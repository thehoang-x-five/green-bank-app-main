/**
 * Hotel seed data for demo
 * VN major cities: 30-50 hotels each
 * International cities: 10 hotels each
 */

// Helper to generate hotel variations
function generateHotels(cityKey, cityName, count, priceRange, isVN = true) {
  const hotels = [];
  const starOptions = [3, 4, 5];
  const amenitiesOptions = [
    ["wifi"],
    ["wifi", "breakfast"],
    ["wifi", "pool"],
    ["wifi", "breakfast", "pool"],
    ["wifi", "breakfast", "gym"],
    ["wifi", "pool", "gym"],
    ["wifi", "breakfast", "pool", "gym"],
    ["wifi", "breakfast", "pool", "gym", "spa"],
  ];
  
  const prefixes = [
    "Grand", "Royal", "Premier", "Luxury", "Elite", "Golden", "Silver", "Diamond",
    "Emerald", "Sapphire", "Pearl", "Crystal", "Sunrise", "Sunset", "Ocean", "River",
    "Lake", "Mountain", "Garden", "Park", "Central", "Plaza", "Tower", "Palace",
    "Heritage", "Boutique", "Modern", "Classic", "Imperial", "Majestic"
  ];
  
  const suffixes = [
    "Hotel", "Resort", "Suites", "Inn", "Lodge", "Residence", "Stay", "Place",
    "House", "Retreat", "Villa", "Mansion", "Court", "Gardens"
  ];

  for (let i = 0; i < count; i++) {
    const stars = starOptions[Math.floor(Math.random() * starOptions.length)];
    const amenities = amenitiesOptions[Math.floor(Math.random() * amenitiesOptions.length)];
    const prefix = prefixes[i % prefixes.length];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    // Price based on stars
    const basePrice = priceRange[0] + (stars - 3) * ((priceRange[1] - priceRange[0]) / 3);
    const priceVariation = (Math.random() - 0.5) * 0.3 * basePrice;
    const price = Math.round((basePrice + priceVariation) / 10000) * 10000;
    
    hotels.push({
      cityKey,
      name: `${prefix} ${cityName} ${suffix}`,
      lat: 0, // Will be set per city
      lon: 0,
      stars,
      rating: Number((3.5 + Math.random() * 1.4).toFixed(1)),
      priceFrom: isVN ? price : Math.round(price / 23000), // USD for international
      distanceToCenterKm: Number((0.3 + Math.random() * 5).toFixed(1)),
      amenities,
      images: [],
    });
  }
  
  return hotels;
}

// Vietnam major cities - 30-50 hotels each
const VN_HOTELS = [
  // Hà Nội - 50 hotels
  ...generateHotels("VN_HN", "Hanoi", 50, [500000, 2500000], true).map((h, i) => ({
    ...h,
    lat: 21.0285 + (Math.random() - 0.5) * 0.05,
    lon: 105.8542 + (Math.random() - 0.5) * 0.05,
  })),
  
  // TP.HCM - 50 hotels
  ...generateHotels("VN_HCM", "Saigon", 50, [550000, 2800000], true).map((h, i) => ({
    ...h,
    lat: 10.7758 + (Math.random() - 0.5) * 0.05,
    lon: 106.7009 + (Math.random() - 0.5) * 0.05,
  })),
  
  // Đà Nẵng - 40 hotels
  ...generateHotels("VN_DN", "Da Nang", 40, [450000, 2200000], true).map((h, i) => ({
    ...h,
    lat: 16.0704 + (Math.random() - 0.5) * 0.04,
    lon: 108.2245 + (Math.random() - 0.5) * 0.04,
  })),
  
  // Nha Trang - 35 hotels
  ...generateHotels("VN_NT", "Nha Trang", 35, [400000, 2000000], true).map((h, i) => ({
    ...h,
    lat: 12.2388 + (Math.random() - 0.5) * 0.03,
    lon: 109.1967 + (Math.random() - 0.5) * 0.03,
  })),
  
  // Phú Quốc - 30 hotels
  ...generateHotels("VN_PQ", "Phu Quoc", 30, [600000, 3000000], true).map((h, i) => ({
    ...h,
    lat: 10.2899 + (Math.random() - 0.5) * 0.03,
    lon: 103.9840 + (Math.random() - 0.5) * 0.03,
  })),
  
  // Hội An - 30 hotels
  ...generateHotels("VN_HA", "Hoi An", 30, [350000, 1800000], true).map((h, i) => ({
    ...h,
    lat: 15.8801 + (Math.random() - 0.5) * 0.02,
    lon: 108.3380 + (Math.random() - 0.5) * 0.02,
  })),
  
  // Huế - 25 hotels
  ...generateHotels("VN_HUE", "Hue", 25, [300000, 1500000], true).map((h, i) => ({
    ...h,
    lat: 16.4637 + (Math.random() - 0.5) * 0.02,
    lon: 107.5909 + (Math.random() - 0.5) * 0.02,
  })),
  
  // Đà Lạt - 30 hotels
  ...generateHotels("VN_DL", "Da Lat", 30, [350000, 1600000], true).map((h, i) => ({
    ...h,
    lat: 11.9404 + (Math.random() - 0.5) * 0.02,
    lon: 108.4583 + (Math.random() - 0.5) * 0.02,
  })),
  
  // Vũng Tàu - 25 hotels
  ...generateHotels("VN_VT", "Vung Tau", 25, [400000, 1800000], true).map((h, i) => ({
    ...h,
    lat: 10.3460 + (Math.random() - 0.5) * 0.02,
    lon: 107.0843 + (Math.random() - 0.5) * 0.02,
  })),
  
  // Hạ Long - 25 hotels
  ...generateHotels("VN_HL", "Ha Long", 25, [450000, 2000000], true).map((h, i) => ({
    ...h,
    lat: 20.9517 + (Math.random() - 0.5) * 0.02,
    lon: 107.0748 + (Math.random() - 0.5) * 0.02,
  })),
];

