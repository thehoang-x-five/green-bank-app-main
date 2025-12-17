# Requirements Document - Movie Ticket Booking

## Introduction

This specification defines the requirements for a movie ticket booking feature within the Viet Bank TQT mobile banking application. The feature allows users to browse cinemas by location, select movies and showtimes, choose seats, and complete payment transactions using their bank accounts.

## Glossary

- **System**: The movie ticket booking module within the Viet Bank TQT application
- **User**: An authenticated customer of Viet Bank TQT with a verified account
- **Cinema**: A movie theater location with multiple screening rooms
- **Movie**: A film available for viewing with associated metadata (title, poster, duration, genre, rating)
- **Showtime**: A scheduled screening of a movie at a specific cinema, date, and time
- **Seat**: An individual seat in a cinema room with a unique identifier (row and number)
- **Booking**: A confirmed reservation for specific seats at a showtime
- **Transaction**: A payment record for a booking using a user's bank account

## Requirements

### Requirement 1

**User Story:** As a user, I want to select a cinema by location, so that I can find movie theaters near me.

#### Acceptance Criteria

1. WHEN the user opens the movie booking page THEN the System SHALL display location selection options for Vietnam provinces and cities
2. WHEN the user selects a province or city THEN the System SHALL load and display all cinemas in that location
3. WHEN no cinemas are available in the selected location THEN the System SHALL display a message indicating no cinemas found
4. WHEN the user changes the selected location THEN the System SHALL clear the current cinema selection and reload cinema options

### Requirement 2

**User Story:** As a user, I want to browse available movies at a selected cinema, so that I can choose what to watch.

#### Acceptance Criteria

1. WHEN the user selects a cinema THEN the System SHALL display all movies currently showing at that cinema with poster images
2. WHEN displaying movies THEN the System SHALL show movie title, genre, duration, and rating for each movie
3. WHEN the user clicks on a movie THEN the System SHALL display available showtimes for that movie at the selected cinema
4. WHEN no movies are available at the selected cinema THEN the System SHALL display a message indicating no movies found

### Requirement 3

**User Story:** As a user, I want to select a showtime and date, so that I can book tickets for a specific screening.

#### Acceptance Criteria

1. WHEN the user selects a movie THEN the System SHALL display available showtimes grouped by date
2. WHEN displaying showtimes THEN the System SHALL show the screening time, available seats count, and room number
3. WHEN the user selects a showtime THEN the System SHALL proceed to seat selection
4. WHEN a showtime is fully booked THEN the System SHALL disable selection and display "Sold Out" status

### Requirement 4

**User Story:** As a user, I want to select seats from a visual seat map, so that I can choose my preferred seating location.

#### Acceptance Criteria

1. WHEN the user enters seat selection THEN the System SHALL display a visual seat map showing all seats in the cinema room
2. WHEN displaying the seat map THEN the System SHALL indicate seat status (available, selected, occupied) with distinct visual markers
3. WHEN the user clicks an available seat THEN the System SHALL mark it as selected and update the total price
4. WHEN the user clicks a selected seat THEN the System SHALL deselect it and update the total price
5. WHEN the user attempts to select an occupied seat THEN the System SHALL prevent selection and display a message
6. WHEN the user selects the maximum allowed seats THEN the System SHALL prevent further seat selection

### Requirement 5

**User Story:** As a user, I want to review my booking details before payment, so that I can verify my selection is correct.

#### Acceptance Criteria

1. WHEN the user proceeds to payment THEN the System SHALL display a summary including cinema name, movie title, showtime, selected seats, and total price
2. WHEN displaying the payment summary THEN the System SHALL show the user's available bank accounts with current balances
3. WHEN the user has not selected any seats THEN the System SHALL prevent proceeding to payment
4. WHEN the booking details are displayed THEN the System SHALL allow the user to return to previous steps to modify selections

### Requirement 6

**User Story:** As a user, I want to complete payment using my bank account, so that I can confirm my movie ticket booking.

#### Acceptance Criteria

1. WHEN the user selects a source account and confirms payment THEN the System SHALL validate the account has sufficient balance
2. WHEN the account balance is insufficient THEN the System SHALL display an error message with the required amount and available balance
3. WHEN the payment amount is greater than or equal to 10,000,000 VND THEN the System SHALL require biometric authentication
4. WHEN payment is successful THEN the System SHALL create a booking record, deduct the amount from the account, and display a success confirmation
5. WHEN payment fails THEN the System SHALL display an error message and allow the user to retry

### Requirement 7

**User Story:** As a user, I want to see a confirmation receipt after successful booking, so that I have proof of my purchase.

#### Acceptance Criteria

1. WHEN payment is successful THEN the System SHALL navigate to a receipt page displaying booking details
2. WHEN displaying the receipt THEN the System SHALL show transaction ID, cinema name, movie title, showtime, seat numbers, total amount, and transaction timestamp
3. WHEN the receipt is displayed THEN the System SHALL provide an option to return to the home screen

### Requirement 8

**User Story:** As a system administrator, I want cinema and movie data to be seeded in Firestore, so that users have content to browse without requiring external API calls.

#### Acceptance Criteria

1. WHEN the Firebase emulator starts THEN the System SHALL seed cinema data for major Vietnamese cities if not already present
2. WHEN seeding cinemas THEN the System SHALL include cinema name, location, address, and room configurations
3. WHEN the Firebase emulator starts THEN the System SHALL seed movie data with titles, posters, genres, durations, and ratings
4. WHEN seeding movies THEN the System SHALL create showtimes for each movie at each cinema
5. WHEN seeding showtimes THEN the System SHALL generate seat maps with available and occupied seats

### Requirement 9

**User Story:** As a user, I want the booking process to validate my account status, so that only verified users can make bookings.

#### Acceptance Criteria

1. WHEN the user attempts to make a payment THEN the System SHALL verify the user is authenticated
2. WHEN the user is not authenticated THEN the System SHALL display an error message requiring login
3. WHEN the user's account status is LOCKED THEN the System SHALL prevent payment and display an error message
4. WHEN the user's eKYC status is not VERIFIED THEN the System SHALL prevent payment and display an error message
5. WHEN the user's account does not have transaction permissions THEN the System SHALL prevent payment and display an error message

### Requirement 10

**User Story:** As a user, I want the interface to be responsive and user-friendly, so that I can easily navigate the booking process on mobile devices.

#### Acceptance Criteria

1. WHEN the user views the booking page on mobile THEN the System SHALL display a responsive layout optimized for small screens
2. WHEN the user navigates between steps THEN the System SHALL provide clear visual indicators of the current step
3. WHEN the user interacts with form elements THEN the System SHALL provide immediate visual feedback
4. WHEN errors occur THEN the System SHALL display clear, user-friendly error messages in Vietnamese
