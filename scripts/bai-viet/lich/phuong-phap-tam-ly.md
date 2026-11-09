# Lịch Xuất bản 13:45 Hàng Ngày — Luận điểm Bot Trader (Ưu tiên) & Chuyên đề Phương pháp / Tâm lý (Dự phòng)

Nhiệm vụ: Khung giờ 13:45 chiều hàng ngày (đầu phiên chiều) là khung giờ xuất bản nội dung giao dịch thực chiến hoặc lý thuyết chuyên sâu. Vận hành theo cơ chế ưu tiên có điều kiện (conditional fallback) với nguyên tắc trần cứng 1 bài Trade/ngày trên toàn hệ thống.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 13:45 hàng ngày (đầu phiên chiều).
* **Tần suất:** Đúng 1 bài duy nhất mỗi ngày (hoặc Luận điểm Bot Trader, hoặc Bài viết Phương pháp / Tâm lý).

---

## Cơ chế Điều phối 2 Bước tại Khung 13:45

### Bước 1 (Ưu tiên 1 - Lấy bài Trade Bot Trader):
Thực thi lệnh kiểm tra và đăng theo lịch luân phiên:
```powershell
& "$HOME\.venv\Scripts\python.exe" "D:\Projects\gikky-net\scripts\bot-trader\bot_trader_cli.py" --post-scheduled
```
* **Quy tắc trần cứng tối đa 1 bài Trade/ngày trên toàn hệ thống:**
  - Áp dụng gộp cho toàn bộ mọi thị trường và loại tài sản: Cổ phiếu VN (D1), Ngoại hối (FX H4), Năng lượng (Dầu thô H4), Hàng hóa (Vàng/Bạc H4). Tổng cộng không bao giờ vượt quá 1 bài trade mới trong cùng một ngày dương lịch.
  - Giãn cách tối thiểu **18 giờ** kể từ lệnh mở gần nhất để các chuyên mục khác xuất hiện xen kẽ.
* **Luân phiên thị trường & chiến lược:**
  - Nếu lệnh gần nhất là Quốc tế (H4) -> Ưu tiên tìm kiếm Cổ phiếu VN (D1), và ngược lại.
  - Ưu tiên phương pháp kỹ thuật (`strategy_id`) khác với lệnh liền trước (Ichimoku, MA Cross, Pullback, BB Squeeze, PA MA 200).
* **Kết quả:**
  - Nếu tìm được setup đạt chuẩn và chưa chạm hạn mức -> Xuất bản bài viết cho `u/bot-trader`, console in `TRADED_SUCCESS` -> **Hoàn tất phiên 13:45**.
  - Nếu hôm nay đã có bài trade, chưa đủ 18h giãn cách, danh mục đầy (3/3), hoặc không có setup đạt chuẩn -> Console in `NO_TRADE_FALLBACK` -> **Chuyển sang Bước 2**.

---

### Bước 2 (Fallback - Bài viết Chuyên đề Phương pháp & Tâm lý u/gikky-team-member):
Chỉ thực hiện khi Bước 1 trả về `NO_TRADE_FALLBACK`. Biên soạn một bài lý thuyết chuyên sâu về phương pháp kỹ thuật, kỷ luật giao dịch, tâm lý học hành vi hoặc đúc kết sách kinh điển lên gikky.net bằng tài khoản `u/gikky-team-member`.

## Hướng dẫn nội dung cho Bước 2
* **Chủ đề:** Luân phiên giữa hai nhóm:
  - **Nhóm H (Tâm lý và kỷ luật):** Thiên lệch xác nhận, ác cảm thua lỗ, ngụy biện chi phí chìm, tâm lý giữ lệnh, điểm mù cảm xúc (`loai`: `Tâm lý` hoặc `Đọc sách`).
  - **Nhóm I (Phương pháp giao dịch):** Chỉ báo kỹ thuật (RSI, MACD, Bollinger Bands, Moving Average), hệ thống theo xu hướng, quy tắc quản trị rủi ro (`loai`: `Phương pháp`).
