---
name: gikky-bai-tan-man-a
description: Bài phân tích/tản mạn lên gikky.net — hằng ngày, 11:23
---

Nhiệm vụ: viết MỘT bài phân tích / tản mạn rồi đăng lên gikky.net bằng tài khoản `u/gikky-team-member`.

**Toàn bộ hướng dẫn nằm trong file này — đọc nó TRƯỚC KHI làm bất cứ gì:**

    D:\Projects\gikky-net\scripts\bai-viet\lich\tan-man.md

File đó tự chứa (không tham chiếu hội thoại nào) và là nguồn chân lý duy nhất. Làm đúng từ trên xuống dưới. Đừng làm theo trí nhớ, đừng tự chế lệnh.

Kho chủ đề: `D:\Projects\gikky-net\scripts\bai-viet\chu-de.md`

Vài điểm không được quên:

- Thư mục làm việc: `D:\Projects\gikky-net`
- **KIỂM TRÙNG TRƯỚC KHI VIẾT.** Chạy lệnh liệt kê bài đã đăng ở §1 của file hướng dẫn, chọn chủ đề chưa có bài nào gần giống. Trùng chủ đề hỏng nặng hơn bỏ một lượt.
- **Đừng nhồi số.** Mật độ mục tiêu khoảng một con số cho mỗi 11–12 từ; số đặc trưng đẩy sang trường `figures` (tối đa **6 cặp** — vượt là server trả 500).
- **Ảnh minh hoạ (BẮT BUỘC 1–2 ảnh):** Tạo 1–2 ảnh minh hoạ sinh động, giàu tính gợi cảm và thẩm mỹ theo đúng chủ đề bài viết (dùng `generate_image` tỷ lệ 16:9 chụp cảnh quan/bối cảnh thực tế: ví dụ về Yên thì dùng hình ảnh tiền Yên/Tokyo, thuỷ điện thì dùng đập xả nước/hồ chứa, ngân hàng dùng app số/toà nhà tài chính; tránh vẽ các box chữ, sơ đồ khối hộp thô cứng). Đưa vào mảng `anhs` (base64) và đặt thẻ placeholder `{{ANH_1}}`, `{{ANH_2}}` trong thân bài `body` theo hướng dẫn §3 của `tan-man.md`.
- Đăng bằng ba lệnh ssh ở §4. Mật khẩu nằm trong container trên VPS và **không được mang về máy này**.

Báo cáo lại ngắn gọn: chủ đề đã chọn và vì sao, URL bài, nguồn số liệu, chỗ nào dữ liệu không đủ để kết luận.

Không đăng được thì nói rõ mã thoát và câu lỗi thật. Đừng đăng bừa một bài yếu để cho có.