# Design Document: Mobile Phone Payment Integration

## Overview

This design implements payment processing for three mobile phone utility services: Phone Topup, Data Pack Purchase, and Data 4G/Topup Combined. The implementation follows the established pattern from `utilityBillService.ts`, ensuring consistency across all payment flows in the application.

The system provides a unified service layer that handles authentication, validation, balance management, transaction recording, and notifications for all three mobile phone payment types.

## Architecture

### Service Layer

The payment logic is encapsulated in a new service file: `src/services/mobilePhonePaymentService.ts`

This service provides three main functions:

- `payPhoneTopup()` - Process phone credit topup payments
- `payDataPack()` - Process data package purchase payments
- Helper functions for validation and error handling

### Integration Points

1. **UI Components**:

   - `UtilityPhoneTopup.tsx` - Phone topup interface
   - `UtilityDataPack.tsx` - Data pack and combined topup interface
   - `UtilityBills.tsx` - Main routing and state management

2. **Existing Services**:

   - `userService.ts` - User profile and permission validation
   - `firebase.ts` - Database connection and operations

3. **Database Structure** (Firebase RTDB):
   ```
   /utilityTransactions/{transactionId}
   /accounts/{accountId}
   /notifications/{userId}/{notificationId}
   /users/{userId}
   ```

## Components and Interfaces

### Service Functions

#### 1. payPhoneTopup

```typescript
async function payPhoneTopup(params: {
  phoneNumber: string;
  telco: string;
  topupAmount: number;
  accountId: string;
}): Promise<{ transactionId: string; amount: number }>;
```

**Purpose**: Process phone credit topup payment

**Parameters**:

- `phoneNumber`: Target phone number (10 digits, starts with 0)
- `telco`: Telecommunications provider (viettel, vina, mobi)
- `topupAmount`: Amount to topup in VND
- `accountId`: Payment source account ID

**Returns**: Transaction ID and amount

**Process Flow**:

1. Validate user authentication
2. Get and validate user profile (eKYC, status, permissions)
3. Validate phone number format
4. Validate topup amount > 0
5. Validate payment account (exists, belongs to user, not locked)
6. Check sufficient balance
7. Deduct balance using Firebase transaction
8. Create transaction record
9. Send balance change notification
10. Return transaction details

#### 2. payDataPack

```typescript
async function payDataPack(params: {
  phoneNumber: string;
  telco: string;
  packId: string;
  packName: string;
  packPrice: number;
  accountId: string;
}): Promise<{ transactionId: string; amount: number }>;
```

**Purpose**: Process data package purchase payment

**Parameters**:

- `phoneNumber`: Target phone number
- `telco`: Telecommunications provider
- `packId`: Data pack identifier (e.g., "ks110", "5g13ks")
- `packName`: Display name of the pack
- `packPrice`: Pack price in VND
- `accountId`: Payment source account ID

**Returns**: Transaction ID and amount

**Process Flow**: Same as payPhoneTopup, with pack-specific details

### Data Models

#### Transaction Record

```typescript
{
  transactionId: string;
  userId: string;
  accountId: string;
  type: "PHONE_TOPUP" | "DATA_PACK_PURCHASE";
  amount: number;
  description: string;
  status: "SUCCESS";
  phoneNumber: string;
  telco: string;

  // Phone topup specific
  topupAmount?: number;

  // Data pack specific
  packId?: string;
  packName?: string;
  packPrice?: number;

  createdAt: number;
  createdAtServer: ServerTimestamp;
}
```

#### Notification Record

```typescript
{
  type: "BALANCE_CHANGE";
  direction: "OUT";
  title: string; // "Nạp tiền điện thoại" | "Mua gói data"
  message: string; // Phone number and telco
  amount: number;
  accountNumber: string;
  balanceAfter: number;
  transactionId: string;
  createdAt: number;
}
```

### Validation Rules

#### Phone Number Validation

- Format: `/^0\d{9}$/` (10 digits, starts with 0)
- Examples: 0862525038, 0912345678

#### Telco Detection

- Viettel: 086, 096, 097, 098, 032-039
- Vinaphone: 088, 091, 094, 081-085
- Mobifone: 089, 090, 093, 070, 076-079

#### User Validation

- Must be authenticated
- eKYC status must be "VERIFIED"
- Account status must not be "LOCKED"
- Must have transaction permission (canTransact = true)

#### Account Validation

