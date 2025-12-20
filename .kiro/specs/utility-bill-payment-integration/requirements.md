# Requirements Document: Utility Bill Payment Integration

## Introduction

This document specifies the requirements for refactoring the utility bill payment system (electric and water bills) to follow the same payment patterns and standards established in the flight booking payment system. The current implementation lacks proper validation, account balance deduction, transaction records, and notifications.

## Glossary

- **Utility_Bill_Service**: The service responsible for processing utility bill payments (electric and water)
- **User_Profile**: The authenticated user's profile containing status, eKYC verification, and transaction permissions
- **Account**: A user's bank account in Realtime Database used for payment transactions
- **Transaction_Record**: A record in Realtime Database documenting a payment transaction
- **Bill_Record**: A record in Realtime Database documenting a utility bill and its payment status
- **Balance_Change_Notification**: A notification sent to the user's notification feed when account balance changes
- **RTDB**: Firebase Realtime Database

## Requirements

### Requirement 1: User Authentication and Transaction Permissions

**User Story:** As a system, I want to verify user authentication and permissions before processing utility bill payments, so that only authorized users can make transactions.

#### Acceptance Criteria

1. WHEN a user attempts to pay a utility bill, THE Utility_Bill_Service SHALL verify the user is authenticated
2. IF the user is not authenticated, THEN THE Utility_Bill_Service SHALL return error "Vui lòng đăng nhập để tiếp tục"
3. WHEN checking user permissions, THE Utility_Bill_Service SHALL retrieve the User_Profile
4. IF the User_Profile cannot be retrieved, THEN THE Utility_Bill_Service SHALL return error "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
5. IF the User_Profile status is "LOCKED", THEN THE Utility_Bill_Service SHALL return error "Tài khoản đăng nhập đang bị khóa, không thể giao dịch"
6. IF the User_Profile ekycStatus is not "VERIFIED", THEN THE Utility_Bill_Service SHALL return error "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
7. IF the User_Profile canTransact is false, THEN THE Utility_Bill_Service SHALL return error "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."

### Requirement 2: Bill Validation

**User Story:** As a system, I want to validate utility bill information before processing payment, so that only valid bills are paid.

#### Acceptance Criteria

1. WHEN a user attempts to pay a bill, THE Utility_Bill_Service SHALL verify the bill exists
2. IF the bill does not exist, THEN THE Utility_Bill_Service SHALL return error "Không tìm thấy hóa đơn để thanh toán"
3. WHEN validating bill status, THE Utility_Bill_Service SHALL verify status is "UNPAID"
4. IF the bill status is not "UNPAID", THEN THE Utility_Bill_Service SHALL return error "Hóa đơn không hợp lệ hoặc đã được thanh toán"
5. WHEN validating bill amount, THE Utility_Bill_Service SHALL verify amount is greater than zero
6. IF the bill amount is zero or negative, THEN THE Utility_Bill_Service SHALL return error "Số tiền hóa đơn không hợp lệ"

### Requirement 3: Account Selection and Validation

**User Story:** As a user, I want to select which account to use for bill payment, so that I can pay from my preferred account.

#### Acceptance Criteria

1. WHEN paying a bill, THE Utility_Bill_Service SHALL require an accountId parameter
2. IF accountId is not provided, THEN THE Utility_Bill_Service SHALL return error "Vui lòng chọn tài khoản thanh toán"
3. WHEN processing payment with a non-DEMO accountId, THE Utility_Bill_Service SHALL retrieve the Account from RTDB path `accounts/{accountId}`
4. IF the Account does not exist, THEN THE Utility_Bill_Service SHALL return error "Không tìm thấy tài khoản thanh toán"
5. WHEN validating Account ownership, THE Utility_Bill_Service SHALL verify Account.uid matches the authenticated user's uid
6. IF Account.uid does not match, THEN THE Utility_Bill_Service SHALL return error "Bạn không có quyền sử dụng tài khoản này"

### Requirement 4: Account Balance Deduction

**User Story:** As a system, I want to deduct the bill amount from the user's account balance atomically, so that payments are processed correctly and securely.

#### Acceptance Criteria

1. WHEN deducting balance, THE Utility_Bill_Service SHALL use an atomic transaction on the Account reference
2. IF Account.status is "LOCKED" during transaction, THEN THE Utility_Bill_Service SHALL abort and return error "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
3. IF Account.balance is less than bill amount, THEN THE Utility_Bill_Service SHALL abort and return error with format "Số dư không đủ. Cần {amount} ₫, hiện có {balance} ₫"
4. WHEN balance is sufficient, THE Utility_Bill_Service SHALL deduct bill amount from Account.balance
5. WHEN transaction completes successfully, THE Utility_Bill_Service SHALL capture the new balance value for notification

### Requirement 5: Create Transaction Record in RTDB

**User Story:** As a system, I want to create a transaction record in Realtime Database for utility bill payments, so that payment history is consistently stored across all utilities.

#### Acceptance Criteria

