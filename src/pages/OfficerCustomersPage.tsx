// src/pages/OfficerCustomersPage.tsx
import { useEffect, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Search, Users, ArrowLeft, Plus } from "lucide-react";

import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { toast } from "sonner";
import type { AppUserProfile } from "@/services/authService";

// ----- Kiểu raw user trong Realtime DB -----
interface RawUser extends AppUserProfile {
  cif?: string;
  cifCode?: string;
  nationalId?: string;
  cccd?: string;
  idNumber?: string;
  national_id?: string;
  phone?: string;
  phoneNumber?: string;
}

// Nhân viên = profile app user
type StaffProfile = AppUserProfile;

// Khách hàng: thêm uid + normalize 1 số field
type CustomerProfile = RawUser & {
  uid: string;
};

const OfficerCustomersPage = () => {
  const navigate = useNavigate();

  // ==== THÔNG TIN NHÂN VIÊN (HEADER) ====
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(true);

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
        if (raw.role !== "OFFICER") {
          toast.error("Tài khoản này không phải nhân viên ngân hàng.");
          navigate("/home");
          return;
        }

        setStaffProfile(raw);
      } catch (error) {
        console.error("Lỗi tải profile nhân viên:", error);
        toast.error("Không tải được thông tin nhân viên.");
      } finally {
        setLoadingStaff(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const staffName =
    staffProfile?.username?.trim() || "Banking Officer";

  // ==== DANH SÁCH KHÁCH HÀNG ====
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerProfile[]>(
    []
  );
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);

        const snap = await get(ref(firebaseRtdb, "users"));
        if (!snap.exists()) {
          setCustomers([]);
          setFilteredCustomers([]);
          return;
        }

        const raw = snap.val() as Record<string, RawUser>;

        const list: CustomerProfile[] = Object.entries(raw)
          .filter(([, u]) => u && u.role === "CUSTOMER")
          .map(([uid, u]) => ({
            uid,
            ...u,
            cif: u.cif || u.cifCode || "",
            nationalId:
              u.nationalId || u.cccd || u.idNumber || u.national_id || "",
            phone: u.phone || u.phoneNumber || "",
          }));

        // sắp xếp theo username để dễ nhìn
        list.sort((a, b) => {
          const nameA = (a.username || "").toLowerCase();
          const nameB = (b.username || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });

        setCustomers(list);
        setFilteredCustomers(list);
      } catch (error) {
        console.error("Lỗi load danh sách khách hàng:", error);
        toast.error("Không tải được danh sách khách hàng.");
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, []);

  // ==== SEARCH: theo tên / CIF / CCCD / SĐT ====
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setFilteredCustomers(customers);
      return;
    }

    const next = customers.filter((c) => {
      const name = (c.username || "").toLowerCase();
      const cif = (c.cif || "").toLowerCase();
      const nationalId = (c.nationalId || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();

      return (
        name.includes(q) ||
        cif.includes(q) ||
        nationalId.includes(q) ||
        phone.includes(q)
      );
    });

    setFilteredCustomers(next);
  }, [search, customers]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-8">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Bên trái: tên trang + nút back */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">Quản lý khách hàng</p>
            <button
              type="button"
              onClick={() => navigate("/officer")}
              className="inline-flex items-center gap-2 text-xs text-emerald-100 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại Dashboard
            </button>
          </div>

          {/* Bên phải: thông tin nhân viên */}
          <div className="text-right text-xs">
            {loadingStaff ? (
              <>
                <p className="font-semibold">Đang tải...</p>
                <p className="text-emerald-100 mt-1">
                  Vai trò: Banking Officer
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">{staffName}</p>
                <p className="text-emerald-100">Vai trò: Banking Officer</p>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 mt-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Card className="border-0 shadow-sm bg-white">
            {/* Header danh sách khách hàng */}
            <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-5 w-5 text-emerald-600" />
                  <span className="whitespace-nowrap">
                    Danh sách khách hàng
                  </span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Tra cứu khách hàng và mở trang quản lý hồ sơ chi tiết.
                </p>
              </div>

              <div className="flex items-end">
                <Button
                  size="sm"
                  className="h-8 px-3 text-[11px] rounded-full inline-flex items-center gap-1 mt-2"
                  onClick={() =>
                    navigate("/login?mode=register&source=officer")
                  }
                >
                  <Plus className="h-3 w-3" />
                  Tạo khách mới
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Ô tìm kiếm */}
              <div className="flex items-center gap-2 text-xs">
                <div className="relative flex-1">
                  <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-7 h-8 text-xs"
                    placeholder="Tìm theo tên / CIF / CCCD / SĐT"
                    value={search}
                    onChange={handleSearchChange}
                  />
                </div>
              </div>

              {/* Danh sách khách hàng */}
              <div className="space-y-2 mt-2">
                {loadingCustomers && (
                  <p className="text-xs text-muted-foreground py-4">
                    Đang tải danh sách khách hàng...
                  </p>
                )}

                {!loadingCustomers && filteredCustomers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Không tìm thấy khách hàng nào phù hợp.
                  </p>
                )}

                {!loadingCustomers &&
                  filteredCustomers.map((c) => (
                    <button
                      key={c.uid}
                      type="button"
                      onClick={() => navigate(`/officer/customers/${c.uid}`)}
                      className="w-full text-left rounded-lg border px-3 py-2 text-xs hover:bg-emerald-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">
                            {c.username || "(Chưa có tên)"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            CIF: {c.cif || "Chưa cấp"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            CCCD: {c.nationalId || "Chưa cập nhật"}
                          </p>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-medium">
                          Quản lý hồ sơ →
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default OfficerCustomersPage;
