// src/pages/QRScanner.tsx
import { Button } from "@/components/ui/button";
import { X, Zap, QrCode, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const QRScanner = () => {
  const navigate = useNavigate();
  const [flashOn, setFlashOn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleFlash = () => {
    setFlashOn((prev) => !prev);
    toast.info(
      !flashOn ? "Đã bật đèn flash (mô phỏng)" : "Đã tắt đèn flash (mô phỏng)"
    );
  };

  const handleMyQR = () => {
    navigate("/my-qr");
  };

  const handleSelectImage = () => {
    if (fileInputRef.current) {
      // reset để lần sau chọn cùng 1 file vẫn nhận change
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const now = new Date();
    toast.success("Đã đọc mã QR từ ảnh (demo)");

    // Demo: dữ liệu đọc được từ mã QR
    const qrData = {
      bankName: "Vietcombank",
      bankCode: "VCB",
      accountNumber: "1234567890",
      accountName: "Nguyễn Thị B",
    };

    // Điều hướng sang chuyển tiền tới tài khoản với dữ liệu được điền sẵn
    navigate("/transfer/account", {
      state: {
        fromQR: true,
        scannedAt: now.toISOString(),
        bankName: qrData.bankName,
        bankCode: qrData.bankCode,
        accountNumber: qrData.accountNumber,
        accountName: qrData.accountName,
      },
    });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <button
          // QUAY LẠI TRANG TRƯỚC THAY VÌ LUÔN VỀ /home
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
          aria-label="Đóng"
        >
          <X size={22} />
        </button>

        <p className="text-sm font-medium">Quét mã QR</p>

        <button
          onClick={handleToggleFlash}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            flashOn ? "bg-amber-400 text-black" : "bg-white/15 text-white"
          }`}
          aria-label="Bật/tắt đèn flash"
        >
          <Zap size={20} />
        </button>
      </div>

      {/* Khu vực quét QR – chiếm phần giữa, căn đều đẹp */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
        {/* Khung quét chỉ có 4 góc, to hơn một chút */}
        <div className="relative w-64 h-64">
          {/* 4 góc khung – không có viền xung quanh */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Góc trên trái */}
            <div className="absolute left-0 top-0 h-10 w-10 border-l-4 border-t-4 border-emerald-400 rounded-tl-3xl" />
            {/* Góc trên phải */}
            <div className="absolute right-0 top-0 h-10 w-10 border-r-4 border-t-4 border-emerald-400 rounded-tr-3xl" />
            {/* Góc dưới trái */}
            <div className="absolute left-0 bottom-0 h-10 w-10 border-l-4 border-b-4 border-emerald-400 rounded-bl-3xl" />
            {/* Góc dưới phải */}
            <div className="absolute right-0 bottom-0 h-10 w-10 border-r-4 border-b-4 border-emerald-400 rounded-br-3xl" />
          </div>
        </div>

        {/* Hướng dẫn nằm dưới khung quét, canh giữa */}
        <p className="mt-4 text-xs text-center text-white/80 max-w-xs">
          Di chuyển mã QR đến trung tâm khung hình để quét
        </p>
      </div>

      {/* Thanh chức năng dưới cùng */}
      <div className="px-4 pb-20">
        <div className="flex rounded-2xl overflow-hidden border border-white/15 bg-white/5 backdrop-blur-sm">
          <Button
            variant="ghost"
            className="flex-1 rounded-none py-4 text-white hover:bg-white/10"
            onClick={handleMyQR}
          >
            <QrCode className="w-4 h-4 mr-2" />
            Mã QR của tôi
          </Button>

          <div className="w-px bg-white/15" />

          <Button
            variant="ghost"
            className="flex-1 rounded-none py-4 text-white hover:bg-white/10"
            onClick={handleSelectImage}
          >
            <Upload className="w-4 h-4 mr-2" />
            Tải ảnh QR
          </Button>
        </div>
      </div>

      {/* Input ẩn để chọn ảnh QR từ thư viện */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default QRScanner;
