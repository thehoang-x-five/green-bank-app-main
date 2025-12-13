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

const DATA_PACKS = [
  { id: "ks6h", name: "3GB - 6 giờ", code: "KS6H", price: 10000 },
  { id: "ks8", name: "1.5GB - 1 ngày", code: "KS8", price: 8000 },
  { id: "ks12", name: "2.5GB - 1 ngày", code: "KS12", price: 12000 },
  { id: "ks20", name: "4GB - 3 ngày", code: "KS20", price: 20000 },
];

const formatCurrencyVND = (value: number) =>
  value.toLocaleString("vi-VN") + " đ";

export default function UtilityDataPack({ formData, setFormData }: Props) {
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
            value={formData.dataPhone}
            maxLength={10}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
              setFormData((prev) => ({ ...prev, dataPhone: digitsOnly }));
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
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

        <div className="space-y-1.5">
          <Label className="text-xs">
            Gói cước <span className="text-destructive">*</span>
          </Label>

          <div className="space-y-2">
            {DATA_PACKS.map((pack) => {
              const isActive = formData.dataPack === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, dataPack: pack.id }))
                  }
                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-3 text-left ${
                    isActive
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-muted bg-background"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{pack.name}</p>
                    <p className="text-xs text-muted-foreground">{pack.code}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">
                    {formatCurrencyVND(pack.price)}
                  </p>
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
