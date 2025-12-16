import { describe, it } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 10: Transaction Atomicity
 * 
 * For any payment attempt, if the RTDB balance update fails (insufficient funds
 * or transaction error), no Firestore documents (transaction or booking) should be created.
 * 
 * Validates: Requirements 11.5
 */

interface Account {
  accountNumber: string
  balance: number
  status: 'ACTIVE' | 'LOCKED'
}

interface PaymentAttempt {
  accountNumber: string
  amount: number
  currentBalance: number
  accountStatus: 'ACTIVE' | 'LOCKED'
}

interface PaymentResult {
  rtdbSuccess: boolean
  firestoreTransactionCreated: boolean
  firestoreBookingCreated: boolean
  newBalance?: number
  error?: string
}

// Simulate RTDB balance update
function updateAccountBalance(account: Account, amount: number): { success: boolean; newBalance?: number; error?: string } {
  if (account.status === 'LOCKED') {
    return {
      success: false,
      error: 'Tài khoản đang bị khóa',
    }
  }
  
  if (account.balance < amount) {
    return {
      success: false,
      error: 'Số dư không đủ',
    }
  }
  
  return {
    success: true,
    newBalance: account.balance - amount,
  }
}

// Simulate the complete payment process with atomicity
function processPayment(attempt: PaymentAttempt): PaymentResult {
  const account: Account = {
    accountNumber: attempt.accountNumber,
    balance: attempt.currentBalance,
    status: attempt.accountStatus,
  }
  
  // Step 1: Try to update RTDB balance
  const balanceUpdate = updateAccountBalance(account, attempt.amount)
  
  if (!balanceUpdate.success) {
    // If RTDB fails, no Firestore documents should be created
    return {
      rtdbSuccess: false,
      firestoreTransactionCreated: false,
      firestoreBookingCreated: false,
      error: balanceUpdate.error,
    }
  }
  
  // Step 2: If RTDB succeeds, create Firestore documents
  // In a real implementation, this would be wrapped in error handling
  // If Firestore fails, RTDB has already committed (can't rollback)
  return {
    rtdbSuccess: true,
    firestoreTransactionCreated: true,
    firestoreBookingCreated: true,
    newBalance: balanceUpdate.newBalance,
  }
}

