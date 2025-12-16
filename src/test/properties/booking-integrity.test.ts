import { describe, it } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 9: Booking Data Integrity
 * 
 * For any successful hotel booking, the created booking document must contain
 * all required fields: customerUid, hotelId, roomId, checkIn, checkOut, nights,
 * guests, rooms, total, transactionId, and status must equal "PAID".
 * 
 * Validates: Requirements 10.4
 */

interface BookingDocument {
  id?: string
  status: string
  customerUid: string
  hotelId: string
  hotelName: string
  roomId: string
  roomName: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  rooms: number
  total: number
  transactionId: string
  createdAt?: Date
}

interface BookingParams {
  customerUid: string
  hotelId: string
  hotelName: string
  roomId: string
  roomName: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  rooms: number
  total: number
  transactionId: string
}

// Function that represents the booking document creation logic
function createBookingDocument(params: BookingParams): BookingDocument {
  return {
    id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'PAID',
    customerUid: params.customerUid,
    hotelId: params.hotelId,
    hotelName: params.hotelName,
    roomId: params.roomId,
    roomName: params.roomName,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nights: params.nights,
    guests: params.guests,
    rooms: params.rooms,
    total: params.total,
    transactionId: params.transactionId,
    createdAt: new Date(),
  }
}

// Function to validate booking document integrity
function validateBookingIntegrity(booking: BookingDocument): boolean {
  const requiredFields = [
    'status', 'customerUid', 'hotelId', 'hotelName', 'roomId', 'roomName',
    'checkIn', 'checkOut', 'nights', 'guests', 'rooms', 'total', 'transactionId'
  ]
  
  // Check all required fields are present and not null/undefined
  const hasAllFields = requiredFields.every(field => 
    booking[field as keyof BookingDocument] !== null && 
    booking[field as keyof BookingDocument] !== undefined
  )
  
  // Check status is "PAID"
  const correctStatus = booking.status === 'PAID'
  
  // Check numeric fields are valid positive numbers
  const validNights = typeof booking.nights === 'number' && 
    booking.nights > 0 && !isNaN(booking.nights)
  const validGuests = typeof booking.guests === 'number' && 
    booking.guests > 0 && !isNaN(booking.guests)
  const validRooms = typeof booking.rooms === 'number' && 
    booking.rooms > 0 && !isNaN(booking.rooms)
  const validTotal = typeof booking.total === 'number' && 
    booking.total > 0 && !isNaN(booking.total)
  
  // Check string fields are non-empty
  const validStrings = booking.customerUid.length > 0 &&
    booking.hotelId.length > 0 &&
    booking.hotelName.length > 0 &&
    booking.roomId.length > 0 &&
    booking.roomName.length > 0 &&
    booking.checkIn.length > 0 &&
    booking.checkOut.length > 0 &&
    booking.transactionId.length > 0
  
  // Check date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const validDates = dateRegex.test(booking.checkIn) && dateRegex.test(booking.checkOut)
  
  // Check checkout is after checkin
  const checkInDate = new Date(booking.checkIn)
  const checkOutDate = new Date(booking.checkOut)
  const validDateOrder = checkOutDate > checkInDate
  
  return hasAllFields && correctStatus && validNights && validGuests && 
    validRooms && validTotal && validStrings && validDates && validDateOrder
}

