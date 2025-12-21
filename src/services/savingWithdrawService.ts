// src/services/savingWithdrawService.ts
import { firebaseRtdb } from "@/lib/firebase";
import { get, ref, runTransaction, update, set, push, serverTimestamp } from "firebase/database";

type SavingStatus = "ACTIVE" | "CLOSED";

type InitiateSavingWithdrawArgs = {
  savingNumber: string;
  payoutAccountNumber: string;
  isEarlyWithdrawal: boolean;
};

export type InitiateSavingWithdrawResponse = {
  transactionId: string;
  maskedEmail: string;
  expireAt: number;
  amount: number; // payout amount
  devOtpCode?: string;
};

export type ResendOtpResponse = {
  maskedEmail: string;
  expireAt: number;
  devOtpCode?: string;
};

type SavingAccountInDb = {
  uid?: string;
  number?: string;
  amount?: number | string;
  term?: string;
  rate?: number | string;
  openDate?: string; // yyyy-mm-dd
  maturityDate?: string; // yyyy-mm-dd
  status?: string; // ACTIVE/CLOSED
};

type SavingWithdrawTx = {
  uid: string;
  savingNumber: string;
  payoutAccountNumber: string;

  principal: number;
  interestAmount: number;
  payoutAmount: number;

  isEarlyWithdrawal: boolean;
  earlyRateApplied: number;

  status: "PENDING" | "SUCCESS" | "EXPIRED";
  otpCode: string;

  createdAt: number;
  expireAt: number;

  confirmedAt?: number;
};

const OTP_TTL_MS = 3 * 60 * 1000; // 3 phút

const parseMoneyLike = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const maskEmail = (email: string): string => {
  const e = (email || "").trim();
  const at = e.indexOf("@");
  if (at <= 1) return "****";
  const name = e.slice(0, at);
  const domain = e.slice(at);
  const keep = Math.min(2, name.length);
  return `${name.slice(0, keep)}***${domain}`;
};

const nowIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// yyyy-mm-dd so sánh chuỗi được
const isMatured = (today: string, maturityDate: string) => {
  if (!maturityDate) return false;
  return today >= maturityDate;
};

const getMonthsFromLabel = (term: string): number => {
  const t = (term || "").toLowerCase();
  if (t.includes("1 tháng")) return 1;
  if (t.includes("3 tháng")) return 3;
  if (t.includes("6 tháng")) return 6;
  if (t.includes("12 tháng") || t.includes("1 năm")) return 12;
  return 12;
};

// demo tháng đã giữ (xấp xỉ)
const approxHeldMonths = (openDateIso: string): number => {
  const parts = (openDateIso || "").split("-");
  if (parts.length !== 3) return 0;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0;

  const start = new Date(y, m - 1, d).getTime();
  const diffDays = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  return Math.max(0, Math.floor(diffDays / 30));
};

// đọc lãi “không kỳ hạn” để demo rút trước hạn có lãi nhỏ
const readEarlyRate = async (): Promise<number> => {
  const paths = ["interestConfig/savingEarlyRate", "config/rates/savingEarlyRate"];
  for (const p of paths) {
    const s = await get(ref(firebaseRtdb, p));
    if (!s.exists()) continue;
    const n = parseMoneyLike(s.val());
    if (n >= 0 && n <= 99) return n;
  }
  return 0; // mặc định: mất lãi
};

