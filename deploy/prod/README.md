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
`next build` cùng lúc là OOM. Phải build **từng service một**:

```bash
for s in api web admin caddy; do gk build "$s" || break; done
```

⚠ **`build.sh` KHÔNG TỒN TẠI** — không trong repo, không trong lịch sử git, không trên
prod. Tài liệu này từng nhắc nó ở ba chỗ như thể nó có thật (kiểm 2026-08-29). Ai đó định
viết mà chưa viết. Dùng vòng lặp trên cho tới khi có script thật; đừng chép lại lời gọi
`./build.sh` vào chỗ nào nữa.

### Việc chạy theo lịch: gộp lượt xem — **BẮT BUỘC, không phải tuỳ chọn**

```bash
crontab -e
# 03:10 giờ VN mỗi ngày — sau nửa đêm để "ngày đã xong" thật sự đã xong.
10 3 * * *  cd ~/gikky-net/src && docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env exec -T api python manage.py gom_luot_xem >> ~/gikky-gom-luot-xem.log 2>&1
```

Không có lịch này thì **ba chuyện hỏng, cả ba im lặng**:

1. Bảng thô `core_luotxem` phình vô hạn — lời hứa "giữ 90 ngày" chỉ được giữ bởi chính
   lệnh này (`gom_luot_xem` gộp xong mới dọn, và chỉ dọn phần đã gộp).
2. Số liệu dài hạn không bao giờ được dựng. Trang `/luot-xem` **tự lành** ở phép đọc
   ("toàn thời gian" lấy hàng thô cho phần chưa gộp), nên bạn sẽ *không* thấy con số sai
   — chỉ thấy bảng thô lớn dần cho tới ngày nó thành vấn đề.
3. **Riêng tư**: lệnh này là lưới huỷ **muối khách** (`MuoiNgay`) thứ hai. Đường ghi tự
   huỷ muối cũ ở lượt xem đầu tiên của ngày mới (`api/dem_luot_xem.py::muoi_cua_ngay`),
   nhưng một ngày site không có lượt xem nào — hay Django chết — thì chỉ cron này dọn.
   Muối còn sống là còn nối được một người qua ngày nếu DB bị đọc, tức đúng thứ ba dòng
   cam kết trên trang `/luot-xem` nói là không thể.

Kiểm nó có chạy: `gk exec api python manage.py shell -c "from core.models.luot_xem import TongNgay; print(TongNgay.objects.count(), TongNgay.objects.order_by('-ngay').values_list('ngay', flat=True).first())"`

### Việc chạy theo lịch: đối soát chỉ mục tìm kiếm — **BẮT BUỘC** (2026-08-30)

```bash
crontab -e
# 03:40 giờ VN mỗi ngày — SAU `gom_luot_xem` (03:10) để hai lệnh không tranh CPU của một VPS nhỏ.
40 3 * * *  cd ~/gikky-net/src && docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env exec -T api python manage.py reindex_tim_kiem >> ~/gikky-reindex-tim-kiem.log 2>&1
```

**Không `--sach`.** Bước gỡ tài liệu ma nay chạy mặc định, còn `--sach` xoá hẳn index rồi
dựng lại — vài giây index rỗng giữa lúc site đang chạy. Đó là lệnh của người ngồi trước
máy, không phải của cron.

Không có lịch này thì **chỉ mục lệch DB im lặng, vĩnh viễn** (`P-20260827-2`). Ba lớp hợp
lại làm nó im: đường ghi index **nuốt lỗi** có chủ đích (`core/tim_kiem.py` — mất index
còn hơn mất bài), lớp lọc thứ hai ở `api/tim_kiem.py` **che mọi hậu quả nhìn thấy được**
(index lệch chỉ làm trang *thiếu dòng*, không làm nó *sai*), nên không ai kêu. Hai kiểu
lệch, cả hai đều không tự lành:

