import { firebaseRtdb, firebaseAuth } from "@/lib/firebase";
import {
  get,
  ref,
  set,
  push,
  runTransaction,
  serverTimestamp as rtdbServerTimestamp,
} from "firebase/database";
import { getCurrentUserProfile } from "./userService";

import type {
  FlightOption,
  UtilityFormData,
} from "@/pages/utilities/utilityTypes";

// ✅ [PATCH - NEW]
// Dùng chung type với UI để đảm bảo shape dữ liệu location
import type { LocationOption } from "@/pages/utilities/utilityTypes";

/**
 * ✅ [PATCH - NEW]
 * Danh sách sân bay/địa điểm: flightLocations/{CODE}
 */
export async function fetchFlightLocations(): Promise<LocationOption[]> {
  const snap = await get(ref(firebaseRtdb, "flightLocations"));
  if (!snap.exists()) return [];

  const val = snap.val() as Record<string, LocationOption>;
  const list = Object.values(val)
    .map((x) => {
      const code = (x as any)?.code ?? "";
      const city = (x as any)?.city ?? "";
      const airport = (x as any)?.airport ?? "";
      const region = (x as any)?.region ?? "";
      if (!code || !city) return null;
      return {
        code,
        city,
        airport: airport || city,
        region: region || "Việt Nam",
      };
    })
    .filter(Boolean) as LocationOption[];

  // sort theo city cho UI dễ tìm
  list.sort((a, b) => String(a.city).localeCompare(String(b.city), "vi"));
  return list;
}

/**
 * ✅ [PATCH - NEW]
 * Recent location theo yêu cầu:
 * flightRecent/{uid}/locations/{from|to}/{CODE}
 */
export async function upsertRecentLocation(params: {
  mode: "from" | "to";
  location: LocationOption;
  uid?: string;
}): Promise<void> {
  const uid = params.uid ?? firebaseAuth.currentUser?.uid;
  if (!uid) return;

  const code = (params.location.code || "").trim().toUpperCase();
  if (!code) return;

  const path = `flightRecent/${uid}/locations/${params.mode}/${code}`;
  await set(ref(firebaseRtdb, path), {
    ...params.location,
    code,
    ts: Date.now(),
    tsServer: rtdbServerTimestamp(),
  });
}

export async function fetchRecentLocations(params: {
  mode: "from" | "to";
  limit?: number;
  uid?: string;
}): Promise<LocationOption[]> {
  const uid = params.uid ?? firebaseAuth.currentUser?.uid;
  if (!uid) return [];

  const snap = await get(
    ref(firebaseRtdb, `flightRecent/${uid}/locations/${params.mode}`)
  );
  if (!snap.exists()) return [];

  const val = snap.val() as Record<string, any>;
  const list = Object.values(val)
    .map((x) => {
      const code = (x?.code ?? "").trim();
      const city = (x?.city ?? "").trim();
      const airport = (x?.airport ?? "").trim();
      const region = (x?.region ?? "").trim();
      if (!code || !city) return null;
      const ts = typeof x?.ts === "number" ? x.ts : 0;
      return {
        code,
        city,
        airport: airport || city,
        region: region || "Việt Nam",
        ts,
      } as any;
    })
    .filter(Boolean) as any[];

  list.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  return list.slice(0, params.limit ?? 5) as LocationOption[];
}

export async function fetchFlightInventory(): Promise<FlightOption[]> {
  const snap = await get(ref(firebaseRtdb, "flightInventory"));
  if (!snap.exists()) return [];

  const val = snap.val() as Record<string, FlightOption>;
  return Object.values(val);
}

/**
 * ✅ [PATCH - NEW]
 * Seat availability theo ngày: flightInventory/{id}/availability/{yyyy-mm-dd}
 */
type AvailabilityDay = {
  status?: "open" | "closed";
  seats?: { eco?: number; business?: number };
  price?: number;
};

function getAvailForDate(flight: any, dateKey: string): AvailabilityDay | null {
  if (!dateKey) return null;
  const availability = flight?.availability;
  if (!availability) return null;
  const day = availability?.[dateKey];
  if (!day) return null;
  return day as AvailabilityDay;
}

/**
 * ✅ [PATCH - NEW]
 * Tìm chuyến bay theo:
 * - from/to
 * - seatClass (all/eco/business)
 * - departDateKey (yyyy-mm-dd) từ UI Input type="date"
 * - đủ ghế theo availability ngày
 *
 * Rule match ngày đi (đúng “lịch bay”):
 * - Flight có availability mà không có key ngày → coi như không có chuyến ngày đó.
 * - status: "closed" → không bán.
 * - Giá ưu tiên availability[date].price (nếu có).
 */
