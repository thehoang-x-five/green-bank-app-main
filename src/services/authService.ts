// src/services/authService.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import {
  ref,
  set,
  get,
  runTransaction,
  query,
  orderByChild,
  equalTo,
  limitToFirst,
  update,
} from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { runBiometricVerification } from "@/services/biometricService";

export type AppUserRole = "CUSTOMER" | "OFFICER";
export type EkycStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface AppUserProfile {
  uid: string; // id Firebase auth
  username: string; // Họ tên hiển thị
  email: string;

  role: AppUserRole; // CUSTOMER / OFFICER
  status: "ACTIVE" | "LOCKED"; // trạng thái tài khoản đăng nhập

  // Trạng thái eKYC & quyền giao dịch
  ekycStatus: EkycStatus; // PENDING / VERIFIED / REJECTED
  canTransact: boolean; // được phép giao dịch hay không

  createdAt: number; // timestamp

  // Các trường thông tin cá nhân (optional – sẽ được bổ sung dần)
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  nationalId?: string | null;
  idIssueDate?: string | null;
  placeOfIssue?: string | null;
  permanentAddress?: string | null;
  contactAddress?: string | null;
  cif?: string | null;

  // URL ảnh eKYC (từ Cloudinary/Firebase Storage)
  frontIdUrl?: string | null;
  backIdUrl?: string | null;
  selfieUrl?: string | null;
}

/** Dữ liệu bổ sung truyền từ bước đăng ký */
type RegisterExtraProfile = {
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  nationalId?: string | null;
  idIssueDate?: string | null;
  placeOfIssue?: string | null;
  permanentAddress?: string | null;
  contactAddress?: string | null;
  cif?: string | null;
  frontIdUrl?: string | null;
  backIdUrl?: string | null;
  selfieUrl?: string | null;

  // tên cũ để tương thích nếu còn chỗ nào gọi
  address?: string | null;
  idIssuePlace?: string | null;
};

/* ===================== LOGIN LOCK (5 FAILS) ===================== */

export const MAX_LOGIN_ATTEMPTS = 5;

type UserSecurityNode = {
  loginFailCount?: number;
  [key: string]: unknown;
};

type UserNode = {
  uid?: string;
  email?: string;
  username?: string;
  fullName?: string;
  displayName?: string;

  role?: string;
  status?: string; // ACTIVE | LOCKED
  ekycStatus?: string;
  canTransact?: boolean;
  createdAt?: number;

  lockedAt?: number | null;
  lockReason?: string | null;

  security?: UserSecurityNode;

  [key: string]: unknown;
};

export type RecordLoginFailureResult = {
  attemptsLeft: number;
  locked: boolean;
  failCount: number;
};

function normalizeEmailForQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

function toSafeNonNegInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0)
    return Math.floor(v);
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isLockedStatus(raw: unknown): boolean {
  return String(raw ?? "").toUpperCase() === "LOCKED";
}

async function findUserUidByEmail(email: string): Promise<string | null> {
  const e = normalizeEmailForQuery(email);
  if (!e) return null;

  const q = query(
    ref(firebaseRtdb, "users"),
    orderByChild("email"),
    equalTo(e),
    limitToFirst(1)
  );

  const snap = await get(q);
  if (!snap.exists()) return null;

  let foundUid: string | null = null;
  snap.forEach((child) => {
    foundUid = child.key ?? null;
    return true;
  });

  return foundUid;
}

async function getUserNodeByUid(uid: string): Promise<UserNode | null> {
  if (!uid) return null;
  const snap = await get(ref(firebaseRtdb, `users/${uid}`));
  if (!snap.exists()) return null;
  return snap.val() as UserNode;
}

async function getUserNodeByEmail(
  email: string
): Promise<{ uid: string; node: UserNode } | null> {
  const uid = await findUserUidByEmail(email);
  if (!uid) return null;

  const node = await getUserNodeByUid(uid);
  if (!node) return null;

  return { uid, node };
}

async function assertNotLockedByEmail(email: string): Promise<void> {
  const hit = await getUserNodeByEmail(email);
  if (!hit) return; // không tìm thấy trong RTDB => để firebase auth quyết định

  const status = hit.node.status;
  if (isLockedStatus(status)) {
    throw new Error(
      "Tài khoản đã bị tạm khóa do đăng nhập sai quá 5 lần. Vui lòng liên hệ nhân viên để mở khóa."
    );
  }
}

