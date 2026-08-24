# gikky-net — phần RIÊNG của repo

Quy trình làm việc chung nằm ở `D:\Projects\CLAUDE.md` — **không chép lại ở đây**.
Thiết kế sản phẩm + kiến trúc: `PLAN.md`. Plan con từng phase: `plans/`.

## Bảng port dev

| Cái gì | Port |
|---|---|
| `apps/web` (Next public) | 3000 |
| `apps/admin` (Next admin) | 3001 |
| `api` (Django runserver) | 8000 |
| PostgreSQL 17 **local** (đang dùng) | 5432 |
| postgres trong `docker-compose.dev.yml` (chưa chạy) | 55432 |
| minio trong compose (chưa chạy) | 9000 / 9001 |

Windows + Hyper-V thỉnh thoảng chiếm sẵn port sau reboot, báo EACCES khó hiểu. Xem dải bị loại trừ:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

## Môi trường

- **Python 3.12 KHÔNG có trên PATH.** Gõ `python` trần sẽ trúng stub Microsoft Store. Dựng từ
  clone sạch:
  ```powershell
  pnpm install
  pnpm setup:env          # chép api\.env.example -> api\.env (KHÔNG đè nếu đã có),
                          # tự sinh SECRET_KEY ngẫu nhiên cho file mới
  # rồi mở api\.env kiểm DATABASE_URL + DEBUG
  cd api
  & "C:\Users\Ng Xuan Mui\AppData\Local\Programs\Python\Python312\python.exe" -m venv .venv
  .\.venv\Scripts\python.exe -m pip install -e ".[dev]"
  cd ..
  pnpm api:migrate
  pnpm test
  ```
  **Bỏ bước `pnpm setup:env` là mọi lệnh Python chết ngay dòng đầu** (`settings.py` đọc
  `SECRET_KEY` không có default) — đó là lý do nó nằm ở đây chứ không nằm trong đầu người đã
  dựng repo một lần.
  Mọi lệnh Python trong repo dùng `api\.venv\Scripts\python.exe` (script Node `scripts/py.mjs` tự
  resolve đường dẫn này, cross-platform).
- **Docker: CHƯA CÀI trên máy dev** (user chốt 2026-08-21 là không cài). `docker-compose.dev.yml` đã
  viết sẵn nhưng **không chạy được ở đây** — đừng cố chạy, đừng tự cài Docker.
- **DB dev = PostgreSQL 17 local**, không phải container: role `gikky` / db `gikky_dev` /
  `127.0.0.1:5432`. Cấu hình đọc từ `api/.env` (`DATABASE_URL`), mẫu ở `api/.env.example`.
  Khi nào có Docker thì đổi `DATABASE_URL` sang port **55432** (xem đầu `docker-compose.dev.yml`).
- psql không có trên PATH: `C:\Program Files\PostgreSQL\17\bin\psql.exe`.

## Lệnh

Chạy ở **gốc repo** trừ khi ghi khác.

| Việc | Lệnh |
|---|---|
| Cài JS | `pnpm install` |
| Tạo `api/.env` từ mẫu | `pnpm setup:env` |
| Django dev server (8000) | `pnpm api:dev` |
| Migrate | `pnpm api:migrate` |
| Kiểm cấu hình + kết nối DB | `pnpm api:check` |
| Lệnh Django bất kỳ | `node scripts/py.mjs <lệnh> [args]` |
| Web dev (3000) | `pnpm web:dev` |
| Admin dev (3001) | `pnpm admin:dev` |
| Build cả 2 app Next | `pnpm build` |
| Lint cả 2 app (`--max-warnings=0`) | `pnpm lint` |
| Sinh lại TS client từ OpenAPI | `pnpm codegen` |
| Kiểm drift codegen (sinh lại + so hash) | `pnpm codegen:check` |
| Test Python | `pnpm test` (thêm cờ: `pnpm test -- -k health -x`) |
| Test e2e (Playwright) | `pnpm e2e` — **tự dựng seed, tự build + start Next 3000 và Django 8000** |
| Chỉ chạy nhóm test hàm thuần | `pnpm e2e:don-vi` — **an toàn để chạy song song**: đi qua `playwright.don-vi.config.ts`, không `webServer`, không `globalSetup`, không chạm DB, không chiếm cổng |
| Đo Lighthouse SEO | `pnpm lighthouse` (cần `next start` + Django đang chạy) |
| Seed 21 mạch cho ca "hồ sơ bị cắt" | `node scripts/py.mjs seed_e2e` |

