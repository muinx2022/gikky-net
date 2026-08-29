# Vận hành gikky.net trên `vps-muinx`

Dựng lần đầu 2026-08-25. Đây là bản **đã chạy thật** — khác `deploy/Caddyfile` ở gốc,
vốn là bản nháp có căn cứ và tự nó nói ra là chưa bao giờ chạy.

## Máy này thật sự là gì

Không phải VPS thuê ngoài. `vps-muinx` là **VM Ubuntu chạy tại nhà** (`muinx-nuc`,
4 vCPU / 5 GiB RAM), IP public `42.113.184.243` là đường Internet dân dụng. Mọi HTTP vào
máy đi qua **Cloudflare Tunnel** — không NAT, không port-forward, không cổng 80/443 nào
mở ra Internet. Hệ quả chi phối toàn bộ cấu hình:

- **TLS cắt ở Cloudflare edge**, Caddy nghe HTTP thuần. Bật ACME ở đây là đi xin chứng
  chỉ cho một tên miền mà Caddy không bao giờ nhận request 443 — thất bại lặp vô hạn.
- **IP thật của người dùng chỉ có trong `CF-Connecting-IP`.** Xem ghi chú 2 trong
  `Caddyfile`; đây là chỗ dễ sai nhất và cái sai của nó im lặng hoàn toàn.
- **Ingress không nằm trên máy này.** Container `cloudflared` chạy bằng `TUNNEL_TOKEN`
  (remotely-managed) ⇒ bảng ánh xạ hostname → cổng nằm trên dashboard Cloudflare. Không có
  file nào trên máy để sửa. Xem mục "Cloudflare" cuối tài liệu.

Máy còn chạy **4 stack khác** (trekky, console, hoc-tieng-anh, hai postgres rời). Cổng host
đã bận: 22, 2000, 5432, 7700, 8088, 8090, 8091, 8092, 8093, 15432.

## Bố cục

```
~/gikky-net/
  app/.env      # secret, NGOÀI cây mã nguồn — deploy không đè
  src/          # cây mã nguồn, bị THAY NGUYÊN KHỐI mỗi lần deploy
```

Compose project **`gikkynet`**. Volume: `gikkynet_pgdata`, `_meilidata`, `_media`,
`_mediaan`, `_static`, `_caddydata`, `_caddyconfig`.

⚠ **Đừng đặt tên project là `gikky`.** Trên chính máy này project `gikky` đã tồn tại (một
bản Trekky gắn thương hiệu gikky, thuộc `~/trekky/src/deploy/production/compose.yml`) và
sở hữu volume `gikky_data`. Trùng tên là compose coi hai stack là một.

## Lệnh

Chạy ở `~/gikky-net/src`. Rút gọn:

```bash
alias gk='docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env'
```

| Việc | Lệnh |
|---|---|
| Xem trạng thái | `gk ps` |
| Log | `gk logs -f api` (hoặc `web` / `admin` / `caddy`) |
| Khởi động lại một service | `gk up -d api` |
| Build lại **tuần tự** (đừng dùng `gk build` trần) | `./build.sh` |
| Lệnh Django bất kỳ | `gk exec api python manage.py <lệnh>` |
| Tạo 3 tài khoản đội ngũ | `gk exec api python manage.py tao_tai_khoan_doi` |
| Nạp lại index tìm kiếm | `gk exec api python manage.py reindex_tim_kiem --sach` |
| Sinh khoá Meili hẹp | `deploy/prod/tao-khoa-meili.sh` |

⚠ **`gk build` trần chạy SONG SONG.** Máy còn ~3.4 GiB RAM; xcaddy (Go) cộng hai
`next build` cùng lúc là OOM. `build.sh` build từng cái một, và đó là lý do nó tồn tại.

### Việc chạy theo lịch: gộp lượt xem — **BẮT BUỘC, không phải tuỳ chọn**

```bash
crontab -e
# 03:10 giờ VN mỗi ngày — sau nửa đêm để "ngày đã xong" thật sự đã xong.
10 3 * * *  cd /srv/gikky/deploy/prod && docker compose exec -T api python manage.py gom_luot_xem >> /var/log/gikky-gom-luot-xem.log 2>&1
```

Không có lịch này thì **hai chuyện hỏng, cả hai im lặng**:

1. Bảng thô `core_luotxem` phình vô hạn — lời hứa "giữ 90 ngày" chỉ được giữ bởi chính
   lệnh này (`gom_luot_xem` gộp xong mới dọn, và chỉ dọn phần đã gộp).
2. Số liệu dài hạn không bao giờ được dựng. Trang `/luot-xem` **tự lành** ở phép đọc
   ("toàn thời gian" lấy hàng thô cho phần chưa gộp), nên bạn sẽ *không* thấy con số sai
   — chỉ thấy bảng thô lớn dần cho tới ngày nó thành vấn đề.

Kiểm nó có chạy: `gk exec api python manage.py shell -c "from core.models.luot_xem import TongNgay; print(TongNgay.objects.count(), TongNgay.objects.order_by('-ngay').values_list('ngay', flat=True).first())"`

## Deploy một bản mới

Từ máy dev (Windows, **không có rsync** — dùng tar qua ssh):

```bash
tar czf - --exclude='./.git' --exclude='node_modules' --exclude='.venv' \
  --exclude='.next' --exclude='__pycache__' --exclude='./backup' \
  --exclude='./api/media' --exclude='./api/media-an' --exclude='./api/.env' . \
| ssh vps-muinx 'rm -rf ~/gikky-net/src && mkdir -p ~/gikky-net/src && tar xzf - -C ~/gikky-net/src'
ssh vps-muinx 'cd ~/gikky-net/src && ./build.sh && docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env up -d'
```