1. **thiếu** — `on_commit` chết giữa chừng (deploy đúng lúc, Meili restart) ⇒ bài mới
   không bao giờ tìm được;
2. **thừa** — mạch bị mod ẩn mà lời gọi xoá thất bại ⇒ tài liệu nằm lại **mãi mãi**; chỉ
   mục không hết hạn như cache. Hôm nay lớp lọc Postgres còn che, tức hệ thống đang chạy
   trên **một** lớp thay vì hai, và không ai biết.

Kiểm nó có chạy: mở `/chan-doan` ở khu quản trị (khối **Tìm kiếm**) — hai con số của mỗi
index phải bằng nhau. Lệch vài đơn vị ngay sau khi có bài mới là bình thường
(Meilisearch index bất đồng bộ); lệch dai dẳng thì cron đang chết.

### Việc chạy theo lịch: phát hành bài đã hẹn — **BẮT BUỘC** (2026-09-04)

```bash
crontab -e
# Mỗi 5 phút — độ trễ chấp nhận sau giờ hẹn: ≤ 5 phút.
*/5 * * * *  cd ~/gikky-net/src && docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env exec -T api python manage.py phat_hanh_da_hen >> ~/gikky-phat-hanh-da-hen.log 2>&1
```

Không có lịch này thì bài viết trước **không bao giờ lên sóng**. Log phải có một dòng
mỗi lần chạy, kể cả `"Đã phát hành 0 bài."` — không có dòng nào thì "cron chết" và
"không có bài nào tới hạn" trông y hệt nhau.

Đối soát (số này phải = **0**; khác 0 là cron chết hoặc lệnh nổ im lặng):

```bash
gk exec api python manage.py shell -c "from datetime import timedelta; from django.utils import timezone; from core.models.dien_dan import Mach; n=Mach.objects.filter(hidden_at__isnull=False, hidden_by__isnull=True, published_at__lt=timezone.now()-timedelta(minutes=15)).count(); print(n)"
```

## Deploy một bản mới

Từ máy dev (Windows, **không có rsync** — dùng tar qua ssh).

⚠ **Bốn luật dưới đây là BẮT BUỘC, không phải gợi ý.** Cả bốn được chốt ngày 2026-09-03
sau một sự cố prod thật, giữa hai phiên Claude cùng làm trên repo này. Mỗi luật có một
sự cố đứng sau nó; phần "Vì sao" ngay dưới kể từng cái. Bỏ luật nào cũng được — cho tới
lần bạn không bỏ được nữa.

### Luật 1 · Nhắn các phiên khác TRƯỚC khi deploy

Máy này thường xuyên có nhiều phiên Claude làm song song trên cùng checkout. Trước khi
đẩy bất cứ thứ gì lên prod, hỏi các phiên còn lại (`ListAgents` → `SendMessage`) xem có
ai đang deploy hoặc sắp deploy không, và nói rõ bạn sắp đẩy commit nào.

### Luật 2 · Commit ĐỦ trước, rồi mới `git archive HEAD`

`git archive` đẩy **đúng commit**, không đẩy cây. Kết hợp với `rm -rf ~/gikky-net/src` ở
lệnh dưới, hệ quả là: **mọi thứ chưa commit bị XOÁ khỏi prod**, không phải bị ghi đè.

Trước khi deploy, kiểm bằng **git**, đừng kiểm bằng đĩa:

```bash
# Còn dòng nào không phải của mình ⇒ `git archive` sẽ xoá nó khỏi prod.
git status --porcelain | grep -vE '^\?\? plans/'

# Chặt hơn, khi biết đích danh file của người khác:
git archive HEAD | tar tf - | grep -c 'apps/web/components/vi-du.tsx'   # phải 1
```

⚠ **Phép kiểm "grep cây làm việc" là VÔ DỤNG ở đây** và nó đã lừa được một lượt: cây
luôn có đủ file, thứ sai là **khoảng cách giữa cây và git**.

