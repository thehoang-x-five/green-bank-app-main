// src/services/mobilePhonePaymentService.ts
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import {
  ref,
  get,
  runTransaction,
  push,
  set,
  serverTimestamp,
} from "firebase/database";
import { getCurrentUserProfile } from "./userService";

/* ================== TYPES ================== */

export type PayPhoneTopupParams = {
  phoneNumber: string;
  telco: string;
  topupAmount: number;
  accountId: string;
};

export type PayDataPackParams = {
  phoneNumber: string;
  telco: string;
  packId: string;
  packName: string;
  packPrice: number;
  accountId: string;
};

export type PaymentResult = {
  transactionId: string;
  amount: number;
};

/* ================== HELPER FUNCTIONS ================== */

function ensureUserId(): string {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) throw new Error("Vui lòng đăng nhập để tiếp tục");
  return uid;
}

function validatePhoneNumber(phone: string): boolean {
  return /^0\d{9}$/.test(phone);
}

function validateAmount(amount: number): void {
  if (!amount || amount <= 0) {
    throw new Error("Số tiền thanh toán không hợp lệ");
  }
}

function getTelcoLabel(telco: string): string {
  switch (telco) {
    case "viettel":
      return "Viettel";
    case "vina":
    case "vinaphone":
      return "VinaPhone";
    case "mobi":
    case "mobifone":
      return "MobiFone";
    default:
      return telco || "Unknown";
  }
}

/* ================== PAYMENT FUNCTIONS ================== */

/**
 * Process phone credit topup payment
 */
