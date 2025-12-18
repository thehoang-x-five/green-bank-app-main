// src/pages/Notifications.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Bell,
  Mail,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Download,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { onValue, ref } from "firebase/database";

// ✅ giống TransferReceipt
import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// ✅ lấy tên KH để đồng bộ "Nội dung" kiểu: "{Tên} chuyển tiền"
import { getCustomerDisplayName } from "@/services/accountService";

const promotions = [
  {
    id: 1,
    title: "Hoàn tiền 5% khi thanh toán hóa đơn điện",
    description: "Áp dụng cho hóa đơn từ 200.000đ, tối đa 100.000đ/giao dịch.",
    date: "20/11/2024",
  },
  {
    id: 2,
    title: "Miễn phí chuyển tiền liên ngân hàng",
    description: "Không giới hạn số lần, áp dụng đến 31/12/2024.",
    date: "18/11/2024",
  },
  {
    id: 3,
    title: "Ưu đãi mua vé máy bay",
    description: "Giảm đến 200.000đ cho vé nội địa, 500.000đ cho vé quốc tế.",
    date: "15/11/2024",
  },
];

const mailboxMessages = [
  {
    id: 1,
    from: "Ngân hàng VietBank",
    subject: "Cập nhật điều khoản sử dụng dịch vụ",
    date: "19/11/2024",
  },
  {
    id: 2,
    from: "Ngân hàng VietBank",
    subject: "Thông báo thay đổi lịch bảo trì hệ thống",
    date: "16/11/2024",
  },
];

type Direction = "IN" | "OUT";

type BalanceChangeNotification = {
  id: string;
  direction: Direction;
  title: string;
  message: string;
  amount: number;
  accountNumber: string;
  balanceAfter: number | null;
  transactionId: string;
  createdAt: number;
};

// ===== Helpers =====
function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "-";
  return amount.toLocaleString("vi-VN");
}

function formatDateTimeFull(timestamp: number): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN");
}

