// src/services/utilityBillService.ts
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

export type UtilityBillServiceType = "electric" | "water";

export type BillProvider = {
  id: string;
  name: string;
};

export type UserUtilityBill = {
  providerId: string;
  providerName: string;
  amount: number; // VND
  status: "UNPAID" | "PAID";
  updatedAt?: unknown;
  paidAt?: unknown;
};

function ensureUserId(): string {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) throw new Error("Bạn chưa đăng nhập");
  return uid;
}

export async function fetchBillProviders(
  service: UtilityBillServiceType
): Promise<BillProvider[]> {
  const snap = await get(ref(firebaseRtdb, `billProviders/${service}`));
  if (!snap.exists()) return [];

  const val = snap.val() as Record<string, { name?: string }>;
  return Object.entries(val)
    .map(([id, item]) => ({
      id,
      name: String(item?.name || ""),
    }))
    .filter((p) => p.name.trim().length > 0);
}

export async function fetchUserUtilityBill(
  service: UtilityBillServiceType,
  providerId: string
): Promise<UserUtilityBill | null> {
  const uid = ensureUserId();
  const snap = await get(
    ref(firebaseRtdb, `utilityBillsByUser/${uid}/${service}/${providerId}`)
  );
  if (!snap.exists()) return null;

  const val = snap.val() as Partial<UserUtilityBill>;
  if (!val) return null;

  return {
    providerId,
    providerName: String(val.providerName || ""),
    amount: Number(val.amount || 0),
    status: (val.status as "UNPAID" | "PAID") || "UNPAID",
    updatedAt: val.updatedAt,
    paidAt: val.paidAt,
  };
}

export async function payUserUtilityBill(params: {
  service: UtilityBillServiceType;
  providerId: string;
  accountId: string;
}): Promise<{ transactionId: string; billAmount: number }> {
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

    // Fetch and validate bill
    const bill = await fetchUserUtilityBill(params.service, params.providerId);
    if (!bill) {
      throw new Error("Không tìm thấy hóa đơn để thanh toán");
    }

    // Validate bill status
    if (bill.status !== "UNPAID") {
      throw new Error("Hóa đơn không hợp lệ hoặc đã được thanh toán");
    }

    // Validate bill amount
    const billAmount = Number(bill.amount || 0);
    if (billAmount <= 0) {
      throw new Error("Số tiền hóa đơn không hợp lệ");
    }

    // Validate account selection
    if (!params.accountId) {
      throw new Error("Vui lòng chọn tài khoản thanh toán");
    }

    // Handle account transaction and balance deduction
    let balanceAfter = 0;
    if (params.accountId && params.accountId !== "DEMO") {
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
        if (balance < billAmount) {
          throw new Error(
            `Số dư không đủ. Cần ${billAmount.toLocaleString(
              "vi-VN"
            )} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`
          );
        }
        return { ...acc, balance: balance - billAmount };
      }).then((res) => {
        if (!res.committed) throw new Error("Giao dịch thất bại");
        const acc = res.snapshot.val() as Record<string, unknown>;
        return typeof acc.balance === "number"
          ? acc.balance
          : Number((acc.balance as string) || 0);
      });
    }

    // Service label mapping
    const serviceLabelMap: Record<UtilityBillServiceType, string> = {
      electric: "điện",
      water: "nước",
    };
    const serviceLabel = serviceLabelMap[params.service];

    // Create transaction record in RTDB
    const txnRef = push(ref(firebaseRtdb, `utilityTransactions`));
    const transactionId = txnRef.key!;

    const createdAtTimestamp = Date.now();

    await set(txnRef, {
      transactionId,
      userId: user.uid,
      accountId: params.accountId,
      type: "UTILITY_BILL_PAYMENT",
      amount: billAmount,
      description: `Thanh toán hóa đơn ${serviceLabel}: ${bill.providerName}`,
      status: "SUCCESS",
      service: params.service,
      providerId: params.providerId,
      providerName: bill.providerName,
      createdAt: createdAtTimestamp,
      createdAtServer: serverTimestamp(),
    });

    // Update bill status to PAID
    const billRef = ref(
      firebaseRtdb,
      `utilityBillsByUser/${uid}/${params.service}/${params.providerId}`
    );

    await runTransaction(billRef, (current) => {
      if (!current) return current;

      return {
        ...current,
        amount: 0,
        status: "PAID",
        transactionId,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    });

    // Send balance change notification
    try {
      const notiRef = push(ref(firebaseRtdb, `notifications/${user.uid}`));
      const notificationTitle =
        params.service === "electric"
          ? "Thanh toán hóa đơn điện"
          : "Thanh toán hóa đơn nước";

      await set(notiRef, {
        type: "BALANCE_CHANGE",
        direction: "OUT",
        title: notificationTitle,
        message: bill.providerName,
        amount: billAmount,
        accountNumber: params.accountId,
        balanceAfter,
        transactionId,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn("payUserUtilityBill notification failed (ignored):", err);
    }

    return {
      transactionId,
      billAmount,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Có lỗi xảy ra";
    throw new Error(msg);
  }
}
