---
name: gikky-quet-binh-luan
description: Quét và tự động phản hồi bình luận của độc giả trên website Gikky.net bằng tài khoản u/gikky-team-member — 23:30 hàng ngày
---

# Quét & Phản hồi Bình luận Website Gikky.net

## Mục tiêu
Duy trì sự kết nối trí tuệ và sự đồng hành chuyên sâu với độc giả Gikky.net.
Mỗi bình luận từ độc giả trên các bài viết do Gikky đăng đều được lắng nghe, thấu hiểu và phản hồi chu đáo, lịch thiệp, giữ vững tôn chỉ và phong cách tư duy của Gikky.

## Lịch chạy
- **Tần suất**: 1 lần / ngày.
- **Khung giờ**: **23:30** hàng đêm (sau khi toàn bộ các bài viết trong ngày đã lên sóng và độc giả có thời gian tương tác).

## Quy trình thực hiện

### Bước 1: Quét bình luận chưa phản hồi
Chạy lệnh CLI:
```bash
python scripts/binh-luan/gikky_comments_manager.py --scan --json
```
- Nếu trả về danh sách rỗng `[]`: Báo cáo không có bình luận mới và kết thúc.
- Nếu có bình luận: Đọc kỹ từng bình luận (`comment_id`, `mach_title`, `author`, `body`, `mach_url`).

### Bước 2: Phân tích & Soạn nội dung phản hồi (Chuẩn DNA Gikky)
Nguyên tắc phản hồi:
1. **Thấu hiểu & Tôn trọng**: Ghi nhận góc nhìn, cảm xúc hoặc câu hỏi của độc giả một cách chân thành.
2. **Khách quan & Khoa học**: Giải thích cơ chế (tâm lý học hành vi, cấu trúc thị trường, toán học xác suất, thanh khoản).
3. **Khiêm tốn & Điềm đạm**: Tuyệt đối không tự mãn, không tranh cãi đúng sai cá nhân.
4. **Không phán xét hay phím hàng**: Tuyệt đối KHÔNG khuyến nghị mua bán, KHÔNG nhận định cảm tính thiếu căn cứ.
5. **Độ dài**: 2–4 câu hoặc 1–2 đoạn súc tích, đúc kết bài học giá trị.

### Bước 3: Đăng phản hồi lên hệ thống
Chạy lệnh:
```bash
python scripts/binh-luan/gikky_comments_manager.py --reply <comment_id> -m "<nội dung phản hồi>"
```
Lệnh sẽ tự động:
- Kết nối tới container `gikkynet-api-1` trên VPS.
- Tạo comment dưới danh nghĩa user `gikky-team-member` làm con (`parent_id`) của bình luận độc giả.
- Cập nhật tự động số lượng bình luận và đẩy bài lên tab "Đang diễn ra" nếu đạt tiêu chuẩn tương tác.

### Bước 4: Báo cáo kết quả
Báo cáo lại cho người dùng:
- Số lượng bình luận đã quét và phản hồi.
- Chi tiết từng bình luận: người hỏi, bài viết, nội dung trả lời và URL bài viết.
