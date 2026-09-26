# BẢO VỆ MÃ HOÁ FONT CHỮ TIẾNG VIỆT (ZERO FONT CORRUPTION RULE)

## 1. Bản chất nguyên nhân lỗi font
* Trên hệ điều hành Windows, **PowerShell 5.1** tự động ép mã hóa stdout của các lệnh pipe (`|`) sang ASCII/CP1252.
* Nếu chạy lệnh dạng:
  ```powershell
  Get-Content file.json | ssh vps-muinx "cat > /tmp/bai.json"  # ❌ CẤM TUYỆT ĐỐI! SẼ HỎNG TOÀN BỘ TIẾNG VIỆT THÀNH '?'
  ```
  toàn bộ nguyên âm tiếng Việt có dấu (`à, á, ả, ã, ạ, ê, ơ, ư...`) sẽ bị biến dạng thành dấu hỏi `?`.
* Hậu quả: Tiêu đề bị lỗi font, database bị ghi đè ký tự hỏng, slug tự động bị cụt ngủn hoặc mất nghĩa, URL hỏng và người đọc thấy bài viết bị lỗi nghiêm trọng.

## 2. Quy tắc bắt buộc trước khi publish (Publishing Protocols)

### A. Đối với bài viết Gikky.net (Đăng qua API container trên VPS)
1. **Tuyệt đối truyền file qua giao thức SCP nhị phân (Binary Transfer):**
   ```powershell
   scp scripts/bai-viet/.tam/bai.json vps-muinx:/tmp/bai.json
   ssh vps-muinx "docker compose -p gikkynet cp /tmp/bai.json api:/tmp/bai.json"
   ```
2. **Kiểm tra xác thực UTF-8 trên VPS trước khi chạy script đăng:**
   - Dùng lệnh `head -n 5 /tmp/bai.json` trên VPS để đọc trực tiếp tiêu đề tiếng Việt xem có sắc nét, chuẩn dấu hay không.
3. **Thực thi script đăng bài qua đường ống UTF-8 an toàn:**
   ```powershell
   Get-Content -Raw -Encoding utf8 "scripts\bai-viet\dang-bai.py" | ssh vps-muinx "docker compose -p gikkynet exec -T api python -"
   ```

### B. Đối với bài đăng Facebook Fanpage
1. Luôn lưu file văn bản bài viết bằng `encoding="utf-8"`:
   ```python
   with open(post_path, "w", encoding="utf-8") as f:
       f.write(content)
   ```
2. Gọi script `poster.py` thông qua cờ `--file`:
   ```powershell
   python scripts/facebook/poster.py --file "<duong_dan_file.txt>" --image "<duong_dan_anh.jpg>"
   ```
   Tránh truyền văn bản trực tiếp qua cờ `--text "..."` trên dòng lệnh PowerShell nếu chứa ký tự đặc biệt hoặc nhiều đoạn văn phức tạp.

## 3. Checklist tự kiểm tra trước khi bấm Publish
- [x] File nguồn được lưu đúng chuẩn UTF-8 (không có BOM thừa).
- [x] Tiêu đề không chứa ký tự `?` thay cho nguyên âm tiếng Việt.
- [x] Kiểm tra slug bài viết được sinh ra có đầy đủ các âm tiết không dấu hay bị mất chữ.
- [x] Xác minh hiển thị thực tế trên website / fanpage ngay sau khi phát hành.
