// src/pages/TransferBiometricConfirm.tsx
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import {
  get,
  ref,
  update,
  runTransaction,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import type { DatabaseReference, DataSnapshot } from "firebase/database";

import {
  HIGH_VALUE_THRESHOLD_VND,
  runBiometricVerification,
} from "@/services/biometricService";

import {
  initiateTransferToAccount,
  markTransactionBiometricVerified,
  type TransferToAccountRequest,
} from "@/services/transferService";

const MAX_BIOMETRIC_ATTEMPTS = 5;

type BiometricState = {
  pendingRequest?: TransferToAccountRequest;
  sessionId?: string;
};

type RtdbAccountLite = {
  uid?: string;
  status?: string;
  accountNumber?: string;
  [key: string]: unknown;
};

function generateSessionId(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

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

function pickFirstKeyOfRecord(v: unknown): string | null {
  if (typeof v !== "object" || v === null) return null;
  const rec = v as Record<string, unknown>;
  const keys = Object.keys(rec);
  return keys.length > 0 ? keys[0] : null;
}

/**
 * ✅ Resolve CHẮC CHẮN đúng node account theo accountNumber.
 * - Ưu tiên key trực tiếp accounts/{accountNumber} nếu tồn tại.
 * - Nếu không tồn tại: query theo child accountNumber.
 * - Nếu query ra nhiều kết quả (xấu), sẽ cố chọn đúng record có acc.accountNumber === accountNumber.
 */
async function resolveAccountRefByAccountNumber(
  accountNumber: string
): Promise<{ accRef: DatabaseReference; acc: RtdbAccountLite; key: string } | null> {
  const target = accountNumber.trim();
  if (!target) return null;

  // 1) thử accounts/{accountNumber}
  const directKey = target;
  const directRef = ref(firebaseRtdb, `accounts/${directKey}`);
  const directSnap = await get(directRef);
  if (directSnap.exists()) {
    return {
      accRef: directRef,
      acc: directSnap.val() as RtdbAccountLite,
      key: directKey,
    };
  }

  // 2) fallback query theo child accountNumber
  const q = query(
    ref(firebaseRtdb, "accounts"),
    orderByChild("accountNumber"),
    equalTo(target)
  );

  const listSnap = await get(q);
  if (!listSnap.exists()) return null;

  const raw = listSnap.val() as Record<string, unknown>;
  const keys = Object.keys(raw);
  if (keys.length === 0) return null;

  // cố chọn đúng record có field accountNumber match
  let pickedKey: string | null = null;
  for (const k of keys) {
    const item = raw[k];
    if (typeof item === "object" && item !== null) {
      const acc = item as Record<string, unknown>;
      const accNo = typeof acc.accountNumber === "string" ? acc.accountNumber : String(acc.accountNumber ?? "");
      if (accNo.trim() === target) {
        pickedKey = k;
        break;
      }
    }
  }

  // nếu không tìm được match field, fallback key đầu tiên
  if (!pickedKey) pickedKey = keys[0];

  const accRef = ref(firebaseRtdb, `accounts/${pickedKey}`);
  const snap = await get(accRef);
  if (!snap.exists()) return null;

  return { accRef, acc: snap.val() as RtdbAccountLite, key: pickedKey };
}

/**
 * ✅ Chặn giao dịch nếu tài khoản thanh toán đã LOCKED
 */
async function ensureAccountNotLocked(
  uid: string,
  sourceAccountNumber: string
): Promise<void> {
  const resolved = await resolveAccountRefByAccountNumber(sourceAccountNumber);
  if (!resolved) return; // không resolve được thì không tự block ở đây

  const ownerUid = typeof resolved.acc.uid === "string" ? resolved.acc.uid.trim() : "";
  if (ownerUid && ownerUid !== uid) return; // không phải tài khoản của user hiện tại

  const st = normalizeStatus(resolved.acc.status);
  if (st === "LOCKED") {
    throw new Error("Tài khoản thanh toán đang bị tạm khóa. Vui lòng liên hệ nhân viên để mở lại.");
  }
}

/**
 * ✅ Lock đồng bộ: users/{uid}.status + accounts/{account}.status
 * (Đây là chỗ fix đúng lỗi anh gặp: toast báo khóa nhưng node account vẫn ACTIVE)
 */
async function lockUserAndSourceAccount(uid: string, sourceAccountNumber: string): Promise<void> {
  const now = Date.now();

  // 1) lock user
  await update(ref(firebaseRtdb, `users/${uid}`), {
    status: "LOCKED",
    lockedAt: now,
    lockReason: "BIOMETRIC_FAILED",
  });

  // 2) lock account
  const resolved = await resolveAccountRefByAccountNumber(sourceAccountNumber);
  if (!resolved) return;

  const ownerUid = typeof resolved.acc.uid === "string" ? resolved.acc.uid.trim() : "";
  if (ownerUid && ownerUid !== uid) return;

  await update(resolved.accRef, {
    status: "LOCKED",
    lockedAt: now,
    lockReason: "BIOMETRIC_FAILED",
  });

  // ✅ debug nhẹ (không ảnh hưởng logic)
  // console.log("[LOCK_ACCOUNT_OK]", { uid, sourceAccountNumber, key: resolved.key });
}

async function recordBiometricFailure(
  uid: string,
  sourceAccountNumber: string
): Promise<{ failCount: number; attemptsLeft: number; locked: boolean }> {
  const failRef = ref(firebaseRtdb, `users/${uid}/biometricFailCount`);

  const tx = await runTransaction(failRef, (current: unknown) => {
    const prev = toNonNegInt(current);
    return prev + 1;
  });

  const failCount = toNonNegInt(tx.snapshot.val());
  const attemptsLeft = Math.max(0, MAX_BIOMETRIC_ATTEMPTS - failCount);

  if (failCount >= MAX_BIOMETRIC_ATTEMPTS) {
    await lockUserAndSourceAccount(uid, sourceAccountNumber);
    return { failCount, attemptsLeft: 0, locked: true };
  }

  return { failCount, attemptsLeft, locked: false };
}

async function resetBiometricFailures(uid: string): Promise<void> {
  await update(ref(firebaseRtdb, `users/${uid}`), { biometricFailCount: 0 });
}

export default function TransferBiometricConfirm() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state as BiometricState | null) ?? null;
  const pendingRequest = state?.pendingRequest;

  const sessionId = useMemo(
    () => state?.sessionId ?? generateSessionId(),
    [state?.sessionId]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const goBackToPin = (): void => {
    if (isSubmitting) return;

    if (!pendingRequest) {
      navigate("/transfer", { replace: true });
      return;
    }

    navigate("/transfer/account", {
      replace: true,
      state: { resume: { pendingRequest } },
    });
  };

  const startBiometricFlow = async (): Promise<void> => {
    if (!pendingRequest || isSubmitting) return;

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      navigate("/login", { replace: true });
      return;
    }

    // ✅ Chặn nếu user LOCKED
    try {
      const stSnap = await get(ref(firebaseRtdb, `users/${currentUser.uid}/status`));
      const status = stSnap.exists() ? normalizeStatus(stSnap.val()) : "";
      if (status === "LOCKED") {
        toast.error("Tài khoản đang bị tạm khóa. Vui lòng liên hệ nhân viên để mở lại.");
        navigate("/transfer", { replace: true });
        return;
      }
    } catch {
      // ignore
    }

    // ✅ Chặn nếu account LOCKED (đúng nghiệp vụ “xét status account là chính”)
    try {
      await ensureAccountNotLocked(currentUser.uid, pendingRequest.sourceAccountNumber);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Tài khoản đang bị tạm khóa.";
      toast.error(msg);
      navigate("/transfer", { replace: true });
      return;
    }

    setErrorText(null);
    setIsSubmitting(true);

    let navigated = false;

    try {
      const reason = `Giao dịch chuyển khoản ${pendingRequest.amount.toLocaleString(
        "vi-VN"
      )} VND. Vui lòng xác thực sinh trắc (vân tay / FaceID).`;

      const bio = await runBiometricVerification(reason);

      if (!bio.success) {
        const msg = bio.message ?? "Xác thực sinh trắc không thành công.";
        setErrorText(msg);

        // "unavailable" không tính vào số lần sai
        if (bio.code !== "unavailable") {
          const r = await recordBiometricFailure(
            currentUser.uid,
            pendingRequest.sourceAccountNumber
          );

          if (r.locked) {
            toast.error("Bạn đã xác thực sinh trắc sai quá 5 lần. Tài khoản đã bị tạm khóa.");
            navigate("/transfer", { replace: true });
            return;
          }

          toast.error(`${msg} (Còn ${r.attemptsLeft} lần thử)`);
          return;
        }

        toast.error(msg);
        return;
      }

      // sinh trắc OK => reset counter
      await resetBiometricFailures(currentUser.uid);

      toast.success("Xác thực sinh trắc thành công. Đang tạo Smart-OTP...");

      // 1) tạo txn + OTP
      const resp = await initiateTransferToAccount(pendingRequest);

      if (!resp?.transactionId || resp.transactionId.trim() === "") {
        throw new Error("Không tạo được giao dịch Smart-OTP (thiếu transactionId).");
      }

      // ✅ FIX OTP bị chặn: đánh dấu txn đã sinh trắc
      await markTransactionBiometricVerified(resp.transactionId);

      // 2) sang OTP
      navigated = true;
      navigate("/transfer/otp", {
        replace: true,
        state: {
          transfer: {
            transactionId: resp.transactionId,
            otpCode: resp.devOtpCode ?? "",
            expireAt: resp.expireAt,
            amount: pendingRequest.amount,
            content: pendingRequest.content,
            sourceAccountNumber: pendingRequest.sourceAccountNumber,
            destinationAccountNumber: pendingRequest.destinationAccountNumber,
            destinationName:
              pendingRequest.destinationName ?? pendingRequest.destinationAccountNumber,
            bankName: pendingRequest.bankName,
          },
        },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Có lỗi khi tạo Smart-OTP sau sinh trắc.";
      setErrorText(message);
      toast.error(message);
      console.error("[TransferBiometricConfirm]", { sessionId, err });
    } finally {
      if (!navigated) setIsSubmitting(false);
    }
  };

  if (!pendingRequest) {
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

  const isHighValue = pendingRequest.amount >= HIGH_VALUE_THRESHOLD_VND;

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
              Số tiền:{" "}
              <span className="font-semibold">
                {pendingRequest.amount.toLocaleString("vi-VN")} đ
              </span>
            </p>
            <p>
              Người nhận:{" "}
              <span className="font-semibold">
                {pendingRequest.destinationName} - {pendingRequest.destinationAccountNumber} (
                {pendingRequest.bankName})
              </span>
            </p>
            {isHighValue && (
              <p className="text-xs text-amber-600">
                Giao dịch giá trị cao: cần xác thực sinh trắc trước khi nhập Smart-OTP.
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
}
