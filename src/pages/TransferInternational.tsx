import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, User2, Wallet, Info } from "lucide-react";
import { toast } from "sonner";

const sourceAccounts = [
  {
    id: "1",
    name: "Tài khoản thanh toán VND",
    number: "1900123456789",
    balance: "250,000,000",
    currency: "VND",
    isDefault: true,
  },
  {
    id: "2",
    name: "Tài khoản ngoại tệ USD",
    number: "1900987654321",
    balance: "10,000",
    currency: "USD",
  },
];

// Tỷ giá demo quy đổi sang VND
const FX_RATES: Record<string, number> = {
  USD: 25000,
  EUR: 27000,
  AUD: 18000,
  JPY: 200,
};

const TransferInternational = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    sourceAccountId: sourceAccounts[0]?.id ?? "",
    beneficiaryName: "",
    beneficiaryCountry: "",
    beneficiaryBank: "",
    swiftCode: "",
    beneficiaryAccount: "",
    currency: "USD",
    amountForeign: "",
    purpose: "",
  });

  const [amountError, setAmountError] = useState("");
  const [swiftError, setSwiftError] = useState("");

  const selectedAccount = sourceAccounts.find(
    (acc) => acc.id === formData.sourceAccountId
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate tài khoản nguồn
    if (!formData.sourceAccountId) {
      toast.error("Vui lòng chọn tài khoản nguồn");
      return;
    }

    // Validate thông tin người thụ hưởng
    if (
      !formData.beneficiaryName ||
      !formData.beneficiaryCountry ||
      !formData.beneficiaryBank ||
      !formData.swiftCode ||
      !formData.beneficiaryAccount
    ) {
      toast.error("Vui lòng nhập đầy đủ thông tin người thụ hưởng");
      return;
    }

    // Validate SWIFT
    if (!/^[A-Za-z0-9]{8,11}$/.test(formData.swiftCode.trim())) {
      setSwiftError(
        "Mã SWIFT/BIC gồm 8–11 ký tự chữ/số (không dấu, không khoảng trắng)"
      );
      toast.error("Mã SWIFT/BIC không hợp lệ");
      return;
    }

    // Validate số tiền (đơn vị ngoại tệ)
    const rawAmount = formData.amountForeign.replace(/,/g, "");
    if (
      !rawAmount ||
      !/^\d+(\.\d+)?$/.test(rawAmount) ||
      Number(rawAmount) <= 0
    ) {
      setAmountError("Số tiền phải là số dương hợp lệ");
      toast.error("Số tiền không hợp lệ");
      return;
    }

    const rate = FX_RATES[formData.currency] ?? 1;
    const foreignAmountNumber = Number(rawAmount);
    const vndAmountNumber = Math.round(foreignAmountNumber * rate);

    // format hiển thị
    const vndFormatted = vndAmountNumber.toLocaleString("vi-VN"); // VD: 250.000.000
    const foreignFormatted = foreignAmountNumber.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });

    toast.success("Chuyển tiền quốc tế thành công (demo)");

    const now = new Date();
    const src = selectedAccount!;

    navigate("/transfer/result", {
      state: {
        result: {
          flow: "international",
          // Số tiền đã quy đổi sang VND để hiển thị ở màn chi tiết
          amount: vndFormatted,
          // Lưu thêm số tiền gốc + loại tiền để show chi tiết
          originalAmount: foreignFormatted,
          originalCurrency: formData.currency,
          content:
            formData.purpose || "Chuyển tiền quốc tế tới người thụ hưởng",
          time: now.toLocaleString("vi-VN"),
          fee: "0 đ",
          transactionId: "GD-INTL-" + now.getTime(),
          source: {
            label: `${src.name} (${src.currency})`,
            number: src.number,
          },
          destination: {
            label: formData.beneficiaryName,
            number: formData.beneficiaryAccount,
            bank: `${formData.beneficiaryBank} • ${formData.beneficiaryCountry}`,
          },
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/transfer")}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-primary-foreground">
              Chuyển tiền quốc tế
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Chuyển tiền ra nước ngoài cho người thụ hưởng
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 -mt-6 space-y-4">
        {/* Tài khoản nguồn */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">
                Tài khoản nguồn
              </p>
              <p className="text-sm font-medium">
                {selectedAccount?.name ?? "Chọn tài khoản nguồn"}
              </p>
              {selectedAccount && (
                <p className="text-xs text-muted-foreground">
                  {selectedAccount.number} • Số dư: {selectedAccount.balance}{" "}
                  {selectedAccount.currency}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label className="text-xs">Chọn tài khoản</Label>
            <Select
              value={formData.sourceAccountId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, sourceAccountId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn tài khoản nguồn" />
              </SelectTrigger>
              <SelectContent>
                {sourceAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.number} • {acc.name} ({acc.balance} {acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Thông tin người thụ hưởng + số tiền */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Thông tin người thụ hưởng</p>
              <p className="text-xs text-muted-foreground">
                Nhập thông tin người nhận tại ngân hàng nước ngoài
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>
                Họ tên người thụ hưởng{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="VD: JOHN SMITH"
                value={formData.beneficiaryName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    beneficiaryName: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Quốc gia <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.beneficiaryCountry}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    beneficiaryCountry: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn quốc gia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">Hoa Kỳ (USA)</SelectItem>
                  <SelectItem value="UK">Vương quốc Anh (UK)</SelectItem>
                  <SelectItem value="AU">Úc (Australia)</SelectItem>
                  <SelectItem value="JP">Nhật Bản (Japan)</SelectItem>
                  <SelectItem value="EU">Khu vực Châu Âu (EU)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Ngân hàng người thụ hưởng{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="VD: BANK OF AMERICA"
                value={formData.beneficiaryBank}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    beneficiaryBank: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Mã SWIFT/BIC <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="VD: BOFAUS3N"
                value={formData.swiftCode}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    swiftCode: e.target.value.toUpperCase(),
                  }));
                  if (swiftError) setSwiftError("");
                }}
                className={
                  swiftError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {swiftError && (
                <p className="text-xs text-destructive">{swiftError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Số tài khoản/IBAN <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="VD: GB29 NWBK 6016 1331 9268 19"
                value={formData.beneficiaryAccount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    beneficiaryAccount: e.target.value,
                  }))
                }
              />
            </div>

            {/* Số tiền */}
            <div className="space-y-2 pt-2">
              <Label>
                Số tiền chuyển <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="Nhập số tiền"
                    value={formData.amountForeign}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        amountForeign: e.target.value,
                      }));
                      if (amountError) setAmountError("");
                    }}
                    className={
                      amountError
                        ? "border-destructive focus-visible:ring-destructive pr-16"
                        : "pr-16"
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {formData.currency}
                  </span>
                </div>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, currency: value }))
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {amountError && (
                <p className="text-xs text-destructive">{amountError}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Tỷ giá và số tiền quy đổi sang VND được tính theo tỷ giá demo
                trong ứng dụng.
              </p>
            </div>

            {/* Mục đích */}
            <div className="space-y-2">
              <Label>
                Mục đích chuyển tiền{" "}
                <span className="text-[11px] text-muted-foreground">
                  (không bắt buộc)
                </span>
              </Label>
              <Textarea
                rows={2}
                placeholder="VD: Học phí, viện phí, trợ cấp gia đình..."
                value={formData.purpose}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    purpose: e.target.value,
                  }))
                }
              />
            </div>

            <div className="rounded-lg bg-muted px-3 py-2 text-[11px] flex gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-[2px]" />
              <p>
                Phí chuyển tiền quốc tế, tỷ giá thực tế và thời gian nhận tiền
                phụ thuộc vào ngân hàng trung gian và quốc gia người thụ hưởng
                (giao diện demo).
              </p>
            </div>

            <Button type="submit" className="w-full mt-2">
              Tiếp tục
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default TransferInternational;
