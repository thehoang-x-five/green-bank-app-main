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

      return true;
    });

    return found;
  } catch (error) {
    console.error("getPrimaryAccount error:", error);
    return null;
  }
}

export async function getCustomerDisplayName(uid: string): Promise<string | null> {
  try {
    const snapshot = await get(ref(firebaseRtdb, `users/${uid}`));
    if (!snapshot.exists()) return null;

    const data = snapshot.val() as { username?: string };
    return data.username ?? null;
  } catch (error) {
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

  // ✅ 1) Đọc trực tiếp account node để lấy balance thật từ server
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

  // ✅ 2) Transaction trực tiếp trên /balance để tránh currentData bị sai shape
  const balanceRef = ref(firebaseRtdb, `accounts/${account.accountNumber}/balance`);

  let committed = false;

  try {
    const tx = await runTransaction(
      balanceRef,
      (currentValue) => {
        const currentBalance = safeNumber(currentValue, serverBalance);

        // nếu thiếu tiền thì giữ nguyên (không abort kiểu undefined)
        if (currentBalance < amount) return currentBalance;

        return currentBalance - amount;
      },
      { applyLocally: false }
    );

    // committed có thể true ngay cả khi “không đổi” (thiếu tiền) => check lại
    const afterVal = tx.snapshot.val();
    const afterBalance = safeNumber(afterVal, serverBalance);

    committed = tx.committed && afterBalance === serverBalance - amount;
  } catch (e) {
    // fallback phía dưới
    committed = false;
  }

  // ✅ 3) Fallback: nếu transaction không commit nhưng server vẫn đủ tiền -> set trực tiếp
  if (!committed) {
    const latestSnap = await get(balanceRef);
    const latest = safeNumber(latestSnap.val(), serverBalance);

    if (latest < amount) {
      throw new Error("Số dư tài khoản không đủ để rút.");
    }

    await set(balanceRef, latest - amount);
  }

  // 4) Ghi lịch sử giao dịch
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

  // 5) Thông báo
  await createNotificationForUser(uid, {
    type: "CASH_WITHDRAW",
    title: "Rút tiền thành công",
    message: `Bạn đã rút ${amount.toLocaleString("vi-VN")} VND từ tài khoản ${account.accountNumber}.`,
  });
}
