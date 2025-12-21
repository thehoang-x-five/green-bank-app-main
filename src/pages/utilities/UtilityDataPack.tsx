import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUserAccount } from "@/hooks/useUserAccount";
import { useEkycCheck } from "@/hooks/useEkycCheck";

import type { UtilityFormData } from "./utilityTypes";
import {
  DATA_PACK_GROUPS,
  detectTelcoByPhone,
  getTelcoLabel,
  validatePhoneNumber,
} from "./utilityData";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;
};

type FromSource = "mobilePhone" | null;

function PromoBanners() {
  const banners = [
    { id: 1, title: "Tặng ngay 80GB", sub: "Khi mua gói cước Data" },
    { id: 2, title: "Ưu đãi Data 4G", sub: "Chỉ trong hôm nay" },
    { id: 3, title: "Gói combo", sub: "Data + TV360" },
  ];

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl">
        <div className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth">
          {banners.map((b) => (
            <div
              key={b.id}
              className="min-w-[88%] md:min-w-[60%] h-28 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-400 text-white p-4 flex flex-col justify-between"
            >
              <div>
                <p className="text-xl font-extrabold">{b.title}</p>
                <p className="text-sm text-white/90">{b.sub}</p>
              </div>
              <div className="text-xs text-white/80">
                Demo banner (placeholder)
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-1">
        <span className="h-1.5 w-6 rounded-full bg-emerald-600" />
        <span className="h-1.5 w-2 rounded-full bg-emerald-200" />
        <span className="h-1.5 w-2 rounded-full bg-emerald-200" />
      </div>
    </div>
  );
}

export default function UtilityDataPack({ formData, setFormData }: Props) {
  const navigate = useNavigate();
  const { account } = useUserAccount();
  const { isVerified } = useEkycCheck();

  // ✅ Đọc entry để phân biệt Data 4G/Nạp tiền vs Mua 3G/4G
  const location = useLocation() as {
    state?: { from?: string; entry?: string };
  };
  const from = (location.state?.from ?? null) as FromSource;
  const entry = (location.state as any)?.entry as string | undefined;

  // ✅ Mua 3G/4G (riêng) là entry=mobile3g4g
  const isMua3G4G = entry === "mobile3g4g";

  // ✅ [PATCH-MUA3G4G-PAYMENT-MODAL] Thêm state cho modal thanh toán
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAccountForPayment, setSelectedAccountForPayment] =
    useState<string>("");

  // =========================
  // ✅ [PATCH-DATA4G-TABS-NO-NAV]
  // Data 4G/Nạp tiền: tab switch nội bộ, KHÔNG navigate sang /utilities/phone
  // =========================
  const [activeTab4G, setActiveTab4G] = useState<"data" | "phone">("data");

  // ✅ [PATCH-RESET-ON-UNMOUNT] Reset selections when component unmounts (back navigation)
  useEffect(() => {
    return () => {
      // Reset form data when leaving the page
      setFormData((prev) => ({
        ...prev,
        dataPack: "",
        topupAmount: "",
      }));
    };
  }, [setFormData]);

  // ✅ Giữ hàm goTab cũ cho trường hợp cần (nhưng Data4G thì không dùng)
  const goTab = (tab: "data" | "phone") => {
    const nextState = {
      ...(from ? { from } : {}),
      ...(entry ? { entry } : {}),
    };
    navigate(`/utilities/${tab}`, {
      state: Object.keys(nextState).length ? nextState : undefined,
    });
  };

  // ====== TELCO (DATA) ======
  const telcoKey = useMemo(
    () => detectTelcoByPhone(formData.dataPhone),
    [formData.dataPhone]
  );

  const canShowTelco = validatePhoneNumber(formData.dataPhone);
  const telcoLabel = canShowTelco ? getTelcoLabel(telcoKey) : "Chọn nhà mạng";

  // ====== TELCO (PHONE TOPUP - dùng cho tab Nạp điện thoại trong Data4G) ======
  const telcoKeyPhone = useMemo(
    () => detectTelcoByPhone(formData.phoneNumber),
    [formData.phoneNumber]
  );
  const canShowTelcoPhone = validatePhoneNumber(formData.phoneNumber);

  // ✅ [PATCH-TELCO-COLOR-TEXT-ONLY] chỉ đổi màu chữ theo nhà mạng
  const getTelcoTextClass = (key: string, canShow: boolean) => {
    if (!canShow) return "text-muted-foreground";
    switch (key) {
      case "viettel":
        return "text-red-700";
      case "vina":
        return "text-blue-700";
      case "mobi":
        return "text-cyan-700";
      default:
        return "text-emerald-700";
    }
  };

  // ✅ dùng cho tab data
  const telcoStyle = useMemo(() => {
    return {
      text: getTelcoTextClass(telcoKey, canShowTelco),
    };
  }, [canShowTelco, telcoKey]);

  // ✅ dùng cho tab phone
  const telcoStylePhone = useMemo(() => {
    return {
      text: getTelcoTextClass(telcoKeyPhone, canShowTelcoPhone),
    };
  }, [canShowTelcoPhone, telcoKeyPhone]);

  const onChangePhone = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      dataPhone: value,
      dataTelco: detectTelcoByPhone(value),
      ...(value.trim().length === 0 ? { dataPack: "" } : {}),
    }));
  };

  // ✅ [PATCH-PHONE-IN-DATA4G-UI] input phoneNumber cho tab Nạp điện thoại (trong Data4G)
  const onChangeTopupPhone = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      phoneNumber: value,
      telco: detectTelcoByPhone(value),
      ...(value.trim().length === 0 ? { topupAmount: "" } : {}),
    }));
  };

  // ✅ [PATCH-POPULAR-AMOUNTS] mệnh giá tiền theo yêu cầu
  const POPULAR_AMOUNTS = useMemo(
    () => [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
    []
  );

  // ✅ Danh sách gói riêng cho Mua 3G/4G
  const mua3g4gPacks = useMemo(
    () => [
      { id: "KS6H", name: "3GB - 6 giờ", subtitle: "KS6H", price: 10000 },
      { id: "KS8", name: "1.5GB - 1 ngày", subtitle: "KS8", price: 8000 },
      { id: "KS12", name: "2.5GB - 1 ngày", subtitle: "KS12", price: 12000 },
      { id: "KS20", name: "4GB - 3 ngày", subtitle: "KS20", price: 20000 },
      { id: "KS36", name: "8GB - 7 ngày", subtitle: "KS36", price: 36000 },
      {
        id: "KS110",
        name: "1.2GB/ngày - 30 ngày",
        subtitle: "KS110",
        price: 110000,
      },
      {
        id: "KS145",
        name: "2.2GB/ngày - 30 ngày",
        subtitle: "KS145",
        price: 145000,
      },
      {
        id: "KS165",
        name: "3GB/ngày - 30 ngày",
        subtitle: "KS165",
        price: 165000,
      },
    ],
    []
  );

  // ✅ [PATCH-MUA3G4G-CONTINUE-BUTTON] Thêm state và handler cho nút Tiếp tục
  const [selectedPackForContinue, setSelectedPackForContinue] = useState<{
    id: string;
    name: string;
    price: number;
    description?: string;
  } | null>(null);

  const handleContinuePayment = () => {
    if (!selectedPackForContinue) {
      toast.error("Vui lòng chọn gói cước");
      return;
    }

    // Validate phone number
    if (!validatePhoneNumber(formData.dataPhone)) {
      toast.error("Vui lòng nhập số điện thoại hợp lệ");
      return;
    }

    // Validate account
    if (!account || !account.accountNumber) {
      toast.error("Không tìm thấy tài khoản thanh toán");
      return;
    }

    // ✅ Kiểm tra eKYC trước khi mở modal thanh toán
    if (!isVerified) {
      toast.error(
        "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
      );
      return;
    }

    // ✅ [PATCH-MUA3G4G-PAYMENT-MODAL] Mở modal thanh toán thay vì navigate trực tiếp
    setSelectedAccountForPayment(account.accountNumber);
    setShowPaymentModal(true);
  };

  // Handle data pack payment (for Mua 3G/4G and Data 4G tab) - Navigate to PIN screen
  const handleDataPackPayment = async (pack: {
    id: string;
    name: string;
    price: number;
    description?: string;
  }) => {
    console.log("=== handleDataPackPayment called ===");
    console.log("pack:", pack);
    console.log("formData.dataPhone:", formData.dataPhone);
    console.log("account:", account);
    console.log("isVerified:", isVerified);
    console.log("isMua3G4G:", isMua3G4G);

    // Validate phone number
    const phoneToUse = isMua3G4G ? formData.dataPhone : formData.dataPhone;
    if (!validatePhoneNumber(phoneToUse)) {
      console.log("ERROR: Invalid phone number");
      toast.error("Vui lòng nhập số điện thoại hợp lệ");
      return;
    }

    // Validate account
    if (!account || !account.accountNumber) {
      console.log("ERROR: No account found");
      toast.error("Không tìm thấy tài khoản thanh toán");
      return;
    }

    // ✅ [PATCH-MUA3G4G-NO-DOUBLE-EKYC-CHECK]
    // Không cần kiểm tra eKYC ở đây vì đã kiểm tra trong handleContinuePayment() rồi
    // Chỉ kiểm tra eKYC khi gọi trực tiếp từ Data 4G tab (không qua modal)
    if (!isMua3G4G && !isVerified) {
      console.log("ERROR: eKYC not verified (Data 4G tab)");
      toast.error(
        "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
      );
      return;
    }

    console.log("=== All validations passed, navigating to PIN screen ===");
    // Navigate to PIN screen with payment request
    navigate("/utilities/pin", {
      state: {
        pendingRequest: {
          type: "DATA_PACK",
          amount: pack.price,
          accountId: account.accountNumber,
          details: {
            phoneNumber: phoneToUse,
            telco: detectTelcoByPhone(phoneToUse),
            packId: pack.id,
            packName: pack.name,
            formData: {
              dataPhone: phoneToUse,
              dataTelco: detectTelcoByPhone(phoneToUse),
              dataPack: pack.id,
            },
            source: "home",
          },
        },
        returnPath: "/utilities/data",
      },
    });
    console.log("=== Navigate called ===");
  };

  // ✅ [PATCH-MUA3G4G-PAYMENT-MODAL] Hàm xử lý thanh toán từ modal
  const handlePaymentFromModal = () => {
    console.log("=== handlePaymentFromModal called ===");
    console.log("selectedPackForContinue:", selectedPackForContinue);
    console.log("selectedAccountForPayment:", selectedAccountForPayment);
    console.log("account:", account);
    console.log("isVerified:", isVerified);
    console.log("isMua3G4G:", isMua3G4G);

    if (!selectedPackForContinue) {
      console.log("ERROR: No pack selected");
      toast.error("Vui lòng chọn gói cước");
      return;
    }

    if (!selectedAccountForPayment) {
      console.log("ERROR: No account selected");
      toast.error("Vui lòng chọn tài khoản thanh toán");
      return;
    }

    console.log("=== Closing modal and calling handleDataPackPayment ===");
    // Close modal
    setShowPaymentModal(false);

    // Navigate to PIN screen
    handleDataPackPayment(selectedPackForContinue);
  };

  // ✅ [PATCH-MUA3G4G-UI-TUNE] chỉnh UI Mua 3G/4G theo yêu cầu mới
  if (isMua3G4G) {
    return (
      <>
        <div className="space-y-6">
          {/* Tài khoản nguồn */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Tài khoản nguồn</h3>
            <Card className="p-4 rounded-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  {/* ✅ giảm size số tiền */}
                  <p className="text-xl font-bold text-foreground">
                    {account
                      ? `${account.balance.toLocaleString("vi-VN")} đ`
                      : "0 đ"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Normal Account | {account?.accountNumber || "0862525038"}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-emerald-700 font-semibold hover:opacity-80"
                  onClick={() =>
                    toast.message("Demo", {
                      description: "Đổi tài khoản nguồn (demo)",
                    })
                  }
                >
                  Thay đổi
                </button>
              </div>
            </Card>
          </div>

          {/* Thông tin thanh toán */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Thông tin thanh toán</h3>
            <Card className="p-4 rounded-2xl space-y-4">
              {/* Số điện thoại */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Số điện thoại <span className="text-red-500">*</span>
                </Label>

                <div className="relative">
                  <Input
                    value={formData.dataPhone}
                    onChange={(e) => onChangePhone(e.target.value)}
                    placeholder="Nhập số điện thoại"
                    inputMode="numeric"
                    className="h-11 pr-10"
                  />

                  {formData.dataPhone?.length > 0 && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => onChangePhone("")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Nhà mạng */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Nhà mạng <span className="text-red-500">*</span>
                </Label>

                <div className="w-full h-11 rounded-xl border px-4 flex items-center justify-between bg-muted/30">
                  <span
                    className={`text-sm ${
                      canShowTelco ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {telcoLabel}
                  </span>
                </div>
              </div>

              {/* Gói cước */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Gói cước <span className="text-red-500">*</span>
                </Label>

                <div className="space-y-3">
                  {mua3g4gPacks.map((p) => {
                    const selected = formData.dataPack === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          // Set form data and selected pack (không validate ở đây)
                          setFormData((prev) => ({
                            ...prev,
                            dataPack: p.id,
                            dataTelco: detectTelcoByPhone(prev.dataPhone),
                          }));

                          // ✅ Set selected pack for continue button
                          setSelectedPackForContinue({
                            id: p.id,
                            name: p.name,
                            price: p.price,
                            description: p.subtitle,
                          });
                        }}
                        className={`w-full rounded-xl border p-4 text-left transition-colors ${
                          selected
                            ? "border-emerald-600 bg-emerald-50"
                            : "border-border bg-background hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {p.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.subtitle}
                            </p>
                          </div>

                          <p className="text-sm font-semibold text-emerald-800">
                            {p.price.toLocaleString("vi-VN")} đ
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ✅ [PATCH-MUA3G4G-CONTINUE-BUTTON] Nút Tiếp tục chỉ hiện khi đã chọn gói */}
        {selectedPackForContinue && (
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t">
            <div className="max-w-4xl mx-auto px-4 py-3">
              <Button
                type="button"
                onClick={handleContinuePayment}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700"
              >
                Tiếp tục
              </Button>
            </div>
          </div>
        )}

        {/* ✅ [PATCH-MUA3G4G-PAYMENT-MODAL] Modal xác nhận thanh toán */}
        {showPaymentModal && selectedPackForContinue && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40">
            <div className="bg-background w-full rounded-t-2xl p-6 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Xác nhận thanh toán</h2>
                <button
                  type="button"
                  className="text-sm text-muted-foreground"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Đóng
                </button>
              </div>

              {/* Payment Info Summary */}
              <div className="space-y-2 rounded-xl border p-3 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Số điện thoại</span>
                  <span className="font-semibold">{formData.dataPhone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nhà mạng</span>
                  <span className="font-semibold">
                    {getTelcoLabel(detectTelcoByPhone(formData.dataPhone))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Gói cước</span>
                  <span className="font-semibold">
                    {selectedPackForContinue.name}
                  </span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between text-base font-bold text-primary">
                  <span>Tổng thanh toán</span>
                  <span>
                    {selectedPackForContinue.price.toLocaleString("vi-VN")} ₫
                  </span>
                </div>
              </div>

              {/* Account Selection */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Tài khoản nguồn
                </p>
                {account && (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-primary bg-primary/5 p-3 text-left"
                    onClick={() =>
                      setSelectedAccountForPayment(account.accountNumber)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono font-semibold">
                          {account.accountNumber}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Normal Account
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">
                          {account.balance.toLocaleString("vi-VN")} ₫
                        </div>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* Payment Button */}
              <div className="flex gap-3 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1"
                >
                  Hủy
                </Button>
                <Button
                  onClick={handlePaymentFromModal}
                  disabled={!selectedAccountForPayment}
                  className="flex-1"
                >
                  Thanh toán
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ====== UI Data 4G/Nạp tiền ======
  const filteredGroups = useMemo(() => {
    const t = telcoKey;
    return DATA_PACK_GROUPS.map((g) => ({
      ...g,
      packs: g.packs.filter(
        (p) => !p.telco || p.telco === "all" || !t || p.telco === t
      ),
    })).filter((g) => g.packs.length > 0);
  }, [telcoKey]);

  const openHistory = () => {
    navigate("/utilities/mobile-history", {
      state: {
        // ✅ [PATCH-DATA4G-TABS-NO-NAV] tab param phản ánh đúng tab đang xem
        tab: activeTab4G === "phone" ? "phone" : "data",
        from: from === "mobilePhone" ? "mobilePhone" : "home",
        backTo: "/utilities/data",
        backState: {
          ...(from ? { from } : {}),
          ...(entry ? { entry } : {}),
        },
      },
    });
  };

  // Handle phone topup payment (for Data 4G phone tab) - Navigate to PIN screen
  const handlePhoneTopupPayment = async (amount: number) => {
    // Validate phone number
    if (!validatePhoneNumber(formData.phoneNumber)) {
      toast.error("Vui lòng nhập số điện thoại hợp lệ");
      return;
    }

    // Validate account
    if (!account || !account.accountNumber) {
      toast.error("Không tìm thấy tài khoản thanh toán");
      return;
    }

    // ✅ Kiểm tra eKYC trước khi mở modal thanh toán
    if (!isVerified) {
      toast.error(
        "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
      );
      return;
    }

    // Navigate to PIN screen with payment request
    navigate("/utilities/pin", {
      state: {
        pendingRequest: {
          type: "PHONE_TOPUP",
          amount: amount,
          accountId: account.accountNumber,
          details: {
            phoneNumber: formData.phoneNumber,
            telco: detectTelcoByPhone(formData.phoneNumber),
            formData: {
              phoneNumber: formData.phoneNumber,
              telco: detectTelcoByPhone(formData.phoneNumber),
              topupAmount: String(amount),
            },
            source: "home",
          },
        },
        returnPath: "/utilities/data",
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* ✅ [PATCH-DATA4G-TABS-NO-NAV] Tab nội bộ, KHÔNG navigate */}
      <div className="grid grid-cols-2 border-b">
        <button
          type="button"
          onClick={() => setActiveTab4G("data")}
          className={`relative py-3 text-sm text-center ${
            activeTab4G === "data"
              ? "font-bold text-emerald-700"
              : "font-semibold text-muted-foreground hover:text-foreground"
          }`}
        >
          Nạp data
          {activeTab4G === "data" && (
            <span className="absolute left-6 right-6 -bottom-[1px] h-[3px] rounded-t-full bg-emerald-600" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab4G("phone")}
          className={`relative py-3 text-sm text-center ${
            activeTab4G === "phone"
              ? "font-bold text-emerald-700"
              : "font-semibold text-muted-foreground hover:text-foreground"
          }`}
        >
          Nạp điện thoại
          {activeTab4G === "phone" && (
            <span className="absolute left-6 right-6 -bottom-[1px] h-[3px] rounded-t-full bg-emerald-600" />
          )}
        </button>
      </div>

      {/* ✅ bỏ banner giữ nguyên theo code anh đang để comment */}
      {/* <PromoBanners /> */}

      {/* ======================================================
          TAB 1: NẠP DATA (giữ layout cũ, chỉ sửa “Gói Data phổ biến”)
         ====================================================== */}
      {activeTab4G === "data" && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Số điện thoại được nạp
            </Label>
            <div className="flex items-center gap-3">
              {/* ✅ [PATCH-TELCO-COLOR-TEXT-ONLY] giữ nguyên ô, chỉ đổi màu chữ */}
              <div className="h-11 w-24 rounded-xl border bg-white flex items-center justify-center">
                <span className={`text-sm font-extrabold ${telcoStyle.text}`}>
                  {canShowTelco ? getTelcoLabel(telcoKey) : "—"}
                </span>
              </div>

              <div className="flex-1 relative">
                <Input
                  value={formData.dataPhone}
                  onChange={(e) => onChangePhone(e.target.value)}
                  placeholder="Nhập số điện thoại (VD: 0862525038)"
                  inputMode="numeric"
                  className="h-11 pr-10"
                />
                {formData.dataPhone?.length > 0 && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => onChangePhone("")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.key} className="space-y-3">
                <h3 className="text-lg font-bold">{group.title}</h3>

                <div className="grid grid-cols-2 gap-3">
                  {group.packs.map((p) => {
                    const selected = formData.dataPack === p.id;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          // Validate phone number
                          if (!validatePhoneNumber(formData.dataPhone)) {
                            toast.error("Vui lòng nhập số điện thoại hợp lệ");
                            return;
                          }

                          // Set form data
                          setFormData((prev) => ({
                            ...prev,
                            dataPack: p.id,
                            dataTelco: detectTelcoByPhone(prev.dataPhone),
                          }));

                          // Show payment modal
                          handleDataPackPayment({
                            id: p.id,
                            name: p.name,
                            price: p.price,
                            description: p.description,
                          });
                        }}
                        className={`text-left rounded-2xl border p-4 transition-colors relative ${
                          selected
                            ? "border-emerald-600 bg-emerald-50"
                            : "border-border bg-background hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-extrabold text-emerald-700">
                              {p.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toast.message("Thông tin gói", {
                                description:
                                  p.description || "Không có mô tả (demo)",
                              });
                            }}
                            className="shrink-0 rounded-full border border-emerald-600/40 text-emerald-700 w-7 h-7 flex items-center justify-center hover:bg-emerald-50"
                            aria-label="Xem thông tin gói"
                          >
                            <span className="text-sm font-bold">i</span>
                          </button>
                        </div>

                        <p className="mt-3 text-base font-extrabold">
                          Giá: {p.price.toLocaleString("vi-VN")} VND
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ======================================================
          TAB 2: NẠP ĐIỆN THOẠI (UI riêng, format giống tab Nạp data)
         ====================================================== */}
      {activeTab4G === "phone" && (
        <>
          {/* ✅ [PATCH-PHONE-IN-DATA4G-UI] Số điện thoại được nạp (phoneNumber) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Số điện thoại được nạp
            </Label>
            <div className="flex items-center gap-3">
              {/* ✅ [PATCH-TELCO-COLOR-TEXT-ONLY] giữ ô trắng, chỉ màu chữ */}
              <div className="h-11 w-24 rounded-xl border bg-white flex items-center justify-center">
                <span
                  className={`text-sm font-extrabold ${telcoStylePhone.text}`}
                >
                  {canShowTelcoPhone ? getTelcoLabel(telcoKeyPhone) : "—"}
                </span>
              </div>

              <div className="flex-1 relative">
                <Input
                  value={formData.phoneNumber}
                  onChange={(e) => onChangeTopupPhone(e.target.value)}
                  placeholder="Nhập số điện thoại (VD: 0862525038)"
                  inputMode="numeric"
                  className="h-11 pr-10"
                />
                {formData.phoneNumber?.length > 0 && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => onChangeTopupPhone("")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ✅ grid mệnh giá giống format tab Nạp data */}
          <div className="grid grid-cols-3 gap-3">
            {POPULAR_AMOUNTS.map((amt) => {
              const selected = formData.topupAmount === String(amt);
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    if (!validatePhoneNumber(formData.phoneNumber)) {
                      toast.error("Vui lòng nhập số điện thoại hợp lệ");
                      return;
                    }

                    // Set form data
                    setFormData((prev) => ({
                      ...prev,
                      topupAmount: String(amt),
                      telco: detectTelcoByPhone(prev.phoneNumber),
                    }));

                    // Show payment modal
                    handlePhoneTopupPayment(amt);
                  }}
                  className={`h-12 rounded-xl border text-sm font-semibold transition-colors ${
                    selected
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-border bg-background hover:bg-muted/30"
                  }`}
                >
                  {amt.toLocaleString("vi-VN")} đ
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="space-y-2 pt-2">
        <h3 className="text-lg font-bold">Tiện ích dùng nhanh</h3>
        <button type="button" className="w-full" onClick={openHistory}>
          <Card className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-700 font-bold">⏱</span>
              </div>
              <p className="font-semibold">Lịch sử giao dịch</p>
            </div>
            <span className="text-muted-foreground text-xl">›</span>
          </Card>
        </button>
      </div>
    </div>
  );
}
