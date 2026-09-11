# Mạch Demo Phương pháp Giao dịch — 16:45 hàng ngày

Nhiệm vụ: Tạo một mạch (thread) demo thực chiến mô phỏng chu trình vào lệnh, quản trị lệnh và đóng lệnh theo một phương pháp giao dịch cụ thể lên gikky.net bằng tài khoản `u/gikky-team-member`.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 16:45 hàng ngày (sau khi phiên giao dịch trong nước đóng cửa).
* **Tần suất:** 1 mạch mỗi ngày (gồm 3 mốc thời gian hoàn chỉnh).

## Nguyên tắc cốt lõi: Phản ánh thực tế (Có Thắng - Có Thua)
* **Bắt buộc có deal THUA LỖ (Stop Loss):** Bất kỳ phương pháp kỹ thuật nào cũng có xác suất thất bại tùy thuộc vào bối cảnh thị trường (ví dụ: Trend-following thất bại khi thị trường đi ngang choppy, Breakout gặp bẫy Bull/Bear trap do cạn kiệt thanh khoản, v.v.). **Tuyệt đối không đăng toàn deal thắng.**
* **Tỷ lệ luân phiên:** Duy trì tỷ lệ ~40% – 50% số mạch demo là các **deal dính Stop Loss kỷ luật (-1R)** xen kẽ với các deal đạt mục tiêu lợi nhuận (+2R, +3R).
* **Mục tiêu giáo dục:** Chứng minh rằng sự sống còn của trader không nằm ở tỷ lệ thắng 100%, mà nằm ở kỷ luật chấp nhận thua lỗ nhỏ (-1R) để bảo vệ vốn khi thị trường chứng minh phương pháp bị sai.

## Cấu trúc 3 mốc bắt buộc

> **Nguyên tắc phân bổ nội dung:** Mốc 1 và Mốc 2 viết **ngắn gọn, súc tích, khách quan** (thông số kỹ thuật, hành vi nến, hành động dời lệnh). **Dành toàn bộ cảm xúc, chiều sâu phân tích và mổ xẻ tâm lý cho Mốc 3 (Đóng sổ & Rút ra bài học).**

### Kịch bản A: Kèo Thắng (Đạt mục tiêu TP)
1. **Mốc 1 (Loại: `Vào lệnh`):**
   - *Viết ngắn gọn, trực diện:* Nhận diện setup chuẩn (1–2 câu), thông số Entry, Stop Loss (-1R), Take Profit (≥2R–3R), tỷ lệ R:R.
   - Biểu đồ minh hoạ Chart 1.
2. **Mốc 2 (Loại: `Quản trị lệnh`):**
   - *Viết ngắn gọn, kỷ luật:* Giá chạm lợi nhuận trung gian 1R hoặc cản ngắn, chốt 50% và dời SL về hoà vốn (Breakeven).
   - Biểu đồ minh hoạ Chart 2.
3. **Mốc 3 (Loại: `Đóng lệnh`):**
   - *Đóng sổ & đầu tư chiều sâu cảm xúc, phân tích:* Giá hoàn tất mục tiêu, tổng kết lợi nhuận thực tế (+2.5R).
   - **Bài học thực chiến & Tâm lý giao dịch (Bắt buộc):**
     * *Có nên FOMO không?* Bài học tránh mua đuổi khi giá đã chạy xa; kiên định với kế hoạch.
     * *Có nên kiên nhẫn chờ đợi không?* Giá trị của sự kiên nhẫn (chờ đúng nến xác nhận, chờ nhịp retest).
     * *Tâm lý sau deal thắng:* Không tự mãn, không vội vàng tăng vol ở lệnh kế tiếp.
   - Biểu đồ minh hoạ Chart 3.

### Kịch bản B: Kèo Thua (Dính Stop Loss -1R & Mổ xẻ nguyên nhân)
1. **Mốc 1 (Loại: `Vào lệnh`):**
   - *Viết ngắn gọn, trực diện:* Setup nến vượt cản/bắt đáy, kế hoạch Entry, Stop Loss chuẩn (-1R) và TP kỳ vọng.
   - Biểu đồ minh hoạ Chart 1.
