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
    const d = doc.data() as any;
    rooms.push({
      id: doc.id,
      hotelId,
      name: d.name,
      pricePerNight: d.pricePerNight,
      perks: d.perks || [],
      refundable: d.refundable,
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
  if (profile.ekycStatus !== "VERIFIED" || !profile.canTransact) {
    throw new Error("Tài khoản chưa được nhân viên xác thực hoặc chưa được phép giao dịch");
  }

  const total = params.room.pricePerNight * params.rooms * params.nights;
  if (total >= 15_000_000) {
    throw new Error("Giao dịch >= 15 triệu yêu cầu xác thực vân tay (demo)");
  }
  const accountRef = ref(firebaseRtdb, `accounts/${params.accountNumber}`);

  const newBalance = await runTransaction(accountRef, (current) => {
    const acc = current as any;
    if (!acc || acc.uid !== currentUser.uid) {
      throw new Error("Không tìm thấy tài khoản nguồn");
    }
    if (acc.status === "LOCKED") {
      throw new Error("Tài khoản nguồn đang bị khóa");
    }
    const balance = typeof acc.balance === "number" ? acc.balance : Number(acc.balance || 0);
    if (balance < total) {
      throw new Error("Số dư không đủ");
    }
    return { ...acc, balance: balance - total };
  }).then((res) => {
    const acc = res.snapshot.val() as any;
    return typeof acc.balance === "number" ? acc.balance : Number(acc.balance || 0);
  });

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
