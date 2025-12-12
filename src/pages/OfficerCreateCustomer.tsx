// src/pages/OfficerCreateCustomer.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  ArrowLeft,
  ShieldCheck,
  User,
  Phone,
  Mail,
  IdCard,
  MapPin,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  nationalId: string;
  dob: string;
  address: string;
  username: string;
  password: string;
  confirmPassword: string;
  accountNumber: string;
  pin: string;
};

const OfficerCreateCustomer = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    fullName: "",
    phone: "",
    email: "",
    nationalId: "",
    dob: "",
    address: "",
    username: "",
    password: "",
    confirmPassword: "",
    accountNumber: "",
    pin: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {}
  );

  const normalizeEmail = (email: string) => {
    const trimmed = email.trim();
    if (trimmed && !trimmed.includes("@")) {
      return `${trimmed}@gmail.com`;
    }
    return trimmed;
  };

  // ==== VALIDATE ====
  const validate = (data: FormState) => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!data.fullName.trim()) {
      newErrors.fullName = "Vui lòng nhập họ và tên khách hàng";
    }

    if (!data.phone.trim()) {
      newErrors.phone = "Vui lòng nhập số điện thoại";
    } else if (!/^\d+$/.test(data.phone.trim())) {
      newErrors.phone = "Số điện thoại chỉ được chứa chữ số";
    } else if (data.phone.trim().length !== 10) {
      newErrors.phone = "Số điện thoại phải gồm đúng 10 chữ số";
    }

    if (!data.email.trim()) {
      newErrors.email = "Vui lòng nhập email";
    } else {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(data.email.trim())) {
        newErrors.email = "Email không đúng định dạng";
      }
    }

    if (!data.nationalId.trim()) {
      newErrors.nationalId = "Vui lòng nhập số CCCD/CMND";
    } else if (!/^\d+$/.test(data.nationalId.trim())) {
      newErrors.nationalId = "Số CCCD/CMND chỉ được chứa chữ số";
    } else if (data.nationalId.trim().length < 9) {
      newErrors.nationalId = "Số CCCD/CMND không hợp lệ";
    }

    if (!data.address.trim()) {
      newErrors.address = "Vui lòng nhập địa chỉ liên hệ";
    }

    if (!data.username.trim()) {
      newErrors.username = "Vui lòng nhập tên đăng nhập";
    }

    if (!data.password) {
      newErrors.password = "Vui lòng nhập mật khẩu đăng nhập";
    } else if (data.password.length < 8) {
      newErrors.password = "Mật khẩu phải có ít nhất 8 ký tự";
    }

    if (!data.confirmPassword) {
      newErrors.confirmPassword = "Vui lòng nhập lại mật khẩu";
    } else if (data.password !== data.confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu và Nhập lại mật khẩu không trùng khớp";
    }

    if (!data.accountNumber.trim()) {
      newErrors.accountNumber = "Vui lòng nhập số tài khoản thanh toán";
    } else if (!/^\d+$/.test(data.accountNumber.trim())) {
      newErrors.accountNumber = "Số tài khoản chỉ được chứa chữ số";
    } else if (
      data.accountNumber.trim().length < 10 ||
      data.accountNumber.trim().length > 12
    ) {
      newErrors.accountNumber = "Số tài khoản nên gồm từ 10 đến 12 chữ số";
    }

    if (!data.pin.trim()) {
      newErrors.pin = "Vui lòng nhập mã PIN giao dịch";
    } else if (!/^\d+$/.test(data.pin.trim())) {
      newErrors.pin = "PIN chỉ được chứa chữ số";
    } else if (data.pin.trim().length !== 4) {
      newErrors.pin = "PIN phải gồm đúng 4 chữ số";
    }

    return newErrors;
  };

  const handleChange =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        field === "email" ? normalizeEmail(e.target.value) : e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validated = {
      ...form,
      email: normalizeEmail(form.email),
    };

    const newErrors = validate(validated);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast.error("Vui lòng kiểm tra lại thông tin khách hàng");
      return;
    }

    // DEMO: log dữ liệu ra console, sau này gửi lên backend/Firebase
    console.log("Officer create new customer (demo):", {
      ...validated,
      accountType: "CHECKING_DEFAULT",
    });

    toast.success(
      "Tạo tài khoản khách hàng thành công (demo). Đã mở 1 tài khoản thanh toán mặc định."
    );

    // Quay về dashboard nhân viên
    navigate("/officer");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/90 via-primary/70 to-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg shadow-2xl border-0 bg-background/95 backdrop-blur">
        {/* HEADER */}
        <div className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => navigate("/officer")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay về màn hình nhân viên
            </button>
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">Officer</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Tạo tài khoản mới cho khách hàng cá nhân
            </p>
            <h1 className="text-lg font-semibold text-primary">
              Mở tài khoản & tài khoản thanh toán mặc định
            </h1>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
          {/* THÔNG TIN CƠ BẢN */}
          <div className="rounded-lg bg-muted/60 p-3 space-y-3">
            <p className="text-xs font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Thông tin cá nhân
            </p>

            <div className="space-y-2">
              <Label>Họ và tên</Label>
              <Input
                placeholder="VD: Nguyễn Văn A"
                value={form.fullName}
                onChange={handleChange("fullName")}
                className={
                  errors.fullName
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Số điện thoại</Label>
                <Input
                  placeholder="VD: 09xx xxx xxx"
                  value={form.phone}
                  onChange={handleChange("phone")}
                  className={
                    errors.phone
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  placeholder="VD: khachhang@gmail.com"
                  value={form.email}
                  onChange={handleChange("email")}
                  className={
                    errors.email
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CCCD / CMND</Label>
                <Input
                  placeholder="VD: 0790xxxxxxx"
                  value={form.nationalId}
                  onChange={handleChange("nationalId")}
                  className={
                    errors.nationalId
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                {errors.nationalId && (
                  <p className="text-xs text-destructive">
                    {errors.nationalId}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Ngày sinh (tuỳ chọn)</Label>
                <Input
                  type="date"
                  value={form.dob}
                  onChange={handleChange("dob")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Địa chỉ liên hệ</Label>
              <Input
                placeholder="VD: Quận 7, TP. Hồ Chí Minh"
                value={form.address}
                onChange={handleChange("address")}
                className={
                  errors.address
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {errors.address && (
                <p className="text-xs text-destructive">{errors.address}</p>
              )}
            </div>
          </div>

          {/* THÔNG TIN ĐĂNG NHẬP & TÀI KHOẢN THANH TOÁN */}
          <div className="rounded-lg bg-muted/40 p-3 space-y-3">
            <p className="text-xs font-semibold flex items-center gap-2">
              <IdCard className="h-4 w-4 text-primary" />
              Tài khoản đăng nhập & tài khoản thanh toán
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tên đăng nhập</Label>
                <Input
                  placeholder="Đặt username"
                  value={form.username}
                  onChange={handleChange("username")}
                  className={
                    errors.username
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                {errors.username && (
                  <p className="text-xs text-destructive">{errors.username}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Số tài khoản thanh toán</Label>
                <Input
                  placeholder="VD: 1234567890 (10–12 số)"
                  maxLength={12}
                  value={form.accountNumber}
                  onChange={handleChange("accountNumber")}
                  className={
                    errors.accountNumber
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                {errors.accountNumber && (
                  <p className="text-xs text-destructive">
                    {errors.accountNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mật khẩu đăng nhập</Label>
                <Input
                  type="password"
                  placeholder="≥ 8 ký tự, có hoa, thường, số"
                  value={form.password}
                  onChange={handleChange("password")}
                  className={
                    errors.password
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Nhập lại mật khẩu</Label>
                <Input
                  type="password"
                  placeholder="Nhập lại đúng mật khẩu ở trên"
                  value={form.confirmPassword}
                  onChange={handleChange("confirmPassword")}
                  className={
                    errors.confirmPassword
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mã PIN giao dịch (4 số)</Label>
              <Input
                type="password"
                maxLength={4}
                placeholder="4 số bảo mật"
                value={form.pin}
                onChange={handleChange("pin")}
                className={
                  errors.pin
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {errors.pin && (
                <p className="text-xs text-destructive">{errors.pin}</p>
              )}
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs flex items-start gap-2">
              <CreditCard className="h-4 w-4 text-primary mt-0.5" />
              <span>
                Sau khi tạo, khách hàng sẽ có <b>1 tài khoản thanh toán mặc định</b>{" "}
                với số tài khoản ở trên. Các tài khoản tiết kiệm / thế chấp có
                thể được mở thêm sau.
              </span>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/officer")}
            >
              Huỷ
            </Button>
            <Button type="submit" className="flex-1">
              Tạo tài khoản khách hàng
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default OfficerCreateCustomer;
