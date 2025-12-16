# Implementation Plan

- [x] 1. Cập nhật Cloud Functions cho location APIs




  - Tạo hoặc cập nhật các Cloud Functions để xử lý API calls bên ngoài
  - Implement cache logic với Firestore
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.5, 13.2, 13.3, 13.4, 13.5_



- [x] 1.1 Implement getVnProvinces Cloud Function


  - Gọi Provinces Open API với depth=1
  - Cache kết quả trong Firestore collection api_cache với key "vn_provinces_depth1"
  - TTL 24 giờ
  - Handle CORS headers

  - _Requirements: 3.1, 3.2_

- [x] 1.2 Implement getVnDistricts Cloud Function

  - Nhận provinceCode từ query params
  - Gọi Provinces Open API /p/{provinceCode}?depth=2
  - Extract districts array

  - Cache với key "vn_districts_{provinceCode}", TTL 24 giờ
  - _Requirements: 3.3, 3.4_

- [x] 1.3 Implement getVnWards Cloud Function

  - Nhận districtCode từ query params
  - Gọi Provinces Open API /d/{districtCode}?depth=2

  - Extract wards array
  - Cache với key "vn_wards_{districtCode}", TTL 24 giờ
  - _Requirements: 3.5_

- [x] 1.4 Implement getCountriesNow Cloud Function

  - Nhận action, country, state từ request body

  - Handle 3 actions: "countries", "states", "cities"
  - Gọi CountriesNow API tương ứng
  - Cache với key "countriesnow:{action}:{country}:{state}", TTL 24 giờ
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 1.5 Implement reverseGeocode Cloud Function

  - Nhận lat, lon từ request body
  - Round coordinates đến 3 chữ số thập phân
  - Gọi Nominatim API
  - Extract city, state, country từ address
  - Cache với key "revgeo:{lat}:{lon}", TTL 6 giờ
  - _Requirements: 5.4, 5.5_

- [x] 1.6 Write property test for cache-first behavior
  - **Property 2: Cache-First Behavior**
  - **Validates: Requirements 4.5, 13.2**

- [x] 2. Cập nhật locationService để gọi Cloud Functions



  - Thay thế direct API calls bằng calls đến Cloud Functions
  - Handle errors từ Cloud Functions
  - _Requirements: 3.1, 3.3, 3.5, 4.1, 4.3, 4.4_

- [x] 2.1 Update fetchVnProvinces function


  - Gọi Cloud Function getVnProvinces thay vì direct API
  - Parse response và return VnLocation[]
  - _Requirements: 3.1_

- [x] 2.2 Update fetchVnDistricts function


  - Gọi Cloud Function getVnDistricts với provinceCode
  - Parse response và return VnLocation[]
  - _Requirements: 3.3_

- [x] 2.3 Update fetchVnWards function


  - Gọi Cloud Function getVnWards với districtCode
  - Parse response và return VnLocation[]
  - _Requirements: 3.5_

- [x] 2.4 Update fetchCountries function


  - Gọi Cloud Function getCountriesNow với action="countries"
  - Parse response và return string[]
  - _Requirements: 4.1_

- [x] 2.5 Update fetchStates function


  - Gọi Cloud Function getCountriesNow với action="states" và country
  - Parse response và return string[]
  - _Requirements: 4.3_

- [x] 2.6 Update fetchCities function


  - Gọi Cloud Function getCountriesNow với action="cities", country, state
  - Parse response và return string[]
  - _Requirements: 4.4_

- [x] 3. Cải thiện UI bước 1 - Location selection



  - Tách biệt rõ ràng UI cho Việt Nam và Quốc tế
  - Sắp xếp lại layout cho các nút
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2_

- [x] 3.1 Refactor location mode tabs



  - Tạo container cho tabs "Việt Nam" và "Quốc tế"
  - Đặt tabs và nút "Gợi ý GPS" trên cùng một hàng (flexbox)
  - Responsive: vertical trên mobile, horizontal trên desktop
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3.2 Implement conditional rendering cho VN location fields

  - Chỉ hiển thị vnProvinces và vnDistricts dropdown khi locationMode === "vn"
  - Ẩn hoàn toàn khi locationMode === "intl"
  - _Requirements: 1.1, 1.4_