// International cities - 10 hotels each
const INTL_HOTELS = [
  // Bangkok
  ...generateHotels("INT_BANGKOK", "Bangkok", 10, [1200000, 5000000], true).map((h, i) => ({
    ...h,
    lat: 13.7563 + (Math.random() - 0.5) * 0.03,
    lon: 100.5018 + (Math.random() - 0.5) * 0.03,
  })),
  
  // Singapore
  ...generateHotels("INT_SINGAPORE", "Singapore", 10, [2000000, 8000000], true).map((h, i) => ({
    ...h,
    lat: 1.3521 + (Math.random() - 0.5) * 0.02,
    lon: 103.8198 + (Math.random() - 0.5) * 0.02,
  })),
  
  // Tokyo
  ...generateHotels("INT_TOKYO", "Tokyo", 10, [2500000, 10000000], true).map((h, i) => ({
    ...h,
    lat: 35.6762 + (Math.random() - 0.5) * 0.03,
    lon: 139.6503 + (Math.random() - 0.5) * 0.03,
  })),
  
  // Seoul
  ...generateHotels("INT_SEOUL", "Seoul", 10, [1800000, 7000000], true).map((h, i) => ({
    ...h,
    lat: 37.5665 + (Math.random() - 0.5) * 0.03,
    lon: 126.9780 + (Math.random() - 0.5) * 0.03,
  })),
  
  // Hong Kong
  ...generateHotels("INT_HONG_KONG", "Hong Kong", 10, [2200000, 9000000], true).map((h, i) => ({
    ...h,
    lat: 22.3193 + (Math.random() - 0.5) * 0.02,
    lon: 114.1694 + (Math.random() - 0.5) * 0.02,
  })),
  
  // Kuala Lumpur
  ...generateHotels("INT_KUALA_LUMPUR", "Kuala Lumpur", 10, [1000000, 4000000], true).map((h, i) => ({
    ...h,
    lat: 3.1390 + (Math.random() - 0.5) * 0.02,
    lon: 101.6869 + (Math.random() - 0.5) * 0.02,
  })),
  
  // Bali
  ...generateHotels("INT_BALI", "Bali", 10, [1500000, 6000000], true).map((h, i) => ({
    ...h,
    lat: -8.3405 + (Math.random() - 0.5) * 0.03,
    lon: 115.0920 + (Math.random() - 0.5) * 0.03,
  })),
  
  // Phuket
  ...generateHotels("INT_PHUKET", "Phuket", 10, [1300000, 5500000], true).map((h, i) => ({
    ...h,
    lat: 7.8804 + (Math.random() - 0.5) * 0.03,
    lon: 98.3923 + (Math.random() - 0.5) * 0.03,
  })),
  
  // Paris
  ...generateHotels("INT_PARIS", "Paris", 10, [3000000, 12000000], true).map((h, i) => ({
    ...h,
    lat: 48.8566 + (Math.random() - 0.5) * 0.02,
    lon: 2.3522 + (Math.random() - 0.5) * 0.02,
  })),
  
  // London
  ...generateHotels("INT_LONDON", "London", 10, [3500000, 14000000], true).map((h, i) => ({
    ...h,
    lat: 51.5074 + (Math.random() - 0.5) * 0.02,
    lon: -0.1278 + (Math.random() - 0.5) * 0.02,
  })),
];

