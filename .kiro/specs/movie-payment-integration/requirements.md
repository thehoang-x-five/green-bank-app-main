# Requirements Document: Movie Booking Payment Integration

## Introduction

This document specifies the requirements for integrating payment functionality into the movie booking utility. The payment logic must follow the same patterns and standards established in the flight booking payment system and utility bill payment system (electric and water bills), ensuring consistency across all payment flows in the application.

## Glossary

- **Movie_Booking_Service**: The service responsible for creating movie bookings with payment processing
- **User_Profile**: The authenticated user's profile containing status, eKYC verification, and transaction permissions
- **Account**: A user's bank account in Realtime Database used for payment transactions
- **Transaction_Record**: A record in Realtime Database documenting a payment transaction
- **Booking_Record**: A record in Realtime Database documenting a movie booking
- **Balance_Change_Notification**: A notification sent to the user's notification feed when account balance changes
- **RTDB**: Firebase Realtime Database

## Requirements

### Requirement 1: User Authentication and Transaction Permissions

**User Story:** As a system, I want to verify user authentication and permissions before processing movie booking payments, so that only authorized users can make transactions.

#### Acceptance Criteria

1. WHEN a user attempts to create a movie booking, THE Movie_Booking_Service SHALL verify the user is authenticated
2. IF the user is not authenticated, THEN THE Movie_Booking_Service SHALL return error "Vui lòng đăng nhập để tiếp tục"
3. WHEN checking user permissions, THE Movie_Booking_Service SHALL retrieve the User_Profile
4. IF the User_Profile cannot be retrieved, THEN THE Movie_Booking_Service SHALL return error "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
5. IF the User_Profile status is "LOCKED", THEN THE Movie_Booking_Service SHALL return error "Tài khoản đăng nhập đang bị khóa, không thể giao dịch"
6. IF the User_Profile ekycStatus is not "VERIFIED", THEN THE Movie_Booking_Service SHALL return error "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
7. IF the User_Profile canTransact is false, THEN THE Movie_Booking_Service SHALL return error "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."

### Requirement 2: Booking Information Validation

**User Story:** As a system, I want to validate movie booking information before processing payment, so that only valid bookings are created.

#### Acceptance Criteria

1. WHEN a user attempts to create a movie booking, THE Movie_Booking_Service SHALL verify at least one seat is selected
2. IF no seats are selected, THEN THE Movie_Booking_Service SHALL return error "Vui lòng chọn ít nhất một ghế"
3. WHEN validating booking data, THE Movie_Booking_Service SHALL verify all required fields are present (cinemaId, cinemaName, movieId, movieTitle, showtimeId, date, time, room)
4. WHEN validating payment account, THE Movie_Booking_Service SHALL verify accountId is provided
5. IF accountId is not provided, THEN THE Movie_Booking_Service SHALL return error "Vui lòng chọn tài khoản thanh toán"
6. WHEN validating totalAmount, THE Movie_Booking_Service SHALL verify it is greater than zero

### Requirement 3: Account Validation and Balance Deduction

**User Story:** As a system, I want to validate the payment account and deduct the booking amount atomically, so that payments are processed correctly and securely.

#### Acceptance Criteria

1. WHEN processing payment with a non-DEMO accountId, THE Movie_Booking_Service SHALL retrieve the Account from RTDB path `accounts/{accountId}`
2. IF the Account does not exist, THEN THE Movie_Booking_Service SHALL return error "Không tìm thấy tài khoản thanh toán"
3. WHEN validating Account ownership, THE Movie_Booking_Service SHALL verify Account.uid matches the authenticated user's uid
4. IF Account.uid does not match, THEN THE Movie_Booking_Service SHALL return error "Bạn không có quyền sử dụng tài khoản này"
5. WHEN deducting balance, THE Movie_Booking_Service SHALL use an atomic transaction on the Account reference
6. IF Account.status is "LOCKED" during transaction, THEN THE Movie_Booking_Service SHALL abort and return error "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
7. IF Account.balance is less than totalAmount, THEN THE Movie_Booking_Service SHALL abort and return error with format "Số dư không đủ. Cần {amount} ₫, hiện có {balance} ₫"
8. WHEN balance is sufficient, THE Movie_Booking_Service SHALL deduct totalAmount from Account.balance
9. WHEN transaction completes successfully, THE Movie_Booking_Service SHALL capture the new balance value for notification

### Requirement 4: Create Transaction Record in RTDB

**User Story:** As a system, I want to create a transaction record in Realtime Database for movie bookings, so that payment history is consistently stored across all utilities.

#### Acceptance Criteria

1. WHEN creating a transaction record, THE Movie_Booking_Service SHALL use RTDB path `movieTransactions/{pushKey}`
2. WHEN generating the transaction ID, THE Movie_Booking_Service SHALL use Firebase push() to generate a unique key
3. WHEN populating transaction data, THE Movie_Booking_Service SHALL include field transactionId with the push key value
4. WHEN populating transaction data, THE Movie_Booking_Service SHALL include field userId with the authenticated user's uid
5. WHEN populating transaction data, THE Movie_Booking_Service SHALL include field accountId with the payment account ID
6. WHEN populating transaction data, THE Movie_Booking_Service SHALL include field type with value "MOVIE_BOOKING"
7. WHEN populating transaction data, THE Movie_Booking_Service SHALL include field amount with the totalAmount value
8. WHEN populating transaction data, THE Movie_Booking_Service SHALL include field status with value "SUCCESS"
9. WHEN populating transaction data, THE Movie_Booking_Service SHALL include field description with format "Đặt vé xem phim: {movieTitle}"
10. WHEN populating transaction data, THE Movie_Booking_Service SHALL include booking details: cinemaName, movieTitle, date, time, selectedSeats
11. WHEN populating transaction data, THE Movie_Booking_Service SHALL include field createdAt with client timestamp (Date.now())
12. WHEN populating transaction data, THE Movie_Booking_Service SHALL include field createdAtServer with serverTimestamp()

