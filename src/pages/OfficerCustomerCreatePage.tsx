// src/pages/OfficerCustomerCreatePage.tsx
import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const OfficerCustomerCreatePage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
    dob: "",
    address: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Sau này gọi Firebase để tạo khách hàng
    console.log("Create customer:", form);

    // Giả lập delay
    setTimeout(() => {
      setIsSubmitting(false);
      // Tạm thời quay lại danh sách khách hàng
      navigate("/officer/customers");
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 rounded-b-3xl shadow-md">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-emerald-100 mb-1">Nhân viên ngân hàng</p>
          <h1 className="text-xl font-semibold">Tạo khách hàng mới</h1>
          <p className="text-emerald-100 text-xs mt-1">
            Nhập thông tin cơ bản để mở hồ sơ cho khách hàng
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-24">
        <Card className="border-0 shadow-sm bg-white">
          <form className="p-4 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Họ và tên</Label>
              <Input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                required
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Email</Label>
              <Input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="nguyenvana@example.com"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Số điện thoại</Label>
              <Input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                placeholder="0123 456 789"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">CCCD / CMND</Label>
              <Input
                name="idNumber"
                value={form.idNumber}
                onChange={handleChange}
                required
                placeholder="012345678901"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Ngày sinh</Label>
              <Input
                type="date"
                name="dob"
                value={form.dob}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Địa chỉ</Label>
              <Textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={3}
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              />
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang lưu..." : "Lưu khách hàng"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default OfficerCustomerCreatePage;
