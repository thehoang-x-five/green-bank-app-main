// src/dev/seedExternalAccounts.ts
import { firebaseRtdb } from "@/lib/firebase";
import { ref, set } from "firebase/database";

/**
 * Seed dữ liệu tài khoản ngân hàng khác (externalAccounts) vào Realtime Database.
 * Mỗi ngân hàng: 2 khách hàng mẫu.
 */
export async function seedExternalAccounts() {
  const data = {
    Vietcombank: {
      "1234567890": {
        fullName: "Nguyen Van A",
        accountNumber: "1234567890",
        bankName: "Vietcombank",
        status: "ACTIVE",
        balance: 50_000_000,
      },
      "2345678901": {
        fullName: "Tran Thi B",
        accountNumber: "2345678901",
        bankName: "Vietcombank",
        status: "ACTIVE",
        balance: 15_500_000,
      },
    },

    BIDV: {
      "3456789012": {
        fullName: "Le Van C",
        accountNumber: "3456789012",
        bankName: "BIDV",
        status: "ACTIVE",
        balance: 20_000_000,
      },
      "4567890123": {
        fullName: "Pham Thi D",
        accountNumber: "4567890123",
        bankName: "BIDV",
        status: "ACTIVE",
        balance: 8_000_000,
      },
    },

    Techcombank: {
      "5678901234": {
        fullName: "Hoang Van E",
        accountNumber: "5678901234",
        bankName: "Techcombank",
        status: "ACTIVE",
        balance: 30_000_000,
      },
      "6789012345": {
        fullName: "Do Thi F",
        accountNumber: "6789012345",
        bankName: "Techcombank",
        status: "ACTIVE",
        balance: 12_300_000,
      },
    },

    VietinBank: {
      "7890123456": {
        fullName: "Nguyen Van G",
        accountNumber: "7890123456",
        bankName: "VietinBank",
        status: "ACTIVE",
        balance: 18_000_000,
      },
      "8901234567": {
        fullName: "Tran Thi H",
        accountNumber: "8901234567",
        bankName: "VietinBank",
        status: "ACTIVE",
        balance: 22_500_000,
      },
    },

    ACB: {
      "9012345678": {
        fullName: "Le Van I",
        accountNumber: "9012345678",
        bankName: "ACB",
        status: "ACTIVE",
        balance: 9_900_000,
      },
      "1122334455": {
        fullName: "Pham Thi K",
        accountNumber: "1122334455",
        bankName: "ACB",
        status: "ACTIVE",
        balance: 41_000_000,
      },
    },

    Agribank: {
      "2233445566": {
        fullName: "Hoang Van L",
        accountNumber: "2233445566",
        bankName: "Agribank",
        status: "ACTIVE",
        balance: 6_500_000,
      },
      "3344556677": {
        fullName: "Do Thi M",
        accountNumber: "3344556677",
        bankName: "Agribank",
        status: "ACTIVE",
        balance: 27_000_000,
      },
    },

    "MB Bank": {
      "4455667788": {
        fullName: "Nguyen Van N",
        accountNumber: "4455667788",
        bankName: "MB Bank",
        status: "ACTIVE",
        balance: 13_000_000,
      },
      "5566778899": {
        fullName: "Tran Thi O",
        accountNumber: "5566778899",
        bankName: "MB Bank",
        status: "ACTIVE",
        balance: 19_800_000,
      },
    },

    VPBank: {
      "6677889900": {
        fullName: "Le Van P",
        accountNumber: "6677889900",
        bankName: "VPBank",
        status: "ACTIVE",
        balance: 24_000_000,
      },
      "7788990011": {
        fullName: "Pham Thi Q",
        accountNumber: "7788990011",
        bankName: "VPBank",
        status: "ACTIVE",
        balance: 11_400_000,
      },
    },
  };

  await set(ref(firebaseRtdb, "externalAccounts"), data);
}
