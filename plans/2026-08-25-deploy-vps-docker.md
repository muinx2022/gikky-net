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

---

# LƯỢT DEPLOY 2 — 2026-08-26 (152 file, 4 migration)

## Cách so "cái gì sắp lên"

Không dùng `git diff` (phần lớn việc chưa commit). So **md5 từng file** giữa cây làm việc
và `~/gikky-net/src` đang chạy. Bẫy: `md5sum` trên Git Bash in `hash *tên-file` (chế độ
binary) ⇒ tên có dấu `*`, so thẳng ra "mọi file đều MỚI". Phải `sed 's/ \*/  /'` trước.

Kết quả: **152 file lệch** — 4 migration mới, module API mới (`quan_tri_cai_dat`,
`theo_user`, `cau_hinh_oauth`), lệnh `tao_sub`, bot `scripts/tin-tuc/`, và khu người dùng
mới ở frontend.

## Bốn thứ kiểm TRƯỚC khi đụng vào prod

| Kiểm | Vì sao | Kết quả |
|---|---|---|
| `package.json` đổi mà `pnpm-lock.yaml` KHÔNG | thêm dep mà lock cũ ⇒ `pnpm install --frozen-lockfile` ĐỎ | chỉ thêm script `test:bot` — an toàn |
| `settings.py` có env mới BẮT BUỘC không | thiếu env ⇒ api restart-loop | không có; Google chuyển sang cấu hình trong DB (`cau_hinh_oauth.py`) |
| 4 migration làm gì | `0017` có `RunPython(xoa_reaction_bo_cu)` — **xoá dữ liệu** | prod đang 0 mạch/0 reaction ⇒ không mất gì; 3 cái còn lại thuần thêm |
| file bí mật có lọt gói không | `scripts/tin-tuc/.env` (credential bot) + `.tam/` (dữ liệu runtime, đã gitignore) | **thêm `--exclude`**, và kiểm lại trên VPS sau khi giải nén |

## Lỗi THẬT chặn build, và hàng rào của repo đã bắt đúng nó

```
./components/dung-mo-ta.ts:10:14
Type error: Type '{ phim_hang; lua_dao; spam; khac }' is missing the following
properties from type 'Record<"phim_hang" | … | "cam_ket_loi_nhuan" | "link_nhom_kin", string>'
```

Migration `0019` thêm hai lý do báo cáo, TS client sinh lại theo, nhưng
`apps/admin/components/dung-mo-ta.ts` còn 4 khoá. Docstring chính file ấy viết:
*"thêm một lý do ở Python mà quên chỗ này là **lỗi biên dịch**, không phải một ô trống
trên bảng của mod"* — hàng rào chạy đúng như thiết kế, chỉ là nó nổ ở `next build` chứ
không ở `pytest`, nên `pnpm test` xanh vẫn không thấy.

Vá: thêm `cam_ket_loi_nhuan` + `link_nhom_kin`, chữ chép ĐÚNG từ `Report.LyDo` và khớp
`apps/web/components/bao-cao.tsx::NHAN_LY_DO` — mod và người báo phải nói cùng một điều.

