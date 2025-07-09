# Service Worker Registration Fix

## ❌ Error Encountered:
```
Service worker registration failed. Status code: 15
```

## 🔍 Root Cause:
- **Invalid permission**: `"background"` permission không hợp lệ trong Manifest V3
- **Status code 15**: Thường liên quan đến manifest.json validation errors

## ✅ Solution Applied:

### 1. Fixed manifest.json:
**Before:**
```json
"permissions": [
  "storage",
  "scripting", 
  "tabs",
  "background",  // ❌ Invalid permission
  "alarms"
],
```

**After:**
```json
"permissions": [
  "storage",
  "scripting",
  "tabs", 
  "alarms"       // ✅ Removed invalid permission
],
```

### 2. Verification Steps:
- ✅ background.js syntax check: No errors
- ✅ manifest.json syntax check: No errors  
- ✅ index.js syntax check: No errors
- ✅ url.js syntax check: No errors

## 🚀 How to Test Fix:

1. **Reload Extension:**
   - Go to `chrome://extensions/`
   - Find GSC Tool
   - Click reload button (🔄)

2. **Check Service Worker:**
   - Look for "service worker" link next to extension
   - Click it to open background console
   - Should see service worker logs without errors

3. **Verify Registration:**
   - Open extension popup
   - Check popup console for any errors
   - Test background communication

## 📋 Expected Behavior After Fix:
- ✅ No registration failed errors
- ✅ Service worker starts properly  
- ✅ Background console accessible
- ✅ Enhanced logging visible
- ✅ Queue communication works

## 🔧 Additional Debugging (if still issues):

### Check Chrome DevTools:
```javascript
// In popup console
chrome.runtime.sendMessage({type: 'GET_QUEUE_STATUS'}, (response) => {
  console.log('Background response:', response);
  if (chrome.runtime.lastError) {
    console.error('Runtime error:', chrome.runtime.lastError);
  }
});
```

### Check Service Worker Status:
```javascript
// In background console (if accessible)
console.log('Service Worker Active:', {
  uptime: Math.round((Date.now() - serviceWorkerStartTime) / 1000) + 's',
  logCount: logCounter
});
```

---
**Fix Applied**: ${new Date().toLocaleString()}  
**Status**: Ready for re-testing
