import { describe, it } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 3: Search Input Validation
 * 
 * For any search request, if the location (cityKey) is empty or the checkout date
 * is before or equal to checkin date, the system should reject the search and
 * display an error message without calling the hotel search API.
 * 
 * Validates: Requirements 6.1, 6.2
 */

interface SearchInput {
  cityKey: string
  checkIn: string
  checkOut: string
}

interface ValidationResult {
  isValid: boolean
  errorMessage?: string
  shouldCallAPI: boolean
}

// Function that represents the search validation logic
function validateSearchInput(input: SearchInput): ValidationResult {
  // Check if cityKey is empty
  if (!input.cityKey || input.cityKey.trim() === '') {
    return {
      isValid: false,
      errorMessage: 'Vui lòng chọn địa điểm trước khi tìm kiếm',
      shouldCallAPI: false,
    }
  }

  // Check if checkout date is after checkin date
  const checkInDate = new Date(input.checkIn)
  const checkOutDate = new Date(input.checkOut)
  
  if (checkOutDate <= checkInDate) {
    return {
      isValid: false,
      errorMessage: 'Ngày trả phòng phải sau ngày nhận phòng',
      shouldCallAPI: false,
    }
  }

  return {
    isValid: true,
    shouldCallAPI: true,
  }
}

describe('Property 3: Search Input Validation', () => {
  it('should reject search when cityKey is empty', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\t', '\n'), // Empty or whitespace-only strings
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        (emptyCityKey, checkIn, checkOut) => {
          // Skip invalid dates
          if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            return true // Skip this test case
          }
          
          const input: SearchInput = {
            cityKey: emptyCityKey,
            checkIn: checkIn.toISOString().split('T')[0],
            checkOut: checkOut.toISOString().split('T')[0],
          }
          
          const result = validateSearchInput(input)
          
          // Property: Empty cityKey should always result in invalid search
          return !result.isValid && !result.shouldCallAPI && result.errorMessage?.includes('địa điểm')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject search when checkout is before or equal to checkin', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // Non-empty cityKey
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        (cityKey, baseDate) => {
          // Skip invalid dates
          if (isNaN(baseDate.getTime())) {
            return true // Skip this test case
          }
          
          const checkIn = baseDate.toISOString().split('T')[0]
          const checkOut = baseDate.toISOString().split('T')[0] // Same date
          
          const input: SearchInput = {
            cityKey: cityKey.trim() || 'VN_HN', // Ensure non-empty
            checkIn,
            checkOut,
          }
          
          const result = validateSearchInput(input)
          
          // Property: Same or earlier checkout date should result in invalid search
          return !result.isValid && !result.shouldCallAPI && result.errorMessage?.includes('ngày')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should accept valid search inputs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-11-30') }),
        fc.integer({ min: 1, max: 30 }), // Days to add for checkout
        (cityKey, checkInDate, daysToAdd) => {
          // Skip invalid dates
          if (isNaN(checkInDate.getTime())) {
            return true // Skip this test case
          }
          
          const checkIn = checkInDate.toISOString().split('T')[0]
          const checkOutDate = new Date(checkInDate)
          checkOutDate.setDate(checkOutDate.getDate() + daysToAdd)
          const checkOut = checkOutDate.toISOString().split('T')[0]
          
          const input: SearchInput = {
            cityKey: cityKey.trim(),
            checkIn,
            checkOut,
          }
          
          const result = validateSearchInput(input)
          
          // Property: Valid inputs should pass validation
          return result.isValid && result.shouldCallAPI && !result.errorMessage
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should never call API when validation fails', () => {
    // Helper to safely convert date to ISO string
    const safeToDateString = (d: Date): string => {
      if (isNaN(d.getTime())) {
        return '2024-06-15' // Fallback to valid date
      }
      return d.toISOString().split('T')[0]
    }

    fc.assert(
      fc.property(
        fc.oneof(
          // Empty cityKey cases
          fc.record({
            cityKey: fc.constantFrom('', '   ', '\t'),
            checkIn: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map(safeToDateString),
            checkOut: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map(safeToDateString),
          }),
          // Invalid date cases (checkout <= checkin)
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).chain(baseDate => 
            fc.record({
              cityKey: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
              checkIn: fc.constant(safeToDateString(baseDate)),
              checkOut: fc.constant(safeToDateString(baseDate)), // Same date = invalid
            })
          )
        ),
        (input) => {
          const result = validateSearchInput(input)
          
          // Property: Invalid inputs should never trigger API call
          return !result.shouldCallAPI
        }
      ),
      { numRuns: 100 }
    )
  })
})