// src/pages/TransferReceipt.tsx
import { useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Download, Share2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

type TransferFlow = "account" | "card" | "self" | "international";

type TransferResultState = {
  flow: TransferFlow;
  amount: string; // số tiền VND
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
  originalAmount?: string;
  originalCurrency?: string;
};

const TransferReceipt = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { result?: TransferResultState } };

  // ✅ vùng biên lai để chụp ảnh
  const receiptRef = useRef<HTMLDivElement | null>(null);

  const now = new Date();
  const defaultResult: TransferResultState = {
    flow: "account",
    amount: "500000",
    content: "Chuyển tiền",
    time: now.toLocaleString("vi-VN"),
    fee: "0 đ",
    transactionId: "GD-DEMO-0001",
    source: { label: "Tài khoản thanh toán VND", number: "1234 5678 9001" },
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
  const txId = data.transactionId ?? `GD-${now.getTime()}`;
  const feeText = data.fee ?? "0 đ";

  // ✅ FIX 1: format tiền có dấu chấm theo vi-VN
  const formattedAmountVnd = useMemo(() => {
    const raw = (data.amount ?? "").toString();
    const digitsOnly = raw.replace(/[^\d]/g, "");
    if (!digitsOnly) return raw;
    const n = Number(digitsOnly);
    if (!Number.isFinite(n)) return raw;
    return new Intl.NumberFormat("vi-VN").format(n);
  }, [data.amount]);

  // ✅ Không dùng any: helper lấy message lỗi
  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return "Lỗi không xác định";
    }
  };

  // ✅ chụp biên lai -> base64 png
  const captureReceiptPng = async () => {
    const el = receiptRef.current;
    if (!el) throw new Error("Không tìm thấy vùng biên lai để xuất ảnh.");

    const prevScrollY = window.scrollY;
    try {
      window.scrollTo(0, 0);

      const canvas = await html2canvas(el, {
        // ✅ để nền gradient (xanh) được giữ đúng khi chụp
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });

      const dataUrl = canvas.toDataURL("image/png", 1.0);
      const base64 = dataUrl.split(",")[1] ?? "";
      if (!base64) throw new Error("Không tạo được dữ liệu ảnh.");

      // ✅ FIX lỗi regex \w: dùng whitelist ký tự an toàn
      const safeTx = txId.replace(/[^0-9A-Za-z_-]/g, "_");
      const fileName = `VietBank_Receipt_${safeTx}.png`;

      return { dataUrl, base64, fileName };
    } finally {
      window.scrollTo(0, prevScrollY);
    }
  };

  // ✅ Download thật + hiện đường dẫn thật
  const handleDownload = async () => {
    const loadingId = toast.loading("Đang tạo biên lai...");

    try {
      const { dataUrl, base64, fileName } = await captureReceiptPng();
      const platform = Capacitor.getPlatform(); // web/android/ios

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

  // ✅ Share thật — lưu Cache rồi share uri + hiện đường dẫn thật
  const handleShare = async () => {
    const loadingId = toast.loading("Đang chuẩn bị chia sẻ...");

    try {
      const { dataUrl, base64, fileName } = await captureReceiptPng();
      const platform = Capacitor.getPlatform();

      if (platform === "web") {
        if (navigator.share) {
          await navigator.share({
            title: "Biên lai giao dịch VietBank",
            text: `Biên lai ${txId} • ${timeText}`,
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
        text: `Biên lai ${txId} • ${timeText}`,
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

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* ✅ vùng chụp ảnh: bọc gradient + thêm padding dưới để ảnh không bị cắt */}
      <div ref={receiptRef} className="bg-gradient-to-br from-primary to-accent pb-10">
        {/* Header */}
        <div className="p-6 pb-8">
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
            {/* ✅ FIX: icon + text thẳng hàng */}
            <div className="bg-white/95 backdrop-blur-sm rounded-full px-6 py-3 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 -translate-y-[1px]" />
              <span className="font-semibold text-success leading-none">
                Giao dịch thành công
              </span>
            </div>
          </div>
        </div>

        {/* Card */}
        {/* ✅ FIX: thêm pb-8 để có nền xanh bên dưới card khi chụp/in */}
        <div className="px-4 -mt-6 pb-8">
          <Card className="p-6">
            <div className="mb-6 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                Số tiền giao dịch
              </p>
              <p className="text-3xl font-bold text-foreground">
                {formattedAmountVnd} VND
              </p>

              {data.originalAmount && data.originalCurrency && (
                <p className="text-xs text-muted-foreground mt-1">
                  {data.originalAmount} {data.originalCurrency}
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-2">{flowLabel}</p>
            </div>

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
        </div>
      </div>

      {/* Nút hành động (không nằm trong ảnh biên lai) */}
      <div className="px-4 space-y-3 mt-4">
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