- Account must exist
- Account must belong to current user
- Account status must not be "LOCKED"
- Balance must be sufficient

#### Amount Validation

- Must be greater than 0
- Must be a valid number

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Authentication Required

_For any_ payment request, the system should reject the request if no user is authenticated
**Validates: Requirements 1.2, 2.2**

### Property 2: User Validation

_For any_ authenticated payment request, the system should validate eKYC status, account status, and transaction permission before processing
**Validates: Requirements 1.3, 1.4, 1.5, 2.3, 2.4, 2.5**

### Property 3: Phone Number Format

_For any_ payment request with a phone number, the system should validate the phone number matches the format `/^0\d{9}$/`
**Validates: Requirements 1.1, 2.1, 3.3, 3.4**

### Property 4: Account Ownership

_For any_ payment request, the system should verify the payment account belongs to the authenticated user
**Validates: Requirements 1.6, 2.6**

### Property 5: Account Status Check

_For any_ payment request, the system should reject the request if the payment account status is LOCKED
**Validates: Requirements 1.7, 2.7**

### Property 6: Sufficient Balance

_For any_ payment request, the system should verify the account balance is greater than or equal to the payment amount before deducting
**Validates: Requirements 1.8, 2.8**

### Property 7: Balance Deduction Atomicity

_For any_ successful payment, the balance deduction should be atomic (either fully succeeds or fully fails with no partial state)
**Validates: Requirements 1.9, 2.9**

### Property 8: Transaction Record Creation

_For any_ successful balance deduction, the system should create exactly one transaction record with the correct type and details
**Validates: Requirements 1.10, 1.11, 2.10, 2.11, 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 9: Notification Delivery

_For any_ successful transaction, the system should attempt to send a balance change notification
**Validates: Requirements 1.12, 2.12, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

### Property 10: Error Handling Without Side Effects

_For any_ validation failure, the system should return an error without modifying any data (balance, transactions, notifications)
**Validates: Requirements 1.13, 2.13**

### Property 11: Amount Validation

_For any_ payment request, the system should reject the request if the payment amount is less than or equal to zero
**Validates: Requirements 6.3**

### Property 12: Transaction Rollback on Failure

_For any_ payment where transaction record creation fails, the system should not have modified the account balance
**Validates: Requirements 4.6**

### Property 13: Notification Failure Isolation

_For any_ payment where notification creation fails, the payment transaction should still succeed
**Validates: Requirements 5.8**

### Property 14: Data 4G Tab Routing

_For any_ Data 4G/Topup payment from "Nạp data" tab, the system should use dataPhone field for validation
**Validates: Requirements 3.3**

### Property 15: Phone Topup Tab Routing

_For any_ Data 4G/Topup payment from "Nạp điện thoại" tab, the system should use phoneNumber field for validation
**Validates: Requirements 3.4**

## Error Handling

### Error Types and Messages

| Condition                 | Error Message                                                                     |
| ------------------------- | --------------------------------------------------------------------------------- |
| Not authenticated         | "Vui lòng đăng nhập để tiếp tục"                                                  |
| Profile not found         | "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."                    |
| Account locked            | "Tài khoản đăng nhập đang bị khóa, không thể giao dịch"                           |
| eKYC not verified         | "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực." |
| No transaction permission | "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."            |
| Payment account not found | "Không tìm thấy tài khoản thanh toán"                                             |
| Wrong account owner       | "Bạn không có quyền sử dụng tài khoản này"                                        |
| Payment account locked    | "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."                       |
| Insufficient balance      | "Số dư không đủ. Cần {amount} ₫, hiện có {balance} ₫"                             |
| Invalid phone number      | "Vui lòng nhập số điện thoại hợp lệ"                                              |
| Invalid amount            | "Số tiền thanh toán không hợp lệ"                                                 |
| Transaction failed        | "Giao dịch thất bại"                                                              |

### Error Handling Strategy

1. **Validation Errors**: Return immediately without database operations
2. **Transaction Errors**: Use Firebase transactions for atomicity
3. **Notification Errors**: Log but don't fail the payment
4. **Unknown Errors**: Catch and return generic error message

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **Phone Number Validation**:

   - Valid formats: 0862525038, 0912345678
   - Invalid formats: 862525038, 09123456789, abc1234567

2. **Amount Validation**:

   - Valid: 10000, 50000, 100000
   - Invalid: 0, -1000, NaN

