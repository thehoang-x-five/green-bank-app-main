// src/pages/OfficerTransactionsPage.tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useState } from "react";


import { ArrowLeft, ListOrdered, Search } from "lucide-react";

// Dữ liệu demo
const RECENT_TX = [
  {
    id: "TX000123",
    customer: "Nguyễn Văn A",
    type: "Chuyển khoản",
    amount: "-15,000,000 VND",
    time: "Hôm nay • 10:45",
  },
  {
    id: "TX000124",
    customer: "Trần Thị B",
    type: "Nộp tiền tiết kiệm",
    amount: "+50,000,000 VND",
    time: "Hôm qua • 16:20",
  },
  {
    id: "TX000125",
    customer: "Lê Minh C",
    type: "Thanh toán khoản vay",
    amount: "-8,500,000 VND",
    time: "12/11/2025 • 09:15",
  },
];

const OfficerTransactionsPage = () => {
  const navigate = useNavigate();

  const transactions = RECENT_TX; // sau này có thể filter / search

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-8">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/officer")}
          className="inline-flex items-center gap-2 text-xs text-emerald-100 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Dashboard
        </button>
        <div className="text-right">
          <p className="text-xs text-emerald-100">Nhân viên ngân hàng</p>
          <p className="text-sm font-semibold">Lịch sử giao dịch</p>
        </div>
      </header>

      <main className="flex-1 px-4 mt-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListOrdered className="h-4 w-4 text-emerald-600" />
                  Giao dịch gần đây
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Theo dõi các giao dịch giá trị lớn để hỗ trợ kiểm soát rủi ro
                  (màn hình demo – dữ liệu giả lập).
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Thanh search/filter đơn giản */}
              <div className="flex items-center gap-2 text-xs">
                <div className="relative flex-1">
                  <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-7 h-8 text-xs"
                    placeholder="Tìm theo mã giao dịch / tên khách hàng..."
                  />
                </div>
                <Button variant="outline" className="h-8 px-3 text-xs">
                  Lọc (demo)
                </Button>
              </div>

              {/* Danh sách giao dịch */}
              <div className="space-y-2 mt-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-lg border px-3 py-2 text-xs flex flex-col gap-1 bg-white"
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold">{tx.id}</span>
                      <span className="font-semibold">{tx.amount}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>
                        {tx.type} • {tx.customer}
                      </span>
                      <span>{tx.time}</span>
                    </div>
                    <div className="flex justify-end gap-2 mt-1">
                      <Button
                        variant="outline"
                        className="h-7 px-3 text-[11px]"
                      >
                        Xem chi tiết
                      </Button>
                      <Button className="h-7 px-3 text-[11px]">
                        Gắn cờ rủi ro
                      </Button>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Chưa có giao dịch nào trong danh sách.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default OfficerTransactionsPage;
