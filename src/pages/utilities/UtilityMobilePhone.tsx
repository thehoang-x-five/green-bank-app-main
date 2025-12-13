import { Card } from "@/components/ui/card";

type Props = {
  onGoTopup: () => void;
  onGoData: () => void;
};

const MOCK_USER_PHONE = "0862525038";

const RECENT_MOBILE_TRANSACTIONS = [
  {
    id: 1,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
  {
    id: 2,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
  {
    id: 3,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
  {
    id: 4,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
  {
    id: 5,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
];

const formatCurrencyVND = (value: number) =>
  value.toLocaleString("vi-VN") + " đ";

export default function UtilityMobilePhone({ onGoTopup, onGoData }: Props) {
  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-3 gap-3 mb-6 max-w-xl mx-auto">
          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-2xl bg-muted py-4 hover:bg-muted/80"
            onClick={onGoTopup}
          >
            <span className="text-2xl mb-1">📲</span>
            <span className="text-sm font-medium text-center">Nạp tiền</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-2xl bg-muted py-4 hover:bg-muted/80"
            onClick={onGoData}
          >
            <span className="text-2xl mb-1">📶</span>
            <span className="text-sm font-medium text-center">Mua 3G/4G</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-2xl bg-muted py-4 hover:bg-muted/80"
            onClick={onGoData}
          >
            <span className="text-2xl mb-1">📡</span>
            <span className="text-sm font-medium text-center">
              Data 4G/Nạp tiền
            </span>
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">Gần đây</h2>
        <div className="space-y-3">
          {RECENT_MOBILE_TRANSACTIONS.map((item) => (
            <Card
              key={item.id}
              className="p-3 flex items-center justify-between rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-xs font-semibold text-emerald-700">
                  VIET
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.phone}</p>
                </div>
              </div>
              <p className="text-sm font-semibold">
                {formatCurrencyVND(item.amount)}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
