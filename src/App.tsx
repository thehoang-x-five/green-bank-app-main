import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import type { UtilityType } from "@/pages/utilities/utilityTypes";
import DevSeedOfficersPage from "@/pages/DevSeedOfficers";

// ✅ [PATCH-ADD-TRANSFER-BIOMETRIC] thêm từ code (2)
import TransferBiometricConfirm from "@/pages/TransferBiometricConfirm";

// ✅ [PATCH-ADD-TRANSFER-OTP] thêm từ code (2)
import TransferOtpConfirm from "@/pages/TransferOtpConfirm";

// ✅ [PATCH-ADD-PAYMENT-DEPOSIT-WITHDRAW] thêm từ code (2)
import PaymentAccountDeposit from "@/pages/PaymentAccountDeposit";
import PaymentAccountWithdraw from "@/pages/PaymentAccountWithdraw";

// Auth & common
import Login from "@/pages/Login";
import OtpVerification from "@/pages/OtpVerification";
import NotFound from "@/pages/NotFound";

// Customer area pages
import Home from "@/pages/Home";
import Transfer from "@/pages/Transfer";
import TransferToAccount from "@/pages/TransferToAccount";
import TransferToCard from "@/pages/TransferToCard";
import TransferToMyAccount from "@/pages/TransferToMyAccount";
import TransferToMyAccountConfirm from "@/pages/TransferToMyAccountConfirm";
import TransferReceipt from "@/pages/TransferReceipt";
import TransferInternational from "@/pages/TransferInternational";

import Accounts from "@/pages/Accounts";
import PaymentAccountDetail from "@/pages/PaymentAccountDetail";
import SavingsAccountDetail from "@/pages/SavingsAccountDetail";
import MortgageAccountDetail from "@/pages/MortgageAccountDetail";

import Notifications from "@/pages/Notifications";
import QRScanner from "@/pages/QRScanner";
import MyQR from "@/pages/MyQR";

import Profile from "@/pages/Profile";
import ProfileInfo from "@/pages/ProfileInfo";
import ProfileInfoEdit from "@/pages/ProfileInfoEdit";
import ProfileDocumentsUpdate from "@/pages/ProfileDocumentsUpdate";
import AccountSettings from "@/pages/AccountSettings";
import SecuritySettings from "@/pages/SecuritySettings";
import SupportHelp from "@/pages/SupportHelp";

import TransactionDetail from "@/pages/TransactionDetail";
import UtilityBills from "@/pages/UtilityBills";
import UtilityReceipt from "@/pages/UtilityReceipt";
import HotelBooking from "@/pages/HotelBooking";
import MovieBooking from "@/pages/MovieBooking";
import UtilityMobileHistory from "@/pages/UtilityMobileHistory";
import UtilityConfirmPayment from "@/pages/utilities/UtilityConfirmPayment";

import BottomNav from "@/components/BottomNav";

import PaymentAccountDeposit from "@/pages/PaymentAccountDeposit";
import PaymentAccountWithdraw from "@/pages/PaymentAccountWithdraw";

// Officer area pages
import OfficerDashboard from "@/pages/OfficerDashboard";
import OfficerCustomersPage from "@/pages/OfficerCustomersPage";
import OfficerCustomerCreatePage from "@/pages/OfficerCustomerCreatePage";
import OfficerCustomerDetailPage from "@/pages/OfficerCustomerDetailPage";
import OfficerAccountCreatePage from "@/pages/OfficerAccountCreatePage";
import OfficerAccountDetailPage from "@/pages/OfficerAccountDetailPage";
import OfficerRatesPage from "@/pages/OfficerRatesPage";
import OfficerTransactionsPage from "@/pages/OfficerTransactionsPage";
import OfficerEKYCPage from "@/pages/OfficerEKYCPage";
import OfficerEKYCDetailPage from "@/pages/OfficerEKYCDetailPage";

// 🔹 MÀN XÁC THỰC OTP CHUYỂN TIỀN
import TransferOtpConfirm from "@/pages/TransferOtpConfirm";

