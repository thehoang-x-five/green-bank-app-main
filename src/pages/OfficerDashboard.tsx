// src/pages/OfficerDashboard.tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

import { ArrowLeft, Users, BadgeCheck, Percent } from "lucide-react";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { toast } from "sonner";
import { logout, type AppUserProfile } from "@/services/authService";

// ===== Types phụ trợ =====

type StaffProfile = AppUserProfile;

type RawUserInDb = AppUserProfile & {
  ekycStatus?: string;
  kycStatus?: string;
};

type NormalizedEkycStatus = "pending" | "needMoreInfo" | "verified" | "rejected";

function normalizeEkycStatus(raw?: string | null): NormalizedEkycStatus {
  const s = (raw ?? "").toString().toLowerCase().trim();

  if (s === "needmoreinfo" || s === "need_more_info" || s === "missing") {
    return "needMoreInfo";
  }
  if (s === "verified" || s === "done" || s === "approved") {
    return "verified";
  }
  if (s === "rejected" || s === "denied") {
    return "rejected";
  }

  // mặc định: coi là đang chờ duyệt
  return "pending";
}

const OfficerDashboard = () => {
  const navigate = useNavigate();

  // ====== PROFILE NHÂN VIÊN ======
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(true);

  // ====== STATS KHÁCH HÀNG / E-KYC ======
  const [stats, setStats] = useState({
    totalCustomers: 0,
    pendingEKYC: 0,
  });

  // Hàm tải thống kê từ node users trong Realtime DB
  const fetchStats = async () => {
    try {
      const snap = await get(ref(firebaseRtdb, "users"));
      if (!snap.exists()) {
        setStats({ totalCustomers: 0, pendingEKYC: 0 });
        return;
      }

      const usersObj = snap.val() as Record<string, RawUserInDb>;
      let totalCustomers = 0;
      let pendingEKYC = 0;

      Object.values(usersObj).forEach((u) => {
        if (u.role === "CUSTOMER") {
          totalCustomers++;

          // dùng cùng logic với trang eKYC list
          const status = normalizeEkycStatus(u.ekycStatus ?? u.kycStatus);

          // hồ sơ cần xử lý: đang chờ hoặc thiếu thông tin
          if (status === "pending" || status === "needMoreInfo") {
            pendingEKYC++;
          }
        }
      });

      setStats({ totalCustomers, pendingEKYC });
    } catch (error) {
      console.error("Lỗi tải thống kê khách hàng:", error);
      // Không cần toast quá ồn, để 0 là được
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setStaffProfile(null);
        setLoadingStaff(false);
        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      try {
        const snap = await get(ref(firebaseRtdb, `users/${user.uid}`));
        if (!snap.exists()) {
          toast.error("Không tìm thấy hồ sơ nhân viên.");
          navigate("/login");
          return;
        }

        const raw = snap.val() as AppUserProfile;

        // Chỉ cho OFFICER vào dashboard nhân viên
        if (raw.role !== "OFFICER") {
          toast.error("Tài khoản này không phải nhân viên ngân hàng.");
          navigate("/home");
          return;
        }

        setStaffProfile(raw);

        // Sau khi confirm là nhân viên -> tải thống kê khách hàng
        await fetchStats();
      } catch (error) {
        console.error("Lỗi tải profile nhân viên:", error);
        toast.error("Không tải được thông tin nhân viên.");
      } finally {
        setLoadingStaff(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

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

  const displayName =
    staffProfile?.username?.trim() || "Nhân viên ngân hàng";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-8">
      {/* Header xanh + nút đăng xuất */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 rounded-b-3xl shadow-md flex items-center justify-between">
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 text-xs text-emerald-100 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Đăng xuất
        </button>

        <div className="text-right">
          {loadingStaff ? (
            <>
              <p className="text-xs text-emerald-100">Đang tải thông tin...</p>
              <div className="h-4 w-32 bg-emerald-600/40 rounded mt-1 animate-pulse" />
            </>
          ) : (
            <>
              <p className="text-xs text-emerald-100">Chào mừng,</p>
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-[11px] text-emerald-100/90">
                Vai trò: Banking Officer
              </p>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 mt-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* 3 ô chức năng chính */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ô 1: Khách hàng */}
            <Card
              role="button"
              tabIndex={0}
              onClick={() => navigate("/officer/customers")}
              className="border-0 shadow-sm bg-white hover:shadow-md transition cursor-pointer"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Users className="w-6 h-6 text-emerald-600" />
                  Khách hàng
                </CardTitle>
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                  {stats.totalCustomers.toLocaleString("vi-VN")} KH
                </span>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-1">
                <p>
                  Quản lý hồ sơ, chỉnh sửa thông tin và mở các loại tài khoản.
                </p>
                <p className="font-medium text-emerald-700 mt-1">
                  → Bấm để vào màn hình quản lý khách hàng
                </p>
              </CardContent>
            </Card>

            {/* Ô 2: eKYC */}
            <Card
              className="border-0 shadow-sm bg-white cursor-pointer hover:bg-emerald-50 transition"
              onClick={() => navigate("/officer/ekyc")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <BadgeCheck className="w-6 h-6 text-amber-500" />
                    Chờ eKYC
                  </CardTitle>

                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                    {stats.pendingEKYC} HS
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground mt-1">
                  Danh sách khách hàng đã đăng ký nhưng chưa được xác thực.
                </p>
              </CardHeader>

              <CardContent>
                <p className="text-[11px] text-emerald-700 mt-1">
                  → Bấm để mở danh sách hồ sơ eKYC đang chờ duyệt
                </p>
              </CardContent>
            </Card>

            {/* Ô 3: Lãi suất */}
            <Card
              role="button"
              tabIndex={0}
              onClick={() => navigate("/officer/rates")}
              className="border-0 shadow-sm bg-white hover:shadow-md transition cursor-pointer"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Percent className="w-6 h-6 text-emerald-600" />
                  Lãi suất tiết kiệm và thế chấp
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-1">
                <p>
                  Quản lý lãi suất tiết kiệm (1, 3, 6, 12 tháng) và lãi suất vay
                  thế chấp.
                </p>

                <p className="font-medium text-emerald-700 mt-1">
                  → Bấm để mở màn hình quản lý lãi suất
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
};

export default OfficerDashboard;
