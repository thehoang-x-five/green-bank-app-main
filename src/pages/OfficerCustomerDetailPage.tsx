// src/pages/OfficerCustomerDetailPage.tsx
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, User, CreditCard } from "lucide-react";

import { onAuthStateChanged } from "firebase/auth";
import { get, ref, set, update } from "firebase/database";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { toast } from "sonner";
import type { AppUserProfile } from "@/services/authService";
import { getPrimaryAccount } from "@/services/accountService";

type AccountStatus = "active" | "locked";
type Gender = "male" | "female" | "other";

interface SavingAccount {
  number: string;
  amount: number;
  term: string;
  rate: number; // %/năm (CHỐT theo hợp đồng)
  openDate: string; // yyyy-mm-dd
  maturityDate: string; // yyyy-mm-dd
}

interface MortgageAccount {
  number: string;
  originalAmount: number;
  debtRemaining: number;
  termMonths: number;
  rate: number; // %/năm (CHỐT theo hợp đồng)
  startDate: string; // yyyy-mm-dd
  maturityDate: string; // yyyy-mm-dd
  note: string;
}

interface Customer {
  id: string; // uid
  fullName: string;
  nationalId: string;
  dob: string;
  phone: string;
  email: string;
  gender: Gender;
  cif: string;
  idIssueDate: string; // yyyy-mm-dd
  idIssuePlace: string;
  permanentAddress: string;
  contactAddress: string;
  username: string;
  checkingAccountNumber: string;
  status: AccountStatus;
  checkingBalance: number;
  savings: SavingAccount[];
  mortgages: MortgageAccount[];
}

// map trạng thái trong form -> DB
const mapAccountStatusToDb = (status: AccountStatus): "ACTIVE" | "LOCKED" =>
  status === "active" ? "ACTIVE" : "LOCKED";

// Raw user lưu trong Realtime DB
type RawUserInDb = AppUserProfile & {
  cif?: string;
  cifCode?: string;
  nationalId?: string;
  cccd?: string;
  idNumber?: string;
  national_id?: string;
  phone?: string;
  phoneNumber?: string;
  dob?: string;
  gender?: string;
  idIssueDate?: string;
  placeOfIssue?: string;
  idIssuePlace?: string;
  permanentAddress?: string;
  contactAddress?: string;
  paymentAccountNumber?: string;
  primaryPaymentAccountNumber?: string;
  status?: string; // "ACTIVE" | "LOCKED"

  // eKYC có thể lưu theo nhiều field khác nhau
  ekycVerified?: boolean;
  isEkycVerified?: boolean;
  kycVerified?: boolean;
  ekyc_status?: string;
  ekycStatus?: string;
};

// Dữ liệu thô tài khoản tiết kiệm / thế chấp trên RTDB
interface SavingAccountInDb {
  uid?: string;
  number?: string;
  amount?: number | string;
  term?: string;
  rate?: number | string;
  openDate?: string;
  maturityDate?: string;
  createdAt?: number;
}

interface MortgageAccountInDb {
  uid?: string;
  number?: string;
  originalAmount?: number | string;
  debtRemaining?: number | string;
  termMonths?: number | string;
  rate?: number | string;
  startDate?: string;
  maturityDate?: string;
  note?: string;
  createdAt?: number;
}

type MortgageInterestStatus = "DUE" | "PAID";

interface MortgageInterestScheduleItemInDb {
  createdAt: number;
  interestAmount: number; // ✅ lãi kỳ
  status: MortgageInterestStatus;
  yyyymm: string;

  // ✅ bổ sung để khớp "kỳ = gốc + lãi" (không phá schema cũ)
  principalAmount?: number; // ✅ gốc kỳ
  totalAmount?: number; // ✅ tổng kỳ
}

/**
 * ✅ LÃI SUẤT: đọc từ interestConfig (OfficerRatesPage quản lý)
 * - saving: 1m,3m,6m,12m
 * - mortgage.baseRate
 */
type SavingTermKey = "1m" | "3m" | "6m" | "12m";

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

const TERM_LABEL_TO_KEY: Record<string, SavingTermKey> = {
  "Kỳ hạn 1 tháng": "1m",
  "Kỳ hạn 3 tháng": "3m",
  "Kỳ hạn 6 tháng": "6m",
  "Kỳ hạn 12 tháng": "12m",
};

const KEY_TO_MONTHS: Record<SavingTermKey, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

const parseRateNumber = (raw: unknown, fallback: number): number => {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.replace(/[^\d.-]/g, ""))
        : fallback;

  if (!Number.isFinite(n) || n < 0 || n > 99) return fallback;
  return n;
};

const getTermKeyFromLabel = (term: string): SavingTermKey => {
  return TERM_LABEL_TO_KEY[term] ?? "12m";
};

const getTermInfo = (
  term: string,
  savingRates?: Partial<Record<SavingTermKey, number>>
) => {
  const key = getTermKeyFromLabel(term);
  const months = KEY_TO_MONTHS[key];
  const rate = savingRates?.[key] ?? DEFAULT_SAVING_RATES[key];
  return { months, rate };
};

const formatCurrency = (value: number) => value.toLocaleString("vi-VN") + " VND";

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addMonths = (date: Date, months: number) => {
  const d = new Date(date.getTime());
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  return d;
};

const toYYYYMM = (iso: string) => {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length < 2) return "";
  const y = parts[0];
  const m = parts[1];
  if (!y || !m) return "";
  return `${y}${m}`;
};

const addMonthsIso = (iso: string, monthsToAdd: number) => {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;

  const y = Number(parts[0]);
  const m = Number(parts[1]);

  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return iso;
  }

  // ✅ dùng ngày = 1 để tránh lỗi nhảy tháng khi start rơi vào 29/30/31
  const dt = new Date(y, m - 1, 1);
  dt.setMonth(dt.getMonth() + monthsToAdd);
  return formatDate(dt);
};

// Ví dụ start=2025-12-19, term=3 => ["202512","202601","202602"]
const buildMonthKeys = (startIso: string, termMonths: number) => {
  const keys: string[] = [];
  for (let i = 0; i < termMonths; i++) {
    const iso = addMonthsIso(startIso, i);
    const k = toYYYYMM(iso);
    if (k) keys.push(k);
  }
  return keys;
};

