# Design Document: PIN/OTP Authentication for Movie and Hotel Bookings

## Overview

This design implements two-factor authentication (PIN → OTP) for movie booking and hotel booking payment flows. The implementation follows the established pattern from flight booking, utility bill payment, data pack purchase, and phone topup services, ensuring consistent security across all payment utilities in the application.

The system extends the existing PIN/OTP infrastructure by adding support for MOVIE and HOTEL payment types, creating new service functions for payment initiation and confirmation, and updating UI components to use the authentication flow.

## Architecture

### Current State

**Utilities with PIN/OTP:**

- ✅ Flight booking (`FLIGHT`)
- ✅ Utility bill payment (`UTILITY_BILL`)
- ✅ Data pack purchase (`DATA_PACK`)
- ✅ Phone topup (`PHONE_TOPUP`)

**Utilities without PIN/OTP:**

- ❌ Movie booking (direct payment)
- ❌ Hotel booking (direct payment)

### Target State

All payment utilities will use the same PIN → OTP → Payment flow:

```
User selects service
  ↓
User selects payment account
  ↓
User clicks "Pay" button
  ↓
Navigate to /utilities/pin
  ↓
User enters PIN
  ↓
System verifies PIN
  ↓
System creates PENDING transaction
  ↓
System sends OTP to email
  ↓
Navigate to /utilities/otp
  ↓
User enters OTP
  ↓
System verifies OTP
  ↓
System updates transaction to SUCCESS
  ↓
System deducts balance
  ↓
System creates booking record
  ↓
Navigate to /utilities/result
```

### Service Layer Architecture

Two new service files will be created:

1. **`src/services/moviePaymentService.ts`**

   - `initiateMoviePayment()` - Create PENDING transaction + send OTP
   - `confirmMoviePaymentWithOtp()` - Verify OTP + process payment
   - `resendMoviePaymentOtp()` - Resend OTP

2. **`src/services/hotelPaymentService.ts`**
   - `initiateHotelPayment()` - Create PENDING transaction + send OTP
   - `confirmHotelPaymentWithOtp()` - Verify OTP + process payment
   - `resendHotelPaymentOtp()` - Resend OTP

### Integration Points

**Modified Components:**

- `UtilityPinConfirm.tsx` - Add MOVIE and HOTEL cases
- `UtilityOtpConfirm.tsx` - Add MOVIE and HOTEL cases
- `UtilityMovie.tsx` - Navigate to PIN screen instead of direct payment
- `UtilityHotel.tsx` - Navigate to PIN screen instead of direct payment

**Existing Services Used:**

- `userService.ts` - PIN verification, user profile validation
- `otpService.ts` - OTP generation and email sending
- `firebase.ts` - Database operations

**Database Structure (RTDB):**

```
/movieTransactions/{transactionId}
  - status: "PENDING" | "SUCCESS" | "FAILED"
  - otp: string (hashed)
  - otpExpireAt: number

/hotelTransactions/{transactionId}
  - status: "PENDING" | "SUCCESS" | "FAILED"
  - otp: string (hashed)
  - otpExpireAt: number

/movieBookings/{bookingId}
/hotelBookings/{bookingId}
/accounts/{accountId}
/notifications/{userId}/{notificationId}
```

## Components and Interfaces

### Service Functions

#### 1. initiateMoviePayment

```typescript
async function initiateMoviePayment(params: {
  movieId: string;
  movieName: string;
  showtime: string;
  seats: string[];
  totalAmount: number;
  accountId: string;
}): Promise<{
  transactionId: string;
  maskedEmail: string;
  expireAt: number;
}>;
```

**Purpose**: Create PENDING movie booking transaction and send OTP

**Process Flow**:

1. Validate user authentication
2. Get and validate user profile (eKYC, status, permissions)
3. Validate movie booking details (seats, amount)
4. Validate payment account (exists, belongs to user, not locked, sufficient balance)
5. Create PENDING transaction in `movieTransactions/{pushKey}`
6. Generate 6-digit OTP
7. Send OTP email to user
8. Return transaction ID, masked email, and expiration time

**Transaction Record (PENDING)**:

```typescript
{
  transactionId: string;
  userId: string;
  accountId: string;
  type: "MOVIE_BOOKING";
  amount: number;
  status: "PENDING";
  description: string; // "Đặt vé xem phim: {movieName}"
  movieId: string;
  movieName: string;
  showtime: string;
  seats: string[];
  otp: string; // Hashed OTP
  otpExpireAt: number; // Timestamp
  otpAttempts: number; // 0
  createdAt: number;
  createdAtServer: ServerTimestamp;
}
```

#### 2. confirmMoviePaymentWithOtp

```typescript
async function confirmMoviePaymentWithOtp(params: {
  transactionId: string;
  otp: string;
}): Promise<{
  title: string;
  amount: string;
  time: string;
  fee: string;
  details: Array<{ label: string; value: string }>;
}>;
```

**Purpose**: Verify OTP and complete movie booking payment

**Process Flow**:

1. Get PENDING transaction from `movieTransactions/{transactionId}`
2. Validate transaction exists and status is PENDING
3. Validate OTP has not expired
4. Validate OTP attempts < 3
5. Verify OTP matches (compare hashed values)
6. Deduct balance from account (atomic transaction)
7. Update transaction status to SUCCESS
8. Create booking record in `movieBookings/{pushKey}`
9. Send balance change notification
10. Return receipt data for result page

**Transaction Record (SUCCESS)**:

```typescript
{
  // ... existing fields
  status: "SUCCESS";
  otpVerifiedAt: number;
  completedAt: number;
  completedAtServer: ServerTimestamp;
}
```

**Booking Record**:

```typescript
{
  bookingId: string;
  userId: string;
  movieId: string;
  movieName: string;
  showtime: string;
  seats: string[];
  totalAmount: number;
  accountId: string;
  status: "CONFIRMED";
  transactionId: string;
  createdAt: number;
  createdAtServer: ServerTimestamp;
}
```

#### 3. resendMoviePaymentOtp

```typescript
async function resendMoviePaymentOtp(params: {
  transactionId: string;
}): Promise<{
  maskedEmail: string;
  expireAt: number;
}>;
```

**Purpose**: Generate and send new OTP for existing PENDING transaction

**Process Flow**:

1. Get PENDING transaction
2. Validate transaction exists and status is PENDING
3. Generate new 6-digit OTP
4. Update transaction with new OTP and expiration
5. Send OTP email
6. Return masked email and new expiration time

#### 4. initiateHotelPayment

```typescript
async function initiateHotelPayment(params: {
  hotelId: string;
  hotelName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount: number;
  accountId: string;
}): Promise<{
  transactionId: string;
  maskedEmail: string;
  expireAt: number;
}>;
```

**Purpose**: Create PENDING hotel booking transaction and send OTP

**Process Flow**: Same as `initiateMoviePayment`, with hotel-specific details

**Transaction Record (PENDING)**:

```typescript
{
  transactionId: string;
  userId: string;
  accountId: string;
  type: "HOTEL_BOOKING";
  amount: number;
  status: "PENDING";
  description: string; // "Đặt phòng khách sạn: {hotelName}"
  hotelId: string;
  hotelName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  otp: string; // Hashed OTP
  otpExpireAt: number;
  otpAttempts: number;
  createdAt: number;
  createdAtServer: ServerTimestamp;
}
```

#### 5. confirmHotelPaymentWithOtp

```typescript
async function confirmHotelPaymentWithOtp(params: {
  transactionId: string;
  otp: string;
}): Promise<{
  title: string;
  amount: string;
  time: string;
  fee: string;
  details: Array<{ label: string; value: string }>;
}>;
```

**Purpose**: Verify OTP and complete hotel booking payment

**Process Flow**: Same as `confirmMoviePaymentWithOtp`, with hotel-specific details

**Booking Record**:

```typescript
{
  bookingId: string;
  userId: string;
  hotelId: string;
  hotelName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount: number;
  accountId: string;
  status: "CONFIRMED";
  transactionId: string;
  createdAt: number;
  createdAtServer: ServerTimestamp;
}
```

#### 6. resendHotelPaymentOtp

```typescript
async function resendHotelPaymentOtp(params: {
  transactionId: string;
}): Promise<{
  maskedEmail: string;
  expireAt: number;
}>;
```

