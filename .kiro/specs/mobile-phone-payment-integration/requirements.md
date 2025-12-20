# Requirements Document: Mobile Phone Payment Integration

## Introduction

This feature implements complete payment integration for three mobile phone utility services: Phone Topup (Nạp tiền), Data Pack Purchase (Mua 3G/4G), and Data 4G/Phone Topup (Data 4G/Nạp tiền). The system must handle authentication, account validation, balance deduction, transaction recording, and notifications following the same pattern as the existing utility bill payment system.

## Glossary

- **System**: The mobile phone payment integration system
- **User**: An authenticated customer using the mobile banking application
- **Phone_Topup**: Service for adding prepaid credit to mobile phone numbers
- **Data_Pack**: Service for purchasing mobile data packages (3G/4G)
- **Data4G_Topup**: Combined service offering both data packages and phone credit topup
- **Payment_Account**: User's bank account used as payment source
- **Transaction**: A payment record stored in the database
- **Notification**: Balance change alert sent to user
- **Telco**: Telecommunications provider (Viettel, Vinaphone, Mobifone)
- **RTDB**: Firebase Realtime Database

## Requirements

### Requirement 1: Phone Topup Payment

**User Story:** As a user, I want to pay for phone topup using my bank account, so that I can add credit to mobile phone numbers.

#### Acceptance Criteria

1. WHEN a user selects a topup amount and submits payment, THE System SHALL validate the phone number format
2. WHEN a user submits payment, THE System SHALL verify the user is authenticated
3. WHEN a user submits payment, THE System SHALL validate the user's eKYC status is VERIFIED
4. WHEN a user submits payment, THE System SHALL validate the user's account status is not LOCKED
5. WHEN a user submits payment, THE System SHALL validate the user has transaction permission
6. WHEN a user submits payment, THE System SHALL validate the selected payment account exists and belongs to the user
7. WHEN a user submits payment, THE System SHALL validate the payment account status is not LOCKED
8. WHEN a user submits payment, THE System SHALL validate the account balance is sufficient for the topup amount
9. WHEN payment validation passes, THE System SHALL deduct the topup amount from the payment account balance
10. WHEN balance is deducted, THE System SHALL create a transaction record in RTDB with type PHONE_TOPUP
11. WHEN transaction is created, THE System SHALL include userId, accountId, amount, phone number, telco, and timestamp
12. WHEN transaction is recorded, THE System SHALL send a balance change notification to the user
13. WHEN any validation fails, THE System SHALL return a descriptive error message without modifying data

### Requirement 2: Data Pack Purchase Payment

**User Story:** As a user, I want to pay for mobile data packages using my bank account, so that I can purchase 3G/4G data for mobile phones.

#### Acceptance Criteria

1. WHEN a user selects a data pack and submits payment, THE System SHALL validate the phone number format
2. WHEN a user submits payment, THE System SHALL verify the user is authenticated
3. WHEN a user submits payment, THE System SHALL validate the user's eKYC status is VERIFIED
4. WHEN a user submits payment, THE System SHALL validate the user's account status is not LOCKED
5. WHEN a user submits payment, THE System SHALL validate the user has transaction permission
6. WHEN a user submits payment, THE System SHALL validate the selected payment account exists and belongs to the user
7. WHEN a user submits payment, THE System SHALL validate the payment account status is not LOCKED
8. WHEN a user submits payment, THE System SHALL validate the account balance is sufficient for the data pack price
9. WHEN payment validation passes, THE System SHALL deduct the data pack price from the payment account balance
10. WHEN balance is deducted, THE System SHALL create a transaction record in RTDB with type DATA_PACK_PURCHASE
11. WHEN transaction is created, THE System SHALL include userId, accountId, amount, phone number, telco, pack details, and timestamp
12. WHEN transaction is recorded, THE System SHALL send a balance change notification to the user
13. WHEN any validation fails, THE System SHALL return a descriptive error message without modifying data

### Requirement 3: Data 4G/Topup Combined Payment

**User Story:** As a user, I want to pay for either data packages or phone topup through the Data 4G/Nạp tiền interface, so that I can access both services from one location.

#### Acceptance Criteria

1. WHEN a user selects "Nạp data" tab and purchases a data pack, THE System SHALL process payment following Requirement 2 acceptance criteria
2. WHEN a user selects "Nạp điện thoại" tab and purchases phone topup, THE System SHALL process payment following Requirement 1 acceptance criteria
3. WHEN processing Data 4G tab payment, THE System SHALL use the dataPhone field for phone number validation
4. WHEN processing Nạp điện thoại tab payment, THE System SHALL use the phoneNumber field for phone number validation
5. THE System SHALL maintain separate form state for each tab (dataPhone vs phoneNumber)

