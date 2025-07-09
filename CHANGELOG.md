# Changelog

Tất cả các thay đổi quan trọng của dự án này sẽ được ghi lại trong file này.

## [1.1.1] - 2025-07-10

### 🐛 Bug Fixes
- **🔧 Fixed Queue Timing Issue:** Loại bỏ fixed 2s delay, giờ queue đợi hoàn tất URL hiện tại trước khi xử lý URL tiếp theo
- **🎨 Fixed UI Overlap Bug:** Khi mở popup trong queue mode, tự động ẩn tất cả pack mode controls
- **⏱️ Improved Processing Timing:** Tăng delays trong quá trình xử lý để đảm bảo GSC response đầy đủ
- **🧹 Better Error Handling:** Đợi popup đóng hoàn toàn trước khi tiếp tục queue

### ✨ Enhanced UX
- **🎯 Smart UI Mode Switching:** Popup tự động chuyển giữa Pack Mode và Queue Mode
- **💬 Clearer Messages:** Thông báo rõ ràng hơn về queue behavior
- **🎨 CSS Classes:** Thêm `.queue-mode-active` class để kiểm soát UI states
- **📱 Responsive Queue UI:** Chỉ hiển thị controls cần thiết cho từng mode

### 🔧 Technical Details
- **Sequential Processing:** URLs được xử lý hoàn toàn tuần tự thay vì parallel
- **Event-Driven Queue:** Queue tiếp tục dựa trên completion events thay vì timers
- **UI State Management:** Proper show/hide của elements khi switch modes
- **Storage Cleanup:** Reset queue results khi bắt đầu queue mới

## [1.1.0] - 2025-07-10

### 🚀 New Features
- **🔄 Background Queue Processing:** Tính năng chạy ngầm hoàn toàn mới
  - Xử lý URLs ngay cả khi đóng popup
  - Queue tự động khôi phục sau browser restart
  - Thanh progress real-time và điều khiển queue (pause/resume/stop)
  - Export kết quả queue riêng biệt

### ✨ Enhanced
- **Improved UI:** Thêm section Background Queue với controls chuyên dụng
- **Better Storage:** Phân tách storage cho pack mode và queue mode
- **Enhanced Error Handling:** Xử lý lỗi tốt hơn cho background processing
- **Auto Recovery:** Tự động khôi phục queue state khi mở lại popup

### 🔧 Technical Changes
- **New Background Functions:**
  - `startQueueProcessing()` - Xử lý queue tuần tự
  - `processNextUrl()` - Chuyển URL tiếp theo
  - `processSingleUrlFromQueue()` - Xử lý từng URL riêng lẻ
- **Enhanced Storage Management:** Riêng biệt cache cho queue và pack modes
- **Improved Service Worker:** Background script persistence tốt hơn

### 📝 Documentation
- **Updated README:** Hướng dẫn chi tiết Background Queue mode
- **Enhanced Comments:** Code comments đầy đủ cho maintainability

## [1.0.1] - 2025-07-10

### 🔧 Fixed
- **Fix lỗi phát hiện ngôn ngữ:** Hỗ trợ tất cả biến thể tiếng Anh (en-US, en-GB, en-AU, etc.)
- **Sửa cấu trúc thư mục:** Di chuyển files từ thư mục con lên thư mục gốc
- **Update manifest.json:** Sửa đường dẫn icon từ `logo-appnet-media1.png` thành `icon.png`

### 🚀 Improved
- **Cải thiện error handling:** Thêm thông tin debug để hiển thị ngôn ngữ hiện tại
- **Tối ưu code:** Thêm null safety check cho language detection
- **Documentation:** Tạo README.md chi tiết và LICENSE

### 📝 Changed
- Thay đổi logic phát hiện ngôn ngữ trong `url.js`:
  ```javascript
  // Cũ
  if (document.getElementsByTagName("html")[0].lang === "en")
  
  // Mới
  const htmlLang = document.getElementsByTagName("html")[0].lang;
  if (htmlLang && htmlLang.toLowerCase().startsWith("en"))
  ```

## [1.0.0] - 2025-07-03

### 🎉 Initial Release
- **Chrome Extension cơ bản** cho Google Search Console
- **Tự động gửi yêu cầu xóa URL** hàng loạt
- **Giao diện popup** với các tùy chọn cơ bản
- **Background script** để xử lý các tác vụ nền
- **Content script** để tương tác với trang GSC
- **Hỗ trợ temporary removal** và permanent removal
- **Lưu trữ kết quả** và thống kê cơ bản
