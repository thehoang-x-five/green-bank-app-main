// src/pages/UtilityMobileHistory.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, CheckCircle2, Download, Share2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { fbAuth, fbRtdb } from "@/lib/firebase";
import { ref, query, orderByChild, equalTo, get } from "firebase/database";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

type HistoryTab = "data" | "phone";
type HistoryFrom = "home" | "mobilePhone";

interface Transaction {
  transactionId: string;
  type: string;
  amount: number;
  phoneNumber: string;
  telco: string;
  packName?: string;
  topupAmount?: number;
  createdAt: number;
  createdAtServer?: number;
  status: string;
  description: string;
  accountNumber?: string;
}

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Lỗi không xác định";
  }
};

const getTelcoLabel = (telco: string): string => {
  switch (telco?.toLowerCase()) {
    case "viettel":
      return "Viettel";
    case "vina":
    case "vinaphone":
      return "Vinaphone";
    case "mobi":
    case "mobifone":
      return "Mobifone";
    default:
      return telco || "Không xác định";
  }
};

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

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // ✅ vùng biên lai để chụp ảnh
  const receiptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadTransactions();
  }, [tab]);

  const loadTransactions = async () => {
    const user = fbAuth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const txnRef = ref(fbRtdb, "utilityTransactions");

      // ✅ Lọc theo type: DATA_PACK_PURCHASE cho tab data, PHONE_TOPUP cho tab phone
      const txnType = tab === "data" ? "DATA_PACK_PURCHASE" : "PHONE_TOPUP";

      console.log("🔍 Loading transactions for:", {
        userId: user.uid,
        tab,
        txnType,
      });

      // ✅ Lấy TẤT CẢ transactions (không filter bằng query)
      const snapshot = await get(txnRef);

      console.log("📊 Snapshot exists:", snapshot.exists());

      if (!snapshot.exists()) {
        console.log("⚠️ No transactions found for user");
        setTransactions([]);
        setLoading(false);
        return;
      }

      const txnList: Transaction[] = [];
      let totalCount = 0;
      let matchedCount = 0;

      snapshot.forEach((child) => {
        totalCount++;
        const data = child.val();

        console.log(`📝 Transaction ${totalCount}:`, {
          key: child.key,
          type: data.type,
          userId: data.userId,
          amount: data.amount,
          phoneNumber: data.phoneNumber,
        });

        // ✅ Lọc theo userId VÀ type
        if (data.userId === user.uid && data.type === txnType) {
          matchedCount++;
          txnList.push({
            transactionId: data.transactionId || child.key,
            type: data.type,
            amount: data.amount || 0,
            phoneNumber: data.phoneNumber || "",
            telco: data.telco || "",
            packName: data.packName,
            topupAmount: data.topupAmount,
            createdAt: data.createdAt || 0,
            createdAtServer: data.createdAtServer,
            status: data.status || "SUCCESS",
            description: data.description || "",
            accountNumber: data.accountNumber || "",
          });
        }
      });

      console.log(
        `✅ Found ${matchedCount} matching transactions out of ${totalCount} total`
      );

      // Sắp xếp theo thời gian mới nhất
      txnList.sort((a, b) => b.createdAt - a.createdAt);

      setTransactions(txnList);
    } catch (error) {
      console.error("❌ Error loading transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // ✅ [PATCH] quay về đúng màn Data/Phone đang đứng trước đó
    navigate(backTo, { state: backState });
  };

  const title =
    tab === "data"
      ? "Lịch sử giao dịch Data"
      : "Lịch sử giao dịch Nạp điện thoại";

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTimeFull = (timestamp: number): string => {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("vi-VN");
  };

  // ✅ chụp biên lai -> base64 png
  const captureReceiptPng = async (tx: Transaction) => {
    const el = receiptRef.current;
    if (!el) throw new Error("Không tìm thấy vùng biên lai để xuất ảnh.");

    const prevScrollY = window.scrollY;
    try {
      window.scrollTo(0, 0);

      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });

      const dataUrl = canvas.toDataURL("image/png", 1.0);
      const base64 = dataUrl.split(",")[1] ?? "";
      if (!base64) throw new Error("Không tạo được dữ liệu ảnh.");

      const safeTxId = (tx.transactionId || tx.transactionId).replace(
        /[^0-9A-Za-z_-]/g,
        "_"
      );
      const fileName = `VietBank_Receipt_${safeTxId}.png`;

      return { dataUrl, base64, fileName };
    } finally {
      window.scrollTo(0, prevScrollY);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!selectedTx) return;

    const loadingId = toast.loading("Đang tạo biên lai...");

    try {
      const { dataUrl, base64, fileName } = await captureReceiptPng(selectedTx);
      const platform = Capacitor.getPlatform();

      if (platform === "web") {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.dismiss(loadingId);
        toast.success("Đã tải xuống biên lai.");
        return;
      }

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });

      const savedUri = await Filesystem.getUri({
        directory: Directory.Documents,
        path: fileName,
      });

      toast.dismiss(loadingId);
      toast.success(`Đã lưu biên lai (Documents): ${savedUri.uri}`);
    } catch (err: unknown) {
      toast.dismiss(loadingId);
      toast.error(`Tải biên lai thất bại: ${getErrorMessage(err)}`);
    }
  };

  const handleShareReceipt = async () => {
    if (!selectedTx) return;

    const loadingId = toast.loading("Đang chuẩn bị chia sẻ...");

    try {
      const { dataUrl, base64, fileName } = await captureReceiptPng(selectedTx);
      const platform = Capacitor.getPlatform();

      const timeText = formatDateTimeFull(selectedTx.createdAt);

      if (platform === "web") {
        if (navigator.share) {
          await navigator.share({
            title: "Biên lai giao dịch VietBank",
            text: `Biên lai ${selectedTx.transactionId} • ${timeText}`,
          });
          toast.dismiss(loadingId);
          toast.success("Đã mở chia sẻ.");
          return;
        }

        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();

        toast.dismiss(loadingId);
        toast.success(
          "Trình duyệt không hỗ trợ chia sẻ, đã tải biên lai xuống."
        );
        return;
      }

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });

      const savedUri = await Filesystem.getUri({
        directory: Directory.Cache,
        path: fileName,
      });

      await Share.share({
        title: "Biên lai giao dịch VietBank",
        text: `Biên lai ${selectedTx.transactionId} • ${timeText}`,
        url: savedUri.uri,
        dialogTitle: "Chia sẻ biên lai",
      });

      toast.dismiss(loadingId);
      toast.success(`Đã mở chia sẻ biên lai. File: ${savedUri.uri}`);
    } catch (err: unknown) {
      toast.dismiss(loadingId);
      toast.error(`Chia sẻ thất bại: ${getErrorMessage(err)}`);
    }
  };

  // ✅ Transaction detail view (giống như trong Notifications)
  if (selectedTx) {
    const flowLabel =
      selectedTx.type === "DATA_PACK_PURCHASE"
        ? `Mua gói data: ${selectedTx.packName || "N/A"}`
        : "Nạp tiền điện thoại";
    const timeText = formatDateTimeFull(selectedTx.createdAt);
    const txId = selectedTx.transactionId;
    const feeText = "0 đ";

    const formattedAmount = new Intl.NumberFormat("vi-VN").format(
      Number(selectedTx.amount ?? 0)
    );

    return (
      <div className="min-h-screen bg-background pb-16">
        {/* vùng chụp ảnh */}
        <div
          ref={receiptRef}
          className="bg-gradient-to-br from-primary to-accent pb-10"
        >
          {/* Header */}
          <div className="p-6 pb-8">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setSelectedTx(null)}
                className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-primary-foreground">
                Chi tiết giao dịch
              </h1>
            </div>

            <div className="flex justify-center">
              <div className="bg-white/95 backdrop-blur-sm rounded-full px-6 py-3 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 -translate-y-[1px]" />
                <span className="font-semibold text-success leading-none">
                  Giao dịch thành công
                </span>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="px-4 -mt-6 pb-8">
            <Card className="p-6">
              <div className="mb-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Số tiền giao dịch
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {formattedAmount} VND
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {flowLabel}
                </p>
              </div>

              <div className="space-y-4 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loại giao dịch</span>
                  <span className="font-medium text-foreground">
                    {flowLabel}
                  </span>
                </div>

                {/* Nguồn tiền */}
                <div className="flex justify-between gap-6">
                  <span className="text-muted-foreground">Nguồn tiền</span>
                  <div className="text-right">
                    <p className="font-medium">Tài khoản thanh toán</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTx.accountNumber || "—"}
                    </p>
                  </div>
                </div>

                {/* Số điện thoại */}
                <div className="flex justify-between gap-6">
                  <span className="text-muted-foreground">Số điện thoại</span>
                  <div className="text-right">
                    <p className="font-medium">{selectedTx.phoneNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {getTelcoLabel(selectedTx.telco)}
                    </p>
                  </div>
                </div>

                {/* Gói data (chỉ hiện cho DATA_PACK_PURCHASE) */}
                {selectedTx.type === "DATA_PACK_PURCHASE" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gói data</span>
                    <span className="font-medium text-foreground">
                      {selectedTx.packName || "N/A"}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Thời gian</span>
                  <span className="font-medium text-foreground">
                    {timeText}
                  </span>
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
                    {selectedTx.description || "Không có nội dung"}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Nút hành động (không nằm trong ảnh biên lai) */}
        <div className="px-4 space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={handleDownloadReceipt}>
              <Download className="w-4 h-4 mr-2" />
              Tải biên lai
            </Button>
            <Button onClick={handleShareReceipt}>
              <Share2 className="w-4 h-4 mr-2" />
              Chia sẻ
            </Button>
          </div>

          <Button className="w-full" onClick={() => setSelectedTx(null)}>
            Xong
          </Button>
        </div>
      </div>
    );
  }

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

      {/* Content */}
      <div className="px-4 pt-4">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 rounded-2xl animate-pulse">
                <div className="h-20 bg-muted rounded"></div>
              </Card>
            ))}
          </div>
        )}

        {!loading && transactions.length === 0 && (
          <Card className="p-10 flex flex-col items-center justify-center text-center rounded-2xl">
            <div className="w-40 h-24 rounded-2xl bg-muted mb-6" />
            <p className="text-lg font-medium">Không có đơn hàng nào</p>
            <p className="text-sm text-muted-foreground mt-2">
              Khi anh thực hiện giao dịch, lịch sử sẽ hiển thị tại đây (demo).
            </p>
          </Card>
        )}

        {!loading && transactions.length > 0 && (
          <div className="space-y-3">
            {transactions.map((txn) => (
              <Card
                key={txn.transactionId}
                className="p-4 rounded-2xl hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setSelectedTx(txn)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      {txn.type === "DATA_PACK_PURCHASE"
                        ? `Mua gói data: ${txn.packName || "N/A"}`
                        : `Nạp tiền điện thoại`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {txn.phoneNumber} • {txn.telco}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(txn.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700">
                      -{txn.amount.toLocaleString("vi-VN")} ₫
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {txn.status === "SUCCESS" ? "Thành công" : txn.status}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
