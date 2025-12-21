// src/services/mortgageService.ts
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import {
  get,
  push,
  ref,
  runTransaction,
  set,
  serverTimestamp,
  update,
} from "firebase/database";
import { getPrimaryAccount } from "@/services/accountService";
import { getUserProfile, verifyTransactionPin } from "@/services/userService";
import type { AppUserProfile } from "@/services/authService";

const HIGH_VALUE_THRESHOLD_VND = 10_000_000;

export type MortgageScheduleStatus = "DUE" | "PAID";

export interface MortgageInterestScheduleItem {
  yyyymm: string;
  interestAmount: number;
  status: MortgageScheduleStatus;
  createdAt: number;
  paidAt?: number;
  paidByAccountNumber?: string;
}

interface MortgageInterestScheduleInDb {
  yyyymm?: string;
  interestAmount?: number | string;
  status?: string;
  createdAt?: number;
  paidAt?: number;
  paidByAccountNumber?: string;

  // ✅ optional fields (bổ sung) – không phá schema cũ
  principalAmount?: number | string;
  totalAmount?: number | string;
}

type MortgageAccountInDb = {
  uid?: string;
  number?: string;
  originalAmount?: number | string;
  debtRemaining?: number | string;
  termMonths?: number | string;
  rate?: number | string;
  startDate?: string;
  maturityDate?: string;
  note?: string;
  createdAt?: number;
  updatedAt?: number;
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

// ✅ tính số tiền phải trả kỳ này = gốc + lãi (theo mô hình gốc chia đều)
async function computeDueForMortgagePeriod(params: {
  uid: string;
  mortgageAccountNumber: string;
}): Promise<{
  debtBefore: number;
  debtAfter: number;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  rateYearly: number;
  termMonths: number;
  originalAmount: number;
}> {
  const mortgageRef = ref(
    firebaseRtdb,
    `mortgageAccounts/${params.uid}/${params.mortgageAccountNumber}`
  );
  const mortgageSnap = await get(mortgageRef);
  if (!mortgageSnap.exists()) {
    throw new Error("Không tìm thấy tài khoản thế chấp để tính số tiền phải trả.");
  }

  const m = mortgageSnap.val() as MortgageAccountInDb;

  const originalAmount = toNumber(m.originalAmount);
  const debtBefore = toNumber(m.debtRemaining);
  const termMonthsRaw = toNumber(m.termMonths);
  const termMonths = termMonthsRaw > 0 ? Math.round(termMonthsRaw) : 0;

  const rateYearly = toNumber(m.rate);
  const monthlyRate = rateYearly > 0 ? rateYearly / 100 / 12 : 0;

  if (debtBefore <= 0) {
    return {
      debtBefore,
      debtAfter: 0,
      principalDue: 0,
      interestDue: 0,
      totalDue: 0,
      rateYearly,
      termMonths,
      originalAmount,
    };
  }

  // lãi kỳ này (ước tính) theo dư nợ hiện tại
  const interestDue =
    debtBefore > 0 && monthlyRate > 0 ? Math.round(debtBefore * monthlyRate) : 0;

  // gốc chia đều theo kỳ hạn (giữ cùng logic UI bên OfficerCustomerDetailPage: Math.round)
  const principalPerMonth =
    termMonths > 0 && originalAmount > 0 ? Math.round(originalAmount / termMonths) : 0;

  const principalDue = principalPerMonth > 0 ? Math.min(debtBefore, principalPerMonth) : 0;

  const totalDue = principalDue + interestDue;
  const debtAfter = Math.max(0, debtBefore - principalDue);

  return {
    debtBefore,
    debtAfter,
    principalDue,
    interestDue,
    totalDue,
    rateYearly,
    termMonths,
    originalAmount,
  };
}

export const fetchMortgageInterestSchedules = async (
  uid: string,
  mortgageAccountNumber: string
): Promise<MortgageInterestScheduleItem[]> => {
  const user = firebaseAuth.currentUser;
  if (!user || user.uid !== uid) return [];

  const basePath = `mortgageInterestSchedules/${uid}/${mortgageAccountNumber}`;
  const snap = await get(ref(firebaseRtdb, basePath));
  if (!snap.exists()) return [];

  const raw = snap.val() as Record<string, MortgageInterestScheduleInDb>;
  const list: MortgageInterestScheduleItem[] = Object.keys(raw)
    .map((key) => {
      const item = raw[key];
      const yyyymm = item.yyyymm ?? key;
      const interestAmount = toNumber(item.interestAmount);
      const status =
        item.status === "PAID" ? "PAID" : ("DUE" as MortgageScheduleStatus);

      return {
        yyyymm,
        interestAmount,
        status,
        createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
        paidAt: typeof item.paidAt === "number" ? item.paidAt : undefined,
        paidByAccountNumber:
          typeof item.paidByAccountNumber === "string"
            ? item.paidByAccountNumber
            : undefined,
      };
    })
    .sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));

  return list;
};

