// src/pages/UtilityBills.tsx
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

type UtilityType =
  | "bill"
  | "phone"
  | "data"
  | "flight"
  | "movie"
  | "hotel"
  | "insurance"
  | "all";

const UtilityBills = () => {
  const navigate = useNavigate();
  const { type } = useParams<{ type: UtilityType }>();
  const currentType: UtilityType = type ?? "bill";

  // State chung cho tất cả form (dùng từng phần tùy type)
  const [formData, setFormData] = useState({
    // bill
    billType: "",
    customerCode: "",
    billAmount: "",

    // phone
    phoneNumber: "",
    telco: "",
    topupAmount: "",

    // data
    dataPhone: "",
    dataTelco: "",
    dataPack: "",

    // flight
    flightFrom: "",
    flightTo: "",
    flightDate: "",
    flightPassengers: "1",

    // movie
    movieCinema: "",
    movieName: "",
    movieDate: "",
    movieTime: "",
    movieTickets: "1",

    // hotel
    hotelCity: "",
    hotelCheckIn: "",
    hotelCheckOut: "",
    hotelGuests: "1",
    hotelRooms: "1",
  });

  const headerConfig: Record<
    UtilityType,
    { title: string; subtitle: string; successMsg: string }
  > = {
    bill: {
      title: "Thanh toán hóa đơn",
      subtitle: "Thanh toán hóa đơn điện, nước, Internet…",
      successMsg: "Thanh toán hóa đơn thành công (demo)!",
    },
    phone: {
      title: "Nạp tiền điện thoại",
      subtitle: "Nạp tiền nhanh cho thuê bao di động",
      successMsg: "Tạo lệnh nạp tiền điện thoại thành công (demo)!",
    },
    data: {
      title: "Nạp data 4G",
      subtitle: "Mua gói data 4G cho thuê bao di động",
      successMsg: "Tạo lệnh nạp data 4G thành công (demo)!",
    },
    flight: {
      title: "Mua vé máy bay",
      subtitle: "Đặt vé máy bay nội địa, quốc tế (demo)",
      successMsg: "Tạo yêu cầu đặt vé máy bay thành công (demo)!",
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

  const { title, subtitle, successMsg } = headerConfig[currentType];

  const getTelcoLabel = (code: string) => {
    switch (code) {
      case "viettel":
        return "Viettel";
      case "vina":
        return "VinaPhone";
      case "mobi":
        return "MobiFone";
      default:
        return code || "-";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // --- Validate theo từng loại tiện ích ---
    switch (currentType) {
      case "bill": {
        if (!formData.billType || !formData.customerCode) {
          toast.error("Vui lòng chọn loại hóa đơn và nhập mã khách hàng");
          return;
        }
        break;
      }
      case "phone": {
        if (!formData.phoneNumber || !formData.telco || !formData.topupAmount) {
          toast.error("Vui lòng nhập số điện thoại, nhà mạng và số tiền nạp");
          return;
        }
        break;
      }
      case "data": {
        if (!formData.dataPhone || !formData.dataTelco || !formData.dataPack) {
          toast.error("Vui lòng nhập số điện thoại, nhà mạng và gói data");
          return;
        }
        break;
      }
      case "flight": {
        if (
          !formData.flightFrom ||
          !formData.flightTo ||
          !formData.flightDate
        ) {
          toast.error("Vui lòng nhập đầy đủ thông tin chuyến bay");
          return;
        }
        break;
      }
      case "movie": {
        if (
          !formData.movieCinema ||
          !formData.movieName ||
          !formData.movieDate ||
          !formData.movieTime
        ) {
          toast.error("Vui lòng nhập đầy đủ thông tin vé xem phim");
          return;
        }
        break;
      }
      case "hotel": {
        if (
          !formData.hotelCity ||
          !formData.hotelCheckIn ||
          !formData.hotelCheckOut
        ) {
          toast.error("Vui lòng nhập thành phố và ngày nhận/trả phòng");
          return;
        }
        break;
      }
      default:
        break;
    }

    const now = new Date();
    let result: any = null;

    // --- Build dữ liệu chi tiết để gửi sang UtilityReceipt ---
    switch (currentType) {
      case "bill": {
        const title =
          formData.billType === "electric"
            ? "Thanh toán hóa đơn điện"
            : formData.billType === "water"
            ? "Thanh toán hóa đơn nước"
            : "Thanh toán hóa đơn dịch vụ";
        result = {
          flow: "bill",
          amount: "350.000", // demo, có thể thay bằng số thật
          title,
          time: now.toLocaleString("vi-VN"),
          fee: "0 đ",
          transactionId: "HD-BILL-" + now.getTime(),
          details: [
            {
              label: "Loại hóa đơn",
              value:
                formData.billType === "electric"
                  ? "Điện"
                  : formData.billType === "water"
                  ? "Nước"
                  : formData.billType === "internet"
                  ? "Internet/Truyền hình"
                  : formData.billType === "gas"
                  ? "Gas"
                  : "-",
            },
            { label: "Mã khách hàng", value: formData.customerCode },
          ],
        };
        break;
      }
      case "phone": {
        const amount = formData.topupAmount || "50.000";
        result = {
          flow: "phone",
          amount,
          title: "Nạp tiền điện thoại",
          time: now.toLocaleString("vi-VN"),
          fee: "0 đ",
          transactionId: "HD-TOPUP-" + now.getTime(),
          details: [
            { label: "Số điện thoại", value: formData.phoneNumber },
            { label: "Nhà mạng", value: getTelcoLabel(formData.telco) },
          ],
        };
        break;
      }
      case "data": {
        // Demo: gán sẵn số tiền theo gói
        const dataAmount =
          formData.dataPack === "1gb"
            ? "20.000"
            : formData.dataPack === "5gb"
            ? "70.000"
            : formData.dataPack === "unlimited"
            ? "200.000"
            : "0";
        result = {
          flow: "data",
          amount: dataAmount,
          title: "Nạp data 4G",
          time: now.toLocaleString("vi-VN"),
          fee: "0 đ",
          transactionId: "HD-DATA-" + now.getTime(),
          details: [
            { label: "Số điện thoại", value: formData.dataPhone },
            { label: "Nhà mạng", value: getTelcoLabel(formData.dataTelco) },
            {
              label: "Gói data",
              value:
                formData.dataPack === "1gb"
                  ? "Gói 1GB/ngày"
                  : formData.dataPack === "5gb"
                  ? "Gói 5GB/7 ngày"
                  : formData.dataPack === "unlimited"
                  ? "Gói không giới hạn (tháng)"
                  : "-",
            },
          ],
        };
        break;
      }
      case "flight": {
        const passengers = Number(formData.flightPassengers || "1");
        const amountNumber = 1500000 * (isNaN(passengers) ? 1 : passengers);
        const amount = amountNumber.toLocaleString("vi-VN");
        result = {
          flow: "flight",
          amount,
          title: "Mua vé máy bay",
          time: now.toLocaleString("vi-VN"),
          fee: "0 đ",
          transactionId: "HD-FLIGHT-" + now.getTime(),
          details: [
            { label: "Nơi đi", value: formData.flightFrom },
            { label: "Nơi đến", value: formData.flightTo },
            { label: "Ngày bay", value: formData.flightDate },
            {
              label: "Số hành khách",
              value: String(passengers || 1),
            },
          ],
        };
        break;
      }
      case "movie": {
        const tickets = Number(formData.movieTickets || "1");
        const amountNumber = 100000 * (isNaN(tickets) ? 1 : tickets);
        const amount = amountNumber.toLocaleString("vi-VN");
        result = {
          flow: "movie",
          amount,
          title: "Mua vé xem phim",
          time: now.toLocaleString("vi-VN"),
          fee: "0 đ",
          transactionId: "HD-MOVIE-" + now.getTime(),
          details: [
            { label: "Rạp chiếu", value: formData.movieCinema },
            { label: "Tên phim", value: formData.movieName },
            { label: "Ngày chiếu", value: formData.movieDate },
            { label: "Suất chiếu", value: formData.movieTime },
            { label: "Số lượng vé", value: String(tickets || 1) },
          ],
        };
        break;
      }
      case "hotel": {
        const rooms = Number(formData.hotelRooms || "1");
        const amountNumber = 800000 * (isNaN(rooms) ? 1 : rooms);
        const amount = amountNumber.toLocaleString("vi-VN");
        result = {
          flow: "hotel",
          amount,
          title: "Đặt phòng khách sạn",
          time: now.toLocaleString("vi-VN"),
          fee: "0 đ",
          transactionId: "HD-HOTEL-" + now.getTime(),
          details: [
            { label: "Thành phố / Khu vực", value: formData.hotelCity },
            { label: "Ngày nhận phòng", value: formData.hotelCheckIn },
            { label: "Ngày trả phòng", value: formData.hotelCheckOut },
            { label: "Số khách", value: String(formData.hotelGuests || "1") },
            { label: "Số phòng", value: String(rooms || 1) },
          ],
        };
        break;
      }
      default: {
        // các tiện ích demo khác chưa có màn chi tiết
        result = null;
        break;
      }
    }

    toast.success(successMsg);

    if (result) {
      navigate("/utilities/result", {
        state: { result },
      });
    } else {
      // fallback cho các type chưa hỗ trợ chi tiết
      navigate("/home");
    }
  };

  // ==== RENDER FORM THEO TỪNG TYPE ====

  const renderBillForm = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="billType">
          Loại hóa đơn <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.billType}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, billType: value }))
          }
        >
          <SelectTrigger id="billType">
            <SelectValue placeholder="Chọn loại hóa đơn" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="electric">Hóa đơn điện</SelectItem>
            <SelectItem value="water">Hóa đơn nước</SelectItem>
            <SelectItem value="internet">Internet/Truyền hình</SelectItem>
            <SelectItem value="gas">Hóa đơn gas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerCode">
          Mã khách hàng <span className="text-destructive">*</span>
        </Label>
        <Input
          id="customerCode"
          type="text"
          placeholder="Nhập mã khách hàng"
          value={formData.customerCode}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              customerCode: e.target.value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Số tiền</Label>
        <Input
          id="amount"
          type="text"
          placeholder="Số tiền sẽ được tự động điền (demo)"
          value={formData.billAmount}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Số tiền sẽ được lấy tự động sau khi nhập mã khách hàng (giao diện
          demo).
        </p>
      </div>
    </>
  );

  const renderPhoneForm = () => (
    <>
      <div className="space-y-2">
        <Label>
          Số điện thoại <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Nhập số điện thoại"
          value={formData.phoneNumber}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>
          Nhà mạng <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.telco}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, telco: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn nhà mạng" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viettel">Viettel</SelectItem>
            <SelectItem value="vina">VinaPhone</SelectItem>
            <SelectItem value="mobi">MobiFone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>
          Số tiền nạp <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: 50.000"
          value={formData.topupAmount}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, topupAmount: e.target.value }))
          }
        />
        <p className="text-xs text-muted-foreground">
          Đây là giao diện demo, chưa kết nối nhà mạng.
        </p>
      </div>
    </>
  );

  const renderDataForm = () => (
    <>
      <div className="space-y-2">
        <Label>
          Số điện thoại <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Nhập số điện thoại"
          value={formData.dataPhone}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, dataPhone: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>
          Nhà mạng <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.dataTelco}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, dataTelco: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn nhà mạng" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viettel">Viettel</SelectItem>
            <SelectItem value="vina">VinaPhone</SelectItem>
            <SelectItem value="mobi">MobiFone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>
          Gói data <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.dataPack}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, dataPack: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn gói data" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1gb">Gói 1GB/ngày</SelectItem>
            <SelectItem value="5gb">Gói 5GB/7 ngày</SelectItem>
            <SelectItem value="unlimited">
              Gói không giới hạn (tháng)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  const renderFlightForm = () => (
    <>
      <div className="space-y-2">
        <Label>
          Nơi đi <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: TP. Hồ Chí Minh"
          value={formData.flightFrom}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, flightFrom: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>
          Nơi đến <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: Hà Nội"
          value={formData.flightTo}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, flightTo: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>
          Ngày bay <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          value={formData.flightDate}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, flightDate: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Số hành khách</Label>
        <Input
          type="number"
          min={1}
          value={formData.flightPassengers}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              flightPassengers: e.target.value,
            }))
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Đây là giao diện demo mô phỏng bước nhập thông tin đặt vé.
      </p>
    </>
  );

  const renderMovieForm = () => (
    <>
      <div className="space-y-2">
        <Label>
          Rạp chiếu <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: CGV Vincom Landmark"
          value={formData.movieCinema}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieCinema: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>
          Tên phim <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: Avengers: Endgame"
          value={formData.movieName}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieName: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>
          Ngày chiếu <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          value={formData.movieDate}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieDate: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>
          Suất chiếu <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: 19:30"
          value={formData.movieTime}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieTime: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Số lượng vé</Label>
        <Input
          type="number"
          min={1}
          value={formData.movieTickets}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieTickets: e.target.value }))
          }
        />
      </div>
    </>
  );

  const renderHotelForm = () => (
    <>
      <div className="space-y-2">
        <Label>
          Thành phố / Khu vực <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: Đà Nẵng"
          value={formData.hotelCity}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelCity: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>
          Ngày nhận phòng <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          value={formData.hotelCheckIn}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelCheckIn: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>
          Ngày trả phòng <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          value={formData.hotelCheckOut}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelCheckOut: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Số khách</Label>
        <Input
          type="number"
          min={1}
          value={formData.hotelGuests}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelGuests: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Số phòng</Label>
        <Input
          type="number"
          min={1}
          value={formData.hotelRooms}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelRooms: e.target.value }))
          }
        />
      </div>
    </>
  );

  const renderComingSoon = () => (
    <p className="text-sm text-muted-foreground">
      Tính năng này đang được nhóm phát triển, màn hình hiện tại chỉ mang tính
      minh họa (demo).
    </p>
  );

  const renderFormByType = () => {
    switch (currentType) {
      case "bill":
        return renderBillForm();
      case "phone":
        return renderPhoneForm();
      case "data":
        return renderDataForm();
      case "flight":
        return renderFlightForm();
      case "movie":
        return renderMovieForm();
      case "hotel":
        return renderHotelForm();
      default:
        return renderComingSoon();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/home")}
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

      {/* Body */}
      <div className="px-6 -mt-4">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {renderFormByType()}
            <Button type="submit" className="w-full">
              Tiếp tục
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default UtilityBills;
