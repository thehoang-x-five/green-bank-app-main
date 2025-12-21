// src/services/userService.ts
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import {
  ref,
  get,
  update,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import type { AppUserProfile } from "./authService";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

/**
 * Mở rộng profile thêm các trường liên quan đến PIN giao dịch
 */
type AppUserSecurityProfile = AppUserProfile & {
  transactionPinHash?: string | null;
  pinFailCount?: number | null;
  pinLockedUntil?: number | null;
  status?: "ACTIVE" | "LOCKED";
};

type AccountWithPin = {
  pin?: string | number | null;
  uid?: string | null;
  status?: "ACTIVE" | "LOCKED";
};

/* ================== HELPER ================== */

function hashPin(pin: string): string {
  // giữ nguyên để không phá verify cũ
  return btoa(pin);
}

function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function validateStrongPassword(pw: string): string | null {
  if (!pw || pw.length < 8) return "Mật khẩu mới phải có ít nhất 8 ký tự.";
  if (!/[A-Z]/.test(pw)) return "Mật khẩu mới phải có ít nhất 1 chữ hoa (A-Z).";
  if (!/[0-9]/.test(pw)) return "Mật khẩu mới phải có ít nhất 1 chữ số (0-9).";
  if (!/[^A-Za-z0-9]/.test(pw))
    return "Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt (vd: !@#$%^&*).";
  return null;
}

function getAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: unknown })?.code;
  const c = typeof code === "string" ? code : "";

  switch (c) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Mật khẩu hiện tại không đúng.";
    case "auth/weak-password":
      // mình vẫn giữ nhưng UI/service đã chặn theo policy mạnh
      return "Mật khẩu mới quá yếu. Vui lòng đặt mật khẩu mạnh hơn.";
    case "auth/requires-recent-login":
      return "Vui lòng đăng nhập lại rồi thử đổi mật khẩu.";
    case "auth/too-many-requests":
      return "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.";
    case "auth/network-request-failed":
      return "Lỗi mạng. Vui lòng kiểm tra kết nối và thử lại.";
    default:
      return "Không thể đổi mật khẩu. Vui lòng thử lại.";
  }
}

/**
 * Lấy danh sách accountNumber thuộc về uid (nhanh hơn đọc toàn bộ accounts)
 */
async function getAccountNumbersByUid(uid: string): Promise<string[]> {
  const q = query(
    ref(firebaseRtdb, "accounts"),
    orderByChild("uid"),
    equalTo(uid)
  );
  const snap = await get(q);
  if (!snap.exists()) return [];

  const out: string[] = [];
  snap.forEach((child) => {
    if (child.key) out.push(child.key);
    return false;
  });

  return out;
}

/**
 * Update PIN vào cả users + accounts (đúng theo DB structure của bạn)
 */
async function updatePinEverywhere(uid: string, newPin: string): Promise<void> {
  const accountNumbers = await getAccountNumbersByUid(uid);

  const updates: Record<string, unknown> = {
    [`users/${uid}/transactionPinHash`]: hashPin(newPin),
    [`users/${uid}/pinFailCount`]: 0,
    [`users/${uid}/pinLockedUntil`]: null,
    [`users/${uid}/pinUpdatedAt`]: Date.now(),
  };

  // ✅ cập nhật tất cả accounts của user
  for (const accNo of accountNumbers) {
    updates[`accounts/${accNo}/pin`] = newPin; // DB đang lưu plain pin như ảnh
    updates[`accounts/${accNo}/pinUpdatedAt`] = Date.now();
  }

  await update(ref(firebaseRtdb), updates);
}

/**
 * 🔒 Khoá user + TẤT CẢ tài khoản thanh toán của user
 * (PHẢI duyệt toàn bộ accounts vì key = accountNumber)
 */
async function lockUserAndPaymentAccounts(uid: string): Promise<void> {
  const updates: Record<string, unknown> = {
    [`users/${uid}/status`]: "LOCKED",
  };

  const accSnap = await get(ref(firebaseRtdb, "accounts"));
  if (accSnap.exists()) {
    const accounts = accSnap.val() as Record<string, AccountWithPin>;
    for (const accNumber of Object.keys(accounts)) {
      const acc = accounts[accNumber];
      if (acc.uid === uid) {
        updates[`accounts/${accNumber}/status`] = "LOCKED";
      }
    }
  }

  await update(ref(firebaseRtdb), updates);
}

/* ================== PROFILE ================== */

export async function getUserProfile(
  uid: string
): Promise<AppUserProfile | null> {
  const snap = await get(ref(firebaseRtdb, `users/${uid}`));
  if (!snap.exists()) return null;
  return snap.val() as AppUserProfile;
}

export async function getCurrentUserProfile(): Promise<AppUserProfile | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return getUserProfile(user.uid);
}

/* ================== PIN GIAO DỊCH ================== */

