# Requirements Document

## Introduction

Hiện tại chức năng đặt vé máy bay chỉ lưu thông tin đơn hàng vào Realtime Database nhưng không thực hiện thanh toán thực sự. Cần bổ sung logic thanh toán tương tự như chức năng đặt vé xem phim và đặt phòng khách sạn để đảm bảo tính nhất quán và đầy đủ trong hệ thống.

## Glossary

- **Flight_Booking_Service**: Dịch vụ xử lý đặt vé máy bay
- **Movie_Booking_Service**: Dịch vụ xử lý đặt vé xem phim (tham chiếu)
- **Hotel_Booking_Service**: Dịch vụ xử lý đặt phòng khách sạn (tham chiếu)
- **Payment_Account**: Tài khoản thanh toán của người dùng trong Realtime Database
- **eKYC**: Electronic Know Your Customer - xác thực danh tính điện tử
- **Transaction_Record**: Bản ghi giao dịch trong Realtime Database
- **Booking_Record**: Bản ghi đặt vé trong Realtime Database
- **Balance_Change_Notification**: Thông báo biến động số dư trong Realtime Database
- **RTDB**: Firebase Realtime Database

## Requirements

### Requirement 1: Xác thực người dùng và quyền giao dịch

**User Story:** Là một khách hàng, tôi muốn hệ thống kiểm tra đầy đủ quyền giao dịch của tôi trước khi thanh toán vé máy bay, để đảm bảo an toàn và tuân thủ quy định ngân hàng.

#### Acceptance Criteria

1. WHEN a user attempts to create a flight booking, THE Flight_Booking_Service SHALL verify the user is authenticated
2. WHEN a user is not authenticated, THE Flight_Booking_Service SHALL return error "Vui lòng đăng nhập để tiếp tục"
3. WHEN a user is authenticated, THE Flight_Booking_Service SHALL fetch the user profile
4. IF the user profile cannot be retrieved, THEN THE Flight_Booking_Service SHALL return error "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
5. WHEN the user account status is "LOCKED", THE Flight_Booking_Service SHALL return error "Tài khoản đăng nhập đang bị khóa, không thể giao dịch"
6. WHEN the user eKYC status is not "VERIFIED", THE Flight_Booking_Service SHALL return error "Tài khoản chưa hoàn tất định danh eKYC. Vui lòng liên hệ ngân hàng để xác thực."
7. WHEN the user canTransact flag is false, THE Flight_Booking_Service SHALL return error "Tài khoản chưa được bật quyền giao dịch. Vui lòng liên hệ ngân hàng."

### Requirement 2: Xác thực thông tin đặt vé

**User Story:** Là một khách hàng, tôi muốn hệ thống kiểm tra đầy đủ thông tin đặt vé trước khi thanh toán, để tránh lỗi và đảm bảo giao dịch chính xác.

#### Acceptance Criteria

1. WHEN creating a flight booking, THE Flight_Booking_Service SHALL validate that selectedFlight is provided
2. IF selectedFlight is missing, THEN THE Flight_Booking_Service SHALL return error "Vui lòng chọn chuyến bay"
3. WHEN creating a flight booking, THE Flight_Booking_Service SHALL validate that accountId is provided
4. IF accountId is missing, THEN THE Flight_Booking_Service SHALL return error "Vui lòng chọn tài khoản thanh toán"
5. WHEN creating a flight booking, THE Flight_Booking_Service SHALL validate that at least one passenger is selected
6. IF total passengers is less than 1, THEN THE Flight_Booking_Service SHALL return error "Vui lòng chọn ít nhất một hành khách"

### Requirement 3: Xác thực và trừ tiền tài khoản thanh toán

**User Story:** Là một khách hàng, tôi muốn hệ thống kiểm tra số dư và trừ tiền chính xác từ tài khoản của tôi khi đặt vé máy bay, để đảm bảo giao dịch an toàn và minh bạch.

#### Acceptance Criteria

1. WHEN accountId is provided, THE Flight_Booking_Service SHALL verify the account exists in RTDB
2. IF the account does not exist, THEN THE Flight_Booking_Service SHALL return error "Không tìm thấy tài khoản thanh toán"
3. WHEN the account exists, THE Flight_Booking_Service SHALL verify the account belongs to the current user
4. IF the account uid does not match current user uid, THEN THE Flight_Booking_Service SHALL return error "Bạn không có quyền sử dụng tài khoản này"
5. WHEN verifying account balance, THE Flight_Booking_Service SHALL check if account status is "LOCKED"
6. IF account status is "LOCKED", THEN THE Flight_Booking_Service SHALL return error "Tài khoản nguồn đang bị khóa. Vui lòng liên hệ ngân hàng."
7. WHEN the account balance is less than total amount, THE Flight_Booking_Service SHALL return error with format "Số dư không đủ. Cần {amount} ₫, hiện có {balance} ₫"
8. WHEN the account balance is sufficient, THE Flight_Booking_Service SHALL deduct the total amount from the account balance using atomic transaction
9. WHEN the transaction fails to commit, THE Flight_Booking_Service SHALL return error "Giao dịch thất bại"

