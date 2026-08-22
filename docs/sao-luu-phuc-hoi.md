# Sao lưu và phục hồi PostgreSQL

Phase 6 — PLAN mục 10 (*"backup Postgres tự động"*, nghiệm thu: *"script backup chạy +
restore thử thành công"*).

> **Đọc file này TRƯỚC khi cần tới nó.** Lúc cần thật thì database đang hỏng, và đó không
> phải lúc để đọc lần đầu một quy trình.

## Sao lưu

```powershell
pnpm db:sao-luu                       # ra ./backup/gikky-<db>-<dấu thời gian>.dump
pnpm db:sao-luu --thu-muc D:\sao-luu  # đổi chỗ ghi
pnpm db:sao-luu --giu 14              # giữ 14 bản gần nhất
pnpm db:sao-luu --kiem                # chỉ kiểm điều kiện, KHÔNG dump
```

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
ngoài phạm vi Phase 6 vì chưa có tài khoản lưu trữ nào (cùng lý do ảnh hoãn sang Phase 5),
và nó là **nợ có tên**, không phải chuyện đã xong.

## Cái ĐÃ chạy thật, cái CHƯA

| Việc | Trạng thái |
|---|---|
| `pnpm db:sao-luu` trên PostgreSQL 17 local | **đã chạy** — ra file `.dump` 85.6 KB |
| `pg_restore` vào một database mới + đối chiếu số hàng | **đã chạy** — `core_mach` 3/3, `core_comment` 34/34 |
| Phục hồi TẠI CHỖ (`--clean --if-exists`) | **chưa** — không đè lên database nào của máy này |
| Task Scheduler / cron | **chưa** — hai đoạn trên là mẫu, chưa đăng ký ở đâu |
| Đẩy bản sao lưu ra khỏi máy | **chưa** — nợ có tên, xem trên |
