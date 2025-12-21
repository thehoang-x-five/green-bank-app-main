import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useEkycCheck } from "@/hooks/useEkycCheck";
import type {
  UtilityFormData,
  UtilityType,
  BillService,
  SeatClass,
  FlightOption,
} from "./utilities/utilityTypes";
import {
  buildBillReceipt,
  buildFlightReceipt,
  buildHotelReceipt,
  buildMovieReceipt,
} from "./utilities/buildReceipt";

import { detectTelcoByPhone, MOCK_USER_PHONE } from "./utilities/utilityData";
import UtilityBill from "./utilities/UtilityBill";
import UtilityMobilePhone from "./utilities/UtilityMobilePhone";
import UtilityPhoneTopup from "./utilities/UtilityPhoneTopup";
import UtilityDataPack from "./utilities/UtilityDataPack";
import UtilityFlight from "./utilities/UtilityFlight";
import UtilityMovie from "./utilities/UtilityMovie";
import UtilityHotel from "./utilities/UtilityHotel";
import { fbAuth, fbRtdb } from "@/lib/firebase";
import { ref, get } from "firebase/database";

type UtilityEntry = "home" | "bill" | "mobileBill" | "mobile3g4g";

type FlightUiHandle = {
  goBack: () => boolean;
};

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  balance: number;
}

