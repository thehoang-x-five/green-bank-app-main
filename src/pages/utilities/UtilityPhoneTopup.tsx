import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { useUserAccount } from "@/hooks/useUserAccount";
import { useEkycCheck } from "@/hooks/useEkycCheck";
import { useNavigate } from "react-router-dom";
import { fbAuth, fbRtdb } from "@/lib/firebase";
import { ref, get } from "firebase/database";

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

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  balance: number;
}

const TOPUP_AMOUNTS = [
  10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000,
];

export default function UtilityPhoneTopup({ formData, setFormData }: Props) {
  const navigate = useNavigate();
  const { account } = useUserAccount();
  const { isVerified } = useEkycCheck();

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // ✅ [PATCH-RESET-ON-UNMOUNT] Reset selections when component unmounts (back navigation)
  useEffect(() => {
    return () => {
      // Reset form data when leaving the page
      setFormData((prev) => ({
        ...prev,
        topupAmount: "",
      }));
    };
  }, [setFormData]);

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

  // Load accounts for payment
  const loadAccounts = async () => {
    const user = fbAuth.currentUser;
    if (!user) {
      toast.error("Vui lòng đăng nhập");
      navigate("/login");
      return;
    }

    setLoadingAccounts(true);
    try {
      const accountsRef = ref(fbRtdb, "accounts");
      const snap = await get(accountsRef);

      if (!snap.exists()) {
        setAccounts([]);
        toast.error("Bạn chưa có tài khoản thanh toán");
        setLoadingAccounts(false);
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

      setAccounts(accountList);

      if (accountList.length === 0) {
        toast.error("Bạn chưa có tài khoản thanh toán");
      } else {
        setSelectedAccountId(accountList[0].id);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
      toast.error("Không thể tải danh sách tài khoản");
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Handle payment confirmation
  const handlePaymentConfirm = () => {
    // Validate inputs
    if (!validatePhoneNumber(formData.phoneNumber)) {
      toast.error("Vui lòng nhập số điện thoại hợp lệ");
      return;
    }

    if (!formData.topupAmount || Number(formData.topupAmount) <= 0) {
      toast.error("Vui lòng chọn mệnh giá nạp");
      return;
    }

    // ✅ Kiểm tra eKYC trước khi mở modal thanh toán
    if (!isVerified) {
      toast.error(
        "Khách hàng chưa hoàn tất eKYC nên không thể thực hiện thanh toán"
      );
      return;
    }

    // Show payment modal and load accounts
    setShowPaymentModal(true);
    loadAccounts();
  };

  // Handle payment execution - Navigate to PIN screen
  const handlePayment = () => {
    if (!selectedAccountId) {
      toast.error("Vui lòng chọn tài khoản thanh toán");
      return;
    }

    // Close modal and navigate to PIN screen
    setShowPaymentModal(false);

    // Navigate to PIN screen with payment request
    navigate("/utilities/pin", {
      state: {
        pendingRequest: {
          type: "PHONE_TOPUP",
          amount: Number(formData.topupAmount),
          accountId: selectedAccountId,
          details: {
            phoneNumber: formData.phoneNumber,
            telco: formData.telco,
            formData: {
              phoneNumber: formData.phoneNumber,
              telco: formData.telco,
              topupAmount: formData.topupAmount,
            },
            source: "home",
          },
        },
        returnPath: "/utilities/phone",
      },
    });
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
              <p className="text-xl font-bold text-foreground">
                {account
                  ? `${account.balance.toLocaleString("vi-VN")} đ`
                  : "0 đ"}
              </p>
              <p className="text-sm text-muted-foreground">
                Normal Account | {account?.accountNumber || "0862525038"}
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
                className="h-11 pr-10"
              />

              {formData.phoneNumber?.length > 0 && (
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

      {/* Payment confirmation button - chỉ hiện khi đã chọn mệnh giá */}
      {formData.topupAmount && Number(formData.topupAmount) > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <Button
              type="button"
              onClick={handlePaymentConfirm}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              Tiếp tục
            </Button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
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
                <span className="font-semibold">{formData.phoneNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nhà mạng</span>
                <span className="font-semibold">
                  {getTelcoLabel(formData.telco)}
                </span>
              </div>
              <div className="border-t pt-2 flex items-center justify-between text-base font-bold text-primary">
                <span>Tổng thanh toán</span>
                <span>
                  {Number(formData.topupAmount).toLocaleString("vi-VN")} ₫
                </span>
              </div>
            </div>

            {/* Account Selection */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Tài khoản nguồn
              </p>
              {loadingAccounts && (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingAccounts && accounts.length > 0 && (
                <div className="space-y-2">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedAccountId === acc.id
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedAccountId(acc.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono font-semibold">
                            {acc.accountNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {acc.accountType}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-primary">
                            {acc.balance.toLocaleString("vi-VN")} ₫
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!loadingAccounts && accounts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Chưa có tài khoản thanh toán
                </p>
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
                onClick={handlePayment}
                disabled={!selectedAccountId || processingPayment}
                className="flex-1"
              >
                {processingPayment ? "Đang xử lý..." : "Thanh toán"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
