// src/pages/TransferReceipt.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Download, Share2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

type TransferFlow = "account" | "card" | "self" | "international";

type TransferResultState = {
  flow: TransferFlow;
  // amount: số tiền hiển thị chính trên màn (VND đối với các luồng hiện tại)
  amount: string;
  content?: string;
  time?: string;
  fee?: string;
  transactionId?: string;
  source: {
    label: string;
    number: string;
  };
  destination: {
    label: string;
    number: string;
    bank?: string;
  };
  // Dùng riêng cho chuyển tiền quốc tế (hiển thị thêm số tiền gốc)
  originalAmount?: string; // VD: "10,000"
  originalCurrency?: string; // VD: "USD"
};

const TransferReceipt = () => {
  const navigate = useNavigate();
  const location = useLocation() as {
    state?: { result?: TransferResultState };
  };

  const now = new Date();
  const defaultResult: TransferResultState = {
    flow: "account",
    amount: "500.000",
    content: "Chuyển tiền",
    time: now.toLocaleString("vi-VN"),
    fee: "0 đ",
    transactionId: "GD-DEMO-0001",
    source: {
      label: "Tài khoản thanh toán VND",
      number: "1234 5678 9001",
    },
    destination: {
      label: "Nguyễn Thị B",
      number: "1234567890",
      bank: "Vietcombank",
    },
  };

  const data = location.state?.result ?? defaultResult;

  const flowLabel =
    data.flow === "self"
      ? "Chuyển nội bộ"
      : data.flow === "card"
      ? "Chuyển tới thẻ"
      : data.flow === "international"
      ? "Chuyển tiền quốc tế"
      : "Chuyển tới tài khoản khác";

  const timeText = data.time ?? now.toLocaleString("vi-VN");
  const txId = data.transactionId ?? "GD-" + now.getTime();
  const feeText = data.fee ?? "0 đ";

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
            onClick={() => navigate("/transfer", { replace: true })}
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

            {data.originalAmount && data.originalCurrency && (
              <p className="text-xs text-muted-foreground mt-1">
                {data.originalAmount} {data.originalCurrency}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-2">{flowLabel}</p>
          </div>

          {/* Thông tin chi tiết */}
          <div className="space-y-4 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loại giao dịch</span>
              <span className="font-medium text-foreground">{flowLabel}</span>
            </div>

            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Nguồn tiền</span>
              <div className="text-right">
                <p className="font-medium">{data.source.label}</p>
                <p className="text-xs text-muted-foreground">
                  {data.source.number}
                </p>
              </div>
            </div>

            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">
                {data.flow === "self" ? "Tài khoản đích" : "Người nhận"}
              </span>
              <div className="text-right">
                <p className="font-medium">{data.destination.label}</p>
                <p className="text-xs text-muted-foreground">
                  {data.destination.number}
                  {data.destination.bank ? ` • ${data.destination.bank}` : ""}
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Thời gian</span>
              <span className="font-medium text-foreground">{timeText}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Mã giao dịch</span>
              <span className="font-medium text-foreground">{txId}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Phí giao dịch</span>
              <span className="font-medium text-foreground">{feeText}</span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Nội dung</span>
              <span className="font-medium text-foreground text-right max-w-[60%]">
                {data.content || "Không có nội dung"}
              </span>
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

export default TransferReceipt;
