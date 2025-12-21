// src/pages/MortgageInterestOtpConfirm.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth } from "@/lib/firebase";
import {
  confirmPayMortgageInterestWithOtp,
  initiatePayMortgageInterestOtp,
  resendMortgageInterestOtpOnlyWhenExpired,
} from "@/services/mortgageService";

type LocationStateShape = {
  fromPath?: string;
  transactionId?: string;
  maskedEmail?: string;
  expireAt?: number;
  devOtpCode?: string;

  mortgageAccountNumber?: string;
  yyyymm?: string;
  interestAmount?: number;
  paymentAccountNumber?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function readState(state: unknown): LocationStateShape {
  const r = asRecord(state);
  if (!r) return {};

  const out: LocationStateShape = {};

  out.fromPath = typeof r.fromPath === "string" ? r.fromPath : undefined;
  out.transactionId = typeof r.transactionId === "string" ? r.transactionId : undefined;
  out.maskedEmail = typeof r.maskedEmail === "string" ? r.maskedEmail : undefined;
  out.expireAt = typeof r.expireAt === "number" ? r.expireAt : undefined;
  out.devOtpCode = typeof r.devOtpCode === "string" ? r.devOtpCode : undefined;

  out.mortgageAccountNumber =
    typeof r.mortgageAccountNumber === "string" ? r.mortgageAccountNumber : undefined;
  out.yyyymm = typeof r.yyyymm === "string" ? r.yyyymm : undefined;
  out.interestAmount = typeof r.interestAmount === "number" ? r.interestAmount : undefined;
  out.paymentAccountNumber =
    typeof r.paymentAccountNumber === "string" ? r.paymentAccountNumber : undefined;

  return out;
}

function formatCountdown(msLeft: number): string {
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const MortgageInterestOtpConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const st = useMemo(() => readState(location.state), [location.state]);

  const [phase, setPhase] = useState<"PIN" | "OTP">(() => (st.transactionId ? "OTP" : "PIN"));

  const [pin, setPin] = useState<string>("");
  const [otp, setOtp] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);

  const [transactionId, setTransactionId] = useState<string>(st.transactionId ?? "");
  const [maskedEmail, setMaskedEmail] = useState<string>(st.maskedEmail ?? "");
  const [devOtpCode, setDevOtpCode] = useState<string>(st.devOtpCode ?? "");

  const [expireAt, setExpireAt] = useState<number>(typeof st.expireAt === "number" ? st.expireAt : 0);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // sync state when coming from previous screen / after replace navigate
  useEffect(() => {
    if (typeof st.expireAt === "number") setExpireAt(st.expireAt);

    if (typeof st.transactionId === "string" && st.transactionId.trim()) {
      setTransactionId(st.transactionId.trim());
      setPhase("OTP");
    }
    if (typeof st.maskedEmail === "string") setMaskedEmail(st.maskedEmail);
    if (typeof st.devOtpCode === "string") setDevOtpCode(st.devOtpCode);
  }, [st.expireAt, st.transactionId, st.maskedEmail, st.devOtpCode]);

  const msLeft = Math.max(0, expireAt - now);
  const isExpired = expireAt > 0 ? now >= expireAt : true;

  const canResend = phase === "OTP" && isExpired && !submitting && Boolean(transactionId);
  const canConfirm = phase === "OTP" && !submitting && /^\d{6}$/.test(otp.trim()) && Boolean(transactionId);

  const hasContextForSendOtp =
    Boolean(st.mortgageAccountNumber) && Boolean(st.yyyymm) && Boolean(st.paymentAccountNumber);

  const onBack = () => {
    const backTo = st.fromPath && st.fromPath.trim() ? st.fromPath : "/accounts";
    navigate(backTo);
  };

  const onSendOtp = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      navigate("/login");
      return;
    }

    if (!hasContextForSendOtp) {
      toast.error("Thiếu dữ liệu đóng lãi. Vui lòng quay lại và thử lại.");
      return;
    }

    const pinTrim = pin.trim();
    if (!pinTrim) {
      toast.error("Vui lòng nhập mã PIN giao dịch.");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await initiatePayMortgageInterestOtp({
        uid: user.uid,
        mortgageAccountNumber: st.mortgageAccountNumber as string,
        yyyymm: st.yyyymm as string,
        paymentAccountNumber: st.paymentAccountNumber as string,
        pin: pinTrim,
      });

      setTransactionId(resp.transactionId);
      setMaskedEmail(resp.maskedEmail);
      setExpireAt(resp.expireAt);
      setDevOtpCode(resp.devOtpCode ?? "");
      setPhase("OTP");
      setOtp("");

      // persist essential info so refresh/back still has ids
      navigate(location.pathname, {
        replace: true,
        state: {
          ...st,
          transactionId: resp.transactionId,
          maskedEmail: resp.maskedEmail,
          expireAt: resp.expireAt,
          devOtpCode: resp.devOtpCode,
        } satisfies LocationStateShape,
      });

      toast.success(`Đã gửi OTP tới ${resp.maskedEmail}.`);
      if (resp.devOtpCode) toast.info(`DEV OTP: ${resp.devOtpCode}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể gửi OTP.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onConfirm = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      navigate("/login");
      return;
    }
    if (!transactionId) {
      toast.error("Thiếu mã giao dịch.");
      return;
    }

    const otpTrim = otp.trim();
    if (!/^\d{6}$/.test(otpTrim)) {
      toast.error("Mã OTP phải gồm 6 chữ số.");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await confirmPayMortgageInterestWithOtp(user.uid, transactionId, otpTrim);

      toast.success("Đóng lãi thành công.");

      const backTo = st.fromPath && st.fromPath.trim() ? st.fromPath : "/accounts";
      navigate(backTo, {
        state: {
          mortgageInterestPaid: {
            transactionId: resp.transactionId,
            paidAt: resp.paidAt,
            newBalance: resp.newBalance,
            paidByAccountNumber: resp.paidByAccountNumber,
            mortgageAccountNumber: st.mortgageAccountNumber,
            yyyymm: st.yyyymm,
          },
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Xác nhận OTP thất bại.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      navigate("/login");
      return;
    }
    if (!transactionId) {
      toast.error("Thiếu mã giao dịch.");
      return;
    }

    if (!isExpired) {
      toast.info("OTP hiện tại còn hiệu lực. Chỉ được gửi lại khi OTP đã hết hạn.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await resendMortgageInterestOtpOnlyWhenExpired(user.uid, transactionId);
      setExpireAt(r.expireAt);

      toast.success(`Đã gửi lại OTP tới ${r.maskedEmail}.`);

      if (typeof r.devOtpCode === "string" && r.devOtpCode.trim()) {
        setDevOtpCode(r.devOtpCode);
        toast.info(`DEV OTP: ${r.devOtpCode}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gửi lại OTP thất bại.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const titleLine = phase === "PIN" ? "Xác thực PIN để gửi OTP" : "Xác nhận OTP đóng lãi";
  const subLine =
    phase === "PIN"
      ? "Nhập PIN giao dịch để hệ thống gửi OTP qua email."
      : maskedEmail
        ? `OTP đã gửi tới: ${maskedEmail}`
        : "Vui lòng nhập OTP 6 số.";

  const amountLine =
    typeof st.interestAmount === "number" && st.interestAmount > 0
      ? `Số tiền lãi: ${st.interestAmount.toLocaleString("vi-VN")} VND`
      : "";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-primary-foreground hover:bg-white/25 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">{titleLine}</h1>
            <p className="text-sm text-primary-foreground/80">{subLine}</p>
            {amountLine ? <p className="text-xs text-primary-foreground/80">{amountLine}</p> : null}
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        <Card className="p-6 space-y-3">
          {!hasContextForSendOtp && phase === "PIN" ? (
            <p className="text-sm text-muted-foreground">
              Thiếu dữ liệu giao dịch (kỳ lãi/tài khoản trích tiền). Vui lòng quay lại màn trước và thao tác lại.
            </p>
          ) : null}

          {phase === "PIN" ? (
            <>
              <p className="text-sm font-semibold">Mã PIN giao dịch</p>

              <input
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPin(v);
                }}
                inputMode="numeric"
                type="password"
                placeholder="Nhập PIN (6 số)"
                className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />

              <Button
                className="w-full"
                disabled={submitting || !hasContextForSendOtp || pin.trim().length < 4}
                onClick={onSendOtp}
              >
                {submitting ? "Đang xử lý..." : "Xác thực PIN & Gửi OTP"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Sau khi PIN đúng, OTP sẽ được gửi về email để bạn xác nhận đóng lãi.
              </p>
            </>
          ) : null}

          {phase === "OTP" ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Mã OTP</p>
                <p className="text-xs text-muted-foreground">
                  {expireAt > 0 ? (isExpired ? "Đã hết hạn" : `Còn lại: ${formatCountdown(msLeft)}`) : "—"}
                </p>
              </div>

              <input
                value={otp}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtp(v);
                }}
                inputMode="numeric"
                placeholder="Nhập OTP (6 số)"
                className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />

              <div className="flex gap-2">
                <Button className="flex-1" disabled={!canConfirm} onClick={onConfirm}>
                  {submitting ? "Đang xử lý..." : "Xác nhận"}
                </Button>

                <Button className="flex-1" variant="outline" disabled={!canResend} onClick={onResend}>
                  {submitting ? "Đang xử lý..." : "Gửi lại OTP"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Lưu ý: Chỉ được gửi lại OTP khi OTP hiện tại đã hết hạn.
              </p>

              {devOtpCode ? (
                <p className="text-[11px] text-muted-foreground">
                  DEV OTP: <span className="font-semibold">{devOtpCode}</span>
                </p>
              ) : null}
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

export default MortgageInterestOtpConfirm;
