// src/pages/TransferOtpConfirm.tsx
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { confirmTransferWithOtp, resendTransferOtp } from "@/services/transferService";

type TransferInfo = {
  transactionId: string;

  // Email OTP
  maskedEmail?: string;
  expireAt?: number;

  // Backward-compat (nếu state cũ còn truyền)
  otpCode?: string;

  amount: number;
  content?: string;
  sourceAccountNumber: string;
  destinationAccountNumber: string;
  destinationName: string;
  bankName: string;
};

type TransferState = {
  transfer?: TransferInfo;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatRemainMmSs(remainSec: number): string {
  const safe = Math.max(0, remainSec);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

const TransferOtpConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as TransferState | undefined;
  const initialTransfer = state?.transfer;

  const [transfer, setTransfer] = useState<TransferInfo | null>(
    initialTransfer ?? null
  );

  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // tick để countdown
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  // Nếu thiếu state -> UI fallback
  // ✅ luôn tính expireAt trước (fallback) để hook không bị gọi conditionally
const expireAtRaw = transfer?.expireAt;
const expireAtSafe = typeof expireAtRaw === "number" ? expireAtRaw : 0;

const remainSec = useMemo(() => {
  if (!expireAtSafe) return 0;
  const remainMs = Math.max(0, expireAtSafe - nowMs);
  return Math.ceil(remainMs / 1000);
}, [expireAtSafe, nowMs]);

const canResend = remainSec <= 0;

// ✅ UI fallback để dưới hook
if (!transfer) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Thiếu thông tin giao dịch. Vui lòng thực hiện chuyển khoản lại.
        </p>
        <Button onClick={() => navigate("/transfer")}>Quay lại</Button>
      </div>
    </div>
  );
}


  const emailText =
    (transfer.maskedEmail && transfer.maskedEmail.trim()) || "email đã đăng ký";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const otpTrimmed = otp.trim();
    if (!otpTrimmed) {
      toast.error("Vui lòng nhập mã OTP.");
      return;
    }
    if (!/^\d{6}$/.test(otpTrimmed)) {
      toast.error("Mã OTP phải gồm 6 chữ số.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmTransferWithOtp(
        transfer.transactionId,
        otpTrimmed
      );

      toast.success("Giao dịch thành công.");

      navigate("/transfer/result", {
        state: {
          result: {
            flow: "account",
            amount: transfer.amount.toString(),
            content: transfer.content ?? "",
            time: new Date().toLocaleString("vi-VN"),
            fee: "0 đ",
            source: {
              label: `${transfer.sourceAccountNumber} - Tài khoản thanh toán`,
              number: transfer.sourceAccountNumber,
              newBalance: result.newBalance,
            },
            destination: {
              label: transfer.destinationName,
              number: transfer.destinationAccountNumber,
              bank: transfer.bankName,
            },
          },
        },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Có lỗi xảy ra khi xác nhận giao dịch.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    // ✅ Ràng buộc: chỉ được gửi lại khi OTP đã hết hạn
    if (!canResend) {
      toast.error(`OTP hiện tại chưa hết hạn. Vui lòng chờ ${formatRemainMmSs(remainSec)}.`);
      return;
    }

    setIsResending(true);
    try {
      const resp = await resendTransferOtp(transfer.transactionId);

      toast.success("Đã gửi OTP mới tới email. Vui lòng kiểm tra hộp thư.");

      setOtp("");

      setTransfer((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          maskedEmail: resp.maskedEmail,
          expireAt: resp.expireAt,
        };
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Không thể gửi lại OTP.";
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            disabled={isSubmitting || isResending}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">
            Xác thực OTP Email
          </h1>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <Card className="p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Mã OTP đã được gửi tới email <span className="font-semibold">{emailText}</span>.
            </p>

            <p className="text-sm text-muted-foreground">
              OTP hết hạn sau:{" "}
              <span className="font-semibold">{formatRemainMmSs(remainSec)}</span>
            </p>
          </div>

          <div className="space-y-1 text-sm pt-2">
            <p>
              Số tiền:{" "}
              <span className="font-semibold">
                {transfer.amount.toLocaleString("vi-VN")} đ
              </span>
            </p>
            <p>
              Tài khoản nguồn:{" "}
              <span className="font-semibold">{transfer.sourceAccountNumber}</span>
            </p>
            <p>
              Người nhận:{" "}
              <span className="font-semibold">
                {transfer.destinationName} - {transfer.destinationAccountNumber} (
                {transfer.bankName})
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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
                disabled={isSubmitting || isResending}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting || isResending}>
              {isSubmitting ? "Đang xác thực..." : "Xác nhận thanh toán"}
            </Button>

            <Button
              type="button"
              className="w-full"
              variant="outline"
              onClick={() => void handleResend()}
              disabled={!canResend || isSubmitting || isResending}
            >
              {isResending
                ? "Đang gửi..."
                : canResend
                ? "Gửi lại OTP"
                : `Gửi lại OTP (${formatRemainMmSs(remainSec)})`}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default TransferOtpConfirm;
