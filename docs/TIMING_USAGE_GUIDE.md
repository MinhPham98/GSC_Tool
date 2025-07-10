# GSC Tool - Timing Analyzer Usage Guide

## Giới thiệu
File `timing-analyzer.js` cung cấp các công cụ để phân tích thời gian thực thi của các chức năng trong GSC Tool.

## Cách sử dụng

### 1. Load file trong HTML
Thêm vào `index.html`:
```html
<script src="timing-analyzer.js"></script>
```

### 2. Các lệnh cơ bản

#### Bắt đầu ghi nhận timing
```javascript
timingStart();
```

#### Ghi nhận sự kiện đơn lẻ
```javascript
timingEvent('URL_CLICKED', 'User clicked start button', { urlCount: 50 });
timingEvent('PACK_SENT', 'Pack sent to content script', { packIndex: 1, urlCount: 10 });
timingEvent('GSC_RESPONSE', 'Received response from GSC', { success: true });
```

#### Ghi nhận session (có thời gian bắt đầu và kết thúc)
```javascript
// Bắt đầu xử lý pack
timingSessionStart('pack-1', 'PACK_PROCESSING', 'Processing pack 1', { urls: 10 });

// ... xử lý pack ...

// Kết thúc xử lý pack
timingSessionEnd('pack-1', 'completed', { successCount: 8, errorCount: 2 });
```

#### Lấy báo cáo
```javascript
const report = timingStop(); // Dừng và lấy báo cáo
// hoặc
const currentReport = timingReport(); // Lấy báo cáo hiện tại mà không dừng
```

#### Tải xuống báo cáo
```javascript
timingDownload('json'); // Tải file JSON
timingDownload('csv');  // Tải file CSV
```

## Tích hợp vào GSC Tool

### Trong index.js (Popup)
```javascript
// Khi bắt đầu gửi pack
startBtn.addEventListener('click', function() {
    timingStart();
    timingEvent('START_CLICKED', 'User clicked start button', {
        mode: backgroundModeCheckbox.checked ? 'queue' : 'pack',
        urlCount: urlChunks.reduce((sum, pack) => sum + pack.length, 0)
    });
    
    if (backgroundModeCheckbox.checked) {
        timingSessionStart('queue-session', 'QUEUE_PROCESSING', 'Background queue processing');
    }
});

// Khi pack hoàn thành
chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.type === "PACK_DONE") {
        timingEvent('PACK_COMPLETED', 'Pack processing completed', {
            packIndex: currentPack,
            success: true
        });
    }
});
```

### Trong background.js
```javascript
// Khi bắt đầu xử lý URL
function processUrl(url, index) {
    timingSessionStart(`url-${index}`, 'URL_PROCESSING', `Processing URL ${index + 1}`, {
        url: url,
        index: index
    });
    
    // ... xử lý URL ...
    
    timingSessionEnd(`url-${index}`, result.success ? 'success' : 'error', {
        responseTime: result.responseTime,
        errorMessage: result.error
    });
}
```

### Trong url.js (Content Script)
```javascript
// Khi click vào GSC form
function clickRemovalForm() {
    timingEvent('GSC_FORM_CLICK', 'Clicked removal form', {
        url: currentUrl,
        formType: 'removal'
    });
    
    // ... click form ...
    
    timingEvent('GSC_FORM_SUBMITTED', 'Form submitted successfully', {
        url: currentUrl,
        responseTime: Date.now() - startTime
    });
}
```

## Phân tích Performance

### Thresholds được thiết lập:
- **URL Processing**: 3 giây/URL
- **Pack Processing**: 30 giây/pack  
- **Queue Delay**: 1 giây giữa các URL
- **UI Response**: 100ms cho phản hồi UI
- **Background Task**: 5 giây cho background tasks

### Ví dụ báo cáo:
```javascript
{
  "summary": {
    "recordingDuration": 45000,
    "totalEvents": 25,
    "totalSessions": 5
  },
  "packPerformance": {
    "totalPacks": 3,
    "completedPacks": 3,
    "avgDuration": 8500,
    "urlsPerPack": 10
  },
  "queuePerformance": {
    "totalUrls": 30,
    "completedUrls": 28,
    "errorUrls": 2,
    "urlsPerMinute": 4.2
  },
  "thresholdViolations": [
    {
      "type": "THRESHOLD_EXCEEDED",
      "description": "URL_PROCESSING took 4500ms (threshold: 3000ms)"
    }
  ]
}
```

## Debug Console Commands

Khi file được load, các function này có sẵn trong console:

```javascript
// Bắt đầu recording
timingStart()

// Log một sự kiện test
timingEvent('TEST_EVENT', 'This is a test', {data: 'test'})

// Xem báo cáo hiện tại
timingReport()

// Dừng và tải báo cáo
timingStop()
timingDownload('json')
```

## Performance Optimization Tips

1. **URL Processing quá chậm**: Tăng delay giữa các thao tác DOM
2. **Pack Processing timeout**: Giảm số URL mỗi pack
3. **Queue delay quá ngắn**: Tăng thời gian chờ giữa các URL
4. **UI lag**: Optimize các function DOM manipulation
5. **Background task slow**: Check service worker performance

## Monitoring Real-time

```javascript
// Monitor continuous
setInterval(() => {
    const report = timingReport();
    if (report.thresholdViolations.length > 0) {
        console.warn('Performance issues detected:', report.thresholdViolations);
    }
}, 5000);
```
