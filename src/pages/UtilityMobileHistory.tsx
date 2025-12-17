// src/pages/UtilityMobileHistory.tsx
import { Card } from "@/components/ui/card";
import { ArrowLeft, Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

type HistoryTab = "data" | "phone";
type HistoryFrom = "home" | "mobilePhone";

export default function UtilityMobileHistory() {
  const navigate = useNavigate();
  const location = useLocation() as {
    state?: {
      tab?: HistoryTab;
      from?: HistoryFrom;
      backTo?: string; // ✅ /utilities/data hoặc /utilities/phone
      backState?: any; // ✅ giữ {from:"mobilePhone"} nếu cần
    };
  };

  const tab: HistoryTab = location.state?.tab ?? "data";
  const from: HistoryFrom = location.state?.from ?? "home";
  const backTo =
    location.state?.backTo ??
    (tab === "data" ? "/utilities/data" : "/utilities/phone");
  const backState = location.state?.backState;

  const handleBack = () => {
    // ✅ [PATCH] quay về đúng màn Data/Phone đang đứng trước đó
    navigate(backTo, { state: backState });
  };

  const title =
    tab === "data"
      ? "Lịch sử giao dịch Data"
      : "Lịch sử giao dịch Nạp điện thoại";

  return (
    <div className="min-h-screen bg-background">
      {/* Top header */}
      <div className="bg-background border-b px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-full p-2 hover:bg-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold flex-1 text-center -ml-10">
          Data 4G/Nạp tiền
        </h1>
      </div>

      {/* Breadcrumb row */}
      <div className="px-4 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Home className="w-4 h-4" />
          <span>Data &amp; Topup</span>
          <span>›</span>
          <span className="text-foreground font-medium">{title}</span>
        </div>

        <button
          type="button"
          onClick={handleBack}
          className="text-emerald-700 font-bold"
        >
          Quay lại
        </button>
      </div>

      {/* Empty state (giữ giống ảnh) */}
      <div className="px-4 pt-10">
        <Card className="p-10 flex flex-col items-center justify-center text-center rounded-2xl">
          <div className="w-40 h-24 rounded-2xl bg-muted mb-6" />
          <p className="text-lg font-medium">Không có đơn hàng nào</p>
          <p className="text-sm text-muted-foreground mt-2">
            Khi anh thực hiện giao dịch, lịch sử sẽ hiển thị tại đây (demo).
          </p>
        </Card>
      </div>
    </div>
  );
}
