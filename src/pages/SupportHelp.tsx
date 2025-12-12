// src/pages/SupportHelp.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  PhoneCall,
  MessageCircle,
  Mail,
  MapPin,
  AlertCircle,
  Info,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SupportHelp = () => {
  const navigate = useNavigate();

  const handleCallHotline = () => {
    // Thực tế: mở tel:1900xxxx
    toast.success("Đang kết nối tổng đài 1900 1234 (demo)");
  };

  const handleSendEmail = () => {
    // Thực tế: mở mailto:
    toast.info("Mở ứng dụng email tới support@vietbank.com (demo)");
  };

  const handleLiveChat = () => {
    toast.info("Tính năng chat với CSKH đang được mô phỏng (demo)");
  };

  const handleReportIssue = () => {
    toast.info("Màn hình báo lỗi giao dịch sẽ được triển khai (demo)");
  };

  const handleFindBranch = () => {
    toast.info("Mở bản đồ tìm chi nhánh / ATM gần bạn (demo)");
  };

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
            Trợ giúp & Hỗ trợ
          </h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {/* Kênh liên hệ nhanh */}
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold mb-1">Liên hệ nhanh</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleCallHotline}
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <PhoneCall className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Gọi tổng đài</p>
                <p className="text-xs text-muted-foreground">
                  1900 1234 (24/7)
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleLiveChat}
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Chat với VietBank</p>
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ trực tuyến
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleSendEmail}
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Gửi email hỗ trợ</p>
                <p className="text-xs text-muted-foreground">
                  support@vietbank.com
                </p>
              </div>
            </Button>
          </div>
        </Card>

        {/* Các vấn đề thường gặp / FAQ */}
        <Card className="p-5 space-y-2">
          <h2 className="text-sm font-semibold mb-2">Câu hỏi thường gặp</h2>

          {[
            "Quên mật khẩu đăng nhập / khóa tài khoản",
            "Không nhận được OTP khi giao dịch",
            "Khi nào tiền chuyển liên ngân hàng được ghi có?",
            "Xử lý khi nghi ngờ lộ thông tin / mất điện thoại",
          ].map((title, idx) => (
            <button
              key={idx}
              className="w-full flex items-center justify-between py-2 text-sm hover:bg-muted/60 px-2 rounded-md transition-colors"
              onClick={() =>
                toast.info(`Màn chi tiết FAQ "${title}" đang được mô phỏng`)
              }
            >
              <div className="flex items-center gap-2 text-left">
                <Info className="w-4 h-4 text-primary" />
                <span>{title}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </Card>

        {/* Hỗ trợ giao dịch & khiếu nại */}
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold mb-1">
            Hỗ trợ giao dịch & khiếu nại
          </h2>

          <p className="text-xs text-muted-foreground">
            Nếu anh phát hiện giao dịch bất thường, vui lòng báo ngay để ngân
            hàng kiểm tra và hỗ trợ kịp thời.
          </p>

          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={handleReportIssue}
          >
            <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-destructive" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">
                Báo lỗi / tra soát giao dịch
              </p>
              <p className="text-xs text-muted-foreground">
                Giao dịch chuyển tiền, thanh toán, nạp tiền...
              </p>
            </div>
          </Button>
        </Card>

        {/* Chi nhánh & thông tin ứng dụng */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold mb-1">
            Chi nhánh, ATM & thông tin ứng dụng
          </h2>

          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={handleFindBranch}
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">Tìm chi nhánh / ATM gần bạn</p>
              <p className="text-xs text-muted-foreground">
                Xem vị trí trên bản đồ và giờ làm việc (demo)
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </Button>

          <div className="flex items-center justify-between pt-2 border-t border-muted/60">
            <div>
              <p className="text-xs text-muted-foreground">
                Phiên bản ứng dụng
              </p>
              <p className="text-sm font-medium">Việt Bank v1.0.0</p>
            </div>
            <button
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() =>
                toast.info("Điều khoản sử dụng & chính sách bảo mật (demo)")
              }
            >
              Điều khoản &amp; Chính sách
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SupportHelp;
