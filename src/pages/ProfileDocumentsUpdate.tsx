// src/pages/ProfileDocumentsUpdate.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, IdCard, Calendar, MapPin, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, ChangeEvent, FormEvent } from "react";
import { toast } from "sonner";

import { onAuthStateChanged } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { uploadEkycImage } from "@/services/ekycService";
import type { AppUserProfile, EkycStatus } from "@/services/authService";

type CaptureKind = "frontId" | "backId" | "selfie";

type PreviewModal = {
  open: boolean;
  title: string;
  src: string;
};

const ProfileDocumentsUpdate = () => {
  const navigate = useNavigate();

  // Thông tin user hiện tại
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form dữ liệu CCCD
  const [formData, setFormData] = useState({
    idNumber: "",
    issueDate: "",
    issuePlace: "",
  });

  // File ảnh
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  // Preview local (blob url) hoặc url đã có
  const [frontPreview, setFrontPreview] = useState<string>("");
  const [backPreview, setBackPreview] = useState<string>("");
  const [selfiePreview, setSelfiePreview] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);

  // input hidden (giống màn đăng ký)
  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);

  // Modal xem ảnh to
  const [previewModal, setPreviewModal] = useState<PreviewModal>({
    open: false,
    title: "",
    src: "",
  });

  const openPreview = (title: string, src: string) => {
    setPreviewModal({ open: true, title, src });
  };

  const closePreview = () => {
    setPreviewModal((p) => ({ ...p, open: false }));
  };

  // ===== Lấy thông tin user + fill form khi mở trang =====
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      try {
        const snap = await get(ref(firebaseRtdb, `users/${user.uid}`));
        if (snap.exists()) {
          const raw = snap.val() as AppUserProfile;
          setProfile(raw);

          setFormData({
            idNumber: (raw.nationalId ?? "").toString(),
            issueDate: (raw.idIssueDate ?? "").toString(),
            issuePlace: (raw.placeOfIssue ?? "").toString(),
          });

          // nếu trước đó user đã có url ảnh trong profile
          const rawAny = raw as AppUserProfile & {
            frontIdUrl?: string | null;
            backIdUrl?: string | null;
            selfieUrl?: string | null;
          };
          setFrontPreview(rawAny.frontIdUrl ?? "");
          setBackPreview(rawAny.backIdUrl ?? "");
          setSelfiePreview(rawAny.selfieUrl ?? "");
        } else {
          toast.error("Không tìm thấy hồ sơ khách hàng.");
        }
      } catch (error) {
        console.error("Lỗi tải hồ sơ eKYC:", error);
        toast.error("Không tải được thông tin giấy tờ định danh.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // cleanup blob urls khi unmount
  useEffect(() => {
    return () => {
      if (frontPreview.startsWith("blob:")) URL.revokeObjectURL(frontPreview);
      if (backPreview.startsWith("blob:")) URL.revokeObjectURL(backPreview);
      if (selfiePreview.startsWith("blob:")) URL.revokeObjectURL(selfiePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange =
    (field: keyof typeof formData) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleCapture = (kind: CaptureKind) => {
    if (kind === "frontId") frontInputRef.current?.click();
    if (kind === "backId") backInputRef.current?.click();
    if (kind === "selfie") selfieInputRef.current?.click();
  };

  const handleFrontFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    setFrontFile(file);

    setFrontPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return prev;
    });

    setFrontPreview(URL.createObjectURL(file));
  };

  const handleBackFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    setBackFile(file);

    setBackPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return prev;
    });

    setBackPreview(URL.createObjectURL(file));
  };

  const handleSelfieFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    setSelfieFile(file);

    setSelfiePreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return prev;
    });

    setSelfiePreview(URL.createObjectURL(file));
  };

  const canSubmit = useMemo(() => {
    // yêu cầu: đủ CCCD info + ít nhất 1 ảnh (front/back/selfie)
    return (
      !!formData.idNumber.trim() &&
      !!formData.issueDate.trim() &&
      !!formData.issuePlace.trim() &&
      (!!frontFile || !!backFile || !!selfieFile)
    );
  }, [
    formData.idNumber,
    formData.issueDate,
    formData.issuePlace,
    frontFile,
    backFile,
    selfieFile,
  ]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!profile) {
      toast.error("Không xác định được hồ sơ khách hàng.");
      return;
    }

    if (!formData.idNumber || !formData.issueDate || !formData.issuePlace) {
      toast.error("Vui lòng nhập đầy đủ Số CCCD/CMND, Ngày cấp và Nơi cấp");
      return;
    }

    if (!frontFile && !backFile && !selfieFile) {
      toast.error("Vui lòng chụp ít nhất 1 ảnh (mặt trước / mặt sau / khuôn mặt).");
      return;
    }

    const currentUser = firebaseAuth.currentUser;
    const email = currentUser?.email || profile.email;
    if (!email) {
      toast.error("Không xác định được email tài khoản để lưu eKYC.");
      return;
    }

    try {
      setSubmitting(true);

      // ===== Upload ảnh mới (nếu có) =====
      let frontUrl: string | undefined;
      let backUrl: string | undefined;
      let selfieUrl: string | undefined;

      if (frontFile) {
        frontUrl = await uploadEkycImage(email, "frontId", frontFile);
      }
      if (backFile) {
        backUrl = await uploadEkycImage(email, "backId", backFile);
      }
      if (selfieFile) {
        // key selfie giống lúc đăng ký
        selfieUrl = await uploadEkycImage(email, "selfie", selfieFile);
      }

      // ===== Cập nhật lại user profile: CCCD + trạng thái eKYC + URL ẢNH =====
      const userRef = ref(firebaseRtdb, `users/${profile.uid}`);
      const newStatus: EkycStatus = "PENDING";

      const payload: Record<string, unknown> = {
        nationalId: formData.idNumber.trim(),
        cccd: formData.idNumber.trim(),
        idNumber: formData.idNumber.trim(),
        idIssueDate: formData.issueDate.trim(),
        placeOfIssue: formData.issuePlace.trim(),
        idIssuePlace: formData.issuePlace.trim(),

        ekycStatus: newStatus,
        kycStatus: newStatus,
        ekyc_status: newStatus,

        canTransact: false, // cập nhật giấy tờ => tạm khóa giao dịch, chờ duyệt lại
      };

      // ✅ Cực quan trọng: update URL ảnh lên users để bên nhân viên đọc đúng ảnh mới
      if (frontUrl) payload.frontIdUrl = frontUrl;
      if (backUrl) payload.backIdUrl = backUrl;
      if (selfieUrl) payload.selfieUrl = selfieUrl;

      await update(userRef, payload);

      toast.success(
        "Đã gửi yêu cầu cập nhật giấy tờ định danh. Tài khoản sẽ được xét duyệt lại eKYC."
      );
      navigate("/profile/info");
    } catch (error) {
      console.error("Submit eKYC update error:", error);
      toast.error("Gửi yêu cầu cập nhật giấy tờ thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/profile/info");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Đang tải thông tin...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/profile/info")}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-primary-foreground">
            Cập nhật giấy tờ định danh
          </h1>
          <div className="w-10" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 -mt-4 space-y-4">
        {/* Thông tin giấy tờ */}
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold mb-1">Thông tin giấy tờ</h3>

          <div className="space-y-1">
            <Label htmlFor="idNumber">Số CCCD / CMND</Label>
            <div className="flex items-center gap-2">
              <IdCard className="w-4 h-4 text-primary" />
              <Input
                id="idNumber"
                value={formData.idNumber}
                onChange={handleChange("idNumber")}
                placeholder="Nhập số CCCD / CMND"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="issueDate">Ngày cấp</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={handleChange("issueDate")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="issuePlace">Nơi cấp</Label>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <Input
                  id="issuePlace"
                  value={formData.issuePlace}
                  onChange={handleChange("issuePlace")}
                  placeholder="Nhập nơi cấp"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Ảnh giấy tờ (khung ảnh + chụp camera) */}
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold mb-1">Ảnh giấy tờ</h3>
          <p className="text-xs text-muted-foreground">
            Bấm vào khung để chụp ảnh. Sau khi chụp, bấm vào ảnh để xem phóng to.
            Có thể chụp lại nếu ảnh bị sai/mờ.
          </p>

          {/* CCCD trước/sau */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Mặt trước */}
            <div className="space-y-2">
              <Label>Ảnh mặt trước</Label>

              <Button
                type="button"
                variant="outline"
                className="h-40 w-full flex items-center justify-center p-0 overflow-hidden"
                onClick={() => {
                  if (frontPreview) {
                    openPreview("CCCD mặt trước", frontPreview);
                    return;
                  }
                  handleCapture("frontId");
                }}
                disabled={submitting}
              >
                {frontPreview ? (
                  <img
                    src={frontPreview}
                    alt="CCCD mặt trước"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <IdCard className="h-5 w-5" />
                    <span className="text-xs font-medium">Chụp CCCD mặt trước</span>
                  </div>
                )}
              </Button>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => handleCapture("frontId")}
                  disabled={submitting}
                >
                  {frontPreview ? "Chụp lại" : "Mở camera"}
                </Button>
              </div>
            </div>

            {/* Mặt sau */}
            <div className="space-y-2">
              <Label>Ảnh mặt sau</Label>

              <Button
                type="button"
                variant="outline"
                className="h-40 w-full flex items-center justify-center p-0 overflow-hidden"
                onClick={() => {
                  if (backPreview) {
                    openPreview("CCCD mặt sau", backPreview);
                    return;
                  }
                  handleCapture("backId");
                }}
                disabled={submitting}
              >
                {backPreview ? (
                  <img
                    src={backPreview}
                    alt="CCCD mặt sau"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <IdCard className="h-5 w-5" />
                    <span className="text-xs font-medium">Chụp CCCD mặt sau</span>
                  </div>
                )}
              </Button>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => handleCapture("backId")}
                  disabled={submitting}
                >
                  {backPreview ? "Chụp lại" : "Mở camera"}
                </Button>
              </div>
            </div>
          </div>

          {/* Khuôn mặt (khung đứng như đăng ký) */}
          <div className="space-y-2">
            <Label>Ảnh khuôn mặt</Label>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="p-0 border border-dashed border-muted-foreground/60 rounded-xl bg-muted/40 hover:bg-muted/70
                  w-32 h-44 flex items-center justify-center overflow-hidden"
                onClick={() => {
                  if (selfiePreview) {
                    openPreview("Ảnh khuôn mặt", selfiePreview);
                    return;
                  }
                  handleCapture("selfie");
                }}
                disabled={submitting}
              >
                {selfiePreview ? (
                  <img
                    src={selfiePreview}
                    alt="Ảnh khuôn mặt"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UserIcon className="h-5 w-5" />
                    <span className="text-xs font-medium">Chụp khuôn mặt</span>
                  </div>
                )}
              </Button>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={() => handleCapture("selfie")}
                disabled={submitting}
              >
                {selfiePreview ? "Chụp lại" : "Mở camera"}
              </Button>
            </div>
          </div>

          {/* input file ẩn */}
          <input
            ref={frontInputRef}
            capture="environment"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFrontFileChange}
          />
          <input
            ref={backInputRef}
            capture="environment"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBackFileChange}
          />
          <input
            ref={selfieInputRef}
            capture="user"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSelfieFileChange}
          />
        </Card>

        {/* Nút thao tác */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCancel}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !canSubmit}
          >
            {submitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu cập nhật"}
          </Button>
        </div>
      </form>

      {/* Dialog xem ảnh phóng to */}
      <Dialog
        open={previewModal.open}
        onOpenChange={(open) => !open && closePreview()}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewModal.title}</DialogTitle>
          </DialogHeader>

          <div className="w-full rounded-lg overflow-hidden border bg-slate-50">
            <img
              src={previewModal.src}
              alt={previewModal.title}
              className="w-full h-auto object-contain"
            />
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={closePreview}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileDocumentsUpdate;
