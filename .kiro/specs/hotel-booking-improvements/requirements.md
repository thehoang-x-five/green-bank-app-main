# Requirements Document

## Introduction

Hệ thống đặt phòng khách sạn hiện tại cần được cải thiện để tăng tính bảo mật, trải nghiệm người dùng và tích hợp đầy đủ với các API địa điểm. Tài liệu này mô tả các yêu cầu để nâng cấp tính năng đặt phòng khách sạn với các cải tiến về UI/UX, xác thực, và tích hợp Cloud Functions.

## Glossary

- **System**: Hệ thống đặt phòng khách sạn VietBank
- **User**: Khách hàng sử dụng ứng dụng để đặt phòng
- **Officer**: Nhân viên ngân hàng có quyền xác thực tài khoản
- **eKYC**: Electronic Know Your Customer - quy trình định danh khách hàng điện tử
- **Cloud Function**: Firebase Cloud Function xử lý logic backend
- **Provinces Open API**: API cung cấp dữ liệu tỉnh/thành/quận/huyện Việt Nam
- **CountriesNow API**: API cung cấp dữ liệu quốc gia/bang/thành phố quốc tế
- **Nominatim**: Dịch vụ reverse geocoding của OpenStreetMap
- **Biometric Authentication**: Xác thực sinh trắc học (vân tay/FaceID)
- **Transaction PIN**: Mã PIN giao dịch của người dùng
- **Firestore**: Cơ sở dữ liệu NoSQL của Firebase
- **RTDB**: Firebase Realtime Database

## Requirements

### Requirement 1

**User Story:** Là một khách hàng, tôi muốn chọn địa điểm Việt Nam hoặc quốc tế một cách rõ ràng, để tôi có thể dễ dàng tìm kiếm khách sạn ở khu vực mong muốn.

#### Acceptance Criteria

1. WHEN User chọn tab "Việt Nam", THEN THE System SHALL hiển thị dropdown tỉnh/thành và quận/huyện Việt Nam
2. WHEN User chọn tab "Quốc tế", THEN THE System SHALL hiển thị input và gợi ý thành phố quốc tế
3. WHEN User chuyển đổi giữa tab "Việt Nam" và "Quốc tế", THEN THE System SHALL ẩn các trường input không liên quan đến tab đang chọn
4. WHEN User ở tab "Việt Nam", THEN THE System SHALL không hiển thị các trường input quốc tế
5. WHEN User ở tab "Quốc tế", THEN THE System SHALL không hiển thị các dropdown tỉnh/thành Việt Nam

### Requirement 2

**User Story:** Là một khách hàng, tôi muốn các nút điều hướng được sắp xếp hợp lý, để giao diện trông gọn gàng và dễ sử dụng.

#### Acceptance Criteria

1. WHEN User xem bước 1 tìm phòng, THEN THE System SHALL hiển thị nút "Việt Nam" và "Quốc tế" cùng dòng với nút "Gợi ý GPS" ở bên phải
2. WHEN User xem bước 1, THEN THE System SHALL căn chỉnh các nút tab và nút gợi ý trên cùng một hàng ngang
3. WHEN màn hình nhỏ hơn breakpoint md, THEN THE System SHALL hiển thị các nút theo chiều dọc
4. WHEN màn hình lớn hơn breakpoint md, THEN THE System SHALL hiển thị các nút theo chiều ngang

### Requirement 3

**User Story:** Là một khách hàng, tôi muốn hệ thống lấy dữ liệu địa điểm Việt Nam từ Cloud Function, để tránh lỗi CORS và tận dụng cache.

#### Acceptance Criteria

1. WHEN System cần danh sách tỉnh/thành Việt Nam, THEN THE System SHALL gọi Cloud Function getVnProvinces với depth=1
2. WHEN Cloud Function getVnProvinces nhận request, THEN THE System SHALL gọi Provinces Open API và cache kết quả trong Firestore với TTL 24 giờ
3. WHEN User chọn một tỉnh/thành, THEN THE System SHALL gọi Cloud Function getVnDistricts với provinceCode
4. WHEN Cloud Function getVnDistricts nhận request, THEN THE System SHALL gọi Provinces Open API và cache kết quả với TTL 24 giờ
5. WHEN User chọn một quận/huyện, THEN THE System SHALL gọi Cloud Function getVnWards với districtCode (nếu cần)

### Requirement 4

**User Story:** Là một khách hàng, tôi muốn hệ thống lấy dữ liệu địa điểm quốc tế từ Cloud Function, để có trải nghiệm nhất quán và tránh lỗi CORS.

#### Acceptance Criteria

