import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useMemo,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";

import {
  fetchFlightInventory,
  searchFlightsFromInventoryWithAvailability,
  fetchFlightLocations,
  fetchRecentLocations,
  upsertRecentLocation,
} from "../../services/flightBookingService";

import { toast } from "sonner";

import type {
  FlightOption,
  LocationOption,
  SeatClass,
  FlightStep,
  UtilityFormData,
} from "./utilityTypes";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;
  onConfirm: (flight: FlightOption) => void; // wrapper sẽ build receipt + navigate
};

const mockFlights: FlightOption[] = [
  {
    id: "VN270-ECO",
    airline: "Vietnam Airlines",
    code: "270",
    fromCode: "SGN",
    fromName: "Sân bay quốc tế Tân Sơn Nhất",
    toCode: "HAN",
    toName: "Sân bay quốc tế Nội Bài",
    departTime: "23:05",
    arriveTime: "01:10",
    duration: "2 giờ 5 phút",
    cabin: "Economy Flex",
    price: 3841000,
  },
  {
    id: "VN270-BUS",
    airline: "Vietnam Airlines",
    code: "270",
    fromCode: "SGN",
    fromName: "Sân bay quốc tế Tân Sơn Nhất",
    toCode: "HAN",
    toName: "Sân bay quốc tế Nội Bài",
    departTime: "23:05",
    arriveTime: "01:10",
    duration: "2 giờ 5 phút",
    cabin: "Business Classic",
    price: 5960000,
  },
];

const CITY_AIRPORT_API =
  "https://script.google.com/macros/s/AKfycbzcTGVj1FzBZ_IhgpRE_zHnqHk4v0vmaFidmwA7OqANAQZUts8z1p77Y3h0IYi5amOpuQ/exec";

type ApiCityAirportItem = {
  code?: string;
  city?: string;
  airport?: string;
  region?: string;
  name?: string;
};

async function fetchLocationsFromApi(): Promise<LocationOption[]> {
  const res = await fetch(CITY_AIRPORT_API);
  if (!res.ok) throw new Error("Không tải được danh sách sân bay (API).");

  const data = (await res.json()) as unknown;

  const arr: ApiCityAirportItem[] = Array.isArray(data)
    ? (data as ApiCityAirportItem[])
    : Array.isArray((data as any)?.data)
    ? ((data as any).data as ApiCityAirportItem[])
    : [];

  const mapped: LocationOption[] = arr
    .map((x) => {
      const code = (x.code ?? "").trim();
      const city = (x.city ?? x.name ?? "").trim();
      const airport = (x.airport ?? "").trim();
      const region = (x.region ?? "Việt Nam").trim();

      if (!code || !city) return null;
      return { code, city, airport: airport || city, region };
    })
    .filter(Boolean) as LocationOption[];

  // fallback nếu API trả rỗng
  return mapped.length ? mapped : ALL_LOCATIONS;
}

const LOCATION_SECTIONS: string[] = [
  "Miền Bắc",
  "Miền Trung",
  "Miền Nam",
  "Đông Nam Á",
  "Đông Bắc Á",
  "Châu Âu",
  "Châu Mỹ",
  "Châu Úc",
  "Châu Phi",
];

const ALL_LOCATIONS: LocationOption[] = [
  {
    code: "HAN",
    city: "Hà Nội",
    airport: "Sân bay Nội Bài",
    region: "Miền Bắc",
  },
  {
    code: "HPH",
    city: "Hải Phòng",
    airport: "Sân bay Cát Bi",
    region: "Miền Bắc",
  },
  {
    code: "VDO",
    city: "Quảng Ninh",
    airport: "Sân bay Quốc tế Vân Đồn",
    region: "Miền Bắc",
  },
  {
    code: "DIN",
    city: "Điện Biên",
    airport: "Sân bay Điện Biên Phủ",
    region: "Miền Bắc",
  },

  {
    code: "DAD",
    city: "Đà Nẵng",
    airport: "Sân bay Quốc tế Đà Nẵng",
    region: "Miền Trung",
  },
  {
    code: "CXR",
    city: "Nha Trang",
    airport: "Sân bay Quốc tế Cam Ranh",
    region: "Miền Trung",
  },

  {
    code: "SGN",
    city: "Hồ Chí Minh",
    airport: "Sân bay Tân Sơn Nhất",
    region: "Miền Nam",
  },
  {
    code: "PQC",
    city: "Phú Quốc",
    airport: "Sân bay Phú Quốc",
    region: "Miền Nam",
  },
  {
    code: "VCA",
    city: "Cần Thơ",
    airport: "Sân bay Quốc tế Cần Thơ",
    region: "Miền Nam",
  },
  {
    code: "VCS",
    city: "Côn Đảo",
    airport: "Sân bay Côn Đảo",
    region: "Miền Nam",
  },
  {
    code: "VKG",
    city: "Rạch Giá",
    airport: "Sân bay Rạch Giá",
    region: "Miền Nam",
  },

  {
    code: "BKK",
    city: "Bangkok",
    airport: "Sân bay Quốc tế Suvarnabhumi",
    region: "Đông Nam Á",
  },
  {
    code: "SIN",
    city: "Singapore",
    airport: "Sân bay Changi",
    region: "Đông Nam Á",
  },

  {
    code: "ICN",
    city: "Seoul",
    airport: "Sân bay Quốc tế Incheon",
    region: "Đông Bắc Á",
  },
  {
    code: "NRT",
    city: "Tokyo",
    airport: "Sân bay Narita",
    region: "Đông Bắc Á",
  },

  {
    code: "CDG",
    city: "Paris",
    airport: "Sân bay Charles de Gaulle",
    region: "Châu Âu",
  },
  {
    code: "LHR",
    city: "London",
    airport: "Sân bay Heathrow",
    region: "Châu Âu",
  },

  {
    code: "LAX",
    city: "Los Angeles",
    airport: "Los Angeles International Airport",
    region: "Châu Mỹ",
  },
  {
    code: "JFK",
    city: "New York",
    airport: "John F. Kennedy International Airport",
    region: "Châu Mỹ",
  },

  {
    code: "SYD",
    city: "Sydney",
    airport: "Sydney Kingsford Smith Airport",
    region: "Châu Úc",
  },
  {
    code: "CAI",
    city: "Cairo",
    airport: "Cairo International Airport",
    region: "Châu Phi",
  },
];

