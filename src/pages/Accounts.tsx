// src/pages/Accounts.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { get, ref } from "firebase/database";
import { getPrimaryAccount, type BankAccount } from "@/services/accountService";

type AccountCard = {
  type: string;
  accountNumber: string;
  color: string;
  route: string;
  balanceLabel: string;
  balance?: string;
};

interface SavingAccountInDb {
  number?: string;
  amount?: number | string;
  term?: string;
  rate?: number | string;
}

interface SavingAccount {
  number: string;
  amount: number;
  term: string;
  rate: number;
}

interface MortgageAccountInDb {
  number?: string;
  originalAmount?: number | string;
  debtRemaining?: number | string;
  termMonths?: number | string;
  rate?: number | string;
}

interface MortgageAccount {
  number: string;
  originalAmount: number;
  debtRemaining: number;
  termMonths: number;
  rate: number;
}

const formatMoneyNumber = (value: number): string =>
  value.toLocaleString("vi-VN");

const Accounts = () => {
  const navigate = useNavigate();
  const [showBalances, setShowBalances] = useState(true);

  const [primaryAccount, setPrimaryAccount] = useState<BankAccount | null>(null);
  const [savingAccounts, setSavingAccounts] = useState<SavingAccount[]>([]);
  const [mortgageAccounts, setMortgageAccounts] = useState<MortgageAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (!user) {
          setLoading(false);
          navigate("/login");
          return;
        }

        // 1. tài khoản thanh toán
        const acc = await getPrimaryAccount(user.uid);
        if (!acc) {
          toast.info(
            "Hiện tại bạn chưa có tài khoản thanh toán. Vui lòng liên hệ ngân hàng để được hỗ trợ."
          );
        }
        setPrimaryAccount(acc);

        // 2. danh sách tài khoản tiết kiệm
        try {
          const savingSnap = await get(
            ref(firebaseRtdb, `savingAccounts/${user.uid}`)
          );
          if (savingSnap.exists()) {
            const rawVal = savingSnap.val() as Record<string, SavingAccountInDb>;
            const list: SavingAccount[] = Object.keys(rawVal).map((key) => {
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
              };
            });
            setSavingAccounts(list);
          }
        } catch (err) {
          console.error("Lỗi đọc savingAccounts:", err);
        }

        // 3. danh sách tài khoản thế chấp
        try {
          const mortgageSnap = await get(
            ref(firebaseRtdb, `mortgageAccounts/${user.uid}`)
          );
          if (mortgageSnap.exists()) {
            const rawVal = mortgageSnap.val() as Record<
              string,
              MortgageAccountInDb
            >;
            const list: MortgageAccount[] = Object.keys(rawVal).map((key) => {
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
              };
            });
            setMortgageAccounts(list);
          }
        } catch (err) {
          console.error("Lỗi đọc mortgageAccounts:", err);
        }
      } catch (error) {
        console.error("Lỗi khi tải tài khoản:", error);
        toast.error("Không tải được thông tin tài khoản.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [navigate]);

  const cards: AccountCard[] = [];

  if (primaryAccount) {
    cards.push({
      type: "Tài khoản thanh toán",
      accountNumber: primaryAccount.accountNumber || "—",
      balance: formatMoneyNumber(primaryAccount.balance ?? 0),
      color: "from-primary to-accent",
      route: "/accounts/payment",
      balanceLabel: "Số dư khả dụng",
    });
  }

  const totalSaving = savingAccounts.reduce(
    (sum, s) => sum + s.amount,
    0
  );
  if (savingAccounts.length > 0) {
    cards.push({
      type: "Tài khoản tiết kiệm",
      accountNumber: `Số lượng: ${savingAccounts.length}`,
      balance: formatMoneyNumber(totalSaving),
      color: "from-emerald-400 to-emerald-500",
      route: savingAccounts.length
        ? `/accounts/savings/${savingAccounts[0].number}`
        : "/accounts", // fallback
      balanceLabel: "Tổng số tiền gửi",
    });
  }

  const totalDebt = mortgageAccounts.reduce(
    (sum, m) => sum + m.debtRemaining,
    0
  );
  if (mortgageAccounts.length > 0) {
    cards.push({
      type: "Tài khoản thế chấp",
      accountNumber: `Số lượng: ${mortgageAccounts.length}`,
      balance: formatMoneyNumber(totalDebt),
      color: "from-emerald-700 to-emerald-900",
      route: mortgageAccounts.length
        ? `/accounts/mortgage/${mortgageAccounts[0].number}`
        : "/accounts",
      balanceLabel: "Tổng dư nợ còn lại",
    });
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/home")}
              className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-primary-foreground">
              Tài khoản
            </h1>
          </div>
          <button
            onClick={() => setShowBalances((prev) => !prev)}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            aria-label="Ẩn/hiện số dư"
          >
            {showBalances ? <Eye size={24} /> : <EyeOff size={24} />}
          </button>
        </div>

        {loading && (
          <p className="mt-3 text-xs text-primary-foreground/80">
            Đang tải thông tin tài khoản...
          </p>
        )}
      </div>

      {/* Danh sách tài khoản */}
      <div className="px-6 -mt-4 space-y-4">
        {cards.length === 0 && !loading && (
          <Card className="p-5 mt-2">
            <p className="text-sm text-muted-foreground">
              Bạn chưa có tài khoản nào trên hệ thống.
            </p>
          </Card>
        )}

        {cards.map((account, index) => (
          <Card key={index} className="overflow-hidden">
            <div
              className={`bg-gradient-to-br ${account.color} p-5 text-white`}
            >
              <p className="text-sm opacity-90 mb-1">{account.type}</p>
              <p className="text-lg font-semibold mb-3">
                {account.accountNumber}
              </p>

              <div>
                <p className="text-xs opacity-80">{account.balanceLabel}</p>
                <p className="text-3xl font-bold mt-1">
                  {showBalances ? account.balance : "••••••••"} VND
                </p>
              </div>
            </div>

            <div className="p-4 bg-muted/30">
              <button
                className="text-sm text-primary font-medium hover:underline"
                onClick={() => {
                  if (!account.route.startsWith("/accounts/")) {
                    navigate("/accounts");
                    return;
                  }
                  navigate(account.route);
                }}
              >
                Xem chi tiết →
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Accounts;
