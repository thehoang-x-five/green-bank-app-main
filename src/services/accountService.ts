// src/services/accountService.ts
import { firebaseRtdb } from "@/lib/firebase";
import {
  ref,
  get,
  runTransaction,
  push,
  set,
  serverTimestamp,
  update,
  query,
  orderByChild,
  equalTo,
  limitToFirst,
} from "firebase/database";
import { getUserProfile, verifyTransactionPin } from "@/services/userService";
import type { AppUserProfile } from "@/services/authService";

const HIGH_VALUE_THRESHOLD_VND = 10_000_000;

export interface BankAccount {
  accountNumber: string;
  uid: string;
  balance: number;
  status: "ACTIVE" | "LOCKED";
  createdAt: number;
}

export interface CashOperationPayload {
  amount: number;
  pin: string;
  accountNumber?: string;
}

interface AccountNode {
  uid?: string;
  balance?: number | string;
  status?: string;
  createdAt?: number | string;
  [key: string]: unknown;
}

type UserWithEkycFlags = AppUserProfile & {
  ekycStatus?: string;
  kycStatus?: string;
  canTransact?: boolean;
};

type UserWithPinFlags = AppUserProfile & {
  pinFailCount?: number | null;
};

function safeNumber(n: unknown, fallback = 0): number {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string") {
    const cleaned = n.replace(/[,_\s]/g, "");
    const v = Number(cleaned);
    return Number.isFinite(v) ? v : fallback;
  }
  return fallback;
}

function normalizeStatus(raw: unknown): "ACTIVE" | "LOCKED" {
  return raw === "LOCKED" ? "LOCKED" : "ACTIVE";
}

export async function getPrimaryAccount(uid: string): Promise<BankAccount | null> {
  try {
    const q = query(
      ref(firebaseRtdb, "accounts"),
      orderByChild("uid"),
      equalTo(uid),
      limitToFirst(1)
    );

    const snapshot = await get(q);
    if (!snapshot.exists()) return null;

    let found: BankAccount | null = null;

    snapshot.forEach((childSnap) => {
      const raw = childSnap.val() as AccountNode;

      found = {
        accountNumber: childSnap.key ?? "",
        uid: String(raw.uid ?? ""),
        balance: safeNumber(raw.balance, 0),
        status: normalizeStatus(raw.status),
        createdAt: safeNumber(raw.createdAt, Date.now()),
      };

      return true; // stop
    });

    return found;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("getPrimaryAccount error:", error);
    return null;
  }
}

/**
 * ✅ NEW: Lấy TẤT CẢ tài khoản thanh toán thuộc về uid (không limitToFirst)
 * - Không thay đổi logic cũ của getPrimaryAccount()
 * - Dùng cho các màn cần user chọn đúng tài khoản để trích tiền (vd: đóng lãi thế chấp)
 */
export async function getPaymentAccountsByUid(uid: string): Promise<BankAccount[]> {
  try {
    const q = query(ref(firebaseRtdb, "accounts"), orderByChild("uid"), equalTo(uid));

    const snapshot = await get(q);
    if (!snapshot.exists()) return [];

    const list: BankAccount[] = [];

    snapshot.forEach((childSnap) => {
      const raw = childSnap.val() as AccountNode;

      list.push({
        accountNumber: childSnap.key ?? "",
        uid: String(raw.uid ?? ""),
        balance: safeNumber(raw.balance, 0),
        status: normalizeStatus(raw.status),
        createdAt: safeNumber(raw.createdAt, Date.now()),
      });

      return false; // continue
    });

    // sort ổn định: cũ -> mới, nếu bằng nhau thì theo accountNumber
    list.sort((a, b) => {
      const d = a.createdAt - b.createdAt;
      if (d !== 0) return d;
      return a.accountNumber.localeCompare(b.accountNumber);
    });

    return list;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("getPaymentAccountsByUid error:", error);
    return [];
  }
}

export async function getCustomerDisplayName(uid: string): Promise<string | null> {
  try {
    const snapshot = await get(ref(firebaseRtdb, `users/${uid}`));
    if (!snapshot.exists()) return null;

    const data = snapshot.val() as { username?: string };
    return data.username ?? null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("getCustomerDisplayName error:", error);
    return null;
  }
}

