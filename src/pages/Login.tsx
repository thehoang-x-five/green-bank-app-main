// src/pages/Login.tsx
import {
  useState,
  useRef,
  ChangeEvent,
  FormEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { firebaseAuth } from "@/lib/firebase";
import { runBiometricVerification } from "@/services/biometricService";
import { onAuthStateChanged } from "firebase/auth";
import {
  loginWithBiometric,
  isBiometricLoginEnabled,
} from "@/services/authService";

import {
  Fingerprint,
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  IdCard,
  Camera as CameraIcon,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import {
  loginWithEmail,
  registerCustomerAccount,
  sendResetPasswordEmail,
} from "@/services/authService";

import { sendOtp, verifyOtp } from "@/services/otpService";
import { uploadEkycImage, saveEkycInfoByUid } from "@/services/ekycService";
import { Capacitor } from "@capacitor/core";
import {
  Camera,
  CameraDirection,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";


type RegisterStep = 1 | 2 | 3;

// Helper đọc code lỗi Firebase an toàn
const getFirebaseErrorCode = (error: unknown): string | undefined => {
  if (typeof error === "object" && error && "code" in error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const BIO_ENABLED_KEY = "vietbank_bio_enabled";

  // mode=register => mở sẵn tab đăng ký
  const modeParam = searchParams.get("mode");
  // source=officer nếu đi từ giao diện nhân viên
  const sourceParam = searchParams.get("source");

  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });

  const [registerStep, setRegisterStep] = useState<RegisterStep>(1);
  const [registerData, setRegisterData] = useState({
    // Bước 1
    phone: "",
    email: "",
    otp: "",
    // Bước 2 – ảnh eKYC
    frontId: "",
    backId: "",
    selfieStatus: "Chưa xác thực",
    frontIdUrl: "",
    backIdUrl: "",
    selfieUrl: "",
    // Bước 3 – thông tin định danh
    fullName: "",
    gender: "",
    dob: "",
    nationalId: "",
    idIssueDate: "",
    idIssuePlace: "",     // nơi cấp CCCD
    idExpiryDate: "",     // ngày hết hạn CCCD
    address: "",          // địa chỉ thường trú
    contactAddress: "",   // địa chỉ liên hệ / tạm trú
    username: "", // không dùng nữa nhưng giữ để tránh vỡ chỗ khác
    password: "",
    confirmPassword: "",
    accountNumber: "",
    pin: "",
  });

  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [pinError, setPinError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const [authTab, setAuthTab] = useState<"login" | "register">(
    modeParam === "register" ? "register" : "login"
  );

  // trạng thái cho OTP thật
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // input file ẩn cho eKYC
  const frontIdInputRef = useRef<HTMLInputElement | null>(null);
  const backIdInputRef = useRef<HTMLInputElement | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  // platform: web / android / ios
const isNative = Capacitor.isNativePlatform();

// Loại ảnh eKYC dùng chung
type EkycImageKind = "frontId" | "backId" | "selfie";

// Chuyển dataURL (base64) từ Camera thành File để reuse uploadEkycImage
const dataUrlToFile = (dataUrl: string, fileName: string): File => {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*);base64/);
  const mimeType = mimeMatch?.[1] ?? "image/jpeg";

  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new File([bytes], fileName, { type: mimeType });
};


  // --------- Helpers validate ---------

  // ✅ Chuẩn hóa email: trim + lowerCase, tự thêm @gmail.com nếu thiếu
  const normalizeEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && !trimmed.includes("@")) {
      return `${trimmed}@gmail.com`;
    }
    return trimmed;
  };

  // ✅ SĐT: chỉ số, đúng 10 số
  const validatePhone = (phone: string) => {
    if (!phone) return "Vui lòng nhập số điện thoại";
    if (!/^\d+$/.test(phone)) return "Số điện thoại chỉ được chứa chữ số";
    if (phone.length !== 10) return "Số điện thoại phải gồm đúng 10 chữ số";
    return "";
  };

  // ✅ Email: phải là Gmail, định dạng ...@gmail.com
  const validateEmail = (email: string) => {
    if (!email) return "Vui lòng nhập email";
    const trimmed = email.trim().toLowerCase();
    const re = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!re.test(trimmed)) {
      return "Email phải là địa chỉ Gmail hợp lệ (định dạng ten@gmail.com)";
    }
    return "";
  };

  const validateOtp = (otp: string) => {
    if (!otp) return "Vui lòng nhập mã OTP";
    if (!/^\d+$/.test(otp)) return "Mã OTP chỉ gồm chữ số";
    if (otp.length !== 6) return "Mã OTP phải gồm đúng 6 chữ số";
    return "";
  };

  const validatePin = (pin: string) => {
    if (!pin) return "Vui lòng nhập mã PIN giao dịch";
    if (!/^\d+$/.test(pin)) return "Mã PIN chỉ được chứa chữ số";
    if (pin.length !== 4) return "Mã PIN phải gồm đúng 4 chữ số";
    return "";
  };

  // ✅ Helper: check ngày trong tương lai (chỉ so sánh theo ngày)
  const isFutureDate = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d > today;
  };

  // ✅ Ngày sinh không được > hôm nay
  const validateDob = (dob: string) => {
    if (!dob) return "Vui lòng chọn ngày sinh";
    if (isFutureDate(dob)) {
      return "Ngày sinh không được lớn hơn ngày hiện tại";
    }
    return "";
  };

  // ✅ CCCD: số, đúng 12 số
  const validateNationalId = (id: string) => {
    if (!id) return "Vui lòng nhập số CCCD/CMND";
    if (!/^\d+$/.test(id)) return "Số CCCD phải là số";
    if (id.length !== 12) return "Số CCCD phải gồm đúng 12 chữ số";
    return "";
  };

  // ✅ Ngày cấp CCCD không được > hôm nay
  const validateIdIssueDate = (date: string) => {
    if (!date) return "Vui lòng chọn ngày cấp CCCD";
    if (isFutureDate(date)) {
      return "Ngày cấp CCCD không được lớn hơn ngày hiện tại";
    }
    return "";
  };

  // ✅ Mật khẩu ≥ 8 ký tự, có hoa, thường, số
  const validatePassword = (password: string) => {
    if (!password) return "Vui lòng nhập mật khẩu đăng nhập";
    if (password.length < 8) {
      return "Mật khẩu phải có ít nhất 8 ký tự";
    }
    if (!/[A-Z]/.test(password)) {
      return "Mật khẩu phải có ít nhất 1 chữ hoa (A-Z)";
    }
    if (!/[a-z]/.test(password)) {
      return "Mật khẩu phải có ít nhất 1 chữ thường (a-z)";
    }
    if (!/[0-9]/.test(password)) {
      return "Mật khẩu phải có ít nhất 1 chữ số (0-9)";
    }
    return "";
  };

  const resetRegisterFlow = () => {
    setRegisterStep(1);
    setRegisterData({
      phone: "",
      email: "",
      otp: "",
      frontId: "",
      backId: "",
      selfieStatus: "Chưa xác thực",
      frontIdUrl: "",
      backIdUrl: "",
      selfieUrl: "",
      fullName: "",
      gender: "",
      dob: "",
      nationalId: "",
      idIssueDate: "",
      idIssuePlace: "",
      idExpiryDate: "",
      address: "",
      contactAddress: "",
      username: "",
      password: "",
      confirmPassword: "",
      accountNumber: "",
      pin: "",
    });
    setPhoneError("");
    setEmailError("");
    setOtpError("");
    setPinError("");
    setConfirmPasswordError("");
    setOtpSent(false);
    setIsSendingOtp(false);
    setIsVerifyingOtp(false);
  };

  const ensureEmailForEkyc = (): string | null => {
    const normalized = normalizeEmail(registerData.email);
    if (!normalized) {
      toast.error(
        "Vui lòng hoàn thành Bước 1 (email) trước khi tải ảnh CCCD/khuôn mặt"
      );
      return null;
    }
    if (normalized !== registerData.email) {
      setRegisterData((prev) => ({ ...prev, email: normalized }));
    }
    return normalized;
  };

  // Chụp ảnh eKYC bằng camera (native), fallback input file trên web
