import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Download, Share2, Ticket } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import type { UtilityFlow, UtilityResultState } from "./utilities/utilityTypes";

type ReceiptSource = "home" | "mobilePhone";

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
    state?: { result?: UtilityResultState; source?: ReceiptSource };
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
      { label: "Loại hóa đơn", value: "Nước sinh hoạt" },
      { label: "Mã khách hàng", value: "KH001" },
    ],
  };

  const data = location.state?.result ?? defaultResult;
  const flowLabel = flowLabelMap[data.flow];
  const source: ReceiptSource = location.state?.source ?? "home";

  const handleDownload = () => {
    toast.success("Đã tải biên lai giao dịch (demo)");
  };

  const handleShare = () => {
    toast.success("Đang chia sẻ biên lai (demo)");
  };

  const handleBack = () => {
    if (data.flow === "phone" || data.flow === "data") {
      if (source === "mobilePhone") {
        navigate("/utilities/mobilePhone");
      } else {
        navigate("/home");
      }
      return;
    }
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background pb-16">
      <header className="sticky top-0 z-30 border-b bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <button
            onClick={handleBack}
            className="rounded-full border border-white/30 bg-white/10 p-2 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="text-xs opacity-80">Tiện ích – Thanh toán dịch vụ</p>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold">Biên lai giao dịch</h1>
              <Badge
                variant="secondary"
                className="border-white/30 bg-white/15 text-white"
              >
                {flowLabel}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 -mt-6 space-y-4">
        <Card className="relative overflow-hidden border-none bg-white/95 shadow-lg">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600" />
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Số tiền</p>
                <p className="text-3xl font-bold text-foreground">
                  {data.amount} VND
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{data.title}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-semibold">Thành công</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-muted-foreground">Loại dịch vụ</p>
                <p className="font-semibold text-foreground">{flowLabel}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-muted-foreground">Mã giao dịch</p>
                <p className="font-semibold text-foreground">
                  {data.transactionId}
                </p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-muted-foreground">Thời gian</p>
                <p className="font-semibold text-foreground">{data.time}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-muted-foreground">Phí giao dịch</p>
                <p className="font-semibold text-foreground">{data.fee}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Chi tiết giao dịch
              </p>
              <p className="text-xs text-muted-foreground">
                Thông tin đã được xác thực và lưu trên hệ thống
              </p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            {data.details.map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="text-right font-medium text-foreground">
                  {item.value || "-"}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={handleDownload} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Tải biên lai
          </Button>
          <Button variant="outline" onClick={handleShare} className="w-full">
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
