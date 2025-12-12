// src/pages/PaymentAccountDetail.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

import { firebaseAuth } from "@/lib/firebase";
import {
  getPrimaryAccount,
  getCustomerDisplayName,
  type BankAccount,
} from "@/services/accountService";

const PaymentAccountDetail = () => {
  const navigate = useNavigate();

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [holderName, setHolderName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setAccount(null);
        setHolderName(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [acc, name] = await Promise.all([
          getPrimaryAccount(user.uid),
          getCustomerDisplayName(user.uid),
        ]);

        setAccount(acc);
        setHolderName(name);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const formatCurrency = (value: number | undefined): string => {
    if (typeof value !== "number" || Number.isNaN(value)) return "0";
    return value.toLocaleString("vi-VN");
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return "—";
    const d = new Date(timestamp);
    return d.toLocaleDateString("vi-VN");
  };

  const statusLabel =
    account?.status === "LOCKED" ? "Đã khóa" : "Hoạt động";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/accounts")}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-primary-foreground hover:bg-white/25 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              Chi tiết tài khoản thanh toán
            </h1>
            <p className="text-sm text-primary-foreground/80">
              {account?.accountNumber ?? "—"} ·{" "}
              {holderName ?? "Chủ tài khoản"}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 -mt-4 space-y-4">
        {loading ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Đang tải thông tin tài khoản...
          </Card>
        ) : !account ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Không tìm thấy tài khoản thanh toán trên hệ thống.
          </Card>
        ) : (
          <>
            <Card className="p-6 space-y-4 max-w-md mx-auto">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Số tài khoản</span>
                <span className="font-medium">{account.accountNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Chủ tài khoản</span>
                <span className="font-medium">
                  {holderName ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Số dư hiện tại</span>
                <span className="font-semibold text-primary">
                  {formatCurrency(account.balance)} VND
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Số dư khả dụng
                </span>
                <span className="font-medium">
                  {formatCurrency(account.balance)} VND
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trạng thái</span>
                <span className="font-medium">{statusLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Ngày mở tài khoản
                </span>
                <span className="font-medium">
                  {formatDate(account.createdAt)}
                </span>
              </div>
            </Card>

            {/* Thực hiện giao dịch: Nạp / Rút / Chuyển */}
            <div className="max-w-md mx-auto space-y-3 pb-4">
              <h2 className="text-base font-semibold text-center">
                Thực hiện giao dịch
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {/* Nạp tiền */}
                <Button
                  className="w-full rounded-full font-semibold"
                  onClick={() => navigate("/accounts/payment/deposit")}
                >
                  Nạp tiền
                </Button>

                {/* Rút tiền */}
                <Button
                  variant="outline"
                  className="w-full rounded-full font-semibold"
                  onClick={() => navigate("/accounts/payment/withdraw")}
                >
                  Rút tiền
                </Button>

                {/* Chuyển tiền */}
                <Button
                  variant="outline"
                  className="col-span-2 w-full rounded-full font-semibold"
                  onClick={() => navigate("/transfer")}
                >
                  Chuyển tiền
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentAccountDetail;
