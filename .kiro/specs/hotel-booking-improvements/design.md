# Design Document

## Overview

Tài liệu này mô tả thiết kế chi tiết cho việc cải thiện tính năng đặt phòng khách sạn trong ứng dụng VietBank. Thiết kế tập trung vào việc tách biệt rõ ràng giữa địa điểm Việt Nam và quốc tế, tích hợp Cloud Functions để xử lý API calls, và tăng cường bảo mật với xác thực sinh trắc học và kiểm tra trạng thái tài khoản.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Frontend      │
│  (React/TS)     │
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌──────────────────┐
│ Cloud Functions │  │   Firestore      │
│  (Node.js)      │  │   (hotels,       │
│                 │  │   bookings,      │
│  - getVnProv    │  │   transactions)  │
│  - getVnDist    │  │                  │
│  - getVnWards   │  │                  │
│  - getCountries │  │                  │
│  - reverseGeo   │  │                  │
└────────┬────────┘  └──────────────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│ Provinces API   │  │CountriesNow  │  │  Nominatim   │
│ (VN locations)  │  │    API       │  │   (Reverse   │
│                 │  │              │  │   Geocode)   │
└─────────────────┘  └──────────────┘  └──────────────┘

┌─────────────────┐
│      RTDB       │
│   (accounts,    │
│    users)       │
└─────────────────┘
```

### Component Interaction Flow

**Bước 1: Tìm phòng**
1. User chọn tab Việt Nam/Quốc tế
2. Frontend gọi Cloud Functions để lấy danh sách địa điểm
3. Cloud Functions kiểm tra cache trong Firestore
4. Nếu cache hết hạn, gọi API bên ngoài và cache lại
5. User điền thông tin và bấm "Tìm nhanh"
6. Frontend query Firestore collection `hotels` với cityKey

**Bước 2: Chọn phòng**
1. User chọn khách sạn
2. Frontend query Firestore collection `hotel_rooms` với hotelId
3. User chọn loại phòng và chuyển sang bước 3

**Bước 3: Thanh toán**
1. Frontend kiểm tra auth và profile user
2. Kiểm tra ekycStatus, canTransact, status
3. Kiểm tra tài khoản nguồn
4. Nếu total >= 10,000,000 VND, yêu cầu xác thực sinh trắc học
5. Gọi `createHotelBooking` service
6. Service sử dụng RTDB transaction để trừ tiền
7. Tạo documents trong Firestore (transactions, bookings)
8. Chuyển hướng đến trang biên lai

## Components and Interfaces

### Frontend Components

#### HotelBooking Component (src/pages/HotelBooking.tsx)

**State Management:**
```typescript
// Location mode
locationMode: "vn" | "intl"

// Vietnam location
vnProvinces: CityOption[]
vnDistricts: CityOption[]
selectedProvince: string
selectedDistrict: string

// International location
intlCities: CityOption[]
cityInput: string
cityKey: string

// Search params
checkIn: string
checkOut: string
guests: number
rooms: number
filters: { nearCenter: boolean; starsGte4: boolean; cheapFirst: boolean }

// Results
hotels: HotelItem[]
roomsOptions: HotelRoom[]
accounts: UserAccount[]

// Selection
selectedHotel: HotelItem | null
selectedRoom: HotelRoom | null
selectedAccount: string

