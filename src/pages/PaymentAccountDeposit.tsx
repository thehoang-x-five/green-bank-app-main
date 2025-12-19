// src/pages/PaymentAccountDeposit.tsx
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";
import { getUserProfile } from "@/services/userService";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import {
  getPrimaryAccount,
  getCustomerDisplayName,
  depositToPaymentAccount,
  type BankAccount,
} from "@/services/accountService";
import { push, ref, set } from "firebase/database";

// Kiểu direction cho log biến động
type Direction = "IN" | "OUT";

// ✅ Helper format/parse số tiền nhập (không đổi logic submit)
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

// Helper: ghi log biến động số dư (Nạp / Rút)
async function createBalanceChangeNotification(params: {
  uid: string;
  direction: Direction;
  title: string;
  message: string;
  amount: number;
  accountNumber: string;
  balanceAfter: number;
}): Promise<void> {
  const {
    uid,
    direction,
    title,
    message,
    amount,
    accountNumber,
    balanceAfter,
  } = params;

  const notiListRef = ref(firebaseRtdb, `notifications/${uid}`);
  const newRef = push(notiListRef);
  const createdAt = Date.now();

  await set(newRef, {
    type: "BALANCE_CHANGE",
    direction,
    title,
    message,
    amount,
    accountNumber,
    balanceAfter,
    transactionId: newRef.key,
    createdAt,
  });
}

const PaymentAccountDeposit = () => {
  const navigate = useNavigate();

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [holderName, setHolderName] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [pin, setPin] = useState<string>("");

  const [loadingAccount, setLoadingAccount] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Lấy user + tài khoản thanh toán giống PaymentAccountDetail
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

    // ✅ FIX: parse số tiền đã format "1.000.000" -> 1000000
    const numericAmount = parseVndInput(amount);
    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg("Vui lòng nhập số tiền nạp hợp lệ.");
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

      // 1. Thực hiện nạp tiền (service đã kiểm tra PIN, trạng thái, v.v.)
      await depositToPaymentAccount(firebaseUser.uid, {
        amount: numericAmount,
        pin,
      });

      // 2. Tính số dư sau nạp (xấp xỉ dựa trên số dư hiện tại + số tiền nạp)
      const currentBalance =
        typeof account.balance === "number"
          ? account.balance
          : Number(account.balance ?? 0);
      const balanceAfter = currentBalance + numericAmount;

      // 3. Ghi log biến động số dư vào notifications/{uid}
      const title = "Nạp tiền vào tài khoản thanh toán";
      const message = `Nạp ${numericAmount.toLocaleString(
        "vi-VN"
      )} VND vào tài khoản ${account.accountNumber}.`;

      await createBalanceChangeNotification({
        uid: firebaseUser.uid,
        direction: "IN",
        title,
        message,
        amount: numericAmount,
        accountNumber: account.accountNumber,
        balanceAfter,
      });

      toast.success("Nạp tiền thành công vào tài khoản thanh toán.");
      navigate(-1);
    } catch (error: unknown) {
      let message = "Có lỗi xảy ra, vui lòng thử lại.";
      if (error instanceof Error && error.message) {
        message = error.message;
      }
      setErrorMsg(message);
      toast.error(message);

      // 🔁 Nếu là lỗi sai PIN -> hiển thị số lần còn lại
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
              toast.error(
                `Sai mã PIN. Bạn còn ${remaining} lần thử trước khi tài khoản bị tạm khóa.`
              );
            } else {
              toast.error(
                "Bạn đã nhập sai mã PIN quá 5 lần. Tài khoản đã bị tạm khóa."
              );
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
              Nạp tiền tài khoản thanh toán
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

            {/* Form nạp tiền */}
            <Card className="p-6 space-y-4 max-w-md mx-auto">
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                autoComplete="off"
              >
                {/* Input giả để browser autofill vào đây thay vì ô PIN thật */}
                <input
                  type="text"
                  name="fake-username"
                  autoComplete="username"
                  className="hidden"
                />
                <input
                  type="password"
                  name="fake-password"
                  autoComplete="new-password"
                  className="hidden"
                />

                <div className="space-y-1">
                  <label className="text-sm font-medium">Số tiền nạp</label>

                  {/* ✅ FIX: dùng text để hiển thị 1.000.000, vẫn mở bàn phím số */}
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
                    Ví dụ: 1.000.000
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Mã PIN giao dịch
                  </label>
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

                {errorMsg && (
                  <p className="text-xs text-destructive">{errorMsg}</p>
                )}

                <Button
                  type="submit"
                  className="w-full rounded-full font-semibold"
                  disabled={submitting}
                >
                  {submitting ? "Đang xử lý..." : "Xác nhận nạp tiền"}
                </Button>
              </form>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentAccountDeposit;
