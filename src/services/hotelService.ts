import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { fbDb } from "@/lib/firebase";

export type HotelFilter = {
  nearCenter?: boolean;
  starsGte4?: boolean;
  cheapFirst?: boolean;
};

export type HotelSearchParams = {
  cityKey: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  filters?: HotelFilter;
};

export type HotelItem = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  stars: number;
  rating: number;
  priceFrom: number;
  distanceToCenterKm?: number;
  images?: string[];
};

const HOTELS_LIMIT = 50;

export async function searchHotels(
  params: HotelSearchParams
): Promise<HotelItem[]> {
  console.log("[searchHotels] Searching with cityKey:", params.cityKey);

  const hotelsRef = collection(fbDb, "hotels");
  const baseQuery = query(
    hotelsRef,
    where("cityKey", "==", params.cityKey),
    orderBy("priceFrom", params.filters?.cheapFirst ? "asc" : "desc"),
    limit(HOTELS_LIMIT)
  );

  const snap = await getDocs(baseQuery);
  console.log("[searchHotels] Found", snap.size, "hotels");
  const items: HotelItem[] = [];
  snap.forEach((doc) => {
    const d = doc.data() as any;
    items.push({
      id: doc.id,
      name: d.name,
      lat: d.lat,
      lon: d.lon,
      stars: d.stars,
      rating: d.rating,
      priceFrom: d.priceFrom,
      distanceToCenterKm: d.distanceToCenterKm,
      images: d.images,
    });
  });

  return items
    .filter((h) => {
      if (params.filters?.starsGte4 && h.stars < 4) return false;
      return true;
    })
    .sort((a, b) => {
      if (params.filters?.nearCenter) {
        const da = a.distanceToCenterKm ?? Number.MAX_SAFE_INTEGER;
        const db = b.distanceToCenterKm ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
      }
      if (params.filters?.cheapFirst) {
        return a.priceFrom - b.priceFrom;
      }
      return 0;
    });
}
