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
    </div>
  );
}