**Purpose**: Generate and send new OTP for existing PENDING hotel transaction

**Process Flow**: Same as `resendMoviePaymentOtp`

### Data Models

#### UtilityPaymentRequest Type (Updated)

```typescript
export type UtilityPaymentRequest = {
  type:
    | "FLIGHT"
    | "UTILITY_BILL"
    | "DATA_PACK"
    | "PHONE_TOPUP"
    | "MOVIE"
    | "HOTEL";
  amount: number;
  accountId: string;
  details: Record<string, unknown>;
};
```

#### Movie Payment Details

```typescript
{
  movieId: string;
  movieName: string;
  showtime: string;
  seats: string[];
}
```

#### Hotel Payment Details

```typescript
{
  hotelId: string;
  hotelName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}
```

### Validation Rules

#### Movie Booking Validation

- At least one seat must be selected
- Movie ID and name must be provided
- Showtime must be provided
- Total amount must be > 0
- User must be authenticated
- User eKYC status must be VERIFIED
- User account status must not be LOCKED
- User must have transaction permission
- Payment account must exist and belong to user
- Payment account status must not be LOCKED
- Account balance must be sufficient

#### Hotel Booking Validation

- Hotel ID and name must be provided
- Room type must be provided
- Check-in date must be before check-out date
- Number of guests must be > 0
- Total amount must be > 0
- User must be authenticated
- User eKYC status must be VERIFIED
- User account status must not be LOCKED
- User must have transaction permission
- Payment account must exist and belong to user
- Payment account status must not be LOCKED
- Account balance must be sufficient

#### PIN Validation

- PIN must be 4-6 digits
- PIN must match user's transaction PIN
- Maximum 5 failed attempts before account lock
- Failed attempts increment `pinFailCount` in user profile

#### OTP Validation

- OTP must be exactly 6 digits
- OTP must not be expired (5 minutes validity)
- OTP must match hashed value in transaction
- Maximum 3 attempts per transaction
- Failed attempts increment `otpAttempts` in transaction

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: PIN Screen Navigation with Complete Details

_For any_ movie or hotel booking payment, when the user clicks the payment button, the system should navigate to /utilities/pin with a pendingRequest containing type (MOVIE or HOTEL), amount, accountId, and all booking-specific details
**Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5**

### Property 2: PIN Verification and Attempt Tracking

_For any_ PIN entry attempt, the system should verify the PIN against the user profile, and if verification fails, should increment pinFailCount and display remaining attempts (max 5), and if pinFailCount reaches 5, should lock the account
**Validates: Requirements 1.4, 1.5, 1.6, 2.4, 2.5, 2.6, 15.1, 15.2**

### Property 3: PENDING Transaction Creation After PIN Success

_For any_ successful PIN verification for movie or hotel booking, the system should create exactly one PENDING transaction in the appropriate collection (movieTransactions or hotelTransactions) with all required fields including otp (hashed), otpExpireAt, and otpAttempts=0
**Validates: Requirements 1.7, 2.7, 5.4, 6.4, 15.6**

### Property 4: OTP Generation and Email Delivery

_For any_ PENDING transaction creation, the system should generate a 6-digit OTP, send it to the user's email with appropriate subject and content, and return transactionId, maskedEmail, and expireAt
**Validates: Requirements 1.8, 2.8, 5.5, 5.6, 5.7, 6.5, 6.6, 6.7, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7**

### Property 5: OTP Screen Navigation with Transaction Data

_For any_ successful OTP sending, the system should navigate to /utilities/otp with pendingRequest, transactionId, maskedEmail, expireAt, and returnPath
**Validates: Requirements 1.9, 2.9, 7.5**

### Property 6: OTP Expiration Timer Display

_For any_ OTP confirmation screen, the system should display a countdown timer starting at 5 minutes (300 seconds) that decrements correctly until expiration
**Validates: Requirements 3.2, 4.2**

### Property 7: OTP Verification with Attempt Limiting

_For any_ OTP entry attempt, the system should verify the OTP matches the hashed value in the transaction, check it has not expired, increment otpAttempts on failure, and reject if otpAttempts >= 3
**Validates: Requirements 3.3, 3.4, 4.3, 4.4, 5.9, 6.9, 15.3, 15.4, 15.5**

