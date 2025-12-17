// src/pages/utilities/utilityData.ts
import type { FlightOption, LocationOption } from "./utilityTypes";

export const MOCK_USER_PHONE = "0862525038";

export const formatCurrencyVND = (value: number) =>
  value.toLocaleString("vi-VN") + " đ";

export const validatePhoneNumber = (phone: string) => /^0\d{9}$/.test(phone);

/**
 * Auto detect telco theo prefix (demo rule).
 * return: "viettel" | "vina" | "mobi" | "" (unknown)
 */
export const detectTelcoByPhone = (phone: string): string => {
  const p = (phone || "").replace(/\D/g, "");
  if (!/^0\d{9}$/.test(p)) return "";

  const viettel = [
    "086",
    "096",
    "097",
    "098",
    "032",
    "033",
    "034",
    "035",
    "036",
    "037",
    "038",
    "039",
  ];
  const vina = ["088", "091", "094", "081", "082", "083", "084", "085"];
  const mobi = ["089", "090", "093", "070", "076", "077", "078", "079"];

  const prefix3 = p.slice(0, 3);
  if (viettel.includes(prefix3)) return "viettel";
  if (vina.includes(prefix3)) return "vina";
  if (mobi.includes(prefix3)) return "mobi";
  return "";
};

export const mockFlights: FlightOption[] = [
  {
    id: "VN270-ECO",
    airline: "Vietnam Airlines",
    code: "270",
    fromCode: "SGN",
    fromName: "Sân bay quốc tế Tân Sơn Nhất",
    toCode: "HAN",
    toName: "Sân bay quốc tế Nội Bài",
    departTime: "23:05",
    arriveTime: "01:10",
    duration: "2 giờ 5 phút",
    cabin: "Economy Flex",
    price: 3841000,
  },
  {
    id: "VN270-BUS",
    airline: "Vietnam Airlines",
    code: "270",
    fromCode: "SGN",
    fromName: "Sân bay quốc tế Tân Sơn Nhất",
    toCode: "HAN",
    toName: "Sân bay quốc tế Nội Bài",
    departTime: "23:05",
    arriveTime: "01:10",
    duration: "2 giờ 5 phút",
    cabin: "Business Classic",
    price: 5960000,
  },
];

export const LOCATION_SECTIONS: string[] = [
  "Miền Bắc",
  "Miền Trung",
  "Miền Nam",
  "Đông Nam Á",
  "Đông Bắc Á",
  "Châu Âu",
  "Châu Mỹ",
  "Châu Úc",
  "Châu Phi",
];

export const ALL_LOCATIONS: LocationOption[] = [
  {
    code: "HAN",
    city: "Hà Nội",
    airport: "Sân bay Nội Bài",
    region: "Miền Bắc",
  },
  {
    code: "HPH",
    city: "Hải Phòng",
    airport: "Sân bay Cát Bi",
    region: "Miền Bắc",
  },
  {
    code: "VDO",
    city: "Quảng Ninh",
    airport: "Sân bay Quốc tế Vân Đồn",
    region: "Miền Bắc",
  },
  {
    code: "DIN",
    city: "Điện Biên",
    airport: "Sân bay Điện Biên Phủ",
    region: "Miền Bắc",
  },

  {
    code: "DAD",
    city: "Đà Nẵng",
    airport: "Sân bay Quốc tế Đà Nẵng",
    region: "Miền Trung",
  },
  {
    code: "CXR",
    city: "Nha Trang",
    airport: "Sân bay Quốc tế Cam Ranh",
    region: "Miền Trung",
  },

  {
    code: "SGN",
    city: "Hồ Chí Minh",
    airport: "Sân bay Tân Sơn Nhất",
    region: "Miền Nam",
  },
  {
    code: "PQC",
    city: "Phú Quốc",
    airport: "Sân bay Phú Quốc",
    region: "Miền Nam",
  },
  {
    code: "VCA",
    city: "Cần Thơ",
    airport: "Sân bay Quốc tế Cần Thơ",
    region: "Miền Nam",
  },
  {
    code: "VCS",
    city: "Côn Đảo",
    airport: "Sân bay Côn Đảo",
    region: "Miền Nam",
  },
  {
    code: "VKG",
    city: "Rạch Giá",
    airport: "Sân bay Rạch Giá",
    region: "Miền Nam",
  },

  {
    code: "BKK",
    city: "Bangkok",
    airport: "Sân bay Quốc tế Suvarnabhumi",
    region: "Đông Nam Á",
  },
  {
    code: "SIN",
    city: "Singapore",
    airport: "Sân bay Changi",
    region: "Đông Nam Á",
  },

  {
    code: "ICN",
    city: "Seoul",
    airport: "Sân bay Quốc tế Incheon",
    region: "Đông Bắc Á",
  },
  {
    code: "NRT",
    city: "Tokyo",
    airport: "Sân bay Narita",
    region: "Đông Bắc Á",
  },

  {
    code: "CDG",
    city: "Paris",
    airport: "Sân bay Charles de Gaulle",
    region: "Châu Âu",
  },
  {
    code: "LHR",
    city: "London",
    airport: "Sân bay Heathrow",
    region: "Châu Âu",
  },

  {
    code: "LAX",
    city: "Los Angeles",
    airport: "Los Angeles International Airport",
    region: "Châu Mỹ",
  },
  {
    code: "JFK",
    city: "New York",
    airport: "John F. Kennedy International Airport",
    region: "Châu Mỹ",
  },

  {
    code: "SYD",
    city: "Sydney",
    airport: "Sydney Kingsford Smith Airport",
    region: "Châu Úc",
  },
  {
    code: "CAI",
    city: "Cairo",
    airport: "Cairo International Airport",
    region: "Châu Phi",
  },
];

