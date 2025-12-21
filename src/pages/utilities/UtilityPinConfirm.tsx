// src/pages/utilities/UtilityPinConfirm.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { firebaseAuth } from "@/lib/firebase";
import { verifyTransactionPin, getUserProfile } from "@/services/userService";

export type UtilityPaymentRequest = {
  type:
    | "FLIGHT"
    | "UTILITY_BILL"
    | "DATA_PACK"
    | "PHONE_TOPUP"
    | "MOVIE"
    | "HOTEL";
  amount: number;
  accountId: string;
  details: Record<string, unknown>;
};

type PinState = {
  pendingRequest?: UtilityPaymentRequest;
  returnPath?: string;
};

export default function UtilityPinConfirm() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as PinState | undefined;
  const pendingRequest = state?.pendingRequest;
  const returnPath = state?.returnPath || "/home";

  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!pendingRequest) {
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

  const handleConfirmPin = async (): Promise<void> => {
    const trimmedPin = pin.trim();
    if (!trimmedPin) {
      toast.error("Vui lòng nhập mã PIN giao dịch.");
      return;
    }

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setIsSubmitting(true);
    let navigated = false;

    try {
      // Verify PIN
      await verifyTransactionPin(currentUser.uid, trimmedPin);

      // PIN đúng -> call initiate function based on payment type
      let initiateResult: {
        transactionId: string;
        maskedEmail: string;
        expireAt: number;
      };

      switch (pendingRequest.type) {
        case "FLIGHT": {
          const { initiateFlightPayment } = await import(
            "@/services/flightBookingService"
          );
          initiateResult = await initiateFlightPayment({
            selectedFlight: pendingRequest.details.selectedFlight as any,
            formData: pendingRequest.details.formData as any,
            accountId: pendingRequest.accountId,
          });
          break;
        }
        case "UTILITY_BILL": {
          const { initiateUtilityBillPayment } = await import(
            "@/services/utilityBillService"
          );
          initiateResult = await initiateUtilityBillPayment({
            service: pendingRequest.details.service as any,
            providerId: pendingRequest.details.providerId as string,
            accountId: pendingRequest.accountId,
          });
          break;
        }
        case "DATA_PACK": {
          const { initiateDataPackPayment } = await import(
            "@/services/mobilePhonePaymentService"
          );
          initiateResult = await initiateDataPackPayment({
            phoneNumber: pendingRequest.details.phoneNumber as string,
            telco: pendingRequest.details.telco as string,
            packId: pendingRequest.details.packId as string,
            packName: pendingRequest.details.packName as string,
            packPrice: pendingRequest.amount,
            accountId: pendingRequest.accountId,
          });
          break;
        }
        case "PHONE_TOPUP": {
          const { initiatePhoneTopupPayment } = await import(
            "@/services/mobilePhonePaymentService"
          );
          initiateResult = await initiatePhoneTopupPayment({
            phoneNumber: pendingRequest.details.phoneNumber as string,
            telco: pendingRequest.details.telco as string,
            topupAmount: pendingRequest.amount,
            accountId: pendingRequest.accountId,
          });
          break;
        }
        case "MOVIE": {
          const { initiateMovieBooking } = await import(
            "@/services/movieBookingService"
          );
          initiateResult = await initiateMovieBooking({
            cinemaId: pendingRequest.details.cinemaId as string,
            cinemaName: pendingRequest.details.cinemaName as string,
            movieId: pendingRequest.details.movieId as string,
            movieTitle: pendingRequest.details.movieTitle as string,
            showtimeId: pendingRequest.details.showtimeId as string,
            date: pendingRequest.details.date as string,
            time: pendingRequest.details.time as string,
            room: pendingRequest.details.room as number,
            selectedSeats: pendingRequest.details.selectedSeats as string[],
            totalAmount: pendingRequest.amount,
            accountId: pendingRequest.accountId,
          });
          break;
        }
        case "HOTEL": {
          const { initiateHotelBooking } = await import(
            "@/services/hotelBookingService"
          );
          initiateResult = await initiateHotelBooking({
            hotel: pendingRequest.details.hotel as any,
            room: pendingRequest.details.room as any,
            guests: pendingRequest.details.guests as number,
            rooms: pendingRequest.details.rooms as number,
            nights: pendingRequest.details.nights as number,
            checkIn: pendingRequest.details.checkIn as string,
            checkOut: pendingRequest.details.checkOut as string,
            accountNumber: pendingRequest.accountId,
          });
          break;
        }
        default:
          throw new Error("Loại giao dịch không hợp lệ");
      }

      // Navigate to OTP screen with transaction info
      navigated = true;
      navigate("/utilities/otp", {
        state: {
          pendingRequest,
          transactionId: initiateResult.transactionId,
          maskedEmail: initiateResult.maskedEmail,
          expireAt: initiateResult.expireAt,
          returnPath,
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi xác thực PIN.";

      toast.error(message);

      // Hiển thị số lần còn lại nếu sai PIN
      if (
        error instanceof Error &&
        (error.message.includes("Mã PIN giao dịch không đúng") ||
          (error.message.toLowerCase().includes("pin") &&
            error.message.toLowerCase().includes("không đúng")))
      ) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          if (profile) {
            const withPin = profile as {
              pinFailCount?: number | null;
              status?: string | null;
            };

            const failCount = withPin.pinFailCount ?? 0;
            const remaining = Math.max(0, 5 - failCount);
            const isLocked =
              (withPin.status ?? "").toString().toUpperCase() === "LOCKED";

            if (isLocked || remaining <= 0) {
              toast.error(
                "Bạn đã nhập sai mã PIN quá 5 lần. Tài khoản đã bị tạm khóa. Vui lòng liên hệ nhân viên để mở khóa."
              );
            } else {
              toast.error(
                `Sai mã PIN. Bạn còn ${remaining} lần thử trước khi tài khoản bị tạm khóa.`
              );
            }
          }
        } catch (err: unknown) {
          console.error("Không lấy được số lần sai PIN:", err);
        }
      }
    } finally {
      if (!navigated) setIsSubmitting(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(returnPath)}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            disabled={isSubmitting}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">
            Nhập PIN giao dịch
          </h1>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <Card className="p-6 space-y-4">
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

          <div className="space-y-2 pt-4">
            <Label htmlFor="txnPin">Mã PIN giao dịch</Label>
            <Input
              id="txnPin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Nhập PIN 4–6 số"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSubmitting) {
                  void handleConfirmPin();
                }
              }}
            />
          </div>

          <Button
            className="w-full mt-4"
            onClick={handleConfirmPin}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Đang xử lý..." : "Tiếp tục"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
