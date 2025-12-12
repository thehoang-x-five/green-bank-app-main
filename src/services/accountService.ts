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
}

/**
 * Node tài khoản trong Realtime Database
 */
interface AccountNode {
  uid?: string;
  balance?: number;
  status?: string;
  createdAt?: number;
  [key: string]: unknown;
}

/**
 * Profile user với flag eKYC & quyền giao dịch
 */
type UserWithEkycFlags = AppUserProfile & {
  ekycStatus?: string;
  kycStatus?: string;
  canTransact?: boolean;
};

/**
 * Profile user với thông tin đếm sai PIN
 */
type UserWithPinFlags = AppUserProfile & {
  pinFailCount?: number | null;
};

/**
 * Lấy tài khoản thanh toán chính của 1 user theo uid.
 */
export async function getPrimaryAccount(
  uid: string
): Promise<BankAccount | null> {
  try {
    const snapshot = await get(ref(firebaseRtdb, "accounts"));
    if (!snapshot.exists()) return null;

    let found: BankAccount | null = null;

    snapshot.forEach((childSnap) => {
      const raw = childSnap.val() as {
        uid?: string;
        balance?: number;
        status?: string;
        createdAt?: number;
      };

      if (!found && raw.uid === uid) {
        found = {
          accountNumber: childSnap.key ?? "",
          uid: raw.uid ?? "",
          balance:
            typeof raw.balance === "number" && !Number.isNaN(raw.balance)
              ? raw.balance
              : 0,
          status: raw.status === "LOCKED" ? "LOCKED" : "ACTIVE",
          createdAt:
            typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
        };
      }

      return false;
    });

    return found;
  } catch (error) {
    console.error("getPrimaryAccount error:", error);
    return null;
  }
}

/**
 * Lấy tên hiển thị của khách hàng
 */
export async function getCustomerDisplayName(
  uid: string
): Promise<string | null> {
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

/**
 * Check user đã eKYC VERIFIED và được phép giao dịch
 */
async function ensureUserCanTransact(uid: string): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) {
    throw new Error("Không tìm thấy thông tin khách hàng.");
  }

  const extended: UserWithEkycFlags = profile;

  const rawStatus =
    typeof extended.ekycStatus === "string"
      ? extended.ekycStatus
      : typeof extended.kycStatus === "string"
      ? extended.kycStatus
      : "";

  const normalizedStatus = rawStatus.toUpperCase();
  const canTransact = Boolean(extended.canTransact);

  if (normalizedStatus !== "VERIFIED" || !canTransact) {
    throw new Error(
      "Tài khoản của bạn chưa được xác thực eKYC hoặc chưa được phép giao dịch. Vui lòng liên hệ ngân hàng."
    );
  }
}

/**
 * Khóa tài khoản theo số tài khoản
 */
async function lockAccountByNumber(accountNumber: string): Promise<void> {
  const accRef = ref(firebaseRtdb, `accounts/${accountNumber}`);
  await update(accRef, { status: "LOCKED" });
}

/**
 * Tạo thông báo cho người dùng
 */
async function createNotificationForUser(
  uid: string,
  payload: {
    type: string;
    title: string;
    message: string;
  }
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

/**
 * Sau khi verify PIN thất bại, kiểm tra pinFailCount
 * Nếu >= 5 thì khóa tài khoản thanh toán chính.
 */
async function lockAccountIfTooManyPinFails(
  uid: string,
  accountNumber: string
): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) return;

  const withPin: UserWithPinFlags = profile;
  const failCount = withPin.pinFailCount ?? 0;

  if (failCount >= 5) {
    await lockAccountByNumber(accountNumber);
  }
}

/**
 * Nạp tiền mặt vào tài khoản thanh toán chính
 */
