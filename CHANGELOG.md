# Changelog

Tất cả các thay đổi quan trọng của dự án này sẽ được ghi lại trong file này.

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