⚠ **Nợ nhỏ để lại:** hai khoá CŨ vẫn lệch chữ giữa hai app (`lua_dao`: admin ghi
*"Lừa đảo, mời uỷ thác, room VIP"*, web/Django ghi *"Mời uỷ thác, room VIP trả phí, lừa
đảo"*; `spam`: *"Spam"* vs *"Spam, lôi kéo, đăng lặp"*). Không sửa ở lượt này vì đó là
câu chữ user đã chọn, không phải lỗi.

## "1131 errors" — báo động giả, và vì sao

Lượt `pnpm test` đầu ra `372 passed, **1131 errors**`. Nguyên nhân **không phải code**:

```
Got an error creating the test database: database "test_gikky_dev" already exists
Got an error recreating the test database: database "test_gikky_dev" is being accessed
by other users — There is 1 other session using the database.
```

`pg_stat_activity` xác nhận: một kết nối `test_gikky_dev` mở lúc 15:51:32, đang
`INSERT INTO core_user` — **một phiên Claude khác đang chạy test trên cùng repo**, đúng
cảnh báo ở `D:\Projects\CLAUDE.md`.

⇒ Không giết phiên kia. Chạy lại trên **test DB riêng**, và đây là mẹo đáng nhớ:
`environ.Env.read_env` dùng `setdefault` nên **biến môi trường thắng `api/.env`**, tức
đổi tên DB chỉ cần một tiền tố:

```bash
DATABASE_URL="postgres://gikky:<pw>@127.0.0.1:5432/gikky_kiem_deploy" node scripts/pytest.mjs -q
```

(DB gốc không cần tồn tại — Django tạo `test_<tên>` qua `_nodb_cursor`.)

**Kết quả sạch: `1487 passed, 16 skipped in 281s`.** 16 skip đều là `test_tim_kiem_that.py`
— `MEILI_URL` trống ở máy dev, đúng thiết kế. ⚠ Nghĩa là **16 bài đo Meilisearch chưa
từng chạy ở đâu**, kể cả lượt này, dù prod có Meili thật.

## Nghiệm thu sau deploy

| Đo | Kết quả |
|---|---|
| Migration | `0017`→`0020` Applied OK · **0** chờ · `makemigrations --check` SẠCH |
| `collectstatic` | 129 file |
| `/` · `/luat` · `/dang-nhap` · `/tim-kiem` · `/sitemap.xml` · `/feed.xml` | **200** |
| `/api/v1/health` | **200** |
| `/api/admin/django/login/` (host public) | **403** |
| `/api/v1/openapi.json` | **404** |
| `admin.gikky.net` `/` · `/bao-cao` · `/cai-dat` | **200** |
| `trekky.net` (hàng xóm) | **200**, không bị đụng |
| Log 3 phút sau deploy | **0** traceback / exception / 500 |
| Build | 0 warning (trừ 2 advisory `npm deprecated` + `Bake`) |

`ACCOUNT_LOGIN_METHODS` nay là `{email, username}` — đo cả hai, **có đối chứng hai chiều**:

| Đo | Kết quả |
|---|---|
| `admin@gikky.net` + mật khẩu đúng | **200** `"is_authenticated": true` |
| username `admin` + mật khẩu đúng | **200** `"is_authenticated": true` |
| username đúng + mật khẩu SAI | **400** ✅ |
| username KHÔNG tồn tại | **400** ✅ |

## Đường lui

- `pg_dump` trước khi migrate: `~/gikky-net/backups/truoc-deploy-20260826-085748.sql.gz` (24K)
- Cây mã nguồn bản trước: `~/gikky-net/src.cu`
- Image bản trước vẫn còn trong docker (`docker images` — tag `<none>` sau khi build đè)

---

# LƯỢT DEPLOY 3 — 2026-08-27 (94 file, migration `0021`)

**Khác hẳn hai lượt trước: prod nay CÓ DỮ LIỆU THẬT** — 7 mạch / 7 mốc / 8 vote / 6 sub /
5 user (bot tin tức đã đăng). Mọi phép cân nhắc "mất gì nếu sai" đổi theo.

## Bốn cổng kiểm trước khi đụng prod

| Cổng | Kết quả |
|---|---|
| `package.json` / `pnpm-lock.yaml` đổi? | **không cái nào** ⇒ `--frozen-lockfile` an toàn |
| `settings.py` thêm env bắt buộc? | không đổi. `core/apps.py` chỉ thêm `from core import phien` cho receiver `user_logged_in` |
| migration `0021` làm gì | **thuần metadata** — `AlterField(choices)`; `choices` không phải ràng buộc Postgres, cột `varchar(8)` giữ nguyên. Đối lập với `0017` đã XOÁ hàng `Reaction`. Với 7 mạch thật thì khác biệt này là thật |
| file cấm lên VPS | thêm `--exclude`: `.env` (mọi tầng) · `da-dang.json` (sổ runtime, gitignore) · `.tam/` · **`.claude/`** |

⚠ **`.claude/` — lỗ hổng của HAI lượt trước.** Nó không nằm trong exclude, nên 6 MB worktree
của phiên khác đã lên VPS từ lượt 1. Nay các worktree ấy CÓ `api/.env` bên trong. Kiểm lại:
`find ~/gikky-net/src/.claude -name ".env"` ra **rỗng** — chưa rò lần nào, đúng vì worktree
có `.env` xuất hiện sau. Lượt này loại hẳn `.claude/`, và bước giải nén nay **dừng** nếu tìm
thấy `.env` / `da-dang.json` / `.claude` trong gói.

## Bộ kiểm: 1 ĐỎ, và nó là FLAKY có sẵn

`1 failed, 1503 passed, 16 skipped` — `test_api_theo_sub.py::test_me_subs_moi_theo_dung_truoc`.

Không nhận là flaky theo cảm tính. Chạy RIÊNG bài đó 5 lần trên test DB sạch: **2 xanh /
3 đỏ**. Nguyên nhân đo được:

```
6 lần timezone.now() liên tiếp → cách nhau 0.0 us, trùng nhau: True
số giá trị PHÂN BIỆT được trong 6 lần gọi: 1
```

Hai hàng `TheoSub` mang **cùng `created_at`** ⇒ `ORDER BY -created_at` hoà ⇒ Postgres trả
thứ tự tuỳ ý. `api/api/theo_sub.py` **không** nằm trong 94 file lệch ⇒ không phải hồi quy
của lượt này. **Ghi sổ `P-20260827-1`**, không sửa giữa lượt deploy.

## Nghiệm thu sau deploy

| Đo | Kết quả |
|---|---|
| `0021` | Applied OK · **0** chờ · `makemigrations --check` SẠCH |
| **Dữ liệu còn nguyên** | Mach 7 · Moc 7 · Vote 8 · User 5 · Sub 6 · Reaction 0 — **y hệt trước deploy** |
| Bộ reaction | 5 khoá, `lieu → "⚠️ rủi ro"`, thêm `hay_lam → "🔥 hay lắm"` |
| 13 URL HTTPS | `/` `/luat` `/dang-nhap` `/tim-kiem` `/sitemap.xml` `/feed.xml` `admin/*` **200** · `/api/admin/django/login/` **403** · `/api/v1/openapi.json` **404** |
| `trekky.net` | **200**, không bị đụng |
| Trang mạch thật `…-1007` | **200**, `data-testid="banner*"` còn **0** ⇒ `BannerMach` đã sạch |
| `chan-dong-so` không thấy trong HTML | **ĐÚNG, không phải lỗi**: component `return null` khi `status !== "closed"`, và cả 7 mạch đang mở |
| Log 3 phút sau deploy | **0** traceback / exception / 500 |
| Build | 0 warning (trừ advisory `pip as root` + `Bake`) |

## Một lỗi PROD tìm ra lúc nghiệm thu — đã sửa

Meili có **8** tài liệu trong khi DB có 7 mạch. Đếm tay từng id:

- `1001` **đã xoá khỏi DB** nhưng còn trong index ⇒ tìm ra rồi bấm vào là 404;
- `1005` **đang bị mod ẩn** (`hidden_at` set) nhưng vẫn `hien = true` ⇒ **bài bị ẩn vẫn tìm
  ra được**, tức lớp che nội dung bị đi vòng qua đường tìm kiếm.

Xử: `reindex_tim_kiem --sach` ⇒ 8 → **6 tài liệu**, đúng 6 mạch công khai.

Nguyên nhân chưa biết — đường ghi `dat_an_mach` **có** gọi `dong_bo_mach`, và log của cửa sổ
thời gian đó đã mất cùng container cũ. **Ghi sổ `P-20260827-2` (NẶNG)** kèm hai giả thuyết
ghi rõ là chưa dựng được bằng chứng, và đề nghị làm cho cái lệch này **nhìn thấy được**
thay vì phải đi tìm.

## Đường lui

- `~/gikky-net/backups/truoc-deploy-20260827-042800.sql.gz` (32K, kiểm được: 34 `CREATE TABLE`, có `COPY public.core_mach`)
- Cây mã nguồn bản trước: `~/gikky-net/src.cu`

---

# SMTP — trả xong món nợ số 1 (2026-08-27)

Từ lượt deploy đầu tiên (25/08) tới giờ, hạng mục số 1 luôn là *"`EMAIL_URL` trống ⇒ không
ai đăng ký được"*. Nay đã xong: **Brevo SMTP**, gói free 300 thư/ngày.

```
EMAIL_URL=smtp+ssl://b6dab0001@smtp-brevo.com:<smtp-key>@smtp-relay.brevo.com:465
DEFAULT_FROM_EMAIL=gikky <no-reply@gikky.net>
```

## Thứ tự kiểm — rẻ trước, đắt sau

Cố ý **không** restart `api` rồi mới thử. Mỗi bước hỏng ở đây có một thông báo riêng; gộp
lại thì tất cả cùng hiện ra dưới đúng một triệu chứng "đăng ký không được".

| Bước | Đo gì | Kết quả |
|---|---|---|
| 1 | Cổng ra từ VPS tới Brevo | 25 **chặn** · 587 mở · 465 mở · 2525 mở |
| 2 | DNS: brevo-code · DMARC · DKIM | ✅ cả ba, xác nhận từ **hai** resolver (1.1.1.1 + 8.8.8.8) |
| 3 | AUTH SMTP thật, **chưa** đụng container | `525 Unauthorized IP` → user tắt chặn → **AUTH OK** cả 465 lẫn 587 |
| 4 | `up -d api`, đọc cấu hình Django THẤY | `USE_SSL=True` `USE_TLS=False` port 465 — khớp scheme |
| 5 | `send_mail()` | trả `1` |
| 6 | Đăng ký thật trên gikky.net | `401` + `verify_email is_pending` — đúng luồng allauth |
| 7 | **Log của chính Brevo** | `07:42:13 · từ no-reply@gikky.net · "[gikky.net] Xác nhận địa chỉ email cho gikky.net"` |
| 8 | Link trong thư | key HMAC 53 ký tự → cửa verify → DB **`verified=True`** |

**Đối chứng ở mọi bước có thể:** mật khẩu SMTP sai ra `535 Authentication failed`; API key
sai ra `Key not found`. Không có đối chứng thì bước 3 và 5 chỉ là "không thấy lỗi".

Tài khoản thử `u/thu-smtp-054209` đã xoá sau khi đo xong (in danh sách trước khi xoá, có
chốt an toàn chặn nhầm tài khoản `is_staff`).

## Hai cái bẫy mất thời gian nhất

**1. `525 Unauthorized IP address` trông y như sai key.** Brevo có công tắc chặn IP **riêng**
cho SMTP key và cho API key. Thứ phân biệt hai ca là **thông báo lỗi khác nhau** —
`525 5.7.1 Unauthorized IP` (key ĐÚNG, IP sai) vs `535 5.7.8 Authentication failed` (key
sai). Không có đối chứng key-sai thì không đọc ra được điều đó.

Đã thử luôn giả thuyết *"hay dùng API key thay SMTP?"*: **API key đụng ĐÚNG bức tường đó**
(`401 unrecognised IP address`), nên đổi sang REST API vừa không gỡ được gì vừa phải thêm
`django-anymail` + sửa `EMAIL_BACKEND` + build lại image. Bỏ.

**2. IP của máy này là IP ĐỘNG.** `42.113.184.243` là đường Internet nhà. Chốt **tắt chặn IP**
thay vì allowlist: allowlist trên IP động không hỏng lúc đang nhìn, nó hỏng ba tuần sau vào
đúng lúc có người thật đăng ký. Bật lại nếu ngày nào chuyển sang VPS có IP tĩnh.

## Ba lần phép đo của TÔI sai, cấu hình thì đúng

Ghi lại vì cùng một kiểu sai:

1. Tìm DKIM ở selector `mail._domainkey` (dạng Brevo cũ) — thật ra là `brevo1/brevo2._domainkey`;
2. Lọc DKIM theo `v=DKIM1` — Brevo bỏ tag đó, mà RFC 6376 ghi `v=` là *RECOMMENDED*;
3. `dig +short TXT | head -1` trên chuỗi CNAME **nhiều chặng** ⇒ chộp trúng dòng CNAME thay
   vì dòng TXT cuối.

Cả ba lần bảng ✅ trong giao diện Brevo đã đúng ngay từ đầu. Bài học: khi phép đo của mình
mâu thuẫn với một nguồn độc lập đang báo xanh, **nghi phép đo trước**.

## Còn lại

- **300 thư/ngày** là trần thật của gói free. Chạm trần ⇒ `send_mail` ném ⇒ **allauth không
  tạo được tài khoản**. Chưa có cảnh báo nào khi gần chạm — cùng loại với `P-20260827-2`
  (thứ hỏng im lặng cần được nhìn thấy), đáng làm chung một lượt.
- `no-reply@gikky.net` **không nhận được thư** (không MX). Người ta sẽ bấm Reply vào thư xác
  thực và thư rơi vào hư không. Bật Cloudflare Email Routing (miễn phí) là xong.
- Thư vào Inbox hay Spam thì **chỉ user kiểm được** — không đo từ phía server được.

## Báo động giả sau đó — và nó là do CÁCH TÔI ĐO, không phải do sản phẩm

User báo: đăng ký xong, có thư, bấm link ⇒ **`Invalid or expired key`**. Server thì mọi
phép đo đều nói "phải chạy được": link thô ✅, link percent-encode ✅, khoá chưa hết hạn
(3 ngày), tài khoản chưa từng xác thực thành công.

Gỡ ra bằng cách **decode phần đầu của khoá** — allauth nhét `EmailAddress.pk` vào đó:

```
KHOÁ OQ…   -> EmailAddress pk=9   -> KHÔNG CÒN (đã bị xoá)
KHOÁ MTA…  -> EmailAddress pk=10  -> muinx2022@gmail.com
```

Nguyên nhân: tôi chạy thử bằng bí danh **`muinx2022+gikkytest@gmail.com`** — tức **chính
hộp thư của user**. Gmail gộp bí danh `+` vào cùng inbox, nên thư thử của tôi nằm lẫn giữa
thư thật và **trông y hệt**. Đo xong tôi xoá tài khoản thử ⇒ khoá của nó trỏ vào một hàng
không còn tồn tại ⇒ user bấm trúng nó và nhận đúng câu lỗi trên.

**Ba luật rút ra cho mọi lượt đo có gửi mail thật:**

1. **Đừng test trên hộp thư của user.** Bí danh `+` không tách được về mặt thị giác — nó
   tách về mặt định tuyến, mà cái người ta nhìn thấy mới là cái gây nhầm.
2. **Nếu buộc phải, cho thư thử một tiêu đề PHÂN BIỆT ĐƯỢC** (`[THỬ — bỏ qua]`), đừng để
   nó dùng chung template với thư thật.
3. **Xoá dữ liệu thử là một thao tác có HẬU QUẢ RA NGOÀI**, không chỉ dọn DB: nó làm chết
   những link đã nằm trong hộp thư người khác. Báo trước, hoặc đừng xoá.

Phát hiện thật lộ ra từ vụ này: `P-20260827-4` — trang xác thực phun nguyên văn tiếng Anh
`Invalid or expired key` ra UI tiếng Việt, và **ba nguyên nhân khác nhau cùng ra một câu**
(khoá đã dùng / quá hạn / hàng đã bị xoá) trong khi cách xử của người dùng ở ba ca là khác
nhau.

## Chốt cuối (13:07 giờ VN, 2026-08-27)

| Đo | Kết quả |
|---|---|
| Đăng ký bằng địa chỉ ĐỘC LẬP (`nguyenxuanmui@gmail.com`, không phải bí danh `+`) | `id=10 u/ngxuanmui` **verified=True** |
| 7 tài khoản trên prod | **tất cả** `verified=True` |
| Quota Brevo | 295/300 còn lại |

---

# LƯỢT DEPLOY 4 — 2026-08-28 (46 file · migration `0022`+`0023` · đếm lượt xem)

## Bốn cổng kiểm

| Cổng | Kết quả |
|---|---|
| `package.json` / `pnpm-lock.yaml` | không đổi ⇒ `--frozen-lockfile` an toàn |
| `settings.py` có env MỚI bắt buộc? | thêm `DEM_LUOT_XEM_SECRET` nhưng **có `default=""`** ⇒ không chặn boot |
| Migration | `0022` AlterField choices (metadata) · `0023` CreateModel `LuotXem`+`TongNgay` — **thuần thêm**, không đụng dữ liệu |
| File cấm lên VPS | `.env` · `da-dang.json` · `.tam` · `.claude` — bước giải nén tự dừng nếu thấy |

## Một lỗ hổng CHẶN, phải sửa trước khi build

`compose.yml` truyền `DEM_LUOT_XEM_SECRET` làm **build-arg** cho `web` (đúng — docstring
`lib/dem-luot-xem.ts:153` nói middleware là edge runtime), nhưng **`node.Dockerfile` không
khai `ARG` đó**. Docker **bỏ qua build-arg mà Dockerfile không khai**, chỉ in một dòng cảnh
báo lẫn giữa hàng trăm dòng build.

⇒ Thêm `ARG DEM_LUOT_XEM_SECRET` + `ENV`. Và thêm cùng build-arg vào target `admin` —
**không phải vì admin dùng nó**, mà vì `web`/`admin` chung stage `builder`: build-arg là một
phần cache key, truyền khác nhau là dựng `builder` HAI lần (`pnpm install` + hai `next build`).

Kiểm sau build: **không có dòng "build args not consumed"** ⇒ `ARG` đã tới nơi.

## Nghiệm thu

| Đo | Kết quả |
|---|---|
| `pnpm test` (test DB riêng) | **1600 passed, 16 skipped, 0 failed** |
| Migration | `0022`,`0023` Applied OK · **0** chờ · `makemigrations --check` SẠCH |
| Dữ liệu trước/sau | Mach 11 · Moc 13 · Vote 14 · User 7 · Sub 6 — **y hệt** |
| Bảng mới | `LuotXem`, `TongNgay` đã tạo |
| 10 URL HTTPS | 200 / `api/admin` **403** / `openapi.json` **404** / `admin.gikky.net/luot-xem` **200** |
| `trekky.net` | 200, không bị đụng |
| Build | 0 warning |

## ⚠ Nhưng TÍNH NĂNG CHÍNH của bản này KHÔNG CHẠY

Đếm lượt xem ra **0 hàng** dù vào trang mạch thật nhiều lần. Truy ra: middleware **có** gọi
Django (`POST /api/v1/dem-luot-xem → 400`), nhưng gửi **thân request RỖNG**.

Cách truy — dò 118 byte của phản hồi 400 khớp ca nào:

```
thân JSON đúng          -> 200  16 byte
thân = [object Object]  -> 400  71 byte
thân RỖNG               -> 400  118 byte   ← KHỚP
thiếu duong_dan         -> 400  128 byte
duong_dan = null        -> 400  144 byte
```

Và **không phải lỗi secret**: secret sai ra **401**, không phải 400 ⇒ header đã tới nơi,
đã qua lớp auth. Endpoint tự nó đúng (curl ⇒ `200 {"da_dem": true}`).

⇒ **Ghi sổ `P-20260828-1` (NẶNG)**, không sửa trong lượt này: đây là mã sản phẩm
(`middleware.ts` + client sinh ra), user giao "sync + migrate".

**Bài học về hàng rào**: `e2e/don-vi/dem-luot-xem.spec.ts` là bài đo **đọc mã nguồn**, nên
nó ghim được "hai file dùng chung tên header" mà **mù** với chuyện thân request có đi hay
không lúc chạy. Phép đo duy nhất bắt được là *"vào trang thật rồi đếm hàng `LuotXem`"* —
và nó chỉ chạy vì lượt nghiệm thu này đi đo tính năng mới thay vì chỉ đo site còn sống.

## Đường lui

- `~/gikky-net/backups/truoc-deploy-20260828-160113.sql.gz` (52K, 34 bảng)
- Cây mã nguồn bản trước: `~/gikky-net/src.cu`