type PassengerField = "adult" | "child" | "infant";

type FlightUiHandle = {
  goBack: () => boolean; // true = đã xử lý back trong Flight UI
};

const UtilityFlight = forwardRef<FlightUiHandle, Props>(function UtilityFlight(
  { formData, setFormData, onConfirm }: Props,
  ref
) {
  const [flightStep, setFlightStep] = useState<FlightStep>(1);
  const [flightList, setFlightList] = useState<FlightOption[]>(mockFlights);
  const [selectedFlight, setSelectedFlight] = useState<FlightOption | null>(
    null
  );
  const [flightTab, setFlightTab] = useState<"info" | "rules">("info");

  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const [isRoundTrip, setIsRoundTrip] = useState(false);

  const [showFromLocationSheet, setShowFromLocationSheet] = useState(false);
  const [showToLocationSheet, setShowToLocationSheet] = useState(false);
  const [showSeatClassSheet, setShowSeatClassSheet] = useState(false);
  const [showPassengerSheet, setShowPassengerSheet] = useState(false);

  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [recentFrom, setRecentFrom] = useState<LocationOption[]>([]);
  const [recentTo, setRecentTo] = useState<LocationOption[]>([]);

  const [tempSeatClass, setTempSeatClass] = useState<SeatClass>("all");

  const [locations, setLocations] = useState<LocationOption[]>(ALL_LOCATIONS);
  const [inventory, setInventory] = useState<FlightOption[]>(mockFlights);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // ✅ [PATCH-VALIDATION-STATE]
  // Lỗi validate UI cho Step 1 (không dùng toast cho lỗi thiếu/invalid input)
  const [fieldErrors, setFieldErrors] = useState<{
    from?: string;
    to?: string;
    date?: string;
    returnDate?: string;
    passengers?: string;
  }>({});

  type SortMode = "priceAsc" | "priceDesc" | "early" | "late" | null;
  const [sortMode, setSortMode] = useState<SortMode>(null);

  type StopFilter = "direct" | "1stop" | "2plus" | null;
  type DepartBucket = "00_06" | "06_12" | "12_18" | "18_24" | null;

  type AppliedFilters = {
    stop: StopFilter;
    departBucket: DepartBucket;
    airlines: string[]; // multi select
  };

  const DEFAULT_FILTERS: AppliedFilters = {
    stop: null,
    departBucket: null,
    airlines: [],
  };

  const [appliedFilters, setAppliedFilters] =
    useState<AppliedFilters>(DEFAULT_FILTERS);
  const [tempFilters, setTempFilters] =
    useState<AppliedFilters>(DEFAULT_FILTERS);

  // ✅ Khi mở popup Bộ lọc -> sync temp = applied (để “giữ lựa chọn” đúng UX)
  useEffect(() => {
    if (!showFilterSheet) return;
    setTempFilters(appliedFilters);
  }, [showFilterSheet, appliedFilters]);

  // yyyy-mm-dd theo LOCAL time (tránh lệch ngày do timezone)
  const getTodayKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayKey = getTodayKey();

  const extractCode = (v: string) => {
    const s = (v || "").trim();
    const idx = s.lastIndexOf("-");
    if (idx === -1) return s.toUpperCase();
    return s
      .slice(idx + 1)
      .trim()
      .toUpperCase();
  };

  const validateSearch = () => {
    const errs: {
      from?: string;
      to?: string;
      date?: string;
      returnDate?: string;
      passengers?: string;
    } = {};

    const from = String(formData.flightFrom || "").trim();
    const to = String(formData.flightTo || "").trim();
    const departDate = String(formData.flightDate || "").trim();
    const returnDate = String(formData.flightReturnDate || "").trim();

    const paxAdult = parseInt(formData.flightAdult || "0", 10) || 0;
    const paxChild = parseInt(formData.flightChild || "0", 10) || 0;
    const paxInfant = parseInt(formData.flightInfant || "0", 10) || 0;

    // 1) Required fields
    if (!from) errs.from = "Hãy điền đầy đủ thông tin";
    if (!to) errs.to = "Hãy điền đầy đủ thông tin";
    if (!departDate) errs.date = "Hãy điền đầy đủ thông tin";

    // 2) From != To (so sánh theo code)
    if (from && to) {
      const fromCode = extractCode(from);
      const toCode = extractCode(to);
      if (fromCode && toCode && fromCode === toCode) {
        // Tô đỏ cả 2 ô để người dùng thấy ngay
        errs.from = "Điểm đi và điểm đến phải khác nhau";
        errs.to = "Điểm đi và điểm đến phải khác nhau";
      }
    }

    // 3) Ngày đi >= hôm nay
    if (departDate && departDate < todayKey) {
      errs.date = "Ngày đi không được là ngày trong quá khứ";
    }

    // 4) Khứ hồi: ngày về không được quá khứ và không nhỏ hơn ngày đi
    if (isRoundTrip) {
      if (!returnDate) {
        errs.returnDate = "Hãy điền đầy đủ thông tin";
      } else {
        if (returnDate < todayKey) {
          errs.returnDate = "Ngày về không được là ngày trong quá khứ";
        }
        if (departDate && returnDate < departDate) {
          errs.returnDate = "Ngày về không được nhỏ hơn ngày đi";
        }
      }
    }

    // 5) Hành khách: tối thiểu 1 người lớn, không được chỉ trẻ em/em bé
    if (paxAdult < 1) {
      errs.passengers =
        "Tối thiểu 1 người lớn (không được chỉ chọn trẻ em/em bé)";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ✅ [PATCH-FLIGHT-UI-BACK]
  // Expose API cho header back ở UtilityBills:
  // - Step 3 -> Step 2
  // - Step 2 -> Step 1
  // - Step 1 -> return false (để UtilityBills back theo luồng cũ)
  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (flightStep === 3) {
        setFlightStep(2);

        // ✅ FIX: Khi quay về danh sách thì nút "Chi tiết vé" phải trở lại màu xanh
        setActiveDetailId(null);

        // optional: reset tab để lần sau vào chi tiết luôn về "info"
        setFlightTab("info");

        return true;
      }

      if (flightStep === 2) {
        setFlightStep(1);
        setSelectedFlight(null);
        setFlightTab("info");
        setShowSortSheet(false);
        setShowFilterSheet(false);
        setActiveDetailId(null);

        setSortMode(null);
        setAppliedFilters(DEFAULT_FILTERS);
        setTempFilters(DEFAULT_FILTERS);
        return true;
      }

      return false;
    },
  }));

  useEffect(() => {
    // ✅ [PATCH - NEW]
    // Load locations ưu tiên từ RTDB: flightLocations/{CODE}.
    // Nếu RTDB chưa có seed thì fallback qua API / ALL_LOCATIONS như cũ.
    (async () => {
      try {
        const rtdbList = await fetchFlightLocations();
        if (rtdbList.length) {
          setLocations(rtdbList);
          return;
        }
      } catch (e) {
        // ignore -> fallback dưới
      }

      try {
        const apiList = await fetchLocationsFromApi();
        setLocations(apiList);
      } catch (e) {
        // nếu lỗi thì vẫn dùng ALL_LOCATIONS (demo)
      }
    })();

    // ✅ [PATCH - NEW]
    // Load recent locations từ RTDB: flightRecent/{uid}/locations/{from|to}/{CODE}
    (async () => {
      try {
        const [rf, rt] = await Promise.all([
          fetchRecentLocations({ mode: "from", limit: 5 }),
          fetchRecentLocations({ mode: "to", limit: 5 }),
        ]);
        setRecentFrom(rf);
        setRecentTo(rt);
      } catch (e) {
        // nếu chưa login / chưa có dữ liệu thì để trống (UI đã handle)
      }
    })();
  }, []);

  // ✅ [PATCH 1] Người lớn mặc định = 0 (trước là 1)
  const [tempPassengers, setTempPassengers] = useState({
    adult: 0,
    child: 0,
    infant: 0,
  });

  // ✅ [PATCH 2] Track nút "Chi tiết vé" đang active để đổi màu
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);

  const filteredLocationsFrom = useMemo(() => {
    const keyword = fromSearch.trim().toLowerCase();
    return locations.filter((loc) => {
      if (!keyword) return true;
      return `${loc.city} ${loc.airport} ${loc.code}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [fromSearch, locations]);

  const filteredLocationsTo = useMemo(() => {
    const keyword = toSearch.trim().toLowerCase();
    return locations.filter((loc) => {
      if (!keyword) return true;
      return `${loc.city} ${loc.airport} ${loc.code}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [toSearch, locations]);

  const handleSearchFlights = async () => {
    // ✅ [PATCH-SEARCH-VALIDATION]
    // Validate UI theo yêu cầu: tô đỏ + text đỏ dưới ô (không toast cho lỗi nhập liệu)
    const ok = validateSearch();
    if (!ok) return;

    try {
      setLoadingInventory(true);
      // ✅ [PATCH - NOTE]
      // Không cần load toàn bộ inventory ở đây nữa vì searchFlightsFromInventoryWithAvailability
      // đã tự đọc RTDB và match theo availability theo ngày.

      const fromCode = extractCode(formData.flightFrom);
      const toCode = extractCode(formData.flightTo);

      const seatClass = formData.flightSeatClass; // "all" | "eco" | "business"

      // ✅ [PATCH - NEW]
      // Match theo "lịch bay" (availability theo ngày) + check số ghế theo ngày.
      const paxAdult = parseInt(formData.flightAdult || "0", 10) || 0;
      const paxChild = parseInt(formData.flightChild || "0", 10) || 0;
      const paxInfant = parseInt(formData.flightInfant || "0", 10) || 0;
      const paxTotal = paxAdult + paxChild + paxInfant;

      const list = await searchFlightsFromInventoryWithAvailability({
        fromCode,
        toCode,
        seatClass: (seatClass as any) ?? "all",
        departDateKey: formData.flightDate,
        paxTotal: paxTotal,
      });

      if (!list.length) {
        toast("Không tìm thấy chuyến bay phù hợp");
      }

      // giữ nguyên logic: set list + sang step 2 (màn danh sách vé)
      setFlightList(list);
      setFlightStep(2);

      // reset active detail khi sang danh sách mới
      setActiveDetailId(null);

      setSortMode(null);
      setAppliedFilters(DEFAULT_FILTERS);
      setTempFilters(DEFAULT_FILTERS);
    } catch (e) {
      toast.error("Không tải được danh sách chuyến bay từ hệ thống (RTDB).");
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleSortFlights = (
    mode: "priceAsc" | "priceDesc" | "early" | "late"
  ) => {
    setSortMode(mode);
    setShowSortSheet(false);
  };

  const handleChooseFlight = (flight: FlightOption) => {
    setSelectedFlight(flight);
    setFlightTab("info");
    setFlightStep(3);
  };

  const updatePassengerCount = (field: PassengerField, diff: number) => {
    setTempPassengers((prev) => {
      const current = prev[field];

      // ✅ [PATCH 1] min của adult = 0 (trước là 1)
      const min = 0;

      let next = current + diff;
      if (next < min) next = min;
      if (next > 9) next = 9;
      return { ...prev, [field]: next };
    });
  };

  const handleSelectLocation = (mode: "from" | "to", loc: LocationOption) => {
    const value = `${loc.city.toUpperCase()} - ${loc.code}`;
    if (mode === "from") {
      setFormData((prev) => ({ ...prev, flightFrom: value }));
      setFieldErrors((prev) => ({ ...prev, from: undefined }));
      setShowFromLocationSheet(false);
      setFromSearch("");
      setRecentFrom((prev) =>
        [loc, ...prev.filter((x) => x.code !== loc.code)].slice(0, 5)
      );
      void upsertRecentLocation({ mode: "from", location: loc });
    } else {
      setFormData((prev) => ({ ...prev, flightTo: value }));
      setFieldErrors((prev) => ({ ...prev, to: undefined }));
      setShowToLocationSheet(false);
      setToSearch("");
      setRecentTo((prev) =>
        [loc, ...prev.filter((x) => x.code !== loc.code)].slice(0, 5)
      );
      void upsertRecentLocation({ mode: "to", location: loc });
    }
  };

  const openSeatClassSheet = () => {
    const cur = formData.flightSeatClass;
    setTempSeatClass(
      cur === "eco" || cur === "business" || cur === "all" ? cur : "all"
    );
    setShowSeatClassSheet(true);
  };

  const renderLocationSheet = (mode: "from" | "to") => {
    const isFrom = mode === "from";
    const show = isFrom ? showFromLocationSheet : showToLocationSheet;
    if (!show) return null;

    const title = isFrom ? "Địa điểm khởi hành" : "Địa điểm đến";
    const placeholder = isFrom ? "Nhập điểm khởi hành" : "Nhập điểm đến";
    const keyword = isFrom ? fromSearch : toSearch;
    const setKeyword = isFrom ? setFromSearch : setToSearch;
    const recentList = isFrom ? recentFrom : recentTo;
    const filtered = isFrom ? filteredLocationsFrom : filteredLocationsTo;

    const close = () => {
      if (isFrom) {
        setShowFromLocationSheet(false);
        setFromSearch("");
      } else {
        setShowToLocationSheet(false);
        setToSearch("");
      }
    };

    return (
      <div className="fixed top-0 left-0 w-screen h-screen z-[999] bg-black/40 flex items-end">
        <div className="bg-background w-full rounded-t-2xl p-4 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-base font-semibold">{title}</p>
            <button
              type="button"
              className="text-xs text-muted-foreground"
              onClick={close}
            >
              Đóng
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="mb-3">
              <Input
                placeholder={placeholder}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <div className="mb-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Tìm kiếm gần đây
              </p>
              {recentList.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Chưa có tìm kiếm gần đây
                </p>
              ) : (
                <div className="space-y-1">
                  {recentList.map((loc) => (
                    <button
                      key={`recent-${mode}-${loc.code}`}
                      type="button"
                      className="w-full text-left py-1.5 px-1 rounded-lg hover:bg-muted/70"
                      onClick={() => handleSelectLocation(mode, loc)}
                    >
                      <p className="text-sm font-medium">
                        {loc.city.toUpperCase()} - {loc.code}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {loc.airport}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {LOCATION_SECTIONS.map((section) => {
              const items = filtered.filter((loc) => loc.region === section);
              if (!items.length) return null;
              return (
                <div key={section} className="mt-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    {section}
                  </p>
                  <div className="space-y-1">
                    {items.map((loc) => (
                      <button
                        key={`${mode}-${loc.code}`}
                        type="button"
                        className="w-full text-left py-2 px-1 rounded-lg hover:bg-muted/70 flex items-center justify-between"
                        onClick={() => handleSelectLocation(mode, loc)}
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {loc.city.toUpperCase()} - {loc.code}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {loc.airport}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderPassengerSheet = () => {
    if (!showPassengerSheet) return null;
    const { adult, child, infant } = tempPassengers;

    return (
      <div className="fixed top-0 left-0 w-screen h-screen z-[999] bg-black/40 flex items-end">
        <div className="bg-background w-full rounded-t-2xl p-4 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Chọn hành khách</p>
            <button
              type="button"
              className="text-xs text-muted-foreground"
              onClick={() => setShowPassengerSheet(false)}
            >
              Đóng
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Người lớn</p>
                <p className="text-[11px] text-muted-foreground">
                  Từ 12 tuổi trở lên
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-lg"
                  onClick={() => updatePassengerCount("adult", -1)}
                >
                  –
                </button>
                <span className="w-6 text-center text-sm font-semibold">
                  {adult}
                </span>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-lg"
                  onClick={() => updatePassengerCount("adult", 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Trẻ em</p>
                <p className="text-[11px] text-muted-foreground">
                  Từ 02 đến 11 tuổi
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-lg"
                  onClick={() => updatePassengerCount("child", -1)}
                >
                  –
                </button>
                <span className="w-6 text-center text-sm font-semibold">
                  {child}
                </span>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-lg"
                  onClick={() => updatePassengerCount("child", 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Em bé</p>
                <p className="text-[11px] text-muted-foreground">
                  Từ 14 ngày tuổi đến 2 tuổi
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-lg"
                  onClick={() => updatePassengerCount("infant", -1)}
                >
                  –
                </button>
                <span className="w-6 text-center text-sm font-semibold">
                  {infant}
                </span>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-lg"
                  onClick={() => updatePassengerCount("infant", 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <Button
            type="button"
            className="w-full mt-3"
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                flightAdult: String(tempPassengers.adult),
                flightChild: String(tempPassengers.child),
                flightInfant: String(tempPassengers.infant),
              }));
              setFieldErrors((prev) => ({ ...prev, passengers: undefined }));
              setShowPassengerSheet(false);
            }}
          >
            Áp dụng
          </Button>
        </div>
      </div>
    );
  };

  const renderSeatClassSheet = () => {
    if (!showSeatClassSheet) return null;

    const renderRow = (value: SeatClass, title: string, note: string) => {
      const active = tempSeatClass === value;
      return (
        <button
          type="button"
          className="w-full text-left py-2 px-1 rounded-lg hover:bg-muted/70 flex items-center justify-between"
          onClick={() => setTempSeatClass(value)}
        >
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-[11px] text-muted-foreground">{note}</p>
          </div>
          <div
            className={`w-5 h-5 rounded-md border flex items-center justify-center ${
              active ? "border-green-600 bg-green-500" : "border-muted"
            }`}
          >
            {active && <span className="text-[11px] text-white">✓</span>}
          </div>
        </button>
      );
    };

    return (
      <div className="fixed top-0 left-0 w-screen h-screen z-[999] bg-black/40 flex items-end">
        <div className="bg-background w-full rounded-t-2xl p-4 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Chọn hạng ghế</p>
            <button
              type="button"
              className="text-xs text-muted-foreground"
              onClick={() => setShowSeatClassSheet(false)}
            >
              Đóng
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {renderRow("all", "Tất cả hạng ghế", "Tất cả hạng ghế")}
            {renderRow(
              "eco",
              "Phổ thông tiết kiệm",
              "Bay tiết kiệm, đáp ứng mọi yêu cầu cơ bản"
            )}
            {renderRow(
              "business",
              "Thương gia",
              "Bay đẳng cấp, với quầy thủ tục và khu ghế riêng"
            )}
          </div>

          <Button
            type="button"
            className="w-full mt-3"
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                flightSeatClass: tempSeatClass,
              }));
              setShowSeatClassSheet(false);
            }}
          >
            Áp dụng
          </Button>
        </div>
      </div>
    );
  };

  const renderFlightStep1 = () => {
    // ✅ [PATCH 1] Người lớn mặc định = 0 (trước là 1)
    const adult = parseInt(formData.flightAdult || "0", 10) || 0;
    const child = parseInt(formData.flightChild || "0", 10) || 0;
    const infant = parseInt(formData.flightInfant || "0", 10) || 0;

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <div className="space-y-2">
            <Label>
              Điểm đi <span className="text-destructive">*</span>
            </Label>
            <button
              type="button"
              onClick={() => setShowFromLocationSheet(true)}
              className={`w-full rounded-lg border ${
                fieldErrors.from ? "border-destructive" : "border-input"
              } bg-background px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 hover:bg-muted/60`}
            >
              {formData.flightFrom ? (
                <>
                  <span className="font-medium text-foreground">
                    {formData.flightFrom}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Chọn từ danh sách sân bay
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Chọn điểm đi (VD: TP. Hồ Chí Minh - SGN)
                </span>
              )}
            </button>
            {fieldErrors.from && (
              <p className="text-[11px] text-destructive mt-1">
                {fieldErrors.from}
              </p>
            )}
          </div>

          <div className="hidden md:flex items-center justify-center mt-6 text-primary">
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  flightFrom: prev.flightTo,
                  flightTo: prev.flightFrom,
                }))
              }
              className="w-10 h-10 rounded-full border border-primary flex items-center justify-center text-sm font-semibold bg-background"
            >
              ↔
            </button>
          </div>

          <div className="space-y-2">
            <Label>
              Điểm đến <span className="text-destructive">*</span>
            </Label>
            <button
              type="button"
              onClick={() => setShowToLocationSheet(true)}
              className={`w-full rounded-lg border ${
                fieldErrors.to ? "border-destructive" : "border-input"
              } bg-background px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 hover:bg-muted/60`}
            >
              {formData.flightTo ? (
                <>
                  <span className="font-medium text-foreground">
                    {formData.flightTo}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Chọn từ danh sách sân bay
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Chọn điểm đến (VD: Hà Nội - HAN)
                </span>
              )}
            </button>
            {fieldErrors.to && (
              <p className="text-[11px] text-destructive mt-1">
                {fieldErrors.to}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_1.3fr] gap-4 items-end">
          <div className="space-y-2">
            <Label>
              Ngày đi <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              min={todayKey}
              value={formData.flightDate}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  flightDate: e.target.value,
                }));
                setFieldErrors((prev) => ({ ...prev, date: undefined }));
              }}
              className={fieldErrors.date ? "border-destructive" : undefined}
            />
            {fieldErrors.date && (
              <p className="text-[11px] text-destructive mt-1">
                {fieldErrors.date}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="invisible">_</Label>
            <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2.5">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={isRoundTrip}
                onChange={(e) => setIsRoundTrip(e.target.checked)}
              />
              <span className="text-sm text-foreground font-medium">
                Khứ hồi
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                (Hiển thị Ngày về)
              </span>
            </div>
          </div>
        </div>

        {isRoundTrip && (
          <div className="space-y-2">
            <Label>
              Ngày về <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              min={formData.flightDate ? formData.flightDate : todayKey}
              value={formData.flightReturnDate}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  flightReturnDate: e.target.value,
                }));
                setFieldErrors((prev) => ({ ...prev, returnDate: undefined }));
              }}
              className={
                fieldErrors.returnDate ? "border-destructive" : undefined
              }
            />
            {fieldErrors.returnDate && (
              <p className="text-[11px] text-destructive mt-1">
                {fieldErrors.returnDate}
              </p>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Hạng ghế</Label>
            <button
              type="button"
              onClick={openSeatClassSheet}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 hover:bg-muted/60"
            >
              <span className="font-medium text-foreground">
                {formData.flightSeatClass === "all"
                  ? "Tất cả hạng ghế"
                  : formData.flightSeatClass === "eco"
                  ? "Phổ thông tiết kiệm"
                  : "Thương gia"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Chọn hạng ghế phù hợp
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <Label>Hành khách</Label>
            <button
              type="button"
              onClick={() => {
                // ✅ [PATCH 1] curAdult mặc định = 0
                const curAdult = parseInt(formData.flightAdult || "0", 10) || 0;
                const curChild = parseInt(formData.flightChild || "0", 10) || 0;
                const curInfant =
                  parseInt(formData.flightInfant || "0", 10) || 0;

                setTempPassengers({
                  adult: curAdult,
                  child: curChild,
                  infant: curInfant,
                });
                setShowPassengerSheet(true);
              }}
              className={`w-full rounded-lg border ${
                fieldErrors.passengers ? "border-destructive" : "border-input"
              } bg-background px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 hover:bg-muted/60`}
            >
              <span className="font-medium text-foreground">
                {adult} người lớn, {child} trẻ em, {infant} em bé
              </span>
              <span className="text-[11px] text-muted-foreground">
                Điều chỉnh số lượng theo từng loại
              </span>
            </button>
            {fieldErrors.passengers && (
              <p className="text-[11px] text-destructive mt-1">
                {fieldErrors.passengers}
              </p>
            )}
          </div>
        </div>

        <Button
          type="button"
          className="w-full mt-2"
          onClick={handleSearchFlights}
          disabled={loadingInventory}
        >
          {loadingInventory ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Đang tìm...
            </span>
          ) : (
            "Tìm chuyến bay"
          )}
        </Button>

        <p className="text-xs text-muted-foreground mt-3">
          Khách hàng có thẻ hạng cao có thể liên hệ tổng đài{" "}
          <span className="text-primary font-semibold">1900 23 23 55</span> để
          hỗ trợ đặt vé.
        </p>

        {renderLocationSheet("from")}
        {renderLocationSheet("to")}
        {renderSeatClassSheet()}
        {renderPassengerSheet()}
      </>
    );
  };

  // ✅ [PATCH-FLIGHT-SORT-FILTER-HELPERS] — helper lọc/sort danh sách
  const toMinutes = (hhmm: string) => {
    const s = (hhmm || "").trim();
    const [hhRaw, mmRaw] = s.split(":");
    const hh = parseInt(hhRaw || "0", 10) || 0;
    const mm = parseInt(mmRaw || "0", 10) || 0;
    return hh * 60 + mm;
  };

  const matchDepartBucket = (t: string, bucket: DepartBucket) => {
    if (!bucket) return true;
    const m = toMinutes(t);
    if (bucket === "00_06") return m >= 0 && m < 360;
    if (bucket === "06_12") return m >= 360 && m < 720;
    if (bucket === "12_18") return m >= 720 && m < 1080;
    return m >= 1080 && m < 1440; // 18_24
  };

  const getStops = (f: FlightOption) => {
    // dữ liệu demo hiện chưa có stops, nên mặc định 0 (bay thẳng)
    const anyStops = (f as any)?.stops;
    const n = typeof anyStops === "number" ? anyStops : 0;
    return n;
  };

  const matchStopFilter = (f: FlightOption, stop: StopFilter) => {
    if (!stop) return true;
    const n = getStops(f);
    if (stop === "direct") return n === 0;
    if (stop === "1stop") return n === 1;
    return n >= 2;
  };

  const visibleFlights = useMemo(() => {
    // 1) filter
    let arr = [...flightList];

    arr = arr.filter((f) => matchStopFilter(f, appliedFilters.stop));
    arr = arr.filter((f) =>
      matchDepartBucket(f.departTime, appliedFilters.departBucket)
    );

    if (appliedFilters.airlines.length > 0) {
      arr = arr.filter((f) => appliedFilters.airlines.includes(f.airline));
    }

    // 2) sort
    if (sortMode === "priceAsc") arr.sort((a, b) => a.price - b.price);
    if (sortMode === "priceDesc") arr.sort((a, b) => b.price - a.price);
    if (sortMode === "early")
      arr.sort((a, b) => (a.departTime > b.departTime ? 1 : -1));
    if (sortMode === "late")
      arr.sort((a, b) => (a.departTime < b.departTime ? 1 : -1));

    return arr;
  }, [flightList, appliedFilters, sortMode]);

  // ✅ [PATCH-FLIGHT-SORT-FILTER-AIRLINES] — danh sách hãng từ list hiện có
  const airlineOptions = useMemo(() => {
    const set = new Set<string>();
    flightList.forEach((f) => set.add(f.airline));
    return Array.from(set);
  }, [flightList]);

  const toggleAirlineTemp = (name: string) => {
    setTempFilters((prev) => {
      const exists = prev.airlines.includes(name);
      const next = exists
        ? prev.airlines.filter((x) => x !== name)
        : [...prev.airlines, name];
      return { ...prev, airlines: next };
    });
  };

  const isAirlineSelectedTemp = (name: string) =>
    tempFilters.airlines.includes(name);

  const filterBtnActive =
    "bg-primary text-primary-foreground border-primary hover:bg-primary/90";
  const filterBtnIdle =
    "hover:bg-primary hover:text-primary-foreground hover:border-primary";

  const renderFlightStep2 = () => (
    <>
      <p className="text-sm text-muted-foreground mb-2">
        Chọn vé chiều đi phù hợp. Giá đã bao gồm thuế & phí
      </p>

      <div className="space-y-3">
        {visibleFlights.map((f) => {
          const isActiveDetail = activeDetailId === f.id;

          return (
            <Card
              key={f.id}
              className="p-4 cursor-pointer hover:bg-muted/60"
              onClick={() => handleChooseFlight(f)}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{f.airline}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.code} • {f.cabin}
                  </p>

                  <div className="mt-2 flex gap-6 text-xs">
                    <div>
                      <p className="text-base font-semibold">{f.departTime}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.fromCode}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {f.fromName}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        {f.duration}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Bay thẳng
                      </p>
                    </div>
                    <div>
                      <p className="text-base font-semibold">{f.arriveTime}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.toCode}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {f.toName}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <p className="text-red-500 font-bold">
                    {f.price.toLocaleString("vi-VN")} VND
                  </p>

                  {/* ✅ [PATCH 2] Nút "Chi tiết vé" màu xanh (primary) + active chuyển xám trắng */}
                  <Button
                    type="button"
                    size="sm"
                    className={
                      isActiveDetail
                        ? "bg-muted text-foreground border border-muted hover:bg-muted/80"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }
                    onClick={(e) => {
                      e.stopPropagation();

                      // khi bấm "Chi tiết vé" -> set active để đổi màu
                      setActiveDetailId(f.id);

                      // vẫn mở chi tiết vé như logic cũ
                      handleChooseFlight(f);
                    }}
                  >
                    Chi tiết vé
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="fixed left-0 right-0 bottom-4 px-6 z-40">
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowSortSheet(true)}
          >
            Sắp xếp
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilterSheet(true)}
          >
            Bộ lọc
          </Button>
        </div>
      </div>

      {showSortSheet && (
        <div className="fixed top-0 left-0 w-screen h-screen z-[999] bg-black/40 flex items-end">
          <div className="bg-background w-full rounded-t-2xl p-4 space-y-2">
            <p className="text-sm font-semibold mb-2">Sắp xếp theo</p>
            <button
              type="button"
              className="w-full text-left py-2 text-sm rounded-lg hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleSortFlights("priceAsc")}
            >
              Giá thấp nhất
            </button>
            <button
              type="button"
              className="w-full text-left py-2 text-sm rounded-lg hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleSortFlights("priceDesc")}
            >
              Giá cao nhất
            </button>
            <button
              type="button"
              className="w-full text-left py-2 text-sm rounded-lg hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleSortFlights("early")}
            >
              Giờ bay sớm nhất
            </button>
            <button
              type="button"
              className="w-full text-left py-2 text-sm rounded-lg hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleSortFlights("late")}
            >
              Giờ bay muộn nhất
            </button>

            <Button
              type="button"
              className="w-full mt-2"
              onClick={() => setShowSortSheet(false)}
            >
              Đóng
            </Button>
          </div>
        </div>
      )}

      {showFilterSheet && (
        <div className="fixed top-0 left-0 w-screen h-screen z-[999] bg-black/40 flex items-end">
          <div className="bg-background w-full rounded-t-2xl p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Bộ lọc</p>
              <button
                type="button"
                className="text-xs text-primary"
                onClick={() => {
                  setTempFilters(DEFAULT_FILTERS);
                }}
              >
                Đặt lại
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Quá cảnh
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Button
                  type="button"
                  variant="outline"
                  className={
                    tempFilters.stop === "direct"
                      ? filterBtnActive
                      : filterBtnIdle
                  }
                  onClick={() =>
                    setTempFilters((p) => ({
                      ...p,
                      stop: p.stop === "direct" ? null : "direct",
                    }))
                  }
                >
                  Bay thẳng
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className={
                    tempFilters.stop === "1stop"
                      ? filterBtnActive
                      : filterBtnIdle
                  }
                  onClick={() =>
                    setTempFilters((p) => ({
                      ...p,
                      stop: p.stop === "1stop" ? null : "1stop",
                    }))
                  }
                >
                  1 điểm dừng
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className={
                    tempFilters.stop === "2plus"
                      ? filterBtnActive
                      : filterBtnIdle
                  }
                  onClick={() =>
                    setTempFilters((p) => ({
                      ...p,
                      stop: p.stop === "2plus" ? null : "2plus",
                    }))
                  }
                >
                  + 2 điểm dừng
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Giờ cất cánh
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Button
                  type="button"
                  variant="outline"
                  className={
                    tempFilters.departBucket === "00_06"
                      ? filterBtnActive
                      : filterBtnIdle
                  }
                  onClick={() =>
                    setTempFilters((p) => ({
                      ...p,
                      departBucket: p.departBucket === "00_06" ? null : "00_06",
                    }))
                  }
                >
                  00:00 - 06:00 • Sáng sớm
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className={
                    tempFilters.departBucket === "06_12"
                      ? filterBtnActive
                      : filterBtnIdle
                  }
                  onClick={() =>
                    setTempFilters((p) => ({
                      ...p,
                      departBucket: p.departBucket === "06_12" ? null : "06_12",
                    }))
                  }
                >
                  06:00 - 12:00 • Buổi sáng
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className={
                    tempFilters.departBucket === "12_18"
                      ? filterBtnActive
                      : filterBtnIdle
                  }
                  onClick={() =>
                    setTempFilters((p) => ({
                      ...p,
                      departBucket: p.departBucket === "12_18" ? null : "12_18",
                    }))
                  }
                >
                  12:00 - 18:00 • Buổi chiều
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className={
                    tempFilters.departBucket === "18_24"
                      ? filterBtnActive
                      : filterBtnIdle
                  }
                  onClick={() =>
                    setTempFilters((p) => ({
                      ...p,
                      departBucket: p.departBucket === "18_24" ? null : "18_24",
                    }))
                  }
                >
                  18:00 - 24:00 • Buổi tối
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Hãng hàng không
              </p>
              <div className="flex flex-wrap gap-2">
                {airlineOptions.map((name) => {
                  const active = isAirlineSelectedTemp(name);
                  return (
                    <Button
                      key={name}
                      type="button"
                      variant="outline"
                      className={active ? filterBtnActive : filterBtnIdle}
                      onClick={() => toggleAirlineTemp(name)}
                    >
                      {name}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Button
              type="button"
              className="w-full mt-2"
              onClick={() => {
                // ✅ [PATCH-FILTER-APPLY] — apply lọc thật vào danh sách
                setAppliedFilters(tempFilters);
                setShowFilterSheet(false);
              }}
            >
              Áp dụng
            </Button>
          </div>
        </div>
      )}
    </>
  );

  const renderFlightStep3 = () => {
    if (!selectedFlight) return null;

    return (
      <>
        <div className="flex rounded-full border border-primary/20 overflow-hidden mb-4">
          <button
            type="button"
            className={`flex-1 py-2 text-sm ${
              flightTab === "info"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground"
            }`}
            onClick={() => setFlightTab("info")}
          >
            Thông tin vé
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm ${
              flightTab === "rules"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground"
            }`}
            onClick={() => setFlightTab("rules")}
          >
            Điều kiện vé
          </button>
        </div>

        {flightTab === "info" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {selectedFlight.airline}
                </p>
                <p className="text-xs text-muted-foreground">
                  Chuyến bay {selectedFlight.code} • {selectedFlight.cabin}
                </p>
              </div>
              <p className="text-base font-bold text-red-500">
                {selectedFlight.price.toLocaleString("vi-VN")} VND
              </p>
            </div>

            <div className="border-l-2 border-muted pl-4 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-primary">
                  {selectedFlight.departTime} •{" "}
                  {formData.flightDate || "29/11/2025"}
                </p>
                <p className="text-muted-foreground">
                  {selectedFlight.fromName} ({selectedFlight.fromCode})
                </p>
              </div>

              <div>
                <p className="text-sm text-primary">
                  ⏱ {selectedFlight.duration} • Bay thẳng
                </p>
              </div>

              <div>
                <p className="font-semibold text-primary">
                  {selectedFlight.arriveTime}
                </p>
                <p className="text-muted-foreground">
                  {selectedFlight.toName} ({selectedFlight.toCode})
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-semibold mb-2">Điều kiện vé</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Hành lý xách tay: 10 Kg</li>
              <li>Hành lý ký gửi: 23 Kg</li>
              <li>Suất ăn: Tùy chuyến bay</li>
              <li>Thay đổi chuyến bay: Được phép (có thể thu phí)</li>
              <li>Đổi tên: Không hỗ trợ</li>
              <li>Hoàn vé: Được phép theo điều kiện hạng vé</li>
              <li>Chọn ghế ngồi: Miễn phí trên ứng dụng</li>
            </ul>
          </div>
        )}

        <Button
          type="button"
          className="w-full mt-6"
          onClick={() => {
            if (!selectedFlight) return;
            onConfirm(selectedFlight);
          }}
        >
          Chọn vé
        </Button>
      </>
    );
  };

  if (flightStep === 1) return renderFlightStep1();
  if (flightStep === 2) return renderFlightStep2();
  return renderFlightStep3();
});

export default UtilityFlight;
