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

/**
 * Mở rộng profile thêm các trường liên quan đến PIN giao dịch
 */
type AppUserSecurityProfile = AppUserProfile & {
  transactionPinHash?: string | null;
  pinFailCount?: number | null;
  pinLockedUntil?: number | null;
};

type AccountWithPin = {
  pin?: string | number | null;
  uid?: string | null;
};

/**
 * Lấy profile theo uid từ Realtime DB: users/{uid}
 */
export async function getUserProfile(
  uid: string
): Promise<AppUserProfile | null> {
  const snap = await get(ref(firebaseRtdb, `users/${uid}`));
  if (!snap.exists()) return null;
  return snap.val() as AppUserProfile;
}

/**
 * Lấy profile của user hiện đang đăng nhập
 */
export async function getCurrentUserProfile(): Promise<AppUserProfile | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return getUserProfile(user.uid);
}

/* ================== PIN GIAO DỊCH (TRANSACTION PIN) ================== */

function hashPin(pin: string): string {
  // Đơn giản hoá: dùng base64. Đồ án ok, thực tế nên dùng hash mạnh hơn.
  return btoa(pin);
}

/**
 * Thiết lập / thay đổi PIN giao dịch cho user.
 * Lưu tại: users/{uid}/transactionPinHash, pinFailCount, pinLockedUntil
 */
export async function setTransactionPin(
  uid: string,
  pin: string
): Promise<void> {
  if (!pin) {
    throw new Error("PIN không được để trống");
  }
  if (pin.length < 4 || pin.length > 6) {
    throw new Error("PIN phải từ 4–6 số");
  }

  const userRef = ref(firebaseRtdb, `users/${uid}`);

  await update(userRef, {
    transactionPinHash: hashPin(pin),
    pinFailCount: 0,
    pinLockedUntil: null,
  });
}

/**
 * Xác thực PIN giao dịch.
 * - Nếu đã có transactionPinHash: dùng bình thường.
 * - Nếu CHƯA có transactionPinHash:
 *     + Tìm trong accounts của user xem có account.pin trùng hay không.
 *     + Nếu trùng: coi là đúng, đồng thời migrate => lưu transactionPinHash cho user.
 * - Sai >= 5 lần sẽ khoá trong 10 phút.
 */
export async function verifyTransactionPin(
  uid: string,
  pin: string
): Promise<void> {
  if (!pin) {
    throw new Error("PIN không được để trống");
  }

  const userRef = ref(firebaseRtdb, `users/${uid}`);
  const userSnap = await get(userRef);

  const now = Date.now();
  const data: AppUserSecurityProfile | null = userSnap.exists()
    ? (userSnap.val() as AppUserSecurityProfile)
    : null;

  const lockedUntil = data?.pinLockedUntil ?? null;
  if (typeof lockedUntil === "number" && now < lockedUntil) {
    throw new Error(
      "PIN đang bị khoá tạm thời do nhập sai nhiều lần. Vui lòng thử lại sau ít phút."
    );
  }

  const transactionPinHash = data?.transactionPinHash ?? "";

  // ===== CASE 1: ĐÃ CÓ transactionPinHash -> chỉ cần so sánh hash =====
  if (transactionPinHash) {
    if (hashPin(pin) !== transactionPinHash) {
      const currentFailCount = data?.pinFailCount ?? 0;
      const newFailCount = currentFailCount + 1;

      const updatePayload: Partial<AppUserSecurityProfile> = {
        pinFailCount: newFailCount,
      };

      if (newFailCount >= 5) {
        // Khoá 10 phút
        updatePayload.pinLockedUntil = now + 10 * 60 * 1000;
      }

      await update(userRef, updatePayload);
      throw new Error("Mã PIN giao dịch không đúng");
    }

    // Đúng PIN -> reset bộ đếm + mở khoá nếu có
    await update(userRef, {
      pinFailCount: 0,
      pinLockedUntil: null,
    });
    return;
  }

  // ===== CASE 2: CHƯA có transactionPinHash -> fallback sang PIN trong accounts =====
  const accQuery = query(
    ref(firebaseRtdb, "accounts"),
    orderByChild("uid"),
    equalTo(uid)
  );
  const accSnap = await get(accQuery);

  if (!accSnap.exists()) {
    throw new Error("Bạn chưa thiết lập PIN giao dịch.");
  }

  const raw = accSnap.val() as Record<string, AccountWithPin>;

  let matched = false;

  for (const key of Object.keys(raw)) {
    const acc = raw[key];
    const pinRaw = acc.pin;

    if (pinRaw === undefined || pinRaw === null) continue;

    const pinStr = typeof pinRaw === "string" ? pinRaw : String(pinRaw);

    if (pinStr === pin) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    const currentFailCount = data?.pinFailCount ?? 0;
    const newFailCount = currentFailCount + 1;

    const updatePayload: Partial<AppUserSecurityProfile> = {
      pinFailCount: newFailCount,
    };

    if (newFailCount >= 5) {
      updatePayload.pinLockedUntil = now + 10 * 60 * 1000;
    }

    await update(userRef, updatePayload);
    throw new Error("Mã PIN giao dịch không đúng");
  }

  // Nếu vào được đây => PIN trùng với 1 account.pin
  // => coi như user đã thiết lập PIN giao dịch lần đầu.
  await update(userRef, {
    transactionPinHash: hashPin(pin),
    pinFailCount: 0,
    pinLockedUntil: null,
  });
}
