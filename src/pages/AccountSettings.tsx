// src/pages/AccountSettings.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Bell,
  Globe2,
  Smartphone,
  Shield,
  CreditCard,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AccountSettings = () => {
  const navigate = useNavigate();

  const [loginSettings, setLoginSettings] = useState({
    rememberUser: true,
    autoLogin: false,
    loginAlert: true,
  });

  const [notifySettings, setNotifySettings] = useState({
    smsTransaction: true,
    pushNotification: true,
    emailStatement: false,
  });

  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const [dailyLimit, setDailyLimit] = useState("200,000,000");

  const handleSave = () => {
    // Thực tế: gọi API lưu cài đặt
    toast.success("Đã lưu cài đặt tài khoản (demo)");
  };

  const handleReset = () => {
    setLoginSettings({
      rememberUser: true,
      autoLogin: false,
      loginAlert: true,
    });
    setNotifySettings({
      smsTransaction: true,
      pushNotification: true,
      emailStatement: false,
    });
    setLanguage("vi");
    setDailyLimit("200,000,000");
    toast.info("Đã khôi phục cài đặt mặc định (demo)");
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
          <h1 className="text-lg font-bold text-primary-foreground">
            Cài đặt tài khoản
          </h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {/* Cài đặt đăng nhập */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Cài đặt đăng nhập</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Ghi nhớ tên đăng nhập
              </Label>
              <p className="text-xs text-muted-foreground">
                Tự động điền tên đăng nhập trên thiết bị này
              </p>
            </div>
            <Switch
              checked={loginSettings.rememberUser}
              onCheckedChange={(checked) =>
                setLoginSettings((p) => ({ ...p, rememberUser: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Tự động đăng nhập</Label>
              <p className="text-xs text-muted-foreground">
                Không khuyến khích trên thiết bị dùng chung
              </p>
            </div>
            <Switch
              checked={loginSettings.autoLogin}
              onCheckedChange={(checked) =>
                setLoginSettings((p) => ({ ...p, autoLogin: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Thông báo khi có đăng nhập mới
              </Label>
              <p className="text-xs text-muted-foreground">
                Gửi cảnh báo khi tài khoản đăng nhập trên thiết bị lạ
              </p>
            </div>
            <Switch
              checked={loginSettings.loginAlert}
              onCheckedChange={(checked) =>
                setLoginSettings((p) => ({ ...p, loginAlert: checked }))
              }
            />
          </div>
        </Card>

        {/* Thông báo & sao kê */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Thông báo & Sao kê</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">SMS biến động số dư</Label>
              <p className="text-xs text-muted-foreground">
                Nhận SMS khi có giao dịch ghi nợ / ghi có
              </p>
            </div>
            <Switch
              checked={notifySettings.smsTransaction}
              onCheckedChange={(checked) =>
                setNotifySettings((p) => ({ ...p, smsTransaction: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Thông báo trên ứng dụng
              </Label>
              <p className="text-xs text-muted-foreground">
                Hiện thông báo đẩy cho các giao dịch và ưu đãi
              </p>
            </div>
            <Switch
              checked={notifySettings.pushNotification}
              onCheckedChange={(checked) =>
                setNotifySettings((p) => ({ ...p, pushNotification: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Nhận sao kê qua Email
              </Label>
              <p className="text-xs text-muted-foreground">
                Gửi sao kê điện tử hàng tháng tới email đã đăng ký
              </p>
            </div>
            <Switch
              checked={notifySettings.emailStatement}
              onCheckedChange={(checked) =>
                setNotifySettings((p) => ({ ...p, emailStatement: checked }))
              }
            />
          </div>
        </Card>

        {/* Hạn mức giao dịch */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Hạn mức giao dịch</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Hạn mức chuyển khoản trong ngày
              </p>
              <p className="text-xl font-semibold mt-1">{dailyLimit} VND</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info(
                  "Điều chỉnh hạn mức sẽ thực hiện tại quầy hoặc eKYC (demo)"
                )
              }
            >
              Thay đổi
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Để tăng hạn mức cao hơn, khách hàng có thể thực hiện định danh tại
            quầy hoặc qua eKYC theo hướng dẫn của ngân hàng.
          </p>
        </Card>

        {/* Ngôn ngữ & hiển thị */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Ngôn ngữ & hiển thị</h2>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Ngôn ngữ ứng dụng
            </span>
            <div className="inline-flex rounded-full border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setLanguage("vi")}
                className={`px-3 py-1 text-xs rounded-full ${
                  language === "vi"
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                Tiếng Việt
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-3 py-1 text-xs rounded-full ${
                  language === "en"
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                English
              </button>
            </div>
          </div>
        </Card>

        {/* Thiết bị đã đăng nhập (demo) */}
        <Card className="p-5 space-y-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Thiết bị đã đăng nhập</h2>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>- iPhone 15 Pro • Đăng nhập lần cuối: Hôm nay, 09:32</p>
            <p>- MacBook Pro • Đăng nhập lần cuối: Hôm qua, 21:10</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info(
                  "Quản lý chi tiết thiết bị đang được phát triển (demo)"
                )
              }
            >
              Quản lý thiết bị
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                toast.success(
                  "Đã gửi yêu cầu đăng xuất khỏi tất cả thiết bị (demo)"
                )
              }
            >
              Đăng xuất khỏi tất cả
            </Button>
          </div>
        </Card>

        {/* Nút Lưu / Khôi phục */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <Button variant="outline" className="w-full" onClick={handleReset}>
            Khôi phục mặc định
          </Button>
          <Button className="w-full" onClick={handleSave}>
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
