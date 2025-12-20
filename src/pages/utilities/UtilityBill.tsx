import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMemo, useState, useEffect } from "react";
import { useUserAccount } from "@/hooks/useUserAccount";

import type { BillService, UtilityFormData } from "./utilityTypes";
import {
  fetchBillProviders,
  fetchUserUtilityBill,
  payUserUtilityBill,
  type BillProvider,
  type UserUtilityBill,
  type UtilityBillServiceType,
} from "@/services/utilityBillService";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;

  billService: BillService | null;
  setBillService: React.Dispatch<React.SetStateAction<BillService | null>>;

  onGoMobilePhone: () => void;
  onPaymentSuccess?: () => void;
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
  onGoMobilePhone,
  onPaymentSuccess,
}: Props) {
  const [showBillProviderSheet, setShowBillProviderSheet] = useState(false);
  const [billProviderSearch, setBillProviderSearch] = useState("");
  const [showProviderError, setShowProviderError] = useState(false);
  const { account, userProfile } = useUserAccount();

  const [providersFromDb, setProvidersFromDb] = useState<BillProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [activeBill, setActiveBill] = useState<UserUtilityBill | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const billServiceForDb = useMemo(() => {
    if (billService === "electric") return "electric";
    if (billService === "water") return "water";
    return null;
  }, [billService]);

  // Reset billProvider & bill info when changing service
  useEffect(() => {
    if (!billService) return;

    setFormData((prev) => ({
      ...prev,
      billProvider: "",
      customerCode: "",
      billAmount: "",
    }));
    setSelectedProviderId("");
    setActiveBill(null);
    setShowProviderError(false);
    setBillProviderSearch("");
    setProvidersFromDb([]);
  }, [billService, setFormData]);

  // Load providers from DB for electric/water
  useEffect(() => {
    const run = async () => {
      if (!billServiceForDb) return;

      const list = await fetchBillProviders(
        billServiceForDb as UtilityBillServiceType
      );
      setProvidersFromDb(list);
    };

    run();
  }, [billServiceForDb]);

  // Load user's active bill when select provider
  useEffect(() => {
    const run = async () => {
      if (!billServiceForDb) return;
      if (!selectedProviderId) return;

      const bill = await fetchUserUtilityBill(
        billServiceForDb as UtilityBillServiceType,
        selectedProviderId
      );

      if (bill && bill.status === "UNPAID" && bill.amount > 0) {
        setActiveBill(bill);

        setFormData((prev) => ({
          ...prev,
          customerCode: userProfile?.cif || "",
          billAmount: String(bill.amount),
        }));
        return;
      }

      setActiveBill(null);
      setFormData((prev) => ({
        ...prev,
        customerCode: "",
        billAmount: "",
      }));
    };

    run();
  }, [billServiceForDb, selectedProviderId, setFormData, userProfile?.cif]);

  const providers = useMemo(() => {
    if (!billService) return [];
    if (billService === "electric") {
      return providersFromDb.length > 0
        ? providersFromDb.map((p) => p.name)
        : ELECTRIC_PROVIDERS;
    }
    if (billService === "water") {
      return providersFromDb.length > 0
        ? providersFromDb.map((p) => p.name)
        : WATER_PROVIDERS;
    }
    return MOBILE_PROVIDERS;
  }, [billService, providersFromDb]);

  const providerNameToId = useMemo(() => {
    const map = new Map<string, string>();
    providersFromDb.forEach((p) => map.set(p.name, p.id));
    return map;
  }, [providersFromDb]);

  const filteredProviders = useMemo(() => {
    const keyword = billProviderSearch.trim().toLowerCase();
    return providers.filter((p) => p.toLowerCase().includes(keyword));
  }, [providers, billProviderSearch]);

  const hasActiveBill = useMemo(() => {
    return Boolean(
      activeBill && activeBill.status === "UNPAID" && activeBill.amount > 0
    );
  }, [activeBill]);

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
                  setSelectedProviderId(providerNameToId.get(name) || "");
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
              <p className="text-base font-semibold">
                {account
                  ? `${account.balance.toLocaleString("vi-VN")} đ`
                  : "0 đ"}
              </p>
              <p className="text-xs text-muted-foreground">
                Normal Account | {account?.accountNumber || "0862525038"}
              </p>
            </div>
            <span className="text-xs text-primary font-semibold">Thay đổi</span>
          </Card>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Thông tin thanh toán</h3>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Nhà cung cấp <span className="text-destructive">*</span>
            </Label>
            <button
              type="button"
              onClick={() => {
                setShowBillProviderSheet(true);
                setShowProviderError(false);
              }}
              className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 hover:bg-muted/60 ${
                showProviderError && !formData.billProvider
                  ? "border-destructive bg-destructive/5"
                  : "border-input bg-background"
              }`}
            >
              {formData.billProvider ? (
                <span className="font-medium text-foreground">
                  {formData.billProvider}
                </span>
              ) : (
                <span
                  className={
                    showProviderError
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  Chọn nhà cung cấp
                </span>
              )}
            </button>
            {showProviderError && !formData.billProvider && (
              <p className="text-xs text-destructive">
                Vui lòng chọn nhà cung cấp
              </p>
            )}
            {formData.billProvider && !hasActiveBill && (
              <p className="text-xs text-amber-600">
                Bạn không có hóa đơn cần thanh toán tại nhà cung cấp này
              </p>
            )}
          </div>

          {hasActiveBill && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Mã khách hàng <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Mã khách hàng"
                value={userProfile?.cif || formData.customerCode || ""}
                disabled
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
          )}

          {hasActiveBill && formData.billAmount && (
            <div className="space-y-1.5">
              <Label className="text-xs">Số tiền cần thanh toán</Label>
              <Card className="p-3 bg-muted/30">
                <p className="text-lg font-bold text-foreground">
                  {Number(formData.billAmount || 0).toLocaleString("vi-VN")} đ
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {billService === "electric"
                    ? "Hóa đơn tiền điện"
                    : "Hóa đơn tiền nước"}{" "}
                  tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
                </p>
              </Card>
            </div>
          )}
        </section>

        <Button
          type="button"
          disabled={isPaying}
          className="w-full mt-4"
          onClick={async (e) => {
            if (!formData.billProvider) {
              e.preventDefault();
              setShowProviderError(true);
              return;
            }

            if (!hasActiveBill || !billServiceForDb || !selectedProviderId) {
              e.preventDefault();
              return;
            }

            e.preventDefault();
            setIsPaying(true);

            try {
              await payUserUtilityBill({
                service: billServiceForDb as UtilityBillServiceType,
                providerId: selectedProviderId,
                accountId: account?.accountNumber || "DEMO",
              });

              setIsPaying(false);

              // Call parent callback to navigate to result page
              if (onPaymentSuccess) {
                onPaymentSuccess();
              }
            } catch (error) {
              setIsPaying(false);
              // Error will be shown by the service
              console.error("Payment failed:", error);
            }
          }}
        >
          {isPaying ? "Đang xử lý..." : "Tiếp tục"}
        </Button>

        {renderBillProviderSheet()}
      </div>
    );
  };

  if (!billService) return renderBillMain();
  return renderBillPayment();
}
