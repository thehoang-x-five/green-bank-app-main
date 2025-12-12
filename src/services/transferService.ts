// src/services/transferService.ts
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { ref, get, runTransaction, update, set } from "firebase/database";
import type { AppUserProfile } from "./authService";

// ===================== TYPES =====================

export type TransferToAccountRequest = {
  sourceAccountNumber: string; // TK nguồn
  bankName: string; // VietBank / Vietcombank / ...
  bankCode?: string; // VIETBANK / VCB / ...
  destinationAccountNumber: string; // Số TK nhận
  destinationName?: string; // tên người nhận (có thể bỏ trống, sau auto fill)
  amount: number;
  content?: string;
  nickname?: string;
  saveRecipient?: boolean; // lưu vào "Người nhận đã lưu"
};

export type InitiateTransferResponse = {
  transactionId: string;
  maskedEmail: string;
  expireAt: number; // timestamp ms
  // Smart-OTP cho giao dịch (dùng để hiển thị trên màn hình)
  devOtpCode?: string;
};

export type ConfirmTransferResponse = {
  transactionId: string;
  status: "SUCCESS";
  newBalance: number;
};

// ===================== RTDB ENTITY TYPES =====================

interface RtdbAccount {
  uid: string;
  accountNumber: string;
  balance: number | string;
  status: string;
  pin?: string | number | null; // legacy - PIN theo tài khoản (không dùng nữa cho flow mới)
  // các field khác nếu có
  [key: string]: unknown;
}

interface RtdbAccountMutable extends RtdbAccount {
  __insufficient?: boolean | null;
}

interface RtdbTransaction {
  transactionId: string;
  type: string; // "TRANSFER_INTERNAL" | "TRANSFER_EXTERNAL" | ...
  status: string; // "PENDING_OTP" | "SUCCESS" | "FAILED" | ...
  customerUid: string;
  sourceAccountNumber: string;
  destinationAccountNumber: string;
  destinationName: string;
  destinationBankName: string;
  destinationBankCode: string;
  amount: number | string;
  fee: number | string;
  content: string;
  createdAt: number;
  executedAt: number | null;
  isInternal?: boolean;
  destAccUid?: string | null;
  [key: string]: unknown;
}

interface RtdbOtpData {
  transactionId: string;
  uid: string;
  email: string;
  otp: string;
  createdAt: number;
  expireAt: number;
  attemptsLeft: number;
  used: boolean;
}

// Tài khoản ngân hàng khác (externalAccounts)
interface ExternalAccount {
  fullName?: string;
  name?: string;
  accountNumber?: string;
  bankName?: string;
  status?: string;
  [key: string]: unknown;
}

// ===================== HELPERS =====================

function requireCurrentUser() {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error("Bạn cần đăng nhập để thực hiện giao dịch.");
  }
  return currentUser;
}

function generateOtpCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

/** TXN000001, TXN000002,... */
async function generateNextTransactionId(): Promise<string> {
  const counterRef = ref(firebaseRtdb, "counters/transactionCounter");

  const result = await runTransaction(counterRef, (current: unknown) => {
    if (typeof current !== "number" || !Number.isFinite(current) || current < 0) {
      return 1;
    }
    return (current as number) + 1;
  });

  let value = result.snapshot.val();
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    value = 1;
  }

  return `TXN${String(value).padStart(6, "0")}`;
}

/** mask email: t***2@gmail.com (chủ yếu để show thông tin bảo mật, flow Smart-OTP không dùng nhiều) */
function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/** placeholder gửi email OTP – hiện tại chỉ log (Smart-OTP hiển thị trong app) */
async function sendOtpEmailDev(email: string, otp: string, txnId: string) {
  console.log(`[DEV] Smart-OTP ${otp} cho ${email} – giao dịch ${txnId}`);
}

// ===================== CORE SERVICE =====================

/**
 * INIT TRANSFER (sau khi đã verify PIN giao dịch ở FE):
 * 1. Kiểm tra user, eKYC, quyền giao dịch
 * 2. Kiểm tra tài khoản nguồn thuộc user + đủ số dư
 * 3. Nếu bankName = VietBank => coi là chuyển NỘI BỘ, kiểm tra TK nhận tồn tại (và không phải chính mình)
 *    Nếu bankName != VietBank => kiểm tra trong externalAccounts/{bankName}/{accountNumber}
 * 4. Tạo transaction PENDING_OTP
 * 5. Tạo Smart-OTP cho transaction (lưu RTDB, không gửi SMS/email)
 */
