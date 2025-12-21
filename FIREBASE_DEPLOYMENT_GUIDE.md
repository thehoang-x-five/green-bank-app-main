# 🔥 Hướng Dẫn Deploy Firebase Realtime Database

## 📋 Tổng Quan

File này hướng dẫn cách deploy Firebase Realtime Database rules và indexes lên production.

## 🗂️ Cấu Trúc Database

### **utilityTransactions** (Lịch sử giao dịch)

```
utilityTransactions/
  ├── {transactionId}/
  │   ├── transactionId: string
  │   ├── userId: string
  │   ├── accountId: string
  │   ├── type: "DATA_PACK_PURCHASE" | "PHONE_TOPUP"
  │   ├── amount: number
  │   ├── description: string
  │   ├── status: "SUCCESS" | "FAILED"
  │   ├── phoneNumber: string
  │   ├── telco: string
  │   ├── packId?: string (cho DATA_PACK_PURCHASE)
  │   ├── packName?: string (cho DATA_PACK_PURCHASE)
  │   ├── packPrice?: number (cho DATA_PACK_PURCHASE)
  │   ├── topupAmount?: number (cho PHONE_TOPUP)
  │   ├── createdAt: number (timestamp)
  │   └── createdAtServer: ServerValue.TIMESTAMP
```

### **notifications** (Thông báo biến động)

```
notifications/
  ├── {userId}/
  │   ├── {notificationId}/
  │   │   ├── type: "BALANCE_CHANGE"
  │   │   ├── direction: "OUT" | "IN"
  │   │   ├── title: string
  │   │   ├── message: string
  │   │   ├── amount: number
  │   │   ├── accountNumber: string
  │   │   ├── balanceAfter: number
  │   │   ├── transactionId: string
  │   │   └── createdAt: number
```

### **accounts** (Tài khoản thanh toán)

```
accounts/
  ├── {accountId}/
  │   ├── uid: string
  │   ├── accountNumber: string
  │   ├── accountType: string
  │   ├── balance: number
  │   └── status: "ACTIVE" | "LOCKED"
```

## 🚀 Các Bước Deploy

### **Bước 1: Đăng nhập Firebase CLI**

```bash
firebase login
```

### **Bước 2: Chọn Project**

```bash
firebase use <project-id>
```

### **Bước 3: Deploy Database Rules**

```bash
firebase deploy --only database
```

### **Bước 4: Kiểm Tra Rules**

1. Mở Firebase Console: https://console.firebase.google.com
2. Chọn project của bạn
3. Vào **Realtime Database** → **Rules**
4. Xác nhận rules đã được deploy đúng

### **Bước 5: Kiểm Tra Indexes**

1. Trong Firebase Console, vào **Realtime Database**
2. Kiểm tra tab **Indexes** (nếu có)
3. Xác nhận indexes cho `utilityTransactions` đã được tạo:
   - `userId`
   - `type`
   - `createdAt`

## 🔒 Bảo Mật

### **Rules Đã Cấu Hình**

1. **utilityTransactions**:

   - ✅ Chỉ user đã đăng nhập mới đọc/ghi được
   - ✅ User chỉ đọc được transactions của chính mình
   - ✅ User chỉ tạo được transactions với userId của mình

2. **notifications**:

   - ✅ User chỉ đọc/ghi được notifications của chính mình

3. **accounts**:
   - ✅ User chỉ đọc/ghi được accounts của chính mình

## 📊 Indexes

Indexes đã được cấu hình cho query nhanh:

```json
{
  "utilityTransactions": {
    ".indexOn": ["userId", "type", "createdAt"]
  },
  "notifications": {
    "$uid": {
      ".indexOn": ["createdAt", "type"]
    }
  }
}
```

## 🧪 Test Rules

### **Test 1: User có thể đọc transactions của mình**

```javascript
// Simulator trong Firebase Console
{
  "auth": {
    "uid": "user123"
  }
}

// Path: /utilityTransactions/{txnId}
// Data: { "userId": "user123", ... }
// Expected: READ = true
```

### **Test 2: User KHÔNG thể đọc transactions của người khác**

```javascript
// Simulator trong Firebase Console
{
  "auth": {
    "uid": "user123"
  }
}

// Path: /utilityTransactions/{txnId}
// Data: { "userId": "user456", ... }
// Expected: READ = false
```

## 🔧 Troubleshooting

### **Vấn đề: Query chậm**

**Giải pháp**: Kiểm tra indexes đã được tạo chưa

### **Vấn đề: Permission denied**

**Giải pháp**:

1. Kiểm tra user đã đăng nhập chưa
2. Kiểm tra rules đã deploy đúng chưa
3. Kiểm tra userId trong data có khớp với auth.uid không

### **Vấn đề: Không thấy data**

**Giải pháp**:

1. Mở Firebase Console → Realtime Database
2. Kiểm tra data có tồn tại không
3. Kiểm tra structure có đúng không
4. Kiểm tra console log trong app

## 📝 Notes

- **QUAN TRỌNG**: Sau khi deploy rules, có thể mất vài phút để rules có hiệu lực
- Nên test rules trong Firebase Console Simulator trước khi deploy
- Backup rules cũ trước khi deploy rules mới
- Monitor Firebase Console để xem có lỗi gì không

## 🎯 Checklist Deploy

- [ ] Đã đăng nhập Firebase CLI
- [ ] Đã chọn đúng project
- [ ] Đã review rules trong `database.rules.json`
- [ ] Đã backup rules cũ (nếu có)
- [ ] Đã deploy: `firebase deploy --only database`
- [ ] Đã kiểm tra rules trong Firebase Console
- [ ] Đã test rules với Simulator
- [ ] Đã test app với rules mới
- [ ] Đã kiểm tra indexes hoạt động

## 🔗 Links Hữu Ích

- [Firebase Realtime Database Rules](https://firebase.google.com/docs/database/security)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Indexing Data](https://firebase.google.com/docs/database/security/indexing-data)
