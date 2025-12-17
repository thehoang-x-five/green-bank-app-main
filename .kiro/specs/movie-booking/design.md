# Design Document - Movie Ticket Booking

## Overview

The movie ticket booking feature enables users to browse cinemas by location, select movies and showtimes, choose seats from a visual seat map, and complete payment using their bank accounts. The system follows a multi-step wizard pattern similar to the hotel booking feature, with data stored in Firestore and seeded automatically on emulator startup.

## Architecture

### High-Level Flow

```
User → MovieBooking Component → Services → Firestore/RTDB
                                         ↓
                                    Firebase Functions (seed data)
```

### Component Structure

```
src/pages/MovieBooking.tsx          - Main booking page with 3-step wizard
src/services/cinemaService.ts       - Cinema and movie queries
src/services/movieBookingService.ts - Booking creation and payment
functions/cinemaSeedData.js         - Cinema, movie, showtime seed data
functions/index.js                  - Seed function endpoint
```

### Data Flow

1. **Step 1**: User selects location → Load cinemas → Select cinema → Load movies
2. **Step 2**: User selects movie → Load showtimes → Select showtime → Load seat map → Select seats
3. **Step 3**: User reviews booking → Selects account → Confirms payment → Creates booking + transaction

## Components and Interfaces

### Frontend Components

#### MovieBooking Component

**State Management:**
```typescript
- step: 1 | 2 | 3
- selectedProvince: string
- selectedCinema: Cinema | null
- cinemas: Cinema[]
- movies: Movie[]
- selectedMovie: Movie | null
- showtimes: Showtime[]
- selectedShowtime: Showtime | null
- seatMap: Seat[][]
- selectedSeats: Seat[]
- accounts: UserAccount[]
- selectedAccount: string
- totalPrice: number
```

**Key Functions:**
- `handleLocationChange()` - Load cinemas for selected location
- `handleCinemaSelect()` - Load movies for selected cinema
- `handleMovieSelect()` - Load showtimes for selected movie
- `handleShowtimeSelect()` - Load seat map for selected showtime
- `handleSeatToggle()` - Toggle seat selection and update price
- `handlePayment()` - Validate and process payment

#### SeatMap Component

**Props:**
```typescript
interface SeatMapProps {
  seats: Seat[][];
  selectedSeats: Seat[];
  onSeatToggle: (seat: Seat) => void;
}
```

**Rendering:**
- Grid layout showing rows and columns
- Color-coded seats: available (gray), selected (blue), occupied (red)
- Row labels (A, B, C...) and seat numbers (1, 2, 3...)

### Backend Services

#### cinemaService.ts

```typescript
export interface Cinema {
  id: string;
  name: string;
  cityKey: string;
  address: string;
  lat: number;
  lon: number;
  rooms: number;
}

export interface Movie {
  id: string;
  title: string;
  genre: string;
  duration: number; // minutes
  rating: string; // G, PG, PG-13, R
  posterUrl: string;
  description: string;
}

export interface Showtime {
  id: string;
  cinemaId: string;
  movieId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  room: number;
  availableSeats: number;
  totalSeats: number;
}

export interface Seat {
  row: string; // A, B, C...
  number: number; // 1, 2, 3...
  status: 'available' | 'occupied' | 'selected';
  price: number;
}

async function searchCinemas(cityKey: string): Promise<Cinema[]>
async function getMoviesByCinema(cinemaId: string): Promise<Movie[]>
async function getShowtimesByMovie(cinemaId: string, movieId: string): Promise<Showtime[]>
async function getSeatMap(showtimeId: string): Promise<Seat[][]>
```

#### movieBookingService.ts

```typescript
export interface BookingParams {
  cinema: Cinema;
  movie: Movie;
  showtime: Showtime;
  seats: Seat[];
  accountNumber: string;
}

async function createMovieBooking(params: BookingParams): Promise<{
  bookingId: string;
  transactionId: string;
  newBalance: number;
}>
```

**Validation Steps:**
1. Verify user authentication
2. Check user profile status (not LOCKED)
3. Verify eKYC status (VERIFIED)
4. Check transaction permissions
5. Validate account balance
6. Require biometric for amounts >= 10M VND
7. Create booking and transaction records
8. Deduct amount from account

## Data Models

### Firestore Collections

#### cinemas
```typescript
{
  id: string;
  name: string;
  cityKey: string; // VN_HCM, VN_HN, etc.
  address: string;
  lat: number;
  lon: number;
  rooms: number;
  createdAt: Timestamp;
}
```

