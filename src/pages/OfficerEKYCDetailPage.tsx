// src/pages/OfficerEKYCDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ShieldCheck,
  IdCard,
  User as UserIcon,
  Smartphone,
  Mail,
  Calendar,
  MapPin,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { onAuthStateChanged } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { toast } from "sonner";
import type { AppUserProfile } from "@/services/authService";

/** ===== Types ===== */

type EKYCStatus = "pending" | "needMoreInfo" | "verified" | "rejected";
type Gender = "male" | "female" | "other";

// Raw trong DB
type RawUserInDb = AppUserProfile & {
  cif?: string;
  cifCode?: string;

  nationalId?: string;
  cccd?: string;
  idNumber?: string;
  national_id?: string;

  phone?: string;
  phoneNumber?: string;

  dob?: string;
  gender?: string;

  idIssueDate?: string;
  placeOfIssue?: string;
  idIssuePlace?: string;

  permanentAddress?: string;
  contactAddress?: string;

  ekycStatus?: string;
  kycStatus?: string;
  ekyc_status?: string; // một số code cũ
  canTransact?: boolean;

  // ✅ ẢNH eKYC
  frontIdUrl?: string | null;
  backIdUrl?: string | null;
  selfieUrl?: string | null;
};

interface EKYCRequestDetail {
  uid: string;

  // thông tin cơ bản
  fullName: string;
  cif: string;
  nationalId: string;
  phone: string;
  email: string;

  // định danh mở rộng
  dob: string; // yyyy-mm-dd
  gender: Gender;
  idIssueDate: string; // yyyy-mm-dd
  idIssuePlace: string;

  permanentAddress: string;
  contactAddress: string;

  // trạng thái
  status: EKYCStatus;

  // ảnh
  frontIdUrl?: string | null;
  backIdUrl?: string | null;
  selfieUrl?: string | null;
}

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

const normalizeGender = (value?: string): Gender => {
  if (!value) return "other";
  const v = value.toString().toLowerCase().trim();
  if (v === "male" || v === "nam" || v === "m" || v === "1") return "male";
  if (v === "female" || v === "nu" || v === "nữ" || v === "f" || v === "0")
    return "female";
  return "other";
};

const genderLabel: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

const formatDateDisplay = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

/** ===== Page ===== */

type PreviewImageKey = "front" | "back" | "selfie";

interface PreviewState {
  open: boolean;
  title: string;
  url: string;
  key: PreviewImageKey;
}