async function recordLoginFailureByEmail(
  email: string
): Promise<RecordLoginFailureResult> {
  const hit = await getUserNodeByEmail(email);

  // Nếu email chưa có trong users => không tăng đếm (tránh lộ thông tin user)
  if (!hit) {
    return {
      attemptsLeft: MAX_LOGIN_ATTEMPTS,
      locked: false,
      failCount: 0,
    };
  }

  const { uid } = hit;

  const userRef = ref(firebaseRtdb, `users/${uid}`);

  let newFailCount = 0;
  let locked = false;
  const now = Date.now();

  await runTransaction(userRef, (current: unknown) => {
    if (!current || typeof current !== "object") return current;

    const u = current as UserNode;
    const status = typeof u.status === "string" ? u.status : "ACTIVE";

    const sec = (u.security ?? {}) as UserSecurityNode;
    const prev = toSafeNonNegInt(sec.loginFailCount);

    // nếu đã lock -> giữ nguyên
    if (isLockedStatus(status)) {
      newFailCount = Math.max(prev, MAX_LOGIN_ATTEMPTS);
      locked = true;
      return u;
    }

    const next = prev + 1;
    newFailCount = next;
    locked = next >= MAX_LOGIN_ATTEMPTS;

    const nextUser: UserNode = {
      ...u,
      security: {
        ...sec,
        loginFailCount: next,
      },
    };

    if (locked) {
      nextUser.status = "LOCKED";
      nextUser.lockedAt = now;
      nextUser.lockReason = "LOGIN_FAILED_5";
    }

    return nextUser;
  });

  const attemptsLeft = clamp(
    MAX_LOGIN_ATTEMPTS - newFailCount,
    0,
    MAX_LOGIN_ATTEMPTS
  );
  return { attemptsLeft, locked, failCount: newFailCount };
}

async function resetLoginFailuresByUid(uid: string): Promise<void> {
  if (!uid) return;
  await update(ref(firebaseRtdb, `users/${uid}/security`), {
    loginFailCount: 0,
  });
}

/* ===================== BIOMETRIC LOGIN (DEMO) ===================== */
/**
 * DEMO ONLY:
 * - Lưu credential đã đăng nhập để lần sau dùng vân tay -> signInWithEmailAndPassword
 * - Production: phải dùng Secure Enclave/Keystore + token/refresh flow, KHÔNG lưu password.
 */
const BIO_CRED_KEY = "vietbank_bio_cred_v1";

type StoredBioCred = {
  email: string;
  passwordB64: string;
  savedAt: number;
};

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

