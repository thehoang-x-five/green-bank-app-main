// src/services/biometricService.ts

/**
 * Ngưỡng giao dịch giá trị cao (>= 10 triệu phải xác thực sinh trắc)
 */
export const HIGH_VALUE_THRESHOLD_VND = 10_000_000;

/**
 * Kết quả khi yêu cầu xác thực sinh trắc (mã code thô)
 */
export type BiometricResult =
  | "ok" // Xác thực thành công
  | "cancelled" // Người dùng huỷ
  | "unavailable" // Thiết bị / plugin không hỗ trợ
  | "error"; // Lỗi kỹ thuật khác

// ===== Kiểu dữ liệu tối thiểu cho plugin sinh trắc (fingerprint / FaceID) =====

interface BiometricVerifyIdentityOptions {
  reason: string;
  title?: string;
  subtitle?: string;
  description?: string;
}

interface BiometricShowOptions {
  title?: string;
  subtitle?: string;
  description?: string;
  disableBackup?: boolean;
}

type BiometricVerifyIdentityFn = (
  options: BiometricVerifyIdentityOptions
) => Promise<unknown>;

type BiometricShowFn = (options: BiometricShowOptions) => Promise<unknown>;

interface BiometricPlugin {
  verifyIdentity?: BiometricVerifyIdentityFn;
  show?: BiometricShowFn;
}

// Mở rộng kiểu window để TypeScript không báo lỗi
declare global {
  interface Window {
    NativeBiometric?: BiometricPlugin;
    BiometricAuth?: BiometricPlugin;
    FingerprintAIO?: BiometricPlugin;
    Fingerprint?: BiometricPlugin;
  }
}

/**
 * Thử gọi plugin sinh trắc trên thiết bị (Capacitor / Cordova).
 * Nếu không có plugin hoặc không hỗ trợ, trả về "unavailable".
 *
 * QUAN TRỌNG: Với hầu hết plugin,
 * - Promise RESOLVE ⇒ xác thực THÀNH CÔNG.
 * - Promise REJECT ⇒ user huỷ / lỗi / chưa cấu hình.
 * Nên ở đây: chỉ cần await không lỗi là coi là "ok".
 */
async function tryNativeBiometric(reason: string): Promise<BiometricResult> {
  try {
    const plugin: BiometricPlugin | undefined =
      window.FingerprintAIO ||
      window.NativeBiometric ||
      window.BiometricAuth ||
      window.Fingerprint;

    if (!plugin) {
      // Chưa tích hợp plugin sinh trắc
      return "unavailable";
    }

    // Nhánh 1: plugin có hàm verifyIdentity
    if (plugin.verifyIdentity) {
      await plugin.verifyIdentity({
        reason,
        title: "Xác thực sinh trắc",
        subtitle: "VietBank cần xác nhận chủ tài khoản",
        description: reason,
      });

      // Nếu không throw ⇒ xác thực thành công
      return "ok";
    }

    // Nhánh 2: một số plugin fingerprint dùng hàm show()
    if (plugin.show) {
      await plugin.show({
        title: "Xác thực sinh trắc",
        subtitle: "VietBank",
        description: reason,
        disableBackup: true,
      });

      // Nếu không throw ⇒ xác thực thành công
      return "ok";
    }

    // Có plugin nhưng không có API nào dùng được
    return "unavailable";
  } catch (err: unknown) {
    // Chuẩn hoá object lỗi
    const errorObject =
      typeof err === "object" && err !== null ? err : {};

    const errorLike = errorObject as {
      code?: unknown;
      message?: unknown;
    };

    console.error("Biometric error:", errorLike);

    // Lấy code (nếu plugin có trả về)
    let codeNumber: number | undefined;
    if (typeof errorLike.code === "number") {
      codeNumber = errorLike.code;
    } else if (typeof errorLike.code === "string") {
      const parsed = Number(errorLike.code);
      if (!Number.isNaN(parsed)) {
        codeNumber = parsed;
      }
    }

    // Lấy message dạng lowercase để dễ so sánh
    const rawMsg =
      typeof errorLike.message === "string"
        ? errorLike.message
        : String(errorLike.message ?? "");
    const messageLower = rawMsg.toLowerCase().trim();

    // 1️⃣ User tự huỷ / system cancel (chỉ khi message nói rõ "user")
    const isUserCancel =
      messageLower.includes("user cancel") ||
      messageLower.includes("user canceled") ||
      messageLower.includes("user cancelled") ||
      messageLower.includes("cancelled by user");

    if (isUserCancel) {
      return "cancelled";
    }

    // 2️⃣ Không có / chưa đăng ký sinh trắc -> unavailable
    const isUnavailable =
      codeNumber === 1 || // ví dụ: BIOMETRICS_UNAVAILABLE
      codeNumber === 3 || // ví dụ: BIOMETRICS_NOT_ENROLLED
      codeNumber === 14 || // ví dụ: PASSCODE_NOT_SET
      messageLower.includes("not enrolled") ||
      messageLower.includes("no enrolled") ||
      messageLower.includes("no biometrics") ||
      messageLower.includes("no biometric") ||
      messageLower.includes("no fingerprint") ||
      messageLower.includes("no fingerprints") ||
      messageLower.includes("no face") ||
      messageLower.includes("not available") ||
      messageLower.includes("unavailable") ||
      messageLower.includes("no hardware") ||
      messageLower.includes("passcode not set") ||
      messageLower === "cancelled" ||
      messageLower === "canceled";

    if (isUnavailable) {
      return "unavailable";
    }

    // 3️⃣ Plugin chưa cài / không chạy trên web
    const isPluginMissing =
      messageLower.includes("plugin_not_installed") ||
      messageLower.includes("not implemented") ||
      messageLower.includes("no plugin");

    if (isPluginMissing) {
      return "unavailable";
    }

    // 4️⃣ Các lỗi khác -> error kỹ thuật
    return "error";
  }
}

