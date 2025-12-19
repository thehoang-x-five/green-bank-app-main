// src/pages/utilities/UtilityBills.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  SeatClass,
  UtilityFormData,
  UtilityType,
} from "./utilities/utilityTypes";
import {
  buildBillReceipt,
  buildPhoneReceipt,
  buildDataReceipt,
  buildMovieReceipt,
  buildHotelReceipt,
  buildFlightReceipt,
} from "./utilities/buildReceipt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  BedDouble,
  CheckCircle2,
  Clapperboard,
  CreditCard,
  MapPin,
} from "lucide-react";
import { detectTelcoByPhone, MOCK_USER_PHONE } from "./utilities/utilityData";
import { toast } from "sonner"; // ✅ [PATCH-MOVIE-HOTEL-IMPORT] dùng cho validate movie/hotel
import UtilityBill from "./utilities/UtilityBill";
import UtilityMobilePhone from "./utilities/UtilityMobilePhone";
import UtilityPhoneTopup from "./utilities/UtilityPhoneTopup";
import UtilityDataPack from "./utilities/UtilityDataPack";
import UtilityFlight from "./utilities/UtilityFlight";
import UtilityMovie from "./utilities/UtilityMovie";
import UtilityHotel from "./utilities/UtilityHotel";

type UtilityEntry = "home" | "bill" | "mobileBill" | "mobile3g4g";

type FlightUiHandle = {
  goBack: () => boolean; // true = đã xử lý back trong Flight UI
};

