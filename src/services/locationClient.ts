import {
  fetchCities,
  fetchCountries,
  fetchStates,
  fetchVnCities,
  fetchVnProvinces,
  fetchVnDistricts,
  fetchVnWards,
  type VnLocation,
} from "./locationService";

export type CityOption = { label: string; key: string };

export async function getVnCityOptions(): Promise<CityOption[]> {
  const list: VnLocation[] = await fetchVnCities();
  return list.map((l) => ({
    label: l.name,
    key: l.id || l.name,
  }));
}

export async function getIntlCityOptions(): Promise<CityOption[]> {
  try {
    const countries = await fetchCountries();
    const firstCountry = countries[0] || "Vietnam";
    const states = await fetchStates(firstCountry);
    const firstState = states[0] || "";
    if (!firstCountry || !firstState) return [];
    const cities = await fetchCities(firstCountry, firstState);
    return cities.map((c) => ({ label: `${c}, ${firstCountry}`, key: `INT_${c}` }));
  } catch (err) {
    console.error("getIntlCityOptions error:", err);
    return [];
  }
}

export async function getVnProvinceOptions(): Promise<CityOption[]> {
  const provinces = await fetchVnProvinces();
  return provinces.map((p: any) => ({
    label: p.name || p.name_en || p.codename || p.code,
    key: String(p.code || p.codename || p.name),
  }));
}

export async function getVnDistrictOptions(provinceCode: string): Promise<CityOption[]> {
  const districts = await fetchVnDistricts(provinceCode);
  return districts.map((d: any) => ({
    label: d.name || d.name_en || d.codename || d.code,
    key: String(d.code || d.codename || d.name),
  }));
}

export async function getVnWardOptions(districtCode: string): Promise<CityOption[]> {
  const wards = await fetchVnWards(districtCode);
  return wards.map((w: any) => ({
    label: w.name || w.name_en || w.codename || w.code,
    key: String(w.code || w.codename || w.name),
  }));
}
