// src/hooks/useUserAccount.ts
import { useState, useEffect } from "react";
import { firebaseAuth, firebaseRtdb } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { getPrimaryAccount, type BankAccount } from "@/services/accountService";
import type { AppUserProfile } from "@/services/authService";

export function useUserAccount() {
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [userProfile, setUserProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccountAndProfile = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (!user) {
          setAccount(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        // Lấy cả account và user profile
        const [acc, profileSnap] = await Promise.all([
          getPrimaryAccount(user.uid),
          get(ref(firebaseRtdb, `users/${user.uid}`)),
        ]);

        setAccount(acc);

        if (profileSnap.exists()) {
          setUserProfile(profileSnap.val() as AppUserProfile);
        }
      } catch (error) {
        console.error("Error fetching user account and profile:", error);
        setAccount(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAccountAndProfile();
  }, []);

  return { account, userProfile, loading };
}
