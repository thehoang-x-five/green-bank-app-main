# Design Document: Utility Bill Payment Integration

## Overview

This design document specifies how to refactor the utility bill payment system (electric and water bills) to follow the same payment patterns established in the flight booking payment system. The current implementation (`payUserUtilityBill`) lacks proper validation, account balance deduction, transaction records, and notifications.

The goal is to ensure consistency across all payment flows in the application by implementing the same validation logic, error handling, and data storage patterns used in flight bookings.

## Architecture

### Current Architecture (Incomplete)

```
User → payUserUtilityBill()
  ├─ Check authentication (basic)
  ├─ Update bill status to PAID (atomic transaction)
  ├─ Create payment log (minimal)
  └─ Return success/error
```

**Missing:**

- User profile validation (eKYC, status, canTransact)
- Account selection and validation
- Account balance deduction
- Transaction record creation
- Balance change notification

### Target Architecture (Complete - Following Flight Booking Pattern)

```
User → payUserUtilityBill()
  ├─ Validate authentication
  ├─ Validate user profile (status, eKYC, canTransact)
  ├─ Validate bill (exists, UNPAID, amount > 0)
  ├─ Validate account (exists, ownership)
  ├─ Deduct balance from RTDB accounts/{accountId} (atomic)
  ├─ Create transaction in RTDB: utilityTransactions/{pushKey}
  ├─ Update bill status to PAID with transactionId reference
  └─ Send notification to RTDB: notifications/{userId}/{pushKey}
```

### Key Changes

1. **Add account parameter** - User must select which account to pay from
2. **Add user profile validation** - Check status, eKYC, canTransact (like flight booking)
3. **Add account validation** - Check account exists and ownership
4. **Add balance deduction** - Atomic transaction to deduct from account balance
5. **Add transaction record** - Store in `utilityTransactions/{pushKey}`
6. **Add transactionId to bill** - Link bill to transaction record
7. **Add balance change notification** - Notify user of balance change

## Components and Interfaces

### Modified Service: `utilityBillService.ts`

#### Function: `payUserUtilityBill()` (Refactored)

**Input Parameters:**

```typescript
interface PayUtilityBillParams {
  service: UtilityBillServiceType; // "electric" | "water"
  providerId: string;
  accountId: string; // NEW: Required account selection
}
```

**Return Type:**

```typescript
Promise<{
  transactionId: string;
  billAmount: number;
}>;
```

**Implementation Flow:**

1. Validate authentication
2. Get user profile and check permissions (status, eKYC, canTransact)
3. Fetch and validate bill (exists, UNPAID, amount > 0)
4. Validate account selection
5. Validate account (exists, ownership)
6. Deduct account balance (atomic transaction)
7. Create transaction record in RTDB
8. Update bill status to PAID with transactionId
9. Send balance change notification
10. Return transaction ID and bill amount

## Data Models

### Transaction Record (RTDB: `utilityTransactions/{pushKey}`)

```typescript
{
  transactionId: string; // Same as push key
  userId: string; // User UID
  accountId: string; // Payment account ID
  type: "UTILITY_BILL_PAYMENT"; // Transaction type
  amount: number; // Bill amount paid
  description: string; // "Thanh toán hóa đơn {serviceLabel}: {providerName}"
  status: "SUCCESS"; // Transaction status
  service: string; // "electric" | "water"
  providerId: string; // Provider ID
  providerName: string; // Provider name
  createdAt: number; // Client timestamp
  createdAtServer: ServerValue; // Server timestamp
}
```

### Updated Bill Record (RTDB: `utilityBillsByUser/{uid}/{service}/{providerId}`)

```typescript
{
  providerId: string;
  providerName: string;
  amount: number; // 0 after payment
  status: "PAID"; // Updated from "UNPAID"
  transactionId: string; // NEW: Reference to transaction
  paidAt: ServerValue; // Payment timestamp
  updatedAt: ServerValue; // Update timestamp
}
```

### Balance Change Notification (RTDB: `notifications/{userId}/{pushKey}`)

