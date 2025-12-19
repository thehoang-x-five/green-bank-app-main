// src/services/transferService.ts
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { ref, get, runTransaction, update, set } from "firebase/database";
import type { AppUserProfile } from "./authService";

const HIGH_VALUE_THRESHOLD_VND = 10_000_000;

// ===================== TYPES =====================

export type TransferToAccountRequest = {
  sourceAccountNumber: string;
  bankName: string;
  bankCode?: string;
  destinationAccountNumber: string;
  destinationName?: string;
  amount: number;
  content?: string;
  nickname?: string;
  saveRecipient?: boolean;
};

export type InitiateTransferResponse = {
  transactionId: string;
  maskedEmail: string;
  expireAt: number;
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
  pin?: string | number | null;
  [key: string]: unknown;
}

interface RtdbAccountMutable extends RtdbAccount {
  __insufficient?: boolean | null;
}

interface RtdbTransaction {
  transactionId: string;
  type: string;
  status: string;
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

  // ✅ NEW
  requiresBiometric?: boolean; // lưu để trace, nhưng luôn fallback theo amount nếu missing
  biometricVerifiedAt?: number | null; // null => chưa sinh trắc

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

interface ExternalAccount {
  fullName?: string;
  name?: string;
  accountNumber?: string;
  bankName?: string;
  status?: string;
  [key: string]: unknown;
}

// ===================== RECEIVER ELIGIBILITY (INTERNAL) =====================

type RtdbUserLite = {
  status?: string | null;
  canTransact?: boolean | null;

  // node user của anh có: kycStatus: "VERIFIED" và có thể có ekycStatus
  ekycStatus?: string | null;
  kycStatus?: string | null;
  ekyc_status?: string | null;
  kyc_status?: string | null;

  fullName?: string | null;
  username?: string | null;
  displayName?: string | null;

  [key: string]: unknown;
};

function upper(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function isKycVerified(u: RtdbUserLite): boolean {
  const s1 = upper(u.ekycStatus);
  const s2 = upper(u.kycStatus);
  const s3 = upper(u.ekyc_status);
  const s4 = upper(u.kyc_status);
  return (
    s1 === "VERIFIED" ||
    s2 === "VERIFIED" ||
    s3 === "VERIFIED" ||
    s4 === "VERIFIED"
  );
}

function resolveDisplayName(u: RtdbUserLite): string {
  return (
    String(u.fullName ?? "").trim() ||
    String(u.username ?? "").trim() ||
    String(u.displayName ?? "").trim() ||
    ""
  );
}

/**
 * ✅ Rule mới theo yêu cầu anh:
 * - User nhận phải eKYC/KYC VERIFIED
 * - User nhận không bị LOCKED
 * - (tuỳ đề) user nhận cũng phải canTransact = true
 */
async function assertReceiverEligibleOrThrow(
  receiverUid: string
): Promise<RtdbUserLite> {
  const userSnap = await get(ref(firebaseRtdb, `users/${receiverUid}`));
  if (!userSnap.exists()) {
    throw new Error("Không tìm thấy thông tin chủ tài khoản thụ hưởng.");
  }

  const u = userSnap.val() as RtdbUserLite;

  if (upper(u.status) === "LOCKED") {
    throw new Error(
      "Tài khoản thụ hưởng đang bị tạm khóa hoặc không hoạt động."
    );
  }

  if (!isKycVerified(u)) {
    throw new Error(
      "Tài khoản thụ hưởng chưa hoàn tất eKYC, không thể nhận tiền."
    );
  }

  // Nếu anh bắt buộc người nhận cũng phải được bật giao dịch
  if (u.canTransact === false) {
    throw new Error(
      "Tài khoản thụ hưởng chưa được bật quyền giao dịch, không thể nhận tiền."
    );
  }

  return u;
}

// ===================== HELPERS =====================

function requireCurrentUser() {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser)
    throw new Error("Bạn cần đăng nhập để thực hiện giao dịch.");
  return currentUser;
}

function generateOtpCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

async function generateNextTransactionId(): Promise<string> {
  const counterRef = ref(firebaseRtdb, "counters/transactionCounter");

  const result = await runTransaction(counterRef, (current: unknown) => {
    if (typeof current !== "number" || !Number.isFinite(current) || current < 0)
      return 1;
    return (current as number) + 1;
  });

  let value = result.snapshot.val();
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    value = 1;

  return `TXN${String(value).padStart(6, "0")}`;
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

async function sendOtpEmailDev(email: string, otp: string, txnId: string) {
  console.log(`[DEV] Smart-OTP ${otp} cho ${email} – giao dịch ${txnId}`);
}

function toNumber(v: number | string): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

// ===================== NEW: MARK BIOMETRIC =====================

export async function markTransactionBiometricVerified(
  transactionId: string
): Promise<void> {
  const currentUser = requireCurrentUser();

  if (!transactionId) throw new Error("Thiếu mã giao dịch.");

  const txnRef = ref(firebaseRtdb, `transactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) throw new Error("Không tìm thấy giao dịch.");

  const txn = txnSnap.val() as RtdbTransaction;

  if (txn.customerUid !== currentUser.uid) {
    throw new Error("Bạn không có quyền xác nhận giao dịch này.");
  }

  if (txn.status !== "PENDING_OTP") {
    throw new Error("Giao dịch không còn ở trạng thái chờ OTP.");
  }

  const amount = toNumber(txn.amount);

  // ✅ FIX: nếu txn.requiresBiometric bị missing vẫn bắt theo amount
  const requiresBiometric =
    txn.requiresBiometric === true || amount >= HIGH_VALUE_THRESHOLD_VND;

  if (!requiresBiometric) return;

  await update(txnRef, {
    requiresBiometric: true, // set lại cho chắc
    biometricVerifiedAt: Date.now(),
  });
}

// ===================== CORE SERVICE =====================

export async function initiateTransferToAccount(
  req: TransferToAccountRequest
): Promise<InitiateTransferResponse> {
  const currentUser = requireCurrentUser();

  if (!req.sourceAccountNumber) throw new Error("Thiếu tài khoản nguồn.");
  if (!req.bankName || !req.destinationAccountNumber) {
    throw new Error("Thiếu thông tin ngân hàng hoặc số tài khoản nhận.");
  }
  if (!req.amount || req.amount <= 0) throw new Error("Số tiền không hợp lệ.");

  const userSnap = await get(ref(firebaseRtdb, `users/${currentUser.uid}`));
  if (!userSnap.exists())
    throw new Error("Không tìm thấy thông tin khách hàng.");

  const profile = userSnap.val() as AppUserProfile;

  if (profile.status === "LOCKED")
    throw new Error("Tài khoản đăng nhập của bạn đang bị khóa.");
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

  const sourceAccSnap = await get(
    ref(firebaseRtdb, `accounts/${req.sourceAccountNumber}`)
  );
  if (!sourceAccSnap.exists())
    throw new Error("Không tìm thấy tài khoản nguồn.");

  const sourceAcc = sourceAccSnap.val() as RtdbAccount;

  if (sourceAcc.uid !== currentUser.uid)
    throw new Error("Tài khoản nguồn không thuộc về bạn.");
  if (sourceAcc.status !== "ACTIVE")
    throw new Error("Tài khoản nguồn không hoạt động.");

  const balance = toNumber(sourceAcc.balance);
  if (balance < req.amount) throw new Error("Số dư tài khoản nguồn không đủ.");

  if (req.sourceAccountNumber === req.destinationAccountNumber) {
    throw new Error(
      "Bạn không thể chuyển tiền tới cùng một tài khoản nguồn trong chức năng này."
    );
  }

  const isInternal =
    req.bankName === "VietBank" ||
    req.bankCode === "VIETBANK" ||
    req.bankCode === "VietBank";

  let destAccUid: string | null = null;
  let externalDest: ExternalAccount | null = null;

  if (isInternal) {
    const destSnap = await get(
      ref(firebaseRtdb, `accounts/${req.destinationAccountNumber}`)
    );
    if (!destSnap.exists())
      throw new Error("Không tìm thấy tài khoản nhận trong hệ thống VietBank.");

    const destAcc = destSnap.val() as RtdbAccount;

    // ✅ Rule 1: account nhận phải ACTIVE
    if (upper(destAcc.status) !== "ACTIVE") {
      throw new Error(
        "Tài khoản thụ hưởng đang bị tạm khóa hoặc không hoạt động."
      );
    }

    // ✅ Rule: không cho chuyển tới chính mình
    if (destAcc.uid === currentUser.uid) {
      throw new Error(
        "Không thể chuyển tiền tới tài khoản của chính bạn trong chức năng này."
      );
    }

    // ✅ Rule 2: user nhận phải eKYC VERIFIED (+ optional canTransact)
    const receiverUid = String(destAcc.uid ?? "").trim();
    if (!receiverUid) {
      throw new Error("Tài khoản thụ hưởng không hợp lệ (thiếu uid).");
    }

    const receiverProfile = await assertReceiverEligibleOrThrow(receiverUid);

    destAccUid = receiverUid;

    // ✅ Nếu UI chưa truyền destinationName => service tự set cho chắc
    const receiverName = resolveDisplayName(receiverProfile);
    if (!req.destinationName || !req.destinationName.trim()) {
      req.destinationName = receiverName || req.destinationAccountNumber;
    }
  } else {
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
      throw new Error("Tài khoản nhận tại ngân hàng này hiện không hoạt động.");
    }

    externalDest = extAcc;
  }

  const txnId = await generateNextTransactionId();
  const now = Date.now();

  const requiresBiometric = req.amount >= HIGH_VALUE_THRESHOLD_VND;

  const transactionData: RtdbTransaction = {
    transactionId: txnId,
    type: isInternal ? "TRANSFER_INTERNAL" : "TRANSFER_EXTERNAL",
    status: "PENDING_OTP",
    customerUid: currentUser.uid,
    sourceAccountNumber: req.sourceAccountNumber,
    destinationAccountNumber: req.destinationAccountNumber,
    destinationName:
      req.destinationName ?? externalDest?.fullName ?? externalDest?.name ?? "",
    destinationBankName: req.bankName,
    destinationBankCode: req.bankCode ?? "",
    amount: req.amount,
    fee: 0,
    content: req.content ?? "",
    createdAt: now,
    executedAt: null,
    isInternal,
    destAccUid,

    // ✅ NEW
    requiresBiometric,
    biometricVerifiedAt: null,
  };

  await set(ref(firebaseRtdb, `transactions/${txnId}`), transactionData);

  const otpCode = generateOtpCode(6);
  const expireMs = 2 * 60 * 1000;
  const expireAt = now + expireMs;

  const otpData: RtdbOtpData = {
    transactionId: txnId,
    uid: currentUser.uid,
    email: profile.email,
    otp: otpCode,
    createdAt: now,
    expireAt,
    attemptsLeft: 5,
    used: false,
  };

  await set(ref(firebaseRtdb, `transactionOtps/${txnId}`), otpData);
  await sendOtpEmailDev(profile.email, otpCode, txnId);

  if (req.saveRecipient) {
    const recipientKey = `${req.bankCode ?? req.bankName}_${
      req.destinationAccountNumber
    }`;

    const realName =
      (req.destinationName && req.destinationName.trim()) ||
      externalDest?.fullName ||
      externalDest?.name ||
      "";

    const nickname = req.nickname?.trim() || "";

    await set(
      ref(firebaseRtdb, `savedRecipients/${currentUser.uid}/${recipientKey}`),
      {
        name: realName,
        accountNumber: req.destinationAccountNumber,
        bankName: req.bankName,
        bankCode: req.bankCode ?? "",
        nickname,
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

export async function confirmTransferWithOtp(
  transactionId: string,
  otpInput: string
): Promise<ConfirmTransferResponse> {
  const currentUser = requireCurrentUser();

  if (!transactionId || !otpInput)
    throw new Error("Thiếu mã giao dịch hoặc OTP.");

  // ✅ 1) Đọc transaction trước để CHẶN sinh trắc (fail-closed)
  const txnRef = ref(firebaseRtdb, `transactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) throw new Error("Không tìm thấy giao dịch.");

  const txn = txnSnap.val() as RtdbTransaction;

  if (txn.status !== "PENDING_OTP")
    throw new Error("Giao dịch đã được xử lý trước đó.");
  if (txn.customerUid !== currentUser.uid)
    throw new Error("Bạn không có quyền xác nhận giao dịch này.");

  const amount = toNumber(txn.amount);

  // ✅ FIX: nếu requiresBiometric missing vẫn bắt theo amount >= 10tr
  const requiresBiometric =
    txn.requiresBiometric === true || amount >= HIGH_VALUE_THRESHOLD_VND;

  const biometricVerifiedAt = txn.biometricVerifiedAt ?? null;

  if (requiresBiometric && !biometricVerifiedAt) {
    throw new Error(
      "Giao dịch giá trị cao: bạn cần xác thực sinh trắc trước khi hoàn tất."
    );
  }

  // ✅ 2) Kiểm tra OTP
  const otpRef = ref(firebaseRtdb, `transactionOtps/${transactionId}`);
  const otpSnap = await get(otpRef);
  if (!otpSnap.exists())
    throw new Error("Không tìm thấy yêu cầu OTP cho giao dịch này.");

  const otpData = otpSnap.val() as RtdbOtpData;

  if (otpData.uid !== currentUser.uid)
    throw new Error("Bạn không có quyền xác nhận giao dịch này.");
  if (otpData.used) throw new Error("OTP đã được sử dụng.");

  const now = Date.now();
  if (now > otpData.expireAt)
    throw new Error("OTP đã hết hạn, vui lòng tạo giao dịch mới.");
  if (otpData.attemptsLeft <= 0)
    throw new Error("Bạn đã nhập sai OTP quá số lần cho phép.");

  if (otpData.otp !== otpInput) {
    await update(otpRef, { attemptsLeft: otpData.attemptsLeft - 1 });
    throw new Error(
      `Mã OTP không chính xác. Bạn còn ${otpData.attemptsLeft - 1} lần thử.`
    );
  }

  // ✅ OTP đúng => đánh dấu used
  await update(otpRef, { used: true });

  // ✅ 3) Thực hiện trừ/cộng tiền
  const sourceAccNumber = txn.sourceAccountNumber;
  const destAccNumber = txn.destinationAccountNumber;
  const destBankName = txn.destinationBankName;

  const isInternal = Boolean(txn.isInternal);

  if (!sourceAccNumber || amount <= 0)
    throw new Error("Dữ liệu giao dịch không hợp lệ.");

  let senderName: string | null = null;
  try {
    const senderSnap = await get(ref(firebaseRtdb, `users/${currentUser.uid}`));
    if (senderSnap.exists()) {
      const p = senderSnap.val() as AppUserProfile & {
        fullName?: string;
        username?: string;
        displayName?: string;
      };
      senderName = p.fullName ?? p.username ?? p.displayName ?? null;
    }
  } catch (err) {
    console.error("Lỗi đọc thông tin người gửi để tạo thông báo:", err);
  }

  const sourceAccRef = ref(firebaseRtdb, `accounts/${sourceAccNumber}`);
  const sourceAccSnapBefore = await get(sourceAccRef);
  if (!sourceAccSnapBefore.exists())
    throw new Error("Không tìm thấy tài khoản nguồn.");

  let newSourceBalance = 0;

  await runTransaction(sourceAccRef, (current: unknown) => {
    if (!current) return current;

    const acc = current as RtdbAccountMutable;
    const currentBalance = toNumber(acc.balance);

    if (currentBalance < amount) {
      return { ...acc, __insufficient: true };
    }

    const updatedBalance = currentBalance - amount;
    newSourceBalance = updatedBalance;

    return { ...acc, balance: updatedBalance, __insufficient: null };
  });

  const afterSourceSnap = await get(sourceAccRef);
  const afterSource = afterSourceSnap.val() as RtdbAccountMutable | null;
  if (afterSource && afterSource.__insufficient) {
    await update(sourceAccRef, { __insufficient: null });
    throw new Error(
      "Số dư tài khoản nguồn không đủ (có thể đã thay đổi trong lúc xử lý)."
    );
  }

  let newDestBalance: number | null = null;

  if (isInternal && destAccNumber) {
    const destAccRef = ref(firebaseRtdb, `accounts/${destAccNumber}`);
    await runTransaction(destAccRef, (current: unknown) => {
      if (!current) return current;

      const acc = current as RtdbAccount;
      const currentBalance = toNumber(acc.balance);
      const updatedBalance = currentBalance + amount;
      newDestBalance = updatedBalance;

      return { ...acc, balance: updatedBalance };
    });
  }

  // ✅ 4) SUCCESS
  await update(txnRef, { status: "SUCCESS", executedAt: now });

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

  historyPromises.push(
    set(
      ref(
        firebaseRtdb,
        `accountTransactions/${sourceAccNumber}/${transactionId}`
      ),
      {
        ...historyItem,
        direction: "OUT",
      }
    ).then(() => undefined)
  );

  if (isInternal && destAccNumber) {
    historyPromises.push(
      set(
        ref(
          firebaseRtdb,
          `accountTransactions/${destAccNumber}/${transactionId}`
        ),
        {
          ...historyItem,
          direction: "IN",
        }
      ).then(() => undefined)
    );
  }

  await Promise.all(historyPromises);

  const notificationsPromises: Promise<void>[] = [];

  const destDisplayName =
    txn.destinationName || destAccNumber || "tài khoản khác";
  const senderTitle = `Chuyển tiền đến ${destDisplayName}`;
  const senderMessage = `Đã chuyển ${amount.toLocaleString(
    "vi-VN"
  )} VND đến ${destDisplayName}${destBankName ? ` (${destBankName})` : ""}.`;

  notificationsPromises.push(
    set(
      ref(firebaseRtdb, `notifications/${currentUser.uid}/${transactionId}`),
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
    ).then(() => undefined)
  );

  const receiverUid = txn.destAccUid;
  if (isInternal && destAccNumber && receiverUid) {
    const senderDisplay = senderName ?? sourceAccNumber;
    const receiverTitle = `Nhận tiền từ ${senderDisplay}`;
    const receiverMessage = `Tài khoản ${destAccNumber} nhận ${amount.toLocaleString(
      "vi-VN"
    )} VND từ ${senderDisplay}.`;

    notificationsPromises.push(
      set(ref(firebaseRtdb, `notifications/${receiverUid}/${transactionId}`), {
        type: "BALANCE_CHANGE",
        direction: "IN",
        title: receiverTitle,
        message: receiverMessage,
        amount,
        accountNumber: destAccNumber,
        balanceAfter: newDestBalance,
        transactionId,
        createdAt: now,
      }).then(() => undefined)
    );
  }

  await Promise.all(notificationsPromises);

  return { transactionId, status: "SUCCESS", newBalance: newSourceBalance };
}
