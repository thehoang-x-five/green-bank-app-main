# VietBank Documentation

## 📚 Available Documents

### 1. **Class Diagram** (`vietbank-class-diagram.puml`)
PlantUML class diagram chi tiết cho toàn bộ hệ thống VietBank.

**Cách xem:**

#### Option A: Online PlantUML Viewer
1. Mở file `vietbank-class-diagram.puml`
2. Copy toàn bộ nội dung
3. Truy cập: https://www.plantuml.com/plantuml/uml/
4. Paste vào và xem diagram

#### Option B: VS Code Extension
1. Cài extension: **PlantUML** (jebbs.plantuml)
2. Mở file `vietbank-class-diagram.puml`
3. Nhấn `Alt + D` để preview

#### Option C: Generate PNG/SVG
```bash
# Install PlantUML (requires Java)
brew install plantuml  # macOS
# or
sudo apt-get install plantuml  # Linux

# Generate PNG
plantuml docs/vietbank-class-diagram.puml

# Generate SVG
plantuml -tsvg docs/vietbank-class-diagram.puml
```

**Diagram bao gồm:**
- ✅ Domain Entities (AppUserProfile, BankAccount, Transaction, Cinema, Hotel...)
- ✅ Enums (AppUserRole, EkycStatus, TransactionType, TransactionStatus...)
- ✅ Relationships với multiplicities chính xác
- ✅ Constraints ({id}, {fk}, {unique}, {optional})
- ✅ Notes giải thích business rules

---

### 2. **Use Case Diagram** (`vietbank-usecase-diagram.puml`)
PlantUML Use Case Diagram chi tiết cho toàn bộ chức năng hệ thống.

**Cách xem:** (Giống Class Diagram)
- Online: https://www.plantuml.com/plantuml/uml/
- VS Code: Extension PlantUML + `Alt + D`
- Generate: `plantuml docs/vietbank-usecase-diagram.puml`

**Diagram bao gồm:**
- 👤 Actors: Customer, Officer, System, External Services
- 📦 Use Case Packages: Authentication, eKYC, Transfer, Booking, Admin...
- 🔗 Relationships: include, extend, uses, triggers
- 🔒 Security levels: PIN, OTP, Biometric, eKYC
- 📝 Notes giải thích business rules
- 🎨 Color-coded: Standard (orange), Critical (red), Admin (green)

---

### 3. **Entity-Relationship Diagram (ERD)** (`vietbank-erd.puml`)
PlantUML ERD chi tiết cho database schema (RTDB + Firestore).

**Cách xem:** (Giống Class Diagram)
- Online: https://www.plantuml.com/plantuml/uml/
- VS Code: Extension PlantUML + `Alt + D`
- Generate: `plantuml docs/vietbank-erd.puml`

**Diagram bao gồm:**
- 🔵 Firebase Realtime Database entities (users, accounts, transactions...)
- 🟠 Firebase Firestore collections (cinemas, hotels, bookings...)
- 🔗 Relationships với cardinality (1-to-many, many-to-many...)
- 📝 Notes giải thích database structure
- 🎨 Color-coded: RTDB (blue) vs Firestore (orange)
- 📊 Legend với notation explanation

---

### 4. **Database Schema Documentation** (`DATABASE_SCHEMA.md`)
Tài liệu chi tiết về database schema.

**Nội dung:**
- 📊 Database Architecture (Why hybrid RTDB + Firestore?)
- 📋 RTDB Schema (users, accounts, transactions, otps...)
- 📄 Firestore Schema (cinemas, hotels, bookings...)
- 🔗 Cross-Database Relationships
- 🔒 Security Rules examples
- 📈 Performance Optimization (indexes, caching)
- 🔄 Data Migration & Seed scripts
- 📊 Database Size Estimates
- 🚀 Backup & Recovery

---

### 5. **Project Overview** (`PROJECT_OVERVIEW.md`)
Tài liệu tổng quan về project VietBank.