export const ELECTRIC_PROVIDERS = [
  "Điện lực HCM",
  "Điện lực Hà Nội",
  "Điện lực toàn quốc",
  "Hợp tác xã điện",
];

export const WATER_PROVIDERS = [
  "Cấp nước Bình Thuận",
  "Cấp nước Bình Phước",
  "Cấp nước Khánh Hòa",
  "Cấp nước Kiên Giang",
  "Cấp nước Hà Tĩnh",
  "Cấp nước Bến Lức",
  "Cấp nước Sơn Hà",
  "Cấp nước Vạn Ninh",
  "Cấp nước Thủ Thừa",
  "Cấp nước Cà Mau",
  "Cấp nước Tiền Giang",
  "Cấp nước Trà Vinh",
];

export const MOBILE_PROVIDERS = ["Viettel", "VinaPhone", "MobiFone"];

/**
 * Dữ liệu nạp tiền
 */
export const PHONE_TOPUP_AMOUNTS = [
  10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000,
];

export const TOPUP_AMOUNTS = PHONE_TOPUP_AMOUNTS;

/**
 * Data packs cơ bản (để tương thích code cũ nếu có)
 */
export const DATA_PACKS = [
  { id: "ks6h", name: "3GB - 6 giờ", code: "KS6H", price: 10000 },
  { id: "ks8", name: "1.5GB - 1 ngày", code: "KS8", price: 8000 },
  { id: "ks12", name: "2.5GB - 1 ngày", code: "KS12", price: 12000 },
  { id: "ks20", name: "4GB - 3 ngày", code: "KS20", price: 20000 },
];

/**
 * UI packs (đúng format UtilityDataPack.tsx)
 */
export type DataPackUI = {
  id: string;
  name: string;
  price: number;
  description: string;
  telco?: "viettel" | "vina" | "mobi" | "all";
};

/**
 * ✅ [PATCH-5][PATCH-6] Chia nhóm gói data đúng yêu cầu:
 * - Gói data phổ biến
 * - Gói Data ngày
 * - Gói Data 5G
 * - Gói Data tháng
 * - Gói cước TV360
 *
 * Lưu ý: Đây là data demo để render UI, không ảnh hưởng luồng khác.
 */