- [x] 3.3 Implement conditional rendering cho international location fields

  - Chỉ hiển thị cityInput và intlCities suggestions khi locationMode === "intl"
  - Ẩn hoàn toàn khi locationMode === "vn"
  - _Requirements: 1.2, 1.5_

- [x] 3.4 Update state management cho location mode switching

  - Clear VN-specific state khi chuyển sang "intl"
  - Clear intl-specific state khi chuyển sang "vn"
  - _Requirements: 1.3_

- [x] 3.5 Write property test for UI visibility
  - **Property 1: UI Visibility Based on Location Mode**
  - **Validates: Requirements 1.3, 1.4, 1.5**

- [x] 4. Implement input validation cho bước 1


  - Validate location selection
  - Validate dates
  - Normalize guest and room counts
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4.1 Implement location validation

  - Check cityKey hoặc selectedProvince/selectedDistrict không rỗng
  - Display error toast nếu rỗng
  - Prevent search call
  - _Requirements: 6.1_

- [x] 4.2 Implement date validation

  - Check checkOut > checkIn
  - Calculate nights correctly
  - Display error toast nếu invalid
  - Prevent search call
  - _Requirements: 6.2_

- [x] 4.3 Implement guest count normalization

  - Clamp guests value: Math.max(1, guests)
  - Apply on input change
  - _Requirements: 6.3_

- [x] 4.4 Implement room count normalization

  - Clamp rooms value: Math.max(1, rooms)
  - Apply on input change
  - _Requirements: 6.4_

- [x] 4.5 Write property test for input validation
  - **Property 3: Search Input Validation**
  - **Validates: Requirements 6.1, 6.2**

- [x] 4.6 Write property test for input normalization
  - **Property 4: Guest and Room Count Normalization**
  - **Validates: Requirements 6.3, 6.4**

- [x] 5. Enhance hotelBookingService với validation và security checks


  - Kiểm tra auth status
  - Kiểm tra user profile (eKYC, canTransact, status)
  - Kiểm tra account ownership và status
  - Implement biometric check cho giao dịch >= 10M
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 5.1 Add authentication check

  - Check firebaseAuth.currentUser exists
  - Throw error "Bạn cần đăng nhập để thanh toán" nếu null
  - _Requirements: 7.1, 7.2_

- [x] 5.2 Add user profile validation

  - Fetch profile từ RTDB users/{uid}
  - Check status !== "LOCKED"
  - Check ekycStatus === "VERIFIED"
  - Check canTransact === true
  - Throw appropriate Vietnamese error messages
  - _Requirements: 7.3, 7.4, 7.5, 7.6_

- [x] 5.3 Write property test for eKYC validation
  - **Property 5: eKYC Status Validation**
  - **Validates: Requirements 7.4**

- [x] 5.4 Add account ownership validation

  - Fetch account từ RTDB accounts/{accountNumber}
  - Check account.uid === currentUser.uid
  - Throw error "Tài khoản nguồn không thuộc về bạn" nếu không match
  - _Requirements: 8.1, 8.2_

- [x] 5.5 Write property test for account ownership
  - **Property 6: Account Ownership Validation**
  - **Validates: Requirements 8.1**

- [x] 5.6 Add account status validation

  - Check account.status === "ACTIVE"
  - Throw error "Tài khoản nguồn không hoạt động" nếu LOCKED
  - _Requirements: 8.3_

- [x] 5.7 Add balance check

  - Check account.balance >= total
  - Throw error "Số dư không đủ" nếu insufficient
  - _Requirements: 8.5_

- [x] 5.8 Implement biometric authentication check

  - Calculate total amount
  - If total >= 10,000,000, call requireBiometricForHighValueVnd
  - Throw error nếu biometric fails hoặc user cancels
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 5.9 Write property test for biometric threshold
  - **Property 7: Biometric Authentication Threshold**
  - **Validates: Requirements 9.1, 9.5**

- [x] 6. Update createHotelBooking để tạo Firestore documents


  - Tạo transaction document với đầy đủ fields
  - Tạo booking document với đầy đủ fields
  - Ensure atomicity với RTDB balance update
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 6.1 Implement RTDB balance update với runTransaction

  - Use runTransaction để trừ tiền từ account
  - Check balance trong transaction callback
  - Rollback nếu insufficient
  - Return new balance
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 6.2 Create transaction document trong Firestore

  - Collection: transactions
  - Fields: type="HOTEL_BOOKING", status="SUCCESS", customerUid, accountNumber, hotelId, hotelName, amount, fee=0, createdAt
  - Use addDoc để tạo document
  - _Requirements: 10.1, 10.2_

