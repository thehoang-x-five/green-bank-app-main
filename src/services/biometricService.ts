// src/services/biometricService.ts

/**
 * Ngưỡng giao dịch giá trị cao (>= 10 triệu phải xác thực sinh trắc)
 */
export const HIGH_VALUE_THRESHOLD_VND = 10_000_000;

/**
 * Kết quả khi yêu cầu xác thực sinh trắc (mã code thô)
 */
export type BiometricResult = "ok" | "cancelled" | "unavailable" | "error";

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

type SuccessCb = (res?: unknown) => void;
type ErrorCb = (err?: unknown) => void;

type PromiseStyleFn<O> = (options: O) => Promise<unknown>;
type CallbackStyleFn<O> = (options: O, success: SuccessCb, error: ErrorCb) => void;

type BiometricFn<O> = PromiseStyleFn<O> | CallbackStyleFn<O>;

interface BiometricPlugin {
  verifyIdentity?: BiometricFn<BiometricVerifyIdentityOptions>;
  show?: BiometricFn<BiometricShowOptions>;
}

// Mở rộng kiểu window để TypeScript không báo lỗi
declare global {
  interface Window {
    NativeBiometric?: BiometricPlugin;
    BiometricAuth?: BiometricPlugin;
    FingerprintAIO?: BiometricPlugin;
    Fingerprint?: BiometricPlugin;

    Capacitor?: unknown;
    cordova?: unknown;
  }
}

function getBiometricPlugin(): BiometricPlugin | undefined {
  return (
    window.FingerprintAIO ||
    window.NativeBiometric ||
    window.BiometricAuth ||
    window.Fingerprint
  );
}

type CapacitorLike = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

function getCapacitorLike(): CapacitorLike | undefined {
  const w = window as unknown as { Capacitor?: unknown };
  const cap = w.Capacitor;
  if (typeof cap === "object" && cap !== null) return cap as CapacitorLike;
  return undefined;
}

function isNativeRuntime(): boolean {
  const cap = getCapacitorLike();

  try {
    if (cap?.getPlatform) return cap.getPlatform() !== "web";
    if (cap?.isNativePlatform) return Boolean(cap.isNativePlatform());
  } catch {
    // ignore
  }

  const w = window as unknown as { cordova?: unknown };
  return Boolean(w.cordova);
}

function normalizeError(err: unknown): { code?: unknown; message: string } {
  if (typeof err === "object" && err !== null) {
    const rec = err as Record<string, unknown>;
    const msgRaw = rec["message"];
    const msg = typeof msgRaw === "string" ? msgRaw : String(msgRaw ?? "");
    return { code: rec["code"], message: msg };
  }
  if (typeof err === "string") return { message: err };
  return { message: String(err ?? "") };
}

function isThenable(x: unknown): x is { then: (...args: unknown[]) => unknown } {
  if (typeof x !== "object" || x === null) return false;
  const rec = x as Record<string, unknown>;
  return typeof rec["then"] === "function";
}

function hasExplicitFalseFlag(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  const r = result as Record<string, unknown>;

  const keys = ["verified", "success", "authenticated", "isVerified", "authorized"];
  for (const k of keys) {
    if (typeof r[k] === "boolean" && r[k] === false) return true;
  }
  return false;
}

function isUserCancelledError(err: unknown): boolean {
  const { message } = normalizeError(err);
  const m = message.toLowerCase().trim();

  return (
    m.includes("cancel") ||
    m.includes("canceled") ||
    m.includes("cancelled") ||
    m.includes("user cancel") ||
    m.includes("user canceled") ||
    m.includes("user cancelled") ||
    m.includes("cancelled by user") ||
    m.includes("canceled by user") ||
    m.includes("authentication canceled") ||
    m.includes("authentication cancelled")
  );
}

function isUnavailableOrNotEnrolled(err: unknown): boolean {
  const { code, message } = normalizeError(err);
  const m = message.toLowerCase().trim();

  const codeNum =
    typeof code === "number"
      ? code
      : typeof code === "string"
        ? Number(code)
        : Number.NaN;

  return (
    codeNum === 1 ||
    codeNum === 3 ||
    codeNum === 14 ||
    m.includes("not enrolled") ||
    m.includes("no enrolled") ||
    m.includes("no biometrics") ||
    m.includes("no biometric") ||
    m.includes("no fingerprint") ||
    m.includes("no fingerprints") ||
    m.includes("no face") ||
    m.includes("not available") ||
    m.includes("unavailable") ||
    m.includes("no hardware") ||
    m.includes("passcode not set")
  );
}

