// src/pages/TransferToAccount.tsx
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getUserProfile, verifyTransactionPin } from "@/services/userService";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { onValue, query, ref, orderByChild, equalTo, get } from "firebase/database";

import {
  initiateTransferToAccount,
  type TransferToAccountRequest,
} from "@/services/transferService";

import { HIGH_VALUE_THRESHOLD_VND } from "@/services/biometricService";

type BeneficiaryFromState = {
  id?: string;
  name?: string;
  nickname?: string;
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
};

type SourceAccount = {
  accountNumber: string;
  balance: number;
  status: string;
};

type RtdbUser = {
  username?: string;
  fullName?: string;
  displayName?: string;

  // ✅ thêm các field để kiểm tra eligibility người thụ hưởng
  status?: string | null; // "ACTIVE" | "LOCKED"...
  canTransact?: boolean | null;

  // node user anh có thể dùng kycStatus hoặc ekycStatus + các biến thể
  kycStatus?: string | null;
  ekycStatus?: string | null;
  kyc_status?: string | null;
  ekyc_status?: string | null;

  [key: string]: unknown;
};

type RtdbAccount = {
  uid?: string;
  status?: string;
  [key: string]: unknown;
};

type ExternalAccount = {
  accountNumber?: string;
  name?: string;
  fullName?: string;
  ownerName?: string;
  username?: string;
  status?: string;
  bankName?: string;
  bankCode?: string;
  balance?: number | string;
  [key: string]: unknown;
};

type Step = "FORM" | "PIN";

/**
 * ✅ Support nhiều kiểu state để khỏi lệch:
 * - từ danh bạ: { beneficiary }
 * - từ biometric quay lại: { pendingRequest } hoặc { resume: { pendingRequest } }
 */
type RouteState = {
  beneficiary?: BeneficiaryFromState;
  pendingRequest?: TransferToAccountRequest;
  sessionId?: string;
  resume?: {
    pendingRequest?: TransferToAccountRequest;
  };
};