const UtilitiesShell = () => {
  const { type } = useParams<{ type: UtilityType }>();
  const hideBottomNav = type === "mobilePhone";

const queryClient = new QueryClient();
  return (
    <>
      <UtilityBills />
      {!hideBottomNav && <BottomNav />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/otp" element={<OtpVerification />} />

          {/* Customer area */}
          <Route
            path="/home"
            element={
              <>
                <Home />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/transfer"
            element={
              <>
                <Transfer />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/transfer/account"
            element={
              <>
                <TransferToAccount />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/transfer/card"
            element={
              <>
                <TransferToCard />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/transfer/self"
            element={
              <>
                <TransferToMyAccount />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/transfer/self/confirm"
            element={
              <>
                <TransferToMyAccountConfirm />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/transfer/international"
            element={
              <>
                <TransferInternational />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/transfer/result"
            element={
              <>
                <TransferReceipt />
                <BottomNav />
              </>
            }
          />

          {/* ✅ [PATCH-ADD-TRANSFER-BIOMETRIC-ROUTE] thêm từ code (2) */}
          <Route
            path="/transfer/biometric"
            element={
              <>
                <TransferBiometricConfirm />
                <BottomNav />
              </>
            }
          />

          {/* ✅ [PATCH-ADD-TRANSFER-OTP-ROUTE] thêm từ code (2) */}
          <Route path="/transfer/otp" element={<TransferOtpConfirm />} />

          {/* Accounts list */}
          <Route
            path="/accounts"
            element={
              <>
                <Accounts />
                <BottomNav />
              </>
            }
          />

          {/* Payment account detail */}
          <Route
            path="/accounts/payment"
            element={
              <>
                <PaymentAccountDetail />
                <BottomNav />
              </>
            }
          />

          {/* ✅ [PATCH-ADD-PAYMENT-DEPOSIT-ROUTE] thêm từ code (2) */}
          <Route
            path="/accounts/payment/deposit"
            element={
              <>
                <PaymentAccountDeposit />
                <BottomNav />
              </>
            }
          />

          {/* ✅ [PATCH-ADD-PAYMENT-WITHDRAW-ROUTE] thêm từ code (2) */}
          <Route
            path="/accounts/payment/withdraw"
            element={
              <>
                <PaymentAccountWithdraw />
                <BottomNav />
              </>
            }
          />

          {/* Savings account detail – CÓ PARAM accountNumber */}
          <Route
            path="/accounts/savings/:accountNumber"
            element={
              <>
                <SavingsAccountDetail />
                <BottomNav />
              </>
            }
          />
          {/* Mortgage account detail – CÓ PARAM accountNumber */}
          <Route
            path="/accounts/mortgage/:accountNumber"
            element={
              <>
                <MortgageAccountDetail />
                <BottomNav />
              </>
            }
          />
          {/* Dev seed officers */}
          <Route path="/dev-seed-officers" element={<DevSeedOfficersPage />} />
          <Route
            path="/notifications"
            element={
              <>
                <Notifications />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/qr-scanner"
            element={
              <>
                <QRScanner />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/my-qr"
            element={
              <>
                <MyQR />
                <BottomNav />
              </>
            }
          />
          {/* Profile & settings */}
          <Route
            path="/profile"
            element={
              <>
                <Profile />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/profile/info"
            element={
              <>
                <ProfileInfo />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/profile/info/edit"
            element={
              <>
                <ProfileInfoEdit />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/profile/documents/update"
            element={
              <>
                <ProfileDocumentsUpdate />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/profile/settings"
            element={
              <>
                <AccountSettings />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/profile/security"
            element={
              <>
                <SecuritySettings />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/profile/support"
            element={
              <>
                <SupportHelp />
                <BottomNav />
              </>
            }
          />
          {/* Transaction detail */}
          <Route
            path="/transaction/:id"
            element={
              <>
                <TransactionDetail />
                <BottomNav />
              </>
            }
          />

          {/* Utilities */}
          <Route
            path="/utilities/hotel-booking"
            element={
              <>
                <HotelBooking />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/utilities/movie-booking"
            element={
              <>
                <MovieBooking />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/utilities/:type"
            element={
              <>
                <UtilityBills />
                <BottomNav />
              </>
            }
          />
          <Route path="/utilities/:type" element={<UtilitiesShell />} />

          <Route
            path="/utilities/result"
            element={
              <>
                <UtilityReceipt />
              </>
            }
          />
          <Route
            path="/utilities/confirm"
            element={<UtilityConfirmPayment />}
          />
          <Route
            path="/utilities/mobile-history"
            element={<UtilityMobileHistory />}
          />

          {/* Officer area */}
          <Route path="/officer" element={<OfficerDashboard />} />
          <Route path="/officer/customers" element={<OfficerCustomersPage />} />
          <Route
            path="/officer/customers/new"
            element={<OfficerCustomerCreatePage />}
          />
          <Route
            path="/officer/customers/:id"
            element={<OfficerCustomerDetailPage />}
          />
          <Route
            path="/officer/customers/:customerId/accounts/new"
            element={<OfficerAccountCreatePage />}
          />
          <Route
            path="/officer/accounts/:accountId"
            element={<OfficerAccountDetailPage />}
          />
          <Route path="/officer/rates" element={<OfficerRatesPage />} />
          <Route
            path="/officer/transactions"
            element={<OfficerTransactionsPage />}
          />
          <Route path="/officer/ekyc" element={<OfficerEKYCPage />} />
          <Route
            path="/officer/ekyc/:id"
            element={<OfficerEKYCDetailPage />}
          />
          <Route
            path="/transfer/biometric"
            element={
              <>
                <TransferBiometricConfirm />
                <BottomNav />
              </>
            }
          />

          <Route path="/transfer/otp" element={<TransferOtpConfirm />} />

          {/* 🔹 Nạp / Rút tài khoản thanh toán (không dùng :id) */}
          <Route
            path="/accounts/payment/deposit"
            element={
              <>
                <PaymentAccountDeposit />
                <BottomNav />
              </>
            }
          />
          <Route
            path="/accounts/payment/withdraw"
            element={
              <>
                <PaymentAccountWithdraw />
                <BottomNav />
              </>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
