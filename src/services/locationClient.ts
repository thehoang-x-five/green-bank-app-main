import {
  fetchVnCities,
  fetchVnProvinces,
  fetchVnDistricts,
  fetchVnWards,
  type VnLocation,
} from "./locationService";

export type CityOption = { label: string; key: string };

// Popular international destinations with hotels in our database
const INTL_DESTINATIONS: CityOption[] = [
  { label: "Bangkok, Thailand", key: "INT_BANGKOK" },
  { label: "Singapore", key: "INT_SINGAPORE" },
  { label: "Tokyo, Japan", key: "INT_TOKYO" },
  { label: "Seoul, South Korea", key: "INT_SEOUL" },
  { label: "Hong Kong", key: "INT_HONG_KONG" },
  { label: "Kuala Lumpur, Malaysia", key: "INT_KUALA_LUMPUR" },
  { label: "Bali, Indonesia", key: "INT_BALI" },
  { label: "Phuket, Thailand", key: "INT_PHUKET" },
  { label: "Paris, France", key: "INT_PARIS" },
  { label: "London, UK", key: "INT_LONDON" },
];

export async function getVnCityOptions(): Promise<CityOption[]> {
  const list: VnLocation[] = await fetchVnCities();
  return list.map((l) => ({
    label: l.name,
    key: l.id || l.name,
  }));
}

// International: Get popular destinations (no API call needed)
export function getIntlDestinations(): CityOption[] {
  return INTL_DESTINATIONS;
}

export async function getVnProvinceOptions(): Promise<CityOption[]> {
  const provinces = await fetchVnProvinces();
  return provinces.map((p: any) => ({
    label: p.name || p.name_en || p.codename || p.code,
    key: String(p.code || p.codename || p.name),
  }));
}

export async function getVnDistrictOptions(
  provinceCode: string
): Promise<CityOption[]> {
  const districts = await fetchVnDistricts(provinceCode);
  return districts.map((d: any) => ({
    label: d.name || d.name_en || d.codename || d.code,
    key: String(d.code || d.codename || d.name),
  }));
}

export async function getVnWardOptions(
  districtCode: string
): Promise<CityOption[]> {
  const wards = await fetchVnWards(districtCode);
  return wards.map((w: any) => ({
    label: w.name || w.name_en || w.codename || w.code,
    key: String(w.code || w.codename || w.name),
  }));
}