/**
 * Thiết lập PIN (không yêu cầu PIN cũ) – dùng khi user lần đầu tạo PIN
 * ✅ Giờ sẽ update cả users + accounts.pin
 */
export async function setTransactionPin(uid: string, pin: string): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error("PIN phải từ 4–6 số");
  }

  await updatePinEverywhere(uid, pin);
}

/**
 * ✅ NEW: ĐỔI PIN có kiểm tra PIN hiện tại
 * - dùng verifyTransactionPin() để check + đếm sai/khóa theo logic sẵn có
 * - sau đó update pin mới vào users + accounts
 */
export async function changeTransactionPin(
  uid: string,
  currentPin: string,
  newPin: string
): Promise<void> {
  if (!isValidPin(currentPin)) {
    throw new Error("PIN hiện tại phải từ 4–6 số");
  }
  if (!isValidPin(newPin)) {
    throw new Error("PIN mới phải từ 4–6 số");
  }
  if (currentPin === newPin) {
    throw new Error("PIN mới phải khác PIN hiện tại");
  }

  // ✅ check PIN cũ + đếm sai/khóa
  await verifyTransactionPin(uid, currentPin);

  // ✅ set PIN mới (update users + accounts)
  await updatePinEverywhere(uid, newPin);
}

/**
 * ✅ VERIFY PIN – SAI ≥ 5 LẦN → KHOÁ USER + ACCOUNT
 */
export async function verifyTransactionPin(
  uid: string,
  pin: string
): Promise<void> {
  if (!pin) throw new Error("PIN không được để trống");

  const userRef = ref(firebaseRtdb, `users/${uid}`);
  const userSnap = await get(userRef);
  const data = userSnap.exists()
    ? (userSnap.val() as AppUserSecurityProfile)
    : null;

  const now = Date.now();

  if (typeof data?.pinLockedUntil === "number" && now < data.pinLockedUntil) {
    throw new Error(
      "PIN đang bị khoá tạm thời do nhập sai nhiều lần. Vui lòng thử lại sau."
    );
  }

  const hash = data?.transactionPinHash;

  // ===== ĐÃ CÓ PIN =====
  if (hash) {
    if (hashPin(pin) !== hash) {
      const fail = (data?.pinFailCount ?? 0) + 1;

      await update(userRef, {
        pinFailCount: fail,
        pinLockedUntil: fail >= 5 ? now + 10 * 60 * 1000 : null,
      });

      if (fail >= 5) {
        await lockUserAndPaymentAccounts(uid);
      }

      throw new Error("Mã PIN giao dịch không đúng");
    }

    // ĐÚNG PIN
    await update(userRef, {
      pinFailCount: 0,
      pinLockedUntil: null,
    });
    return;
  }

  // ===== CHƯA CÓ PIN → CHECK accounts.pin =====
  const accSnap = await get(ref(firebaseRtdb, "accounts"));
  if (!accSnap.exists()) {
    throw new Error("Bạn chưa thiết lập PIN giao dịch.");
  }

  const accounts = accSnap.val() as Record<string, AccountWithPin>;
  let matched = false;

  for (const acc of Object.values(accounts)) {
    if (acc.uid !== uid) continue;
    const accPin = acc.pin?.toString();
    if (accPin === pin) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    const fail = (data?.pinFailCount ?? 0) + 1;

    await update(userRef, {
      pinFailCount: fail,
      pinLockedUntil: fail >= 5 ? now + 10 * 60 * 1000 : null,
    });

    if (fail >= 5) {
      await lockUserAndPaymentAccounts(uid);
    }

    throw new Error("Mã PIN giao dịch không đúng");
  }

  // MIGRATE PIN (giữ logic cũ)
  await update(userRef, {
    transactionPinHash: hashPin(pin),
    pinFailCount: 0,
    pinLockedUntil: null,
  });
}

/* ================== PASSWORD ================== */

/**
 * ✅ Đổi mật khẩu đăng nhập (reauth + updatePassword)
 * - enforce policy mạnh (>=8, 1 uppercase, 1 number, 1 special)
 * - update RTDB: users/{uid}/passwordUpdatedAt
 */
export async function changeLoginPassword(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

  const email = user.email;
  if (!email) throw new Error("Tài khoản không có email. Không thể đổi mật khẩu.");

  const { currentPassword, newPassword } = params;

  if (!currentPassword || !newPassword) {
    throw new Error("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.");
  }

  const pwErr = validateStrongPassword(newPassword);
  if (pwErr) throw new Error(pwErr);

  try {
    const cred = EmailAuthProvider.credential(email, currentPassword);
    await reauthenticateWithCredential(user, cred);

    await updatePassword(user, newPassword);

    await update(ref(firebaseRtdb, `users/${user.uid}`), {
      passwordUpdatedAt: Date.now(),
    });
  } catch (err: unknown) {
    throw new Error(getAuthErrorMessage(err));
  }
}