export default function UtilityBills() {
  const navigate = useNavigate();
  const location = useLocation();
  const flightUiRef = useRef<FlightUiHandle | null>(null);

  // ✅ [PATCH-ENTRY] Đọc entry để phân biệt luồng navigate/back + header
  const entry: UtilityEntry = (location.state as any)?.entry ?? "home";

  // ✅ route: /utilities/:type
  const { type } = useParams<{ type: UtilityType }>();
  const routeType: UtilityType = (type as UtilityType) ?? "bill";

  const [currentType, setCurrentType] = useState<UtilityType>(routeType);

  const [billService, setBillService] = useState<
    "electric" | "water" | "mobile" | null
  >(null);
  const [billSave, setBillSave] = useState(false);

  const initTelco = detectTelcoByPhone(MOCK_USER_PHONE);

  const [formData, setFormData] = useState<UtilityFormData>({
    billType: "",
    billProvider: "",
    customerCode: "",
    billAmount: "",

    phoneNumber: MOCK_USER_PHONE,
    telco: initTelco,
    topupAmount: "",

    dataPhone: MOCK_USER_PHONE,
    dataTelco: initTelco,
    dataPack: "",

    flightFrom: "",
    flightTo: "",
    flightDate: "",
    flightReturnDate: "",
    flightSeatClass: "all" as SeatClass,
    flightAdult: "0",
    flightChild: "0",
    flightInfant: "0",

    movieCinema: "",
    movieName: "",
    movieDate: "",
    movieTime: "",
    movieTickets: "1",

    hotelCity: "",
    hotelCheckIn: "",
    hotelCheckOut: "",
    hotelGuests: "1",
    hotelRooms: "1",
  });

  // ✅ [PATCH-MOVIE-HOTEL-STATE] — thêm state 3 bước (chỉ cho movie/hotel)
  const [movieStep, setMovieStep] = useState<1 | 2 | 3>(1);
  const [hotelStep, setHotelStep] = useState<1 | 2 | 3>(1);
  const [selectedHotelRoom, setSelectedHotelRoom] = useState<{
    name: string;
    price: number;
    perks: string[];
  } | null>(null);

  // ✅ [PATCH-ROUTE-SYNC] Sync state theo URL param
  useEffect(() => {
    if (routeType === currentType) return;
    setCurrentType(routeType);

    // rời bill thì clear billService để không kẹt bill detail
    if (routeType !== "bill") setBillService(null);
  }, [routeType, currentType]);

  // ✅ [PATCH-MOVIE-HOTEL-RESET] — khi đổi sang type khác thì reset step movie/hotel
  useEffect(() => {
    if (currentType !== "movie") setMovieStep(1);
    if (currentType !== "hotel") {
      setHotelStep(1);
      setSelectedHotelRoom(null);
    }
  }, [currentType]);

  // ✅ Helper điều hướng đúng route
  const goToType = (
    t: UtilityType,
    opts?: { replace?: boolean; state?: any }
  ) => {
    navigate(`/utilities/${t}`, {
      replace: opts?.replace ?? false,
      state: opts?.state,
    });
  };

  // ✅ Header cho BILL DETAIL theo billService
  const billDetailHeaderTitle =
    billService === "electric"
      ? "Thanh toán hóa đơn Điện"
      : billService === "water"
      ? "Thanh toán hóa đơn Nước"
      : "Thanh toán hóa đơn";

  // ✅ [PATCH-HEADER-DATA4G] xác định Data 4G/Nạp tiền (GIỮ LOGIC ANH ĐƯA)
  const isData4GTopup = useMemo(() => {
    return entry === "home" || entry === "mobileBill";
  }, [entry]);

  // ✅ [PATCH-3G4G-STICKY] chỉ bật sticky button ở màn data khi là Mua 3G/4G
  const isMua3G4G = useMemo(() => {
    return entry === "mobile3g4g";
  }, [entry]);

  const headerMeta = (() => {
    switch (currentType) {
      case "mobilePhone":
        return {
          title: "Điện thoại di động",
          subtitle: "Nạp tiền, mua 3G/4G và xem lịch sử gần đây",
        };

      case "phone":
        return {
          title: "Nạp tiền điện thoại",
          subtitle: "Nạp tiền nhanh cho thuê bao di động",
        };

      case "data": {
        // ✅ [PATCH-HEADER-DATA4G] (đúng logic anh đưa)
        return isData4GTopup
          ? {
              title: "Data 4G/Nạp tiền",
              subtitle: "Nạp data 4G hoặc nạp tiền cho thuê bao (demo)",
            }
          : {
              title: "Mua 3G/4G",
              subtitle: "Mua gói data 3G/4G cho thuê bao di động",
            };
      }

      case "flight":
        return {
          title: "Mua vé máy bay",
          subtitle: "Tra cứu, so sánh và chọn chuyến bay (demo)",
        };
      case "movie":
        return { title: "Mua vé xem phim", subtitle: "Đặt vé tại rạp (demo)" };
      case "hotel":
        return {
          title: "Đặt phòng khách sạn",
          subtitle: "Đặt phòng trong và ngoài nước (demo)",
        };
      case "bill":
      default:
        return {
          title: "Thanh toán hóa đơn",
          subtitle: "Thanh toán các hóa đơn điện, nước, di động",
        };
    }
  })();

  // ✅ [PATCH-MOVIE-HOTEL-HELPERS] — tính toán hiển thị (không ảnh hưởng luồng khác)
  const movieTickets = Math.min(
    10,
    Math.max(1, Number(formData.movieTickets || "1") || 1)
  );
  const isMovieReady =
    !!formData.movieCinema &&
    !!formData.movieName &&
    !!formData.movieDate &&
    !!formData.movieTime;
  const movieEstimate = (100000 * movieTickets).toLocaleString("vi-VN");

  const hotelRoomsCount = Math.max(1, Number(formData.hotelRooms || "1") || 1);
  const hotelNights = (() => {
    if (!formData.hotelCheckIn || !formData.hotelCheckOut) return 0;
    const start = new Date(formData.hotelCheckIn).getTime();
    const end = new Date(formData.hotelCheckOut).getTime();
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  })();
  const hotelReady =
    !!formData.hotelCity && !!formData.hotelCheckIn && !!formData.hotelCheckOut;
  const hotelRoomRate = selectedHotelRoom?.price ?? 850000;
  const hotelEstimate = (
    hotelRoomRate *
    hotelRoomsCount *
    (hotelNights || 1)
  ).toLocaleString("vi-VN");
  const hotelGuestSummary = `${
    formData.hotelGuests || "1"
  } khách · ${hotelRoomsCount} phòng`;

  const roomOptions = [
    {
      name: "Phòng tiêu chuẩn",
      price: 850000,
      perks: ["Miễn phí Wi-Fi", "Hủy miễn phí 24h", "Bao gồm bữa sáng"],
    },
    {
      name: "Deluxe City View",
      price: 1150000,
      perks: [
        "View thành phố",
        "Nhận phòng sớm",
        "Được nâng hạng khi còn phòng",
      ],
    },
    {
      name: "Suite Executive",
      price: 1550000,
      perks: ["Late checkout", "Mini bar miễn phí", "Ưu tiên đỗ xe"],
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentType === "bill") {
      if (!billService) return;
      const result = buildBillReceipt({ billService, billSave, formData });
      navigate("/utilities/result", { state: { result, source: "home" } });
      return;
    }

    if (currentType === "phone") {
      const result = buildPhoneReceipt(formData);
      navigate("/utilities/result", { state: { result, source: "home" } });
      return;
    }

    if (currentType === "data") {
      const result = buildDataReceipt(formData);
      navigate("/utilities/result", { state: { result, source: "home" } });
      return;
    }

    if (currentType === "flight") return;

    // ✅ [PATCH-MOVIE-HOTEL-SUBMIT] — thay luồng movie/hotel theo 3 bước (chỉ áp dụng cho 2 tiện ích này)
    if (currentType === "movie") {
      if (movieStep === 1) {
        if (!isMovieReady) {
          toast.error("Vui lòng nhập đầy đủ thông tin vé xem phim");
          return;
        }
        setMovieStep(2);
        return;
      }

      if (movieStep === 2) {
        setMovieStep(3);
        return;
      }

      // movieStep === 3 => pay => receipt
      const result = buildMovieReceipt(formData);
      navigate("/utilities/result", { state: { result, source: "home" } });
      return;
    }

    if (currentType === "hotel") {
      if (hotelStep === 1) {
        if (!hotelReady) {
          toast.error("Vui lòng nhập đủ thành phố và ngày nhận / trả phòng");
          return;
        }
        setHotelStep(2);
        return;
      }

      if (hotelStep === 2) {
        if (!selectedHotelRoom) {
          toast.error("Vui lòng chọn hạng phòng");
          return;
        }
        setHotelStep(3);
        return;
      }

      // hotelStep === 3 => pay => receipt
      const result = buildHotelReceipt(formData);
      navigate("/utilities/result", { state: { result, source: "home" } });
      return;
    }
  };

  // ✅ Back đúng luồng theo yêu cầu
  const handleBack = () => {
    // ✅ [PATCH-MOVIE-HOTEL-BACK] — back theo step cho movie/hotel (chỉ ảnh hưởng 2 tiện ích này)
    if (currentType === "movie") {
      if (movieStep === 3) {
        setMovieStep(2);
        return;
      }
      if (movieStep === 2) {
        setMovieStep(1);
        return;
      }
    }

    if (currentType === "hotel") {
      if (hotelStep === 3) {
        setHotelStep(2);
        return;
      }
      if (hotelStep === 2) {
        setHotelStep(1);
        return;
      }
    }

    if (currentType === "flight") {
      const handled = flightUiRef.current?.goBack?.() ?? false;
      if (handled) return;
    }

    if (currentType === "bill" && billService) {
      setBillService(null);
      return;
    }

    if (currentType === "mobilePhone") {
      if (entry === "bill") goToType("bill");
      else navigate("/home");
      return;
    }

    // ✅ [PATCH-BACK-MERGE-1-2] phone/data: nếu vào từ mobile (bill / 3g4g) => về mobilePhone, render liền (không trắng)
    if (currentType === "phone" || currentType === "data") {
      if (entry === "mobileBill" || entry === "mobile3g4g") {
        // 1) Điều hướng SPA như bình thường (GIỮ LUỒNG)
        navigate("/utilities/mobilePhone", {
          replace: true,
          state: { entry: "bill", _t: Date.now() },
        });

        // 2) Watchdog: nếu router đổi URL nhưng UI MobilePhone không render (bị trắng)
        //    thì tự động hard-redirect để người dùng KHÔNG phải tự reload.
        setTimeout(() => {
          const isAtMobilePhone = window.location.pathname.endsWith(
            "/utilities/mobilePhone"
          );
          const hasRendered = !!document.getElementById(
            "utility-mobilephone-screen"
          );

          if (isAtMobilePhone && !hasRendered) {
            // ✅ chỉ chạy khi bị lỗi trắng
            window.location.replace("/utilities/mobilePhone");
          }
        }, 50);

        return;
      }

      navigate("/home");
      return;
    }

    navigate("/home");
  };

  const renderContent = () => {
    if (currentType === "bill") {
      return (
        <UtilityBill
          formData={formData}
          setFormData={setFormData}
          billService={billService}
          setBillService={setBillService}
          billSave={billSave}
          setBillSave={setBillSave}
          onGoMobilePhone={() => {
            goToType("mobilePhone", { state: { entry: "bill" } });
            setBillService("mobile");
          }}
        />
      );
    }

    if (currentType === "mobilePhone") {
      return (
        <UtilityMobilePhone
          onGoTopup={() =>
            goToType("phone", { state: { entry: "mobileBill" } })
          }
          onGo3G4G={() => goToType("data", { state: { entry: "mobile3g4g" } })}
          onGoData4G={() =>
            goToType("data", { state: { entry: "mobileBill" } })
          }
        />
      );
    }

    if (currentType === "phone") {
      return (
        <UtilityPhoneTopup formData={formData} setFormData={setFormData} />
      );
    }

    if (currentType === "data") {
      return <UtilityDataPack formData={formData} setFormData={setFormData} />;
    }

    if (currentType === "flight") {
      return (
        <UtilityFlight
          ref={flightUiRef}
          formData={formData}
          setFormData={setFormData}
          onConfirm={(selectedFlight) => {
            const result = buildFlightReceipt({ selectedFlight, formData });
            navigate("/utilities/result", {
              state: { result, source: "home" },
            });
          }}
        />
      );
    }

    // ✅ [PATCH-MOVIE-HOTEL-CONTENT] — Step 1 vẫn dùng component cũ (không phá component)
    if (currentType === "movie") {
      return <UtilityMovie formData={formData} setFormData={setFormData} />;
    }

    if (currentType === "hotel") {
      return <UtilityHotel formData={formData} setFormData={setFormData} />;
    }

    return null;
  };

  const content = renderContent();

  // ✅ [PATCH-MOVIE-FLOW-UI] — UI 3 bước cho Movie (lấy logic/UI từ code (2) nhưng không ảnh hưởng các trang khác)
  if (currentType === "movie") {
    const isStep1 = movieStep === 1;
    const isStep2 = movieStep === 2;

    return (
      <div className="min-h-screen bg-background pb-12">
        <header className="bg-gradient-to-br from-primary to-accent px-6 pb-8 pt-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">
                Mua vé xem phim
              </h1>
              <p className="text-sm text-primary-foreground/80">
                Đặt vé tại rạp (demo)
              </p>
            </div>
          </div>
        </header>

        <div className="px-6 -mt-4">
          <Card className="overflow-hidden rounded-2xl shadow-lg">
            <div className="bg-gradient-to-r from-primary to-accent px-4 py-4 text-primary-foreground">
              <p className="text-xs opacity-80">Bước {movieStep} / 3</p>
              <h2 className="text-lg font-semibold">Quy trình đặt vé</h2>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                {[
                  {
                    label: "Thông tin vé",
                    icon: Clapperboard,
                    step: 1 as const,
                  },
                  { label: "Xác nhận", icon: CheckCircle2, step: 2 as const },
                  { label: "Thanh toán", icon: CreditCard, step: 3 as const },
                ].map(({ label, icon: Icon, step }, index, arr) => {
                  const isLast = index === arr.length - 1;
                  const active = movieStep >= step;
                  return (
                    <div key={label} className="flex flex-1 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${
                          active
                            ? "border-white bg-emerald-600 text-white"
                            : "border-white/60 bg-white/30 text-primary-foreground/80"
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-primary-foreground/80">
                          Bước {step}
                        </p>
                        <p className="text-sm font-semibold text-primary-foreground">
                          {label}
                        </p>
                      </div>
                      {!isLast && (
                        <div className="hidden h-px flex-1 bg-gradient-to-r from-white/30 via-white/60 to-white/30 md:block" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-5 md:p-6">
              {isStep1 && (
                <form id="movie-ticket-form" onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Bước 1 · Thông tin vé
                    </p>
                    <h2 className="text-lg font-semibold text-foreground">
                      Chọn rạp, phim và suất chiếu
                    </h2>
                  </div>

                  {content}

                  <div className="mt-4 flex justify-end">
                    <Button
                      form="movie-ticket-form"
                      type="submit"
                      size="lg"
                      className="px-8"
                      disabled={!isMovieReady}
                    >
                      Tiếp tục
                    </Button>
                  </div>
                </form>
              )}

              {isStep2 && (
                <div className="space-y-4">
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Bước 2 · Xác nhận
                    </p>
                    <h2 className="text-lg font-semibold text-foreground">
                      Kiểm tra thông tin vé
                    </h2>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground">Phim</span>
                      <span className="font-medium text-foreground">
                        {formData.movieName || "Chưa chọn"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground">Rạp chiếu</span>
                      <span className="font-medium text-foreground">
                        {formData.movieCinema || "Chưa chọn"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground">Ngày · Giờ</span>
                      <span className="font-medium text-foreground">
                        {formData.movieDate || "--/--"} ·{" "}
                        {formData.movieTime || "--:--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground">Số vé</span>
                      <span className="font-semibold text-foreground">
                        {movieTickets} vé · {movieEstimate} VND
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      type="button"
                      onClick={() => setMovieStep(1)}
                    >
                      Quay lại bước 1
                    </Button>
                    <Button
                      className="flex-1 min-w-[180px]"
                      type="button"
                      onClick={() => setMovieStep(3)}
                    >
                      Sang bước 3
                    </Button>
                  </div>
                </div>
              )}

              {movieStep === 3 && (
                <div className="space-y-4">
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Bước 3 · Thanh toán
                    </p>
                    <h2 className="text-lg font-semibold text-foreground">
                      Chọn phương thức thanh toán
                    </h2>
                  </div>

                  <div className="space-y-3 rounded-xl border border-muted bg-muted/30 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Tài khoản nguồn
                      </span>
                      <span className="font-semibold text-foreground">
                        559 807 ₫
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Phí giao dịch
                      </span>
                      <span className="font-semibold text-foreground">0 ₫</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Tổng thanh toán
                      </span>
                      <span className="text-lg font-bold text-emerald-700">
                        {movieEstimate} VND
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      type="button"
                      onClick={() => setMovieStep(2)}
                    >
                      Quay lại bước 2
                    </Button>
                    <Button
                      className="flex-1 min-w-[180px]"
                      type="button"
                      onClick={() => {
                        const result = buildMovieReceipt(formData);
                        navigate("/utilities/result", {
                          state: { result, source: "home" },
                        });
                      }}
                    >
                      Thanh toán và xem biên lai
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ✅ [PATCH-HOTEL-FLOW-UI] — UI 3 bước cho Hotel (lấy logic/UI từ code (2) nhưng không ảnh hưởng các trang khác)
  if (currentType === "hotel") {
    const isStep1 = hotelStep === 1;
    const isStep2 = hotelStep === 2;
    const hasSelection = !!selectedHotelRoom;
    const selectedRoom = selectedHotelRoom || roomOptions[0];

    return (
      <div className="min-h-screen bg-background pb-12">
        <header className="bg-gradient-to-br from-primary to-accent px-6 pb-8 pt-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">
                Đặt phòng khách sạn
              </h1>
              <p className="text-sm text-primary-foreground/80">
                Đặt phòng trong và ngoài nước (demo)
              </p>
            </div>
          </div>
        </header>

        <div className="px-6 -mt-4">
          <Card className="overflow-hidden rounded-2xl shadow-lg">
            <div className="bg-gradient-to-r from-primary to-accent px-4 py-4 text-primary-foreground">
              <p className="text-xs opacity-80">Bước {hotelStep} / 3</p>
              <h2 className="text-lg font-semibold">Quy trình đặt phòng</h2>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                {[
                  { label: "Tìm phòng", icon: MapPin, step: 1 as const },
                  { label: "Chọn phòng", icon: BedDouble, step: 2 as const },
                  {
                    label: "Xác nhận & thanh toán",
                    icon: CreditCard,
                    step: 3 as const,
                  },
                ].map(({ label, icon: Icon, step }, index, arr) => {
                  const isLast = index === arr.length - 1;
                  const active = hotelStep >= step;
                  return (
                    <div key={label} className="flex flex-1 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${
                          active
                            ? "border-white bg-emerald-600 text-white"
                            : "border-white/60 bg-white/30 text-primary-foreground/80"
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-primary-foreground/80">
                          Bước {step}
                        </p>
                        <p className="text-sm font-semibold text-primary-foreground">
                          {label}
                        </p>
                      </div>
                      {!isLast && (
                        <div className="hidden h-px flex-1 bg-gradient-to-r from-white/30 via-white/60 to-white/30 md:block" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-5 md:p-6">
              {isStep1 && (
                <form
                  id="hotel-booking-form"
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Bước 1 · Tìm phòng
                    </p>
                    <h2 className="text-lg font-semibold text-foreground">
                      Nhập điểm đến, ngày ở và số khách
                    </h2>
                  </div>

                  {content}

                  <div className="mt-4 flex justify-end">
                    <Button
                      form="hotel-booking-form"
                      type="submit"
                      size="lg"
                      className="w-full sm:w-auto px-8"
                      disabled={!hotelReady}
                    >
                      Tiếp tục
                    </Button>
                  </div>
                </form>
              )}

              {isStep2 && (
                <div className="space-y-4">
                  <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Bước 2 · Chọn phòng
                      </p>
                      <h2 className="text-lg font-semibold text-foreground">
                        Lựa chọn hạng phòng phù hợp
                      </h2>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-xl border border-muted/60 bg-muted/40 p-4 text-sm md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-emerald-700" />
                      <span className="text-muted-foreground">
                        {formData.hotelCity || "Chưa chọn điểm đến"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-700" />
                      <span className="text-muted-foreground">
                        {formData.hotelCheckIn || "--/--"} →{" "}
                        {formData.hotelCheckOut || "--/--"} ({hotelNights || 1}{" "}
                        đêm)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BedDouble size={16} className="text-emerald-700" />
                      <span className="text-muted-foreground">
                        {hotelGuestSummary}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-emerald-700" />
                      <span className="text-muted-foreground">
                        Ước tính: {hotelEstimate} VND
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {roomOptions.map((room) => {
                      const active = selectedHotelRoom?.name === room.name;
                      return (
                        <button
                          key={room.name}
                          type="button"
                          onClick={() => setSelectedHotelRoom(room)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                            active
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-muted bg-white hover:border-emerald-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-foreground">
                                {room.name}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {room.perks.map((perk) => (
                                  <span
                                    key={perk}
                                    className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"
                                  >
                                    {perk}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-emerald-700">
                                {room.price.toLocaleString("vi-VN")} đ/đêm
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Đặt linh hoạt
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      type="button"
                      onClick={() => setHotelStep(1)}
                    >
                      Quay lại bước 1
                    </Button>
                    <Button
                      className="flex-1 min-w-[180px]"
                      type="button"
                      onClick={() => {
                        if (!hasSelection) {
                          toast.error("Vui lòng chọn hạng phòng");
                          return;
                        }
                        setHotelStep(3);
                      }}
                      disabled={!hasSelection}
                    >
                      Sang bước 3
                    </Button>
                  </div>
                </div>
              )}

              {hotelStep === 3 && (
                <div className="space-y-4">
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Bước 3 · Xác nhận & thanh toán
                    </p>
                    <h2 className="text-lg font-semibold text-foreground">
                      Kiểm tra thông tin đặt phòng
                    </h2>
                  </div>

                  <div className="space-y-2 rounded-xl border border-muted bg-muted/30 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Điểm đến</span>
                      <span className="font-semibold text-foreground">
                        {formData.hotelCity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ngày ở</span>
                      <span className="font-semibold text-foreground">
                        {formData.hotelCheckIn} → {formData.hotelCheckOut} (
                        {hotelNights || 1} đêm)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Hạng phòng</span>
                      <span className="font-semibold text-foreground">
                        {selectedRoom.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Khách & phòng
                      </span>
                      <span className="font-semibold text-foreground">
                        {hotelGuestSummary}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Tổng thanh toán
                      </span>
                      <span className="text-lg font-bold text-emerald-700">
                        {hotelEstimate} VND
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-muted bg-white p-4 shadow-sm text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Tài khoản nguồn
                      </span>
                      <span className="font-semibold text-foreground">
                        559 807 ₫
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Phí giao dịch
                      </span>
                      <span className="font-semibold text-foreground">0 ₫</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      type="button"
                      onClick={() => setHotelStep(2)}
                    >
                      Quay lại bước 2
                    </Button>
                    <Button
                      className="flex-1 min-w-[180px]"
                      type="button"
                      onClick={() => {
                        const result = buildHotelReceipt(formData);
                        navigate("/utilities/result", {
                          state: { result, source: "home" },
                        });
                      }}
                    >
                      Thanh toán và xem biên lai
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Bill detail branch
  if (currentType === "bill" && billService) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-primary to-accent px-6 pb-8 pt-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">
                {billDetailHeaderTitle}
              </h1>
              <p className="text-sm text-primary-foreground/80">
                {headerMeta.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 -mt-4">
          <Card className="p-6 rounded-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              {content}
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-background ${
        currentType === "phone"
          ? "pb-32"
          : currentType === "data" && isMua3G4G
          ? "pb-32"
          : currentType === "flight"
          ? "pb-6"
          : "pb-20"
      }`}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent px-6 pb-8 pt-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              {headerMeta.title}
            </h1>
            <p className="text-sm text-primary-foreground/80">
              {headerMeta.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 -mt-4">
        <Card className="p-6 rounded-2xl">
          <form
            id="utility-main-form"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {content}
          </form>
        </Card>
      </div>

      {/* Sticky bottom button — cho Nạp tiền điện thoại và Mua 3G/4G */}
      {(currentType === "phone" || (currentType === "data" && isMua3G4G)) && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <Button
              form="utility-main-form"
              type="submit"
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              Tiếp tục
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
