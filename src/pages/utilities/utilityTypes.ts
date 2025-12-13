export type UtilityType =
  | "bill"
  | "mobilePhone"
  | "phone"
  | "data"
  | "flight"
  | "movie"
  | "hotel"
  | "insurance"
  | "all";

export type UtilityFlow =
  | "bill"
  | "phone"
  | "data"
  | "flight"
  | "movie"
  | "hotel";

export type BillService = "electric" | "water" | "mobile";

export type SeatClass = "all" | "eco" | "business";
export type FlightStep = 1 | 2 | 3;

export type FlightOption = {
  id: string;
  airline: string;
  code: string;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  departTime: string;
  arriveTime: string;
  duration: string;
  cabin: string;
  price: number;
};

export type LocationOption = {
  code: string;
  city: string;
  airport: string;
  region: string;
};

export type UtilityResultState = {
  flow: UtilityFlow;
  amount: string;
  title: string;
  time: string;
  fee: string;
  transactionId: string;
  details: { label: string; value: string }[];
};

export type UtilityFormData = {
  // bill
  billType: string;
  billProvider: string;
  customerCode: string;
  billAmount: string;

  // phone
  phoneNumber: string;
  telco: string;
  topupAmount: string;

  // data
  dataPhone: string;
  dataTelco: string;
  dataPack: string;

  // flight
  flightFrom: string;
  flightTo: string;
  flightDate: string;
  flightReturnDate: string;
  flightSeatClass: SeatClass;
  flightAdult: string;
  flightChild: string;
  flightInfant: string;

  // movie
  movieCinema: string;
  movieName: string;
  movieDate: string;
  movieTime: string;
  movieTickets: string;

  // hotel
  hotelCity: string;
  hotelCheckIn: string;
  hotelCheckOut: string;
  hotelGuests: string;
  hotelRooms: string;
};
