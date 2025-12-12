// src/pages/OfficerEKYCPage.tsx
import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, AlertTriangle } from "lucide-react";

import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { toast } from "sonner";
import type { AppUserProfile } from "@/services/authService";

type EKYCStatus = "pending" | "needMoreInfo" | "verified" | "rejected";

interface EKYCRequest {
  uid: string;
  cif: string;
  fullName: string;
  nationalId: string;
  phone: string;
  submittedAt: string; // dd/mm/yyyy • hh:mm
  status: EKYCStatus;
}

// Raw user lưu trong Realtime DB
type RawUserInDb = AppUserProfile & {
  nationalId?: string;
  cccd?: string;
  idNumber?: string;
  national_id?: string;
  phone?: string;
  phoneNumber?: string;
  ekycStatus?: string;
  kycStatus?: string;
  ekycSubmittedAt?: number;
};

type StaffProfile = AppUserProfile;

const statusLabel: Record<EKYCStatus, string> = {
  pending: "Đang chờ duyệt",
  needMoreInfo: "Thiếu thông tin",
  verified: "Đã xác thực",
  rejected: "Từ chối",
};

function mapRawStatus(raw?: string): EKYCStatus {
  const s = (raw || "").toLowerCase().trim();
  if (s === "needmoreinfo" || s === "need_more_info" || s === "missing") {
    return "needMoreInfo";
  }
  if (s === "verified") return "verified";
  if (s === "rejected") return "rejected";
  // default: coi như đang chờ duyệt
  return "pending";
}

function formatSubmittedAt(ts?: number): string {
  if (!ts) return "Chưa rõ thời gian";
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} • ${hh}:${mi}`;
}

const OfficerEKYCPage = () => {
  const navigate = useNavigate();

  // ======= THÔNG TIN NHÂN VIÊN (HEADER) =======
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

  // ======= DANH SÁCH HỒ SƠ EKYC =======
  const [requests, setRequests] = useState<EKYCRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<EKYCRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchEkycRequests = async () => {
      try {
        setLoadingRequests(true);
        const snap = await get(ref(firebaseRtdb, "users"));
        if (!snap.exists()) {
          setRequests([]);
          setFilteredRequests([]);
          return;
        }

        const rawAll = snap.val() as Record<string, RawUserInDb>;

        const list: EKYCRequest[] = Object.entries(rawAll)
          .filter(([, u]) => u && u.role === "CUSTOMER")
          .map(([uid, u]) => {
            const fullName = u.username || "(Chưa có tên)";
            const cif = u.cif || ""; // mã khách hàng
            const nationalId =
              u.nationalId || u.cccd || u.idNumber || u.national_id || "";
            const phone = u.phone || u.phoneNumber || "";
            const submittedAtTs = u.ekycSubmittedAt;
            const rawStatus = u.ekycStatus || u.kycStatus;
            const status = mapRawStatus(rawStatus);

            return {
              uid,
              cif,
              fullName,
              nationalId,
              phone,
              submittedAt: formatSubmittedAt(submittedAtTs),
              status,
            };
          })
          // chỉ lấy các hồ sơ cần xử lý (đang chờ / thiếu thông tin)
          .filter(
            (r) => r.status === "pending" || r.status === "needMoreInfo"
          );

        setRequests(list);
        setFilteredRequests(list);
      } catch (error) {
        console.error("Lỗi tải danh sách eKYC:", error);
        toast.error("Không tải được danh sách hồ sơ eKYC.");
      } finally {
        setLoadingRequests(false);
      }
    };

    fetchEkycRequests();
  }, []);

  // ======= SEARCH (theo CIF + tên + CCCD) =======
  useEffect(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      setFilteredRequests(requests);
      return;
    }

    const next = requests.filter((item) => {
      const name = item.fullName.toLowerCase();
      const nationalId = (item.nationalId || "").toLowerCase();
      const cif = (item.cif || "").toLowerCase();
      return (
        name.includes(keyword) ||
        nationalId.includes(keyword) ||
        cif.includes(keyword)
      );
    });

    setFilteredRequests(next);
  }, [search, requests]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const totalCount = filteredRequests.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-4">
      {/* Header kiểu mới */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Bên trái: tiêu đề + nút back */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">Hỗ trợ eKYC</p>
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
                <p className="text-emerald-100">Vai trò: Banking Officer</p>
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

      <main className="flex-1 px-4 mt-3">
        {/* Thu hẹp toàn bộ nội dung lại */}
        <div className="max-w-2xl mx-auto space-y-3">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-3 space-y-2">
              <CardTitle className="text-base md:text-lg font-semibold">
                Danh sách hồ sơ eKYC đang chờ
              </CardTitle>

              <Badge className="w-fit text-[11px] md:text-xs px-3 py-1 rounded-full bg-emerald-700 text-white">
                Tổng: {totalCount} hồ sơ
              </Badge>

              <p className="flex items-start gap-1 text-[11px] md:text-xs text-amber-700">
                <AlertTriangle className="h-3 w-3 mt-0.5" />
                <span>
                  Nhân viên kiểm tra CCCD và khuôn mặt, sau đó đánh dấu
                  <span className="italic"> “Đã xác thực” </span>
                  hoặc
                  <span className="italic"> “Từ chối/Bổ sung”.</span>
                </span>
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Thanh tìm kiếm + nút Tìm kiếm cùng 1 hàng */}
              <div className="flex items-center gap-2 text-xs">
                <div className="relative flex-1">
                  <Search className="h-3 w-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9 text-xs rounded-full"
                    placeholder="Tìm theo CIF / tên / CCCD"
                    value={search}
                    onChange={handleSearchChange}
                  />
                </div>
                <Button
                  type="button"
                  className="h-9 px-4 text-xs rounded-full"
                >
                  Tìm kiếm
                </Button>
              </div>

              {/* Danh sách hồ sơ */}
              <div className="space-y-3">
                {loadingRequests && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Đang tải danh sách hồ sơ eKYC...
                  </p>
                )}

                {!loadingRequests &&
                  filteredRequests.map((item) => (
                    <div
                      key={item.uid}
                      className="rounded-2xl border px-3 py-2 md:px-4 md:py-2.5 bg-white flex flex-col gap-1.5 max-w-xl mx-auto"
                    >
                      {/* Hàng trên: thông tin + trạng thái */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-sm md:text-base">
                            {item.fullName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            CIF: {item.cif || "Chưa có"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            CCCD: {item.nationalId || "Chưa cập nhật"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.submittedAt}
                          </p>
                        </div>

                        <Badge className="text-[11px] md:text-xs font-medium whitespace-nowrap bg-emerald-600 text-white">
                          {statusLabel[item.status]}
                        </Badge>
                      </div>

                      {/* Hàng dưới: link Xem hồ sơ */}
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          className="text-[11px] md:text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                          onClick={() =>
                            navigate(`/officer/ekyc/${item.uid}`)
                          }
                        >
                          Xem hồ sơ
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  ))}

                {!loadingRequests && filteredRequests.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Không tìm thấy hồ sơ eKYC nào khớp với từ khóa.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default OfficerEKYCPage;