export type PayMortgageInterestResult =
  | { ok: true; newBalance: number; paidAt: number; paidByAccountNumber: string }
  | { ok: false; error: string };

/**
 * ✅ Non-OTP flow
 * Trừ tiền = gốc + lãi, đồng thời giảm debtRemaining
 */
export const payMortgageInterest = async (params: {
  uid: string;
  mortgageAccountNumber: string;
  yyyymm: string;
}): Promise<PayMortgageInterestResult> => {
  const user = firebaseAuth.currentUser;
  if (!user || user.uid !== params.uid) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
  }

  const schedulePath = `mortgageInterestSchedules/${params.uid}/${params.mortgageAccountNumber}/${params.yyyymm}`;
  const scheduleSnap = await get(ref(firebaseRtdb, schedulePath));
  if (!scheduleSnap.exists()) {
    return { ok: false, error: "Không tìm thấy kỳ cần đóng." };
  }

  const schedule = scheduleSnap.val() as MortgageInterestScheduleInDb;
  const status = typeof schedule.status === "string" ? schedule.status : "DUE";
  if (status === "PAID") {
    return { ok: false, error: "Kỳ này đã được đóng trước đó." };
  }

  // ✅ tính tổng phải trả = gốc + lãi
  let due;
  try {
    due = await computeDueForMortgagePeriod({
      uid: params.uid,
      mortgageAccountNumber: params.mortgageAccountNumber,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Không tính được số tiền phải trả.";
    return { ok: false, error: msg };
  }

  if (due.totalDue <= 0) {
    return { ok: false, error: "Khoản vay đã tất toán hoặc số tiền phải trả không hợp lệ." };
  }

  // ✅ TRỪ TIỀN TỪ TÀI KHOẢN THANH TOÁN CHÍNH
  const primary = await getPrimaryAccount(params.uid);
  const paymentAccountNumber = primary?.accountNumber?.trim() ?? "";
  if (!paymentAccountNumber) {
    return { ok: false, error: "Không tìm thấy tài khoản thanh toán chính để trừ tiền." };
  }

  const balanceRef = ref(firebaseRtdb, `accounts/${paymentAccountNumber}/balance`);
  const balSnap = await get(balanceRef);
  const currentBalance = toNumber(balSnap.val());

  if (currentBalance < due.totalDue) {
    return {
      ok: false,
      error:
        "Không đủ số dư để đóng kỳ (gốc + lãi). Vui lòng nạp thêm tiền vào tài khoản thanh toán.",
    };
  }

  const tx = await runTransaction(balanceRef, (cur: unknown) => {
    const bal = toNumber(cur);
    if (bal < due.totalDue) return bal;
    return bal - due.totalDue;
  });

  if (!tx.committed) {
    return { ok: false, error: "Không thể trừ tiền. Vui lòng thử lại." };
  }

  const newBalance = toNumber(tx.snapshot.val());
  const paidAt = Date.now();

  // ✅ cập nhật: schedule PAID + ghi thêm principal/total + giảm debtRemaining
  await update(ref(firebaseRtdb), {
    [`${schedulePath}/status`]: "PAID",
    [`${schedulePath}/paidAt`]: paidAt,
    [`${schedulePath}/paidByAccountNumber`]: paymentAccountNumber,

    // cập nhật số liệu kỳ đã đóng (không phá schema cũ)
    [`${schedulePath}/interestAmount`]: due.interestDue,
    [`${schedulePath}/principalAmount`]: due.principalDue,
    [`${schedulePath}/totalAmount`]: due.totalDue,

    [`mortgageAccounts/${params.uid}/${params.mortgageAccountNumber}/debtRemaining`]:
      due.debtAfter,
    [`mortgageAccounts/${params.uid}/${params.mortgageAccountNumber}/updatedAt`]: paidAt,
  });

  return { ok: true, newBalance, paidAt, paidByAccountNumber: paymentAccountNumber };
};

/* =========================================================
   ✅ OTP PAY MORTGAGE INTEREST FLOW (Email OTP)
   - Tạo txn + otp -> confirm mới trừ tiền + set schedule PAID
   - Resend: CHỈ cho phép khi OTP hiện tại đã HẾT HẠN
========================================================= */

type UserWithEkycFlags = AppUserProfile & {
  ekycStatus?: string;
  kycStatus?: string;
  canTransact?: boolean;
};

type AccountNode = {
  uid?: string;
  balance?: number | string;
  status?: string;
  createdAt?: number | string;
  [key: string]: unknown;
};

function normalizeStatus(raw: unknown): "ACTIVE" | "LOCKED" {
  return raw === "LOCKED" ? "LOCKED" : "ACTIVE";
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
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
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
}): Promise<boolean> {
  const webappUrl = getEnvString([
    "VITE_OTP_EMAIL_WEBAPP_URL",
    "VITE_GAS_EMAIL_WEBAPP_URL",
    "VITE_GAS_WEBAPP_URL",
  ]);

  if (!webappUrl) {
    // eslint-disable-next-line no-console
    console.log(
      `[DEV] OTP ${params.otp} -> ${params.toEmail} (txn ${params.transactionId})`
    );
    return false;
  }

  const form = new URLSearchParams();
  form.set("email", params.toEmail);
  form.set("otp", params.otp);
  form.set("transactionId", params.transactionId);
  form.set("purpose", "MORTGAGE_INTEREST");

  const apiKey = getEnvString([
    "VITE_OTP_EMAIL_API_KEY",
    "VITE_GAS_EMAIL_API_KEY",
    "VITE_GAS_API_KEY",
  ]);
  if (apiKey) form.set("apiKey", apiKey);

  await postFormNoCors(webappUrl, form);
  return true;
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

function generateOtpCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) code += Math.floor(Math.random() * 10).toString();
  return code;
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