### Property 8: OTP Resend with New Expiration

_For any_ OTP resend request, if the current OTP has expired, the system should generate a new 6-digit OTP, update the transaction with new otp and otpExpireAt, send a new email, and return updated maskedEmail and expireAt
**Validates: Requirements 3.5, 3.6, 4.5, 4.6, 5.14, 6.14**

### Property 9: Transaction Status Update on OTP Success

_For any_ successful OTP verification, the system should atomically update the transaction status from PENDING to SUCCESS and set otpVerifiedAt and completedAt timestamps
**Validates: Requirements 3.7, 4.7, 5.10, 6.10, 15.10**

### Property 10: Atomic Balance Deduction

_For any_ transaction with SUCCESS status, the system should deduct the exact transaction amount from the payment account balance using an atomic transaction operation
**Validates: Requirements 3.8, 4.8, 5.11, 6.11, 13.9, 13.10, 15.8, 15.9**

### Property 11: Booking Record Creation

_For any_ successful balance deduction, the system should create exactly one booking record in the appropriate collection (movieBookings or hotelBookings) with all required fields including bookingId, userId, booking details, totalAmount, accountId, status="CONFIRMED", transactionId, and timestamps
**Validates: Requirements 3.9, 4.9, 5.11, 6.11**

### Property 12: Balance Change Notification

_For any_ successful booking creation, the system should create a balance change notification with type="BALANCE_CHANGE", direction="OUT", appropriate title, booking details in message, amount, accountNumber, balanceAfter, transactionId, and createdAt
**Validates: Requirements 3.10, 4.10**

### Property 13: Result Page Navigation with Receipt Data

_For any_ completed booking, the system should navigate to /utilities/result with result data containing title, amount, time, fee, transactionId, and booking-specific details array
**Validates: Requirements 3.11, 4.11, 5.12, 6.12, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8**

### Property 14: Payment Type Routing in PIN Confirmation

_For any_ pendingRequest with type "MOVIE" or "HOTEL" in UtilityPinConfirm, the system should call the appropriate initiate function (initiateMoviePayment or initiateHotelPayment) with the correct booking details from pendingRequest.details
**Validates: Requirements 7.3, 7.4**

### Property 15: Payment Type Label Display

_For any_ payment type "MOVIE" or "HOTEL", the system should display the correct Vietnamese label ("Đặt vé xem phim" or "Đặt phòng khách sạn") in both PIN and OTP confirmation screens
**Validates: Requirements 7.6, 7.7, 8.7, 8.8**

### Property 16: Payment Type Routing in OTP Confirmation

_For any_ pendingRequest with type "MOVIE" or "HOTEL" in UtilityOtpConfirm, the system should call the appropriate confirm function (confirmMoviePaymentWithOtp or confirmHotelPaymentWithOtp) and resend function (resendMoviePaymentOtp or resendHotelPaymentOtp) based on the payment type
**Validates: Requirements 8.1, 8.2, 8.4, 8.5**

### Property 17: User Authentication and Permission Validation

_For any_ payment initiation request, the system should validate that the user is authenticated, has eKYC status "VERIFIED", account status not "LOCKED", and canTransact=true, rejecting with appropriate Vietnamese error messages if any validation fails
**Validates: Requirements 5.2, 6.2, 12.1, 12.2, 12.3, 13.1, 13.2**

### Property 18: Account Ownership and Status Validation

_For any_ payment initiation request, the system should validate that the payment account exists, belongs to the authenticated user, has status not "LOCKED", and has sufficient balance, rejecting with appropriate Vietnamese error messages if any validation fails
**Validates: Requirements 5.3, 6.3, 12.4, 12.5**

### Property 19: Consistent Error Message Format

_For any_ validation failure or error condition, the system should return error messages in Vietnamese following the same format as existing utilities (flight, utility bill, data pack, phone topup)
**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 13.3, 13.4**

### Property 20: RTDB-Only Data Storage

_For any_ movie or hotel booking transaction, all data (transactions, bookings, notifications) should be stored in Firebase Realtime Database, not Firestore
**Validates: Requirements 13.5, 13.6**

