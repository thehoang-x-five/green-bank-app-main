// src/pages/OtpVerification.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const OTP_EXPIRE_SECONDS = 180;

type Mode = "reset" | "register";
type Stage = "otp" | "newPassword";

const OtpVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const mode = (searchParams.get("mode") as Mode) || "reset"; // reset | register
  const username = searchParams.get("username") || "";

  const [otp, setOtp] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(OTP_EXPIRE_SECONDS);
  const [error, setError] = useState("");

  const [stage, setStage] = useState<Stage>("otp");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Đếm ngược thời gian OTP khi đang ở bước nhập OTP
  useEffect(() => {
    if (stage !== "otp") return;
    if (secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, stage]);

  const validateOtpReset = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Vui lòng nhập mã OTP";
    if (!/^\d+$/.test(trimmed)) return "Mã OTP chỉ gồm chữ số";
    if (trimmed.length !== 6) return "Mã OTP phải gồm đúng 6 chữ số";
    return "";
  };

  const handleVerifyOtp = () => {
    const otpErr = validateOtpReset(otp);
    if (otpErr) {
      setError(otpErr);
      return;
    }

    if (secondsLeft <= 0 && mode === "reset") {
      setError("Mã OTP đã hết hiệu lực. Vui lòng gửi lại mã mới.");
      return;
    }

    // Demo: OTP luôn đúng nếu qua được validate
    if (mode === "reset") {
      toast.success("Xác thực OTP thành công. Vui lòng đặt lại mật khẩu mới.");
      setError("");
      // Chuyển sang bước nhập mật khẩu mới
      setStage("newPassword");
    } else {
      // mode === "register"
      toast.success("Xác thực OTP thành công (demo)");
      navigate("/login?from=otp");
    }
  };

  const handleResend = () => {
    setSecondsLeft(OTP_EXPIRE_SECONDS);
    setOtp("");
    setError("");
    toast.success("Đã gửi lại mã OTP (demo)");
  };

  const handleConfirmNewPassword = () => {
    if (!newPassword || !confirmPassword) {
      setPasswordError(
        "Vui lòng nhập đầy đủ mật khẩu mới và xác nhận mật khẩu"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không trùng khớp");
      return;
    }

    // Có thể thêm rule độ mạnh mật khẩu nếu muốn
    setPasswordError("");
    toast.success("Đặt lại mật khẩu thành công (demo). Vui lòng đăng nhập.");
    navigate("/login");
  };

  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  // ------------ RENDER -------------
  const renderOtpStage = () => (
    <>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">
          {mode === "reset"
            ? "Nhập mã OTP để đặt lại mật khẩu"
            : "Xác thực OTP"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {mode === "reset" ? (
            <>
              Mã OTP đã được gửi đến email đã đăng ký
              {username ? (
                <>
                  {" "}
                  của tài khoản <b>{username}</b>.
                </>
              ) : (
                <> của bạn.</>
              )}{" "}
              Vui lòng nhập chính xác 6 số.
            </>
          ) : (
            <>
              Mã OTP đã được gửi đến email của bạn. Vui lòng nhập chính xác 6
              số.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={(value) => {
            setOtp(value);
            setError("");
          }}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 text-primary" />
          <span
            className={
              secondsLeft <= 0
                ? "text-destructive font-semibold"
                : "text-muted-foreground"
            }
          >
            {secondsLeft > 0
              ? `Mã OTP sẽ hết hiệu lực sau ${minutes}:${seconds}`
              : "Mã OTP đã hết hiệu lực"}
          </span>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={handleVerifyOtp} className="w-full">
          Xác nhận
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={secondsLeft > 0}
          onClick={handleResend}
        >
          Gửi lại mã OTP
        </Button>
      </div>
    </>
  );

  const renderNewPasswordStage = () => (
    <>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Đặt lại mật khẩu mới</h1>
        <p className="text-xs text-muted-foreground">
          Vui lòng nhập mật khẩu mới và xác nhận lại. Sau khi đặt lại thành
          công, bạn sẽ được chuyển về màn hình đăng nhập.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="new-password">Mật khẩu mới</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Nhập mật khẩu mới"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (passwordError) setPasswordError("");
            }}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (passwordError) setPasswordError("");
            }}
          />
        </div>

        {passwordError && (
          <p className="text-xs text-destructive">{passwordError}</p>
        )}

        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs flex items-start gap-2 mt-2">
          <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
          <span>
            Nên dùng mật khẩu ≥ 8 ký tự, kết hợp <b>chữ hoa</b>,{" "}
            <b>chữ thường</b> và <b>số</b> để tăng bảo mật.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={handleConfirmNewPassword} className="w-full">
          Xác nhận mật khẩu mới
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => navigate("/login")}
        >
          Hủy và quay lại đăng nhập
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/90 via-primary/70 to-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md bg-background/95 backdrop-blur shadow-2xl border-0 p-6 space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Quay lại
        </button>

        {stage === "otp" ? renderOtpStage() : renderNewPasswordStage()}
      </Card>
    </div>
  );
};

export default OtpVerification;
