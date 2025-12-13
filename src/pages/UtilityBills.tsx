// src/pages/UtilityBills.tsx
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import type {
  UtilityFormData,
  UtilityType,
  BillService,
  SeatClass,
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

// pages
import UtilityBill from "./utilities/UtilityBill";
import UtilityMobilePhone from "./utilities/UtilityMobilePhone";
import UtilityPhoneTopup from "./utilities/UtilityPhoneTopup";
import UtilityDataPack from "./utilities/UtilityDataPack";
import UtilityFlight from "./utilities/UtilityFlight";
import UtilityMovie from "./utilities/UtilityMovie";
import UtilityHotel from "./utilities/UtilityHotel";

// ✅ [PATCH] thêm type để UtilityReceipt biết back về đâu
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

const UtilityBills = () => {
  const navigate = useNavigate();
  const { type } = useParams<{ type: UtilityType }>();
  const location = useLocation();
  const currentType: UtilityType = type ?? "bill";
  const fromPage: string | null = (location.state as any)?.from ?? null;

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

  // bill-only UI states
  const [billService, setBillService] = useState<BillService | null>(null);
  const [billSave, setBillSave] = useState(false);

  // flight selected (receipt build)
  const [selectedFlight, setSelectedFlight] = useState<any>(null);

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

  // ✅ [PATCH] source quyết định nút back ở Receipt sẽ về đâu
  const receiptSource: ReceiptSource =
    fromPage === "mobilePhone" ? "mobilePhone" : "home";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentType === "flight") return; // flight tự confirm riêng

    // validate theo tiện ích
    if (currentType === "bill") {
      if (!billService || !formData.billProvider || !formData.customerCode) {
        toast.error(
          "Vui lòng chọn dịch vụ, nhà cung cấp và nhập mã khách hàng"
        );
        return;
      }
      const result = buildBillReceipt({ billService, billSave, formData });
      toast.success(successMsg);
      // ✅ [PATCH] truyền source
      navigate("/utilities/result", { state: { result, source: "home" } });
      return;
    }

    if (currentType === "phone") {
      if (!formData.phoneNumber || !formData.telco || !formData.topupAmount) {
        toast.error("Vui lòng nhập số điện thoại, nhà mạng và số tiền nạp");
        return;
      }
      if (!validatePhoneNumber(formData.phoneNumber)) {
        toast.error("Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0");
        return;
      }
      const result = buildPhoneReceipt(formData);
      toast.success(successMsg);
      // ✅ [PATCH] nếu đi từ Trang chủ -> source=home; nếu đi từ MobilePhone -> source=mobilePhone
      navigate("/utilities/result", {
        state: { result, source: receiptSource },
      });
      return;
    }

    if (currentType === "data") {
      if (!formData.dataPhone || !formData.dataTelco || !formData.dataPack) {
        toast.error("Vui lòng nhập số điện thoại, nhà mạng và gói data");
        return;
      }
      if (!validatePhoneNumber(formData.dataPhone)) {
        toast.error("Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0");
        return;
      }
      const result = buildDataReceipt(formData);
      toast.success(successMsg);
      // ✅ [PATCH] source đúng theo nơi khởi tạo
      navigate("/utilities/result", {
        state: { result, source: receiptSource },
      });
      return;
    }

    if (currentType === "movie") {
      if (
        !formData.movieCinema ||
        !formData.movieName ||
        !formData.movieDate ||
        !formData.movieTime
      ) {
        toast.error("Vui lòng nhập đầy đủ thông tin vé xem phim");
        return;
      }
      const result = buildMovieReceipt(formData);
      toast.success(successMsg);
      // ✅ [PATCH] movie thường từ Trang chủ
      navigate("/utilities/result", { state: { result, source: "home" } });
      return;
    }

    if (currentType === "hotel") {
      if (
        !formData.hotelCity ||
        !formData.hotelCheckIn ||
        !formData.hotelCheckOut
      ) {
        toast.error("Vui lòng nhập thành phố và ngày nhận/trả phòng");
        return;
      }
      const result = buildHotelReceipt(formData);
      toast.success(successMsg);
      // ✅ [PATCH] hotel thường từ Trang chủ
      navigate("/utilities/result", { state: { result, source: "home" } });
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
            onGoData={() =>
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
              // ✅ [PATCH] flight thường từ Trang chủ
              navigate("/utilities/result", {
                state: { result, source: "home" },
              });
            }}
          />
        );
      case "movie":
        return <UtilityMovie formData={formData} setFormData={setFormData} />;
      case "hotel":
        return <UtilityHotel formData={formData} setFormData={setFormData} />;
      default:
        return (
          <p className="text-sm text-muted-foreground">
            Tính năng này đang được nhóm phát triển, màn hình hiện tại chỉ mang
            tính minh họa (demo).
          </p>
        );
    }
  }, [currentType, formData, billService, billSave, navigate]);

  // BILL DETAIL special header (giữ đúng UI như anh)
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
