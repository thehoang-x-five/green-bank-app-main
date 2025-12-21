# Requirements Document: PIN/OTP Authentication for Movie and Hotel Bookings

## Introduction

This document specifies the requirements for adding PIN and OTP authentication to movie booking and hotel booking payment flows. Currently, these utilities lack the two-factor authentication (PIN → OTP) that is already implemented for flight bookings, utility bill payments, data pack purchases, and phone topup. This feature will ensure consistent security across all payment utilities in the application.

## Glossary

- **System**: The payment authentication system for movie and hotel bookings
- **User**: An authenticated customer using the mobile banking application
- **PIN**: Personal Identification Number used for transaction authentication (4-6 digits)
- **OTP**: One-Time Password sent to user's email for transaction verification (6 digits)
- **Movie_Booking**: Service for booking movie tickets with seat selection
- **Hotel_Booking**: Service for booking hotel rooms with date selection
- **Payment_Account**: User's bank account used as payment source
- **Transaction**: A payment record with PENDING or SUCCESS status
- **RTDB**: Firebase Realtime Database
- **Pending_Transaction**: A transaction created after PIN verification, awaiting OTP confirmation

## Requirements

### Requirement 1: Movie Booking PIN Authentication

**User Story:** As a user, I want to authenticate with my transaction PIN when booking movie tickets, so that my payment is secure.

#### Acceptance Criteria

1. WHEN a user completes movie selection and clicks payment button, THE System SHALL navigate to PIN confirmation screen
2. WHEN navigating to PIN screen, THE System SHALL pass movie booking details (movieId, movieName, showtime, seats, totalAmount, accountId)
3. WHEN navigating to PIN screen, THE System SHALL set payment type to "MOVIE"
4. WHEN user enters PIN on confirmation screen, THE System SHALL verify PIN against user profile
5. IF PIN verification fails, THEN THE System SHALL display remaining attempts (maximum 5 attempts)
6. IF PIN verification fails 5 times, THEN THE System SHALL lock the user account
7. WHEN PIN verification succeeds, THE System SHALL create a PENDING transaction in movieTransactions
8. WHEN PENDING transaction is created, THE System SHALL generate and send OTP to user's email
9. WHEN OTP is sent, THE System SHALL navigate to OTP confirmation screen with transaction details

### Requirement 2: Hotel Booking PIN Authentication

**User Story:** As a user, I want to authenticate with my transaction PIN when booking hotel rooms, so that my payment is secure.

#### Acceptance Criteria

1. WHEN a user completes hotel selection and clicks payment button, THE System SHALL navigate to PIN confirmation screen
2. WHEN navigating to PIN screen, THE System SHALL pass hotel booking details (hotelId, hotelName, roomType, checkIn, checkOut, guests, totalAmount, accountId)
3. WHEN navigating to PIN screen, THE System SHALL set payment type to "HOTEL"
4. WHEN user enters PIN on confirmation screen, THE System SHALL verify PIN against user profile
5. IF PIN verification fails, THEN THE System SHALL display remaining attempts (maximum 5 attempts)
6. IF PIN verification fails 5 times, THEN THE System SHALL lock the user account
7. WHEN PIN verification succeeds, THE System SHALL create a PENDING transaction in hotelTransactions
8. WHEN PENDING transaction is created, THE System SHALL generate and send OTP to user's email
9. WHEN OTP is sent, THE System SHALL navigate to OTP confirmation screen with transaction details

### Requirement 3: Movie Booking OTP Verification

**User Story:** As a user, I want to verify my movie booking with an OTP code, so that my transaction is confirmed securely.

#### Acceptance Criteria

1. WHEN user receives OTP on confirmation screen, THE System SHALL display masked email address
2. WHEN user receives OTP, THE System SHALL display expiration countdown timer (5 minutes)
3. WHEN user enters 6-digit OTP, THE System SHALL verify OTP against pending transaction
4. IF OTP verification fails, THEN THE System SHALL display error message and allow retry (maximum 3 attempts)
5. IF OTP expires, THEN THE System SHALL allow user to resend OTP
6. WHEN user requests OTP resend, THE System SHALL generate new OTP with new expiration time
7. WHEN OTP verification succeeds, THE System SHALL update transaction status from PENDING to SUCCESS
8. WHEN transaction status is SUCCESS, THE System SHALL deduct amount from payment account balance
9. WHEN balance is deducted, THE System SHALL create booking record in movieBookings
10. WHEN booking is created, THE System SHALL send balance change notification to user
11. WHEN all operations complete, THE System SHALL navigate to result page with booking details