### Property 21: Email Masking for Privacy

_For any_ OTP confirmation screen, the system should display the user's email address in masked format (e.g., "a**\*@example.com") to protect privacy
**Validates: Requirements 3.1, 4.1\*\*

### Property 22: Direct Payment Removal from UI Components

_For any_ UtilityMovie or UtilityHotel component, the component should not directly import or call payment service functions, instead navigating to PIN screen with pendingRequest
**Validates: Requirements 9.6, 9.7, 10.6, 10.7**

### Property 23: Validation Sequence Consistency

_For any_ payment initiation, the system should follow the same validation sequence as existing utilities: authentication → user profile → account ownership → account status → balance sufficiency
**Validates: Requirements 13.1, 13.2**

### Property 24: Atomic Transaction Rollback on Failure

_For any_ payment operation where any step fails after balance deduction, the system should not have modified the account balance (atomic rollback)
**Validates: Requirements 15.8, 15.9**

## Error Handling

### Error Types and Messages

| Condition                      | Error Message                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Not authenticated              | "Vui lòng đăng nhập để tiếp tục"                                                                     |
| Profile not found              | "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."                                       |
| Account locked                 | "Tài khoản đăng nhập đang bị khóa, không thể giao dịch"                                              |
| eKYC not verified              | "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."                    |
| No transaction permission      | "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."                               |
| Payment account not found      | "Không tìm thấy tài khoản thanh toán"                                                                |
| Wrong account owner            | "Bạn không có quyền sử dụng tài khoản này"                                                           |
| Payment account locked         | "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."                                          |
| Insufficient balance           | "Số dư không đủ. Cần {amount} ₫, hiện có {balance} ₫"                                                |
| No seats selected (movie)      | "Vui lòng chọn ít nhất một ghế"                                                                      |
| Invalid booking details        | "Thông tin đặt chỗ không hợp lệ"                                                                     |
| Wrong PIN                      | "Mã PIN giao dịch không đúng. Bạn còn {remaining} lần thử."                                          |
| Account locked after PIN fails | "Bạn đã nhập sai mã PIN quá 5 lần. Tài khoản đã bị tạm khóa. Vui lòng liên hệ nhân viên để mở khóa." |
| Wrong OTP                      | "Mã OTP không đúng. Vui lòng thử lại."                                                               |
| OTP expired                    | "Mã OTP đã hết hạn. Vui lòng gửi lại OTP mới."                                                       |
| OTP max attempts               | "Bạn đã nhập sai OTP quá 3 lần. Giao dịch đã bị hủy."                                                |
| Transaction not found          | "Không tìm thấy giao dịch"                                                                           |
| Transaction not pending        | "Giao dịch không ở trạng thái chờ xác nhận"                                                          |
| Transaction failed             | "Giao dịch thất bại"                                                                                 |

### Error Handling Strategy

1. **Validation Errors**: Return immediately without database operations
2. **PIN Errors**: Track attempts, lock account after 5 failures
3. **OTP Errors**: Track attempts per transaction, limit to 3
4. **Transaction Errors**: Use Firebase atomic transactions for balance operations
5. **Notification Errors**: Log but don't fail the payment
6. **Unknown Errors**: Catch and return generic error message

### Rollback Strategy

If any step fails after balance deduction:

1. The atomic transaction will automatically rollback
2. Transaction status remains PENDING or is set to FAILED
3. No booking record is created
4. No notification is sent
5. User can retry or cancel

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **PIN Validation**:

   - Valid PIN: 4-6 digits matching user profile
   - Invalid PIN: wrong digits, too short, too long
   - PIN attempt tracking: verify counter increments
   - Account locking: verify after 5 failed attempts

2. **OTP Validation**:

   - Valid OTP: 6 digits matching hashed value
   - Invalid OTP: wrong digits, expired, too many attempts
   - OTP expiration: verify 5-minute timeout
   - OTP resend: verify new OTP generation

3. **Navigation State**:

   - Verify pendingRequest structure for MOVIE type
   - Verify pendingRequest structure for HOTEL type
   - Verify returnPath is set correctly

4. **Error Messages**:

   - Each error condition returns correct Vietnamese message
   - Error messages match existing utility patterns

