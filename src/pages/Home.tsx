// src/pages/Home.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  Smartphone,
  Wifi,
  Plane,
  Film,
  Hotel,
  ArrowUpRight,
  QrCode,
  Eye,
  EyeOff,
} from "lucide-react";

import { firebaseAuth } from "@/lib/firebase";
import { getPrimaryAccount } from "@/services/accountService";
import { getCurrentUserProfile } from "@/services/userService";
import type { AppUserProfile } from "@/services/authService";
import { onAuthStateChanged, type User } from "firebase/auth";

const Home = () => {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);

  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [balance, setBalance] = useState<number>(0);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // ✅ auth ready + user hiện tại (fix reload mất currentUser)
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(firebaseAuth.currentUser);

  // Tiện ích (giữ nguyên)
  const utilities = [
    { icon: Receipt, label: "Thanh toán hóa đơn", path: "/utilities/bill" },
    {
      icon: Smartphone,
      label: "Nạp tiền điện thoại",
      path: "/utilities/phone",
    },
    { icon: Wifi, label: "Nạp data 4G", path: "/utilities/data" },
    { icon: Plane, label: "Vé máy bay", path: "/utilities/flight" },
    { icon: Film, label: "Vé xem phim", path: "/utilities/movie-booking" },
    { icon: Hotel, label: "Đặt phòng khách sạn", path: "/utilities/hotel-booking" },
  ];

  // ✅ 1) Lắng nghe auth state để biết khi nào user hydrate xong sau reload
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ✅ 2) Khi auth đã ready và có user -> fetch profile + balance
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Chưa ready thì giữ loading
      if (!authReady) return;

      // Ready nhưng không có user -> coi như chưa đăng nhập (tùy app bạn có guard route hay không)
      if (!authUser) {
        if (!cancelled) {
          setProfile(null);
          setBalance(0);
          setLoadingProfile(false);
          setLoadingBalance(false);
        }
        return;
      }

      if (!cancelled) {
        setLoadingProfile(true);
        setLoadingBalance(true);
      }

      try {
        const [p, acc] = await Promise.all([
          getCurrentUserProfile(),
          getPrimaryAccount(authUser.uid),
        ]);

        if (cancelled) return;

        setProfile(p);
        setBalance(acc?.balance ?? 0);
      } catch (error) {
        console.error("Home fetch error:", error);
        if (!cancelled) {
          // fallback an toàn
          setProfile(null);
          setBalance(0);
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
          setLoadingBalance(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authReady, authUser?.uid]);

  const formatMoney = (value: number): string => {
    try {
      return value.toLocaleString("vi-VN");
    } catch {
      return String(value);
    }
  };

  const displayName = profile?.username || "Khách hàng";
  const displayBalance = formatMoney(balance);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-primary-foreground/80 text-sm">Xin chào,</p>
            <h2 className="text-primary-foreground text-xl font-bold">
              {loadingProfile ? "Đang tải..." : displayName}
            </h2>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20"
            onClick={() => navigate("/qr-scanner")}
          >
            <QrCode size={24} />
          </Button>
        </div>

        {/* Balance Card */}
        <Card className="p-5 bg-white/95 backdrop-blur-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Số dư tài khoản</p>
              <div className="flex items-center gap-2">
                <h3 className="text-3xl font-bold text-primary">
                  {loadingBalance
                    ? "Đang tải..."
                    : showBalance
                    ? displayBalance
                    : "••••••••"}
                </h3>

                {!loadingBalance && (
                  <button
                    type="button"
                    onClick={() => setShowBalance((p) => !p)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Ẩn/hiện số dư"
                  >
                    {showBalance ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">VND</p>
            </div>
          </div>

          <Button className="w-full" onClick={() => navigate("/transfer")}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Chuyển tiền
          </Button>
        </Card>
      </div>

      {/* Utilities Section */}
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Tiện ích</h3>
        <div className="grid grid-cols-3 gap-4">
          {utilities.map((utility, index) => {
            const Icon = utility.icon;
            return (
              <button
                key={index}
                onClick={() => navigate(utility.path)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs text-center text-foreground leading-tight">
                  {utility.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Home;
