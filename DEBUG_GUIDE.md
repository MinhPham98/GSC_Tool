# 🔧 DEBUG GUIDE - Console Log cho GSC Tool Extension

## 📋 Cách kiểm tra Console Log của Background Script (Service Worker)

### Bước 1: Mở Developer Tools cho Service Worker
1. Vào `chrome://extensions/`
2. Bật "Developer mode" 
3. Tìm "GSC Tool" extension
4. Click **"background.html"** (hoặc "service worker") 
5. Console tab sẽ mở ra

### Bước 2: Kiểm tra trạng thái Service Worker
```javascript
// Copy-paste vào Console để kiểm tra trạng thái hiện tại:
console.log('=== QUEUE STATUS CHECK ===');
console.log('backgroundMode:', backgroundMode);
console.log('queueProcessing:', queueProcessing); 
console.log('queuePaused:', queuePaused);
console.log('currentUrlIndex:', currentUrlIndex);
console.log('urlQueue length:', urlQueue.length);
console.log('targetTabId:', targetTabId);
```

## ⚠️ Các trường hợp Console Log bị XÓA:

### 🔴 LOG BỊ XÓA HOÀN TOÀN:
1. **Reload Extension** - Click "Reload" trong chrome://extensions/
2. **Update Extension** - Modify code và reload
3. **Service Worker Terminate** - Chrome tự động stop sau 30s idle
4. **Browser Restart** - Đóng/mở lại Chrome
5. **Manual Clear** - Click "Clear console" button

### 🟢 LOG ĐƯỢC GIỮ NGUYÊN:
1. **Đóng/Mở Popup** - Service worker vẫn running
2. **Reload tab GSC** - Service worker độc lập
3. **Message Exchange** - Service worker active, log tiếp tục

## 🛠️ Cách DEBUG khi Log bị mất:

### Method 1: Wake up Service Worker
```javascript
// Từ popup hoặc content script, gửi message để wake up:
chrome.runtime.sendMessage({type: "GET_QUEUE_STATUS"}, (response) => {
    console.log("Service worker response:", response);
});
```

### Method 2: Kiểm tra Storage State
```javascript
// Check state trong storage (data vẫn còn dù log mất):
chrome.storage.local.get(null, (data) => {
    console.log("Current storage state:", data);
});
```

### Method 3: Force Log Recovery
1. Mở popup GSC Tool (trigger service worker)
2. Mở lại DevTools cho service worker  
3. Log mới sẽ bắt đầu từ lúc này

## 📝 Log Pattern để theo dõi:

### Startup Logs:
```
🔄 Restoring queue state: {data}
✅ Restored background queue: {status}
📦 No queue to restore, staying in pack mode
```

### Message Logs:
```
BG received message type: GET_QUEUE_STATUS
🔍 Processing GET_QUEUE_STATUS request  
📤 Sending queue status response: {data}
✅ Queue status response sent successfully
```

### Queue Processing Logs:
```
Processing URL: 1 / 10
Injected url.js for queue URL: https://example.com
Queue URL processed, moving to next...
Moving to next URL in queue...
```

### Error Logs:
```
❌ Error in message handler: {error}
❌ The message port closed before a response was received
❌ Error processing queue URL: {error}
```

## 🎯 Quick Debug Commands:

### Check if Service Worker is alive:
```javascript
console.log("Service worker alive at:", new Date().toLocaleTimeString());
```

### Check message handler status:
```javascript
// Trigger từ popup:
chrome.runtime.sendMessage({type: "GET_QUEUE_STATUS"});
```

### Manual queue check:
```javascript
chrome.storage.local.get(['urlQueue', 'currentUrlIndex', 'backgroundMode'], 
    (data) => console.log("Storage state:", data)
);
```

---
**💡 TIP**: Luôn để DevTools mở trong tab "service worker" khi debug để theo dõi log real-time!