// Function to calculate nights between two dates
function calculateNights(checkIn: string, checkOut: string): number {
  const checkInDate = new Date(checkIn)
  const checkOutDate = new Date(checkOut)
  const diffTime = checkOutDate.getTime() - checkInDate.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

describe('Property 9: Booking Data Integrity', () => {
  it('should create booking documents with all required fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }), // customerUid
        fc.string({ minLength: 5, maxLength: 20 }),  // hotelId
        fc.string({ minLength: 5, maxLength: 50 }),  // hotelName
        fc.string({ minLength: 5, maxLength: 20 }),  // roomId
        fc.string({ minLength: 5, maxLength: 50 }),  // roomName
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-11-30') }), // checkIn
        fc.integer({ min: 1, max: 30 }), // days to add for checkout
        fc.integer({ min: 1, max: 10 }), // guests
        fc.integer({ min: 1, max: 5 }),  // rooms
        fc.float({ min: 100000, max: 10000000, noNaN: true }), // total
        fc.string({ minLength: 10, maxLength: 30 }), // transactionId
        (customerUid, hotelId, hotelName, roomId, roomName, checkInDate, daysToAdd, guests, rooms, total, transactionId) => {
          // Skip invalid dates
          if (isNaN(checkInDate.getTime())) {
            return true // Skip this test case
          }
          
          const checkIn = checkInDate.toISOString().split('T')[0]
          const checkOutDate = new Date(checkInDate)
          checkOutDate.setDate(checkOutDate.getDate() + daysToAdd)
          const checkOut = checkOutDate.toISOString().split('T')[0]
          const nights = calculateNights(checkIn, checkOut)
          
          const params: BookingParams = {
            customerUid,
            hotelId,
            hotelName,
            roomId,
            roomName,
            checkIn,
            checkOut,
            nights,
            guests,
            rooms,
            total,
            transactionId,
          }
          
          const booking = createBookingDocument(params)
          
          // Property: All required fields should be present and valid
          return validateBookingIntegrity(booking)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should always set status to PAID for successful bookings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-11-30') }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.float({ min: 100000, max: 10000000, noNaN: true }),
        fc.string({ minLength: 10, maxLength: 30 }),
        (customerUid, hotelId, hotelName, roomId, roomName, checkInDate, daysToAdd, guests, rooms, total, transactionId) => {
          // Skip invalid dates
          if (isNaN(checkInDate.getTime())) {
            return true // Skip this test case
          }
          
          const checkIn = checkInDate.toISOString().split('T')[0]
          const checkOutDate = new Date(checkInDate)
          checkOutDate.setDate(checkOutDate.getDate() + daysToAdd)
          const checkOut = checkOutDate.toISOString().split('T')[0]
          const nights = calculateNights(checkIn, checkOut)
          
          const params: BookingParams = {
            customerUid, hotelId, hotelName, roomId, roomName,
            checkIn, checkOut, nights, guests, rooms, total, transactionId,
          }
          
          const booking = createBookingDocument(params)
          
          // Property: Status should always be "PAID"
          return booking.status === 'PAID'
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should correctly calculate and preserve nights', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-11-30') }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.float({ min: 100000, max: 10000000, noNaN: true }),
        fc.string({ minLength: 10, maxLength: 30 }),
        (customerUid, hotelId, hotelName, roomId, roomName, checkInDate, daysToAdd, guests, rooms, total, transactionId) => {
          // Skip invalid dates
          if (isNaN(checkInDate.getTime())) {
            return true // Skip this test case
          }
          
          const checkIn = checkInDate.toISOString().split('T')[0]
          const checkOutDate = new Date(checkInDate)
          checkOutDate.setDate(checkOutDate.getDate() + daysToAdd)
          const checkOut = checkOutDate.toISOString().split('T')[0]
          const expectedNights = calculateNights(checkIn, checkOut)
          
          const params: BookingParams = {
            customerUid, hotelId, hotelName, roomId, roomName,
            checkIn, checkOut, nights: expectedNights, guests, rooms, total, transactionId,
          }
          
          const booking = createBookingDocument(params)
          
          // Property: Nights calculation should be correct
          return booking.nights === expectedNights && booking.nights === daysToAdd
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve all input parameters in the booking', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-11-30') }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.float({ min: 100000, max: 10000000, noNaN: true }),
        fc.string({ minLength: 10, maxLength: 30 }),
        (customerUid, hotelId, hotelName, roomId, roomName, checkInDate, daysToAdd, guests, rooms, total, transactionId) => {
          // Skip invalid dates
          if (isNaN(checkInDate.getTime())) {
            return true // Skip this test case
          }
          
          const checkIn = checkInDate.toISOString().split('T')[0]
          const checkOutDate = new Date(checkInDate)
          checkOutDate.setDate(checkOutDate.getDate() + daysToAdd)
          const checkOut = checkOutDate.toISOString().split('T')[0]
          const nights = calculateNights(checkIn, checkOut)
          
          const params: BookingParams = {
            customerUid, hotelId, hotelName, roomId, roomName,
            checkIn, checkOut, nights, guests, rooms, total, transactionId,
          }
          
          const booking = createBookingDocument(params)
          
          // Property: All input parameters should be preserved exactly
          return booking.customerUid === customerUid &&
            booking.hotelId === hotelId &&
            booking.hotelName === hotelName &&
            booking.roomId === roomId &&
            booking.roomName === roomName &&
            booking.checkIn === checkIn &&
            booking.checkOut === checkOut &&
            booking.nights === nights &&
            booking.guests === guests &&
            booking.rooms === rooms &&
            booking.total === total &&
            booking.transactionId === transactionId
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should validate date format and order', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-11-30') }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.float({ min: 100000, max: 10000000, noNaN: true }),
        fc.string({ minLength: 10, maxLength: 30 }),
        (customerUid, hotelId, hotelName, roomId, roomName, checkInDate, daysToAdd, guests, rooms, total, transactionId) => {
          // Skip invalid dates
          if (isNaN(checkInDate.getTime())) {
            return true // Skip this test case
          }
          
          const checkIn = checkInDate.toISOString().split('T')[0]
          const checkOutDate = new Date(checkInDate)
          checkOutDate.setDate(checkOutDate.getDate() + daysToAdd)
          const checkOut = checkOutDate.toISOString().split('T')[0]
          const nights = calculateNights(checkIn, checkOut)
          
          const params: BookingParams = {
            customerUid, hotelId, hotelName, roomId, roomName,
            checkIn, checkOut, nights, guests, rooms, total, transactionId,
          }
          
          const booking = createBookingDocument(params)
          
          // Property: Dates should be in correct format and order
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/
          const validFormat = dateRegex.test(booking.checkIn) && dateRegex.test(booking.checkOut)
          const validOrder = new Date(booking.checkOut) > new Date(booking.checkIn)
          
          return validFormat && validOrder
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should generate unique booking IDs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-11-30') }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.float({ min: 100000, max: 10000000, noNaN: true }),
        fc.string({ minLength: 10, maxLength: 30 }),
        (customerUid, hotelId, hotelName, roomId, roomName, checkInDate, daysToAdd, guests, rooms, total, transactionId) => {
          // Skip invalid dates
          if (isNaN(checkInDate.getTime())) {
            return true // Skip this test case
          }
          
          const checkIn = checkInDate.toISOString().split('T')[0]
          const checkOutDate = new Date(checkInDate)
          checkOutDate.setDate(checkOutDate.getDate() + daysToAdd)
          const checkOut = checkOutDate.toISOString().split('T')[0]
          const nights = calculateNights(checkIn, checkOut)
          
          const params: BookingParams = {
            customerUid, hotelId, hotelName, roomId, roomName,
            checkIn, checkOut, nights, guests, rooms, total, transactionId,
          }
          
          const booking1 = createBookingDocument(params)
          const booking2 = createBookingDocument(params)
          
          // Property: Each booking should have a unique ID
          return booking1.id !== booking2.id &&
            booking1.id && booking1.id.length > 0 &&
            booking2.id && booking2.id.length > 0
        }
      ),
      { numRuns: 100 }
    )
  })
})