### Requirement 4: Tạo bản ghi giao dịch trong Firestore

**User Story:** Là một khách hàng, tôi muốn mọi giao dịch đặt vé máy bay được ghi lại đầy đủ trong hệ thống, để tôi có thể tra cứu lịch sử giao dịch và đối chiếu.

#### Acceptance Criteria

1. WHEN a flight booking payment is successful, THE Flight_Booking_Service SHALL create a transaction record in Firestore
2. THE transaction record SHALL include userId field with current user uid
3. THE transaction record SHALL include accountId field with the payment account id
4. THE transaction record SHALL include type field with value "flight_booking"
5. THE transaction record SHALL include amount field with negative value of total payment amount
6. THE transaction record SHALL include description field with format "Đặt vé máy bay: {airline} {flightCode}"
7. THE transaction record SHALL include status field with value "completed"
8. THE transaction record SHALL include metadata object with booking details
9. THE metadata object SHALL include orderId, airline, flightCode, route, departDate, departTime, arriveTime, passengers, and cabin fields
10. THE transaction record SHALL include createdAt field with Firestore serverTimestamp

### Requirement 5: Tạo bản ghi đặt vé trong Firestore

**User Story:** Là một khách hàng, tôi muốn thông tin đặt vé máy bay được lưu trữ đầy đủ trong Firestore, để hệ thống có thể quản lý và tra cứu đơn hàng hiệu quả.

#### Acceptance Criteria

1. WHEN a flight booking payment is successful, THE Flight_Booking_Service SHALL create a booking record in Firestore collection "flight_bookings"
2. THE booking record SHALL include userId field with current user uid
3. THE booking record SHALL include flightId field with selected flight id
4. THE booking record SHALL include airline, flightCode, fromCode, toCode, departTime, arriveTime, duration, cabin fields from selected flight
5. THE booking record SHALL include departDate field from form data
6. THE booking record SHALL include adults, children, infants fields with passenger counts
7. THE booking record SHALL include totalAmount field with calculated total payment
8. THE booking record SHALL include accountId field with payment account id
9. THE booking record SHALL include status field with value "confirmed"
10. THE booking record SHALL include transactionId field with reference to transaction record id
11. THE booking record SHALL include createdAt field with Firestore serverTimestamp

### Requirement 6: Gửi thông báo biến động số dư

**User Story:** Là một khách hàng, tôi muốn nhận thông báo ngay lập tức khi số dư tài khoản thay đổi do đặt vé máy bay, để theo dõi giao dịch của mình.

#### Acceptance Criteria

1. WHEN a flight booking payment is successful, THE Flight_Booking_Service SHALL create a balance change notification in RTDB
2. THE notification SHALL be stored at path "notifications/{userId}/{notificationId}"
3. THE notification SHALL include type field with value "BALANCE_CHANGE"
4. THE notification SHALL include direction field with value "OUT"
5. THE notification SHALL include title field with value "Đặt vé máy bay"
6. THE notification SHALL include message field with format "{airline} • {fromCode} → {toCode}"
7. THE notification SHALL include amount field with total payment amount
8. THE notification SHALL include accountNumber field with payment account id
9. THE notification SHALL include balanceAfter field with new account balance after deduction
10. THE notification SHALL include transactionId field with reference to transaction record id
11. THE notification SHALL include createdAt field with current timestamp
12. IF notification creation fails, THE Flight_Booking_Service SHALL log warning but not fail the booking

### Requirement 7: Tính toán tổng tiền thanh toán

**User Story:** Là một khách hàng, tôi muốn hệ thống tính toán chính xác tổng tiền cần thanh toán dựa trên giá vé và số lượng hành khách, để đảm bảo minh bạch và công bằng.

#### Acceptance Criteria

1. WHEN calculating total amount, THE Flight_Booking_Service SHALL multiply flight price by total number of passengers
2. THE total number of passengers SHALL be sum of adults, children, and infants
3. IF total passengers is less than 1, THE Flight_Booking_Service SHALL use 1 as minimum
4. THE calculated amount SHALL be used for balance deduction, transaction record, and notification

### Requirement 8: Tương thích với logic hiện tại

**User Story:** Là một developer, tôi muốn logic thanh toán mới tương thích với logic lưu đơn hàng hiện tại, để không làm gián đoạn chức năng đang hoạt động.

#### Acceptance Criteria

1. WHEN payment is successful, THE Flight_Booking_Service SHALL continue to save order to RTDB at "flightOrdersByUser/{uid}/{orderId}"
2. THE Flight_Booking_Service SHALL continue to increment order counter at "counters/flightOrder"
3. THE Flight_Booking_Service SHALL continue to save recent search to "flightRecent/{uid}/{pushId}"
4. THE Flight_Booking_Service SHALL return orderId, orderNo, createdAtIso, bookingId, and transactionId
5. THE existing order record in RTDB SHALL include transactionId field referencing Firestore transaction
6. THE existing order record in RTDB SHALL include bookingId field referencing Firestore booking
