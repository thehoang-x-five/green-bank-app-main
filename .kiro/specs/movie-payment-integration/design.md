# Design Document: Movie Booking Payment Integration

## Overview

This design document specifies how to refactor the movie booking payment system to use Firebase Realtime Database (RTDB) instead of Firestore, following the same patterns established in the flight booking payment system. The goal is to ensure consistency across all payment flows in the application (utility bills, flight bookings, and movie bookings).

The current implementation uses Firestore for storing movie bookings and transactions. This design will migrate to RTDB while maintaining the same validation logic, error handling, and user experience.

## Architecture

### Current Architecture (Firestore-based)

```
User → movieBookingService.createMovieBooking()
  ├─ Validate user & permissions
  ├─ Deduct balance from RTDB accounts/{accountId}
  ├─ Create booking in Firestore: movie_bookings/{docId}
  ├─ Create transaction in Firestore: transactions/{docId}
  └─ Send notification to RTDB: notifications/{userId}/{pushKey}
```

### Target Architecture (RTDB-based)

```
User → movieBookingService.createMovieBooking()
  ├─ Validate user & permissions
  ├─ Deduct balance from RTDB accounts/{accountId}
  ├─ Create transaction in RTDB: movieTransactions/{pushKey}
  ├─ Create booking in RTDB: movieBookings/{pushKey}
  └─ Send notification to RTDB: notifications/{userId}/{pushKey}
```

### Key Changes

1. **Remove Firestore dependency** for movie bookings and transactions
2. **Use RTDB push keys** instead of Firestore auto-generated IDs
3. **Store all data in RTDB** for consistency with flight bookings and utility bills
4. **Maintain same validation logic** and error messages

## Components and Interfaces

### Modified Service: `movieBookingService.ts`

#### Function: `createMovieBooking()`

**Input Parameters:**

```typescript
interface CreateMovieBookingParams {
  cinemaId: string;
  cinemaName: string;
  movieId: string;
  movieTitle: string;
  showtimeId: string;
  date: string;
  time: string;
  room: number;
  selectedSeats: string[];
  totalAmount: number;
  accountId: string;
}
```

**Return Type:**

```typescript
Promise<{
  bookingId: string;
  transactionId: string;
}>;
```

**Implementation Flow:**

1. Validate authentication
2. Validate seat selection
3. Validate account selection
4. Get user profile and check permissions
5. Validate and deduct account balance (atomic transaction)
6. Create transaction record in RTDB
7. Create booking record in RTDB
8. Send balance change notification
9. Return booking and transaction IDs

## Data Models

### Transaction Record (RTDB: `movieTransactions/{pushKey}`)

```typescript
{
  transactionId: string;        // Same as push key
  userId: string;               // User UID
  accountId: string;            // Payment account ID
  type: "MOVIE_BOOKING";        // Transaction type
  amount: number;               // Total amount paid
  description: string;          // "Đặt vé xem phim: {movieTitle}"
  status: "SUCCESS";            // Transaction status
  cinemaName: string;           // Cinema name
  movieTitle: string;           // Movie title
  date: string;                 // Showtime date
  time: string;                 // Showtime time
  selectedSeats: string[];      // Array of seat IDs
  createdAt: number;            // Client timestamp
  createdAtServer: ServerValue; // Server timestamp
}
```

### Booking Record (RTDB: `movieBookings/{pushKey}`)

```typescript
{
  bookingId: string;            // Same as push key
  userId: string;               // User UID
  cinemaId: string;             // Cinema ID
  cinemaName: string;           // Cinema name
  movieId: string;              // Movie ID
  movieTitle: string;           // Movie title
  showtimeId: string;           // Showtime ID
  date: string;                 // Showtime date
  time: string;                 // Showtime time
  room: number;                 // Room/hall number
  selectedSeats: string[];      // Array of seat IDs
  totalAmount: number;          // Total payment amount
  accountId: string;            // Payment account ID
  status: "CONFIRMED";          // Booking status
  transactionId: string;        // Reference to transaction
  createdAt: number;            // Client timestamp
  createdAtServer: ServerValue; // Server timestamp
}
```

### Balance Change Notification (RTDB: `notifications/{userId}/{pushKey}`)