function generateSessionId(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ===== ✅ Format / Parse tiền VND (không any) =====
function formatVndWithDots(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";

  // bỏ số 0 ở đầu (trừ trường hợp "0")
  const normalized = digits.replace(/^0+(?=\d)/, "");

  // chèn dấu chấm theo nhóm 3
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseVndToNumber(input: string): number {
  const digits = input.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

// ===== ✅ Helpers check KYC/eKYC =====
function upper(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

function isKycVerified(u: RtdbUser): boolean {
  const s1 = upper(u.ekycStatus);
  const s2 = upper(u.kycStatus);
  const s3 = upper(u.ekyc_status);
  const s4 = upper(u.kyc_status);
  return s1 === "VERIFIED" || s2 === "VERIFIED" || s3 === "VERIFIED" || s4 === "VERIFIED";
}

function resolveDisplayName(u: RtdbUser): string {
  return (
    String(u.fullName ?? "").trim() ||
    String(u.username ?? "").trim() ||
    String(u.displayName ?? "").trim() ||
    ""
  );
}

const TransferToAccount = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const routeState = (location.state as RouteState | undefined) ?? undefined;
  const beneficiary: BeneficiaryFromState | undefined = routeState?.beneficiary;

  // Danh sách tài khoản nguồn của user hiện tại
  const [sourceAccounts, setSourceAccounts] = useState<SourceAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [step, setStep] = useState<Step>("FORM");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    sourceAccount: "",
    bank: beneficiary?.bankName ?? "",
    accountNumber: beneficiary?.accountNumber ?? "",
    beneficiaryName: beneficiary?.name ?? "",
    nickname: beneficiary?.nickname ?? "",
    amount: "",
    content: "",
    saveAccount: false,
  });

  // request tạm để chuyển sang bước PIN
  const [pendingRequest, setPendingRequest] =
    useState<TransferToAccountRequest | null>(null);
  const [pin, setPin] = useState("");

  // Tên người CHUYỂN
  const [senderName, setSenderName] = useState<string>("");

  const banks = [
    "VietBank",
    "Vietcombank",
    "BIDV",
    "Techcombank",
    "VietinBank",
    "ACB",
    "Agribank",
    "MB Bank",
    "VPBank",
  ];

  // ✅ Nếu quay lại từ màn biometric -> restore pendingRequest + mở lại step PIN
  useEffect(() => {
    const resumeReq =
      routeState?.pendingRequest ?? routeState?.resume?.pendingRequest;

    if (resumeReq) {
      setPendingRequest(resumeReq);
      setPin("");
      setStep("PIN");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== Load accounts ==========
  useEffect(() => {
    const currentUser = firebaseAuth.currentUser;

    if (!currentUser) {
      setSourceAccounts([]);
      setLoadingAccounts(false);
      return;
    }

    const q = query(
      ref(firebaseRtdb, "accounts"),
      orderByChild("uid"),
      equalTo(currentUser.uid)
    );

    const unsubscribe = onValue(
      q,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSourceAccounts([]);
          setLoadingAccounts(false);
          return;
        }

        const raw = snapshot.val() as Record<
          string,
          {
            uid: string;
            accountNumber: string;
            balance: number | string;
            status: string;
          }
        >;

        const list: SourceAccount[] = Object.values(raw).map((value) => ({
          accountNumber: value.accountNumber,
          balance:
            typeof value.balance === "number"
              ? value.balance
              : Number(value.balance) || 0,
          status: value.status || "ACTIVE",
        }));

        const active = list.filter((acc) => acc.status === "ACTIVE");

        setSourceAccounts(active);
        setLoadingAccounts(false);

        if (active.length > 0 && !formData.sourceAccount) {
          setFormData((prev) => ({
            ...prev,
            sourceAccount: active[0].accountNumber,
          }));
        }
      },
      (error) => {
        console.error("Lỗi đọc accounts:", error);
        setSourceAccounts([]);
        setLoadingAccounts(false);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== Lấy tên người CHUYỂN ==========
  useEffect(() => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    const userRef = ref(firebaseRtdb, `users/${currentUser.uid}`);
    get(userRef)
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.val() as RtdbUser;
        const name =
          (data.fullName || data.username || data.displayName || "")
            ?.toString()
            .trim() || "";
        if (!name) return;

        setSenderName(name);

        setFormData((prev) =>
          prev.content.trim()
            ? prev
            : { ...prev, content: `${name} chuyển tiền` }
        );
      })
      .catch((err) => {
        console.error("Lỗi đọc thông tin người chuyển:", err);
      });
  }, []);

  // ========== Lookup tên người nhận + CHECK eligibility ==========
  const lookupAndFillBeneficiaryName = async (): Promise<string> => {
    const bankName = formData.bank.trim();
    const accountNumber = formData.accountNumber.trim();
    if (!bankName || !accountNumber) return "";

    try {
      if (bankName === "VietBank") {
        let accSnap = await get(ref(firebaseRtdb, `accounts/${accountNumber}`));

        if (!accSnap.exists()) {
          const accQuery = query(
            ref(firebaseRtdb, "accounts"),
            orderByChild("accountNumber"),
            equalTo(accountNumber)
          );
          const listSnap = await get(accQuery);

          if (!listSnap.exists()) {
            toast.error("Không tìm thấy tài khoản nhận trong hệ thống VietBank.");
            setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
            return "";
          }

          const all = listSnap.val() as Record<string, { uid?: string; [key: string]: unknown }>;
          const firstKey = Object.keys(all)[0];
          accSnap = await get(ref(firebaseRtdb, `accounts/${firstKey}`));
        }

        if (!accSnap.exists()) {
          toast.error("Không tìm thấy tài khoản nhận trong hệ thống VietBank.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        const accData = accSnap.val() as RtdbAccount;

        // ✅ Rule 1: account nhận phải ACTIVE
        if (accData.status && upper(accData.status) !== "ACTIVE") {
          toast.error("Tài khoản thụ hưởng đang bị tạm khóa hoặc không hoạt động.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        const uid = accData.uid;
        if (typeof uid !== "string" || uid.trim() === "") {
          toast.error("Tài khoản thụ hưởng không hợp lệ.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        const userSnap = await get(ref(firebaseRtdb, `users/${uid}`));
        if (!userSnap.exists()) {
          toast.error("Không tìm thấy thông tin chủ tài khoản thụ hưởng.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        const userData = userSnap.val() as RtdbUser;

        // ✅ Rule 2: user nhận không LOCKED
        if (upper(userData.status) === "LOCKED") {
          toast.error("Tài khoản thụ hưởng đang bị tạm khóa hoặc không hoạt động.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        // ✅ Rule 3: user nhận phải KYC/eKYC VERIFIED
        if (!isKycVerified(userData)) {
          toast.error("Tài khoản thụ hưởng chưa hoàn tất eKYC, không thể nhận tiền.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        // ✅ Rule 4 (tuỳ): nếu canTransact = false thì chặn
        if (userData.canTransact === false) {
          toast.error("Tài khoản thụ hưởng chưa được bật quyền giao dịch, không thể nhận tiền.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        const name = resolveDisplayName(userData);
        if (!name) {
          toast.error("Không lấy được tên chủ tài khoản thụ hưởng.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        setFormData((prev) => ({ ...prev, beneficiaryName: name }));
        return name;
      }

      // ========== External bank ==========
      const extRef = ref(firebaseRtdb, `externalAccounts/${bankName}/${accountNumber}`);
      const extSnap = await get(extRef);

      if (!extSnap.exists()) {
        toast.error(`Không tìm thấy tài khoản ${accountNumber} tại ngân hàng ${bankName}.`);
        setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
        return "";
      }

      const extData = extSnap.val() as ExternalAccount;
      const extStatus = upper(extData.status);

      if (extStatus && extStatus !== "ACTIVE") {
        toast.error("Tài khoản nhận tại ngân hàng này hiện không hoạt động.");
        setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
        return "";
      }

      const extName =
        (extData.name ||
          extData.fullName ||
          extData.ownerName ||
          extData.username ||
          "")
          ?.toString()
          .trim() || "";

      if (!extName) {
        toast.error(`Không lấy được tên chủ tài khoản ${accountNumber} tại ngân hàng ${bankName}.`);
        setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
        return "";
      }

      setFormData((prev) => ({ ...prev, beneficiaryName: extName }));
      return extName;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Lỗi khi tra cứu thông tin tài khoản nhận.";
      console.error("lookupAndFillBeneficiaryName error:", error);
      toast.error(message);
      setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
      return "";
    }
  };

  // ========== Submit FORM -> PIN ==========
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!formData.sourceAccount) {
      toast.error("Vui lòng chọn tài khoản nguồn");
      return;
    }

    if (!formData.bank || !formData.accountNumber || !formData.amount) {
      toast.error("Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }

    if (
      formData.bank === "VietBank" &&
      formData.accountNumber.trim() === formData.sourceAccount.trim()
    ) {
      toast.error("Bạn không thể chuyển tiền tới chính tài khoản nguồn.");
      return;
    }

    // ✅ parse lại từ chuỗi có dấu chấm
    const amountNumber = parseVndToNumber(formData.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Số tiền không hợp lệ");
      return;
    }

    // ✅ luôn lookup lại để đảm bảo chặn đúng trạng thái mới nhất
    const beneficiaryName = await lookupAndFillBeneficiaryName();

    if (!beneficiaryName) {
      toast.error("Không thể tiếp tục vì tài khoản thụ hưởng không hợp lệ.");
      return;
    }

    const bankCode = formData.bank === "VietBank" ? "VIETBANK" : undefined;

    const trimmedContent = formData.content.trim();
    const autoContent =
      trimmedContent || (senderName ? `${senderName} chuyển tiền` : "Chuyển tiền");

    const req: TransferToAccountRequest = {
      sourceAccountNumber: formData.sourceAccount,
      bankName: formData.bank,
      bankCode,
      destinationAccountNumber: formData.accountNumber.trim(),
      destinationName: beneficiaryName,
      amount: amountNumber,
      content: autoContent,
      nickname: formData.nickname,
      saveRecipient: formData.saveAccount,
    };

    setPendingRequest(req);
    setPin("");
    setStep("PIN");
  };

  // ========== Confirm PIN -> (>=10tr) sang biometric, (<10tr) tạo txn -> OTP ==========
  const handleConfirmPin = async (): Promise<void> => {
    if (!pendingRequest) {
      toast.error("Thiếu thông tin giao dịch, vui lòng thực hiện lại.");
      setStep("FORM");
      return;
    }

    const trimmedPin = pin.trim();
    if (!trimmedPin) {
      toast.error("Vui lòng nhập mã PIN giao dịch.");
      return;
    }

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setIsSubmitting(true);
    let navigated = false;

    try {
      // 1) verify PIN (service sẽ tự tăng pinFailCount + khóa nếu quá 5 lần)
      await verifyTransactionPin(currentUser.uid, trimmedPin);

      // 2) HIGH VALUE -> sang màn biometric (KHÔNG tạo txn/OTP ở đây)
      if (pendingRequest.amount >= HIGH_VALUE_THRESHOLD_VND) {
        const sessionId = generateSessionId();
        navigated = true;
        navigate("/transfer/biometric", {
          state: { pendingRequest, sessionId },
        });
        return;
      }

      // 3) LOW VALUE -> tạo txn + Smart-OTP -> OTP
      const resp = await initiateTransferToAccount(pendingRequest);

      toast.success("Đã tạo Smart-OTP cho giao dịch chuyển tiền.");

      navigated = true;
      navigate("/transfer/otp", {
        state: {
          transfer: {
            transactionId: resp.transactionId,
            otpCode: resp.devOtpCode ?? "",
            expireAt: resp.expireAt,
            amount: pendingRequest.amount,
            content: pendingRequest.content,
            sourceAccountNumber: pendingRequest.sourceAccountNumber,
            destinationAccountNumber: pendingRequest.destinationAccountNumber,
            destinationName:
              pendingRequest.destinationName ?? pendingRequest.destinationAccountNumber,
            bankName: pendingRequest.bankName,
          },
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Có lỗi xảy ra khi xác thực PIN hoặc tạo giao dịch.";

      toast.error(message);

      // ✅ Nếu là lỗi sai PIN -> hiển thị số lần còn lại
      if (
        error instanceof Error &&
        (error.message.includes("Mã PIN giao dịch không đúng") ||
          (error.message.toLowerCase().includes("pin") && error.message.toLowerCase().includes("không đúng")))
      ) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          if (profile) {
            const withPin = profile as {
              pinFailCount?: number | null;
              status?: string | null;
            };

            const failCount = withPin.pinFailCount ?? 0;
            const remaining = Math.max(0, 5 - failCount);
            const isLocked = (withPin.status ?? "").toString().toUpperCase() === "LOCKED";

            if (isLocked || remaining <= 0) {
              toast.error(
                "Bạn đã nhập sai mã PIN quá 5 lần. Tài khoản đã bị tạm khóa. Vui lòng liên hệ nhân viên để mở khóa."
              );
            } else {
              toast.error(`Sai mã PIN. Bạn còn ${remaining} lần thử trước khi tài khoản bị tạm khóa.`);
            }
          }
        } catch (err: unknown) {
          console.error("Không lấy được số lần sai PIN:", err);
        }
      }
    } finally {
      if (!navigated) setIsSubmitting(false);
    }
  };

  // ====== UI STEP PIN ======
  if (step === "PIN" && pendingRequest) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setStep("FORM")}
              className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
              disabled={isSubmitting}
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-primary-foreground">Nhập PIN giao dịch</h1>
          </div>
        </div>

        <div className="px-6 -mt-4">
          <Card className="p-6 space-y-4">
            <div className="space-y-1 text-sm">
              <p>
                Số tiền:{" "}
                <span className="font-semibold">
                  {pendingRequest.amount.toLocaleString("vi-VN")} đ
                </span>
              </p>
              <p>
                Người nhận:{" "}
                <span className="font-semibold">
                  {pendingRequest.destinationName} - {pendingRequest.destinationAccountNumber} ({pendingRequest.bankName})
                </span>
              </p>

              {pendingRequest.amount >= HIGH_VALUE_THRESHOLD_VND && (
                <p className="text-xs text-amber-600">
                  Giao dịch giá trị cao, sau khi nhập PIN sẽ chuyển sang màn hình xác thực sinh trắc.
                </p>
              )}
            </div>

            <div className="space-y-2 pt-4">
              <Label htmlFor="txnPin">Mã PIN giao dịch</Label>
              <Input
                id="txnPin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Nhập PIN 4–6 số"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <Button className="w-full mt-4" onClick={handleConfirmPin} disabled={isSubmitting}>
              {isSubmitting ? "Đang xử lý..." : "Tiếp tục"}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // ====== UI STEP FORM ======
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/transfer")}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">Chuyển tới tài khoản khác</h1>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tài khoản nguồn</Label>

              {loadingAccounts ? (
                <p className="text-sm text-muted-foreground">Đang tải danh sách tài khoản...</p>
              ) : sourceAccounts.length === 0 ? (
                <p className="text-sm text-destructive">Bạn chưa có tài khoản thanh toán hoạt động.</p>
              ) : (
                <Select
                  value={formData.sourceAccount}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, sourceAccount: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tài khoản nguồn" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceAccounts.map((acc) => (
                      <SelectItem key={acc.accountNumber} value={acc.accountNumber}>
                        {acc.accountNumber} - Tài khoản thanh toán
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4 text-foreground">Thông tin người nhận</h3>

              <div className="space-y-2 mb-4">
                <Label htmlFor="bank">
                  Ngân hàng <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.bank}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      bank: value,
                      accountNumber: "",
                      beneficiaryName: "",
                    }))
                  }
                >
                  <SelectTrigger id="bank">
                    <SelectValue placeholder="Chọn ngân hàng" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 mb-4">
                <Label htmlFor="accountNumber">
                  Số tài khoản <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="accountNumber"
                  type="text"
                  placeholder="Nhập số tài khoản"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      accountNumber: e.target.value,
                      beneficiaryName: "", // ✅ đổi STK là reset tên luôn để tránh “tên cũ”
                    }))
                  }
                  onBlur={() => void lookupAndFillBeneficiaryName()}
                />
              </div>

              <div className="space-y-2 mb-4">
                <Label htmlFor="beneficiaryName">Tên người thụ hưởng</Label>
                <Input
                  id="beneficiaryName"
                  type="text"
                  placeholder="Tên sẽ được tự động điền sau khi nhập STK hợp lệ"
                  value={formData.beneficiaryName}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2 mb-4">
                <Label htmlFor="nickname">Tên gợi nhớ</Label>
                <Input
                  id="nickname"
                  type="text"
                  placeholder="Nhập tên gợi nhớ (không bắt buộc)"
                  value={formData.nickname}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      nickname: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="amount">
                Số tiền <span className="text-destructive">*</span>
              </Label>

              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                placeholder="Nhập số tiền"
                value={formData.amount}
                onChange={(e) => {
                  const formatted = formatVndWithDots(e.target.value);
                  setFormData((prev) => ({ ...prev, amount: formatted }));
                }}
              />

              <p className="text-xs text-muted-foreground">
                Giao dịch từ {HIGH_VALUE_THRESHOLD_VND.toLocaleString("vi-VN")} VND trở lên sẽ yêu cầu <b>xác thực sinh trắc</b>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Nội dung chuyển tiền</Label>
              <Input
                id="content"
                type="text"
                value={formData.content}
                onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="saveAccount"
                checked={formData.saveAccount}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    saveAccount: Boolean(checked),
                  }))
                }
              />
              <Label htmlFor="saveAccount" className="text-sm cursor-pointer">
                Ghi nhớ tài khoản người nhận
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={sourceAccounts.length === 0}>
              Tiếp tục
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default TransferToAccount;
