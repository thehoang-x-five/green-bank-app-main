import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

import type { BillService, UtilityFormData } from "./utilityTypes";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;

  billService: BillService | null;
  setBillService: React.Dispatch<React.SetStateAction<BillService | null>>;

  billSave: boolean;
  setBillSave: React.Dispatch<React.SetStateAction<boolean>>;

  onGoMobilePhone: () => void;
};

const ELECTRIC_PROVIDERS = [
  "Điện lực HCM",
  "Điện lực Hà Nội",
  "Điện lực toàn quốc",
  "Hợp tác xã điện",
];

const WATER_PROVIDERS = [
  "Cấp nước Bình Thuận",
  "Cấp nước Bình Phước",
  "Cấp nước Khánh Hòa",
  "Cấp nước Kiên Giang",
  "Cấp nước Hà Tĩnh",
  "Cấp nước Bến Lức",
  "Cấp nước Sơn Hà",
  "Cấp nước Vạn Ninh",
  "Cấp nước Thủ Thừa",
  "Cấp nước Cà Mau",
  "Cấp nước Tiền Giang",
  "Cấp nước Trà Vinh",
];

const MOBILE_PROVIDERS = ["Viettel", "VinaPhone", "MobiFone"];

export default function UtilityBill({
  formData,
  setFormData,
  billService,
  setBillService,
  billSave,
  setBillSave,
  onGoMobilePhone,
}: Props) {
  const [showBillProviderSheet, setShowBillProviderSheet] = useState(false);
  const [billProviderSearch, setBillProviderSearch] = useState("");

  const providers = useMemo(() => {
    if (!billService) return [];
    if (billService === "electric") return ELECTRIC_PROVIDERS;
    if (billService === "water") return WATER_PROVIDERS;
    return MOBILE_PROVIDERS;
  }, [billService]);

  const filteredProviders = useMemo(() => {
    const keyword = billProviderSearch.trim().toLowerCase();
    return providers.filter((p) => p.toLowerCase().includes(keyword));
  }, [providers, billProviderSearch]);

  const renderBillProviderSheet = () => {
    if (!showBillProviderSheet || !billService) return null;

    return (
      <div className="fixed inset-0 z-40 bg-black/40 flex items-end">
        <div className="bg-background w-full rounded-t-2xl p-4 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-base font-semibold">Nhà cung cấp</p>
            <button
              type="button"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setShowBillProviderSheet(false);
                setBillProviderSearch("");
              }}
            >
              Đóng
            </button>
          </div>

          <div className="mb-3">
            <Input
              placeholder="Tìm kiếm"
              value={billProviderSearch}
              onChange={(e) => setBillProviderSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredProviders.map((name) => (
              <button
                key={name}
                type="button"
                className="w-full text-left py-2 px-1 rounded-lg hover:bg-muted/70"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, billProvider: name }));
                  setShowBillProviderSheet(false);
                  setBillProviderSearch("");
                }}
              >
                <p className="text-sm font-medium">{name}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderBillMain = () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold mb-3">Dịch vụ</h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-2xl bg-muted py-4 hover:bg-muted/80"
            onClick={() => {
              setBillService("electric");
              setFormData((prev) => ({ ...prev, billType: "electric" }));
            }}
          >
            <span className="text-2xl mb-1">💡</span>
            <span className="text-sm font-medium">Điện</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-2xl bg-muted py-4 hover:bg-muted/80"
            onClick={() => {
              setBillService("water");
              setFormData((prev) => ({ ...prev, billType: "water" }));
            }}
          >
            <span className="text-2xl mb-1">💧</span>
            <span className="text-sm font-medium">Nước</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-2xl bg-muted py-4 hover:bg-muted/80"
            onClick={onGoMobilePhone}
          >
            <span className="text-2xl mb-1">📱</span>
            <span className="text-sm font-medium text-center">
              Điện thoại
              <br />
              di động
            </span>
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">Danh sách hóa đơn</h2>

        <div className="flex mb-3">
          <button
            type="button"
            className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          >
            Đã lưu
          </button>
        </div>

        <Card className="p-4 text-sm text-muted-foreground">
          Chưa có hóa đơn đã lưu (demo). Hóa đơn anh thanh toán và chọn “Lưu hóa
          đơn” sẽ được hiển thị tại đây.
        </Card>
      </section>
    </div>
  );

  const renderBillPayment = () => {
    if (!billService) return null;

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
            <Label className="text-xs">Nhà cung cấp</Label>
            <button
              type="button"
              onClick={() => setShowBillProviderSheet(true)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 hover:bg-muted/60"
            >
              {formData.billProvider ? (
                <span className="font-medium text-foreground">
                  {formData.billProvider}
                </span>
              ) : (
                <span className="text-muted-foreground">Chọn nhà cung cấp</span>
              )}
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Mã khách hàng <span className="text-destructive">*</span>
            </Label>
            <Input
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

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium">Lưu hóa đơn</p>
              <p className="text-[11px] text-muted-foreground">
                Lưu thông tin để thanh toán nhanh cho lần sau
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBillSave((prev) => !prev)}
              className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${
                billSave ? "bg-emerald-500" : "bg-muted"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  billSave ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

        <Button type="submit" className="w-full mt-4">
          Tiếp tục
        </Button>

        {renderBillProviderSheet()}
      </div>
    );
  };

  if (!billService) return renderBillMain();
  return renderBillPayment();
}