// 2000-01-01 -> 01/01/2000 (ngày sinh)
const formatDobDisplay = (dobIso: string) => {
  if (!dobIso) return "";
  const [y, m, d] = dobIso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

// yyyy-mm-dd -> dd/mm/yyyy
const formatDateDisplay = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

// 01/01/2000 -> 2000-01-01
const parseDobFromDisplay = (value: string) => {
  const parts = value.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

// Chuẩn hoá giới tính từ profile.gender
const normalizeGender = (value?: string): Gender => {
  if (!value) return "other";
  const v = value.toString().toLowerCase().trim();

  if (v === "male" || v === "nam" || v === "m" || v === "1") {
    return "male";
  }
  if (v === "female" || v === "nu" || v === "nữ" || v === "f" || v === "0") {
    return "female";
  }
  if (v === "other" || v === "khac" || v === "khác") {
    return "other";
  }
  return "other";
};

// input trong các dialog mở tài khoản
const dialogInputClass =
  "rounded-xl border border-emerald-200 bg-white text-base h-10 px-3 focus-visible:outline-none focus-visible:border-emerald-700 focus-visible:ring-0 transition-colors";

// Customer rỗng làm default state
const EMPTY_CUSTOMER: Customer = {
  id: "",
  fullName: "",
  nationalId: "",
  dob: "",
  phone: "",
  email: "",
  gender: "other",
  cif: "",
  idIssueDate: "",
  idIssuePlace: "",
  permanentAddress: "",
  contactAddress: "",
  username: "",
  checkingAccountNumber: "",
  checkingBalance: 0,
  status: "active",
  savings: [],
  mortgages: [],
};

// Helper: tự sinh số tài khoản tiết kiệm / thế chấp
const generateSavingAccountNumber = () => {
  const ts = Date.now().toString().slice(-6);
  return `8${ts}`;
};

const generateMortgageAccountNumber = () => {
  const ts = Date.now().toString().slice(-6);
  return `9${ts}`;
};

const OfficerCustomerDetailPage = () => {
  const navigate = useNavigate();

  // Lấy param linh hoạt: customerId / uid / id (tuỳ router)
  const params = useParams();
  const typedParams = params as Record<string, string | undefined>;
  const customerId =
    typedParams.customerId ??
    typedParams.uid ??
    typedParams.id ??
    (Object.values(typedParams)[0] ?? "");

  // ===== THÔNG TIN NHÂN VIÊN (HEADER) =====
  const [staffProfile, setStaffProfile] = useState<AppUserProfile | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setStaffProfile(null);
        setLoadingStaff(false);
        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      try {
        const snap = await get(ref(firebaseRtdb, `users/${user.uid}`));
        if (!snap.exists()) {
          toast.error("Không tìm thấy hồ sơ nhân viên.");
          navigate("/login");
          return;
        }

        const raw = snap.val() as AppUserProfile;
        if (raw.role !== "OFFICER") {
          toast.error("Tài khoản này không phải nhân viên ngân hàng.");
          navigate("/home");
          return;
        }

        setStaffProfile(raw);
      } catch (error: unknown) {
        console.error("Lỗi tải profile nhân viên:", error);
        toast.error("Không tải được thông tin nhân viên.");
      } finally {
        setLoadingStaff(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const staffName = staffProfile?.username?.trim() || "Banking Officer";

  // ====== LOAD BẢNG LÃI SUẤT HIỆN HÀNH (interestConfig) ======
  const [bankSavingRates, setBankSavingRates] = useState<Record<SavingTermKey, number>>(
    DEFAULT_SAVING_RATES
  );

  const [bankMortgageRate, setBankMortgageRate] = useState<number>(DEFAULT_MORTGAGE_RATE);

  const [loadingRates, setLoadingRates] = useState<boolean>(true);

  const fetchInterestConfig = async () => {
    try {
      setLoadingRates(true);

      const cfgRef = ref(firebaseRtdb, "interestConfig");
      const snap = await get(cfgRef);

      // nếu chưa có -> seed default
      if (!snap.exists()) {
        await set(cfgRef, {
          saving: DEFAULT_SAVING_RATES,
          mortgage: { baseRate: DEFAULT_MORTGAGE_RATE },
        });

        setBankSavingRates(DEFAULT_SAVING_RATES);
        setBankMortgageRate(DEFAULT_MORTGAGE_RATE);

        return {
          savingRates: DEFAULT_SAVING_RATES,
          mortgageRate: DEFAULT_MORTGAGE_RATE,
        };
      }

      const data = snap.val() as InterestConfigFromDb;

      const savingRates: Record<SavingTermKey, number> = {
        ...DEFAULT_SAVING_RATES,
      };

      (Object.keys(DEFAULT_SAVING_RATES) as SavingTermKey[]).forEach((k) => {
        savingRates[k] = parseRateNumber(data.saving?.[k], DEFAULT_SAVING_RATES[k]);
      });

      const mortgageRate = parseRateNumber(data.mortgage?.baseRate, DEFAULT_MORTGAGE_RATE);

      setBankSavingRates(savingRates);
      setBankMortgageRate(mortgageRate);

      return { savingRates, mortgageRate };
    } catch (err) {
      console.error("Lỗi tải interestConfig:", err);
      // fallback
      setBankSavingRates(DEFAULT_SAVING_RATES);
      setBankMortgageRate(DEFAULT_MORTGAGE_RATE);
      return {
        savingRates: DEFAULT_SAVING_RATES,
        mortgageRate: DEFAULT_MORTGAGE_RATE,
      };
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    // load sớm để dialog hiển thị đúng rate
    fetchInterestConfig().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== THÔNG TIN KHÁCH HÀNG =====
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [isEkycVerified, setIsEkycVerified] = useState(false);

  // text hiển thị trạng thái eKYC khách hàng
  const ekycStatusLabel = isEkycVerified ? "Đã xác thực eKYC" : "Chưa xác thực eKYC";
  const ekycStatusClass = isEkycVerified ? "text-emerald-700" : "text-amber-700";

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!customerId) {
        setLoadingCustomer(false);
        return;
      }

      try {
        setLoadingCustomer(true);

        // 1. Lấy profile khách hàng
        const snap = await get(ref(firebaseRtdb, `users/${customerId}`));
        if (!snap.exists()) {
          toast.error("Không tìm thấy thông tin khách hàng.");
          setCustomer(EMPTY_CUSTOMER);
          return;
        }

        const raw = snap.val() as RawUserInDb;

        const gender = normalizeGender(raw.gender);
        const nationalId =
          raw.nationalId || raw.cccd || raw.idNumber || raw.national_id || "";
        const phone = raw.phone || raw.phoneNumber || "";
        const idIssueDate = raw.idIssueDate || "";
        const idIssuePlace = raw.placeOfIssue || raw.idIssuePlace || "";
        const cif = raw.cif || raw.cifCode || "";

        // 2. Lấy tài khoản thanh toán chính (nếu có)
        const primaryAccount = await getPrimaryAccount(customerId);

        const checkingAccountNumber =
          primaryAccount?.accountNumber ||
          raw.paymentAccountNumber ||
          raw.primaryPaymentAccountNumber ||
          "";
        const checkingBalance = primaryAccount?.balance ?? 0;

        let status: AccountStatus = "active";
        if (primaryAccount?.status === "LOCKED" || raw.status === "LOCKED") {
          status = "locked";
        }

        // 3. Lấy danh sách tài khoản TIẾT KIỆM từ Realtime DB
        let savings: SavingAccount[] = [];
        try {
          const savingSnap = await get(ref(firebaseRtdb, `savingAccounts/${customerId}`));
          if (savingSnap.exists()) {
            const val = savingSnap.val() as Record<string, SavingAccountInDb>;
            savings = Object.keys(val).map((key) => {
              const s = val[key];
              const term = String(s.term ?? "");
              const termInfo = getTermInfo(term); // fallback default
              const rateFromData =
                typeof s.rate === "number"
                  ? s.rate
                  : Number(s.rate ?? termInfo.rate) || termInfo.rate;

              return {
                number: s.number ?? key,
                amount: Number(s.amount ?? 0) || 0,
                term,
                rate: rateFromData,
                openDate: s.openDate ?? "",
                maturityDate: s.maturityDate ?? "",
              };
            });
          }
        } catch (err: unknown) {
          console.error("Lỗi đọc savingAccounts:", err);
        }

        // 4. Lấy danh sách tài khoản THẾ CHẤP từ Realtime DB
        let mortgages: MortgageAccount[] = [];
        try {
          const mortgageSnap = await get(ref(firebaseRtdb, `mortgageAccounts/${customerId}`));
          if (mortgageSnap.exists()) {
            const val = mortgageSnap.val() as Record<string, MortgageAccountInDb>;
            mortgages = Object.keys(val).map((key) => {
              const m = val[key];

              const parsedRate =
                typeof m.rate === "number"
                  ? m.rate
                  : Number(m.rate ?? NaN);

              const safeRate =
                Number.isFinite(parsedRate) && parsedRate > 0
                  ? parsedRate
                  : DEFAULT_MORTGAGE_RATE;

              return {
                number: m.number ?? key,
                originalAmount: Number(m.originalAmount ?? 0) || 0,
                debtRemaining: Number(m.debtRemaining ?? 0) || 0,
                termMonths: Number(m.termMonths ?? 0) || 0,
                rate: safeRate,
                startDate: m.startDate ?? "",
                maturityDate: m.maturityDate ?? "",
                note: m.note ?? "Khoản vay thế chấp",
              };
            });
          }
        } catch (err: unknown) {
          console.error("Lỗi đọc mortgageAccounts:", err);
        }

        // 5. Check eKYC (bắt nhiều kiểu field cho chắc)
        const ekyc =
          !!raw.ekycVerified ||
          !!raw.isEkycVerified ||
          !!raw.kycVerified ||
          raw.ekyc_status === "VERIFIED" ||
          raw.ekycStatus === "VERIFIED";

        setIsEkycVerified(ekyc);

        setCustomer({
          id: customerId,
          fullName: raw.username ?? "",
          nationalId,
          dob: raw.dob ?? "",
          phone,
          email: raw.email ?? "",
          gender,
          cif,
          idIssueDate,
          idIssuePlace,
          permanentAddress: raw.permanentAddress ?? "",
          contactAddress: raw.contactAddress ?? "",
          username: raw.username ?? "",
          checkingAccountNumber,
          checkingBalance,
          status,
          savings,
          mortgages,
        });
      } catch (error: unknown) {
        console.error("Lỗi tải thông tin khách hàng:", error);
        toast.error("Không tải được thông tin khách hàng.");
        setCustomer(EMPTY_CUSTOMER);
      } finally {
        setLoadingCustomer(false);
      }
    };

    fetchCustomer();
  }, [customerId]);

  // ===== STATE FORM MỞ TIẾT KIỆM & THẾ CHẤP =====
  const [showSavingForm, setShowSavingForm] = useState(false);
  const [showMortgageForm, setShowMortgageForm] = useState(false);

  const [newSaving, setNewSaving] = useState({
    number: "",
    amount: "",
    term: "Kỳ hạn 6 tháng",
  });

  const [newMortgage, setNewMortgage] = useState({
    number: "",
    originalAmount: "",
    debtRemaining: "",
    termMonths: "60",
    rate: DEFAULT_MORTGAGE_RATE.toString(),
    note: "Vay mua nhà / vay tiêu dùng...",
  });

  const [selectedSavingNumber, setSelectedSavingNumber] = useState<string | null>(null);
  const [selectedMortgageNumber, setSelectedMortgageNumber] = useState<string | null>(null);

  const [savingDetailOpen, setSavingDetailOpen] = useState(false);
  const [mortgageDetailOpen, setMortgageDetailOpen] = useState(false);

  // ✅ Lưu hồ sơ khách hàng + trạng thái tài khoản
  const handleSaveCustomerInfo = async (e: FormEvent) => {
    e.preventDefault();

    if (!customer.id) {
      toast.error("Không xác định được khách hàng.");
      return;
    }

    try {
      // 1️⃣ Cập nhật hồ sơ khách hàng trong node users/{uid}
      const userRef = ref(firebaseRtdb, `users/${customer.id}`);

      const userUpdates: Record<string, unknown> = {
        // thông tin cơ bản
        username: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        phoneNumber: customer.phone,
        dob: customer.dob,
        gender: customer.gender,

        // giấy tờ & địa chỉ
        nationalId: customer.nationalId,
        cccd: customer.nationalId,
        idNumber: customer.nationalId,
        idIssueDate: customer.idIssueDate,
        placeOfIssue: customer.idIssuePlace,
        idIssuePlace: customer.idIssuePlace,
        permanentAddress: customer.permanentAddress,
        contactAddress: customer.contactAddress,

        // CIF + tài khoản thanh toán
        cif: customer.cif,
        cifCode: customer.cif,
        paymentAccountNumber: customer.checkingAccountNumber,
        primaryPaymentAccountNumber: customer.checkingAccountNumber,

        // trạng thái tổng thể
        status: mapAccountStatusToDb(customer.status),
      };

      // Nếu officer mở khóa lại thì reset bộ đếm PIN
      if (customer.status === "active") {
        userUpdates.pinFailCount = 0;
        userUpdates.pinLockedUntil = null;
        userUpdates.biometricFailCount = 0;
        userUpdates.biometricLockedUntil = null;
      }

      await update(userRef, userUpdates);

      // 2️⃣ Đồng bộ trạng thái tài khoản thanh toán trong node accounts
      if (customer.checkingAccountNumber) {
        const accRef = ref(firebaseRtdb, `accounts/${customer.checkingAccountNumber}`);

        const accUpdates: Record<string, unknown> = {
          status: mapAccountStatusToDb(customer.status),
          uid: customer.id,
        };

        await update(accRef, accUpdates);
      }

      toast.success("Đã lưu thay đổi hồ sơ khách hàng.");
    } catch (error: unknown) {
      console.error("Lỗi lưu hồ sơ khách hàng:", error);
      toast.error("Không thể lưu thay đổi. Vui lòng thử lại.");
    }
  };

  // ===== TIẾT KIỆM – tính lãi form mở mới =====
  const termInfo = getTermInfo(newSaving.term, bankSavingRates);
  const principal = Number(newSaving.amount.replace(/[^\d]/g, "")) || 0;
  const yearlyRate = termInfo.rate;
  const months = termInfo.months;

  const monthlyRate = yearlyRate / 100 / 12;
  const monthlyInterest = principal > 0 ? Math.round(principal * monthlyRate) : 0;
  const totalInterest =
    principal > 0 ? Math.round(principal * (yearlyRate / 100) * (months / 12)) : 0;
  const maturityAmount = principal + totalInterest;

  const today = new Date();
  const openDateStr = formatDate(today);
  const maturityDateStr = formatDate(addMonths(today, months));

  const handleCreateSaving = async (e: FormEvent) => {
    e.preventDefault();

    if (!customer.id) {
      toast.error("Không xác định được khách hàng.");
      return;
    }

    if (!isEkycVerified) {
      toast.error("Khách hàng chưa hoàn tất eKYC nên không thể mở tài khoản tiết kiệm.");
      return;
    }

    if (!newSaving.amount) {
      toast.error("Vui lòng nhập Số tiền gửi ban đầu.");
      return;
    }
    if (principal <= 0) {
      toast.error("Số tiền gửi ban đầu phải lớn hơn 0.");
      return;
    }

    // ✅ CHỐT RATE theo interestConfig tại thời điểm mở
    const cfg = await fetchInterestConfig();
    const contractTermInfo = getTermInfo(newSaving.term, cfg.savingRates);
    const contractRate = contractTermInfo.rate;
    const contractMonths = contractTermInfo.months;

    const openDate = formatDate(new Date());
    const maturityDate = formatDate(addMonths(new Date(), contractMonths));

    // Đảm bảo có số tài khoản tự sinh
    const accountNumber = newSaving.number || generateSavingAccountNumber();

    try {
      const savingRef = ref(firebaseRtdb, `savingAccounts/${customer.id}/${accountNumber}`);

      await set(savingRef, {
        uid: customer.id,
        number: accountNumber,
        amount: principal,
        term: newSaving.term,
        rate: contractRate, // ✅ chốt theo hợp đồng
        openDate,
        maturityDate,
        createdAt: Date.now(),
      });

      setCustomer((prev) => ({
        ...prev,
        savings: [
          ...prev.savings,
          {
            number: accountNumber,
            amount: principal,
            term: newSaving.term,
            rate: contractRate,
            openDate,
            maturityDate,
          },
        ],
      }));

      setNewSaving({
        number: "",
        amount: "",
        term: "Kỳ hạn 6 tháng",
      });
      setShowSavingForm(false);
      setSelectedSavingNumber(accountNumber);

      toast.success("Mở tài khoản tiết kiệm thành công.");
    } catch (error: unknown) {
      console.error("Lỗi khi tạo tài khoản tiết kiệm:", error);
      toast.error("Không thể mở tài khoản tiết kiệm. Vui lòng thử lại.");
    }
  };

  // ===== THẾ CHẤP – dữ liệu form mở mới =====
  const loanOriginal = Number(newMortgage.originalAmount.replace(/[^\d]/g, "")) || 0;
  const loanTermMonths = Number(newMortgage.termMonths) || 0;

  // Dư nợ = số tiền vay ban đầu khi tạo mới
  const loanOutstanding = loanOriginal;

  // ✅ Lãi suất hiển thị trong dialog (đã set theo interestConfig khi mở form)
  const rateParsed = Number(newMortgage.rate);
  const loanRateUi =
    Number.isFinite(rateParsed) && rateParsed > 0 ? rateParsed : bankMortgageRate;

  const loanStartDateStr = formatDate(today);
  const loanMaturityDateStr =
    loanTermMonths > 0 ? formatDate(addMonths(today, loanTermMonths)) : loanStartDateStr;

  const loanMonthlyRate = loanRateUi / 100 / 12;

  const loanMonthlyInterest =
    loanOutstanding > 0 && loanRateUi > 0 ? Math.round(loanOutstanding * loanMonthlyRate) : 0;

  const loanPrincipalPerMonth =
    loanTermMonths > 0 && loanOriginal > 0 ? Math.round(loanOriginal / loanTermMonths) : 0;

  const loanMonthlyPayment =
    loanPrincipalPerMonth > 0 && loanMonthlyInterest > 0
      ? loanPrincipalPerMonth + loanMonthlyInterest
      : 0;

  const handleCreateMortgage = async (e: FormEvent) => {
    e.preventDefault();

    if (!customer.id) {
      toast.error("Không xác định được khách hàng.");
      return;
    }

    if (!isEkycVerified) {
      toast.error("Khách hàng chưa hoàn tất eKYC nên không thể mở tài khoản thế chấp.");
      return;
    }

    if (loanOriginal <= 0) {
      toast.error("Vui lòng nhập Số tiền vay ban đầu > 0.");
      return;
    }
    if (loanTermMonths <= 0) {
      toast.error("Vui lòng chọn Kỳ hạn khoản vay hợp lệ.");
      return;
    }

    // ✅ CHỐT RATE theo interestConfig tại thời điểm mở khoản vay
    const cfg = await fetchInterestConfig();
    const contractRate = cfg.mortgageRate;

    // Đảm bảo có số tài khoản tự sinh
    const accountNumber = newMortgage.number || generateMortgageAccountNumber();

    try {
      const createdAt = Date.now();

      // Path đúng theo node bạn đang dùng
      const mortgagePath = `mortgageAccounts/${customer.id}/${accountNumber}`;
      const scheduleBasePath = `mortgageInterestSchedules/${customer.id}/${accountNumber}`;

      const monthKeys = buildMonthKeys(loanStartDateStr, loanTermMonths);

      // ✅ tính theo kỳ: gốc chia đều + lãi giảm dần theo dư nợ
      const principalPerMonth =
        loanTermMonths > 0 ? Math.round(loanOriginal / loanTermMonths) : 0;

      let outstanding = loanOriginal;
      const monthlyRate = contractRate / 100 / 12;

      // Multi-path update: ghi 1 lần để không lệch dữ liệu
      const updates: Record<string, unknown> = {};

      // 1) Tạo khoản vay (rate lưu vào đây = rate “chốt hợp đồng”)
      updates[mortgagePath] = {
        uid: customer.id,
        number: accountNumber,
        originalAmount: loanOriginal,
        debtRemaining: loanOutstanding,
        termMonths: loanTermMonths,
        rate: contractRate, // ✅ chốt theo hợp đồng
        startDate: loanStartDateStr,
        maturityDate: loanMaturityDateStr,
        note: newMortgage.note || "Khoản vay thế chấp",
        createdAt,
      };

      // 2) Tạo lịch kỳ theo tháng (gốc + lãi)
      for (const yyyymm of monthKeys) {
        const interestAmount =
          outstanding > 0 && contractRate > 0 ? Math.round(outstanding * monthlyRate) : 0;

        const principalAmount =
          principalPerMonth > 0 ? Math.min(outstanding, principalPerMonth) : 0;

        const totalAmount = principalAmount + interestAmount;

        const item: MortgageInterestScheduleItemInDb = {
          createdAt,
          interestAmount,
          principalAmount, // ✅ gốc kỳ
          totalAmount, // ✅ tổng kỳ
          status: "DUE",
          yyyymm,
        };

        updates[`${scheduleBasePath}/${yyyymm}`] = item;

        // giảm dư nợ cho kỳ tiếp theo (để lãi giảm dần theo lịch)
        outstanding = Math.max(0, outstanding - principalAmount);
      }

      await update(ref(firebaseRtdb), updates);

      // Update UI state (giữ nguyên logic cũ)
      setCustomer((prev) => ({
        ...prev,
        mortgages: [
          ...prev.mortgages,
          {
            number: accountNumber,
            originalAmount: loanOriginal,
            debtRemaining: loanOutstanding,
            termMonths: loanTermMonths,
            rate: contractRate,
            startDate: loanStartDateStr,
            maturityDate: loanMaturityDateStr,
            note: newMortgage.note || "Khoản vay thế chấp",
          },
        ],
      }));

      setNewMortgage({
        number: "",
        originalAmount: "",
        debtRemaining: "",
        termMonths: "60",
        rate: DEFAULT_MORTGAGE_RATE.toString(),
        note: "Vay mua nhà / vay tiêu dùng...",
      });
      setShowMortgageForm(false);
      setSelectedMortgageNumber(accountNumber);

      toast.success("Mở tài khoản thế chấp thành công (đã tạo lịch kỳ gốc + lãi).");
    } catch (error: unknown) {
      console.error("Lỗi khi tạo tài khoản thế chấp:", error);
      toast.error("Không thể mở tài khoản thế chấp. Vui lòng thử lại.");
    }
  };

  const selectedSaving = customer.savings.find((s) => s.number === selectedSavingNumber);
  const selectedMortgage = customer.mortgages.find((m) => m.number === selectedMortgageNumber);

  let selectedSavingMonthlyInterest = 0;
  let selectedSavingTotalInterest = 0;
  let selectedSavingMaturityAmount = 0;

  if (selectedSaving) {
    const info = getTermInfo(selectedSaving.term);
    const p = selectedSaving.amount;
    const r = selectedSaving.rate;
    const m = info.months;
    const mr = r / 100 / 12;
    selectedSavingMonthlyInterest = Math.round(p * mr);
    selectedSavingTotalInterest = Math.round(p * (r / 100) * (m / 12));
    selectedSavingMaturityAmount = p + selectedSavingTotalInterest;
  }

  let selectedMortgageMonthlyInterest = 0;
  let selectedMortgageMonthlyPayment = 0;

  if (selectedMortgage) {
    const mr = selectedMortgage.rate / 100 / 12;
    selectedMortgageMonthlyInterest = Math.round(selectedMortgage.debtRemaining * mr);

    const principalPerMonth =
      selectedMortgage.termMonths > 0
        ? Math.round(selectedMortgage.originalAmount / selectedMortgage.termMonths)
        : 0;

    selectedMortgageMonthlyPayment = principalPerMonth + selectedMortgageMonthlyInterest;
  }

  // ===== TRƯỜNG HỢP KHÔNG CÓ customerId TRONG URL =====
  if (!customerId) {
    return (
      <div className="min-h-screen bg-slate-50 pb-10">
        {/* Header */}
        <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">Quản lý khách hàng</p>
              <button
                type="button"
                onClick={() => navigate("/officer")}
                className="inline-flex items-center gap-2 text-xs text-emerald-100 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </button>
            </div>

            <div className="text-right text-xs">
              {loadingStaff ? (
                <>
                  <p className="font-semibold">Đang tải...</p>
                  <p className="text-emerald-100">Vai trò: Banking Officer</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">{staffName}</p>
                  <p className="text-emerald-100">Vai trò: Banking Officer</p>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mt-4 px-4">
          <div className="max-w-3xl mx-auto space-y-4">
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="py-8 text-center space-y-4">
                <p className="text-sm text-red-600 font-medium">
                  Không tìm thấy mã khách hàng trong đường dẫn.
                </p>
                <Button onClick={() => navigate("/officer/customers")}>
                  Quay lại danh sách khách hàng
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white px-4 pt-6 pb-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">Quản lý khách hàng</p>
            <button
              type="button"
              onClick={() => navigate("/officer")}
              className="inline-flex items-center gap-2 text-xs text-emerald-100 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </button>
          </div>

          <div className="text-right text-xs">
            {loadingStaff ? (
              <>
                <p className="font-semibold">Đang tải...</p>
                <p className="text-emerald-100">Vai trò: Banking Officer</p>
              </>
            ) : (
              <>
                <p className="font-semibold">{staffName}</p>
                <p className="text-emerald-100">Vai trò: Banking Officer</p>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mt-4 px-4">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* 1. Hồ sơ khách hàng */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-7 w-7 text-emerald-600" />
                1. Hồ sơ khách hàng
              </CardTitle>
              <p className={`text-[11px] md:text-xs font-medium ${ekycStatusClass}`}>
                Trạng thái eKYC khách hàng:{" "}
                <span className="font-semibold">{ekycStatusLabel}</span>
              </p>
            </CardHeader>

            <CardContent>
              {loadingCustomer ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Đang tải hồ sơ khách hàng...
                </p>
              ) : (
                <form className="space-y-4" onSubmit={handleSaveCustomerInfo}>
                  <div className="space-y-3">
                    {/* Họ tên */}
                    <div className="flex items-center gap-2">
                      <Label className="w-28 text-xs md:text-sm shrink-0">
                        Họ và tên :
                      </Label>
                      <Input
                        className="flex-1 h-9 text-sm"
                        value={customer.fullName}
                        onChange={(e) =>
                          setCustomer({
                            ...customer,
                            fullName: e.target.value,
                          })
                        }
                      />
                    </div>

                    {/* CIF */}
                    <div className="flex items-center gap-2">
                      <Label className="w-28 text-xs md:text-sm shrink-0">
                        Mã khách hàng (CIF) :
                      </Label>
                      <Input className="flex-1 h-9 text-sm" value={customer.cif || "Chưa cấp"} disabled />
                    </div>

                    {/* CCCD */}
                    <div className="flex items-center gap-2">
                      <Label className="w-28 text-xs md:text-sm shrink-0">
                        CCCD / CMND :
                      </Label>
                      <Input className="flex-1 h-9 text-sm" value={customer.nationalId} disabled />
                    </div>

                    {/* Ngày cấp CCCD */}
                    <div className="flex items-center gap-2">
                      <Label className="w-28 text-xs md:text-sm shrink-0">
                        Ngày cấp CCCD :
                      </Label>
                      <Input
                        type="text"
                        className="flex-1 h-9 text-sm"
                        placeholder="dd/mm/yyyy"
                        value={formatDateDisplay(customer.idIssueDate)}
                        onChange={(e) =>
                          setCustomer({
                            ...customer,
                            idIssueDate: parseDobFromDisplay(e.target.value),
                          })
                        }
                      />
                    </div>

                    {/* Nơi cấp */}
                    <div className="flex items-center gap-2">
                      <Label className="w-28 text-xs md:text-sm shrink-0">
                        Nơi cấp CCCD :
                      </Label>
                      <Input
                        className="flex-1 h-9 text-sm"
                        value={customer.idIssuePlace}
                        onChange={(e) =>
                          setCustomer({
                            ...customer,
                            idIssuePlace: e.target.value,
                          })
                        }
                      />
                    </div>

                    {/* Ngày sinh */}
                    <div className="flex items-center gap-2">
                      <Label className="w-28 text-xs md:text-sm shrink-0">
                        Ngày sinh :
                      </Label>
                      <Input
                        type="text"
                        className="flex-1 h-9 text-sm"
                        placeholder="dd/mm/yyyy"
                        value={formatDobDisplay(customer.dob)}
                        onChange={(e) =>
                          setCustomer({
                            ...customer,
                            dob: parseDobFromDisplay(e.target.value),
                          })
                        }
                      />
                    </div>

                    {/* Giới tính */}
                    <div className="flex items-center gap-2">
                      <Label className="w-28 text-xs md:text-sm shrink-0">
                        Giới tính :
                      </Label>
                      <Select
                        value={customer.gender}
                        onValueChange={(value: Gender) =>
                          setCustomer({
                            ...customer,
                            gender: value,
                          })
                        }
                      >
                        <SelectTrigger className="flex-1 h-9 text-sm">
                          <SelectValue placeholder="Chọn giới tính" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Nam</SelectItem>
                          <SelectItem value="female">Nữ</SelectItem>
                          <SelectItem value="other">Khác</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* SĐT */}
                    <div className="flex items-center gap-2">
                      <Label className="w-28 text-xs md:text-sm shrink-0">
                        Số điện thoại :
                      </Label>
                      <Input
                        className="flex-1 h-9 text-sm"
                        value={customer.phone}
                        onChange={(e) =>
                          setCustomer({
                            ...customer,
                            phone: e.target.value,
                          })
                        }
                      />
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2">
                      <Label className="w-28 text-xs md:text-sm shrink-0">
                        Email :
                      </Label>
                      <Input
                        type="email"
                        className="flex-1 h-9 text-sm"
                        value={customer.email}
                        onChange={(e) =>
                          setCustomer({
                            ...customer,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Địa chỉ thường trú */}
                  <div className="space-y-2">
                    <Label>Địa chỉ thường trú :</Label>
                    <Textarea
                      rows={2}
                      value={customer.permanentAddress}
                      onChange={(e) =>
                        setCustomer({
                          ...customer,
                          permanentAddress: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* Địa chỉ liên hệ */}
                  <div className="space-y-2">
                    <Label>Địa chỉ liên hệ / tạm trú :</Label>
                    <Textarea
                      rows={2}
                      value={customer.contactAddress}
                      onChange={(e) =>
                        setCustomer({
                          ...customer,
                          contactAddress: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Số tài khoản thanh toán</Label>
                      <Input
                        value={customer.checkingAccountNumber || "Chưa có tài khoản thanh toán"}
                        disabled
                      />
                    </div>
                    {/* ĐÃ BỎ Ô MÃ PIN GIAO DỊCH */}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-2">
                      <Label>Trạng thái tài khoản</Label>
                      <Select
                        value={customer.status}
                        onValueChange={(value: AccountStatus) =>
                          setCustomer({ ...customer, status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Đang hoạt động</SelectItem>
                          <SelectItem value="locked">Tạm khóa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/officer/customers")}
                      >
                        Hủy
                      </Button>
                      <Button type="submit">Lưu thay đổi</Button>
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* 2. Tài khoản ngân hàng */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-7 w-7 text-emerald-600" />
                2. Tài khoản ngân hàng
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-sm">
              {/* Tài khoản thanh toán */}
              <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-1">
                <p className="font-semibold">Tài khoản thanh toán</p>
                <p className="text-xs text-muted-foreground">
                  Số lượng tài khoản: {customer.checkingAccountNumber ? "1" : "0"}
                </p>
                <ul className="list-disc list-inside text-sm mt-1">
                  {customer.checkingAccountNumber ? (
                    <li>
                      {customer.checkingAccountNumber} –{" "}
                      {formatCurrency(customer.checkingBalance)}
                    </li>
                  ) : (
                    <li className="text-xs text-muted-foreground">
                      Chưa có tài khoản thanh toán.
                    </li>
                  )}
                </ul>
              </div>

              {/* Tài khoản tiết kiệm */}
              <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2">
                <p className="font-semibold">Tài khoản tiết kiệm</p>

                <Button
                  size="sm"
                  className="text-xs w-fit"
                  onClick={async () => {
                    if (!isEkycVerified) {
                      toast.error(
                        "Khách hàng chưa hoàn tất eKYC nên không thể mở tài khoản tiết kiệm."
                      );
                      return;
                    }
                    if (!customer.id) {
                      toast.error("Không xác định được khách hàng.");
                      return;
                    }

                    // ✅ load rate mới nhất trước khi mở dialog
                    await fetchInterestConfig();

                    const autoNumber = generateSavingAccountNumber();
                    setNewSaving({
                      number: autoNumber,
                      amount: "",
                      term: "Kỳ hạn 6 tháng",
                    });
                    setShowSavingForm(true);
                  }}
                >
                  Mở tài khoản tiết kiệm mới
                </Button>

                <p className="text-xs text-muted-foreground">
                  Số lượng tài khoản: {customer.savings.length}
                </p>

                <ul className="text-sm space-y-2 mt-1">
                  {customer.savings.map((s) => {
                    const isSelected = selectedSavingNumber === s.number;
                    const shortTerm = s.term.replace("Kỳ hạn ", "");

                    return (
                      <li
                        key={s.number}
                        className={`rounded-md px-3 py-2 cursor-pointer border ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-white hover:bg-slate-100"
                        }`}
                        onClick={() => {
                          setSelectedSavingNumber(s.number);
                          setSavingDetailOpen(true);
                        }}
                      >
                        <div className="flex flex-col">
                          <p className="font-semibold text-sm">
                            {s.number} - {formatCurrency(s.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">Kỳ hạn: {shortTerm}</p>
                          <p className="text-xs text-muted-foreground">Lãi suất: {s.rate}%/năm</p>
                        </div>
                      </li>
                    );
                  })}

                  {customer.savings.length === 0 && (
                    <li className="text-xs text-muted-foreground">
                      Chưa có tài khoản tiết kiệm nào.
                    </li>
                  )}
                </ul>
              </div>

              {/* Tài khoản thế chấp */}
              <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2">
                <p className="font-semibold">Tài khoản thế chấp</p>

                <Button
                  size="sm"
                  className="text-xs w-fit"
                  onClick={async () => {
                    if (!isEkycVerified) {
                      toast.error(
                        "Khách hàng chưa hoàn tất eKYC nên không thể mở tài khoản thế chấp."
                      );
                      return;
                    }
                    if (!customer.id) {
                      toast.error("Không xác định được khách hàng.");
                      return;
                    }

                    // ✅ load rate mới nhất trước khi mở dialog
                    const cfg = await fetchInterestConfig();

                    const autoNumber = generateMortgageAccountNumber();
                    setNewMortgage({
                      number: autoNumber,
                      originalAmount: "",
                      debtRemaining: "",
                      termMonths: "60",
                      rate: cfg.mortgageRate.toString(),
                      note: "Vay mua nhà / vay tiêu dùng...",
                    });
                    setShowMortgageForm(true);
                  }}
                >
                  Mở tài khoản thế chấp mới
                </Button>

                <p className="text-xs text-muted-foreground">
                  Số lượng tài khoản: {customer.mortgages.length}
                </p>

                <ul className="text-sm space-y-2 mt-1">
                  {customer.mortgages.map((m) => {
                    const isSelected = selectedMortgageNumber === m.number;

                    return (
                      <li
                        key={m.number}
                        className={`rounded-md px-3 py-2 cursor-pointer border ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-white hover:bg-slate-100"
                        }`}
                        onClick={() => {
                          setSelectedMortgageNumber(m.number);
                          setMortgageDetailOpen(true);
                        }}
                      >
                        <div className="flex flex-col">
                          <p className="font-semibold text-sm">
                            {m.number} - {formatCurrency(m.debtRemaining)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Kỳ hạn: {m.termMonths} tháng
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Lãi suất: {m.rate}%/năm
                          </p>
                        </div>
                      </li>
                    );
                  })}

                  {customer.mortgages.length === 0 && (
                    <li className="text-xs text-muted-foreground">
                      Chưa có tài khoản thế chấp nào.
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Dialog chi tiết tài khoản tiết kiệm */}
      {selectedSaving && (
        <Dialog open={savingDetailOpen} onOpenChange={setSavingDetailOpen}>
          <DialogContent className="w-[95vw] sm:w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-emerald-50 border-2 border-emerald-700 rounded-2xl shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-emerald-700">
                Chi tiết tài khoản tiết kiệm
              </DialogTitle>
              <DialogDescription>
                Thông tin sổ tiết kiệm khách hàng đang xem.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Số tài khoản</span>
                <span className="font-semibold text-right">{selectedSaving.number}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Số tiền gửi ban đầu</span>
                <span className="font-semibold text-right">
                  {formatCurrency(selectedSaving.amount)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Kỳ hạn</span>
                <span className="font-semibold text-right">{selectedSaving.term}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Lãi suất</span>
                <span className="font-semibold text-right">{selectedSaving.rate}%/năm</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ngày mở</span>
                <span className="text-right">{formatDateDisplay(selectedSaving.openDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ngày đáo hạn</span>
                <span className="text-right">
                  {formatDateDisplay(selectedSaving.maturityDate)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tiền lãi mỗi tháng</span>
                <span className="font-semibold text-right">
                  {formatCurrency(selectedSavingMonthlyInterest)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tổng lãi sau kỳ hạn</span>
                <span className="font-semibold text-right">
                  {formatCurrency(selectedSavingTotalInterest)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tổng nhận khi đáo hạn</span>
                <span className="font-semibold text-right">
                  {formatCurrency(selectedSavingMaturityAmount)}
                </span>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                className="bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={() => setSavingDetailOpen(false)}
              >
                Đóng
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog chi tiết tài khoản thế chấp */}
      {selectedMortgage && (
        <Dialog open={mortgageDetailOpen} onOpenChange={setMortgageDetailOpen}>
          {/* ✅ fix typo sm.max-w-md -> sm:max-w-md */}
          <DialogContent className="w-[95vw] sm:w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-emerald-50 border-2 border-emerald-700 rounded-2xl shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-emerald-700">
                Chi tiết tài khoản thế chấp
              </DialogTitle>
              <DialogDescription>
                Thông tin khoản vay thế chấp khách hàng đang xem.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Số tài khoản thế chấp</span>
                <span className="font-semibold text-right">{selectedMortgage.number}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Số tiền vay ban đầu</span>
                <span className="font-semibold text-right">
                  {formatCurrency(selectedMortgage.originalAmount)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Dư nợ còn lại</span>
                <span className="font-semibold text-right">
                  {formatCurrency(selectedMortgage.debtRemaining)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Kỳ hạn</span>
                <span className="text-right">{selectedMortgage.termMonths} tháng</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Lãi suất</span>
                <span className="text-right">{selectedMortgage.rate}%/năm</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ngày bắt đầu vay</span>
                <span className="text-right">{formatDateDisplay(selectedMortgage.startDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ngày đáo hạn</span>
                <span className="text-right">{formatDateDisplay(selectedMortgage.maturityDate)}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tiền lãi mỗi tháng (ước tính)</span>
                <span className="font-semibold text-right">
                  {formatCurrency(selectedMortgageMonthlyInterest)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Tổng tiền phải trả mỗi tháng
                  <br />
                  (gốc + lãi, ước tính)
                </span>
                <span className="font-semibold text-right">
                  {formatCurrency(selectedMortgageMonthlyPayment)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ghi chú</span>
                <span className="text-right">{selectedMortgage.note || "—"}</span>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                className="bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={() => setMortgageDetailOpen(false)}
              >
                Đóng
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog mở tài khoản TIẾT KIỆM mới */}
      <Dialog open={showSavingForm} onOpenChange={setShowSavingForm}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-white border border-emerald-200 rounded-2xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-emerald-700">Mở tài khoản tiết kiệm mới</DialogTitle>
            <DialogDescription>Nhập thông tin sổ tiết kiệm cho khách hàng.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSaving} className="space-y-3 pt-1 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Số tài khoản tiết kiệm</Label>
                <Input className={dialogInputClass} value={newSaving.number} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Số tiền gửi ban đầu</Label>
                <Input
                  className={dialogInputClass}
                  value={newSaving.amount}
                  onChange={(e) => setNewSaving({ ...newSaving, amount: e.target.value })}
                  placeholder="VD: 50,000,000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Kỳ hạn</Label>
                <Select
                  value={newSaving.term}
                  onValueChange={(value) => setNewSaving({ ...newSaving, term: value })}
                >
                  <SelectTrigger className={dialogInputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kỳ hạn 1 tháng">Kỳ hạn 1 tháng</SelectItem>
                    <SelectItem value="Kỳ hạn 3 tháng">Kỳ hạn 3 tháng</SelectItem>
                    <SelectItem value="Kỳ hạn 6 tháng">Kỳ hạn 6 tháng</SelectItem>
                    <SelectItem value="Kỳ hạn 12 tháng">Kỳ hạn 12 tháng</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Lãi suất (%/năm)</Label>
                <Input className={dialogInputClass} value={yearlyRate.toString()} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Tiền lãi mỗi tháng</Label>
                <Input
                  className={dialogInputClass}
                  value={principal > 0 ? formatCurrency(monthlyInterest) : ""}
                  disabled
                />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Tổng lãi sau kỳ hạn</Label>
                <Input
                  className={dialogInputClass}
                  value={principal > 0 ? formatCurrency(totalInterest) : ""}
                  disabled
                />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Tổng nhận khi đáo hạn</Label>
                <Input
                  className={dialogInputClass}
                  value={principal > 0 ? formatCurrency(maturityAmount) : ""}
                  disabled
                />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Ngày mở</Label>
                <Input className={dialogInputClass} value={formatDateDisplay(openDateStr)} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Ngày đáo hạn</Label>
                <Input
                  className={dialogInputClass}
                  value={formatDateDisplay(maturityDateStr)}
                  disabled
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSavingForm(false);
                  setNewSaving({ number: "", amount: "", term: "Kỳ hạn 6 tháng" });
                }}
              >
                Hủy
              </Button>
              <Button type="submit" size="sm">
                Tạo tài khoản tiết kiệm
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog mở tài khoản THẾ CHẤP mới */}
      <Dialog open={showMortgageForm} onOpenChange={setShowMortgageForm}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-white border border-emerald-200 rounded-2xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-emerald-700">Mở tài khoản thế chấp mới</DialogTitle>
            <DialogDescription>
              Nhập thông tin khoản vay thế chấp cho khách hàng.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMortgage} className="space-y-3 pt-1 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Số tài khoản thế chấp</Label>
                <Input className={dialogInputClass} value={newMortgage.number} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Số tiền vay ban đầu</Label>
                <Input
                  className={dialogInputClass}
                  value={newMortgage.originalAmount}
                  onChange={(e) =>
                    setNewMortgage({
                      ...newMortgage,
                      originalAmount: e.target.value,
                      debtRemaining: e.target.value,
                    })
                  }
                  placeholder="VD: 1,000,000,000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Dư nợ còn lại</Label>
                <Input className={dialogInputClass} value={newMortgage.debtRemaining} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Kỳ hạn (tháng)</Label>
                <Select
                  value={newMortgage.termMonths}
                  onValueChange={(value) => setNewMortgage({ ...newMortgage, termMonths: value })}
                >
                  <SelectTrigger className={dialogInputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 tháng</SelectItem>
                    <SelectItem value="24">24 tháng</SelectItem>
                    <SelectItem value="36">36 tháng</SelectItem>
                    <SelectItem value="60">60 tháng</SelectItem>
                    <SelectItem value="120">120 tháng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Lãi suất (%/năm)</Label>
                <Input className={dialogInputClass} value={newMortgage.rate} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Ngày bắt đầu vay</Label>
                <Input className={dialogInputClass} value={formatDateDisplay(loanStartDateStr)} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Ngày đáo hạn</Label>
                <Input
                  className={dialogInputClass}
                  value={formatDateDisplay(loanMaturityDateStr)}
                  disabled
                />
              </div>

              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">Tiền lãi mỗi tháng (ước tính)</Label>
                <Input
                  className={dialogInputClass}
                  value={loanMonthlyInterest > 0 ? formatCurrency(loanMonthlyInterest) : ""}
                  disabled
                />
              </div>

              <div className="space-y-1">
                <Label className="text-emerald-700 text-sm">
                  Tổng tiền phải trả mỗi tháng{" (gốc + lãi, ước tính)"}
                </Label>
                <Input
                  className={dialogInputClass}
                  value={loanMonthlyPayment > 0 ? formatCurrency(loanMonthlyPayment) : ""}
                  disabled
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-emerald-700 text-sm">Ghi chú khoản vay</Label>
                <Input
                  className={dialogInputClass}
                  value={newMortgage.note}
                  onChange={(e) => setNewMortgage({ ...newMortgage, note: e.target.value })}
                  placeholder="VD: Vay mua nhà, trả góp hàng tháng..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowMortgageForm(false);
                  setNewMortgage({
                    number: "",
                    originalAmount: "",
                    debtRemaining: "",
                    termMonths: "60",
                    rate: DEFAULT_MORTGAGE_RATE.toString(),
                    note: "Vay mua nhà / vay tiêu dùng...",
                  });
                }}
              >
                Hủy
              </Button>
              <Button type="submit" size="sm">
                Lưu tài khoản thế chấp mới
              </Button>
            </div>
          </form>

          {/* (Không đổi UI) */}
          {loadingRates && (
            <p className="text-[11px] text-muted-foreground">Đang tải bảng lãi suất...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfficerCustomerDetailPage;