const handleCaptureEkyc = async (kind: EkycImageKind) => {
  // Web: vẫn dùng input file như cũ
  if (!isNative) {
    if (kind === "frontId" && frontIdInputRef.current) {
      frontIdInputRef.current.click();
    } else if (kind === "backId" && backIdInputRef.current) {
      backIdInputRef.current.click();
    } else if (kind === "selfie" && selfieInputRef.current) {
      selfieInputRef.current.click();
    }
    return;
  }

  const email = ensureEmailForEkyc();
  if (!email) return;

  const isSelfie = kind === "selfie";

  try {
    if (kind === "frontId") setUploadingFront(true);
    if (kind === "backId") setUploadingBack(true);
    if (kind === "selfie") setUploadingSelfie(true);

    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      direction: isSelfie ? CameraDirection.Front : CameraDirection.Rear,
      resultType: CameraResultType.DataUrl,
      quality: 70,
      // các option khác để mặc định cho khỏi lỗi type
    });

    if (!photo.dataUrl) {
      toast.error("Không chụp được ảnh. Vui lòng thử lại.");
      return;
    }

    const fileName = `${kind}-${Date.now()}.jpeg`;
    const file = dataUrlToFile(photo.dataUrl, fileName);

    const url = await uploadEkycImage(email, kind, file);

    setRegisterData((prev) => {
      if (kind === "frontId") {
        return {
          ...prev,
          frontId: "Đã tải CCCD mặt trước",
          frontIdUrl: url,
        };
      }
      if (kind === "backId") {
        return {
          ...prev,
          backId: "Đã tải CCCD mặt sau",
          backIdUrl: url,
        };
      }
      // selfie
      return {
        ...prev,
        selfieStatus: "Đã tải ảnh khuôn mặt",
        selfieUrl: url,
      };
    });

    if (kind === "frontId") {
      toast.success("Chụp CCCD mặt trước thành công");
    } else if (kind === "backId") {
      toast.success("Chụp CCCD mặt sau thành công");
    } else {
      toast.success("Chụp ảnh khuôn mặt thành công");
    }
  } catch (error) {
    console.error("Capture eKYC error:", error);
    toast.error("Không thể chụp ảnh. Vui lòng thử lại.");
  } finally {
    if (kind === "frontId") setUploadingFront(false);
    if (kind === "backId") setUploadingBack(false);
    if (kind === "selfie") setUploadingSelfie(false);
  }
};


  // --------- Login (Firebase) ---------
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    if (!loginData.username || !loginData.password) {
      toast.error("Vui lòng nhập đầy đủ email và mật khẩu");
      return;
    }

    const emailInput = loginData.username.trim();
    const email = normalizeEmail(emailInput);

    try {
      const { profile } = await loginWithEmail(email, loginData.password);
      localStorage.setItem("vietbank_bio_enabled", "1"); // optional nhưng giờ authService đã set rồi


      // Role lấy từ profile (nếu chưa có thì coi như CUSTOMER)
      const role = profile?.role ?? "CUSTOMER";

      toast.success(
        role === "OFFICER"
          ? "Đăng nhập nhân viên thành công"
          : "Đăng nhập khách hàng thành công"
      );

      if (role === "OFFICER") {
        navigate("/officer");
      } else {
        navigate("/home");
      }
    } catch (error: unknown) {
      console.error("Firebase login error:", error);
      const code = getFirebaseErrorCode(error);

      let message =
        "Đăng nhập thất bại. Vui lòng kiểm tra lại email và mật khẩu.";

      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {
        message = "Email hoặc mật khẩu không đúng.";
      } else if (code === "auth/user-not-found") {
        message = "Tài khoản không tồn tại.";
      } else if (code === "auth/too-many-requests") {
        message =
          "Bạn đã đăng nhập sai nhiều lần. Vui lòng thử lại sau ít phút.";
      }

      toast.error(message);
    }
  };

  const handleBiometricLogin = async (): Promise<void> => {
  try {
    const { profile } = await loginWithBiometric();

    const role = profile?.role ?? "CUSTOMER";

    toast.success(
      role === "OFFICER"
        ? "Đăng nhập vân tay (nhân viên) thành công"
        : "Đăng nhập vân tay (khách hàng) thành công"
    );

    navigate(role === "OFFICER" ? "/officer" : "/home");
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Có lỗi khi đăng nhập vân tay.";
    toast.error(message);
    console.error("[handleBiometricLogin]", err);
  }
};



  const handleForgotPassword = async () => {
    const trimmedUsername = loginData.username.trim();
    if (!trimmedUsername) {
      toast.error("Vui lòng nhập email đăng nhập trước khi quên mật khẩu");
      return;
    }

    const email = normalizeEmail(trimmedUsername);
    const emailErr = validateEmail(email);
    if (emailErr) {
      toast.error(emailErr);
      return;
    }

    try {
      await sendResetPasswordEmail(email);
      toast.success(
        "Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (kể cả Spam) và làm theo hướng dẫn."
      );
    } catch (error: unknown) {
      console.error("Firebase reset password error:", error);
      const code = getFirebaseErrorCode(error);

      let message =
        "Gửi email đặt lại mật khẩu thất bại. Vui lòng thử lại sau.";

      if (code === "auth/user-not-found") {
        message = "Email này chưa được đăng ký tài khoản.";
      } else if (code === "auth/too-many-requests") {
        message =
          "Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau ít phút.";
      }

      toast.error(message);
    }
  };

  // --------- Gửi OTP thật ---------
  const handleSendOtp = async () => {
    const normalizedPhone = registerData.phone.trim();
    const normalizedEmail = normalizeEmail(registerData.email);

    const phoneErr = validatePhone(normalizedPhone);
    const emailErr = validateEmail(normalizedEmail);

    setPhoneError(phoneErr);
    setEmailError(emailErr);

    if (normalizedEmail !== registerData.email) {
      setRegisterData((prev) => ({ ...prev, email: normalizedEmail }));
    }

    if (phoneErr || emailErr) {
      toast.error("Vui lòng kiểm tra lại SĐT và email");
      return;
    }

    try {
      setIsSendingOtp(true);
      await sendOtp(normalizedEmail, normalizedPhone);
      setOtpSent(true);
      toast.success(
        "Đã gửi OTP đến email của bạn. Vui lòng kiểm tra hộp thư (kể cả Spam)."
      );
    } catch (error) {
      console.error("Send OTP error:", error);
      toast.error("Gửi OTP thất bại. Vui lòng thử lại sau.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // --------- Upload ảnh eKYC ---------
  const handleFrontIdFileChange = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const email = ensureEmailForEkyc();
    if (!email) return;

    try {
      setUploadingFront(true);
      const url = await uploadEkycImage(email, "frontId", file);
      setRegisterData((prev) => ({
        ...prev,
        frontId: "Đã tải CCCD mặt trước",
        frontIdUrl: url,
      }));
      toast.success("Tải CCCD mặt trước thành công");
    } catch (error) {
      console.error("Upload front CCCD error:", error);
      toast.error("Tải CCCD mặt trước thất bại. Vui lòng thử lại.");
    } finally {
      setUploadingFront(false);
      if (frontIdInputRef.current) {
        frontIdInputRef.current.value = "";
      }
    }
  };

  const handleBackIdFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const email = ensureEmailForEkyc();
    if (!email) return;

    try {
      setUploadingBack(true);
      const url = await uploadEkycImage(email, "backId", file);
      setRegisterData((prev) => ({
        ...prev,
        backId: "Đã tải CCCD mặt sau",
        backIdUrl: url,
      }));
      toast.success("Tải CCCD mặt sau thành công");
    } catch (error) {
      console.error("Upload back CCCD error:", error);
      toast.error("Tải CCCD mặt sau thất bại. Vui lòng thử lại.");
    } finally {
      setUploadingBack(false);
      if (backIdInputRef.current) {
        backIdInputRef.current.value = "";
      }
    }
  };

  const handleSelfieFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const email = ensureEmailForEkyc();
    if (!email) return;

    try {
      setUploadingSelfie(true);
      const url = await uploadEkycImage(email, "selfie", file);
      setRegisterData((prev) => ({
        ...prev,
        selfieStatus: "Đã tải ảnh khuôn mặt",
        selfieUrl: url,
      }));
      toast.success("Tải ảnh khuôn mặt thành công");
    } catch (error) {
      console.error("Upload selfie error:", error);
      toast.error("Tải ảnh khuôn mặt thất bại. Vui lòng thử lại.");
    } finally {
      setUploadingSelfie(false);
      if (selfieInputRef.current) {
        selfieInputRef.current.value = "";
      }
    }
  };

  // --------- Register flow (3 bước) ---------
  const handleNextRegisterStep = async () => {
    if (registerStep === 1) {
      const normalizedPhone = registerData.phone.trim();
      const normalizedEmail = normalizeEmail(registerData.email);
      const otpTrimmed = registerData.otp.trim();

      const phoneErr = validatePhone(normalizedPhone);
      const emailErr = validateEmail(normalizedEmail);
      const otpErr = validateOtp(otpTrimmed);

      setPhoneError(phoneErr);
      setEmailError(emailErr);
      setOtpError(otpErr);

      if (normalizedEmail !== registerData.email) {
        setRegisterData((prev) => ({ ...prev, email: normalizedEmail }));
      }

      if (phoneErr || emailErr || otpErr) {
        toast.error("Vui lòng kiểm tra lại SĐT, email và mã OTP");
        return;
      }

      if (!otpSent) {
        toast.error("Vui lòng bấm 'Gửi OTP' trước khi tiếp tục");
        return;
      }

      try {
        setIsVerifyingOtp(true);
        const result = await verifyOtp(normalizedEmail, otpTrimmed);

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(result.message);
        setRegisterStep(2);
      } catch (error) {
        console.error("Verify OTP error:", error);
        toast.error("Có lỗi khi xác thực OTP. Vui lòng thử lại.");
      } finally {
        setIsVerifyingOtp(false);
      }
    } else if (registerStep === 2) {
      setRegisterStep(3);
    } else {
      // Bước 3: HOÀN TẤT ĐĂNG KÝ (gọi Firebase + lưu eKYC info)

      // ✅ Kiểm tra bắt buộc đã nhập đầy đủ
      if (
        !registerData.fullName ||
        !registerData.gender ||
        !registerData.dob ||
        !registerData.nationalId ||
        !registerData.idIssueDate ||
        !registerData.idIssuePlace ||
        !registerData.idExpiryDate ||
        !registerData.address ||
        !registerData.contactAddress
      ) {
        toast.error(
          "Vui lòng nhập đầy đủ Họ tên, Giới tính, Ngày sinh, Số CCCD, Ngày cấp, Nơi cấp, Ngày hết hạn CCCD, Địa chỉ thường trú và Địa chỉ liên hệ."
        );
        return;
      }

      // ✅ Ngày sinh không được trong tương lai
      const dobErr = validateDob(registerData.dob.trim());
      if (dobErr) {
        toast.error(dobErr);
        return;
      }

      // ✅ CCCD phải là số, đủ 12 số
      const nationalIdErr = validateNationalId(
        registerData.nationalId.trim()
      );
      if (nationalIdErr) {
        toast.error(nationalIdErr);
        return;
      }

      // ✅ Ngày cấp CCCD không được trong tương lai
      const idIssueDateErr = validateIdIssueDate(
        registerData.idIssueDate.trim()
      );
      if (idIssueDateErr) {
        toast.error(idIssueDateErr);
        return;
      }

      // ✅ Mật khẩu mạnh: ≥ 8 ký tự, có hoa, thường, số
      const passwordErr = validatePassword(registerData.password);
      if (passwordErr) {
        toast.error(passwordErr);
        return;
      }

      // ✅ Kiểm tra nhập lại mật khẩu trùng khớp
      if (registerData.password !== registerData.confirmPassword) {
        const msg = "Mật khẩu và Nhập lại mật khẩu không trùng khớp";
        setConfirmPasswordError(msg);
        toast.error(msg);
        return;
      }

      const pinTrimmed = registerData.pin.trim();
      const pinErr = validatePin(pinTrimmed);
      setPinError(pinErr);

      if (pinErr) {
        toast.error(pinErr);
        return;
      }

      // Email dùng để tạo tài khoản đăng nhập chính là email Bước 1
      const normalizedEmail = normalizeEmail(registerData.email);

try {
  // ✅ 1) Đăng ký tài khoản trước để chắc chắn có UID trong users/{uid}
  const result = await registerCustomerAccount(
    normalizedEmail,
    registerData.password,
    registerData.fullName.trim(), // dùng HỌ TÊN làm tên hiển thị
    pinTrimmed,
    {
      phone: registerData.phone.trim(),
      gender: registerData.gender,
      dob: registerData.dob.trim(),
      nationalId: registerData.nationalId.trim(),
      idIssueDate: registerData.idIssueDate.trim(),

      // map đúng tên field trong AppUserProfile
      placeOfIssue: registerData.idIssuePlace.trim(),        // nơi cấp CCCD
      permanentAddress: registerData.address.trim(),         // địa chỉ thường trú
      contactAddress: registerData.contactAddress.trim(),    // địa chỉ liên hệ / tạm trú

      // lưu luôn url ảnh eKYC vào profile
      frontIdUrl: registerData.frontIdUrl || null,
      backIdUrl: registerData.backIdUrl || null,
      selfieUrl: registerData.selfieUrl || null,
    },
    {
      // nếu đi từ màn nhân viên thì tạo user mà KHÔNG đổi session
      createdByOfficer: sourceParam === "officer",
    }
  );

  // ✅ 2) Sau khi đã có UID → lưu session eKYC + submittedAt + đồng bộ users/{uid}/ekycSubmittedAt
  await saveEkycInfoByUid(result.profile.uid, normalizedEmail, {
    fullName: registerData.fullName.trim(),
    dob: registerData.dob.trim(),
    nationalId: registerData.nationalId.trim(),
    address: registerData.address.trim(),
    gender: registerData.gender,
    idIssueDate: registerData.idIssueDate.trim(),
  });

        

        if (sourceParam === "officer") {
          // FLOW NHÂN VIÊN TẠO KHÁCH MỚI
          toast.success(
            `Đã tạo tài khoản cho khách hàng ${registerData.fullName.trim()}. Số tài khoản thanh toán: ${result.accountNumber}.`
          );

          // reset flow đăng ký cho sạch form
          resetRegisterFlow();

          // quay lại danh sách khách hàng, OFFICER vẫn là user đăng nhập hiện tại
          navigate("/officer/customers");
        } else {
          // FLOW KHÁCH TỰ ĐĂNG KÝ – giữ nguyên logic cũ
          toast.success(
            `Đăng ký tài khoản thành công. Số tài khoản mặc định của bạn là: ${result.accountNumber}. Sau khi nhân viên duyệt eKYC, bạn sẽ có thể thực hiện giao dịch.`
          );

          const emailForLogin = normalizedEmail;

          resetRegisterFlow();
          setAuthTab("login");
          setLoginData({ username: emailForLogin, password: "" });
        }

      } catch (error: unknown) {
          console.error("Firebase login error:", error);

          // ✅ Ưu tiên message custom từ authService (đếm lần còn lại / khóa tài khoản)
          const serviceMessage =
            error instanceof Error && error.message ? error.message.trim() : "";

          if (serviceMessage) {
            toast.error(serviceMessage);
            return;
          }

          // fallback: nếu không có message custom thì mới map theo Firebase code
          const code = getFirebaseErrorCode(error);

          let message =
            "Đăng nhập thất bại. Vui lòng kiểm tra lại email và mật khẩu.";

          if (
            code === "auth/invalid-credential" ||
            code === "auth/wrong-password"
          ) {
            message = "Email hoặc mật khẩu không đúng.";
          } else if (code === "auth/user-not-found") {
            message = "Tài khoản không tồn tại.";
          } else if (code === "auth/too-many-requests") {
            message = "Bạn đã đăng nhập sai nhiều lần. Vui lòng thử lại sau ít phút.";
          }

          toast.error(message);
        }

    }
  };

  const handleBackRegisterStep = () => {
    setRegisterStep((prev) => (prev === 1 ? 1 : ((prev - 1) as RegisterStep)));
  };

  const renderRegisterStep = () => {
    switch (registerStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">
                Bước 1/3 – Xác thực số điện thoại &amp; email
              </p>
              <p className="text-xs text-muted-foreground">
                Nhập số điện thoại (10 số) và email cá nhân. Hệ thống sẽ gửi mã
                OTP về email để xác thực mở tài khoản ngân hàng.
              </p>
            </div>

            {/* PHONE */}
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input
                type="tel"
                placeholder="VD: 09xx xxx xxx"
                value={registerData.phone}
                onChange={(e) => {
                  setRegisterData({ ...registerData, phone: e.target.value });
                  if (phoneError) setPhoneError("");
                }}
                className={
                  phoneError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {phoneError && (
                <p className="text-xs text-destructive">{phoneError}</p>
              )}
            </div>

            {/* EMAIL */}
            <div className="space-y-2">
              <Label>Email cá nhân (sẽ dùng để đăng nhập)</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="VD: taikhoan@gmail.com"
                  value={registerData.email}
                  onChange={(e) => {
                    setRegisterData({ ...registerData, email: e.target.value });
                    if (emailError) setEmailError("");
                  }}
                  onBlur={(e) => {
                    const normalized = normalizeEmail(e.target.value);
                    if (normalized !== e.target.value) {
                      setRegisterData((prev) => ({
                        ...prev,
                        email: normalized,
                      }));
                    }
                  }}
                  className={
                    emailError
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp}
                >
                  {isSendingOtp ? "Đang gửi..." : "Gửi OTP"}
                </Button>
              </div>
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>

            {/* OTP */}
            <div className="space-y-2">
              <Label>Mã OTP (gửi qua email)</Label>
              <Input
                type="text"
                maxLength={6}
                placeholder="Nhập 6 số OTP"
                value={registerData.otp}
                onChange={(e) => {
                  setRegisterData({ ...registerData, otp: e.target.value });
                  if (otpError) setOtpError("");
                }}
                className={
                  otpError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              <p className="text-xs text-muted-foreground">
                Mã OTP có hiệu lực trong 3 phút. Vui lòng kiểm tra hộp thư email
                (bao gồm mục Spam).
              </p>
              {otpError && (
                <p className="text-xs text-destructive">{otpError}</p>
              )}
              {isVerifyingOtp && (
                <p className="text-xs text-muted-foreground">
                  Đang kiểm tra OTP...
                </p>
              )}
            </div>
          </div>
        );

      // --------- Bước 2: eKYC ảnh ---------
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">
                Bước 2/3 – eKYC CCCD &amp; khuôn mặt
              </p>
              <p className="text-xs text-muted-foreground">
                Tải ảnh CCCD và ảnh khuôn mặt. Nhân viên ngân hàng sẽ dùng thông
                tin này để xác thực hồ sơ eKYC của bạn.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* CCCD mặt trước */}
              <Button
                type="button"
                variant="outline"
                className="h-24 flex items-center justify-center p-0 overflow-hidden"
                onClick={() => handleCaptureEkyc("frontId")}
                disabled={uploadingFront}
              >
                {uploadingFront ? (
                  <span className="text-xs font-medium">Đang tải...</span>
                ) : registerData.frontIdUrl ? (
                  // ẢNH THẬT ĐÃ UPLOAD
                  <img
                    src={registerData.frontIdUrl}
                    alt="CCCD mặt trước"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // TRẠNG THÁI CHƯA CÓ ẢNH
                  <div className="flex flex-col items-center justify-center gap-2">
                    <IdCard className="h-5 w-5" />
                    <span className="text-xs font-medium">CCCD mặt trước</span>
                  </div>
                )}
              </Button>

              {/* CCCD mặt sau */}
              <Button
                type="button"
                variant="outline"
                className="h-24 flex items-center justify-center p-0 overflow-hidden"
                onClick={() => handleCaptureEkyc("backId")}
                disabled={uploadingBack}
              >
                {uploadingBack ? (
                  <span className="text-xs font-medium">Đang tải...</span>
                ) : registerData.backIdUrl ? (
                  <img
                    src={registerData.backIdUrl}
                    alt="CCCD mặt sau"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <IdCard className="h-5 w-5" />
                    <span className="text-xs font-medium">CCCD mặt sau</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Ảnh khuôn mặt – khung đứng */}
            <div className="flex justify-center mb-2">
              <Button
                type="button"
                variant="outline"
                className="p-0 border border-dashed border-muted-foreground/60 rounded-xl bg-muted/40 hover:bg-muted/70
                    w-28 h-40 flex items-center justify-center overflow-hidden"
                onClick={() => handleCaptureEkyc("selfie")}
                disabled={uploadingSelfie}
              >
                {uploadingSelfie ? (
                  <span className="text-xs font-medium">Đang tải...</span>
                ) : registerData.selfieUrl ? (
                  <img
                    src={registerData.selfieUrl}
                    alt="Ảnh khuôn mặt"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                    <CameraIcon className="h-4 w-4" />
                    <span>Ảnh khuôn mặt</span>
                  </div>
                )}
              </Button>
            </div>

            <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
              <p className="font-semibold text-foreground">Trạng thái eKYC</p>
              <p>
                CCCD mặt trước:{" "}
                {registerData.frontIdUrl
                  ? "Đã tải CCCD mặt trước"
                  : "Chưa tải lên"}
              </p>
              <p>
                CCCD mặt sau:{" "}
                {registerData.backIdUrl
                  ? "Đã tải CCCD mặt sau"
                  : "Chưa tải lên"}
              </p>
              <p>
                Khuôn mặt:{" "}
                {registerData.selfieUrl
                  ? "Đã tải ảnh khuôn mặt"
                  : "Chưa xác thực"}
              </p>
            </div>

            {/* input file ẩn giữ nguyên */}
            <input
              ref={frontIdInputRef}
              capture="environment"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFrontIdFileChange}
            />
            <input
              ref={backIdInputRef}
              capture="environment"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBackIdFileChange}
            />
            <input
              ref={selfieInputRef}
              capture="environment"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSelfieFileChange}
            />
          </div>
        );

      // --------- Bước 3: Thông tin định danh & tài khoản ---------
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">
                Bước 3/3 – Thông tin tài khoản &amp; eKYC
              </p>
              <p className="text-xs text-muted-foreground">
                Vui lòng nhập thông tin định danh theo CCCD và cấu hình tài
                khoản đăng nhập/PIN. Số tài khoản thanh toán sẽ được ngân hàng
                tự sinh.
              </p>
            </div>

            {/* Thông tin eKYC (nhập tay) */}
            <div className="space-y-3 rounded-lg bg-muted p-3 text-xs">
              {/* Họ tên */}
              <div className="space-y-1">
                <Label className="text-xs">Họ và tên (theo CCCD)</Label>
                <Input
                  value={registerData.fullName}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      fullName: e.target.value,
                    })
                  }
                  placeholder="VD: NGUYEN VAN A"
                  className="h-8 text-xs"
                />
              </div>

              {/* Giới tính */}
              <div className="space-y-1">
                <Label className="text-xs">Giới tính</Label>
                <select
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                  value={registerData.gender}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      gender: e.target.value,
                    })
                  }
                >
                  <option value="">-- Chọn giới tính --</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>

              {/* Ngày sinh */}
              <div className="space-y-1">
                <Label className="text-xs">Ngày sinh</Label>
                <Input
                  type="date"
                  value={registerData.dob}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      dob: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>

              {/* Số CCCD */}
              <div className="space-y-1">
                <Label className="text-xs">Số CCCD/CMND</Label>
                <Input
                  value={registerData.nationalId}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      nationalId: e.target.value,
                    })
                  }
                  placeholder="VD: 0790xxxxxxx"
                  className="h-8 text-xs"
                />
              </div>

              {/* Ngày cấp CCCD */}
              <div className="space-y-1">
                <Label className="text-xs">Ngày cấp CCCD</Label>
                <Input
                  type="date"
                  value={registerData.idIssueDate}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      idIssueDate: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>

              {/* Nơi cấp CCCD */}
              <div className="space-y-1">
                <Label className="text-xs">Nơi cấp CCCD</Label>
                <Input
                  value={registerData.idIssuePlace}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      idIssuePlace: e.target.value,
                    })
                  }
                  placeholder="VD: Cục Cảnh sát QLHC về TTXH"
                  className="h-8 text-xs"
                />
              </div>

              {/* Ngày hết hạn CCCD */}
              <div className="space-y-1">
                <Label className="text-xs">Ngày hết hạn CCCD</Label>
                <Input
                  type="date"
                  value={registerData.idExpiryDate}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      idExpiryDate: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>

              {/* Địa chỉ thường trú */}
              <div className="space-y-1">
                <Label className="text-xs">Địa chỉ thường trú</Label>
                <Input
                  value={registerData.address}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      address: e.target.value,
                    })
                  }
                  placeholder="VD: 123 Đường ABC, Quận 1, TP. Hồ Chí Minh"
                  className="h-8 text-xs"
                />
              </div>

              {/* Địa chỉ liên hệ / tạm trú */}
              <div className="space-y-1">
                <Label className="text-xs">Địa chỉ liên hệ / tạm trú</Label>
                <Input
                  // ✅ Tắt auto-fill cho địa chỉ liên hệ
                  autoComplete="off"
                  value={registerData.contactAddress}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      contactAddress: e.target.value,
                    })
                  }
                  placeholder="VD: Căn hộ XYZ, Thủ Đức, TP. Hồ Chí Minh"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Mật khẩu & PIN */}
            <div className="space-y-2">
              <Label>Mật khẩu đăng nhập</Label>
              <Input
                type="password"
                // ✅ Tắt auto-fill mật khẩu đăng ký
                autoComplete="new-password"
                placeholder="≥ 8 ký tự, có hoa, thường, số"
                value={registerData.password}
                onChange={(e) => {
                  setRegisterData({
                    ...registerData,
                    password: e.target.value,
                  });
                  if (confirmPasswordError) setConfirmPasswordError("");
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Nhập lại mật khẩu</Label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Nhập lại đúng mật khẩu ở trên"
                value={registerData.confirmPassword}
                onChange={(e) => {
                  setRegisterData({
                    ...registerData,
                    confirmPassword: e.target.value,
                  });
                  if (confirmPasswordError) setConfirmPasswordError("");
                }}
                className={
                  confirmPasswordError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {confirmPasswordError && (
                <p className="text-xs text-destructive">
                  {confirmPasswordError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Mã PIN giao dịch</Label>
              <Input
                type="password"
                maxLength={4}
                autoComplete="off" // ✅ tránh auto-fill cho PIN
                placeholder="4 số bảo mật"
                value={registerData.pin}
                onChange={(e) => {
                  setRegisterData({ ...registerData, pin: e.target.value });
                  if (pinError) setPinError("");
                }}
                className={
                  pinError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {pinError && (
                <p className="text-xs text-destructive">{pinError}</p>
              )}
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
              <span>
                Mật khẩu nên ≥ 8 ký tự, bao gồm <b>chữ hoa</b>,{" "}
                <b>chữ thường</b> và <b>số</b>. Số tài khoản thanh toán sẽ được
                ngân hàng <b>tự động cấp</b>. PIN chỉ dùng để xác thực giao
                dịch. Sau khi nhân viên <b>duyệt eKYC</b>, tài khoản mới được
                phép thực hiện giao dịch.
              </span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/90 via-primary/70 to-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-background/95 backdrop-blur">
        <div className="px-6 pt-6 pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Ngân hàng số</p>
              <h1 className="text-2xl font-bold text-primary">GreenBank</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">
                eKYC • 2FA
              </span>
            </div>
          </div>
        </div>

        <Tabs
          value={authTab}
          onValueChange={(value) => setAuthTab(value as "login" | "register")}
          className="px-6 pb-6"
        >
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="login">Đăng nhập</TabsTrigger>
            <TabsTrigger value="register">Đăng ký</TabsTrigger>
          </TabsList>

          {/* Đăng nhập */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Email đăng nhập</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Nhập email đã đăng ký"
                  value={loginData.username}
                  onChange={(e) =>
                    setLoginData({ ...loginData, username: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-start text-xs">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  onClick={handleForgotPassword}
                >
                  <Mail className="h-3 w-3" />
                  Quên mật khẩu
                </button>
              </div>

              <Button type="submit" className="w-full mt-2">
                Đăng nhập
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={handleBiometricLogin}
              >
                <Fingerprint className="h-4 w-4" />
                <span>Đăng nhập nhanh bằng vân tay</span>
              </Button>
            </form>
          </TabsContent>

          {/* Đăng ký */}
          <TabsContent value="register">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {sourceParam === "officer" ? (
                  <>
                    Nhân viên đang <b>tạo tài khoản mới</b> cho khách hàng.
                  </>
                ) : (
                  <>
                    Mở tài khoản mới cho <b>khách hàng cá nhân</b>.
                  </>
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                Bước {registerStep}/3
                <ChevronRight className="h-3 w-3" />
              </span>
            </div>

            <div className="space-y-4">{renderRegisterStep()}</div>

            <div className="mt-4 flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                disabled={registerStep === 1}
                onClick={handleBackRegisterStep}
              >
                Quay lại
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleNextRegisterStep}
                disabled={isVerifyingOtp && registerStep === 1}
              >
                {registerStep === 3 ? "Hoàn tất đăng ký" : "Tiếp tục"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Login;
