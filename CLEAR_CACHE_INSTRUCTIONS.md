# HƯỚ

NG DẪN XÓA CACHE ĐỂ FIX LỖI 400

## Vấn đề:
Browser đang cache Firebase SDK cũ (12.6.0) và không load Firebase 10.14.1 mới

## Giải pháp:

### Bước 1: Xóa cache trong Chrome/Edge
1. Mở DevTools (F12)
2. Vào tab **Application**
3. Bên trái, click **Clear storage**
4. Tick tất cả các ô:
   - ✅ Local storage
   - ✅ Session storage
   - ✅ IndexedDB
   - ✅ Web SQL
   - ✅ Cookies
   - ✅ Cache storage
   - ✅ Application cache
5. Click **Clear site data**

### Bước 2: Hard Reload
- Nhấn **Ctrl + Shift + R** (Windows)
- Hoặc **Ctrl + F5**

### Bước 3: Hoặc dùng Incognito Mode
- Nhấn **Ctrl + Shift + N**
- Vào http://localhost:5175/

### Bước 4: Kiểm tra console logs
Sau khi load lại, bạn phải thấy:
```
[firebase] 🔧 Initializing with emulator mode...
[firebase] Connecting Firestore to emulator: 127.0.0.1:8080
[firebase] ✅ Firestore connected to emulator
[firebase] Connecting Functions to emulator: 127.0.0.1:5001
[firebase] ✅ Functions connected to emulator
```

### Bước 5: Test tìm rạp
1. Chọn tỉnh: **Khánh Hòa** (code 56)
2. Click **Tìm rạp phim**
3. Phải thấy 4 rạp ở Nha Trang

## Nếu vẫn lỗi:
Gửi cho tôi screenshot của:
1. Console logs (toàn bộ từ lúc load trang)
2. Network tab - request bị lỗi 400
3. Emulator UI (http://127.0.0.1:4000/firestore) - xem có data không
