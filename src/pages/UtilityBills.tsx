// src/pages/UtilityBills.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type {
  UtilityFormData,
  UtilityType,
  BillService,
  SeatClass,
  FlightOption,
} from "./utilities/utilityTypes";
import {
  buildBillReceipt,
  buildDataReceipt,
  buildFlightReceipt,
  buildHotelReceipt,
  buildMovieReceipt,
  buildPhoneReceipt,
} from "./utilities/buildReceipt";

import { detectTelcoByPhone, MOCK_USER_PHONE } from "./utilities/utilityData";
import UtilityBill from "./utilities/UtilityBill";
import UtilityMobilePhone from "./utilities/UtilityMobilePhone";
import UtilityPhoneTopup from "./utilities/UtilityPhoneTopup";
import UtilityDataPack from "./utilities/UtilityDataPack";
import UtilityFlight from "./utilities/UtilityFlight";
import UtilityMovie from "./utilities/UtilityMovie";
import UtilityHotel from "./utilities/UtilityHotel";

type UtilityEntry = "home" | "bill" | "mobileBill" | "mobile3g4g";

type FlightUiHandle = {
  goBack: () => boolean;
};

export default function UtilityBills() {
  const navigate = useNavigate();
  const location = useLocation();
  const flightUiRef = useRef<FlightUiHandle | null>(null);

  const entry: UtilityEntry = (location.state as any)?.entry ?? "home";
  const { type } = useParams<{ type: UtilityType }>();
  const routeType: UtilityType = (type as UtilityType) ?? "bill";

  const [currentType, setCurrentType] = useState<UtilityType>(routeType);
  const [billService, setBillService] = useState<BillService | null>(null);
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

  const [movieStep, setMovieStep] = useState<1 | 2 | 3>(1);
  const [hotelStep, setHotelStep] = useState<1 | 2 | 3>(1);
  const [selectedHotelRoom, setSelectedHotelRoom] = useState<{
    name: string;
    price: number;
    perks: string[];
  } | null>(null);

  // Sync state with URL param
  useEffect(() => {
    if (routeType === currentType) return;
    setCurrentType(routeType);
    if (routeType !== "bill") setBillService(null);
  }, [routeType, currentType]);

  // Reset steps when changing type
  useEffect(() => {
    if (currentType !== "movie") setMovieStep(1);
    if (currentType !== "hotel") {
      setHotelStep(1);
      setSelectedHotelRoom(null);
    }
  }, [currentType]);

  const isData4GTopup = useMemo(() => {
    return entry === "home" || entry === "mobileBill";
  }, [entry]);

  const isMua3G4G = useMemo(() => {
    return entry === "mobile3g4g";
  }, [entry]);

  const goToType = (
    t: UtilityType,
    opts?: { replace?: boolean; state?: any }
  ) => {
    navigate(`/utilities/${t}`, {
      replace: opts?.replace ?? false,
      state: opts?.state,
    });
  };

  const handleBack = () => {
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

    if (currentType === "phone" || currentType === "data") {
      if (entry === "mobileBill" || entry === "mobile3g4g") {
        navigate("/utilities/mobilePhone", {
          replace: true,
          state: { entry: "bill", _t: Date.now() },
        });
        return;
      }
      navigate("/home");
      return;
    }

    navigate("/home");
  };

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
      case "data":
        return isData4GTopup
          ? {
              title: "Data 4G/Nạp tiền",
              subtitle: "Nạp data 4G hoặc nạp tiền cho thuê bao (demo)",
            }
          : {
              title: "Mua 3G/4G",
              subtitle: "Mua gói data 3G/4G cho thuê bao di động",
            };
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

    if (currentType === "movie") {
      if (movieStep === 1) {
        const isReady = formData.movieCinema && formData.movieName && formData.movieDate && formData.movieTime;
        if (!isReady) {
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
      if (movieStep === 3) {
        const result = buildMovieReceipt(formData);
        navigate("/utilities/result", { state: { result, source: "home" } });
        return;
      }
    }

    if (currentType === "hotel") {
      if (hotelStep === 1) {
        const isReady = formData.hotelCity && formData.hotelCheckIn && formData.hotelCheckOut;
        if (!isReady) {
          toast.error("Vui lòng nhập đủ thành phố và ngày nhận / trả phòng");
          return;
        }
        setHotelStep(2);
        return;
      }
      if (hotelStep === 2) {
        setHotelStep(3);
        return;
      }
      if (hotelStep === 3) {
        const room = selectedHotelRoom || { name: "Phòng tiêu chuẩn", price: 850000 };
        const result = buildHotelReceipt(formData, {
          nights: 1,
          roomName: room.name,
          nightlyRate: room.price,
        });
        navigate("/utilities/result", { state: { result, source: "home" } });
        return;
      }
    }
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
        <div id="utility-mobilephone-screen">
          <UtilityMobilePhone
            onGoTopup={() =>
              goToType("phone", { state: { entry: "mobileBill" } })
            }
            onGo3G4G={() => goToType("data", { state: { entry: "mobile3g4g" } })}
            onGoData4G={() =>
              goToType("data", { state: { entry: "mobileBill" } })
            }
          />
        </div>
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

    if (currentType === "movie") {
      return (
        <UtilityMovie
          formData={formData}
          setFormData={setFormData}
          showErrors={false}
        />
      );
    }

    if (currentType === "hotel") {
      return (
        <UtilityHotel
          formData={formData}
          setFormData={setFormData}
          showErrors={false}
        />
      );
    }

    return null;
  };

  const content = renderContent();

  // Bill detail branch
  if (currentType === "bill" && billService) {
    const billDetailHeaderTitle =
      billService === "electric"
        ? "Thanh toán hóa đơn Điện"
        : billService === "water"
        ? "Thanh toán hóa đơn Nước"
        : "Thanh toán hóa đơn";

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

      {/* Sticky bottom button */}
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