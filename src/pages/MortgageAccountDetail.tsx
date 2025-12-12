import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { get, ref } from "firebase/database";

interface MortgageAccountInDb {
  uid?: string;
  number?: string;
  originalAmount?: number | string;
  debtRemaining?: number | string;
  termMonths?: number | string;
  rate?: number | string; // %/năm
  startDate?: string; // yyyy-mm-dd
  maturityDate?: string; // yyyy-mm-dd
  note?: string;
  createdAt?: number;
}

interface MortgageAccount {
  number: string;
  originalAmount: number;
  debtRemaining: number;
  termMonths: number;
  rate: number;
  startDate: string;
  maturityDate: string;
  note: string;
}

const DEFAULT_MORTGAGE_RATE = 9.0;

const formatMoney = (value: number): string =>
  value.toLocaleString("vi-VN") + " VND";

const formatDateDisplay = (iso: string): string => {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

const MortgageAccountDetail = () => {
  const navigate = useNavigate();
  const params = useParams();
  const accountParam = params.accountNumber ?? null;

  const [accounts, setAccounts] = useState<MortgageAccount[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [configRate, setConfigRate] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // ===== LOAD DATA =====
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (!user) {
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
          navigate("/login");
          return;
        }

        // 1. Danh sách tài khoản thế chấp
        const mortgageSnap = await get(
          ref(firebaseRtdb, `mortgageAccounts/${user.uid}`)
        );

        let list: MortgageAccount[] = [];
        if (mortgageSnap.exists()) {
          const rawVal = mortgageSnap.val() as Record<
            string,
            MortgageAccountInDb
          >;

          list = Object.keys(rawVal).map((key) => {
            const raw = rawVal[key];

            const originalAmount =
              typeof raw.originalAmount === "number"
                ? raw.originalAmount
                : Number(raw.originalAmount ?? 0);

            const debtRemaining =
              typeof raw.debtRemaining === "number"
                ? raw.debtRemaining
                : Number(raw.debtRemaining ?? 0);

            const termMonths =
              typeof raw.termMonths === "number"
                ? raw.termMonths
                : Number(raw.termMonths ?? 0);

            const rate =
              typeof raw.rate === "number"
                ? raw.rate
                : Number(raw.rate ?? 0);

            return {
              number: raw.number ?? key,
              originalAmount: Number.isNaN(originalAmount) ? 0 : originalAmount,
              debtRemaining: Number.isNaN(debtRemaining) ? 0 : debtRemaining,
              termMonths: Number.isNaN(termMonths) ? 0 : termMonths,
              rate: Number.isNaN(rate) ? 0 : rate,
              startDate: raw.startDate ?? "",
              maturityDate: raw.maturityDate ?? "",
              note: raw.note ?? "Khoản vay thế chấp",
            };
          });
        }

        let initialNumber: string | null = null;
        if (accountParam && list.some((m) => m.number === accountParam)) {
          initialNumber = accountParam;
        } else if (list.length > 0) {
          initialNumber = list[0].number;
        }

        setAccounts(list);
        setSelectedNumber(initialNumber);

        // 2. Lãi suất chuẩn vay thế chấp do nhân viên chỉnh
        try {
          const rateSnap = await get(
            ref(firebaseRtdb, "interestConfig/mortgage/baseRate")
          );
          if (rateSnap.exists()) {
            const rawRate = rateSnap.val();
            let num: number | null = null;

            if (typeof rawRate === "number") {
              num = rawRate;
            } else if (
              typeof rawRate === "string" &&
              rawRate.trim() !== ""
            ) {
              const v = Number(rawRate);
              if (!Number.isNaN(v)) num = v;
            }

            if (num != null) {
              setConfigRate(num);
            } else {
              setConfigRate(DEFAULT_MORTGAGE_RATE);
            }
          } else {
            setConfigRate(DEFAULT_MORTGAGE_RATE);
          }
        } catch (err) {
          console.error("Lỗi đọc interestConfig/mortgage/baseRate:", err);
          setConfigRate(DEFAULT_MORTGAGE_RATE);
        }
      } catch (error) {
        console.error("Lỗi khi tải tài khoản thế chấp:", error);
        toast.error("Không thể tải thông tin tài khoản thế chấp.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accountParam, navigate]);

  const selectedAccount = useMemo(() => {
    if (!selectedNumber) return null;
    return accounts.find((a) => a.number === selectedNumber) ?? null;
  }, [accounts, selectedNumber]);

  const {
    yearlyRate,
    monthlyInterest,
    principalPerMonth,
    monthlyPayment,
    paymentCycleLabel,
  } = useMemo(() => {
    if (!selectedAccount || selectedAccount.termMonths <= 0) {
      return {
        yearlyRate: 0,
        monthlyInterest: 0,
        principalPerMonth: 0,
        monthlyPayment: 0,
        paymentCycleLabel: "Hàng tháng",
      };
    }

    const rateToUse =
      configRate != null && !Number.isNaN(configRate)
        ? configRate
        : selectedAccount.rate;

    const monthlyRate = rateToUse / 100 / 12;
    const principalEachMonth = Math.round(
      selectedAccount.originalAmount / selectedAccount.termMonths
    );
    const interestEachMonth = Math.round(
      selectedAccount.debtRemaining * monthlyRate
    );
    const paymentEachMonth = principalEachMonth + interestEachMonth;

    return {
      yearlyRate: rateToUse,
      monthlyInterest: interestEachMonth,
      principalPerMonth: principalEachMonth,
      monthlyPayment: paymentEachMonth,
      paymentCycleLabel: "Hàng tháng",
    };
  }, [selectedAccount, configRate]);

  const totalDebt = accounts.reduce((sum, a) => sum + a.debtRemaining, 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/accounts")}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-primary-foreground hover:bg-white/25 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              Chi tiết tài khoản thế chấp
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Số lượng: {accounts.length} tài khoản
            </p>
            <p className="text-xs text-primary-foreground/80">
              Tổng dư nợ còn lại:{" "}
              <span className="font-semibold">{formatMoney(totalDebt)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {loading && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Đang tải thông tin tài khoản thế chấp...
            </p>
          </Card>
        )}

        {!loading && accounts.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Bạn chưa có tài khoản thế chấp nào.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => navigate("/accounts")}
            >
              Quay lại danh sách tài khoản
            </Button>
          </Card>
        )}

        {!loading && accounts.length > 0 && (
          <>
            {/* Danh sách tài khoản để chọn */}
            {accounts.length > 1 && (
              <Card className="p-4 space-y-2">
                <p className="text-sm font-semibold">
                  Danh sách tài khoản thế chấp
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {accounts.map((acc) => (
                    <Button
                      key={acc.number}
                      size="sm"
                      variant={
                        acc.number === selectedNumber ? "default" : "outline"
                      }
                      onClick={() => setSelectedNumber(acc.number)}
                    >
                      {acc.number}
                    </Button>
                  ))}
                </div>
              </Card>
            )}

            {selectedAccount && (
              <>
                <Card className="p-6 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Số tài khoản</span>
                    <span className="font-medium">
                      {selectedAccount.number}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Số tiền vay ban đầu
                    </span>
                    <span className="font-medium">
                      {formatMoney(selectedAccount.originalAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Dư nợ còn lại
                    </span>
                    <span className="font-semibold text-primary">
                      {formatMoney(selectedAccount.debtRemaining)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kỳ hạn</span>
                    <span className="font-medium">
                      {selectedAccount.termMonths > 0
                        ? `${selectedAccount.termMonths} tháng`
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lãi suất</span>
                    <span className="font-medium">{yearlyRate}%/năm</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Ngày bắt đầu vay
                    </span>
                    <span className="font-medium">
                      {formatDateDisplay(selectedAccount.startDate)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ngày đáo hạn</span>
                    <span className="font-medium">
                      {formatDateDisplay(selectedAccount.maturityDate)}
                    </span>
                  </div>
                </Card>

                <Card className="p-6 space-y-4">
                  <h2 className="text-sm font-semibold">
                    Thông tin trả nợ định kỳ (ước tính)
                  </h2>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Tiền gốc phải trả mỗi tháng
                    </span>
                    <span className="font-medium">
                      {principalPerMonth > 0
                        ? formatMoney(principalPerMonth)
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Tiền lãi mỗi tháng (ước tính)
                    </span>
                    <span className="font-medium">
                      {monthlyInterest > 0
                        ? formatMoney(monthlyInterest)
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Tổng tiền phải trả mỗi kỳ
                    </span>
                    <span className="font-semibold text-primary">
                      {monthlyPayment > 0
                        ? formatMoney(monthlyPayment)
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Chu kỳ thanh toán
                    </span>
                    <span className="font-medium">{paymentCycleLabel}</span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    Số tiền phải trả định kỳ chỉ là ước tính dựa trên dư nợ hiện
                    tại, lãi suất và kỳ hạn. Thực tế có thể thay đổi theo chính
                    sách của ngân hàng và lịch thanh toán cụ thể.
                  </p>
                </Card>

                {selectedAccount.note && (
                  <Card className="p-6">
                    <p className="text-xs text-muted-foreground mb-1">
                      Ghi chú
                    </p>
                    <p className="text-sm">{selectedAccount.note}</p>
                  </Card>
                )}

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate("/home")}
                >
                  Về trang chủ
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MortgageAccountDetail;
