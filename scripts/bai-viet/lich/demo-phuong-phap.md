# Mạch Demo Phương pháp Giao dịch — 16:45 hàng ngày

Nhiệm vụ: Tạo một mạch (thread) demo thực chiến mô phỏng chu trình vào lệnh, quản trị lệnh và đóng lệnh theo một phương pháp giao dịch cụ thể lên gikky.net bằng tài khoản `u/gikky-team-member`.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 16:45 hàng ngày (sau khi phiên giao dịch trong nước đóng cửa).
* **Tần suất:** 1 mạch mỗi ngày (gồm 3 mốc thời gian hoàn chỉnh).

## Cấu trúc 3 mốc bắt buộc
1. **Mốc 1 (Loại: `Vào lệnh`):**
   - Nhận diện tín hiệu kỹ thuật (Price Action, MA Crossover, VSA, Harmonic, Đột phá hỗ trợ/kháng cự...).
   - Xác định điểm Vào lệnh (Entry), Điểm cắt lỗ (Stop Loss), Mục tiêu ban đầu (Take Profit) và tỷ lệ Risk/Reward (R:R).
   - Biểu đồ minh hoạ Chart 1: Thời điểm nhận diện setup và mở vị thế.
2. **Mốc 2 (Loại: `Quản trị lệnh`):**
   - Diễn biến giá sau khi mở vị thế (chạm ngưỡng lợi nhuận 1R hoặc cản trung gian).
   - Quy tắc xử lý lệnh: Chốt lời từng phần (50% TP1) và dời Stop Loss về điểm hoà vốn (Breakeven) hoặc kéo Trailing Stop.
   - Biểu đồ minh hoạ Chart 2: Cập nhật vị thế đã loại bỏ rủi ro.
3. **Mốc 3 (Loại: `Đóng lệnh`):**
   - Giá hoàn tất mục tiêu kỳ vọng (TP2) hoặc kích hoạt điều kiện thoát hàng (Trailing Stop / Tín hiệu đảo chiều).
   - Đóng toàn bộ vị thế, tổng kết tỷ lệ R:R thực tế và bài học kỷ luật.
   - Biểu đồ minh hoạ Chart 3: Toàn bộ chu trình lệnh hoàn tất.

## Yêu cầu kỹ thuật
* **Tiêu đề:** Bắt đầu bằng tiền tố `[Demo phương pháp] <Tên phương pháp>: <Mô tả setup và kết quả>` (≤160 ký tự).
* **Trường phái (`truong_phai`):** Đặt đúng tên trường phái (ví dụ: `Price Action`, `MA Crossover`, `VSA / Wyckoff`, `Harmonic Patterns`, `Bollinger Bands`...).
* **Chuyên mục (`sub`):** `quan-tri-von`.
* **Biểu đồ nến:** Sử dụng Python `matplotlib` dựng biểu đồ Dark Mode độ phân giải cao tỷ lệ 16:9, thể hiện rõ nến, vạch Entry, SL, TP, vùng hỗ trợ/kháng cự và chú thích mũi tên rõ ràng.