1. WHEN System cần danh sách quốc gia, THEN THE System SHALL gọi Cloud Function getCountriesNow với action="countries"
2. WHEN Cloud Function getCountriesNow nhận request với action="countries", THEN THE System SHALL gọi CountriesNow API và cache kết quả với TTL 24 giờ
3. WHEN User chọn một quốc gia, THEN THE System SHALL gọi Cloud Function getCountriesNow với action="states" và country
4. WHEN User chọn một bang/vùng, THEN THE System SHALL gọi Cloud Function getCountriesNow với action="cities", country và state
5. WHEN Cloud Function getCountriesNow nhận request, THEN THE System SHALL trả về dữ liệu từ cache nếu còn hạn, nếu không sẽ gọi API và cache lại

### Requirement 5

**User Story:** Là một khách hàng, tôi muốn sử dụng tính năng gợi ý vị trí dựa trên GPS, để nhanh chóng tìm khách sạn gần tôi.

#### Acceptance Criteria

1. WHEN User bấm nút "Gợi ý GPS", THEN THE System SHALL yêu cầu quyền truy cập vị trí từ thiết bị
2. WHEN quyền vị trí bị từ chối, THEN THE System SHALL hiển thị thông báo lỗi và không thực hiện reverse geocode
3. WHEN quyền vị trí được cấp, THEN THE System SHALL lấy tọa độ GPS hiện tại của User
4. WHEN System có tọa độ GPS, THEN THE System SHALL gọi Cloud Function reverseGeocode với lat và lon
5. WHEN Cloud Function reverseGeocode nhận request, THEN THE System SHALL gọi Nominatim API và cache kết quả với TTL 6 giờ
6. WHEN reverse geocode thành công, THEN THE System SHALL tự động điền thông tin thành phố/khu vực vào form

### Requirement 6

**User Story:** Là một khách hàng, tôi muốn hệ thống kiểm tra đầy đủ thông tin đầu vào ở bước 1, để tránh lỗi khi tìm kiếm khách sạn.

#### Acceptance Criteria

1. WHEN User bấm "Tìm nhanh" mà chưa chọn tỉnh/thành hoặc khu vực, THEN THE System SHALL hiển thị thông báo lỗi và không thực hiện tìm kiếm
2. WHEN User chọn ngày trả phòng trước hoặc bằng ngày nhận phòng, THEN THE System SHALL hiển thị thông báo lỗi và không thực hiện tìm kiếm
3. WHEN User nhập số khách nhỏ hơn 1, THEN THE System SHALL tự động điều chỉnh về 1
4. WHEN User nhập số phòng nhỏ hơn 1, THEN THE System SHALL tự động điều chỉnh về 1
5. WHEN tất cả thông tin hợp lệ, THEN THE System SHALL thực hiện tìm kiếm khách sạn

### Requirement 7

**User Story:** Là một khách hàng, tôi muốn hệ thống kiểm tra trạng thái tài khoản trước khi thanh toán, để đảm bảo giao dịch hợp lệ.

#### Acceptance Criteria

1. WHEN User bấm thanh toán ở bước 3, THEN THE System SHALL kiểm tra User đã đăng nhập
2. WHEN User chưa đăng nhập, THEN THE System SHALL hiển thị thông báo lỗi và không cho phép thanh toán
3. WHEN User đã đăng nhập, THEN THE System SHALL kiểm tra trạng thái eKYC của User
4. WHEN ekycStatus không phải "VERIFIED", THEN THE System SHALL hiển thị thông báo lỗi và không cho phép thanh toán
5. WHEN canTransact là false, THEN THE System SHALL hiển thị thông báo lỗi và không cho phép thanh toán
6. WHEN status là "LOCKED", THEN THE System SHALL hiển thị thông báo lỗi và không cho phép thanh toán

### Requirement 8

**User Story:** Là một khách hàng, tôi muốn hệ thống kiểm tra trạng thái tài khoản nguồn trước khi thanh toán, để đảm bảo tài khoản có thể giao dịch.

#### Acceptance Criteria

1. WHEN User chọn tài khoản nguồn, THEN THE System SHALL kiểm tra tài khoản có thuộc về User
2. WHEN tài khoản nguồn không thuộc về User, THEN THE System SHALL hiển thị thông báo lỗi và không cho phép thanh toán
3. WHEN tài khoản nguồn có status "LOCKED", THEN THE System SHALL hiển thị thông báo lỗi và không cho phép thanh toán
4. WHEN tài khoản nguồn có status "ACTIVE", THEN THE System SHALL kiểm tra số dư
5. WHEN số dư không đủ, THEN THE System SHALL hiển thị thông báo lỗi và không cho phép thanh toán

### Requirement 9

**User Story:** Là một khách hàng, tôi muốn xác thực sinh trắc học cho giao dịch lớn, để bảo mật tài khoản của tôi.

#### Acceptance Criteria

