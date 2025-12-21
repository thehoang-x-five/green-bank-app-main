// src/pages/PaymentWithdrawOtpConfirm.tsx
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth } from "@/lib/firebase";
import {
  confirmWithdrawFromPaymentAccountWithOtp,
  resendWithdrawOtpOnlyWhenExpired,
} from "@/services/accountService";

const HIGH_VALUE_THRESHOLD_VND = 10_000_000;

type WithdrawOtpState = {
  withdraw?: {
    transactionId: string;
    maskedEmail: string;
    expireAt: number;
    amount: number;
    accountNumber: string;
    requiresBiometric?: boolean;
  };
};

const PaymentWithdrawOtpConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as WithdrawOtpState | undefined;
  const withdraw = state?.withdraw;

  const [otp, setOtp] = useState("");
  const [expireAt, setExpireAt] = useState<number>(withdraw?.expireAt ?? 0);
  const [tick, setTick] = useState<number>(Date.now());

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const requiresBiometric = withdraw?.requiresBiometric || (withdraw?.amount ?? 0) >= HIGH_VALUE_THRESHOLD_VND;

  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const remainSec = useMemo(() => {
    if (!expireAt) return 0;
    const diff = expireAt - tick;
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }, [expireAt, tick]);

  if (!withdraw) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Thiếu thông tin giao dịch rút tiền. Vui lòng thao tác lại.
          </p>
          <Button onClick={() => navigate("/accounts/payment/withdraw")}>Quay lại</Button>
        </div>
      </div>
    );
  }

  const handleConfirm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Mã OTP phải gồm 6 chữ số.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmWithdrawFromPaymentAccountWithOtp(user.uid, withdraw.transactionId, code);
      toast.success("Rút tiền thành công.");
      navigate("/accounts/payment", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Có lỗi xảy ra khi xác nhận OTP.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setResending(true);
    try {
      const res = await resendWithdrawOtpOnlyWhenExpired(user.uid, withdraw.transactionId);
      setExpireAt(res.expireAt);

      toast.success(`Đã gửi lại OTP về email ${res.maskedEmail}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể gửi lại OTP.";
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            disabled={submitting || resending}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">Xác thực OTP rút tiền</h1>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <Card className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            OTP đã được gửi về email <b>{withdraw.maskedEmail}</b>.
          </p>

          <div className="space-y-1 text-sm">
            <p>
              Số tiền:{" "}
              <span className="font-semibold">
                {withdraw.amount.toLocaleString("vi-VN")} đ
              </span>
            </p>
            <p>
              Tài khoản: <span className="font-semibold">{withdraw.accountNumber}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              OTP còn hiệu lực: <b>{remainSec}s</b>
            </p>
          </div>

          <form onSubmit={handleConfirm} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="otp">Mã OTP</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Nhập 6 chữ số OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                disabled={resending || submitting || remainSec > 0}
                title={remainSec > 0 ? "Chỉ được gửi lại khi OTP đã hết hạn" : "Gửi lại OTP"}
              >
                {resending ? "Đang gửi..." : "Gửi lại OTP"}
              </Button>

              <Button type="submit" disabled={submitting}>
                {submitting ? "Đang xác thực..." : "Xác nhận"}
              </Button>
            </div>
          </form>

          {remainSec > 0 && (
            <p className="text-xs text-muted-foreground">
              Bạn chỉ có thể bấm <b>Gửi lại OTP</b> khi OTP hiện tại đã hết hạn.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PaymentWithdrawOtpConfirm;
