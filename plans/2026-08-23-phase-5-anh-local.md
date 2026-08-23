# Phase 5 — Ảnh, lưu LOCAL (không R2, không minio)

> User chốt 2026-08-23: **upload xuống đĩa local, cả dev lẫn VPS. Chưa cần dịch vụ.**
> Điều này gỡ đúng cái đang kẹt (máy không có Docker, chưa có R2) và **đơn giản hoá PLAN 8.5**.

## 0. Ba chỗ lệch PLAN, đã chốt — ghi vào `PLAN.md` 8.5 khi làm

| PLAN 8.5 (thiết kế cho R2) | Nay | Vì sao |
|---|---|---|
| **Hai nhịp**: `presign` → client PUT thẳng lên storage → `POST /media/confirm` | **MỘT nhịp**: `POST` multipart thẳng vào Django | Hai nhịp tồn tại **chỉ vì** server không cầm được file. Upload thẳng thì lý do đó mất. Cột `status` **giữ lại** (PLAN mục 6 dựng sẵn cột cho sau) — đặt `confirmed` ngay, ghi docstring rằng hai nhịp quay lại khi có R2 |
| **Client** đọc EXIF `DateTimeOriginal` trước khi resize | **Server** đọc từ file gốc, rồi xoá sạch EXIF khi tái mã hoá | Đáng tin hơn hẳn: không phụ thuộc client trung thực, không có chuyện client/server bất đồng. Tiêu chí nghiệm thu PLAN đổi thành *"server đọc đúng `DateTimeOriginal` từ file gốc"* |
| **Ngoại lệ CORS duy nhất** cho presigned PUT | **Không còn ngoại lệ nào** | Same-origin. Xoá câu ngoại lệ ở PLAN 8.6 — bớt một bề mặt |
| `MocAnh.r2_key` | **đổi tên** thành khoá lưu trữ trung tính | Một cột tên `r2_key` chứa đường dẫn local là đúng loài "chữ nói quá code". Django `STORAGES` khiến khoá giống nhau ở cả hai backend, nên tên trung tính đúng cho cả hai. Nếu rename kéo theo quá nhiều thì **giữ tên + docstring nói rõ**, và ghi vào báo cáo |

## 1. Lưu và phục vụ

- `STORAGES["default"]` = `FileSystemStorage`; `MEDIA_ROOT` đọc từ env (dev: `api/media/`, VPS: một
  thư mục **ngoài** cây mã nguồn, ví dụ `/var/lib/gikky/media`), `MEDIA_URL = /media/`.
  Đổi sang R2 sau này là đổi **một khối `STORAGES`**, không đụng đường ghi.
- **Dev**: Django phục vụ `/media/` khi `DEBUG` (`static()` trong `urls.py`) + rewrite ở
  `next.config.ts` như `/api/`.
- **Prod**: **Caddy phục vụ thẳng từ đĩa**, không qua Django (`handle /media/* { root … file_server }`),
  kèm `X-Content-Type-Options: nosniff` và `Content-Type` đúng. Thêm vào `deploy/Caddyfile`.
  ⚠ Caddyfile hiện có **lỗi L01** (thứ tự `respond`/`handle`) — V1 đang sửa. Đừng đụng khối đó;
  chỉ thêm khối `/media/*`, và nếu va thì để phiên chính gộp.
- `MEDIA_ROOT` vào `.gitignore`.

## 2. Đường ghi — `POST /api/v1/mocs/{id}/anh` (multipart)

**Quyền:** chỉ `Moc.author`. Mạch khoá ⇒ 403. Mốc bia mộ / bị ẩn ⇒ 409. Mạch đóng sổ: **cho phép**
(sửa mốc cũ vẫn được, đúng PLAN 5.1) — nếu thấy sai thì báo, đừng tự quyết ngược.

**Bảy phép kiểm, theo thứ tự — đây là phần quan trọng nhất của cả phase:**
1. **Kích thước byte** — chặn trước khi đọc gì (PLAN: ảnh 8MB xử lý ≤5s).
2. **Nhận dạng bằng NỘI DUNG, không bằng tên file hay `Content-Type`** — cả hai đều do client gửi.
   Dùng Pillow mở và `verify()`.
3. **Allowlist định dạng**: JPEG · PNG · WebP. Không GIF động, không SVG (SVG là XML, chạy script).
4. **Chống bom giải nén**: đặt trần `Image.MAX_IMAGE_PIXELS`, kiểm `w×h` **trước** khi decode đủ.
5. **TÁI MÃ HOÁ mọi ảnh** — không bao giờ ghi lại byte của client. Đây là thứ vô hiệu hoá file đa
   định dạng (polyglot) và xoá sạch EXIF/ICC cùng lúc. Đọc `DateTimeOriginal` **trước** bước này.
