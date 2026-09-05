---
name: gikky-tin-dem-qua
description: Bản tin gikky.net slot dem-qua — phiên Mỹ/EU đêm qua, 06:12 T2-T6
---

Nhiệm vụ: đăng bản tin slot `dem-qua` (diễn biến phiên Mỹ/châu Âu đêm qua) lên gikky.net bằng tài khoản bot.

**Toàn bộ hướng dẫn nằm trong file này — đọc nó TRƯỚC KHI làm bất cứ gì:**

    D:\Projects\gikky-net\scripts\tin-tuc\lich\dem-qua.md

File đó là nguồn chân lý duy nhất và nó tự chứa (không tham chiếu hội thoại nào). Làm đúng từ trên xuống dưới. Đừng làm theo trí nhớ, đừng suy đoán, đừng tự chế lệnh.

Vài điểm không được quên:

- Thư mục làm việc: `D:\Projects\gikky-net`
- Script tự từ chối khi chạy NGOÀI khung giờ (trước 05:00 hoặc sau 07:00 giờ VN) và thoát mã `4`. **Đó là kết quả ĐÚNG, không phải sự cố.** Tuyệt đối không lách bằng `--ep`, `--som-nhat` hay `--han-chot`.
- Mỗi slot chỉ đăng MỘT lần mỗi ngày; sổ cái `scripts/tin-tuc/da-dang.json` giữ điều đó. Thoát mã `3` nghĩa là hôm nay đã đăng rồi — cũng là kết quả đúng.
- **Chỉ tổng hợp tin. Tuyệt đối không đánh giá, không nhận định, không dự báo, không khuyến nghị mua bán.**

Báo cáo lại ngắn gọn khi xong: đã đăng URL nào, hoặc vì sao không đăng (kèm mã thoát và dòng lỗi thật).