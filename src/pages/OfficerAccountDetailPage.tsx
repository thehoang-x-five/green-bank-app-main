// src/pages/OfficerAccountDetailPage.tsx
import { useState, useMemo, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type AccountType = "CHECKING" | "SAVING" | "MORTGAGE";

type Account = {
  id: string;
  customerId: string;
  accountNumber: string;
  type: AccountType;
  balance: number;
  interestRate?: number; // cho saving
};

// Mock data tạm – nên đồng bộ id với MOCK_ACCOUNTS ở trang detail khách hàng
const MOCK_ACCOUNTS: Account[] = [
  {
    id: "a1",
    customerId: "c1",
    accountNumber: "1234567890",
    type: "CHECKING",
    balance: 125_430_000,
  },
  {
    id: "a2",
    customerId: "c1",
    accountNumber: "0987654321",
    type: "SAVING",
    balance: 50_000_000,
    interestRate: 5.5,
  },
];

const typeLabel: Record<AccountType, string> = {
  CHECKING: "Tài khoản thanh toán",
  SAVING: "Tài khoản tiết kiệm",
  MORTGAGE: "Tài khoản vay thế chấp",
};

const OfficerAccountDetailPage = () => {
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();

  const account = useMemo(
    () => MOCK_ACCOUNTS.find((a) => a.id === accountId),
    [accountId]
  );

  const [rate, setRate] = useState(
    account?.interestRate?.toString() ?? ""
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!account) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <p className="text-sm text-slate-500 mb-4">
          Không tìm thấy tài khoản.
        </p>
        <Button variant="outline" onClick={() => navigate("/officer/customers")}>
          Quay lại danh sách khách hàng
        </Button>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (account.type !== "SAVING") return;

    setIsSaving(true);

    // TODO: sau này gọi Firebase/API để cập nhật lãi suất
    console.log("Update interest rate", { accountId, newRate: rate });

    setTimeout(() => {
      setIsSaving(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 rounded-b-3xl shadow-md">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-emerald-800/60 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-xs text-emerald-100 mb-0.5">
              Chi tiết tài khoản
            </p>
            <h1 className="text-xl font-semibold">
              {account.accountNumber}
            </h1>
            <p className="text-emerald-100 text-xs mt-1">
              {typeLabel[account.type]}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-24 space-y-4">
        <Card className="border-0 shadow-sm bg-white">
          <div className="p-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Loại tài khoản</span>
              <span className="font-medium">{typeLabel[account.type]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Số tài khoản</span>
              <span className="font-medium">{account.accountNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Số dư hiện tại</span>
              <span className="font-semibold">
                {account.balance.toLocaleString("vi-VN")} VND
              </span>
            </div>
          </div>
        </Card>

        {account.type === "SAVING" && (
          <Card className="border-0 shadow-sm bg-white">
            <form className="p-4 space-y-3" onSubmit={handleSubmit}>
              <h2 className="text-sm font-semibold text-slate-800">
                Lãi suất tiết kiệm
              </h2>
              <p className="text-xs text-slate-500">
                Nhân viên ngân hàng có thể điều chỉnh lãi suất cho tài khoản
                tiết kiệm này theo chính sách hiện hành.
              </p>

              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  Lãi suất (%/năm)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="max-w-[160px]"
                    placeholder="5.5"
                  />
                  <span className="text-xs text-slate-500">
                    Ví dụ: 5.5 (%)
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2"
                disabled={isSaving || !rate}
              >
                {isSaving ? "Đang lưu..." : "Cập nhật lãi suất"}
              </Button>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
};

export default OfficerAccountDetailPage;
