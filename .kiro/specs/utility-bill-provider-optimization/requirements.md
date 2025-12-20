# Requirements Document

## Introduction

Hệ thống thanh toán hóa đơn tiện ích hiện tại sử dụng dữ liệu hardcoded làm fallback khi database trống. Điều này phù hợp cho môi trường demo nhưng không phù hợp cho production. Spec này định nghĩa các yêu cầu để tối ưu hóa cách hệ thống xử lý danh sách nhà cung cấp dịch vụ.

## Glossary

- **System**: Hệ thống thanh toán hóa đơn tiện ích
- **Provider**: Nhà cung cấp dịch vụ (điện, nước)
- **Fallback_Data**: Dữ liệu hardcoded được sử dụng khi database trống
- **Database**: Firebase Realtime Database
- **Production_Mode**: Môi trường production thực tế
- **Demo_Mode**: Môi trường demo/development

## Requirements

### Requirement 1: Database-Only Provider Loading

**User Story:** Là một developer, tôi muốn hệ thống chỉ load providers từ database trong production, để đảm bảo dữ liệu luôn chính xác và được quản lý tập trung.

#### Acceptance Criteria

1. WHEN THE System loads providers in Production_Mode, THE System SHALL fetch data exclusively from Database
2. WHEN THE Database returns empty results in Production_Mode, THE System SHALL display an empty provider list
3. WHEN THE System loads providers in Demo_Mode, THE System SHALL use Fallback_Data if Database is empty
4. THE System SHALL NOT use Fallback_Data in Production_Mode under any circumstances

### Requirement 2: Environment Detection

**User Story:** Là một developer, tôi muốn hệ thống tự động phát hiện môi trường đang chạy, để áp dụng logic phù hợp cho từng môi trường.

#### Acceptance Criteria

1. THE System SHALL detect whether it is running in Production_Mode or Demo_Mode
2. WHEN environment variables are configured, THE System SHALL use environment variables to determine mode
3. WHEN environment variables are not configured, THE System SHALL default to Production_Mode for safety
4. THE System SHALL expose the current mode through a configuration module

### Requirement 3: Empty State Handling

**User Story:** Là một user, tôi muốn thấy thông báo rõ ràng khi không có nhà cung cấp nào, để hiểu tại sao tôi không thể tiếp tục.

#### Acceptance Criteria

1. WHEN THE provider list is empty, THE System SHALL display a user-friendly message
2. THE message SHALL explain that no providers are currently available
3. THE System SHALL disable the provider selection input when list is empty
4. THE System SHALL prevent form submission when no provider is selected

### Requirement 4: Fallback Data Removal

**User Story:** Là một developer, tôi muốn loại bỏ hardcoded fallback data khỏi production code, để giảm technical debt và tránh nhầm lẫn.

#### Acceptance Criteria

1. THE System SHALL move Fallback_Data to a separate configuration file
2. THE Fallback_Data SHALL only be imported when Demo_Mode is active
3. WHEN building for Production_Mode, THE System SHALL NOT include Fallback_Data in the bundle
4. THE System SHALL document clearly where and why Fallback_Data exists

### Requirement 5: Backward Compatibility

**User Story:** Là một developer, tôi muốn đảm bảo các thay đổi không phá vỡ chức năng hiện tại, để hệ thống vẫn hoạt động ổn định.

#### Acceptance Criteria

1. WHEN THE System runs in Demo_Mode, THE System SHALL behave identically to current implementation
2. THE System SHALL maintain the same API interface for provider fetching
3. WHEN providers are available in Database, THE System SHALL display them regardless of mode
4. THE System SHALL NOT require changes to existing test data or Firebase structure
