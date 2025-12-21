import { fbDb, fbAuth, fbRtdb } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import {
  ref,
  get,
  runTransaction as rtdbRunTransaction,
  push,
  set,
} from "firebase/database";
import { getCurrentUserProfile } from "./userService";
import { requireBiometricForHighValueVnd } from "./biometricService";

export interface CreateMovieBookingParams {
  cinemaId: string;
  cinemaName: string;
  movieId: string;
  movieTitle: string;
  showtimeId: string;
  date: string;
  time: string;
  room: number;
  selectedSeats: string[];
  totalAmount: number;
  accountId: string;
}

/**
 * Create a movie booking with payment
 * Validates: authentication, eKYC, account status, balance, biometric requirement
 * Creates booking and transaction records atomically
 */
export async function createMovieBooking(
  params: CreateMovieBookingParams
): Promise<{ bookingId: string; transactionId: string }> {
  const user = fbAuth.currentUser;
  if (!user) {
    throw new Error("Vui lòng đăng nhập để tiếp tục");
  }

  // Validate seat selection
  if (!params.selectedSeats || params.selectedSeats.length === 0) {
    throw new Error("Vui lòng chọn ít nhất một ghế");
  }

  // Validate account selection
  if (!params.accountId) {
    throw new Error("Vui lòng chọn tài khoản thanh toán");
  }

  // Get user profile
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new Error(
      "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
    );
  }

  // Check account status
  if (profile.status === "LOCKED") {
    throw new Error("Tài khoản đăng nhập đang bị khóa, không thể giao dịch");
  }

  // Check eKYC status
  if (profile.ekycStatus !== "VERIFIED") {
    throw new Error(
      "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
    );
  }

  // Check transaction permission
  if (!profile.canTransact) {
    throw new Error(
      "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."
    );
  }

  // ✅ Biometric authentication for high-value transactions (>= 10 million VND)
  const biometricResult = await requireBiometricForHighValueVnd(
    params.totalAmount,
    {
      reason: `Xác thực đặt vé xem phim ${params.totalAmount.toLocaleString(
        "vi-VN"
      )} VND`,
    }
  );

  if (!biometricResult.success) {
    throw new Error(biometricResult.message || "Xác thực sinh trắc thất bại");
  }

  // Handle account transaction in Realtime Database
  let balanceAfter = 0;
  if (params.accountId && params.accountId !== "DEMO") {
    const accountRef = ref(fbRtdb, `accounts/${params.accountId}`);

    // Check if account exists first
    const accountSnap = await get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Không tìm thấy tài khoản thanh toán");
    }

    const accountData = accountSnap.val() as Record<string, unknown>;

    // Verify account ownership
    if (accountData.uid !== user.uid) {
      throw new Error("Bạn không có quyền sử dụng tài khoản này");
    }

    // Run transaction to deduct balance
    balanceAfter = await rtdbRunTransaction(accountRef, (current) => {
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
      if (balance < params.totalAmount) {
        throw new Error(
          `Số dư không đủ. Cần ${params.totalAmount.toLocaleString(
            "vi-VN"
          )} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`
        );
      }
      return { ...acc, balance: balance - params.totalAmount };
    }).then((res) => {
      if (!res.committed) throw new Error("Giao dịch thất bại");
      const acc = res.snapshot.val() as Record<string, unknown>;
      return typeof acc.balance === "number"
        ? acc.balance
        : Number((acc.balance as string) || 0);
    });
  }

  // ✅ Update showtime occupiedSeats BEFORE creating booking (atomic seat reservation)
  const showtimeRef = doc(fbDb, "showtimes", params.showtimeId);
  await updateDoc(showtimeRef, {
    occupiedSeats: arrayUnion(...params.selectedSeats),
  });

  // Create booking record in Firestore
  const bookingRef = await addDoc(collection(fbDb, "movie_bookings"), {
    userId: user.uid,
    cinemaId: params.cinemaId,
    cinemaName: params.cinemaName,
    movieId: params.movieId,
    movieTitle: params.movieTitle,
    showtimeId: params.showtimeId,
    date: params.date,
    time: params.time,
    room: params.room,
    selectedSeats: params.selectedSeats,
    totalAmount: params.totalAmount,
    accountId: params.accountId,
    status: "confirmed",
    createdAt: serverTimestamp(),
  });

  // Create transaction record in Firestore
  const txnRef = await addDoc(collection(fbDb, "transactions"), {
    userId: user.uid,
    accountId: params.accountId,
    type: "movie_booking",
    amount: -params.totalAmount,
    description: `Đặt vé xem phim: ${params.movieTitle}`,
    status: "completed",
    metadata: {
      bookingId: bookingRef.id,
      cinemaName: params.cinemaName,
      movieTitle: params.movieTitle,
      date: params.date,
      time: params.time,
      seats: params.selectedSeats,
    },
    createdAt: serverTimestamp(),
  });

  // Push balance-change notification to RTDB (Biến động tab)
  try {
    const notiRef = push(ref(fbRtdb, `notifications/${user.uid}`));
    const createdAt = Date.now();
    await set(notiRef, {
      type: "BALANCE_CHANGE",
      direction: "OUT",
      title: "Đặt vé xem phim",
      message: `${params.movieTitle} • ${params.cinemaName}`,
      amount: params.totalAmount,
      accountNumber: params.accountId,
      balanceAfter,
      transactionId: txnRef.id,
      createdAt,
    });
  } catch (err) {
    console.warn("createMovieBooking notification failed (ignored):", err);
  }

  return {
    bookingId: bookingRef.id,
    transactionId: txnRef.id,
  };
}

