import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { reverseGeocode } from "@/services/geocodeService";
import { searchHotels, type HotelItem } from "@/services/hotelService";
import {
  createHotelBooking,
  fetchHotelRooms,
  fetchUserAccounts,
  type HotelRoom,
  type UserAccount,
} from "@/services/hotelBookingService";
import {
  getVnProvinceOptions,
  getVnDistrictOptions,
  getIntlDestinations,
  type CityOption,
} from "@/services/locationClient";
import { requireBiometricForHighValueVnd } from "@/services/biometricService";
import { Geolocation } from "@capacitor/geolocation";
import {
  ArrowLeft,
  BedDouble,
  CalendarRange,
  Check,
  ChevronsUpDown,
  CreditCard,
  ImageIcon,
  LocateFixed,
  MapPin,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { toast } from "sonner";
import { format } from "date-fns";

type Step = 1 | 2 | 3;

// Generate hotel room images using Unsplash source (free, no API key needed)
const HOTEL_IMAGE_KEYWORDS = [
  "hotel-room",
  "luxury-bedroom",
  "hotel-suite",
  "resort-room",
  "hotel-interior",
];

function getHotelImages(hotelId: string, count: number = 5): string[] {
  // Use hotel ID as seed for consistent images per hotel
  const seed = hotelId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Array.from({ length: count }, (_, i) => {
    const keyword = HOTEL_IMAGE_KEYWORDS[(seed + i) % HOTEL_IMAGE_KEYWORDS.length];
    // Using picsum.photos for reliable free images
    return `https://picsum.photos/seed/${hotelId}-${i}/800/600`;
  });
}

const CITY_KEY_MAP: Record<string, string> = {
  "hà nội": "VN_HN",
  hanoi: "VN_HN",
  "ha noi": "VN_HN",
  "tp.hcm": "VN_HCM",
  "hồ chí minh": "VN_HCM",
  "ho chi minh": "VN_HCM",
  "sài gòn": "VN_HCM",
  "da nang": "VN_DN",
  "đà nẵng": "VN_DN",
  "khanh hoa": "VN_KH",
  "khánh hòa": "VN_KH",
  "nha trang": "VN_NT",
};

export default function HotelBooking() {
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

  const [locationMode, setLocationMode] = useState<"vn" | "intl">("vn");
  const [cityInput, setCityInput] = useState("");
  const [cityKey, setCityKey] = useState("");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [filters, setFilters] = useState({ nearCenter: true, starsGte4: true, cheapFirst: true });
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [hotels, setHotels] = useState<HotelItem[]>([]);
  const [roomsOptions, setRoomsOptions] = useState<HotelRoom[]>([]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [step, setStep] = useState<Step>(1);
  const [selectedHotel, setSelectedHotel] = useState<HotelItem | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<HotelRoom | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  // VN location hierarchy
  const [vnProvinces, setVnProvinces] = useState<CityOption[]>([]);
  const [vnDistricts, setVnDistricts] = useState<CityOption[]>([]);
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  // International - simple dropdown with popular destinations
  const [intlDestinations] = useState<CityOption[]>(getIntlDestinations());
  const [intlComboboxOpen, setIntlComboboxOpen] = useState(false);

  useEffect(() => {
    getVnProvinceOptions().then(setVnProvinces).catch(() => setVnProvinces([]));
    fetchUserAccounts()
      .then((list) => {
        setAccounts(list);
        if (list[0]) setSelectedAccount(list[0].accountNumber);
      })
      .catch(() => setAccounts([]));
  }, []);

  const nights = useMemo(() => {
    const s = new Date(checkIn).getTime();
    const e = new Date(checkOut).getTime();
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [checkIn, checkOut]);

  const totalPrice = useMemo(() => {
    const base = selectedRoom?.pricePerNight ?? 850000;
    return base * rooms * (nights || 1);
  }, [rooms, nights, selectedRoom]);

  const resolveCityKey = (): string => {
    if (cityKey) return cityKey;
    if (selectedDistrict) return `VN_${selectedDistrict}`;
    if (selectedProvince) return `VN_${selectedProvince}`;
    const normalized = cityInput.trim().toLowerCase();
    if (CITY_KEY_MAP[normalized]) return CITY_KEY_MAP[normalized];
    return cityInput ? `INT_${cityInput.replace(/\s+/g, "_").toUpperCase()}` : "";
  };

  const handleGeoSuggest = async () => {
    try {
      setLoadingGeo(true);
      const perm = await Geolocation.requestPermissions();
      if (perm?.location === "denied") throw new Error("Quyền vị trí bị từ chối");
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      const result = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      const city = result.city || result.state || result.country || "";
      setCityInput(city);
      setCityKey(city ? `INT_${city.replace(/\s+/g, "_").toUpperCase()}` : "");
    } catch (err) {
      console.error(err);
      setCityInput("Hà Nội");
      setCityKey("VN_HN");
    } finally {
      setLoadingGeo(false);
    }
  };

  const handleSearch = async () => {
    // Validate location selection
    const finalCityKey = resolveCityKey();
    if (!finalCityKey) {
      if (locationMode === "vn") {
        toast.error("Vui lòng chọn tỉnh/thành phố trước khi tìm kiếm");
      } else {
        toast.error("Vui lòng nhập thành phố/khu vực trước khi tìm kiếm");
      }
      return;
    }

    // Validate dates
    if (!nights || nights <= 0) {
      toast.error("Ngày trả phòng phải sau ngày nhận phòng");
      return;
    }

    // Normalize guest and room counts (already handled in onChange)
    const normalizedGuests = Math.max(1, guests);
    const normalizedRooms = Math.max(1, rooms);

    try {
      setLoadingSearch(true);
      const result = await searchHotels({
        cityKey: finalCityKey,
        checkIn,
        checkOut,
        guests: normalizedGuests,
        rooms: normalizedRooms,
        filters,
      });
      setHotels(result);
      setSelectedHotel(null);
      setSelectedRoom(null);
      setRoomsOptions([]);
      setStep(2);
      setCityKey(finalCityKey);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách khách sạn. Vui lòng thử lại.");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSelectHotel = async (hotel: HotelItem) => {
    setSelectedHotel(hotel);
    setSelectedRoom(null);
    setLoadingRooms(true);
    try {
      const roomsList = await fetchHotelRooms(hotel.id);
      setRoomsOptions(roomsList);
    } catch (err) {
      console.error(err);
      toast.error("Không tải được danh sách hạng phòng");
      setRoomsOptions([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedHotel || !selectedRoom) return;
    if (!selectedAccount) {
      toast.error("Chọn tài khoản nguồn");
      return;
    }
    const total = totalPrice;
    if (total >= 10_000_000) {
      const biometric = await requireBiometricForHighValueVnd(total);
      if (biometric !== "ok") {
        toast.error("Cần xác thực vân tay/FaceID cho giao dịch >= 10 triệu");
        return;
      }
    }
    try {
      await createHotelBooking({
        hotel: selectedHotel,
        room: selectedRoom,
        guests,
        rooms,
        nights: nights || 1,
        checkIn,
        checkOut,
        accountNumber: selectedAccount,
      });
      toast.success("Thanh toán thành công (demo)");
      navigate("/utilities/result", {
        state: {
          result: {
            flow: "hotel" as const,
            title: "Đặt phòng khách sạn thành công",
            amount: total.toLocaleString("vi-VN") + " ₫",
            time: new Date().toLocaleString("vi-VN"),
            fee: "0 ₫",
            transactionId: `HTL-${Date.now()}`,
            details: [
              { label: "Khách sạn", value: selectedHotel.name },
              { label: "Hạng phòng", value: selectedRoom.name },
              { label: "Ngày nhận phòng", value: checkIn },
              { label: "Ngày trả phòng", value: checkOut },
              { label: "Số đêm", value: `${nights || 1} đêm` },
              { label: "Số khách", value: `${guests} khách` },
              { label: "Số phòng", value: `${rooms} phòng` },
            ],
          },
          source: "home",
        },
      });
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Thanh toán thất bại";
      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-gradient-to-br from-primary to-accent p-6 pb-6 text-primary-foreground">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
            >
              <ArrowLeft size={18} />
              Trở lại
            </button>
            <div className="leading-tight">
              <p className="text-xs opacity-80">Tiện ích – Du lịch & nghỉ dưỡng</p>
              <h1 className="text-xl font-semibold">Đặt phòng khách sạn</h1>
            </div>
          </div>
          <Badge className="bg-white/20 text-primary-foreground border-white/40">Beta</Badge>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl -mt-5 mb-24 px-4 md:px-6">
        <Card className="overflow-hidden shadow-lg">
          <div className="bg-gradient-to-r from-primary to-accent px-4 py-4 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">BƯỚC {step} / 3</p>
                <h2 className="text-lg font-semibold">Quy trình đặt phòng</h2>
              </div>
              <Badge className="border-white/40 bg-white/15 text-primary-foreground">An toàn</Badge>
            </div>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              {[
                { label: "Tìm phòng", icon: MapPin, id: 1 },
                { label: "Chọn phòng", icon: BedDouble, id: 2 },
                { label: "Thanh toán", icon: CreditCard, id: 3 },
              ].map((item, idx) => (
                <div key={item.label} className="flex flex-1 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-primary-foreground shadow-sm ${
                      step >= item.id ? "border-white bg-white/90 text-primary" : "border-white/60 bg-white/20"
                    }`}
                  >
                    <item.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-primary-foreground/80">Bước {idx + 1}</p>
                    <p
                      className={`text-sm font-semibold ${
                        step >= item.id ? "text-primary-foreground" : "text-primary-foreground/70"
                      }`}
                    >
                      {item.label}
                    </p>
                  </div>
                  {idx < 2 && (
                    <div className="hidden h-px flex-1 bg-gradient-to-r from-white/30 via-white/60 to-white/30 md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="grid gap-4 p-5 md:p-6 bg-white">
              {/* Location Mode Tabs and GPS Button */}
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant={locationMode === "vn" ? "default" : "outline"}
                    onClick={() => {
                      setLocationMode("vn");
                      // Clear international fields when switching to VN
                      setCityInput("");
                      setCityKey("");
                    }}
                  >
                    Việt Nam
                  </Button>
                  <Button
                    size="sm"
                    variant={locationMode === "intl" ? "default" : "outline"}
                    onClick={() => {
                      setLocationMode("intl");
                      // Clear VN fields when switching to international
                      setSelectedProvince("");
                      setSelectedDistrict("");
                      setVnDistricts([]);
                    }}
                  >
                    Quốc tế
                  </Button>
                </div>
                <Button variant="outline" onClick={handleGeoSuggest} disabled={loadingGeo}>
                  <LocateFixed size={16} className="mr-2" />
                  {loadingGeo ? "Đang lấy vị trí..." : "Gợi ý GPS"}
                </Button>
              </div>

              {/* Location Selection - Vietnam */}
              {locationMode === "vn" && (
                <div className="space-y-3">
                  <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">
                    Chọn địa điểm Việt Nam
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">Tỉnh/Thành phố</Label>
                      <select
                        className="w-full rounded-xl border bg-background p-3 text-sm"
                        value={selectedProvince}
                        onChange={async (e) => {
                          const code = e.target.value;
                          setSelectedProvince(code);
                          setSelectedDistrict("");
                          if (code) {
                            const provinceLabel = vnProvinces.find((p) => p.key === code)?.label || "";
                            setCityInput(provinceLabel);
                            setCityKey(`VN_${code}`);
                            const districts = await getVnDistrictOptions(code);
                            setVnDistricts(districts);
                          } else {
                            setVnDistricts([]);
                            setCityInput("");
                            setCityKey("");
                          }
                        }}
                      >
                        <option value="">Chọn tỉnh/thành</option>
                        {vnProvinces.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">Quận/Huyện (tùy chọn)</Label>
                      <select
                        className="w-full rounded-xl border bg-background p-3 text-sm"
                        value={selectedDistrict}
                        onChange={(e) => {
                          const code = e.target.value;
                          setSelectedDistrict(code);
                          if (code) {
                            const distLabel = vnDistricts.find((d) => d.key === code)?.label || "";
                            setCityInput(distLabel);
                            setCityKey(`VN_${code}`);
                          } else if (selectedProvince) {
                            // If district is cleared but province is selected, use province
                            const provinceLabel = vnProvinces.find((p) => p.key === selectedProvince)?.label || "";
                            setCityInput(provinceLabel);
                            setCityKey(`VN_${selectedProvince}`);
                          }
                        }}
                        disabled={!vnDistricts.length}
                      >
                        <option value="">Chọn quận/huyện</option>
                        {vnDistricts.map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Selection - International */}
              {locationMode === "intl" && (
                <div className="space-y-3">
                  <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">
                    Chọn địa điểm quốc tế
                  </p>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Điểm đến phổ biến</Label>
                    <Popover open={intlComboboxOpen} onOpenChange={setIntlComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={intlComboboxOpen}
                          className="w-full justify-between rounded-xl border bg-background p-3 text-sm font-normal h-auto"
                        >
                          {cityKey
                            ? intlDestinations.find((c) => c.key === cityKey)?.label || cityInput
                            : "Chọn điểm đến..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Tìm điểm đến..." />
                          <CommandList>
                            <CommandEmpty>Không tìm thấy.</CommandEmpty>
                            <CommandGroup>
                              {intlDestinations.map((opt) => (
                                <CommandItem
                                  key={opt.key}
                                  value={opt.label}
                                  onSelect={() => {
                                    setCityInput(opt.label);
                                    setCityKey(opt.key);
                                    setIntlComboboxOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      cityKey === opt.key ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {opt.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarRange size={16} className="text-emerald-700" />
                    Ngày nhận / trả
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nhận phòng</Label>
                      <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Trả phòng</Label>
                      <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{nights || 1} đêm</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <UsersRound size={16} className="text-emerald-700" />
                    Khách & Phòng
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Khách</Label>
                      <Input
                        type="number"
                        min={1}
                        value={guests}
                        onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phòng</Label>
                      <Input
                        type="number"
                        min={1}
                        value={rooms}
                        onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles size={16} className="text-emerald-700" />
                  Bộ lọc nhanh
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                    <span>Gần trung tâm</span>
                    <Switch
                      checked={filters.nearCenter}
                      onCheckedChange={(v) => setFilters((f) => ({ ...f, nearCenter: v }))}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                    <span>4★+</span>
                    <Switch
                      checked={filters.starsGte4}
                      onCheckedChange={(v) => setFilters((f) => ({ ...f, starsGte4: v }))}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                    <span>Giá tốt</span>
                    <Switch
                      checked={filters.cheapFirst}
                      onCheckedChange={(v) => setFilters((f) => ({ ...f, cheapFirst: v }))}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border p-4 bg-muted/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Tóm tắt nhanh
                    </p>
                    <p className="text-sm font-semibold text-foreground">{cityInput || "Chưa chọn điểm đến"}</p>
                    <p className="text-xs text-muted-foreground">
                      {checkIn} → {checkOut} · {guests} khách · {rooms} phòng
                    </p>
                  </div>
                  <Badge className="border-emerald-100 bg-white text-emerald-700 shadow-sm">
                    Ước tính: {totalPrice.toLocaleString("vi-VN")} ₫
                  </Badge>
                </div>
                <Separator className="my-3" />
                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>
                      Thành phố: {cityInput || "—"} | Bộ lọc:{" "}
                      {[filters.nearCenter && "Gần trung tâm", filters.starsGte4 && "4★+", filters.cheapFirst && "Giá tốt"]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-muted-foreground">
                  Hỗ trợ demo: dữ liệu khách sạn mẫu Firestore, không gọi API trả phí.
                </div>
                <Button size="lg" onClick={handleSearch} disabled={loadingSearch}>
                  <Search size={16} className="mr-2" />
                  {loadingSearch ? "Đang tìm..." : "Tìm nhanh"}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {step === 2 && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Left column: Hotel list */}
            <Card className="p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Danh sách khách sạn</p>
                <Badge variant="secondary">{hotels.length} kết quả</Badge>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-hide flex-1">
                {hotels.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedHotel?.id === h.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-muted hover:border-emerald-200"
                    }`}
                    onClick={() => handleSelectHotel(h)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{h.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.stars}★ · {h.rating ?? "--"} điểm · Cách trung tâm {h.distanceToCenterKm ?? 1.2} km
                        </p>
                      </div>
                      <Badge variant="outline">Từ {h.priceFrom.toLocaleString("vi-VN")} ₫/đêm</Badge>
                    </div>
                  </button>
                ))}
                {!hotels.length && (
                  <p className="text-xs text-muted-foreground">
                    Chưa có kết quả. Hãy quay lại bước 1 và bấm Tìm nhanh.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-auto pt-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Quay lại bước 1
                </Button>
              </div>
            </Card>

            {/* Right column: Hotel images & Room selection */}
            <div className="space-y-4">
              {/* Hotel Images Carousel */}
              {selectedHotel && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <ImageIcon size={16} className="text-emerald-700" />
                      Hình ảnh khách sạn
                    </p>
                    <Badge variant="secondary">{selectedHotel.name}</Badge>
                  </div>
                  <div className="px-10">
                    <Carousel className="w-full">
                      <CarouselContent>
                        {getHotelImages(selectedHotel.id).map((imgUrl, idx) => (
                          <CarouselItem key={idx}>
                            <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                              <img
                                src={imgUrl}
                                alt={`${selectedHotel.name} - Ảnh ${idx + 1}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
                                {idx + 1} / 5
                              </div>
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <CarouselPrevious />
                      <CarouselNext />
                    </Carousel>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Vuốt hoặc bấm mũi tên để xem thêm ảnh
                  </p>
                </Card>
              )}

              {/* Room Selection */}
              {selectedHotel && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Chọn hạng phòng</p>
                    <Badge variant="secondary">
                      {loadingRooms ? "Đang tải..." : `${roomsOptions.length} lựa chọn`}
                    </Badge>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-hide">
                    {roomsOptions.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoom(r);
                          setStep(3);
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          selectedRoom?.id === r.id
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-muted hover:border-emerald-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{r.name}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {r.perks.map((perk) => (
                                <Badge key={perk} variant="outline" className="text-xs">
                                  {perk}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-700">
                              {r.pricePerNight.toLocaleString("vi-VN")} ₫/đêm
                            </p>
                            {r.refundable && <p className="text-[11px] text-emerald-600">Hủy miễn phí</p>}
                          </div>
                        </div>
                      </button>
                    ))}
                    {!roomsOptions.length && !loadingRooms && (
                      <p className="text-xs text-muted-foreground">Chọn khách sạn để xem hạng phòng.</p>
                    )}
                  </div>
                </Card>
              )}

              {/* Placeholder when no hotel selected */}
              {!selectedHotel && (
                <Card className="p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[300px]">
                  <ImageIcon size={48} className="text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Chọn một khách sạn từ danh sách bên trái để xem hình ảnh và hạng phòng
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {step === 3 && selectedHotel && selectedRoom && (
          <div className="mt-4 grid gap-4 md:grid-cols-10">
            {/* Left column: Payment confirmation - 7/10 */}
            <Card className="p-4 space-y-3 md:col-span-7">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Xác nhận & thanh toán</p>
                <Badge variant="secondary">Demo</Badge>
              </div>
              <div className="space-y-2 rounded-xl border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Khách sạn</span>
                  <span className="font-semibold">{selectedHotel.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ngày ở</span>
                  <span className="font-semibold">
                    {checkIn} → {checkOut} ({nights || 1} đêm)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Hạng phòng</span>
                  <span className="font-semibold">{selectedRoom.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Khách & Phòng</span>
                  <span className="font-semibold">
                    {guests} khách · {rooms} phòng
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tạm tính</span>
                  <span className="font-semibold">{totalPrice.toLocaleString("vi-VN")} ₫</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Phí</span>
                  <span className="font-semibold">0 ₫</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold text-emerald-700">
                  <span>Tổng thanh toán</span>
                  <span>{totalPrice.toLocaleString("vi-VN")} ₫</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Tài khoản nguồn</p>
                {accounts.length > 0 ? (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{selectedAccount}</span>
                      <span className="text-emerald-600 font-semibold">
                        {accounts.find((a) => a.accountNumber === selectedAccount)?.balance.toLocaleString("vi-VN")} ₫
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Chưa có tài khoản</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Quay lại bước 2
                </Button>
                <Button onClick={handlePayment} disabled={!selectedAccount}>
                  Thanh toán & xem biên lai
                </Button>
              </div>
            </Card>

            {/* Right column: Commitments & Notes - 3/10 */}
            <Card className="p-4 space-y-4 md:col-span-3">
              <div>
                <p className="text-sm font-semibold mb-3">Cam kết của chúng tôi</p>
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span>Xác nhận đặt phòng ngay lập tức qua email và SMS</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span>Giá tốt nhất được đảm bảo, không phí ẩn</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span>Hỗ trợ khách hàng 24/7 qua hotline 1900-xxxx</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span>Thanh toán an toàn, bảo mật thông tin</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-3">Lưu ý quan trọng</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>• Giờ nhận phòng: từ 14:00, trả phòng: trước 12:00</p>
                  <p>• Vui lòng mang theo CCCD/Hộ chiếu khi nhận phòng</p>
                  <p>• Chính sách hủy phòng theo quy định của khách sạn</p>
                  {selectedRoom.refundable ? (
                    <p className="text-emerald-600 font-medium">✓ Phòng này có thể hoàn tiền</p>
                  ) : (
                    <p className="text-amber-600 font-medium">⚠ Phòng này không hoàn tiền</p>
                  )}
                </div>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground">
                <p>Bằng việc thanh toán, bạn đồng ý với <span className="text-primary underline cursor-pointer">Điều khoản sử dụng</span> và <span className="text-primary underline cursor-pointer">Chính sách bảo mật</span> của VietBank.</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
