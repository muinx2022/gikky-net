---
name: gikky-bai-thoi-su
description: Bài viết phân tích vấn đề thời sự kinh tế, tài chính, thị trường đang diễn ra lên gikky.net — 16:45 cách ngày (T2, T4, T6, CN)
---

Nhiệm vụ: Viết một bài phân tích/bình luận chuyên sâu về sự kiện, vấn đề thời sự kinh tế, tài chính, thị trường hoặc chính sách mới ban hành lên gikky.net bằng tài khoản `u/gikky-team-member` theo tài liệu hướng dẫn tại `D:\Projects\gikky-net\scripts\bai-viet\lich\thoi-su.md`.

Khung giờ chạy: 16:45 các ngày Thứ Hai, Thứ Tư, Thứ Sáu, Chủ Nhật (xen kẽ cách ngày với mạch Nhật ký demo).

Quy tắc thực hiện:
1. **Chủ đề thời sự:** Bám sát diễn biến nóng trong ngày/tuần về điều hành vĩ mô, lãi suất, tỷ giá, diễn biến bất thường sau phiên giao dịch, cấu trúc dòng tiền, tái cơ cấu tập đoàn hoặc quy định pháp lý mới.
2. **Kiểm trùng:** Kiểm tra các bài gần nhất trên database qua SSH trước khi chọn chủ đề.
3. **Chuyên mục linh hoạt (`sub`):** Đăng vào `vi-mo`, `chung-khoan` hoặc `crypto` tuỳ thuộc nội dung sự kiện.
4. **Loại (`loai`):** `Thời sự` hoặc `Phân tích`.
5. **Định dạng HTML bắt buộc:** Toàn bộ nội dung body phải viết bằng thẻ HTML chuẩn (`<p>`, `<h3>`, `<h4>`, `<strong>`, `<em>`, `<ul><li>`, `<hr>`), phân đoạn ngắn gọn 2–3 câu, không dùng raw markdown trần.
6. **Hình ảnh:** Tạo 1–2 ảnh minh hoạ thực tế tỷ lệ 16:9 bằng `generate_image`, chuyển thành base64 và chèn `{{ANH_1}}` vào vị trí phù hợp trong body.
7. **Dải số & Câu hỏi tương tác:** 4–6 cặp `figures` (mỗi ô ≤24 ký tự) và 1 câu hỏi `question_for_crowd` (≤200 ký tự, kết thúc bằng `?`).
8. **Đăng bài:** Xuất payload ra `D:\Projects\gikky-net\scripts\bai-viet\.tam\bai.json`, đẩy lên VPS và thực thi tạo bài viết kèm gọi `lam_moi_mach` để revalidate ISR ngay lập tức.
