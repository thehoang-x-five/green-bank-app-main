# Implementation Plan: Utility Bill Payment Integration

## Overview

This implementation plan refactors the utility bill payment system (electric and water bills) to follow the same payment patterns established in the flight booking payment system. The implementation will add proper validation, account balance deduction, transaction records, and notifications.

## Tasks

- [x] 1. Update function signature and add imports

  - Add accountId parameter to PayUtilityBillParams interface
  - Import getCurrentUserProfile from userService
  - Ensure all RTDB imports are present
  - _Requirements: 3.1, 9.1_

- [x] 2. Add authentication and user profile validation

  - [x] 2.1 Add authentication check at function start

    - Check if user is authenticated
    - Throw error "Vui lòng đăng nhập để tiếp tục" if not authenticated
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Add user profile validation

    - Call getCurrentUserProfile() to get user profile
    - Throw error "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại." if profile not found
    - Check profile.status !== "LOCKED", throw error "Tài khoản đăng nhập đang bị khóa, không thể giao dịch" if locked
    - Check profile.ekycStatus === "VERIFIED", throw error "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực." if not verified
    - Check profile.canTransact === true, throw error "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng." if cannot transact
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]\* 2.3 Write property tests for authentication and profile validation
    - **Property 1: Authentication Required**
    - **Property 2: User Profile Validation**
    - **Validates: Requirements 1.1-1.7**

- [x] 3. Add bill validation before payment

  - [x] 3.1 Fetch bill and validate existence

    - Fetch bill from RTDB using existing fetchUserUtilityBill()
    - Throw error "Không tìm thấy hóa đơn để thanh toán" if bill not found
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Validate bill status and amount

    - Check bill.status === "UNPAID", throw error "Hóa đơn không hợp lệ hoặc đã được thanh toán" if not UNPAID
    - Check bill.amount > 0, throw error "Số tiền hóa đơn không hợp lệ" if amount <= 0
    - Store bill amount for later use
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [ ]\* 3.3 Write property tests for bill validation
    - **Property 3: Bill Existence Required**
    - **Property 4: Bill Status Validation**
    - **Property 5: Bill Amount Validation**
    - **Validates: Requirements 2.1-2.6**

- [x] 4. Add account validation and balance deduction

  - [x] 4.1 Validate account selection

    - Check accountId is provided, throw error "Vui lòng chọn tài khoản thanh toán" if not provided
    - _Requirements: 3.1, 3.2_

  - [x] 4.2 Validate account existence and ownership

    - Skip validation if accountId === "DEMO"
    - Get account from RTDB path `accounts/{accountId}`
    - Throw error "Không tìm thấy tài khoản thanh toán" if account not found
    - Check account.uid === user.uid, throw error "Bạn không có quyền sử dụng tài khoản này" if ownership mismatch
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

  - [x] 4.3 Implement atomic balance deduction

    - Use runTransaction() on account reference
    - Check account.status !== "LOCKED" in transaction, throw error "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng." if locked
    - Check account.balance >= billAmount, throw error with format "Số dư không đủ. Cần {amount} ₫, hiện có {balance} ₫" if insufficient
    - Deduct billAmount from account.balance
    - Capture balanceAfter for notification
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]\* 4.4 Write property tests for account validation and balance deduction
    - **Property 6: Account Selection Required**
    - **Property 7: Account Existence Required**
    - **Property 8: Account Ownership Verification**
    - **Property 9: Sufficient Balance Required**
    - **Property 10: Atomic Balance Deduction**
    - **Validates: Requirements 3.1-3.6, 4.1-4.5**

- [x] 5. Create transaction record in RTDB

  - [x] 5.1 Generate transaction ID and create record

    - Use push(ref(firebaseRtdb, 'utilityTransactions')) to generate transaction ID
    - Create service label map: electric → "điện", water → "nước"
    - Set transaction record with all required fields:
      - transactionId (push key)
      - userId
      - accountId
      - type: "UTILITY_BILL_PAYMENT"
      - amount (bill amount)
      - description: "Thanh toán hóa đơn {serviceLabel}: {providerName}"
      - status: "SUCCESS"
      - service, providerId, providerName
      - createdAt (Date.now())
      - createdAtServer (serverTimestamp())
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 8.1, 8.2_

  - [ ]\* 5.2 Write property test for transaction record creation
    - **Property 11: Transaction Record Creation**
    - **Property 14: Service Type Labels**
    - **Validates: Requirements 5.1-5.12, 8.1-8.2**

- [x] 6. Update bill status to PAID

  - [x] 6.1 Update bill with transaction reference

    - Use runTransaction() on bill reference
    - Set status to "PAID"
    - Set amount to 0
    - Add transactionId field
    - Set paidAt to serverTimestamp()
    - Set updatedAt to serverTimestamp()
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]\* 6.2 Write property test for bill status update
    - **Property 12: Bill Status Update**
    - **Validates: Requirements 6.1-6.5**

- [x] 7. Send balance change notification

  - [x] 7.1 Create notification in RTDB

    - Use push(ref(firebaseRtdb, `notifications/${userId}`))
    - Set notification title based on service: "Thanh toán hóa đơn điện" or "Thanh toán hóa đơn nước"
    - Set notification with all required fields:
      - type: "BALANCE_CHANGE"
      - direction: "OUT"
      - title (based on service)
      - message (provider name)
      - amount (bill amount)
      - accountNumber (accountId)
      - balanceAfter
      - transactionId
      - createdAt (Date.now())
    - Wrap in try-catch, log error but don't fail payment if notification fails
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_

  - [ ]\* 7.2 Write property test for notification creation
    - **Property 13: Balance Change Notification**
    - **Validates: Requirements 7.1-7.12**

- [x] 8. Update return value and remove old payment log

  - Remove old utilityBillPaymentsByUser log creation
  - Change return type from {ok, error} to {transactionId, billAmount}
  - Return transactionId and billAmount on success
  - _Requirements: 9.5, 9.6_

- [x] 9. Checkpoint - Ensure all tests pass

  - Run all unit tests and property tests
  - Verify no regressions in existing functionality
  - Ask the user if questions arise

- [x] 10. Update calling code to provide accountId

  - Find all places that call payUserUtilityBill()
  - Update to include accountId parameter
  - Update to handle new return type {transactionId, billAmount}
  - _Requirements: 9.1_

- [ ]\* 11. Write integration tests for complete payment flow

  - Test complete flow from validation to notification
  - Test atomic balance deduction
  - Test RTDB record creation
  - Test notification creation
  - Test error scenarios
  - _Requirements: 9.3, 9.4, 9.5, 9.6_

- [x] 12. Final checkpoint - Verify complete integration
  - Test end-to-end bill payment flow for electric bills
  - Test end-to-end bill payment flow for water bills
  - Verify transaction records in RTDB
  - Verify bill status updates correctly
  - Verify notifications appear correctly
  - Ensure all tests pass
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- The implementation follows the same pattern as flight booking for consistency
- All data storage uses RTDB to match flight booking pattern
- Function signature changes require updating all calling code
