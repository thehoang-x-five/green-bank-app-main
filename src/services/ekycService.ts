// src/services/ekycService.ts
import { firebaseRtdb } from "@/lib/firebase";
import { ref as dbRef, get, update } from "firebase/database";
import type { AppUserProfile } from "./authService";
import { generateNextCif } from "./authService";

function emailToKey(email: string) {
  // Firebase không cho dùng . # $ [ ]
  return email.replace(/[.#$[\]]/g, "_");
}

export type EkycKind = "frontId" | "backId" | "selfie";

// ===== Cloudinary config =====
const CLOUDINARY_CLOUD_NAME = "dndzpcykq";
const CLOUDINARY_UPLOAD_PRESET = "vietbank_unsigned";

async function uploadToCloudinary(
  email: string,
  kind: EkycKind,
  file: File
): Promise<string> {
  const key = emailToKey(email);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `vietbank/ekyc/${key}`);
  formData.append("public_id", `${kind}_${Date.now()}`);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const data: unknown = await res.json();
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    console.error("Cloudinary error:", err);
    throw new Error(
      err.error?.message || "Upload ảnh eKYC lên Cloudinary thất bại"
    );
  }

  return (data as { secure_url: string }).secure_url;
}

// =====================================================
//  A. SIDE KHÁCH HÀNG – upload ảnh & lưu info eKYC
// =====================================================

export async function uploadEkycImage(
  email: string,
  kind: EkycKind,
  file: File
): Promise<string> {
  const key = emailToKey(email);

  // 1. Upload file lên Cloudinary, lấy URL
  const url = await uploadToCloudinary(email, kind, file);

  // 2. Lưu URL + status vào Realtime DB
  await update(dbRef(firebaseRtdb, `ekycSessions/${key}`), {
    email,
    [`${kind}Url`]: url,
    updatedAt: Date.now(),
    status: "PENDING_CUSTOMER",
  });

  return url;
}

export interface EkycInfo {
  fullName: string;
  dob: string;
  nationalId: string;
  address: string;
  gender: string;
  idIssueDate: string;
}

// User trong DB, kế thừa profile + thêm vài field eKYC
type DbUser = AppUserProfile & {
  nationalId?: string;
  cccd?: string;
  idNumber?: string;
  national_id?: string;
  phone?: string;
  phoneNumber?: string;
  ekycStatus?: string;
  kycStatus?: string;
  ekycSubmittedAt?: number;
  cif?: string | null;
  createdAt?: number;
};

export async function saveEkycInfo(email: string, info: EkycInfo) {
  const key = emailToKey(email);
  const now = Date.now();

  // Lưu session eKYC chi tiết
  await update(dbRef(firebaseRtdb, `ekycSessions/${key}`), {
    email,
    ...info,
    submittedAt: now,
    status: "PENDING_REVIEW",
  });

  // Đồng bộ trạng thái eKYC về node users (để các chỗ khác đọc)
  try {
    const usersSnap = await get(dbRef(firebaseRtdb, "users"));
    if (!usersSnap.exists()) return;

    const users = usersSnap.val() as Record<string, DbUser>;

    let matchedUid: string | null = null;

    for (const [uid, user] of Object.entries(users)) {
      if (user.email === email) {
        matchedUid = uid;
        break;
      }
    }

    if (!matchedUid) return;

    const userUpdate: Partial<DbUser> = {
      ekycStatus: "PENDING",
      ekycSubmittedAt: now,
    };

    if (!users[matchedUid].nationalId && info.nationalId) {
      userUpdate.nationalId = info.nationalId;
    }

    await update(
      dbRef(firebaseRtdb, `users/${matchedUid}`),
      userUpdate as Record<string, unknown>
    );
  } catch (error) {
    console.error("saveEkycInfo: không cập nhật được users/", error);
  }
}

// =====================================================
//  B. SIDE NHÂN VIÊN – danh sách & duyệt eKYC
// =====================================================

export type EkycSessionStatus =
  | "PENDING_CUSTOMER"
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "REJECTED";

export interface EkycSession {
  uid?: string;
  email?: string;

  fullName?: string;
  dob?: string;
  nationalId?: string;
  address?: string;
  gender?: string;
  idIssueDate?: string;