export async function initiateTransferToAccount(
  req: TransferToAccountRequest
): Promise<InitiateTransferResponse> {
  const currentUser = requireCurrentUser();

  if (!req.sourceAccountNumber) {
    throw new Error("Thiếu tài khoản nguồn.");
  }
  if (!req.bankName || !req.destinationAccountNumber) {
    throw new Error("Thiếu thông tin ngân hàng hoặc số tài khoản nhận.");
  }
  if (!req.amount || req.amount <= 0) {
    throw new Error("Số tiền không hợp lệ.");
  }

  // 1. Đọc profile user để check eKYC + canTransact
  const userSnap = await get(ref(firebaseRtdb, `users/${currentUser.uid}`));
  if (!userSnap.exists()) {
    throw new Error("Không tìm thấy thông tin khách hàng.");
  }

  const profile = userSnap.val() as AppUserProfile;
  if (profile.status === "LOCKED") {
    throw new Error("Tài khoản đăng nhập của bạn đang bị khóa.");
  }

  if (profile.ekycStatus !== "VERIFIED") {
    throw new Error(
      "Tài khoản của bạn chưa hoàn tất định danh eKYC, không thể thực hiện giao dịch."
    );
  }

  if (!profile.canTransact) {
    throw new Error(
      "Tài khoản của bạn chưa được bật quyền giao dịch, vui lòng liên hệ ngân hàng."
    );
  }

  // 2. Kiểm tra tài khoản nguồn
  const sourceAccSnap = await get(
    ref(firebaseRtdb, `accounts/${req.sourceAccountNumber}`)
  );
  if (!sourceAccSnap.exists()) {
    throw new Error("Không tìm thấy tài khoản nguồn.");
  }

  const sourceAcc = sourceAccSnap.val() as RtdbAccount;

  if (sourceAcc.uid !== currentUser.uid) {
    throw new Error("Tài khoản nguồn không thuộc về bạn.");
  }

  if (sourceAcc.status !== "ACTIVE") {
    throw new Error("Tài khoản nguồn không hoạt động.");
  }

  const balance =
    typeof sourceAcc.balance === "number"
      ? sourceAcc.balance
      : Number(sourceAcc.balance) || 0;

  if (balance < req.amount) {
    throw new Error("Số dư tài khoản nguồn không đủ.");
  }

  // Không cho chuyển tới cùng một số tài khoản trong flow này
  if (req.sourceAccountNumber === req.destinationAccountNumber) {
    throw new Error(
      "Bạn không thể chuyển tiền tới cùng một tài khoản nguồn trong chức năng này. Vui lòng dùng 'Chuyển tới tài khoản của tôi'."
    );
  }

  // 3. Xác định chuyển nội bộ hay liên ngân hàng
  const isInternal =
    req.bankName === "VietBank" ||
    req.bankCode === "VIETBANK" ||
    req.bankCode === "VietBank";

  let destAccUid: string | null = null;
  let externalDest: ExternalAccount | null = null;

  if (isInternal) {
    // Chuyển NỘI BỘ: kiểm tra tài khoản nhận trong /accounts
    const destSnap = await get(
      ref(firebaseRtdb, `accounts/${req.destinationAccountNumber}`)
    );
    if (!destSnap.exists()) {
      throw new Error(
        "Không tìm thấy tài khoản nhận trong hệ thống VietBank."
      );
    }

    const destAcc = destSnap.val() as RtdbAccount;

    if (destAcc.status !== "ACTIVE") {
      throw new Error("Tài khoản nhận hiện không hoạt động.");
    }

    // Không cho chuyển tới tài khoản của chính mình trong flow này
    if (destAcc.uid === currentUser.uid) {
      throw new Error(
        "Không thể chuyển tiền tới tài khoản của chính bạn trong chức năng này. Vui lòng dùng 'Chuyển tới tài khoản của tôi'."
      );
    }

    destAccUid = destAcc.uid;
  } else {
    // Chuyển LIÊN NGÂN HÀNG: kiểm tra trong externalAccounts/{bankName}/{accountNumber}
    const extRef = ref(
      firebaseRtdb,
      `externalAccounts/${req.bankName}/${req.destinationAccountNumber}`
    );
    const extSnap = await get(extRef);
    if (!extSnap.exists()) {
      throw new Error(
        `Không tìm thấy tài khoản nhận tại ngân hàng ${req.bankName}.`
      );
    }

    const extAcc = extSnap.val() as ExternalAccount;

    if (extAcc.status && extAcc.status !== "ACTIVE") {
      throw new Error(
        "Tài khoản nhận tại ngân hàng này hiện không hoạt động."
      );
    }

    externalDest = extAcc;
  }

  // 4. Tạo transaction PENDING_OTP
  const txnId = await generateNextTransactionId();
  const now = Date.now();

  const transactionData: RtdbTransaction = {
    transactionId: txnId,
    type: isInternal ? "TRANSFER_INTERNAL" : "TRANSFER_EXTERNAL",
    status: "PENDING_OTP",
    customerUid: currentUser.uid,
    sourceAccountNumber: req.sourceAccountNumber,
    destinationAccountNumber: req.destinationAccountNumber,
    destinationName:
      req.destinationName ??
      externalDest?.fullName ??
      externalDest?.name ??
      "",
    destinationBankName: req.bankName,
    destinationBankCode: req.bankCode ?? "",
    amount: req.amount,
    fee: 0,
    content: req.content ?? "",
    createdAt: now,
    executedAt: null,
    isInternal,
    destAccUid,
  };

  await set(ref(firebaseRtdb, `transactions/${txnId}`), transactionData);

  // 5. Tạo Smart-OTP + record OTP
  const otpCode = generateOtpCode(6);
  const expireMs = 2 * 60 * 1000; // 2 phút
  const expireAt = now + expireMs;

  const otpData: RtdbOtpData = {
    transactionId: txnId,
    uid: currentUser.uid,
    email: profile.email,
    otp: otpCode, // NOTE: demo lưu plain text, thực tế nên hash
    createdAt: now,
    expireAt,
    attemptsLeft: 5, // cho phép nhập sai tối đa 5 lần
    used: false,
  };

  await set(ref(firebaseRtdb, `transactionOtps/${txnId}`), otpData);

  // Log dev, không gửi email thật (Smart-OTP hiển thị trong app)
  await sendOtpEmailDev(profile.email, otpCode, txnId);

  // 6. Nếu người dùng chọn "Ghi nhớ tài khoản người nhận" thì lưu
    // 6. Nếu người dùng chọn "Ghi nhớ tài khoản người nhận" thì lưu
  if (req.saveRecipient) {
    const recipientKey = `${req.bankCode ?? req.bankName}_${req.destinationAccountNumber}`;

    // TÊN THẬT NGƯỜI THỤ HƯỞNG
    const realName =
      (req.destinationName && req.destinationName.trim()) ||
      externalDest?.fullName ||
      externalDest?.name ||
      "";

    // TÊN GỢI NHỚ (có thể rỗng)
    const nickname = req.nickname?.trim() || "";

    await set(
      ref(
        firebaseRtdb,
        `savedRecipients/${currentUser.uid}/${recipientKey}`
      ),
      {
        name: realName, // tên người thụ hưởng thật
        accountNumber: req.destinationAccountNumber,
        bankName: req.bankName,
        bankCode: req.bankCode ?? "",
        nickname,       // tên gợi nhớ
        updatedAt: now,
      }
    );
  }


  return {
    transactionId: txnId,
    maskedEmail: maskEmail(profile.email),
    expireAt,
    devOtpCode: otpCode,
  };
}

