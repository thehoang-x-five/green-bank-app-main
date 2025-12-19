// src/components/layout/BottomNav.tsx
import { Home, CreditCard, Bell, User, QrCode } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Những route KHÔNG hiển thị bottom nav
  const hiddenRoutes = [
    "/utilities/flight", // màn hình đặt vé máy bay (demo)
    "/utilities/bill", // màn hình thanh toán hóa đơn (demo)
    "/utilities/phone", // màn hình nạp tiền điện thoại (demo)
    "/utilities/data", // màn hình nạp data 4G (demo)
    "/utilities/movie", // màn hình mua vé xem phim (demo)
    "/utilities/hotel", // màn hình đặt phòng khách sạn (demo)
  ];

  const shouldHide = hiddenRoutes.some((p) => location.pathname.startsWith(p));

  if (shouldHide) {
    return null;
  }

  const navItems = [
    { icon: Home, label: "Trang chủ", path: "/home" },
    { icon: CreditCard, label: "Tài khoản", path: "/accounts" },
    { icon: QrCode, label: "QR", path: "/qr-scanner", isCenter: true },
    { icon: Bell, label: "Thông báo", path: "/notifications" },
    { icon: User, label: "Cá nhân", path: "/profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const isCenter = item.isCenter;

          if (isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-8"
              >
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <Icon size={28} className="text-primary-foreground" />
                </div>
                <span className="text-xs mt-1 text-foreground">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