export async function searchFlightsFromInventoryWithAvailability(params: {
  fromCode: string;
  toCode: string;
  seatClass: "all" | "eco" | "business";
  departDateKey: string; // yyyy-mm-dd
  paxTotal: number;
}): Promise<FlightOption[]> {
  const all = await fetchFlightInventory();

  const from = (params.fromCode || "").trim().toUpperCase();
  const to = (params.toCode || "").trim().toUpperCase();
  const seatClass = params.seatClass;
  const pax = Math.max(params.paxTotal || 0, 1);
  const dateKey = (params.departDateKey || "").trim(); // yyyy-mm-dd

  const result: FlightOption[] = [];

  for (const f of all) {
    const flightAny = f as any;

    // 1) Route
    const okRoute = (!from || f.fromCode === from) && (!to || f.toCode === to);
    if (!okRoute) continue;

    // 2) Cabin/seatClass
    const cabin = String(f.cabin ?? "").toLowerCase();
    if (seatClass === "eco" && !cabin.includes("economy")) continue;
    if (seatClass === "business" && !cabin.includes("business")) continue;

    // 3) Match ngày theo lịch bay (availability) - bắt buộc phải có
    const dayAvail = getAvailForDate(flightAny, dateKey);
    if (!dayAvail) continue;
    if (dayAvail.status === "closed") continue;

    // 4) Check ghế theo ngày
    const daySeats = (dayAvail?.seats ?? null) as {
      eco?: number;
      business?: number;
    } | null;

    const seats = daySeats ?? { eco: 0, business: 0 };

    if (seatClass === "eco") {
      const eco = typeof seats.eco === "number" ? seats.eco : 0;
      if (eco < pax) continue;
    }
    if (seatClass === "business") {
      const bus = typeof seats.business === "number" ? seats.business : 0;
      if (bus < pax) continue;
    }
    if (seatClass === "all") {
      const eco = typeof seats.eco === "number" ? seats.eco : 0;
      const bus = typeof seats.business === "number" ? seats.business : 0;
      if (eco < pax && bus < pax) continue;
    }

    // 5) Giá theo ngày (nếu có)
    const dayPrice =
      typeof dayAvail?.price === "number" ? dayAvail!.price : f.price;

    // Không mutate object gốc
    result.push({
      ...f,
      price: dayPrice,
    });
  }

  return result;
}