function formatDateTimeLabel(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (targetDay.getTime() === today.getTime()) return `Hôm nay, ${timeStr}`;
  if (targetDay.getTime() === yesterday.getTime()) return `Hôm qua, ${timeStr}`;
  return date.toLocaleDateString("vi-VN");
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

type DestinationInfo = {
  label: string;
  number: string;
  bank?: string;
};

// Heuristic nhẹ: nếu message có dạng "... 6180... • VietBank" thì tách ra
function tryParseDestination(message: string): DestinationInfo | null {
  const msg = (message ?? "").trim();
  if (!msg) return null;

  // match: "<digits> • <bank>"
  const m = msg.match(/(\d{6,})\s*[•-]\s*([A-Za-zÀ-ỹ0-9 ]{2,})/);
  if (!m) return null;

  const number = (m[1] ?? "").trim();
  const bank = (m[2] ?? "").trim();
  if (!number) return null;

  // lấy "label" phía trước đoạn number nếu có (cắt ngắn cho gọn)
  const idx = msg.indexOf(m[0]);
  const prefix = idx > 0 ? msg.slice(0, idx).trim() : "";
  const label = prefix ? prefix.slice(-40).trim() : "Người nhận";

  return { label, number, bank };
}

const Notifications = () => {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<BalanceChangeNotification[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  const [selectedTx, setSelectedTx] = useState<BalanceChangeNotification | null>(null);

  // ✅ tên KH (để đồng bộ “Nội dung” cho chuyển tiền)
  const [customerName, setCustomerName] = useState<string>("");

  // ✅ vùng biên lai để chụp ảnh
  const receiptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    // best-effort: lấy tên hiển thị
    getCustomerDisplayName(currentUser.uid)
      .then((name) => setCustomerName(name ?? ""))
      .catch(() => setCustomerName(""));
  }, []);

  // ===== Load biến động số dư từ RTDB: notifications/{uid} =====
  useEffect(() => {
    const currentUser = firebaseAuth.currentUser;

    if (!currentUser) {
      setTransactions([]);
      setLoadingTransactions(false);
      return;
    }

    const notiRef = ref(firebaseRtdb, `notifications/${currentUser.uid}`);

    const unsubscribe = onValue(
      notiRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setTransactions([]);
          setLoadingTransactions(false);
          return;
        }

        const raw = snapshot.val() as Record<
          string,
          {
            type?: string;
            direction?: Direction;
            title?: string;
            message?: string;
            amount?: number;
            accountNumber?: string;
            balanceAfter?: number | null;
            transactionId?: string;
            createdAt?: number;
          }
        >;

        const list: BalanceChangeNotification[] = Object.entries(raw)
          .filter(([, value]) => value.type === "BALANCE_CHANGE")
          .map(([id, value]) => ({
            id,
            direction: value.direction === "IN" ? "IN" : ("OUT" as Direction),
            title: value.title ?? "",
            message: value.message ?? "",
            amount: Number(value.amount ?? 0),
            accountNumber: value.accountNumber ?? "",
            balanceAfter:
              typeof value.balanceAfter === "number"
                ? value.balanceAfter
                : Number(value.balanceAfter ?? NaN),
            transactionId: value.transactionId ?? id,
            createdAt: value.createdAt ?? 0,
          }));

        list.sort((a, b) => b.createdAt - a.createdAt);
        setTransactions(list);
        setLoadingTransactions(false);
      },
      (error) => {
        console.error("Lỗi đọc notifications:", error);
        setTransactions([]);
        setLoadingTransactions(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formattedSelectedAmount = useMemo(() => {
    if (!selectedTx) return "";
    return new Intl.NumberFormat("vi-VN").format(Number(selectedTx.amount ?? 0));
  }, [selectedTx]);

  // ✅ chụp biên lai -> base64 png
  const captureReceiptPng = async (tx: BalanceChangeNotification) => {
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

      const safeTxId = (tx.transactionId || tx.id).replace(/[^0-9A-Za-z_-]/g, "_");
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
        toast.success("Trình duyệt không hỗ trợ chia sẻ, đã tải biên lai xuống.");
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

  // ✅ Receipt view (clone theo TransferReceipt)
  if (selectedTx) {
    const flowLabel = selectedTx.title || "Chi tiết giao dịch";
    const timeText = formatDateTimeFull(selectedTx.createdAt);
    const txId = selectedTx.transactionId || selectedTx.id;
    const feeText = "0 đ";

    const isTransferLike = /chuyển/i.test(flowLabel);

    // ✅ Đồng bộ “Nội dung” kiểu TransferReceipt (đặc biệt cho chuyển tiền)
    const contentText = isTransferLike
      ? `${(customerName || "Khách hàng").toUpperCase()} chuyển tiền`
      : selectedTx.message || "Không có nội dung";

    const source = {
      label: `${selectedTx.accountNumber} - Tài khoản thanh toán`,
      number: selectedTx.accountNumber,
    };

    const parsedDest = tryParseDestination(selectedTx.message);
    const destination: DestinationInfo = parsedDest
      ? parsedDest
      : isTransferLike
      ? { label: "Tài khoản khác", number: "", bank: "" }
      : { label: customerName || "Chủ tài khoản", number: selectedTx.accountNumber, bank: "VietBank" };

    return (
      <div className="min-h-screen bg-background pb-16">
        {/* vùng chụp ảnh */}
        <div ref={receiptRef} className="bg-gradient-to-br from-primary to-accent pb-10">
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
                <p className="text-sm text-muted-foreground mb-1">Số tiền giao dịch</p>
                <p className="text-3xl font-bold text-foreground">
                  {formattedSelectedAmount} VND
                </p>
                <p className="text-xs text-muted-foreground mt-2">{flowLabel}</p>
              </div>

              <div className="space-y-4 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loại giao dịch</span>
                  <span className="font-medium text-foreground">{flowLabel}</span>
                </div>

                {/* ✅ Đồng bộ theo TransferReceipt: Nguồn tiền */}
                <div className="flex justify-between gap-6">
                  <span className="text-muted-foreground">Nguồn tiền</span>
                  <div className="text-right">
                    <p className="font-medium">{source.label}</p>
                    <p className="text-xs text-muted-foreground">{source.number}</p>
                  </div>
                </div>

                {/* ✅ Đồng bộ theo TransferReceipt: Người nhận */}
                <div className="flex justify-between gap-6">
                  <span className="text-muted-foreground">Người nhận</span>
                  <div className="text-right">
                    <p className="font-medium">{destination.label || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {destination.number}
                      {destination.bank ? ` • ${destination.bank}` : ""}
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
                    {contentText}
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

  // ===== UI bình thường (Tabs) =====
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/home")}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">Thông báo</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-2">
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="promotions">Khuyến mãi</TabsTrigger>
            <TabsTrigger value="transactions">Biến động</TabsTrigger>
            <TabsTrigger value="mailbox">Hòm thư</TabsTrigger>
          </TabsList>

          {/* Khuyến mãi */}
          <TabsContent value="promotions" className="space-y-3">
            {promotions.map((item) => (
              <Card key={item.id} className="p-4 flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.date}</p>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Biến động số dư */}
          <TabsContent value="transactions" className="space-y-3">
            {loadingTransactions ? (
              <p className="text-sm text-muted-foreground">Đang tải biến động số dư...</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có biến động số dư nào.</p>
            ) : (
              transactions.map((transaction) => {
                const isIn = transaction.direction === "IN";
                const sign = isIn ? "+" : "-";
                const amountStr = `${sign}${formatCurrency(transaction.amount)} VND`;

                return (
                  <Card
                    key={transaction.id}
                    className="p-4 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => setSelectedTx(transaction)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isIn ? "bg-success/10" : "bg-destructive/10"
                        }`}
                      >
                        {isIn ? (
                          <TrendingUp className="w-5 h-5 text-success" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-destructive" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-foreground">{transaction.title}</p>
                          <p
                            className={`ml-4 font-semibold text-sm ${
                              isIn ? "text-success" : "text-destructive"
                            }`}
                          >
                            {amountStr}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTimeLabel(transaction.createdAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Số dư: {formatCurrency(transaction.balanceAfter)} VND
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Hòm thư */}
          <TabsContent value="mailbox" className="space-y-3">
            {mailboxMessages.map((item) => (
              <Card key={item.id} className="p-4 flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{item.subject}</h3>
                  <p className="text-sm text-muted-foreground">{item.from}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.date}</p>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Notifications;
