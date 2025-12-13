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

import type { UtilityFormData } from "./utilityTypes";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;
};

const PHONE_TOPUP_AMOUNTS = [
  10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000,
];

const formatCurrencyVND = (value: number) =>
  value.toLocaleString("vi-VN") + " đ";

export default function UtilityPhoneTopup({ formData, setFormData }: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Tài khoản nguồn</h3>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-base font-semibold">559 807 đ</p>
            <p className="text-xs text-muted-foreground">
              Normal Account | 0862525038
            </p>
          </div>
          <span className="text-xs text-primary font-semibold">Thay đổi</span>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Thông tin thanh toán</h3>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Số điện thoại <span className="text-destructive">*</span>
          </Label>
          <Input
            placeholder="Nhập số điện thoại"
            value={formData.phoneNumber}
            maxLength={10}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
              setFormData((prev) => ({ ...prev, phoneNumber: digitsOnly }));
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
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

        <div className="space-y-1.5">
          <Label className="text-xs">
            Mệnh giá nạp <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {PHONE_TOPUP_AMOUNTS.map((amount) => {
              const formatted = formatCurrencyVND(amount);
              const isActive = formData.topupAmount === formatted;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, topupAmount: formatted }))
                  }
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold text-center ${
                    isActive
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-muted bg-background text-foreground"
                  }`}
                >
                  {formatted}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Button type="submit" className="w-full mt-2">
        Tiếp tục
      </Button>
    </div>
  );
}
