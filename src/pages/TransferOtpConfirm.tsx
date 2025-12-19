// src/pages/TransferOtpConfirm.tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { confirmTransferWithOtp } from "@/services/transferService";

type TransferState = {
  transfer?: {
    transactionId: string;
    otpCode: string;
    expireAt?: number;
    amount: number;
    content?: string;
    sourceAccountNumber: string;
    destinationAccountNumber: string;
    destinationName: string;
    bankName: string;
  };
};

const TransferOtpConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as TransferState | undefined;
  const transfer = state?.transfer;

  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        err instanceof Error
          ? err.message
          : "Có lỗi xảy ra khi xác nhận giao dịch.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedOtp =
    transfer.otpCode && transfer.otpCode.length === 6
      ? transfer.otpCode.split("").join(" ")
      : "";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">
            Xác thực Smart-OTP
          </h1>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <Card className="p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Vui lòng nhập mã Smart-OTP để xác nhận giao dịch chuyển tiền.
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <p>
              Số tiền:{" "}
              <span className="font-semibold">
                {transfer.amount.toLocaleString("vi-VN")} đ
              </span>
            </p>
            <p>
              Tài khoản nguồn:{" "}
              <span className="font-semibold">
                {transfer.sourceAccountNumber}
              </span>
            </p>
            <p>
              Người nhận:{" "}
              <span className="font-semibold">
                {transfer.destinationName} - {transfer.destinationAccountNumber}{" "}
                ({transfer.bankName})
              </span>
            </p>
          </div>

          {formattedOtp && (
            <div className="pt-2 pb-1">
              <p className="text-xs text-muted-foreground text-center mb-1">
                Mã Smart-OTP cho giao dịch này:
              </p>
              <div className="text-2xl font-mono text-center tracking-[0.5em]">
                {formattedOtp}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Nhập lại mã OTP</Label>
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

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Đang xác thực..." : "Xác nhận thanh toán"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default TransferOtpConfirm;
