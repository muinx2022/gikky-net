# Deploy gikky-net lên vps-muinx bằng Docker — 2026-08-25

## Bối cảnh đo được (khảo sát 2026-08-25)

- `vps-muinx` = VM Ubuntu `muinx-nuc`, 4 vCPU / 5.0 GiB RAM / 64 GiB trống. Docker 29.1.3,
  compose v2.40.3. **Không phải VPS thuê ngoài** — IP public `42.113.184.243` là đường
  nhà, và mọi HTTP vào máy đi qua **Cloudflare Tunnel**, không qua NAT/port-forward.
- `cloudflared` chạy sẵn (container, `network_mode: host`, `TUNNEL_TOKEN`), cấu hình
  ingress **do Cloudflare đẩy xuống** (remotely-managed) — không có file config trên máy.
  Ingress hiện tại: `gikky.net` → `http://localhost:8091`, `admin.gikky.net` → `8091`.
- **`gikky.net` ĐANG phục vụ app Trekky**, không phải repo này: `gikky-frontend-1` /
  `gikky-api-1` thuộc compose project `gikky` ở `~/trekky/src/deploy/production/compose.yml`.
  `curl https://gikky.net` → `<title>Trekky</title>`.
- Cổng host đã bị chiếm: 22, 2000, 5432, 7700, 8088, 8090, 8091, 8092, 8093, 15432.
- Volume/network tên `gikky_*` **đã thuộc về stack Trekky** ⇒ project mới phải tên khác.

## Quyết định của user (2026-08-25)

1. **Thay thẳng `gikky.net`** — dừng stack Trekky-trên-gikky, đưa gikky-net vào chỗ đó.
2. **Deploy từ working tree** (161 file chưa commit, 4 migration mới), không từ HEAD.

## Chốt kiến trúc

Compose project **`gikkynet`** (KHÔNG phải `gikky` — tránh đè volume `gikky_data` của Trekky),
mã nguồn ở `~/gikky-net/src`, file env ở `~/gikky-net/app/.env` (ngoài cây mã nguồn).

| service | image | cổng | ghi chú |
|---|---|---|---|
| `postgres` | `postgres:17` | nội bộ | volume `pgdata`; **không** publish ra host (5432/15432 đã bận) |
| `meili` | `getmeili/meilisearch:v1.51.0` | nội bộ | volume `meilidata`; tag khớp bản trekky đã chạy thật |
| `api` | build `deploy/prod/api.Dockerfile` | nội bộ 8000 | gunicorn; entrypoint chạy `migrate` + `collectstatic` |
| `web` | build `deploy/prod/node.Dockerfile` target `web` | nội bộ 3000 | `next start` |
| `admin` | cùng Dockerfile, target `admin` | nội bộ 3001 | `next start` |
| `caddy` | build `deploy/prod/caddy.Dockerfile` (xcaddy + caddy-ratelimit) | `127.0.0.1:8091:80` | route theo Host |

TLS do Cloudflare lo ⇒ Caddy nghe **HTTP :80 trong container**, không ACME, không cổng 443.
Bind `127.0.0.1` (bản Trekky bind `0.0.0.0`) — cloudflared chạy host-network nên vẫn tới được.

### Ba chỗ khác `deploy/Caddyfile` mẫu, và lý do

1. **`rate_limit` phải khoá theo `CF-Connecting-IP`, không phải `{remote_host}`.**
   Sau tunnel, `remote_host` là IP của cloudflared với MỌI request ⇒ cả thế giới dùng
   chung một khoá đếm, và cửa đăng ký khoá cứng sau 20 lượt đầu tiên của bất kỳ ai.
2. **`header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}`.**
   `core/han_muc.py::dia_chi_ip` lấy phần tử **CUỐI** của `X-Forwarded-For` — đúng khi có
   ĐÚNG MỘT proxy. Ở đây có hai (cloudflared + Caddy), nên phần tử cuối là IP của
   cloudflared. Ghi đè tường minh làm danh sách chỉ còn một phần tử = IP thật.
