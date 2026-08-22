# gikky.net

Diễn đàn trading tiếng Việt. Điểm khác biệt duy nhất, và mọi thứ khác xoay quanh nó: **mạch**.

Một mạch không phải một bài đăng rồi thôi. Nó là **cuốn nhật ký sống** — tác giả nối thêm
**mốc** có dấu thời gian vào chính bài đó khi lệnh chạy tiếp: vào lệnh, gia tăng, dời dừng lỗ,
chốt. Ai đọc lại cũng thấy **lý do được ghi TRƯỚC khi biết kết quả**, nên không ai giặt được
hindsight thành tiên tri. Bình luận nào hoá ra đúng thì chủ mạch **trích vào sổ** — cuốn sổ
không-xoá-được, và đó là phần thưởng chủ lực cho người bình luận.

Thiết kế sản phẩm đầy đủ: [`PLAN.md`](PLAN.md). Kế hoạch + nhật ký từng phase: [`plans/`](plans/).

## Trạng thái

**Phase 1 đã xong — trang CHỈ ĐỌC.** Nói thẳng những gì CHƯA có, để không ai clone về rồi mới biết:

| Đã chạy | Chưa có |
|---|---|
| Feed "Mới" · "Đang diễn ra" · "Nhiều điểm nhất" (kèm khoảng ngày/tuần/tháng) | **Đăng nhập** — không có tài khoản, không có phiên |
| Trang mạch mặt CẶN: mốc 1 · dải gập · ngăn kéo theo mốc · khối trích | **Mọi thao tác ghi** — đăng, nối mốc, bình luận, vote |
| Khán đài: cây bình luận, 3 sort, khối "Câu đáng đọc", gập nhánh | Mặt BÃO (mạch đang chạy), follow, notification |
| Trang chuyên mục `/s/<sub>`, hồ sơ `/u/<user>`, `/luat` | Khu quản trị, kiểm duyệt |
| SEO: JSON-LD, sitemap, canonical | Ảnh (cần object storage) |

Cột vote có render nhưng **mũi tên bị khoá** kèm lý do — chỗ đứng của nó có thật, Phase 2 mới sống.

## Kiến trúc

```
apps/web       Next.js 15 App Router (public)      :3000
apps/admin     Next.js 15 App Router (quản trị)    :3001   — khung, Phase 4 mới làm
api            Django 5.2 + django-ninja           :8000
packages/api-client   TS client SINH RA từ OpenAPI  — không sửa tay
```

**Type đi một chiều: `Ninja → OpenAPI → TypeScript`.** Frontend không được tự khai interface
trùng với API; sửa Django xong thì chạy `pnpm codegen`. Có hàng rào chạy được cho luật này,
không chỉ là lời hứa — xem [`CLAUDE.md`](CLAUDE.md).

Không dùng Tailwind: CSS Modules + token toàn cục. Ngôn ngữ thị giác ở `PLAN.md` mục 9.

## Dựng từ clone sạch

Cần **Node 20+ · pnpm · Python 3.12 · PostgreSQL 17**.

```bash
pnpm install
pnpm setup:env          # chép api/.env.example -> api/.env, tự sinh SECRET_KEY ngẫu nhiên
```

Bỏ `pnpm setup:env` là mọi lệnh Python chết ngay dòng đầu — `settings.py` đọc `SECRET_KEY`
không có giá trị mặc định. Mở `api/.env` kiểm `DATABASE_URL` rồi tạo DB:

```sql
CREATE ROLE gikky LOGIN PASSWORD '<mật khẩu của bạn>';
CREATE DATABASE gikky_dev OWNER gikky;
```

Dựng venv (Python 3.12 thường không nằm trên PATH ở Windows — gọi thẳng đường dẫn của nó):

```bash
# Linux/macOS
cd api && python3.12 -m venv .venv && .venv/bin/python -m pip install -e ".[dev]" && cd ..
```

```powershell
# Windows — thay bằng đường dẫn python.exe 3.12 trên máy bạn
cd api
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..
```

Rồi, ở gốc repo:

```bash
pnpm api:migrate
node scripts/py.mjs seed_dev      # dữ liệu mẫu: 3 mạch, 24 bình luận
pnpm test
```

Mọi lệnh Python trong repo đi qua `scripts/py.mjs`, script này tự tìm `api/.venv`.