5. **Service Function Signatures**:
   - initiateMoviePayment accepts correct parameters
   - confirmMoviePaymentWithOtp accepts correct parameters
   - resendMoviePaymentOtp accepts correct parameters
   - Same for hotel functions

### Property-Based Tests

Property-based tests verify universal properties across many generated inputs. Each test should run minimum 100 iterations.

1. **Property 1: PIN Screen Navigation with Complete Details**

   - Generate random movie/hotel bookings
   - Verify navigation includes all required fields

2. **Property 2: PIN Verification and Attempt Tracking**

   - Generate random PINs and user profiles
   - Verify attempt tracking and account locking

3. **Property 3: PENDING Transaction Creation After PIN Success**

   - Generate random successful PIN verifications
   - Verify exactly one PENDING transaction is created

4. **Property 4: OTP Generation and Email Delivery**

   - Generate random PENDING transactions
   - Verify OTP is 6 digits and email is sent

5. **Property 5: OTP Screen Navigation with Transaction Data**

   - Generate random OTP sending scenarios
   - Verify navigation includes all required fields

6. **Property 6: OTP Expiration Timer Display**

   - Generate random OTP confirmation screens
   - Verify timer starts at 300 seconds and decrements

7. **Property 7: OTP Verification with Attempt Limiting**

   - Generate random OTP attempts
   - Verify attempt limiting and expiration checking

8. **Property 8: OTP Resend with New Expiration**

   - Generate random resend requests
   - Verify new OTP and expiration are generated

9. **Property 9: Transaction Status Update on OTP Success**

   - Generate random successful OTP verifications
   - Verify status changes to SUCCESS atomically

10. **Property 10: Atomic Balance Deduction**

    - Generate random successful transactions
    - Verify balance is decreased by exact amount atomically

11. **Property 11: Booking Record Creation**

    - Generate random successful balance deductions
    - Verify exactly one booking record is created

12. **Property 12: Balance Change Notification**

    - Generate random successful bookings
    - Verify notification is created with correct structure

13. **Property 13: Result Page Navigation with Receipt Data**

    - Generate random completed bookings
    - Verify navigation includes all receipt fields

14. **Property 14: Payment Type Routing in PIN Confirmation**

    - Generate random MOVIE and HOTEL payment requests
    - Verify correct initiate function is called

15. **Property 15: Payment Type Label Display**

    - Generate random MOVIE and HOTEL payment types
    - Verify correct Vietnamese labels are displayed

16. **Property 16: Payment Type Routing in OTP Confirmation**

    - Generate random MOVIE and HOTEL OTP confirmations
    - Verify correct confirm/resend functions are called

17. **Property 17: User Authentication and Permission Validation**

    - Generate random user profiles with various statuses
    - Verify only valid users pass validation

18. **Property 18: Account Ownership and Status Validation**

    - Generate random accounts with various statuses
    - Verify only valid accounts pass validation

19. **Property 19: Consistent Error Message Format**

    - Generate random error conditions
    - Verify error messages match existing patterns

20. **Property 20: RTDB-Only Data Storage**

    - Generate random transactions
    - Verify no Firestore operations are performed

21. **Property 21: Email Masking for Privacy**

    - Generate random email addresses
    - Verify masking format (a\*\*\*@example.com)

22. **Property 22: Direct Payment Removal from UI Components**

    - Verify UtilityMovie doesn't import payment services
    - Verify UtilityHotel doesn't import payment services

23. **Property 23: Validation Sequence Consistency**

    - Generate random payment initiations
    - Verify validation order matches existing utilities

24. **Property 24: Atomic Transaction Rollback on Failure**
    - Simulate failures after balance deduction
    - Verify balance remains unchanged

### Testing Framework

- **Unit Tests**: Vitest
- **Property-Based Tests**: fast-check (TypeScript property-based testing library)
- **Test Location**: Co-located with service files as `*.test.ts`

### Test Configuration

```typescript
// Property test configuration
import { test } from "vitest";
import * as fc from "fast-check";

test("Property N: Description", () => {
  fc.assert(
    fc.property(
      // generators
      fc.string(),
      fc.integer(),
      // test function
      (input1, input2) => {
        // property assertion
        return true;
      }
    ),
    { numRuns: 100 } // minimum 100 iterations
  );
});
```

