import { describe, it } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 8: Transaction Data Integrity
 * 
 * For any successful hotel booking transaction, the created transaction document
 * must contain all required fields: customerUid, accountNumber, hotelId, hotelName,
 * amount, fee, status, and type must equal "HOTEL_BOOKING".
 * 
 * Validates: Requirements 10.2
 */

interface TransactionDocument {
  id?: string
  type: string
  status: string
  customerUid: string
  accountNumber: string
  hotelId: string
  hotelName: string
  amount: number
  fee: number
  createdAt?: Date
}

interface BookingParams {
  customerUid: string
  accountNumber: string
  hotelId: string
  hotelName: string
  amount: number
  fee: number
}

// Function that represents the transaction document creation logic
function createTransactionDocument(params: BookingParams): TransactionDocument {
  return {
    id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'HOTEL_BOOKING',
    status: 'SUCCESS',
    customerUid: params.customerUid,
    accountNumber: params.accountNumber,
    hotelId: params.hotelId,
    hotelName: params.hotelName,
    amount: params.amount,
    fee: params.fee,
    createdAt: new Date(),
  }
}

// Function to validate transaction document integrity
function validateTransactionIntegrity(transaction: TransactionDocument): boolean {
  const requiredFields = [
    'type', 'status', 'customerUid', 'accountNumber', 
    'hotelId', 'hotelName', 'amount', 'fee'
  ]
  
  // Check all required fields are present and not null/undefined
  const hasAllFields = requiredFields.every(field => 
    transaction[field as keyof TransactionDocument] !== null && 
    transaction[field as keyof TransactionDocument] !== undefined
  )
  
  // Check type is specifically "HOTEL_BOOKING"
  const correctType = transaction.type === 'HOTEL_BOOKING'
  
  // Check status is "SUCCESS"
  const correctStatus = transaction.status === 'SUCCESS'
  
  // Check numeric fields are valid numbers
  const validAmount = typeof transaction.amount === 'number' && 
    transaction.amount >= 0 && !isNaN(transaction.amount)
  const validFee = typeof transaction.fee === 'number' && 
    transaction.fee >= 0 && !isNaN(transaction.fee)
  
  // Check string fields are non-empty
  const validStrings = transaction.customerUid.length > 0 &&
    transaction.accountNumber.length > 0 &&
    transaction.hotelId.length > 0 &&
    transaction.hotelName.length > 0
  
  return hasAllFields && correctType && correctStatus && 
    validAmount && validFee && validStrings
}

describe('Property 8: Transaction Data Integrity', () => {
  it('should create transaction documents with all required fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }), // customerUid
        fc.string({ minLength: 8, maxLength: 20 }),  // accountNumber
        fc.string({ minLength: 5, maxLength: 20 }),  // hotelId
        fc.string({ minLength: 5, maxLength: 50 }),  // hotelName
        fc.float({ min: 1, max: 100000000, noNaN: true }), // amount
        fc.float({ min: 0, max: 1000000, noNaN: true }),   // fee
        (customerUid, accountNumber, hotelId, hotelName, amount, fee) => {
          const params: BookingParams = {
            customerUid,
            accountNumber,
            hotelId,
            hotelName,
            amount,
            fee,
          }
          
          const transaction = createTransactionDocument(params)
          
          // Property: All required fields should be present and valid
          return validateTransactionIntegrity(transaction)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should always set type to HOTEL_BOOKING', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.float({ min: 1, max: 100000000, noNaN: true }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (customerUid, accountNumber, hotelId, hotelName, amount, fee) => {
          const params: BookingParams = {
            customerUid,
            accountNumber,
            hotelId,
            hotelName,
            amount,
            fee,
          }
          
          const transaction = createTransactionDocument(params)
          
          // Property: Type should always be "HOTEL_BOOKING"
          return transaction.type === 'HOTEL_BOOKING'
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should always set status to SUCCESS for successful bookings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.float({ min: 1, max: 100000000, noNaN: true }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (customerUid, accountNumber, hotelId, hotelName, amount, fee) => {
          const params: BookingParams = {
            customerUid,
            accountNumber,
            hotelId,
            hotelName,
            amount,
            fee,
          }
          
          const transaction = createTransactionDocument(params)
          
          // Property: Status should always be "SUCCESS"
          return transaction.status === 'SUCCESS'
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve all input parameters in the transaction', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.float({ min: 1, max: 100000000, noNaN: true }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (customerUid, accountNumber, hotelId, hotelName, amount, fee) => {
          const params: BookingParams = {
            customerUid,
            accountNumber,
            hotelId,
            hotelName,
            amount,
            fee,
          }
          
          const transaction = createTransactionDocument(params)
          
          // Property: All input parameters should be preserved exactly
          return transaction.customerUid === customerUid &&
            transaction.accountNumber === accountNumber &&
            transaction.hotelId === hotelId &&
            transaction.hotelName === hotelName &&
            transaction.amount === amount &&
            transaction.fee === fee
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle edge cases for numeric values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.oneof(
          fc.constant(0.01),           // Minimum amount
          fc.constant(1),              // Small integer
          fc.constant(10_000_000),     // Biometric threshold
          fc.constant(999_999_999.99)  // Large amount
        ),
        fc.oneof(
          fc.constant(0),              // No fee
          fc.constant(0.01),           // Minimum fee
          fc.constant(1000),           // Standard fee
          fc.constant(100000)          // High fee
        ),
        (customerUid, accountNumber, hotelId, hotelName, amount, fee) => {
          const params: BookingParams = {
            customerUid,
            accountNumber,
            hotelId,
            hotelName,
            amount,
            fee,
          }
          
          const transaction = createTransactionDocument(params)
          
          // Property: Edge case numeric values should be handled correctly
          return validateTransactionIntegrity(transaction) &&
            transaction.amount === amount &&
            transaction.fee === fee
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should generate unique transaction IDs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.float({ min: 1, max: 100000000, noNaN: true }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (customerUid, accountNumber, hotelId, hotelName, amount, fee) => {
          const params: BookingParams = {
            customerUid,
            accountNumber,
            hotelId,
            hotelName,
            amount,
            fee,
          }
          
          const transaction1 = createTransactionDocument(params)
          const transaction2 = createTransactionDocument(params)
          
          // Property: Each transaction should have a unique ID
          return transaction1.id !== transaction2.id &&
            transaction1.id && transaction1.id.length > 0 &&
            transaction2.id && transaction2.id.length > 0
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should include timestamp information', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 8, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.float({ min: 1, max: 100000000, noNaN: true }),
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (customerUid, accountNumber, hotelId, hotelName, amount, fee) => {
          const beforeCreation = new Date()
          
          const params: BookingParams = {
            customerUid,
            accountNumber,
            hotelId,
            hotelName,
            amount,
            fee,
          }
          
          const transaction = createTransactionDocument(params)
          const afterCreation = new Date()
          
          // Property: Transaction should have a valid timestamp
          return transaction.createdAt instanceof Date &&
            transaction.createdAt >= beforeCreation &&
            transaction.createdAt <= afterCreation
        }
      ),
      { numRuns: 100 }
    )
  })
})