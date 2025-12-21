import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { get, ref, runTransaction, push, set } from "firebase/database";
import { firebaseAuth, fbDb, firebaseRtdb } from "@/lib/firebase";
import { getCurrentUserProfile } from "@/services/userService";
import { requireBiometricForHighValueVnd } from "./biometricService";
import type { HotelItem } from "./hotelService";
import type { AppUserProfile } from "./authService";

export type HotelRoom = {
  id: string;
  hotelId: string;
  name: string;
  pricePerNight: number;
  perks: string[];
  refundable?: boolean;
};

export type UserAccount = {
  accountNumber: string;
  balance: number;
};

/**
 * ✅ Check if a room is available for the given date range
 * Check-in: 14:00, Check-out: 12:00
 * A room is unavailable if there's an existing booking that overlaps with the requested dates
 */
async function isRoomAvailable(
  roomId: string,
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  const requestCheckIn = new Date(`${checkIn}T14:00:00`).getTime();
  const requestCheckOut = new Date(`${checkOut}T12:00:00`).getTime();

  // Query all bookings for this room
  const bookingsRef = collection(fbDb, "hotel_bookings");
  const q = query(
    bookingsRef,
    where("roomId", "==", roomId),
    where("status", "==", "PAID")
  );
  const snap = await getDocs(q);

  // Check for overlapping bookings
  for (const doc of snap.docs) {
    const booking = doc.data();
    const existingCheckIn = booking.checkInDateTime as number;
    const existingCheckOut = booking.checkOutDateTime as number;

    // Check if date ranges overlap
    // Overlap occurs if: requestCheckIn < existingCheckOut AND requestCheckOut > existingCheckIn
    if (
      requestCheckIn < existingCheckOut &&
      requestCheckOut > existingCheckIn
    ) {
      return false; // Room is booked during this period
    }
  }

  return true; // Room is available
}

export async function fetchHotelRooms(
  hotelId: string,
  checkIn?: string,
  checkOut?: string
): Promise<HotelRoom[]> {
  const roomsRef = collection(fbDb, "hotel_rooms");
  const q = query(roomsRef, where("hotelId", "==", hotelId));
  const snap = await getDocs(q);
  const rooms: HotelRoom[] = [];

  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const room: HotelRoom = {
      id: doc.id,
      hotelId,
      name: (d.name as string) || "Phòng",
      pricePerNight: (d.pricePerNight as number) || 0,
      perks: Array.isArray(d.perks) ? (d.perks as string[]) : [],
      refundable: (d.refundable as boolean) ?? false,
    };

    // ✅ Filter out rooms that are already booked for the requested dates
    if (checkIn && checkOut) {
      const available = await isRoomAvailable(doc.id, checkIn, checkOut);
      if (available) {
        rooms.push(room);
      }
    } else {
      // No date filter - return all rooms
      rooms.push(room);
    }
  }

  return rooms;
}

export async function fetchUserAccounts(): Promise<UserAccount[]> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) return [];
  const accountsRef = ref(firebaseRtdb, "accounts");
  const snap = await get(accountsRef);
  if (!snap.exists()) return [];
  const out: UserAccount[] = [];
  snap.forEach((child) => {
    const v = child.val();
    if (v?.uid === currentUser.uid) {
      const balance =
        typeof v.balance === "number" ? v.balance : Number(v.balance || 0);
      out.push({ accountNumber: child.key ?? "", balance });
    }
    return false;
  });
  return out;
}