Each property test must include a comment tag:

```typescript
// Feature: remaining-utilities-pin-otp-auth, Property 1: PIN Screen Navigation with Complete Details
// Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5
```

## Implementation Notes

### Code Reuse from Existing Services

The implementation should closely follow patterns from:

- `flightBookingService.ts` - For initiate/confirm/resend pattern
- `utilityBillService.ts` - For validation and error handling
- `mobilePhonePaymentService.ts` - For transaction structure
- `otpService.ts` - For OTP generation and email sending

### Firebase Transaction Usage

Use `runTransaction` for balance deduction to ensure atomicity:

```typescript
await runTransaction(accountRef, (current) => {
  const acc = current as Record<string, unknown> | null;
  if (!acc) return current; // Abort

  // Validate account status
  if (acc.status === "LOCKED") {
    throw new Error("Account locked");
  }

  // Check balance
  const balance = Number(acc.balance || 0);
  if (balance < amount) {
    throw new Error("Insufficient balance");
  }

  // Deduct balance
  return { ...acc, balance: balance - amount };
});
```

### OTP Hashing

Use bcrypt or similar for OTP hashing:

```typescript
import bcrypt from "bcryptjs";

// Generate and hash OTP
const otp = generateOtp(); // 6 digits
const hashedOtp = await bcrypt.hash(otp, 10);

// Verify OTP
const isValid = await bcrypt.compare(userInputOtp, hashedOtp);
```

### Timestamp Handling

Use both client and server timestamps:

- `createdAt`: `Date.now()` - for client-side display
- `createdAtServer`: `serverTimestamp()` - for server-side ordering

### Navigation State Management

When navigating to PIN screen:

```typescript
navigate("/utilities/pin", {
  state: {
    pendingRequest: {
      type: "MOVIE", // or "HOTEL"
      amount: totalAmount,
      accountId: selectedAccountId,
      details: {
        movieId,
        movieName,
        showtime,
        seats,
        // ... other details
      },
    },
    returnPath: "/utilities/movie", // or "/utilities/hotel"
  },
});
```

### Component Updates

**UtilityMovie.tsx**:

```typescript
// Remove direct payment call
// const result = await createMovieBooking({ ... });

// Replace with navigation to PIN screen
navigate("/utilities/pin", {
  state: {
    pendingRequest: {
      type: "MOVIE",
      amount: totalAmount,
      accountId: selectedAccountId,
      details: { movieId, movieName, showtime, seats },
    },
    returnPath: "/utilities/movie",
  },
});
```

**UtilityHotel.tsx**:

```typescript
// Remove direct payment call
// const result = await createHotelBooking({ ... });

// Replace with navigation to PIN screen
navigate("/utilities/pin", {
  state: {
    pendingRequest: {
      type: "HOTEL",
      amount: totalAmount,
      accountId: selectedAccountId,
      details: { hotelId, hotelName, roomType, checkIn, checkOut, guests },
    },
    returnPath: "/utilities/hotel",
  },
});
```

**UtilityPinConfirm.tsx**:

```typescript
// Add MOVIE and HOTEL cases
case "MOVIE": {
  const { initiateMoviePayment } = await import(
    "@/services/moviePaymentService"
  );
  initiateResult = await initiateMoviePayment({
    movieId: pendingRequest.details.movieId as string,
    movieName: pendingRequest.details.movieName as string,
    showtime: pendingRequest.details.showtime as string,
    seats: pendingRequest.details.seats as string[],
    totalAmount: pendingRequest.amount,
    accountId: pendingRequest.accountId,
  });
  break;
}
case "HOTEL": {
  const { initiateHotelPayment } = await import(
    "@/services/hotelPaymentService"
  );
  initiateResult = await initiateHotelPayment({
    hotelId: pendingRequest.details.hotelId as string,
    hotelName: pendingRequest.details.hotelName as string,
    roomType: pendingRequest.details.roomType as string,
    checkIn: pendingRequest.details.checkIn as string,
    checkOut: pendingRequest.details.checkOut as string,
    guests: pendingRequest.details.guests as number,
    totalAmount: pendingRequest.amount,
    accountId: pendingRequest.accountId,
  });
  break;
}
```

