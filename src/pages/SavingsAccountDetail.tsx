import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { get, ref } from "firebase/database";

type SavingTermKey = "1m" | "3m" | "6m" | "12m";

interface SavingAccountInDb {
  uid?: string;
  number?: string;
  amount?: number | string;
  term?: string;
  rate?: number | string;
  openDate?: string; // yyyy-mm-dd
  maturityDate?: string; // yyyy-mm-dd
  createdAt?: number;
}

interface SavingAccount {
  number: string;
  amount: number;
  term: string;
  rate: number; // %/năm (lưu trong hợp đồng, dùng fallback)
  openDate: string;
  maturityDate: string;
}

type SavingRateConfig = Partial<Record<SavingTermKey, number>>;

const formatMoney = (value: number): string =>
  value.toLocaleString("vi-VN") + " VND";

const formatDateDisplay = (iso: string): string => {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

const getTermKeyFromLabel = (term: string): SavingTermKey | null => {
  const t = term.toLowerCase();
  if (t.includes("1 tháng")) return "1m";
  if (t.includes("3 tháng")) return "3m";
  if (t.includes("6 tháng")) return "6m";
  if (t.includes("12 tháng") || t.includes("1 năm")) return "12m";
  return null;
};

const getMonthsFromLabel = (term: string): number => {
  const t = term.toLowerCase();
  if (t.includes("1 tháng")) return 1;
  if (t.includes("3 tháng")) return 3;
  if (t.includes("6 tháng")) return 6;
  if (t.includes("12 tháng") || t.includes("1 năm")) return 12;
  return 12;
};

const SavingsAccountDetail = () => {
  const navigate = useNavigate();
  const params = useParams();
  const accountParam = params.accountNumber ?? null;

  const [accounts, setAccounts] = useState<SavingAccount[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [rateConfig, setRateConfig] = useState<SavingRateConfig>({});
  const [loading, setLoading] = useState<boolean>(true);

  // ========== LOAD DATA ==========
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (!user) {
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
          navigate("/login");
          return;
        }

        // 1. Danh sách sổ tiết kiệm
        const savingSnap = await get(
          ref(firebaseRtdb, `savingAccounts/${user.uid}`)
        );

        let list: SavingAccount[] = [];
        if (savingSnap.exists()) {
          const rawVal = savingSnap.val() as Record<string, SavingAccountInDb>;
          list = Object.keys(rawVal).map((key) => {
            const raw = rawVal[key];
            const amount =
              typeof raw.amount === "number"
                ? raw.amount
                : Number(raw.amount ?? 0);
            const rate =
              typeof raw.rate === "number"
                ? raw.rate
                : Number(raw.rate ?? 0);

            return {
              number: raw.number ?? key,
              amount: Number.isNaN(amount) ? 0 : amount,
              term: raw.term ?? "",
              rate: Number.isNaN(rate) ? 0 : rate,
              openDate: raw.openDate ?? "",
              maturityDate: raw.maturityDate ?? "",
            };
          });
        }

        // Chọn sổ đang xem
        let initialNumber: string | null = null;
        if (accountParam && list.some((s) => s.number === accountParam)) {
          initialNumber = accountParam;
        } else if (list.length > 0) {
          initialNumber = list[0].number;
        }

        setAccounts(list);
        setSelectedNumber(initialNumber);

        // 2. Bảng lãi suất chung do nhân viên chỉnh
        //    Ưu tiên đọc interestConfig/saving, nếu không có thì fallback sang config/rates/saving
        const paths = ["interestConfig/saving", "config/rates/saving"];
        let cfg: SavingRateConfig = {};
        let found = false;

        for (const path of paths) {
          const rateSnap = await get(ref(firebaseRtdb, path));
          if (!rateSnap.exists()) continue;

          const rawCfg = rateSnap.val() as Record<string, unknown>;
          const tmp: SavingRateConfig = {};
          (["1m", "3m", "6m", "12m"] as SavingTermKey[]).forEach((k) => {
            const v = rawCfg[k];
            if (typeof v === "number") {
              tmp[k] = v;
            } else if (typeof v === "string" && v.trim() !== "") {
              const num = Number(v);
              if (!Number.isNaN(num)) tmp[k] = num;
            }
          });

          cfg = tmp;
          found = true;
          break;
        }

        if (found) {
          setRateConfig(cfg);
        } else {
          setRateConfig({});
        }
      } catch (error) {
        console.error("Lỗi khi tải tài khoản tiết kiệm:", error);
        toast.error("Không thể tải thông tin tài khoản tiết kiệm.");
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

  // Tính toán lãi cho sổ đang chọn (dùng rateConfig nếu có)
  const interestInfo = useMemo(() => {
    if (!selectedAccount) {
      return {
        yearlyRate: 0,
        monthlyInterest: 0,
        totalInterest: 0,
        maturityAmount: 0,
      };
    }

    const termKey = getTermKeyFromLabel(selectedAccount.term);
    const rateFromConfig =
      termKey && rateConfig[termKey] != null
        ? rateConfig[termKey]!
        : undefined;

    const yearlyRate =
      rateFromConfig != null && !Number.isNaN(rateFromConfig)
        ? rateFromConfig
        : selectedAccount.rate;

    const months = getMonthsFromLabel(selectedAccount.term);
    const principal = selectedAccount.amount;

    const monthlyRate = yearlyRate / 100 / 12;
    const monthlyInterest =
      principal > 0 ? Math.round(principal * monthlyRate) : 0;
    const totalInterest =
      principal > 0
        ? Math.round(principal * (yearlyRate / 100) * (months / 12))
        : 0;
    const maturityAmount = principal + totalInterest;

    return { yearlyRate, monthlyInterest, totalInterest, maturityAmount };
  }, [selectedAccount, rateConfig]);

  const totalSaving = accounts.reduce((sum, a) => sum + a.amount, 0);

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
              Chi tiết tài khoản tiết kiệm
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Số lượng sổ: {accounts.length}
            </p>
            <p className="text-xs text-primary-foreground/80">
              Tổng số tiền gửi:{" "}
              <span className="font-semibold">{formatMoney(totalSaving)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {loading && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Đang tải thông tin tài khoản tiết kiệm...
            </p>
          </Card>
        )}

        {!loading && accounts.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Bạn chưa có tài khoản tiết kiệm nào.
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
            {/* Danh sách sổ để chọn */}
            {accounts.length > 1 && (
              <Card className="p-4 space-y-2">
                <p className="text-sm font-semibold">Danh sách sổ tiết kiệm</p>
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
              <Card className="p-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Số tài khoản</span>
                  <span className="font-medium">{selectedAccount.number}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Số tiền gửi ban đầu
                  </span>
                  <span className="font-medium">
                    {formatMoney(selectedAccount.amount)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kỳ hạn</span>
                  <span className="font-medium">
                    {selectedAccount.term || "—"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Lãi suất hiện tại
                  </span>
                  <span className="font-medium">
                    {interestInfo.yearlyRate}%/năm
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ngày mở</span>
                  <span className="font-medium">
                    {formatDateDisplay(selectedAccount.openDate)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ngày đáo hạn</span>
                  <span className="font-medium">
                    {formatDateDisplay(selectedAccount.maturityDate)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Lợi nhuận hàng tháng (ước tính)
                  </span>
                  <span className="font-medium">
                    {interestInfo.monthlyInterest > 0
                      ? formatMoney(interestInfo.monthlyInterest)
                      : "—"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tổng lãi sau kỳ hạn (ước tính)
                  </span>
                  <span className="font-medium">
                    {interestInfo.totalInterest > 0
                      ? formatMoney(interestInfo.totalInterest)
                      : "—"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tổng nhận khi đáo hạn (ước tính)
                  </span>
                  <span className="font-semibold text-primary">
                    {interestInfo.maturityAmount > 0
                      ? formatMoney(interestInfo.maturityAmount)
                      : "—"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground pt-2">
                  Lãi suất và lợi nhuận hiển thị chỉ mang tính chất tham khảo.
                  Thực tế có thể thay đổi theo chính sách lãi suất của ngân hàng
                  tại từng thời điểm.
                </p>
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
      </div>
    </div>
  );
};

export default SavingsAccountDetail;
