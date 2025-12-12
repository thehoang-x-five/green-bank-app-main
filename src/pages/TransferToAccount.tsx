// src/pages/TransferToAccount.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import {
  onValue,
  query,
  ref,
  orderByChild,
  equalTo,
  get,
} from "firebase/database";
import {
  initiateTransferToAccount,
  type TransferToAccountRequest,
} from "@/services/transferService";
import { verifyTransactionPin } from "@/services/userService";

// 🔐 NEW: import service sinh trắc
import {
  HIGH_VALUE_THRESHOLD_VND,
  runBiometricVerification,
} from "@/services/biometricService";

type BeneficiaryFromState = {
  id?: string;
  name?: string; // tên thật người thụ hưởng
  nickname?: string; // tên gợi nhớ
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

const TransferToAccount = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const beneficiary: BeneficiaryFromState | undefined =
    (location.state as { beneficiary?: BeneficiaryFromState } | undefined)
      ?.beneficiary;

  // Danh sách tài khoản nguồn (thanh toán) của user hiện tại
  const [sourceAccounts, setSourceAccounts] = useState<SourceAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [step, setStep] = useState<Step>("FORM");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    sourceAccount: "",
    bank: beneficiary?.bankName ?? "",
    accountNumber: beneficiary?.accountNumber ?? "",
    beneficiaryName: beneficiary?.name ?? "", // tên thật
    nickname: beneficiary?.nickname ?? "", // tên gợi nhớ
    amount: "",
    content: "",
    saveAccount: false,
  });

  // Xác định chuyển nội bộ hay liên ngân hàng
  const isInternalBank = formData.bank === "VietBank";

  // request tạm thời để chuyển sang bước PIN
  const [pendingRequest, setPendingRequest] =
    useState<TransferToAccountRequest | null>(null);
  const [pin, setPin] = useState("");

  // Tên người CHUYỂN (chủ tài khoản đang đăng nhập)
  const [senderName, setSenderName] = useState<string>("");

  // Danh sách ngân hàng
  const banks = [
    "VietBank", // ngân hàng của mình
    "Vietcombank",
    "BIDV",
    "Techcombank",
    "VietinBank",
    "ACB",
    "Agribank",
    "MB Bank",
    "VPBank",
  ];

  // ========== Lấy tài khoản nguồn từ RTDB: /accounts where uid == currentUser.uid ==========
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

        // Auto chọn tài khoản đầu tiên nếu chưa chọn
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

  // ========== Lấy tên người CHUYỂN từ users/{uid} ==========
  useEffect(() => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    const userRef = ref(firebaseRtdb, `users/${currentUser.uid}`);
    get(userRef)
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.val() as RtdbUser;
        const name =
          (data.fullName ||
            data.username ||
            data.displayName ||
            "")?.toString() || "";

        if (!name) return;

        setSenderName(name);

        // Nếu ô content đang trống thì fill mặc định = TÊN NGƯỜI CHUYỂN + " chuyển tiền"
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

  // ========== Lookup & auto-fill tên người nhận (nội bộ + liên ngân hàng) ==========
  const lookupAndFillBeneficiaryName = async (): Promise<string> => {
    const bankName = formData.bank.trim();
    const accountNumber = formData.accountNumber.trim();

    if (!bankName || !accountNumber) return "";

    try {
      // 1. Nội bộ VietBank -> tra trong "accounts"
      if (bankName === "VietBank") {
        let accSnap = await get(
          ref(firebaseRtdb, `accounts/${accountNumber}`)
        );

        if (!accSnap.exists()) {
          const accQuery = query(
            ref(firebaseRtdb, "accounts"),
            orderByChild("accountNumber"),
            equalTo(accountNumber)
          );
          const listSnap = await get(accQuery);

          if (!listSnap.exists()) {
            toast.error(
              "Không tìm thấy tài khoản nhận trong hệ thống VietBank."
            );
            setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
            return "";
          }

          const all = listSnap.val() as Record<
            string,
            { uid?: string; [key: string]: unknown }
          >;
          const firstKey = Object.keys(all)[0];
          accSnap = await get(ref(firebaseRtdb, `accounts/${firstKey}`));
        }

        if (!accSnap.exists()) {
          toast.error("Không tìm thấy tài khoản nhận trong hệ thống VietBank.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        const accData = accSnap.val() as RtdbAccount;

        if (accData.status && accData.status !== "ACTIVE") {
          toast.error("Tài khoản nhận hiện không hoạt động.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        const uid = accData.uid;
        if (typeof uid !== "string" || uid.trim() === "") {
          toast.error("Tài khoản nhận không hợp lệ.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        const userSnap = await get(ref(firebaseRtdb, `users/${uid}`));
        if (!userSnap.exists()) {
          toast.error("Không tìm thấy thông tin chủ tài khoản nhận.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        const userData = userSnap.val() as RtdbUser;
        const name =
          (userData.fullName ||
            userData.username ||
            userData.displayName ||
            "")?.toString() || "";

        if (!name) {
          toast.error("Không lấy được tên chủ tài khoản nhận.");
          setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
          return "";
        }

        setFormData((prev) => ({
          ...prev,
          beneficiaryName: name,
        }));
        return name;
      }

      // 2. Liên ngân hàng -> tra trong "externalAccounts/{bankName}/{accountNumber}"
      const extRef = ref(
        firebaseRtdb,
        `externalAccounts/${bankName}/${accountNumber}`
      );
      const extSnap = await get(extRef);

      if (!extSnap.exists()) {
        toast.error(
          `Không tìm thấy tài khoản ${accountNumber} tại ngân hàng ${bankName}.`
        );
        setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
        return "";
      }

      const extData = extSnap.val() as ExternalAccount;
      const extName =
        (extData.name ||
          extData.fullName ||
          extData.ownerName ||
          extData.username ||
          "")?.toString() || "";

      if (!extName) {
        toast.error(
          `Không lấy được tên chủ tài khoản ${accountNumber} tại ngân hàng ${bankName}.`
        );
        setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
        return "";
      }

      setFormData((prev) => ({
        ...prev,
        beneficiaryName: extName,
      }));
      return extName;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Lỗi khi tra cứu thông tin tài khoản nhận.";
      console.error("lookupAndFillBeneficiaryName error:", error);
      toast.error(message);
      setFormData((prev) => ({ ...prev, beneficiaryName: "" }));
      return "";
    }
  };

  // ========== Submit FORM -> chuyển sang bước PIN ==========
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!formData.sourceAccount) {
      toast.error("Vui lòng chọn tài khoản nguồn");
      return;
    }

    if (!formData.bank || !formData.accountNumber || !formData.amount) {
      toast.error("Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }

    // Không cho chuyển tới chính tài khoản nguồn (nội bộ)
    if (
      formData.bank === "VietBank" &&
      formData.accountNumber.trim() === formData.sourceAccount.trim()
    ) {
      toast.error("Bạn không thể chuyển tiền tới chính tài khoản nguồn.");
      return;
    }

    const amountNumber = Number(formData.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Số tiền không hợp lệ");
      return;
    }

    // Đảm bảo đã có tên người thụ hưởng (lookup nếu đang trống)
    let beneficiaryName = formData.beneficiaryName.trim();
    if (!beneficiaryName) {
      beneficiaryName = await lookupAndFillBeneficiaryName();
    }

    if (!beneficiaryName) {
      toast.error(
        "Không tìm thấy thông tin người thụ hưởng. Vui lòng kiểm tra lại số tài khoản / ngân hàng."
      );
      return;
    }

    const bankCode =
      formData.bank === "VietBank" ? "VIETBANK" : undefined;

    // Auto fill nội dung: ưu tiên content user tự nhập; nếu trống -> tên NGƯỜI CHUYỂN + " chuyển tiền"
    const trimmedContent = formData.content.trim();
    const autoContent =
      trimmedContent ||
      (senderName ? `${senderName} chuyển tiền` : "Chuyển tiền");

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

    // Lưu lại request và chuyển sang bước nhập PIN giao dịch
    setPendingRequest(req);
    setPin("");
    setStep("PIN");
  };

  // ========== Xác nhận PIN (transaction PIN) + sinh trắc + Smart-OTP ==========
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
    try {
      // 1. Xác thực transaction PIN (user-level)
      await verifyTransactionPin(currentUser.uid, trimmedPin);

      // 2. Nếu giao dịch giá trị cao (>= 10 triệu) -> yêu cầu sinh trắc
      if (pendingRequest.amount >= HIGH_VALUE_THRESHOLD_VND) {
        const bioResult = await runBiometricVerification(
          `Giao dịch chuyển khoản ${pendingRequest.amount.toLocaleString(
            "vi-VN"
          )} VND. Vui lòng xác thực sinh trắc (vân tay / FaceID).`
        );

        if (!bioResult.success) {
          toast.error(
            bioResult.message ||
              "Xác thực sinh trắc không thành công. Giao dịch chưa được khởi tạo."
          );
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Tạo giao dịch + Smart-OTP
      const resp = await initiateTransferToAccount(pendingRequest);

      toast.success("Đã tạo Smart-OTP cho giao dịch chuyển tiền.");

      // 4. Điều hướng sang màn OTP, mang theo thông tin giao dịch + OTP
      navigate("/transfer/otp", {
        state: {
          transfer: {
            transactionId: resp.transactionId,
            otpCode: resp.devOtpCode ?? "",
            expireAt: resp.expireAt,
            amount: pendingRequest.amount,
            content: pendingRequest.content,
            sourceAccountNumber: pendingRequest.sourceAccountNumber,
            destinationAccountNumber:
              pendingRequest.destinationAccountNumber,
            destinationName:
              pendingRequest.destinationName ??
              pendingRequest.destinationAccountNumber,
            bankName: pendingRequest.bankName,
          },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi xác thực PIN hoặc tạo giao dịch.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========== UI STEP PIN ==========
  if (step === "PIN" && pendingRequest) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setStep("FORM")}
              className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-primary-foreground">
              Nhập PIN giao dịch
            </h1>
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
                  {pendingRequest.destinationName} -{" "}
                  {pendingRequest.destinationAccountNumber} (
                  {pendingRequest.bankName})
                </span>
              </p>
              {pendingRequest.amount >= HIGH_VALUE_THRESHOLD_VND && (
                <p className="text-xs text-amber-600">
                  Giao dịch giá trị cao, sau khi nhập PIN sẽ yêu cầu
                  xác thực sinh trắc.
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
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, ""))
                }
              />
            </div>

            <Button
              className="w-full mt-4"
              onClick={handleConfirmPin}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang xử lý..." : "Tiếp tục"}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // ========== UI STEP FORM ==========
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/transfer")}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">
            Chuyển tới tài khoản khác
          </h1>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Source Account */}
            <div className="space-y-2">
              <Label>Tài khoản nguồn</Label>

              {loadingAccounts ? (
                <p className="text-sm text-muted-foreground">
                  Đang tải danh sách tài khoản...
                </p>
              ) : sourceAccounts.length === 0 ? (
                <p className="text-sm text-destructive">
                  Bạn chưa có tài khoản thanh toán hoạt động.
                </p>
              ) : (
                <Select
                  value={formData.sourceAccount}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, sourceAccount: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tài khoản nguồn" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceAccounts.map((acc) => (
                      <SelectItem
                        key={acc.accountNumber}
                        value={acc.accountNumber}
                      >
                        {acc.accountNumber} - Tài khoản thanh toán
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4 text-foreground">
                Thông tin người nhận
              </h3>

              {/* Bank Selection */}
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
                      // đổi ngân hàng thì clear STK + tên người nhận
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

              {/* Account Number */}
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
                    }))
                  }
                  onBlur={() => {
                    void lookupAndFillBeneficiaryName();
                  }}
                />
              </div>

              {/* Beneficiary Name */}
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

              {/* Nickname */}
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

            {/* Amount */}
            <div className="space-y-1">
              <Label htmlFor="amount">
                Số tiền <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="Nhập số tiền"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Giao dịch từ{" "}
                {HIGH_VALUE_THRESHOLD_VND.toLocaleString("vi-VN")} VND trở lên
                sẽ yêu cầu <b>xác thực sinh trắc</b> sau khi nhập PIN.
              </p>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Nội dung chuyển tiền</Label>
              <Input
                id="content"
                type="text"
                value={formData.content}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, content: e.target.value }))
                }
              />
            </div>

            {/* Save Account Checkbox */}
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

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={sourceAccounts.length === 0}
            >
              Tiếp tục
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default TransferToAccount;