### Luật 3 · Đóng gói ra FILE → chuyển → so kích thước → rồi mới giải nén

**Đừng** dùng `tar | ssh` một mạch. Ống đứt giữa chừng **không báo lỗi**: một lượt như
thế đã để lại cây **270 file** trên VPS với `apps/web/components` biến mất hẳn, và nó
trông y hệt một lượt thành công.

```bash
git archive --format=tar HEAD -o /tmp/gikky.tar
scp /tmp/gikky.tar vps-muinx:/tmp/gikky.tar
# So kích thước HAI ĐẦU — khác một byte là dừng, đừng giải nén.
stat -c %s /tmp/gikky.tar 2>/dev/null || wc -c < /tmp/gikky.tar
ssh vps-muinx 'wc -c < /tmp/gikky.tar'
ssh vps-muinx 'rm -rf ~/gikky-net/src && mkdir -p ~/gikky-net/src \
  && tar xf /tmp/gikky.tar -C ~/gikky-net/src && rm -f /tmp/gikky.tar \
  && echo "giai nen: $(find ~/gikky-net/src -type f | wc -l) file"'
```

### Luật 4 · `pg_dump` TRƯỚC mọi lượt có thể đổi schema

`api-entrypoint.sh` chạy `migrate` **tự động** mỗi lần container `api` lên. Nên mỗi lần
rebuild `api` là một lần đổi schema tiềm tàng — kể cả khi bạn đang deploy một việc chẳng
liên quan gì tới database.

```bash
# 1. Xem sắp áp cái gì. Không có dòng `[ ]` nào ⇒ không đổi schema, bỏ qua bước 2.
ssh vps-muinx 'cd ~/gikky-net/src && docker compose -f deploy/prod/compose.yml \
  --env-file ~/gikky-net/app/.env exec -T api python manage.py showmigrations core | grep "^ \[ \]"'

# 2. Có migration mới ⇒ dump trước, và hỏi user xem migration ấy ĐƯỢC PHÉP lên prod chưa.
ssh vps-muinx 'mkdir -p ~/gikky-net/backup && cd ~/gikky-net/src && docker compose \
  -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env exec -T postgres \
  pg_dump -U gikky gikky | gzip > ~/gikky-net/backup/gikky-$(date +%Y%m%d-%H%M%S)-truoc-migrate.sql.gz'
```

### Build + up

**Build TỪNG service một** — `build` trần chạy song song và máy chỉ còn ~3.4 GiB RAM:

```bash
ssh vps-muinx 'cd ~/gikky-net/src && for s in api web admin caddy; do docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env build "$s" || break; done'
ssh vps-muinx 'cd ~/gikky-net/src && docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env up -d'
```

⚠ **Rebuild ĐỦ các service mà commit này đụng tới.** Rebuild `web` mà quên `api` (hoặc
ngược lại) để lại prod ở trạng thái **nửa vời**: ngày 2026-09-03, `web` mới mang UI nhắn
tin chạy cùng `api` cũ không có endpoint ⇒ `/api/v1/me/tin-nhan` trả **404** suốt 17 phút,
phong bì header và hộp thư rỗng với mọi người đã đăng nhập. Không có gì đỏ ở đâu cả.

⚠ **Kéo image nền trước nếu mạng chập chờn.** `registry-1.docker.io` từ đường dân dụng
này hay timeout trong khi `auth.docker.io` vẫn 200 — build `web`/`admin` sẽ chết ở
`load metadata for node:22-bookworm-slim`. Chữa: `ssh vps-muinx 'docker pull
node:22-bookworm-slim'`, thử lại vài lần rồi build tiếp.

### Nghiệm thu sau deploy — đo, đừng tin

⚠ **Cổng Caddy của gikkynet là `127.0.0.1:8091`.** Cổng **8090 là stack `trekky`** trên
cùng máy: gõ nhầm nó trả **200 cho mọi thứ**, kể cả một `PATCH` không đăng nhập và cả
đường mà PLAN 8.2 bắt phải chặn. Một bảng toàn 200 trông như deploy hoàn hảo. Luôn kiểm
cổng trước: `docker compose ... ps --format '{{.Service}} -> {{.Ports}}' | grep caddy`.