6. **Tên file ngẫu nhiên** (uuid4), phần mở rộng suy từ định dạng **đã nhận dạng**, không từ tên
   client gửi. Không bao giờ để tên client chạm tới đường dẫn.
7. **Trần 10 ảnh/mốc, enforce TRONG transaction có khoá hàng `Moc`.** Đếm ngoài khoá là lỗi `L11`
   vừa tìm ra ở hạn mức mốc — đừng tái phát ngay trong phase mới.

**Thumbnail**: sinh **đồng bộ** ngay lúc upload (một ảnh, một lần resize — rẻ hơn nhiều so với dựng
job queue). PLAN nói "queue job… cron"; đó là thiết kế cho R2 nơi server không cầm file. Ghi lệch
vào `PLAN.md`.

**Xoá**: `DELETE /api/v1/anh/{id}` (chỉ tác giả). Và **xoá hàng thì phải xoá file** — nếu không,
đĩa đầy dần và không ai biết. Kèm một management command dọn file mồ côi, có `--dry-run`.

**Bia mộ**: mốc bị xoá/ẩn thì ảnh **không được phục vụ nữa**. Đây là chỗ dễ quên nhất: file nằm
trên đĩa và Caddy phục vụ nó **không qua Django**, nên "ẩn ở tầng API" là **không đủ**.
⇒ Quyết định cách xử và ghi lý do: đổi tên/di chuyển file khi ẩn, hay chấp nhận URL đoán-không-ra
(uuid) là đủ. **Nói thẳng cái nào bạn chọn và nó bảo vệ tới đâu** — đừng để người sau tưởng ảnh
biến mất trong khi nó chỉ khó đoán.

## 3. Giao diện

Ô chọn ảnh trong form **đăng mạch** và **nối mốc** và **sửa mốc**: chọn nhiều, xem trước, xoá trước
khi gửi, kéo thả sắp thứ tự (`position`). Gallery trong thẻ mốc. Trạng thái đang tải và lỗi nói
bằng tiếng người (quá 10 ảnh, sai định dạng, quá nặng). Nguyên tắc 9: mốc không ảnh thì **không
render gì cả**, không khung rỗng.

## 4. Sao lưu — thay đổi câu chuyện, phải nói ra

Tới hôm nay `pnpm db:sao-luu` chỉ `pg_dump`. Nay có **trạng thái nằm ngoài DB**. ⇒ script phải sao
lưu **cả** `MEDIA_ROOT`, hoặc **nói thẳng trong tài liệu** rằng nó không sao lưu ảnh. Không để
người ta tin là đã sao lưu đủ. Cập nhật `docs/sao-luu-phuc-hoi.md`.

## 5. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| A1 | Upload từ **trình duyệt thật** trên form nối mốc → ảnh hiện trong gallery → tải lại trang vẫn còn |
| A2 | **Ảnh 8MB xử lý ≤ 5s** (tiêu chí PLAN, đo thật) |
| A3 | **Ảnh thứ 11 bị từ chối**; và **double-click không lọt ảnh thứ 11** (trần enforce trong khoá) |
| A4 | Ảnh có EXIF `DateTimeOriginal` ⇒ server đọc đúng ngày chụp; **ảnh đã lưu KHÔNG còn EXIF** |
| A5 | File `.php`/`.html`/`.svg` đổi đuôi `.jpg` ⇒ **từ chối**; polyglot JPEG+HTML ⇒ tái mã hoá làm nó vô hại |
| A6 | Bom giải nén (ảnh nhỏ giải ra vài tỉ pixel) ⇒ từ chối, **không** làm hết RAM |
| A7 | User B **không** upload/xoá được ảnh của mốc user A |
| A8 | Xoá ảnh ⇒ **file biến khỏi đĩa**; command dọn mồ côi chạy được, có `--dry-run` |
| A9 | Mốc bia mộ / bị mod ẩn ⇒ ảnh không còn được API trả về; cách bảo vệ file trên đĩa được **nói rõ tới đâu** |
| A10 | Prod: Caddy phục vụ `/media/*` thẳng từ đĩa, có `nosniff` (**chưa chạy được — ghi rõ**) |
| A11 | Sao lưu: hoặc gồm ảnh, hoặc tài liệu nói thẳng là không |
| A12 | Không hồi quy: ≥ 754 Python, lint/build/tsc sạch, codegen khớp |
