// src/pages/TransferToMyAccount.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Wallet, CreditCard } from "lucide-react";
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

const TransferToMyAccount = () => {
  const navigate = useNavigate();

  const [sourceId, setSourceId] = useState<string>("acc-main");
  const [targetId, setTargetId] = useState<string>("");

  const sourceAccount = myAccounts.find((acc) => acc.id === sourceId);
  const targetAccount = myAccounts.find((acc) => acc.id === targetId);

  const handleConfirm = () => {
    if (!sourceAccount || !targetAccount) {
      toast.error("Vui lòng chọn đầy đủ tài khoản nguồn và tài khoản đích");
      return;
    }

    if (sourceAccount.id === targetAccount.id) {
      toast.error("Tài khoản nguồn và tài khoản đích không được trùng nhau");
      return;
    }

    navigate("/transfer/self/confirm", {
      state: {
        sourceId: sourceAccount.id,
        targetId: targetAccount.id,
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
          <h1 className="text-lg font-semibold">
            Chuyển tới thẻ/tài khoản của tôi
          </h1>
        </div>

        <div className="px-4 pt-3 pb-5 text-xs text-primary-foreground/80">
          <p>Thực hiện chuyển tiền giữa các tài khoản và thẻ của chính bạn.</p>
        </div>
      </div>

      {/* Content */}
      <main className="-mt-4 px-4 pb-6 space-y-6">
        {/* Tài khoản nguồn tiền */}
        <section>
          <h2 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
            Tài khoản nguồn tiền
          </h2>
          <Card className="p-3 space-y-2">
            {myAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSourceId(acc.id)}
                className={`w-full flex items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                  sourceId === acc.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    {acc.type === "account" ? (
                      <Wallet className="h-4 w-4 text-primary" />
                    ) : (
                      <CreditCard className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{acc.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {acc.number}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-xs font-semibold text-foreground">
                    {acc.balance}
                  </p>
                  {sourceId === acc.id && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Nguồn tiền
                    </span>
                  )}
                </div>
              </button>
            ))}
          </Card>
        </section>

        {/* Tài khoản đích */}
        <section>
          <h2 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
            Tài khoản đích
          </h2>
          <Card className="p-3 space-y-2">
            {myAccounts.map((acc) => {
              const disabled = acc.id === sourceId;
              return (
                <button
                  key={acc.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTargetId(acc.id)}
                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                    disabled
                      ? "border-transparent bg-muted/60 opacity-60 cursor-not-allowed"
                      : targetId === acc.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      {acc.type === "account" ? (
                        <Wallet className="h-4 w-4 text-primary" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{acc.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {acc.number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {targetId === acc.id && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Tài khoản đích
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </Card>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Chỉ cho phép chuyển tiền giữa các tài khoản/thẻ đứng tên chính chủ.
            Số tiền và chi tiết giao dịch sẽ được nhập ở bước tiếp theo (demo).
          </p>
        </section>

        {/* Nút tiếp tục */}
        <div className="pt-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handleConfirm}
            disabled={!sourceId || !targetId || sourceId === targetId}
          >
            Tiếp tục
          </Button>
        </div>
      </main>
    </div>
  );
};

export default TransferToMyAccount;
