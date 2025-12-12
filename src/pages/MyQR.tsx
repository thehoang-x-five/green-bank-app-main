import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const MyQR = () => {
  const navigate = useNavigate();

  const handleDownload = () => {
    toast.success("Đã lưu mã QR về thiết bị");
  };

  const handleShare = () => {
    toast.success("Đang chia sẻ mã QR");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-primary-foreground">Mã QR của tôi</h1>
        </div>
      </div>

      <div className="px-6 -mt-4 pb-6">
        <Card className="p-8">
          <div className="text-center space-y-6">
            {/* User Info */}
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Nguyễn Văn A</h2>
              <p className="text-sm text-muted-foreground">Việt Bank</p>
              <p className="text-sm text-muted-foreground">1234567890</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white p-6 rounded-2xl shadow-lg">
                <div className="w-64 h-64 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl flex items-center justify-center">
                  {/* This would be an actual QR code in production */}
                  <div className="grid grid-cols-8 gap-1">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-sm ${
                          Math.random() > 0.5 ? "bg-primary" : "bg-transparent"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <p className="text-sm text-muted-foreground">
              Người khác có thể quét mã này để chuyển tiền cho bạn
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Lưu ảnh
              </Button>
              <Button onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Chia sẻ
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MyQR;