/**
 * ✅ Wrapper: hỗ trợ cả 2 kiểu plugin
 * - Promise style: fn(options) => Promise
 * - Callback style: fn(options, success, error) => void
 *
 * QUAN TRỌNG (anti-bypass):
 * - Nếu "promise-style" mà fn() KHÔNG trả thenable -> throw (coi như lỗi)
 * - Nếu trả về object mà có flag verified/success/... = false -> throw (coi như fail)
 */
async function callBiometricFn<O extends object>(
  fn: BiometricFn<O>,
  options: O
): Promise<void> {
  // Callback-style (thường có arity >= 2)
  if (fn.length >= 2) {
    const cbFn = fn as CallbackStyleFn<O>;

    await new Promise<void>((resolve, reject) => {
      let done = false;

      const ok: SuccessCb = (res?: unknown) => {
        done = true;
        if (hasExplicitFalseFlag(res)) {
          reject(new Error("BIOMETRIC_VERIFIED_FALSE"));
          return;
        }
        resolve();
      };

      const fail: ErrorCb = (e) => {
        done = true;
        reject(e);
      };

      try {
        cbFn(options, ok, fail);
      } catch (e) {
        reject(e);
      }

      setTimeout(() => {
        if (!done) reject(new Error("Biometric timeout"));
      }, 30_000);
    });

    return;
  }

  // Promise-style
  const promiseFn = fn as PromiseStyleFn<O>;
  const ret = promiseFn(options);

  // ❗FAIL-CLOSED: không trả Promise/thenable => coi như lỗi, không cho qua
  if (!isThenable(ret)) {
    throw new Error("BIOMETRIC_PLUGIN_NOT_PROMISE");
  }

  const res = await ret;
  if (hasExplicitFalseFlag(res)) {
    throw new Error("BIOMETRIC_VERIFIED_FALSE");
  }
}

/**
 * Thử gọi plugin sinh trắc trên thiết bị (Capacitor / Cordova).
 */
async function tryNativeBiometric(reason: string): Promise<BiometricResult> {
  const plugin = getBiometricPlugin();
  if (!plugin) return "unavailable";

  try {
    if (plugin.verifyIdentity) {
      await callBiometricFn(plugin.verifyIdentity, {
        reason,
        title: "Xác thực sinh trắc",
        subtitle: "VietBank cần xác nhận chủ tài khoản",
        description: reason,
      });
      return "ok";
    }

    if (plugin.show) {
      await callBiometricFn(plugin.show, {
        title: "Xác thực sinh trắc",
        subtitle: "VietBank",
        description: reason,
        disableBackup: true,
      });
      return "ok";
    }

    return "unavailable";
  } catch (err: unknown) {
    console.error("Biometric error:", err);

    // trường hợp plugin trả "verified:false" => không cho qua
    const msg = normalizeError(err).message;
    if (msg.includes("BIOMETRIC_VERIFIED_FALSE")) return "cancelled";
    if (msg.includes("BIOMETRIC_PLUGIN_NOT_PROMISE")) return "error";

    if (isUserCancelledError(err)) return "cancelled";
    if (isUnavailableOrNotEnrolled(err)) return "unavailable";

    return "error";
  }
}

/**
 * Fallback trên web: dùng confirm() để demo luồng sinh trắc.
 */
async function fallbackConfirm(reason: string): Promise<BiometricResult> {
  const ok = window.confirm(
    `${reason}\n\n(Đây là bản demo WEB: bấm OK để giả lập "xác thực sinh trắc thành công")`
  );
  return ok ? "ok" : "cancelled";
}

export interface BiometricVerificationResponse {
  success: boolean;
  code: BiometricResult;
  message?: string;
}

/**
 * Hàm tiện ích dùng trong UI:
 * - Có plugin: bắt buộc native (không fallback confirm để tránh “lách”)
 * - Không plugin: nếu là web thì confirm demo, còn native thì unavailable
 */
export async function runBiometricVerification(
  reason?: string
): Promise<BiometricVerificationResponse> {
  const defaultReason = `Giao dịch giá trị cao (>= ${HIGH_VALUE_THRESHOLD_VND.toLocaleString(
    "vi-VN"
  )} VND). Vui lòng xác thực sinh trắc (vân tay / FaceID).`;

  const reasonText = reason && reason.trim().length > 0 ? reason : defaultReason;

  const plugin = getBiometricPlugin();

  const finalCode: BiometricResult = plugin
    ? await tryNativeBiometric(reasonText)
    : !isNativeRuntime()
      ? await fallbackConfirm(reasonText)
      : "unavailable";

  switch (finalCode) {
    case "ok":
      return {
        success: true,
        code: "ok",
        message: "Xác thực sinh trắc thành công.",
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
          "Thiết bị không hỗ trợ hoặc chưa đăng ký sinh trắc (vân tay/FaceID). Vui lòng bật Screen lock và đăng ký sinh trắc để tiếp tục.",
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