async function ensureUserCanTransact(uid: string): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) throw new Error("Không tìm thấy thông tin khách hàng.");

  const extended: UserWithEkycFlags = profile;

  const rawStatus =
    typeof extended.ekycStatus === "string"
      ? extended.ekycStatus
      : typeof extended.kycStatus === "string"
        ? extended.kycStatus
        : "";

  const normalized = rawStatus.toUpperCase();
  const canTransact = Boolean(extended.canTransact);

  if (normalized !== "VERIFIED" || !canTransact) {
    throw new Error(
      "Tài khoản của bạn chưa được xác thực eKYC hoặc chưa được phép giao dịch. Vui lòng liên hệ ngân hàng."
    );
  }
}

async function lockAccountByNumber(accountNumber: string): Promise<void> {
  const accRef = ref(firebaseRtdb, `accounts/${accountNumber}`);
  await update(accRef, { status: "LOCKED" });
}

async function createNotificationForUser(
  uid: string,
  payload: { type: string; title: string; message: string }
): Promise<void> {
  const notifRef = push(ref(firebaseRtdb, `notifications/${uid}`));
  await set(notifRef, {
    type: payload.type,
    title: payload.title,
    message: payload.message,
    createdAt: serverTimestamp(),
    read: false,
  });
}

async function lockAccountIfTooManyPinFails(uid: string, accountNumber: string): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) return;

  const withPin: UserWithPinFlags = profile;
  const failCount = withPin.pinFailCount ?? 0;

  if (failCount >= 5) {
    await lockAccountByNumber(accountNumber);
  }
}

