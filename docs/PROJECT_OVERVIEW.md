# VietBank - Digital Banking Application

## 📋 Project Overview

**VietBank** là ứng dụng ngân hàng số (Digital Banking) được xây dựng với React + TypeScript + Firebase, hỗ trợ đa nền tảng (Web, iOS, Android) thông qua Capacitor.

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: Tailwind CSS, shadcn/ui
- **Backend**: Firebase (Authentication, Realtime Database, Firestore, Cloud Functions)
- **Mobile**: Capacitor (iOS/Android native features)
- **Payment Gateway**: Stripe (for international card topup)
- **Image Storage**: Cloudinary
- **Email Service**: EmailJS
- **Testing**: Vitest, fast-check (property-based testing)

---

## 🏗️ Architecture

### Layered Architecture

```
┌─────────────────────────────────────────┐
│         UI Components (React)           │
│  - Pages (Home, Transfer, Booking...)   │
│  - Components (SeatMap, BottomNav...)   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Services (Business Logic)       │
│  - AuthService, TransferService...      │
│  - MovieBookingService, HotelService... │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Infrastructure (Firebase, APIs)    │
│  - Firebase Auth, RTDB, Firestore       │
│  - Cloudinary, EmailJS, Stripe, etc.    │
└─────────────────────────────────────────┘
```

### Database Structure

#### Firebase Realtime Database (RTDB)
```
/users/{uid}
  - profile data (username, email, role, ekycStatus...)
  - security (loginFailCount, pinFailCount...)

/accounts/{accountNumber}
  - uid, balance, status, pin, createdAt

/transactions/{transactionId}
  - type, status, amount, sourceAccount, destAccount...
  - requiresBiometric, biometricVerifiedAt

/transactionOtps/{transactionId}
  - otp, expireAt, attemptsLeft, used

/ekycSessions/{emailKey}
  - eKYC documents (frontIdUrl, backIdUrl, selfieUrl)
  - status (PENDING_REVIEW, VERIFIED, REJECTED)

/notifications/{uid}/{notificationId}
  - type, title, message, amount, createdAt

/savedRecipients/{uid}/{recipientKey}
  - name, accountNumber, bankName, nickname

/accountTransactions/{accountNumber}/{transactionId}
  - transaction history per account

/externalAccounts/{bankName}/{accountNumber}
  - external bank account data (for inter-bank transfers)
```

#### Firebase Firestore
```
/cinemas
  - cinema data (name, address, cityKey, lat, lon, rating)

/movies
  - movie data (title, genre, duration, posterUrl, trailerUrl)

/showtimes
  - showtime data (cinemaId, movieId, date, time, occupiedSeats)

/movie_bookings
  - booking records (userId, cinemaId, movieId, selectedSeats)

/hotels
  - hotel data (name, cityKey, stars, rating, priceFrom)

/hotel_rooms
  - room data (hotelId, name, pricePerNight, perks)

/hotel_bookings
  - booking records (customerUid, hotelId, roomId, checkIn, checkOut)

/transactions
  - transaction records (type, amount, status, metadata)
```

---

## 🔐 Security Features

### 1. Authentication & Authorization
- **Email/Password Login** with Firebase Auth
- **Biometric Login** (Fingerprint/FaceID) - demo mode
- **Login Lock**: 5 failed attempts → account locked
- **Role-Based Access Control**: CUSTOMER vs OFFICER

### 2. eKYC (Electronic Know Your Customer)
- **Document Upload**: Front ID, Back ID, Selfie (Cloudinary)
- **Officer Review**: Approve/Reject workflow
- **CIF Assignment**: Automatic Customer Identification Number
- **Transaction Permission**: Only verified users can transact

### 3. Transaction Security
- **PIN Verification**: 6-digit transaction PIN
- **PIN Lock**: 5 failed attempts → account locked
- **OTP Verification**: Email OTP for transfers (2-minute expiry)
- **Biometric Auth**: Required for transactions >= 10M VND
- **Atomic Operations**: Firebase transactions prevent race conditions