const ALL_HOTELS = [...VN_HOTELS, ...INTL_HOTELS];

// Additional VN locations
const VN_LOCATIONS = [
  { id: "VN_HN", name: "Hà Nội", type: "province" },
  { id: "VN_HCM", name: "TP.HCM", type: "province" },
  { id: "VN_DN", name: "Đà Nẵng", type: "province" },
  { id: "VN_NT", name: "Nha Trang", type: "province" },
  { id: "VN_PQ", name: "Phú Quốc", type: "province" },
  { id: "VN_HA", name: "Hội An", type: "province" },
  { id: "VN_HUE", name: "Huế", type: "province" },
  { id: "VN_DL", name: "Đà Lạt", type: "province" },
  { id: "VN_VT", name: "Vũng Tàu", type: "province" },
  { id: "VN_HL", name: "Hạ Long", type: "province" },
];

/**
 * Generate rooms for a hotel based on stars and base price
 * @param {string} hotelId - Hotel document ID
 * @param {number} stars - Hotel star rating (3-5)
 * @param {number} basePrice - Hotel's priceFrom
 * @param {boolean} isVN - Is Vietnamese hotel (VND vs USD)
 * @returns {Array} Array of room objects
 */
function generateRooms(hotelId, stars, basePrice, isVN = true) {
  const rooms = [];
  
  // Room types based on hotel stars
  const roomTypes = [
    {
      name: "Standard",
      priceMultiplier: 1.0,
      perks: ["Wifi miễn phí", "Điều hòa", "TV màn hình phẳng"],
      minStars: 3,
    },
    {
      name: "Superior",
      priceMultiplier: 1.3,
      perks: ["Wifi miễn phí", "Điều hòa", "TV màn hình phẳng", "Minibar", "Két an toàn"],
      minStars: 3,
    },
    {
      name: "Deluxe",
      priceMultiplier: 1.6,
      perks: ["Wifi miễn phí", "Điều hòa", "TV màn hình phẳng", "Minibar", "Két an toàn", "View thành phố", "Bồn tắm"],
      minStars: 4,
    },
    {
      name: "Suite",
      priceMultiplier: 2.2,
      perks: ["Wifi miễn phí", "Điều hòa", "TV màn hình phẳng", "Minibar", "Két an toàn", "View thành phố", "Bồn tắm", "Phòng khách riêng", "Bữa sáng miễn phí"],
      minStars: 4,
    },
    {
      name: "Presidential Suite",
      priceMultiplier: 3.5,
      perks: ["Wifi miễn phí", "Điều hòa", "TV màn hình phẳng", "Minibar", "Két an toàn", "View panorama", "Jacuzzi", "Phòng khách riêng", "Bữa sáng miễn phí", "Butler service", "Xe đưa đón sân bay"],
      minStars: 5,
    },
  ];

  // Filter room types based on hotel stars
  const availableTypes = roomTypes.filter((rt) => rt.minStars <= stars);
  
  // Generate rooms
  availableTypes.forEach((roomType, idx) => {
    const pricePerNight = isVN
      ? Math.round((basePrice * roomType.priceMultiplier) / 10000) * 10000
      : Math.round(basePrice * roomType.priceMultiplier);
    
    // Higher tier rooms are less likely to be refundable
    const refundable = idx < 2 ? Math.random() > 0.3 : Math.random() > 0.6;
    
    rooms.push({
      hotelId,
      name: roomType.name,
      pricePerNight,
      perks: roomType.perks,
      refundable,
    });
  });

  return rooms;
}

/**
 * Generate all rooms for all hotels
 * @returns {Array} Array of room objects with hotelId references
 */
function generateAllRooms() {
  const allRooms = [];
  
  ALL_HOTELS.forEach((hotel, idx) => {
    const hotelId = `demo-${idx + 1}`;
    const isVN = hotel.cityKey.startsWith("VN_");
    const rooms = generateRooms(hotelId, hotel.stars, hotel.priceFrom, isVN);
    allRooms.push(...rooms);
  });
  
  return allRooms;
}

const ALL_ROOMS = generateAllRooms();

module.exports = {
  ALL_HOTELS,
  ALL_ROOMS,
  VN_LOCATIONS,
  VN_HOTELS,
  INTL_HOTELS,
  generateRooms,
};