Phép đo tối thiểu, và **phải có một ca ÂM** để chứng minh bảng không rỗng:

```bash
P=8091
curl -so /dev/null -w '/            : %{http_code}\n' -H 'Host: gikky.net' http://127.0.0.1:$P/
curl -so /dev/null -w '/api/v1/health: %{http_code}\n' -H 'Host: gikky.net' http://127.0.0.1:$P/api/v1/health
# Cửa quản trị: 401 trên host admin, 403 trên host công khai (PLAN 8.2 chặn ở Caddy).
curl -so /dev/null -w 'admin  /api/admin/…: %{http_code}\n' -H 'Host: admin.gikky.net' http://127.0.0.1:$P/api/admin/mocs/1
curl -so /dev/null -w 'public /api/admin/…: %{http_code}\n' -H 'Host: gikky.net'       http://127.0.0.1:$P/api/admin/mocs/1
# CA ÂM: đường không tồn tại phải 404. Ra 200 ⇒ bạn đang gõ nhầm cổng.
curl -so /dev/null -w 'khong-ton-tai : %{http_code}\n' -H 'Host: admin.gikky.net' http://127.0.0.1:$P/api/admin/khong-ton-tai
```

Kiểm thêm: `showmigrations core` không còn dòng `[ ]` · `logs api --since 10m` không có
traceback · endpoint mới có thật (`401`/`403`, **không phải** `404`).

Khối trên đo **trực tiếp Caddy nội bộ**, nên nó còn đúng khi Cloudflare trục trặc.
Sau đó chạy nốt **"Bảy phép thử sau mỗi lần deploy"** ở cuối tài liệu — bộ ấy đi qua
`https://gikky.net` thật, tức đo thêm cả tunnel và lớp media mà khối này không chạm.

---

`git archive` tự bỏ mọi thứ `.gitignore` (`.git`, `node_modules`, `.venv`, `.next`,
`__pycache__`, `api/media`, `api/.env`) nên không cần danh sách `--exclude` nào.

⚠ **KHÔNG dùng `tar .`** (chốt 2026-08-29, tái khẳng định 2026-09-03). Nó gói cây làm
việc, tức đẩy lên prod cả thứ đang sửa dở và chưa ai chạy thử — mà trên máy này cây gần
như luôn bẩn. Lần chốt đầu, cây có **190 mục chưa commit** của một lượt khác. Ngày
2026-09-03 một lượt `tar .` còn đặt **hai migration chưa duyệt** vào `~/gikky-net/src`,
nơi chúng nằm chờ người rebuild `api` kế tiếp — người ấy có thể đang làm một việc chẳng
liên quan gì. May là `api` **không bind-mount code** (migration nằm trong image), nên
restart không đủ để kích hoạt; chỉ rebuild mới.

`migrate` + `collectstatic` chạy tự động trong entrypoint của `api` mỗi lần container lên.

### Bản 2026-08-30 (tìm kiếm bình luận) — thứ tự BẮT BUỘC, làm MỘT LẦN

Bản này thêm index Meilisearch thứ hai (`binh_luan`). Khoá `MEILI_KEY` đang chạy chỉ khai
`indexes: ["mach"]`, nên **làm sai thứ tự là hỏng im lặng**: code mới lên trước khoá mới
thì mọi lời gọi index bình luận ăn 403, đường ghi nuốt, và không có gì trên màn hình nào
nói khác.