⚠ **`--` nuốt mất cờ lọc của Playwright.** `pnpm e2e:don-vi -g "X3"` lọc đúng (8 bài);
`pnpm e2e:don-vi -- -g "X3"` chạy **cả 151 bài** và vẫn báo "passed" — một con số trông
như đã lọc mà thực ra là của cả bộ. Bẫy này có sức hút riêng vì bảng trên dạy đúng lối `--`
cho pytest (`pnpm test -- -k health -x`), nên phản xạ chép sang e2e là sai.

⚠ **`pnpm e2e --project=don-vi` thì KHÁC và KHÔNG an toàn** — cờ `--project` đi qua
`playwright.config.ts`, mà `globalSetup` + `webServer` ở đó là cấu hình TOÀN CỤC nên vẫn seed DB
và vẫn dựng 2 server. Đúng lệnh là `pnpm e2e:don-vi`.

**Máy mới phải chạy một lần:** `cd apps/web && npx playwright install chromium`.
**`pnpm e2e` chiếm cổng 3000 + 8000 và GHI vào `gikky_dev`** — đừng chạy song song với bất kỳ
thứ gì cũng dùng DB hay hai cổng đó (xem luật chia độc quyền tài nguyên ở `D:\Projects\CLAUDE.md`).

Django admin ở **`/api/admin/django/`** — không phải `/api/admin/`; xem docstring
`api/config/urls.py`.

## Ràng buộc phải nhớ khi sửa code

- **Type một chiều**: `Ninja → OpenAPI → TS`. `packages/api-client/src` là file SINH RA —
  **không sửa tay**, sửa xong Django thì chạy `pnpm codegen`. Frontend cấm tự khai interface trùng
  với API (PLAN 8.3).
- **Mọi endpoint Ninja phải khai `operation_id` tường minh.** Không khai thì tên hàm trong TS
  client trôi theo tên hàm Python / theo route ⇒ đổi tên một hàm Python thành breaking change
  của frontend, mà không có gì báo.
- **Thêm `NinjaAPI` mới = ĐỦ 3 VIỆC**, thiếu việc nào cũng có chuông riêng:
  1. mount vào `api/config/urls.py`;
  2. đăng ký vào `api/config/api_registry.py` (`scripts/codegen.mjs` đọc registry qua
     `export_openapi --list` rồi LẶP — **không phải sửa `codegen.mjs`**);
  3. thêm subpath vào `packages/api-client/package.json` trỏ `./src-<khoá>/index.ts`.
  Khoá `v1` giữ đường dẫn cũ (`openapi.json` + `src/`, đi qua subpath `"."`); khoá `k` khác ra
  `openapi.k.json` + `src-k/`.
  **Ba cái chuông:** `api/tests/test_api_registry.py` (mount mà chưa đăng ký) ·
  `pnpm codegen:check` (đã đăng ký nhưng không sinh ra client, và mọi tên **mồ côi** nằm lại
  trong `packages/api-client/`) · `scripts/rao-can-exports.mjs` (thiếu subpath).
  **`exports` là ALLOWLIST**: tập subpath phải BẰNG ĐÚNG tập registry sinh ra, mỗi cái trỏ
  đúng `index.ts` của khoá đó. Thừa một dòng cũng chặn — kể cả dòng trỏ vào file có thật, vì
  `"./client.gen": "./src/client.gen.ts"` là đúng cách `client` singleton sống lại.
  **CẤM subpath wildcard** (`"./*"`) trong `exports`. Nó là cách chữa nhanh nhất khi
  `ERR_PACKAGE_PATH_NOT_EXPORTED` đập vào mặt, và nó mở lại đúng đường
  `import { client } from "@gikky/api-client/client.gen"` — đi VÒNG qua `index.ts` nên hàng rào
  singleton dưới đây không thấy. `rao-can-exports.mjs` chặn wildcard vì lý do đó.
- **CẤM `client` singleton trong server component / route handler.** `@gikky/api-client` cố ý
  không export subpath `./client`. Lý do: `client` là object dùng chung CẢ TIẾN TRÌNH Node —
  ai gọi `client.setConfig({ headers: { cookie } })` rồi await là để request của user B đọc dữ
  liệu bằng session của user A (Phase 3, `GET /machs/{id}/me` phải forward cookie). Hỏng im
  lặng, trang vẫn trả 200. Cách đúng **và là cách duy nhất hiện có**: truyền `baseUrl` / `headers`
  **theo từng lời gọi** — `getHealth({ baseUrl, headers })`.
  **Đừng đi tìm `createClient`**: nó có trong `src/client/index.ts` nhưng package **không xuất
  ra** (bề mặt export chỉ có `getHealth` + type), và thêm subpath `"./client"` nay bị
  `rao-can-exports.mjs` chặn vì allowlist. Nếu Phase 3 thật sự cần client riêng cho từng request,
  đó là một **quyết định có chủ đích** phải ghi vào plan con: thêm MỘT entry cố định vào allowlist
  xuất đúng `createClient`/`createConfig` — tuyệt đối không xuất `client` singleton.
  Luật này có hàng rào chạy được, không chỉ là chữ: `scripts/rao-can-client.mjs` dùng type
  checker của TypeScript đọc bề mặt export THẬT của `src/index.ts` (đi theo cả `export *`),
  và `pnpm codegen` exit ≠ 0 nếu `client` lọt ra. `index.ts` là file SINH RA — chỉ một bản
  `@hey-api/openapi-ts` mới đổi ý là luật viết tay thành vô hiệu.
