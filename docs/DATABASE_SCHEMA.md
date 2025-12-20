# VietBank Database Schema Documentation

## 📊 Overview

VietBank sử dụng **hybrid database architecture** với 2 loại database:

1. **Firebase Realtime Database (RTDB)**: Real-time data, user profiles, accounts, transactions
2. **Firebase Firestore**: Document-based data, cinemas, hotels, bookings

---

## 🗄️ Database Architecture

### Why Hybrid Architecture?

| Feature | RTDB | Firestore |
|---------|------|-----------|
| **Data Model** | JSON tree | Document collections |
| **Real-time** | ✅ Excellent | ✅ Good |
| **Queries** | Limited | ✅ Rich queries |
| **Transactions** | ✅ Atomic | ✅ ACID |
| **Offline** | ✅ Good | ✅ Excellent |
| **Pricing** | Per GB stored + downloaded | Per read/write/delete |
| **Best For** | User data, balances, real-time updates | Complex queries, large datasets |

### Our Usage:

**RTDB** → User profiles, bank accounts, transactions (need real-time balance updates)
**Firestore** → Cinemas, hotels, bookings (need complex queries by location, date)

---

## 📋 Firebase Realtime Database (RTDB) Schema

### 1. `/users/{uid}`
**Purpose**: User profiles (customers & officers)

```json
{
  "uid": "abc123",
  "username": "Nguyễn Văn A",
  "email": "user@example.com",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "ekycStatus": "VERIFIED",
  "canTransact": true,
  "createdAt": 1703001234567,
  
  "phone": "0901234567",
  "gender": "male",
  "dob": "1990-01-01",
  "nationalId": "001234567890",
  "cif": "CIF0001",
  
  "transactionPinHash": "base64hash",
  "pinFailCount": 0,
  "loginFailCount": 0
}
```

**Indexes**:
- `email` (unique) - for login
- `nationalId` (unique) - for eKYC
- `cif` (unique) - customer ID

**Business Rules**:
- `ekycStatus = VERIFIED` + `canTransact = true` → can make transactions
- `loginFailCount >= 5` → `status = LOCKED`
- `pinFailCount >= 5` → `status = LOCKED`

---

### 2. `/accounts/{accountNumber}`
**Purpose**: Bank accounts (payment accounts)

```json
{
  "accountNumber": "123456789012",
  "uid": "abc123",
  "balance": 1000000,
  "status": "ACTIVE",
  "pin": "123456",
  "createdAt": 1703001234567
}
```

**Key**: `accountNumber` (12-digit string)