/**
 * CONFIRM:
 * 1. Kiểm tra OTP còn hạn, đúng user, đúng mã (và còn attemptsLeft)
 * 2. Trừ tiền tài khoản nguồn (runTransaction)
 * 3. Nếu internal: cộng tiền tài khoản nhận
 * 4. Cập nhật transaction = SUCCESS
 * 5. Ghi lịch sử theo tài khoản + notifications (biến động số dư)
 *
 * Lưu ý: PIN giao dịch đã được xác thực ở bước trước (màn hình nhập PIN),
 * nên ở đây KHÔNG kiểm tra PIN nữa.
 */
export async function confirmTransferWithOtp(
  transactionId: string,
  otpInput: string
): Promise<ConfirmTransferResponse> {
  const currentUser = requireCurrentUser();

  if (!transactionId || !otpInput) {
    throw new Error("Thiếu mã giao dịch hoặc OTP.");
  }

  // 1. Đọc OTP record
  const otpRef = ref(firebaseRtdb, `transactionOtps/${transactionId}`);
  const otpSnap = await get(otpRef);
  if (!otpSnap.exists()) {
    throw new Error("Không tìm thấy yêu cầu OTP cho giao dịch này.");
  }

  const otpData = otpSnap.val() as RtdbOtpData;

  if (otpData.uid !== currentUser.uid) {
    throw new Error("Bạn không có quyền xác nhận giao dịch này.");
  }

  if (otpData.used) {
    throw new Error("OTP đã được sử dụng.");
  }

  const now = Date.now();
  if (now > otpData.expireAt) {
    throw new Error("OTP đã hết hạn, vui lòng tạo giao dịch mới.");
  }

  if (otpData.attemptsLeft <= 0) {
    throw new Error("Bạn đã nhập sai OTP quá số lần cho phép.");
  }

  // So sánh OTP
  if (otpData.otp !== otpInput) {
    await update(otpRef, {
      attemptsLeft: otpData.attemptsLeft - 1,
    });
    throw new Error(
      `Mã OTP không chính xác. Bạn còn ${
        otpData.attemptsLeft - 1
      } lần thử.`
    );
  }

  // Đánh dấu OTP đã dùng
  await update(otpRef, {
    used: true,
  });

  // 2. Đọc transaction
  const txnRef = ref(firebaseRtdb, `transactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) {
    throw new Error("Không tìm thấy giao dịch.");
  }

  const txn = txnSnap.val() as RtdbTransaction;
  if (txn.status !== "PENDING_OTP") {
    throw new Error("Giao dịch đã được xử lý trước đó.");
  }

  if (txn.customerUid !== currentUser.uid) {
    throw new Error("Bạn không có quyền xác nhận giao dịch này.");
  }

  const sourceAccNumber = txn.sourceAccountNumber;
  const destAccNumber = txn.destinationAccountNumber;
  const destBankName = txn.destinationBankName;
  const amount =
    typeof txn.amount === "number" ? txn.amount : Number(txn.amount) || 0;
  const isInternal = Boolean(txn.isInternal);

  if (!sourceAccNumber || amount <= 0) {
    throw new Error("Dữ liệu giao dịch không hợp lệ.");
  }

    // Lấy tên người gửi (nếu cần dùng cho thông báo IN)
  let senderName: string | null = null;
  try {
    const senderSnap = await get(
      ref(firebaseRtdb, `users/${currentUser.uid}`)
    );
    if (senderSnap.exists()) {
      const profile = senderSnap.val() as AppUserProfile & {
        fullName?: string;
        username?: string;
        displayName?: string;
      };

      senderName =
        profile.fullName ??
        profile.username ??
        profile.displayName ??
        null;
    }
  } catch (err) {
    console.error(
      "Lỗi đọc thông tin người gửi để tạo thông báo:",
      err
    );
  }


  // 3. Đảm bảo tài khoản nguồn tồn tại trước khi trừ tiền
  const sourceAccRef = ref(firebaseRtdb, `accounts/${sourceAccNumber}`);
  const sourceAccSnapBefore = await get(sourceAccRef);
  if (!sourceAccSnapBefore.exists()) {
    throw new Error("Không tìm thấy tài khoản nguồn.");
  }

  // 4. Trừ tiền tài khoản nguồn
  let newSourceBalance = 0;

  await runTransaction(sourceAccRef, (current: unknown) => {
    if (!current) return current;

    const acc = current as RtdbAccountMutable;

    const currentBalance =
      typeof acc.balance === "number"
        ? acc.balance
        : Number(acc.balance) || 0;

    if (currentBalance < amount) {
      return { ...acc, __insufficient: true };
    }

    const updatedBalance = currentBalance - amount;
    newSourceBalance = updatedBalance;

    return {
      ...acc,
      balance: updatedBalance,
      __insufficient: null,
    };
  });

  // Sau transaction, kiểm tra cờ thiếu tiền
  const afterSourceSnap = await get(sourceAccRef);
  const afterSource = afterSourceSnap.val() as RtdbAccountMutable | null;
  if (afterSource && afterSource.__insufficient) {
    // rollback flag
    await update(sourceAccRef, { __insufficient: null });
    throw new Error(
      "Số dư tài khoản nguồn không đủ (có thể đã thay đổi trong lúc xử lý)."
    );
  }

  // 5. Nếu INTERNAL: cộng tiền tài khoản nhận
  let newDestBalance: number | null = null;

  if (isInternal && destAccNumber) {
    const destAccRef = ref(firebaseRtdb, `accounts/${destAccNumber}`);
    await runTransaction(destAccRef, (current: unknown) => {
      if (!current) return current;

      const acc = current as RtdbAccount;
      const currentBalance =
        typeof acc.balance === "number"
          ? acc.balance
          : Number(acc.balance) || 0;
      const updatedBalance = currentBalance + amount;

      newDestBalance = updatedBalance;

      return {
        ...acc,
        balance: updatedBalance,
      };
    });
  }

  // 6. Cập nhật transaction = SUCCESS
  await update(txnRef, {
    status: "SUCCESS",
    executedAt: now,
  });

  // 7. Ghi lịch sử theo tài khoản, sau này dùng để load "Lịch sử giao dịch"
  const historyItem = {
    transactionId,
    type: txn.type,
    amount,
    content: txn.content ?? "",
    createdAt: txn.createdAt,
    executedAt: now,
    sourceAccountNumber: sourceAccNumber,
    destinationAccountNumber: destAccNumber,
    destinationBankName: txn.destinationBankName,
  };

  const historyPromises: Promise<void>[] = [];

  // OUT: tài khoản nguồn
  historyPromises.push(
    set(
      ref(
        firebaseRtdb,
        `accountTransactions/${sourceAccNumber}/${transactionId}`
      ),
      { ...historyItem, direction: "OUT" }
    ).then(() => {
      return;
    })
  );

  // IN: chỉ ghi nếu là chuyển nội bộ và có tài khoản nhận hợp lệ
  if (isInternal && destAccNumber) {
    historyPromises.push(
      set(
        ref(
          firebaseRtdb,
          `accountTransactions/${destAccNumber}/${transactionId}`
        ),
        { ...historyItem, direction: "IN" }
      ).then(() => {
        return;
      })
    );
  }

  await Promise.all(historyPromises);

  // 8. Ghi NOTIFICATIONS (biến động số dư) cho người gửi + người nhận nội bộ
  const notificationsPromises: Promise<void>[] = [];

  const destDisplayName =
    txn.destinationName || destAccNumber || "tài khoản khác";

  const senderTitle = `Chuyển tiền đến ${destDisplayName}`;
  const senderMessage = `Đã chuyển ${amount.toLocaleString(
    "vi-VN"
  )} VND đến ${destDisplayName}${
    destBankName ? ` (${destBankName})` : ""
  }.`;

  // Thông báo cho NGƯỜI GỬI (OUT)
  notificationsPromises.push(
    set(
      ref(
        firebaseRtdb,
        `notifications/${currentUser.uid}/${transactionId}`
      ),
      {
        type: "BALANCE_CHANGE",
        direction: "OUT",
        title: senderTitle,
        message: senderMessage,
        amount,
        accountNumber: sourceAccNumber,
        balanceAfter: newSourceBalance,
        transactionId,
        createdAt: now,
      }
    ).then(() => {
      return;
    })
  );

  // Thông báo cho NGƯỜI NHẬN (IN) nếu chuyển nội bộ
  const receiverUid = txn.destAccUid;
  if (isInternal && destAccNumber && receiverUid) {
    const senderDisplay = senderName ?? sourceAccNumber;
    const receiverTitle = `Nhận tiền từ ${senderDisplay}`;
    const receiverMessage = `Tài khoản ${destAccNumber} nhận ${amount.toLocaleString(
      "vi-VN"
    )} VND từ ${senderDisplay}.`;

    notificationsPromises.push(
      set(
        ref(
          firebaseRtdb,
          `notifications/${receiverUid}/${transactionId}`
        ),
        {
          type: "BALANCE_CHANGE",
          direction: "IN",
          title: receiverTitle,
          message: receiverMessage,
          amount,
          accountNumber: destAccNumber,
          balanceAfter: newDestBalance,
          transactionId,
          createdAt: now,
        }
      ).then(() => {
        return;
      })
    );
  }

  await Promise.all(notificationsPromises);

  return {
    transactionId,
    status: "SUCCESS",
    newBalance: newSourceBalance,
  };
}