- **Frontend: CẤM gọi hàm API qua biến trung gian.** Viết thẳng
  `lietKeFeedMoi({ baseUrl, ... })`, đừng `const ham = x ? lietKeFeedMoi : lietKeFeedDangDienRa;
  ham(...)`. Hàng rào `e2e/don-vi/type-frontend.spec.ts` tìm lời gọi **theo tên hàm** để ép mọi
  lời gọi phải kèm `baseUrl` (chống `client` singleton); alias qua biến làm phân tích tĩnh mù, và
  lựa chọn còn lại là viết nửa cái type-checker bằng regex — thứ mong manh repo này đã diệt nhiều
  lần. Đây là ràng buộc phong cách do hàng rào áp lên code sản phẩm, ghi ra để không ai gỡ nhầm.
- **Thứ tự khoá hàng: `Comment` TRƯỚC, `Mach` SAU.** Đường reply khoá `Comment` cha
  (`cap_phat_path`) rồi mới xin `Mach` (`cap_nhat_dem_mach`). Đường nào làm ngược sinh deadlock —
  Postgres huỷ một bên ⇒ 500 ngẫu nhiên dưới tải, gần như không tái hiện được ở dev. Ngoại lệ duy
  nhất: bình luận gốc không có cha nên khoá thẳng `Mach` (chỉ chạm một hàng khoá).
  **Cạnh thứ hai, thêm ở Phase 1d: `Moc` → `Mach`.** `dat_vote` trên mốc 1 gọi
  `cap_nhat_dem_mach` để `diem_bai_goc` không trôi, nên nó khoá hàng `Moc` rồi mới xin
  hàng `Mach`. Cùng chiều với cạnh cũ (`Mach` luôn đứng CUỐI) nên không sinh chu trình —
  và luật đọc gọn lại thành **`Mach` khoá sau cùng, không có ngoại lệ**.
  **Cạnh thứ tư, thêm ở Phase 5: `Mach` → `MocAnh`.** Ảnh khoá SAU CẢ `Mach`, tức chuỗi đầy
  đủ là `Comment/Moc → Mach → MocAnh`. Bản đầu của Phase 5 dựng chu trình `MocAnh ↔ Mach`
  (`xoa_moc` đi một chiều, `dat_an_mach` đi chiều ngược) và **deadlock thật** — bài đo đua bắt
  được. Luật gọn lại lần nữa: **`Mach` rồi `MocAnh` đứng cuối, theo đúng thứ tự đó.**
  ⚠ Khoá NGẦM cũng tính: `INSERT INTO core_trich(moc_id, …)` lấy `FOR KEY SHARE` trên
  hàng `Moc` được tham chiếu. Phase 2 làm endpoint "trích vào sổ" mà khoá `Mach` trước
  rồi mới insert `Trich` là dựng đúng cạnh ngược `Mach` → `Moc` — cạnh người viết sẽ
  không thấy vì nó không có dòng `select_for_update` nào.
- **`cap_nhat_dem_mach` phải gọi TRONG một `atomic()`.** Nó tự `select_for_update` hàng `Mach`,
  nhưng khoá chỉ sống tới lúc transaction đóng. Ghi `deleted_at`/`hidden_at` ở transaction này rồi
  đếm lại ở transaction khác = `comment_count` sai vĩnh viễn, không log, không job đối soát.
- **`export_openapi` tự ghi file**, không dùng redirect `>` của PowerShell 5.1 (nó ghi UTF-16/BOM,
  làm codegen và bước kiểm drift vỡ). Output phải: UTF-8 không BOM · LF · `sort_keys` · newline cuối
  file — 2 lần chạy ra cùng byte.
- **`.gitattributes` ép `* text=auto eol=lf`**; `scripts/codegen.mjs` còn chuẩn hoá CRLF→LF lần nữa
  cho file sinh ra. Thiếu hai lớp này thì CI kiểm drift báo giả 100% trên Windows.
- **`pytest` chạy với `filterwarnings = ["error"]`** (khai trong `api/pyproject.toml`) — mọi warning
  là lỗi. Không thêm dòng `ignore` mà không ghi lý do vào plan con.