### 4. Account Security
- **Strong Password Policy**: 8+ chars, 1 uppercase, 1 number, 1 special
- **Password Change**: Requires current password + reauthentication
- **PIN Change**: Requires current PIN verification
- **Account Lock**: Manual lock by officer or auto-lock on security violations

---

## 💰 Core Features

### 1. Account Management
- **Payment Account**: Primary account for transactions
- **Savings Account**: Interest-bearing savings (future)
- **Mortgage Account**: Loan tracking (future)
- **Balance Display**: Real-time balance updates
- **Transaction History**: Detailed transaction logs

### 2. Money Transfer
- **Internal Transfer**: VietBank → VietBank (instant, free)
- **External Transfer**: VietBank → Other banks (via external accounts)
- **Transfer Flow**:
  1. Enter recipient details + amount
  2. Verify PIN
  3. Biometric auth (if >= 10M VND)
  4. Receive OTP via email
  5. Confirm with OTP → Transfer executed
- **Saved Recipients**: Save frequently used recipients
- **Transfer Receipt**: Detailed receipt with transaction ID

### 3. Deposit & Withdrawal
- **Cash Deposit**: Deposit cash with PIN verification
- **Cash Withdrawal**: 
  - Simple withdrawal (PIN only)
  - OTP Withdrawal (PIN + Email OTP for security)
- **Stripe Topup**: International card deposit (future)
- **Balance Notifications**: Real-time notifications on balance changes

### 4. Movie Booking
- **Cinema Search**: Search by location (VN provinces + international)
- **Movie Selection**: Browse movies with trailers
- **Seat Selection**: Interactive seat map (8 rows × 12 seats)
- **Real-time Availability**: Occupied seats shown in red
- **Payment**: Deduct from payment account
- **Biometric Auth**: Required for bookings >= 10M VND
- **Booking Confirmation**: Receipt with QR code

### 5. Hotel Booking
- **Hotel Search**: Search by location + dates
- **Room Availability**: Automatic filtering of booked rooms
- **Date Overlap Detection**: Check-in 14:00, Check-out 12:00
- **Room Selection**: Choose room type (Standard, Deluxe, Suite...)
- **Payment**: Deduct from payment account
- **Biometric Auth**: Required for bookings >= 10M VND
- **Booking Confirmation**: Receipt with booking details

### 6. Utility Bills (Future)
- **Mobile Topup**: Prepaid mobile recharge
- **Electricity Bills**: Pay electricity bills
- **Water Bills**: Pay water bills
- **Internet Bills**: Pay internet bills

### 7. Officer Portal
- **Dashboard**: Overview of pending tasks
- **eKYC Review**: Approve/reject customer eKYC
- **Customer Management**: View/edit customer profiles
- **Account Management**: Create/lock accounts
- **Transaction Monitoring**: View all transactions
- **Rate Management**: Update interest rates

---

## 🎯 Key Technical Implementations

### 1. Real-time Seat Booking
```typescript
// Update occupied seats atomically
await updateDoc(showtimeRef, {
  occupiedSeats: arrayUnion(...selectedSeats)
});
```

### 2. Room Availability Check
```typescript
// Check date overlap: checkIn < existingCheckOut AND checkOut > existingCheckIn
const requestCheckIn = new Date(`${checkIn}T14:00:00`).getTime();
const requestCheckOut = new Date(`${checkOut}T12:00:00`).getTime();

if (requestCheckIn < existingCheckOut && requestCheckOut > existingCheckIn) {
  return false; // Room is booked
}
```

### 3. Atomic Balance Deduction
```typescript
await runTransaction(accountRef, (current) => {
  const balance = current.balance;
  if (balance < amount) {
    throw new Error("Insufficient balance");
  }
  return { ...current, balance: balance - amount };
});
```

### 4. Seeded Random for Consistent Data
```typescript
// Linear Congruential Generator (LCG)
function seededRandom(seed) {
  let state = seed;
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const random = seededRandom(12345); // Same seed = same data across machines
```

