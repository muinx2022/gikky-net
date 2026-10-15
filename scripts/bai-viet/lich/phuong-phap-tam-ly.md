# Bài viết Phương pháp & Tâm lý giao dịch — 13:45 hàng ngày

Nhiệm vụ: Viết một bài lý thuyết chuyên sâu về phương pháp kỹ thuật, kỷ luật giao dịch, tâm lý học hành vi hoặc đúc kết sách kinh điển lên gikky.net bằng tài khoản `u/gikky-team-member`.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 13:45 hàng ngày (đầu phiên chiều).
* **Tần suất:** 1 bài mỗi ngày.

## Hướng dẫn nội dung
* **Chủ đề:** Luân phiên giữa hai nhóm:
  - **Nhóm H (Tâm lý và kỷ luật):** Thiên lệch xác nhận, ác cảm thua lỗ, ngụy biện chi phí chìm, tâm lý giữ lệnh, điểm mù cảm xúc (`loai`: `Tâm lý` hoặc `Đọc sách`).
  - **Nhóm I (Phương pháp giao dịch):** Chỉ báo kỹ thuật (RSI, MACD, Bollinger Bands, Moving Average), hệ thống theo xu hướng, quy tắc quản trị rủi ro (`loai`: `Phương pháp`).
* **Kiểm trùng:** Kiểm tra số ngày kể từ bài gần nhất của từng nhóm để giữ nhịp luân phiên đều đặn.
* **Chuyên mục (`sub`):**
  - Bài về **Tâm lý, kỷ luật, đọc sách hành vi** (Nhóm H): Đăng vào `tam-ly-giao-dich` (Tâm lý giao dịch).
  - Bài về **Phương pháp kỹ thuật, hệ thống quản trị rủi ro** (Nhóm I): Đăng vào `quan-tri-von` (Quản trị vốn).
* **Giọng văn & Tránh sáo ngữ:** Chân thành, đĩnh đạc, đúc kết thực chiến. **HẠN CHẾ SÁO NGỮ RẬP KHUÔN:** Tuyệt đối tránh lạm dụng các từ ngữ sáo mòn như *"Giải mã"*, *"Con hào"*, *"Bóc tách"*, *"Giải phẫu"*, *"Cỗ máy"*. Hãy đặt tiêu đề và hành văn tự nhiên, trực diện.
* **Ảnh minh hoạ:** 1–2 ảnh tỷ lệ 16:9 chụp không gian làm việc trader, bàn đọc sách tài chính, góc thư viện nghiên cứu hoặc bối cảnh nghệ thuật sâu lắng gợi mở tâm lý (dùng `generate_image`, tránh vẽ box chữ sơ đồ thô cứng). Khi chèn vào HTML, ảnh bắt buộc phải có thuộc tính `alt` mô tả trực quan và chứa từ khóa bài viết (VD: `<img src="..." alt="Mô hình tâm lý thị trường và kỷ luật giao dịch">`).
* **Dải số (`figures`):** 4–6 cặp `{label, value}`, mỗi ô ≤24 ký tự.
* **Câu hỏi tương tác (`question_for_crowd`):** ≤200 ký tự, kết thúc bằng dấu `?`.
* **Liên kết nội bộ (Internal Linking):** Bắt buộc chèn 2–4 liên kết chéo tự nhiên dạng đường dẫn tương đối `/m/<slug>-<id>` tới các bài viết liên quan đã xuất bản trên Gikky.net (tâm lý, phương pháp, quản trị vốn, đọc sách). **TUYỆT ĐỐI KHÔNG DÙNG `target="_blank"`** để giữ nguyên tab hiện tại khi mở bài.
* **Định dạng HTML bắt buộc (`body`):** Bắt buộc viết bằng các thẻ HTML chuẩn (`<p>`, `<h3>`, `<h4>`, `<strong>`, `<em>`, `<ul><li>`, `<ol><li>`, `<hr>`). Tuyệt đối không dùng raw markdown trần để tránh dính liền text. Nếu là bài Tự sự / Nhật ký sau bàn phím / Tản văn chiêm nghiệm, **TUYỆT ĐỐI KHÔNG DÙNG THẺ `<h2>` HOẶC `<h3>`** để không sinh khối Mục lục trên frontend (thay bằng `<p><strong>...</strong></p>` và `<hr>`). Chia bài viết thành các đoạn văn ngắn gọn, thoáng đãng (`<p>...</p>`) và in đậm (`<strong>`) có chọn lọc các ý tứ đắt giá.

## Cách đăng bài
1. Xuất file `D:\Projects\gikky-net\scripts\bai-viet\.tam\bai.json`.
2. Chuyển vào container `api` trên VPS và chạy `scripts/bai-viet/dang-bai.py`.