3. **Bỏ allowlist IP của `admin.gikky.net`.** `remote_ip` sau tunnel vô nghĩa (xem 1).
   Lớp che đúng ở kiến trúc này là **Cloudflare Access**, cộng `ADMIN_HOSTS=admin.gikky.net`
   ở Django (`config/host_admin.py`) và permission `is_staff`. Một allowlist chép sang
   nguyên si sẽ hoặc khoá cửa với chính user, hoặc cho qua tất — cả hai đều im lặng.

Giữ nguyên: `/api/admin/*` → 403 trên host public (PLAN 8.2 gạch đầu dòng 1), `handle_path
/media/*` đọc thẳng đĩa, header `nosniff`/CSP/immutable trên ảnh.

## Tiêu chí nghiệm thu (ĐO ĐƯỢC)

| # | Tiêu chí | Cách đo |
|---|---|---|
| N1 | 6 container `gikkynet` đều `Up`, postgres+meili `healthy` | `docker compose -p gikkynet ps` |
| N2 | `migrate` không còn migration nào chờ | `showmigrations --plan \| grep -c "\[ \]"` = 0 |
| N3 | `https://gikky.net/api/v1/health` → 200 | `curl -s -o /dev/null -w %{http_code}` |
| N4 | `https://gikky.net/` → 200 **và** HTML chứa `gikky`, KHÔNG chứa `Trekky` | curl + grep |
| N5 | `https://gikky.net/api/admin/django/login/` → 403 (phép thử 1 của Caddyfile) | curl |
| N6 | `https://gikky.net/api/v1/openapi.json` → 404 (DEBUG=False đóng docs) | curl |
| N7 | `https://admin.gikky.net/` → 200 và phục vụ app admin (không phải app web) | curl + grep |
| N8 | Django thấy **IP thật**, không phải IP cloudflared | `/api/v1/health` + log, hoặc `chan-doan` |
| N9 | Ảnh: `GET /media/<file>` qua Caddy → 200 + `X-Content-Type-Options: nosniff` | curl -I |
| N10 | Tìm kiếm bật: `/tim-kiem?q=...` → 200, không phải trang "tắt" | curl + grep |
| N11 | Stack Trekky-trên-gikky đã dừng, **trekky.net vẫn sống** | `docker ps` + `curl https://trekky.net` |
| N12 | Reboot máy thì stack tự lên | `restart: unless-stopped` trên mọi service |

## Nợ biết trước (không giấu)

- **`EMAIL_URL` trống ⇒ KHÔNG ai đăng ký được.** `ACCOUNT_EMAIL_VERIFICATION="mandatory"`,
  không SMTP thì mail xác thực rơi vào file trong container. Cần credential SMTP của user.
- Google OAuth tắt (không có credential) ⇒ frontend không render nút. Đúng theo PLAN mục 4.
- `SECURE_PROXY_SSL_HEADER` không đặt ⇒ Django thấy `scheme=http`. Không gây lỗi (không có
  `SECURE_SSL_REDIRECT`, cookie Secure là do settings chứ không do scheme), nhưng là lệch
  giữa cái Django tin và cái trình duyệt thấy. Sửa = đụng `settings.py` ⇒ để lại làm sau.
- Không có backup tự động cho `pgdata`/`media` ở lượt này.

---

# KẾT QUẢ (đo lúc 2026-08-25 ~09:15 giờ VN)

## Bảng nghiệm thu

| # | Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|---|
| N1 | 6 container `Up`, postgres+meili `healthy` | **ĐẠT** | `gk ps`: admin/api/caddy/meili/postgres/web đều Up; api+meili+postgres `(healthy)` |
| N2 | Không còn migration chờ | **ĐẠT** | `showmigrations --plan \| grep -c "^\[ \]"` = **0**; `makemigrations --check` sạch, không drift |
| N3 | `/api/v1/health` → 200 | **ĐẠT** | `{"status": "ok", "db": "ok"}` |
| N4 | `/` → 200 và là gikky, không phải Trekky | **ĐẠT** | `<title>gikky.net — nhật ký giao dịch của người Việt</title>` |
| N5 | `/api/admin/django/login/` → 403 | **ĐẠT** | 403 |
| N6 | `/api/v1/openapi.json` → 404 (DEBUG=False) | **ĐẠT** | 404 |
| N7 | `admin.gikky.net` → app admin | **ĐẠT** | 200 · `<title>gikky.net — quản trị</title>` |
| N8 | Django thấy IP THẬT | **ĐẠT** | log gunicorn: `xff=2405:4802:17e7:2a20:…` `peer=172.23.0.7` — đúng một phần tử XFF, IP công cộng thật |
| N9 | `/media/*` 200 + header đúng | **ĐẠT** | `content-type: image/png` · `x-content-type-options: nosniff` · `content-security-policy: default-src 'none'; sandbox` · `cache-control: …immutable`. `/media/anh/` → **404**, không ra danh sách |
| N10 | Tìm kiếm BẬT | **ĐẠT** | index `mach` tồn tại trên Meili (`primaryKey: id`); `/tim-kiem?q=vn30` → 200, render `tim-kiem-rong` (đúng: DB đang 0 mạch), không phải trang "tắt" |
| N11 | Trekky-trên-gikky đã dừng, trekky.net còn sống | **ĐẠT** | `gikky-api-1`/`gikky-frontend-1` `Exited (0)`; `https://trekky.net` → 200 `<title>Trekky</title>` |
| N12 | Tự lên sau reboot | **ĐẠT** | cả 6 container `RestartPolicy = unless-stopped` |

**Phép thử 4 của `deploy/Caddyfile` (rate limit) — ĐẠT:** 26 lượt GET
`/api/_allauth/browser/v1/auth/session` từ một IP ra `401 ×20` rồi `429 ×6`. Đúng
`events 20 / window 1h`, và nó chứng minh bản Caddy tự dựng THẬT SỰ có plugin
`caddy-ratelimit`.

⚠ **Số này do phiên chính TỰ ĐO, không qua nghiệm thu/phản biện độc lập.**

## Ba lỗi gặp trong lúc làm, và cách chữa

**1. `COPY --from=deps /repo/packages/api-client/node_modules` → build ĐỎ.**
`packages/api-client` không có dependency nào nên pnpm **không tạo** `node_modules` ở đó.
Danh sách viết tay bốn đường dẫn là một bản sao của "gói nào có dependency" — sự thật do
`pnpm-lock.yaml` quyết định. Chữa: `COPY --from=deps /repo /repo` một lần.

**2. Trang tĩnh vỡ vì `KhungHaiCot`** — xem mục riêng bên dưới.

**3. Script `.sh` viết từ Windows ra CRLF** ⇒ `/bin/sh^M: bad interpreter`. `.gitattributes`
ép `eol=lf` cho file **đã theo dõi**, nhưng file mới tạo bằng công cụ Windows thì chưa qua
git. Chữa: ép LF trước khi `scp`.

## Trang tĩnh vỡ vì KhungHaiCot

`apps/web/components/khung-hai-cot.tsx` (**mới, chưa commit**) gọi `docCacSub()` ở phía
**server** với `cache: "no-store"`. 14 trang dùng nó; 10 trang trong số đó chưa khai
`export const dynamic`. Hệ quả: **`next build` ĐỎ** ở bước export —

```
Error: Dynamic server usage: Route /cai-dat couldn't be rendered statically
because it used revalidate: 0 fetch
Export encountered an error on /cai-dat/page: /cai-dat, exiting the build.
```

Next vốn tự chuyển route sang dynamic khi gặp `DynamicServerError`, nhưng `lay()` trong
`lib/api.ts` **bọc lỗi lại** nên tín hiệu ấy không tới được Next.

⇒ Đã thêm `export const dynamic = "force-dynamic"` vào 10 trang:
`cai-dat` · `dang-ky` · `dang-nhap` · `dat-lai-mat-khau/[key]` · `doi-mat-khau` ·
`khu-mod` · `luat` · `quen-mat-khau` · `sua-ho-so` · `xac-thuc-email/[key]`.

### ⚠ Nợ mới, user phải quyết — `/luat` KHÔNG CÒN LÀ ROUTE TĨNH

`app/error.tsx:99` viết rõ: *"`/luat` là route TĨNH (`app/luat/page.tsx` không gọi API nào,
Next tiền dựng nó lúc build), nên nó lên được kể cả khi Django chết"*, và
`e2e/don-vi/trang-loi.spec.ts:86` ghim điều đó bằng `const ROUTE_TINH = ["/luat"]`.

