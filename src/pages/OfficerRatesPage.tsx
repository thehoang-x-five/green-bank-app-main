// src/pages/OfficerRatesPage.tsx
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Percent } from "lucide-react";
import { firebaseRtdb } from "@/lib/firebase";
import { get, ref, set } from "firebase/database";

type SavingTermKey = "1m" | "3m" | "6m" | "12m";

interface SavingRateRow {
  label: string;
  value: string;
  error?: string;
}

interface MortgageRate {
  label: string;
  value: string;
  error?: string;
}

interface InterestConfigFromDb {
  saving?: Partial<Record<SavingTermKey, number | string>>;
  mortgage?: {
    baseRate?: number | string;
  };
}

const DEFAULT_SAVING_RATES: Record<SavingTermKey, number> = {
  "1m": 3.5,
  "3m": 4.2,
  "6m": 5.5,
  "12m": 6.2,
};

const DEFAULT_MORTGAGE_RATE = 9.0;

const OfficerRatesPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);

  // Bảng lãi suất tiết kiệm
  const [savingRates, setSavingRates] = useState<
    Record<SavingTermKey, SavingRateRow>
  >({
    "1m": { label: "Kỳ hạn 1 tháng", value: DEFAULT_SAVING_RATES["1m"].toString() },
    "3m": { label: "Kỳ hạn 3 tháng", value: DEFAULT_SAVING_RATES["3m"].toString() },
    "6m": { label: "Kỳ hạn 6 tháng", value: DEFAULT_SAVING_RATES["6m"].toString() },
    "12m": { label: "Kỳ hạn 12 tháng", value: DEFAULT_SAVING_RATES["12m"].toString() },
  });

  // Lãi suất vay thế chấp chuẩn
  const [mortgageRate, setMortgageRate] = useState<MortgageRate>({
    label: "Vay thế chấp nhà / tài sản đảm bảo",
    value: DEFAULT_MORTGAGE_RATE.toString(),
  });

  // ====== LOAD LÃI SUẤT TỪ REALTIME DB ======
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const cfgRef = ref(firebaseRtdb, "interestConfig");
        const snap = await get(cfgRef);

        if (!snap.exists()) {
          // Nếu chưa có gì trong DB -> ghi default để lần sau dùng luôn
          await set(ref(firebaseRtdb, "interestConfig"), {
            saving: DEFAULT_SAVING_RATES,
            mortgage: { baseRate: DEFAULT_MORTGAGE_RATE },
          });
          setLoading(false);
          return;
        }

        const data = snap.val() as InterestConfigFromDb;

        // Saving
        setSavingRates((prev) => {
          const updated: Record<SavingTermKey, SavingRateRow> = { ...prev };

          (Object.keys(DEFAULT_SAVING_RATES) as SavingTermKey[]).forEach(
            (key) => {
              const rawVal = data.saving?.[key];
              const num =
                typeof rawVal === "number"
                  ? rawVal
                  : typeof rawVal === "string" && rawVal.trim() !== ""
                  ? Number(rawVal)
                  : DEFAULT_SAVING_RATES[key];

              const safeNum = Number.isNaN(num)
                ? DEFAULT_SAVING_RATES[key]
                : num;

              updated[key] = {
                ...prev[key],
                value: safeNum.toString(),
                error: "",
              };
            }
          );

          return updated;
        });

        // Mortgage
        const rawBase = data.mortgage?.baseRate;
        const baseNum =
          typeof rawBase === "number"
            ? rawBase
            : typeof rawBase === "string" && rawBase.trim() !== ""
            ? Number(rawBase)
            : DEFAULT_MORTGAGE_RATE;

        setMortgageRate((prev) => ({
          ...prev,
          value: (Number.isNaN(baseNum)
            ? DEFAULT_MORTGAGE_RATE
            : baseNum
          ).toString(),
          error: "",
        }));
      } catch (error) {
        console.error("Lỗi tải cấu hình lãi suất:", error);
        toast.error("Không tải được bảng lãi suất. Đang dùng giá trị mặc định.");
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Validate input lãi suất
  const validateRate = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return "Vui lòng nhập lãi suất (%)";

    // Cho phép 0–99, tối đa 2 chữ số sau dấu chấm
    const regex = /^\d{1,2}(\.\d{1,2})?$/;
    if (!regex.test(trimmed)) {
      return "Lãi suất phải trong khoảng 0–99 và tối đa 2 chữ số thập phân (VD: 5.2 hoặc 6.25)";
    }

    const num = parseFloat(trimmed);
    if (Number.isNaN(num) || num < 0 || num > 99) {
      return "Lãi suất phải nằm trong khoảng 0 đến 99 (%)";
    }
    return "";
  };

  const handleSaveSavingRate = async (key: SavingTermKey) => {
    const current = savingRates[key];
    const err = validateRate(current.value);

    if (err) {
      toast.error(err);
      setSavingRates((prev) => ({
        ...prev,
        [key]: { ...prev[key], error: err },
      }));
      return;
    }

    const num = parseFloat(current.value.trim());

    try {
      await set(
        ref(firebaseRtdb, `interestConfig/saving/${key}`),
        num
      );

      setSavingRates((prev) => ({
        ...prev,
        [key]: { ...prev[key], error: "" },
      }));

      toast.success(
        `Đã cập nhật lãi suất tiết kiệm cho ${current.label}: ${current.value}%`
      );
    } catch (error) {
      console.error("Lỗi lưu lãi suất tiết kiệm:", error);
      toast.error("Không lưu được lãi suất. Vui lòng thử lại.");
    }
  };

  const handleSaveMortgageRate = async () => {
    const err = validateRate(mortgageRate.value);
    if (err) {
      toast.error(err);
      setMortgageRate((prev) => ({ ...prev, error: err }));
      return;
    }

    const num = parseFloat(mortgageRate.value.trim());

    try {
      await set(
        ref(firebaseRtdb, "interestConfig/mortgage/baseRate"),
        num
      );

      setMortgageRate((prev) => ({ ...prev, error: "" }));
      toast.success(
        `Đã cập nhật lãi suất vay thế chấp: ${mortgageRate.value}%`
      );
    } catch (error) {
      console.error("Lỗi lưu lãi suất vay thế chấp:", error);
      toast.error("Không lưu được lãi suất vay. Vui lòng thử lại.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-8">
      {/* Header kiểu mới */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Bên trái: tiêu đề + back */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold flex items-center gap-1">
              Quản lý lãi suất
              <Percent className="h-4 w-4 text-emerald-200" />
            </p>
            <button
              type="button"
              onClick={() => navigate("/officer")}
              className="inline-flex items-center gap-2 text-xs text-emerald-100 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại Dashboard
            </button>
          </div>

          {/* Bên phải: thông tin nhân viên (demo) */}
          <div className="text-right text-xs">
            <p className="font-semibold">Đỗ Thị Thu Trang</p>
            <p className="text-emerald-100">Vai trò: Banking Officer</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 mt-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="flex flex-col gap-2 pb-3">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">
                  Bảng lãi suất chung của ngân hàng
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Màn hình này cho phép nhân viên cập nhật{" "}
                <b>lãi suất tiết kiệm theo kỳ hạn</b> và{" "}
                <b>lãi suất vay thế chấp</b>. Hệ thống lưu trực tiếp vào
                <code className="mx-1 px-1 rounded bg-slate-100">
                  interestConfig
                </code>{" "}
                trên Realtime Database và dùng bảng này để tính lãi cho khách
                hàng.
              </p>
            </CardHeader>

            <CardContent className="space-y-5 text-xs">
              {loading && (
                <p className="text-xs text-muted-foreground">
                  Đang tải bảng lãi suất từ hệ thống...
                </p>
              )}

              {!loading && (
                <>
                  {/* 1. Lãi suất tiết kiệm */}
                  <section className="space-y-2">
                    <p className="font-semibold text-sm">
                      1. Lãi suất tiết kiệm theo kỳ hạn
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Mỗi kỳ hạn có một mức lãi suất chuẩn (%/năm). Khi nhân viên
                      mở sổ tiết kiệm cho khách hàng hoặc khi khách hàng xem chi
                      tiết sổ, hệ thống sẽ lấy lãi suất tại đây để tính lãi.
                    </p>

                    <div className="rounded-lg border overflow-hidden">
                      <div className="grid grid-cols-12 bg-slate-50 text-[11px] font-semibold text-muted-foreground px-3 py-2">
                        <span className="col-span-5">Kỳ hạn</span>
                        <span className="col-span-3">Lãi suất (%/năm)</span>
                        <span className="col-span-4 text-right">Thao tác</span>
                      </div>

                      {(
                        Object.entries(savingRates) as [
                          SavingTermKey,
                          SavingRateRow
                        ][]
                      ).map(([key, row]) => (
                        <div
                          key={key}
                          className="grid grid-cols-12 items-center gap-2 px-3 py-2 border-t text-xs"
                        >
                          <div className="col-span-5">
                            <span className="font-medium">{row.label}</span>
                          </div>
                          <div className="col-span-3">
                            <Input
                              className="h-8 text-xs"
                              value={row.value}
                              onChange={(e) =>
                                setSavingRates((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    value: e.target.value,
                                    error: "",
                                  },
                                }))
                              }
                              placeholder="VD: 5.2"
                            />
                            {row.error && (
                              <p className="mt-1 text-[11px] text-destructive">
                                {row.error}
                              </p>
                            )}
                          </div>
                          <div className="col-span-4 flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              className="text-[11px]"
                              onClick={() => handleSaveSavingRate(key)}
                            >
                              Lưu lãi suất
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 2. Lãi suất vay thế chấp */}
                  <section className="space-y-2">
                    <p className="font-semibold text-sm">
                      2. Lãi suất vay thế chấp
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Đây là mức lãi suất chuẩn (%/năm) áp dụng khi nhân viên mở{" "}
                      <b>khoản vay thế chấp</b> mới cho khách hàng và khi khách
                      hàng xem chi tiết khoản vay trên app.
                    </p>

                    <div className="rounded-lg border px-3 py-3 space-y-3 bg-slate-50">
                      <div className="text-xs">
                        <p className="font-medium">Loại vay</p>
                        <p className="text-[11px] text-muted-foreground">
                          {mortgageRate.label}
                        </p>
                      </div>

                      <div className="flex items-end gap-3 text-base">
                        <div className="flex-1">
                          <Label className="text-[11px]">
                            Lãi suất vay (%/năm)
                          </Label>
                          <Input
                            className="h-8 text-xs mt-1"
                            value={mortgageRate.value}
                            onChange={(e) =>
                              setMortgageRate((prev) => ({
                                ...prev,
                                value: e.target.value,
                                error: "",
                              }))
                            }
                            placeholder="VD: 9.0"
                          />
                          {mortgageRate.error && (
                            <p className="mt-1 text-[11px] text-destructive">
                              {mortgageRate.error}
                            </p>
                          )}
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          className="text-[11px]"
                          onClick={handleSaveMortgageRate}
                        >
                          Lưu lãi suất vay
                        </Button>
                      </div>
                    </div>
                  </section>

                  {/* 3. Ghi chú / ràng buộc nhập liệu */}
                  <section className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-[11px] text-muted-foreground">
                    <p className="font-semibold mb-1">
                      Quy tắc nhập liệu &amp; hành vi sau khi cập nhật
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Chỉ cho phép nhập số từ 0 đến 99.</li>
                      <li>Tối đa 2 chữ số sau dấu thập phân (VD: 5.2, 6.25).</li>
                      <li>Không được để trống ô lãi suất.</li>
                      <li>
                        Nếu nhập sai định dạng, hệ thống hiển thị lỗi và không
                        cho lưu.
                      </li>
                      <li>
                        Toàn bộ màn hình khách hàng (chi tiết tiết kiệm / thế
                        chấp) sẽ đọc lãi suất từ{" "}
                        <code className="px-1 rounded bg-slate-100">
                          interestConfig
                        </code>{" "}
                        nên khi cập nhật ở đây, số tiền lãi hiển thị cho khách
                        hàng sẽ thay đổi theo lãi suất mới.
                      </li>
                    </ul>
                  </section>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default OfficerRatesPage;
