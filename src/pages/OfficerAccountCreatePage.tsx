
// src/pages/OfficerAccountCreatePage.tsx
import { useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";


type AccountType = "CHECKING" | "SAVING" | "MORTGAGE";

const OfficerAccountCreatePage = () => {
  const navigate = useNavigate();
  const { customerId } = useParams<{ customerId: string }>();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState<AccountType>("CHECKING");
  const [form, setForm] = useState({
    accountNumber: "",
    initialBalance: "",
    interestRate: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: sau này gọi Firebase để tạo account
    console.log("Create account:", {
      customerId,
      type,
      form,
    });

    setTimeout(() => {
      setIsSubmitting(false);
      // Quay lại trang chi tiết khách hàng
      navigate(`/officer/customers/${customerId}`);
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
              Mở tài khoản cho khách hàng
            </p>
            <h1 className="text-xl font-semibold">
              KH: {customerId?.toUpperCase()}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-24">
        <Card className="border-0 shadow-sm bg-white">
          <form className="p-4 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Loại tài khoản</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as AccountType)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Chọn loại tài khoản" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHECKING">Tài khoản thanh toán</SelectItem>
                  <SelectItem value="SAVING">Tài khoản tiết kiệm</SelectItem>
                  <SelectItem value="MORTGAGE">Tài khoản vay thế chấp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Số tài khoản</Label>
              <Input
                name="accountNumber"
                value={form.accountNumber}
                onChange={handleChange}
                required
                placeholder="Ví dụ: 1234567890"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Số dư ban đầu</Label>
              <Input
                name="initialBalance"
                value={form.initialBalance}
                onChange={handleChange}
                required
                placeholder="Ví dụ: 50000000"
              />
            </div>

            {type === "SAVING" && (
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  Lãi suất tiết kiệm (%/năm)
                </Label>
                <Input
                  name="interestRate"
                  value={form.interestRate}
                  onChange={handleChange}
                  placeholder="Ví dụ: 5.5"
                />
              </div>
            )}

            {/* Với MORTGAGE nếu cần sau này có thể thêm field khoản vay, kỳ hạn */}

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang tạo..." : "Tạo tài khoản"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default OfficerAccountCreatePage;
