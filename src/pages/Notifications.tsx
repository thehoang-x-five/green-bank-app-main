// src/pages/Notifications.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Bell, Mail, TrendingUp, TrendingDown } from "lucide-react";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { onValue, ref } from "firebase/database";

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

function formatDateTimeLabel(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const timeStr = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (targetDay.getTime() === today.getTime()) {
    return `Hôm nay, ${timeStr}`;
  }
  if (targetDay.getTime() === yesterday.getTime()) {
    return `Hôm qua, ${timeStr}`;
  }
  return date.toLocaleDateString("vi-VN");
}

const Notifications = () => {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<BalanceChangeNotification[]>(
    []
  );
  const [loadingTransactions, setLoadingTransactions] = useState(true);

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

        // Sắp xếp mới nhất lên đầu
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
            <h1 className="text-xl font-bold text-primary-foreground">
              Thông báo
            </h1>
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
                  <h3 className="font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.date}
                  </p>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Biến động số dư */}
          <TabsContent value="transactions" className="space-y-3">
            {loadingTransactions ? (
              <p className="text-sm text-muted-foreground">
                Đang tải biến động số dư...
              </p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có biến động số dư nào.
              </p>
            ) : (
              transactions.map((transaction) => {
                const isIn = transaction.direction === "IN";
                const sign = isIn ? "+" : "-";
                const amountStr = `${sign}${formatCurrency(
                  transaction.amount
                )} VND`;

                return (
                  <Card
                    key={transaction.id}
                    className="p-4 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() =>
                      navigate(`/transaction/${transaction.transactionId}`, {
                        state: {
                          transaction: {
                            type: isIn ? "in" : "out",
                            title: transaction.title,
                            amount: amountStr,
                            date: formatDateTimeLabel(
                              transaction.createdAt
                            ),
                            balance: `${formatCurrency(
                              transaction.balanceAfter
                            )} VND`,
                            accountNumber: transaction.accountNumber,
                            transactionId: transaction.transactionId,
                            message: transaction.message,
                          },
                        },
                      })
                    }
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon trái */}
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

                      {/* Nội dung + số tiền + số dư */}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-foreground">
                            {transaction.title}
                          </p>
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
                  <h3 className="font-semibold text-foreground">
                    {item.subject}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.from}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.date}
                  </p>
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
