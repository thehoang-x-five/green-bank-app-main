// src/hooks/useEkycCheck.ts
import { useUserAccount } from "./useUserAccount";

/**
 * Hook kiểm tra trạng thái eKYC của người dùng
 * Trả về:
 * - isVerified: true nếu đã xác thực eKYC
 * - ekycStatus: trạng thái eKYC hiện tại
 * - loading: đang tải dữ liệu
 */
export function useEkycCheck() {
  const { userProfile, loading } = useUserAccount();

  const ekycStatus = userProfile?.ekycStatus || userProfile?.kycStatus || null;
  const isVerified = ekycStatus === "VERIFIED";

  return {
    isVerified,
    ekycStatus,
    loading,
  };
}
