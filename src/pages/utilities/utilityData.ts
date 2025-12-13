import type { FlightOption, LocationOption } from "./utilityTypes";

export const MOCK_USER_PHONE = "0862525038";

export const formatCurrencyVND = (value: number) =>
  value.toLocaleString("vi-VN") + " đ";

export const validatePhoneNumber = (phone: string) => /^0\d{9}$/.test(phone);

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

export const PHONE_TOPUP_AMOUNTS = [
  10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000,
];

export const DATA_PACKS = [
  { id: "ks6h", name: "3GB - 6 giờ", code: "KS6H", price: 10000 },
  { id: "ks8", name: "1.5GB - 1 ngày", code: "KS8", price: 8000 },
  { id: "ks12", name: "2.5GB - 1 ngày", code: "KS12", price: 12000 },
  { id: "ks20", name: "4GB - 3 ngày", code: "KS20", price: 20000 },
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
