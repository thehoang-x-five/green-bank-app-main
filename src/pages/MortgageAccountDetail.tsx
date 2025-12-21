// src/pages/MortgageAccountDetail.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { get, ref } from "firebase/database";
import { getPrimaryAccount, type BankAccount } from "@/services/accountService";
import { verifyTransactionPin } from "@/services/userService";

const HIGH_VALUE_THRESHOLD_VND = 10_000_000;

interface MortgageAccountInDb {
  uid?: string;
  number?: string;
  originalAmount?: number | string;
  debtRemaining?: number | string;
  termMonths?: number | string;
  rate?: number | string; // %/năm
  startDate?: string; // yyyy-mm-dd
  maturityDate?: string; // yyyy-mm-dd
  note?: string;
  createdAt?: number;
}

interface MortgageAccount {
  number: string;
  originalAmount: number;
  debtRemaining: number;
  termMonths: number;
  rate: number;
  startDate: string;
  maturityDate: string;
  note: string;
}

type ScheduleStatus = "DUE" | "PAID";

interface MortgageInterestScheduleInDb {
  uid?: string;
  number?: string;
  yyyymm?: string;

  // legacy: chỉ có lãi
  interestAmount?: number | string;

  // ✅ NEW: có gốc + tổng (để FE hiển thị đúng)
  principalAmount?: number | string;
  totalAmount?: number | string;

  status?: string;
  createdAt?: number;
  paidAt?: number;

  // legacy field names
  paidFrom?: string;
  paidAmount?: number | string;

  // new field name (mortgageService.ts đang dùng)
  paidByAccountNumber?: string;
}

interface MortgageInterestSchedule {
  yyyymm: string;

  // legacy (lãi)
  interestAmount: number;

  // ✅ NEW
  principalAmount: number;
  totalAmount: number;

  status: ScheduleStatus;
  createdAt?: number;
  paidAt?: number;
  paidFrom?: string;
  paidAmount?: number;
}

const DEFAULT_MORTGAGE_RATE = 9.0;

const formatMoney = (value: number): string => value.toLocaleString("vi-VN") + " VND";

const formatDateDisplay = (iso: string): string => {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

const parseMoneyLike = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d-]/g, "");
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const toScheduleStatus = (v: unknown): ScheduleStatus => {
  const s = typeof v === "string" ? v.toUpperCase().trim() : "";
  return s === "PAID" ? "PAID" : "DUE";
};

