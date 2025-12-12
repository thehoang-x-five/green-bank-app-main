// src/pages/Transfer.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ArrowLeft, User, CreditCard, RefreshCw, Globe } from "lucide-react";

// ✅ Dùng đúng lib firebase của anh
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { onValue, ref } from "firebase/database";

type SavedRecipient = {
  id: string;
  name: string; // tên THẬT người thụ hưởng (hoặc fallback tốt nhất)
  nickname?: string; // tên gợi nhớ (có thể rỗng)
  accountNumber: string;
  bankName: string;
  bankCode?: string;
};

const Transfer = () => {
  const navigate = useNavigate();

  const [savedRecipients, setSavedRecipients] = useState<SavedRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);

  const transferOptions = [
    {
      icon: User,
      title: "Chuyển tới tài khoản khác",
      description: "Chuyển tiền đến tài khoản người khác",
      path: "/transfer/account",
      color: "bg-primary",
    },
    {
      icon: CreditCard,
      title: "Chuyển tới thẻ",
      description: "Chuyển tiền đến số thẻ",
      path: "/transfer/card",
      color: "bg-secondary",
    },
    {
      icon: RefreshCw,
      title: "Chuyển tới thẻ/tài khoản của tôi",
      description: "Chuyển giữa các tài khoản của bạn",
      path: "/transfer/self",
      color: "bg-accent",
    },
    {
      icon: Globe,
      title: "Chuyển tiền quốc tế",
      description: "Chuyển tiền ra nước ngoài",
      path: "/transfer/international",
      color: "bg-info",
    },
  ];

  // ============================
  // Lấy "Người nhận đã lưu" từ RTDB
  // Path: savedRecipients/{uid}/{recipientKey}
  // ============================
  useEffect(() => {
    const currentUser = firebaseAuth.currentUser;

    if (!currentUser) {
      setSavedRecipients([]);
      setLoadingRecipients(false);
      return;
    }

    const listRef = ref(firebaseRtdb, `savedRecipients/${currentUser.uid}`);

    const unsubscribe = onValue(
      listRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSavedRecipients([]);
          setLoadingRecipients(false);
          return;
        }

        const raw = snapshot.val() as Record<
          string,
          {
            displayName?: string;
            realName?: string;
            name?: string; // backward compatible
            accountNumber?: string;
            bankName?: string;
            bankCode?: string;
            nickname?: string;
          }
        >;

        const list: SavedRecipient[] = Object.entries(raw).map(
          ([id, value]) => {
            const realName =
              (value.realName && value.realName.toString().trim()) ||
              (value.name && value.name.toString().trim()) ||
              "";

            const nickname =
              (value.nickname && value.nickname.toString().trim()) || "";

            // Dùng cho UI hiển thị danh sách
            const displayName =
              (value.displayName && value.displayName.toString().trim()) ||
              nickname ||
              realName ||
              (value.accountNumber ?? "");

            return {
              id,
              // name giữ TÊN THẬT tốt nhất có thể (hoặc fallback nếu dữ liệu cũ)
              name: realName || displayName,
              nickname,
              accountNumber: value.accountNumber ?? "",
              bankName: value.bankName ?? "",
              bankCode: value.bankCode,
            };
          }
        );

        setSavedRecipients(list);
        setLoadingRecipients(false);
      },
      // ✅ Gán type cho error để tránh implicit any
      (error: Error) => {
        console.error("Lỗi đọc savedRecipients:", error);
        setSavedRecipients([]);
        setLoadingRecipients(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate("/home")}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-primary-foreground">
            Chuyển tiền
          </h1>
        </div>
      </div>

      <div className="px-6 -mt-4">
        {/* Transfer Options */}
        <div className="space-y-3 mb-6">
          {transferOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <Card
                key={index}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(option.path)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`${option.color} w-12 h-12 rounded-xl flex items-center justify-center`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {option.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Saved Recipients */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-foreground">
            Người nhận đã lưu
          </h2>

          {loadingRecipients ? (
            <p className="text-sm text-muted-foreground">
              Đang tải danh sách người nhận...
            </p>
          ) : savedRecipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bạn chưa lưu người nhận nào.
            </p>
          ) : (
            <div className="space-y-3">
              {savedRecipients.map((recipient) => {
                const displayName =
                  (recipient.nickname && recipient.nickname.trim()) ||
                  recipient.name ||
                  recipient.accountNumber;

                return (
                  <Card
                    key={recipient.id}
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-3"
                    onClick={() =>
                      navigate("/transfer/account", {
                        state: { beneficiary: recipient },
                      })
                    }
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">
                        {displayName}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {recipient.accountNumber} • {recipient.bankName}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transfer;