1. WHEN creating a transaction record, THE Utility_Bill_Service SHALL use RTDB path `utilityTransactions/{pushKey}`
2. WHEN generating the transaction ID, THE Utility_Bill_Service SHALL use Firebase push() to generate a unique key
3. WHEN populating transaction data, THE Utility_Bill_Service SHALL include field transactionId with the push key value
4. WHEN populating transaction data, THE Utility_Bill_Service SHALL include field userId with the authenticated user's uid
5. WHEN populating transaction data, THE Utility_Bill_Service SHALL include field accountId with the payment account ID
6. WHEN populating transaction data, THE Utility_Bill_Service SHALL include field type with value "UTILITY_BILL_PAYMENT"
7. WHEN populating transaction data, THE Utility_Bill_Service SHALL include field amount with the bill amount value
8. WHEN populating transaction data, THE Utility_Bill_Service SHALL include field status with value "SUCCESS"
9. WHEN populating transaction data, THE Utility_Bill_Service SHALL include field description with format "Thanh toán hóa đơn {serviceLabel}: {providerName}"
10. WHEN populating transaction data, THE Utility_Bill_Service SHALL include bill details: service, providerId, providerName
11. WHEN populating transaction data, THE Utility_Bill_Service SHALL include field createdAt with client timestamp (Date.now())
12. WHEN populating transaction data, THE Utility_Bill_Service SHALL include field createdAtServer with serverTimestamp()

### Requirement 6: Update Bill Status

**User Story:** As a system, I want to update the bill status to PAID after successful payment, so that users cannot pay the same bill twice.

#### Acceptance Criteria

1. WHEN payment is successful, THE Utility_Bill_Service SHALL update the bill status to "PAID"
2. WHEN updating bill status, THE Utility_Bill_Service SHALL set amount to 0
3. WHEN updating bill status, THE Utility_Bill_Service SHALL include field paidAt with serverTimestamp()
4. WHEN updating bill status, THE Utility_Bill_Service SHALL include field updatedAt with serverTimestamp()
5. WHEN updating bill status, THE Utility_Bill_Service SHALL include field transactionId referencing the transaction record

### Requirement 7: Send Balance Change Notification

**User Story:** As a user, I want to receive a notification when my account balance changes due to bill payment, so that I can track my spending.

#### Acceptance Criteria

1. WHEN a bill payment is successful, THE Utility_Bill_Service SHALL create a Balance_Change_Notification
2. WHEN creating the notification, THE Utility_Bill_Service SHALL use RTDB path `notifications/{userId}/{pushKey}`
3. WHEN populating notification data, THE Utility_Bill_Service SHALL include field type with value "BALANCE_CHANGE"
4. WHEN populating notification data, THE Utility_Bill_Service SHALL include field direction with value "OUT"
5. WHEN populating notification data, THE Utility_Bill_Service SHALL include field title based on service type ("Thanh toán hóa đơn điện" or "Thanh toán hóa đơn nước")
6. WHEN populating notification data, THE Utility_Bill_Service SHALL include field message with provider name
7. WHEN populating notification data, THE Utility_Bill_Service SHALL include field amount with the bill amount value
8. WHEN populating notification data, THE Utility_Bill_Service SHALL include field accountNumber with the accountId
9. WHEN populating notification data, THE Utility_Bill_Service SHALL include field balanceAfter with the account balance after deduction
10. WHEN populating notification data, THE Utility_Bill_Service SHALL include field transactionId referencing the transaction record
11. WHEN populating notification data, THE Utility_Bill_Service SHALL include field createdAt with client timestamp (Date.now())
12. IF notification creation fails, THE Utility_Bill_Service SHALL log the error but not fail the entire payment operation

### Requirement 8: Service Type Labels

**User Story:** As a system, I want to use proper Vietnamese labels for service types, so that users see clear and understandable messages.

#### Acceptance Criteria

1. WHEN service type is "electric", THE Utility_Bill_Service SHALL use label "điện"
2. WHEN service type is "water", THE Utility_Bill_Service SHALL use label "nước"
3. WHEN displaying amounts in error messages, THE Utility_Bill_Service SHALL format using Vietnamese locale with ₫ symbol

### Requirement 9: Compatibility with Existing Logic

**User Story:** As a developer, I want the utility bill payment to follow the same patterns as flight booking, so that the codebase is consistent and maintainable.

#### Acceptance Criteria

1. WHEN implementing utility bill payment, THE Utility_Bill_Service SHALL use Realtime Database for all data storage
2. WHEN implementing utility bill payment, THE Utility_Bill_Service SHALL follow the same error message format as flight booking
3. WHEN implementing utility bill payment, THE Utility_Bill_Service SHALL use the same validation sequence as flight booking (auth → profile → account → balance)
4. WHEN implementing utility bill payment, THE Utility_Bill_Service SHALL use atomic transactions for balance deduction like flight booking
5. WHEN implementing utility bill payment, THE Utility_Bill_Service SHALL create transaction records like flight booking
6. WHEN implementing utility bill payment, THE Utility_Bill_Service SHALL send balance change notifications like flight booking
