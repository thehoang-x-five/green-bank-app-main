// src/pages/TransferToCard.tsx
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
import { ArrowLeft, CreditCard, Landmark, User2 } from "lucide-react";
import { toast } from "sonner";

const sourceAccounts = [
  {
    id: "1",
    name: "Tài khoản thanh toán VND",
    number: "1900123456789",
    balance: "25,800,000",
    currency: "VND",
    isDefault: true,
  },
  {
    id: "2",
    name: "Tài khoản thanh toán VND",
    number: "1900987654321",
    balance: "5,200,000",
    currency: "VND",
  },
];

const savedCardReceivers = [
  {
    id: "c1",
    name: "Nguyễn Thị B",
    bank: "Vietcombank",
    cardNumber: "9704 •••• •••• 1234",
  },
  {
    id: "c2",
    name: "Trần Văn C",
    bank: "BIDV",
    cardNumber: "9704 •••• •••• 5678",
  },
];

const TransferToCard = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    sourceAccountId: sourceAccounts[0]?.id ?? "",
    cardNumber: "",
    amount: "",
    description: "",
  });

  const [cardError, setCardError] = useState("");
  const [amountError, setAmountError] = useState("");

  const selectedAccount = sourceAccounts.find(
    (acc) => acc.id === formData.sourceAccountId
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // validate tối thiểu
    if (!formData.sourceAccountId || !formData.cardNumber || !formData.amount) {
      toast.error("Vui lòng nhập đầy đủ Số thẻ và Số tiền");
      return;
    }

    const rawCard = formData.cardNumber.replace(/\s+/g, "");
    if (!/^\d{12,19}$/.test(rawCard)) {
      setCardError("Số thẻ chỉ được chứa số (12–19 chữ số)");
      toast.error("Số thẻ không hợp lệ");
      return;
    }

    const rawAmount = formData.amount.replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(rawAmount) || Number(rawAmount) <= 0) {
      setAmountError("Số tiền phải là số dương hợp lệ");
      toast.error("Số tiền không hợp lệ");
      return;
    }

    if (!selectedAccount) {
      toast.error("Không tìm thấy tài khoản nguồn");
      return;
    }

    // Dữ liệu gửi sang màn biên nhận /transfer/result
    const nowText = new Date().toLocaleString("vi-VN");

    navigate("/transfer/result", {
      state: {
        result: {
          flow: "card" as const,
          amount: formData.amount, // giữ nguyên định dạng user nhập
          content: formData.description,
          time: nowText,
          fee: "0 đ",
          source: {
            label: selectedAccount.name,
            number: selectedAccount.number,
          },
          destination: {
            label: "Chủ thẻ",
            number: rawCard,
            // demo: không có thông tin ngân hàng cụ thể từ số thẻ
            bank: undefined,
          },
        },
      },
    });

    toast.success("Chuyển tiền tới thẻ thành công (demo)");
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
              Chuyển tiền tới thẻ
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Chuyển tiền nhanh qua số thẻ ATM/NAPAS
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 -mt-6 space-y-4">
        {/* Nguồn tiền */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Tài khoản nguồn</p>
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

          <div className="space-y-2">
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
                    {acc.number} • {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Thông tin người nhận */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Thông tin thẻ nhận</p>
              <p className="text-xs text-muted-foreground">
                Nhập số thẻ, số tiền và nội dung (không bắt buộc)
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Số thẻ */}
            <div className="space-y-2">
              <Label>
                Số thẻ <span className="text-destructive">*</span>
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="VD: 9704 xxxx xxxx 1234"
                value={formData.cardNumber}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    cardNumber: e.target.value,
                  }));
                  if (cardError) setCardError("");
                }}
                className={
                  cardError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {cardError && (
                <p className="text-xs text-destructive">{cardError}</p>
              )}
            </div>

            {/* Số tiền */}
            <div className="space-y-2">
              <Label>
                Số tiền <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Nhập số tiền"
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      amount: e.target.value,
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
                  VND
                </span>
              </div>
              {amountError && (
                <p className="text-xs text-destructive">{amountError}</p>
              )}
            </div>

            {/* Nội dung (không bắt buộc) */}
            <div className="space-y-2">
              <Label>
                Nội dung chuyển tiền{" "}
                <span className="text-[11px] text-muted-foreground">
                  (không bắt buộc)
                </span>
              </Label>
              <Textarea
                rows={2}
                placeholder="VD: Chuyển tiền học phí, trả nợ..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <Button type="submit" className="w-full mt-2">
              Xác nhận chuyển tiền
            </Button>
          </form>
        </Card>

        {/* Thẻ đã lưu (demo) */}
        {savedCardReceivers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Thẻ người nhận đã lưu
            </p>
            <div className="space-y-2">
              {savedCardReceivers.map((receiver) => (
                <button
                  key={receiver.id}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      cardNumber: receiver.cardNumber.replace(
                        / •••• •••• /,
                        ""
                      ),
                    }))
                  }
                  className="w-full flex items-center justify-between rounded-xl border bg-card px-3 py-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <User2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{receiver.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {receiver.cardNumber} • {receiver.bank}
                      </p>
                    </div>
                  </div>
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferToCard;
