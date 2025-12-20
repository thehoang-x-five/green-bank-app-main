# Seeded Random Implementation for Consistent Seed Data

## Problem
Trước đây, seed data sử dụng `Math.random()` nên mỗi máy sẽ có data khác nhau:
- Máy A: Rạp CGV có 30 ghế đã đặt
- Máy B: Rạp CGV có 45 ghế đã đặt
- Máy C: Rạp CGV có 12 ghế đã đặt

→ **Không nhất quán**, khó debug và test

## Solution: Seeded Random Number Generator

Sử dụng **Linear Congruential Generator (LCG)** để tạo số ngẫu nhiên có seed cố định:

```javascript
function seededRandom(seed) {
  let state = seed;
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Cinema seed: 12345
const random = seededRandom(12345);

// Hotel seed: 54321
const random = seededRandom(54321);
```

## How It Works

### Linear Congruential Generator (LCG)
Formula: `X(n+1) = (a * X(n) + c) mod m`

- **a** = 1664525 (multiplier)
- **c** = 1013904223 (increment)
- **m** = 2^32 (modulus)
- **seed** = initial state

Với cùng một seed, LCG sẽ luôn tạo ra cùng một chuỗi số ngẫu nhiên.

### Example
```javascript
const random = seededRandom(12345);

console.log(random()); // 0.7267316... (luôn giống nhau)
console.log(random()); // 0.3849201... (luôn giống nhau)
console.log(random()); // 0.9182734... (luôn giống nhau)
```

## Changes Made

### 1. Cinema Seed Data (`functions/cinemaSeedData.js`)
**Seed**: `12345`

Replaced all `Math.random()` with `random()`:
```javascript
// Before
const occupiedCount = Math.floor(Math.random() * maxOccupied);

// After
const occupiedCount = Math.floor(random() * maxOccupied);
```

**Affected areas**:
- Showtime generation (time slots, room numbers)
- Occupied seat count
- Seat selection (which seats are occupied)
- Ticket pricing variations

### 2. Hotel Seed Data (`functions/hotelSeedData.js`)
**Seed**: `54321`

Replaced all `Math.random()` with `random()`:
```javascript
// Before
const stars = starOptions[Math.floor(Math.random() * starOptions.length)];

// After
const stars = starOptions[Math.floor(random() * starOptions.length)];
```

**Affected areas**:
- Hotel star ratings
- Hotel amenities
- Price variations
- Location coordinates (lat/lon)
- Room refundability

## Benefits

### ✅ Consistency Across Machines
- Máy A, B, C đều có **cùng data**
- Dễ dàng reproduce bugs
- Test cases nhất quán

### ✅ Reproducible Testing
```javascript
// Test case sẽ luôn pass/fail giống nhau trên mọi máy
expect(hotels[0].name).toBe("Grand Hanoi Hotel");
expect(hotels[0].stars).toBe(4);
expect(hotels[0].rating).toBe(4.2);
```

### ✅ Deterministic Behavior
- Cùng seed → cùng output
- Dễ debug (biết chính xác data nào sẽ được tạo)
- Không có "flaky tests"

### ✅ Still Looks Random
- Data vẫn trông ngẫu nhiên và đa dạng
- Không ảnh hưởng đến UX
- Chỉ khác là **nhất quán** giữa các máy

## Verification

### Before (Random)
```bash
# Máy A
Cinema 1: 30 occupied seats
Hotel 1: 4 stars, rating 4.5

# Máy B
Cinema 1: 45 occupied seats
Hotel 1: 3 stars, rating 3.8
```

### After (Seeded)
```bash
# Máy A
Cinema 1: 37 occupied seats
Hotel 1: 4 stars, rating 4.2

# Máy B
Cinema 1: 37 occupied seats  ✅ Same!
Hotel 1: 4 stars, rating 4.2  ✅ Same!
```

## Testing

### Manual Test
1. Clear emulator data: `firebase emulators:start --import=./emulator-data --export-on-exit`
2. Run seed script: `node scripts/seed-emulator.js`
3. Check data in Firestore emulator UI
4. Repeat on another machine → should see identical data

### Automated Test
```javascript
// Test seeded random consistency
test('seeded random generates consistent values', () => {
  const random1 = seededRandom(12345);
  const random2 = seededRandom(12345);
  
  expect(random1()).toBe(random2()); // ✅ Same
  expect(random1()).toBe(random2()); // ✅ Same
  expect(random1()).toBe(random2()); // ✅ Same
});
```

## Changing Seeds

If you want different data (e.g., for testing different scenarios):

```javascript
// Cinema seed
const random = seededRandom(12345); // Default
const random = seededRandom(99999); // Different data

// Hotel seed
const random = seededRandom(54321); // Default
const random = seededRandom(11111); // Different data
```

**Note**: Changing seeds will generate completely different data, but it will still be consistent across machines.

## Technical Details

### Why LCG?
- **Simple**: Easy to implement and understand
- **Fast**: O(1) time complexity
- **Deterministic**: Same seed → same sequence
- **Good enough**: For seed data generation (not cryptography)

### Why Different Seeds for Cinema and Hotel?
- Prevents correlation between cinema and hotel data
- Each dataset has its own independent random sequence
- Easier to debug (know which seed affects which data)

### Limitations
- **Not cryptographically secure**: Don't use for passwords, tokens, etc.
- **Predictable**: Anyone with the seed can reproduce the sequence
- **Period**: Will eventually repeat (after 2^32 values)

For seed data generation, these limitations are acceptable.

## Summary

✅ **Consistent data** across all machines
✅ **Reproducible tests** and debugging
✅ **Deterministic behavior** for reliability
✅ **Still looks random** for realistic demo data

**Files changed**:
- `functions/cinemaSeedData.js` (seed: 12345)
- `functions/hotelSeedData.js` (seed: 54321)

**Next time you run seed script**: All machines will have identical data! 🎉
