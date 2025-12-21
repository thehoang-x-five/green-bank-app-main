# Implementation Plan: PIN/OTP Authentication for Movie and Hotel Bookings

## Overview

This implementation adds two-factor authentication (PIN → OTP) to movie and hotel booking payment flows by creating new service files, updating shared components, and modifying UI components to use the authentication flow.

## Tasks

- [ ] 1. Create Movie Payment Service

  - Create `src/services/moviePaymentService.ts` with three main functions
  - Implement validation logic following existing utility patterns
  - Use RTDB for all data storage
  - _Requirements: 1.7, 1.8, 3.7, 3.8, 3.9, 3.10, 5.1-5.14_

- [ ] 1.1 Implement initiateMoviePayment function

  - Accept movieId, movieName, showtime, seats, totalAmount, accountId parameters
  - Validate user authentication and permissions (eKYC, status, canTransact)
  - Validate account ownership and balance
  - Create PENDING transaction in `movieTransactions/{pushKey}`
  - Generate 6-digit OTP and hash it
  - Send OTP email using otpService
  - Return transactionId, maskedEmail, expireAt
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ]\* 1.2 Write property test for initiateMoviePayment

  - **Property 3: PENDING Transaction Creation After PIN Success**
  - **Property 4: OTP Generation and Email Delivery**
  - **Validates: Requirements 1.7, 1.8, 5.4, 5.5, 5.6, 5.7**

- [ ] 1.3 Implement confirmMoviePaymentWithOtp function

  - Accept transactionId and otp parameters
  - Get PENDING transaction from RTDB
  - Validate transaction exists, status is PENDING, OTP not expired
  - Verify OTP matches hashed value (max 3 attempts)
  - Update transaction status to SUCCESS atomically
  - Deduct balance from account using atomic transaction
  - Create booking record in `movieBookings/{pushKey}`
  - Send balance change notification
  - Return receipt data for result page
  - _Requirements: 5.8, 5.9, 5.10, 5.11, 5.12_

- [ ]\* 1.4 Write property test for confirmMoviePaymentWithOtp

  - **Property 7: OTP Verification with Attempt Limiting**
  - **Property 9: Transaction Status Update on OTP Success**
  - **Property 10: Atomic Balance Deduction**
  - **Property 11: Booking Record Creation**
  - **Validates: Requirements 3.3, 3.4, 3.7, 3.8, 3.9, 5.9, 5.10, 5.11**

- [ ] 1.5 Implement resendMoviePaymentOtp function

  - Accept transactionId parameter
  - Get PENDING transaction from RTDB
  - Validate transaction exists and status is PENDING
  - Generate new 6-digit OTP and hash it
  - Update transaction with new OTP and expiration
  - Send new OTP email
  - Return maskedEmail and new expireAt
  - _Requirements: 5.13, 5.14_

- [ ]\* 1.6 Write property test for resendMoviePaymentOtp

  - **Property 8: OTP Resend with New Expiration**
  - **Validates: Requirements 3.5, 3.6, 5.14**

- [ ] 2. Create Hotel Payment Service

  - Create `src/services/hotelPaymentService.ts` with three main functions
  - Follow same patterns as moviePaymentService
  - Use RTDB for all data storage
  - _Requirements: 2.7, 2.8, 4.7, 4.8, 4.9, 4.10, 6.1-6.14_

- [ ] 2.1 Implement initiateHotelPayment function

  - Accept hotelId, hotelName, roomType, checkIn, checkOut, guests, totalAmount, accountId parameters
  - Validate user authentication and permissions
  - Validate account ownership and balance
  - Create PENDING transaction in `hotelTransactions/{pushKey}`
  - Generate 6-digit OTP and hash it
  - Send OTP email using otpService
  - Return transactionId, maskedEmail, expireAt
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ]\* 2.2 Write property test for initiateHotelPayment

  - **Property 3: PENDING Transaction Creation After PIN Success**
  - **Property 4: OTP Generation and Email Delivery**
  - **Validates: Requirements 2.7, 2.8, 6.4, 6.5, 6.6, 6.7**

- [ ] 2.3 Implement confirmHotelPaymentWithOtp function

  - Accept transactionId and otp parameters
  - Get PENDING transaction from RTDB
  - Validate transaction and OTP
  - Update transaction status to SUCCESS
  - Deduct balance atomically
  - Create booking record in `hotelBookings/{pushKey}`
  - Send balance change notification
  - Return receipt data
  - _Requirements: 6.8, 6.9, 6.10, 6.11, 6.12_

