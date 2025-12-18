// src/pages/ProfileInfo.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  IdCard,
  Calendar,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import type { AppUserProfile } from "@/services/authService";

// ✅ Dialog preview ảnh
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ✅ FIX: hỗ trợ nhiều kiểu lưu gender trong DB (MALE/FEMALE/OTHER, male/female/other, nam/nữ, 0/1...)
const formatGender = (g?: unknown) => {
  if (g === null || g === undefined) return "Chưa cập nhật";

  const raw = String(g).trim();
  if (!raw) return "Chưa cập nhật";

  const lower = raw.toLowerCase();

  // Nam
  if (
    raw === "MALE" ||
    lower === "male" ||
    lower === "nam" ||
    lower === "m" ||
    lower === "1"
  ) {
    return "Nam";
  }

  // Nữ
  if (
    raw === "FEMALE" ||
    lower === "female" ||
    lower === "nu" ||
    lower === "nữ" ||
    lower === "f" ||
    lower === "0"
  ) {
    return "Nữ";
  }

  // Khác
  if (
    raw === "OTHER" ||
    lower === "other" ||
    lower === "khac" ||
    lower === "khác" ||
    lower === "o"
  ) {
    return "Khác";
  }

  return "Chưa cập nhật";
};

const ProfileInfo = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ state preview ảnh phóng to
  const [imagePreview, setImagePreview] = useState<{
    open: boolean;
    src: string;
    title: string;
  }>({
    open: false,
    src: "",
    title: "",
  });

  const openPreview = (src: string, title: string) => {
    if (!src) return;
    setImagePreview({ open: true, src, title });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      try {
        const snap = await get(ref(firebaseRtdb, `users/${user.uid}`));
        if (snap.exists()) {
          setProfile(snap.val() as AppUserProfile);
        } else {
          toast.error("Không tìm thấy thông tin khách hàng.");
        }
      } catch (err) {
        console.error("Lỗi tải ProfileInfo:", err);
        toast.error("Không tải được thông tin cá nhân.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [navigate]);

  const handleEditInfo = () => {
    navigate("/profile/info/edit");
  };

  const handleUpdateDocuments = () => {
    navigate("/profile/documents/update");
  };

  const fullName = profile?.username ?? "Khách hàng";
  const email = profile?.email ?? "Chưa cập nhật";
  const phone = profile?.phone ?? "Chưa cập nhật";
  const gender = formatGender(profile?.gender);
  const dob = profile?.dob ?? "Chưa cập nhật";
  const nationalId = profile?.nationalId ?? "Chưa cập nhật";
  const idIssueDate = profile?.idIssueDate ?? "Chưa cập nhật";
  const placeOfIssue = profile?.placeOfIssue ?? "Chưa cập nhật";
  const permanentAddress = profile?.permanentAddress ?? "Chưa cập nhật";
  const contactAddress = profile?.contactAddress ?? "Chưa cập nhật";
  const cif = profile?.cif ?? "Chưa có";

  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "NA";

  const showImages =
    !!profile?.frontIdUrl || !!profile?.backIdUrl || !!profile?.selfieUrl;

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
            Thông tin cá nhân
          </h1>
          <div className="w-10" /> {/* spacer */}
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {/* Thông tin chung */}
        <Card className="p-5">
          {loading ? (
            <div className="animate-pulse flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xl font-bold">
                {initials}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  {fullName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Khách hàng cá nhân
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Mã khách hàng (CIF): {cif || "Chưa có"}
                </p>
              </div>
              <Badge
                variant="outline"
                className="flex items-center gap-1 text-[11px]"
              >
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                {profile?.ekycStatus === "VERIFIED"
                  ? "Đã xác thực eKYC"
                  : "Chưa xác thực eKYC"}
              </Badge>
            </div>
          )}
        </Card>

        {/* Thông tin liên hệ */}
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold mb-1">Thông tin liên hệ</h3>

          <div className="flex items-start justify-between text-sm">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Email</span>
            </div>
            <span className="text-right text-foreground">{email}</span>
          </div>

          <div className="flex items-start justify-between text-sm">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Số điện thoại</span>
            </div>
            <span className="text-right text-foreground">{phone}</span>
          </div>

          <div className="flex items-start justify-between text-sm">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Giới tính</span>
            </div>
            <span className="text-right text-foreground">{gender}</span>
          </div>

          <div className="flex items-start justify-between text-sm">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Ngày sinh</span>
            </div>
            <span className="text-right text-foreground">{dob}</span>
          </div>
        </Card>

        {/* Giấy tờ định danh */}
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold mb-1">Giấy tờ định danh</h3>

          <div className="flex items-start justify-between text-sm">
            <div className="flex items-center gap-3">
              <IdCard className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Số CCCD / CMND</span>
            </div>
            <span className="text-right text-foreground">{nationalId}</span>
          </div>

          <div className="flex items-start justify-between text-sm">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Ngày cấp</span>
            </div>
            <span className="text-right text-foreground">{idIssueDate}</span>
          </div>

          <div className="flex items-start justify-between text-sm">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Nơi cấp</span>
            </div>
            <span className="text-right text-foreground">{placeOfIssue}</span>
          </div>

          {/* Ảnh eKYC */}
          {showImages && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {profile?.frontIdUrl && (
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-muted-foreground">
                    CCCD mặt trước
                  </p>

                  {/* ✅ Click để phóng to */}
                  <button
                    type="button"
                    onClick={() =>
                      openPreview(profile.frontIdUrl!, "CCCD mặt trước")
                    }
                    className="border rounded-lg overflow-hidden bg-muted flex items-center justify-center w-full cursor-zoom-in"
                    title="Bấm để phóng to"
                  >
                    <img
                      src={profile.frontIdUrl}
                      alt="CCCD mặt trước"
                      className="max-h-40 w-full object-cover hover:opacity-90 transition-opacity"
                    />
                  </button>
                </div>
              )}

              {profile?.backIdUrl && (
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-muted-foreground">
                    CCCD mặt sau
                  </p>

                  {/* ✅ Click để phóng to */}
                  <button
                    type="button"
                    onClick={() =>
                      openPreview(profile.backIdUrl!, "CCCD mặt sau")
                    }
                    className="border rounded-lg overflow-hidden bg-muted flex items-center justify-center w-full cursor-zoom-in"
                    title="Bấm để phóng to"
                  >
                    <img
                      src={profile.backIdUrl}
                      alt="CCCD mặt sau"
                      className="max-h-40 w-full object-cover hover:opacity-90 transition-opacity"
                    />
                  </button>
                </div>
              )}

              {profile?.selfieUrl && (
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-muted-foreground">
                    Ảnh khuôn mặt
                  </p>

                  {/* ✅ Click để phóng to */}
                  <button
                    type="button"
                    onClick={() =>
                      openPreview(profile.selfieUrl!, "Ảnh khuôn mặt")
                    }
                    className="border rounded-lg overflow-hidden bg-muted flex items-center justify-center w-full cursor-zoom-in"
                    title="Bấm để phóng to"
                  >
                    <img
                      src={profile.selfieUrl}
                      alt="Ảnh khuôn mặt"
                      className="max-h-40 w-full object-cover hover:opacity-90 transition-opacity"
                    />
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Địa chỉ */}
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold mb-1">Địa chỉ</h3>

          <div className="flex items-start gap-3 text-sm">
            <MapPin className="w-4 h-4 text-primary mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-muted-foreground text-xs">
                Địa chỉ thường trú
              </p>
              <p className="text-foreground">{permanentAddress}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-sm">
            <MapPin className="w-4 h-4 text-primary mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-muted-foreground text-xs">
                Địa chỉ liên hệ / tạm trú
              </p>
              <p className="text-foreground">{contactAddress}</p>
            </div>
          </div>
        </Card>

        {/* Nút thao tác */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 mb-4">
          <Button className="w-full" onClick={handleEditInfo}>
            Cập nhật / Chỉnh sửa thông tin
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleUpdateDocuments}
          >
            Cập nhật giấy tờ định danh
          </Button>
        </div>
      </div>

      {/* ✅ Dialog phóng to ảnh */}
      <Dialog
        open={imagePreview.open}
        onOpenChange={(open) =>
          setImagePreview((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl p-0 bg-black border border-white/10">
          <div className="p-4 border-b border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white text-sm sm:text-base">
                {imagePreview.title}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-3 sm:p-4 flex items-center justify-center">
            <img
              src={imagePreview.src}
              alt={imagePreview.title}
              className="max-h-[75vh] max-w-[92vw] object-contain rounded-lg"
            />
          </div>

          <div className="p-3 sm:p-4 pt-0 flex justify-end">
            <Button
              variant="outline"
              className="text-white border-white/30 hover:bg-white/10"
              onClick={() =>
                setImagePreview((prev) => ({ ...prev, open: false }))
              }
            >
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileInfo;
