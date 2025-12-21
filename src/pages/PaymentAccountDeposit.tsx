// src/pages/PaymentAccountDeposit.tsx
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";
import { getUserProfile, verifyTransactionPin } from "@/services/userService";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import {
  getPrimaryAccount,
  getCustomerDisplayName,
  depositToPaymentAccount,
  type BankAccount,
} from "@/services/accountService";
import {
  push,
  ref,
  set,
  get,
  update,
  query,
  orderByChild,
  equalTo,
  runTransaction,
} from "firebase/database";

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

// ================== APPS SCRIPT URL (Stripe server verify) ==================
// ✅ Dùng URL public dạng script.google.com/macros/s/.../exec
const STRIPE_GAS_URL =
  "https://script.google.com/macros/s/AKfycbyUw6r7YvNzgG0pwJpRZlB6f-OONQFxH8GvPtgHltbEAO4Bwl30PBYbSXascTYwKIkY/exec";

// ⚠️ Demo: số tiền cố định
const STRIPE_FIXED_AMOUNT = 1000000;

// ================== TYPES ==================
type Direction = "IN" | "OUT";

type StripeTopupStatus =
  | "CREATED"
  | "PAID_PENDING_2FA"
  | "CREDITING"
  | "COMPLETED"
  | "CANCELED";

type StripeTopup = {
  topupId: string;
  uid: string;
  accountNumber: string;
  amount: number;
  status: StripeTopupStatus;
  createdAt: number;
  updatedAt: number;

  checkoutSessionId?: string;
  checkoutUrl?: string;
  paymentStatus?: string;

  verifiedPaidAt?: number;
  creditingAt?: number;
  creditedAt?: number;
  completedAt?: number;
  canceledAt?: number;
};

type GasCreateSessionOk = { ok: true; checkoutUrl: string; sessionId: string };
type GasCreateSessionFail = { ok: false; error: string };
type GasCreateSessionResp = GasCreateSessionOk | GasCreateSessionFail;

type GasVerifySessionOk = {
  ok: true;
  paid: boolean;
  sessionId: string;
  payment_status: string | null;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
};
type GasVerifySessionFail = { ok: false; error: string };
type GasVerifySessionResp = GasVerifySessionOk | GasVerifySessionFail;

// ================== SAFE HELPERS ==================
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function toErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

// ✅ Normalize status (fix DB lỡ ghi "paid" / "PAID-PENDING-2FA"…)
function normalizeTopupStatus(raw: unknown): StripeTopupStatus | null {
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();

  if (upper === "CREATED") return "CREATED";
  if (upper === "CREDITING") return "CREDITING";
  if (upper === "COMPLETED") return "COMPLETED";
  if (upper === "CANCELED" || upper === "CANCELLED") return "CANCELED";

  if (upper === "PAID_PENDING_2FA") return "PAID_PENDING_2FA";
  if (upper === "PAID-PENDING-2FA") return "PAID_PENDING_2FA";
  if (upper === "PAID") return "PAID_PENDING_2FA"; // <-- case anh gặp

  return null;
}

// ✅ Helper format/parse số tiền nhập
const formatVndInput = (raw: string): string => {
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return "";
  const n = Number(digitsOnly);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("vi-VN").format(n);
};
const parseVndInput = (formatted: string): number => {
  const digitsOnly = formatted.replace(/[^\d]/g, "");
  if (!digitsOnly) return 0;
  const n = Number(digitsOnly);
  return Number.isFinite(n) ? n : 0;
};

// Helper: ghi log biến động số dư (Nạp / Rút)
async function createBalanceChangeNotification(params: {
  uid: string;
  direction: Direction;
  title: string;
  message: string;
  amount: number;
  accountNumber: string;
  balanceAfter: number;
}): Promise<void> {
  const { uid, direction, title, message, amount, accountNumber, balanceAfter } =
    params;

  const notiListRef = ref(firebaseRtdb, `notifications/${uid}`);
  const newRef = push(notiListRef);
  const createdAt = Date.now();

  await set(newRef, {
    type: "BALANCE_CHANGE",
    direction,
    title,
    message,
    amount,
    accountNumber,
    balanceAfter,
    transactionId: newRef.key,
    createdAt,
  });
}