#### movies
```typescript
{
  id: string;
  title: string;
  genre: string;
  duration: number;
  rating: string;
  posterUrl: string; // picsum.photos URL
  description: string;
  releaseDate: string;
  createdAt: Timestamp;
}
```

#### showtimes
```typescript
{
  id: string;
  cinemaId: string;
  movieId: string;
  date: string;
  time: string;
  room: number;
  totalSeats: number;
  occupiedSeats: string[]; // ["A1", "A2", "B5"]
  pricePerSeat: number;
  createdAt: Timestamp;
}
```

#### movie_bookings
```typescript
{
  id: string;
  status: 'PAID' | 'CANCELLED';
  customerUid: string;
  cinemaId: string;
  cinemaName: string;
  movieId: string;
  movieTitle: string;
  showtimeId: string;
  date: string;
  time: string;
  seats: string[]; // ["A1", "A2"]
  totalAmount: number;
  transactionId: string;
  createdAt: Timestamp;
}
```

#### transactions
```typescript
{
  id: string;
  type: 'MOVIE_BOOKING';
  status: 'SUCCESS' | 'FAILED';
  customerUid: string;
  accountNumber: string;
  cinemaName: string;
  movieTitle: string;
  amount: number;
  fee: number;
  createdAt: Timestamp;
}
```

### Seed Data Structure

**Cinemas:** 5-10 cinemas per major city (HCM, HN, DN)
**Movies:** 10-15 current movies with posters
**Showtimes:** 3-5 showtimes per movie per cinema per day
**Seats:** Standard layout 8 rows (A-H) x 12 seats per row

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Cinema location filtering
*For any* location key, querying cinemas should return only cinemas where cityKey matches the location key
**Validates: Requirements 1.2**

### Property 2: Location change clears selection
*For any* booking state with a selected cinema, changing the location should clear the cinema selection
**Validates: Requirements 1.4**

### Property 3: Movies filtered by cinema
*For any* cinema ID, querying movies should return only movies that have at least one showtime at that cinema
**Validates: Requirements 2.1**

### Property 4: Movie data completeness
*For any* movie object, it should contain non-empty title, genre, duration, rating, and posterUrl fields
**Validates: Requirements 2.2**

### Property 5: Showtimes filtered by cinema and movie
*For any* cinema ID and movie ID, querying showtimes should return only showtimes matching both IDs
**Validates: Requirements 2.3**

### Property 6: Showtime grouping preserves data
*For any* list of showtimes, grouping by date should preserve all showtimes without loss or duplication
**Validates: Requirements 3.1**

### Property 7: Showtime data completeness
*For any* showtime object, it should contain time, room number, and seat availability information
**Validates: Requirements 3.2**

### Property 8: Sold out detection
*For any* showtime, if the number of occupied seats equals total seats, it should be marked as sold out
**Validates: Requirements 3.4**

### Property 9: Seat status validity
*For any* seat in a seat map, its status should be one of: 'available', 'selected', or 'occupied'
**Validates: Requirements 4.2**

### Property 10: Seat selection increases price
*For any* available seat with price P, selecting it should increase the total price by exactly P
**Validates: Requirements 4.3**

### Property 11: Seat deselection decreases price
*For any* selected seat with price P, deselecting it should decrease the total price by exactly P
**Validates: Requirements 4.4**

### Property 12: Occupied seats cannot be selected
*For any* seat with status 'occupied', attempting to select it should not change its status
**Validates: Requirements 4.5**

### Property 13: Maximum seat limit enforcement
*For any* seat selection state at maximum capacity, attempting to select additional seats should be rejected
**Validates: Requirements 4.6**

### Property 14: Payment summary completeness
*For any* booking proceeding to payment, the summary should contain cinema name, movie title, showtime, seats, and total price
**Validates: Requirements 5.1**

### Property 15: Account ownership verification
*For any* user, fetching accounts should return only accounts where the account's uid matches the user's uid
**Validates: Requirements 5.2**

### Property 16: Empty seat selection blocks payment
*For any* booking state with zero selected seats, proceeding to payment should be prevented
**Validates: Requirements 5.3**

### Property 17: Insufficient balance rejection
*For any* account with balance B and booking amount A where B < A, payment should fail with an insufficient balance error
**Validates: Requirements 6.1**

### Property 18: High-value biometric requirement
*For any* payment amount >= 10,000,000 VND, biometric authentication should be required
**Validates: Requirements 6.3**

### Property 19: Payment atomicity
*For any* successful payment, the account balance should decrease by the exact booking amount and a booking record should be created
**Validates: Requirements 6.4**