export async function createFlightOrder(params: {
  selectedFlight: FlightOption;
  formData: UtilityFormData;
  accountId: string;
}): Promise<{
  uid: string;
  orderId: string;
  orderNo: number;
  createdAtIso: string;
  bookingId: string;
  transactionId: string;
}> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Vui lòng đăng nhập để tiếp tục");
  }

  const { selectedFlight, formData, accountId } = params;

  // Validate flight selection
  if (!selectedFlight) {
    throw new Error("Vui lòng chọn chuyến bay");
  }

  // Validate account selection
  if (!accountId) {
    throw new Error("Vui lòng chọn tài khoản thanh toán");
  }

  // Validate passengers
  const paxAdults = parseInt((formData as any).flightAdult || "0", 10) || 0;
  const paxChildren = parseInt((formData as any).flightChild || "0", 10) || 0;
  const paxInfants = parseInt((formData as any).flightInfant || "0", 10) || 0;
  const paxTotal = paxAdults + paxChildren + paxInfants;

  if (paxTotal < 1) {
    throw new Error("Vui lòng chọn ít nhất một hành khách");
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
      "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
    );
  }

  // Check transaction permission
  if (!profile.canTransact) {
    throw new Error(
      "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."
    );
  }

  // Calculate total amount
  const totalAmount = (selectedFlight.price ?? 0) * Math.max(paxTotal, 1);

  // Handle account transaction in Realtime Database
  let balanceAfter = 0;
  if (accountId && accountId !== "DEMO") {
    const accountRef = ref(firebaseRtdb, `accounts/${accountId}`);

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
    balanceAfter = await runTransaction(accountRef, (current) => {
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

  const createdAtIso = new Date().toISOString();
  const createdAtTimestamp = Date.now();

  // 1) Tăng counter để tạo mã đơn tăng dần
  const counterRef = ref(firebaseRtdb, "counters/flightOrder");
  const tx = await runTransaction(counterRef, (current) => {
    const cur = typeof current === "number" ? current : 0;
    return cur + 1;
  });

  const orderNo = (tx.snapshot.val() as number) ?? 1;
  const orderId = `FO${String(orderNo).padStart(6, "0")}`;

  // Create transaction record in Realtime Database
  const txnRef = push(ref(firebaseRtdb, `flightTransactions`));
  const transactionId = txnRef.key!;

  await set(txnRef, {
    transactionId,
    userId: user.uid,
    accountId: accountId,
    type: "FLIGHT_BOOKING",
    amount: totalAmount,
    description: `Đặt vé máy bay: ${selectedFlight.airline} ${selectedFlight.code}`,
    status: "SUCCESS",
    orderId,
    airline: selectedFlight.airline,
    flightCode: selectedFlight.code,
    route: `${selectedFlight.fromCode} → ${selectedFlight.toCode}`,
    departDate: formData.flightDate,
    departTime: selectedFlight.departTime,
    arriveTime: selectedFlight.arriveTime,
    passengers: {
      adults: paxAdults,
      children: paxChildren,
      infants: paxInfants,
    },
    cabin: selectedFlight.cabin,
    createdAt: createdAtTimestamp,
    createdAtServer: rtdbServerTimestamp(),
  });

  // Create booking record in Realtime Database
  const bookingRef = push(ref(firebaseRtdb, `flightBookings`));
  const bookingId = bookingRef.key!;

  await set(bookingRef, {
    bookingId,
    userId: user.uid,
    flightId: selectedFlight.id,
    airline: selectedFlight.airline,
    flightCode: selectedFlight.code,
    fromCode: selectedFlight.fromCode,
    fromName: selectedFlight.fromName,
    toCode: selectedFlight.toCode,
    toName: selectedFlight.toName,
    departTime: selectedFlight.departTime,
    arriveTime: selectedFlight.arriveTime,
    duration: selectedFlight.duration,
    cabin: selectedFlight.cabin,
    departDate: formData.flightDate,
    adults: paxAdults,
    children: paxChildren,
    infants: paxInfants,
    totalAmount: totalAmount,
    accountId: accountId,
    status: "CONFIRMED",
    transactionId,
    orderId,
    createdAt: createdAtTimestamp,
    createdAtServer: rtdbServerTimestamp(),
  });

  // 2) Ghi đơn vào flightOrdersByUser/{uid}/{orderId} (giữ logic cũ)
  const orderPath = `flightOrdersByUser/${user.uid}/${orderId}`;
  await set(ref(firebaseRtdb, orderPath), {
    orderId,
    orderNo,
    uid: user.uid,

    // snapshot search info
    from: formData.flightFrom ?? null,
    to: formData.flightTo ?? null,
    departDate: formData.flightDate ?? null,
    isRoundTrip: !!(
      formData.flightReturnDate && String(formData.flightReturnDate).trim()
    ),
    returnDate: formData.flightReturnDate ?? null,
    seatClass: formData.flightSeatClass ?? null,

    // pax
    adults: paxAdults,
    children: paxChildren,
    infants: paxInfants,

    // flight
    flight: selectedFlight,

    // payment
    amount: totalAmount,
    currency: "VND",
    status: "PAID",

    // references to Realtime Database
    transactionId,
    bookingId,

    createdAt: createdAtIso,
    createdAtServer: rtdbServerTimestamp(),
  });

  // 3) Lưu recent search: flightRecent/{uid}/{pushId} (giữ logic cũ)
  const recentRef = push(ref(firebaseRtdb, `flightRecent/${user.uid}`));
  await set(recentRef, {
    from: formData.flightFrom ?? null,
    to: formData.flightTo ?? null,
    departDate: formData.flightDate ?? null,
    isRoundTrip: !!(
      formData.flightReturnDate && String(formData.flightReturnDate).trim()
    ),
    returnDate: formData.flightReturnDate ?? null,
    seatClass: formData.flightSeatClass ?? null,
    adults: paxAdults,
    children: paxChildren,
    infants: paxInfants,
    createdAt: createdAtIso,
    createdAtServer: rtdbServerTimestamp(),
  });

  // Push balance-change notification to RTDB (Biến động tab)
  try {
    const notiRef = push(ref(firebaseRtdb, `notifications/${user.uid}`));
    const createdAt = Date.now();
    await set(notiRef, {
      type: "BALANCE_CHANGE",
      direction: "OUT",
      title: "Đặt vé máy bay",
      message: `${selectedFlight.airline} • ${selectedFlight.fromCode} → ${selectedFlight.toCode}`,
      amount: totalAmount,
      accountNumber: accountId,
      balanceAfter,
      transactionId,
      createdAt,
    });
  } catch (err) {
    console.warn("createFlightOrder notification failed (ignored):", err);
  }

  return {
    uid: user.uid,
    orderId,
    orderNo,
    createdAtIso,
    bookingId,
    transactionId,
  };
}