**Nội dung:**
- 📋 Project Overview (Tech Stack, Architecture)
- 🏗️ Architecture (Layered Architecture, Database Structure)
- 🔐 Security Features (Auth, eKYC, Transaction Security)
- 💰 Core Features (Transfer, Booking, Deposit/Withdraw...)
- 🎯 Key Technical Implementations
- 📊 Data Flow Examples
- 🧪 Testing Strategy
- 📱 Mobile Features (Capacitor)
- 🚀 Deployment
- 🔮 Future Enhancements

---

### 6. **Implementation Docs** (`.kiro/docs/`)

#### Booking Availability Implementation
- Real-time seat booking for movies
- Room availability check for hotels
- Date overlap detection logic

#### Seeded Random Implementation
- Consistent seed data across machines
- Linear Congruential Generator (LCG)
- Cinema seed: 12345, Hotel seed: 54321

---

## 🎨 Diagram Legend

### Colors
- 🟢 **Green (ENTITY_COLOR)**: Domain Entities (Data Models)
- 🔵 **Blue (SERVICE_COLOR)**: Services (Business Logic)
- 🟠 **Orange (COMPONENT_COLOR)**: UI Components (React)
- 🟣 **Purple (UTIL_COLOR)**: Infrastructure (External APIs)

### Relationships
- **Solid Line (—)**: Association (has-a relationship)
- **Dashed Line (..>)**: Dependency (uses)
- **Arrow (→)**: Direction of dependency

### Multiplicity
- `1`: Exactly one
- `0..1`: Zero or one
- `0..*`: Zero or many
- `1..*`: One or many

---

## 📖 How to Read the Use Case Diagram

### 1. Identify Actors
Các actor chính:
- **Customer**: Khách hàng sử dụng app (đăng ký, chuyển tiền, đặt vé...)
- **Officer**: Nhân viên ngân hàng (duyệt eKYC, quản lý khách hàng...)
- **System**: Hệ thống tự động (gửi notification, tạo transaction...)
- **External Services**: Dịch vụ bên ngoài (Email, Biometric, Stripe...)

### 2. Follow Use Case Packages
Các nhóm chức năng:
- **Authentication & Account Management**: Đăng nhập, đăng ký, đổi mật khẩu...
- **eKYC**: Upload giấy tờ, duyệt eKYC, cấp CIF...
- **Money Transfer**: Chuyển tiền nội bộ/liên ngân hàng, OTP, biometric...
- **Deposit & Withdrawal**: Nạp/rút tiền, Stripe topup...
- **Movie Booking**: Tìm rạp, chọn ghế, đặt vé...
- **Hotel Booking**: Tìm khách sạn, kiểm tra phòng trống, đặt phòng...
- **Officer Portal**: Dashboard, quản lý khách hàng, xem giao dịch...

### 3. Understand Relationships
- **→** (Association): Actor thực hiện use case
- **..> <<include>>**: Use case bắt buộc phải gọi sub-use case (VD: Transfer → Verify PIN)
- **..> <<extend>>**: Use case tùy chọn/điều kiện (VD: Biometric nếu >= 10M VND)
- **→ <<uses>>**: Sử dụng external system (VD: Send OTP → Email Service)
- **→ <<triggers>>**: Kích hoạt system automation (VD: Create Transaction → System)

### 4. Security Layers
Các lớp bảo mật:
- **PIN**: Bắt buộc cho mọi giao dịch (deposit, withdraw, transfer, booking)
- **OTP**: Bắt buộc cho chuyển tiền và rút tiền OTP (expire 2 phút, max 5 attempts)
- **Biometric**: Bắt buộc cho giao dịch >= 10M VND (vân tay/FaceID)
- **eKYC**: Bắt buộc để được phép giao dịch (upload CMND + selfie → officer duyệt)

---

## 📖 How to Read the Class Diagram

### 1. Start with Domain Entities
Các entity chính:
- **AppUserProfile**: Thông tin người dùng (customer/officer)
- **BankAccount**: Tài khoản ngân hàng (balance, status, pin)
- **Transaction**: Giao dịch chuyển tiền
- **Cinema, Movie, Showtime**: Dữ liệu rạp phim
- **HotelItem, HotelRoom**: Dữ liệu khách sạn

### 2. Follow Service Dependencies
Services sử dụng entities:
- **AuthService** → manages AppUserProfile, creates BankAccount
- **TransferService** → creates Transaction, manages OtpData
- **MovieBookingService** → creates MovieBooking, updates Showtime
- **HotelBookingService** → creates HotelBooking, checks room availability