Máy mới chạy e2e lần đầu: `cd apps/web && npx playwright install chromium`.

## Cổng

| Cái gì | Cổng |
|---|---|
| `apps/web` | 3000 |
| `apps/admin` | 3001 |
| `api` | 8000 |
| PostgreSQL | 5432 |

Dev đi same-origin: `/api/:path*` được `rewrites` trong `next.config.ts` của cả hai app đẩy sang
`API_ORIGIN` (mặc định `http://localhost:8000`). Prod là việc của Caddy.

## Lệnh

Chạy ở gốc repo.

| Việc | Lệnh |
|---|---|
| Django dev server | `pnpm api:dev` |
| Web dev | `pnpm web:dev` |
| Admin dev | `pnpm admin:dev` |
| Migrate | `pnpm api:migrate` |
| Lệnh Django bất kỳ | `node scripts/py.mjs <lệnh>` |
| Test Python | `pnpm test` |
| Test e2e (tự dựng seed + 2 server) | `pnpm e2e` |
| Chỉ nhóm hàm thuần (chạy song song an toàn) | `pnpm e2e:don-vi` |
| Build 2 app | `pnpm build` |
| Lint (`--max-warnings=0`) | `pnpm lint` |
| Sinh lại TS client | `pnpm codegen` |
| Kiểm drift codegen | `pnpm codegen:check` |
| Đo Lighthouse SEO | `pnpm lighthouse` |
| Sao lưu PostgreSQL | `pnpm db:sao-luu` |
| Gửi digest tuần | `pnpm digest` |

`pnpm e2e` **chiếm cổng 3000 + 8000 và ghi vào `gikky_dev`** — đừng chạy song song với thứ khác
dùng chung hai thứ đó.

## API

Hai `NinjaAPI`: **`/api/v1/`** (công khai) và **`/api/admin/`** (khu quản trị, staff-only —
Phase 4). Bảng đầy đủ của cả hai ở `PLAN.md` mục 7. Lược đồ tương tác chỉ mở khi `DEBUG=True`
(`/api/v1/docs`, `/api/admin/docs`) — ngoài DEBUG thì tắt hẳn, vì nó phơi toàn bộ bề mặt API.

Django admin nằm ở **`/api/admin/django/`**, không phải `/api/admin/` — chỗ sau là router
quản trị Ninja. TS client của nó ở subpath `@gikky/api-client/admin`.

## Vận hành (Phase 6)

| Thứ | Ở đâu | Đã chạy thật chưa |
|---|---|---|
| Reverse proxy + rate limit tầng biên | [`deploy/Caddyfile`](deploy/Caddyfile) | **Chưa** — không có Caddy/tên miền trên máy dev. Cần bản Caddy dựng kèm plugin `caddy-ratelimit`. |
| Sao lưu / phục hồi Postgres | [`docs/sao-luu-phuc-hoi.md`](docs/sao-luu-phuc-hoi.md) | Dump + `pg_restore` **đã chạy**; scheduler và đẩy bản sao ra khỏi máy thì **chưa** |
| Email digest tuần (8:00 T7 giờ VN) | `pnpm digest`, `api/core/digest.py` | Nội dung + giao cho backend **đã chạy** (backend `filebased`); **SMTP chưa bao giờ chạy**, và danh sách người nhận còn rỗng cho tới Phase 3 |

## Cách làm việc trong repo này

Quy ước và những cái bẫy đã biết nằm ở [`CLAUDE.md`](CLAUDE.md) — đọc trước khi sửa code. Vài cái
đắt nhất:

- **Thêm test mới thì phải thử phá**: sửa ngược code cho hỏng, test phải ĐỎ, rồi khôi phục. Test
  không đỏ khi code hỏng là test trang trí, và nó nguy hiểm hơn không có test.
- **0 warning là mốc, không phải mong muốn.**
- `packages/api-client/src` là file sinh ra. Đừng sửa tay.
- Thứ tự khoá hàng: **`Mach` khoá sau cùng, không có ngoại lệ.**

`plans/` giữ nguyên nhật ký từng lượt — gồm cả những lỗi đã tìm ra và vì sao chúng lọt. Nó dài,
nhưng nó là chỗ trả lời câu "tại sao chỗ này viết kỳ vậy" nhanh hơn đọc code.
