# GSC Tool Debug Guide v2.0

## 📋 Mục lục
1. [Cách kiểm tra Log](#cách-kiểm-tra-log)
2. [Hiểu về Enhanced Logging System](#hiểu-về-enhanced-logging-system)  
3. [Khi nào Log bị Reset](#khi-nào-log-bị-reset)
4. [Kiểm tra trạng thái Queue](#kiểm-tra-trạng-thái-queue)
5. [Debug Commands nhanh](#debug-commands-nhanh)
6. [Các lỗi thường gặp](#các-lỗi-thường-gặp)

## 🔍 Cách kiểm tra Log

### 1. Mở Background Console:
1. Vào **Chrome Extensions** (`chrome://extensions/`)
2. Bật **Developer mode**
3. Tìm **GSC Tool** → Click **"background page"** hoặc **"service worker"**
4. Console sẽ hiển thị tất cả logs từ background.js

### 2. Hiểu Log Format mới:
```
🔵 [14:30:25] [SW:120s] [45] [INFO] 🚀 Background queue started: {totalUrls: 50, tabId: 123}
└─ Icon  └─ Time   └─ Uptime └─ Counter └─ Level    └─ Message + Data
```

**Giải thích:**
- **🔵/🟡/🔴**: Icon theo level (INFO/WARN/ERROR)
- **[14:30:25]**: Timestamp chính xác
- **[SW:120s]**: Service Worker uptime (120 giây)
- **[45]**: Log counter (log thứ 45)
- **[INFO]**: Log level
- **🚀**: Emoji phân loại (🚀=QUEUE, 📦=PACK, 🔧=DEBUG, etc.)

## 🎯 Hiểu về Enhanced Logging System

### Log Levels:
- **🔵 INFO**: Thông tin chính (start/stop queue, khởi động)
- **🟡 WARN**: Cảnh báo (service worker suspend, unknown message)
- **🔴 ERROR**: Lỗi nghiêm trọng (inject failed, tab closed)
- **🔧 DEBUG**: Chi tiết kỹ thuật (message received, status sent)
- **🚀 QUEUE**: Hoạt động queue (start, pause, URL processing)

### Persistent Log Features:
- **Log Counter**: Đếm tổng số log từ khi SW khởi động
- **Service Worker Uptime**: Thời gian SW chạy liên tục
- **Timestamp chính xác**: Theo giờ địa phương
- **Structured Data**: Objects được log kèm chi tiết

## ⚠️ Khi nào Log bị Reset

### Log sẽ BỊ MẤT khi:
1. **Extension Reload**: Developer reload extension (`Ctrl+R` trong chrome://extensions/)
2. **Extension Update**: Auto-update hoặc manual update từ store
3. **Browser Restart**: Đóng hoàn toàn và mở lại Chrome
4. **Service Worker Terminate**: Chrome tự động terminate SW sau idle
5. **Manual Clear**: Dev tools → Console → Clear hoặc `console.clear()`
6. **Extension Disable/Enable**: Tắt/bật extension

### Log sẽ TIẾP TỤC khi:
- ✅ Đóng/mở popup (popup ≠ background)
- ✅ Đóng/mở tab GSC (background vẫn chạy)
- ✅ Chuyển tab khác rồi quay lại
- ✅ Lock/unlock máy tính
- ✅ Chrome minimize/restore

### Cách nhận biết Log Reset:
- **Log counter** về 0
- **Service Worker uptime** về 0s  
- **First log**: `🚀 GSC Tool Background Service Worker Started`

## 🔄 Kiểm tra trạng thái Queue

### 1. Qua Log:
Tìm logs có icon 🚀 (QUEUE):
```
🚀 [14:30:25] [SW:120s] [45] [QUEUE] 🚀 Background queue started: {totalUrls: 50, tabId: 123}
🚀 [14:30:27] [SW:122s] [46] [QUEUE] 🔄 Processing URL: {index: 1, total: 50, url: "https://..."}
🚀 [14:30:30] [SW:125s] [47] [QUEUE] ✅ URL processed, moving to next: {current: 2, total: 50}
```

### 2. Qua Storage:
Trong Console, chạy:
```javascript
chrome.storage.local.get(['urlQueue', 'currentUrlIndex', 'backgroundMode', 'queueProcessing', 'queuePaused'], (data) => console.log('Queue State:', data));
```

### 3. Qua Debug Object:
```javascript
// Kiểm tra state tổng quát
gscToolDebug.getQueueState()

// Xem log custom
gscToolDebug.log('DEBUG', 'Custom debug message', {data: 'test'})

// Clear logs thủ công  
gscToolDebug.clearLogs()
```

## ⚡ Debug Commands nhanh

### Kiểm tra Extension có hoạt động:
```javascript
chrome.runtime.sendMessage({type: 'GET_QUEUE_STATUS'}, (response) => console.log('Extension Response:', response));
```

### Kiểm tra Service Worker:
```javascript
// Trong background console
console.log('Service Worker Active:', {
    uptime: Math.round((Date.now() - serviceWorkerStartTime) / 1000) + 's',
    logCount: logCounter,
    queueActive: backgroundMode && queueProcessing,
    currentIndex: currentUrlIndex,
    totalUrls: urlQueue.length
});
```

### Force resume Queue nếu bị stuck:
```javascript
// Trong background console
if (backgroundMode && !queueProcessing) {
    queueProcessing = true;
    startQueueProcessing();
    console.log('Force resumed queue');
}
```

### Reset Queue hoàn toàn:
```javascript
// Trong background console  
stopQueueProcessing();
chrome.storage.local.clear();
console.log('Queue reset completely');
```

## 🐛 Các lỗi thường gặp

### 1. "Cannot access contents of the page"
- **Nguyên nhân**: GSC tab bị refresh hoặc navigate
- **Log pattern**: `🔴 [ERROR] ❌ Error processing queue URL: Cannot access contents...`
- **Giải pháp**: Quay lại trang GSC, queue sẽ tự resume

### 2. Queue bị stuck không chạy
- **Kiểm tra**: `gscToolDebug.getQueueState()`
- **Nếu** `queueProcessing: false` nhưng `backgroundMode: true`
- **Giải pháp**: Force resume bằng command trên

### 3. Service Worker terminate liên tục  
- **Log pattern**: `🟡 [WARN] ⚠️ Service Worker is being suspended`
- **Nguyên nhân**: Chrome memory management
- **Queue vẫn OK**: Sẽ auto-restore khi cần

### 4. Log counter nhảy cóc
- **VD**: Counter từ 45 → 1  
- **Nguyên nhân**: Service Worker restart
- **Kiểm tra**: Look for `🚀 GSC Tool Background Service Worker Started`

## 📊 Log Monitoring Best Practices

### Khi test Queue:
1. Mở background console **TRƯỚC** khi start queue
2. Leave console open suốt quá trình
3. Theo dõi pattern: START → PROCESSING → URL_PROCESSED → NEXT...
4. Nếu log dừng > 30s mà chưa có "URL processed" → có lỗi

### Khi báo bug:
1. Copy **toàn bộ** background console (từ "Service Worker Started")
2. Include **queue state**: `gscToolDebug.getQueueState()`  
3. Include **storage state**: Chạy storage command ở trên
4. Note **steps to reproduce** và **expected vs actual**

---

**💡 Tip**: Bookmark guide này và luôn kiểm tra background console khi có vấn đề!
