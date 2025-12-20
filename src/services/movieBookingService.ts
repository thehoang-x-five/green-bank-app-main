import { fbDb, fbAuth, fbRtdb } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion } from "firebase/firestore";
import {
  ref,
  get,
  runTransaction as rtdbRunTransaction,
  push,
  set,
} from "firebase/database";
import { getCurrentUserProfile } from "./userService";

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
    throw new Error("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
  }

  // Check account status
  if (profile.status === "LOCKED") {
    throw new Error("Tài khoản đăng nhập đang bị khóa, không thể giao dịch");
  }

  // Check eKYC status
  if (profile.ekycStatus !== "VERIFIED") {
    throw new Error(
      "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
    );
  }

  // Check transaction permission
  if (!profile.canTransact) {
    throw new Error("Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng.");
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
        throw new Error("Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng.");
      }
      const balance =
        typeof acc.balance === "number" ? acc.balance : Number((acc.balance as string) || 0);
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