export const DATA_PACK_GROUPS: {
  key: string;
  title: string;
  packs: DataPackUI[];
}[] = [
  // 1) Popular
  {
    key: "popular",
    title: "Gói Data phổ biến",
    packs: [
      {
        id: "pop-3gb-6h",
        name: "3GB - 6 giờ",
        price: 10000,
        description: "3GB • 6 giờ • Phù hợp dùng nhanh",
        telco: "all",
      },
      {
        id: "pop-12gb-1d",
        name: "1.2GB - 1 ngày",
        price: 8000,
        description: "1.2GB • 1 ngày • Giá tiết kiệm",
        telco: "all",
      },
      {
        id: "pop-4gb-3d",
        name: "4GB - 3 ngày",
        price: 20000,
        description: "4GB • 3 ngày • Dùng ổn định",
        telco: "all",
      },
      {
        id: "pop-8gb-7d",
        name: "8GB - 7 ngày",
        price: 36000,
        description: "8GB • 7 ngày • Dành cho người dùng nhiều",
        telco: "all",
      },
      {
        id: "pop-1n-tmdt",
        name: "1N_TMDT",
        price: 10000,
        description: "5GB • 1 ngày • Gói theo nhu cầu",
        telco: "all",
      },
      {
        id: "pop-ks110",
        name: "KS110",
        price: 110000,
        description: "30GB • 30 ngày • Gói dài ngày",
        telco: "all",
      },
      {
        id: "pop-5g13ks",
        name: "5G13KS",
        price: 13000,
        description: "7GB • 1 ngày • Data tốc độ cao",
        telco: "all",
      },
    ],
  },

  // 2) Daily
  {
    key: "daily",
    title: "Gói Data ngày",
    packs: [
      {
        id: "day-25gb",
        name: "2.5GB - 1 ngày",
        price: 12000,
        description: "2.5GB • 1 ngày",
        telco: "all",
      },
      {
        id: "day-vt1",
        name: "VT1",
        price: 50000,
        description: "28GB • 7 ngày",
        telco: "all",
      },
      {
        id: "day-7n-tmdt",
        name: "7N_TMDT",
        price: 70000,
        description: "35GB • 7 ngày",
        telco: "all",
      },
    ],
  },

  // 3) 5G
  {
    key: "5g",
    title: "Gói Data 5G",
    packs: [
      {
        id: "5g-65gb-7d",
        name: "65GB - 7 ngày",
        price: 85000,
        description: "65GB • 7 ngày • Data 5G",
        telco: "all",
      },
      {
        id: "5gmxh200",
        name: "5GMXH200",
        price: 200000,
        description: "60GB • 30 ngày • Gói 5G MXH",
        telco: "all",
      },
      {
        id: "5gmxh230",
        name: "5GMXH230",
        price: 230000,
        description: "30GB • 30 ngày • Gói 5G MXH",
        telco: "all",
      },
    ],
  },

  // 4) Monthly
  {
    key: "monthly",
    title: "Gói Data tháng",
    packs: [
      {
        id: "ks145",
        name: "KS145",
        price: 145000,
        description: "66GB • 30 ngày",
        telco: "all",
      },
      {
        id: "ks165",
        name: "KS165",
        price: 165000,
        description: "90GB • 30 ngày",
        telco: "all",
      },
      {
        id: "5gvt6",
        name: "5GVT6",
        price: 250000,
        description: "240GB • 30 ngày",
        telco: "all",
      },
    ],
  },

  // 5) TV360
  {
    key: "tv360",
    title: "Gói cước TV360",
    packs: [
      {
        id: "vcine30",
        name: "VCINE30",
        price: 20000,
        description: "20.000 VND • 30 ngày • TV360",
        telco: "all",
      },
      {
        id: "vcine90",
        name: "VCINE90",
        price: 60000,
        description: "60.000 VND • 90 ngày • TV360",
        telco: "all",
      },
      {
        id: "vsport30",
        name: "VSPORT30",
        price: 30000,
        description: "30.000 VND • 30 ngày • TV360",
        telco: "all",
      },
      {
        id: "vsport90",
        name: "VSPORT90",
        price: 90000,
        description: "90.000 VND • 90 ngày • TV360",
        telco: "all",
      },
      {
        id: "standard7",
        name: "STANDARD7",
        price: 15000,
        description: "15.000 VND • 7 ngày • TV360",
        telco: "all",
      },
      {
        id: "standard30",
        name: "STANDARD30",
        price: 50000,
        description: "50.000 VND • 30 ngày • TV360",
        telco: "all",
      },
      {
        id: "vip7",
        name: "VIP7",
        price: 25000,
        description: "25.000 VND • 7 ngày • TV360",
        telco: "all",
      },
      {
        id: "vip30",
        name: "VIP30",
        price: 80000,
        description: "80.000 VND • 30 ngày • TV360",
        telco: "all",
      },
      {
        id: "vip90",
        name: "VIP90",
        price: 220000,
        description: "220.000 VND • 90 ngày • TV360",
        telco: "all",
      },
    ],
  },
];

export const RECENT_MOBILE_TRANSACTIONS = [
  {
    id: 1,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
  {
    id: 2,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
  {
    id: 3,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
  {
    id: 4,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
  {
    id: 5,
    title: "Nạp tiền điện thoại",
    phone: MOCK_USER_PHONE,
    amount: 10000,
  },
];

export const getTelcoLabel = (code: string) => {
  switch (code) {
    case "viettel":
      return "Viettel";
    case "vina":
      return "VinaPhone";
    case "mobi":
      return "MobiFone";
    default:
      return code || "-";
  }
};