3. **Telco Detection**:

   - Viettel numbers: 0862525038 → "viettel"
   - Vinaphone numbers: 0912345678 → "vina"
   - Mobifone numbers: 0901234567 → "mobi"

4. **Error Messages**:

   - Each error condition returns correct message
   - Error messages are in Vietnamese

5. **Integration Points**:
   - Service functions accept correct parameter types
   - Return values match expected structure

### Property-Based Tests

Property-based tests verify universal properties across many generated inputs. Each test should run minimum 100 iterations.

1. **Property 1: Authentication Required**

   - Generate random payment requests
   - Verify all requests without authentication are rejected

2. **Property 2: User Validation**

   - Generate random user profiles with various statuses
   - Verify only VERIFIED eKYC + ACTIVE status + canTransact=true pass

3. **Property 3: Phone Number Format**

   - Generate random strings
   - Verify only strings matching `/^0\d{9}$/` pass validation

4. **Property 4: Account Ownership**

   - Generate random user IDs and account IDs
   - Verify only matching user-account pairs pass

5. **Property 5: Account Status Check**

   - Generate random account statuses
   - Verify LOCKED accounts are rejected

6. **Property 6: Sufficient Balance**

   - Generate random balances and amounts
   - Verify only balance >= amount passes

7. **Property 7: Balance Deduction Atomicity**

   - Generate random payment scenarios
   - Verify balance changes are atomic (no partial updates)

8. **Property 8: Transaction Record Creation**

   - Generate random successful payments
   - Verify exactly one transaction record is created with correct fields

9. **Property 9: Notification Delivery**

   - Generate random successful transactions
   - Verify notification is created with correct structure

10. **Property 10: Error Handling Without Side Effects**

    - Generate random invalid payment requests
    - Verify no database changes occur on validation failure

11. **Property 11: Amount Validation**

    - Generate random numbers including negatives and zero
    - Verify only positive amounts pass

12. **Property 12: Transaction Rollback on Failure**

    - Simulate transaction creation failures
    - Verify balance remains unchanged

13. **Property 13: Notification Failure Isolation**

    - Simulate notification failures
    - Verify payment still succeeds

14. **Property 14: Data 4G Tab Routing**

    - Generate random Data 4G payments from "Nạp data" tab
    - Verify dataPhone field is used for validation

15. **Property 15: Phone Topup Tab Routing**
    - Generate random Data 4G payments from "Nạp điện thoại" tab
    - Verify phoneNumber field is used for validation

### Testing Framework

- **Unit Tests**: Vitest
- **Property-Based Tests**: fast-check (TypeScript property-based testing library)
- **Test Location**: Co-located with service file as `mobilePhonePaymentService.test.ts`

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
// Feature: mobile-phone-payment-integration, Property 1: Authentication Required
// Validates: Requirements 1.2, 2.2
```

## Implementation Notes

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

### Timestamp Handling

Use both client and server timestamps:

- `createdAt`: `Date.now()` - for client-side display
- `createdAtServer`: `serverTimestamp()` - for server-side ordering

### Notification Error Handling

Wrap notification creation in try-catch to prevent payment failure:

```typescript
try {
  await createNotification(/* ... */);
} catch (err) {
  console.warn("Notification failed (ignored):", err);
}
```

### UI Integration

The service functions are designed to be called from UI components after user confirmation:

```typescript
// In UtilityPhoneTopup or UtilityDataPack
const handlePayment = async () => {
  try {
    const result = await payPhoneTopup({
      phoneNumber: formData.phoneNumber,
      telco: formData.telco,
      topupAmount: Number(formData.topupAmount),
      accountId: selectedAccountId,
    });

    // Navigate to success page
    navigate("/utilities/result", {
      state: { result, source: "home" },
    });
  } catch (error) {
    toast.error(error.message);
  }
};
```

### Compatibility with Existing Code

The service maintains compatibility with:

- Existing form data structure (`UtilityFormData`)
- Existing routing logic in `UtilityBills.tsx`
- Existing result page format
- Existing notification structure
- Existing transaction record format

## Security Considerations

1. **Authentication**: All operations require authenticated user
2. **Authorization**: Verify account ownership before operations
3. **Validation**: Validate all inputs before database operations
4. **Atomicity**: Use Firebase transactions for balance changes
5. **Error Messages**: Don't expose sensitive information in errors
6. **Audit Trail**: Record all transactions with timestamps and user IDs
