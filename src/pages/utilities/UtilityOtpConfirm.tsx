// src/pages/utilities/UtilityOtpConfirm.tsx
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { UtilityPaymentRequest } from "./UtilityPinConfirm";

// Import các service functions
import {
  confirmFlightPaymentWithOtp,
  resendFlightPaymentOtp,
} from "@/services/flightBookingService";
import {
  confirmUtilityBillPaymentWithOtp,
  resendUtilityBillPaymentOtp,
} from "@/services/utilityBillService";
import {
  confirmDataPackPaymentWithOtp,
  resendDataPackPaymentOtp,
  confirmPhoneTopupPaymentWithOtp,
  resendPhoneTopupPaymentOtp,
} from "@/services/mobilePhonePaymentService";

type OtpState = {
  pendingRequest?: UtilityPaymentRequest;
  transactionId?: string;
  maskedEmail?: string;
  expireAt?: number;
  returnPath?: string;
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

export default function UtilityOtpConfirm() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as OtpState | undefined;
  const pendingRequest = state?.pendingRequest;
  const returnPath = state?.returnPath || "/home";

  const [transactionId] = useState(state?.transactionId || "");
  const [maskedEmail, setMaskedEmail] = useState(state?.maskedEmail || "");
  const [expireAt, setExpireAt] = useState(state?.expireAt || 0);

  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Countdown timer
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  const remainSec = useMemo(() => {
    if (!expireAt) return 0;
    const remainMs = Math.max(0, expireAt - nowMs);
    return Math.ceil(remainMs / 1000);
  }, [expireAt, nowMs]);

  const canResend = remainSec <= 0;

  if (!pendingRequest || !transactionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Thiếu thông tin giao dịch. Vui lòng thực hiện lại.
          </p>
          <Button onClick={() => navigate(returnPath)}>Quay lại</Button>
        </div>
      </div>
    );
  }

  const emailText =
    maskedEmail && maskedEmail.trim() ? maskedEmail : "email đã đăng ký";

  const getTypeLabel = () => {
    switch (pendingRequest.type) {
      case "FLIGHT":
        return "Đặt vé máy bay";
      case "UTILITY_BILL":
        return "Thanh toán hóa đơn";
      case "DATA_PACK":
        return "Mua gói data";
      case "PHONE_TOPUP":
        return "Nạp tiền điện thoại";
      case "MOVIE":
        return "Đặt vé xem phim";
      case "HOTEL":
        return "Đặt phòng khách sạn";
      default:
        return "Thanh toán";
    }
  };

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
      let result: any;

      // Call appropriate confirm function based on type
      switch (pendingRequest.type) {
        case "FLIGHT":
          result = await confirmFlightPaymentWithOtp(transactionId, otpTrimmed);
          break;
        case "UTILITY_BILL":
          result = await confirmUtilityBillPaymentWithOtp(
            transactionId,
            otpTrimmed
          );
          break;
        case "DATA_PACK":
          result = await confirmDataPackPaymentWithOtp(
            transactionId,
            otpTrimmed
          );
          break;
        case "PHONE_TOPUP":
          result = await confirmPhoneTopupPaymentWithOtp(
            transactionId,
            otpTrimmed
          );
          break;
        case "MOVIE": {
          const { confirmMovieBookingWithOtp } = await import(
            "@/services/movieBookingService"
          );
          result = await confirmMovieBookingWithOtp(transactionId, otpTrimmed);
          break;
        }
        case "HOTEL": {
          const { confirmHotelBookingWithOtp } = await import(
            "@/services/hotelBookingService"
          );
          result = await confirmHotelBookingWithOtp(transactionId, otpTrimmed);
          break;
        }
        default:
          throw new Error("Loại giao dịch không hợp lệ");
      }

      toast.success("Giao dịch thành công.");

      // Navigate to appropriate result page based on type
      if (pendingRequest.type === "FLIGHT") {
        // Import buildFlightReceipt for flight result
        const { buildFlightReceipt } = await import("./buildReceipt");
        const receiptResult = buildFlightReceipt({
          selectedFlight: pendingRequest.details.selectedFlight as any,
          formData: pendingRequest.details.formData as any,
        });

        navigate("/utilities/result", {
          state: {
            result: {
              ...receiptResult,
              transactionId,
              details: [
                ...receiptResult.details,
                {
                  label: "Mã đặt vé",
                  value: (result as any).orderId || transactionId,
                },
                { label: "Mã giao dịch", value: transactionId },
              ],
            },
            source: "home",
          },
        });
      } else if (pendingRequest.type === "UTILITY_BILL") {
        // Build proper receipt for utility bill
        const { buildBillReceipt } = await import("./buildReceipt");
        const receiptResult = buildBillReceipt({
          billService: pendingRequest.details.billService as any,
          formData: pendingRequest.details.formData as any,
        });

        navigate("/utilities/result", {
          state: {
            result: {
              ...receiptResult,
              transactionId,
              amount:
                (result as any).billAmount?.toLocaleString("vi-VN") ||
                receiptResult.amount,
            },
            source: "home",
          },
        });
      } else if (pendingRequest.type === "DATA_PACK") {
        // Build proper receipt for data pack
        const { buildDataReceipt } = await import("./buildReceipt");
        const receiptResult = buildDataReceipt(
          pendingRequest.details.formData as any
        );

        // ✅ Override amount and pack name from pendingRequest.details
        const packName = pendingRequest.details.packName || "-";
        const amount = pendingRequest.amount || 0;

        navigate("/utilities/result", {
          state: {
            result: {
              ...receiptResult,
              transactionId,
              amount: amount.toLocaleString("vi-VN"),
              details: receiptResult.details.map((detail) => {
                if (detail.label === "Gói data") {
                  return { ...detail, value: packName };
                }
                return detail;
              }),
            },
            source: pendingRequest.details.source || "home",
          },
        });
      } else if (pendingRequest.type === "PHONE_TOPUP") {
        // Build proper receipt for phone topup
        const { buildPhoneReceipt } = await import("./buildReceipt");
        const receiptResult = buildPhoneReceipt(
          pendingRequest.details.formData as any
        );

        navigate("/utilities/result", {
          state: {
            result: {
              ...receiptResult,
              transactionId,
            },
            source: pendingRequest.details.source || "home",
          },
        });
      } else if (pendingRequest.type === "MOVIE") {
        // Build proper receipt for movie booking
        const { buildMovieReceipt } = await import("./buildReceipt");
        const receiptResult = buildMovieReceipt(
          pendingRequest.details.formData as any
        );

        navigate("/utilities/result", {
          state: {
            result: {
              ...receiptResult,
              transactionId,
              details: [
                ...receiptResult.details,
                {
                  label: "Mã đặt vé",
                  value: (result as any).bookingId || transactionId,
                },
              ],
            },
            source: "home",
          },
        });
      } else if (pendingRequest.type === "HOTEL") {
        // Build proper receipt for hotel booking
        const { buildHotelReceipt } = await import("./buildReceipt");
        const receiptResult = buildHotelReceipt(
          pendingRequest.details.formData as any,
          {
            nights: pendingRequest.details.nights as number,
            roomName: pendingRequest.details.roomName as string,
            nightlyRate: pendingRequest.details.nightlyRate as number,
          }
        );

        navigate("/utilities/result", {
          state: {
            result: {
              ...receiptResult,
              transactionId,
              details: [
                ...receiptResult.details,
                {
                  label: "Mã đặt phòng",
                  value: (result as any).bookingId || transactionId,
                },
              ],
            },
            source: "home",
          },
        });
      } else {
        // Fallback for unknown types
        navigate("/utilities/result", {
          state: {
            result: {
              ...result,
              transactionId,
            },
          },
        });
      }
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

  const handleResend = async (): Promise<void> => {
    if (!canResend) {
      toast.error(
        `OTP hiện tại chưa hết hạn. Vui lòng chờ ${formatRemainMmSs(
          remainSec
        )}.`
      );
      return;
    }

    setIsResending(true);
    try {
      let resp: any;

      // Call appropriate resend function based on type
      switch (pendingRequest.type) {
        case "FLIGHT":
          resp = await resendFlightPaymentOtp(transactionId);
          break;
        case "UTILITY_BILL":
          resp = await resendUtilityBillPaymentOtp(transactionId);
          break;
        case "DATA_PACK":
          resp = await resendDataPackPaymentOtp(transactionId);
          break;
        case "PHONE_TOPUP":
          resp = await resendPhoneTopupPaymentOtp(transactionId);
          break;
        case "MOVIE": {
          const { resendMovieBookingOtp } = await import(
            "@/services/movieBookingService"
          );
          resp = await resendMovieBookingOtp(transactionId);
          break;
        }
        case "HOTEL": {
          const { resendHotelBookingOtp } = await import(
            "@/services/hotelBookingService"
          );
          resp = await resendHotelBookingOtp(transactionId);
          break;
        }
        default:
          throw new Error("Loại giao dịch không hợp lệ");
      }

      toast.success("Đã gửi OTP mới tới email. Vui lòng kiểm tra hộp thư.");

      setOtp("");
      setMaskedEmail(resp.maskedEmail || maskedEmail);
      setExpireAt(resp.expireAt || Date.now() + 5 * 60 * 1000);
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
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1 text-sm">
              <p>
                Loại giao dịch:{" "}
                <span className="font-semibold">{getTypeLabel()}</span>
              </p>
              <p>
                Số tiền:{" "}
                <span className="font-semibold">
                  {pendingRequest.amount.toLocaleString("vi-VN")} đ
                </span>
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Mã OTP đã được gửi tới{" "}
                <span className="font-semibold">{emailText}</span>
              </p>
              {expireAt > 0 && (
                <p className="text-sm text-muted-foreground">
                  Mã OTP có hiệu lực trong:{" "}
                  <span className="font-semibold text-foreground">
                    {formatRemainMmSs(remainSec)}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp">Mã OTP</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Nhập 6 chữ số"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                disabled={!canResend || isResending}
                className="flex-1"
              >
                {isResending ? "Đang gửi..." : "Gửi lại OTP"}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Đang xử lý..." : "Xác nhận"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
