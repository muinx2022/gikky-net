# Sao lưu và phục hồi

Phase 6 — PLAN mục 10 (*"backup Postgres tự động"*, nghiệm thu: *"script backup chạy +
restore thử thành công"*). **Phase 5 (2026-08-23) mở rộng phạm vi sang ẢNH** — xem ngay
khối dưới, nó đổi câu trả lời cho câu hỏi "sao lưu xong là đủ chưa".

> **Đọc file này TRƯỚC khi cần tới nó.** Lúc cần thật thì database đang hỏng, và đó không
> phải lúc để đọc lần đầu một quy trình.

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
```

Ra:

```
backup/
  gikky-<db>-<dấu thời gian>.dump   # một file MỚI mỗi lần chạy, `--giu N` dọn bản cũ
  media/                            # GƯƠNG của MEDIA_ROOT — không dọn, chỉ lớn thêm
  media-an/                         # GƯƠNG của MEDIA_AN_ROOT
```

⚠ **`--giu` chỉ dọn file `.dump`, không đụng `media/`.** Đó là chủ đích: dump là ảnh chụp
toàn bộ database tại một thời điểm nên bản cũ thay thế được, còn mỗi file ảnh là một dữ
liệu riêng lẻ mà không bản nào khác chứa. Dọn gương theo số lượng là xoá ảnh thật.

Script đọc `DATABASE_URL` từ **`api/.env`** — cùng nguồn với `settings.py`. Không lấy từ
`process.env`: một script backup lấy DB ở chỗ khác với ứng dụng là script sẽ sao lưu nhầm
database, im lặng, và chỉ lộ ra lúc phục hồi.

`pg_dump` không cần có trên PATH; script tự dò `C:\Program Files\PostgreSQL\17\bin`
(xem `NOI_DO_PG_DUMP` trong `scripts/sao-luu-db.mjs`).

Định dạng là **custom (`-Fc`)**, kèm `--no-owner --no-privileges`: phục hồi được vào một
máy chưa có role `gikky`, và `pg_restore` chọn được từng bảng thay vì chạy tuốt một file
SQL từ đầu đến cuối.

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

Chưa có scheduler nào chạy — máy dev không phải máy chủ. Trên prod chọn một trong hai:

**Windows — Task Scheduler**

```powershell
$viec = New-ScheduledTaskAction -Execute "pnpm" `
          -Argument "db:sao-luu --giu 14" -WorkingDirectory "C:\gikky-net"
$luc  = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "gikky-sao-luu" -Action $viec -Trigger $luc
```

**Linux — cron**

```cron
0 3 * * *  cd /srv/gikky-net && pnpm db:sao-luu --giu 14 >> /var/log/gikky-sao-luu.log 2>&1
```

⚠ **Bản sao lưu nằm cùng máy với database KHÔNG phải bản sao lưu.** Ổ hỏng thì mất cả
hai. Bước còn thiếu là đẩy thư mục `backup/` sang một nơi khác (R2/S3/rsync) — nó nằm
ngoài phạm vi Phase 6 vì chưa có tài khoản lưu trữ nào, và nó là **nợ có tên**, không
phải chuyện đã xong.

Phase 5 làm món nợ này **nặng hơn**, không phải nhẹ đi: trước đây nội dung mất khi ổ hỏng
là thứ gõ lại được; nay có ảnh, và một tấm ảnh chụp màn hình bảng giá lúc 9h35 sáng thì
không ai gõ lại được.

## Cái ĐÃ chạy thật, cái CHƯA

| Việc | Trạng thái |
|---|---|
| `pnpm db:sao-luu` trên PostgreSQL 17 local | **đã chạy** — ra file `.dump` 85.6 KB |
| `pg_restore` vào một database mới + đối chiếu số hàng | **đã chạy** — `core_mach` 3/3, `core_comment` 34/34 |
| Chép gương ảnh (`chepGuong`) | **đã đo bằng test**, chưa chạy trên kho ảnh thật — `apps/web/e2e/don-vi/sao-luu.spec.ts` (chép mới · bỏ qua bản đã có · chép đè khi cỡ lệch · nguồn chưa tồn tại) |
| Phục hồi ẢNH rồi mở lại trang mạch | **chưa** — cần một vòng deploy thật, xem bước 4 |
| Phục hồi TẠI CHỖ (`--clean --if-exists`) | **chưa** — không đè lên database nào của máy này |
| Task Scheduler / cron | **chưa** — hai đoạn trên là mẫu, chưa đăng ký ở đâu |
| Đẩy bản sao lưu ra khỏi máy | **chưa** — nợ có tên, xem trên |
