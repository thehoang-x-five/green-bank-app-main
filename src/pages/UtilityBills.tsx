// src/pages/UtilityBills.tsx
import { Badge } from "@/components/ui/badge";
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
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import type {
  UtilityFormData,
  UtilityType,
  BillService,
  SeatClass,
  FlightOption,
} from "./utilities/utilityTypes";
import { MOCK_USER_PHONE, validatePhoneNumber } from "./utilities/utilityData";
import {
  buildBillReceipt,
  buildDataReceipt,
  buildFlightReceipt,
  buildHotelReceipt,
  buildMovieReceipt,
  buildPhoneReceipt,
} from "./utilities/buildReceipt";

import UtilityBill from "./utilities/UtilityBill";
import UtilityMobilePhone from "./utilities/UtilityMobilePhone";
import UtilityPhoneTopup from "./utilities/UtilityPhoneTopup";
import UtilityDataPack from "./utilities/UtilityDataPack";
import UtilityFlight from "./utilities/UtilityFlight";
import UtilityMovie from "./utilities/UtilityMovie";
import UtilityHotel from "./utilities/UtilityHotel";

type ReceiptSource = "home" | "mobilePhone";

const headerConfig: Record<
  UtilityType,
  { title: string; subtitle: string; successMsg: string }
> = {
  bill: {
    title: "Hóa đơn",
    subtitle: "Thanh toán các loại hóa đơn điện, nước, di động",
    successMsg: "Thanh toán hóa đơn thành công (demo)!",
  },
  mobilePhone: {
    title: "Điện thoại di động",
    subtitle: "Nạp tiền, mua 3G/4G và xem lịch sử gần đây",
    successMsg: "",
  },
  phone: {
    title: "Nạp tiền điện thoại",
    subtitle: "Nạp tiền nhanh cho thuê bao di động",
    successMsg: "Tạo lệnh nạp tiền điện thoại thành công (demo)!",
  },
  data: {
    title: "Mua 3G/4G",
    subtitle: "Mua gói data 3G/4G cho thuê bao di động",
    successMsg: "Tạo lệnh mua gói 3G/4G thành công (demo)!",
  },
  flight: {
    title: "Đặt vé máy bay",
    subtitle: "Tra cứu, so sánh và chọn vé máy bay (demo)",
    successMsg: "",
  },
  movie: {
    title: "Mua vé xem phim",
    subtitle: "Đặt vé xem phim tại rạp (demo)",
    successMsg: "Tạo yêu cầu đặt vé xem phim thành công (demo)!",
  },
  hotel: {
    title: "Đặt phòng khách sạn",
    subtitle: "Đặt phòng khách sạn trong và ngoài nước (demo)",
    successMsg: "Tạo yêu cầu đặt phòng khách sạn thành công (demo)!",
  },
  insurance: {
    title: "Mua bảo hiểm",
    subtitle: "Tính năng đang được phát triển (demo)",
    successMsg: "Giao dịch bảo hiểm (demo)!",
  },
  all: {
    title: "Tất cả tiện ích",
    subtitle: "Danh sách các tiện ích khác (demo)",
    successMsg: "Tiện ích (demo)!",
  },
};

const isUtilityType = (rawType: string | undefined): rawType is UtilityType =>
  !!rawType && rawType in headerConfig;