- [x] 6.3 Write property test for transaction data integrity
  - **Property 8: Transaction Data Integrity**
  - **Validates: Requirements 10.2**

- [x] 6.4 Create booking document trong Firestore

  - Collection: bookings
  - Fields: status="PAID", customerUid, hotelId, hotelName, roomId, roomName, checkIn, checkOut, nights, guests, rooms, total, transactionId, createdAt
  - Use addDoc để tạo document
  - _Requirements: 10.3, 10.4_

- [x] 6.5 Write property test for booking data integrity
  - **Property 9: Booking Data Integrity**
  - **Validates: Requirements 10.4**

- [x] 6.6 Implement error handling và rollback

  - Wrap RTDB transaction trong try-catch
  - Nếu RTDB fails, không tạo Firestore documents
  - Nếu Firestore fails, log error (RTDB đã commit, không thể rollback)
  - _Requirements: 11.5_

- [x] 6.7 Write property test for transaction atomicity
  - **Property 10: Transaction Atomicity**
  - **Validates: Requirements 11.5**

- [x] 7. Implement receipt page


  - Tạo hoặc cập nhật trang biên lai
  - Hiển thị thông tin transaction và booking
  - Implement navigation buttons
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 7.1 Update navigation sau payment success

  - Navigate đến /utilities/result với transactionId
  - Pass booking details trong state
  - _Requirements: 12.1_

- [x] 7.2 Display transaction information

  - Hiển thị: trạng thái, số tiền, mã giao dịch, thời gian
  - Format số tiền với toLocaleString("vi-VN")
  - _Requirements: 12.2_

- [x] 7.3 Display booking details

  - Hiển thị: thành phố, ngày nhận/trả, số đêm, loại phòng, số khách, số phòng
  - Format dates với date-fns
  - _Requirements: 12.3_

- [x] 7.4 Add action buttons

  - Nút "Tải biên lai" (placeholder hoặc implement PDF generation)
  - Nút "Chia sẻ" (placeholder hoặc implement share API)
  - Nút "Xong" navigate về /utilities
  - _Requirements: 12.4, 12.5_

- [x] 8. Improve error handling và messages


  - Ensure tất cả error messages là tiếng Việt
  - Add specific error messages cho từng error type
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 8.1 Review và update error messages

  - Auth errors: "Bạn cần đăng nhập..."
  - Validation errors: "Vui lòng chọn...", "Ngày trả phòng phải sau..."
  - Permission errors: "Quyền vị trí bị từ chối..."
  - Network errors: "Không thể kết nối, vui lòng kiểm tra mạng..."
  - Business logic errors: "Tài khoản đang bị khóa...", "Số dư không đủ..."
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 8.2 Write property test for Vietnamese error messages
  - **Property 11: Vietnamese Error Messages**
  - **Validates: Requirements 14.1**

- [x] 9. Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Testing và bug fixes



  - Test toàn bộ flow từ search đến payment
  - Test error scenarios
  - Test responsive design
  - Fix bugs nếu có

- [x] 10.1 Test location selection flow

  - Test chuyển đổi giữa VN và Quốc tế
  - Test dropdown loading và selection
  - Test GPS suggestion
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 10.2 Test search và hotel selection

  - Test search với valid inputs
  - Test search với invalid inputs
  - Test hotel selection và room loading
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 10.3 Test payment flow

  - Test với user chưa đăng nhập
  - Test với user chưa eKYC
  - Test với account locked
  - Test với insufficient balance
  - Test với amount < 10M (no biometric)
  - Test với amount >= 10M (require biometric)
  - Test successful payment
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.5, 9.1, 9.2, 9.3, 9.4_

- [x] 10.4 Test receipt page

  - Test navigation đến receipt
  - Test data display
  - Test action buttons
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 10.5 Test error handling

  - Test network errors
  - Test permission errors
  - Test validation errors
  - Verify error messages là tiếng Việt
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