export async function depositToPaymentAccount(
  uid: string,
  payload: CashOperationPayload
): Promise<void> {
  const amount = Number(payload.amount);
  const pin = payload.pin?.trim();

  if (!amount || amount <= 0) {
    throw new Error("Số tiền nạp phải lớn hơn 0.");
  }

  if (!pin) {
    throw new Error("Vui lòng nhập mã PIN giao dịch.");
  }

  // 1️⃣ Check eKYC & quyền giao dịch
  await ensureUserCanTransact(uid);

  // 2️⃣ Lấy tài khoản thanh toán & trạng thái
  const account = await getPrimaryAccount(uid);
  if (!account) {
    throw new Error("Không tìm thấy tài khoản thanh toán.");
  }

  if (account.status !== "ACTIVE") {
    throw new Error("Tài khoản đang bị khóa, không thể nạp tiền.");
  }

  // 3️⃣ Check PIN – nếu sai 5 lần thì khóa luôn account
  try {
    await verifyTransactionPin(uid, pin);
  } catch (error) {
    // Sau khi verify PIN sai, userService đã tăng pinFailCount
    await lockAccountIfTooManyPinFails(uid, account.accountNumber);
    throw error;
  }

  const accountRef = ref(firebaseRtdb, `accounts/${account.accountNumber}`);

  // 4️⃣ Cập nhật số dư bằng transaction
  await runTransaction(accountRef, (currentData) => {
    const current = (currentData ?? null) as AccountNode | null;

    if (current === null) return currentData;

    const currentBalance =
      typeof current.balance === "number" && !Number.isNaN(current.balance)
        ? current.balance
        : 0;

    return {
      ...current,
      balance: currentBalance + amount,
    };
  });

  // 5️⃣ Ghi lịch sử giao dịch
  const txListRef = ref(
    firebaseRtdb,
    `accountTransactions/${account.accountNumber}`
  );
  const newTxRef = push(txListRef);

  await set(newTxRef, {
    type: "CASH_DEPOSIT",
    direction: "IN",
    amount,
    currency: "VND",
    createdAt: serverTimestamp(),
    description: "Nạp tiền mặt vào tài khoản thanh toán",
  });

  // 6️⃣ Thông báo
  await createNotificationForUser(uid, {
    type: "CASH_DEPOSIT",
    title: "Nạp tiền thành công",
    message: `Bạn đã nạp ${amount.toLocaleString(
      "vi-VN"
    )} VND vào tài khoản ${account.accountNumber}.`,
  });
}

/**
 * Rút tiền mặt từ tài khoản thanh toán chính
 */
export async function withdrawFromPaymentAccount(
  uid: string,
  payload: CashOperationPayload
): Promise<void> {
  const amount = Number(payload.amount);
  const pin = payload.pin?.trim();

  if (!amount || amount <= 0) {
    throw new Error("Số tiền rút phải lớn hơn 0.");
  }

  if (!pin) {
    throw new Error("Vui lòng nhập mã PIN giao dịch.");
  }

  // 1️⃣ Check eKYC & quyền giao dịch
  await ensureUserCanTransact(uid);

  // 2️⃣ Lấy tài khoản thanh toán & trạng thái
  const account = await getPrimaryAccount(uid);
  if (!account) {
    throw new Error("Không tìm thấy tài khoản thanh toán.");
  }

  if (account.status !== "ACTIVE") {
    throw new Error("Tài khoản đang bị khóa, không thể rút tiền.");
  }

  // 3️⃣ Check PIN – sai nhiều lần thì khóa account
  try {
    await verifyTransactionPin(uid, pin);
  } catch (error) {
    await lockAccountIfTooManyPinFails(uid, account.accountNumber);
    throw error;
  }

  const accountRef = ref(firebaseRtdb, `accounts/${account.accountNumber}`);

  // 4️⃣ Transaction để đảm bảo không rút âm
  const result = await runTransaction(accountRef, (currentData) => {
    const current = (currentData ?? null) as AccountNode | null;

    if (current === null) return currentData;

    const currentBalance =
      typeof current.balance === "number" && !Number.isNaN(current.balance)
        ? current.balance
        : 0;

    if (currentBalance < amount) {
      return currentData;
    }

    return {
      ...current,
      balance: currentBalance - amount,
    };
  });

  if (!result.committed) {
    throw new Error("Số dư tài khoản không đủ để rút.");
  }

  // 5️⃣ Ghi lịch sử giao dịch
  const txListRef = ref(
    firebaseRtdb,
    `accountTransactions/${account.accountNumber}`
  );
  const newTxRef = push(txListRef);

  await set(newTxRef, {
    type: "CASH_WITHDRAW",
    direction: "OUT",
    amount,
    currency: "VND",
    createdAt: serverTimestamp(),
    description: "Rút tiền mặt từ tài khoản thanh toán",
  });

  // 6️⃣ Thông báo
  await createNotificationForUser(uid, {
    type: "CASH_WITHDRAW",
    title: "Rút tiền thành công",
    message: `Bạn đã rút ${amount.toLocaleString(
      "vi-VN"
    )} VND từ tài khoản ${account.accountNumber}.`,
  });
}