**Indexes**:
- `uid` (for querying user's accounts)

**Business Rules**:
- Balance updated **atomically** via `runTransaction()`
- PIN required for all transactions
- One user can have multiple accounts

**Atomic Balance Update Example**:
```typescript
await runTransaction(accountRef, (current) => {
  if (current.balance < amount) {
    throw new Error("Insufficient balance");
  }
  return { ...current, balance: current.balance - amount };
});
```

---

### 3. `/transactions/{transactionId}`
**Purpose**: All financial transactions

```json
{
  "transactionId": "TXN000001",
  "type": "TRANSFER_INTERNAL",
  "status": "SUCCESS",
  "customerUid": "abc123",
  
  "sourceAccountNumber": "123456789012",
  "destinationAccountNumber": "987654321098",
  "destinationName": "Nguyễn Văn B",
  "destinationBankName": "VietBank",
  
  "amount": 500000,
  "fee": 0,
  "content": "Chuyển tiền",
  "createdAt": 1703001234567,
  "executedAt": 1703001235000,
  
  "isInternal": true,
  "requiresBiometric": false
}
```

**Key**: `transactionId` (auto-increment: TXN000001, TXN000002...)

**Types**:
- `TRANSFER_INTERNAL`: VietBank → VietBank
- `TRANSFER_EXTERNAL`: VietBank → Other banks
- `CASH_DEPOSIT`: Deposit cash
- `CASH_WITHDRAW`: Withdraw cash
- `MOVIE_BOOKING`: Movie ticket payment
- `HOTEL_BOOKING`: Hotel room payment

**Status Flow**:
```
PENDING_OTP → PROCESSING → SUCCESS
                         ↘ FAILED
```

**Business Rules**:
- `requiresBiometric = true` if `amount >= 10,000,000 VND`
- OTP required for all transfers
- Atomic balance deduction from source account
- Atomic balance credit to destination account (if internal)

---

### 4. `/transactionOtps/{transactionId}`
**Purpose**: OTP verification for transactions

```json
{
  "transactionId": "TXN000001",
  "uid": "abc123",
  "email": "user@example.com",
  "otp": "123456",
  "createdAt": 1703001234567,
  "expireAt": 1703001354567,
  "attemptsLeft": 5,
  "used": false
}
```

**Key**: `transactionId` (1-to-1 with transaction)

**Business Rules**:
- OTP expires after **2 minutes**
- Max **5 attempts**
- One-time use only (`used = true` after verification)
- Sent via email (EmailJS or Apps Script)

---

### 5. `/ekycSessions/{emailKey}`
**Purpose**: eKYC document submissions

```json
{
  "emailKey": "user_example_com",
  "uid": "abc123",
  "email": "user@example.com",
  "fullName": "Nguyễn Văn A",
  "dob": "1990-01-01",
  "nationalId": "001234567890",
  "address": "123 Đường ABC, TP.HCM",
  
  "frontIdUrl": "https://cloudinary.com/...",
  "backIdUrl": "https://cloudinary.com/...",
  "selfieUrl": "https://cloudinary.com/...",
  
  "status": "PENDING_REVIEW",
  "submittedAt": 1703001234567,
  "cif": "CIF0001"
}
```

**Key**: `emailKey` (email with special chars replaced: `user@example.com` → `user_example_com`)

**Status Flow**:
```
PENDING_CUSTOMER → PENDING_REVIEW → VERIFIED
                                  ↘ REJECTED
```

**Business Rules**:
- Officer reviews and approves/rejects
- Upon approval: `users/{uid}/ekycStatus = VERIFIED` + assign CIF
- Images stored in Cloudinary

---

### 6. `/notifications/{uid}/{notificationId}`
**Purpose**: User notifications (balance changes, system alerts)

```json
{
  "notificationId": "notif123",
  "uid": "abc123",
  "type": "BALANCE_CHANGE",
  "direction": "OUT",
  "title": "Chuyển tiền đến Nguyễn Văn B",
  "message": "Đã chuyển 500,000 VND",
  "amount": 500000,
  "accountNumber": "123456789012",
  "balanceAfter": 500000,
  "transactionId": "TXN000001",
  "createdAt": 1703001234567,
  "read": false
}
```

**Types**:
- `BALANCE_CHANGE`: Money in/out
- `SYSTEM`: System announcements
- `PROMOTION`: Marketing messages

**Direction**:
- `IN`: Money received
- `OUT`: Money sent

---

### 7. `/accountTransactions/{accountNumber}/{transactionId}`
**Purpose**: Transaction history per account

```json
{
  "transactionId": "TXN000001",
  "type": "TRANSFER_INTERNAL",
  "direction": "OUT",
  "amount": 500000,
  "content": "Chuyển tiền",
  "createdAt": 1703001234567,
  "executedAt": 1703001235000,
  "destinationAccountNumber": "987654321098",
  "destinationBankName": "VietBank"
}
```

**Purpose**: Fast query of account history without scanning all transactions

---

### 8. `/savedRecipients/{uid}/{recipientKey}`
**Purpose**: Saved transfer recipients

```json
{
  "recipientKey": "VIETBANK_987654321098",
  "name": "Nguyễn Văn B",
  "accountNumber": "987654321098",
  "bankName": "VietBank",
  "bankCode": "VIETBANK",
  "nickname": "Anh B",
  "updatedAt": 1703001234567
}
```

**Key**: `recipientKey` = `{bankCode}_{accountNumber}`

---

### 9. `/counters/{counterName}`
**Purpose**: Auto-increment counters

```json
{
  "transactionCounter": 123,
  "cifCounter": 45
}
```

**Usage**:
```typescript
const txnId = await generateNextTransactionId();
// Returns: "TXN000124"

const cif = await generateNextCif();
// Returns: "CIF0046"
```

**Updated atomically** via `runTransaction()`

---

## 📄 Firebase Firestore Schema

### 1. `cinemas` Collection
**Purpose**: Movie theater data

```json
{
  "id": "cinema1",
  "name": "CGV Vincom Center",
  "address": "72 Lê Thánh Tôn, Q.1, TP.HCM",
  "cityKey": "VN_HCM",
  "lat": 10.7769,
  "lon": 106.7009,
  "rooms": 8,
  "rating": 4.5
}
```

**Indexes**:
- `cityKey` (for location-based search)

---

### 2. `movies` Collection
**Purpose**: Movie information

```json
{
  "id": "movie1",
  "title": "Avengers: Endgame",
  "genre": "Action, Sci-Fi",
  "duration": 181,
  "rating": "PG-13",
  "description": "After the devastating events...",
  "posterUrl": "https://picsum.photos/...",
  "trailerUrl": "https://youtube.com/...",
  "images": ["url1", "url2", "url3"]
}
```

---

### 3. `showtimes` Collection
**Purpose**: Movie showtimes

```json
{
  "id": "showtime1",
  "cinemaId": "cinema1",
  "movieId": "movie1",
  "date": "2024-12-25",
  "time": "19:30",
  "room": 5,
  "totalSeats": 96,
  "occupiedSeats": ["A1", "A2", "B5"],
  "pricePerSeat": 80000
}
```

**Indexes**:
- `cinemaId` (for cinema's showtimes)
- `movieId` (for movie's showtimes)
- `date` (for date filtering)

**Business Rules**:
- `occupiedSeats` updated **atomically** via `arrayUnion()`
- Prevents double-booking
- 96 seats total (8 rows × 12 seats: A1-A12, B1-B12, ..., H1-H12)

**Atomic Seat Booking**:
```typescript
await updateDoc(showtimeRef, {
  occupiedSeats: arrayUnion(...selectedSeats)
});
```

---

### 4. `movie_bookings` Collection
**Purpose**: Movie ticket bookings

```json
{
  "id": "booking1",
  "userId": "abc123",
  "cinemaId": "cinema1",
  "cinemaName": "CGV Vincom Center",
  "movieId": "movie1",
  "movieTitle": "Avengers: Endgame",
  "showtimeId": "showtime1",
  "date": "2024-12-25",
  "time": "19:30",
  "room": 5,
  "selectedSeats": ["A1", "A2"],
  "totalAmount": 160000,
  "accountId": "123456789012",
  "status": "confirmed",
  "createdAt": 1703001234567
}
```

**Indexes**:
- `userId` (for user's bookings)

---

### 5. `hotels` Collection
**Purpose**: Hotel information

```json
{
  "id": "hotel1",
  "name": "Grand Hanoi Hotel",
  "cityKey": "VN_HN",
  "lat": 21.0285,
  "lon": 105.8542,
  "stars": 4,
  "rating": 4.2,
  "priceFrom": 850000,
  "distanceToCenterKm": 1.5,
  "amenities": ["wifi", "breakfast", "pool"],
  "images": ["url1", "url2"]
}
```

**Indexes**:
- `cityKey` (for location-based search)

---

### 6. `hotel_rooms` Collection
**Purpose**: Hotel room types

```json
{
  "id": "room1",
  "hotelId": "hotel1",
  "name": "Deluxe Room",
  "pricePerNight": 1200000,
  "perks": ["Wifi", "Minibar", "City view"],
  "refundable": true
}
```

**Indexes**:
- `hotelId` (for hotel's rooms)

---

### 7. `hotel_bookings` Collection
**Purpose**: Hotel room bookings

```json
{
  "id": "booking1",
  "status": "PAID",
  "customerUid": "abc123",
  "hotelId": "hotel1",
  "hotelName": "Grand Hanoi Hotel",
  "roomId": "room1",
  "roomName": "Deluxe Room",
  
  "checkIn": "2024-12-25",
  "checkOut": "2024-12-27",
  "checkInDateTime": 1703494800000,
  "checkOutDateTime": 1703667600000,
  "nights": 2,
  
  "guests": 2,
  "rooms": 1,
  "total": 2400000,
  
  "transactionId": "TXN000001",
  "createdAt": 1703001234567
}
```

**Indexes**:
- `customerUid` (for user's bookings)
- `checkInDateTime` (for availability check)
- `checkOutDateTime` (for availability check)

**Business Rules**:
- Check-in: **14:00** (2 PM)
- Check-out: **12:00** (noon)

**Availability Check**:
```typescript
// Room is unavailable if date ranges overlap
const overlap = 
  requestCheckIn < existingCheckOut && 
  requestCheckOut > existingCheckIn;
```

**Example**:
- Existing booking: Dec 20 (14:00) → Dec 22 (12:00)
- New request: Dec 21 (14:00) → Dec 23 (12:00)
- Result: ❌ Overlap detected → Room unavailable

---

## 🔗 Cross-Database Relationships

### Logical Foreign Keys (Not Enforced)

| RTDB Entity | Firestore Entity | Relationship |
|-------------|------------------|--------------|
| `users/{uid}` | `movie_bookings.userId` | User places movie bookings |
| `users/{uid}` | `hotel_bookings.customerUid` | User places hotel bookings |
| `accounts/{accountNumber}` | `movie_bookings.accountId` | Account pays for booking |
| `transactions/{transactionId}` | `hotel_bookings.transactionId` | Transaction for booking |

**Note**: Firebase doesn't enforce foreign key constraints. Application logic must ensure referential integrity.

---

## 🔒 Security Rules

### RTDB Rules (Example)
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'OFFICER'",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'OFFICER'"
      }
    },
    "accounts": {
      "$accountNumber": {
        ".read": "data.child('uid').val() === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'OFFICER'",
        ".write": false
      }
    }
  }
}
```

### Firestore Rules (Example)
```javascript
match /movie_bookings/{bookingId} {
  allow read: if request.auth != null && 
    (resource.data.userId == request.auth.uid || 
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'OFFICER');
  allow create: if request.auth != null && 
    request.resource.data.userId == request.auth.uid;
  allow update, delete: if false;
}
```

---

## 📈 Performance Optimization

### Indexes

**RTDB**:
- Query by `email`: `.indexOn: ["email"]`
- Query by `uid`: `.indexOn: ["uid"]`

**Firestore**:
- Composite index: `(cityKey, priceFrom)` for hotel search
- Composite index: `(cinemaId, movieId, date)` for showtime search
- Composite index: `(roomId, checkInDateTime, checkOutDateTime)` for availability

### Caching Strategy

1. **User Profile**: Cache in memory after login
2. **Account Balance**: Real-time listener for updates
3. **Cinema/Hotel Data**: Cache for 1 hour (rarely changes)
4. **Showtimes**: Cache for 5 minutes (occupiedSeats changes frequently)

---

## 🔄 Data Migration

### Seed Data Scripts

**Location**: `functions/cinemaSeedData.js`, `functions/hotelSeedData.js`

**Features**:
- **Seeded Random**: Consistent data across machines (LCG algorithm)
- **Cinema Seed**: 12345
- **Hotel Seed**: 54321

**Run Seed**:
```bash
node scripts/seed-emulator.js
```

---

## 📊 Database Size Estimates

| Collection/Path | Documents | Avg Size | Total |
|----------------|-----------|----------|-------|
| `users` | 10,000 | 2 KB | 20 MB |
| `accounts` | 15,000 | 0.5 KB | 7.5 MB |
| `transactions` | 100,000 | 1 KB | 100 MB |
| `cinemas` | 50 | 1 KB | 50 KB |
| `movies` | 100 | 2 KB | 200 KB |
| `showtimes` | 5,000 | 1 KB | 5 MB |
| `hotels` | 500 | 2 KB | 1 MB |
| `hotel_rooms` | 2,000 | 0.5 KB | 1 MB |
| **Total** | | | **~135 MB** |

---

## 🚀 Backup & Recovery

### Firebase Automatic Backups
- **RTDB**: Daily backups (retained for 30 days)
- **Firestore**: Point-in-time recovery (up to 7 days)

### Manual Export
```bash
# Export RTDB
firebase database:get / > backup.json

# Export Firestore
gcloud firestore export gs://bucket-name/backup
```

---

## 📞 Support

For database schema questions, refer to:
1. This document
2. ERD diagram: `docs/vietbank-erd.puml`
3. Source code with inline comments

---

**VietBank Database Schema** - Last updated: 2024-12-20
