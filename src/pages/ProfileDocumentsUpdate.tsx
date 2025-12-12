// src/pages/ProfileDocumentsUpdate.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  IdCard,
  Calendar,
  MapPin,
  Upload,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
} from "react";
import { toast } from "sonner";

import { onAuthStateChanged } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { uploadEkycImage, saveEkycInfo } from "@/services/ekycService";
import type { AppUserProfile, EkycStatus } from "@/services/authService";

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
    note: "",
  });

  // File & tên file ảnh
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontFileName, setFrontFileName] = useState<string | null>(null);
  const [backFileName, setBackFileName] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

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
            idNumber: raw.nationalId ?? "",
            issueDate: raw.idIssueDate ?? "",
            issuePlace: raw.placeOfIssue ?? "",
            note: "",
          });
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

  const handleChange =
    (field: keyof typeof formData) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleFrontFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFrontFile(file);
      setFrontFileName(file.name);
    }
  };

  const handleBackFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackFile(file);
      setBackFileName(file.name);
    }
  };

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

    if (!frontFile && !backFile) {
      toast.error("Vui lòng tải lên ít nhất 1 ảnh mặt trước hoặc mặt sau CCCD");
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

      if (frontFile) {
        frontUrl = await uploadEkycImage(email, "frontId", frontFile);
      }
      if (backFile) {
        backUrl = await uploadEkycImage(email, "backId", backFile);
      }

      // ===== Cập nhật lại user profile: CCCD + trạng thái eKYC =====
      const userRef = ref(firebaseRtdb, `users/${profile.uid}`);

      const newStatus: EkycStatus = "PENDING";

      await update(userRef, {
        nationalId: formData.idNumber.trim(),
        idIssueDate: formData.issueDate.trim(),
        placeOfIssue: formData.issuePlace.trim(),
        ekycStatus: newStatus,
        canTransact: false, // cập nhật giấy tờ => tạm khóa giao dịch, chờ duyệt lại
      });

      // ===== Ghi thêm log / metadata eKYC (tùy ý) =====
           // ===== Ghi thêm log / metadata eKYC cơ bản (giống lúc đăng ký) =====
      await saveEkycInfo(email, {
        fullName: profile.username,
        dob: profile.dob ?? "",
        gender: profile.gender ?? "",
        address: profile.permanentAddress ?? "",
        nationalId: formData.idNumber.trim(),
        idIssueDate: formData.issueDate.trim(),
        // không truyền idIssuePlace, note, front/backUrl... vì kiểu hàm chưa khai báo
      });


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

        {/* Ảnh giấy tờ */}
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold mb-1">Ảnh giấy tờ</h3>

          <div className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5" />
            <p>
              Vui lòng chụp rõ nét, không bị chói, đủ 4 góc giấy tờ. Ảnh mới sẽ
              thay thế ảnh cũ và được dùng để xét duyệt lại eKYC.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Mặt trước */}
            <div className="space-y-2">
              <Label>Ảnh mặt trước</Label>
              <label className="border border-dashed border-primary/40 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-primary/5 transition-colors">
                <div className="flex flex-col text-xs">
                  <span className="font-medium text-sm">
                    {frontFileName || "Chọn ảnh mặt trước CCCD / CMND"}
                  </span>
                  <span className="text-muted-foreground mt-1">
                    Định dạng: JPG, PNG • Tối đa 5MB
                  </span>
                </div>
                <Upload className="w-5 h-5 text-primary" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFrontFile}
                />
              </label>
            </div>

            {/* Mặt sau */}
            <div className="space-y-2">
              <Label>Ảnh mặt sau</Label>
              <label className="border border-dashed border-primary/40 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-primary/5 transition-colors">
                <div className="flex flex-col text-xs">
                  <span className="font-medium text-sm">
                    {backFileName || "Chọn ảnh mặt sau CCCD / CMND"}
                  </span>
                  <span className="text-muted-foreground mt-1">
                    Định dạng: JPG, PNG • Tối đa 5MB
                  </span>
                </div>
                <Upload className="w-5 h-5 text-primary" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBackFile}
                />
              </label>
            </div>
          </div>
        </Card>

        {/* Ghi chú bổ sung */}
        <Card className="p-5 space-y-2 mb-4">
          <Label htmlFor="note">Ghi chú (nếu có)</Label>
          <Textarea
            id="note"
            value={formData.note}
            onChange={handleChange("note")}
            placeholder="Ví dụ: Đổi từ CMND sang CCCD, cập nhật lại địa chỉ trên giấy tờ..."
            className="min-h-[80px]"
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
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu cập nhật"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProfileDocumentsUpdate;
