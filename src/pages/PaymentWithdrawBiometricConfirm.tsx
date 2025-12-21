// src/pages/PaymentWithdrawBiometricConfirm.tsx
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { get, ref, update, runTransaction } from "firebase/database";

import {
  HIGH_VALUE_THRESHOLD_VND,
  runBiometricVerification,
} from "@/services/biometricService";

import {
  initiateWithdrawFromPaymentAccountOtp,
  markWithdrawTransactionBiometricVerified,
} from "@/services/accountService";

const MAX_BIOMETRIC_ATTEMPTS = 5;

type BiometricState = {
  pendingWithdraw?: {
    amount: number;
    pin: string;
    accountNumber: string;
  };
};

function toNonNegInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

function normalizeStatus(v: unknown): string {
  return typeof v === "string" ? v.toUpperCase().trim() : "";
}

async function lockUserAndAccount(uid: string, accountNumber: string): Promise<void> {
  const now = Date.now();

  // Lock user
  await update(ref(firebaseRtdb, `users/${uid}`), {
    status: "LOCKED",
    lockedAt: now,
    lockReason: "BIOMETRIC_FAILED",
  });

  // Lock account
  await update(ref(firebaseRtdb, `accounts/${accountNumber}`), {
    status: "LOCKED",
    lockedAt: now,
    lockReason: "BIOMETRIC_FAILED",
  });
}

async function recordBiometricFailure(
  uid: string,
  accountNumber: string
): Promise<{ failCount: number; attemptsLeft: number; locked: boolean }> {
  const failRef = ref(firebaseRtdb, `users/${uid}/biometricFailCount`);

  const tx = await runTransaction(failRef, (current: unknown) => {
    const prev = toNonNegInt(current);
    return prev + 1;
  });

  const failCount = toNonNegInt(tx.snapshot.val());
  const attemptsLeft = Math.max(0, MAX_BIOMETRIC_ATTEMPTS - failCount);

  if (failCount >= MAX_BIOMETRIC_ATTEMPTS) {
    await lockUserAndAccount(uid, accountNumber);
    return { failCount, attemptsLeft: 0, locked: true };
  }

  return { failCount, attemptsLeft, locked: false };
}

async function resetBiometricFailures(uid: string): Promise<void> {
  await update(ref(firebaseRtdb, `users/${uid}`), { biometricFailCount: 0 });
}

const PaymentWithdrawBiometricConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state as BiometricState | null) ?? null;
  const pendingWithdraw = state?.pendingWithdraw;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const goBackToPin = (): void => {
    if (isSubmitting) return;
    navigate("/accounts/payment/withdraw", { replace: true });
  };

  const startBiometricFlow = async (): Promise<void> => {
    if (!pendingWithdraw || isSubmitting) return;

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      navigate("/login", { replace: true });
      return;
    }

    // Kiểm tra user có bị lock không
    try {
      const stSnap = await get(ref(firebaseRtdb, `users/${currentUser.uid}/status`));
      const status = stSnap.exists() ? normalizeStatus(stSnap.val()) : "";
      if (status === "LOCKED") {
        toast.error("Tài khoản đang bị tạm khóa. Vui lòng liên hệ ngân hàng để mở lại.");
        navigate("/accounts/payment/withdraw", { replace: true });
        return;
      }
    } catch {
      // ignore
    }

    setErrorText(null);
    setIsSubmitting(true);

    let navigated = false;

    try {
      const reason = `Rút ${pendingWithdraw.amount.toLocaleString(
        "vi-VN"
      )} VND từ tài khoản thanh toán. Vui lòng xác thực sinh trắc (vân tay / FaceID).`;

      const bio = await runBiometricVerification(reason);

      if (!bio.success) {
        const msg = bio.message ?? "Xác thực sinh trắc không thành công.";
        setErrorText(msg);

        // "unavailable" không tính vào số lần sai
        if (bio.code !== "unavailable") {
          const r = await recordBiometricFailure(
            currentUser.uid,
            pendingWithdraw.accountNumber
          );

          if (r.locked) {
            toast.error("Bạn đã xác thực sinh trắc sai quá 5 lần. Tài khoản đã bị tạm khóa.");
            navigate("/accounts/payment/withdraw", { replace: true });
            return;
          }

          toast.error(`${msg} (Còn ${r.attemptsLeft} lần thử)`);
          return;
        }

        toast.error(msg);
        return;
      }

      // Sinh trắc OK => reset counter
      await resetBiometricFailures(currentUser.uid);

      toast.success("Xác thực sinh trắc thành công. Đang tạo OTP...");

      // Tạo giao dịch + OTP
      const resp = await initiateWithdrawFromPaymentAccountOtp(currentUser.uid, {
        amount: pendingWithdraw.amount,
        pin: pendingWithdraw.pin,
        accountNumber: pendingWithdraw.accountNumber,
      });

      if (!resp?.transactionId || resp.transactionId.trim() === "") {
        throw new Error("Không tạo được giao dịch OTP (thiếu transactionId).");
      }

      // Đánh dấu đã xác thực sinh trắc
      await markWithdrawTransactionBiometricVerified(resp.transactionId);

      // Chuyển sang màn OTP
      navigated = true;
      navigate("/accounts/payment/withdraw/otp", {
        replace: true,
        state: {
          withdraw: {
            transactionId: resp.transactionId,
            maskedEmail: resp.maskedEmail,
            expireAt: resp.expireAt,
            amount: pendingWithdraw.amount,
            accountNumber: pendingWithdraw.accountNumber,
            requiresBiometric: true,
          },
        },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Có lỗi khi tạo OTP sau sinh trắc.";
      setErrorText(message);
      toast.error(message);
      console.error("[PaymentWithdrawBiometricConfirm]", err);
    } finally {
      if (!navigated) setIsSubmitting(false);
    }
  };

  if (!pendingWithdraw) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Thiếu thông tin giao dịch. Vui lòng thực hiện rút tiền lại.
          </p>
          <Button onClick={() => navigate("/accounts/payment/withdraw")}>Quay lại</Button>
        </div>
      </div>
    );
  }

  const isHighValue = pendingWithdraw.amount >= HIGH_VALUE_THRESHOLD_VND;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={goBackToPin}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            disabled={isSubmitting}
            aria-label="Quay lại"
          >
            <ArrowLeft size={24} />
          </button>

          <h1 className="text-xl font-bold text-primary-foreground">
            Xác thực sinh trắc
          </h1>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <Card className="p-6 space-y-4">
          <div className="space-y-1 text-sm">
            <p>
              Số tiền rút:{" "}
              <span className="font-semibold">
                {pendingWithdraw.amount.toLocaleString("vi-VN")} đ
              </span>
            </p>
            <p>
              Tài khoản:{" "}
              <span className="font-semibold">
                {pendingWithdraw.accountNumber}
              </span>
            </p>
            {isHighValue && (
              <p className="text-xs text-amber-600">
                Giao dịch giá trị cao: cần xác thực sinh trắc trước khi nhập OTP.
              </p>
            )}
          </div>

          {errorText && <p className="text-xs text-destructive">{errorText}</p>}

          <Button
            className="w-full"
            onClick={() => void startBiometricFlow()}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Đang xử lý..." : "Quét vân tay / FaceID"}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={goBackToPin}
            disabled={isSubmitting}
          >
            Quay lại
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default PaymentWithdrawBiometricConfirm;