### Requirement 4: Hotel Booking OTP Verification

**User Story:** As a user, I want to verify my hotel booking with an OTP code, so that my transaction is confirmed securely.

#### Acceptance Criteria

1. WHEN user receives OTP on confirmation screen, THE System SHALL display masked email address
2. WHEN user receives OTP, THE System SHALL display expiration countdown timer (5 minutes)
3. WHEN user enters 6-digit OTP, THE System SHALL verify OTP against pending transaction
4. IF OTP verification fails, THEN THE System SHALL display error message and allow retry (maximum 3 attempts)
5. IF OTP expires, THEN THE System SHALL allow user to resend OTP
6. WHEN user requests OTP resend, THE System SHALL generate new OTP with new expiration time
7. WHEN OTP verification succeeds, THE System SHALL update transaction status from PENDING to SUCCESS
8. WHEN transaction status is SUCCESS, THE System SHALL deduct amount from payment account balance
9. WHEN balance is deducted, THE System SHALL create booking record in hotelBookings
10. WHEN booking is created, THE System SHALL send balance change notification to user
11. WHEN all operations complete, THE System SHALL navigate to result page with booking details

### Requirement 5: Movie Payment Service Functions

**User Story:** As a developer, I want movie payment service functions that support PIN/OTP flow, so that the implementation follows existing patterns.

#### Acceptance Criteria

1. THE System SHALL provide function initiateMoviePayment that accepts movieId, movieName, showtime, seats, totalAmount, accountId
2. WHEN initiateMoviePayment is called, THE System SHALL validate user authentication and permissions
3. WHEN initiateMoviePayment is called, THE System SHALL validate account ownership and balance
4. WHEN validation passes, THE System SHALL create PENDING transaction in movieTransactions
5. WHEN PENDING transaction is created, THE System SHALL generate 6-digit OTP
6. WHEN OTP is generated, THE System SHALL send OTP email to user
7. WHEN OTP is sent, THE System SHALL return transactionId, maskedEmail, and expireAt
8. THE System SHALL provide function confirmMoviePaymentWithOtp that accepts transactionId and otp
9. WHEN confirmMoviePaymentWithOtp is called, THE System SHALL verify OTP matches transaction
10. WHEN OTP is verified, THE System SHALL update transaction status to SUCCESS
11. WHEN transaction is SUCCESS, THE System SHALL deduct balance and create booking record
12. WHEN booking is complete, THE System SHALL return receipt data for result page
13. THE System SHALL provide function resendMoviePaymentOtp that accepts transactionId
14. WHEN resendMoviePaymentOtp is called, THE System SHALL generate new OTP and update expiration

### Requirement 6: Hotel Payment Service Functions

**User Story:** As a developer, I want hotel payment service functions that support PIN/OTP flow, so that the implementation follows existing patterns.

#### Acceptance Criteria

1. THE System SHALL provide function initiateHotelPayment that accepts hotelId, hotelName, roomType, checkIn, checkOut, guests, totalAmount, accountId
2. WHEN initiateHotelPayment is called, THE System SHALL validate user authentication and permissions
3. WHEN initiateHotelPayment is called, THE System SHALL validate account ownership and balance
4. WHEN validation passes, THE System SHALL create PENDING transaction in hotelTransactions
5. WHEN PENDING transaction is created, THE System SHALL generate 6-digit OTP
6. WHEN OTP is generated, THE System SHALL send OTP email to user
7. WHEN OTP is sent, THE System SHALL return transactionId, maskedEmail, and expireAt
8. THE System SHALL provide function confirmHotelPaymentWithOtp that accepts transactionId and otp
9. WHEN confirmHotelPaymentWithOtp is called, THE System SHALL verify OTP matches transaction
10. WHEN OTP is verified, THE System SHALL update transaction status to SUCCESS
11. WHEN transaction is SUCCESS, THE System SHALL deduct balance and create booking record
12. WHEN booking is complete, THE System SHALL return receipt data for result page
13. THE System SHALL provide function resendHotelPaymentOtp that accepts transactionId
14. WHEN resendHotelPaymentOtp is called, THE System SHALL generate new OTP and update expiration