```typescript
{
  type: "BALANCE_CHANGE";
  direction: "OUT";
  title: string; // "Thanh toán hóa đơn điện" or "Thanh toán hóa đơn nước"
  message: string; // Provider name
  amount: number; // Bill amount
  accountNumber: string; // Account ID
  balanceAfter: number; // Balance after deduction
  transactionId: string; // Reference to transaction
  createdAt: number; // Client timestamp
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Authentication Required

_For any_ utility bill payment attempt, the user must be authenticated, otherwise the operation should fail with error "Vui lòng đăng nhập để tiếp tục"

**Validates: Requirements 1.1, 1.2**

### Property 2: User Profile Validation

_For any_ authenticated user attempting a bill payment, if their profile status is "LOCKED", ekycStatus is not "VERIFIED", or canTransact is false, the operation should fail with the appropriate error message

**Validates: Requirements 1.5, 1.6, 1.7**

### Property 3: Bill Existence Required

_For any_ bill payment attempt, the bill must exist in RTDB, otherwise the operation should fail with error "Không tìm thấy hóa đơn để thanh toán"

**Validates: Requirements 2.1, 2.2**

### Property 4: Bill Status Validation

_For any_ bill payment attempt, the bill status must be "UNPAID", otherwise the operation should fail with error "Hóa đơn không hợp lệ hoặc đã được thanh toán"

**Validates: Requirements 2.3, 2.4**

### Property 5: Bill Amount Validation

_For any_ bill payment attempt, the bill amount must be greater than zero, otherwise the operation should fail with error "Số tiền hóa đơn không hợp lệ"

**Validates: Requirements 2.5, 2.6**

### Property 6: Account Selection Required

_For any_ bill payment attempt, an accountId must be provided, otherwise the operation should fail with error "Vui lòng chọn tài khoản thanh toán"

**Validates: Requirements 3.1, 3.2**

### Property 7: Account Existence Required

_For any_ bill payment with a non-DEMO account, the account must exist in RTDB, otherwise the operation should fail with error "Không tìm thấy tài khoản thanh toán"

**Validates: Requirements 3.3, 3.4**

### Property 8: Account Ownership Verification

_For any_ bill payment with a non-DEMO account, the account's uid must match the authenticated user's uid, otherwise the operation should fail with error "Bạn không có quyền sử dụng tài khoản này"

**Validates: Requirements 3.5, 3.6**

### Property 9: Sufficient Balance Required

_For any_ bill payment, if the account balance is less than the bill amount, the operation should fail with error message showing required and available amounts

**Validates: Requirements 4.3**

### Property 10: Atomic Balance Deduction

_For any_ successful bill payment, the account balance should be decreased by exactly the bill amount in an atomic transaction

**Validates: Requirements 4.1, 4.4**

### Property 11: Transaction Record Creation

_For any_ successful bill payment, a transaction record must be created in RTDB at path `utilityTransactions/{pushKey}` with all required fields including transactionId, userId, accountId, type="UTILITY_BILL_PAYMENT", amount, status="SUCCESS", service, providerId, providerName, and timestamps

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12**

### Property 12: Bill Status Update

_For any_ successful bill payment, the bill status must be updated to "PAID", amount set to 0, and transactionId field added

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### Property 13: Balance Change Notification

_For any_ successful bill payment, a balance change notification must be created in RTDB at path `notifications/{userId}/{pushKey}` with type="BALANCE_CHANGE", direction="OUT", appropriate title based on service type, and all required fields

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11**

### Property 14: Service Type Labels

_For any_ bill payment, the service type label should be "điện" for electric and "nước" for water in all user-facing messages

**Validates: Requirements 8.1, 8.2**

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

3. **Bill Validation Errors**

   - Bill not found: "Không tìm thấy hóa đơn để thanh toán"
   - Bill already paid: "Hóa đơn không hợp lệ hoặc đã được thanh toán"
   - Invalid amount: "Số tiền hóa đơn không hợp lệ"

4. **Account Errors**

   - No account selected: "Vui lòng chọn tài khoản thanh toán"
   - Account not found: "Không tìm thấy tài khoản thanh toán"
   - Wrong ownership: "Bạn không có quyền sử dụng tài khoản này"
   - Account locked: "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
   - Insufficient balance: "Số dư không đủ. Cần {amount} ₫, hiện có {balance} ₫"

5. **Transaction Errors**
   - Transaction failed: "Giao dịch thất bại"

### Notification Failure Handling

If notification creation fails, the error is logged but does not fail the entire payment operation. This ensures that payment and transaction records are still created successfully.

## Testing Strategy

### Unit Tests

- Test authentication validation
- Test user profile validation (locked, eKYC, canTransact)
- Test bill validation (exists, status, amount)
- Test account selection validation
- Test account ownership verification
- Test balance validation
- Test error message formatting

### Property-Based Tests

Each correctness property will be implemented as a property-based test using a suitable testing framework (e.g., fast-check for TypeScript). Each test will run a minimum of 100 iterations to ensure comprehensive coverage.

**Test Configuration:**

- Minimum 100 iterations per property test
- Each test tagged with: **Feature: utility-bill-payment-integration, Property {number}: {property_text}**

**Property Test Examples:**

1. **Property 1 Test**: Generate random payment attempts with/without authentication, verify error handling
2. **Property 3 Test**: Generate random bill IDs (existing and non-existing), verify validation
3. **Property 10 Test**: Generate random valid payments, verify balance is decreased by exact amount
4. **Property 11 Test**: Generate random valid payments, verify transaction record structure and fields
5. **Property 12 Test**: Generate random valid payments, verify bill status update

### Integration Tests

- Test complete payment flow from validation to notification
- Test atomic transaction behavior (balance deduction)
- Test RTDB record creation
- Test notification creation
- Test error recovery scenarios

## Implementation Notes

### Import Changes

```typescript
// Add user service import
import { getCurrentUserProfile } from "./userService";

// Ensure RTDB imports are present
import {
  ref,
  get,
  runTransaction,
  push,
  set,
  serverTimestamp,
} from "firebase/database";
```

### Key Implementation Details

1. **Add accountId parameter**: Function signature must change to include accountId
2. **Use `getCurrentUserProfile()`**: Import and call to get user profile for validation
3. **Use `push()` for transaction ID**: Generate unique transaction ID using RTDB push()
4. **Use `runTransaction()` for balance**: Atomic balance deduction on account
5. **Path structure**: Follow flight booking pattern (`utilityTransactions/`)
6. **Status values**: Use uppercase ("SUCCESS", "PAID") to match flight booking pattern
7. **Service labels**: Map "electric" → "điện", "water" → "nước" for Vietnamese labels

### Code Reuse

The implementation should closely follow the `flightBookingService.ts` pattern:

- Same validation sequence
- Same error messages format
- Same transaction handling
- Same notification structure

This ensures consistency and makes the codebase easier to maintain.

### Service Label Mapping

```typescript
const serviceLabelMap: Record<UtilityBillServiceType, string> = {
  electric: "điện",
  water: "nước",
};
```

### Backward Compatibility

The function signature changes from:

```typescript
// Old
payUserUtilityBill(params: {
  service: UtilityBillServiceType;
  providerId: string;
})

// New
payUserUtilityBill(params: {
  service: UtilityBillServiceType;
  providerId: string;
  accountId: string; // NEW required parameter
})
```

All calling code must be updated to provide accountId parameter.
