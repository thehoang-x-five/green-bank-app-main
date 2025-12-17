import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { get, ref, runTransaction } from "firebase/database";
import { firebaseAuth, fbDb, firebaseRtdb } from "@/lib/firebase";
import { getCurrentUserProfile } from "@/services/userService";
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

export async function fetchHotelRooms(hotelId: string): Promise<HotelRoom[]> {
  const roomsRef = collection(fbDb, "hotel_rooms");
  const q = query(roomsRef, where("hotelId", "==", hotelId));
  const snap = await getDocs(q);
  const rooms: HotelRoom[] = [];
  snap.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    rooms.push({
      id: doc.id,
      hotelId,
      name: (d.name as string) || "Phòng",
      pricePerNight: (d.pricePerNight as number) || 0,
      perks: Array.isArray(d.perks) ? (d.perks as string[]) : [],
      refundable: (d.refundable as boolean) ?? false,
    });
  });
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
      const balance = typeof v.balance === "number" ? v.balance : Number(v.balance || 0);
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

  const profile: AppUserProfile | null = await getCurrentUserProfile().catch(() => null);
  if (!profile) {
    throw new Error("Không lấy được hồ sơ khách hàng");
  }
  if (profile.status === "LOCKED") {
    throw new Error("Tài khoản đăng nhập đang bị khóa, không thể giao dịch");
  }
  if (profile.ekycStatus !== "VERIFIED") {
    throw new Error("Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực.");
  }
  if (!profile.canTransact) {
    throw new Error("Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng.");
  }

  const total = params.room.pricePerNight * params.rooms * params.nights;
  if (total >= 10_000_000) {
    throw new Error("Giao dịch >= 10 triệu yêu cầu xác thực vân tay");
  }

  let newBalance = 0;

  // Skip RTDB transaction if no account number or RTDB not available
  if (params.accountNumber && params.accountNumber !== "DEMO") {
    const accountRef = ref(firebaseRtdb, `accounts/${params.accountNumber}`);
    
    // Check if account exists first
    const accountSnap = await get(accountRef);
    if (accountSnap.exists()) {
      newBalance = await runTransaction(accountRef, (current) => {
        const acc = current as Record<string, unknown> | null;
        if (!acc) {
          return current; // Abort transaction
        }
        if (acc.status === "LOCKED") {
          throw new Error("Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng.");
        }
        const balance = typeof acc.balance === "number" ? acc.balance : Number((acc.balance as string) || 0);
        if (balance < total) {
          throw new Error(`Số dư không đủ. Cần ${total.toLocaleString("vi-VN")} ₫, hiện có ${balance.toLocaleString("vi-VN")} ₫`);
        }
        return { ...acc, balance: balance - total };
      }).then((res) => {
        if (!res.committed) return 0;
        const acc = res.snapshot.val() as Record<string, unknown>;
        return typeof acc.balance === "number" ? acc.balance : Number((acc.balance as string) || 0);
      });
    }
    // If account doesn't exist, continue without RTDB transaction (newBalance = 0)
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

  const bookingRef = await addDoc(collection(fbDb, "bookings"), {
    status: "PAID",
    customerUid: currentUser.uid,
    hotelId: params.hotel.id,
    hotelName: params.hotel.name,
    roomId: params.room.id,
    roomName: params.room.name,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nights: params.nights,
    guests: params.guests,
    rooms: params.rooms,
    total,
    transactionId: txnRef.id,
    createdAt: serverTimestamp(),
  });

  return { bookingId: bookingRef.id, transactionId: txnRef.id, newBalance };
}