  submittedAt?: number;
  updatedAt?: number;
  status?: EkycSessionStatus;

  frontIdUrl?: string;
  backIdUrl?: string;
  selfieUrl?: string;

  approvedAt?: number;
  rejectedAt?: number;
  rejectReason?: string;
  cif?: string;
}

async function getAllUsers(): Promise<Record<string, DbUser>> {
  const snap = await get(dbRef(firebaseRtdb, "users"));
  if (!snap.exists()) return {};
  return snap.val() as Record<string, DbUser>;
}

async function getAllEkycSessions(): Promise<Record<string, EkycSession>> {
  const snap = await get(dbRef(firebaseRtdb, "ekycSessions"));
  if (!snap.exists()) return {};
  return snap.val() as Record<string, EkycSession>;
}

export interface OfficerEkycItem {
  uid: string;
  email: string;
  fullName: string;
  nationalId: string;
  phone: string;
  submittedAt: number | null;
  status: EkycSessionStatus;
  frontIdUrl?: string;
  backIdUrl?: string;
  selfieUrl?: string;
}

// Danh sách hồ sơ eKYC đang chờ duyệt cho nhân viên
export async function fetchPendingEkycListForOfficer(): Promise<
  OfficerEkycItem[]
> {
  const [users, sessions] = await Promise.all([
    getAllUsers(),
    getAllEkycSessions(),
  ]);

  if (Object.keys(users).length === 0 || Object.keys(sessions).length === 0) {
    return [];
  }

  const customersByEmailKey: Record<string, { uid: string; user: DbUser }> = {};

  for (const [uid, user] of Object.entries(users)) {
    if (user.role !== "CUSTOMER") continue;
    if (!user.email) continue;
    const key = emailToKey(user.email);
    customersByEmailKey[key] = { uid, user };
  }

  const list: OfficerEkycItem[] = [];

  for (const [emailKey, session] of Object.entries(sessions)) {
    if (session.status !== "PENDING_REVIEW") continue;

    const match = customersByEmailKey[emailKey];
    if (!match) continue;

    const { uid, user } = match;
    const email = user.email ?? session.email ?? "";

    const fullName = session.fullName || user.username || "Khách hàng chưa có tên";

    const nationalId =
      session.nationalId ||
      user.nationalId ||
      user.cccd ||
      user.idNumber ||
      user.national_id ||
      "";

    const phone = user.phone || user.phoneNumber || "";

    const submittedAt =
      session.submittedAt ?? user.ekycSubmittedAt ?? user.createdAt ?? null;

    list.push({
      uid,
      email,
      fullName,
      nationalId,
      phone,
      submittedAt,
      status: session.status ?? "PENDING_REVIEW",
      frontIdUrl: session.frontIdUrl,
      backIdUrl: session.backIdUrl,
      selfieUrl: session.selfieUrl,
    });
  }

  // mới nhất lên trước
  list.sort((a, b) => {
    const tA = a.submittedAt ?? 0;
    const tB = b.submittedAt ?? 0;
    return tB - tA;
  });

  return list;
}

// Đếm số hồ sơ eKYC đang chờ (dùng cho Dashboard)
export async function countPendingEkyc(): Promise<number> {
  const list = await fetchPendingEkycListForOfficer();
  return list.length;
}

/**
 * Nhân viên DUYỆT eKYC cho 1 khách hàng (theo uid)
 * - users/{uid}: ekycStatus = "VERIFIED", gán CIF (nếu chưa có)
 * - ekycSessions/{emailKey}: status = "VERIFIED", lưu CIF + thời gian
 */