Bản chưa commit đã phá hợp đồng ấy **trước** lượt deploy này: từ lúc `/luat` dùng
`KhungHaiCot`, nó gọi API ở phía server dù có `force-dynamic` hay không. `force-dynamic`
chỉ làm `next build` xanh trở lại, **không** làm hỏng thêm gì — nhưng cũng không chữa.

Hậu quả thật: Django chết ⇒ `error.tsx` hiện ra, người dùng bấm "về Luật", và `/luat`
**cũng chết**. Đường thoát hỏng cùng lúc với thứ nó thoát khỏi — đúng câu mà docstring
`docCacSubOTrinhDuyet` đã viết ra để cảnh báo (nợ `NAV-GHI-CUNG`, trả 2026-08-23).

Hai lối chữa, cả hai đều là quyết định thiết kế:

- **(a)** `/luat` thôi dùng `KhungHaiCot`, quay lại khung một cột không gọi API;
- **(b)** `KhungHaiCot` nhận danh sách sub **từ trình duyệt** như `docCacSubOTrinhDuyet`
  đã làm cho thanh nav — giữ được sidebar ở mọi trang, đổi lại link sub không có trong
  HTML lần đầu.

Chưa làm ở lượt này vì nó vượt phạm vi "deploy", và vì chọn lối nào là việc của user.

## Còn lại sau lượt này

1. **SMTP** — chưa có ⇒ **không ai đăng ký được**. Hạng mục số 1.
2. `/luat` (mục trên).
3. Cloudflare Access cho `admin.gikky.net`.
4. Backup `gikkynet_pgdata` + `gikkynet_media`.
5. DB đang **rỗng** (0 mạch, 0 sub thật) — mới có 3 tài khoản đội ngũ.

---

# BỔ SUNG 2026-08-25: email tài khoản đội ngũ đổi sang tên miền THẬT

User chốt: ba tài khoản dùng `admin@gikky.net` / `gikky-team-news@gikky.net` /
`gikky-team-member@gikky.net`, mật khẩu ngẫu nhiên nằm trong file env.

## Vì sao là BIẾN, không phải sửa hằng số

`tao_tai_khoan_doi.py` gán cứng `vi-du.gikky.net`, và lý do ghi tại chỗ vẫn đúng: bộ e2e
nhận diện tài khoản dựng sẵn **theo hậu tố `vi-du.`** (`apps/web/e2e/dung-seed.ts`), và
`seed_dev`/`seed_e2e` cũng dùng tên miền ấy. Sửa hằng số là đổi luôn thứ chúng dựa vào.

⇒ Thêm `GIKKY_TEAM_EMAIL_DOMAIN`, mặc định giữ nguyên `vi-du.gikky.net`. Chỉ
`~/gikky-net/app/.env` trên prod đặt `=gikky.net`.

## Cái bẫy tự tay dựng ra rồi tự gỡ

Dòng compose `GIKKY_TEAM_EMAIL_DOMAIN: ${GIKKY_TEAM_EMAIL_DOMAIN:-}` làm biến **luôn tồn
tại** trong container, chỉ rỗng khi không ai đặt. Mà `default=` của django-environ chỉ
dùng khi biến **KHÔNG TỒN TẠI** ⇒ `ten_mien` ra `""` và ba tài khoản mang email `admin@`,
`gikky-team-news@`. Django lưu bình thường, allauth lưu bình thường, **không có gì đỏ** —
chỉ có ba tài khoản không đăng nhập nổi.

Vá: `env.str(..., default="") or TEN_MIEN_EMAIL_MAC_DINH`. Ghim bằng
`test_bien_RONG_roi_ve_mac_dinh_chu_khong_ra_email_cut_duoi`.

## Bốn bài đo mới + THỬ PHÁ (Luật 4)

`api/tests/test_tao_tai_khoan_doi.py`: `7 → 11 bài, 11 passed in 13.8s`.