### Requirement 7: Update UtilityPinConfirm Component

**User Story:** As a developer, I want UtilityPinConfirm to handle MOVIE and HOTEL payment types, so that PIN verification works for all utilities.

#### Acceptance Criteria

1. THE System SHALL add "MOVIE" to UtilityPaymentRequest type union
2. THE System SHALL add "HOTEL" to UtilityPaymentRequest type union
3. WHEN payment type is "MOVIE", THE System SHALL call initiateMoviePayment with booking details
4. WHEN payment type is "HOTEL", THE System SHALL call initiateHotelPayment with booking details
5. WHEN initiate function succeeds, THE System SHALL navigate to OTP screen with transaction data
6. WHEN payment type is "MOVIE", THE System SHALL display label "Đặt vé xem phim"
7. WHEN payment type is "HOTEL", THE System SHALL display label "Đặt phòng khách sạn"

### Requirement 8: Update UtilityOtpConfirm Component

**User Story:** As a developer, I want UtilityOtpConfirm to handle MOVIE and HOTEL payment types, so that OTP verification works for all utilities.

#### Acceptance Criteria

1. WHEN payment type is "MOVIE", THE System SHALL call confirmMoviePaymentWithOtp with transactionId and otp
2. WHEN payment type is "HOTEL", THE System SHALL call confirmHotelPaymentWithOtp with transactionId and otp
3. WHEN OTP confirmation succeeds, THE System SHALL navigate to result page with booking details
4. WHEN user requests resend for "MOVIE" type, THE System SHALL call resendMoviePaymentOtp
5. WHEN user requests resend for "HOTEL" type, THE System SHALL call resendHotelPaymentOtp
6. WHEN resend succeeds, THE System SHALL update masked email and expiration time
7. WHEN payment type is "MOVIE", THE System SHALL display label "Đặt vé xem phim"
8. WHEN payment type is "HOTEL", THE System SHALL display label "Đặt phòng khách sạn"

### Requirement 9: Update UtilityMovie Component

**User Story:** As a user, I want the movie booking interface to use PIN/OTP authentication, so that my payment is secure.

#### Acceptance Criteria

1. WHEN user clicks payment button in UtilityMovie, THE System SHALL navigate to /utilities/pin
2. WHEN navigating to PIN screen, THE System SHALL pass pendingRequest with type "MOVIE"
3. WHEN navigating to PIN screen, THE System SHALL include movie details in pendingRequest.details
4. WHEN navigating to PIN screen, THE System SHALL include amount and accountId in pendingRequest
5. WHEN navigating to PIN screen, THE System SHALL set returnPath to /utilities/movie
6. THE System SHALL NOT call payment service directly from UtilityMovie component
7. THE System SHALL remove direct payment logic from UtilityMovie component

### Requirement 10: Update UtilityHotel Component

**User Story:** As a user, I want the hotel booking interface to use PIN/OTP authentication, so that my payment is secure.

#### Acceptance Criteria

1. WHEN user clicks payment button in UtilityHotel, THE System SHALL navigate to /utilities/pin
2. WHEN navigating to PIN screen, THE System SHALL pass pendingRequest with type "HOTEL"
3. WHEN navigating to PIN screen, THE System SHALL include hotel details in pendingRequest.details
4. WHEN navigating to PIN screen, THE System SHALL include amount and accountId in pendingRequest
5. WHEN navigating to PIN screen, THE System SHALL set returnPath to /utilities/hotel
6. THE System SHALL NOT call payment service directly from UtilityHotel component
7. THE System SHALL remove direct payment logic from UtilityHotel component

### Requirement 11: Transaction Result Page Display

**User Story:** As a user, I want to see transaction details after successful payment, so that I can review my booking.

#### Acceptance Criteria

