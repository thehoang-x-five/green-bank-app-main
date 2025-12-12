// src/pages/OfficerEKYCDetailPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ShieldCheck,
  IdCard,
  User as UserIcon,
  Smartphone,
} from "lucide-react";

import { onAuthStateChanged } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { toast } from "sonner";
import type { AppUserProfile } from "@/services/authService";

type EKYCStatus = "pending" | "needMoreInfo" | "verified" | "rejected";

interface EKYCRequestDetail {
  uid: string;
  cif: string;
  fullName: string;
  nationalId: string;
  phone: string;
  status: EKYCStatus;
  frontIdUrl?: string | null;
  backIdUrl?: string | null;
  selfieUrl?: string | null;
}

// Raw trong DB – AppUserProfile đã có sẵn frontIdUrl/backIdUrl/selfieUrl
type RawUserInDb = AppUserProfile & {
  nationalId?: string;
  cccd?: string;
  idNumber?: string;
  national_id?: string;
  phone?: string;
  phoneNumber?: string;
  ekycStatus?: string;
  kycStatus?: string;
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
  return "pending";
}

const OfficerEKYCDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // ======= NHÂN VIÊN (HEADER) =======
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

  const staffName = staffProfile?.username?.trim() || "Banking Officer";

  // ======= HỒ SƠ EKYC KHÁCH HÀNG =======
  const [request, setRequest] = useState<EKYCRequestDetail | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchRequest = async () => {
      if (!id) {
        setLoadingRequest(false);
        setRequest(null);
        return;
      }

      try {
        setLoadingRequest(true);
        const snap = await get(ref(firebaseRtdb, `users/${id}`));
        if (!snap.exists()) {
          setRequest(null);
          return;
        }

        const raw = snap.val() as RawUserInDb;
        if (raw.role !== "CUSTOMER") {
          setRequest(null);
          return;
        }

        const fullName = raw.username || "(Chưa có tên)";
        const cif = raw.cif || "";
        const nationalId =
          raw.nationalId || raw.cccd || raw.idNumber || raw.national_id || "";
        const phone = raw.phone || raw.phoneNumber || "";
        const status = mapRawStatus(raw.ekycStatus || raw.kycStatus);

        const frontIdUrl = raw.frontIdUrl ?? null;
        const backIdUrl = raw.backIdUrl ?? null;
        const selfieUrl = raw.selfieUrl ?? null;

        setRequest({
          uid: id,
          cif,
          fullName,
          nationalId,
          phone,
          status,
          frontIdUrl,
          backIdUrl,
          selfieUrl,
        });
      } catch (error) {
        console.error("Lỗi tải hồ sơ eKYC:", error);
        toast.error("Không tải được hồ sơ eKYC.");
      } finally {
        setLoadingRequest(false);
      }
    };

    fetchRequest();
  }, [id]);

  const handleMarkVerified = async () => {
    if (!id || !request) return;
    try {
      setUpdating(true);
      await update(ref(firebaseRtdb, `users/${id}`), {
        ekycStatus: "VERIFIED",
        kycStatus: "VERIFIED",
        canTransact: true,
      });
      setRequest((prev) => (prev ? { ...prev, status: "verified" } : prev));
      toast.success("Đã đánh dấu hồ sơ eKYC là ĐÃ XÁC THỰC.");
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái eKYC:", error);
      toast.error("Không cập nhật được trạng thái eKYC.");
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!id || !request) return;
    try {
      setUpdating(true);
      await update(ref(firebaseRtdb, `users/${id}`), {
        ekycStatus: "REJECTED",
        kycStatus: "REJECTED",
        canTransact: false,
      });
      setRequest((prev) => (prev ? { ...prev, status: "rejected" } : prev));
      toast.success("Đã đánh dấu hồ sơ eKYC là TỪ CHỐI / CẦN BỔ SUNG.");
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái eKYC:", error);
      toast.error("Không cập nhật được trạng thái eKYC.");
    } finally {
      setUpdating(false);
    }
  };

  if (loadingRequest) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          Đang tải hồ sơ eKYC...
        </p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <p className="text-lg font-semibold">Không tìm thấy hồ sơ eKYC</p>
          <p className="text-sm text-muted-foreground">
            Hồ sơ có thể đã được xử lý hoặc mã hồ sơ không hợp lệ.
          </p>
          <Button onClick={() => navigate("/officer/ekyc")}>
            Quay về danh sách eKYC
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header kiểu mới */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* bên trái: tiêu đề + back */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold flex items-center gap-1">
              Hồ sơ eKYC khách hàng
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
            </p>
            <button
              type="button"
              onClick={() => navigate("/officer/ekyc")}
              className="inline-flex items-center gap-2 text-xs text-emerald-100 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay về danh sách eKYC
            </button>
          </div>

          {/* bên phải: thông tin nhân viên */}
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

      <main className="px-4 mt-4 max-w-4xl mx-auto space-y-4">
        {/* 1. Trạng thái eKYC + thông tin cơ bản */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Trạng thái eKYC</span>
              <Badge className="text-xs px-3 py-1 rounded-full bg-emerald-600 text-white">
                {statusLabel[request.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold">{request.fullName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <IdCard className="h-4 w-4" />
                <span>Mã khách hàng (CIF): {request.cif || "Chưa có"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <IdCard className="h-4 w-4" />
                <span>CCCD: {request.nationalId || "Chưa cập nhật"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                <span>Số điện thoại: {request.phone || "Chưa cập nhật"}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Nhân viên cần đối chiếu thông tin CCCD và khuôn mặt của khách
                hàng trước khi xác nhận <b>Đã xác thực</b>.
              </p>
              <p>
                Sau khi duyệt, tài khoản khách hàng sẽ được kích hoạt để sử
                dụng các chức năng của ứng dụng ngân hàng số (CIF đã được cấp,
                chỉ bật/tắt giao dịch dựa vào trạng thái eKYC).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 2. Ảnh CCCD & khuôn mặt */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Ảnh CCCD &amp; khuôn mặt
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4 text-xs">
            {/* CCCD mặt trước */}
            <div className="space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <IdCard className="h-4 w-4 text-emerald-600" />
                CCCD mặt trước
              </p>
              {request.frontIdUrl ? (
                <div className="aspect-video rounded-lg border overflow-hidden bg-slate-100">
                  <img
                    src={request.frontIdUrl}
                    alt="Ảnh CCCD mặt trước"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg border bg-slate-100 flex items-center justify-center text-[11px] text-muted-foreground">
                  Ảnh CCCD mặt trước
                </div>
              )}
            </div>

            {/* CCCD mặt sau */}
            <div className="space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <IdCard className="h-4 w-4 text-emerald-600" />
                CCCD mặt sau
              </p>
              {request.backIdUrl ? (
                <div className="aspect-video rounded-lg border overflow-hidden bg-slate-100">
                  <img
                    src={request.backIdUrl}
                    alt="Ảnh CCCD mặt sau"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg border bg-slate-100 flex items-center justify-center text-[11px] text-muted-foreground">
                  Ảnh CCCD mặt sau
                </div>
              )}
            </div>

            {/* Ảnh khuôn mặt */}
            <div className="space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-emerald-600" />
                Ảnh khuôn mặt
              </p>
              {request.selfieUrl ? (
                <div className="aspect-video rounded-lg border overflow-hidden bg-slate-100">
                  <img
                    src={request.selfieUrl}
                    alt="Ảnh khuôn mặt khách hàng"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg border bg-slate-100 flex items-center justify-center text-[11px] text-muted-foreground">
                  Ảnh khuôn mặt khách hàng
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. Hành động duyệt hồ sơ */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="text-xs"
            disabled={updating}
            onClick={handleReject}
          >
            Từ chối / Bổ sung
          </Button>
          <Button
            className="text-xs"
            disabled={updating}
            onClick={handleMarkVerified}
          >
            Đã xác thực
          </Button>
        </div>
      </main>
    </div>
  );
};

export default OfficerEKYCDetailPage;