1. WHEN tổng tiền thanh toán lớn hơn hoặc bằng 10,000,000 VND, THEN THE System SHALL yêu cầu xác thực sinh trắc học
2. WHEN User từ chối xác thực sinh trắc học, THEN THE System SHALL hiển thị thông báo lỗi và không cho phép thanh toán
3. WHEN xác thực sinh trắc học thất bại, THEN THE System SHALL hiển thị thông báo lỗi và không cho phép thanh toán
4. WHEN xác thực sinh trắc học thành công, THEN THE System SHALL tiếp tục xử lý thanh toán
5. WHEN tổng tiền nhỏ hơn 10,000,000 VND, THEN THE System SHALL không yêu cầu xác thực sinh trắc học

### Requirement 10

**User Story:** Là một khách hàng, tôi muốn hệ thống tạo booking và transaction trong Firestore, để có thể tra cứu lịch sử đặt phòng.

#### Acceptance Criteria

1. WHEN thanh toán thành công, THEN THE System SHALL tạo document trong collection transactions với type "HOTEL_BOOKING"
2. WHEN tạo transaction, THEN THE System SHALL lưu thông tin customerUid, accountNumber, hotelId, hotelName, amount, fee, status "SUCCESS"
3. WHEN thanh toán thành công, THEN THE System SHALL tạo document trong collection bookings với status "PAID"
4. WHEN tạo booking, THEN THE System SHALL lưu thông tin customerUid, hotelId, roomId, checkIn, checkOut, nights, guests, rooms, total, transactionId
5. WHEN tạo booking và transaction, THEN THE System SHALL sử dụng Firestore transaction để đảm bảo tính nhất quán

### Requirement 11

**User Story:** Là một khách hàng, tôi muốn hệ thống cập nhật số dư tài khoản sau khi thanh toán, để phản ánh chính xác số tiền còn lại.

#### Acceptance Criteria

1. WHEN thanh toán thành công, THEN THE System SHALL trừ số tiền từ tài khoản nguồn trong RTDB
2. WHEN cập nhật số dư, THEN THE System SHALL sử dụng runTransaction để đảm bảo tính nguyên tử
3. WHEN số dư không đủ trong quá trình transaction, THEN THE System SHALL rollback và hiển thị thông báo lỗi
4. WHEN cập nhật số dư thành công, THEN THE System SHALL trả về số dư mới cho frontend
5. WHEN cập nhật số dư thất bại, THEN THE System SHALL không tạo booking và transaction

### Requirement 12

**User Story:** Là một khách hàng, tôi muốn xem biên lai sau khi thanh toán thành công, để có bằng chứng về giao dịch đặt phòng.

#### Acceptance Criteria

1. WHEN thanh toán thành công, THEN THE System SHALL chuyển hướng User đến trang biên lai với transactionId
2. WHEN User vào trang biên lai, THEN THE System SHALL hiển thị trạng thái giao dịch, số tiền, mã giao dịch, thời gian
3. WHEN User vào trang biên lai, THEN THE System SHALL hiển thị chi tiết booking: thành phố, ngày nhận/trả, số đêm, loại phòng, số khách, số phòng
4. WHEN User vào trang biên lai, THEN THE System SHALL hiển thị nút "Tải biên lai", "Chia sẻ", "Xong"
5. WHEN User bấm "Xong", THEN THE System SHALL quay lại trang tiện ích

### Requirement 13

**User Story:** Là một developer, tôi muốn Cloud Functions xử lý tất cả API calls bên ngoài, để tránh lỗi CORS và tối ưu cache.

#### Acceptance Criteria

1. WHEN frontend cần gọi API bên ngoài, THEN THE System SHALL gọi qua Cloud Function tương ứng
2. WHEN Cloud Function nhận request, THEN THE System SHALL kiểm tra cache trong Firestore trước
3. WHEN cache còn hạn, THEN THE System SHALL trả về dữ liệu từ cache
4. WHEN cache hết hạn hoặc không tồn tại, THEN THE System SHALL gọi API bên ngoài
5. WHEN gọi API bên ngoài thành công, THEN THE System SHALL lưu kết quả vào cache với TTL phù hợp

### Requirement 14

**User Story:** Là một khách hàng, tôi muốn hệ thống xử lý lỗi một cách rõ ràng, để tôi biết vấn đề và cách khắc phục.

#### Acceptance Criteria

1. WHEN có lỗi xảy ra, THEN THE System SHALL hiển thị thông báo lỗi dễ hiểu bằng tiếng Việt
2. WHEN lỗi liên quan đến quyền truy cập, THEN THE System SHALL hướng dẫn User cách cấp quyền
3. WHEN lỗi liên quan đến dữ liệu không hợp lệ, THEN THE System SHALL chỉ rõ trường nào cần sửa
4. WHEN lỗi liên quan đến kết nối mạng, THEN THE System SHALL đề xuất User kiểm tra kết nối
5. WHEN lỗi không xác định, THEN THE System SHALL hiển thị thông báo chung và log chi tiết lỗi