1. WHEN movie booking completes, THE System SHALL navigate to /utilities/result with booking details
2. WHEN hotel booking completes, THE System SHALL navigate to /utilities/result with booking details
3. WHEN displaying movie result, THE System SHALL show movie title, cinema name, showtime, seats, and amount
4. WHEN displaying hotel result, THE System SHALL show hotel name, room type, check-in/out dates, guests, and amount
5. WHEN displaying result, THE System SHALL show transaction ID
6. WHEN displaying result, THE System SHALL show transaction time
7. WHEN displaying result, THE System SHALL provide option to download/share receipt
8. WHEN displaying result, THE System SHALL provide option to return to home

### Requirement 12: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when authentication fails, so that I understand what went wrong.

#### Acceptance Criteria

1. IF user is not authenticated, THEN THE System SHALL return error "Vui lòng đăng nhập để tiếp tục"
2. IF user eKYC status is not VERIFIED, THEN THE System SHALL return error "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
3. IF user account is LOCKED, THEN THE System SHALL return error "Tài khoản đăng nhập đang bị khóa, không thể giao dịch"
4. IF payment account balance is insufficient, THEN THE System SHALL return error with required and available amounts
5. IF PIN is incorrect, THEN THE System SHALL display remaining attempts
6. IF OTP is incorrect, THEN THE System SHALL display error and allow retry
7. IF OTP expires, THEN THE System SHALL display expiration message and resend option
8. IF transaction fails, THEN THE System SHALL rollback PENDING transaction

### Requirement 13: Consistency with Existing Payment Flows

**User Story:** As a developer, I want movie and hotel payments to follow the same patterns as existing utilities, so that the codebase is maintainable.

#### Acceptance Criteria

1. WHEN implementing movie payment, THE System SHALL use same validation sequence as flight booking (auth → profile → account → balance)
2. WHEN implementing hotel payment, THE System SHALL use same validation sequence as flight booking (auth → profile → account → balance)
3. WHEN implementing movie payment, THE System SHALL use same error message format as existing utilities
4. WHEN implementing hotel payment, THE System SHALL use same error message format as existing utilities
5. WHEN implementing movie payment, THE System SHALL use RTDB for all data storage
6. WHEN implementing hotel payment, THE System SHALL use RTDB for all data storage
7. WHEN implementing movie payment, THE System SHALL send balance change notifications like other utilities
8. WHEN implementing hotel payment, THE System SHALL send balance change notifications like other utilities
9. WHEN implementing movie payment, THE System SHALL use atomic transactions for balance deduction
10. WHEN implementing hotel payment, THE System SHALL use atomic transactions for balance deduction

### Requirement 14: OTP Email Format

**User Story:** As a user, I want to receive clear OTP emails for movie and hotel bookings, so that I can easily identify and use the code.

#### Acceptance Criteria

1. WHEN sending movie booking OTP, THE System SHALL include subject "Mã OTP đặt vé xem phim"
2. WHEN sending hotel booking OTP, THE System SHALL include subject "Mã OTP đặt phòng khách sạn"
3. WHEN sending OTP email, THE System SHALL include 6-digit OTP code prominently
4. WHEN sending OTP email, THE System SHALL include transaction amount
5. WHEN sending OTP email, THE System SHALL include expiration time (5 minutes)
6. WHEN sending OTP email, THE System SHALL include booking details (movie/hotel name)
7. WHEN sending OTP email, THE System SHALL include warning about not sharing OTP

### Requirement 15: Security and Validation

**User Story:** As a system administrator, I want strict validation and security measures, so that fraudulent transactions are prevented.

#### Acceptance Criteria

1. WHEN validating PIN, THE System SHALL increment pinFailCount on each failed attempt
2. WHEN pinFailCount reaches 5, THE System SHALL set user status to LOCKED
3. WHEN validating OTP, THE System SHALL check OTP has not expired
4. WHEN validating OTP, THE System SHALL check OTP matches transaction
5. WHEN validating OTP, THE System SHALL limit attempts to 3 per transaction
6. WHEN creating PENDING transaction, THE System SHALL set expiration time to 5 minutes
7. WHEN PENDING transaction expires, THE System SHALL not allow OTP confirmation
8. WHEN deducting balance, THE System SHALL use atomic transaction to prevent race conditions
9. WHEN transaction fails, THE System SHALL not modify account balance
10. WHEN transaction succeeds, THE System SHALL update transaction status atomically
