# Implementation Plan - Movie Ticket Booking

- [x] 1. Set up data models and seed infrastructure


- [x] 1.1 Create cinema seed data generator in `functions/cinemaSeedData.js`



  - Generate 5-10 cinemas per major city (HCM, HN, DN)
  - Include cinema name, address, location, room count
  - _Requirements: 8.1, 8.2_

- [x] 1.2 Create movie seed data with posters

  - Generate 10-15 movies with titles, genres, durations, ratings
  - Use picsum.photos for poster URLs
  - _Requirements: 8.3_

- [x] 1.3 Create showtime seed data

  - Generate 3-5 showtimes per movie per cinema
  - Include date, time, room, seat availability
  - _Requirements: 8.4_

- [x] 1.4 Create seat map generator


  - Generate 8x12 seat layout (rows A-H, seats 1-12)
  - Randomly mark some seats as occupied
  - _Requirements: 8.5_

- [x] 1.5 Add `seedMoviesDemo` function to `functions/index.js`

  - Implement seed endpoint with secret validation
  - Check for existing data before seeding
  - Return seed statistics
  - _Requirements: 8.1-8.5_

- [x] 1.6 Update auto-seed script to include movie data
  - Modify `scripts/start-emulator-with-seed.cjs`
  - Call `seedMoviesDemo` after hotel seeding
  - _Requirements: 8.1_

- [x] 1.7 Add Firestore composite indexes
  - Update `firestore.indexes.json` with required indexes
  - cinemas by cityKey, showtimes by cinemaId+movieId+date
  - _Requirements: 1.2, 2.1, 2.3_

- [x] 2. Create cinema and movie services
- [x] 2.1 Create `src/services/cinemaService.ts`
  - Implement `searchCinemas(cityKey)` function
  - Implement `getMoviesByCinema(cinemaId)` function
  - Implement `getShowtimesByMovie(cinemaId, movieId)` function
  - Implement `getSeatMap(showtimeId)` function
  - Define TypeScript interfaces for Cinema, Movie, Showtime, Seat
  - _Requirements: 1.2, 2.1, 2.3, 4.1_

- [ ]* 2.2 Write property test for cinema filtering
  - **Property 1: Cinema location filtering**
  - **Validates: Requirements 1.2**

- [ ]* 2.3 Write property test for movie filtering
  - **Property 3: Movies filtered by cinema**
  - **Validates: Requirements 2.1**

- [ ]* 2.4 Write property test for showtime filtering
  - **Property 5: Showtimes filtered by cinema and movie**
  - **Validates: Requirements 2.3**

- [x] 3. Create movie booking service
- [x] 3.1 Create `src/services/movieBookingService.ts`
  - Implement `createMovieBooking(params)` function
  - Add validation for authentication, eKYC, account status
  - Add balance check and biometric requirement
  - Create booking and transaction records
  - Update account balance atomically
  - _Requirements: 6.1, 6.3, 6.4, 9.1, 9.3, 9.4, 9.5_

- [ ]* 3.2 Write property test for payment validation
  - **Property 17: Insufficient balance rejection**
  - **Property 18: High-value biometric requirement**
  - **Validates: Requirements 6.1, 6.3**

- [ ]* 3.3 Write property test for payment atomicity
  - **Property 19: Payment atomicity**
  - **Validates: Requirements 6.4**

- [ ]* 3.4 Write property test for authentication checks
  - **Property 21: Authentication requirement**
  - **Property 22: Locked account rejection**
  - **Property 23: eKYC verification requirement**
  - **Property 24: Transaction permission requirement**
  - **Validates: Requirements 9.1, 9.3, 9.4, 9.5**

- [x] 4. Create SeatMap component
- [x] 4.1 Create `src/components/SeatMap.tsx`
  - Render seat grid with rows and columns
  - Color-code seats by status (available, selected, occupied)
  - Handle seat click events
  - Display row labels (A-H) and seat numbers (1-12)
  - Show legend for seat status colors
  - _Requirements: 4.1, 4.2_

- [x] 4.2 Implement seat selection logic
  - Toggle seat selection on click
  - Prevent selection of occupied seats
  - Enforce maximum seat limit
  - Update total price on selection change
  - _Requirements: 4.3, 4.4, 4.5, 4.6_

- [ ]* 4.3 Write property test for seat selection
  - **Property 10: Seat selection increases price**
  - **Property 11: Seat deselection decreases price**
  - **Property 12: Occupied seats cannot be selected**
  - **Property 13: Maximum seat limit enforcement**
  - **Validates: Requirements 4.3, 4.4, 4.5, 4.6**

