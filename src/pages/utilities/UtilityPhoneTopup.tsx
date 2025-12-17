// src/pages/utilities/UtilityPhoneTopup.tsx
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Phone, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { UtilityFormData } from "./utilityTypes";
import {
  detectTelcoByPhone,
  getTelcoLabel,
  validatePhoneNumber,
} from "./utilityData";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;
};

const TOPUP_AMOUNTS = [
  10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000,
];

function TelcoOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
        selected ? "border-emerald-600 bg-emerald-50" : "hover:bg-muted/30"
      }`}
    >
      <span className="font-semibold">{label}</span>
      {selected ? <Check className="w-5 h-5 text-emerald-600" /> : null}
    </button>
  );
}

export default function UtilityPhoneTopup({ formData, setFormData }: Props) {
  const [openTelco, setOpenTelco] = useState(false);

  const telcoKey = useMemo(
    () => detectTelcoByPhone(formData.phoneNumber),
    [formData.phoneNumber]
  );

  const canShowTelco = validatePhoneNumber(formData.phoneNumber);
  const telcoLabel = canShowTelco ? getTelcoLabel(telcoKey) : "Chọn nhà mạng";

  const onChangePhone = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      phoneNumber: value,
      telco: detectTelcoByPhone(value),
      ...(value.trim().length === 0 ? { topupAmount: "" } : {}),
    }));
  };

  const onPickAmount = (amount: number) => {
    setFormData((prev) => ({ ...prev, topupAmount: String(amount) }));
  };

  return (
    <div className="space-y-6">
      {/* Tài khoản nguồn */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Tài khoản nguồn</h3>
        <Card className="p-4 rounded-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              {/* ✅ [PATCH-TOPUP-BALANCE-SMALLER] giảm size số tiền */}
              <p className="text-xl font-bold text-foreground">559 807 đ</p>
              <p className="text-sm text-muted-foreground">
                Normal Account | 0862525038
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="text-emerald-700 font-semibold"
              onClick={() =>
                toast.message("Demo", {
                  description: "Đổi tài khoản nguồn (demo)",
                })
              }
            >
              Thay đổi
            </Button>
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
                value={formData.phoneNumber}
                onChange={(e) => onChangePhone(e.target.value)}
                placeholder="Nhập số điện thoại"
                inputMode="numeric"
                className="h-11 pr-20"
              />

              {formData.phoneNumber?.length > 0 && (
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
                  toast.message("Demo", {
                    description: "Mở danh bạ (demo)",
                  })
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
              {/* ✅ [PATCH-TOPUP-TELCO-PLACEHOLDER-SIZE] text-sm giống input */}
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

          {/* Mệnh giá nạp */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Mệnh giá nạp <span className="text-red-500">*</span>
            </Label>

            {/* ✅ [PATCH-TOPUP-AMOUNT-GREEN] đổi màu số tiền sang xanh lá (không tick) */}
            <div className="grid grid-cols-3 gap-3">
              {TOPUP_AMOUNTS.map((amt) => {
                const selected = formData.topupAmount === String(amt);
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => onPickAmount(amt)}
                    className={`h-12 rounded-xl border text-sm font-semibold transition-colors text-emerald-800 ${
                      selected
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-border bg-background hover:bg-muted/30"
                    }`}
                  >
                    {amt.toLocaleString("vi-VN")} đ
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

            <TelcoOption
              label="VIETTEL"
              selected={telcoKey === "viettel"}
              onClick={() => {
                setFormData((prev) => ({ ...prev, telco: "viettel" as any }));
                setOpenTelco(false);
              }}
            />
            <TelcoOption
              label="VINAPHONE"
              selected={telcoKey === "vinaphone"}
              onClick={() => {
                setFormData((prev) => ({ ...prev, telco: "vinaphone" as any }));
                setOpenTelco(false);
              }}
            />
            <TelcoOption
              label="MOBIFONE"
              selected={telcoKey === "mobifone"}
              onClick={() => {
                setFormData((prev) => ({ ...prev, telco: "mobifone" as any }));
                setOpenTelco(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
