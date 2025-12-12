// src/pages/UtilityReceipt.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Download, Share2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

type UtilityFlow = "bill" | "phone" | "data" | "flight" | "movie" | "hotel";

type UtilityResultState = {
  flow: UtilityFlow;
  amount: string;
  title: string;
  time: string;
  fee: string;
  transactionId: string;
  details: {
    label: string;
    value: string;
  }[];
};

const flowLabelMap: Record<UtilityFlow, string> = {
  bill: "Thanh toán hóa đơn",
  phone: "Nạp tiền điện thoại",
  data: "Nạp data 4G",
  flight: "Mua vé máy bay",
  movie: "Mua vé xem phim",
  hotel: "Đặt phòng khách sạn",
};

const UtilityReceipt = () => {
  const navigate = useNavigate();
  const location = useLocation() as {
    state?: { result?: UtilityResultState };
  };

  const now = new Date();
  const defaultResult: UtilityResultState = {
    flow: "bill",
    amount: "350.000",
    title: "Thanh toán hóa đơn nước",
    time: now.toLocaleString("vi-VN"),
    fee: "0 đ",
    transactionId: "HD-DEMO-0001",
    details: [
      { label: "Loại hóa đơn", value: "Nước" },
      { label: "Mã khách hàng", value: "KH001" },
    ],
  };

  const data = location.state?.result ?? defaultResult;
  const flowLabel = flowLabelMap[data.flow];

  const handleDownload = () => {
    toast.success("Đã tải xuống biên lai giao dịch (demo)");
  };

  const handleShare = () => {
    toast.success("Đang chia sẻ biên lai giao dịch (demo)");
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-primary-foreground">
            Chi tiết giao dịch
          </h1>
        </div>

        <div className="flex justify-center">
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-6 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="font-semibold text-success">
              Giao dịch thành công
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 -mt-6 space-y-4">
        <Card className="p-6">
          {/* Số tiền */}
          <div className="mb-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">
              Số tiền giao dịch
            </p>
            <p className="text-3xl font-bold text-foreground">
              {data.amount} VND
            </p>
            <p className="text-xs text-muted-foreground mt-2">{data.title}</p>
          </div>

          {/* Nội dung */}
          <div className="space-y-4 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loại dịch vụ</span>
              <span className="font-medium text-foreground">{flowLabel}</span>
            </div>

            {data.details.map((item) => (
              <div key={item.label} className="flex justify-between gap-6">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium text-foreground text-right">
                  {item.value}
                </span>
              </div>
            ))}

            <div className="flex justify-between">
              <span className="text-muted-foreground">Thời gian</span>
              <span className="font-medium text-foreground">{data.time}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Mã giao dịch</span>
              <span className="font-medium text-foreground">
                {data.transactionId}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Phí giao dịch</span>
              <span className="font-medium text-foreground">{data.fee}</span>
            </div>
          </div>
        </Card>

        {/* Nút hành động (mới) */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Tải biên lai
          </Button>
          <Button onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Chia sẻ
          </Button>
        </div>

        <Button className="w-full" onClick={() => navigate("/home")}>
          Xong
        </Button>
      </div>
    </div>
  );
};

export default UtilityReceipt;
