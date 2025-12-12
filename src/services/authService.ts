// src/services/authService.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { ref, set, get, runTransaction } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";

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

/** Tạo số tài khoản ngẫu nhiên gồm N chữ số */
function randomAccountNumber(length = 12): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

/** Sinh số tài khoản không trùng trong Realtime DB */
async function createUniqueAccountNumber(): Promise<string> {
  const maxTries = 5;

  for (let i = 0; i < maxTries; i++) {
    const acc = randomAccountNumber(12);
    const snap = await get(ref(firebaseRtdb, `accounts/${acc}`));
    if (!snap.exists()) {
      return acc;
    }
  }

  throw new Error("Không tạo được số tài khoản, vui lòng thử lại.");
}

/** Sinh CIF dạng CIF0001, CIF0002,... dùng làm mã khách hàng cố định */
export async function generateNextCif(): Promise<string> {
  const counterRef = ref(firebaseRtdb, "counters/cifCounter");

  try {
    const result = await runTransaction(counterRef, (current) => {
      if (
        typeof current !== "number" ||
        !Number.isFinite(current) ||
        current < 0
      ) {
        return 1;
      }
      return (current as number) + 1;
    });

    let value = result.snapshot.val();
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      value = 1;
    }

    // CIF0001, CIF0002, ...
    return `CIF${String(value).padStart(4, "0")}`;
  } catch (error) {
    console.error("generateNextCif error:", error);
    // fallback: vẫn đảm bảo có CIF, dù không chuẩn counter
    const fallback = Date.now() % 10000;
    return `CIF${String(fallback).padStart(4, "0")}`;
  }
}

/**
 * Tạo user Auth bằng REST API nhưng KHÔNG làm thay đổi currentUser.
 * Dùng cho trường hợp nhân viên đang đăng nhập tạo tài khoản cho khách hàng.
 */
async function createAuthUserWithoutAffectingSession(
  email: string,
  password: string
): Promise<{ uid: string }> {
  const appOptions = firebaseAuth.app.options as { apiKey?: string };
  const apiKey = appOptions.apiKey;

  if (!apiKey) {
    throw new Error("Không tìm thấy apiKey của Firebase để tạo user qua REST.");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false, // không cần idToken
      }),
    }
  );

  const data: {
    localId?: string;
    error?: { message?: string };
  } = await res.json();

  if (!res.ok || !data.localId) {
    throw new Error(
      data.error?.message ||
        "Tạo tài khoản đăng nhập (Auth user) qua REST thất bại."
    );
  }

  return { uid: data.localId };
}

// Khi đăng ký customer mới
// displayName = HỌ TÊN THẬT theo CCCD
export async function registerCustomerAccount(
  email: string,
  password: string,
  displayName: string,
  pin?: string,
  extra?: RegisterExtraProfile,
  options?: { createdByOfficer?: boolean } // nếu true thì không đổi session
): Promise<{
  firebaseUser: User | null;
  profile: AppUserProfile;
  accountNumber: string;
}> {
  let userUid: string;
  let firebaseUser: User | null = null;

  if (options?.createdByOfficer) {
    // Nhân viên tạo khách mới: dùng REST, không đụng tới currentUser
    const result = await createAuthUserWithoutAffectingSession(
      email,
      password
    );
    userUid = result.uid;
  } else {
    // Khách tự đăng ký: dùng SDK bình thường (sẽ đăng nhập luôn user mới)
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password)
      .catch(async () => {
        // nếu chưa tồn tại user thì tạo mới
        const newCred = await createUserWithEmailAndPassword(
          firebaseAuth,
          email,
          password
        );
        return newCred;
      });

    firebaseUser = cred.user;
    userUid = cred.user.uid;
  }

  // 2. Sinh số tài khoản thanh toán duy nhất
  const accountNumber = await createUniqueAccountNumber();

  // 2b. Sinh CIF ngay khi đăng ký (dùng chung counters/cifCounter)
  const newCif = await generateNextCif();

  // 3. Base profile
  const base: AppUserProfile = {
    uid: userUid,
    username: displayName,
    email,
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
    cif: newCif, // luôn có CIF từ lúc đăng ký
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
    // nếu có truyền CIF custom thì ưu tiên, còn không dùng newCif
    cif: extra?.cif ?? newCif,
    frontIdUrl: extra?.frontIdUrl ?? null,
    backIdUrl: extra?.backIdUrl ?? null,
    selfieUrl: extra?.selfieUrl ?? null,
  };

  // 4. Lưu vào Realtime Database
  try {
    // Lưu profile người dùng
    await set(ref(firebaseRtdb, `users/${userUid}`), profile);

    // Lưu thông tin tài khoản ngân hàng
    await set(ref(firebaseRtdb, `accounts/${accountNumber}`), {
      uid: userUid,
      accountNumber,
      balance: 0,
      status: "ACTIVE",
      pin: pin ?? null, // demo: lưu plain text, thực tế nên hash
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error("Lỗi khi lưu profile/account vào Realtime DB:", error);
    // Không throw thêm để tránh phá flow demo
  }

  return { firebaseUser, profile, accountNumber };
}

// Đăng nhập (cho cả customer & officer)
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ firebaseUser: User; profile: AppUserProfile | null }> {
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const firebaseUser = cred.user;

  let profile: AppUserProfile | null = null;
  try {
    const snap = await get(ref(firebaseRtdb, `users/${firebaseUser.uid}`));
    if (snap.exists()) {
      const raw = snap.val() as Record<string, unknown>;

      profile = {
        uid: (raw.uid as string) ?? firebaseUser.uid,
        username: (raw.username as string) ?? firebaseUser.displayName ?? "",
        email: (raw.email as string) ?? firebaseUser.email ?? email,

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

  return { firebaseUser, profile };
}

// Gửi email đặt lại mật khẩu
export async function sendResetPasswordEmail(rawEmail: string) {
  const email = rawEmail.trim();
  if (!email) {
    throw new Error("Email trống");
  }

  await sendPasswordResetEmail(firebaseAuth, email);
}

// Đăng xuất
export async function logout() {
  await signOut(firebaseAuth);
}