| Phá gì | Bài đo phải ĐỎ | Kết quả |
|---|---|---|
| Lệnh phớt lờ biến env (`ten_mien = TEN_MIEN_EMAIL_MAC_DINH`) | `test_bien_moi_truong_de_duoc_ten_mien` · `test_doi_ten_mien_...` | **2 failed, 8 passed** ✅ |
| Bỏ bước hạ cờ `primary` của địa chỉ cũ | `test_doi_ten_mien_...` · `test_tai_khoan_CO_SAN_...` | **2 failed, 8 passed** (`IntegrityError`) ✅ |
| Chỉ dựa `default=`, bỏ vế `or` | `test_bien_RONG_...` | **1 failed, 10 passed** ✅ |
| — khôi phục — | — | **11 passed** ✅ |

## Nghiệm thu trên PROD

Trạng thái DB — mỗi tài khoản **đúng 1** địa chỉ `primary`, đều `verified=True`:

```
u/admin              email=admin@gikky.net              staff=True  super=True
u/gikky-team-news    email=gikky-team-news@gikky.net    staff=False super=False
u/gikky-team-member  email=gikky-team-member@gikky.net  staff=False super=False
```

Đăng nhập THẬT qua HTTPS (`https://admin.gikky.net/api/_allauth/browser/v1/auth/login` —
host này không có rate-limit `/api/_allauth/*`, khác host public):

| Đo | Kết quả |
|---|---|
| 3 tài khoản `@gikky.net` | **200** · `"is_authenticated": true` · session giữ được ở lần gọi sau |
| **Đối chứng** mật khẩu sai | **400** — phép đo phân biệt được, không phải luôn xanh |
| Email cũ `@vi-du.gikky.net` | **200** — vẫn đăng nhập được (xem nợ dưới) |

## Nợ nhỏ để lại

Mỗi tài khoản còn **hai** hàng `EmailAddress` đều `verified=True`: `@gikky.net` (primary)
và `@vi-du.gikky.net` (không primary). Lệnh cố ý **hạ cờ chứ không xoá** — nó không có
quyền vứt đi một địa chỉ có thể là email thật của người đang dùng tài khoản. Ở đây thì ba
địa chỉ `@vi-du` là **rác của chính lượt deploy này** (dựng lúc 09:11, đổi lúc 09:58,
chưa ai từng dùng), nên xoá được:

```bash
gk exec api python manage.py shell -c "from allauth.account.models import EmailAddress; \
print(EmailAddress.objects.filter(email__endswith='@vi-du.gikky.net', primary=False).delete())"
```

Chưa chạy — xoá dữ liệu trên site đang sống là việc phải có người quyết.

## ĐÃ TRẢ nợ trên — user chốt xoá (2026-08-25)

Xoá 3 hàng `EmailAddress` `@vi-du.gikky.net`. Lệnh xoá có **một chốt an toàn**: dừng nếu
địa chỉ sắp xoá đang là `primary`, vì user còn 0 địa chỉ chính thì allauth không có nơi
gửi thư đặt lại mật khẩu. Ở lượt này cả 3 đều `primary=False` nên chốt không chạm tới —
nó ở đó cho lượt chạy lại sau.

```
=== XOÁ === (3, {'account.EmailAddress': 3})
```

Trạng thái cuối — mỗi tài khoản **đúng 1** địa chỉ, khớp `User.email`, `verified+primary`:

```
u/admin              admin@gikky.net              [(…, True, True)]
u/gikky-team-member  gikky-team-member@gikky.net  [(…, True, True)]
u/gikky-team-news    gikky-team-news@gikky.net    [(…, True, True)]
còn sót @vi-du: 0
```

Đăng nhập THẬT qua HTTPS, **có đối chứng hai chiều**:

| Đo | Kết quả |
|---|---|
| 3 tài khoản `@gikky.net` | **200** · `"is_authenticated": true` |
| `admin@vi-du.gikky.net` (đối chứng — trước khi xoá là 200) | **400** ✅ |
| `admin@gikky.net` + mật khẩu sai (đối chứng) | **400** ✅ |

⚠ Còn một đường quay lui: mất dòng `GIKKY_TEAM_EMAIL_DOMAIN=gikky.net` trong
`~/gikky-net/app/.env` rồi chạy lại `tao_tai_khoan_doi` là lệnh dựng lại `@vi-du` và đặt
nó làm `primary`, hạ `@gikky.net` xuống. Lệnh không nằm trong entrypoint nên nó không tự
chạy lúc deploy — nhưng dòng env ấy là thứ giữ trạng thái này đứng yên.