async function getAccountByNumberForOwner(
  uid: string,
  accountNumber: string
): Promise<BankAccount | null> {
  try {
    const snap = await get(ref(firebaseRtdb, `accounts/${accountNumber}`));
    if (!snap.exists()) return null;

    const raw = snap.val() as AccountNode;
    if (String(raw.uid ?? "") !== uid) return null;

    return {
      accountNumber,
      uid,
      balance: safeNumber(raw.balance, 0),
      status: normalizeStatus(raw.status),
      createdAt: safeNumber(raw.createdAt, Date.now()),
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("getAccountByNumberForOwner error:", e);
    return null;
  }
}

async function resolveAccount(uid: string, payload: CashOperationPayload): Promise<BankAccount> {
  const hint = payload.accountNumber?.trim();
  if (hint) {
    const byNo = await getAccountByNumberForOwner(uid, hint);
    if (byNo) return byNo;
  }

  const primary = await getPrimaryAccount(uid);
  if (!primary) throw new Error("Không tìm thấy tài khoản thanh toán.");
  return primary;
}

export async function depositToPaymentAccount(uid: string, payload: CashOperationPayload): Promise<void> {
  const amount = Number(payload.amount);
  const pin = payload.pin?.trim();

  if (!amount || amount <= 0) throw new Error("Số tiền nạp phải lớn hơn 0.");
  if (!pin) throw new Error("Vui lòng nhập mã PIN giao dịch.");

  await ensureUserCanTransact(uid);

  const account = await resolveAccount(uid, payload);

  if (account.status !== "ACTIVE") {
    throw new Error("Tài khoản đang bị khóa, không thể nạp tiền.");
  }

  try {
    await verifyTransactionPin(uid, pin);
  } catch (error) {
    await lockAccountIfTooManyPinFails(uid, account.accountNumber);
    throw error;
  }

  const accountRef = ref(firebaseRtdb, `accounts/${account.accountNumber}`);

  const tx = await runTransaction(accountRef, (currentData) => {
    const current = (currentData ?? null) as AccountNode | null;

    const base: AccountNode =
      current && typeof current === "object"
        ? current
        : { uid, status: "ACTIVE", createdAt: Date.now(), balance: 0 };

    if (typeof base.uid === "string" && base.uid !== uid) return;

    const currentBalance = safeNumber(base.balance, 0);

    return { ...base, balance: currentBalance + amount };
  });

  if (!tx.committed) throw new Error("Không thể nạp tiền, vui lòng thử lại.");

  const txListRef = ref(firebaseRtdb, `accountTransactions/${account.accountNumber}`);
  const newTxRef = push(txListRef);

  await set(newTxRef, {
    type: "CASH_DEPOSIT",
    direction: "IN",
    amount,
    currency: "VND",
    createdAt: serverTimestamp(),
    description: "Nạp tiền mặt vào tài khoản thanh toán",
  });

  await createNotificationForUser(uid, {
    type: "CASH_DEPOSIT",
    title: "Nạp tiền thành công",
    message: `Bạn đã nạp ${amount.toLocaleString("vi-VN")} VND vào tài khoản ${account.accountNumber}.`,
  });
}

/**
 * ✅ NEW: Finalize Stripe topup (atomic) - chặn cộng tiền vô hạn
 * - Chỉ finalize nếu topup.status === "PAID_PENDING_2FA" và creditedAt chưa có
 * - Update balance + set topup COMPLETED trong 1 transaction root
 */
type StripeTopupNode = {
  uid?: string;
  accountNumber?: string;
  amount?: number;
  status?: "CREATED" | "PAID_PENDING_2FA" | "COMPLETED" | "CANCELED" | string;
  creditedAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
  stripeLink?: string;
  paidAt?: number;
  completedAt?: number;
  canceledAt?: number;
};

type RootData = {
  accounts?: Record<string, AccountNode>;
  stripeTopups?: Record<string, Record<string, StripeTopupNode>>;
  [key: string]: unknown;
};

function asObjectRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

export async function finalizeStripeTopup(
  uid: string,
  params: { topupId: string; accountNumber: string; amount: number; pin: string }
): Promise<void> {
  const { topupId, accountNumber, amount, pin } = params;

  const n = Number(amount);
  const pinTrim = pin.trim();

  if (!n || n <= 0) throw new Error("Số tiền nạp phải lớn hơn 0.");
  if (!pinTrim) throw new Error("Vui lòng nhập mã PIN giao dịch.");

  await ensureUserCanTransact(uid);

  try {
    await verifyTransactionPin(uid, pinTrim);
  } catch (error) {
    await lockAccountIfTooManyPinFails(uid, accountNumber);
    throw error;
  }

  const rootRef = ref(firebaseRtdb);

  const tx = await runTransaction(rootRef, (currentRoot) => {
    const rootObj = asObjectRecord(currentRoot) ?? {};
    const root: RootData = rootObj as RootData;

    root.accounts = root.accounts ?? {};
    root.stripeTopups = root.stripeTopups ?? {};
    root.stripeTopups[uid] = root.stripeTopups[uid] ?? {};

    const topup = root.stripeTopups[uid][topupId];
    if (!topup) {
      throw new Error("Không tìm thấy giao dịch Stripe.");
    }

    if (topup.status !== "PAID_PENDING_2FA") {
      throw new Error("Giao dịch chưa được xác nhận thanh toán Stripe.");
    }

    if (typeof topup.creditedAt === "number") {
      throw new Error("Giao dịch này đã được cộng tiền trước đó.");
    }

    if (topup.accountNumber !== accountNumber || Number(topup.amount ?? 0) !== n) {
      throw new Error("Giao dịch Stripe không khớp số tiền/tài khoản.");
    }

    const acc = root.accounts[accountNumber];
    if (!acc) {
      throw new Error("Không tìm thấy tài khoản thanh toán.");
    }
    if (String(acc.uid ?? "") !== uid) {
      throw new Error("Tài khoản không thuộc về bạn.");
    }
    if (normalizeStatus(acc.status) !== "ACTIVE") {
      throw new Error("Tài khoản đang bị khóa, không thể nạp tiền.");
    }

    const cur = safeNumber(acc.balance, 0);
    const now = Date.now();

    root.accounts[accountNumber] = { ...acc, balance: cur + n };

    root.stripeTopups[uid][topupId] = {
      ...topup,
      status: "COMPLETED",
      creditedAt: now,
      completedAt: now,
      updatedAt: now,
    };

    return root;
  });

  if (!tx.committed) throw new Error("Không thể hoàn tất nạp tiền, vui lòng thử lại.");

  const txListRef = ref(firebaseRtdb, `accountTransactions/${accountNumber}`);
  const newTxRef = push(txListRef);

  await set(newTxRef, {
    type: "STRIPE_TOPUP",
    direction: "IN",
    amount: n,
    currency: "VND",
    createdAt: serverTimestamp(),
    description: "Nạp tiền qua Stripe (Payment Link)",
  });

  await createNotificationForUser(uid, {
    type: "STRIPE_TOPUP",
    title: "Nạp tiền thành công",
    message: `Bạn đã nạp ${n.toLocaleString("vi-VN")} VND vào tài khoản ${accountNumber}.`,
  });
}

/**
 * ✅ FIX: Rút tiền đọc balance thật + transact trực tiếp /balance (tránh đọc sai/stale)
 */
export async function withdrawFromPaymentAccount(uid: string, payload: CashOperationPayload): Promise<void> {
  const amount = Number(payload.amount);
  const pin = payload.pin?.trim();

  if (!amount || amount <= 0) throw new Error("Số tiền rút phải lớn hơn 0.");
  if (!pin) throw new Error("Vui lòng nhập mã PIN giao dịch.");

  await ensureUserCanTransact(uid);

  const account = await resolveAccount(uid, payload);

  if (account.status !== "ACTIVE") {
    throw new Error("Tài khoản đang bị khóa, không thể rút tiền.");
  }

  try {
    await verifyTransactionPin(uid, pin);
  } catch (error) {
    await lockAccountIfTooManyPinFails(uid, account.accountNumber);
    throw error;
  }

  const accountRef = ref(firebaseRtdb, `accounts/${account.accountNumber}`);
  const accSnap = await get(accountRef);
  if (!accSnap.exists()) throw new Error("Không tìm thấy tài khoản thanh toán.");

  const accNode = accSnap.val() as AccountNode;
  if (String(accNode.uid ?? "") !== uid) {
    throw new Error("Không tìm thấy tài khoản thanh toán (không thuộc về bạn).");
  }
  if (normalizeStatus(accNode.status) !== "ACTIVE") {
    throw new Error("Tài khoản đang bị khóa, không thể rút tiền.");
  }

  const serverBalance = safeNumber(accNode.balance, 0);

  if (serverBalance < amount) {
    throw new Error("Số dư tài khoản không đủ để rút.");
  }

  const balanceRef = ref(firebaseRtdb, `accounts/${account.accountNumber}/balance`);

  let committed = false;

  try {
    const tx = await runTransaction(
      balanceRef,
      (currentValue) => {
        const currentBalance = safeNumber(currentValue, serverBalance);

        if (currentBalance < amount) return currentBalance;

        return currentBalance - amount;
      },
      { applyLocally: false }
    );

    const afterVal = tx.snapshot.val();
    const afterBalance = safeNumber(afterVal, serverBalance);

    committed = tx.committed && afterBalance === serverBalance - amount;
  } catch {
    committed = false;
  }

  if (!committed) {
    const latestSnap = await get(balanceRef);
    const latest = safeNumber(latestSnap.val(), serverBalance);

    if (latest < amount) {
      throw new Error("Số dư tài khoản không đủ để rút.");
    }

    await set(balanceRef, latest - amount);
  }

  const txListRef = ref(firebaseRtdb, `accountTransactions/${account.accountNumber}`);
  const newTxRef = push(txListRef);

  await set(newTxRef, {
    type: "CASH_WITHDRAW",
    direction: "OUT",
    amount,
    currency: "VND",
    createdAt: serverTimestamp(),
    description: "Rút tiền mặt từ tài khoản thanh toán",
  });

  await createNotificationForUser(uid, {
    type: "CASH_WITHDRAW",
    title: "Rút tiền thành công",
    message: `Bạn đã rút ${amount.toLocaleString("vi-VN")} VND từ tài khoản ${account.accountNumber}.`,
  });
}

/* =========================================================
   ✅ OTP WITHDRAW FLOW (PIN -> OTP email -> CONFIRM)
   - Không làm ảnh hưởng withdrawFromPaymentAccount() cũ
   - Resend: CHỈ cho phép khi OTP hiện tại đã HẾT HẠN
========================================================= */

type OtpNode = {
  transactionId: string;
  uid: string;
  email: string;
  otp: string;
  createdAt: number;
  expireAt: number;
  attemptsLeft: number;
  used: boolean;
};

type CashTxnNode = {
  transactionId: string;
  type: "CASH_WITHDRAW";
  status: "PENDING_OTP" | "PROCESSING" | "SUCCESS" | "FAILED";
  customerUid: string;
  sourceAccountNumber: string;
  amount: number;
  fee: number;
  content: string;
  createdAt: number;
  executedAt: number | null;
  
  // ✅ NEW: Biometric fields for high-value transactions
  requiresBiometric?: boolean;
  biometricVerifiedAt?: number | null;
};

export type InitiateWithdrawOtpResponse = {
  transactionId: string;
  maskedEmail: string;
  expireAt: number;
  devOtpCode?: string;
};

export type ConfirmWithdrawOtpResponse = {
  transactionId: string;
  status: "SUCCESS";
  newBalance: number;
};

function generateOtpCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) code += Math.floor(Math.random() * 10).toString();
  return code;
}

