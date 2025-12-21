// src/pages/PaymentAccountWithdraw.tsx
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

import { firebaseAuth } from "@/lib/firebase";
import {
  getPrimaryAccount,
  getCustomerDisplayName,
  initiateWithdrawFromPaymentAccountOtp,
  type BankAccount,
} from "@/services/accountService";

import { getUserProfile } from "@/services/userService";
import { verifyTransactionPin } from "@/services/userService";
import { requireBiometricForHighValueVnd } from "@/services/biometricService";

const HIGH_VALUE_THRESHOLD_VND = 10_000_000;

// ✅ Helper format/parse số tiền nhập
const formatVndInput = (raw: string): string => {
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return "";
  const n = Number(digitsOnly);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("vi-VN").format(n);
};

const parseVndInput = (formatted: string): number => {
  const digitsOnly = formatted.replace(/[^\d]/g, "");
  if (!digitsOnly) return 0;
  const n = Number(digitsOnly);
  return Number.isFinite(n) ? n : 0;
};

const PaymentAccountWithdraw = () => {
  const navigate = useNavigate();

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [holderName, setHolderName] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [pin, setPin] = useState<string>("");

  const [loadingAccount, setLoadingAccount] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setAccount(null);
        setHolderName(null);
        setLoadingAccount(false);
        return;
      }

      try {
        setLoadingAccount(true);
        const [acc, name] = await Promise.all([
          getPrimaryAccount(user.uid),
          getCustomerDisplayName(user.uid),
        ]);
        setAccount(acc);
        setHolderName(name);
      } finally {
        setLoadingAccount(false);
      }
    });

    return () => unsub();
  }, []);

  const formatCurrency = (value: number | undefined): string => {
    if (typeof value !== "number" || Number.isNaN(value)) return "0";
    return value.toLocaleString("vi-VN");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const numericAmount = parseVndInput(amount);
    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg("Vui lòng nhập số tiền rút hợp lệ.");
      return;
    }

    if (!pin) {
      setErrorMsg("Vui lòng nhập mã PIN giao dịch.");
      return;
    }

    if (!firebaseUser) {
      setErrorMsg("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
      return;
    }

    if (!account) {
      setErrorMsg("Không tìm thấy tài khoản thanh toán trên hệ thống.");
      return;
    }

    try {
      setSubmitting(true);

      // ✅ Kiểm tra PIN trước
      await verifyTransactionPin(firebaseUser.uid, pin);
      
      // ✅ PIN đúng -> kiểm tra có cần sinh trắc không
      if (numericAmount >= HIGH_VALUE_THRESHOLD_VND) {
        // Chuyển sang màn hình sinh trắc
        navigate("/accounts/payment/withdraw/biometric", {
          state: {
            pendingWithdraw: {
              amount: numericAmount,
              pin,
              accountNumber: account.accountNumber,
            },
          },
        });
      } else {
        // Không cần sinh trắc -> tạo OTP luôn
        const resp = await initiateWithdrawFromPaymentAccountOtp(firebaseUser.uid, {
          amount: numericAmount,
          pin,
          accountNumber: account.accountNumber,
        });

        toast.success(`OTP đã được gửi về email ${resp.maskedEmail}.`);

        navigate("/accounts/payment/withdraw/otp", {
          state: {
            withdraw: {
              transactionId: resp.transactionId,
              maskedEmail: resp.maskedEmail,
              expireAt: resp.expireAt,
              amount: numericAmount,
              accountNumber: account.accountNumber,
              requiresBiometric: false,
            },
          },
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại.";
      setErrorMsg(message);
      toast.error(message);

      // 🔁 Lỗi sai PIN -> toast số lần còn lại
      if (
        firebaseUser &&
        error instanceof Error &&
        error.message.includes("Mã PIN giao dịch không đúng")
      ) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            const withPin = profile as { pinFailCount?: number | null };
            const failCount = withPin.pinFailCount ?? 0;
            const remaining = Math.max(0, 5 - failCount);

            if (remaining > 0) {
              toast.error(`Sai mã PIN. Bạn còn ${remaining} lần thử trước khi tài khoản bị tạm khóa.`);
            } else {
              toast.error("Bạn đã nhập sai mã PIN quá 5 lần. Tài khoản đã bị tạm khóa.");
            }
          }
        } catch (err: unknown) {
          console.error("Không lấy được số lần sai PIN:", err);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-primary-foreground hover:bg-white/25 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              Rút tiền tài khoản thanh toán
            </h1>
            {account && (
              <p className="text-sm text-primary-foreground/80">
                {account.accountNumber} · {holderName ?? "Chủ tài khoản"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 -mt-4 space-y-4">
        {loadingAccount ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Đang tải thông tin tài khoản...
          </Card>
        ) : !account ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Không tìm thấy tài khoản thanh toán trên hệ thống.
          </Card>
        ) : (
          <>
            {/* Thông tin tài khoản */}
            <Card className="p-6 space-y-4 max-w-md mx-auto">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Số tài khoản</span>
                <span className="font-medium">{account.accountNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Chủ tài khoản</span>
                <span className="font-medium">{holderName ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Số dư hiện tại</span>
                <span className="font-semibold text-primary">
                  {formatCurrency(account.balance)} VND
                </span>
              </div>
            </Card>

            {/* Form rút tiền */}
            <Card className="p-6 space-y-4 max-w-md mx-auto">
              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                <input type="text" name="fake-username" autoComplete="username" className="hidden" />
                <input type="password" name="fake-password" autoComplete="new-password" className="hidden" />

                <div className="space-y-1">
                  <label className="text-sm font-medium">Số tiền rút</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9.]*"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Nhập số tiền (VND)"
                    value={amount}
                    onChange={(e) => setAmount(formatVndInput(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ví dụ: 1.000.000 • Giao dịch ≥ {HIGH_VALUE_THRESHOLD_VND.toLocaleString("vi-VN")} VND cần xác thực sinh trắc
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Mã PIN giao dịch</label>
                  <input
                    type="password"
                    name="transaction-pin"
                    autoComplete="off"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="••••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>

                {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

                <Button type="submit" className="w-full rounded-full font-semibold" disabled={submitting}>
                  {submitting ? "Đang xử lý..." : "Tiếp tục"}
                </Button>
              </form>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentAccountWithdraw;
