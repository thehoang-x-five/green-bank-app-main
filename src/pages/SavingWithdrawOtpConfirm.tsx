import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth } from "@/lib/firebase";
import { verifyTransactionPin } from "@/services/userService";
import {
  initiateSavingWithdrawOtpAfterPin,
  resendSavingWithdrawOtpOnlyWhenExpired,
  confirmSavingWithdrawWithOtp,
} from "@/services/savingWithdrawService";

type SavingWithdrawStartState = {
  fromPath?: string;

  savingNumber?: string; // số sổ
  savingAccountNumber?: string; // alias
  paymentAccountNumber?: string; // tk nhận tiền

  isEarlyWithdrawal?: boolean;

  principal?: number;
  estimatedInterestAmount?: number;
  estimatedPayoutAmount?: number;

  maturityDate?: string; // yyyy-mm-dd
};

type TxState = {
  transactionId: string;
  maskedEmail: string;
  expireAt: number;
  amount: number;
  devOtpCode?: string;
};

const formatMoney = (value: number): string => value.toLocaleString("vi-VN") + " đ";

const SavingWithdrawOtpConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as SavingWithdrawStartState | undefined;

  const savingNumber = state?.savingNumber ?? state?.savingAccountNumber ?? "";
  const payoutAccountNumber = state?.paymentAccountNumber ?? "";
  const principal = typeof state?.principal === "number" ? state!.principal : 0;
  const estInterest = typeof state?.estimatedInterestAmount === "number" ? state!.estimatedInterestAmount : 0;
  const estPayout = typeof state?.estimatedPayoutAmount === "number" ? state!.estimatedPayoutAmount : 0;
  const maturityDate = state?.maturityDate ?? "";
  const isEarly = !!state?.isEarlyWithdrawal;

  const [step, setStep] = useState<"PIN" | "OTP">("PIN");

  // PIN step
  const [pin, setPin] = useState("");
  const [sending, setSending] = useState(false);

  // OTP step
  const [tx, setTx] = useState<TxState | null>(null);
  const [otp, setOtp] = useState("");
  const [expireAt, setExpireAt] = useState<number>(0);
  const [tick, setTick] = useState<number>(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (step !== "OTP") return;
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [step]);

  const remainSec = useMemo(() => {
    if (!expireAt) return 0;
    const diff = expireAt - tick;
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }, [expireAt, tick]);

  if (!savingNumber || !payoutAccountNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Thiếu dữ liệu tất toán tiết kiệm. Vui lòng thao tác lại từ trang sổ tiết kiệm.
          </p>
          <Button onClick={() => navigate("/accounts")}>Quay lại</Button>
        </div>
      </div>
    );
  }

  const handleSendOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      navigate("/login");
      return;
    }

    const code = pin.trim();
    // ✅ PIN giao dịch của bạn là 4 số
    if (!/^\d{4}$/.test(code)) {
      toast.error("Mã PIN giao dịch phải gồm 4 chữ số.");
      return;
    }

    setSending(true);
    try {
      // 1) Verify PIN
      await verifyTransactionPin(user.uid, code);

      // 2) Initiate OTP saving withdraw
      const res = await initiateSavingWithdrawOtpAfterPin(user.uid, {
        savingNumber,
        payoutAccountNumber,
        isEarlyWithdrawal: isEarly,
      });

      setTx(res);
      setExpireAt(res.expireAt);
      setStep("OTP");

      toast.success(`OTP đã được gửi về email ${res.maskedEmail}.`);

      // ✅ DEV fallback: nếu email gateway chưa gửi được, vẫn có OTP để test
      if (res.devOtpCode) {
        console.log("[DEV] saving withdraw otp:", res.devOtpCode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể xác thực PIN / gửi OTP.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    const user = firebaseAuth.currentUser;
    if (!user || !tx) return;

    setResending(true);
    try {
      const res = await resendSavingWithdrawOtpOnlyWhenExpired(user.uid, tx.transactionId);
      setExpireAt(res.expireAt);
      toast.success(`Đã gửi lại OTP về email ${res.maskedEmail}.`);
      if (res.devOtpCode) console.log("[DEV] saving withdraw otp (resend):", res.devOtpCode);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể gửi lại OTP.";
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  const handleConfirmOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const user = firebaseAuth.currentUser;
    if (!user || !tx) {
      toast.error("Thiếu thông tin giao dịch OTP.");
      return;
    }

    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Mã OTP phải gồm 6 chữ số.");
      return;
    }

    setConfirming(true);
    try {
      await confirmSavingWithdrawWithOtp(user.uid, tx.transactionId, code);
      toast.success("Tất toán sổ tiết kiệm thành công.");

      const back = state?.fromPath || "/accounts";
      navigate(back, {
        replace: true,
        state: { savingWithdrawn: { transactionId: tx.transactionId } },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Có lỗi khi xác nhận OTP.";
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            disabled={sending || confirming || resending}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">
            {step === "PIN" ? "Xác thực PIN tất toán tiết kiệm" : "Xác thực OTP tất toán tiết kiệm"}
          </h1>
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        <Card className="p-6 space-y-3">
          <p className="text-sm">
            <b>Số tiết kiệm:</b> {savingNumber}
          </p>
          <p className="text-sm">
            <b>Tài khoản nhận tiền:</b> {payoutAccountNumber}
          </p>
          <p className="text-sm">
            <b>Số tiền gốc:</b> {formatMoney(principal)}
          </p>
          <p className="text-sm">
            <b>Lãi (ước tính):</b> {formatMoney(estInterest)}
          </p>
          <p className="text-sm">
            <b>Tổng nhận (ước tính):</b> {formatMoney(estPayout)}
          </p>
          <p className="text-sm">
            <b>Ngày đáo hạn:</b> {maturityDate || "—"}
          </p>
          <p className="text-sm">
            <b>Trạng thái:</b>{" "}
            {isEarly ? "Rút trước hạn (có thể mất lãi/lãi nhỏ)" : "Tất toán đúng hạn (gốc + lãi)"}
          </p>
        </Card>

        {step === "PIN" && (
          <Card className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Nhập <b>PIN giao dịch (4 số)</b> để gửi OTP về email.
            </p>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">Mã PIN giao dịch</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Nhập 4 chữ số PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              <Button className="w-full" type="submit" disabled={sending}>
                {sending ? "Đang xử lý..." : "Gửi OTP"}
              </Button>
            </form>
          </Card>
        )}

        {step === "OTP" && tx && (
          <Card className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              OTP đã được gửi về email <b>{tx.maskedEmail}</b>.
            </p>

            <p className="text-xs text-muted-foreground">
              OTP còn hiệu lực: <b>{remainSec}s</b>
            </p>

            <form onSubmit={handleConfirmOtp} className="space-y-4">
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
                  disabled={resending || confirming || remainSec > 0}
                  title={remainSec > 0 ? "Chỉ được gửi lại khi OTP đã hết hạn" : "Gửi lại OTP"}
                >
                  {resending ? "Đang gửi..." : "Gửi lại OTP"}
                </Button>

                <Button type="submit" disabled={confirming}>
                  {confirming ? "Đang xác thực..." : "Xác nhận"}
                </Button>
              </div>

              {remainSec > 0 && (
                <p className="text-xs text-muted-foreground">
                  Bạn chỉ có thể bấm <b>Gửi lại OTP</b> khi OTP hiện tại đã hết hạn.
                </p>
              )}
            </form>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SavingWithdrawOtpConfirm;