const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const genTxId = () => `SW_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

async function getUserEmail(uid: string): Promise<string> {
  const snap = await get(ref(firebaseRtdb, `users/${uid}/email`));
  return snap.exists() ? String(snap.val() || "") : "";
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
  form.set("purpose", "SAVING_WITHDRAW");

  const apiKey = getEnvString([
    "VITE_OTP_EMAIL_API_KEY",
    "VITE_GAS_EMAIL_API_KEY",
    "VITE_GAS_API_KEY",
  ]);
  if (apiKey) form.set("apiKey", apiKey);

  await postFormNoCors(webappUrl, form);
  return true;
}

export async function initiateSavingWithdrawOtpAfterPin(
  uid: string,
  args: InitiateSavingWithdrawArgs
): Promise<InitiateSavingWithdrawResponse> {
  const savingRef = ref(firebaseRtdb, `savingAccounts/${uid}/${args.savingNumber}`);
  const savingSnap = await get(savingRef);

  if (!savingSnap.exists()) {
    throw new Error("Không tìm thấy sổ tiết kiệm.");
  }

  const raw = savingSnap.val() as SavingAccountInDb;

  const status = (raw.status || "ACTIVE").toString().toUpperCase().trim() as SavingStatus;
  if (status === "CLOSED") {
    throw new Error("Sổ tiết kiệm đã tất toán.");
  }

  const principal = parseMoneyLike(raw.amount);
  if (principal <= 0) {
    throw new Error("Sổ tiết kiệm không có số dư hợp lệ.");
  }

  const contractRate = parseMoneyLike(raw.rate); // %/năm (đã chốt theo hợp đồng)
  const termMonths = getMonthsFromLabel(raw.term || "");
  const today = nowIso();

  const matured = isMatured(today, raw.maturityDate || "");
  const earlyRate = await readEarlyRate();

  let interestAmount = 0;

  if (args.isEarlyWithdrawal) {
    // rút trước hạn: mất lãi hoặc lãi nhỏ
    if (earlyRate > 0) {
      const heldMonths = approxHeldMonths(raw.openDate || "");
      interestAmount =
        heldMonths > 0
          ? Math.round(principal * (earlyRate / 100) * (heldMonths / 12))
          : 0;
    } else {
      interestAmount = 0;
    }
  } else {
    // tất toán đúng hạn: bắt buộc phải đến đáo hạn (backend check lại)
    if (!matured) {
      throw new Error("Chưa đến ngày đáo hạn nên chỉ có thể rút trước hạn.");
    }
    if (contractRate > 0 && termMonths > 0) {
      interestAmount = Math.round(principal * (contractRate / 100) * (termMonths / 12));
    } else {
      interestAmount = 0;
    }
  }

  const payoutAmount = principal + interestAmount;

  const transactionId = genTxId();
  const otpCode = genOtp();
  const createdAt = Date.now();
  const expireAt = createdAt + OTP_TTL_MS;

  const tx: SavingWithdrawTx = {
    uid,
    savingNumber: args.savingNumber,
    payoutAccountNumber: args.payoutAccountNumber,
    principal,
    interestAmount,
    payoutAmount,
    isEarlyWithdrawal: args.isEarlyWithdrawal,
    earlyRateApplied: args.isEarlyWithdrawal ? earlyRate : 0,
    status: "PENDING",
    otpCode,
    createdAt,
    expireAt,
  };

  await set(ref(firebaseRtdb, `savingWithdrawOtps/${uid}/${transactionId}`), tx);

  const email = await getUserEmail(uid);
  const maskedEmail = maskEmail(email);

  // ✅ Gửi OTP qua email giống như mortgageService
  try {
    await sendOtpEmailViaGAS({ toEmail: email, otp: otpCode, transactionId });
  } catch (e: unknown) {
    // Nếu gửi email thất bại, xóa transaction đã tạo
    await set(ref(firebaseRtdb, `savingWithdrawOtps/${uid}/${transactionId}`), null);
    
    const msg = e instanceof Error ? e.message : "Gửi OTP thất bại.";
    throw new Error(`Gửi OTP thất bại: ${msg}`);
  }

  // Chỉ hiển thị devOtpCode khi không có cấu hình email gateway
  const devShown = !getEnvString([
    "VITE_OTP_EMAIL_WEBAPP_URL",
    "VITE_GAS_EMAIL_WEBAPP_URL",
    "VITE_GAS_WEBAPP_URL",
  ]);

  return {
    transactionId,
    maskedEmail,
    expireAt,
    amount: payoutAmount,
    devOtpCode: devShown ? otpCode : undefined,
  };
}

export async function resendSavingWithdrawOtpOnlyWhenExpired(
  uid: string,
  transactionId: string
): Promise<ResendOtpResponse> {
  const txRef = ref(firebaseRtdb, `savingWithdrawOtps/${uid}/${transactionId}`);
  const snap = await get(txRef);

  if (!snap.exists()) {
    throw new Error("Không tìm thấy giao dịch OTP.");
  }

  const tx = snap.val() as SavingWithdrawTx;

  if (tx.status !== "PENDING") {
    throw new Error("Giao dịch không ở trạng thái chờ xác thực.");
  }

  if (Date.now() < tx.expireAt) {
    throw new Error("Chỉ được gửi lại OTP khi OTP hiện tại đã hết hạn.");
  }

  const otpCode = genOtp();
  const expireAt = Date.now() + OTP_TTL_MS;

  await update(txRef, {
    otpCode,
    expireAt,
  });

  const email = await getUserEmail(uid);
  const maskedEmail = maskEmail(email);

  // ✅ Gửi OTP qua email
  try {
    await sendOtpEmailViaGAS({ toEmail: email, otp: otpCode, transactionId });
  } catch (e: unknown) {
    // Rollback nếu gửi email thất bại
    await update(txRef, {
      otpCode: tx.otpCode,
      expireAt: tx.expireAt,
    });
    
    const msg = e instanceof Error ? e.message : "Gửi OTP thất bại.";
    throw new Error(`Gửi OTP thất bại: ${msg}`);
  }

  // Chỉ hiển thị devOtpCode khi không có cấu hình email gateway
  const devShown = !getEnvString([
    "VITE_OTP_EMAIL_WEBAPP_URL",
    "VITE_GAS_EMAIL_WEBAPP_URL",
    "VITE_GAS_WEBAPP_URL",
  ]);

  return { 
    maskedEmail, 
    expireAt, 
    devOtpCode: devShown ? otpCode : undefined 
  };
}

export async function confirmSavingWithdrawWithOtp(
  uid: string,
  transactionId: string,
  otpCode: string
): Promise<void> {
  const txRef = ref(firebaseRtdb, `savingWithdrawOtps/${uid}/${transactionId}`);
  const snap = await get(txRef);

  if (!snap.exists()) {
    throw new Error("Không tìm thấy giao dịch OTP.");
  }

  const tx = snap.val() as SavingWithdrawTx;

  if (tx.status !== "PENDING") {
    throw new Error("Giao dịch đã được xử lý hoặc không hợp lệ.");
  }

  if (Date.now() > tx.expireAt) {
    await update(txRef, { status: "EXPIRED" });
    throw new Error("OTP đã hết hạn. Vui lòng gửi lại OTP.");
  }

  if (tx.otpCode !== otpCode) {
    throw new Error("OTP không đúng.");
  }

  // 1) Cộng tiền về tài khoản thanh toán
  const balRef = ref(firebaseRtdb, `accounts/${tx.payoutAccountNumber}/balance`);
  const balTx = await runTransaction(balRef, (cur) => {
    const current = parseMoneyLike(cur);
    return current + tx.payoutAmount;
  });

  if (!balTx.committed) {
    throw new Error("Không thể cộng tiền vào tài khoản. Vui lòng thử lại.");
  }

  const confirmedAt = Date.now();

  // 2) Đóng sổ (amount = 0, status = CLOSED)
  const savingRef = ref(firebaseRtdb, `savingAccounts/${uid}/${tx.savingNumber}`);
  const savingSnap = await get(savingRef);
  if (!savingSnap.exists()) {
    throw new Error("Không tìm thấy sổ tiết kiệm để tất toán.");
  }

  await update(savingRef, {
    status: "CLOSED",
    amount: 0,
    closedAt: confirmedAt,
    payoutAccountNumber: tx.payoutAccountNumber,
    payoutAmount: tx.payoutAmount,
    interestAmountPaid: tx.interestAmount,
    isEarlyWithdrawal: tx.isEarlyWithdrawal,
    earlyRateApplied: tx.earlyRateApplied,
  });

  // 3) Mark tx success
  await update(txRef, {
    status: "SUCCESS",
    confirmedAt,
  });

  // 4) ✅ Lưu lịch sử giao dịch và thông báo (giống mortgageService)
  try {
    const newBalance = parseMoneyLike(balTx.snapshot.val());

    // Lưu vào lịch sử giao dịch tài khoản
    const txListRef = ref(firebaseRtdb, `accountTransactions/${tx.payoutAccountNumber}`);
    const newTxRef = push(txListRef);
    await set(newTxRef, {
      type: "SAVING_WITHDRAW",
      direction: "IN",
      amount: tx.payoutAmount,
      currency: "VND",
      createdAt: serverTimestamp(),
      description: `Tất toán sổ tiết kiệm ${tx.savingNumber} ${tx.isEarlyWithdrawal ? "(rút trước hạn)" : "(đúng hạn)"}`,
      transactionId,
      savingNumber: tx.savingNumber,
      principalAmount: tx.principal,
      interestAmount: tx.interestAmount,
      isEarlyWithdrawal: tx.isEarlyWithdrawal,
      earlyRateApplied: tx.earlyRateApplied,
    });

    // Thông báo thay đổi số dư
    const balNotiRef = push(ref(firebaseRtdb, `notifications/${uid}`));
    await set(balNotiRef, {
      type: "BALANCE_CHANGE",
      direction: "IN",
      title: "Tất toán tiết kiệm",
      message: `Tất toán sổ tiết kiệm ${tx.savingNumber} về tài khoản ${tx.payoutAccountNumber}.`,
      amount: tx.payoutAmount,
      accountNumber: tx.payoutAccountNumber,
      balanceAfter: newBalance,
      transactionId,
      createdAt: confirmedAt,
    });

    // Thông báo riêng về việc tất toán
    const notifRef = push(ref(firebaseRtdb, `notifications/${uid}`));
    await set(notifRef, {
      type: "SAVING_WITHDRAW",
      title: "Tất toán tiết kiệm thành công",
      message: `Bạn đã tất toán sổ tiết kiệm ${tx.savingNumber} với số tiền ${tx.payoutAmount.toLocaleString("vi-VN")} VND ${tx.isEarlyWithdrawal ? "(rút trước hạn)" : "(đúng hạn)"}.`,
      createdAt: serverTimestamp(),
      read: false,
      savingNumber: tx.savingNumber,
      payoutAmount: tx.payoutAmount,
      principalAmount: tx.principal,
      interestAmount: tx.interestAmount,
      isEarlyWithdrawal: tx.isEarlyWithdrawal,
    });
  } catch (error) {
    // Không ảnh hưởng đến logic chính, chỉ log lỗi
    console.error("Lỗi khi lưu lịch sử giao dịch:", error);
  }
}