/** ✅ Base64 UTF-8 safe */
function safeB64Encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** ✅ Base64 UTF-8 safe */
function safeB64Decode(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function toSafeNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function saveBiometricCredential(email: string, password: string): void {
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) return;

  try {
    const payload: StoredBioCred = {
      email: normalizeEmailForQuery(email),
      passwordB64: safeB64Encode(password),
      savedAt: Date.now(),
    };
    localStorage.setItem(BIO_CRED_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function readBiometricCredential(): StoredBioCred | null {
  try {
    const raw = localStorage.getItem(BIO_CRED_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;

    const rec = parsed as Record<string, unknown>;
    const email = rec["email"];
    const passwordB64 = rec["passwordB64"];
    const savedAtRaw = rec["savedAt"];

    if (!isNonEmptyString(email) || !isNonEmptyString(passwordB64)) return null;

    const savedAt = toSafeNumber(savedAtRaw);
    if (savedAt <= 0) return null;

    return {
      email: normalizeEmailForQuery(String(email)),
      passwordB64: String(passwordB64),
      savedAt,
    };
  } catch {
    return null;
  }
}

export function isBiometricLoginEnabled(): boolean {
  return readBiometricCredential() !== null;
}

export function disableBiometricLogin(): void {
  try {
    localStorage.removeItem(BIO_CRED_KEY);
  } catch {
    // ignore
  }
}

export async function loginWithBiometric(): Promise<{
  firebaseUser: User;
  profile: AppUserProfile | null;
}> {
  const stored = readBiometricCredential();
  if (!stored) {
    throw new Error(
      "Bạn cần đăng nhập bằng mật khẩu 1 lần để bật đăng nhập vân tay."
    );
  }

  // ✅ check lock trước khi cho quét
  await assertNotLockedByEmail(stored.email);

  const bio = await runBiometricVerification(
    "Vui lòng xác thực sinh trắc để đăng nhập VietBank."
  );
  if (!bio.success) {
    throw new Error(bio.message ?? "Xác thực sinh trắc không thành công.");
  }

  let password = "";
  try {
    password = safeB64Decode(stored.passwordB64);
  } catch {
    disableBiometricLogin();
    throw new Error(
      "Dữ liệu đăng nhập vân tay bị lỗi. Vui lòng đăng nhập mật khẩu lại để bật lại."
    );
  }

  return loginWithEmail(stored.email, password);
}

/* ===================== CORE HELPERS ===================== */

function randomAccountNumber(length = 12): string {
  let result = "";
  for (let i = 0; i < length; i++)
    result += Math.floor(Math.random() * 10).toString();
  return result;
}

async function createUniqueAccountNumber(): Promise<string> {
  const maxTries = 5;

  for (let i = 0; i < maxTries; i++) {
    const acc = randomAccountNumber(12);
    const snap = await get(ref(firebaseRtdb, `accounts/${acc}`));
    if (!snap.exists()) return acc;
  }

  throw new Error("Không tạo được số tài khoản, vui lòng thử lại.");
}

export async function generateNextCif(): Promise<string> {
  const counterRef = ref(firebaseRtdb, "counters/cifCounter");

  try {
    const result = await runTransaction(counterRef, (current: unknown) => {
      if (
        typeof current !== "number" ||
        !Number.isFinite(current) ||
        current < 0
      )
        return 1;
      return (current as number) + 1;
    });

    let value = result.snapshot.val();
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
      value = 1;

    return `CIF${String(value).padStart(4, "0")}`;
  } catch (error) {
    console.error("generateNextCif error:", error);
    const fallback = Date.now() % 10000;
    return `CIF${String(fallback).padStart(4, "0")}`;
  }
}

async function createAuthUserWithoutAffectingSession(
  email: string,
  password: string
): Promise<{ uid: string }> {
  const appOptions = firebaseAuth.app.options as { apiKey?: string };
  const apiKey = appOptions.apiKey;

  if (!apiKey)
    throw new Error("Không tìm thấy apiKey của Firebase để tạo user qua REST.");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  );

  const data = (await res.json()) as {
    localId?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.localId) {
    throw new Error(
      data.error?.message ||
        "Tạo tài khoản đăng nhập (Auth user) qua REST thất bại."
    );
  }

  return { uid: data.localId };
}

export async function registerCustomerAccount(
  email: string,
  password: string,
  displayName: string,
  pin?: string,
  extra?: RegisterExtraProfile,
  options?: { createdByOfficer?: boolean }
): Promise<{
  firebaseUser: User | null;
  profile: AppUserProfile;
  accountNumber: string;
}> {
  let userUid: string;
  let firebaseUser: User | null = null;

  const normalizedEmail = normalizeEmailForQuery(email);

  if (options?.createdByOfficer) {
    const result = await createAuthUserWithoutAffectingSession(
      normalizedEmail,
      password
    );
    userUid = result.uid;
  } else {
    const cred = await signInWithEmailAndPassword(
      firebaseAuth,
      normalizedEmail,
      password
    ).catch(async () => {
      const newCred = await createUserWithEmailAndPassword(
        firebaseAuth,
        normalizedEmail,
        password
      );
      return newCred;
    });

    firebaseUser = cred.user;
    userUid = cred.user.uid;

    saveBiometricCredential(normalizedEmail, password);
  }

  const accountNumber = await createUniqueAccountNumber();
  const newCif = await generateNextCif();

  const base: AppUserProfile = {
    uid: userUid,
    username: displayName,
    email: normalizedEmail,
    role: "CUSTOMER",
    status: "ACTIVE",
    ekycStatus: "PENDING",
    canTransact: false,
    createdAt: Date.now(),

    phone: null,
    gender: null,
    dob: null,
    nationalId: null,
    idIssueDate: null,
    placeOfIssue: null,
    permanentAddress: null,
    contactAddress: null,
    cif: newCif,
    frontIdUrl: null,
    backIdUrl: null,
    selfieUrl: null,
  };

  const profile: AppUserProfile = {
    ...base,
    phone: extra?.phone ?? null,
    gender: extra?.gender ?? null,
    dob: extra?.dob ?? null,
    nationalId: extra?.nationalId ?? null,
    idIssueDate: extra?.idIssueDate ?? null,
    placeOfIssue: extra?.placeOfIssue ?? extra?.idIssuePlace ?? null,
    permanentAddress: extra?.permanentAddress ?? extra?.address ?? null,
    contactAddress: extra?.contactAddress ?? null,
    cif: extra?.cif ?? newCif,
    frontIdUrl: extra?.frontIdUrl ?? null,
    backIdUrl: extra?.backIdUrl ?? null,
    selfieUrl: extra?.selfieUrl ?? null,
  };

  try {
    await set(ref(firebaseRtdb, `users/${userUid}`), profile);

    await set(ref(firebaseRtdb, `accounts/${accountNumber}`), {
      uid: userUid,
      accountNumber,
      balance: 0,
      status: "ACTIVE",
      pin: pin ?? null,
      createdAt: Date.now(),
    });

    // ✅ init security node
    await update(ref(firebaseRtdb, `users/${userUid}/security`), {
      loginFailCount: 0,
    });
  } catch (error) {
    console.error("Lỗi khi lưu profile/account vào Realtime DB:", error);
  }

  return { firebaseUser, profile, accountNumber };
}

/**
 * ✅ LOGIN + khóa 5 lần
 * - Trước login: nếu user LOCKED (theo email) => chặn luôn
 * - Sai pass: tăng loginFailCount (theo email) => đủ 5 thì set LOCKED
 * - Đúng pass: reset loginFailCount = 0
 * - Nếu profile.status=LOCKED thì signOut + throw
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ firebaseUser: User; profile: AppUserProfile | null }> {
  const normalizedEmail = normalizeEmailForQuery(email);

  // 1) chặn sẵn nếu đã LOCKED
  await assertNotLockedByEmail(normalizedEmail);

  try {
    const cred = await signInWithEmailAndPassword(
      firebaseAuth,
      normalizedEmail,
      password
    );
    const firebaseUser = cred.user;

    // ✅ login success -> reset fail count + lưu biometric demo
    await resetLoginFailuresByUid(firebaseUser.uid);
    saveBiometricCredential(normalizedEmail, password);

    let profile: AppUserProfile | null = null;
    try {
      const snap = await get(ref(firebaseRtdb, `users/${firebaseUser.uid}`));
      if (snap.exists()) {
        const raw = snap.val() as Record<string, unknown>;

        profile = {
          uid: (raw.uid as string) ?? firebaseUser.uid,
          username: (raw.username as string) ?? firebaseUser.displayName ?? "",
          email: (raw.email as string) ?? firebaseUser.email ?? normalizedEmail,

          role: (raw.role as AppUserRole) ?? "CUSTOMER",
          status: raw.status === "LOCKED" ? "LOCKED" : "ACTIVE",

          ekycStatus: (raw.ekycStatus as EkycStatus) ?? "PENDING",
          canTransact: (raw.canTransact as boolean) ?? false,

          createdAt:
            typeof raw.createdAt === "number"
              ? (raw.createdAt as number)
              : Date.now(),

          phone: (raw.phone as string | null | undefined) ?? null,
          gender: (raw.gender as string | null | undefined) ?? null,
          dob: (raw.dob as string | null | undefined) ?? null,
          nationalId: (raw.nationalId as string | null | undefined) ?? null,
          idIssueDate: (raw.idIssueDate as string | null | undefined) ?? null,
          placeOfIssue: (raw.placeOfIssue as string | null | undefined) ?? null,
          permanentAddress:
            (raw.permanentAddress as string | null | undefined) ?? null,
          contactAddress:
            (raw.contactAddress as string | null | undefined) ?? null,
          cif: (raw.cif as string | null | undefined) ?? null,

          frontIdUrl: (raw.frontIdUrl as string | null | undefined) ?? null,
          backIdUrl: (raw.backIdUrl as string | null | undefined) ?? null,
          selfieUrl: (raw.selfieUrl as string | null | undefined) ?? null,
        };
      }
    } catch (error) {
      console.error("Lỗi đọc profile từ Realtime DB:", error);
    }

    // 3) Nếu DB đã lock (trường hợp lock bởi rule khác) => signOut + chặn
    if (profile && profile.status === "LOCKED") {
      await signOut(firebaseAuth);
      throw new Error(
        "Tài khoản đã bị tạm khóa. Vui lòng liên hệ nhân viên để mở khóa."
      );
    }

    return { firebaseUser, profile };
  } catch (error: unknown) {
    // Sai credential -> tăng failCount nếu user tồn tại trong RTDB
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    const isWrongPassword =
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "auth/invalid-login-credentials";

    // auth/user-not-found: cũng có thể tăng nếu email tồn tại trong users, nhưng thường không nên lộ
    const shouldCount = isWrongPassword || code === "auth/user-not-found";

    if (shouldCount) {
      const r = await recordLoginFailureByEmail(normalizedEmail);
      if (r.locked) {
        throw new Error(
          "Bạn đã đăng nhập sai quá 5 lần. Tài khoản đã bị tạm khóa. Vui lòng liên hệ nhân viên để mở khóa."
        );
      }
      // nếu failCount=0 (email không tồn tại trong RTDB) -> trả lỗi chung
      if (r.failCount > 0) {
        throw new Error(
          `Sai email hoặc mật khẩu. Bạn còn ${r.attemptsLeft} lần thử.`
        );
      }
    }

    throw error;
  }
}

export async function sendResetPasswordEmail(rawEmail: string) {
  const email = normalizeEmailForQuery(rawEmail);
  if (!email) throw new Error("Email trống");
  await sendPasswordResetEmail(firebaseAuth, email);
}

export async function logout() {
  await signOut(firebaseAuth);
  // disableBiometricLogin();
}
