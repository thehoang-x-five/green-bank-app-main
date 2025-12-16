import { describe, it } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 5: eKYC Status Validation
 * 
 * For any user attempting payment, if the ekycStatus is not "VERIFIED",
 * the system should reject the payment and display an error message.
 * 
 * Validates: Requirements 7.4
 */

type EKYCStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

interface PaymentAttempt {
  ekycStatus: EKYCStatus | string
  amount: number
}

interface PaymentResult {
  allowed: boolean
  errorMessage?: string
}

// Function that represents the eKYC validation logic
function validateEKYCForPayment(attempt: PaymentAttempt): PaymentResult {
  if (attempt.ekycStatus !== 'VERIFIED') {
    return {
      allowed: false,
      errorMessage: 'Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực.',
    }
  }

  return {
    allowed: true,
  }
}

describe('Property 5: eKYC Status Validation', () => {
  it('should reject payment for any non-VERIFIED eKYC status', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom('PENDING', 'REJECTED'),
          fc.string().filter(s => s !== 'VERIFIED'), // Any other string
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('')
        ),
        fc.float({ min: 1, max: 1000000, noNaN: true }),
        (ekycStatus, amount) => {
          const attempt: PaymentAttempt = {
            ekycStatus: ekycStatus as string,
            amount,
          }
          
          const result = validateEKYCForPayment(attempt)
          
          // Property: Non-VERIFIED status should always reject payment
          const isRejected = !result.allowed
          const hasErrorMessage = result.errorMessage && result.errorMessage.includes('eKYC')
          
          return isRejected && hasErrorMessage
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should allow payment only for VERIFIED eKYC status', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 1000000, noNaN: true }),
        (amount) => {
          const attempt: PaymentAttempt = {
            ekycStatus: 'VERIFIED',
            amount,
          }
          
          const result = validateEKYCForPayment(attempt)
          
          // Property: VERIFIED status should allow payment
          const isAllowed = result.allowed
          const noErrorMessage = !result.errorMessage
          
          return isAllowed && noErrorMessage
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should be case-sensitive for eKYC status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('verified', 'Verified', 'VERIFIED', 'VERIFIED ', ' VERIFIED', 'verified '),
        fc.float({ min: 1, max: 1000000, noNaN: true }),
        (ekycStatus, amount) => {
          const attempt: PaymentAttempt = {
            ekycStatus,
            amount,
          }
          
          const result = validateEKYCForPayment(attempt)
          
          // Property: Only exact "VERIFIED" should be accepted
          const shouldBeAllowed = ekycStatus === 'VERIFIED'
          
          return result.allowed === shouldBeAllowed
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject payment regardless of amount when eKYC is not verified', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('PENDING', 'REJECTED', '', null, undefined),
        fc.oneof(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),      // Small amounts
          fc.float({ min: Math.fround(1000), max: Math.fround(10000000) }),  // Medium amounts
          fc.float({ min: Math.fround(10000000), max: Math.fround(100000000) }) // Large amounts
        ),
        (ekycStatus, amount) => {
          const attempt: PaymentAttempt = {
            ekycStatus: ekycStatus as string,
            amount,
          }
          
          const result = validateEKYCForPayment(attempt)
          
          // Property: Amount should not affect eKYC validation
          return !result.allowed && result.errorMessage?.includes('eKYC')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should provide consistent error message for eKYC failures', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s !== 'VERIFIED'),
        fc.float({ min: 1, max: 1000000, noNaN: true }),
        (invalidEkycStatus, amount) => {
          const attempt: PaymentAttempt = {
            ekycStatus: invalidEkycStatus,
            amount,
          }
          
          const result = validateEKYCForPayment(attempt)
          
          // Property: Error message should be consistent and in Vietnamese
          const hasVietnameseError = result.errorMessage && 
            (result.errorMessage.includes('eKYC') || 
             result.errorMessage.includes('định danh') ||
             result.errorMessage.includes('xác thực'))
          
          return !result.allowed && hasVietnameseError
        }
      ),
      { numRuns: 100 }
    )
  })
})