const PaymentAccountDeposit = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [holderName, setHolderName] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [pin, setPin] = useState<string>("");

  const [loadingAccount, setLoadingAccount] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [pendingTopup, setPendingTopup] = useState<StripeTopup | null>(null);

  // ✅ chống auto-verify lặp lại nhiều lần
  const autoVerifiedSessionRef = useRef<string | null>(null);

  const numericAmount = useMemo(() => parseVndInput(amount), [amount]);

  const isCreated = pendingTopup?.status === "CREATED";
  const isPaidPending = pendingTopup?.status === "PAID_PENDING_2FA";
  const isCrediting = pendingTopup?.status === "CREDITING";

  const formatCurrency = (value: number | undefined): string => {
    if (typeof value !== "number" || Number.isNaN(value)) return "0";
    return value.toLocaleString("vi-VN");
  };

  // ================== RTDB HELPERS ==================
  async function loadLatestActiveTopup(
    uid: string,
    accountNumber: string
  ): Promise<StripeTopup | null> {
    try {
      const baseRef = ref(firebaseRtdb, `stripeTopups/${uid}`);
      const q = query(baseRef, orderByChild("accountNumber"), equalTo(accountNumber));
      const snap = await get(q);
      if (!snap.exists()) return null;

      let best: StripeTopup | null = null;

      snap.forEach((child) => {
        const v = child.val() as unknown;
        if (!isRecord(v)) return;

        const status = normalizeTopupStatus(v.status) ?? undefined;

        if (
          status !== "CREATED" &&
          status !== "PAID_PENDING_2FA" &&
          status !== "CREDITING"
        ) {
          return;
        }

        const item: StripeTopup = {
          topupId: child.key ?? "",
          uid,
          accountNumber: String(v.accountNumber ?? ""),
          amount: Number(v.amount ?? 0),
          status,
          createdAt: Number(v.createdAt ?? 0),
          updatedAt: Number(v.updatedAt ?? 0),
          checkoutSessionId: asString(v.checkoutSessionId),
          checkoutUrl: asString(v.checkoutUrl),
          paymentStatus: asString(v.paymentStatus),
          verifiedPaidAt: asNumber(v.verifiedPaidAt),
          creditingAt: asNumber(v.creditingAt),
          creditedAt: asNumber(v.creditedAt),
          completedAt: asNumber(v.completedAt),
          canceledAt: asNumber(v.canceledAt),
        };

        const itemTime = item.updatedAt || item.createdAt;
        const bestTime = best ? best.updatedAt || best.createdAt : 0;
        if (!best || itemTime > bestTime) best = item;
      });

      return best;
    } catch (e) {
      console.error("loadLatestActiveTopup error:", e);
      return null;
    }
  }

  async function createTopupCreated(params: {
    uid: string;
    accountNumber: string;
    amount: number;
    checkoutSessionId: string;
    checkoutUrl: string;
  }): Promise<StripeTopup> {
    const { uid, accountNumber, amount, checkoutSessionId, checkoutUrl } = params;

    const listRef = ref(firebaseRtdb, `stripeTopups/${uid}`);
    const newRef = push(listRef);
    const now = Date.now();

    const topup: StripeTopup = {
      topupId: newRef.key ?? `topup_${now}`,
      uid,
      accountNumber,
      amount,
      status: "CREATED",
      createdAt: now,
      updatedAt: now,
      checkoutSessionId,
      checkoutUrl,
    };

    await set(newRef, {
      uid,
      accountNumber,
      amount,
      status: "CREATED",
      createdAt: now,
      updatedAt: now,
      checkoutSessionId,
      checkoutUrl,
    });

    return topup;
  }

  async function cancelTopup(uid: string, topupId: string): Promise<void> {
    const now = Date.now();
    await update(ref(firebaseRtdb, `stripeTopups/${uid}/${topupId}`), {
      status: "CANCELED",
      updatedAt: now,
      canceledAt: now,
    });
  }

  async function markPaidPending(uid: string, topupId: string, paymentStatus?: string) {
    const now = Date.now();
    await update(ref(firebaseRtdb, `stripeTopups/${uid}/${topupId}`), {
      status: "PAID_PENDING_2FA",
      updatedAt: now,
      verifiedPaidAt: now,
      // ✅ paymentStatus chỉ là metadata, KHÔNG bao giờ là status
      paymentStatus: typeof paymentStatus === "string" ? paymentStatus : "paid",
    });
  }

  // ================== APPS SCRIPT CALLS (NO JSON - NO PREFLIGHT) ==================
  async function gasCreateSession(params: {
    uid: string;
    accountNumber: string;
    amount: number;
  }): Promise<GasCreateSessionResp> {
    // ✅ form-urlencoded để tránh preflight
    const form = new URLSearchParams();
    form.set("action", "create_session");
    form.set("uid", params.uid);
    form.set("accountNumber", params.accountNumber);
    form.set("amount", String(params.amount));
    form.set("successUrl", "https://example.com/success");
    form.set("cancelUrl", "https://example.com/cancel");

    const res = await fetch(STRIPE_GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
    });

    const raw = (await res.json()) as unknown;

    if (!isRecord(raw) || typeof raw.ok !== "boolean") {
      return { ok: false, error: "Phản hồi từ Apps Script không hợp lệ." };
    }

    if (raw.ok === true) {
      const checkoutUrl = asString(raw.checkoutUrl);
      const sessionId = asString(raw.sessionId);
      if (!checkoutUrl || !sessionId) {
        return { ok: false, error: "Thiếu checkoutUrl/sessionId từ Apps Script." };
      }
      return { ok: true, checkoutUrl, sessionId };
    }

    return { ok: false, error: asString(raw.error) ?? "Không thể tạo phiên thanh toán Stripe." };
  }

  async function gasVerifySession(sessionId: string): Promise<GasVerifySessionResp> {
    const url = `${STRIPE_GAS_URL}?action=verify_session&sessionId=${encodeURIComponent(
      sessionId
    )}`;

    const res = await fetch(url, { method: "GET" });
    const raw = (await res.json()) as unknown;

    if (!isRecord(raw) || typeof raw.ok !== "boolean") {
      return { ok: false, error: "Phản hồi từ Apps Script không hợp lệ." };
    }

    if (raw.ok === true) {
      return {
        ok: true,
        paid: Boolean(raw.paid),
        sessionId: String(raw.sessionId ?? sessionId),
        payment_status: (raw.payment_status ?? null) as string | null,
        amount_total: typeof raw.amount_total === "number" ? raw.amount_total : null,
        currency: typeof raw.currency === "string" ? raw.currency : null,
        metadata: isRecord(raw.metadata) ? (raw.metadata as Record<string, unknown>) : {},
      };
    }

    return { ok: false, error: asString(raw.error) ?? "Xác minh thất bại." };
  }

  async function openUrl(url: string) {
    const platform = Capacitor.getPlatform();
    if (platform === "web") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    await Browser.open({ url, presentationStyle: "fullscreen" });
  }

  // ================== AUTH LOAD ==================
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setAccount(null);
        setHolderName(null);
        setPendingTopup(null);
        setLoadingAccount(false);
        autoVerifiedSessionRef.current = null;
        return;
      }

      try {
        setLoadingAccount(true);
        const [acc, name] = await Promise.all([
          getPrimaryAccount(user.uid),
          getCustomerDisplayName(user.uid),
        ]);

        setAccount(acc);
        setHolderName(name);

        if (acc) {
          const active = await loadLatestActiveTopup(user.uid, acc.accountNumber);
          setPendingTopup(active);
        } else {
          setPendingTopup(null);
        }
      } finally {
        setLoadingAccount(false);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Reload mỗi lần quay lại màn hình
  useEffect(() => {
    const reload = async () => {
      if (!firebaseUser || !account) return;
      const active = await loadLatestActiveTopup(firebaseUser.uid, account.accountNumber);
      setPendingTopup(active);
    };
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // ✅ AUTO-VERIFY khi quay lại mà status vẫn CREATED nhưng Stripe đã paid
  useEffect(() => {
    const run = async () => {
      if (!firebaseUser || !account || !pendingTopup) return;
      if (pendingTopup.accountNumber !== account.accountNumber) return;
      if (pendingTopup.status !== "CREATED") return;
      if (!pendingTopup.checkoutSessionId) return;

      const sid = pendingTopup.checkoutSessionId;
      if (autoVerifiedSessionRef.current === sid) return;

      autoVerifiedSessionRef.current = sid;

      try {
        const v = await gasVerifySession(sid);
        if (!v.ok || !v.paid) return;

        const amountTotal = Number(v.amount_total ?? 0);
        const currency = String(v.currency ?? "").toLowerCase();

        if (currency !== "vnd") return;
        if (amountTotal !== Number(pendingTopup.amount)) return;

        await markPaidPending(firebaseUser.uid, pendingTopup.topupId, v.payment_status ?? "paid");

        const now = Date.now();
        setPendingTopup({
          ...pendingTopup,
          status: "PAID_PENDING_2FA",
          verifiedPaidAt: now,
          updatedAt: now,
          paymentStatus: v.payment_status ?? "paid",
        });

        toast.success("Stripe: phát hiện giao dịch đã thanh toán. Bạn có thể hoàn tất cộng tiền.");
      } catch (e) {
        console.warn("auto verify failed:", e);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTopup?.topupId, pendingTopup?.status, pendingTopup?.checkoutSessionId]);

  // ================== PAY VIA STRIPE ==================
  const handlePayViaStripe = async () => {
    setErrorMsg("");

    if (!firebaseUser) return setErrorMsg("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    if (!account) return setErrorMsg("Không tìm thấy tài khoản thanh toán trên hệ thống.");
    if (!numericAmount || numericAmount <= 0) return setErrorMsg("Vui lòng nhập số tiền nạp hợp lệ.");

    if (numericAmount !== STRIPE_FIXED_AMOUNT) {
      return setErrorMsg(
        `Demo Stripe hiện chỉ hỗ trợ gói nạp cố định ${STRIPE_FIXED_AMOUNT.toLocaleString("vi-VN")} VND. Vui lòng nhập đúng số tiền này.`
      );
    }

    const pinTrim = pin.trim();
    if (!pinTrim) return setErrorMsg("Vui lòng nhập mã PIN giao dịch.");

    // ✅ PIN đúng mới cho tạo session + mở Stripe
    try {
      await verifyTransactionPin(firebaseUser.uid, pinTrim);
    } catch (err) {
      const msg = toErrorMessage(err, "Mã PIN giao dịch không đúng.");
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    try {
      setSubmitting(true);

      // mở lại nếu đã có active topup
      if (
        pendingTopup &&
        pendingTopup.accountNumber === account.accountNumber &&
        pendingTopup.amount === numericAmount &&
        (pendingTopup.status === "CREATED" ||
          pendingTopup.status === "PAID_PENDING_2FA" ||
          pendingTopup.status === "CREDITING") &&
        pendingTopup.checkoutUrl
      ) {
        toast.message("Đang mở trang thanh toán Stripe...");
        await openUrl(pendingTopup.checkoutUrl);
        return;
      }

      toast.message("Đang tạo phiên thanh toán Stripe...");

      const resp = await gasCreateSession({
        uid: firebaseUser.uid,
        accountNumber: account.accountNumber,
        amount: numericAmount,
      });

     if (!resp.ok) {
  const errMsg =
    "error" in resp && typeof resp.error === "string" && resp.error.trim()
      ? resp.error
      : "Không thể tạo phiên thanh toán Stripe.";
  toast.error(errMsg);
  return;
}


      const topup = await createTopupCreated({
        uid: firebaseUser.uid,
        accountNumber: account.accountNumber,
        amount: numericAmount,
        checkoutSessionId: resp.sessionId,
        checkoutUrl: resp.checkoutUrl,
      });

      setPendingTopup(topup);

      toast.message("Đang mở trang thanh toán Stripe...");
      await openUrl(resp.checkoutUrl);
    } catch (e) {
      console.error(e);
      toast.error(toErrorMessage(e, "Không thể mở trang thanh toán Stripe."));
    } finally {
      setSubmitting(false);
    }
  };

  // ================== VERIFY PAID (REAL) ==================
  const handleVerifyPayment = async () => {
    setErrorMsg("");

    if (!firebaseUser) return setErrorMsg("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    if (!account) return setErrorMsg("Không tìm thấy tài khoản thanh toán trên hệ thống.");
    if (!pendingTopup || pendingTopup.status !== "CREATED") {
      toast.error("Không có giao dịch cần xác minh.");
      return;
    }
    if (!pendingTopup.checkoutSessionId) {
      toast.error("Thiếu sessionId để xác minh. Vui lòng tạo lại giao dịch.");
      return;
    }

    try {
      setSubmitting(true);
      toast.message("Đang xác minh thanh toán từ Stripe...");

      const resp = await gasVerifySession(pendingTopup.checkoutSessionId);

      if (!resp.ok) {
  const errMsg =
    "error" in resp && typeof resp.error === "string" && resp.error.trim()
      ? resp.error
      : "Không thể tạo phiên thanh toán Stripe.";
  toast.error(errMsg);
  return;
}


      if (!resp.paid) {
        toast.error("Stripe chưa ghi nhận thanh toán (payment_status chưa phải PAID).");
        return;
      }

      const amountTotal = Number(resp.amount_total ?? 0);
      const currency = String(resp.currency ?? "").toLowerCase();

      if (currency !== "vnd") {
        toast.error("Sai loại tiền tệ (không phải VND).");
        return;
      }

      if (amountTotal !== pendingTopup.amount) {
        toast.error("Số tiền thanh toán không khớp giao dịch nạp.");
        return;
      }

      await markPaidPending(firebaseUser.uid, pendingTopup.topupId, resp.payment_status ?? "paid");

      setPendingTopup((prev) =>
        prev
          ? {
              ...prev,
              status: "PAID_PENDING_2FA",
              verifiedPaidAt: Date.now(),
              updatedAt: Date.now(),
              paymentStatus: resp.payment_status ?? "paid",
            }
          : prev
      );

      toast.success("✅ Đã xác minh Stripe. Bây giờ có thể hoàn tất cộng tiền.");
    } catch (e) {
      console.error(e);
      toast.error(toErrorMessage(e, "Không thể xác minh. Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  // ================== COMPLETE (CỘNG TIỀN) ==================
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (submitting) return;

    const n = numericAmount;

    if (!n || n <= 0) return setErrorMsg("Vui lòng nhập số tiền nạp hợp lệ.");
    if (n !== STRIPE_FIXED_AMOUNT) {
      return setErrorMsg(
        `Demo Stripe hiện chỉ hỗ trợ gói nạp cố định ${STRIPE_FIXED_AMOUNT.toLocaleString("vi-VN")} VND. Vui lòng nhập đúng số tiền này.`
      );
    }

    const pinTrim = pin.trim();
    if (!pinTrim) return setErrorMsg("Vui lòng nhập mã PIN giao dịch.");
    if (!firebaseUser) return setErrorMsg("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    if (!account) return setErrorMsg("Không tìm thấy tài khoản thanh toán trên hệ thống.");

    // ✅ chỉ cho cộng tiền khi đã verify PAID thật
    if (!pendingTopup || pendingTopup.status !== "PAID_PENDING_2FA") {
      setErrorMsg("Bạn cần xác minh thanh toán Stripe trước khi hoàn tất.");
      toast.error("Chưa xác minh thanh toán Stripe.");
      return;
    }

    if (pendingTopup.accountNumber !== account.accountNumber || pendingTopup.amount !== n) {
      setErrorMsg("Giao dịch Stripe không khớp số tiền/tài khoản. Vui lòng tạo lại.");
      toast.error("Giao dịch Stripe không khớp. Vui lòng tạo lại.");
      return;
    }

    const topupRef = ref(
      firebaseRtdb,
      `stripeTopups/${firebaseUser.uid}/${pendingTopup.topupId}`
    );

    try {
      setSubmitting(true);

      // ✅ LOCK chống double: PAID_PENDING_2FA -> CREDITING
      const lockTx = await runTransaction(
        topupRef,
        (current: unknown) => {
          if (!isRecord(current)) return current;

          const status = normalizeTopupStatus(current.status) ?? undefined;
          const creditedAt = asNumber(current.creditedAt);

          if (creditedAt) return; // abort
          if (status !== "PAID_PENDING_2FA") return; // abort

          return {
            ...current,
            status: "CREDITING",
            creditingAt: Date.now(),
            updatedAt: Date.now(),
          };
        },
        { applyLocally: false }
      );

      if (!lockTx.committed) {
        throw new Error("Giao dịch đã được xử lý hoặc không hợp lệ. Vui lòng tải lại.");
      }

      // 1) cộng tiền
      await depositToPaymentAccount(firebaseUser.uid, { amount: n, pin: pinTrim });

      // 2) completed
      const now = Date.now();
      await update(topupRef, {
        status: "COMPLETED",
        updatedAt: now,
        creditedAt: now,
        completedAt: now,
      });

      // 3) noti biến động số dư
      const currentBalance =
        typeof account.balance === "number" ? account.balance : Number(account.balance ?? 0);
      const balanceAfter = currentBalance + n;

      await createBalanceChangeNotification({
        uid: firebaseUser.uid,
        direction: "IN",
        title: "Nạp tiền vào tài khoản thanh toán (Stripe)",
        message: `Nạp ${n.toLocaleString("vi-VN")} VND qua Stripe vào tài khoản ${account.accountNumber}.`,
        amount: n,
        accountNumber: account.accountNumber,
        balanceAfter,
      });

      toast.success("Nạp tiền thành công vào tài khoản thanh toán.");
      setPendingTopup(null);
      navigate(-1);
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Có lỗi xảy ra, vui lòng thử lại.");
      setErrorMsg(message);
      toast.error(message);

      // rollback nếu đang CREDITING mà fail
      try {
        const snap = await get(topupRef);
        const cur = snap.val() as unknown;

        if (isRecord(cur)) {
          const status = normalizeTopupStatus(cur.status);
          const creditedAt = asNumber(cur.creditedAt);

          if (status === "CREDITING" && !creditedAt) {
            await update(topupRef, { status: "PAID_PENDING_2FA", updatedAt: Date.now() });
          }
        }
      } catch {
        // ignore
      }

      // show remaining PIN tries (nếu lỗi PIN)
      if (firebaseUser && message.includes("Mã PIN giao dịch không đúng")) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            const withPin = profile as { pinFailCount?: number | null };
            const failCount = withPin.pinFailCount ?? 0;
            const remaining = Math.max(0, 5 - failCount);

            if (remaining > 0) {
              toast.error(`Sai mã PIN. Bạn còn ${remaining} lần thử trước khi tài khoản bị tạm khóa.`);
            } else {
              toast.error("Bạn đã nhập sai mã PIN quá 5 lần. Tài khoản đã bị tạm khóa.");
            }
          }
        } catch (err) {
          console.error("Không lấy được số lần sai PIN:", err);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPending = async () => {
    if (!firebaseUser || !pendingTopup) return;
    try {
      await cancelTopup(firebaseUser.uid, pendingTopup.topupId);
      setPendingTopup(null);
      toast.success("Đã hủy giao dịch nạp đang chờ.");
    } catch (e) {
      console.error(e);
      toast.error("Không thể hủy giao dịch đang chờ.");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-primary-foreground hover:bg-white/25 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              Nạp tiền tài khoản thanh toán
            </h1>
            {account && (
              <p className="text-sm text-primary-foreground/80">
                {account.accountNumber} · {holderName ?? "Chủ tài khoản"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 -mt-4 space-y-4">
        {loadingAccount ? (
          <Card className="p-6 text-sm text-muted-foreground">Đang tải thông tin tài khoản...</Card>
        ) : !account ? (
          <Card className="p-6 text-sm text-muted-foreground">Không tìm thấy tài khoản thanh toán trên hệ thống.</Card>
        ) : (
          <>
            {/* Banner */}
            {pendingTopup &&
              (pendingTopup.status === "CREATED" ||
                pendingTopup.status === "PAID_PENDING_2FA" ||
                pendingTopup.status === "CREDITING") && (
                <Card className="p-4 max-w-md mx-auto border border-primary/30">
                  <p className="text-sm font-semibold text-foreground">
                    {pendingTopup.status === "CREATED" &&
                      "Bạn đã tạo 1 giao dịch nạp (chưa xác minh thanh toán)"}
                    {pendingTopup.status === "PAID_PENDING_2FA" &&
                      "Đã xác minh Stripe – chờ cộng tiền"}
                    {pendingTopup.status === "CREDITING" &&
                      "Đang cộng tiền, vui lòng không thao tác thêm"}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Số tiền: <b>{pendingTopup.amount.toLocaleString("vi-VN")} VND</b> • Trạng thái:{" "}
                    <b>{pendingTopup.status}</b>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={handlePayViaStripe}
                      disabled={isCrediting || submitting}
                    >
                      Mở Stripe
                    </Button>

                    <Button
                      type="button"
                      className="rounded-full"
                      onClick={handleVerifyPayment}
                      disabled={!isCreated || isCrediting || submitting}
                      title={!isCreated ? "Chỉ xác minh khi đang ở trạng thái CREATED" : undefined}
                    >
                      Xác minh thanh toán
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-full"
                      onClick={handleCancelPending}
                      disabled={isCrediting || submitting}
                    >
                      Hủy
                    </Button>
                  </div>

                  {isCreated && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      * Sau khi thanh toán trên Stripe, bấm <b>Xác minh thanh toán</b> để hệ thống kiểm tra PAID thật.
                    </p>
                  )}
                </Card>
              )}

            {/* Account info */}
            <Card className="p-6 space-y-4 max-w-md mx-auto">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Số tài khoản</span>
                <span className="font-medium">{account.accountNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Chủ tài khoản</span>
                <span className="font-medium">{holderName ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Số dư hiện tại</span>
                <span className="font-semibold text-primary">
                  {formatCurrency(account.balance)} VND
                </span>
              </div>
            </Card>

            {/* Form */}
            <Card className="p-6 space-y-4 max-w-md mx-auto">
              <form
                onSubmit={handleSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="space-y-4"
                autoComplete="off"
              >
                <input type="text" name="fake-username" autoComplete="username" className="hidden" />
                <input type="password" name="fake-password" autoComplete="new-password" className="hidden" />

                <div className="space-y-1">
                  <label className="text-sm font-medium">Số tiền nạp</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9.]*"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={`Nhập đúng ${STRIPE_FIXED_AMOUNT.toLocaleString("vi-VN")} (VND) để demo Stripe`}
                    value={amount}
                    onChange={(e) => setAmount(formatVndInput(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Demo Stripe: gói cố định <b>{STRIPE_FIXED_AMOUNT.toLocaleString("vi-VN")} VND</b>
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Mã PIN giao dịch</label>
                  <input
                    type="password"
                    name="transaction-pin"
                    autoComplete="off"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="••••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>

                {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

                <div className="grid grid-cols-1 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full font-semibold"
                    onClick={handlePayViaStripe}
                    disabled={submitting || isCrediting}
                  >
                    Thanh toán qua Stripe
                  </Button>

                  <Button
                    type="submit"
                    className="w-full rounded-full font-semibold"
                    disabled={submitting || !isPaidPending || isCrediting}
                    title={!isPaidPending ? "Bạn cần xác minh thanh toán Stripe trước" : undefined}
                  >
                    {submitting ? "Đang xử lý..." : "Hoàn tất nạp tiền (Cộng tiền)"}
                  </Button>

                  {!isPaidPending && (
                    <p className="text-xs text-muted-foreground text-center">
                      Sau khi thanh toán Stripe, bấm <b>Xác minh thanh toán</b> để hệ thống kiểm tra PAID thật, rồi mới hoàn tất cộng tiền.
                    </p>
                  )}
                </div>
              </form>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentAccountDeposit;