- [ ]\* 2.4 Write property test for confirmHotelPaymentWithOtp

  - **Property 7: OTP Verification with Attempt Limiting**
  - **Property 9: Transaction Status Update on OTP Success**
  - **Property 10: Atomic Balance Deduction**
  - **Property 11: Booking Record Creation**
  - **Validates: Requirements 4.3, 4.4, 4.7, 4.8, 4.9, 6.9, 6.10, 6.11**

- [ ] 2.5 Implement resendHotelPaymentOtp function

  - Accept transactionId parameter
  - Get PENDING transaction
  - Generate new OTP
  - Update transaction
  - Send new email
  - Return maskedEmail and expireAt
  - _Requirements: 6.13, 6.14_

- [ ]\* 2.6 Write property test for resendHotelPaymentOtp

  - **Property 8: OTP Resend with New Expiration**
  - **Validates: Requirements 4.5, 4.6, 6.14**

- [ ] 3. Checkpoint - Ensure service tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Update Shared Type Definitions

  - Update UtilityPaymentRequest type to include MOVIE and HOTEL
  - Ensure TypeScript compilation succeeds
  - _Requirements: 7.1, 7.2_

- [ ] 4.1 Add MOVIE and HOTEL to UtilityPaymentRequest type union

  - Open `src/pages/utilities/UtilityPinConfirm.tsx`
  - Update type definition: `type: "FLIGHT" | "UTILITY_BILL" | "DATA_PACK" | "PHONE_TOPUP" | "MOVIE" | "HOTEL"`
  - Verify no TypeScript errors
  - _Requirements: 7.1, 7.2_

- [ ] 5. Update UtilityPinConfirm Component

  - Add MOVIE and HOTEL cases to PIN verification flow
  - Call appropriate initiate functions
  - Display correct labels
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 5.1 Add MOVIE case to handleConfirmPin switch statement

  - Import initiateMoviePayment dynamically
  - Extract movie details from pendingRequest.details
  - Call initiateMoviePayment with correct parameters
  - Navigate to OTP screen on success
  - _Requirements: 7.3, 7.5_

- [ ] 5.2 Add HOTEL case to handleConfirmPin switch statement

  - Import initiateHotelPayment dynamically
  - Extract hotel details from pendingRequest.details
  - Call initiateHotelPayment with correct parameters
  - Navigate to OTP screen on success
  - _Requirements: 7.4, 7.5_

- [ ] 5.3 Add MOVIE and HOTEL cases to getTypeLabel function

  - Return "Đặt vé xem phim" for MOVIE type
  - Return "Đặt phòng khách sạn" for HOTEL type
  - _Requirements: 7.6, 7.7_

- [ ]\* 5.4 Write property test for PIN confirmation routing

  - **Property 14: Payment Type Routing in PIN Confirmation**
  - **Property 15: Payment Type Label Display**
  - **Validates: Requirements 7.3, 7.4, 7.6, 7.7**

- [ ] 6. Update UtilityOtpConfirm Component

  - Add MOVIE and HOTEL cases to OTP verification flow
  - Call appropriate confirm and resend functions
  - Display correct labels
  - Navigate to result page with correct data
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.11, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.11, 8.1, 8.2, 8.4, 8.5, 8.7, 8.8_

- [ ] 6.1 Add MOVIE case to handleSubmit switch statement

  - Import confirmMoviePaymentWithOtp dynamically
  - Call function with transactionId and otp
  - Navigate to result page with booking details
  - _Requirements: 8.1_

- [ ] 6.2 Add HOTEL case to handleSubmit switch statement

  - Import confirmHotelPaymentWithOtp dynamically
  - Call function with transactionId and otp
  - Navigate to result page with booking details
  - _Requirements: 8.2_

- [ ] 6.3 Add MOVIE case to handleResend switch statement

  - Import resendMoviePaymentOtp dynamically
  - Call function with transactionId
  - Update maskedEmail and expireAt state
  - _Requirements: 8.4_

- [ ] 6.4 Add HOTEL case to handleResend switch statement

  - Import resendHotelPaymentOtp dynamically
  - Call function with transactionId
  - Update maskedEmail and expireAt state
  - _Requirements: 8.5_

