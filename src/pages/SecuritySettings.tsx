// src/pages/SecuritySettings.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shield, Lock, KeyRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { signOut } from "firebase/auth";

import { firebaseAuth } from "@/lib/firebase";
import { changeTransactionPin, changeLoginPassword } from "@/services/userService";

const SecuritySettings = () => {
  const navigate = useNavigate();

  // ===== Password policy (UI) =====
  const passwordGuide =
    "Mật khẩu mới tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt.";

  const validateStrongPassword = (pw: string): string | null => {
    if (!pw || pw.length < 8) return "Mật khẩu mới phải có ít nhất 8 ký tự.";
    if (!/[A-Z]/.test(pw)) return "Mật khẩu mới phải có ít nhất 1 chữ hoa (A-Z).";
    if (!/[0-9]/.test(pw)) return "Mật khẩu mới phải có ít nhất 1 chữ số (0-9).";
    if (!/[^A-Za-z0-9]/.test(pw))
      return "Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt (vd: !@#$%^&*).";
    return null;
  };

  // ===== 1) Đổi mật khẩu đăng nhập =====
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const resetPasswordForm = () => {
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPasswordValue("");
    setNewPasswordConfirm("");
  };

  const handleSubmitChangePassword = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    if (!currentPassword || !newPasswordValue || !newPasswordConfirm) {
      toast.error("Vui lòng nhập đầy đủ các trường.");
      return;
    }

    if (newPasswordValue !== newPasswordConfirm) {
      toast.error("Mật khẩu mới và xác nhận không khớp.");
      return;
    }

    const pwErr = validateStrongPassword(newPasswordValue);
    if (pwErr) {
      toast.error(pwErr);
      return;
    }

    try {
      setIsSavingPassword(true);

      await changeLoginPassword({
        currentPassword,
        newPassword: newPasswordValue,
      });

      toast.success("Đổi mật khẩu thành công.");

      // tăng bảo mật: logout bắt buộc
      resetPasswordForm();
      await signOut(firebaseAuth);
      toast.info("Vui lòng đăng nhập lại với mật khẩu mới.");
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Không thể đổi mật khẩu. Vui lòng thử lại.";
      console.error(error);
      toast.error(message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  // ===== 2) Đổi PIN giao dịch =====
  const [showPinForm, setShowPinForm] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);

  const resetPinForm = () => {
    setShowPinForm(false);
    setCurrentPin("");
    setPin("");
    setPinConfirm("");
  };

  const isValidPin = (v: string) => /^\d{4,6}$/.test(v);

  const handleSubmitPin = async () => {
    const user = firebaseAuth.currentUser;

    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    if (!currentPin) {
      toast.error("Vui lòng nhập PIN hiện tại.");
      return;
    }
    if (!isValidPin(currentPin)) {
      toast.error("PIN hiện tại phải từ 4–6 số.");
      return;
    }

    if (!pin || !pinConfirm) {
      toast.error("Vui lòng nhập đầy đủ PIN mới và xác nhận PIN.");
      return;
    }

    if (!isValidPin(pin)) {
      toast.error("PIN mới phải từ 4–6 số.");
      return;
    }

    if (pin !== pinConfirm) {
      toast.error("PIN mới và xác nhận PIN không khớp.");
      return;
    }

    if (currentPin === pin) {
      toast.error("PIN mới phải khác PIN hiện tại.");
      return;
    }

    try {
      setIsSavingPin(true);

      await changeTransactionPin(user.uid, currentPin, pin);

      toast.success("Đã đổi PIN giao dịch thành công.");
      resetPinForm();
    } catch (error: unknown) {
      let message = "Không thể cập nhật PIN giao dịch. Vui lòng thử lại.";
      if (error instanceof Error && error.message) message = error.message;
      console.error(error);
      toast.error(message);
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/profile")}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            aria-label="Quay lại"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-primary-foreground">Bảo mật</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {/* Card: Đổi mật khẩu */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Mật khẩu đăng nhập</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="pr-3">
              <Label className="text-sm font-medium">Đổi mật khẩu</Label>
              <p className="text-xs text-muted-foreground">
                Khuyến nghị đổi định kỳ để tăng bảo mật tài khoản.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPasswordForm((p) => !p)}
            >
              {showPasswordForm ? "Đóng" : "Đổi mật khẩu"}
            </Button>
          </div>

          {showPasswordForm && (
            <div className="mt-2 space-y-3 border-t pt-3">
              <div className="rounded-lg bg-muted/60 p-3 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">
                    Chính sách mật khẩu
                  </span>
                </div>
                <p className="mt-1">{passwordGuide}</p>
              </div>

              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mật khẩu hiện tại"
                  autoComplete="current-password"
                />
                <Input
                  type="password"
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  placeholder="Mật khẩu mới"
                  autoComplete="new-password"
                />
                <Input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="Xác nhận mật khẩu mới"
                  autoComplete="new-password"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetPasswordForm}
                  disabled={isSavingPassword}
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitChangePassword}
                  disabled={isSavingPassword}
                >
                  {isSavingPassword ? "Đang lưu..." : "Lưu mật khẩu"}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Card: PIN giao dịch */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">PIN giao dịch</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="pr-3">
              <Label className="text-sm font-medium">Thiết lập / đổi PIN</Label>
              <p className="text-xs text-muted-foreground">
                Dùng để xác nhận chuyển tiền hoặc thanh toán (4–6 số).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPinForm((p) => !p)}
            >
              {showPinForm ? "Đóng" : "Thiết lập / đổi"}
            </Button>
          </div>

          {showPinForm && (
            <div className="mt-2 space-y-3 border-t pt-3">
              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="PIN hiện tại"
                  autoComplete="off"
                />
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="PIN mới"
                  autoComplete="off"
                />
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                  placeholder="Xác nhận PIN mới"
                  autoComplete="off"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetPinForm}
                  disabled={isSavingPin}
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
        </Card>

        {/* Card: Mẹo bảo mật (không liên quan vân tay) */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Mẹo bảo mật</h2>
          </div>
          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
            <li>Không chia sẻ OTP/PIN/mật khẩu cho bất kỳ ai, kể cả “nhân viên ngân hàng”.</li>
            <li>Đặt mật khẩu mạnh và không dùng lại mật khẩu ở các ứng dụng khác.</li>
            <li>Đổi PIN/mật khẩu ngay nếu nghi ngờ bị lộ thông tin.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default SecuritySettings;