**UtilityOtpConfirm.tsx**:

```typescript
// Add MOVIE and HOTEL cases for confirm
case "MOVIE": {
  const { confirmMoviePaymentWithOtp } = await import(
    "@/services/moviePaymentService"
  );
  result = await confirmMoviePaymentWithOtp({
    transactionId,
    otp: trimmedOtp,
  });
  break;
}
case "HOTEL": {
  const { confirmHotelPaymentWithOtp } = await import(
    "@/services/hotelPaymentService"
  );
  result = await confirmHotelPaymentWithOtp({
    transactionId,
    otp: trimmedOtp,
  });
  break;
}

// Add MOVIE and HOTEL cases for resend
case "MOVIE": {
  const { resendMoviePaymentOtp } = await import(
    "@/services/moviePaymentService"
  );
  const resendResult = await resendMoviePaymentOtp({ transactionId });
  setMaskedEmail(resendResult.maskedEmail);
  setExpireAt(resendResult.expireAt);
  break;
}
case "HOTEL": {
  const { resendHotelPaymentOtp } = await import(
    "@/services/hotelPaymentService"
  );
  const resendResult = await resendHotelPaymentOtp({ transactionId });
  setMaskedEmail(resendResult.maskedEmail);
  setExpireAt(resendResult.expireAt);
  break;
}
```

## Security Considerations

1. **Authentication**: All operations require authenticated user
2. **Authorization**: Verify account ownership before operations
3. **PIN Security**: Hash PINs, track attempts, lock after 5 failures
4. **OTP Security**: Hash OTPs, 5-minute expiration, limit to 3 attempts
5. **Atomicity**: Use Firebase transactions for balance changes
6. **Error Messages**: Don't expose sensitive information in errors
7. **Audit Trail**: Record all transactions with timestamps and user IDs
8. **Email Privacy**: Mask email addresses in UI
9. **Transaction Expiration**: PENDING transactions expire after 5 minutes
10. **Rollback Safety**: Atomic operations ensure no partial state on failure

## Migration Strategy

### Phase 1: Create Service Files

1. Create `moviePaymentService.ts` with initiate/confirm/resend functions
2. Create `hotelPaymentService.ts` with initiate/confirm/resend functions
3. Add unit tests for service functions

### Phase 2: Update Shared Components

1. Update `UtilityPaymentRequest` type to include MOVIE and HOTEL
2. Update `UtilityPinConfirm.tsx` to handle MOVIE and HOTEL cases
3. Update `UtilityOtpConfirm.tsx` to handle MOVIE and HOTEL cases
4. Add property-based tests for PIN/OTP flows

### Phase 3: Update UI Components

1. Update `UtilityMovie.tsx` to navigate to PIN screen
2. Update `UtilityHotel.tsx` to navigate to PIN screen
3. Remove direct payment logic from both components
4. Test complete flow for both utilities

### Phase 4: Testing and Validation

1. Run all unit tests
2. Run all property-based tests
3. Manual testing of complete flows
4. Verify error handling and edge cases
5. Verify notification delivery
6. Verify result page display

### Backward Compatibility

- Existing movie/hotel bookings (if any) remain accessible
- New bookings use PIN/OTP flow
- No breaking changes to database structure
- Existing transaction records remain valid

## Performance Considerations

1. **Lazy Loading**: Service functions are dynamically imported to reduce initial bundle size
2. **Atomic Operations**: Firebase transactions ensure consistency without locks
3. **Email Sending**: Asynchronous, doesn't block payment flow
4. **Notification Failures**: Don't block payment completion
5. **Database Reads**: Minimize reads by caching user profile during validation
6. **OTP Expiration**: 5-minute window balances security and user experience

## Monitoring and Logging

1. **Transaction Logging**: All transactions logged with timestamps
2. **Error Logging**: All errors logged with context
3. **OTP Failures**: Track OTP failure rates
4. **PIN Failures**: Track PIN failure rates and account locks
5. **Email Delivery**: Monitor email sending success rates
6. **Performance Metrics**: Track payment completion times