2. **Mốc 2 (Loại: `Quản trị lệnh` - Diễn biến bất lợi):**
   - *Viết ngắn gọn, kỷ luật thép:* Tín hiệu bẫy giá đảo chiều (Bull Trap/Bear Trap), trạng thái lệnh chịu lỗ tạm tính. Nhấn mạnh 3 KHÔNG: Không gồng lỗ, không nới Stop Loss, không nhồi lệnh bình quân giá.
   - Biểu đồ minh hoạ Chart 2.
3. **Mốc 3 (Loại: `Đóng lệnh` - Cắn Stop Loss & Mổ xẻ sau lệnh):**
   - *Đóng sổ & đầu tư toàn bộ cảm xúc, mổ xẻ tâm lý:* Giá chạm SL tự động (-1.0R), thị trường tiếp tục lao dốc sau đó.
   - **Mổ xẻ nguyên nhân kỹ thuật (Post-mortem):** Khối lượng giả, bẫy thanh khoản, xung đột xu hướng lớn.
   - **Bài học thực chiến & Tâm lý giao dịch (Bắt buộc):**
     * *Có nên FOMO không?* Phân tích cái bẫy tâm lý sợ lỡ cơ hội khiến trader vội vã mua đuổi ngay đỉnh kháng cự, biến mình thành thanh khoản cho Smart Money xả hàng.
     * *Có nên kiên nhẫn chờ đợi không?* Nếu kiên nhẫn chờ nến đóng cửa hoặc chờ nhịp retest kiểm định cản, trader đã hoàn toàn đứng ngoài và bảo vệ 100% vốn.
     * *Kỷ luật cắt lỗ:* Việc dứt khoát chấp nhận mất 1R giúp bảo toàn 99% tài khoản, tránh cú rơi tự do hàng chục phần trăm sau đó.
   - Biểu đồ minh hoạ Chart 3.

## Yêu cầu kỹ thuật & Định dạng trình bày
* **Định dạng HTML bắt buộc (`body`):** Mọi nội dung mốc **bắt buộc viết bằng thẻ HTML chuẩn** (`<p>`, `<h3>`, `<h4>`, `<strong>`, `<em>`, `<ul><li>`, `<ol><li>`, `<hr>`).
  - *Tuyệt đối KHÔNG dùng raw markdown trần* (vì trình duyệt web không tự chèn thẻ `<p>`, khiến bài viết bị dính liền thành một khối dài không xuống dòng).
  - *Xuống dòng rõ ràng:* Chia nhỏ thành từng đoạn văn ngắn 2–3 câu trong cặp thẻ `<p>...</p>`, tạo khoảng thở thị giác dễ chịu.
  - *In đậm (`<strong>`):* Bold đậm có chọn lọc các thuật ngữ then chốt, mốc giá, tỷ lệ R:R và bài học cốt lõi.
* **Tiêu đề:** Bắt đầu bằng tiền tố `[Nhật kí demo] <Mô tả setup và kết quả (Đạt mục tiêu TP hoặc Dính Stop Loss)>` (≤160 ký tự).
  - *Lưu ý quan trọng:* **KHÔNG lặp lại tên phương pháp trong tiêu đề** (ví dụ: viết `[Nhật kí demo] Mô hình Spring kiểm định đáy...`, KHÔNG viết `[Nhật kí demo] VSA: ...`), vì phương pháp đã được chọn riêng ở trường `truong_phai` và hiển thị thành badge trên giao diện.
* **Trường phái (`truong_phai`):** Đặt đúng tên trường phái (`Price Action`, `Breakout Trading`, `MA Crossover`, `VSA / Wyckoff`, `Harmonic Patterns`, `Bollinger Bands`...).
* **Chuyên mục (`sub`):** `quan-tri-von`.
* **Biểu đồ nến:** Sử dụng Python `matplotlib` dựng biểu đồ Dark Mode độ phân giải cao tỷ lệ 16:9, thể hiện rõ nến, vạch Entry, SL, TP, vùng hỗ trợ/kháng cự và chú thích mũi tên rõ ràng.