export async function approveEkycForUser(uid: string): Promise<string> {
  const userSnap = await get(dbRef(firebaseRtdb, `users/${uid}`));
  if (!userSnap.exists()) {
    throw new Error("Không tìm thấy người dùng để duyệt eKYC.");
  }

  const user = userSnap.val() as DbUser;
  const email = user.email;

  const updates: Record<string, unknown> = {};

  // Nếu user đã có CIF (cấp khi đăng ký) thì giữ nguyên,
  // chỉ khi chưa có mới sinh CIF mới.
  let cif = user.cif;
  if (!cif) {
    cif = await generateNextCif();
  }
  const finalCif = cif as string;

  updates[`users/${uid}/ekycStatus`] = "VERIFIED";
  updates[`users/${uid}/cif`] = finalCif;

  if (email) {
    const emailKey = emailToKey(email);
    const sessionRef = dbRef(firebaseRtdb, `ekycSessions/${emailKey}`);
    const sessionSnap = await get(sessionRef);

    if (sessionSnap.exists()) {
      updates[`ekycSessions/${emailKey}/status`] = "VERIFIED";
      updates[`ekycSessions/${emailKey}/approvedAt`] = Date.now();
      updates[`ekycSessions/${emailKey}/cif`] = finalCif;
      updates[`ekycSessions/${emailKey}/uid`] = uid;
    }
  }

  // update multi-path
  await update(dbRef(firebaseRtdb), updates);

  return finalCif;
}

/**
 * Nhân viên TỪ CHỐI / yêu cầu bổ sung eKYC
 */
export async function rejectEkycForUser(
  uid: string,
  reason?: string
): Promise<void> {
  const userSnap = await get(dbRef(firebaseRtdb, `users/${uid}`));
  if (!userSnap.exists()) {
    throw new Error("Không tìm thấy người dùng để từ chối eKYC.");
  }

  const user = userSnap.val() as DbUser;
  const email = user.email;

  const updates: Record<string, unknown> = {};

  updates[`users/${uid}/ekycStatus`] = "REJECTED";

  if (email) {
    const emailKey = emailToKey(email);
    updates[`ekycSessions/${emailKey}/status`] = "REJECTED";
    updates[`ekycSessions/${emailKey}/rejectedAt`] = Date.now();
    if (reason) {
      updates[`ekycSessions/${emailKey}/rejectReason`] = reason;
    }
  }

  await update(dbRef(firebaseRtdb), updates);
}

export interface OfficerEkycDetail {
  uid: string;
  email: string;
  fullName: string;
  nationalId: string;
  phone: string;
  status: EkycSessionStatus;
  cif?: string;
  frontIdUrl?: string;
  backIdUrl?: string;
  selfieUrl?: string;
}

function normalizeStatus(
  sessionStatus?: EkycSessionStatus,
  userStatus?: string
): EkycSessionStatus {
  if (sessionStatus) return sessionStatus;
  const raw = (userStatus ?? "").toUpperCase();
  if (raw === "VERIFIED") return "VERIFIED";
  if (raw === "REJECTED") return "REJECTED";
  if (raw === "PENDING_CUSTOMER") return "PENDING_CUSTOMER";
  return "PENDING_REVIEW";
}

// Lấy detail 1 hồ sơ eKYC cho nhân viên (gộp users + ekycSessions)
export async function fetchEkycDetailForOfficer(
  uid: string
): Promise<OfficerEkycDetail | null> {
  const userSnap = await get(dbRef(firebaseRtdb, `users/${uid}`));
  if (!userSnap.exists()) return null;

  const user = userSnap.val() as DbUser;
  if (user.role !== "CUSTOMER") return null;

  const email = user.email ?? "";
  let session: EkycSession | null = null;

  if (email) {
    const emailKey = emailToKey(email);
    const sessionSnap = await get(
      dbRef(firebaseRtdb, `ekycSessions/${emailKey}`)
    );
    if (sessionSnap.exists()) {
      session = sessionSnap.val() as EkycSession;
    }
  }

  const fullName = session?.fullName || user.username || "Khách hàng chưa có tên";

  const nationalId =
    session?.nationalId ||
    user.nationalId ||
    user.cccd ||
    user.idNumber ||
    user.national_id ||
    "";

  const phone = user.phone || user.phoneNumber || "";

  const status = normalizeStatus(
    session?.status,
    user.ekycStatus ?? user.kycStatus
  );

  const cif = session?.cif || user.cif || undefined;

  return {
    uid,
    email,
    fullName,
    nationalId,
    phone,
    status,
    cif,
    frontIdUrl: session?.frontIdUrl,
    backIdUrl: session?.backIdUrl,
    selfieUrl: session?.selfieUrl,
  };
}
