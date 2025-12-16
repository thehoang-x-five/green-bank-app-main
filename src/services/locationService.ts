import { functionsBaseUrl } from "@/lib/firebase";

type CountriesNowAction = "countries" | "states" | "cities";

type CountriesNowRequest = {
  action: CountriesNowAction;
  country?: string;
  state?: string;
};

const baseUrl =
  (import.meta.env?.DEV &&
    import.meta.env?.VITE_USE_FUNCTIONS_EMULATOR === "true" &&
    "http://127.0.0.1:5002/vietbank-final/asia-southeast1") ||
  functionsBaseUrl;

const headers = {
  "Content-Type": "application/json",
};

async function callCountriesNow<T>(payload: CountriesNowRequest): Promise<T> {
  const res = await fetch(`${baseUrl}/getCountriesNow`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `getCountriesNow failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as T;
}

export async function fetchCountries(): Promise<string[]> {
  const data = await callCountriesNow<{ data?: string[] }>({ action: "countries" });
  return data.data ?? [];
}

export async function fetchStates(country: string): Promise<string[]> {
  const data = await callCountriesNow<{ data?: string[] }>({
    action: "states",
    country,
  });
  return data.data ?? [];
}

export async function fetchCities(
  country: string,
  state: string
): Promise<string[]> {
  const data = await callCountriesNow<{ data?: string[] }>({
    action: "cities",
    country,
    state,
  });
  return data.data ?? [];
}

// ---------- VN locations from Firestore (locations_vn) ----------
export type VnLocation = { id: string; name: string; type?: string };

export async function fetchVnCities(): Promise<VnLocation[]> {
  try {
    const res = await fetch(`${baseUrl}/getVnLocations`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      throw new Error(`getVnLocations failed: ${res.status}`);
    }
    const json = await res.json();
    const list = Array.isArray(json?.data) ? json.data : [];
    return list.map((l: any) => ({
      id: l.id ?? l.code ?? l.name,
      name: l.name ?? "",
      type: l.type,
    }));
  } catch (err) {
    console.error("fetchVnCities error:", err);
    return [];
  }
}

export async function fetchVnProvinces(): Promise<any[]> {
  try {
    const res = await fetch(`${baseUrl}/getVnProvinces`, { method: "GET", headers });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (err) {
    console.error("fetchVnProvinces error:", err);
    return [];
  }
}

export async function fetchVnDistricts(provinceCode: string): Promise<any[]> {
  try {
    const res = await fetch(`${baseUrl}/getVnDistricts?provinceCode=${provinceCode}`, {
      method: "GET",
      headers,
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (err) {
    console.error("fetchVnDistricts error:", err);
    return [];
  }
}

export async function fetchVnWards(districtCode: string): Promise<any[]> {
  try {
    const res = await fetch(`${baseUrl}/getVnWards?districtCode=${districtCode}`, {
      method: "GET",
      headers,
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (err) {
    console.error("fetchVnWards error:", err);
    return [];
  }
}
