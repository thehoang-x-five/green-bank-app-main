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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarClock,
  Check,
  ChevronRight,
  Clapperboard,
  Clock3,
  MapPin,
  Minus,
  Plus,
  Search,
  Ticket,
} from "lucide-react";

import type { UtilityFormData } from "./utilityTypes";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;
  showErrors?: boolean;
};

const CINEMAS = [
  {
    id: "cgv",
    name: "CGV",
    branch: "Vincom Landmark 81",
    badge: "Ưu đãi thẻ",
    tone: "bg-red-50 text-red-700",
    abbr: "CGV",
  },
  {
    id: "lotte",
    name: "Lotte Cinema",
    branch: "Gò Vấp",
    badge: "Đối tác",
    tone: "bg-emerald-50 text-emerald-700",
    abbr: "LT",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    branch: "Nguyễn Du",
    badge: "Hot",
    tone: "bg-orange-50 text-orange-700",
    abbr: "GX",
  },
];

const MOVIES = [
  {
    id: "dune-2",
    name: "Dune: Part Two",
    duration: "166 phút",
    rating: "C16",
    genre: "Sci-fi",
  },
  {
    id: "inside-out-2",
    name: "Inside Out 2",
    duration: "96 phút",
    rating: "P",
    genre: "Hoạt hình",
  },
  {
    id: "madame-web",
    name: "Madame Web",
    duration: "117 phút",
    rating: "C13",
    genre: "Hành động",
  },
];

const SHOW_TIMES = ["18:30", "19:45", "21:00", "22:15"];
const BASE_PRICE = 100000;

const formatPrice = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

export default function UtilityMovie({
  formData,
  setFormData,
  showErrors = false,
}: Props) {
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [movieOpen, setMovieOpen] = useState(false);
  const [movieSearch, setMovieSearch] = useState("");

  const tickets = Math.min(
    10,
    Math.max(1, Number(formData.movieTickets || "1") || 1)
  );
  const selectedCinema = CINEMAS.find(
    (cinema) => cinema.name === formData.movieCinema
  );
  const selectedMovie = MOVIES.find(
    (movie) => movie.name === formData.movieName
  );

  const filteredMovies = useMemo(() => {
    if (!movieSearch) return MOVIES;
    return MOVIES.filter((movie) =>
      movie.name.toLowerCase().includes(movieSearch.toLowerCase())
    );
  }, [movieSearch]);

  useEffect(() => {
    if (!movieOpen) setMovieSearch("");
  }, [movieOpen]);

  const updateTickets = (delta: number) => {
    const next = Math.min(10, Math.max(1, tickets + delta));
    setFormData((prev) => ({ ...prev, movieTickets: String(next) }));
  };

  const fieldError = (value: string) => showErrors && !value;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          Rạp chiếu <span className="text-destructive">*</span>
        </Label>
        <Dialog open={cinemaOpen} onOpenChange={setCinemaOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border bg-white/70 px-4 py-3 text-left shadow-sm transition hover:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                  {selectedCinema ? selectedCinema.abbr : <MapPin size={18} />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedCinema ? selectedCinema.name : "Chọn rạp chiếu"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCinema
                      ? selectedCinema.branch
                      : "Ưu tiên rạp gần bạn"}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader className="text-left">
              <DialogTitle>Chọn rạp chiếu</DialogTitle>
              <DialogDescription>
                Logo rạp đối tác, cập nhật liên tục
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 pr-1">
                {CINEMAS.map((cinema) => (
                  <button
                    key={cinema.id}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        movieCinema: cinema.name,
                      }));
                      setCinemaOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${cinema.tone}`}
                      >
                        {cinema.abbr}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {cinema.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cinema.branch}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cinema.tone}>
                      {cinema.badge}
                    </Badge>
                  </button>
                ))}
                <div className="rounded-xl border px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Đang tải thêm rạp
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
        {fieldError(formData.movieCinema) && (
          <p className="text-xs text-destructive">Chọn rạp để tiếp tục.</p>
        )}
      </section>

      <section className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          Phim <span className="text-destructive">*</span>
        </Label>
        <Dialog open={movieOpen} onOpenChange={setMovieOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border bg-white/70 px-4 py-3 text-left shadow-sm transition hover:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                  <Clapperboard size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedMovie ? selectedMovie.name : "Chọn phim"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedMovie
                      ? `${selectedMovie.duration} • ${selectedMovie.genre}`
                      : "Có thể tìm kiếm tên phim"}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader className="text-left">
              <DialogTitle>Chọn phim đang chiếu</DialogTitle>
              <DialogDescription>
                Có hỗ trợ tìm kiếm và lọc nhanh
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
                <Search size={16} className="text-muted-foreground" />
                <Input
                  placeholder="Nhập tên phim..."
                  value={movieSearch}
                  onChange={(e) => setMovieSearch(e.target.value)}
                  className="border-0 p-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <ScrollArea className="h-[250px] pr-1">
                <div className="space-y-3">
                  {filteredMovies.map((movie) => (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          movieName: movie.name,
                        }));
                        setMovieOpen(false);
                      }}
                      className="w-full rounded-xl border px-4 py-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <Ticket size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {movie.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {movie.duration} • {movie.genre}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">{movie.rating}</Badge>
                      </div>
                    </button>
                  ))}
                  {filteredMovies.length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">
                      Không tìm thấy phim phù hợp
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
        {fieldError(formData.movieName) && (
          <p className="text-xs text-destructive">
            Chọn phim trước khi tiếp tục.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-white/80 px-3 py-3 shadow-sm">
            <Label className="text-xs font-semibold text-muted-foreground">
              Ngày chiếu <span className="text-destructive">*</span>
            </Label>
            <div className="mt-2 flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
              <CalendarClock size={16} className="text-emerald-700" />
              <Input
                type="date"
                value={formData.movieDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    movieDate: e.target.value,
                  }))
                }
                className="border-0 p-0 shadow-none focus-visible:ring-0"
              />
            </div>
            {fieldError(formData.movieDate) && (
              <p className="mt-2 text-xs text-destructive">
                Vui lòng chọn ngày chiếu.
              </p>
            )}
          </div>

          <div className="rounded-xl border bg-white/80 px-3 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground">
                Suất chiếu <span className="text-destructive">*</span>
              </Label>
              <Badge variant="secondary" className="text-emerald-700">
                1 lựa chọn
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SHOW_TIMES.map((time) => {
                const active = formData.movieTime === time;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, movieTime: time }))
                    }
                    className={`flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-muted bg-white text-foreground hover:border-emerald-200"
                    }`}
                  >
                    <Clock3 size={14} />
                    {time}
                  </button>
                );
              })}
            </div>
            {fieldError(formData.movieTime) && (
              <p className="mt-2 text-xs text-destructive">
                Chọn suất chiếu để khóa lịch.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          Số vé
        </Label>
        <div className="flex items-center justify-between rounded-xl border bg-white/80 px-3 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tickets} vé
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPrice(BASE_PRICE)} đ / vé · tối đa 10 vé
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => updateTickets(-1)}
              disabled={tickets <= 1}
            >
              <Minus size={16} />
            </Button>
            <div className="min-w-[64px] rounded-lg border bg-white px-3 py-2 text-center text-lg font-semibold shadow-sm">
              {tickets}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => updateTickets(1)}
              disabled={tickets >= 10}
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check size={14} className="text-emerald-600" />
          <span>Tự động cập nhật tạm tính và sẵn sàng thanh toán nhanh.</span>
        </div>
      </section>
    </div>
  );
}
