// src/services/nearbyPois.ts
import { firebaseAuth } from "@/lib/firebase";

export type NearbyPoi = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  tags?: Record<string, string>;
  distanceM?: number;
};

export type NearbyRequest = {
  lat: number;
  lon: number;
  radiusM: number;
  amenity?: string; // e.g., atm, bank, restaurant
  limit?: number;
};

export type NearbyResponse = {
  pois: NearbyPoi[];
  cached: boolean;
  source: "overpass";
};

export async function nearbyPois(req: NearbyRequest): Promise<NearbyResponse> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Bạn cần đăng nhập trước khi tìm địa điểm.");
  }

  const idToken = await user.getIdToken();
  const base =
    import.meta.env.VITE_FUNCTIONS_URL ||
    "https://asia-southeast1-vietbank-final.cloudfunctions.net";

  const resp = await fetch(`${base}/nearbyPois`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "Gọi nearbyPois thất bại");
  }

  return (await resp.json()) as NearbyResponse;
}
