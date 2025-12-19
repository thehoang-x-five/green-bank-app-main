import { fbDb } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

export interface Cinema {
  id: string;
  name: string;
  address: string;
  cityKey: string;
  lat: number;
  lon: number;
  rooms: number;
  rating: number;
}

export interface Movie {
  id: string;
  title: string;
  genre: string;
  duration: number;
  rating: string;
  description: string;
  posterUrl: string;
  trailerUrl?: string;
  images?: string[];
}

export interface Showtime {
  id: string;
  cinemaId: string;
  movieId: string;
  date: string;
  time: string;
  room: number;
  totalSeats: number;
  occupiedSeats: string[];
  pricePerSeat: number;
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  status: "available" | "occupied" | "selected";
}

/**
 * Search cinemas by city key
 */
export async function searchCinemas(cityKey: string): Promise<Cinema[]> {
  try {
    console.log("🔍 [cinemaService] Searching cinemas with cityKey:", cityKey);
    console.log(
      "🔍 [cinemaService] Firestore instance:",
      fbDb.app.options.projectId
    );

    const cinemasRef = collection(fbDb, "cinemas");
    const q = query(cinemasRef, where("cityKey", "==", cityKey));

    console.log("🔍 [cinemaService] Executing query...");
    const snapshot = await getDocs(q);

    console.log(
      "🔍 [cinemaService] Query completed. Found docs:",
      snapshot.docs.length
    );

    const cinemas = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Cinema)
    );

    console.log("🔍 [cinemaService] Returning cinemas:", cinemas);
    return cinemas;
  } catch (error) {
    console.error("❌ [cinemaService] Error searching cinemas:", error);
    console.error("❌ [cinemaService] Error details:", {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw new Error("Không thể tải danh sách rạp phim");
  }
}

/**
 * Get movies available at a specific cinema
 */
export async function getMoviesByCinema(cinemaId: string): Promise<Movie[]> {
  try {
    // Get all showtimes for this cinema
    const showtimesRef = collection(fbDb, "showtimes");
    const q = query(showtimesRef, where("cinemaId", "==", cinemaId));
    const snapshot = await getDocs(q);

    // Get unique movie IDs
    const movieIds = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.movieId) {
        movieIds.add(data.movieId);
      }
    });

    // Fetch movie details
    const movies: Movie[] = [];
    for (const movieId of movieIds) {
      const movieDoc = await getDoc(doc(fbDb, "movies", movieId));
      if (movieDoc.exists()) {
        movies.push({
          id: movieDoc.id,
          ...movieDoc.data(),
        } as Movie);
      }
    }

    return movies;
  } catch (error) {
    console.error("Error getting movies by cinema:", error);
    throw new Error("Không thể tải danh sách phim");
  }
}

/**
 * Get showtimes for a specific movie at a cinema
 */
export async function getShowtimesByMovie(
  cinemaId: string,
  movieId: string
): Promise<Showtime[]> {
  try {
    const showtimesRef = collection(fbDb, "showtimes");
    const q = query(
      showtimesRef,
      where("cinemaId", "==", cinemaId),
      where("movieId", "==", movieId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Showtime)
    );
  } catch (error) {
    console.error("Error getting showtimes:", error);
    throw new Error("Không thể tải lịch chiếu");
  }
}

/**
 * Get seat map for a specific showtime
 */
export async function getSeatMap(showtimeId: string): Promise<Seat[]> {
  try {
    const showtimeDoc = await getDoc(doc(fbDb, "showtimes", showtimeId));

    if (!showtimeDoc.exists()) {
      throw new Error("Suất chiếu không tồn tại");
    }

    const data = showtimeDoc.data() as Showtime;
    const occupiedSeats = new Set(data.occupiedSeats || []);

    // Generate 8x12 seat map (rows A-H, seats 1-12)
    const seats: Seat[] = [];
    const rows = ["A", "B", "C", "D", "E", "F", "G", "H"];

    for (const row of rows) {
      for (let num = 1; num <= 12; num++) {
        const seatId = `${row}${num}`;
        seats.push({
          id: seatId,
          row,
          number: num,
          status: occupiedSeats.has(seatId) ? "occupied" : "available",
        });
      }
    }

    return seats;
  } catch (error) {
    console.error("Error getting seat map:", error);
    throw new Error("Không thể tải sơ đồ ghế");
  }
}

/**
 * Search cinemas by movie name - find which cinemas are showing a specific movie
 */
export async function searchCinemasByMovie(
  movieName: string,
  cityKey?: string
): Promise<Cinema[]> {
  try {
    // First, find movies matching the name
    const moviesRef = collection(fbDb, "movies");
    const moviesSnapshot = await getDocs(moviesRef);

    const matchingMovies = moviesSnapshot.docs
      .filter((doc) => {
        const movie = doc.data() as Movie;
        return movie.title.toLowerCase().includes(movieName.toLowerCase());
      })
      .map((doc) => doc.id);

    if (matchingMovies.length === 0) {
      return [];
    }

    // Find showtimes for these movies (query per movie to avoid loading entire collection)
    const showtimesRef = collection(fbDb, "showtimes");
    const cinemaIds = new Set<string>();

    await Promise.all(
      matchingMovies.map(async (movieId) => {
        const q = query(showtimesRef, where("movieId", "==", movieId));
        const snap = await getDocs(q);
        snap.docs.forEach((docSnap) => {
          const showtime = docSnap.data();
          if (showtime?.cinemaId) {
            cinemaIds.add(showtime.cinemaId);
          }
        });
      })
    );

    // Get cinema details
    const cinemas: Cinema[] = [];
    for (const cinemaId of cinemaIds) {
      const cinemaDoc = await getDoc(doc(fbDb, "cinemas", cinemaId));
      if (cinemaDoc.exists()) {
        const cinema = { id: cinemaDoc.id, ...cinemaDoc.data() } as Cinema;
        // Filter by cityKey if provided
        if (!cityKey || cinema.cityKey === cityKey) {
          cinemas.push(cinema);
        }
      }
    }

    return cinemas;
  } catch (error) {
    console.error("Error searching cinemas by movie:", error);
    throw new Error("Không thể tìm rạp theo phim");
  }
}

/**
 * Get all movies (for search/filter)
 */
export async function getAllMovies(): Promise<Movie[]> {
  try {
    const moviesRef = collection(fbDb, "movies");
    const snapshot = await getDocs(moviesRef);

    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Movie)
    );
  } catch (error) {
    console.error("Error getting all movies:", error);
    throw new Error("Không thể tải danh sách phim");
  }
}
