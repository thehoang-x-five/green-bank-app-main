import type {
  BillService,
  UtilityFormData,
  UtilityResultState,
  FlightOption,
} from "./utilityTypes";
import { DATA_PACKS, getTelcoLabel } from "./utilityData";

export const getBillServiceLabel = (service: BillService | null) => {
  if (!service) return "-";
  if (service === "electric") return "Điện";
  if (service === "water") return "Nước";
  return "Điện thoại di động";
};

export function buildBillReceipt(args: {
  billService: BillService;
  billSave: boolean;
  formData: UtilityFormData;
}): UtilityResultState {
  const now = new Date();
  const serviceLabel = getBillServiceLabel(args.billService);

  const title =
    args.billService === "electric"
      ? "Thanh toán hóa đơn điện"
      : args.billService === "water"
      ? "Thanh toán hóa đơn nước"
      : "Thanh toán hóa đơn điện thoại di động";

  return {
    flow: "bill",
    amount: "350.000",
    title,
    time: now.toLocaleString("vi-VN"),
    fee: "0 đ",
    transactionId: "HD-BILL-" + now.getTime(),
    details: [
      { label: "Loại hóa đơn", value: serviceLabel },
      { label: "Nhà cung cấp", value: args.formData.billProvider || "-" },
      { label: "Mã khách hàng", value: args.formData.customerCode },
      { label: "Lưu hóa đơn", value: args.billSave ? "Có" : "Không" },
    ],
  };
}

export function buildPhoneReceipt(
  formData: UtilityFormData
): UtilityResultState {
  const now = new Date();
  const amount = formData.topupAmount || "50.000";
  return {
    flow: "phone",
    amount,
    title: "Nạp tiền điện thoại",
    time: now.toLocaleString("vi-VN"),
    fee: "0 đ",
    transactionId: "HD-TOPUP-" + now.getTime(),
    details: [
      { label: "Số điện thoại", value: formData.phoneNumber },
      { label: "Nhà mạng", value: getTelcoLabel(formData.telco) },
    ],
  };
}

export function buildDataReceipt(
  formData: UtilityFormData
): UtilityResultState {
  const now = new Date();
  const selectedPack = DATA_PACKS.find((p) => p.id === formData.dataPack);
  const amount = selectedPack
    ? selectedPack.price.toLocaleString("vi-VN")
    : "0";
  return {
    flow: "data",
    amount,
    title: "Mua 3G/4G",
    time: now.toLocaleString("vi-VN"),
    fee: "0 đ",
    transactionId: "HD-DATA-" + now.getTime(),
    details: [
      { label: "Số điện thoại", value: formData.dataPhone },
      { label: "Nhà mạng", value: getTelcoLabel(formData.dataTelco) },
      {
        label: "Gói data",
        value: selectedPack
          ? `${selectedPack.name} (${selectedPack.code})`
          : "-",
      },
    ],
  };
}

export function buildMovieReceipt(
  formData: UtilityFormData
): UtilityResultState {
  const now = new Date();
  const tickets = Number(formData.movieTickets || "1");
  const amountNumber = 100000 * (isNaN(tickets) ? 1 : tickets);
  const amount = amountNumber.toLocaleString("vi-VN");
  return {
    flow: "movie",
    amount,
    title: "Mua vé xem phim",
    time: now.toLocaleString("vi-VN"),
    fee: "0 đ",
    transactionId: "HD-MOVIE-" + now.getTime(),
    details: [
      { label: "Rạp chiếu", value: formData.movieCinema },
      { label: "Tên phim", value: formData.movieName },
      { label: "Ngày chiếu", value: formData.movieDate },
      { label: "Suất chiếu", value: formData.movieTime },
      { label: "Số lượng vé", value: String(tickets || 1) },
    ],
  };
}

type HotelReceiptOptions = {
  nights?: number;
  roomName?: string;
  nightlyRate?: number;
};

export function buildHotelReceipt(
  formData: UtilityFormData,
  options?: HotelReceiptOptions
): UtilityResultState {
  const now = new Date();
  const rooms = Number(formData.hotelRooms || "1");
  const nights =
    typeof options?.nights === "number" && options.nights > 0
      ? Math.round(options.nights)
      : 1;
  const nightlyRate = options?.nightlyRate ?? 800000;
  const roomName = options?.roomName ?? "Phòng tiêu chuẩn";

  const roomsCount = isNaN(rooms) || rooms <= 0 ? 1 : rooms;
  const amountNumber = nightlyRate * roomsCount * nights;
  const amount = amountNumber.toLocaleString("vi-VN");
  return {
    flow: "hotel",
    amount,
    title: "Đặt phòng khách sạn",
    time: now.toLocaleString("vi-VN"),
    fee: "0 đ",
    transactionId: "HD-HOTEL-" + now.getTime(),
    details: [
      { label: "Thành phố / Khu vực", value: formData.hotelCity },
      { label: "Ngày nhận phòng", value: formData.hotelCheckIn },
      { label: "Ngày trả phòng", value: formData.hotelCheckOut },
      { label: "Số đêm", value: String(nights) },
      { label: "Hạng phòng", value: roomName },
      { label: "Số khách", value: String(formData.hotelGuests || "1") },
      { label: "Số phòng", value: String(roomsCount) },
    ],
  };
}

export function buildFlightReceipt(args: {
  selectedFlight: FlightOption;
  formData: UtilityFormData;
}): UtilityResultState {
  const now = new Date();
  const adult = Number(args.formData.flightAdult || "1");
  const child = Number(args.formData.flightChild || "0");
  const infant = Number(args.formData.flightInfant || "0");
  const totalPax =
    (isNaN(adult) ? 0 : adult) +
    (isNaN(child) ? 0 : child) +
    (isNaN(infant) ? 0 : infant);

  const amountNumber =
    args.selectedFlight.price * (totalPax > 0 ? totalPax : 1);
  const amount = amountNumber.toLocaleString("vi-VN");

  return {
    flow: "flight",
    amount,
    title: "Mua vé máy bay",
    time: now.toLocaleString("vi-VN"),
    fee: "0 đ",
    transactionId: "HD-FLIGHT-" + now.getTime(),
    details: [
      {
        label: "Hãng hàng không",
        value: `${args.selectedFlight.airline} (${args.selectedFlight.code})`,
      },
      {
        label: "Hành trình",
        value: `${args.selectedFlight.fromCode} → ${args.selectedFlight.toCode}`,
      },
      { label: "Ngày bay", value: args.formData.flightDate },
      {
        label: "Giờ bay",
        value: `${args.selectedFlight.departTime} - ${args.selectedFlight.arriveTime}`,
      },
      {
        label: "Số hành khách",
        value: `${adult} NL, ${child} TE, ${infant} EB`,
      },
      { label: "Hạng ghế", value: args.selectedFlight.cabin },
    ],
  };
}
