/**
 * Cinema, Movie, Showtime, and Seat seed data for movie booking
 * - Generates cinemas for major Vietnamese cities
 * - Generates movies with posters
 * - Generates showtimes for each movie at each cinema
 * - Generates seat maps for each showtime
 */

// ✅ Seeded random number generator for consistent data across machines
function seededRandom(seed) {
  let state = seed;
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Global seeded random instance (seed: 12345)
const random = seededRandom(12345);

// Helper to generate cinema data
function generateCinemas() {
  const cinemas = [];
  
  // HCM - 8 cinemas
  const hcmCinemas = [
    { name: "CGV Vincom Center", address: "72 Lê Thánh Tôn, Q.1, TP.HCM", lat: 10.7769, lon: 106.7009, rooms: 8, rating: 4.5 },
    { name: "Lotte Cinema Diamond Plaza", address: "34 Lê Duẩn, Q.1, TP.HCM", lat: 10.7883, lon: 106.7025, rooms: 10, rating: 4.7 },
    { name: "Galaxy Nguyễn Du", address: "116 Nguyễn Du, Q.1, TP.HCM", lat: 10.7745, lon: 106.6935, rooms: 6, rating: 4.3 },
    { name: "BHD Star Bitexco", address: "2 Hải Triều, Q.1, TP.HCM", lat: 10.7718, lon: 106.7044, rooms: 7, rating: 4.6 },
    { name: "CGV Crescent Mall", address: "101 Tôn Dật Tiên, Q.7, TP.HCM", lat: 10.7291, lon: 106.7198, rooms: 9, rating: 4.4 },
    { name: "Lotte Cinema Gò Vấp", address: "242 Nguyễn Văn Lượng, Gò Vấp, TP.HCM", lat: 10.8376, lon: 106.6765, rooms: 8, rating: 4.2 },
    { name: "Galaxy Kinh Dương Vương", address: "718bis Kinh Dương Vương, Q.6, TP.HCM", lat: 10.7485, lon: 106.6352, rooms: 7, rating: 4.1 },
    { name: "CGV Aeon Tân Phú", address: "30 Bờ Bao Tân Thắng, Tân Phú, TP.HCM", lat: 10.8006, lon: 106.6254, rooms: 10, rating: 4.5 },
  ];
  
  hcmCinemas.forEach(c => {
    cinemas.push({ ...c, cityKey: "VN_HCM" });
  });
  
  // Hà Nội - 7 cinemas
  const hnCinemas = [
    { name: "CGV Vincom Bà Triệu", address: "191 Bà Triệu, Hai Bà Trưng, Hà Nội", lat: 21.0136, lon: 105.8481, rooms: 9, rating: 4.6 },
    { name: "Lotte Cinema Tây Hồ", address: "Lotte Center, 54 Liễu Giai, Ba Đình, Hà Nội", lat: 21.0285, lon: 105.8198, rooms: 10, rating: 4.8 },
    { name: "Galaxy Nguyễn Trãi", address: "87 Nguyễn Trãi, Thanh Xuân, Hà Nội", lat: 20.9985, lon: 105.8095, rooms: 7, rating: 4.3 },
    { name: "BHD Star Vincom Mega Mall", address: "Vincom Mega Mall, 458 Minh Khai, Hai Bà Trưng, Hà Nội", lat: 20.9985, lon: 105.8625, rooms: 8, rating: 4.5 },
    { name: "CGV Vincom Royal City", address: "72A Nguyễn Trãi, Thanh Xuân, Hà Nội", lat: 20.9985, lon: 105.8095, rooms: 11, rating: 4.7 },
    { name: "Lotte Cinema Hà Đông", address: "Aeon Mall Hà Đông, Dương Nội, Hà Đông, Hà Nội", lat: 20.9722, lon: 105.7542, rooms: 9, rating: 4.4 },
    { name: "Platinum Cineplex Times City", address: "458 Minh Khai, Hai Bà Trưng, Hà Nội", lat: 20.9985, lon: 105.8625, rooms: 6, rating: 4.2 },
  ];
  
  hnCinemas.forEach(c => {
    cinemas.push({ ...c, cityKey: "VN_HN" });
  });
  
  // Đà Nẵng - 5 cinemas
  const dnCinemas = [
    { name: "CGV Vincom Đà Nẵng", address: "910A Ngô Quyền, Sơn Trà, Đà Nẵng", lat: 16.0678, lon: 108.2208, rooms: 8, rating: 4.5 },
    { name: "Lotte Cinema Vincom", address: "Vincom Plaza, 910A Ngô Quyền, Sơn Trà, Đà Nẵng", lat: 16.0678, lon: 108.2208, rooms: 7, rating: 4.6 },
    { name: "Galaxy Đà Nẵng", address: "Lô A10-11 Đường 2/9, Hải Châu, Đà Nẵng", lat: 16.0544, lon: 108.2022, rooms: 6, rating: 4.3 },
    { name: "BHD Star Vincom", address: "Vincom Plaza, 910A Ngô Quyền, Sơn Trà, Đà Nẵng", lat: 16.0678, lon: 108.2208, rooms: 5, rating: 4.4 },
    { name: "CGV Indochina Riverside", address: "Indochina Riverside Mall, 74 Bạch Đằng, Hải Châu, Đà Nẵng", lat: 16.0678, lon: 108.2208, rooms: 7, rating: 4.5 },
  ];
  
  dnCinemas.forEach(c => {
    cinemas.push({ ...c, cityKey: "VN_DN" });
  });
  
  // Nha Trang - 4 cinemas
  const ntCinemas = [
    { name: "CGV Nha Trang Center", address: "19 Biet Thu, Nha Trang, Khánh Hòa", lat: 12.2388, lon: 109.1967, rooms: 7, rating: 4.4 },
    { name: "Lotte Cinema Nha Trang", address: "Vincom Plaza, 50 Trần Phú, Nha Trang", lat: 12.2451, lon: 109.1943, rooms: 6, rating: 4.5 },
    { name: "Galaxy Nha Trang", address: "Lô D1, Đường Trần Phú, Nha Trang", lat: 12.2388, lon: 109.1967, rooms: 5, rating: 4.2 },
    { name: "BHD Star Nha Trang", address: "Vinpearl Land, Nha Trang", lat: 12.2388, lon: 109.1967, rooms: 6, rating: 4.3 },
  ];
  
  ntCinemas.forEach(c => {
    cinemas.push({ ...c, cityKey: "VN_NT" });
  });
  
  // Cần Thơ - 4 cinemas
  const ctCinemas = [
    { name: "CGV Vincom Cần Thơ", address: "Vincom Plaza Xuân Khánh, Cần Thơ", lat: 10.0452, lon: 105.7469, rooms: 7, rating: 4.3 },
    { name: "Lotte Cinema Sense City", address: "Sense City, 1 Nguyễn Văn Linh, Cần Thơ", lat: 10.0452, lon: 105.7469, rooms: 6, rating: 4.4 },
    { name: "Galaxy Cần Thơ", address: "Vincom Plaza, Cần Thơ", lat: 10.0452, lon: 105.7469, rooms: 5, rating: 4.1 },
    { name: "Platinum Cineplex Cần Thơ", address: "Vincom Plaza, Cần Thơ", lat: 10.0452, lon: 105.7469, rooms: 6, rating: 4.2 },
  ];
  
  ctCinemas.forEach(c => {
    cinemas.push({ ...c, cityKey: "VN_CT" });
  });
  
  // Vũng Tàu - 3 cinemas
  const vtCinemas = [
    { name: "CGV Vũng Tàu", address: "Vincom Plaza, 182 Lê Hồng Phong, Vũng Tàu", lat: 10.3460, lon: 107.0843, rooms: 6, rating: 4.3 },
    { name: "Lotte Cinema Vũng Tàu", address: "Vincom Plaza, Vũng Tàu", lat: 10.3460, lon: 107.0843, rooms: 5, rating: 4.4 },
    { name: "Galaxy Vũng Tàu", address: "Lô 1, Đường Thùy Vân, Vũng Tàu", lat: 10.3460, lon: 107.0843, rooms: 5, rating: 4.2 },
  ];
  
  vtCinemas.forEach(c => {
    cinemas.push({ ...c, cityKey: "VN_VT" });
  });
  
  // International - 5 cinemas
  const intlCinemas = [
    { name: "CGV Bangkok Siam", address: "Siam Paragon, Bangkok", lat: 13.7467, lon: 100.5347, rooms: 12, rating: 4.8, cityKey: "INT_BANGKOK" },
    { name: "Golden Village Singapore", address: "VivoCity, Singapore", lat: 1.2644, lon: 103.8220, rooms: 10, rating: 4.7, cityKey: "INT_SINGAPORE" },
    { name: "Toho Cinemas Tokyo", address: "Roppongi Hills, Tokyo", lat: 35.6604, lon: 139.7292, rooms: 9, rating: 4.9, cityKey: "INT_TOKYO" },
    { name: "CGV Seoul Gangnam", address: "Gangnam-gu, Seoul", lat: 37.4979, lon: 127.0276, rooms: 11, rating: 4.6, cityKey: "INT_SEOUL" },
    { name: "UA Cinemas Hong Kong", address: "Times Square, Causeway Bay", lat: 22.2783, lon: 114.1826, rooms: 8, rating: 4.5, cityKey: "INT_HONG_KONG" },
  ];
  
  intlCinemas.forEach(c => {
    cinemas.push(c);
  });
  
  return cinemas;
}

// Helper to generate movie data
function generateMovies() {
  const movies = [
    {
      title: "Avengers: Endgame",
      genre: "Action, Sci-Fi",
      duration: 181,
      rating: "PG-13",
      description: "After the devastating events of Avengers: Infinity War, the universe is in ruins.",
      posterUrl: "https://picsum.photos/seed/avengers/300/450",
      trailerUrl: "https://www.youtube.com/embed/TcMBFSGVi1c",
      images: ["https://picsum.photos/seed/avengers1/800/450", "https://picsum.photos/seed/avengers2/800/450", "https://picsum.photos/seed/avengers3/800/450"],
    },
    {
      title: "The Shawshank Redemption",
      genre: "Drama",
      duration: 142,
      rating: "R",
      description: "Two imprisoned men bond over a number of years, finding solace and eventual redemption.",
      posterUrl: "https://picsum.photos/seed/shawshank/300/450",
      trailerUrl: "https://www.youtube.com/embed/6hB3S9bIaco",
      images: ["https://picsum.photos/seed/shawshank1/800/450", "https://picsum.photos/seed/shawshank2/800/450", "https://picsum.photos/seed/shawshank3/800/450"],
    },
    {
      title: "Inception",
      genre: "Action, Sci-Fi, Thriller",
      duration: 148,
      rating: "PG-13",
      description: "A thief who steals corporate secrets through dream-sharing technology.",
      posterUrl: "https://picsum.photos/seed/inception/300/450",
      trailerUrl: "https://www.youtube.com/embed/YoHD9XEInc0",
      images: ["https://picsum.photos/seed/inception1/800/450", "https://picsum.photos/seed/inception2/800/450", "https://picsum.photos/seed/inception3/800/450"],
    },
    {
      title: "The Dark Knight",
      genre: "Action, Crime, Drama",
      duration: 152,
      rating: "PG-13",
      description: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham.",
      posterUrl: "https://picsum.photos/seed/darkknight/300/450",
      trailerUrl: "https://www.youtube.com/embed/EXeTwQWrcwY",
      images: ["https://picsum.photos/seed/darkknight1/800/450", "https://picsum.photos/seed/darkknight2/800/450", "https://picsum.photos/seed/darkknight3/800/450"],
    },
    {
      title: "Pulp Fiction",
      genre: "Crime, Drama",
      duration: 154,
      rating: "R",
      description: "The lives of two mob hitmen, a boxer, a gangster and his wife intertwine.",
      posterUrl: "https://picsum.photos/seed/pulpfiction/300/450",
      trailerUrl: "https://www.youtube.com/embed/s7EdQ4FqbhY",
      images: ["https://picsum.photos/seed/pulpfiction1/800/450", "https://picsum.photos/seed/pulpfiction2/800/450", "https://picsum.photos/seed/pulpfiction3/800/450"],
    },
    {
      title: "Forrest Gump",
      genre: "Drama, Romance",
      duration: 142,
      rating: "PG-13",
      description: "The presidencies of Kennedy and Johnson unfold through the perspective of an Alabama man.",
      posterUrl: "https://picsum.photos/seed/forrestgump/300/450",
      trailerUrl: "https://www.youtube.com/embed/bLvqoHBptjg",
      images: ["https://picsum.photos/seed/forrestgump1/800/450", "https://picsum.photos/seed/forrestgump2/800/450", "https://picsum.photos/seed/forrestgump3/800/450"],
    },
    {
      title: "The Matrix",
      genre: "Action, Sci-Fi",
      duration: 136,
      rating: "R",
      description: "A computer hacker learns from mysterious rebels about the true nature of his reality.",
      posterUrl: "https://picsum.photos/seed/matrix/300/450",
      trailerUrl: "https://www.youtube.com/embed/vKQi3bBA1y8",
      images: ["https://picsum.photos/seed/matrix1/800/450", "https://picsum.photos/seed/matrix2/800/450", "https://picsum.photos/seed/matrix3/800/450"],
    },
    {
      title: "Interstellar",
      genre: "Adventure, Drama, Sci-Fi",
      duration: 169,
      rating: "PG-13",
      description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
      posterUrl: "https://picsum.photos/seed/interstellar/300/450",
      trailerUrl: "https://www.youtube.com/embed/zSWdZVtXT7E",
      images: ["https://picsum.photos/seed/interstellar1/800/450", "https://picsum.photos/seed/interstellar2/800/450", "https://picsum.photos/seed/interstellar3/800/450"],
    },
    {
      title: "Parasite",
      genre: "Comedy, Drama, Thriller",
      duration: 132,
      rating: "R",
      description: "Greed and class discrimination threaten the newly formed symbiotic relationship.",
      posterUrl: "https://picsum.photos/seed/parasite/300/450",
      trailerUrl: "https://www.youtube.com/embed/5xH0HfJHsaY",
      images: ["https://picsum.photos/seed/parasite1/800/450", "https://picsum.photos/seed/parasite2/800/450", "https://picsum.photos/seed/parasite3/800/450"],
    },
    {
      title: "The Lion King",
      genre: "Animation, Adventure, Drama",
      duration: 88,
      rating: "G",
      description: "Lion prince Simba and his father are targeted by his bitter uncle.",
      posterUrl: "https://picsum.photos/seed/lionking/300/450",
      trailerUrl: "https://www.youtube.com/embed/7TavVZMewpY",
      images: ["https://picsum.photos/seed/lionking1/800/450", "https://picsum.photos/seed/lionking2/800/450", "https://picsum.photos/seed/lionking3/800/450"],
    },
    {
      title: "Joker",
      genre: "Crime, Drama, Thriller",
      duration: 122,
      rating: "R",
      description: "In Gotham City, mentally troubled comedian Arthur Fleck is disregarded and mistreated.",
      posterUrl: "https://picsum.photos/seed/joker/300/450",
      trailerUrl: "https://www.youtube.com/embed/zAGVQLHvwOY",
      images: ["https://picsum.photos/seed/joker1/800/450", "https://picsum.photos/seed/joker2/800/450", "https://picsum.photos/seed/joker3/800/450"],
    },
    {
      title: "Spider-Man: No Way Home",
      genre: "Action, Adventure, Sci-Fi",
      duration: 148,
      rating: "PG-13",
      description: "With Spider-Man's identity now revealed, Peter asks Doctor Strange for help.",
      posterUrl: "https://picsum.photos/seed/spiderman/300/450",
      trailerUrl: "https://www.youtube.com/embed/JfVOs4VSpmA",
      images: ["https://picsum.photos/seed/spiderman1/800/450", "https://picsum.photos/seed/spiderman2/800/450", "https://picsum.photos/seed/spiderman3/800/450"],
    },
    {
      title: "Oppenheimer",
      genre: "Biography, Drama, History",
      duration: 180,
      rating: "R",
      description: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
      posterUrl: "https://picsum.photos/seed/oppenheimer/300/450",
      trailerUrl: "https://www.youtube.com/embed/uYPbbksJxIg",
      images: ["https://picsum.photos/seed/oppenheimer1/800/450", "https://picsum.photos/seed/oppenheimer2/800/450", "https://picsum.photos/seed/oppenheimer3/800/450"],
    },
    {
      title: "Barbie",
      genre: "Adventure, Comedy, Fantasy",
      duration: 114,
      rating: "PG-13",
      description: "Barbie and Ken are having the time of their lives in the colorful and seemingly perfect world of Barbie Land.",
      posterUrl: "https://picsum.photos/seed/barbie/300/450",
      trailerUrl: "https://www.youtube.com/embed/pBk4NYhWNMM",
      images: ["https://picsum.photos/seed/barbie1/800/450", "https://picsum.photos/seed/barbie2/800/450", "https://picsum.photos/seed/barbie3/800/450"],
    },
    {
      title: "Dune",
      genre: "Action, Adventure, Drama",
      duration: 155,
      rating: "PG-13",
      description: "A noble family becomes embroiled in a war for control over the galaxy's most valuable asset.",
      posterUrl: "https://picsum.photos/seed/dune/300/450",
      trailerUrl: "https://www.youtube.com/embed/8g18jFHCLXk",
      images: ["https://picsum.photos/seed/dune1/800/450", "https://picsum.photos/seed/dune2/800/450", "https://picsum.photos/seed/dune3/800/450"],
    },
    {
      title: "Top Gun: Maverick",
      genre: "Action, Drama",
      duration: 130,
      rating: "PG-13",
      description: "After thirty years, Maverick is still pushing the envelope as a top naval aviator.",
      posterUrl: "https://picsum.photos/seed/topgun/300/450",
      trailerUrl: "https://www.youtube.com/embed/giXco2jaZ_4",
      images: ["https://picsum.photos/seed/topgun1/800/450", "https://picsum.photos/seed/topgun2/800/450", "https://picsum.photos/seed/topgun3/800/450"],
    },
    {
      title: "Everything Everywhere All at Once",
      genre: "Action, Adventure, Comedy",
      duration: 139,
      rating: "R",
      description: "An aging Chinese immigrant is swept up in an insane adventure.",
      posterUrl: "https://picsum.photos/seed/everything/300/450",
      trailerUrl: "https://www.youtube.com/embed/wxN1T1uxQ2g",
      images: ["https://picsum.photos/seed/everything1/800/450", "https://picsum.photos/seed/everything2/800/450", "https://picsum.photos/seed/everything3/800/450"],
    },
    {
      title: "Avatar: The Way of Water",
      genre: "Action, Adventure, Fantasy",
      duration: 192,
      rating: "PG-13",
      description: "Jake Sully lives with his newfound family formed on the extrasolar moon Pandora.",
      posterUrl: "https://picsum.photos/seed/avatar2/300/450",
      trailerUrl: "https://www.youtube.com/embed/d9MyW72ELq0",
      images: ["https://picsum.photos/seed/avatar2-1/800/450", "https://picsum.photos/seed/avatar2-2/800/450", "https://picsum.photos/seed/avatar2-3/800/450"],
    },
    {
      title: "The Batman",
      genre: "Action, Crime, Drama",
      duration: 176,
      rating: "PG-13",
      description: "When a sadistic serial killer begins murdering key political figures in Gotham.",
      posterUrl: "https://picsum.photos/seed/batman2022/300/450",
      trailerUrl: "https://www.youtube.com/embed/mqqft2x_Aa4",
      images: ["https://picsum.photos/seed/batman2022-1/800/450", "https://picsum.photos/seed/batman2022-2/800/450", "https://picsum.photos/seed/batman2022-3/800/450"],
    },
  ];
  
  return movies;
}

// Helper to generate showtimes for a cinema and movie
function generateShowtimes(cinemaId, movieId, cinemaRooms, cinemaName) {
  const showtimes = [];
  const today = new Date();
  
  // Different time slots for variety
  const morningTimes = ["09:00", "10:30", "11:45"];
  const afternoonTimes = ["13:00", "14:30", "16:00", "17:15"];
  const eveningTimes = ["18:30", "19:45", "21:00", "22:15", "23:30"];
  
  // Price varies by cinema brand and time
  let basePriceRange = { min: 70000, max: 100000 }; // Default
  
  if (cinemaName.includes("CGV")) {
    basePriceRange = { min: 80000, max: 120000 };
  } else if (cinemaName.includes("Lotte")) {
    basePriceRange = { min: 85000, max: 130000 };
  } else if (cinemaName.includes("Galaxy")) {
    basePriceRange = { min: 70000, max: 100000 };
  } else if (cinemaName.includes("BHD") || cinemaName.includes("Platinum")) {
    basePriceRange = { min: 75000, max: 110000 };
  }
  
  // Generate showtimes for next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    // More showtimes on weekends
    const numShowtimes = isWeekend ? 5 + Math.floor(random() * 3) : 3 + Math.floor(random() * 3);
    
    // Select random times from different periods
    const selectedTimes = [];
    const allTimes = [...morningTimes, ...afternoonTimes, ...eveningTimes];
    
    for (let i = 0; i < numShowtimes; i++) {
      const randomTime = allTimes[Math.floor(random() * allTimes.length)];
      if (!selectedTimes.includes(randomTime)) {
        selectedTimes.push(randomTime);
      }
    }
    
    selectedTimes.sort(); // Sort times chronologically
    
    for (const time of selectedTimes) {
      const room = 1 + Math.floor(random() * Math.min(cinemaRooms, 6));
      const totalSeats = 96; // 8 rows x 12 seats
      
      // More occupied seats for evening shows and weekends
      let maxOccupied = 30;
      if (eveningTimes.includes(time)) maxOccupied = 50;
      if (isWeekend) maxOccupied += 15;
      
      const occupiedCount = Math.floor(random() * maxOccupied);
      
      // Price varies by time (evening shows more expensive)
      let priceMultiplier = 1.0;
      if (eveningTimes.includes(time)) priceMultiplier = 1.2;
      if (isWeekend) priceMultiplier *= 1.15;
      
      const basePrice = basePriceRange.min + Math.floor(random() * (basePriceRange.max - basePriceRange.min));
      const finalPrice = Math.round(basePrice * priceMultiplier / 1000) * 1000; // Round to nearest 1000
      
      showtimes.push({
        cinemaId,
        movieId,
        date: dateStr,
        time,
        room,
        totalSeats,
        occupiedSeats: generateOccupiedSeats(occupiedCount),
        pricePerSeat: finalPrice,
      });
    }
  }
  
  return showtimes;
}

// Helper to generate random occupied seats
function generateOccupiedSeats(count) {
  const occupied = new Set();
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  
  while (occupied.size < count) {
    const row = rows[Math.floor(random() * rows.length)];
    const seat = 1 + Math.floor(random() * 12);
    occupied.add(`${row}${seat}`);
  }
  
  return Array.from(occupied);
}

// Export seed data
const CINEMA_DATA = generateCinemas();
const MOVIE_DATA = generateMovies();

module.exports = {
  CINEMA_DATA,
  MOVIE_DATA,
  generateShowtimes,
};