- [ ] 6.5 Add MOVIE and HOTEL cases to getTypeLabel function

  - Return "Đặt vé xem phim" for MOVIE type
  - Return "Đặt phòng khách sạn" for HOTEL type
  - _Requirements: 8.7, 8.8_

- [ ]\* 6.6 Write property test for OTP confirmation routing

  - **Property 16: Payment Type Routing in OTP Confirmation**
  - **Property 15: Payment Type Label Display**
  - **Validates: Requirements 8.1, 8.2, 8.4, 8.5, 8.7, 8.8**

- [ ] 7. Checkpoint - Ensure shared component tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Update UtilityMovie Component

  - Remove direct payment logic
  - Navigate to PIN screen with pendingRequest
  - Set correct returnPath
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 8.1 Remove direct payment service import and calls

  - Remove import of createMovieBooking or similar
  - Remove direct payment function calls
  - _Requirements: 9.6, 9.7_

- [ ] 8.2 Add navigation to PIN screen on payment button click

  - Navigate to `/utilities/pin` with state
  - Set pendingRequest.type to "MOVIE"
  - Include movieId, movieName, showtime, seats in details
  - Include amount and accountId
  - Set returnPath to `/utilities/movie`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]\* 8.3 Write property test for UtilityMovie navigation

  - **Property 1: PIN Screen Navigation with Complete Details**
  - **Property 22: Direct Payment Removal from UI Components**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**

- [ ] 9. Update UtilityHotel Component

  - Remove direct payment logic
  - Navigate to PIN screen with pendingRequest
  - Set correct returnPath
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 9.1 Remove direct payment service import and calls

  - Remove import of createHotelBooking or similar
  - Remove direct payment function calls
  - _Requirements: 10.6, 10.7_

- [ ] 9.2 Add navigation to PIN screen on payment button click

  - Navigate to `/utilities/pin` with state
  - Set pendingRequest.type to "HOTEL"
  - Include hotelId, hotelName, roomType, checkIn, checkOut, guests in details
  - Include amount and accountId
  - Set returnPath to `/utilities/hotel`
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]\* 9.3 Write property test for UtilityHotel navigation

  - **Property 1: PIN Screen Navigation with Complete Details**
  - **Property 22: Direct Payment Removal from UI Components**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7**

- [ ] 10. Integration Testing and Validation

  - Test complete flow for movie booking
  - Test complete flow for hotel booking
  - Verify error handling
  - Verify result page display
  - _Requirements: All_

- [ ] 10.1 Test movie booking PIN → OTP → Payment flow

  - Select movie, showtime, seats
  - Select payment account
  - Enter PIN (test correct and incorrect)
  - Receive OTP email
  - Enter OTP (test correct, incorrect, expired)
  - Verify balance deduction
  - Verify booking record creation
  - Verify notification sent
  - Verify result page displays correctly

- [ ] 10.2 Test hotel booking PIN → OTP → Payment flow

  - Select hotel, room type, dates, guests
  - Select payment account
  - Enter PIN (test correct and incorrect)
  - Receive OTP email
  - Enter OTP (test correct, incorrect, expired)
  - Verify balance deduction
  - Verify booking record creation
  - Verify notification sent
  - Verify result page displays correctly

- [ ] 10.3 Test error scenarios

  - Test insufficient balance
  - Test locked account
  - Test unverified eKYC
  - Test wrong account ownership
  - Test PIN lockout after 5 failures
  - Test OTP max attempts (3)
  - Test OTP expiration
  - Test transaction not found
  - Test network errors

- [ ]\* 10.4 Write integration property tests

  - **Property 17: User Authentication and Permission Validation**
  - **Property 18: Account Ownership and Status Validation**
  - **Property 19: Consistent Error Message Format**
  - **Property 23: Validation Sequence Consistency**
  - **Property 24: Atomic Transaction Rollback on Failure**
  - **Validates: Requirements 12.1-12.8, 13.1-13.10, 15.1-15.10**

- [ ] 11. Final Checkpoint - Complete flow verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify no TypeScript errors
  - Verify no console errors
  - Verify all requirements are met

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Follow existing patterns from flight booking and utility bill payment
- Use RTDB for all data storage (no Firestore)
- Use atomic transactions for balance deduction
- Hash OTPs for security
- Limit PIN attempts to 5, OTP attempts to 3
- OTP expiration is 5 minutes
- All error messages in Vietnamese
