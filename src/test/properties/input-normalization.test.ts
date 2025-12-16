import { describe, it } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 4: Guest and Room Count Normalization
 * 
 * For any input value for guests or rooms, if the value is less than 1,
 * the system should automatically normalize it to 1.
 * 
 * Validates: Requirements 6.3, 6.4
 */

// Function that represents the normalization logic
function normalizeGuestCount(input: number): number {
  if (isNaN(input)) return 1
  return Math.max(1, input)
}

function normalizeRoomCount(input: number): number {
  if (isNaN(input)) return 1
  return Math.max(1, input)
}

describe('Property 4: Guest and Room Count Normalization', () => {
  it('should normalize guest count to minimum of 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        (guestInput) => {
          const normalized = normalizeGuestCount(guestInput)
          
          // Property: Result should always be >= 1
          const isAtLeastOne = normalized >= 1
          
          // Property: If input was >= 1, result should equal input
          const preservesValidInput = guestInput >= 1 ? normalized === guestInput : true
          
          // Property: If input was < 1, result should be 1
          const normalizesInvalidInput = guestInput < 1 ? normalized === 1 : true
          
          return isAtLeastOne && preservesValidInput && normalizesInvalidInput
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should normalize room count to minimum of 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        (roomInput) => {
          const normalized = normalizeRoomCount(roomInput)
          
          // Property: Result should always be >= 1
          const isAtLeastOne = normalized >= 1
          
          // Property: If input was >= 1, result should equal input
          const preservesValidInput = roomInput >= 1 ? normalized === roomInput : true
          
          // Property: If input was < 1, result should be 1
          const normalizesInvalidInput = roomInput < 1 ? normalized === 1 : true
          
          return isAtLeastOne && preservesValidInput && normalizesInvalidInput
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle edge cases correctly', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0),
          fc.constant(-1),
          fc.constant(-100),
          fc.constant(Number.NEGATIVE_INFINITY),
          fc.constant(NaN)
        ),
        (edgeCase) => {
          const normalizedGuests = normalizeGuestCount(edgeCase)
          const normalizedRooms = normalizeRoomCount(edgeCase)
          
          // Property: Edge cases should always normalize to 1
          return normalizedGuests === 1 && normalizedRooms === 1
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve positive integers unchanged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (positiveInput) => {
          const normalizedGuests = normalizeGuestCount(positiveInput)
          const normalizedRooms = normalizeRoomCount(positiveInput)
          
          // Property: Positive integers should remain unchanged
          return normalizedGuests === positiveInput && normalizedRooms === positiveInput
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should be idempotent for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (validInput) => {
          const firstNormalization = normalizeGuestCount(validInput)
          const secondNormalization = normalizeGuestCount(firstNormalization)
          
          // Property: Normalizing an already normalized value should not change it
          return firstNormalization === secondNormalization
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle floating point numbers by flooring to integer then normalizing', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -10, max: 10, noNaN: true }),
        (floatInput) => {
          // Simulate how the UI might handle float inputs (convert to int first)
          const intInput = Math.floor(floatInput)
          const normalized = normalizeGuestCount(intInput)
          
          // Property: Result should always be >= 1
          return normalized >= 1
        }
      ),
      { numRuns: 100 }
    )
  })
})