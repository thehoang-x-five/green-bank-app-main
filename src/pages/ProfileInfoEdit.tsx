// src/pages/ProfileInfoEdit.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Phone, Calendar, User, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useEffect,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import { toast } from "sonner";

import { onAuthStateChanged } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import type { AppUserProfile } from "@/services/authService";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
  permanentAddress: string;
  contactAddress: string;
};

const ProfileInfoEdit = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormState>({
    fullName: "",
    email: "",
    phone: "",
    gender: "",
    dob: "",
    permanentAddress: "",
    contactAddress: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load thông tin hiện tại từ Realtime DB
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
          const profile = snap.val() as AppUserProfile;

          setFormData({
            fullName: profile.username ?? "",
            email: profile.email ?? user.email ?? "",
            phone: profile.phone ?? "",
            gender: profile.gender ?? "",
            dob: profile.dob ?? "",
            permanentAddress: profile.permanentAddress ?? "",
            contactAddress: profile.contactAddress ?? "",
          });
        } else {
          // fallback tối thiểu
          setFormData({
            fullName: user.displayName ?? "",
            email: user.email ?? "",
            phone: "",
            gender: "",
            dob: "",
            permanentAddress: "",
            contactAddress: "",
          });
        }
      } catch (error) {
        console.error("Lỗi tải profile:", error);
        toast.error("Không tải được thông tin cá nhân.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleChange =
    (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const fullName = formData.fullName.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();

    if (!fullName || !email || !phone) {
      toast.error("Vui lòng nhập đầy đủ Họ tên, Email và Số điện thoại");
      return;
    }

    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      navigate("/login");
      return;
    }

    try {
      setSaving(true);

      const updates: Partial<AppUserProfile> = {
        username: fullName,
        email,
        phone,
        gender: formData.gender || null,
        dob: formData.dob || null,
        permanentAddress: formData.permanentAddress.trim() || null,
        contactAddress: formData.contactAddress.trim() || null,
      };

      await update(ref(firebaseRtdb, `users/${user.uid}`), updates);

      toast.success("Đã cập nhật thông tin cá nhân.");
      navigate("/profile/info");
    } catch (error) {
      console.error("Lỗi cập nhật thông tin cá nhân:", error);
      toast.error("Cập nhật thông tin thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/profile/info");
  };

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
            Cập nhật thông tin
          </h1>
          <div className="w-10" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 -mt-4 space-y-4">
        {/* Thông tin cơ bản */}
        <Card className="p-5 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="fullName">Họ và tên</Label>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={handleChange("fullName")}
                placeholder="Nhập họ và tên"
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="gender">Giới tính</Label>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <select
                  id="gender"
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      gender: e.target.value,
                    }))
                  }
                  disabled={loading || saving}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                >
                  <option value="">-- Chọn giới tính --</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dob">Ngày sinh</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <Input
                  id="dob"
                  type="date"
                  value={formData.dob}
                  onChange={handleChange("dob")}
                  disabled={loading || saving}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Thông tin liên hệ */}
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold mb-1">Thông tin liên hệ</h3>

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleChange("email")}
                placeholder="Nhập email"
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">Số điện thoại</Label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              <Input
                id="phone"
                value={formData.phone}
                onChange={handleChange("phone")}
                placeholder="Nhập số điện thoại"
                disabled={loading || saving}
              />
            </div>
          </div>
        </Card>

        {/* Địa chỉ */}
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold mb-1">Địa chỉ</h3>

          <div className="space-y-1">
            <Label htmlFor="permanentAddress">Địa chỉ thường trú</Label>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary mt-2" />
              <Input
                id="permanentAddress"
                value={formData.permanentAddress}
                onChange={handleChange("permanentAddress")}
                placeholder="Nhập địa chỉ thường trú"
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="contactAddress">Địa chỉ liên hệ / tạm trú</Label>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary mt-2" />
              <Input
                id="contactAddress"
                value={formData.contactAddress}
                onChange={handleChange("contactAddress")}
                placeholder="Nhập địa chỉ liên hệ / tạm trú"
                disabled={loading || saving}
              />
            </div>
          </div>
        </Card>

        {/* Nút thao tác */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 mb-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCancel}
            disabled={saving}
          >
            Hủy
          </Button>
          <Button type="submit" className="w-full" disabled={saving || loading}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProfileInfoEdit;
