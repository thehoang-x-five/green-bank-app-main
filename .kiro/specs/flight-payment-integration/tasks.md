# Implementation Plan: Flight Payment Integration

## Overview

Tích hợp logic thanh toán đầy đủ cho chức năng đặt vé máy bay, tương tự như logic đã có trong Movie Booking và Hotel Booking.

## Tasks

- [x] 1. Cập nhật flightBookingService.ts

  - [x] 1.1 Import các module cần thiết (RTDB, userService)

    - Import `firebaseRtdb, firebaseAuth` từ firebase config
    - Import `ref, get, set, push, runTransaction, serverTimestamp as rtdbServerTimestamp` từ firebase/database
    - Import `getCurrentUserProfile` từ userService
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 Cập nhật hàm createFlightOrder để thêm tham số accountId

    - Thêm `accountId: string` vào params
    - Cập nhật return type để bao gồm `bookingId` và `transactionId`
    - _Requirements: 2.3, 2.4_

  - [x] 1.3 Thêm xác thực người dùng và quyền giao dịch

    - Kiểm tra user đã đăng nhập
    - Lấy user profile từ userService
    - Kiểm tra account status (LOCKED)
    - Kiểm tra eKYC status (VERIFIED)
    - Kiểm tra canTransact flag
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 1.4 Thêm xác thực thông tin đặt vé

    - Validate selectedFlight không null
    - Validate accountId không empty
    - Validate số lượng hành khách >= 1
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.5 Thêm logic kiểm tra và trừ tiền tài khoản

    - Kiểm tra account tồn tại trong RTDB
    - Verify account ownership
    - Kiểm tra account status
    - Kiểm tra số dư đủ
    - Trừ tiền bằng atomic transaction
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 1.6 Tạo bản ghi transaction trong Realtime Database

    - Tạo record tại path "flightTransactions/{transactionId}" bằng push()
    - Bao gồm đầy đủ các field theo requirements
    - Sử dụng rtdbServerTimestamp() cho createdAtServer
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [x] 1.7 Tạo bản ghi booking trong Realtime Database

    - Tạo record tại path "flightBookings/{bookingId}" bằng push()
    - Bao gồm đầy đủ các field theo requirements
    - Link với transactionId và orderId
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13_

  - [x] 1.8 Cập nhật logic lưu order vào RTDB

    - Giữ nguyên logic lưu vào flightOrdersByUser
    - Thêm field transactionId và bookingId
    - Giữ nguyên logic counter và recent search
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_

  - [x] 1.9 Gửi thông báo biến động số dư
    - Tạo notification trong RTDB
    - Bao gồm đầy đủ các field theo requirements
    - Handle error gracefully (không fail booking)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12_

- [x] 2. Cập nhật UtilityBills.tsx

  - [x] 2.1 Import các module cần thiết

    - Import `createFlightOrder` từ flightBookingService
    - Import `fbAuth, fbRtdb` từ firebase config
    - Import `ref, get` từ firebase/database
    - Import `FlightOption` type
    - _Requirements: 2.1_

  - [x] 2.2 Thêm state quản lý flight payment

    - State cho modal hiển thị/ẩn
    - State cho selected flight
    - State cho danh sách accounts
    - State cho selected account ID
    - State cho loading và processing
    - _Requirements: 2.3, 3.1_

  - [x] 2.3 Thêm hàm loadFlightAccounts

    - Kiểm tra user đã đăng nhập
    - Load accounts từ RTDB
    - Filter theo user uid
    - Auto-select account đầu tiên
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.4 Thêm hàm handleFlightPayment

    - Validate thông tin đầy đủ
    - Gọi createFlightOrder với accountId
    - Handle success: navigate đến result page
    - Handle error: hiển thị toast
    - _Requirements: 2.1, 2.3, 2.4, 7.1, 7.2, 7.3, 7.4_

  - [x] 2.5 Cập nhật onConfirm callback

    - Thay vì navigate trực tiếp
    - Hiển thị modal chọn account
    - Load danh sách accounts
    - _Requirements: 2.3, 3.1_

  - [x] 2.6 Thêm UI modal thanh toán
    - Hiển thị thông tin chuyến bay
    - Hiển thị danh sách accounts
    - Cho phép chọn account
    - Nút thanh toán và hủy
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Kiểm tra và test
  - [x] 3.1 Kiểm tra syntax errors
    - Chạy getDiagnostics cho các file đã sửa
    - Đảm bảo không có lỗi TypeScript
    - _Requirements: All_

## Notes

- Tất cả các task đã được hoàn thành
- Logic thanh toán flight đã được implement sử dụng Realtime Database (khác với movie/hotel booking dùng Firestore)
- Đã test không có lỗi syntax
- Cần test thực tế với Firebase để đảm bảo hoạt động đúng
- **Lưu ý quan trọng**: Flight booking lưu vào RTDB (flightTransactions, flightBookings) trong khi movie/hotel booking lưu vào Firestore (transactions, movie_bookings/bookings)