export async function createHotelBooking(params: {
  hotel: HotelItem;
  room: HotelRoom;
  guests: number;
  rooms: number;
  nights: number;
  checkIn: string;
  checkOut: string;
  accountNumber: string;
}): Promise<{ bookingId: string; transactionId: string; newBalance: number }> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error("Bạn cần đăng nhập để thanh toán");

  const profile: AppUserProfile | null = await getCurrentUserProfile().catch(
    () => null
  );
  if (!profile) {
    throw new Error("Không lấy được hồ sơ khách hàng");
  }
  if (profile.status === "LOCKED") {
    throw new Error("Tài khoản đăng nhập đang bị khóa, không thể giao dịch");
  }
  if (profile.ekycStatus !== "VERIFIED") {
    throw new Error(
      "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
    );
  }
  if (!profile.canTransact) {
    throw new Error(
      "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."
    );
  }

  // Validate input parameters
  if (!params.hotel || !params.room) {
    throw new Error("Thông tin khách sạn và phòng không đầy đủ");
  }

  if (params.guests < 1) {
    throw new Error("Số khách phải >= 1");
  }

  if (params.rooms < 1) {
    throw new Error("Số phòng phải >= 1");
  }

  if (params.nights < 1) {
    throw new Error("Số đêm phải >= 1");
  }

  if (!params.accountNumber) {
    throw new Error("Vui lòng chọn tài khoản thanh toán");
  }

  const total = params.room.pricePerNight * params.rooms * params.nights;

  // ✅ Biometric authentication for high-value transactions (>= 10 million VND)
  const biometricResult = await requireBiometricForHighValueVnd(total, {
    reason: `Xác thực đặt phòng khách sạn ${total.toLocaleString("vi-VN")} VND`,
  });

  if (!biometricResult.success) {
    throw new Error(biometricResult.message || "Xác thực sinh trắc thất bại");
  }

  let newBalance = 0;

  // Handle account transaction in Realtime Database
  if (params.accountNumber && params.accountNumber !== "DEMO") {
    const accountRef = ref(firebaseRtdb, `accounts/${params.accountNumber}`);

    // Check if account exists first
    const accountSnap = await get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Không tìm thấy tài khoản thanh toán");
    }

    const accountData = accountSnap.val() as Record<string, unknown>;

    // Verify account ownership
    if (accountData.uid !== currentUser.uid) {
      throw new Error("Bạn không có quyền sử dụng tài khoản này");
    }

    // Run transaction to deduct balance
    newBalance = await runTransaction(accountRef, (current) => {
      const acc = current as Record<string, unknown> | null;
      if (!acc) {
        return current; // Abort transaction
      }
      if (acc.status === "LOCKED") {
        throw new Error(
          "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
        );
      }
      const balance =
        typeof acc.balance === "number"
          ? acc.balance
          : Number((acc.balance as string) || 0);
      if (balance < total) {
        throw new Error(
          `Số dư không đủ. Cần ${total.toLocaleString(
            "vi-VN"
          )} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`
        );
      }
      return { ...acc, balance: balance - total };
    }).then((res) => {
      if (!res.committed) throw new Error("Giao dịch thất bại");
      const acc = res.snapshot.val() as Record<string, unknown>;
      return typeof acc.balance === "number"
        ? acc.balance
        : Number((acc.balance as string) || 0);
    });
  }

  const txnRef = await addDoc(collection(fbDb, "transactions"), {
    type: "HOTEL_BOOKING",
    status: "SUCCESS",
    customerUid: currentUser.uid,
    accountNumber: params.accountNumber,
    hotelId: params.hotel.id,
    hotelName: params.hotel.name,
    amount: total,
    fee: 0,
    createdAt: serverTimestamp(),
  });

  // ✅ Save booking with check-in/check-out timestamps for availability checking
  // Check-in: 14:00 (2 PM), Check-out: 12:00 (noon)
  const checkInDateTime = new Date(`${params.checkIn}T14:00:00`).getTime();
  const checkOutDateTime = new Date(`${params.checkOut}T12:00:00`).getTime();

  const bookingRef = await addDoc(collection(fbDb, "hotel_bookings"), {
    status: "PAID",
    customerUid: currentUser.uid,
    hotelId: params.hotel.id,
    hotelName: params.hotel.name,
    roomId: params.room.id,
    roomName: params.room.name,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    checkInDateTime,
    checkOutDateTime,
    nights: params.nights,
    guests: params.guests,
    rooms: params.rooms,
    total,
    transactionId: txnRef.id,
    createdAt: serverTimestamp(),
  });

  // Push balance-change notification to RTDB (Biến động tab)
  try {
    const notiRef = push(ref(firebaseRtdb, `notifications/${currentUser.uid}`));
    const createdAt = Date.now();
    await set(notiRef, {
      type: "BALANCE_CHANGE",
      direction: "OUT",
      title: "Đặt phòng khách sạn",
      message: `${params.hotel.name} • ${params.room.name}`,
      amount: total,
      accountNumber: params.accountNumber,
      balanceAfter: newBalance,
      transactionId: txnRef.id,
      createdAt,
    });
  } catch (err) {
    console.warn("createHotelBooking notification failed (ignored):", err);
  }

  return { bookingId: bookingRef.id, transactionId: txnRef.id, newBalance };
}

/* ================== NEW: INITIATE + CONFIRM FLOW ================== */

import { sendOtpEmail } from "./otpService";
import { serverTimestamp as rtdbServerTimestamp } from "firebase/database";

export interface InitiateHotelBookingResult {
  transactionId: string;
  maskedEmail: string;
  expireAt: number;
  devOtpCode?: string;
}

/**
 * Step 1: Initiate hotel booking (create pending transaction + send OTP)
 */