/* ================== NEW: INITIATE + CONFIRM FLOW ================== */

import { sendOtpEmail } from "./otpService";
import { serverTimestamp as rtdbServerTimestamp } from "firebase/database";

export interface InitiateMovieBookingResult {
  transactionId: string;
  maskedEmail: string;
  expireAt: number;
  devOtpCode?: string;
}

/**
 * Step 1: Initiate movie booking (create pending transaction + send OTP)
 */
export async function initiateMovieBooking(
  params: CreateMovieBookingParams
): Promise<InitiateMovieBookingResult> {
  const user = fbAuth.currentUser;
  if (!user) {
    throw new Error("Vui lòng đăng nhập để tiếp tục");
  }

  // Validate seat selection
  if (!params.selectedSeats || params.selectedSeats.length === 0) {
    throw new Error("Vui lòng chọn ít nhất một ghế");
  }

  // Validate account selection
  if (!params.accountId) {
    throw new Error("Vui lòng chọn tài khoản thanh toán");
  }

  // Get user profile
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new Error(
      "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
    );
  }

  // Check account status
  if (profile.status === "LOCKED") {
    throw new Error("Tài khoản đăng nhập đang bị khóa, không thể giao dịch");
  }

  // Check eKYC status
  if (profile.ekycStatus !== "VERIFIED") {
    throw new Error(
      "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
    );
  }

  // Check transaction permission
  if (!profile.canTransact) {
    throw new Error(
      "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."
    );
  }

  // Check if account exists and has sufficient balance
  if (params.accountId && params.accountId !== "DEMO") {
    const accountRef = ref(fbRtdb, `accounts/${params.accountId}`);
    const accountSnap = await get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Không tìm thấy tài khoản thanh toán");
    }

    const accountData = accountSnap.val() as Record<string, unknown>;
    if (accountData.uid !== user.uid) {
      throw new Error("Bạn không có quyền sử dụng tài khoản này");
    }

    const balance =
      typeof accountData.balance === "number"
        ? accountData.balance
        : Number((accountData.balance as string) || 0);
    if (balance < params.totalAmount) {
      throw new Error(
        `Số dư không đủ. Cần ${params.totalAmount.toLocaleString(
          "vi-VN"
        )} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`
      );
    }
  }

  // Create pending transaction in RTDB
  const txnRef = push(ref(fbRtdb, `movieTransactions`));
  const transactionId = txnRef.key!;

  await set(txnRef, {
    transactionId,
    userId: user.uid,
    accountId: params.accountId,
    type: "MOVIE_BOOKING",
    amount: params.totalAmount,
    description: `Đặt vé xem phim: ${params.movieTitle}`,
    status: "PENDING",
    cinemaId: params.cinemaId,
    cinemaName: params.cinemaName,
    movieId: params.movieId,
    movieTitle: params.movieTitle,
    showtimeId: params.showtimeId,
    date: params.date,
    time: params.time,
    room: params.room,
    selectedSeats: params.selectedSeats,
    createdAt: Date.now(),
    createdAtServer: rtdbServerTimestamp(),
  });

  // Send OTP email
  const otpResult = await sendOtpEmail(
    user.uid,
    transactionId,
    "MOVIE_BOOKING"
  );

  return {
    transactionId,
    maskedEmail: otpResult.maskedEmail,
    expireAt: otpResult.expireAt,
    devOtpCode: otpResult.devOtpCode,
  };
}

/**
 * Step 2: Confirm movie booking with OTP
 */