- **`.npmrc` có `public-hoist-pattern[]=*eslint*`**: `eslint-config-next` require() plugin từ thư mục
  app, node_modules cô lập của pnpm làm nó không thấy plugin. Xoá dòng này thì `next build` báo
  "Cannot find module 'eslint-plugin-react-hooks'".
- ⚠ **`pnpm build` PHÁ `next dev` của cùng app đang chạy** — hai tiến trình tranh nhau
  `.next/`, và triệu chứng là `Cannot find module './999.js'` rồi trang trả 500.
  ⇒ Build xong thì **khởi động lại mọi `next dev` đang mở**; gặp lỗi module số thì xoá
  hẳn `.next/` của app đó trước khi khởi động lại.
  - **Triệu chứng đánh lừa: trang "mất hết CSS"**, hoặc khu quản trị kẹt vĩnh viễn ở
    "Đang kiểm tra phiên…" — cả hai trông y hệt lỗi của đoạn code vừa viết, và cả hai
    KHÔNG phải. Đọc log dev server TRƯỚC khi đi sửa code.
  - `pnpm codegen` / `codegen:check` **từng có cùng bệnh** (xoá `packages/api-client/src/`
    rồi sinh lại; watcher đọc trúng lúc thư mục trống là hỏng vĩnh viễn). **Đã vá
    2026-08-23** — nay sinh vào thư mục tạm rồi chép đè, `src/` không bao giờ biến mất.
    Xem `scripts/codegen.mjs::sinhVaTraoDoi`; đừng đổi về `rmSync` cho gọn.
- **Tailwind CSS chỉ ở `apps/admin`** *(Phase 8, 2026-08-23)*. `apps/web` giữ CSS Modules +
  token, và **đừng chuyển nó sang Tailwind như một việc tiện tay**: hàng rào màu của PLAN 9.1
  (`apps/web/e2e/don-vi/mau-token.spec.ts`) ghim allowlist tới từng **selector CSS**, mà
  Tailwind xoá selector. Chuyển được, nhưng phải viết lại hàng rào ấy trước.
  - `postcss.config.mjs` **phải nằm trong `apps/admin/`**. Next đi ngược cây thư mục tìm config
    PostCSS; một bản ở gốc repo chui vào cả `apps/web` và đổi pipeline CSS của app không được
    chạm — `next build` vẫn xanh, CSS thì khác đi.
  - Token khai **một lần** trong khối `@theme` của `apps/admin/app/globals.css`, theme tối ghi
    đè trong `[data-theme="toi"]`. **Cấm màu ứng biến** (`bg-[#…]`, `style={{color:"#…"}}`) —
    `apps/web/e2e/don-vi/quan-tri-giao-dien.spec.ts` chặn, cùng file chặn cả 8 mã của PLAN 9.1
    và mọi mục menu không có trang thật.
  - Hook viết bằng tiếng Việt vẫn **phải mở đầu bằng `use`** (`useQuanTri`, `useDanhSach`):
    `react-hooks/rules-of-hooks` nhận diện hook theo tên, và `pnpm lint` chạy `--max-warnings=0`.
- Same-origin ở dev đi qua `rewrites` trong `next.config.ts` của **cả hai** app
  (`/api/:path*` → `API_ORIGIN`, mặc định `http://localhost:8000`). Prod là việc của Caddy (PLAN 8.2).

## Worktree của subagent có thể đứng ở commit CŨ — kiểm trước khi làm

Chốt 2026-08-23, sau khi một lượt phải huỷ. Worktree cấp cho subagent **không đảm bảo** được tạo
từ `main` hiện tại: một lượt Phase 7 nhận worktree đứng ở commit **đi sau 13 bước**.

Nguy hiểm không nằm ở chỗ thiếu code — nó nằm ở chỗ **bài đo vẫn xanh**. Bài đo kiểu *"liệt kê MỌI
đường ghi rồi ép mỗi đường phải làm X"* chạy trên cây cũ sẽ chỉ liệt kê những đường ghi **đã tồn
tại lúc đó**: xanh thật, và gộp lên `main` thì mười đường ghi mới không ai kiểm mà bảng vẫn báo đủ.
Đúng loài *proof đo RỖNG*.

⇒ **Bước đầu tiên của mọi subagent chạy trong worktree:**
1. `git log --oneline -1`, so với `main`; đi sau thì `git merge --ff-only main`.
2. **Kiểm bằng NỘI DUNG, không chỉ bằng hash** — nêu đích danh vài file/hàm mà việc này phụ thuộc,
   cộng một con số nền (`pytest --collect-only`). Hash trông đúng mà nội dung thiếu thì vẫn dừng.
3. Thiếu thì **DỪNG và báo**, đừng "làm tới đâu hay tới đó".

Và khi giao việc: **nói rõ nền là bao nhiêu test**, để agent tự phát hiện mình đứng sai cây.