export async function initiateHotelBooking(params: {
  hotel: HotelItem;
  room: HotelRoom;
  guests: number;
  rooms: number;
  nights: number;
  checkIn: string;
  checkOut: string;
  accountNumber: string;
}): Promise<InitiateHotelBookingResult> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error("Bạn cần đăng nhập để thanh toán");

  const profile: AppUserProfile | null = await getCurrentUserProfile().catch(
    () => null
  );
  if (!profile) {
    throw new Error("Không lấy được hồ sơ khách hàng");
  }
  if (profile.status === "LOCKED") {
    throw new Error("Tài khoản đăng nhập đang bị khóa, không thể giao dịch");
  }
  if (profile.ekycStatus !== "VERIFIED") {
    throw new Error(
      "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
    );
  }
  if (!profile.canTransact) {
    throw new Error(
      "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."
    );
  }

  // Validate input parameters
  if (!params.hotel || !params.room) {
    throw new Error("Thông tin khách sạn và phòng không đầy đủ");
  }

  if (params.guests < 1) {
    throw new Error("Số khách phải >= 1");
  }

  if (params.rooms < 1) {
    throw new Error("Số phòng phải >= 1");
  }

  if (params.nights < 1) {
    throw new Error("Số đêm phải >= 1");
  }

  if (!params.accountNumber) {
    throw new Error("Vui lòng chọn tài khoản thanh toán");
  }

  const total = params.room.pricePerNight * params.rooms * params.nights;

  // Check if account exists and has sufficient balance
  if (params.accountNumber && params.accountNumber !== "DEMO") {
    const accountRef = ref(firebaseRtdb, `accounts/${params.accountNumber}`);
    const accountSnap = await get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Không tìm thấy tài khoản thanh toán");
    }

    const accountData = accountSnap.val() as Record<string, unknown>;
    if (accountData.uid !== currentUser.uid) {
      throw new Error("Bạn không có quyền sử dụng tài khoản này");
    }

    const balance =
      typeof accountData.balance === "number"
        ? accountData.balance
        : Number((accountData.balance as string) || 0);
    if (balance < total) {
      throw new Error(
        `Số dư không đủ. Cần ${total.toLocaleString(
          "vi-VN"
        )} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`
      );
    }
  }

  // Create pending transaction in RTDB
  const txnRef = push(ref(firebaseRtdb, `hotelTransactions`));
  const transactionId = txnRef.key!;

  const checkInDateTime = new Date(`${params.checkIn}T14:00:00`).getTime();
  const checkOutDateTime = new Date(`${params.checkOut}T12:00:00`).getTime();

  await set(txnRef, {
    transactionId,
    userId: currentUser.uid,
    accountNumber: params.accountNumber,
    type: "HOTEL_BOOKING",
    amount: total,
    description: `Đặt phòng khách sạn: ${params.hotel.name}`,
    status: "PENDING",
    hotelId: params.hotel.id,
    hotelName: params.hotel.name,
    roomId: params.room.id,
    roomName: params.room.name,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    checkInDateTime,
    checkOutDateTime,
    nights: params.nights,
    guests: params.guests,
    rooms: params.rooms,
    createdAt: Date.now(),
    createdAtServer: rtdbServerTimestamp(),
  });

  // Send OTP email
  const otpResult = await sendOtpEmail(
    currentUser.uid,
    transactionId,
    "HOTEL_BOOKING"
  );

  return {
    transactionId,
    maskedEmail: otpResult.maskedEmail,
    expireAt: otpResult.expireAt,
    devOtpCode: otpResult.devOtpCode,
  };
}

/**
 * Step 2: Confirm hotel booking with OTP
 */