/**
 * Fallback trên web: dùng confirm() để demo luồng sinh trắc.
 */
async function fallbackConfirm(reason: string): Promise<BiometricResult> {
  const ok = window.confirm(
    `${reason}\n\n(Đây là bản demo: hãy bấm OK để giả lập "xác thực sinh trắc thành công")`
  );
  return ok ? "ok" : "cancelled";
}

/**
 * Hàm dùng cho logic "giao dịch giá trị cao" (nếu cần dùng chỗ khác):
 * - Nếu số tiền < ngưỡng: trả về "ok" (không bắt sinh trắc)
 * - Nếu >= 10 triệu: thử sinh trắc thật; nếu không có thì fallback confirm()
 */
export async function requireBiometricForHighValueVnd(
  amountVnd: number
): Promise<BiometricResult> {
  if (amountVnd < HIGH_VALUE_THRESHOLD_VND) {
    // Giao dịch nhỏ: không bắt sinh trắc
    return "ok";
  }

  const reason = `Giao dịch giá trị cao (${amountVnd.toLocaleString(
    "vi-VN"
  )} VND). Vui lòng xác thực sinh trắc (vân tay / FaceID).`;

  // 1. Thử sinh trắc thật (khi chạy trên thiết bị + đã tích hợp plugin)
  const nativeResult = await tryNativeBiometric(reason);
  if (nativeResult === "ok" || nativeResult === "cancelled") {
    return nativeResult;
  }

  // 2. Nếu thiếu plugin hoặc lỗi kỹ thuật -> fallback confirm demo
  const fallbackResult = await fallbackConfirm(reason);
  return fallbackResult;
}

/**
 * Kết quả trả về cho UI / page sử dụng (không dùng any, rõ ràng):
 */
export interface BiometricVerificationResponse {
  success: boolean;
  code: BiometricResult;
  message?: string;
}

/**
 * Hàm tiện ích dùng trong UI:
 * - Dùng được cho mọi trường hợp cần sinh trắc (không nhất thiết phải truyền amount)
 * - Page bên ngoài chỉ cần check result.success và show result.message
 */
export async function runBiometricVerification(
  reason?: string
): Promise<BiometricVerificationResponse> {
  const defaultReason = `Giao dịch giá trị cao (>= ${HIGH_VALUE_THRESHOLD_VND.toLocaleString(
    "vi-VN"
  )} VND). Vui lòng xác thực sinh trắc (vân tay / FaceID).`;

  const reasonText =
    reason && reason.trim().length > 0 ? reason : defaultReason;

  // Thử plugin trước
  const nativeResult = await tryNativeBiometric(reasonText);

  let finalCode: BiometricResult;

  if (nativeResult === "ok" || nativeResult === "cancelled") {
    finalCode = nativeResult;
  } else {
    // unavailable / error -> fallback confirm demo
    finalCode = await fallbackConfirm(reasonText);
  }

  // Map sang object cho UI
  switch (finalCode) {
    case "ok":
      return {
        success: true,
        code: "ok",
        message: "Xác thực sinh trắc thành công (demo).",
      };

    case "cancelled":
      return {
        success: false,
        code: "cancelled",
        message: "Bạn đã huỷ xác thực sinh trắc.",
      };

    case "unavailable":
      return {
        success: false,
        code: "unavailable",
        message:
          "Thiết bị không hỗ trợ hoặc chưa đăng ký sinh trắc. Vui lòng dùng phương thức xác thực khác.",
      };

    case "error":
    default:
      return {
        success: false,
        code: "error",
        message: "Có lỗi khi thực hiện xác thực sinh trắc.",
      };
  }
}