### Requirement 4: Transaction Recording

**User Story:** As a system administrator, I want all mobile phone payments recorded in the database, so that we can track payment history and provide audit trails.

#### Acceptance Criteria

1. WHEN a phone topup payment succeeds, THE System SHALL create a record in utilityTransactions with type PHONE_TOPUP
2. WHEN a data pack payment succeeds, THE System SHALL create a record in utilityTransactions with type DATA_PACK_PURCHASE
3. WHEN creating a transaction record, THE System SHALL include transactionId, userId, accountId, type, amount, description, status, createdAt, and createdAtServer
4. WHEN creating a phone topup transaction, THE System SHALL include phoneNumber, telco, and topupAmount in the record
5. WHEN creating a data pack transaction, THE System SHALL include phoneNumber, telco, packId, packName, and packPrice in the record
6. WHEN transaction creation fails, THE System SHALL rollback any balance changes
7. THE System SHALL use Firebase serverTimestamp for createdAtServer field
8. THE System SHALL use Date.now() for createdAt field

### Requirement 5: Balance Change Notifications

**User Story:** As a user, I want to receive notifications when my account balance changes, so that I can track my spending.

#### Acceptance Criteria

1. WHEN a mobile phone payment succeeds, THE System SHALL create a notification record in notifications/{userId}
2. WHEN creating a notification, THE System SHALL include type BALANCE_CHANGE
3. WHEN creating a notification, THE System SHALL include direction OUT
4. WHEN creating a phone topup notification, THE System SHALL set title to "Nạp tiền điện thoại"
5. WHEN creating a data pack notification, THE System SHALL set title to "Mua gói data"
6. WHEN creating a notification, THE System SHALL include message with phone number and telco
7. WHEN creating a notification, THE System SHALL include amount, accountNumber, balanceAfter, transactionId, and createdAt
8. IF notification creation fails, THE System SHALL log the error but not fail the payment transaction

### Requirement 6: Payment Amount Calculation

**User Story:** As a user, I want the system to calculate the correct payment amount, so that I am charged accurately.

#### Acceptance Criteria

1. WHEN processing phone topup payment, THE System SHALL use the topupAmount field as the payment amount
2. WHEN processing data pack payment, THE System SHALL use the selected pack's price as the payment amount
3. THE System SHALL validate payment amount is greater than zero
4. THE System SHALL format amounts in VND currency
5. THE System SHALL display amounts with thousand separators in Vietnamese format

### Requirement 7: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when payment fails, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. IF user is not authenticated, THEN THE System SHALL return error "Vui lòng đăng nhập để tiếp tục"
2. IF user profile is not found, THEN THE System SHALL return error "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
3. IF user account status is LOCKED, THEN THE System SHALL return error "Tài khoản đăng nhập đang bị khóa, không thể giao dịch"
4. IF user eKYC status is not VERIFIED, THEN THE System SHALL return error "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
5. IF user cannot transact, THEN THE System SHALL return error "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."
6. IF payment account is not found, THEN THE System SHALL return error "Không tìm thấy tài khoản thanh toán"
7. IF payment account does not belong to user, THEN THE System SHALL return error "Bạn không có quyền sử dụng tài khoản này"
8. IF payment account status is LOCKED, THEN THE System SHALL return error "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
9. IF account balance is insufficient, THEN THE System SHALL return error with required and available amounts
10. IF phone number is invalid, THEN THE System SHALL return error "Vui lòng nhập số điện thoại hợp lệ"
11. IF payment amount is invalid, THEN THE System SHALL return error "Số tiền thanh toán không hợp lệ"
12. IF transaction fails, THEN THE System SHALL return error "Giao dịch thất bại"

### Requirement 8: Integration with Existing UI

**User Story:** As a developer, I want the payment service to integrate seamlessly with existing UI components, so that the user experience is consistent.

#### Acceptance Criteria

1. THE System SHALL provide a service function for phone topup payment
2. THE System SHALL provide a service function for data pack payment
3. THE System SHALL accept parameters matching the existing form data structure
4. WHEN payment succeeds, THE System SHALL return transactionId and amount
5. THE System SHALL be compatible with the existing UtilityPhoneTopup component
6. THE System SHALL be compatible with the existing UtilityDataPack component
7. THE System SHALL be compatible with the existing UtilityBills page routing logic