export async function confirmHotelBookingWithOtp(
  transactionId: string,
  otpCode: string
): Promise<{ bookingId: string; transactionId: string; newBalance: number }> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error("Vui lòng đăng nhập để tiếp tục");
  }

  // Get transaction
  const txnRef = ref(firebaseRtdb, `hotelTransactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) {
    throw new Error("Không tìm thấy giao dịch");
  }

  const txnData = txnSnap.val() as Record<string, unknown>;

  // Verify ownership
  if (txnData.userId !== currentUser.uid) {
    throw new Error("Bạn không có quyền xác nhận giao dịch này");
  }

  // Check status
  if (txnData.status !== "PENDING") {
    throw new Error("Giao dịch đã được xử lý hoặc đã hủy");
  }

  // Verify OTP
  const otpRef = ref(firebaseRtdb, `otps/${transactionId}`);
  const otpSnap = await get(otpRef);
  if (!otpSnap.exists()) {
    throw new Error("Mã OTP không tồn tại hoặc đã hết hạn");
  }

  const otpData = otpSnap.val() as Record<string, unknown>;

  // Check expiration
  const expireAt = typeof otpData.expireAt === "number" ? otpData.expireAt : 0;
  if (Date.now() > expireAt) {
    throw new Error("Mã OTP đã hết hạn. Vui lòng gửi lại OTP mới.");
  }

  // Verify OTP code
  if (otpData.code !== otpCode) {
    throw new Error("Mã OTP không đúng. Vui lòng kiểm tra lại.");
  }

  // Extract transaction data
  const accountNumber = txnData.accountNumber as string;
  const total = txnData.amount as number;
  const hotelId = txnData.hotelId as string;
  const hotelName = txnData.hotelName as string;
  const roomId = txnData.roomId as string;
  const roomName = txnData.roomName as string;
  const checkIn = txnData.checkIn as string;
  const checkOut = txnData.checkOut as string;
  const checkInDateTime = txnData.checkInDateTime as number;
  const checkOutDateTime = txnData.checkOutDateTime as number;
  const nights = txnData.nights as number;
  const guests = txnData.guests as number;
  const rooms = txnData.rooms as number;

  // Process payment: deduct balance
  let newBalance = 0;
  if (accountNumber && accountNumber !== "DEMO") {
    const accountRef = ref(firebaseRtdb, `accounts/${accountNumber}`);
    newBalance = await runTransaction(accountRef, (current) => {
      const acc = current as Record<string, unknown> | null;
      if (!acc) {
        return current;
      }
      if (acc.status === "LOCKED") {
        throw new Error(
          "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
        );
      }
      const balance =
        typeof acc.balance === "number"
          ? acc.balance
          : Number((acc.balance as string) || 0);
      if (balance < total) {
        throw new Error(
          `Số dư không đủ. Cần ${total.toLocaleString(
            "vi-VN"
          )} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`
        );
      }
      return { ...acc, balance: balance - total };
    }).then((res) => {
      if (!res.committed) throw new Error("Giao dịch thất bại");
      const acc = res.snapshot.val() as Record<string, unknown>;
      return typeof acc.balance === "number"
        ? acc.balance
        : Number((acc.balance as string) || 0);
    });
  }

  // Create transaction record in Firestore
  const firestoreTxnRef = await addDoc(collection(fbDb, "transactions"), {
    type: "HOTEL_BOOKING",
    status: "SUCCESS",
    customerUid: currentUser.uid,
    accountNumber,
    hotelId,
    hotelName,
    amount: total,
    fee: 0,
    createdAt: serverTimestamp(),
  });

  // Create booking record in Firestore
  const bookingRef = await addDoc(collection(fbDb, "hotel_bookings"), {
    status: "PAID",
    customerUid: currentUser.uid,
    hotelId,
    hotelName,
    roomId,
    roomName,
    checkIn,
    checkOut,
    checkInDateTime,
    checkOutDateTime,
    nights,
    guests,
    rooms,
    total,
    transactionId: firestoreTxnRef.id,
    createdAt: serverTimestamp(),
  });

  // Update RTDB transaction status
  await runTransaction(txnRef, (current) => {
    if (!current) return current;
    return {
      ...current,
      status: "SUCCESS",
      bookingId: bookingRef.id,
      firestoreTransactionId: firestoreTxnRef.id,
      confirmedAt: Date.now(),
      confirmedAtServer: rtdbServerTimestamp(),
    };
  });

  // Delete OTP
  await set(otpRef, null);

  // Send notification
  try {
    const notiRef = push(ref(firebaseRtdb, `notifications/${currentUser.uid}`));
    await set(notiRef, {
      type: "BALANCE_CHANGE",
      direction: "OUT",
      title: "Đặt phòng khách sạn",
      message: `${hotelName} • ${roomName}`,
      amount: total,
      accountNumber,
      balanceAfter: newBalance,
      transactionId,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.warn("Notification failed (ignored):", err);
  }

  return {
    bookingId: bookingRef.id,
    transactionId,
    newBalance,
  };
}

/**
 * Resend OTP for hotel booking
 */
export async function resendHotelBookingOtp(
  transactionId: string
): Promise<{ maskedEmail: string; expireAt: number }> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error("Vui lòng đăng nhập để tiếp tục");
  }

  // Verify transaction exists and belongs to user
  const txnRef = ref(firebaseRtdb, `hotelTransactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) {
    throw new Error("Không tìm thấy giao dịch");
  }

  const txnData = txnSnap.val() as Record<string, unknown>;
  if (txnData.userId !== currentUser.uid) {
    throw new Error("Bạn không có quyền gửi lại OTP cho giao dịch này");
  }

  if (txnData.status !== "PENDING") {
    throw new Error("Giao dịch đã được xử lý hoặc đã hủy");
  }

  // Resend OTP
  const otpResult = await sendOtpEmail(
    currentUser.uid,
    transactionId,
    "HOTEL_BOOKING"
  );

  return {
    maskedEmail: otpResult.maskedEmail,
    expireAt: otpResult.expireAt,
  };
}
