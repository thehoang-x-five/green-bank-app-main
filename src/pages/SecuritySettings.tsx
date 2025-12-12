// src/pages/SecuritySettings.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Shield,
  Lock,
  KeyRound,
  Bell,
  Smartphone,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { firebaseAuth } from "@/lib/firebase";
import { setTransactionPin } from "@/services/userService";

const SecuritySettings = () => {
  const navigate = useNavigate();

  // state demo cho các tuỳ chọn
  const [biometricLogin, setBiometricLogin] = useState(true);
  const [twoFactorLogin, setTwoFactorLogin] = useState(true);
  const [txnPinEnabled, setTxnPinEnabled] = useState(true);
  const [biometricForTransfer, setBiometricForTransfer] = useState(false);

  const [otpMethod, setOtpMethod] = useState<"sms" | "smartotp" | "token">(
    "sms"
  );

  const [securityAlert, setSecurityAlert] = useState({
    newDevice: true,
    highValueTxn: true,
    changeSecurity: true,
  });

  // === State cho form thiết lập / đổi PIN giao dịch ===
  const [showPinForm, setShowPinForm] = useState(false);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);

  const handleChangePassword = () => {
    toast.info("Màn hình đổi mật khẩu sẽ được triển khai (demo)");
  };

  const handleChangePin = () => {
    setShowPinForm((prev) => !prev);
  };

  const handleSubmitPin = async () => {
    const user = firebaseAuth.currentUser;

    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    if (!pin || !pinConfirm) {
      toast.error("Vui lòng nhập đầy đủ PIN và xác nhận PIN.");
      return;
    }

    if (pin !== pinConfirm) {
      toast.error("PIN và xác nhận PIN không khớp.");
      return;
    }

    if (pin.length < 4 || pin.length > 6) {
      toast.error("PIN phải từ 4–6 số.");
      return;
    }

    try {
      setIsSavingPin(true);
      await setTransactionPin(user.uid, pin);
      toast.success("Đã thiết lập / đổi PIN giao dịch thành công.");
      setTxnPinEnabled(true);
      setShowPinForm(false);
      setPin("");
      setPinConfirm("");
    } catch (error: unknown) {
      let message =
        "Không thể cập nhật PIN giao dịch. Vui lòng thử lại.";
      if (error instanceof Error && error.message) {
        message = error.message;
      }
      console.error(error);
      toast.error(message);
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleSave = () => {
    // Thực tế: gọi API lưu cấu hình bảo mật
    toast.success("Đã lưu cài đặt bảo mật (demo)");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/profile")}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-primary-foreground">Bảo mật</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {/* Đăng nhập & xác thực */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Đăng nhập & xác thực</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Đăng nhập bằng sinh trắc học
              </Label>
              <p className="text-xs text-muted-foreground">
                Sử dụng vân tay / FaceID để đăng nhập nhanh
              </p>
            </div>
            <Switch
              checked={biometricLogin}
              onCheckedChange={(checked) => {
                setBiometricLogin(checked);
                toast.success(
                  checked
                    ? "Đã bật đăng nhập bằng sinh trắc học (demo)"
                    : "Đã tắt đăng nhập bằng sinh trắc học (demo)"
                );
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Xác thực 2 lớp khi đăng nhập
              </Label>
              <p className="text-xs text-muted-foreground">
                Gửi OTP khi đăng nhập trên thiết bị mới
              </p>
            </div>
            <Switch
              checked={twoFactorLogin}
              onCheckedChange={(checked) => setTwoFactorLogin(checked)}
            />
          </div>
        </Card>

        {/* Mật khẩu & PIN giao dịch */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Mật khẩu & PIN giao dịch</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Mật khẩu đăng nhập</Label>
              <p className="text-xs text-muted-foreground">
                Nên thay đổi định kỳ 3–6 tháng/lần
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleChangePassword}>
              Đổi mật khẩu
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Mật khẩu giao dịch / PIN
              </Label>
              <p className="text-xs text-muted-foreground">
                Xác nhận trước khi chuyển tiền hoặc thanh toán
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={txnPinEnabled}
                onCheckedChange={(checked) => setTxnPinEnabled(checked)}
              />
              <Button size="sm" variant="outline" onClick={handleChangePin}>
                Thiết lập / đổi PIN
              </Button>
            </div>
          </div>

          {/* Form thiết lập / đổi PIN giao dịch */}
          {showPinForm && (
            <div className="mt-3 space-y-3 border-t pt-3">
              <Label className="text-xs text-muted-foreground">
                Thiết lập mã PIN 4–6 số để xác nhận chuyển tiền / thanh toán.
              </Label>
              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Nhập PIN mới"
                />
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinConfirm}
                  onChange={(e) =>
                    setPinConfirm(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Nhập lại PIN để xác nhận"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowPinForm(false);
                    setPin("");
                    setPinConfirm("");
                  }}
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitPin}
                  disabled={isSavingPin}
                >
                  {isSavingPin ? "Đang lưu..." : "Lưu PIN"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Dùng sinh trắc học khi xác nhận giao dịch
              </Label>
              <p className="text-xs text-muted-foreground">
                Thay cho nhập mật khẩu giao dịch trong hạn mức cho phép
              </p>
            </div>
            <Switch
              checked={biometricForTransfer}
              onCheckedChange={(checked) => setBiometricForTransfer(checked)}
            />
          </div>
        </Card>

        {/* Phương thức nhận OTP */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Phương thức nhận OTP</h2>
          </div>

          <p className="text-xs text-muted-foreground">
            OTP được sử dụng để xác thực các giao dịch quan trọng.
          </p>

          <div className="inline-flex rounded-full border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setOtpMethod("sms")}
              className={`px-4 py-1 text-xs rounded-full ${
                otpMethod === "sms"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
              }`}
            >
              SMS OTP
            </button>
            <button
              type="button"
              onClick={() => setOtpMethod("smartotp")}
              className={`px-4 py-1 text-xs rounded-full ${
                otpMethod === "smartotp"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
              }`}
            >
              Smart OTP
            </button>
            <button
              type="button"
              onClick={() => setOtpMethod("token")}
              className={`px-4 py-1 text-xs rounded-full ${
                otpMethod === "token"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
              }`}
            >
              Thiết bị Token
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Thay đổi phương thức OTP có thể yêu cầu xác minh bổ sung tại quầy
            hoặc qua eKYC theo quy định của ngân hàng.
          </p>
        </Card>

        {/* Cảnh báo bảo mật */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Cảnh báo bảo mật</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Đăng nhập trên thiết bị mới
              </Label>
              <p className="text-xs text-muted-foreground">
                Gửi thông báo / SMS khi phát hiện đăng nhập lạ
              </p>
            </div>
            <Switch
              checked={securityAlert.newDevice}
              onCheckedChange={(checked) =>
                setSecurityAlert((p) => ({ ...p, newDevice: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Giao dịch giá trị lớn
              </Label>
              <p className="text-xs text-muted-foreground">
                Cảnh báo khi giao dịch vượt hạn mức anh thiết lập
              </p>
            </div>
            <Switch
              checked={securityAlert.highValueTxn}
              onCheckedChange={(checked) =>
                setSecurityAlert((p) => ({ ...p, highValueTxn: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Thay đổi cài đặt bảo mật
              </Label>
              <p className="text-xs text-muted-foreground">
                Thông báo khi có thay đổi mật khẩu, PIN, OTP…
              </p>
            </div>
            <Switch
              checked={securityAlert.changeSecurity}
              onCheckedChange={(checked) =>
                setSecurityAlert((p) => ({ ...p, changeSecurity: checked }))
              }
            />
          </div>
        </Card>

        {/* Gợi ý khóa nhanh dịch vụ */}
        <Card className="p-5 space-y-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="text-sm font-semibold">Khóa nhanh dịch vụ</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Trong trường hợp nghi ngờ lộ thông tin hoặc bị mất điện thoại, anh
            có thể tạm khóa nhanh các dịch vụ ngân hàng số. Vui lòng liên hệ
            tổng đài hoặc chi nhánh gần nhất để được hỗ trợ mở lại.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() =>
              toast.info(
                "Tính năng khóa nhanh đang được mô phỏng, vui lòng liên hệ tổng đài trong thực tế."
              )
            }
          >
            Khóa nhanh dịch vụ (demo)
          </Button>
        </Card>

        {/* Nút Lưu thay đổi */}
        <div className="mb-6">
          <Button className="w-full" onClick={handleSave}>
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;
