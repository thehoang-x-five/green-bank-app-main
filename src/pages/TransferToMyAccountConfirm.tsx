// src/pages/TransferToMyAccountConfirm.tsx
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRightLeft, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";

type MyAccount = {
  id: string;
  label: string;
  number: string;
  type: "account" | "card";
  balance: string;
};

const myAccounts: MyAccount[] = [
  {
    id: "acc-main",
    label: "Tài khoản thanh toán VND",
    number: "1234 5678 9001",
    type: "account",
    balance: "25.000.000 đ",
  },
  {
    id: "acc-savings",
    label: "Tài khoản tiết kiệm",
    number: "8888 6666 2222",
    type: "account",
    balance: "100.000.000 đ",
  },
  {
    id: "card-visa",
    label: "Thẻ ghi nợ nội địa",
    number: "9704 **** **** 1234",
    type: "card",
    balance: "5.000.000 đ",
  },
];

const TransferToMyAccountConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation() as {
    state?: { sourceId?: string; targetId?: string };
  };

  const sourceId = location.state?.sourceId ?? "acc-main";
  const targetId = location.state?.targetId ?? "acc-savings";

  const sourceAccount = myAccounts.find((a) => a.id === sourceId);
  const targetAccount = myAccounts.find((a) => a.id === targetId);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleQuickAmount = (value: string) => {
    setAmount(value);
  };

  const handleSubmit = () => {
    if (!sourceAccount || !targetAccount) {
      toast.error("Thiếu thông tin tài khoản nguồn hoặc tài khoản đích");
      return;
    }

    if (!amount) {
      toast.error("Vui lòng nhập số tiền");
      return;
    }

    const clean = amount.replace(/[.,]/g, "");
    if (!/^\d+$/.test(clean)) {
      toast.error("Số tiền chỉ được chứa chữ số");
      return;
    }

    const now = new Date().toLocaleString("vi-VN");

    navigate("/transfer/result", {
      state: {
        result: {
          flow: "self",
          amount,
          content: note,
          time: now,
          fee: "0 đ",
          source: {
            label: sourceAccount.label,
            number: sourceAccount.number,
          },
          destination: {
            label: targetAccount.label,
            number: targetAccount.number,
          },
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-muted pb-16">
      {/* Header */}
      <div className="relative bg-primary text-primary-foreground pb-4">
        <div className="flex items-center gap-2 px-4 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full p-2 hover:bg-primary/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Nhập số tiền chuyển nội bộ</h1>
        </div>

        <div className="px-4 pt-3 pb-5 text-xs text-primary-foreground/80">
          <p>
            Kiểm tra lại tài khoản nguồn, tài khoản đích và nhập số tiền muốn
            chuyển.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="-mt-4 px-4 pb-6 space-y-6">
        {/* Tóm tắt nguồn tiền / tài khoản đích */}
        <Card className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                {sourceAccount?.type === "account" ? (
                  <Wallet className="h-4 w-4 text-primary" />
                ) : (
                  <CreditCard className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Nguồn tiền</p>
                <p className="text-sm font-medium">
                  {sourceAccount?.label ?? "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {sourceAccount?.number}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                {targetAccount?.type === "account" ? (
                  <Wallet className="h-4 w-4 text-primary" />
                ) : (
                  <CreditCard className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Tài khoản đích</p>
                <p className="text-sm font-medium">
                  {targetAccount?.label ?? "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {targetAccount?.number}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Nhập số tiền */}
        <section className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Số tiền chuyển
          </p>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="Nhập số tiền (VND)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg font-semibold"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleQuickAmount("500.000")}
            >
              500.000
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleQuickAmount("1.000.000")}
            >
              1.000.000
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleQuickAmount("2.000.000")}
            >
              2.000.000
            </Button>
          </div>
        </section>

        {/* Nội dung chuyển tiền */}
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Nội dung (không bắt buộc)
          </p>
          <Input
            type="text"
            placeholder="VD: Chuyển tiền tiết kiệm, trả nợ thẻ..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </section>

        {/* Thông tin phí */}
        <Card className="p-3 text-xs space-y-1 text-muted-foreground">
          <div className="flex justify-between">
            <span>Phí giao dịch</span>
            <span className="font-medium text-foreground">0 đ</span>
          </div>
          <p className="text-[11px]">
            Chỉ cho phép chuyển tiền giữa các tài khoản/thẻ đứng tên chính chủ.
          </p>
        </Card>

        {/* Nút xác nhận */}
        <div className="pt-2">
          <Button className="w-full" size="lg" onClick={handleSubmit}>
            Xác nhận chuyển tiền
          </Button>
        </div>
      </main>
    </div>
  );
};

export default TransferToMyAccountConfirm;