### 3. Trace UI Component Flow
UI components gọi services:
- **LoginPage** → AuthService.loginWithEmail()
- **TransferPage** → TransferService.initiateTransferToAccount()
- **MovieBookingPage** → CinemaService + MovieBookingService
- **HotelBookingPage** → HotelService + HotelBookingService

### 4. Understand Infrastructure
Services sử dụng infrastructure:
- **Firebase Auth**: Authentication
- **Firebase RTDB**: Real-time data (users, accounts, transactions)
- **Firebase Firestore**: Document data (cinemas, hotels, bookings)
- **Cloudinary**: Image storage (eKYC documents)
- **EmailJS**: Email OTP
- **Stripe**: Payment gateway

---

## 🔍 Key Patterns in the Diagram

### 1. Service Layer Pattern
```
UI Component → Service → Infrastructure
```
- UI không trực tiếp gọi Firebase
- Service xử lý business logic
- Infrastructure chỉ lo I/O

### 2. Repository Pattern
```
Service → Firebase RTDB/Firestore
```
- Service không biết chi tiết database
- Dễ dàng thay đổi database sau này

### 3. Dependency Injection
```
Component receives Service as dependency
```
- Dễ test (mock services)
- Loose coupling

### 4. Atomic Operations
```
Service → runTransaction() → Ensure consistency
```
- Prevent race conditions
- Guarantee data integrity

---

## 📝 Notes on Diagram

### Important Notes Included:
1. **BiometricService**: Handles biometric auth for transactions >= 10M VND
2. **TransferService**: OTP-based transfer flow (initiate → verify biometric → confirm OTP)
3. **MovieBookingService**: Updates occupiedSeats atomically using arrayUnion
4. **HotelBookingService**: Checks room availability by detecting date overlaps
5. **AuthService**: Implements login lock after 5 failed attempts
6. **EkycService**: Manages eKYC workflow (upload → review → approve → assign CIF)

---

## 🚀 Quick Start

### View Use Case Diagram
```bash
# Online viewer (easiest)
open https://www.plantuml.com/plantuml/uml/

# VS Code (recommended for development)
code docs/vietbank-usecase-diagram.puml
# Press Alt + D to preview

# Generate image
plantuml docs/vietbank-usecase-diagram.puml
open docs/vietbank-usecase-diagram.png
```

### View Class Diagram
```bash
# Online viewer
open https://www.plantuml.com/plantuml/uml/

# VS Code
code docs/vietbank-class-diagram.puml
# Press Alt + D to preview

# Generate image
plantuml docs/vietbank-class-diagram.puml
open docs/vietbank-class-diagram.png
```

### View ERD (Database Diagram)
```bash
# Online viewer
open https://www.plantuml.com/plantuml/uml/

# VS Code
code docs/vietbank-erd.puml
# Press Alt + D to preview

# Generate image
plantuml docs/vietbank-erd.puml
open docs/vietbank-erd.png
```

### Read Documentation
```bash
# Open in VS Code
code docs/PROJECT_OVERVIEW.md
code docs/DATABASE_SCHEMA.md
code docs/README.md
```

---

## 📞 Support

Nếu có câu hỏi về documentation:
1. Đọc kỹ `PROJECT_OVERVIEW.md` trước
2. Xem Class Diagram để hiểu relationships
3. Đọc implementation docs trong `.kiro/docs/`
4. Check source code với comments chi tiết

---

## 🎯 Next Steps

1. ✅ Đọc `PROJECT_OVERVIEW.md` để hiểu tổng quan
2. ✅ Xem `vietbank-usecase-diagram.puml` để hiểu chức năng hệ thống
3. ✅ Xem `vietbank-class-diagram.puml` để hiểu domain model
4. ✅ Xem `vietbank-erd.puml` để hiểu database schema
5. ✅ Đọc `DATABASE_SCHEMA.md` để hiểu chi tiết database
6. ✅ Đọc implementation docs để hiểu chi tiết kỹ thuật
7. ✅ Xem source code với comments để hiểu implementation

**Happy coding! 🚀**
