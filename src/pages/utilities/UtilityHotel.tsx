import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  CalendarRange,
  Check,
  ChevronRight,
  MapPin,
  Minus,
  Plus,
  Sparkles,
  UsersRound,
} from "lucide-react";

import type { UtilityFormData } from "./utilityTypes";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;
  showErrors?: boolean;
};

const QUICK_LOCATIONS = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Nha Trang"];
const QUICK_FILTERS = ["Gần trung tâm", "4★+", "Giá tốt"];

export default function UtilityHotel({
  formData,
  setFormData,
  showErrors = false,
}: Props) {
  const initialGuests = Math.max(1, Number(formData.hotelGuests || "2") || 2);
  const initialRooms = Math.max(1, Number(formData.hotelRooms || "1") || 1);

  const [guestSheetOpen, setGuestSheetOpen] = useState(false);
  const [filters, setFilters] = useState<string[]>([]);
  const [adults, setAdults] = useState(Math.max(1, initialGuests));
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(initialRooms);

  const totalGuests = adults + children;

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      hotelGuests: String(totalGuests),
      hotelRooms: String(rooms),
    }));
  }, [adults, children, rooms, setFormData, totalGuests]);

  const fieldError = (value: string) => showErrors && !value;

  const nights = useMemo(() => {
    if (!formData.hotelCheckIn || !formData.hotelCheckOut) return 0;
    const start = new Date(formData.hotelCheckIn);
    const end = new Date(formData.hotelCheckOut);
    const diff = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 0;
  }, [formData.hotelCheckIn, formData.hotelCheckOut]);

  const guestSummary = `${totalGuests} khách • ${rooms} phòng`;
  const dateSummary =
    formData.hotelCheckIn && formData.hotelCheckOut
      ? `${formData.hotelCheckIn} → ${formData.hotelCheckOut}`
      : "Chọn ngày nhận / trả phòng";

  const estimatedPrice = useMemo(() => {
    const nightsCount = Math.max(1, nights || 1);
    const amount = 850_000 * nightsCount * rooms;
    return amount.toLocaleString("vi-VN");
  }, [nights, rooms]);

  const toggleFilter = (filter: string) => {
    setFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((item) => item !== filter)
        : [...prev, filter]
    );
  };

  const adjustCount = (
    type: "adults" | "children" | "rooms",
    delta: number
  ) => {
    if (type === "adults") {
      setAdults((prev) => Math.max(1, prev + delta));
      return;
    }
    if (type === "children") {
      setChildren((prev) => Math.max(0, prev + delta));
      return;
    }
    setRooms((prev) => Math.max(1, prev + delta));
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          Thành phố / Khu vực <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-center gap-3 rounded-2xl border bg-white/80 px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <MapPin size={18} />
          </div>
          <Input
            placeholder="Nhập điểm đến"
            value={formData.hotelCity}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, hotelCity: e.target.value }))
            }
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
          <Badge
            variant="secondary"
            className="hidden items-center gap-1 border-emerald-100 bg-emerald-50 text-emerald-700 sm:flex"
          >
            <Sparkles size={14} />
            Gợi ý
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_LOCATIONS.map((city) => (
            <Button
              key={city}
              type="button"
              size="sm"
              variant={formData.hotelCity === city ? "default" : "outline"}
              className={`rounded-full ${
                formData.hotelCity === city
                  ? "bg-emerald-600 text-white"
                  : "border-emerald-100 text-emerald-700 hover:bg-emerald-50"
              }`}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  hotelCity: city,
                }))
              }
            >
              {city}
            </Button>
          ))}
        </div>
        {fieldError(formData.hotelCity) && (
          <p className="text-xs text-destructive">Nhập điểm đến để tiếp tục.</p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border bg-white/90 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ngày nhận / trả
            </p>
            <p className="text-sm text-foreground">{dateSummary}</p>
          </div>
          <Badge
            variant="secondary"
            className="border-emerald-100 text-emerald-700"
          >
            <CalendarRange size={14} className="mr-1" />
            {nights > 0 ? `${nights} đêm` : "Chưa chọn"}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-inner">
            <CalendarRange size={16} className="text-emerald-600" />
            <Input
              type="date"
              value={formData.hotelCheckIn}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  hotelCheckIn: e.target.value,
                }))
              }
              className="border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-inner">
            <CalendarRange size={16} className="text-emerald-600" />
            <Input
              type="date"
              value={formData.hotelCheckOut}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  hotelCheckOut: e.target.value,
                }))
              }
              className="border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        {(fieldError(formData.hotelCheckIn) ||
          fieldError(formData.hotelCheckOut)) && (
          <p className="text-xs text-destructive">
            Chọn đủ ngày nhận và trả phòng.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          Khách & Phòng
        </Label>
        <Dialog open={guestSheetOpen} onOpenChange={setGuestSheetOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border bg-white/80 px-4 py-3 text-left shadow-sm transition hover:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <UsersRound size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {guestSummary}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Chạm để chỉnh nhanh
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader className="text-left">
              <DialogTitle>Chỉnh số khách & phòng</DialogTitle>
              <DialogDescription>
                Phù hợp cho đoàn gia đình, tự động giới hạn hợp lệ.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {[
                {
                  label: "Người lớn",
                  value: adults,
                  type: "adults" as const,
                  helper: "Từ 12 tuổi",
                },
                {
                  label: "Trẻ em",
                  value: children,
                  type: "children" as const,
                  helper: "0 - 11 tuổi",
                },
                {
                  label: "Số phòng",
                  value: rooms,
                  type: "rooms" as const,
                  helper: "Tối đa 5 phòng",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.helper}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => adjustCount(item.type, -1)}
                      disabled={
                        item.type === "adults"
                          ? item.value <= 1
                          : item.value <= 0
                      }
                    >
                      <Minus size={16} />
                    </Button>
                    <div className="min-w-[48px] rounded-lg border bg-white px-3 py-2 text-center text-base font-semibold shadow-sm">
                      {item.value}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => adjustCount(item.type, 1)}
                      disabled={item.type === "rooms" ? item.value >= 5 : false}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <Check size={14} />
                Tự động cập nhật tổng khách và số phòng.
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Bộ lọc nhanh
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((filter) => {
            const active = filters.includes(filter);
            return (
              <Button
                key={filter}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className={`rounded-full ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "border-emerald-100 text-emerald-700 hover:bg-emerald-50"
                }`}
                onClick={() => toggleFilter(filter)}
              >
                {filter}
              </Button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tóm tắt nhanh
            </p>
            <p className="text-sm font-semibold text-foreground">
              {formData.hotelCity || "Chưa chọn điểm đến"}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="border-emerald-100 text-emerald-700"
          >
            Ước tính: {estimatedPrice} đ
          </Badge>
        </div>
        <Separator className="my-3" />
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Ngày: {dateSummary}</p>
          <p>Khách & phòng: {guestSummary}</p>
          <p>
            Bộ lọc: {filters.length > 0 ? filters.join(", ") : "Chưa áp dụng"}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Skeleton className="h-2 rounded-full" />
          <Skeleton className="h-2 rounded-full" />
          <Skeleton className="h-2 rounded-full col-span-2" />
        </div>
      </section>
    </div>
  );
}