// UI state
step: 1 | 2 | 3
loadingGeo: boolean
loadingSearch: boolean
loadingRooms: boolean
```

**Key Methods:**
- `handleGeoSuggest()`: Xử lý gợi ý GPS
- `handleSearch()`: Tìm kiếm khách sạn
- `handleSelectHotel()`: Chọn khách sạn và load phòng
- `handlePayment()`: Xử lý thanh toán

### Backend Services

#### Location Client (src/services/locationClient.ts)

```typescript
export async function getVnProvinceOptions(): Promise<CityOption[]>
export async function getVnDistrictOptions(provinceCode: string): Promise<CityOption[]>
export async function getVnWardOptions(districtCode: string): Promise<CityOption[]>
export async function getIntlCityOptions(): Promise<CityOption[]>
```

#### Location Service (src/services/locationService.ts)

```typescript
export async function fetchVnProvinces(): Promise<VnLocation[]>
export async function fetchVnDistricts(provinceCode: string): Promise<VnLocation[]>
export async function fetchVnWards(districtCode: string): Promise<VnLocation[]>
export async function fetchCountries(): Promise<string[]>
export async function fetchStates(country: string): Promise<string[]>
export async function fetchCities(country: string, state: string): Promise<string[]>
```

#### Hotel Booking Service (src/services/hotelBookingService.ts)

**Enhanced createHotelBooking:**
```typescript
export async function createHotelBooking(params: {
  hotel: HotelItem;
  room: HotelRoom;
  guests: number;
  rooms: number;
  nights: number;
  checkIn: string;
  checkOut: string;
  accountNumber: string;
}): Promise<{
  bookingId: string;
  transactionId: string;
  newBalance: number;
}>
```

**Validation Steps:**
1. Kiểm tra user đã đăng nhập
2. Lấy profile từ RTDB `users/{uid}`
3. Kiểm tra `status !== "LOCKED"`
4. Kiểm tra `ekycStatus === "VERIFIED"`
5. Kiểm tra `canTransact === true`
6. Kiểm tra tài khoản nguồn thuộc user
7. Kiểm tra tài khoản nguồn `status === "ACTIVE"`
8. Kiểm tra số dư đủ
9. Sử dụng RTDB transaction để trừ tiền
10. Tạo transaction document trong Firestore
11. Tạo booking document trong Firestore

### Cloud Functions (functions/index.js)

#### getVnProvinces
```javascript
exports.getVnProvinces = onRequest({ region: "asia-southeast1" }, async (req, res) => {
  // 1. Check cache in Firestore api_cache
  // 2. If cache valid, return cached data
  // 3. If cache expired, call Provinces Open API /?depth=1
  // 4. Cache result with TTL 24h
  // 5. Return data
})
```

#### getVnDistricts
```javascript
exports.getVnDistricts = onRequest({ region: "asia-southeast1" }, async (req, res) => {
  // 1. Get provinceCode from query params
  // 2. Check cache: vn_districts_{provinceCode}
  // 3. If cache valid, return cached data
  // 4. If cache expired, call Provinces Open API /p/{provinceCode}?depth=2
  // 5. Extract districts array
  // 6. Cache result with TTL 24h
  // 7. Return districts
})
```

#### getVnWards
```javascript
exports.getVnWards = onRequest({ region: "asia-southeast1" }, async (req, res) => {
  // 1. Get districtCode from query params
  // 2. Check cache: vn_wards_{districtCode}
  // 3. If cache valid, return cached data
  // 4. If cache expired, call Provinces Open API /d/{districtCode}?depth=2
  // 5. Extract wards array
  // 6. Cache result with TTL 24h
  // 7. Return wards
})
```

#### getCountriesNow
```javascript
exports.getCountriesNow = onRequest({ region: "asia-southeast1" }, async (req, res) => {
  // 1. Get action, country, state from request body
  // 2. Build cache key: countriesnow:{action}:{country}:{state}
  // 3. Check cache in Firestore api_cache
  // 4. If cache valid, return cached data
  // 5. If cache expired:
  //    - action="countries": call CountriesNow positions endpoint
  //    - action="states": call CountriesNow states endpoint with country
  //    - action="cities": call CountriesNow cities endpoint with country, state
  // 6. Cache result with TTL 24h
  // 7. Return data
})
```

#### reverseGeocode
```javascript
exports.reverseGeocode = onRequest({ region: "asia-southeast1" }, async (req, res) => {
  // 1. Get lat, lon from request body
  // 2. Round coordinates to 3 decimal places
  // 3. Build cache key: revgeo:{lat}:{lon}
  // 4. Check cache in Firestore api_cache
  // 5. If cache valid, return cached data
  // 6. If cache expired, call Nominatim reverse geocode API
  // 7. Extract city, state, country from address
  // 8. Cache result with TTL 6h
  // 9. Return geocode result
})
```

## Data Models

### Firestore Collections

#### hotels
```typescript
{
  id: string;
  cityKey: string;        // VN_HN, VN_HCM, INT_Bangkok, etc.
  name: string;
  lat: number;
  lon: number;
  stars: number;          // 1-5
  rating: number;         // 0-5
  priceFrom: number;      // VND
  distanceToCenterKm: number;
  amenities: string[];
  images: string[];
  createdAt: Timestamp;
}
```

#### hotel_rooms
```typescript
{
  id: string;
  hotelId: string;
  name: string;           // "Deluxe Room", "Suite", etc.
  pricePerNight: number;  // VND
  perks: string[];        // ["WiFi", "Breakfast", "Pool"]
  refundable: boolean;
}
```

#### bookings
```typescript
{
  id: string;
  status: "PAID" | "CANCELLED";
  customerUid: string;
  hotelId: string;
  hotelName: string;
  roomId: string;
  roomName: string;
  checkIn: string;        // YYYY-MM-DD
  checkOut: string;       // YYYY-MM-DD
  nights: number;
  guests: number;
  rooms: number;
  total: number;          // VND
  transactionId: string;
  createdAt: Timestamp;
}
```

#### transactions
```typescript
{
  id: string;
  type: "HOTEL_BOOKING";
  status: "SUCCESS" | "FAILED";
  customerUid: string;
  accountNumber: string;
  hotelId: string;
  hotelName: string;
  amount: number;         // VND
  fee: number;            // VND (currently 0)
  createdAt: Timestamp;
}
```

#### api_cache
```typescript
{
  key: string;            // Cache key
  payload: any;           // Cached data
  createdAt: Timestamp;
  expiresAt: Timestamp;
}
```

### RTDB Structure

#### users/{uid}
```typescript
{
  uid: string;
  username: string;
  email: string;
  role: "CUSTOMER" | "OFFICER";
  status: "ACTIVE" | "LOCKED";
  ekycStatus: "PENDING" | "VERIFIED" | "REJECTED";
  canTransact: boolean;
  // ... other fields
}
```

#### accounts/{accountNumber}
```typescript
{
  uid: string;
  accountNumber: string;
  balance: number;
  status: "ACTIVE" | "LOCKED";
  createdAt: number;
}
```

## Error Handling

### Validation Errors

**Frontend Validation:**
- Kiểm tra địa điểm đã chọn trước khi tìm kiếm
- Kiểm tra ngày trả phòng sau ngày nhận phòng
- Kiểm tra số khách và số phòng >= 1
- Hiển thị toast error với thông báo rõ ràng

**Backend Validation:**
- Kiểm tra user đã đăng nhập
- Kiểm tra profile tồn tại
- Kiểm tra trạng thái tài khoản
- Kiểm tra số dư
- Throw error với message tiếng Việt

### Network Errors

**Cloud Functions:**
- Wrap API calls trong try-catch
- Log error chi tiết
- Trả về HTTP 500 với error message
- Frontend hiển thị thông báo "Không thể kết nối, vui lòng thử lại"

**Frontend:**
- Catch error từ service calls
- Hiển thị toast error
- Log error vào console
- Không crash app

### Permission Errors

**Geolocation:**
- Request permission trước khi lấy vị trí
- Nếu denied, hiển thị thông báo và fallback về Hà Nội
- Không block user flow

**Biometric:**
- Nếu user từ chối, hiển thị error và không cho thanh toán
- Nếu thiết bị không hỗ trợ, hiển thị thông báo rõ ràng

### Business Logic Errors

**Account Status:**
- `status === "LOCKED"`: "Tài khoản đang bị khóa"
- `ekycStatus !== "VERIFIED"`: "Tài khoản chưa hoàn tất định danh eKYC"
- `canTransact === false`: "Tài khoản chưa được bật quyền giao dịch"

**Insufficient Balance:**
- "Số dư không đủ để thực hiện giao dịch"

**Transaction Errors:**
- Rollback RTDB transaction nếu có lỗi
- Không tạo Firestore documents nếu trừ tiền thất bại

## Testing Strategy

### Unit Tests

**Frontend Components:**
- Test state management (locationMode, step transitions)
- Test validation logic (date validation, input validation)
- Test error handling (display error messages)

**Services:**
- Test locationClient functions với mock data
- Test hotelBookingService validation logic
- Test error scenarios (user not logged in, insufficient balance)

### Integration Tests

**Cloud Functions:**
- Test cache hit/miss scenarios
- Test API call success/failure
- Test CORS headers
- Test authentication (optional token verification)

**End-to-End Flow:**
- Test complete booking flow từ search đến payment
- Test biometric authentication trigger
- Test account validation
- Test transaction creation

### Property-Based Tests

Property-based tests sẽ được viết sử dụng thư viện `fast-check` cho TypeScript/JavaScript. Mỗi property test sẽ chạy tối thiểu 100 iterations để đảm bảo coverage tốt.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Sau khi phân tích prework, tôi đã xác định các properties có thể gộp hoặc loại bỏ do redundancy:

**Redundant Properties:**
- Requirements 1.4 và 1.5 có thể gộp vào 1.3 (UI visibility based on locationMode)
- Requirement 9.5 là phần bổ sung của 9.1 (biometric threshold check)
- Requirements 6.3 và 6.4 có thể gộp thành một property chung (input normalization)

**Properties được giữ lại:**
- Property 1: UI visibility dựa trên locationMode (gộp 1.3, 1.4, 1.5)
- Property 2: Cache behavior (4.5, 13.2)
- Property 3: Input validation (6.1, 6.2)
- Property 4: Input normalization (6.3, 6.4)
- Property 5: eKYC validation (7.4)
- Property 6: Account ownership (8.1)
- Property 7: Biometric threshold (9.1, 9.5)
- Property 8: Transaction data integrity (10.2)
- Property 9: Booking data integrity (10.4)
- Property 10: Transaction atomicity (11.5)
- Property 11: Error messages in Vietnamese (14.1)

### Property 1: UI Visibility Based on Location Mode

*For any* location mode selection (Việt Nam or Quốc tế), when the user switches modes, the system should hide all input fields not relevant to the selected mode and show only the relevant fields.

**Validates: Requirements 1.3, 1.4, 1.5**

**Test Strategy:**
- Generate random locationMode values ("vn" or "intl")
- Render component with each mode
- Verify VN-specific fields (vnProvinces, vnDistricts) are visible only when mode="vn"
- Verify international fields (cityInput, intlCities) are visible only when mode="intl"

### Property 2: Cache-First Behavior

*For any* Cloud Function request with cacheable data, the system should check Firestore cache first, return cached data if valid (not expired), and only call external API if cache is expired or missing.

**Validates: Requirements 4.5, 13.2**

**Test Strategy:**
- Generate random API requests (provinces, districts, countries, etc.)
- Mock Firestore cache with random expiry times
- Verify cache is checked before API call
- Verify API is called only when cache is expired or missing
- Verify cache is updated after successful API call

### Property 3: Search Input Validation

*For any* search request, if the location (cityKey) is empty or the checkout date is before or equal to checkin date, the system should reject the search and display an error message without calling the hotel search API.

**Validates: Requirements 6.1, 6.2**

**Test Strategy:**
- Generate random search inputs with invalid combinations:
  - Empty cityKey
  - checkOut <= checkIn
- Verify error message is displayed
- Verify search API is not called

### Property 4: Guest and Room Count Normalization

*For any* input value for guests or rooms, if the value is less than 1, the system should automatically normalize it to 1.

**Validates: Requirements 6.3, 6.4**

**Test Strategy:**
- Generate random numbers including negative, zero, and positive values
- Apply normalization function
- Verify result is always >= 1
- Verify positive values >= 1 are unchanged

### Property 5: eKYC Status Validation

*For any* user attempting payment, if the ekycStatus is not "VERIFIED", the system should reject the payment and display an error message.

**Validates: Requirements 7.4**

**Test Strategy:**
- Generate random ekycStatus values ("PENDING", "REJECTED", "VERIFIED", random strings)
- Attempt payment with each status
- Verify only "VERIFIED" status allows payment
- Verify all other statuses display error message

### Property 6: Account Ownership Validation

*For any* account selection, the account's uid must match the current user's uid, otherwise the system should reject the transaction.

**Validates: Requirements 8.1**

**Test Strategy:**
- Generate random account objects with random uids
- Generate random current user uid
- Verify transaction is rejected when uids don't match
- Verify transaction proceeds when uids match

### Property 7: Biometric Authentication Threshold

*For any* payment amount, if the amount is greater than or equal to 10,000,000 VND, the system should require biometric authentication; if less than 10,000,000 VND, biometric authentication should not be required.

**Validates: Requirements 9.1, 9.5**

**Test Strategy:**
- Generate random payment amounts (including edge cases around 10M)
- Verify biometric is required for amount >= 10,000,000
- Verify biometric is not required for amount < 10,000,000
- Test edge case: exactly 10,000,000 VND

### Property 8: Transaction Data Integrity

*For any* successful hotel booking transaction, the created transaction document must contain all required fields: customerUid, accountNumber, hotelId, hotelName, amount, fee, status, and type must equal "HOTEL_BOOKING".

**Validates: Requirements 10.2**

**Test Strategy:**
- Generate random booking parameters
- Create transaction
- Verify all required fields are present and non-null
- Verify type === "HOTEL_BOOKING"
- Verify status === "SUCCESS"

### Property 9: Booking Data Integrity

*For any* successful hotel booking, the created booking document must contain all required fields: customerUid, hotelId, roomId, checkIn, checkOut, nights, guests, rooms, total, transactionId, and status must equal "PAID".

**Validates: Requirements 10.4**

**Test Strategy:**
- Generate random booking parameters
- Create booking
- Verify all required fields are present and non-null
- Verify status === "PAID"
- Verify nights calculation is correct (checkOut - checkIn)

### Property 10: Transaction Atomicity

*For any* payment attempt, if the RTDB balance update fails (insufficient funds or transaction error), no Firestore documents (transaction or booking) should be created.

**Validates: Requirements 11.5**

**Test Strategy:**
- Generate random booking scenarios
- Mock RTDB transaction to fail (insufficient balance)
- Attempt payment
- Verify no transaction document exists in Firestore
- Verify no booking document exists in Firestore
- Verify account balance is unchanged

### Property 11: Vietnamese Error Messages

*For any* error that occurs in the system, the error message displayed to the user must be in Vietnamese language (contain Vietnamese characters or common Vietnamese words).

**Validates: Requirements 14.1**

**Test Strategy:**
- Generate various error scenarios (auth error, validation error, network error)
- Capture error messages
- Verify messages contain Vietnamese characters (à, á, ả, ã, ạ, ă, ắ, ằ, ẳ, ẵ, ặ, â, ấ, ầ, ẩ, ẫ, ậ, đ, è, é, ẻ, ẽ, ẹ, ê, ế, ề, ể, ễ, ệ, ì, í, ỉ, ĩ, ị, ò, ó, ỏ, õ, ọ, ô, ố, ồ, ổ, ỗ, ộ, ơ, ớ, ờ, ở, ỡ, ợ, ù, ú, ủ, ũ, ụ, ư, ứ, ừ, ử, ữ, ự, ỳ, ý, ỷ, ỹ, ỵ) or common Vietnamese words (không, lỗi, thành công, etc.)

