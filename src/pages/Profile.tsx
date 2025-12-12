// src/pages/Profile.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  User,
  Settings,
  Shield,
  HelpCircle,
  LogOut,
  Fingerprint,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { logout, type AppUserProfile } from "@/services/authService";

import {
  getPrimaryAccount,
  type BankAccount,
} from "@/services/accountService";

type ProfileWithStatus = AppUserProfile & {
  status?: string;
  ekycStatus?: string;
};

const Profile = () => {
  const navigate = useNavigate();
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const [profile, setProfile] = useState<ProfileWithStatus | null>(null);
  const [primaryAccount, setPrimaryAccount] = useState<BankAccount | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const menuItems = [
    { icon: User, label: "Thông tin cá nhân", path: "/profile/info" },
    { icon: Settings, label: "Cài đặt tài khoản", path: "/profile/settings" },
    { icon: Shield, label: "Bảo mật", path: "/profile/security" },
    { icon: HelpCircle, label: "Trợ giúp & Hỗ trợ", path: "/profile/support" },
  ];

  // Lấy thông tin user hiện tại + tài khoản thanh toán chính
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setProfile(null);
        setPrimaryAccount(null);
        setLoading(false);
        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      try {
        const [snap, account] = await Promise.all([
          get(ref(firebaseRtdb, `users/${user.uid}`)),
          getPrimaryAccount(user.uid),
        ]);

        if (snap.exists()) {
          setProfile(snap.val() as ProfileWithStatus);
        } else {
          // fallback tối thiểu
          setProfile({
            uid: user.uid,
            username: user.displayName ?? "Khách hàng",
            email: user.email ?? "",
            role: "CUSTOMER",
            status: "ACTIVE",
            ekycStatus: "PENDING",
            canTransact: false,
            createdAt: Date.now(),
          } as ProfileWithStatus);
        }

        setPrimaryAccount(account);
      } catch (error) {
        console.error("Lỗi tải profile:", error);
        toast.error("Không tải được thông tin cá nhân.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Nếu là OFFICER thì không dùng trang profile này, redirect về dashboard nhân viên
  useEffect(() => {
    if (!loading && profile?.role === "OFFICER") {
      navigate("/officer");
    }
  }, [loading, profile, navigate]);

  // Tránh nháy UI trước khi redirect
  if (!loading && profile?.role === "OFFICER") {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Đăng xuất thành công");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Đăng xuất thất bại. Vui lòng thử lại.");
    }
  };

  const handleBiometricToggle = (checked: boolean) => {
    setBiometricEnabled(checked);
    toast.success(
      checked
        ? "Đã bật đăng nhập bằng vân tay"
        : "Đã tắt đăng nhập bằng vân tay"
    );
  };

  const displayName = profile?.username ?? "Khách hàng";
  const email = profile?.email ?? "Chưa có email";

  // Avatar initials
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "NA";

  // ===== Trạng thái tài khoản thanh toán =====
  let accountStatusText = "Chưa mở tài khoản thanh toán";
  let accountStatusClass = "text-amber-700";

  const userStatus = (profile?.status ?? "").toString().toUpperCase();

  if (primaryAccount) {
    if (primaryAccount.status === "LOCKED") {
      accountStatusText = "Tài khoản thanh toán đang tạm khóa";
      accountStatusClass = "text-red-700";
    } else {
      accountStatusText = "Tài khoản thanh toán đang hoạt động";
      accountStatusClass = "text-emerald-700";
    }
  } else if (userStatus === "LOCKED") {
    // Trường hợp sau này anh khóa toàn bộ user ở mức hồ sơ
    accountStatusText = "Tài khoản ngân hàng đang tạm khóa";
    accountStatusClass = "text-red-700";
  }

  // ===== Trạng thái eKYC =====
  let ekycText = "Chưa xác thực eKYC";
  let ekycClass = "text-amber-700";

  const ekycStatus = (profile?.ekycStatus ?? "").toString().toUpperCase();
  if (ekycStatus === "VERIFIED") {
    ekycText = "Đã xác thực eKYC";
    ekycClass = "text-emerald-700";
  } else if (ekycStatus === "REJECTED") {
    ekycText = "Hồ sơ eKYC bị từ chối";
    ekycClass = "text-red-700";
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-12">
        <h1 className="text-2xl font-bold text-primary-foreground mb-6">
          Cá nhân
        </h1>

        {/* User Info Card */}
        <Card className="p-5 bg-white/95 backdrop-blur-sm">
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold">
                {initials}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">
                  {displayName}
                </h2>
                <p className="text-sm text-muted-foreground">{email}</p>

                {/* 🔹 Thay dòng SĐT bằng trạng thái tài khoản ngân hàng */}
                <p className={`text-sm mt-1 font-medium ${accountStatusClass}`}>
                  {accountStatusText}
                </p>

                <p className={`text-xs mt-1 font-medium ${ekycClass}`}>
                  {ekycText}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="px-6 -mt-6">
        {/* Biometric Login Setting */}
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-primary" />
              </div>
              <div>
                <Label
                  htmlFor="biometric"
                  className="text-base font-medium cursor-pointer"
                >
                  Đăng nhập bằng vân tay
                </Label>
                <p className="text-sm text-muted-foreground">
                  Đăng nhập nhanh hơn
                </p>
              </div>
            </div>
            <Switch
              id="biometric"
              checked={biometricEnabled}
              onCheckedChange={handleBiometricToggle}
            />
          </div>
        </Card>

        {/* Menu Items */}
        <Card className="divide-y">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() =>
                  item.path
                    ? navigate(item.path)
                    : toast.info("Chức năng đang được phát triển")
                }
                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">
                    {item.label}
                  </span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
            );
          })}
        </Card>

        {/* Logout Button */}
        <Button
          variant="destructive"
          className="w-full mt-6"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </Button>

        {/* App Version */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Việt Bank v1.0.0
        </p>
      </div>
    </div>
  );
};

export default Profile;