type MortgageInterestPayTxnNode = {
  transactionId: string;
  type: "MORTGAGE_INTEREST_PAY";
  status: "PENDING_OTP" | "PROCESSING" | "SUCCESS" | "FAILED";
  uid: string;
  mortgageAccountNumber: string;
  yyyymm: string;

  // ✅ amount = tổng tiền phải trả kỳ này (gốc + lãi)
  amount: number;

  // ✅ bổ sung để confirm update đúng
  principalAmount: number;
  interestAmount: number;

  paymentAccountNumber: string;
  createdAt: number;
  executedAt: number | null;
  
  // ✅ NEW: Biometric fields for high-value transactions
  requiresBiometric?: boolean;
  biometricVerifiedAt?: number | null;
};

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

export type InitiateMortgageInterestOtpResponse = {
  transactionId: string;
  maskedEmail: string;
  expireAt: number;
  devOtpCode?: string;
};

// ===================== NEW: MARK BIOMETRIC FOR MORTGAGE INTEREST =====================

export async function markMortgageInterestTransactionBiometricVerified(transactionId: string): Promise<void> {
  if (!transactionId) throw new Error("Thiếu mã giao dịch.");

  const txnRef = ref(firebaseRtdb, `mortgageInterestPayTransactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) throw new Error("Không tìm thấy giao dịch.");

  const txn = txnSnap.val() as MortgageInterestPayTxnNode;

  if (txn.type !== "MORTGAGE_INTEREST_PAY") {
    throw new Error("Giao dịch không đúng loại thanh toán thế chấp.");
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

export async function initiatePayMortgageInterestOtp(params: {
  uid: string;
  mortgageAccountNumber: string;
  yyyymm: string;
  paymentAccountNumber: string;
  pin: string;
}): Promise<InitiateMortgageInterestOtpResponse> {
  const user = firebaseAuth.currentUser;
  if (!user || user.uid !== params.uid) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  await ensureUserCanTransact(params.uid);

  const pinTrim = params.pin.trim();
  if (!pinTrim) throw new Error("Vui lòng nhập mã PIN giao dịch.");

  // ✅ bắt buộc đúng PIN trước khi gửi OTP
  await verifyTransactionPin(params.uid, pinTrim);

  const schedulePath = `mortgageInterestSchedules/${params.uid}/${params.mortgageAccountNumber}/${params.yyyymm}`;
  const scheduleSnap = await get(ref(firebaseRtdb, schedulePath));
  if (!scheduleSnap.exists()) throw new Error("Không tìm thấy kỳ cần đóng.");

  const schedule = scheduleSnap.val() as MortgageInterestScheduleInDb;
  if (typeof schedule.status === "string" && schedule.status.toUpperCase() === "PAID") {
    throw new Error("Kỳ này đã được đóng trước đó.");
  }

  // ✅ tính tổng phải trả = gốc + lãi
  const due = await computeDueForMortgagePeriod({
    uid: params.uid,
    mortgageAccountNumber: params.mortgageAccountNumber,
  });

  if (due.totalDue <= 0) {
    throw new Error("Khoản vay đã tất toán hoặc số tiền phải trả không hợp lệ.");
  }

  // verify payment account belongs to user + active
  const accSnap = await get(ref(firebaseRtdb, `accounts/${params.paymentAccountNumber}`));
  if (!accSnap.exists()) throw new Error("Không tìm thấy tài khoản thanh toán để trích tiền.");

  const acc = accSnap.val() as AccountNode;
  if (String(acc.uid ?? "") !== params.uid) throw new Error("Tài khoản thanh toán không thuộc về bạn.");
  if (normalizeStatus(acc.status) !== "ACTIVE") throw new Error("Tài khoản thanh toán đang bị khóa.");

  // early balance check (gốc + lãi)
  const balSnap = await get(ref(firebaseRtdb, `accounts/${params.paymentAccountNumber}/balance`));
  const curBal = toNumber(balSnap.val());
  if (curBal < due.totalDue) {
    throw new Error("Không đủ số dư để đóng kỳ (gốc + lãi). Vui lòng nạp thêm tiền vào tài khoản thanh toán.");
  }

  const profile = await getUserProfile(params.uid);
  if (!profile || !profile.email) throw new Error("Không tìm thấy email của bạn để gửi OTP.");

  const txnId = await generateNextTransactionId();
  const now = Date.now();
  const expireAt = now + 2 * 60 * 1000;
  const otp = generateOtpCode(6);

  const requiresBiometric = due.totalDue >= HIGH_VALUE_THRESHOLD_VND;

  const txn: MortgageInterestPayTxnNode = {
    transactionId: txnId,
    type: "MORTGAGE_INTEREST_PAY",
    status: "PENDING_OTP",
    uid: params.uid,
    mortgageAccountNumber: params.mortgageAccountNumber,
    yyyymm: params.yyyymm,

    amount: due.totalDue,              // ✅ tổng (gốc + lãi)
    principalAmount: due.principalDue, // ✅ gốc
    interestAmount: due.interestDue,   // ✅ lãi

    paymentAccountNumber: params.paymentAccountNumber,
    createdAt: now,
    executedAt: null,
    requiresBiometric,
    biometricVerifiedAt: null,
  };

  const otpNode: OtpNode = {
    transactionId: txnId,
    uid: params.uid,
    email: profile.email,
    otp,
    createdAt: now,
    expireAt,
    attemptsLeft: 5,
    used: false,
  };

  await set(ref(firebaseRtdb, `mortgageInterestPayTransactions/${txnId}`), txn);
  await set(ref(firebaseRtdb, `mortgageInterestPayOtps/${txnId}`), otpNode);

  try {
    await sendOtpEmailViaGAS({ toEmail: profile.email, otp, transactionId: txnId });
  } catch (e: unknown) {
    await set(ref(firebaseRtdb, `mortgageInterestPayOtps/${txnId}`), null);
    await set(ref(firebaseRtdb, `mortgageInterestPayTransactions/${txnId}`), null);

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

export async function resendMortgageInterestOtpOnlyWhenExpired(
  uid: string,
  transactionId: string
): Promise<{ expireAt: number; maskedEmail: string; devOtpCode?: string }> {
  if (!transactionId) throw new Error("Thiếu mã giao dịch.");

  const user = firebaseAuth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const otpRef = ref(firebaseRtdb, `mortgageInterestPayOtps/${transactionId}`);
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
    await sendOtpEmailViaGAS({ toEmail: otpData.email, otp: newOtp, transactionId });
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

export type ConfirmMortgageInterestOtpResponse = {
  transactionId: string;
  status: "SUCCESS";
  newBalance: number;
  paidAt: number;
  paidByAccountNumber: string;
};

export async function confirmPayMortgageInterestWithOtp(
  uid: string,
  transactionId: string,
  otpInput: string
): Promise<ConfirmMortgageInterestOtpResponse> {
  const user = firebaseAuth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const otpTrim = otpInput.trim();
  if (!transactionId || !otpTrim) throw new Error("Thiếu mã giao dịch hoặc OTP.");
  if (!/^\d{6}$/.test(otpTrim)) throw new Error("Mã OTP phải gồm 6 chữ số.");

  await ensureUserCanTransact(uid);

  const txnRef = ref(firebaseRtdb, `mortgageInterestPayTransactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) throw new Error("Không tìm thấy giao dịch.");

  const txn = txnSnap.val() as MortgageInterestPayTxnNode;
  if (txn.uid !== uid) throw new Error("Bạn không có quyền xác nhận giao dịch này.");
  if (txn.type !== "MORTGAGE_INTEREST_PAY") throw new Error("Giao dịch không đúng loại.");
  if (txn.status !== "PENDING_OTP") throw new Error("Giao dịch đã được xử lý trước đó.");

  const amount = Number(txn.amount);
  const requiresBiometric = txn.requiresBiometric === true || amount >= HIGH_VALUE_THRESHOLD_VND;
  const biometricVerifiedAt = txn.biometricVerifiedAt ?? null;

  if (requiresBiometric && !biometricVerifiedAt) {
    throw new Error("Giao dịch giá trị cao: bạn cần xác thực sinh trắc trước khi hoàn tất.");
  }

  const otpRef = ref(firebaseRtdb, `mortgageInterestPayOtps/${transactionId}`);
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

  // lock txn -> PROCESSING
  const lock = await runTransaction(txnRef, (cur: unknown) => {
    if (!cur || typeof cur !== "object") return cur;
    const obj = cur as Record<string, unknown>;

    const type = String(obj["type"] ?? "");
    const status = String(obj["status"] ?? "");
    const owner = String(obj["uid"] ?? "");

    if (type !== "MORTGAGE_INTEREST_PAY") return obj;
    if (owner !== uid) return obj;
    if (status !== "PENDING_OTP") return obj;

    return { ...obj, status: "PROCESSING" };
  });

  if (!lock.committed) throw new Error("Không thể xử lý giao dịch, vui lòng thử lại.");

  const principalAmount = Number(txn.principalAmount ?? 0);
  const interestAmount = Number(txn.interestAmount ?? 0);
  const paymentAccountNumber = String(txn.paymentAccountNumber ?? "");

  // verify payment account belongs to user + active
  const accSnap = await get(ref(firebaseRtdb, `accounts/${paymentAccountNumber}`));
  if (!accSnap.exists()) {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Không tìm thấy tài khoản thanh toán.");
  }

  const acc = accSnap.val() as AccountNode;
  if (String(acc.uid ?? "") !== uid) {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Tài khoản thanh toán không thuộc về bạn.");
  }
  if (normalizeStatus(acc.status) !== "ACTIVE") {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Tài khoản thanh toán đang bị khóa.");
  }

  const balanceRef = ref(firebaseRtdb, `accounts/${paymentAccountNumber}/balance`);
  const balSnap = await get(balanceRef);
  const serverBalance = toNumber(balSnap.val());
  if (serverBalance < amount) {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Không đủ số dư để đóng kỳ (gốc + lãi).");
  }

  const txBal = await runTransaction(
    balanceRef,
    (cur: unknown) => {
      const curBal = toNumber(cur);
      if (curBal < amount) return curBal;
      return curBal - amount;
    },
    { applyLocally: false }
  );

  if (!txBal.committed) {
    await update(txnRef, { status: "FAILED" });
    throw new Error("Không thể trừ tiền. Vui lòng thử lại.");
  }

  const paidAt = Date.now();

  // ✅ giảm debtRemaining theo principalAmount (đọc debt hiện tại để trừ an toàn)
  const mortgageRef = ref(firebaseRtdb, `mortgageAccounts/${uid}/${txn.mortgageAccountNumber}`);
  const mortgageSnap = await get(mortgageRef);
  const debtBeforeServer = mortgageSnap.exists()
    ? toNumber((mortgageSnap.val() as MortgageAccountInDb).debtRemaining)
    : 0;
  const debtAfterServer = Math.max(0, debtBeforeServer - Math.max(0, principalAmount));

  const schedulePath = `mortgageInterestSchedules/${uid}/${txn.mortgageAccountNumber}/${txn.yyyymm}`;
  await update(ref(firebaseRtdb), {
    // schedule -> PAID + lưu số liệu kỳ đã đóng
    [`${schedulePath}/status`]: "PAID",
    [`${schedulePath}/paidAt`]: paidAt,
    [`${schedulePath}/paidByAccountNumber`]: paymentAccountNumber,
    [`${schedulePath}/interestAmount`]: interestAmount,
    [`${schedulePath}/principalAmount`]: principalAmount,
    [`${schedulePath}/totalAmount`]: amount,

    // update dư nợ
    [`mortgageAccounts/${uid}/${txn.mortgageAccountNumber}/debtRemaining`]: debtAfterServer,
    [`mortgageAccounts/${uid}/${txn.mortgageAccountNumber}/updatedAt`]: paidAt,

    // txn -> SUCCESS
    [`mortgageInterestPayTransactions/${transactionId}/status`]: "SUCCESS",
    [`mortgageInterestPayTransactions/${transactionId}/executedAt`]: paidAt,

    // otp used
    [`mortgageInterestPayOtps/${transactionId}/used`]: true,
  });

  // ledger + notification (không ảnh hưởng logic khác)
  try {
    const txListRef = ref(firebaseRtdb, `accountTransactions/${paymentAccountNumber}`);
    const newTxRef = push(txListRef);
    await set(newTxRef, {
      type: "MORTGAGE_INTEREST_PAY",
      direction: "OUT",
      amount, // ✅ tổng (gốc + lãi)
      currency: "VND",
      createdAt: serverTimestamp(),
      description: `Thanh toán thế chấp kỳ ${txn.yyyymm} (gốc + lãi)`,
      transactionId,
      mortgageAccountNumber: txn.mortgageAccountNumber,
      principalAmount,
      interestAmount,
    });

    // BALANCE_CHANGE
    const finalBalance = toNumber(txBal.snapshot.val());

    const balNotiRef = push(ref(firebaseRtdb, `notifications/${uid}`));
    await set(balNotiRef, {
      type: "BALANCE_CHANGE",
      direction: "OUT",
      title: "Thanh toán thế chấp",
      message: `Thanh toán kỳ ${txn.yyyymm} cho tài khoản ${txn.mortgageAccountNumber} (gốc + lãi).`,
      amount,
      accountNumber: paymentAccountNumber,
      balanceAfter: finalBalance,
      transactionId,
      createdAt: paidAt,
    });

    // notification riêng
    const notifRef = push(ref(firebaseRtdb, `notifications/${uid}`));
    await set(notifRef, {
      type: "MORTGAGE_INTEREST_PAY",
      title: "Thanh toán thế chấp thành công",
      message: `Bạn đã thanh toán ${amount.toLocaleString("vi-VN")} VND (gốc + lãi) kỳ ${txn.yyyymm} từ tài khoản ${paymentAccountNumber}.`,
      createdAt: serverTimestamp(),
      read: false,
    });
  } catch {
    // ignore
  }

  return {
    transactionId,
    status: "SUCCESS",
    newBalance: toNumber(txBal.snapshot.val()),
    paidAt,
    paidByAccountNumber: paymentAccountNumber,
  };
}