export async function confirmMovieBookingWithOtp(
  transactionId: string,
  otpCode: string
): Promise<{ bookingId: string; transactionId: string }> {
  const user = fbAuth.currentUser;
  if (!user) {
    throw new Error("Vui lòng đăng nhập để tiếp tục");
  }

  // Get transaction
  const txnRef = ref(fbRtdb, `movieTransactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) {
    throw new Error("Không tìm thấy giao dịch");
  }

  const txnData = txnSnap.val() as Record<string, unknown>;

  // Verify ownership
  if (txnData.userId !== user.uid) {
    throw new Error("Bạn không có quyền xác nhận giao dịch này");
  }

  // Check status
  if (txnData.status !== "PENDING") {
    throw new Error("Giao dịch đã được xử lý hoặc đã hủy");
  }

  // Verify OTP
  const otpRef = ref(fbRtdb, `otps/${transactionId}`);
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
  const accountId = txnData.accountId as string;
  const totalAmount = txnData.amount as number;
  const cinemaId = txnData.cinemaId as string;
  const cinemaName = txnData.cinemaName as string;
  const movieId = txnData.movieId as string;
  const movieTitle = txnData.movieTitle as string;
  const showtimeId = txnData.showtimeId as string;
  const date = txnData.date as string;
  const time = txnData.time as string;
  const room = txnData.room as number;
  const selectedSeats = txnData.selectedSeats as string[];

  // Process payment: deduct balance
  let balanceAfter = 0;
  if (accountId && accountId !== "DEMO") {
    const accountRef = ref(fbRtdb, `accounts/${accountId}`);
    balanceAfter = await rtdbRunTransaction(accountRef, (current) => {
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
      if (balance < totalAmount) {
        throw new Error(
          `Số dư không đủ. Cần ${totalAmount.toLocaleString(
            "vi-VN"
          )} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`
        );
      }
      return { ...acc, balance: balance - totalAmount };
    }).then((res) => {
      if (!res.committed) throw new Error("Giao dịch thất bại");
      const acc = res.snapshot.val() as Record<string, unknown>;
      return typeof acc.balance === "number"
        ? acc.balance
        : Number((acc.balance as string) || 0);
    });
  }

  // Update showtime occupiedSeats
  const showtimeRef = doc(fbDb, "showtimes", showtimeId);
  await updateDoc(showtimeRef, {
    occupiedSeats: arrayUnion(...selectedSeats),
  });

  // Create booking record in Firestore
  const bookingRef = await addDoc(collection(fbDb, "movie_bookings"), {
    userId: user.uid,
    cinemaId,
    cinemaName,
    movieId,
    movieTitle,
    showtimeId,
    date,
    time,
    room,
    selectedSeats,
    totalAmount,
    accountId,
    status: "confirmed",
    createdAt: serverTimestamp(),
  });

  // Create transaction record in Firestore
  const firestoreTxnRef = await addDoc(collection(fbDb, "transactions"), {
    userId: user.uid,
    accountId,
    type: "movie_booking",
    amount: -totalAmount,
    description: `Đặt vé xem phim: ${movieTitle}`,
    status: "completed",
    metadata: {
      bookingId: bookingRef.id,
      cinemaName,
      movieTitle,
      date,
      time,
      seats: selectedSeats,
    },
    createdAt: serverTimestamp(),
  });

  // Update RTDB transaction status
  await rtdbRunTransaction(txnRef, (current) => {
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
    const notiRef = push(ref(fbRtdb, `notifications/${user.uid}`));
    await set(notiRef, {
      type: "BALANCE_CHANGE",
      direction: "OUT",
      title: "Đặt vé xem phim",
      message: `${movieTitle} • ${cinemaName}`,
      amount: totalAmount,
      accountNumber: accountId,
      balanceAfter,
      transactionId,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.warn("Notification failed (ignored):", err);
  }

  return {
    bookingId: bookingRef.id,
    transactionId,
  };
}

/**
 * Resend OTP for movie booking
 */
export async function resendMovieBookingOtp(
  transactionId: string
): Promise<{ maskedEmail: string; expireAt: number }> {
  const user = fbAuth.currentUser;
  if (!user) {
    throw new Error("Vui lòng đăng nhập để tiếp tục");
  }

  // Verify transaction exists and belongs to user
  const txnRef = ref(fbRtdb, `movieTransactions/${transactionId}`);
  const txnSnap = await get(txnRef);
  if (!txnSnap.exists()) {
    throw new Error("Không tìm thấy giao dịch");
  }

  const txnData = txnSnap.val() as Record<string, unknown>;
  if (txnData.userId !== user.uid) {
    throw new Error("Bạn không có quyền gửi lại OTP cho giao dịch này");
  }

  if (txnData.status !== "PENDING") {
    throw new Error("Giao dịch đã được xử lý hoặc đã hủy");
  }

  // Resend OTP
  const otpResult = await sendOtpEmail(
    user.uid,
    transactionId,
    "MOVIE_BOOKING"
  );

  return {
    maskedEmail: otpResult.maskedEmail,
    expireAt: otpResult.expireAt,
  };
}