function toNumber(v: number | string): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

// ===================== NEW: MARK BIOMETRIC FOR WITHDRAW =====================

export async function markWithdrawTransactionBiometricVerified(transactionId: string): Promise<void> {
  if (!transactionId) throw new Error("Thiếu mã giao dịch.");

  const txnRef = ref(firebaseRtdb, `transactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) throw new Error("Không tìm thấy giao dịch.");

  const txn = txnSnap.val() as CashTxnNode;

  if (txn.type !== "CASH_WITHDRAW") {
    throw new Error("Giao dịch không đúng loại rút tiền.");
  }

  if (txn.status !== "PENDING_OTP") {
    throw new Error("Giao dịch không còn ở trạng thái chờ OTP.");
  }

  const amount = toNumber(txn.amount);
  const requiresBiometric = txn.requiresBiometric === true || amount >= HIGH_VALUE_THRESHOLD_VND;
  
  if (!requiresBiometric) return;

  await update(txnRef, {
    requiresBiometric: true,
    biometricVerifiedAt: Date.now(),
  });
}

async function generateNextTransactionId(): Promise<string> {
  const counterRef = ref(firebaseRtdb, "counters/transactionCounter");

  const result = await runTransaction(counterRef, (current: unknown) => {
    if (typeof current !== "number" || !Number.isFinite(current) || current < 0) return 1;
    return current + 1;
  });

  let value = result.snapshot.val();
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) value = 1;

  return `TXN${String(value).padStart(6, "0")}`;
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function getEnvString(keys: string[]): string | "" {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  for (const k of keys) {
    const v = env[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * ✅ POST x-www-form-urlencoded + no-cors (GIỐNG transfer)
 * -> GAS parseParams_() sẽ đọc được email/otp/transactionId
 * -> tránh CORS "Failed to fetch"
 */
async function postFormNoCors(
  url: string,
  params: URLSearchParams,
  timeoutMs = 12000
): Promise<void> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
      signal: controller.signal,
    });
  } catch {
    throw new Error("Không gửi được OTP email. Vui lòng thử lại.");
  } finally {
    clearTimeout(t);
  }
}

async function sendOtpEmailViaGAS(params: {
  toEmail: string;
  otp: string;
  transactionId: string;
  title: string;
  message: string;
}): Promise<boolean> {
  const webappUrl = getEnvString([
    "VITE_OTP_EMAIL_WEBAPP_URL",
    "VITE_GAS_EMAIL_WEBAPP_URL",
    "VITE_GAS_WEBAPP_URL",
  ]);

  if (!webappUrl) {
    // eslint-disable-next-line no-console
    console.log(`[DEV] OTP ${params.otp} -> ${params.toEmail} (txn ${params.transactionId})`);
    return false;
  }

  // ✅ GAS của anh đang đọc: email, otp, transactionId, purpose, apiKey?
  const form = new URLSearchParams();
  form.set("email", params.toEmail);
  form.set("otp", params.otp);
  form.set("transactionId", params.transactionId);
  form.set("purpose", "WITHDRAW");

  // nếu sau này anh đặt CONFIG.API_KEY thì chỉ cần set env là tự chạy
  const apiKey = getEnvString(["VITE_OTP_EMAIL_API_KEY", "VITE_GAS_EMAIL_API_KEY", "VITE_GAS_API_KEY"]);
  if (apiKey) form.set("apiKey", apiKey);

  await postFormNoCors(webappUrl, form);
  return true;
}

async function createBalanceChangeNotificationDetailed(params: {
  uid: string;
  direction: "IN" | "OUT";
  title: string;
  message: string;
  amount: number;
  accountNumber: string;
  balanceAfter: number;
  transactionId: string;
}): Promise<void> {
  const notiListRef = ref(firebaseRtdb, `notifications/${params.uid}`);
  const newRef = push(notiListRef);
  const createdAt = Date.now();

  await set(newRef, {
    type: "BALANCE_CHANGE",
    direction: params.direction,
    title: params.title,
    message: params.message,
    amount: params.amount,
    accountNumber: params.accountNumber,
    balanceAfter: params.balanceAfter,
    transactionId: params.transactionId,
    createdAt,
  });
}

export async function initiateWithdrawFromPaymentAccountOtp(
  uid: string,
  payload: CashOperationPayload
): Promise<InitiateWithdrawOtpResponse> {
  const amount = Number(payload.amount);
  const pin = payload.pin?.trim();

  if (!amount || amount <= 0) throw new Error("Số tiền rút phải lớn hơn 0.");
  if (!pin) throw new Error("Vui lòng nhập mã PIN giao dịch.");

  await ensureUserCanTransact(uid);

  const account = await resolveAccount(uid, payload);
  if (account.status !== "ACTIVE") {
    throw new Error("Tài khoản đang bị khóa, không thể rút tiền.");
  }

  try {
    await verifyTransactionPin(uid, pin);
  } catch (error) {
    await lockAccountIfTooManyPinFails(uid, account.accountNumber);
    throw error;
  }

  const accountRef = ref(firebaseRtdb, `accounts/${account.accountNumber}`);
  const accSnap = await get(accountRef);
  if (!accSnap.exists()) throw new Error("Không tìm thấy tài khoản thanh toán.");

  const accNode = accSnap.val() as AccountNode;
  if (String(accNode.uid ?? "") !== uid) {
    throw new Error("Không tìm thấy tài khoản thanh toán (không thuộc về bạn).");
  }
  if (normalizeStatus(accNode.status) !== "ACTIVE") {
    throw new Error("Tài khoản đang bị khóa, không thể rút tiền.");
  }

  const serverBalance = safeNumber(accNode.balance, 0);
  if (serverBalance < amount) {
    throw new Error("Số dư tài khoản không đủ để rút.");
  }

  const profile = await getUserProfile(uid);
  if (!profile) throw new Error("Không tìm thấy thông tin khách hàng.");
  if (!profile.email) throw new Error("Không tìm thấy email của bạn để gửi OTP.");

  const txnId = await generateNextTransactionId();
  const now = Date.now();

  const requiresBiometric = amount >= HIGH_VALUE_THRESHOLD_VND;

  const txnData: CashTxnNode = {
    transactionId: txnId,
    type: "CASH_WITHDRAW",
    status: "PENDING_OTP",
    customerUid: uid,
    sourceAccountNumber: account.accountNumber,
    amount,
    fee: 0,
    content: "Rút tiền tài khoản thanh toán",
    createdAt: now,
    executedAt: null,
    requiresBiometric,
    biometricVerifiedAt: null,
  };

  const otp = generateOtpCode(6);
  const expireAt = now + 2 * 60 * 1000;

  const otpData: OtpNode = {
    transactionId: txnId,
    uid,
    email: profile.email,
    otp,
    createdAt: now,
    expireAt,
    attemptsLeft: 5,
    used: false,
  };

  await set(ref(firebaseRtdb, `transactions/${txnId}`), txnData);
  await set(ref(firebaseRtdb, `transactionOtps/${txnId}`), otpData);

  try {
    await sendOtpEmailViaGAS({
      toEmail: profile.email,
      otp,
      transactionId: txnId,
      title: "Rút tiền",
      message: `Bạn đang thực hiện rút ${amount.toLocaleString("vi-VN")} VND từ tài khoản ${account.accountNumber}.`,
    });
  } catch (e: unknown) {
    await set(ref(firebaseRtdb, `transactionOtps/${txnId}`), null);
    await set(ref(firebaseRtdb, `transactions/${txnId}`), null);

    const msg = e instanceof Error ? e.message : "Gửi OTP thất bại.";
    throw new Error(`Gửi OTP thất bại: ${msg}`);
  }

  const devShown = !getEnvString([
    "VITE_OTP_EMAIL_WEBAPP_URL",
    "VITE_GAS_EMAIL_WEBAPP_URL",
    "VITE_GAS_WEBAPP_URL",
  ]);

  return {
    transactionId: txnId,
    maskedEmail: maskEmail(profile.email),
    expireAt,
    devOtpCode: devShown ? otp : undefined,
  };
}

export async function resendWithdrawOtpOnlyWhenExpired(
  uid: string,
  transactionId: string
): Promise<{ expireAt: number; maskedEmail: string; devOtpCode?: string }> {
  if (!transactionId) throw new Error("Thiếu mã giao dịch.");

  const otpRef = ref(firebaseRtdb, `transactionOtps/${transactionId}`);
  const otpSnap = await get(otpRef);
  if (!otpSnap.exists()) throw new Error("Không tìm thấy yêu cầu OTP.");

  const otpData = otpSnap.val() as OtpNode;

  if (otpData.uid !== uid) throw new Error("Bạn không có quyền thao tác OTP này.");
  if (otpData.used) throw new Error("OTP đã được sử dụng.");

  const now = Date.now();
  if (now < otpData.expireAt) {
    throw new Error("OTP hiện tại còn hiệu lực. Chỉ được gửi lại khi OTP đã hết hạn.");
  }

  const old = { ...otpData };

  const newOtp = generateOtpCode(6);
  const newExpireAt = now + 2 * 60 * 1000;

  await update(otpRef, {
    otp: newOtp,
    createdAt: now,
    expireAt: newExpireAt,
    attemptsLeft: 5,
    used: false,
  });

  try {
    await sendOtpEmailViaGAS({
      toEmail: otpData.email,
      otp: newOtp,
      transactionId,
      title: "Rút tiền",
      message: `Mã OTP mới cho giao dịch rút tiền ${transactionId}.`,
    });
  } catch (e: unknown) {
    await set(otpRef, old);
    const msg = e instanceof Error ? e.message : "Gửi OTP thất bại.";
    throw new Error(`Gửi OTP thất bại: ${msg}`);
  }

  const devShown = !getEnvString([
    "VITE_OTP_EMAIL_WEBAPP_URL",
    "VITE_GAS_EMAIL_WEBAPP_URL",
    "VITE_GAS_WEBAPP_URL",
  ]);

  return {
    expireAt: newExpireAt,
    maskedEmail: maskEmail(otpData.email),
    devOtpCode: devShown ? newOtp : undefined,
  };
}

export async function confirmWithdrawFromPaymentAccountWithOtp(
  uid: string,
  transactionId: string,
  otpInput: string
): Promise<ConfirmWithdrawOtpResponse> {
  const otpTrim = otpInput.trim();
  if (!transactionId || !otpTrim) throw new Error("Thiếu mã giao dịch hoặc OTP.");
  if (!/^\d{6}$/.test(otpTrim)) throw new Error("Mã OTP phải gồm 6 chữ số.");

  const txnRef = ref(firebaseRtdb, `transactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) throw new Error("Không tìm thấy giao dịch.");

  const txn = txnSnap.val() as CashTxnNode;

  if (txn.customerUid !== uid) throw new Error("Bạn không có quyền xác nhận giao dịch này.");
  if (txn.type !== "CASH_WITHDRAW") throw new Error("Giao dịch không đúng loại rút tiền.");
  if (txn.status !== "PENDING_OTP") throw new Error("Giao dịch đã được xử lý trước đó.");

  const amount = toNumber(txn.amount);
  const requiresBiometric = txn.requiresBiometric === true || amount >= HIGH_VALUE_THRESHOLD_VND;
  const biometricVerifiedAt = txn.biometricVerifiedAt ?? null;

  if (requiresBiometric && !biometricVerifiedAt) {
    throw new Error("Giao dịch giá trị cao: bạn cần xác thực sinh trắc trước khi hoàn tất.");
  }

  const otpRef = ref(firebaseRtdb, `transactionOtps/${transactionId}`);
  const otpSnap = await get(otpRef);
  if (!otpSnap.exists()) throw new Error("Không tìm thấy yêu cầu OTP cho giao dịch này.");

  const otpData = otpSnap.val() as OtpNode;

  if (otpData.uid !== uid) throw new Error("Bạn không có quyền xác nhận OTP này.");
  if (otpData.used) throw new Error("OTP đã được sử dụng.");

  const now = Date.now();
  if (now > otpData.expireAt) throw new Error("OTP đã hết hạn. Vui lòng gửi lại OTP.");
  if (otpData.attemptsLeft <= 0) throw new Error("Bạn đã nhập sai OTP quá số lần cho phép.");

  if (otpData.otp !== otpTrim) {
    await update(otpRef, { attemptsLeft: otpData.attemptsLeft - 1 });
    throw new Error(`Mã OTP không chính xác. Bạn còn ${otpData.attemptsLeft - 1} lần thử.`);
  }

  const lock = await runTransaction(txnRef, (cur: unknown) => {
    if (!cur || typeof cur !== "object") return cur;
    const obj = cur as Record<string, unknown>;
    const status = String(obj["status"] ?? "");
    const type = String(obj["type"] ?? "");
    const customerUid = String(obj["customerUid"] ?? "");

    if (type !== "CASH_WITHDRAW") return obj;
    if (customerUid !== uid) return obj;
    if (status !== "PENDING_OTP") return obj;

    return { ...obj, status: "PROCESSING" };
  });

  if (!lock.committed) throw new Error("Không thể xử lý giao dịch, vui lòng thử lại.");

  const accountNumber = txn.sourceAccountNumber;
  const withdrawAmount = Number(txn.amount);

  const accountRef = ref(firebaseRtdb, `accounts/${accountNumber}`);
  const accSnap = await get(accountRef);
  if (!accSnap.exists()) {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Không tìm thấy tài khoản thanh toán.");
  }

  const accNode = accSnap.val() as AccountNode;
  if (String(accNode.uid ?? "") !== uid) {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Tài khoản không thuộc về bạn.");
  }
  if (normalizeStatus(accNode.status) !== "ACTIVE") {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Tài khoản đang bị khóa, không thể rút tiền.");
  }

  const serverBalance = safeNumber(accNode.balance, 0);
  if (serverBalance < withdrawAmount) {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Số dư tài khoản không đủ để rút.");
  }

  const balanceRef = ref(firebaseRtdb, `accounts/${accountNumber}/balance`);
  let newBalance = serverBalance;

  const txBal = await runTransaction(
    balanceRef,
    (cur: unknown) => {
      const curBal = safeNumber(cur, serverBalance);
      if (curBal < withdrawAmount) return curBal;
      newBalance = curBal - withdrawAmount;
      return curBal - withdrawAmount;
    },
    { applyLocally: false }
  );

  if (!txBal.committed) {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Không thể rút tiền, vui lòng thử lại.");
  }

  await update(txnRef, { status: "SUCCESS", executedAt: now });
  await update(otpRef, { used: true });

  const txListRef = ref(firebaseRtdb, `accountTransactions/${accountNumber}`);
  const newTxRef = push(txListRef);
  await set(newTxRef, {
    type: "CASH_WITHDRAW",
    direction: "OUT",
    amount: withdrawAmount,
    currency: "VND",
    createdAt: serverTimestamp(),
    description: "Rút tiền từ tài khoản thanh toán (OTP Email)",
    transactionId,
  });

  await createBalanceChangeNotificationDetailed({
    uid,
    direction: "OUT",
    title: "Rút tiền từ tài khoản thanh toán",
    message: `Rút ${withdrawAmount.toLocaleString("vi-VN")} VND từ tài khoản ${accountNumber}.`,
    amount: withdrawAmount,
    accountNumber,
    balanceAfter: newBalance,
    transactionId,
  });

  return { transactionId, status: "SUCCESS", newBalance };
}