const OfficerEKYCDetailPage = () => {
  const navigate = useNavigate();

  // ✅ Lấy param linh hoạt
  const params = useParams();
  const typedParams = params as Record<string, string | undefined>;
  const customerId =
    typedParams.id ??
    typedParams.uid ??
    typedParams.customerId ??
    (Object.values(typedParams)[0] ?? "");

  // ======= STAFF (HEADER) =======
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

  // ======= CUSTOMER EKYC REQUEST =======
  const [request, setRequest] = useState<EKYCRequestDetail | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [updating, setUpdating] = useState(false);

  // ======= IMAGE PREVIEW DIALOG =======
  const [preview, setPreview] = useState<PreviewState>({
    open: false,
    title: "",
    url: "",
    key: "front",
  });

  const openPreview = (key: PreviewImageKey) => {
    if (!request) return;

    const map: Record<
      PreviewImageKey,
      { title: string; url: string | null | undefined }
    > = {
      front: { title: "CCCD mặt trước", url: request.frontIdUrl },
      back: { title: "CCCD mặt sau", url: request.backIdUrl },
      selfie: { title: "Ảnh khuôn mặt", url: request.selfieUrl },
    };

    const item = map[key];
    if (!item.url) {
      toast.error("Không có ảnh để xem.");
      return;
    }

    setPreview({
      open: true,
      title: item.title,
      url: item.url,
      key,
    });
  };

  useEffect(() => {
    const fetchRequest = async () => {
      if (!customerId) {
        setLoadingRequest(false);
        setRequest(null);
        return;
      }

      try {
        setLoadingRequest(true);
        const snap = await get(ref(firebaseRtdb, `users/${customerId}`));
        if (!snap.exists()) {
          setRequest(null);
          return;
        }

        const raw = snap.val() as RawUserInDb;

        // chỉ cho CUSTOMER
        if (raw.role && raw.role !== "CUSTOMER") {
          setRequest(null);
          return;
        }

        const fullName = (raw.username || "").trim() || "(Chưa có tên)";
        const cif = raw.cif || raw.cifCode || "";

        const nationalId =
          raw.nationalId || raw.cccd || raw.idNumber || raw.national_id || "";

        const phone = raw.phone || raw.phoneNumber || "";
        const email = raw.email || "";

        const dob = raw.dob || "";
        const gender = normalizeGender(raw.gender);

        const idIssueDate = raw.idIssueDate || "";
        const idIssuePlace = raw.placeOfIssue || raw.idIssuePlace || "";

        const permanentAddress = raw.permanentAddress || "";
        const contactAddress = raw.contactAddress || "";

        const status = mapRawStatus(
          raw.ekycStatus || raw.kycStatus || raw.ekyc_status
        );

        const frontIdUrl = raw.frontIdUrl ?? null;
        const backIdUrl = raw.backIdUrl ?? null;
        const selfieUrl = raw.selfieUrl ?? null;

        setRequest({
          uid: customerId,
          cif,
          fullName,
          nationalId,
          phone,
          email,
          dob,
          gender,
          idIssueDate,
          idIssuePlace,
          permanentAddress,
          contactAddress,
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
  }, [customerId]);

  const badgeClass = useMemo(() => {
    if (!request) return "bg-emerald-600 text-white";
    if (request.status === "verified") return "bg-emerald-600 text-white";
    if (request.status === "rejected") return "bg-red-600 text-white";
    if (request.status === "needMoreInfo") return "bg-amber-600 text-white";
    return "bg-emerald-600 text-white";
  }, [request]);

  const handleMarkVerified = async () => {
    if (!customerId || !request) return;
    try {
      setUpdating(true);
      await update(ref(firebaseRtdb, `users/${customerId}`), {
        ekycStatus: "VERIFIED",
        kycStatus: "VERIFIED",
        ekyc_status: "VERIFIED",
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
    if (!customerId || !request) return;
    try {
      setUpdating(true);
      await update(ref(firebaseRtdb, `users/${customerId}`), {
        ekycStatus: "REJECTED",
        kycStatus: "REJECTED",
        ekyc_status: "REJECTED",
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
        <p className="text-sm text-muted-foreground">Đang tải hồ sơ eKYC...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <p className="text-lg font-semibold">Không tìm thấy hồ sơ eKYC</p>
          <p className="text-sm text-muted-foreground">
            Hồ sơ có thể đã được xử lý hoặc mã khách hàng không hợp lệ.
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
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
        {/* ✅ 1 CARD DUY NHẤT: trạng thái + toàn bộ info định danh */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Thông tin eKYC khách hàng</span>
              <Badge className={`text-xs px-3 py-1 rounded-full ${badgeClass}`}>
                {statusLabel[request.status]}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 text-sm">
            {/* CỤM 1: Thông tin cơ bản */}
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

              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>Email: {request.email || "Chưa cập nhật"}</span>
              </div>
            </div>

            {/* CỤM 2: Thông tin CCCD */}
            <div className="pt-2 border-t">
              <p className="font-semibold mb-2">Thông tin CCCD</p>

              <div className="space-y-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Ngày sinh:{" "}
                    {request.dob ? formatDateDisplay(request.dob) : "Chưa cập nhật"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span>Giới tính: {genderLabel[request.gender]}</span>
                </div>

                <div className="flex items-center gap-2">
                  <IdCard className="h-4 w-4" />
                  <span>
                    Ngày cấp CCCD:{" "}
                    {request.idIssueDate
                      ? formatDateDisplay(request.idIssueDate)
                      : "Chưa cập nhật"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Nơi cấp CCCD: {request.idIssuePlace || "Chưa cập nhật"}</span>
                </div>
              </div>
            </div>

            {/* CỤM 3: Địa chỉ */}
            <div className="pt-2 border-t">
              <p className="font-semibold mb-2">Địa chỉ</p>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Địa chỉ thường trú</p>
                  <div className="rounded-lg border bg-white px-3 py-2 text-xs text-muted-foreground min-h-[44px]">
                    {request.permanentAddress || "Chưa cập nhật"}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Địa chỉ liên hệ / tạm trú</p>
                  <div className="rounded-lg border bg-white px-3 py-2 text-xs text-muted-foreground min-h-[44px]">
                    {request.contactAddress || "Chưa cập nhật"}
                  </div>
                </div>
              </div>
            </div>

            {/* NOTE nghiệp vụ */}
            <div className="text-xs text-muted-foreground bg-muted rounded-md p-3">
              Nhân viên cần đối chiếu thông tin CCCD và ảnh khuôn mặt khách hàng trước khi xác nhận{" "}
              <b>Đã xác thực</b>. Sau khi duyệt, hệ thống sẽ bật/tắt quyền giao dịch dựa vào trạng thái eKYC.
            </div>
          </CardContent>
        </Card>

        {/* Ảnh CCCD & khuôn mặt */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Ảnh CCCD &amp; khuôn mặt</CardTitle>
          </CardHeader>

          <CardContent className="grid md:grid-cols-3 gap-4 text-xs">
            {/* CCCD mặt trước */}
            <div className="space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <IdCard className="h-4 w-4 text-emerald-600" />
                CCCD mặt trước
              </p>

              {request.frontIdUrl ? (
                <button
                  type="button"
                  onClick={() => openPreview("front")}
                  className="w-full text-left"
                  aria-label="Xem ảnh CCCD mặt trước"
                >
                  <div className="aspect-video rounded-lg border overflow-hidden bg-slate-100">
                    <img
                      src={request.frontIdUrl}
                      alt="Ảnh CCCD mặt trước"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Nhấn để phóng to
                  </p>
                </button>
              ) : (
                <div className="aspect-video rounded-lg border bg-slate-100 flex items-center justify-center text-[11px] text-muted-foreground">
                  Chưa có ảnh CCCD mặt trước
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
                <button
                  type="button"
                  onClick={() => openPreview("back")}
                  className="w-full text-left"
                  aria-label="Xem ảnh CCCD mặt sau"
                >
                  <div className="aspect-video rounded-lg border overflow-hidden bg-slate-100">
                    <img
                      src={request.backIdUrl}
                      alt="Ảnh CCCD mặt sau"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Nhấn để phóng to
                  </p>
                </button>
              ) : (
                <div className="aspect-video rounded-lg border bg-slate-100 flex items-center justify-center text-[11px] text-muted-foreground">
                  Chưa có ảnh CCCD mặt sau
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
                <button
                  type="button"
                  onClick={() => openPreview("selfie")}
                  className="w-full text-left"
                  aria-label="Xem ảnh khuôn mặt"
                >
                  <div className="aspect-video rounded-lg border overflow-hidden bg-slate-100">
                    <img
                      src={request.selfieUrl}
                      alt="Ảnh khuôn mặt khách hàng"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Nhấn để phóng to
                  </p>
                </button>
              ) : (
                <div className="aspect-video rounded-lg border bg-slate-100 flex items-center justify-center text-[11px] text-muted-foreground">
                  Chưa có ảnh khuôn mặt
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="text-xs"
            disabled={updating}
            onClick={handleReject}
          >
            Từ chối / Bổ sung
          </Button>
          <Button className="text-xs" disabled={updating} onClick={handleMarkVerified}>
            Đã xác thực
          </Button>
        </div>
      </main>

      {/* Dialog phóng to ảnh */}
      <Dialog
        open={preview.open}
        onOpenChange={(open) => setPreview((p) => ({ ...p, open }))}
      >
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <div className="p-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-base">
                {preview.title}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-3 sm:p-4">
            <div className="w-full max-h-[72vh] overflow-auto bg-black/5 rounded-lg">
              {/* ảnh to: dùng object-contain để xem rõ, không bị crop */}
              <img
                src={preview.url}
                alt={preview.title}
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="p-2 text-[11px] text-muted-foreground">
              Mẹo: có thể cuộn/zoom của trình duyệt để xem chi tiết hơn.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfficerEKYCDetailPage;