### 5. Biometric Authentication
```typescript
// Check if transaction requires biometric
if (amount >= 10_000_000) {
  const result = await requireBiometricForHighValueVnd(amount);
  if (!result.success) {
    throw new Error("Biometric authentication failed");
  }
}
```

### 6. OTP Email Flow
```typescript
// 1. Generate OTP
const otp = generateOtpCode(6);
const expireAt = Date.now() + 2 * 60 * 1000; // 2 minutes

// 2. Save to RTDB
await set(ref(firebaseRtdb, `transactionOtps/${txnId}`), {
  otp, expireAt, attemptsLeft: 5, used: false
});

// 3. Send via EmailJS or Apps Script
await sendOtpEmail(email, otp, txnId);

// 4. Verify OTP
if (otpInput !== storedOtp) {
  attemptsLeft--;
  throw new Error(`Wrong OTP. ${attemptsLeft} attempts left.`);
}
```

---

## 📊 Data Flow Examples

### Transfer Flow
```
User Input → TransferService.initiateTransferToAccount()
  ↓
1. Validate user (eKYC, canTransact, account status)
2. Validate source account (balance, status)
3. Validate destination account (internal/external)
4. Create transaction (status: PENDING_OTP)
5. Generate OTP + save to RTDB
6. Send OTP email
  ↓
User enters OTP → TransferService.confirmTransferWithOtp()
  ↓
1. Verify OTP (expiry, attempts, correctness)
2. Check biometric (if >= 10M VND)
3. Deduct from source account (atomic transaction)
4. Credit to destination account (if internal)
5. Update transaction status (SUCCESS)
6. Create notifications (sender + receiver)
7. Return receipt
```

### Movie Booking Flow
```
User selects cinema → CinemaService.searchCinemas()
  ↓
User selects movie → CinemaService.getAllMovies()
  ↓
User selects showtime → CinemaService.getShowtimesByMovie()
  ↓
User selects seats → CinemaService.getSeatMap()
  ↓
User confirms → MovieBookingService.createMovieBooking()
  ↓
1. Validate user (eKYC, canTransact)
2. Validate account (balance, status)
3. Check biometric (if >= 10M VND)
4. Update showtime.occupiedSeats (atomic)
5. Deduct from account (atomic transaction)
6. Create booking record
7. Create transaction record
8. Send notification
9. Return receipt
```

### Hotel Booking Flow
```
User searches → HotelService.searchHotels()
  ↓
User selects hotel → HotelBookingService.fetchHotelRooms()
  ↓ (filters out booked rooms by checking date overlap)
User selects room → HotelBookingService.createHotelBooking()
  ↓
1. Validate user (eKYC, canTransact)
2. Validate account (balance, status)
3. Check biometric (if >= 10M VND)
4. Deduct from account (atomic transaction)
5. Create booking record (with checkInDateTime, checkOutDateTime)
6. Create transaction record
7. Send notification
8. Return receipt
```

---

## 🧪 Testing Strategy

### 1. Property-Based Testing (fast-check)
```typescript
// Test: Balance never goes negative
fc.assert(
  fc.property(fc.nat(), fc.nat(), (balance, amount) => {
    if (balance < amount) {
      expect(() => deduct(balance, amount)).toThrow();
    } else {
      expect(deduct(balance, amount)).toBe(balance - amount);
    }
  })
);
```

### 2. Test Categories
- **Input Validation**: Test invalid inputs (negative amounts, empty strings...)
- **eKYC Validation**: Test eKYC status checks
- **Account Ownership**: Test account access control
- **Input Normalization**: Test Vietnamese text normalization
- **Booking Integrity**: Test booking atomicity
- **Transaction Integrity**: Test transaction consistency
- **Transaction Atomicity**: Test concurrent transactions
- **Cache Behavior**: Test data caching
- **Biometric Threshold**: Test 10M VND threshold
- **UI Visibility**: Test conditional rendering

