import { firebaseRtdb, firebaseAuth } from "@/lib/firebase";
import {
  get,
  ref,
  child,
  set,
  push,
  runTransaction,
  serverTimestamp,
} from "firebase/database";

import type {
  FlightOption,
  UtilityFormData,
} from "@/pages/utilities/utilityTypes";

// ✅ [PATCH - NEW]
// Dùng chung type với UI để đảm bảo shape dữ liệu location
import type { LocationOption } from "@/pages/utilities/utilityTypes";

function getUidForOrder(): string {
  // Demo: nếu có login thì dùng uid, không có thì dùng "guest"
  return firebaseAuth.currentUser?.uid ?? "guest";
}

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
    tsServer: serverTimestamp(),
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
}): Promise<{
  uid: string;
  orderId: string;
  orderNo: number;
  createdAtIso: string;
}> {
  const uid = getUidForOrder();
  const createdAtIso = new Date().toISOString();

  // 1) Tăng counter để tạo mã đơn tăng dần
  const counterRef = ref(firebaseRtdb, "counters/flightOrder");
  const tx = await runTransaction(counterRef, (current) => {
    const cur = typeof current === "number" ? current : 0;
    return cur + 1;
  });

  const orderNo = (tx.snapshot.val() as number) ?? 1;
  const orderId = `FO${String(orderNo).padStart(6, "0")}`;

  const { selectedFlight, formData } = params;

  const paxAdults = parseInt((formData as any).flightAdult || "0", 10) || 0;
  const paxChildren = parseInt((formData as any).flightChild || "0", 10) || 0;
  const paxInfants = parseInt((formData as any).flightInfant || "0", 10) || 0;
  const paxTotal = paxAdults + paxChildren + paxInfants;

  const amount = (selectedFlight.price ?? 0) * Math.max(paxTotal, 1);

  // 2) Ghi đơn vào flightOrdersByUser/{uid}/{orderId}
  const orderPath = `flightOrdersByUser/${uid}/${orderId}`;
  await set(ref(firebaseRtdb, orderPath), {
    orderId,
    orderNo,
    uid,

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
    amount,
    currency: "VND",
    status: "PAID", // demo coi như thanh toán xong

    createdAt: createdAtIso,
    createdAtServer: serverTimestamp(),
    transactionId: orderId,
  });

  // 3) Lưu recent search: flightRecent/{uid}/{pushId}
  const recentRef = push(ref(firebaseRtdb, `flightRecent/${uid}`));
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
    createdAtServer: serverTimestamp(),
  });

  return { uid, orderId, orderNo, createdAtIso };
}