const UtilityBills = () => {
  const navigate = useNavigate();
  const { type } = useParams<{ type: UtilityType }>();
  const location = useLocation();
  const currentType: UtilityType = isUtilityType(type) ? type : "bill";
  const fromPage: string | null =
    (location.state as { from?: string } | null)?.from ?? null;
  const isMovieFlow = currentType === "movie";
  const isHotelFlow = currentType === "hotel";

  const { title, subtitle, successMsg } = headerConfig[currentType];

  const [formData, setFormData] = useState<UtilityFormData>({
    billType: "",
    billProvider: "",
    customerCode: "",
    billAmount: "",

    phoneNumber: MOCK_USER_PHONE,
    telco: "",
    topupAmount: "",

    dataPhone: MOCK_USER_PHONE,
    dataTelco: "",
    dataPack: "",

    flightFrom: "",
    flightTo: "",
    flightDate: "",
    flightReturnDate: "",
    flightSeatClass: "all" as SeatClass,
    flightAdult: "1",
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

  const [showMovieErrors, setShowMovieErrors] = useState(false);
  const [showHotelErrors, setShowHotelErrors] = useState(false);

  const [billService, setBillService] = useState<BillService | null>(null);
  const [billSave, setBillSave] = useState(false);

  const [selectedFlight, setSelectedFlight] = useState<FlightOption | null>(
    null
  );
  const [movieStep, setMovieStep] = useState<1 | 2 | 3>(1);
  const [hotelStep, setHotelStep] = useState<1 | 2 | 3>(1);
  const [selectedHotelRoom, setSelectedHotelRoom] = useState<{
    name: string;
    price: number;
    perks: string[];
  } | null>(null);

  const isBillDetail = currentType === "bill" && billService !== null;

  const resetBillDetail = () => {
    setBillService(null);
    setFormData((prev) => ({
      ...prev,
      billType: "",
      billProvider: "",
      customerCode: "",
    }));
    setBillSave(false);
  };

  const handleHeaderBack = () => {
    if (currentType === "mobilePhone") {
      navigate("/utilities/bill");
      return;
    }
    if (currentType === "phone" || currentType === "data") {
      if (fromPage === "mobilePhone") navigate("/utilities/mobilePhone");
      else navigate("/home");
      return;
    }
    navigate("/home");
  };

  const receiptSource: ReceiptSource =
    fromPage === "mobilePhone" ? "mobilePhone" : "home";

  const movieTickets = Math.min(
    10,
    Math.max(1, Number(formData.movieTickets || "1") || 1)
  );
  const isMovieReady =
    formData.movieCinema &&
    formData.movieName &&
    formData.movieDate &&
    formData.movieTime;
  const movieEstimate = (100000 * movieTickets).toLocaleString("vi-VN");

  useEffect(() => {
    if (!isMovieFlow) setShowMovieErrors(false);
  }, [isMovieFlow]);

  useEffect(() => {
    if (!isHotelFlow) {
      setShowHotelErrors(false);
      setHotelStep(1);
      setSelectedHotelRoom(null);
    }
  }, [isHotelFlow]);

  useEffect(() => {
    if (!isMovieFlow || showMovieErrors) return;
    if (
      formData.movieCinema ||
      formData.movieName ||
      formData.movieDate ||
      formData.movieTime
    ) {
      setShowMovieErrors(true);
    }
  }, [
    formData.movieCinema,
    formData.movieDate,
    formData.movieName,
    formData.movieTime,
    isMovieFlow,
    showMovieErrors,
  ]);

  const hotelRoomsCount = Math.max(1, Number(formData.hotelRooms || "1") || 1);
  const hotelNights = (() => {
    if (!formData.hotelCheckIn || !formData.hotelCheckOut) return 0;
    const start = new Date(formData.hotelCheckIn).getTime();
    const end = new Date(formData.hotelCheckOut).getTime();
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  })();
  const hotelReady =
    formData.hotelCity && formData.hotelCheckIn && formData.hotelCheckOut;
  const hotelRoomRate = selectedHotelRoom?.price ?? 850000;
  const hotelEstimate = (
    hotelRoomRate *
    hotelRoomsCount *
    (hotelNights || 1)
  ).toLocaleString("vi-VN");
  const hotelGuestSummary = `${formData.hotelGuests || "1"} khách · ${hotelRoomsCount} phòng`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentType === "flight") return;

    if (currentType === "bill") {
      if (!billService || !formData.billProvider || !formData.customerCode) {
        toast.error(
          "Vui lòng chọn dịch vụ, nhà cung cấp và nhập mã khách hàng"
        );
        return;
      }
      const result = buildBillReceipt({ billService, billSave, formData });
      toast.success(successMsg);
      navigate("/utilities/result", { state: { result, source: "home" } });
      return;
    }

    if (currentType === "phone") {
      if (!formData.phoneNumber || !formData.telco || !formData.topupAmount) {
        toast.error(
          "Vui lòng nhập số điện thoại, nhà mạng và số tiền nạp"
        );
        return;
      }
      if (!validatePhoneNumber(formData.phoneNumber)) {
        toast.error(
          "Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0"
        );
        return;
      }
      const result = buildPhoneReceipt(formData);
      toast.success(successMsg);
      navigate("/utilities/result", {
        state: { result, source: receiptSource },
      });
      return;
    }

    if (currentType === "data") {
      if (!formData.dataPhone || !formData.dataTelco || !formData.dataPack) {
        toast.error(
          "Vui lòng nhập số điện thoại, nhà mạng và gói data"
        );
        return;
      }
      if (!validatePhoneNumber(formData.dataPhone)) {
        toast.error(
          "Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0"
        );
        return;
      }
      const result = buildDataReceipt(formData);
      toast.success(successMsg);
      navigate("/utilities/result", {
        state: { result, source: receiptSource },
      });
      return;
    }

    if (currentType === "movie") {
      setShowMovieErrors(true);
      if (
        !formData.movieCinema ||
        !formData.movieName ||
        !formData.movieDate ||
        !formData.movieTime
      ) {
        toast.error("Vui lòng nhập đầy đủ thông tin vé xem phim");
        return;
      }
      setMovieStep(2);
      return;
    }

    if (currentType === "hotel") {
      setShowHotelErrors(true);
      if (
        !formData.hotelCity ||
        !formData.hotelCheckIn ||
        !formData.hotelCheckOut
      ) {
        toast.error("Vui lòng nhập đủ thành phố và ngày nhận / trả phòng");
        return;
      }
      setHotelStep(2);
      return;
    }

    navigate("/home");
  };

  const content = useMemo(() => {
    switch (currentType) {
      case "bill":
        return (
          <UtilityBill
            formData={formData}
            setFormData={setFormData}
            billService={billService}
            setBillService={setBillService}
            billSave={billSave}
            setBillSave={setBillSave}
            onGoMobilePhone={() => navigate("/utilities/mobilePhone")}
          />
        );
      case "mobilePhone":
        return (
          <UtilityMobilePhone
            onGoTopup={() =>
              navigate("/utilities/phone", { state: { from: "mobilePhone" } })
            }
            onGo3G4G={() =>
              navigate("/utilities/data", {
                state: { from: "mobilePhone", entry: "mobile3g4g" },
              })
            }
            onGoData4G={() =>
              navigate("/utilities/data", { state: { from: "mobilePhone" } })
            }
          />
        );
      case "phone":
        return (
          <UtilityPhoneTopup formData={formData} setFormData={setFormData} />
        );
      case "data":
        return (
          <UtilityDataPack formData={formData} setFormData={setFormData} />
        );
      case "flight":
        return (
          <UtilityFlight
            formData={formData}
            setFormData={setFormData}
            onConfirm={(flight) => {
              setSelectedFlight(flight);
              const result = buildFlightReceipt({
                selectedFlight: flight,
                formData,
              });
              toast.success("Đặt vé máy bay (demo) thành công!");
              navigate("/utilities/result", {
                state: { result, source: "home" },
              });
            }}
          />
        );
      case "movie":
        return (
          <UtilityMovie
            formData={formData}
            setFormData={setFormData}
            showErrors={showMovieErrors}
          />
        );
      case "hotel":
        return (
          <UtilityHotel
            formData={formData}
            setFormData={setFormData}
            showErrors={showHotelErrors}
          />
        );
      default:
        return (
          <p className="text-sm text-muted-foreground">
            Tính năng này đang được nhóm phát triển, màn hình hiện tại chỉ mang
            tính minh họa (demo).
          </p>
        );
    }
  }, [
    currentType,
    formData,
    billService,
    billSave,
    navigate,
    showMovieErrors,
    showHotelErrors,
  ]);

  if (isBillDetail) {
    const label =
      billService === "electric"
        ? "Điện"
        : billService === "water"
        ? "Nước"
        : "Điện thoại di động";

    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-4xl px-0 md:px-6 py-4">
          <Card className="rounded-none md:rounded-2xl md:shadow-lg overflow-hidden">
            <div className="bg-gradient-to-br from-primary to-accent text-primary-foreground px-4 md:px-6 py-3 flex items-center justify-between">
              <button
                type="button"
                onClick={resetBillDetail}
                className="flex items-center gap-1 text-sm font-medium hover:bg-white/10 rounded-full px-3 py-1"
              >
                <ArrowLeft size={18} />
                <span>Dịch vụ</span>
              </button>
              <p className="text-sm md:text-base font-semibold">{label}</p>
              <button
                type="button"
                onClick={resetBillDetail}
                className="text-sm font-medium hover:bg-white/10 rounded-full px-3 py-1"
              >
                Hủy
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="bg-background px-4 md:px-6 py-4 md:py-6 space-y-6"
            >
              {content}
            </form>
          </Card>
        </div>
      </div>
    );
  }

  if (isMovieFlow) {
    const formId = "movie-ticket-form";
    const movieSteps = [
      { label: "Thông tin vé", icon: Clapperboard, step: 1 },
      { label: "Xác nhận", icon: CheckCircle2, step: 2 },
      { label: "Thanh toán", icon: CreditCard, step: 3 },
    ];

    const isStep1 = movieStep === 1;
    const isStep2 = movieStep === 2;

    const handleMoviePay = () => {
      const result = buildMovieReceipt(formData);
      toast.success(headerConfig.movie.successMsg);
      setMovieStep(3);
      navigate("/utilities/result", { state: { result, source: "home" } });
    };

    return (
      <div className="min-h-screen bg-background pb-12">
        <header className="bg-gradient-to-br from-primary to-accent p-6 pb-6">
          <div className="flex w-full flex-col gap-4 px-2 md:flex-row md:items-center md:gap-6 md:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleHeaderBack}
                className="rounded-full border border-white/30 bg-white/10 p-2 text-primary-foreground shadow-sm transition hover:bg-white/20"
              >
                <ArrowLeft size={22} />
              </button>
              <div className="leading-tight">
                <p className="text-xs text-primary-foreground/80">
                  Tiện ích – Thanh toán dịch vụ
                </p>
                <h1 className="text-xl font-semibold text-primary-foreground">
                  Đặt vé xem phim
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="w-full px-4 pb-8 md:px-6 lg:px-10 -mt-4">
          <div className="mx-auto w-full max-w-5xl">
            <Card className="overflow-hidden border-emerald-100 shadow-lg">
              <div className="bg-gradient-to-r from-primary to-accent px-4 py-4 text-primary-foreground">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-80">Bước {movieStep} / 3</p>
                    <h2 className="text-lg font-semibold">Quy trình đặt vé</h2>
                  </div>
                  <Badge className="border-white/40 bg-white/15 text-primary-foreground">
                    An toàn
                  </Badge>
                </div>
                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  {movieSteps.map(({ label, icon: Icon, step }, index) => {
                    const isLast = index === movieSteps.length - 1;
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
                  <form id={formId} onSubmit={handleSubmit}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Bước 1 · Thông tin vé
                        </p>
                        <h2 className="text-lg font-semibold text-foreground">
                          Chọn rạp, phim và suất chiếu
                        </h2>
                      </div>
                      <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700">
                        Nhập nhanh
                      </Badge>
                    </div>
                    <UtilityMovie
                      formData={formData}
                      setFormData={setFormData}
                      showErrors={showMovieErrors}
                    />
                    <div className="mt-4 flex justify-end">
                      <Button
                        form={formId}
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
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Bước 2 · Xác nhận
                        </p>
                        <h2 className="text-lg font-semibold text-foreground">
                          Kiểm tra thông tin vé
                        </h2>
                      </div>
                      <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700">
                        Xác nhận
                      </Badge>
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
                          {formData.movieDate || "--/--"} · {formData.movieTime || "--:--"}
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
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Bước 3 · Thanh toán
                        </p>
                        <h2 className="text-lg font-semibold text-foreground">
                          Chọn phương thức thanh toán
                        </h2>
                      </div>
                      <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700">
                        Thanh toán
                      </Badge>
                    </div>
                    <div className="space-y-3 rounded-xl border border-muted bg-muted/30 p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tài khoản nguồn</span>
                        <span className="font-semibold text-foreground">559 807 ₫</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Phí giao dịch</span>
                        <span className="font-semibold text-foreground">0 ₫</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tổng thanh toán</span>
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
                        onClick={handleMoviePay}
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
      </div>
    );
  }

  if (isHotelFlow) {
    const formId = "hotel-booking-form";
    const hotelSteps = [
      { label: "Tìm phòng", icon: MapPin, step: 1 },
      { label: "Chọn phòng", icon: BedDouble, step: 2 },
      { label: "Xác nhận & thanh toán", icon: CreditCard, step: 3 },
    ];

    const roomOptions = [
      {
        name: "Phòng tiêu chuẩn",
        price: 850000,
        perks: ["Miễn phí Wi-Fi", "Hủy miễn phí 24h", "Bao gồm bữa sáng"],
      },
      {
        name: "Deluxe City View",
        price: 1150000,
        perks: ["View thành phố", "Nhận phòng sớm", "Được nâng hạng khi còn phòng"],
      },
      {
        name: "Suite Executive",
        price: 1550000,
        perks: ["Late checkout", "Mini bar miễn phí", "Ưu tiên đỗ xe"],
      },
    ];

    const isStep1 = hotelStep === 1;
    const isStep2 = hotelStep === 2;
    const hasSelection = !!selectedHotelRoom;
    const selectedRoom = selectedHotelRoom || roomOptions[0];

    const handleHotelPay = () => {
      const room = selectedHotelRoom || roomOptions[0];
      const result = buildHotelReceipt(formData, {
        nights: hotelNights || 1,
        roomName: room?.name ?? "Phòng tiêu chuẩn",
        nightlyRate: room?.price ?? 850000,
      });
      toast.success(headerConfig.hotel.successMsg);
      setHotelStep(3);
      navigate("/utilities/result", { state: { result, source: "home" } });
    };

    return (
      <div className="min-h-screen bg-background pb-12">
        <header className="bg-gradient-to-br from-primary to-accent p-6 pb-6">
          <div className="flex w-full flex-col gap-4 px-2 md:flex-row md:items-center md:gap-6 md:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleHeaderBack}
                className="rounded-full border border-white/30 bg-white/10 p-2 text-primary-foreground shadow-sm transition hover:bg-white/20"
              >
                <ArrowLeft size={22} />
              </button>
              <div className="leading-tight">
                <p className="text-xs text-primary-foreground/80">
                  Tiện ích – Du lịch & nghỉ dưỡng
                </p>
                <h1 className="text-xl font-semibold text-primary-foreground">
                  Đặt phòng khách sạn
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="w-full px-4 pb-8 md:px-6 lg:px-10 -mt-4">
          <div className="mx-auto w-full max-w-5xl">
            <Card className="overflow-hidden border-emerald-100 shadow-lg">
              <div className="bg-gradient-to-r from-primary to-accent px-4 py-4 text-primary-foreground">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-80">Bước {hotelStep} / 3</p>
                    <h2 className="text-lg font-semibold">Quy trình đặt phòng</h2>
                  </div>
                  <Badge className="border-white/40 bg-white/15 text-primary-foreground">
                    An toàn
                  </Badge>
                </div>
                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  {hotelSteps.map(({ label, icon: Icon, step }, index) => {
                    const isLast = index === hotelSteps.length - 1;
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
                  <form id={formId} onSubmit={handleSubmit} className="space-y-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Bước 1 · Tìm phòng
                        </p>
                        <h2 className="text-lg font-semibold text-foreground">
                          Nhập điểm đến, ngày ở và số khách
                        </h2>
                      </div>
                      <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700">
                        Tìm nhanh
                      </Badge>
                    </div>
                    <UtilityHotel
                      formData={formData}
                      setFormData={setFormData}
                      showErrors={showHotelErrors}
                    />
                    <div className="mt-4 flex justify-end">
                      <Button
                        form={formId}
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
                      <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700">
                        Tối đa 5 phòng
                      </Badge>
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
                          {formData.hotelCheckOut || "--/--"} ({hotelNights || 1} đêm)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BedDouble size={16} className="text-emerald-700" />
                        <span className="text-muted-foreground">{hotelGuestSummary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-emerald-700" />
                        <span className="text-muted-foreground">Ước tính: {hotelEstimate} VND</span>
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
                                <p className="text-base font-semibold text-foreground">{room.name}</p>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {room.perks.map((perk) => (
                                    <Badge
                                      key={perk}
                                      variant="secondary"
                                      className="border-emerald-100 bg-emerald-50 text-emerald-700"
                                    >
                                      {perk}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-emerald-700">
                                  {room.price.toLocaleString("vi-VN")} đ/đêm
                                </p>
                                <p className="text-xs text-muted-foreground">Đặt linh hoạt</p>
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
                        onClick={() => setHotelStep(3)}
                        disabled={!hasSelection}
                      >
                        Sang bước 3
                      </Button>
                    </div>
                  </div>
                )}

                {hotelStep === 3 && (
                  <div className="space-y-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Bước 3 · Xác nhận & thanh toán
                        </p>
                        <h2 className="text-lg font-semibold text-foreground">
                          Kiểm tra thông tin đặt phòng
                        </h2>
                      </div>
                      <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700">
                        Bảo mật
                      </Badge>
                    </div>
                    <div className="space-y-2 rounded-xl border border-muted bg-muted/30 p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Điểm đến</span>
                        <span className="font-semibold text-foreground">{formData.hotelCity}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Ngày ở</span>
                        <span className="font-semibold text-foreground">
                          {formData.hotelCheckIn} → {formData.hotelCheckOut} ({hotelNights || 1} đêm)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Hạng phòng</span>
                        <span className="font-semibold text-foreground">{selectedRoom.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Khách & phòng</span>
                        <span className="font-semibold text-foreground">{hotelGuestSummary}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tổng thanh toán</span>
                        <span className="text-lg font-bold text-emerald-700">{hotelEstimate} VND</span>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-muted bg-white p-4 shadow-sm text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tài khoản nguồn</span>
                        <span className="font-semibold text-foreground">559 807 ₫</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Phí giao dịch</span>
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
                        onClick={handleHotelPay}
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
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-background ${
        currentType === "flight" ? "pb-6" : "pb-20"
      }`}
    >
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={handleHeaderBack}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              {title}
            </h1>
            <p className="text-sm text-primary-foreground/80">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {content}
          </form>
        </Card>
      </div>
    </div>
  );
};

export default UtilityBills;