### Requirement 5: Create Booking Record in RTDB

**User Story:** As a system, I want to create a booking record in Realtime Database for movie bookings, so that booking data is consistently stored like flight bookings.

#### Acceptance Criteria

1. WHEN creating a booking record, THE Movie_Booking_Service SHALL use RTDB path `movieBookings/{pushKey}`
2. WHEN generating the booking ID, THE Movie_Booking_Service SHALL use Firebase push() to generate a unique key
3. WHEN populating booking data, THE Movie_Booking_Service SHALL include field bookingId with the push key value
4. WHEN populating booking data, THE Movie_Booking_Service SHALL include field userId with the authenticated user's uid
5. WHEN populating booking data, THE Movie_Booking_Service SHALL include all cinema and movie details: cinemaId, cinemaName, movieId, movieTitle
6. WHEN populating booking data, THE Movie_Booking_Service SHALL include showtime details: showtimeId, date, time, room
7. WHEN populating booking data, THE Movie_Booking_Service SHALL include field selectedSeats with the array of seat identifiers
8. WHEN populating booking data, THE Movie_Booking_Service SHALL include field totalAmount with the payment amount
9. WHEN populating booking data, THE Movie_Booking_Service SHALL include field accountId with the payment account ID
10. WHEN populating booking data, THE Movie_Booking_Service SHALL include field status with value "CONFIRMED"
11. WHEN populating booking data, THE Movie_Booking_Service SHALL include field transactionId referencing the transaction record
12. WHEN populating booking data, THE Movie_Booking_Service SHALL include field createdAt with client timestamp (Date.now())
13. WHEN populating booking data, THE Movie_Booking_Service SHALL include field createdAtServer with serverTimestamp()

### Requirement 6: Send Balance Change Notification

**User Story:** As a user, I want to receive a notification when my account balance changes due to movie booking payment, so that I can track my spending.

#### Acceptance Criteria

1. WHEN a movie booking payment is successful, THE Movie_Booking_Service SHALL create a Balance_Change_Notification
2. WHEN creating the notification, THE Movie_Booking_Service SHALL use RTDB path `notifications/{userId}/{pushKey}`
3. WHEN populating notification data, THE Movie_Booking_Service SHALL include field type with value "BALANCE_CHANGE"
4. WHEN populating notification data, THE Movie_Booking_Service SHALL include field direction with value "OUT"
5. WHEN populating notification data, THE Movie_Booking_Service SHALL include field title with value "Đặt vé xem phim"
6. WHEN populating notification data, THE Movie_Booking_Service SHALL include field message with format "{movieTitle} • {cinemaName}"
7. WHEN populating notification data, THE Movie_Booking_Service SHALL include field amount with the totalAmount value
8. WHEN populating notification data, THE Movie_Booking_Service SHALL include field accountNumber with the accountId
9. WHEN populating notification data, THE Movie_Booking_Service SHALL include field balanceAfter with the account balance after deduction
10. WHEN populating notification data, THE Movie_Booking_Service SHALL include field transactionId referencing the transaction record
11. WHEN populating notification data, THE Movie_Booking_Service SHALL include field createdAt with client timestamp (Date.now())
12. IF notification creation fails, THE Movie_Booking_Service SHALL log the error but not fail the entire booking operation

### Requirement 7: Calculate Total Payment Amount

**User Story:** As a system, I want to calculate the total payment amount for movie bookings based on seat selection, so that users are charged correctly.

#### Acceptance Criteria

1. WHEN calculating total amount, THE Movie_Booking_Service SHALL multiply the ticket price by the number of selected seats
2. WHEN validating the calculated amount, THE Movie_Booking_Service SHALL ensure it matches the totalAmount parameter provided
3. WHEN the totalAmount is zero or negative, THE Movie_Booking_Service SHALL reject the booking
4. WHEN displaying amounts in error messages, THE Movie_Booking_Service SHALL format using Vietnamese locale with ₫ symbol

### Requirement 8: Compatibility with Existing Logic

**User Story:** As a developer, I want the movie booking payment to follow the same patterns as flight booking and utility bill payments, so that the codebase is consistent and maintainable.

#### Acceptance Criteria

1. WHEN implementing movie booking payment, THE Movie_Booking_Service SHALL use Realtime Database for all data storage (not Firestore)
2. WHEN implementing movie booking payment, THE Movie_Booking_Service SHALL follow the same error message format as flight booking
3. WHEN implementing movie booking payment, THE Movie_Booking_Service SHALL use the same validation sequence as flight booking (auth → profile → account → balance)
4. WHEN implementing movie booking payment, THE Movie_Booking_Service SHALL use atomic transactions for balance deduction like flight booking
5. WHEN implementing movie booking payment, THE Movie_Booking_Service SHALL create both transaction and booking records like flight booking
6. WHEN implementing movie booking payment, THE Movie_Booking_Service SHALL send balance change notifications like flight booking and utility bills