### Property 20: Receipt data completeness
*For any* successful booking, the receipt should contain transaction ID, cinema name, movie title, showtime, seats, amount, and timestamp
**Validates: Requirements 7.2**

### Property 21: Authentication requirement
*For any* payment attempt by an unauthenticated user, the payment should be rejected
**Validates: Requirements 9.1**

### Property 22: Locked account rejection
*For any* user with account status 'LOCKED', payment should be rejected
**Validates: Requirements 9.3**

### Property 23: eKYC verification requirement
*For any* user with eKYC status not equal to 'VERIFIED', payment should be rejected
**Validates: Requirements 9.4**

### Property 24: Transaction permission requirement
*For any* user with canTransact = false, payment should be rejected
**Validates: Requirements 9.5**

## Error Handling

### Validation Errors
- Empty location selection
- No cinema selected
- No movie selected
- No showtime selected
- No seats selected
- Invalid seat selection (occupied seats)
- Exceeding maximum seat limit

### Payment Errors
- User not authenticated
- Account locked
- eKYC not verified
- No transaction permission
- Insufficient balance
- Biometric authentication failed
- Network/database errors

### Error Messages
All error messages should be in Vietnamese and provide clear guidance on how to resolve the issue.

## Testing Strategy

### Unit Tests
- Cinema filtering by location
- Movie filtering by cinema
- Showtime filtering by cinema and movie
- Seat selection/deselection logic
- Price calculation
- Seat status validation
- Data completeness checks

### Property-Based Tests
Using **fast-check** library (already in project):
- Generate random cinemas, movies, showtimes, seats
- Test properties hold across all valid inputs
- Minimum 100 iterations per property
- Each property test tagged with: `**Feature: movie-booking, Property X: [description]**`
- Each property test references requirements: `**Validates: Requirements X.Y**`

### Integration Tests
- Full booking flow from location selection to payment
- Account balance updates
- Booking record creation
- Transaction record creation

### Edge Cases
- Empty cinema list
- Empty movie list
- Fully booked showtimes
- Maximum seat selection
- Boundary amounts (9,999,999 vs 10,000,000 VND)

## UI/UX Considerations

### Step Indicators
Clear visual progress through 3 steps with ability to navigate back

### Responsive Design
- Mobile-first approach
- Touch-friendly seat selection
- Optimized for small screens
- Grid layouts adapt to screen size

### Loading States
- Skeleton loaders for cinema/movie lists
- Loading spinners for data fetching
- Disabled states during processing

### Visual Feedback
- Selected seats highlighted in blue
- Occupied seats shown in red/gray
- Available seats in light gray
- Hover effects on interactive elements
- Toast notifications for errors and success

### Accessibility
- Semantic HTML
- ARIA labels for screen readers
- Keyboard navigation support
- Color contrast compliance

## Performance Considerations

### Data Fetching
- Lazy load movies only after cinema selection
- Lazy load showtimes only after movie selection
- Cache cinema and movie data in component state
- Minimize Firestore reads with efficient queries

### Seat Map Rendering
- Virtualize large seat maps if needed
- Optimize re-renders with React.memo
- Batch seat selection updates

### Image Loading
- Use picsum.photos for movie posters (free, no API key)
- Lazy load poster images
- Provide fallback images for loading errors

## Security Considerations

### Authentication
- Verify user authentication before any payment operation
- Check eKYC status before allowing transactions
- Validate account ownership

### Authorization
- Ensure users can only access their own accounts
- Validate account status and permissions
- Prevent unauthorized booking modifications

### Data Validation
- Validate all user inputs on frontend and backend
- Sanitize seat selections to prevent injection
- Verify seat availability before booking
- Check for race conditions in seat booking

### Payment Security
- Require biometric for high-value transactions
- Use Firebase RTDB transactions for atomic balance updates
- Log all payment attempts for audit trail
- Prevent double-booking with transaction locks

## Deployment Considerations

### Firestore Indexes
Required composite indexes:
```
cinemas: cityKey ASC
showtimes: cinemaId ASC, movieId ASC, date ASC
movie_bookings: customerUid ASC, createdAt DESC
```

### Seed Data
- Auto-seed on emulator startup via `seedMoviesDemo` function
- Check for existing data before seeding
- Seed 5-10 cinemas per major city
- Seed 10-15 movies with varied genres
- Seed 3-5 showtimes per movie per cinema
- Generate realistic seat maps (8x12 layout)

### Environment Variables
```
VITE_USE_FUNCTIONS_EMULATOR=true (for local dev)
```

### Firebase Functions
- Deploy `seedMoviesDemo` function for manual seeding
- Configure CORS for local development
- Set appropriate timeout limits for seed operations