- [x] 5. Create MovieBooking page - Step 1 (Location & Cinema Selection)
- [x] 5.1 Create `src/pages/MovieBooking.tsx` with basic structure
  - Set up 3-step wizard state management
  - Add header with navigation
  - Add step indicators
  - _Requirements: 10.2_

- [x] 5.2 Implement Step 1 UI
  - Add location selection dropdown (reuse VN provinces)
  - Add cinema list display with cards
  - Add cinema selection handler
  - Show cinema details (name, address, rooms)
  - _Requirements: 1.1, 1.2_

- [x] 5.3 Implement location change handler
  - Clear cinema selection when location changes
  - Reload cinema list for new location
  - _Requirements: 1.4_

- [ ]* 5.4 Write property test for location change
  - **Property 2: Location change clears selection**
  - **Validates: Requirements 1.4**

- [x] 6. Create MovieBooking page - Step 2 (Movie & Showtime Selection)
- [x] 6.1 Implement movie list display
  - Show movies in grid layout with posters
  - Display movie title, genre, duration, rating
  - Add movie selection handler
  - _Requirements: 2.1, 2.2_

- [x] 6.2 Implement showtime selection
  - Display showtimes grouped by date
  - Show time, room, available seats
  - Mark sold-out showtimes
  - Add showtime selection handler
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 6.3 Integrate SeatMap component
  - Load seat map when showtime is selected
  - Handle seat selection events
  - Update total price display
  - Show selected seats summary
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 6.4 Write property test for showtime grouping
  - **Property 6: Showtime grouping preserves data**
  - **Validates: Requirements 3.1**

- [ ]* 6.5 Write property test for sold-out detection
  - **Property 8: Sold out detection**
  - **Validates: Requirements 3.4**

- [x] 7. Create MovieBooking page - Step 3 (Payment Confirmation)
- [x] 7.1 Implement payment summary display
  - Show cinema name, movie title, showtime
  - Display selected seats and total price
  - Show booking details in card layout
  - _Requirements: 5.1_

- [x] 7.2 Implement account selection
  - Fetch and display user accounts
  - Show account balances
  - Add account selection handler
  - _Requirements: 5.2_

- [x] 7.3 Implement payment handler
  - Validate seat selection (not empty)
  - Validate account selection
  - Check biometric for high-value transactions
  - Call `createMovieBooking` service
  - Navigate to receipt page on success
  - Display error messages on failure
  - _Requirements: 5.3, 6.1, 6.3, 6.4_

- [ ]* 7.4 Write property test for payment summary
  - **Property 14: Payment summary completeness**
  - **Property 15: Account ownership verification**
  - **Property 16: Empty seat selection blocks payment**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 8. Add navigation and routing
- [x] 8.1 Update app routing to include MovieBooking page
  - Add route in main router configuration
  - Add navigation from utilities menu
  - _Requirements: 1.1_

- [x] 8.2 Implement receipt page navigation
  - Pass booking data to receipt page
  - Format receipt with all required details
  - Add return to home button
  - _Requirements: 7.1, 7.2, 7.3_

- [ ]* 8.3 Write property test for receipt data
  - **Property 20: Receipt data completeness**
  - **Validates: Requirements 7.2**

- [x] 9. Add responsive design and polish


- [x] 9.1 Implement responsive layouts


  - Mobile-first grid layouts
  - Touch-friendly seat selection
  - Responsive movie poster grid
  - _Requirements: 10.1_

- [x] 9.2 Add loading states


  - Skeleton loaders for lists
  - Loading spinners for data fetching
  - Disabled states during processing
  - _Requirements: 10.3_

- [x] 9.3 Add error handling and messages


  - Toast notifications for errors
  - Vietnamese error messages
  - Clear guidance for error resolution
  - _Requirements: 10.4_

- [x] 9.4 Add visual feedback


  - Hover effects on interactive elements
  - Selected state indicators
  - Step progress visualization
  - _Requirements: 10.3_

- [ ] 10. Testing and validation
- [ ] 10.1 Run all property-based tests
  - Ensure all 24 properties pass
  - Verify 100+ iterations per property
  - _Requirements: All_

- [ ]* 10.2 Write integration tests for full booking flow
  - Test complete flow from location to payment
  - Verify account balance updates
  - Verify booking and transaction creation
  - _Requirements: 6.4_

- [ ] 10.3 Manual testing checklist
  - Test on mobile devices
  - Test with different screen sizes
  - Test error scenarios
  - Test edge cases (sold out, max seats, etc.)
  - _Requirements: 10.1_

- [ ] 11. Final checkpoint
- Ensure all tests pass, ask the user if questions arise.