```bash
# 1. Khoá TRƯỚC (script đã sửa sang hai index) — chạy trên VPS, sau khi đã đẩy code:
ssh vps-muinx 'cd ~/gikky-net/src && deploy/prod/tao-khoa-meili.sh'
# 2. Dán chuỗi `key` vừa in vào MEILI_KEY= trong ~/gikky-net/app/.env
# 3. Deploy như thường (archive → build → up -d)
# 4. Dựng CẢ HAI index từ đầu — `--sach` ở đây là đúng: cấu hình index vừa đổi
ssh vps-muinx 'cd ~/gikky-net/src && docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env exec -T api python manage.py reindex_tim_kiem --sach'
# 5. Thêm dòng crontab đối soát (mục "Việc chạy theo lịch" ở trên)
# 6. Mở /chan-doan ở khu quản trị → khối "Tìm kiếm" phải nói KHỚP cho cả hai index
```

Bước 6 là bước nghiệm thu thật: nó là màn hình duy nhất phân biệt được "index rỗng" với
"khoá không có quyền đọc index" (`so_tai_lieu = null`).

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

- ~~**`EMAIL_URL` trống ⇒ KHÔNG AI ĐĂNG KÝ ĐƯỢC.**~~ **XONG 2026-08-27** — Brevo SMTP,
  `smtp+ssl://…@smtp-relay.brevo.com:465`. Đo đủ ba chặng: đăng ký → thư đi (log Brevo xác
  nhận, từ `no-reply@gikky.net`) → link xác thực đổi `verified=True`.
  **Ba thứ phải nhớ về nó:**
  1. **Gói free = 300 thư/NGÀY.** Hết quota thì `send_mail` ném, và allauth **không** tạo
     được tài khoản. Chưa có cảnh báo nào khi gần chạm trần.
  2. **Brevo chặn IP là công tắc riêng cho SMTP key và cho API key.** Bật lên mà không
     thêm IP thì ra `525 5.7.1 Unauthorized IP address` — dễ tưởng là sai key. Phân biệt:
     sai key ra `535 5.7.8 Authentication failed`. Hiện **đã tắt** cả hai, cố ý: IP của
     máy này (`42.113.184.243`) là IP động của đường Internet nhà, allowlist trên nó là
     bom hẹn giờ.
  3. **`smtp+ssl://` (465), KHÔNG phải `smtps://`** — xem nợ `P-20260827-3`.
- Google OAuth tắt (không credential) ⇒ frontend không render nút. Đúng theo PLAN mục 4.
- `SECURE_PROXY_SSL_HEADER` không đặt ⇒ Django tin `scheme=http`. Không gây lỗi hiện tại
  (không có `SECURE_SSL_REDIRECT`; cookie `Secure` do settings chứ không do scheme), nhưng
  là lệch giữa cái Django tin và cái trình duyệt thấy. Sửa = đụng `settings.py`.
- ~~**`/luat` không còn là route tĩnh.**~~ **XONG 2026-08-31.** `KhungHaiCot` gọi
  `GET /subs` ở phía server, nên `/luat` phải khai `force-dynamic` (nếu không `next build`
  ĐỎ) — mà `/luat` là **đường thoát** của `error.tsx`: Django chết ⇒ trang lỗi hiện ra,
  người dùng bấm "về Luật", và `/luat` chết cùng thứ nó thoát khỏi. Cách trả: `/luat` đổi
  sang `components/khung-hai-cot-tinh.tsx` — cùng lưới, cùng `Sidebar`, nhưng
  `cacSub={[]}` nên không hỏi API nào; bảng route của `next build` nay in `/luat` là `○`.
  Hợp đồng ghim ở `app/error.tsx` + `e2e/don-vi/trang-loi.spec.ts` (`ROUTE_TINH`, cộng
  một phép kiểm một-bậc-import canh chính khung tĩnh ấy). Chi tiết:
  `plans/2026-08-31-luat-tinh-tro-lai.md`.
  **9 trang còn lại vẫn `force-dynamic` — cố ý:** chúng không mang hợp đồng đường thoát,
  và rail có danh sách chuyên mục trong HTML đầu tiên là thứ đáng giữ ở đó.
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