const formatPeriodLabel = (yyyymm: string): string => {
  if (!yyyymm || yyyymm.length !== 6) return yyyymm || "—";
  const y = yyyymm.slice(0, 4);
  const m = yyyymm.slice(4, 6);
  return `Kỳ ${m}/${y}`;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

const MortgageAccountDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const accountParam = params.accountNumber ?? null;

  const [accounts, setAccounts] = useState<MortgageAccount[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);

  const [configRate, setConfigRate] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // payment account (tài khoản thanh toán dùng để trừ tiền đóng lãi)
  const [primaryPayAcc, setPrimaryPayAcc] = useState<BankAccount | null>(null);

  // schedules
  const [schedules, setSchedules] = useState<MortgageInterestSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState<boolean>(false);
  const [payingKey, setPayingKey] = useState<string | null>(null);

  // trigger reload schedules when coming back from OTP confirm
  const [reloadTick, setReloadTick] = useState<number>(0);

  // ===== LOAD DATA =====
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (!user) {
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
          navigate("/login");
          return;
        }

        // 0) lấy tài khoản thanh toán chính
        try {
          const payAcc = await getPrimaryAccount(user.uid);
          setPrimaryPayAcc(payAcc);
        } catch (err) {
          console.error("Lỗi getPrimaryAccount:", err);
          setPrimaryPayAcc(null);
        }

        // 1) Danh sách tài khoản thế chấp
        const mortgageSnap = await get(ref(firebaseRtdb, `mortgageAccounts/${user.uid}`));

        let list: MortgageAccount[] = [];
        if (mortgageSnap.exists()) {
          const rawVal = mortgageSnap.val() as Record<string, MortgageAccountInDb>;

          list = Object.keys(rawVal).map((key) => {
            const raw = rawVal[key];

            const originalAmount = parseMoneyLike(raw.originalAmount);
            const debtRemaining = parseMoneyLike(raw.debtRemaining);

            const termMonths =
              typeof raw.termMonths === "number" ? raw.termMonths : Number(raw.termMonths ?? 0);

            const rate = typeof raw.rate === "number" ? raw.rate : Number(raw.rate ?? 0);

            return {
              number: raw.number ?? key,
              originalAmount: Number.isFinite(originalAmount) ? originalAmount : 0,
              debtRemaining: Number.isFinite(debtRemaining) ? debtRemaining : 0,
              termMonths: Number.isNaN(termMonths) ? 0 : termMonths,
              rate: Number.isNaN(rate) ? 0 : rate,
              startDate: raw.startDate ?? "",
              maturityDate: raw.maturityDate ?? "",
              note: raw.note ?? "Khoản vay thế chấp",
            };
          });
        }

        let initialNumber: string | null = null;
        if (accountParam && list.some((m) => m.number === accountParam)) {
          initialNumber = accountParam;
        } else if (list.length > 0) {
          initialNumber = list[0].number;
        }

        setAccounts(list);
        setSelectedNumber(initialNumber);

        // 2) Lãi suất chuẩn vay thế chấp (config) - chỉ dùng fallback nếu account.rate không có
        try {
          const rateSnap = await get(ref(firebaseRtdb, "interestConfig/mortgage/baseRate"));
          if (rateSnap.exists()) {
            const rawRate = rateSnap.val();
            const num = parseMoneyLike(rawRate);
            setConfigRate(num > 0 ? num : DEFAULT_MORTGAGE_RATE);
          } else {
            setConfigRate(DEFAULT_MORTGAGE_RATE);
          }
        } catch (err) {
          console.error("Lỗi đọc interestConfig/mortgage/baseRate:", err);
          setConfigRate(DEFAULT_MORTGAGE_RATE);
        }
      } catch (error) {
        console.error("Lỗi khi tải tài khoản thế chấp:", error);
        toast.error("Không thể tải thông tin tài khoản thế chấp.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accountParam, navigate]);

  const selectedAccount = useMemo(() => {
    if (!selectedNumber) return null;
    return accounts.find((a) => a.number === selectedNumber) ?? null;
  }, [accounts, selectedNumber]);

  // ===== LOAD SCHEDULES WHEN SELECTED CHANGES (hoặc reloadTick) =====
  useEffect(() => {
    const fetchSchedules = async () => {
      const user = firebaseAuth.currentUser;
      if (!user || !selectedNumber) {
        setSchedules([]);
        return;
      }

      setLoadingSchedules(true);
      try {
        const snap = await get(
          ref(firebaseRtdb, `mortgageInterestSchedules/${user.uid}/${selectedNumber}`)
        );

        if (!snap.exists()) {
          setSchedules([]);
          return;
        }

        const rawVal = snap.val() as Record<string, MortgageInterestScheduleInDb>;
        const list: MortgageInterestSchedule[] = Object.keys(rawVal)
          .map((key) => {
            const r = rawVal[key];
            const yyyymm = (r.yyyymm ?? key).toString();

            const interestAmount = parseMoneyLike(r.interestAmount);

            // ✅ NEW: đọc thêm gốc + tổng (nếu có)
            const principalAmount = parseMoneyLike(r.principalAmount);
            const totalAmountRaw = parseMoneyLike(r.totalAmount);

            // ✅ fallback: nếu chưa có totalAmount thì suy ra
            const totalAmount =
              totalAmountRaw > 0
                ? totalAmountRaw
                : principalAmount > 0
                ? principalAmount + interestAmount
                : interestAmount;

            const paidAmount = parseMoneyLike(r.paidAmount);
            const paidFrom =
              typeof r.paidFrom === "string"
                ? r.paidFrom
                : typeof r.paidByAccountNumber === "string"
                ? r.paidByAccountNumber
                : undefined;

            return {
              yyyymm,
              interestAmount,
              principalAmount,
              totalAmount,
              status: toScheduleStatus(r.status),
              createdAt: typeof r.createdAt === "number" ? r.createdAt : undefined,
              paidAt: typeof r.paidAt === "number" ? r.paidAt : undefined,
              paidFrom,
              paidAmount: paidAmount > 0 ? paidAmount : undefined,
            };
          })
          .sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));

        setSchedules(list);
      } catch (err) {
        console.error("Lỗi đọc mortgageInterestSchedules:", err);
        setSchedules([]);
      } finally {
        setLoadingSchedules(false);
      }
    };

    fetchSchedules();
  }, [selectedNumber, reloadTick]);

  // ✅ khi quay về từ màn OTP confirm -> reload schedule + refresh primary account
  useEffect(() => {
    const st = asRecord(location.state);
    const paid = st ? asRecord(st["mortgageInterestPaid"]) : null;
    if (!paid) return;

    // clear state để tránh reload lặp
    navigate(location.pathname, { replace: true, state: null });

    setReloadTick(Date.now());

    const user = firebaseAuth.currentUser;
    if (!user) return;

    void (async () => {
      try {
        const payAcc = await getPrimaryAccount(user.uid);
        setPrimaryPayAcc(payAcc);
      } catch (err) {
        console.error("Refresh getPrimaryAccount error:", err);
      }
    })();
  }, [location.pathname, location.state, navigate]);

  const { yearlyRate, monthlyInterest, principalPerMonth, monthlyPayment, paymentCycleLabel } =
    useMemo(() => {
      if (!selectedAccount || selectedAccount.termMonths <= 0) {
        return {
          yearlyRate: 0,
          monthlyInterest: 0,
          principalPerMonth: 0,
          monthlyPayment: 0,
          paymentCycleLabel: "Hàng tháng",
        };
      }

      // ✅ nghiệp vụ: ưu tiên rate đã chốt theo hợp đồng (selectedAccount.rate)
      const fallbackRate =
        configRate != null && !Number.isNaN(configRate) ? configRate : DEFAULT_MORTGAGE_RATE;

      const rateToUse =
        selectedAccount.rate > 0 && Number.isFinite(selectedAccount.rate)
          ? selectedAccount.rate
          : fallbackRate;

      const monthlyRate = rateToUse / 100 / 12;
      const principalEachMonth = Math.round(selectedAccount.originalAmount / selectedAccount.termMonths);
      const interestEachMonth = Math.round(selectedAccount.debtRemaining * monthlyRate);

      return {
        yearlyRate: rateToUse,
        monthlyInterest: interestEachMonth,
        principalPerMonth: principalEachMonth,
        monthlyPayment: principalEachMonth + interestEachMonth,
        paymentCycleLabel: "Hàng tháng",
      };
    }, [selectedAccount, configRate]);

  const totalDebt = accounts.reduce((sum, a) => sum + a.debtRemaining, 0);

  const paidCount = useMemo(() => schedules.filter((s) => s.status === "PAID").length, [schedules]);

  const handlePayInterest = async (item: MortgageInterestSchedule) => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      navigate("/login");
      return;
    }
    if (!selectedNumber) {
      toast.error("Không xác định được tài khoản thế chấp.");
      return;
    }
    if (item.status !== "DUE") {
      toast.info("Kỳ này đã đóng.");
      return;
    }
    if (!primaryPayAcc?.accountNumber) {
      toast.error("Bạn chưa có tài khoản thanh toán để trích tiền đóng kỳ này.");
      return;
    }

    // ✅ tổng phải trả (gốc + lãi nếu có)
    const amountToPay =
      item.totalAmount > 0 ? item.totalAmount : item.principalAmount + item.interestAmount;

    if (amountToPay <= 0) {
      toast.error("Số tiền cần thanh toán không hợp lệ.");
      return;
    }

    setPayingKey(item.yyyymm);

    try {
      // ✅ Kiểm tra PIN trước
      const pin = await new Promise<string>((resolve, reject) => {
        const pinInput = prompt("Vui lòng nhập mã PIN giao dịch:");
        if (!pinInput || !pinInput.trim()) {
          reject(new Error("Vui lòng nhập mã PIN giao dịch."));
          return;
        }
        resolve(pinInput.trim());
      });

      await verifyTransactionPin(user.uid, pin);

      // ✅ PIN đúng -> kiểm tra có cần sinh trắc không
      if (amountToPay >= HIGH_VALUE_THRESHOLD_VND) {
        // Chuyển sang màn hình sinh trắc
        navigate("/mortgage-interest-biometric-confirm", {
          state: {
            pendingMortgageInterest: {
              mortgageAccountNumber: selectedNumber,
              yyyymm: item.yyyymm,
              interestAmount: amountToPay,
              paymentAccountNumber: primaryPayAcc.accountNumber,
              pin,
              fromPath: location.pathname,
            },
          },
        });
      } else {
        // Không cần sinh trắc -> chuyển thẳng sang OTP
        navigate("/mortgage-interest-otp-confirm", {
          state: {
            fromPath: location.pathname,
            mortgageAccountNumber: selectedNumber,
            yyyymm: item.yyyymm,
            interestAmount: amountToPay,
            interestOnlyAmount: item.interestAmount,
            principalAmount: item.principalAmount,
            totalAmount: amountToPay,
            paymentAccountNumber: primaryPayAcc.accountNumber,
          },
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.";
      toast.error(message);
      console.error("Lỗi điều hướng đóng kỳ:", err);
    } finally {
      setPayingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/accounts")}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-primary-foreground hover:bg-white/25 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">Chi tiết tài khoản thế chấp</h1>
            <p className="text-sm text-primary-foreground/80">Số lượng: {accounts.length} tài khoản</p>
            <p className="text-xs text-primary-foreground/80">
              Tổng dư nợ còn lại: <span className="font-semibold">{formatMoney(totalDebt)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {loading && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Đang tải thông tin tài khoản thế chấp...</p>
          </Card>
        )}

        {!loading && accounts.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Bạn chưa có tài khoản thế chấp nào.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/accounts")}>
              Quay lại danh sách tài khoản
            </Button>
          </Card>
        )}

        {!loading && accounts.length > 0 && (
          <>
            {accounts.length > 1 && (
              <Card className="p-4 space-y-2">
                <p className="text-sm font-semibold">Danh sách tài khoản thế chấp</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {accounts.map((acc) => (
                    <Button
                      key={acc.number}
                      size="sm"
                      variant={acc.number === selectedNumber ? "default" : "outline"}
                      onClick={() => setSelectedNumber(acc.number)}
                    >
                      {acc.number}
                    </Button>
                  ))}
                </div>
              </Card>
            )}

            {selectedAccount && (
              <>
                <Card className="p-6 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Số tài khoản</span>
                    <span className="font-medium">{selectedAccount.number}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Số tiền vay ban đầu</span>
                    <span className="font-medium">{formatMoney(selectedAccount.originalAmount)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dư nợ còn lại</span>
                    <span className="font-semibold text-primary">{formatMoney(selectedAccount.debtRemaining)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kỳ hạn</span>
                    <span className="font-medium">
                      {selectedAccount.termMonths > 0 ? `${selectedAccount.termMonths} tháng` : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lãi suất</span>
                    <span className="font-medium">{yearlyRate}%/năm</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ngày bắt đầu vay</span>
                    <span className="font-medium">{formatDateDisplay(selectedAccount.startDate)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ngày đáo hạn</span>
                    <span className="font-medium">{formatDateDisplay(selectedAccount.maturityDate)}</span>
                  </div>
                </Card>

                <Card className="p-6 space-y-4">
                  <h2 className="text-sm font-semibold">Thông tin trả nợ định kỳ (ước tính)</h2>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tiền gốc phải trả mỗi tháng</span>
                    <span className="font-medium">{principalPerMonth > 0 ? formatMoney(principalPerMonth) : "—"}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tiền lãi mỗi tháng (ước tính)</span>
                    <span className="font-medium">{monthlyInterest > 0 ? formatMoney(monthlyInterest) : "—"}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tổng tiền phải trả mỗi kỳ</span>
                    <span className="font-semibold text-primary">{monthlyPayment > 0 ? formatMoney(monthlyPayment) : "—"}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Chu kỳ thanh toán</span>
                    <span className="font-medium">{paymentCycleLabel}</span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    Số tiền phải trả định kỳ chỉ là ước tính dựa trên dư nợ hiện tại, lãi suất và kỳ hạn.
                    Thực tế có thể thay đổi theo lịch thanh toán cụ thể.
                  </p>
                </Card>

                {/* LỊCH ĐÓNG KỲ (gốc + lãi nếu có) */}
                <Card className="p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">Lịch thanh toán</h2>
                      <p className="text-xs text-muted-foreground">
                        Mỗi tháng 1 kỳ. Kỳ hạn {selectedAccount.termMonths} tháng thường tạo{" "}
                        {selectedAccount.termMonths} dòng lịch.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Số kỳ</p>
                      <p className="text-sm font-semibold">
                        {paidCount} / {schedules.length}
                      </p>
                    </div>
                  </div>

                  {loadingSchedules && <p className="text-sm text-muted-foreground">Đang tải lịch thanh toán...</p>}

                  {!loadingSchedules && schedules.length === 0 && (
                    <p className="text-sm text-muted-foreground">Chưa có lịch thanh toán cho tài khoản này.</p>
                  )}

                  {!loadingSchedules && schedules.length > 0 && (
                    <div className="space-y-2">
                      {schedules.map((s) => {
                        const isPaid = s.status === "PAID";
                        const isPaying = payingKey === s.yyyymm;

                        const totalToShow =
                          s.totalAmount > 0 ? s.totalAmount : s.principalAmount + s.interestAmount;

                        const showBreakdown = s.principalAmount > 0; // chỉ hiện breakdown khi có gốc

                        return (
                          <div
                            key={s.yyyymm}
                            className="rounded-xl border bg-white px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{formatPeriodLabel(s.yyyymm)}</p>

                              <span
                                className={`inline-flex mt-1 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {isPaid ? "Đã đóng" : "Chưa đóng"}
                              </span>

                              {isPaid && s.paidAt ? (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Đã đóng lúc: {new Date(s.paidAt).toLocaleString("vi-VN")}
                                </p>
                              ) : null}

                              {showBreakdown && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Gốc: <span className="font-medium">{formatMoney(s.principalAmount)}</span>{" "}
                                  • Lãi: <span className="font-medium">{formatMoney(s.interestAmount)}</span>
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">Tổng phải trả</p>
                              <p className="text-sm font-semibold">{formatMoney(totalToShow)}</p>

                              {!isPaid && (
                                <Button
                                  size="sm"
                                  className="mt-2"
                                  disabled={isPaying || !primaryPayAcc?.accountNumber}
                                  onClick={() => handlePayInterest(s)}
                                >
                                  {isPaying ? "Đang xử lý..." : "Thanh toán"}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {selectedAccount.note && (
                  <Card className="p-6">
                    <p className="text-xs text-muted-foreground mb-1">Ghi chú</p>
                    <p className="text-sm">{selectedAccount.note}</p>
                  </Card>
                )}

                <Button className="w-full" variant="outline" onClick={() => navigate("/home")}>
                  Về trang chủ
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MortgageAccountDetail;