export default function UtilityBills() {
  const navigate = useNavigate();
  const location = useLocation();
  const flightUiRef = useRef<FlightUiHandle | null>(null);
  const { isVerified } = useEkycCheck();

  const entry: UtilityEntry = (location.state as any)?.entry ?? "home";
  const { type } = useParams<{ type: UtilityType }>();
  const routeType: UtilityType = (type as UtilityType) ?? "bill";

  const [currentType, setCurrentType] = useState<UtilityType>(routeType);
  const [billService, setBillService] = useState<BillService | null>(null);

  const initTelco = detectTelcoByPhone(MOCK_USER_PHONE);

  // ✅ [FLIGHT-PAYMENT] State for flight payment
  const [showFlightPaymentModal, setShowFlightPaymentModal] = useState(false);
  const [selectedFlightForPayment, setSelectedFlightForPayment] =
    useState<FlightOption | null>(null);
  const [flightAccounts, setFlightAccounts] = useState<Account[]>([]);
  const [selectedFlightAccountId, setSelectedFlightAccountId] =
    useState<string>("");
  const [loadingFlightAccounts, setLoadingFlightAccounts] = useState(false);
  const [processingFlightPayment, setProcessingFlightPayment] = useState(false);

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
  }, [routeType, currentType, location.key]); // ✅ Add location.key to force re-sync

  // Reset steps when changing type
  useEffect(() => {
    // ✅ Use routeType directly instead of currentType
    if (routeType !== "movie") setMovieStep(1);
    if (routeType !== "hotel") {
      setHotelStep(1);
      setSelectedHotelRoom(null);
    }
  }, [routeType]); // ✅ Change dependency to routeType

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
    // ✅ Use routeType directly instead of currentType
    if (routeType === "flight") {
      const handled = flightUiRef.current?.goBack?.() ?? false;
      if (handled) return;
    }

    if (routeType === "bill" && billService) {
      setBillService(null);
      return;
    }

    if (routeType === "mobilePhone") {
      if (entry === "bill") goToType("bill");
      else navigate("/home");
      return;
    }

    if (routeType === "phone" || routeType === "data") {
      if (entry === "mobileBill" || entry === "mobile3g4g") {
        // ✅ Navigate with key to force component re-render
        navigate("/utilities/mobilePhone", {
          replace: false,
          state: { entry: "bill", key: Date.now() },
        });
        return;
      }
      navigate("/home");
      return;
    }

    navigate("/home");
  };

  // ✅ [FLIGHT-PAYMENT] Load accounts for flight payment
  const loadFlightAccounts = async () => {
    const user = fbAuth.currentUser;
    if (!user) {
      toast.error("Vui lòng đăng nhập");
      navigate("/login");
      return;
    }

    setLoadingFlightAccounts(true);
    try {
      const accountsRef = ref(fbRtdb, "accounts");
      const snap = await get(accountsRef);

      if (!snap.exists()) {
        setFlightAccounts([]);
        toast.error("Bạn chưa có tài khoản thanh toán");
        setLoadingFlightAccounts(false);
        return;
      }

      const accountList: Account[] = [];
      snap.forEach((child) => {
        const v = child.val();
        if (v?.uid === user.uid) {
          const balance =
            typeof v.balance === "number" ? v.balance : Number(v.balance || 0);
          accountList.push({
            id: child.key ?? "",
            accountNumber: child.key ?? "",
            accountType: v.accountType || "Tài khoản thanh toán",
            balance: balance,
          });
        }
        return false;
      });

      setFlightAccounts(accountList);

      if (accountList.length === 0) {
        toast.error("Bạn chưa có tài khoản thanh toán");
      } else {
        // Auto-select first account
        setSelectedFlightAccountId(accountList[0].id);
      }
    } catch (error) {
      console.error("Error loading flight accounts:", error);
      toast.error("Không thể tải danh sách tài khoản");
    } finally {
      setLoadingFlightAccounts(false);
    }
  };

  // ✅ [FLIGHT-PAYMENT] Handle flight payment - Navigate to PIN screen
  const handleFlightPayment = async () => {
    if (!selectedFlightForPayment) {
      toast.error("Thông tin chuyến bay không đầy đủ");
      return;
    }

    if (!selectedFlightAccountId) {
      toast.error("Vui lòng chọn tài khoản thanh toán");
      return;
    }

    // Calculate total amount
    const paxTotal =
      (parseInt(formData.flightAdult || "0") || 0) +
      (parseInt(formData.flightChild || "0") || 0) +
      (parseInt(formData.flightInfant || "0") || 0);
    const totalAmount =
      (selectedFlightForPayment.price ?? 0) * Math.max(paxTotal, 1);

    // Close modal and navigate to PIN screen
    setShowFlightPaymentModal(false);

    // Navigate to PIN screen with payment request
    navigate("/utilities/pin", {
      state: {
        pendingRequest: {
          type: "FLIGHT",
          amount: totalAmount,
          accountId: selectedFlightAccountId,
          details: {
            selectedFlight: selectedFlightForPayment,
            formData: formData,
          },
        },
        returnPath: "/utilities/flight",
      },
    });
  };

  const headerMeta = (() => {
    // ✅ Use routeType directly instead of currentType
    switch (routeType) {
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

    // ✅ Use routeType directly instead of currentType
    if (routeType === "bill") {
      if (!billService) return;
      const result = buildBillReceipt({ billService, formData });
      navigate("/utilities/result", { state: { result, source: "home" } });
      return;
    }

    // Phone and data types are now handled by their respective components
    // with payment modals, so we don't need to handle submit here
    if (routeType === "phone" || routeType === "data") {
      // Payment is handled in UtilityPhoneTopup and UtilityDataPack components
      return;
    }

    if (routeType === "movie") {
      if (movieStep === 1) {
        const isReady =
          formData.movieCinema &&
          formData.movieName &&
          formData.movieDate &&
          formData.movieTime;
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
        // ✅ Kiểm tra eKYC trước khi thanh toán
        if (!isVerified) {
          toast.error(
            "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
          );
          return;
        }

        const result = buildMovieReceipt(formData);
        navigate("/utilities/result", { state: { result, source: "home" } });
        return;
      }
    }

    if (routeType === "hotel") {
      if (hotelStep === 1) {
        const isReady =
          formData.hotelCity && formData.hotelCheckIn && formData.hotelCheckOut;
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
        // ✅ Kiểm tra eKYC trước khi thanh toán
        if (!isVerified) {
          toast.error(
            "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
          );
          return;
        }

        const room = selectedHotelRoom || {
          name: "Phòng tiêu chuẩn",
          price: 850000,
        };
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
    // ✅ Use routeType directly instead of currentType to avoid stale state
    const typeToRender = routeType;

    if (typeToRender === "bill") {
      return (
        <UtilityBill
          formData={formData}
          setFormData={setFormData}
          billService={billService}
          setBillService={setBillService}
          onGoMobilePhone={() => {
            goToType("mobilePhone", { state: { entry: "bill" } });
            setBillService("mobile");
          }}
          onPaymentSuccess={() => {
            // Navigate to result page after successful payment
            if (!billService) return;
            const result = buildBillReceipt({ billService, formData });
            navigate("/utilities/result", {
              state: { result, source: "home" },
            });
          }}
        />
      );
    }

    if (typeToRender === "mobilePhone") {
      return (
        <div id="utility-mobilephone-screen">
          <UtilityMobilePhone
            onGoTopup={() =>
              goToType("phone", { state: { entry: "mobileBill" } })
            }
            onGo3G4G={() =>
              goToType("data", { state: { entry: "mobile3g4g" } })
            }
            onGoData4G={() =>
              goToType("data", { state: { entry: "mobileBill" } })
            }
          />
        </div>
      );
    }

    if (typeToRender === "phone") {
      return (
        <UtilityPhoneTopup formData={formData} setFormData={setFormData} />
      );
    }

    if (typeToRender === "data") {
      return <UtilityDataPack formData={formData} setFormData={setFormData} />;
    }

    if (typeToRender === "flight") {
      return (
        <UtilityFlight
          ref={flightUiRef}
          formData={formData}
          setFormData={setFormData}
          onConfirm={async (selectedFlight) => {
            // ✅ Kiểm tra eKYC trước khi mở modal thanh toán
            if (!isVerified) {
              toast.error(
                "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
              );
              return;
            }

            // ✅ [FLIGHT-PAYMENT] Show payment modal instead of direct navigation
            setSelectedFlightForPayment(selectedFlight);
            setShowFlightPaymentModal(true);
            await loadFlightAccounts();
          }}
        />
      );
    }

    if (typeToRender === "movie") {
      return (
        <UtilityMovie
          formData={formData}
          setFormData={setFormData}
          showErrors={false}
        />
      );
    }

    if (typeToRender === "hotel") {
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
  // ✅ Use routeType directly instead of currentType
  if (routeType === "bill" && billService) {
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
        routeType === "phone"
          ? "pb-32"
          : routeType === "data" && isMua3G4G
          ? "pb-32"
          : routeType === "flight"
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

      {/* Sticky bottom button - removed as payment is now handled in components */}

      {/* ✅ [FLIGHT-PAYMENT] Payment Modal */}
      {showFlightPaymentModal && selectedFlightForPayment && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="bg-background w-full rounded-t-2xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Xác nhận thanh toán</h2>
              <button
                type="button"
                className="text-sm text-muted-foreground"
                onClick={() => setShowFlightPaymentModal(false)}
              >
                Đóng
              </button>
            </div>

            {/* Flight Info Summary */}
            <div className="space-y-2 rounded-xl border p-3 text-sm mb-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Hãng hàng không</span>
                <span className="font-semibold">
                  {selectedFlightForPayment.airline}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Chuyến bay</span>
                <span className="font-semibold">
                  {selectedFlightForPayment.code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Hành trình</span>
                <span className="font-semibold">
                  {selectedFlightForPayment.fromCode} →{" "}
                  {selectedFlightForPayment.toCode}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ngày bay</span>
                <span className="font-semibold">{formData.flightDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Hành khách</span>
                <span className="font-semibold">
                  {formData.flightAdult} NL, {formData.flightChild} TE,{" "}
                  {formData.flightInfant} EB
                </span>
              </div>
              <div className="border-t pt-2 flex items-center justify-between text-base font-bold text-primary">
                <span>Tổng thanh toán</span>
                <span>
                  {(
                    selectedFlightForPayment.price *
                    Math.max(
                      (parseInt(formData.flightAdult || "0") || 0) +
                        (parseInt(formData.flightChild || "0") || 0) +
                        (parseInt(formData.flightInfant || "0") || 0),
                      1
                    )
                  ).toLocaleString("vi-VN")}{" "}
                  ₫
                </span>
              </div>
            </div>

            {/* Account Selection */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Tài khoản nguồn
              </p>
              {loadingFlightAccounts && (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingFlightAccounts && flightAccounts.length > 0 && (
                <div className="space-y-2">
                  {flightAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedFlightAccountId === account.id
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedFlightAccountId(account.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono font-semibold">
                            {account.accountNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {account.accountType}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-primary">
                            {account.balance.toLocaleString("vi-VN")} ₫
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!loadingFlightAccounts && flightAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Chưa có tài khoản thanh toán
                </p>
              )}
            </div>

            {/* Payment Button */}
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowFlightPaymentModal(false)}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button
                onClick={handleFlightPayment}
                disabled={!selectedFlightAccountId || processingFlightPayment}
                className="flex-1"
              >
                {processingFlightPayment ? "Đang xử lý..." : "Thanh toán"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
