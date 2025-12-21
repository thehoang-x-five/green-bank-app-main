// src/services/otpService.ts
import { firebaseRtdb } from "@/lib/firebase";
import { ref, set, get, remove } from "firebase/database";
import emailjs from "@emailjs/browser";

// === ID của EmailJS ===
const SERVICE_ID = "service_zw6iy8k";
const TEMPLATE_ID = "template_gjbyxqg";
const PUBLIC_KEY = "lGlHvgbAvmq1lnswI";

/* ================== HELPER DÙNG CHUNG CHO OTP SỐ ================== */

/**
 * Tạo OTP số với độ dài tuỳ ý (dùng cho Smart-OTP trong app).
 */
export function generateNumericOtp(length = 6): string {
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

/**
 * Hash đơn giản cho OTP (dùng khi cần lưu OTP dạng mã hoá, ví dụ gắn với giao dịch).
 * Đồ án ok, thực tế nên dùng thuật toán hash mạnh hơn.
 */
export function hashOtp(otp: string): string {
  return btoa(otp);
}

// Tạo OTP 6 số ngẫu nhiên (cho flow email OTP hiện tại)
function generateOtp(): string {
  return generateNumericOtp(6);
}

// Firebase path không cho ., #, $, [, ]
function emailToKey(email: string): string {
  return email.replace(/[.#$[\]]/g, "_");
}

// Gửi OTP: lưu vào Realtime DB + gửi email
export async function sendOtp(email: string, phone: string) {
  const otp = generateOtp();
  const expiresAt = Date.now() + 3 * 60 * 1000; // 3 phút

  const key = emailToKey(email);

  // 1. Lưu OTP vào Realtime Database (dạng plain text cho login / eKYC)
  await set(ref(firebaseRtdb, `otpSessions/${key}`), {
    email,
    phone,
    otp,
    expiresAt,
  });

  // 2. Gửi email qua EmailJS
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: email, // phải trùng {{to_email}} trong template EmailJS
      otp_code: otp, // phải trùng {{otp_code}}
    },
    PUBLIC_KEY
  );
}

// Kiểm tra OTP (cho flow email OTP hiện tại)
export async function verifyOtp(email: string, otpInput: string) {
  const key = emailToKey(email);
  const snapshot = await get(ref(firebaseRtdb, `otpSessions/${key}`));

  if (!snapshot.exists()) {
    return {
      ok: false,
      message: "OTP không tồn tại hoặc đã hết hạn. Vui lòng gửi lại OTP.",
    };
  }

  const data = snapshot.val() as { otp: string; expiresAt: number };

  if (Date.now() > data.expiresAt) {
    await remove(ref(firebaseRtdb, `otpSessions/${key}`));
    return { ok: false, message: "OTP đã hết hạn. Vui lòng gửi lại OTP." };
  }

  if (otpInput !== data.otp) {
    return {
      ok: false,
      message: "OTP không chính xác. Vui lòng kiểm tra lại.",
    };
  }

  // OTP đúng -> xóa để không dùng lại
  await remove(ref(firebaseRtdb, `otpSessions/${key}`));
  return { ok: true, message: "Xác thực OTP thành công." };
}

/* ================== TRANSACTION OTP (for utilities, flights, etc.) ================== */

/**
 * Send OTP for transaction confirmation
 * Stores OTP in otps/{transactionId} node
 */
export async function sendOtpEmail(
  userId: string,
  transactionId: string,
  transactionType: string
): Promise<{
  maskedEmail: string;
  expireAt: number;
  devOtpCode?: string;
}> {
  // Get user email
  const userRef = ref(firebaseRtdb, `users/${userId}`);
  const userSnap = await get(userRef);

  if (!userSnap.exists()) {
    throw new Error("Không tìm thấy thông tin người dùng");
  }

  const userData = userSnap.val() as { email?: string };
  const email = userData.email;

  if (!email) {
    throw new Error("Không tìm thấy email người dùng");
  }

  // Generate OTP
  const otp = generateNumericOtp(6);
  const expireAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Store OTP in database
  await set(ref(firebaseRtdb, `otps/${transactionId}`), {
    userId,
    transactionId,
    transactionType,
    code: otp,
    expireAt,
    createdAt: Date.now(),
  });

  // Send email
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: email,
        otp_code: otp,
      },
      PUBLIC_KEY
    );
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    // Don't throw error, OTP is still stored in database
  }

  // Mask email for display
  const [localPart, domain] = email.split("@");
  const maskedLocal =
    localPart.length > 2
      ? localPart[0] + "***" + localPart[localPart.length - 1]
      : "***";
  const maskedEmail = `${maskedLocal}@${domain}`;

  return {
    maskedEmail,
    expireAt,
    devOtpCode: otp, // For development/testing only
  };
}
