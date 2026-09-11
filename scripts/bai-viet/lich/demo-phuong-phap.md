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

### Kịch bản A: Kèo Thắng (Đạt mục tiêu TP)
1. **Mốc 1 (Loại: `Vào lệnh`):**
   - Nhận diện tín hiệu kỹ thuật chuẩn mực (Price Action, MA Crossover, VSA, Harmonic, Đột phá cản...).
   - Xác định rõ Entry, Stop Loss (-1R), Take Profit kỳ vọng (≥ 2R–3R).
   - Biểu đồ minh hoạ Chart 1: Setup mở vị thế.
2. **Mốc 2 (Loại: `Quản trị lệnh`):**
   - Diễn biến giá thuận lợi chạm mốc lợi nhuận trung gian (1R hoặc cản ngắn).
   - Quy tắc: Chốt lời 50% (TP1), dời Stop Loss về điểm hoà vốn (Breakeven) hoặc kéo Trailing Stop.
   - Biểu đồ minh hoạ Chart 2: Vị thế an toàn không còn rủi ro.
3. **Mốc 3 (Loại: `Đóng lệnh`):**
   - Giá hoàn tất mục tiêu kỳ vọng (TP2) hoặc kích hoạt thoát lệnh.
   - Đóng toàn bộ vị thế, tổng kết lợi nhuận thực tế (ví dụ: +2.5R).
   - **Bài học thực chiến & Tâm lý giao dịch (Bắt buộc):**
     * *Có nên FOMO không?* Bài học về việc tránh mua đuổi khi giá đã chạy xa điểm kích hoạt; giữ vững kế hoạch thay vì nhảy vào giữa chừng khiến tỷ lệ R:R bị bóp méo.
     * *Có nên kiên nhẫn chờ đợi không?* Phân tích giá trị của sự kiên nhẫn (chờ đúng nến xác nhận, chờ nhịp hồi retest thay vì vội vã).
     * *Tâm lý sau deal thắng:* Không tự mãn, không vội vàng tăng vol ở lệnh kế tiếp, tuân thủ nguyên tắc một chuỗi lệnh độc lập.
   - Biểu đồ minh hoạ Chart 3: Toàn bộ chu trình hoàn tất.

### Kịch bản B: Kèo Thua (Dính Stop Loss -1R & Mổ xẻ nguyên nhân)
1. **Mốc 1 (Loại: `Vào lệnh`):**
   - Nhận diện tín hiệu chuẩn theo lý thuyết nhưng tiềm ẩn bối cảnh rủi ro (ví dụ: Breakout trong thị trường biên hẹp, nến tín hiệu khối lượng chưa đủ dứt khoát).
   - Xác định Entry, Stop Loss chuẩn (-1R) và TP kỳ vọng.
   - Biểu đồ minh hoạ Chart 1: Setup nến mở vị thế.
2. **Mốc 2 (Loại: `Quản trị lệnh` - Diễn biến bất lợi):**
   - Giá không tiếp diễn đà tăng/giảm mà xuất hiện phản ứng tiêu cực (nến bẫy Bull Trap/Bear Trap, lực cầu/cung cạn kiệt, giá tụt ngược lại).
   - **Kỷ luật sống còn:** Tuyệt đối KHÔNG gồng lỗ, KHÔNG dời Stop Loss ra xa, KHÔNG nhồi lệnh bình quân giá (No Martingale/Averaging down). Kiên định giữ nguyên ngưỡng Stop Loss ban đầu.
   - Biểu đồ minh hoạ Chart 2: Tín hiệu bẫy giá và cách xử lý tâm lý khi vị thế chịu áp lực.
3. **Mốc 3 (Loại: `Đóng lệnh` - Cắn Stop Loss & Mổ xẻ sau lệnh):**
   - Giá xuyên thủng Stop Loss, hệ thống tự động ngắt vị thế ở mức lỗ đúng **-1.0R**.
   - **Mổ xẻ nguyên nhân (Post-mortem):** Phân tích vì sao setup thất bại (khối lượng giả, bẫy thanh khoản của dòng tiền lớn, xung đột khung thời gian lớn hơn...).
   - **Bài học thực chiến & Tâm lý giao dịch (Bắt buộc):**
     * *Có nên FOMO không?* Phân tích cái bẫy tâm lý sợ bỏ lỡ cơ hội khiến trader vội vã mua đuổi ngay đỉnh kháng cự mà không kiểm tra cấu trúc dòng tiền, biến mình thành thanh khoản cho Smart Money xả hàng.
     * *Có nên kiên nhẫn chờ đợi không?* Nhấn mạnh bài học kiên nhẫn: Nếu chờ nến đóng cửa xác nhận vượt cản dứt khoát hoặc chờ nhịp test thành công, trader đã hoàn toàn tránh được cái bẫy này hoặc vào lệnh với vị thế ít rủi ro hơn nhiều.
     * *Kỷ luật cắt lỗ:* Việc dứt khoát chấp nhận mất 1R giúp bảo toàn 99% tài khoản, tránh được cú rơi tự do hàng chục phần trăm sau đó. Tuyệt đối không cay cú trả thù thị trường (revenge trade).
   - Biểu đồ minh hoạ Chart 3: Toàn bộ quá trình giá xuyên thủng SL và tiếp tục lao dốc.

## Yêu cầu kỹ thuật
* **Tiêu đề:** Bắt đầu bằng tiền tố `[Demo phương pháp] <Tên phương pháp>: <Mô tả setup và kết quả (Đạt mục tiêu TP hoặc Dính Stop Loss)>` (≤160 ký tự).
* **Trường phái (`truong_phai`):** Đặt đúng tên trường phái (`Price Action`, `Breakout Trading`, `MA Crossover`, `VSA / Wyckoff`, `Harmonic Patterns`, `Bollinger Bands`...).
* **Chuyên mục (`sub`):** `quan-tri-von`.
* **Biểu đồ nến:** Sử dụng Python `matplotlib` dựng biểu đồ Dark Mode độ phân giải cao tỷ lệ 16:9, thể hiện rõ nến, vạch Entry, SL, TP, vùng hỗ trợ/kháng cự và chú thích mũi tên rõ ràng.