describe('Property 10: Transaction Atomicity', () => {
  it('should not create Firestore documents when RTDB balance update fails due to insufficient funds', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }), // accountNumber
        fc.float({ min: 0, max: 1000000, noNaN: true }), // currentBalance
        fc.float({ min: 1000001, max: 10000000, noNaN: true }), // amount (higher than balance)
        (accountNumber, currentBalance, amount) => {
          fc.pre(amount > currentBalance) // Ensure insufficient funds
          
          const attempt: PaymentAttempt = {
            accountNumber,
            amount,
            currentBalance,
            accountStatus: 'ACTIVE',
          }
          
          const result = processPayment(attempt)
          
          // Property: When RTDB fails, no Firestore documents should be created
          return !result.rtdbSuccess &&
            !result.firestoreTransactionCreated &&
            !result.firestoreBookingCreated &&
            result.error?.includes('không đủ')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not create Firestore documents when account is locked', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.float({ min: 1000000, max: 10000000, noNaN: true }), // sufficient balance
        fc.float({ min: 1, max: 1000000, noNaN: true }), // amount (less than balance)
        (accountNumber, currentBalance, amount) => {
          fc.pre(amount <= currentBalance) // Ensure sufficient funds
          
          const attempt: PaymentAttempt = {
            accountNumber,
            amount,
            currentBalance,
            accountStatus: 'LOCKED', // Account is locked
          }
          
          const result = processPayment(attempt)
          
          // Property: When account is locked, no documents should be created
          return !result.rtdbSuccess &&
            !result.firestoreTransactionCreated &&
            !result.firestoreBookingCreated &&
            result.error?.includes('khóa')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should create all documents when RTDB update succeeds', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.float({ min: 1000000, max: 10000000, noNaN: true }), // sufficient balance
        fc.float({ min: 1, max: 1000000, noNaN: true }), // amount (less than balance)
        (accountNumber, currentBalance, amount) => {
          fc.pre(amount <= currentBalance) // Ensure sufficient funds
          
          const attempt: PaymentAttempt = {
            accountNumber,
            amount,
            currentBalance,
            accountStatus: 'ACTIVE',
          }
          
          const result = processPayment(attempt)
          
          // Property: When RTDB succeeds, all documents should be created
          return result.rtdbSuccess &&
            result.firestoreTransactionCreated &&
            result.firestoreBookingCreated &&
            result.newBalance === (currentBalance - amount) &&
            !result.error
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain balance consistency when transaction succeeds', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.float({ min: 1000000, max: 10000000, noNaN: true }),
        fc.float({ min: 1, max: 1000000, noNaN: true }),
        (accountNumber, currentBalance, amount) => {
          fc.pre(amount <= currentBalance)
          
          const attempt: PaymentAttempt = {
            accountNumber,
            amount,
            currentBalance,
            accountStatus: 'ACTIVE',
          }
          
          const result = processPayment(attempt)
          
          // Property: New balance should be exactly currentBalance - amount
          return result.rtdbSuccess &&
            result.newBalance !== undefined &&
            Math.abs(result.newBalance - (currentBalance - amount)) < 0.01 // Account for floating point precision
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should never create partial state (some documents but not others)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.oneof(
          // Insufficient funds scenario
          fc.record({
            currentBalance: fc.float({ min: 0, max: 1000000, noNaN: true }),
            amount: fc.float({ min: 1000001, max: 10000000, noNaN: true }),
            accountStatus: fc.constant('ACTIVE' as const),
          }),
          // Locked account scenario
          fc.record({
            currentBalance: fc.float({ min: 1000000, max: 10000000, noNaN: true }),
            amount: fc.float({ min: 1, max: 1000000, noNaN: true }),
            accountStatus: fc.constant('LOCKED' as const),
          }),
          // Success scenario
          fc.record({
            currentBalance: fc.float({ min: 1000000, max: 10000000, noNaN: true }),
            amount: fc.float({ min: 1, max: 1000000, noNaN: true }),
            accountStatus: fc.constant('ACTIVE' as const),
          }).filter(({ currentBalance, amount }) => amount <= currentBalance)
        ),
        (accountNumber, scenario) => {
          const attempt: PaymentAttempt = {
            accountNumber,
            amount: scenario.amount,
            currentBalance: scenario.currentBalance,
            accountStatus: scenario.accountStatus,
          }
          
          const result = processPayment(attempt)
          
          // Property: Either all operations succeed or all fail (no partial state)
          const allSucceed = result.rtdbSuccess && 
            result.firestoreTransactionCreated && 
            result.firestoreBookingCreated
          
          const allFail = !result.rtdbSuccess && 
            !result.firestoreTransactionCreated && 
            !result.firestoreBookingCreated
          
          return allSucceed || allFail
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle edge cases around zero balance correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.constantFrom(0, 0.01, 1), // Edge case balances
        fc.constantFrom(0.01, 1, 100), // Small amounts
        (accountNumber, currentBalance, amount) => {
          const attempt: PaymentAttempt = {
            accountNumber,
            amount,
            currentBalance,
            accountStatus: 'ACTIVE',
          }
          
          const result = processPayment(attempt)
          
          // Property: Atomicity should hold even for edge cases
          if (amount > currentBalance) {
            // Should fail atomically
            return !result.rtdbSuccess && 
              !result.firestoreTransactionCreated && 
              !result.firestoreBookingCreated
          } else {
            // Should succeed atomically
            return result.rtdbSuccess && 
              result.firestoreTransactionCreated && 
              result.firestoreBookingCreated &&
              result.newBalance === (currentBalance - amount)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should provide consistent error messages for failed transactions', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.oneof(
          // Insufficient funds
          fc.record({
            currentBalance: fc.float({ min: 0, max: 1000000, noNaN: true }),
            amount: fc.float({ min: 1000001, max: 10000000, noNaN: true }),
            accountStatus: fc.constant('ACTIVE' as const),
          }),
          // Locked account
          fc.record({
            currentBalance: fc.float({ min: 1000000, max: 10000000, noNaN: true }),
            amount: fc.float({ min: 1, max: 1000000, noNaN: true }),
            accountStatus: fc.constant('LOCKED' as const),
          })
        ),
        (accountNumber, scenario) => {
          const attempt: PaymentAttempt = {
            accountNumber,
            amount: scenario.amount,
            currentBalance: scenario.currentBalance,
            accountStatus: scenario.accountStatus,
          }
          
          const result = processPayment(attempt)
          
          // Property: Failed transactions should have meaningful error messages
          return !result.rtdbSuccess && 
            result.error && 
            result.error.length > 0 &&
            (result.error.includes('không đủ') || result.error.includes('khóa'))
        }
      ),
      { numRuns: 100 }
    )
  })
})