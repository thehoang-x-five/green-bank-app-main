import { functionsBaseUrl } from "@/lib/firebase";

const baseUrl =
  (import.meta.env?.DEV &&
    import.meta.env?.VITE_USE_FUNCTIONS_EMULATOR === "true" &&
    "http://127.0.0.1:5001/vietbank-final/asia-southeast1") ||
  functionsBaseUrl;

export type ReverseGeocodeResult = {
  city?: string;
  state?: string;
  country?: string;
  displayName?: string;
};

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult> {
  const res = await fetch(`${baseUrl}/reverseGeocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `reverseGeocode failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as ReverseGeocodeResult;
}
