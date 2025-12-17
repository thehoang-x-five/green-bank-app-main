// src/pages/utilities/UtilityConfirmPayment.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getTelcoLabel } from "./utilityData";

type ConfirmKind = "data4g" | "topup";

type ConfirmState =
  | {
      kind: "data4g";
      phone: string;
      telcoKey: string;
      pack: {
        id: string;
        name: string;
        description?: string;
        price: number;
      };
      sourceAccount?: {
        name: string;
        number: string;
        balanceText: string;
      };
    }
  | {
      kind: "topup";
      phone: string;
      telcoKey: string;
      amount: number;
      sourceAccount?: {
        name: string;
        number: string;
        balanceText: string;
      };
    };

type UtilityFlow = "bill" | "phone" | "data" | "flight" | "movie" | "hotel";

type UtilityResultState = {
  flow: UtilityFlow;
  amount: string;
  title: string;
  time: string;
  fee: string;
  transactionId: string;
  details: { label: string; value: string }[];
};

export default function UtilityConfirmPayment() {
  const navigate = useNavigate();

  const location = useLocation() as {
    state?: ConfirmState;
  };

  const data = location.state;

  // Nếu user vào thẳng URL /utilities/confirm mà không có state
  if (!data) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-primary to-accent px-6 pb-8 pt-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">
                Xác nhận thanh toán
              </h1>
              <p className="text-sm text-primary-foreground/80">
                Không tìm thấy dữ liệu giao dịch (demo)
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 -mt-4">
          <Card className="p-6 rounded-2xl">
            <p className="text-sm text-muted-foreground">
              Vui lòng quay lại trang trước và chọn gói/mệnh giá để tiếp tục.
            </p>
            <Button className="mt-4 w-full" onClick={() => navigate(-1)}>
              Quay lại
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const source = data.sourceAccount ?? {
    name: "Normal Account",
    number: "0862525038",
    balanceText: "559 807 đ",
  };

  const feeNumber = 0;

  const title = data.kind === "data4g" ? "Mua data 4G" : "Nạp tiền điện thoại";

  const amountNumber = data.kind === "data4g" ? data.pack.price : data.amount;

  const totalNumber = amountNumber + feeNumber;

  const handleBack = () => navigate(-1);

  const buildResultState = (): UtilityResultState => {
    const now = new Date();

    if (data.kind === "data4g") {
      return {
        flow: "data",
        amount: amountNumber.toLocaleString("vi-VN"),
        title: "Nạp data 4G",
        time: now.toLocaleString("vi-VN"),
        fee: `${feeNumber.toLocaleString("vi-VN")} đ`,
        transactionId: "HD-DATA4G-" + now.getTime(),
        details: [
          { label: "Số điện thoại", value: data.phone },
          { label: "Nhà mạng", value: getTelcoLabel(data.telcoKey as any) },
          { label: "Gói data", value: data.pack.name },
          {
            label: "Mô tả",
            value: data.pack.description || "—",
          },
          {
            label: "Tổng tiền",
            value: `${totalNumber.toLocaleString("vi-VN")} VND`,
          },
        ],
      };
    }

    // topup
    return {
      flow: "phone",
      amount: amountNumber.toLocaleString("vi-VN"),
      title: "Nạp tiền điện thoại",
      time: now.toLocaleString("vi-VN"),
      fee: `${feeNumber.toLocaleString("vi-VN")} đ`,
      transactionId: "HD-TOPUP-" + now.getTime(),
      details: [
        { label: "Số điện thoại", value: data.phone },
        { label: "Nhà mạng", value: getTelcoLabel(data.telcoKey as any) },
        {
          label: "Mệnh giá",
          value: `${amountNumber.toLocaleString("vi-VN")} đ`,
        },
        {
          label: "Tổng tiền",
          value: `${totalNumber.toLocaleString("vi-VN")} VND`,
        },
      ],
    };
  };

  const handleConfirm = () => {
    toast.success("Xác nhận thanh toán thành công (demo)");
    const result = buildResultState();
    navigate("/utilities/result", { state: { result } });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent px-6 pb-8 pt-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              Xác nhận thanh toán
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Kiểm tra thông tin giao dịch trước khi xác nhận
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <span className="text-sm font-semibold text-emerald-800">
              Giao dịch an toàn (demo)
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 -mt-4 space-y-4">
        {/* Tài khoản nguồn */}
        <Card className="p-5 rounded-2xl">
          <p className="text-sm font-semibold text-foreground mb-3">
            Tài khoản nguồn
          </p>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xl font-bold text-foreground">
                {source.balanceText}
              </p>
              <p className="text-sm text-muted-foreground">
                {source.name} | {source.number}
              </p>
            </div>

            <button
              type="button"
              className="text-emerald-700 font-semibold hover:opacity-80"
              onClick={() =>
                toast.message("Demo", {
                  description: "Đổi tài khoản nguồn (demo)",
                })
              }
            >
              Thay đổi
            </button>
          </div>
        </Card>

        {/* Thông tin thanh toán */}
        <Card className="p-5 rounded-2xl">
          <p className="text-sm font-semibold text-foreground mb-3">
            Thông tin thanh toán
          </p>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Dịch vụ</span>
              <span className="font-semibold text-foreground text-right">
                {title}
              </span>
            </div>

            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Số điện thoại</span>
              <span className="font-semibold text-foreground text-right">
                {data.phone}
              </span>
            </div>

            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Nhà mạng</span>
              <span className="font-semibold text-foreground text-right">
                {getTelcoLabel(data.telcoKey as any)}
              </span>
            </div>

            {data.kind === "data4g" ? (
              <>
                <div className="flex justify-between gap-6">
                  <span className="text-muted-foreground">Gói data</span>
                  <span className="font-semibold text-foreground text-right">
                    {data.pack.name}
                  </span>
                </div>
                <div className="flex justify-between gap-6">
                  <span className="text-muted-foreground">Mô tả</span>
                  <span className="font-medium text-foreground text-right">
                    {data.pack.description || "—"}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">Mệnh giá</span>
                <span className="font-semibold text-foreground text-right">
                  {amountNumber.toLocaleString("vi-VN")} đ
                </span>
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">Số tiền</span>
                <span className="font-semibold text-foreground text-right">
                  {amountNumber.toLocaleString("vi-VN")} VND
                </span>
              </div>

              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">Phí giao dịch</span>
                <span className="font-semibold text-foreground text-right">
                  {feeNumber.toLocaleString("vi-VN")} đ
                </span>
              </div>

              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">Tổng tiền</span>
                <span className="text-base font-extrabold text-foreground text-right">
                  {totalNumber.toLocaleString("vi-VN")} VND
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Sticky confirm */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Button
            type="button"
            onClick={handleConfirm}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700"
          >
            Xác nhận thanh toán
          </Button>
        </div>
      </div>
    </div>
  );
}