```typescript
{
  type: "BALANCE_CHANGE";
  direction: "OUT";
  title: "Đặt vé xem phim";
  message: string; // "{movieTitle} • {cinemaName}"
  amount: number; // Total amount
  accountNumber: string; // Account ID
  balanceAfter: number; // Balance after deduction
  transactionId: string; // Reference to transaction
  createdAt: number; // Client timestamp
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Authentication Required

_For any_ movie booking attempt, the user must be authenticated, otherwise the operation should fail with error "Vui lòng đăng nhập để tiếp tục"

**Validates: Requirements 1.1, 1.2**

### Property 2: Seat Selection Required

_For any_ movie booking attempt, at least one seat must be selected, otherwise the operation should fail with error "Vui lòng chọn ít nhất một ghế"

**Validates: Requirements 2.1, 2.2**

### Property 3: Account Selection Required

_For any_ movie booking attempt, an accountId must be provided, otherwise the operation should fail with error "Vui lòng chọn tài khoản thanh toán"

**Validates: Requirements 2.4, 2.5**

### Property 4: User Profile Validation

_For any_ authenticated user attempting a movie booking, if their profile status is "LOCKED", ekycStatus is not "VERIFIED", or canTransact is false, the operation should fail with the appropriate error message

**Validates: Requirements 1.5, 1.6, 1.7**

### Property 5: Account Ownership Verification

_For any_ movie booking with a non-DEMO account, the account's uid must match the authenticated user's uid, otherwise the operation should fail with error "Bạn không có quyền sử dụng tài khoản này"

**Validates: Requirements 3.3, 3.4**

### Property 6: Sufficient Balance Required

_For any_ movie booking, if the account balance is less than the totalAmount, the operation should fail with error message showing required and available amounts

**Validates: Requirements 3.7**

### Property 7: Atomic Balance Deduction

_For any_ successful movie booking, the account balance should be decreased by exactly the totalAmount in an atomic transaction

**Validates: Requirements 3.5, 3.8**

### Property 8: Transaction Record Creation

_For any_ successful movie booking, a transaction record must be created in RTDB at path `movieTransactions/{pushKey}` with all required fields including transactionId, userId, accountId, type="MOVIE_BOOKING", amount, status="SUCCESS", and timestamps

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.11, 4.12**

### Property 9: Booking Record Creation

_For any_ successful movie booking, a booking record must be created in RTDB at path `movieBookings/{pushKey}` with all required fields including bookingId, userId, cinema/movie details, showtime details, selectedSeats, totalAmount, accountId, status="CONFIRMED", transactionId, and timestamps

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13**

### Property 10: Balance Change Notification

_For any_ successful movie booking, a balance change notification must be created in RTDB at path `notifications/{userId}/{pushKey}` with type="BALANCE_CHANGE", direction="OUT", title="Đặt vé xem phim", and all required fields

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11**

### Property 11: Transaction and Booking ID Consistency

_For any_ successful movie booking, the transactionId field in the booking record must reference the actual transaction record's transactionId

**Validates: Requirements 5.11**

### Property 12: RTDB-Only Storage

_For any_ movie booking operation, all data (transactions, bookings) must be stored in Realtime Database, not Firestore

**Validates: Requirements 8.1**

## Error Handling

### Validation Errors

All validation errors follow the same pattern as flight booking:

- Clear Vietnamese error messages
- Specific guidance for resolution
- No technical jargon exposed to users

### Error Categories

1. **Authentication Errors**

   - Not logged in: "Vui lòng đăng nhập để tiếp tục"
   - Profile not found: "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."

2. **Permission Errors**

   - Account locked: "Tài khoản đăng nhập đang bị khóa, không thể giao dịch"
   - eKYC not verified: "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
   - Cannot transact: "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."

3. **Validation Errors**

   - No seats selected: "Vui lòng chọn ít nhất một ghế"
   - No account selected: "Vui lòng chọn tài khoản thanh toán"

4. **Account Errors**

   - Account not found: "Không tìm thấy tài khoản thanh toán"
   - Wrong ownership: "Bạn không có quyền sử dụng tài khoản này"
   - Account locked: "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
   - Insufficient balance: "Số dư không đủ. Cần {amount} ₫, hiện có {balance} ₫"

5. **Transaction Errors**
   - Transaction failed: "Giao dịch thất bại"

### Notification Failure Handling

If notification creation fails, the error is logged but does not fail the entire booking operation. This ensures that payment and booking records are still created successfully.

## Testing Strategy

### Unit Tests

- Test authentication validation
- Test seat selection validation
- Test account selection validation
- Test user profile validation (locked, eKYC, canTransact)
- Test account ownership verification
- Test balance validation
- Test error message formatting

### Property-Based Tests

Each correctness property will be implemented as a property-based test using a suitable testing framework (e.g., fast-check for TypeScript). Each test will run a minimum of 100 iterations to ensure comprehensive coverage.

**Test Configuration:**

- Minimum 100 iterations per property test
- Each test tagged with: **Feature: movie-payment-integration, Property {number}: {property_text}**

**Property Test Examples:**

1. **Property 1 Test**: Generate random booking attempts with/without authentication, verify error handling
2. **Property 2 Test**: Generate random seat selections (empty and non-empty), verify validation
3. **Property 7 Test**: Generate random valid bookings, verify balance is decreased by exact amount
4. **Property 8 Test**: Generate random valid bookings, verify transaction record structure and fields
5. **Property 9 Test**: Generate random valid bookings, verify booking record structure and fields

### Integration Tests

- Test complete booking flow from validation to notification
- Test atomic transaction behavior (balance deduction)
- Test RTDB record creation
- Test notification creation
- Test error recovery scenarios

### Migration Testing

- Verify old Firestore-based bookings still work (read-only)
- Verify new RTDB-based bookings work correctly
- Verify no data loss during migration
- Verify backward compatibility

## Implementation Notes

### Import Changes

```typescript
// Remove Firestore imports
// import { fbDb } from "@/lib/firebase";
// import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Keep RTDB imports
import { fbAuth, fbRtdb } from "@/lib/firebase";
import {
  ref,
  get,
  runTransaction as rtdbRunTransaction,
  push,
  set,
  serverTimestamp as rtdbServerTimestamp,
} from "firebase/database";
```

### Key Implementation Details

1. **Use `push()` for ID generation**: Instead of Firestore's auto-generated IDs, use RTDB's `push()` to generate unique keys
2. **Use `rtdbServerTimestamp()`**: For server-side timestamps in RTDB
3. **Atomic transactions**: Use `rtdbRunTransaction()` for balance deduction
4. **Path structure**: Follow the same pattern as flight bookings (`movieTransactions/`, `movieBookings/`)
5. **Status values**: Use uppercase ("SUCCESS", "CONFIRMED") to match flight booking pattern

### Code Reuse

The implementation should closely follow the `flightBookingService.ts` pattern:

- Same validation sequence
- Same error messages format
- Same transaction handling
- Same notification structure

This ensures consistency and makes the codebase easier to maintain.
