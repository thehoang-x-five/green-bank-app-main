// src/pages/utilities/UtilityMobilePhone.tsx
import { Card } from "@/components/ui/card";
import { Smartphone, Wifi } from "lucide-react";

type Props = {
  onGoTopup: () => void;
  onGo3G4G: () => void;
  onGoData4G: () => void;
};

export default function UtilityMobilePhone({
  onGoTopup,
  onGo3G4G,
  onGoData4G,
}: Props) {
  // ✅ demo list “Gần đây” giống ảnh (không subtitle ở chỗ giá)
  const recents = Array.from({ length: 5 }).map((_, idx) => ({
    id: idx + 1,
    title: "Nạp tiền điện thoại",
    phone: "0862525038",
    amount: "10 000 đ",
  }));

  return (
    <div id="utility-mobilephone-screen" className="space-y-6">
      {/* ✅ [PATCH-MOBILEPHONE-LAYOUT-3COL] 3 ô cùng 1 hàng, căn đều */}
      <div className="grid grid-cols-3 gap-4">
        <button type="button" onClick={onGoTopup} className="w-full">
          <Card className="p-4 rounded-2xl hover:bg-muted/30 transition-colors h-full min-h-[110px] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-sm">
              <Smartphone className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="mt-3 font-semibold">Nạp tiền</p>
          </Card>
        </button>

        <button type="button" onClick={onGo3G4G} className="w-full">
          <Card className="p-4 rounded-2xl hover:bg-muted/30 transition-colors h-full min-h-[110px] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-sm">
              <Wifi className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="mt-3 font-semibold">Mua 3G/4G</p>
          </Card>
        </button>

        <button type="button" onClick={onGoData4G} className="w-full">
          <Card className="p-4 rounded-2xl hover:bg-muted/30 transition-colors h-full min-h-[110px] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-sm">
              <Wifi className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="mt-3 font-semibold">Data 4G/Nạp tiền</p>
          </Card>
        </button>
      </div>

      {/* ✅ [PATCH-RECENT-AMOUNT-GREEN] đổi màu số tiền sang xanh lá */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Gần đây</h3>

        <div className="space-y-3">
          {recents.map((r) => (
            <Card key={r.id} className="p-4 rounded-2xl">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border bg-background flex items-center justify-center">
                    <span className="text-emerald-700 font-bold">VI</span>
                  </div>
                  <div>
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-sm text-muted-foreground">{r.phone}</p>
                  </div>
                </div>

                {/* ✅ chỉ số tiền, không subtitle */}
                <p className="font-semibold text-emerald-800">{r.amount}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
