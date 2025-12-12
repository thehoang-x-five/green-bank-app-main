// src/pages/DevSeedOfficers.tsx
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AppUserProfile, EkycStatus } from "@/services/authService";

async function createOfficer(
  email: string,
  password: string,
  fullName: string
) {
  // 1. Tạo user trong Firebase Auth
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  const user = cred.user;

  const profile: AppUserProfile = {
    uid: user.uid,
    username: fullName,
    email,
    role: "OFFICER",
    status: "ACTIVE",

    // Nhân viên thì coi như đã xác thực eKYC, không được giao dịch
    ekycStatus: "VERIFIED" as EkycStatus,
    canTransact: false,

    createdAt: Date.now(),

    phone: null,
    gender: null,
    dob: null,
    nationalId: null,
    idIssueDate: null,
    placeOfIssue: null,
    permanentAddress: null,
    contactAddress: null,
    cif: null,
  };

  // 2. Ghi profile vào Realtime DB
  await set(ref(firebaseRtdb, `users/${user.uid}`), profile);

  return profile;
}

export default function DevSeedOfficersPage() {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    try {
      setIsSeeding(true);

      // Anh chỉnh email / password / tên theo ý
      const officer1 = await createOfficer(
        "officer1@vietbank.com",
        "123456",
        "Hoàng Công Tài Thế"
      );

      // Nếu muốn thêm 1 nhân viên nữa thì gọi thêm:
      // const officer2 = await createOfficer(
      //   "officer2@vietbank.com",
      //   "Officer123!",
      //   "Trần Thị Nhân Viên 2"
      // );

      console.log("OFFICER CREATED:", officer1);
      toast.success("Đã tạo tài khoản nhân viên demo thành công!");
    } catch (err) {
      console.error("Seed officer error:", err);
      toast.error("Tạo nhân viên demo thất bại, kiểm tra console.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <Card className="max-w-md w-full p-6 space-y-4">
        <h1 className="text-lg font-bold">Dev • Seed OFFICER</h1>
        <p className="text-sm text-muted-foreground">
          Trang này chỉ dùng cho lập trình viên để tạo nhanh tài khoản nhân viên
          demo trong Firebase (Auth + Realtime DB).
          Sau khi chạy thành công, hãy xoá route này đi.
        </p>
        <Button
          className="w-full"
          onClick={handleSeed}
          disabled={isSeeding}
        >
          {isSeeding ? "Đang tạo..." : "Tạo tài khoản nhân viên demo"}
        </Button>
        <p className="text-xs text-amber-600">
          Email: <b>officer1@vietbank.com</b> • Mật khẩu: <b>Officer123!</b>
        </p>
      </Card>
    </div>
  );
}