---

## 📱 Mobile Features (Capacitor)

### Native Plugins Used
- **@capacitor/geolocation**: GPS location for hotel/cinema search
- **@capacitor/camera**: Take photos for eKYC
- **@capacitor/biometric**: Fingerprint/FaceID authentication
- **@capacitor/push-notifications**: Push notifications (future)
- **@capacitor/local-notifications**: Local notifications (future)

### Platform-Specific Code
```typescript
// Check if running on native platform
const isNative = Capacitor.isNativePlatform();

// Use Capacitor Geolocation on mobile, fallback to browser API on web
if (isNative) {
  const pos = await Geolocation.getCurrentPosition();
} else {
  navigator.geolocation.getCurrentPosition(...);
}
```

---

## 🚀 Deployment

### Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Start Firebase emulators
npm run emulator

# Seed demo data
node scripts/seed-emulator.js
```

### Production Build
```bash
# Build for web
npm run build

# Build for Android
npx cap sync android
npx cap open android

# Build for iOS
npx cap sync ios
npx cap open ios
```

### Firebase Deployment
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Cloud Functions
firebase deploy --only functions

# Deploy hosting
firebase deploy --only hosting
```

---

## 📚 Documentation

### Key Documents
- **Class Diagram**: `docs/vietbank-class-diagram.puml`
- **Booking Availability**: `.kiro/docs/booking-availability-implementation.md`
- **Seeded Random**: `.kiro/docs/seeded-random-implementation.md`
- **Spec Files**: `.kiro/specs/*/requirements.md`, `design.md`, `tasks.md`

### Code Organization
```
src/
├── components/        # Reusable UI components
│   ├── ui/           # shadcn/ui components
│   ├── map/          # Map components
│   └── *.tsx         # Custom components
├── pages/            # Page components (routes)
│   ├── utilities/    # Utility pages
│   └── *.tsx         # Main pages
├── services/         # Business logic services
│   ├── authService.ts
│   ├── transferService.ts
│   ├── movieBookingService.ts
│   └── ...
├── hooks/            # Custom React hooks
├── lib/              # Utilities (firebase, utils)
└── test/             # Test files
    └── properties/   # Property-based tests
```

---

## 🔮 Future Enhancements

### Planned Features
1. **Savings Account**: Interest calculation, auto-transfer
2. **Loan Management**: Mortgage tracking, payment schedule
3. **Investment**: Stocks, bonds, mutual funds
4. **Insurance**: Life, health, property insurance
5. **Credit Card**: Virtual card, spending limits
6. **Bill Payment**: Electricity, water, internet, phone
7. **QR Payment**: Scan QR to pay merchants
8. **P2P Transfer**: Transfer by phone number
9. **Recurring Transfers**: Schedule automatic transfers
10. **Multi-currency**: Support USD, EUR, JPY...

### Technical Improvements
1. **Real-time Updates**: WebSocket for live balance updates
2. **Offline Mode**: Cache data for offline access
3. **Push Notifications**: Real-time transaction alerts
4. **Biometric Enrollment**: Secure biometric registration
5. **Advanced Analytics**: Spending insights, budgeting
6. **AI Chatbot**: Customer support chatbot
7. **Blockchain**: Immutable transaction ledger
8. **GraphQL API**: Replace REST with GraphQL

---

## 👥 Team & Contribution

### Development Team
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Firebase (Auth, RTDB, Firestore, Functions)
- **Mobile**: Capacitor (iOS/Android)
- **Testing**: Vitest + fast-check

### Contribution Guidelines
1. Follow TypeScript strict mode
2. Use ESLint + Prettier for code formatting
3. Write property-based tests for critical logic
4. Document complex algorithms
5. Use semantic commit messages
6. Create PR with clear description

---

## 📄 License

This project is for educational purposes only. Not for commercial use.

---

## 📞 Contact

For questions or support, please contact the development team.

**VietBank** - Digital Banking Made Simple 🏦
