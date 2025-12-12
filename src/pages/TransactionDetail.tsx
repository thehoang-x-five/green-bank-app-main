import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Download, Share2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

const TransactionDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const transaction = location.state?.transaction || {
    type: "out",
    title: "Chuyển tiền đến Nguyễn Thị B",
    amount: "-500,000",
    date: "Hôm nay, 14:30",
    balance: "125,430,000",
  };

  const handleDownload = () => {
    toast.success("Đã tải xuống biên lai giao dịch");
  };

  const handleShare = () => {
    toast.success("Đang chia sẻ biên lai");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-primary-foreground">
            Chi tiết giao dịch
          </h1>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center">
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-6 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="font-semibold text-success">
              Giao dịch thành công
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4 pb-6">
        <Card className="p-6">
          {/* Amount */}
          <div className="text-center py-6 border-b">
            <p className="text-sm text-muted-foreground mb-2">
              Số tiền giao dịch
            </p>
            <h2
              className={`text-4xl font-bold ${
                transaction.type === "in" ? "text-success" : "text-destructive"
              }`}
            >
              {transaction.amount} VND
            </h2>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4 py-6">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loại giao dịch</span>
              <span className="font-medium text-foreground">
                {transaction.type === "in" ? "Nhận tiền" : "Chuyển tiền"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Người gửi/nhận</span>
              <span className="font-medium text-foreground text-right">
                {transaction.title.replace(
                  /^(Chuyển tiền đến|Nhận tiền từ|Thanh toán tại) /,
                  ""
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Thời gian</span>
              <span className="font-medium text-foreground">
                {transaction.date}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Mã giao dịch</span>
              <span className="font-medium text-foreground">
                GD20241117143045
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Số dư sau GD</span>
              <span className="font-medium text-foreground">
                {transaction.balance} VND
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Nội dung</span>
              <span className="font-medium text-foreground text-right max-w-[60%]">
                Chuyển tiền
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Tải biên lai
            </Button>
            <Button onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Chia sẻ
            </Button>
          </div>
        </Card>

        {/* Done Button */}
        <Button
          className="w-full mt-4"
          onClick={() => navigate("/notifications")}
        >
          Xong
        </Button>
      </div>
    </div>
  );
};

export default TransactionDetail;