export async function payPhoneTopup(
  params: PayPhoneTopupParams
): Promise<PaymentResult> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Vui lòng đăng nhập để tiếp tục");
  }

  try {
    const uid = ensureUserId();

    // Get user profile and validate permissions
    const profile = await getCurrentUserProfile();
    if (!profile) {
      throw new Error(
        "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
      );
    }

    // Check account status
    if (profile.status === "LOCKED") {
      throw new Error("Tài khoản đăng nhập đang bị khóa, không thể giao dịch");
    }

    // Check eKYC status
    if (profile.ekycStatus !== "VERIFIED") {
      throw new Error(
        "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
      );
    }

    // Check transaction permission
    if (!profile.canTransact) {
      throw new Error(
        "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."
      );
    }

    // Validate phone number
    if (!validatePhoneNumber(params.phoneNumber)) {
      throw new Error("Vui lòng nhập số điện thoại hợp lệ");
    }

    // Validate amount
    validateAmount(params.topupAmount);

    // Validate account selection
    if (!params.accountId) {
      throw new Error("Vui lòng chọn tài khoản thanh toán");
    }

    // Handle account transaction and balance deduction
    let balanceAfter = 0;
    const accountRef = ref(firebaseRtdb, `accounts/${params.accountId}`);

    // Check if account exists first
    const accountSnap = await get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Không tìm thấy tài khoản thanh toán");
    }

    const accountData = accountSnap.val() as Record<string, unknown>;

    // Verify account ownership
    if (accountData.uid !== user.uid) {
      throw new Error("Bạn không có quyền sử dụng tài khoản này");
    }

    // Run transaction to deduct balance
    balanceAfter = await runTransaction(accountRef, (current) => {
      const acc = current as Record<string, unknown> | null;
      if (!acc) {
        return current; // Abort transaction
      }
      if (acc.status === "LOCKED") {
        throw new Error(
          "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
        );
      }
      const balance =
        typeof acc.balance === "number"
          ? acc.balance
          : Number((acc.balance as string) || 0);
      if (balance < params.topupAmount) {
        throw new Error(
          `Số dư không đủ. Cần ${params.topupAmount.toLocaleString(
            "vi-VN"
          )} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`
        );
      }
      return { ...acc, balance: balance - params.topupAmount };
    }).then((res) => {
      if (!res.committed) throw new Error("Giao dịch thất bại");
      const acc = res.snapshot.val() as Record<string, unknown>;
      return typeof acc.balance === "number"
        ? acc.balance
        : Number((acc.balance as string) || 0);
    });

    // Create transaction record in RTDB
    const txnRef = push(ref(firebaseRtdb, `utilityTransactions`));
    const transactionId = txnRef.key!;

    const createdAtTimestamp = Date.now();
    const telcoLabel = getTelcoLabel(params.telco);

    await set(txnRef, {
      transactionId,
      userId: user.uid,
      accountId: params.accountId,
      type: "PHONE_TOPUP",
      amount: params.topupAmount,
      description: `Nạp tiền điện thoại ${telcoLabel}: ${params.phoneNumber}`,
      status: "SUCCESS",
      phoneNumber: params.phoneNumber,
      telco: params.telco,
      topupAmount: params.topupAmount,
      createdAt: createdAtTimestamp,
      createdAtServer: serverTimestamp(),
    });

    // Send balance change notification
    try {
      const notiRef = push(ref(firebaseRtdb, `notifications/${user.uid}`));

      await set(notiRef, {
        type: "BALANCE_CHANGE",
        direction: "OUT",
        title: "Nạp tiền điện thoại",
        message: `${telcoLabel} - ${params.phoneNumber}`,
        amount: params.topupAmount,
        accountNumber: params.accountId,
        balanceAfter,
        transactionId,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn("payPhoneTopup notification failed (ignored):", err);
    }

    return {
      transactionId,
      amount: params.topupAmount,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Có lỗi xảy ra";
    throw new Error(msg);
  }
}

/**
 * Process data package purchase payment
 */
export async function payDataPack(
  params: PayDataPackParams
): Promise<PaymentResult> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Vui lòng đăng nhập để tiếp tục");
  }

  try {
    const uid = ensureUserId();

    // Get user profile and validate permissions
    const profile = await getCurrentUserProfile();
    if (!profile) {
      throw new Error(
        "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
      );
    }

    // Check account status
    if (profile.status === "LOCKED") {
      throw new Error("Tài khoản đăng nhập đang bị khóa, không thể giao dịch");
    }

    // Check eKYC status
    if (profile.ekycStatus !== "VERIFIED") {
      throw new Error(
        "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
      );
    }

    // Check transaction permission
    if (!profile.canTransact) {
      throw new Error(
        "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."
      );
    }

    // Validate phone number
    if (!validatePhoneNumber(params.phoneNumber)) {
      throw new Error("Vui lòng nhập số điện thoại hợp lệ");
    }

    // Validate amount
    validateAmount(params.packPrice);

    // Validate account selection
    if (!params.accountId) {
      throw new Error("Vui lòng chọn tài khoản thanh toán");
    }

    // Handle account transaction and balance deduction
    let balanceAfter = 0;
    const accountRef = ref(firebaseRtdb, `accounts/${params.accountId}`);

    // Check if account exists first
    const accountSnap = await get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Không tìm thấy tài khoản thanh toán");
    }

    const accountData = accountSnap.val() as Record<string, unknown>;

    // Verify account ownership
    if (accountData.uid !== user.uid) {
      throw new Error("Bạn không có quyền sử dụng tài khoản này");
    }

    // Run transaction to deduct balance
    balanceAfter = await runTransaction(accountRef, (current) => {
      const acc = current as Record<string, unknown> | null;
      if (!acc) {
        return current; // Abort transaction
      }
      if (acc.status === "LOCKED") {
        throw new Error(
          "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
        );
      }
      const balance =
        typeof acc.balance === "number"
          ? acc.balance
          : Number((acc.balance as string) || 0);
      if (balance < params.packPrice) {
        throw new Error(
          `Số dư không đủ. Cần ${params.packPrice.toLocaleString(
            "vi-VN"
          )} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`
        );
      }
      return { ...acc, balance: balance - params.packPrice };
    }).then((res) => {
      if (!res.committed) throw new Error("Giao dịch thất bại");
      const acc = res.snapshot.val() as Record<string, unknown>;
      return typeof acc.balance === "number"
        ? acc.balance
        : Number((acc.balance as string) || 0);
    });

    // Create transaction record in RTDB
    const txnRef = push(ref(firebaseRtdb, `utilityTransactions`));
    const transactionId = txnRef.key!;

    const createdAtTimestamp = Date.now();
    const telcoLabel = getTelcoLabel(params.telco);

    await set(txnRef, {
      transactionId,
      userId: user.uid,
      accountId: params.accountId,
      type: "DATA_PACK_PURCHASE",
      amount: params.packPrice,
      description: `Mua gói data ${telcoLabel}: ${params.packName} - ${params.phoneNumber}`,
      status: "SUCCESS",
      phoneNumber: params.phoneNumber,
      telco: params.telco,
      packId: params.packId,
      packName: params.packName,
      packPrice: params.packPrice,
      createdAt: createdAtTimestamp,
      createdAtServer: serverTimestamp(),
    });

    // Send balance change notification
    try {
      const notiRef = push(ref(firebaseRtdb, `notifications/${user.uid}`));

      await set(notiRef, {
        type: "BALANCE_CHANGE",
        direction: "OUT",
        title: "Mua gói data",
        message: `${telcoLabel} - ${params.packName} - ${params.phoneNumber}`,
        amount: params.packPrice,
        accountNumber: params.accountId,
        balanceAfter,
        transactionId,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn("payDataPack notification failed (ignored):", err);
    }

    return {
      transactionId,
      amount: params.packPrice,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Có lỗi xảy ra";
    throw new Error(msg);
  }
}
