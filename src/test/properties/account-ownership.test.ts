import { describe, it } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 6: Account Ownership Validation
 * 
 * For any account selection, the account's uid must match the current user's uid,
 * otherwise the system should reject the transaction.
 * 
 * Validates: Requirements 8.1
 */

interface Account {
  accountNumber: string
  uid: string
  balance: number
  status: 'ACTIVE' | 'LOCKED'
}

interface User {
  uid: string
}

interface OwnershipValidationResult {
  isValid: boolean
  errorMessage?: string
}

// Function that represents the account ownership validation logic
function validateAccountOwnership(account: Account, currentUser: User): OwnershipValidationResult {
  if (account.uid !== currentUser.uid) {
    return {
      isValid: false,
      errorMessage: 'Tài khoản nguồn không thuộc về bạn hoặc không tồn tại',
    }
  }

  return {
    isValid: true,
  }
}

describe('Property 6: Account Ownership Validation', () => {
  it('should reject transaction when account uid does not match user uid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }), // account uid
        fc.string({ minLength: 10, maxLength: 30 }), // user uid
        fc.string({ minLength: 8, maxLength: 20 }),  // account number
        fc.float({ min: 0, max: 1000000, noNaN: true }), // balance
        (accountUid, userUid, accountNumber, balance) => {
          // Ensure UIDs are different
          fc.pre(accountUid !== userUid)
          
          const account: Account = {
            accountNumber,
            uid: accountUid,
            balance,
            status: 'ACTIVE',
          }
          
          const user: User = {
            uid: userUid,
          }
          
          const result = validateAccountOwnership(account, user)
          
          // Property: Different UIDs should result in rejection
          const isRejected = !result.isValid
          const hasErrorMessage = result.errorMessage && 
            result.errorMessage.includes('không thuộc về bạn')
          
          return isRejected && hasErrorMessage
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should accept transaction when account uid matches user uid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }), // shared uid
        fc.string({ minLength: 8, maxLength: 20 }),  // account number
        fc.float({ min: 0, max: 1000000, noNaN: true }), // balance
        (sharedUid, accountNumber, balance) => {
          const account: Account = {
            accountNumber,
            uid: sharedUid,
            balance,
            status: 'ACTIVE',
          }
          
          const user: User = {
            uid: sharedUid,
          }
          
          const result = validateAccountOwnership(account, user)
          
          // Property: Matching UIDs should result in acceptance
          const isAccepted = result.isValid
          const noErrorMessage = !result.errorMessage
          
          return isAccepted && noErrorMessage
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should be case-sensitive for uid comparison', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }).filter(s => s.toLowerCase() !== s.toUpperCase()),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (baseUid, accountNumber, balance) => {
          const account: Account = {
            accountNumber,
            uid: baseUid.toLowerCase(),
            balance,
            status: 'ACTIVE',
          }
          
          const user: User = {
            uid: baseUid.toUpperCase(),
          }
          
          const result = validateAccountOwnership(account, user)
          
          // Property: Case differences should result in rejection
          return !result.isValid && result.errorMessage?.includes('không thuộc về bạn')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle whitespace differences in uid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (baseUid, accountNumber, balance) => {
          const account: Account = {
            accountNumber,
            uid: ` ${baseUid} `, // uid with whitespace
            balance,
            status: 'ACTIVE',
          }
          
          const user: User = {
            uid: baseUid, // uid without whitespace
          }
          
          const result = validateAccountOwnership(account, user)
          
          // Property: Whitespace differences should result in rejection
          return !result.isValid
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should validate ownership regardless of account status', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.constantFrom('ACTIVE', 'LOCKED'),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (accountUid, userUid, status, accountNumber, balance) => {
          fc.pre(accountUid !== userUid)
          
          const account: Account = {
            accountNumber,
            uid: accountUid,
            balance,
            status,
          }
          
          const user: User = {
            uid: userUid,
          }
          
          const result = validateAccountOwnership(account, user)
          
          // Property: Ownership validation should be independent of account status
          return !result.isValid
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should validate ownership regardless of account balance', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.oneof(
          fc.constant(0),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
          fc.float({ min: Math.fround(1000000), max: Math.fround(1000000000) })
        ),
        fc.string({ minLength: 8, maxLength: 20 }),
        (accountUid, userUid, balance, accountNumber) => {
          fc.pre(accountUid !== userUid)
          
          const account: Account = {
            accountNumber,
            uid: accountUid,
            balance,
            status: 'ACTIVE',
          }
          
          const user: User = {
            uid: userUid,
          }
          
          const result = validateAccountOwnership(account, user)
          
          // Property: Ownership validation should be independent of balance
          return !result.isValid
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should provide consistent error message for ownership failures', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (accountUid, userUid, accountNumber, balance) => {
          fc.pre(accountUid !== userUid)
          
          const account: Account = {
            accountNumber,
            uid: accountUid,
            balance,
            status: 'ACTIVE',
          }
          
          const user: User = {
            uid: userUid,
          }
          
          const result = validateAccountOwnership(account, user)
          
          // Property: Error message should be consistent and in Vietnamese
          const hasConsistentMessage = result.errorMessage === 
            'Tài khoản nguồn không thuộc về bạn hoặc không tồn tại'
          
          return !result.isValid && hasConsistentMessage
        }
      ),
      { numRuns: 100 }
    )
  })
})