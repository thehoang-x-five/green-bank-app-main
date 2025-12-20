# Implementation Plan: Mobile Phone Payment Integration

## Overview

This implementation plan creates a complete payment integration for mobile phone services (Phone Topup, Data Pack Purchase, and Data 4G/Topup Combined). The implementation follows the established pattern from `utilityBillService.ts` and integrates seamlessly with existing UI components.

## Tasks

- [x] 1. Create mobile phone payment service

  - Create `src/services/mobilePhonePaymentService.ts`
  - Implement helper functions for validation
  - Implement `payPhoneTopup()` function
  - Implement `payDataPack()` function
  - _Requirements: 1.1-1.13, 2.1-2.13, 4.1-4.8, 5.1-5.8, 6.1-6.5, 7.1-7.12_

- [ ]\* 1.1 Write property test for authentication validation

  - **Property 1: Authentication Required**
  - **Validates: Requirements 1.2, 2.2**

- [ ]\* 1.2 Write property test for user validation

  - **Property 2: User Validation**
  - **Validates: Requirements 1.3, 1.4, 1.5, 2.3, 2.4, 2.5**

- [ ]\* 1.3 Write property test for phone number format

  - **Property 3: Phone Number Format**
  - **Validates: Requirements 1.1, 2.1, 3.3, 3.4**

- [ ]\* 1.4 Write property test for account ownership

  - **Property 4: Account Ownership**
  - **Validates: Requirements 1.6, 2.6**

- [ ]\* 1.5 Write property test for account status check

  - **Property 5: Account Status Check**
  - **Validates: Requirements 1.7, 2.7**

- [ ]\* 1.6 Write property test for sufficient balance

  - **Property 6: Sufficient Balance**
  - **Validates: Requirements 1.8, 2.8**

- [ ]\* 1.7 Write property test for balance deduction atomicity

  - **Property 7: Balance Deduction Atomicity**
  - **Validates: Requirements 1.9, 2.9**

- [ ]\* 1.8 Write property test for transaction record creation

  - **Property 8: Transaction Record Creation**
  - **Validates: Requirements 1.10, 1.11, 2.10, 2.11, 4.1, 4.2, 4.3, 4.4, 4.5**

- [ ]\* 1.9 Write property test for notification delivery

  - **Property 9: Notification Delivery**
  - **Validates: Requirements 1.12, 2.12, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

- [ ]\* 1.10 Write property test for error handling without side effects

  - **Property 10: Error Handling Without Side Effects**
  - **Validates: Requirements 1.13, 2.13**

- [ ]\* 1.11 Write property test for amount validation

  - **Property 11: Amount Validation**
  - **Validates: Requirements 6.3**

- [ ]\* 1.12 Write property test for transaction rollback on failure

  - **Property 12: Transaction Rollback on Failure**
  - **Validates: Requirements 4.6**

- [ ]\* 1.13 Write property test for notification failure isolation

  - **Property 13: Notification Failure Isolation**
  - **Validates: Requirements 5.8**

- [ ]\* 1.14 Write property test for Data 4G tab routing

  - **Property 14: Data 4G Tab Routing**
  - **Validates: Requirements 3.3**

- [ ]\* 1.15 Write property test for phone topup tab routing

  - **Property 15: Phone Topup Tab Routing**
  - **Validates: Requirements 3.4**

- [ ]\* 1.16 Write unit tests for validation functions

  - Test phone number validation with valid and invalid formats
  - Test telco detection for all providers
  - Test amount validation edge cases
  - _Requirements: 1.1, 2.1, 6.3_

- [ ]\* 1.17 Write unit tests for error messages

  - Test each error condition returns correct Vietnamese message
  - Test error message formatting
  - _Requirements: 7.1-7.12_

- [ ] 2. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Integrate payment service with UtilityPhoneTopup component

  - Add payment confirmation modal to UtilityPhoneTopup
  - Add account selection UI
  - Implement payment handler calling payPhoneTopup service
  - Handle success navigation to result page
  - Handle error display with toast notifications
  - _Requirements: 1.1-1.13, 8.1-8.7_

- [ ]\* 3.1 Write integration tests for phone topup payment flow

  - Test complete payment flow from UI to service
  - Test error handling in UI
  - _Requirements: 1.1-1.13, 8.5_

- [x] 4. Integrate payment service with UtilityDataPack component for Mua 3G/4G

  - Add payment confirmation modal for Mua 3G/4G flow
  - Add account selection UI
  - Implement payment handler calling payDataPack service
  - Handle success navigation to result page
  - Handle error display with toast notifications
  - _Requirements: 2.1-2.13, 8.1-8.7_

- [ ]\* 4.1 Write integration tests for data pack payment flow

  - Test complete payment flow from UI to service
  - Test error handling in UI
  - _Requirements: 2.1-2.13, 8.6_

- [x] 5. Integrate payment service with UtilityDataPack component for Data 4G/Nạp tiền

  - Add payment confirmation modal for "Nạp data" tab
  - Add payment confirmation modal for "Nạp điện thoại" tab
  - Add account selection UI for both tabs
  - Implement payment handlers for both tabs
  - Ensure dataPhone field is used for "Nạp data" tab
  - Ensure phoneNumber field is used for "Nạp điện thoại" tab
  - Handle success navigation to result page
  - Handle error display with toast notifications
  - _Requirements: 3.1-3.5, 8.1-8.7_

- [ ]\* 5.1 Write integration tests for Data 4G combined payment flow

  - Test "Nạp data" tab payment flow
  - Test "Nạp điện thoại" tab payment flow
  - Test tab-specific field usage
  - _Requirements: 3.1-3.5, 8.6_

- [ ] 6. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Update result page to handle mobile phone payment results

  - Ensure result page displays phone topup transaction details
  - Ensure result page displays data pack transaction details
  - Format amounts in Vietnamese currency format
  - Display telco information
  - _Requirements: 6.4, 6.5, 8.4_

- [ ]\* 7.1 Write unit tests for result page formatting

  - Test phone topup result display
  - Test data pack result display
  - Test currency formatting
  - _Requirements: 6.4, 6.5_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- All payment flows follow the established pattern from utilityBillService.ts
- Firebase transactions ensure atomicity of balance changes
- Notification failures do not fail payments
- All error messages are in Vietnamese
