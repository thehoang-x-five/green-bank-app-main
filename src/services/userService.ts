// src/services/userService.ts
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { ref, get, update } from "firebase/database";
import type { AppUserProfile } from "./authService";

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
  return btoa(pin);
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

export async function setTransactionPin(
  uid: string,
  pin: string
): Promise<void> {
  if (!pin || pin.length < 4 || pin.length > 6) {
    throw new Error("PIN phải từ 4–6 số");
  }

  await update(ref(firebaseRtdb, `users/${uid}`), {
    transactionPinHash: hashPin(pin),
    pinFailCount: 0,
    pinLockedUntil: null,
  });
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

  if (
    typeof data?.pinLockedUntil === "number" &&
    now < data.pinLockedUntil
  ) {
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

  // MIGRATE PIN
  await update(userRef, {
    transactionPinHash: hashPin(pin),
    pinFailCount: 0,
    pinLockedUntil: null,
  });
}
