# Requirements Document

## Introduction

Cải tiến trang cài đặt bảo mật (SecuritySettings.tsx) để thêm chức năng bật/tắt đăng nhập bằng sinh trắc học và xác thực 2 lớp. Hiện tại trang này chỉ có chức năng đổi mật khẩu đăng nhập và thiết lập/đổi PIN giao dịch. Cần bổ sung thêm các tính năng bảo mật nâng cao để người dùng có thể quản lý đầy đủ các phương thức xác thực.

## Glossary

- **SecuritySettings**: Trang cài đặt bảo mật trong ứng dụng VietBank
- **BiometricService**: Service quản lý xác thực sinh trắc học (vân tay/FaceID) đã có sẵn
- **BiometricLogin**: Chức năng đăng nhập bằng sinh trắc học cần được thêm vào
- **TwoFactorAuth**: Xác thực 2 lớp yêu cầu thêm bước xác minh khi đăng nhập
- **AuthMethod**: Phương thức xác thực (SMS OTP, Smart OTP, Token, Sinh trắc học)
- **UserPreferences**: Cài đặt cá nhân của người dùng được lưu trữ trong Firebase/Firestore
- **AuthenticationFlow**: Luồng xác thực đăng nhập của người dùng

## Requirements

### Requirement 1

**User Story:** Là người dùng, tôi muốn bật/tắt đăng nhập bằng sinh trắc học, để có thể đăng nhập nhanh chóng và an toàn mà không cần nhập mật khẩu.

#### Acceptance Criteria

1. WHEN người dùng truy cập SecuritySettings, THE SecuritySettings SHALL hiển thị tùy chọn bật/tắt đăng nhập sinh trắc học
2. WHEN người dùng bật đăng nhập sinh trắc học, THE SecuritySettings SHALL kiểm tra khả năng sinh trắc học của thiết bị bằng BiometricService
3. WHEN thiết bị không hỗ trợ sinh trắc học, THE SecuritySettings SHALL hiển thị thông báo và vô hiệu hóa tùy chọn
4. WHEN người dùng tắt đăng nhập sinh trắc học, THE SecuritySettings SHALL lưu cài đặt và yêu cầu đăng nhập bằng mật khẩu
5. WHEN cài đặt sinh trắc học được thay đổi, THE SecuritySettings SHALL lưu trữ cài đặt vào UserPreferences

### Requirement 2

**User Story:** Là người dùng, tôi muốn bật/tắt xác thực 2 lớp khi đăng nhập, để tăng cường bảo mật tài khoản của mình.

#### Acceptance Criteria

1. WHEN người dùng truy cập SecuritySettings, THE SecuritySettings SHALL hiển thị tùy chọn bật/tắt xác thực 2 lớp
2. WHEN người dùng bật xác thực 2 lớp, THE SecuritySettings SHALL lưu cài đặt và áp dụng cho lần đăng nhập tiếp theo
3. WHEN người dùng tắt xác thực 2 lớp, THE SecuritySettings SHALL hiển thị cảnh báo bảo mật và yêu cầu xác nhận
4. WHEN xác thực 2 lớp được bật, THE SecuritySettings SHALL yêu cầu OTP khi đăng nhập từ thiết bị mới
5. WHEN cài đặt xác thực 2 lớp được thay đổi, THE SecuritySettings SHALL gửi thông báo xác nhận

### Requirement 3

**User Story:** Là người dùng, tôi muốn chọn phương thức xác thực 2 lớp ưa thích, để có trải nghiệm đăng nhập phù hợp với nhu cầu của mình.

#### Acceptance Criteria

1. WHEN xác thực 2 lớp được bật, THE SecuritySettings SHALL hiển thị các phương thức xác thực khả dụng
2. WHEN người dùng chọn SMS OTP, THE SecuritySettings SHALL xác minh số điện thoại và lưu cài đặt
3. WHEN người dùng chọn Smart OTP, THE SecuritySettings SHALL hiển thị hướng dẫn cài đặt ứng dụng Smart OTP
4. WHEN người dùng chọn Token thiết bị, THE SecuritySettings SHALL hiển thị hướng dẫn kích hoạt token
5. WHEN phương thức được chọn, THE SecuritySettings SHALL lưu lựa chọn vào UserPreferences

### Requirement 4

**User Story:** Là người dùng, tôi muốn xem trạng thái hiện tại của các cài đặt bảo mật, để biết được mức độ bảo mật tài khoản của mình.

#### Acceptance Criteria

1. WHEN người dùng truy cập SecuritySettings, THE SecuritySettings SHALL hiển thị trạng thái hiện tại của đăng nhập sinh trắc học
2. WHEN người dùng truy cập SecuritySettings, THE SecuritySettings SHALL hiển thị trạng thái hiện tại của xác thực 2 lớp
3. WHEN có cài đặt bảo mật được bật, THE SecuritySettings SHALL hiển thị badge hoặc indicator tương ứng
4. WHEN thiết bị không hỗ trợ sinh trắc học, THE SecuritySettings SHALL hiển thị thông báo rõ ràng
5. WHEN có lỗi khi tải cài đặt, THE SecuritySettings SHALL hiển thị thông báo lỗi và cho phép thử lại

### Requirement 5

**User Story:** Là hệ thống, tôi cần tích hợp với BiometricService và UserService hiện có, để đảm bảo tính nhất quán và tái sử dụng code.

#### Acceptance Criteria

1. WHEN SecuritySettings cần kiểm tra khả năng sinh trắc học, THE SecuritySettings SHALL sử dụng BiometricService.runBiometricVerification
2. WHEN SecuritySettings cần lưu cài đặt người dùng, THE SecuritySettings SHALL sử dụng UserService hoặc Firebase/Firestore
3. WHEN SecuritySettings cần xác thực sinh trắc học, THE SecuritySettings SHALL sử dụng các hàm từ BiometricService
4. WHEN xử lý lỗi sinh trắc học, THE SecuritySettings SHALL sử dụng BiometricVerificationResponse từ BiometricService
5. WHEN cập nhật cài đặt, THE SecuritySettings SHALL đồng bộ với cấu trúc dữ liệu hiện có

### Requirement 6

**User Story:** Là người dùng, tôi muốn giao diện cài đặt bảo mật nhất quán với thiết kế hiện tại, để có trải nghiệm sử dụng mượt mà.

#### Acceptance Criteria

1. WHEN thêm tính năng mới, THE SecuritySettings SHALL giữ nguyên cấu trúc Card và layout hiện tại
2. WHEN hiển thị tùy chọn bật/tắt, THE SecuritySettings SHALL sử dụng Switch component như các tùy chọn khác
3. WHEN hiển thị thông tin bổ sung, THE SecuritySettings SHALL sử dụng Label và muted-foreground text
4. WHEN có form con, THE SecuritySettings SHALL sử dụng pattern border-t và pt-3 như form PIN hiện tại
5. WHEN hiển thị trạng thái, THE SecuritySettings SHALL sử dụng Badge component phù hợp