`migrate` + `collectstatic` chạy tự động trong entrypoint của `api` mỗi lần container lên.

## Bảy phép thử sau mỗi lần deploy

Bốn phép đầu là của `deploy/Caddyfile` (PLAN 8.2); ba phép sau là của Phase 5 (ảnh).

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://gikky.net/api/v1/health              # 200
curl -s -o /dev/null -w '%{http_code}\n' https://gikky.net/api/admin/django/login/    # 403
curl -s -o /dev/null -w '%{http_code}\n' https://gikky.net/api/v1/openapi.json        # 404 (DEBUG=False)
curl -s -o /dev/null -w '%{http_code}\n' https://admin.gikky.net/                     # 200, app admin
curl -sI https://gikky.net/media/anh/<uuid>.jpg | head -5   # 200 + nosniff, KHÔNG 404
curl -s -o /dev/null -w '%{http_code}\n' https://gikky.net/media/anh/                 # 404, KHÔNG phải danh sách
# rồi ẩn một mốc có ảnh ở khu quản trị và curl lại URL ảnh đó            → phải 404 (cơ chế A9)
```

Phép 5 ra **404** nghĩa là `root` trong `Caddyfile` không khớp `MEDIA_ROOT` của service
`api`, hoặc ai đó đổi `handle_path` thành `handle`. Phép 7 vẫn 200 nghĩa là `MEDIA_AN_ROOT`
đang nằm TRONG `MEDIA_ROOT` — sai cấu hình, xem `api/core/anh_luu.py`.

## Bảo mật khu quản trị — ba lớp, và lớp thứ tư còn thiếu

`deploy/Caddyfile` mẫu có allowlist IP cho `admin.gikky.net`. **Bản prod cố ý BỎ nó**: sau
tunnel, `remote_ip` là địa chỉ cloudflared với mọi request, nên allowlist theo nó hoặc chặn
tất (kể cả bạn), hoặc cho qua tất. Ba lớp thật sự đang chạy:

1. `/api/admin/*` → **403** trên host công khai (Caddy).
2. `ADMIN_HOSTS=admin.gikky.net` — middleware `config/host_admin.py` chặn ở tầng Django.
3. Permission `is_staff` của Ninja.

**Lớp thứ tư nên thêm: Cloudflare Access** trên hostname `admin.gikky.net` (Zero Trust →
Access → Applications → Self-hosted). Nó là thứ thay đúng vai của allowlist IP trong kiến
trúc có tunnel, và nó chặn TRƯỚC khi request rời khỏi mạng Cloudflare.

## Nợ biết trước

- **`EMAIL_URL` trống ⇒ KHÔNG AI ĐĂNG KÝ ĐƯỢC.** `ACCOUNT_EMAIL_VERIFICATION="mandatory"`,
  không SMTP thì mail xác thực ghi ra file trong container và người đăng ký kẹt vĩnh viễn ở
  trạng thái chưa xác thực. Đây là hạng mục số 1.
- Google OAuth tắt (không credential) ⇒ frontend không render nút. Đúng theo PLAN mục 4.
- `SECURE_PROXY_SSL_HEADER` không đặt ⇒ Django tin `scheme=http`. Không gây lỗi hiện tại
  (không có `SECURE_SSL_REDIRECT`; cookie `Secure` do settings chứ không do scheme), nhưng
  là lệch giữa cái Django tin và cái trình duyệt thấy. Sửa = đụng `settings.py`.
- **`/luat` không còn là route tĩnh.** `KhungHaiCot` gọi `GET /subs` ở phía server, nên
  10 trang trước đây tĩnh nay phải khai `force-dynamic` (nếu không `next build` ĐỎ).
  Hệ quả: Django chết ⇒ `error.tsx` hiện ra, người dùng bấm "về Luật", và `/luat` cũng
  chết — đường thoát hỏng cùng lúc với thứ nó thoát khỏi. `app/error.tsx:99` và
  `e2e/don-vi/trang-loi.spec.ts:86` đều ghim hợp đồng "`/luat` là route TĨNH".
  Chi tiết + hai lối chữa: `plans/2026-08-25-deploy-vps-docker.md` §"Trang tĩnh vỡ vì
  KhungHaiCot".
- **Không có backup tự động** cho `gikkynet_pgdata` và `gikkynet_media`.
  `docs/sao-luu-phuc-hoi.md` viết cho máy dev, chưa có bản cho stack này.
- Ảnh không có giới hạn dung lượng đĩa tổng.
- **CSDL đang rỗng** (0 mạch, 0 chuyên mục thật) — chỉ có 3 tài khoản đội ngũ.
  Muốn có nội dung mẫu: `gk exec api python manage.py seed_dev`. Đây là site CÔNG KHAI,
  nên cân nhắc trước khi seed dữ liệu giả lên đó.

## Rollback về site Trekky cũ

Hai container cũ chỉ bị `stop`, không bị xoá:

```bash
docker compose -f deploy/prod/compose.yml -p gikkynet stop caddy
docker start gikky-api-1 gikky-frontend-1
```

`gikky-frontend-1` bind `0.0.0.0:8091`, còn caddy mới bind `127.0.0.1:8091` — **hai cái
không chạy cùng lúc được**, nên phải dừng caddy trước. Ingress Cloudflare không phải sửa:
cả hai đều nghe cùng một cổng.
