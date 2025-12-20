# Implementation Plan: Movie Booking Payment Integration

## Overview

This implementation plan refactors the movie booking payment system from Firestore to Firebase Realtime Database (RTDB), following the same patterns established in the flight booking payment system. The implementation will be done incrementally, with testing at each step to ensure correctness.

## Tasks

- [ ] 1. Update imports and remove Firestore dependencies

  - Remove Firestore imports (fbDb, collection, addDoc, serverTimestamp from firestore)
  - Ensure RTDB imports are present (fbRtdb, ref, get, runTransaction, push, set, serverTimestamp from database)
  - Update import aliases to match flight booking service (fbAuth, fbRtdb)
  - _Requirements: 8.1_

- [ ] 2. Refactor transaction record creation to use RTDB

  - [ ] 2.1 Replace Firestore transaction creation with RTDB push()

    - Use `push(ref(fbRtdb, 'movieTransactions'))` to generate transaction ID
    - Store transactionId as the push key
    - Include all required fields: transactionId, userId, accountId, type="MOVIE_BOOKING", amount, description, status="SUCCESS"
    - Include booking details: cinemaName, movieTitle, date, time, selectedSeats
    - Include timestamps: createdAt (Date.now()), createdAtServer (rtdbServerTimestamp())
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [ ]\* 2.2 Write property test for transaction record creation
    - **Property 8: Transaction Record Creation**
    - **Validates: Requirements 4.1-4.12**
    - Generate random valid booking parameters
    - Verify transaction record is created in RTDB at correct path
    - Verify all required fields are present and correct
    - Verify transactionId matches push key
    - Verify type is "MOVIE_BOOKING" and status is "SUCCESS"

- [ ] 3. Refactor booking record creation to use RTDB

  - [ ] 3.1 Replace Firestore booking creation with RTDB push()

    - Use `push(ref(fbRtdb, 'movieBookings'))` to generate booking ID
    - Store bookingId as the push key
    - Include all required fields: bookingId, userId, cinemaId, cinemaName, movieId, movieTitle
    - Include showtime details: showtimeId, date, time, room
    - Include selectedSeats array, totalAmount, accountId
    - Include status="CONFIRMED" and transactionId reference
    - Include timestamps: createdAt (Date.now()), createdAtServer (rtdbServerTimestamp())
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13_

  - [ ]\* 3.2 Write property test for booking record creation
    - **Property 9: Booking Record Creation**
    - **Validates: Requirements 5.1-5.13**
    - Generate random valid booking parameters
    - Verify booking record is created in RTDB at correct path
    - Verify all required fields are present and correct
    - Verify bookingId matches push key
    - Verify status is "CONFIRMED"
    - Verify transactionId reference is correct

- [x] 4. Update notification to use correct timestamp

  - Ensure notification uses Date.now() for createdAt (not serverTimestamp)
  - Verify notification structure matches flight booking pattern
  - _Requirements: 6.11_

- [ ]\* 5. Write integration tests for complete booking flow

  - Test complete flow from validation to notification
  - Test atomic balance deduction
  - Test RTDB record creation
  - Test notification creation
  - Test error scenarios
  - _Requirements: 8.3, 8.4, 8.5, 8.6_

- [ ]\* 6. Write property tests for validation logic

  - [ ]\* 6.1 Write property test for authentication validation

    - **Property 1: Authentication Required**
    - **Validates: Requirements 1.1, 1.2**
    - Generate booking attempts with/without authentication
    - Verify unauthenticated attempts fail with correct error

  - [ ]\* 6.2 Write property test for seat selection validation

    - **Property 2: Seat Selection Required**
    - **Validates: Requirements 2.1, 2.2**
    - Generate booking attempts with empty and non-empty seat arrays
    - Verify empty seat selection fails with correct error

  - [ ]\* 6.3 Write property test for account selection validation

    - **Property 3: Account Selection Required**
    - **Validates: Requirements 2.4, 2.5**
    - Generate booking attempts with/without accountId
    - Verify missing accountId fails with correct error

  - [ ]\* 6.4 Write property test for user profile validation

    - **Property 4: User Profile Validation**
    - **Validates: Requirements 1.5, 1.6, 1.7**
    - Generate users with different profile states (LOCKED, eKYC not verified, canTransact false)
    - Verify each invalid state fails with correct error message

  - [ ]\* 6.5 Write property test for account ownership

    - **Property 5: Account Ownership Verification**
    - **Validates: Requirements 3.3, 3.4**
    - Generate booking attempts with accounts owned by different users
    - Verify ownership mismatch fails with correct error

  - [ ]\* 6.6 Write property test for balance validation

    - **Property 6: Sufficient Balance Required**
    - **Validates: Requirements 3.7**
    - Generate booking attempts with various balance/amount combinations
    - Verify insufficient balance fails with correct error format

  - [ ]\* 6.7 Write property test for atomic balance deduction

    - **Property 7: Atomic Balance Deduction**
    - **Validates: Requirements 3.5, 3.8**
    - Generate random valid bookings
    - Verify balance is decreased by exactly totalAmount
    - Verify transaction is atomic (no partial updates)

  - [ ]\* 6.8 Write property test for notification creation

    - **Property 10: Balance Change Notification**
    - **Validates: Requirements 6.1-6.11**
    - Generate random valid bookings
    - Verify notification is created with all required fields
    - Verify notification format matches specification

  - [ ]\* 6.9 Write property test for transaction-booking consistency

    - **Property 11: Transaction and Booking ID Consistency**
    - **Validates: Requirements 5.11**
    - Generate random valid bookings
    - Verify booking's transactionId references actual transaction record

  - [ ]\* 6.10 Write property test for RTDB-only storage
    - **Property 12: RTDB-Only Storage**
    - **Validates: Requirements 8.1**
    - Generate random valid bookings
    - Verify no Firestore writes occur
    - Verify all data is in RTDB

- [ ] 7. Checkpoint - Ensure all tests pass

  - Run all unit tests and property tests
  - Verify no regressions in existing functionality
  - Ask the user if questions arise

- [ ] 8. Update Firebase Realtime Database security rules (if needed)

  - Review and update rules for movieTransactions path
  - Review and update rules for movieBookings path
  - Ensure only authenticated users can write
  - Ensure users can only read their own records
  - _Requirements: 8.1_

- [ ] 9. Final checkpoint - Verify complete integration
  - Test end-to-end movie booking flow
  - Verify transaction records in RTDB
  - Verify booking records in RTDB
  - Verify notifications appear correctly
  - Ensure all tests pass
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- The implementation follows the same pattern as flight booking for consistency
- All data storage uses RTDB (not Firestore) to match flight booking and utility bill patterns
