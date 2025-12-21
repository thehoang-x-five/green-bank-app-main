// src/pages/SavingsAccountDetail.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { get, ref } from "firebase/database";
import { getPrimaryAccount, type BankAccount } from "@/services/accountService";

type SavingTermKey = "1m" | "3m" | "6m" | "12m";
type SavingStatus = "ACTIVE" | "CLOSED";

interface SavingAccountInDb {
  uid?: string;
  number?: string;
  amount?: number | string;
  term?: string;
  rate?: number | string; // %/năm (CHỐT theo hợp đồng)
  openDate?: string; // yyyy-mm-dd
  maturityDate?: string; // yyyy-mm-dd
  createdAt?: number;

  // ✅ bổ sung để hỗ trợ tất toán
  status?: string; // "ACTIVE" | "CLOSED"
  closedAt?: number;
  payoutAccountNumber?: string;
  payoutAmount?: number | string;
  interestAmountPaid?: number | string;
  isEarlyWithdrawal?: boolean;
  earlyRateApplied?: number | string;
}

interface SavingAccount {
  number: string;
  amount: number;
  term: string;
  rate: number; // %/năm (CHỐT theo hợp đồng)
  openDate: string;
  maturityDate: string;

  status: SavingStatus;
  closedAt?: number;
  payoutAccountNumber?: string;
  payoutAmount?: number;
  interestAmountPaid?: number;
  isEarlyWithdrawal?: boolean;
  earlyRateApplied?: number;
}

type SavingRateConfig = Partial<Record<SavingTermKey, number>>;

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
    const cleaned = v.replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const normalizeSavingStatus = (raw: unknown): SavingStatus => {
  const s = typeof raw === "string" ? raw.toUpperCase().trim() : "";
  return s === "CLOSED" ? "CLOSED" : "ACTIVE";
};

const getTermKeyFromLabel = (term: string): SavingTermKey | null => {
  const t = term.toLowerCase();
  if (t.includes("1 tháng")) return "1m";
  if (t.includes("3 tháng")) return "3m";
  if (t.includes("6 tháng")) return "6m";
  if (t.includes("12 tháng") || t.includes("1 năm")) return "12m";
  return null;
};

const getMonthsFromLabel = (term: string): number => {
  const t = term.toLowerCase();
  if (t.includes("1 tháng")) return 1;
  if (t.includes("3 tháng")) return 3;
  if (t.includes("6 tháng")) return 6;
  if (t.includes("12 tháng") || t.includes("1 năm")) return 12;
  return 12;
};

const toLocalIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

const SavingsAccountDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const accountParam = params.accountNumber ?? null;

  const [accounts, setAccounts] = useState<SavingAccount[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [rateConfig, setRateConfig] = useState<SavingRateConfig>({});
  const [loading, setLoading] = useState<boolean>(true);

  // ✅ TK thanh toán chính (nhận tiền khi tất toán)
  const [primaryPayAcc, setPrimaryPayAcc] = useState<BankAccount | null>(null);

  // ✅ “lãi không kỳ hạn” (nếu bạn muốn demo rút trước hạn có lãi nhỏ)
  // Nếu bạn muốn “mất toàn bộ lãi” thì cứ để 0.
  const [earlyRate, setEarlyRate] = useState<number>(0); // %/năm

  // trigger reload when coming back from OTP confirm
  const [reloadTick, setReloadTick] = useState<number>(0);

  // ========== LOAD DATA ==========
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

        // 1) Danh sách sổ tiết kiệm
        const savingSnap = await get(ref(firebaseRtdb, `savingAccounts/${user.uid}`));

        let list: SavingAccount[] = [];
        if (savingSnap.exists()) {
          const rawVal = savingSnap.val() as Record<string, SavingAccountInDb>;
          list = Object.keys(rawVal).map((key) => {
            const raw = rawVal[key];

            const amount = parseMoneyLike(raw.amount);
            const rate = parseMoneyLike(raw.rate);

            return {
              number: raw.number ?? key,
              amount: Number.isFinite(amount) ? amount : 0,
              term: raw.term ?? "",
              rate: Number.isFinite(rate) ? rate : 0,
              openDate: raw.openDate ?? "",
              maturityDate: raw.maturityDate ?? "",

              status: normalizeSavingStatus(raw.status),
              closedAt: typeof raw.closedAt === "number" ? raw.closedAt : undefined,
              payoutAccountNumber:
                typeof raw.payoutAccountNumber === "string" ? raw.payoutAccountNumber : undefined,
              payoutAmount: (() => {
                const n = parseMoneyLike(raw.payoutAmount);
                return n > 0 ? n : undefined;
              })(),
              interestAmountPaid: (() => {
                const n = parseMoneyLike(raw.interestAmountPaid);
                return n >= 0 ? n : undefined;
              })(),
              isEarlyWithdrawal: typeof raw.isEarlyWithdrawal === "boolean" ? raw.isEarlyWithdrawal : undefined,
              earlyRateApplied: (() => {
                const n = parseMoneyLike(raw.earlyRateApplied);
                return n >= 0 ? n : undefined;
              })(),
            };
          });
        }

        // Chọn sổ đang xem
        let initialNumber: string | null = null;
        if (accountParam && list.some((s) => s.number === accountParam)) {
          initialNumber = accountParam;
        } else if (list.length > 0) {
          initialNumber = list[0].number;
        }

        setAccounts(list);
        setSelectedNumber(initialNumber);

        // 2) Bảng lãi suất chung (chỉ để tham khảo UI)
        //    ✅ NHỚ: rate CHỐT theo hợp đồng -> KHÔNG override rate của sổ đã mở.
        const paths = ["interestConfig/saving", "config/rates/saving"];
        let cfg: SavingRateConfig = {};
        let found = false;

        for (const path of paths) {
          const rateSnap = await get(ref(firebaseRtdb, path));
          if (!rateSnap.exists()) continue;

          const rawCfg = rateSnap.val() as Record<string, unknown>;
          const tmp: SavingRateConfig = {};
          (["1m", "3m", "6m", "12m"] as SavingTermKey[]).forEach((k) => {
            const v = rawCfg[k];
            if (typeof v === "number") tmp[k] = v;
            else if (typeof v === "string" && v.trim() !== "") {
              const num = Number(v);
              if (!Number.isNaN(num)) tmp[k] = num;
            }
          });

          cfg = tmp;
          found = true;
          break;
        }

        setRateConfig(found ? cfg : {});

        // 3) (tuỳ chọn) đọc lãi không kỳ hạn để demo rút trước hạn có lãi nhỏ
        // Nếu node không tồn tại => earlyRate = 0 (mất lãi).
        const earlyPaths = ["interestConfig/savingEarlyRate", "config/rates/savingEarlyRate"];
        let early = 0;
        for (const p of earlyPaths) {
          const s = await get(ref(firebaseRtdb, p));
          if (!s.exists()) continue;
          const v = s.val();
          const num = parseMoneyLike(v);
          if (num >= 0 && num <= 99) early = num;
          break;
        }
        setEarlyRate(early);
      } catch (error) {
        console.error("Lỗi khi tải tài khoản tiết kiệm:", error);
        toast.error("Không thể tải thông tin tài khoản tiết kiệm.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accountParam, navigate, reloadTick]);

  const selectedAccount = useMemo(() => {
    if (!selectedNumber) return null;
    return accounts.find((a) => a.number === selectedNumber) ?? null;
  }, [accounts, selectedNumber]);

  // ✅ khi quay về từ màn OTP confirm -> reload lại danh sách sổ + refresh primary account
  useEffect(() => {
    const st = asRecord(location.state);
    const done = st ? asRecord(st["savingWithdrawn"]) : null;
    if (!done) return;

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

  const totalSaving = accounts.reduce((sum, a) => sum + a.amount, 0);

  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const isMatured = useMemo(() => {
    if (!selectedAccount?.maturityDate) return false;
    // yyyy-mm-dd có thể so sánh chuỗi được
    return todayIso >= selectedAccount.maturityDate;
  }, [selectedAccount?.maturityDate, todayIso]);

  // Tính toán lãi cho sổ đang chọn
  const interestInfo = useMemo(() => {
    if (!selectedAccount) {
      return {
        contractYearlyRate: 0,
        currentPolicyRate: null as number | null,
        monthlyInterest: 0,
        totalInterest: 0,
        maturityAmount: 0,
        earlyPayoutAmount: 0,
        earlyInterestEstimate: 0,
      };
    }

    const months = getMonthsFromLabel(selectedAccount.term);
    const principal = selectedAccount.amount;

    // ✅ rate theo hợp đồng: ưu tiên rate lưu trong sổ
    const contractYearlyRate =
      selectedAccount.rate > 0 && Number.isFinite(selectedAccount.rate) ? selectedAccount.rate : 0;

    // (tham khảo) rate hiện hành từ config
    const termKey = getTermKeyFromLabel(selectedAccount.term);
    const currentPolicyRate =
      termKey && rateConfig[termKey] != null && Number.isFinite(rateConfig[termKey]!)
        ? rateConfig[termKey]!
        : null;

    const yearlyRateToCalc = contractYearlyRate > 0 ? contractYearlyRate : (currentPolicyRate ?? 0);

    const monthlyRate = yearlyRateToCalc / 100 / 12;
    const monthlyInterest = principal > 0 ? Math.round(principal * monthlyRate) : 0;

    const totalInterest =
      principal > 0 && months > 0
        ? Math.round(principal * (yearlyRateToCalc / 100) * (months / 12))
        : 0;

    const maturityAmount = principal + totalInterest;

    // ✅ rút trước hạn:
    // - Nếu earlyRate = 0 => mất lãi (chỉ nhận gốc)
    // - Nếu earlyRate > 0 => demo “lãi nhỏ”: tạm tính theo tháng đã giữ (xấp xỉ)
    const earlyMonthlyRate = earlyRate > 0 ? earlyRate / 100 / 12 : 0;
    const earlyInterestEstimate =
      principal > 0 && earlyMonthlyRate > 0 ? Math.round(principal * earlyMonthlyRate) : 0;

    const earlyPayoutAmount = principal + earlyInterestEstimate;

    return {
      contractYearlyRate: contractYearlyRate > 0 ? contractYearlyRate : yearlyRateToCalc,
      currentPolicyRate,
      monthlyInterest,
      totalInterest,
      maturityAmount,
      earlyPayoutAmount,
      earlyInterestEstimate,
    };
  }, [selectedAccount, rateConfig, earlyRate]);

  const canWithdraw = useMemo(() => {
    if (!selectedAccount) return false;
    if (selectedAccount.status !== "ACTIVE") return false;
    if (selectedAccount.amount <= 0) return false;
    return true;
  }, [selectedAccount]);

  const handleWithdraw = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      navigate("/login");
      return;
    }
    if (!selectedAccount || !selectedNumber) {
      toast.error("Không xác định được sổ tiết kiệm.");
      return;
    }
    if (!primaryPayAcc?.accountNumber) {
      toast.error("Bạn chưa có tài khoản thanh toán để nhận tiền tất toán.");
      return;
    }
    if (!canWithdraw) {
      toast.error("Sổ tiết kiệm này không thể rút (đã tất toán hoặc số dư không hợp lệ).");
      return;
    }

    // ✅ chuẩn bị state cho màn PIN+OTP (giống thế chấp)
    const isEarly = !isMatured;
    const estimatedPayout = isEarly ? interestInfo.earlyPayoutAmount : interestInfo.maturityAmount;

    toast.info("Vui lòng nhập mã PIN giao dịch để gửi OTP xác thực.");

    navigate("/saving-withdraw-otp-confirm", {
      state: {
        fromPath: location.pathname,
        savingAccountNumber: selectedNumber,
        savingNumber: selectedNumber,
        isEarlyWithdrawal: isEarly,

        // để UI confirm hiển thị đẹp
        principal: selectedAccount.amount,
        contractRate: interestInfo.contractYearlyRate,
        maturityDate: selectedAccount.maturityDate,
        estimatedPayoutAmount: estimatedPayout,
        estimatedInterestAmount: isEarly ? interestInfo.earlyInterestEstimate : interestInfo.totalInterest,

        paymentAccountNumber: primaryPayAcc.accountNumber,
      },
    });
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
            <h1 className="text-xl font-bold text-primary-foreground">Chi tiết tài khoản tiết kiệm</h1>
            <p className="text-sm text-primary-foreground/80">Số lượng sổ: {accounts.length}</p>
            <p className="text-xs text-primary-foreground/80">
              Tổng số tiền gửi: <span className="font-semibold">{formatMoney(totalSaving)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {loading && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Đang tải thông tin tài khoản tiết kiệm...</p>
          </Card>
        )}

        {!loading && accounts.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Bạn chưa có tài khoản tiết kiệm nào.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/accounts")}>
              Quay lại danh sách tài khoản
            </Button>
          </Card>
        )}

        {!loading && accounts.length > 0 && (
          <>
            {/* Danh sách sổ để chọn */}
            {accounts.length > 1 && (
              <Card className="p-4 space-y-2">
                <p className="text-sm font-semibold">Danh sách sổ tiết kiệm</p>
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
                    <span className="text-muted-foreground">Số tiền gửi ban đầu</span>
                    <span className="font-medium">{formatMoney(selectedAccount.amount)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kỳ hạn</span>
                    <span className="font-medium">{selectedAccount.term || "—"}</span>
                  </div>

                  {/* ✅ rate chốt theo hợp đồng */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lãi suất theo hợp đồng</span>
                    <span className="font-medium">{interestInfo.contractYearlyRate}%/năm</span>
                  </div>

                  {/* (tham khảo) rate hiện hành */}
                  {interestInfo.currentPolicyRate != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Lãi suất hiện hành (tham khảo)</span>
                      <span className="text-muted-foreground">{interestInfo.currentPolicyRate}%/năm</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ngày mở</span>
                    <span className="font-medium">{formatDateDisplay(selectedAccount.openDate)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ngày đáo hạn</span>
                    <span className="font-medium">{formatDateDisplay(selectedAccount.maturityDate)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lợi nhuận hàng tháng (ước tính)</span>
                    <span className="font-medium">
                      {interestInfo.monthlyInterest > 0 ? formatMoney(interestInfo.monthlyInterest) : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tổng lãi sau kỳ hạn (ước tính)</span>
                    <span className="font-medium">
                      {interestInfo.totalInterest > 0 ? formatMoney(interestInfo.totalInterest) : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tổng nhận khi đáo hạn (ước tính)</span>
                    <span className="font-semibold text-primary">
                      {interestInfo.maturityAmount > 0 ? formatMoney(interestInfo.maturityAmount) : "—"}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground pt-2">
                    ✅ Lãi suất của sổ tiết kiệm được <b>chốt theo hợp đồng</b> tại thời điểm mở sổ. Khi ngân hàng đổi
                    bảng lãi suất, sổ đã mở vẫn giữ lãi suất cũ.
                  </p>
                </Card>

                {/* ✅ CARD TẤT TOÁN / RÚT TRƯỚC HẠN */}
                <Card className="p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">Tất toán sổ tiết kiệm</h2>
                      <p className="text-xs text-muted-foreground">
                        Rút <b>1 lần toàn bộ</b>. Đúng hạn nhận gốc + lãi; rút trước hạn {earlyRate > 0 ? "lãi nhỏ" : "mất lãi"}.
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        selectedAccount.status === "CLOSED"
                          ? "bg-slate-200 text-slate-700"
                          : isMatured
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {selectedAccount.status === "CLOSED"
                        ? "Đã tất toán"
                        : isMatured
                        ? "Đúng hạn"
                        : "Trước hạn"}
                    </span>
                  </div>

                  {selectedAccount.status === "CLOSED" ? (
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Số tiền đã chi</span>
                        <span className="font-semibold">
                          {selectedAccount.payoutAmount != null ? formatMoney(selectedAccount.payoutAmount) : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tài khoản nhận</span>
                        <span className="font-medium">{selectedAccount.payoutAccountNumber ?? "—"}</span>
                      </div>
                      {selectedAccount.closedAt ? (
                        <p className="text-[11px] text-muted-foreground">
                          Tất toán lúc: {new Date(selectedAccount.closedAt).toLocaleString("vi-VN")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tài khoản nhận tiền</span>
                          <span className="font-medium">{primaryPayAcc?.accountNumber ?? "—"}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {isMatured ? "Ước tính nhận (gốc + lãi)" : "Ước tính nhận (trước hạn)"}
                          </span>
                          <span className="font-semibold text-primary">
                            {formatMoney(isMatured ? interestInfo.maturityAmount : interestInfo.earlyPayoutAmount)}
                          </span>
                        </div>

                        {!isMatured && (
                          <p className="text-[11px] text-muted-foreground">
                            {earlyRate > 0
                              ? `Rút trước hạn: áp dụng lãi nhỏ (lãi không kỳ hạn) khoảng ${earlyRate}%/năm (ước tính).`
                              : "Rút trước hạn: mặc định mất lãi, chỉ nhận tiền gốc."}
                          </p>
                        )}

                        <p className="text-[11px] text-muted-foreground">
                          Khi bấm tất toán, hệ thống sẽ yêu cầu <b>mã PIN giao dịch</b> và <b>OTP email</b>.
                        </p>
                      </div>

                      <Button
                        className="w-full mt-2"
                        disabled={!canWithdraw || !primaryPayAcc?.accountNumber}
                        onClick={handleWithdraw}
                      >
                        {isMatured ? "Tất toán (gốc + lãi)" : "Rút trước hạn"}
                      </Button>
                    </>
                  )}
                </Card>

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

export default SavingsAccountDetail;
