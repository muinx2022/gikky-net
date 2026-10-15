# Sao lưu và phục hồi

Phase 6 — PLAN mục 10 (*"backup Postgres tự động"*, nghiệm thu: *"script backup chạy +
restore thử thành công"*). **Phase 5 (2026-08-23) mở rộng phạm vi sang ẢNH** — xem ngay
khối dưới, nó đổi câu trả lời cho câu hỏi "sao lưu xong là đủ chưa".

> **Đọc file này TRƯỚC khi cần tới nó.** Lúc cần thật thì database đang hỏng, và đó không
> phải lúc để đọc lần đầu một quy trình.

## Meilisearch: KHÔNG sao lưu, và đó là một quyết định

Phase 7 (2026-08-23) thêm **trạng thái thứ ba nằm ngoài Postgres**, sau ảnh của Phase 5:
chỉ mục tìm kiếm của Meilisearch. Câu trả lời cho nó **khác** câu trả lời cho ảnh, và
khác vì một lý do có thật chứ không vì lười:

**Ảnh là dữ liệu gốc** — mất là mất hẳn, không có nguồn nào dựng lại được.
**Chỉ mục là dữ liệu DẪN XUẤT** — mọi byte trong đó đều tính lại được từ Postgres:

```
node scripts/py.mjs reindex_tim_kiem --sach
```

⇒ `pnpm db:sao-luu` **không** chạm tới Meilisearch, và thư mục dữ liệu của nó **không**
nằm trong bản sao lưu. Sao lưu một chỉ mục dựng lại được là tự nhân đôi dung lượng để giữ
một bản có thể **lệch** so với nguồn sự thật — bản phục hồi sẽ mang theo cả những tài liệu
lẽ ra đã bị gỡ.

**Điều kiện để câu trên đúng**, và nó được ghim bằng test chứ không bằng lời hứa: lệnh
dựng lại phải thật sự dựng lại **đủ** và phải **không** hồi sinh mạch đã bị mod ẩn. Hai vế
ấy là `api/tests/test_tim_kiem_that.py::test_xoa_sach_index_roi_reindex_dung_lai_du` và
`::test_reindex_khong_dua_mach_bi_an_vao_lai`, chạy trên Meilisearch thật.

### Sau khi phục hồi database, phải dựng lại chỉ mục

Đây là bước dễ quên nhất của quy trình phục hồi, vì **không có gì báo**: site chạy bình
thường, mọi trang 200, chỉ ô tìm kiếm là trả về kết quả của một thế giới đã cũ (hoặc trống
rỗng, nếu máy mới). Thêm nó vào cuối mọi lượt restore:

```
node scripts/py.mjs reindex_tim_kiem --sach
```

## ⚠ Từ Phase 5, `pg_dump` một mình KHÔNG còn là bản sao lưu đủ

Tới Phase 4, mọi thứ sản phẩm biết đều nằm trong Postgres, nên một bản dump là một bản
sao lưu trọn vẹn. Phase 5 cho người dùng tải **ảnh xuống đĩa** (`MEDIA_ROOT`), và từ đó
có **trạng thái nằm ngoài database**.

Phục hồi một bản dump database mà không có ảnh thì: mọi hàng `MocAnh` còn nguyên, mọi URL
còn nguyên, và **mọi thẻ `<img>` gãy**. Không có gì báo — trang vẫn 200.

`pnpm db:sao-luu` vì thế nay chép **cả hai kho ảnh**:

| Kho | Mặc định dev | Prod (env) | Là gì |
|---|---|---|---|
| đang phục vụ | `api/media/` | `MEDIA_ROOT` | ảnh Caddy phục vụ ra internet |
| cách ly | `api/media-an/` | `MEDIA_AN_ROOT` | ảnh của mốc đã thành bia mộ / bị mod ẩn |

**Kho cách ly cũng phải sao lưu**, và đây là chỗ dễ bỏ sót nhất: ẩn của mod **đảo ngược
được** (PLAN 5.10), nên những tấm ảnh ấy là dữ liệu thật đang chờ có thể được phục vụ lại,
không phải rác. Bỏ nó đi là mod bỏ ẩn một mốc sau khi phục hồi và ảnh không quay lại.

Ảnh chép theo lối **gương (mirror)**, không phải bản mới mỗi lần: tên file là uuid và nội
dung sau một tên không bao giờ đổi, nên chép lại thứ đã có chỉ tốn đĩa. Hệ quả cố ý —
gương là **superset**: ảnh đã bị xoá khỏi máy chủ vẫn nằm lại trong bản sao lưu.

Muốn bỏ ảnh thì phải nói ra: `pnpm db:sao-luu --khong-anh`. Script in một cảnh báo và bản
sao lưu ấy **không** phục hồi được ảnh. Không có đường im lặng bỏ qua.

## Sao lưu

```powershell
pnpm db:sao-luu                       # dump database + chép gương CẢ HAI kho ảnh
pnpm db:sao-luu --thu-muc D:\sao-luu  # đổi chỗ ghi
pnpm db:sao-luu --giu 14              # giữ 14 bản dump gần nhất (ảnh KHÔNG bị dọn)
pnpm db:sao-luu --kiem                # chỉ kiểm điều kiện, KHÔNG dump
pnpm db:sao-luu --khong-anh           # BỎ ảnh — bản sao lưu sẽ THIẾU, script cảnh báo
pnpm db:sao-luu -- --cloud r2:gikky-backup   # đẩy lên Cloud qua rclone sau khi dump
pnpm db:sao-luu -- --cloud r2:gikky-backup --giu-cloud 60  # giữ 60 ngày trên cloud
```

Ra:

```
backup/
  gikky-<db>-<dấu thời gian>.dump   # một file MỚI mỗi lần chạy, `--giu N` dọn bản cũ
  media/                            # GƯƠNG của MEDIA_ROOT — không dọn, chỉ lớn thêm
  media-an/                         # GƯƠNG của MEDIA_AN_ROOT
```

Trên Cloud remote (`<remote>:<bucket/path>`):
```
<remote>:<bucket>/
  db/
    gikky-<db>-<dấu thời gian>.dump # lưu trữ các bản dump, dọn theo --giu-cloud (mặc định 30 ngày)
  media/                            # bản sao lưu kho ảnh phục vụ
  media-an/                         # bản sao lưu kho ảnh cách ly
```

⚠ **`--giu` chỉ dọn file `.dump`, không đụng `media/`.** Đó là chủ đích: dump là ảnh chụp
toàn bộ database tại một thời điểm nên bản cũ thay thế được, còn mỗi file ảnh là một dữ
liệu riêng lẻ mà không bản nào khác chứa. Dọn gương theo số lượng là xoá ảnh thật.

Script đọc `DATABASE_URL` từ **`api/.env`** — cùng nguồn với `settings.py`. Không lấy từ
`process.env`: một script backup lấy DB ở chỗ khác với ứng dụng là script sẽ sao lưu nhầm
database, im lặng, và chỉ lộ ra lúc phục hồi.

Biến môi trường hỗ trợ sao lưu Cloud (trong `api/.env` hoặc process env):
- `GIKKY_BACKUP_REMOTE`: Tên remote rclone và đường dẫn (ví dụ `r2:gikky-backup` hoặc `gdrive:backups/gikky`).
- `GIKKY_BACKUP_CLOUD_DAYS`: Số ngày giữ bản dump trên cloud (mặc định `30`, `0` = không xoá).

`pg_dump` không cần có trên PATH; script tự dò `C:\Program Files\PostgreSQL\17\bin`
(xem `NOI_DO_PG_DUMP` trong `scripts/sao-luu-db.mjs`).

Định dạng là **custom (`-Fc`)**, kèm `--no-owner --no-privileges`: phục hồi được vào một
máy chưa có role `gikky`, và `pg_restore` chọn được từng bảng thay vì chạy tuốt một file
SQL từ đầu đến cuối.

## Đẩy bản sao lưu lên Đám mây (Cloud Backup qua `rclone`)

> ⚠ **Bản sao lưu nằm cùng máy với database KHÔNG phải bản sao lưu.** Ổ cứng máy chủ hỏng
> thì mất cả dữ liệu gốc lẫn bản sao lưu. Việc đẩy ra đám mây là bắt buộc đối với hệ thống
> sản phẩm.

Hệ thống sao lưu của gikky.net sử dụng **`rclone`** để đồng bộ lên Cloud Storage. `rclone`
hỗ trợ hơn 70 nhà cung cấp đám mây:
- **Cloudflare R2** (khuyến nghị): Miễn phí 10 GB dung lượng lưu trữ/tháng, 0đ phí truyền tải dữ liệu (Zero Egress Fees), tương thích chuẩn S3 API.
- **Google Drive, Backblaze B2, AWS S3, Wasabi...**

### 1. Cài đặt và cấu hình `rclone`
1. Cài đặt `rclone`:
   - Windows: `winget install Rclone.Rclone` hoặc tải từ [rclone.org](https://rclone.org/downloads/).
   - Ubuntu/Debian: `sudo apt install rclone` hoặc `curl https://rclone.org/install.sh | sudo bash`.
2. Tạo remote mới:
   ```bash
   rclone config
   ```
   Chọn `n` (New remote), đặt tên (ví dụ `r2`), chọn kiểu storage (ví dụ `s3` cho Cloudflare R2 / AWS S3), nhập Access Key, Secret Key và Endpoint.
3. Kiểm tra kết nối:
   ```bash
   rclone lsd r2:
   ```

### 2. Sử dụng trên máy Dev
- Truyền trực tiếp qua cờ dòng lệnh:
  ```powershell
  pnpm db:sao-luu -- --cloud r2:gikky-backup
  ```
- Hoặc cấu hình cố định trong `api/.env`:
  ```env
  GIKKY_BACKUP_REMOTE=r2:gikky-backup
  GIKKY_BACKUP_CLOUD_DAYS=30
  ```
  Sau đó chỉ cần chạy `pnpm db:sao-luu`, script sẽ tự động đẩy lên Cloud sau khi tạo dump thành công.

### 3. Sử dụng trên Production (`vps-muinx`)
Trên máy chủ production, sao lưu toàn diện được thực hiện bằng script `deploy/prod/sao-luu-prod.sh`:
- Cấu hình trong `~/gikky-net/app/.env`:
  ```env
  GIKKY_BACKUP_REMOTE=r2:gikky-backup
  GIKKY_BACKUP_CLOUD_DAYS=30
  GIKKY_BACKUP_KEEP_LOCAL=7
  ```
- Chạy thủ công hoặc qua crontab (xem mục Tự động hoá bên dưới):
  ```bash
  bash deploy/prod/sao-luu-prod.sh
  ```
- Tuỳ chọn `--require-cloud`: Thoát với mã lỗi `2` nếu chưa cấu hình `GIKKY_BACKUP_REMOTE` (phục vụ giám sát nghiêm ngặt).


## Phục hồi

`pg_restore` **không tự tạo database**. Ba bước, và bước 1 là bước hay bị quên:

```powershell
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$pgr  = "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"
$env:PGPASSWORD = "<mật khẩu role gikky>"

# 1. Tạo database ĐÍCH (rỗng). Đừng phục hồi đè lên database đang chạy —
#    xem "Phục hồi tại chỗ" bên dưới.
& $psql -U gikky -h 127.0.0.1 -d postgres -c "CREATE DATABASE gikky_phuc_hoi OWNER gikky"

# 2. Nạp bản dump.
& $pgr --no-owner --no-privileges --host=127.0.0.1 --port=5432 --username=gikky `
       --dbname=gikky_phuc_hoi .\backup\gikky-gikky_dev-2026-08-22T19-04-31.dump

# 3. Kiểm: số hàng phải khớp bản gốc.
& $psql -U gikky -h 127.0.0.1 -d gikky_phuc_hoi -tAc "select count(*) from core_mach"
& $psql -U gikky -h 127.0.0.1 -d gikky_phuc_hoi -tAc "select count(*) from core_comment"
```

Xong bước 3 mới đổi `DATABASE_URL` trong `api/.env` sang `gikky_phuc_hoi`, rồi
`pnpm api:check`.

### Bước 4 — ẢNH (Phase 5). Bỏ bước này là phục hồi một nửa

`pg_restore` chỉ dựng lại database. Chép gương ảnh ngược về:

```powershell
# Đích = MEDIA_ROOT / MEDIA_AN_ROOT của máy đang phục hồi (xem `api/.env`).
Copy-Item -Recurse -Force .\backup\media\*    C:\gikky-net\api\media\
Copy-Item -Recurse -Force .\backup\media-an\* C:\gikky-net\api\media-an\
```

Kiểm: số hàng `core_mocanh` phải khớp số file trong `media/anh/` **cộng** số file trong
`media-an/anh/` (một hàng ↔ một khoá; ảnh chính và thumbnail dùng chung khoá, khác thư mục).

```powershell
& $psql -U gikky -h 127.0.0.1 -d gikky_phuc_hoi -tAc "select count(*) from core_mocanh"
(Get-ChildItem -Recurse C:\gikky-net\api\media\anh, C:\gikky-net\api\media-an\anh -File).Count
```

Lệch thì **đừng đoán**: chạy `node scripts/py.mjs don_anh_mo_coi --dry-run` — nó liệt kê
cả hai chiều (file không hàng nào trỏ tới · hàng còn mà file mất).

### Phục hồi TẠI CHỖ (đè lên database đang chạy)

Chỉ làm khi đã chắc là muốn mất dữ liệu hiện tại, và **sau khi đã dump nó một lần nữa**:

```powershell
pnpm db:sao-luu --thu-muc D:\truoc-khi-phuc-hoi   # lưới an toàn cuối cùng
& $pgr --clean --if-exists --no-owner --no-privileges `
       --host=127.0.0.1 --username=gikky --dbname=gikky_dev <đường dẫn .dump>
```

`--clean --if-exists` xoá đối tượng cũ trước khi tạo lại. Thiếu `--if-exists` thì mọi
`DROP` trên một database rỗng đổ lỗi ra màn hình và bạn không phân biệt được lỗi thật với
tiếng ồn.

## Tự động hoá

Chưa có scheduler nào chạy trên máy dev — máy dev không phải máy chủ.

**Trên Production (`vps-muinx` — BẮT BUỘC):**
Sử dụng script `deploy/prod/sao-luu-prod.sh` chạy qua cron hằng ngày lúc 04:10 sáng (xem `deploy/prod/README.md`):
```bash
crontab -e
# 04:10 sáng giờ VN mỗi ngày — SAU gom_luot_xem (03:10) và reindex_tim_kiem (03:40)
10 4 * * *  cd ~/gikky-net/src && bash deploy/prod/sao-luu-prod.sh >> ~/gikky-sao-luu.log 2>&1
```

Script này tự động:
1. `pg_dump` từ container postgres (kiểm tra `pg_restore --list` trước khi xác nhận).
2. Sao chép 2 volume `gikkynet_media` và `gikkynet_mediaan`.
3. Xoay vòng giữ 7 bản dump gần nhất trên đĩa VPS.
4. Đẩy bản dump + 2 kho ảnh lên Cloud Storage (Cloudflare R2...) qua `rclone` và tự động xoá bản dump cloud quá 30 ngày.

**Trên máy Dev (Windows Task Scheduler / Linux cron nếu cần):**

- Đồng bộ sao lưu Production từ `vps-muinx` về ổ cứng ngoài (`E:\gikky-backups\prod`):
  Lệnh chạy thủ công:
  ```powershell
  pnpm db:sao-luu:o-e
  # Hoặc
  node scripts/sao-luu-ve-o-e.mjs
  ```
  Lịch tự động hàng ngày lúc 08:30 sáng trên Windows (Scheduled Task `GikkyBackupToDriveE`):
  ```cmd
  schtasks /Create /TN "GikkyBackupToDriveE" /TR "node d:\Projects\gikky-net\scripts\sao-luu-ve-o-e.mjs" /SC DAILY /ST 08:30 /F
  ```

- Sao lưu cơ sở dữ liệu Dev local (`E:\gikky-backups\dev`):
  Cấu hình `GIKKY_BACKUP_DIR=E:/gikky-backups/dev` trong `api/.env`, sau đó chạy `pnpm db:sao-luu`.

## Cái ĐÃ chạy thật, cái CHƯA

| Việc | Trạng thái |
|---|---|
| `pnpm db:sao-luu` trên PostgreSQL 17 local | **đã chạy** — ra file `.dump` 85.6 KB |
| `pg_restore` vào một database mới + đối chiếu số hàng | **đã chạy** — `core_mach` 3/3, `core_comment` 34/34 |
| Chép gương ảnh (`chepGuong`) | **đã đo bằng test**, chưa chạy trên kho ảnh thật — `apps/web/e2e/don-vi/sao-luu.spec.ts` (chép mới · bỏ qua bản đã có · chép đè khi cỡ lệch · nguồn chưa tồn tại) |
| Phục hồi ẢNH rồi mở lại trang mạch | **chưa** — cần một vòng deploy thật, xem bước 4 |
| Phục hồi TẠI CHỖ (`--clean --if-exists`) | **chưa** — không đè lên database nào của máy này |
| Task Scheduler / cron trên Production (`vps-muinx`) | **đã đăng ký và chạy thật** — cron 04:10 hằng ngày với `deploy/prod/sao-luu-prod.sh` |
| Đồng bộ tự động về ổ cứng ngoài `E:\gikky-backups` | **đã chạy thật** — 697 files, 86.65 MB (DB dump mới, 31 bản lịch sử, 664 file ảnh), kèm Windows Task `GikkyBackupToDriveE` 08:30 hằng ngày |
| Đẩy bản sao lưu ra khỏi máy (Cloud Backup qua `rclone`) | **đã hoàn thành** — hỗ trợ cờ `--cloud` trong `scripts/sao-luu-db.mjs` và script `deploy/prod/sao-luu-prod.sh` cho production, đã phủ unit test đầy đủ trong `sao-luu.spec.ts` |


