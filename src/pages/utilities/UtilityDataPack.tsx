// src/pages/utilities/UtilityDataPack.tsx
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Phone, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

  // ✅ Đọc entry để phân biệt Data 4G/Nạp tiền vs Mua 3G/4G
  const location = useLocation() as {
    state?: { from?: string; entry?: string };
  };
  const from = (location.state?.from ?? null) as FromSource;
  const entry = (location.state as any)?.entry as string | undefined;

  // ✅ Mua 3G/4G (riêng) là entry=mobile3g4g
  const isMua3G4G = entry === "mobile3g4g";

  const [openTelco, setOpenTelco] = useState(false);

  // =========================
  // ✅ [PATCH-DATA4G-TABS-NO-NAV]
  // Data 4G/Nạp tiền: tab switch nội bộ, KHÔNG navigate sang /utilities/phone
  // =========================
  const [activeTab4G, setActiveTab4G] = useState<"data" | "phone">("data");

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

  // ✅ [PATCH-MUA3G4G-UI-TUNE] chỉnh UI Mua 3G/4G theo yêu cầu mới
  if (isMua3G4G) {
    return (
      <div className="space-y-6">
        {/* Tài khoản nguồn */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Tài khoản nguồn</h3>
          <Card className="p-4 rounded-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                {/* ✅ giảm size số tiền */}
                <p className="text-xl font-bold text-foreground">559 807 đ</p>
                <p className="text-sm text-muted-foreground">
                  Normal Account | 0862525038
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
                  className="h-11 pr-20"
                />

                {formData.dataPhone?.length > 0 && (
                  <button
                    type="button"
                    className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => onChangePhone("")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-center hover:bg-emerald-100"
                  onClick={() =>
                    toast.message("Demo", { description: "Mở danh bạ (demo)" })
                  }
                  aria-label="Chọn từ danh bạ"
                >
                  <Phone className="w-4 h-4 text-emerald-700" />
                </button>
              </div>
            </div>

            {/* Nhà mạng */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Nhà mạng <span className="text-red-500">*</span>
              </Label>

              <button
                type="button"
                onClick={() => setOpenTelco(true)}
                className="w-full h-11 rounded-xl border px-4 flex items-center justify-between hover:bg-muted/30"
              >
                {/* ✅ text-sm giống input */}
                <span
                  className={`text-sm ${
                    canShowTelco ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {telcoLabel}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
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
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          dataPack: p.id,
                          dataTelco: detectTelcoByPhone(prev.dataPhone),
                        }))
                      }
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

        {/* Telco modal (demo) */}
        {openTelco && (
          <div className="fixed inset-0 z-40 bg-black/30 flex items-end justify-center">
            <div className="w-full max-w-2xl bg-background rounded-t-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold">Chọn nhà mạng</p>
                <button
                  type="button"
                  className="rounded-full p-2 hover:bg-muted"
                  onClick={() => setOpenTelco(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {["VIETTEL", "VINAPHONE", "MOBIFONE"].map((name) => (
                <button
                  key={name}
                  type="button"
                  className="w-full flex items-center justify-between rounded-xl border px-4 py-3 hover:bg-muted/30"
                  onClick={() => {
                    toast.message("Demo", {
                      description: `Chọn ${name} (demo)`,
                    });
                    setOpenTelco(false);
                  }}
                >
                  <span className="font-semibold">{name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
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

  // ✅ [PATCH-DATA4G-CONFIRM-NAV] đi tới trang xác nhận thanh toán
  const goConfirmData4G = (args: {
    kind: "data4g";
    phone: string;
    telcoKey: string;
    pack: { id: string; name: string; description?: string; price: number };
  }) => {
    navigate("/utilities/confirm", {
      state: {
        kind: "data4g",
        phone: args.phone,
        telcoKey: args.telcoKey,
        pack: args.pack,
        sourceAccount: {
          name: "Normal Account",
          number: "0862525038",
          balanceText: "559 807 đ",
        },
      },
    });
  };

  const goConfirmTopup = (args: {
    kind: "topup";
    phone: string;
    telcoKey: string;
    amount: number;
  }) => {
    navigate("/utilities/confirm", {
      state: {
        kind: "topup",
        phone: args.phone,
        telcoKey: args.telcoKey,
        amount: args.amount,
        sourceAccount: {
          name: "Normal Account",
          number: "0862525038",
          balanceText: "559 807 đ",
        },
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
                  className="h-11 pr-20"
                />
                {formData.dataPhone?.length > 0 && (
                  <button
                    type="button"
                    className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => onChangePhone("")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-center hover:bg-emerald-100"
                  onClick={() =>
                    toast.message("Demo", { description: "Mở danh bạ (demo)" })
                  }
                  aria-label="Chọn từ danh bạ"
                >
                  <Phone className="w-4 h-4 text-emerald-700" />
                </button>
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
                          // ✅ validate số điện thoại trước khi đi confirm
                          if (!validatePhoneNumber(formData.dataPhone)) {
                            toast.error("Vui lòng nhập số điện thoại hợp lệ");
                            return;
                          }

                          // ✅ vẫn set formData giữ nguyên như cũ
                          setFormData((prev) => ({
                            ...prev,
                            dataPack: p.id,
                            dataTelco: detectTelcoByPhone(prev.dataPhone),
                          }));

                          // ✅ điều hướng sang trang xác nhận
                          goConfirmData4G({
                            kind: "data4g",
                            phone: formData.dataPhone,
                            telcoKey: detectTelcoByPhone(formData.dataPhone),
                            pack: {
                              id: p.id,
                              name: p.name,
                              description: p.description,
                              price: p.price,
                            },
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
                  className="h-11 pr-20"
                />
                {formData.phoneNumber?.length > 0 && (
                  <button
                    type="button"
                    className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => onChangeTopupPhone("")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-center hover:bg-emerald-100"
                  onClick={() =>
                    toast.message("Demo", { description: "Mở danh bạ (demo)" })
                  }
                  aria-label="Chọn từ danh bạ"
                >
                  <Phone className="w-4 h-4 text-emerald-700" />
                </button>
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

                    // ✅ vẫn set formData giữ nguyên như cũ
                    setFormData((prev) => ({
                      ...prev,
                      topupAmount: String(amt),
                      telco: detectTelcoByPhone(prev.phoneNumber),
                    }));

                    // ✅ điều hướng sang trang xác nhận
                    goConfirmTopup({
                      kind: "topup",
                      phone: formData.phoneNumber,
                      telcoKey: detectTelcoByPhone(formData.phoneNumber),
                      amount: amt,
                    });
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