* **Kiểm trùng:** Kiểm tra số ngày kể từ bài gần nhất của từng nhóm để giữ nhịp luân phiên đều đặn.
* **Tự động bồi đắp kho chủ đề (`chu-de.md`):** Sau khi đăng bài và đánh dấu `[ĐÃ VIẾT - Mạch <id> - <ngày/tháng>]` vào `chu-de.md`, nếu nhóm chủ đề vừa chọn còn **dưới 5 chủ đề chưa viết**, bắt buộc phải biên soạn và bổ sung ngay **5–10 chủ đề mới** vào nhóm đó để kho chủ đề không bao giờ bị cạn.
* **Chuyên mục (`sub`):**
  - Bài về **Tâm lý, kỷ luật, đọc sách hành vi** (Nhóm H): Đăng vào `tam-ly-giao-dich` (Tâm lý giao dịch).
  - Bài về **Phương pháp kỹ thuật, hệ thống quản trị rủi ro** (Nhóm I): Đăng vào `quan-tri-von` (Quản trị vốn).
* **Giọng văn & Tránh sáo ngữ:** Chân thành, đĩnh đạc, đúc kết thực chiến. **HẠN CHẾ SÁO NGỮ RẬP KHUÔN:** Tuyệt đối tránh lạm dụng các từ ngữ sáo mòn như *"Giải mã"*, *"Con hào"*, *"Bóc tách"*, *"Giải phẫu"*, *"Cỗ máy"*. Hãy đặt tiêu đề và hành văn tự nhiên, trực diện.
* **Ảnh minh hoạ:** 1–2 ảnh tỷ lệ 16:9 chụp không gian làm việc trader, bàn đọc sách tài chính, góc thư viện nghiên cứu hoặc bối cảnh nghệ thuật sâu lắng gợi mở tâm lý (dùng `generate_image`, tránh vẽ box chữ sơ đồ thô cứng). Khi chèn vào HTML, ảnh bắt buộc phải có thuộc tính `alt` mô tả trực quan và chứa từ khóa bài viết (VD: `<img src="..." alt="Mô hình tâm lý thị trường và kỷ luật giao dịch">`).
* **Dải số (`figures`):** 4–6 cặp `{label, value}`, mỗi ô ≤24 ký tự.
* **Câu hỏi tương tác (`question_for_crowd`):** ≤200 ký tự, kết thúc bằng dấu `?`.
* **Liên kết nội bộ (Internal Linking):** Bắt buộc chèn 2–4 liên kết chéo tự nhiên dạng đường dẫn tương đối `/m/<slug>-<id>` tới các bài viết liên quan đã xuất bản trên Gikky.net (tâm lý, phương pháp, quản trị vốn, đọc sách). **TUYỆT ĐỐI KHÔNG DÙNG `target="_blank"`** để giữ nguyên tab hiện tại khi mở bài.
* **Định dạng HTML bắt buộc (`body`):** Bắt buộc viết bằng các thẻ HTML chuẩn (`<p>`, `<h3>`, `<h4>`, `<strong>`, `<em>`, `<ul><li>`, `<ol><li>`, `<hr>`). Tuyệt đối không dùng raw markdown trần để tránh dính liền text. Nếu là bài Tự sự / Nhật ký sau bàn phím / Tản văn chiêm nghiệm, **TUYỆT ĐỐI KHÔNG DÙNG THẺ `<h2>` HOẶC `<h3>`** để không sinh khối Mục lục trên frontend (thay bằng `<p><strong>...</strong></p>` và `<hr>`). Chia bài viết thành các đoạn văn ngắn gọn, thoáng đãng (`<p>...</p>`) và in đậm (`<strong>`) có chọn lọc các ý tứ đắt giá.

## Cách đăng bài Bước 2
1. Xuất file `D:\Projects\gikky-net\scripts\bai-viet\.tam\bai.json`.
2. Chuyển vào container `api` trên VPS và chạy `scripts/bai-viet/dang-bai.py`.
