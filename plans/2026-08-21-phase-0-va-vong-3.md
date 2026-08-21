# Plan con — Phase 0, đợt vá vòng 3 (đợt cuối)

> Nguồn: báo cáo chặng 4 vòng 2 (`phan-bien`), đã được phiên chính tự kiểm. Ngày 2026-08-21.
> **Đây là đợt cuối của Phase 0.** Xong đợt này, kiểm sạch thì Phase 0 chốt.

## 0. Phiên chính đã tự làm (KHÔNG giao — ca ngoại lệ 3 của `CLAUDE.md`: cập nhật tài liệu)

**Cảnh báo: phần này do phiên chính tự sửa, KHÔNG ai kiểm độc lập.**

| Việc | File |
|---|---|
| `manage.py export_openapi > openapi.json` → `--output packages/api-client/openapi.json`, kèm lý do cấm redirect | `PLAN.md` mục 7 |
| Ghi rõ phần `docker compose up` của nghiệm thu Phase 0 là **HOÃN**, và lần đầu có Docker phải `docker pull` xác minh tag minio/mc | `PLAN.md` mục 10 Phase 0 |
| A15 `postgres:16` → `postgres:17` (theo Q1); ghi lý do vào nhật ký chặng | `plans/2026-08-21-phase-0-skeleton.md` |
| A14 đổi cách đo: `curl localhost:3000/api/v1/health` thay vì "trang in ok" | `plans/2026-08-21-phase-0-skeleton.md` |

Lý do A14 phải đổi: sau đợt vá vòng 2, `apps/web/app/page.tsx:16` gọi **thẳng** `API_ORIGIN`
(cổng 8000), còn phần same-origin nằm trong `useEffect` của client component nên **không có
trong HTML SSR**. Xoá sạch khối `rewrites` thì phép đo cũ **vẫn in "ok"** ⇒ tiêu chí thành rỗng.
Code không sai (đúng PLAN 8.4) — **tiêu chí sai**.

## 1. Việc của đợt này (agent thực thi)

### C1 — `codegen.mjs` phải duyệt registry, không hardcode `v1`
**Bằng chứng.** `scripts/codegen.mjs:50` gọi `export_openapi --output <schemaPath>` đúng một lần,
không truyền `--api`; `export_openapi.py:31-32` mặc định `--api="v1"`.
**Hậu quả.** Phase 4 thêm `api_admin`: test registry bắt đỏ → lập trình viên thêm dòng vào
`NINJA_APIS` → **test xanh trở lại** → tưởng xong. `pnpm codegen` vẫn exit 0, client vẫn thiếu
sạch nhóm admin. Chuông hiện chỉ nối 2/3 bước, và bước thứ ba **được test xanh che cho** —
nguy hiểm hơn không có chuông.
**Làm.** Thêm `export_openapi --list` in JSON danh sách khoá của `NINJA_APIS`; `codegen.mjs` đọc
danh sách rồi lặp: mỗi khoá một `openapi.<khoá>.json` + một lượt openapi-ts. Giữ khoá `v1` sinh ra
đúng đường dẫn/tên file như hiện tại (**không được đổi output của `v1`** — A9/A10 phụ thuộc).
**Test bắt buộc:** thêm tạm một khoá thứ hai vào `NINJA_APIS` → `pnpm codegen` phải sinh thêm
client cho nó (hoặc ít nhất phải THẤT BẠI ồn ào), **không được exit 0 im lặng**. Dán bằng chứng.

### C2 — `setup-env.mjs` phải sinh `SECRET_KEY` ngẫu nhiên
**Bằng chứng.** `api/.env.example:6` `SECRET_KEY=doi-chuoi-nay-o-moi-may-va-o-prod` — chuỗi cố
định **nằm trong repo**; `scripts/setup-env.mjs:29-31` copy nguyên xi.
**Hậu quả.** Từ Phase 2 (allauth, session cookie ký bằng `SECRET_KEY`), máy nào chạy đúng lệnh
repo dạy mà quên sửa một dòng ⇒ cookie phiên ký bằng khoá công khai ⇒ giả mạo phiên được.
Không có gì đỏ, không có gì log. Cảnh báo bằng chữ đã có ở `.env.example:5` — **thiếu là cơ chế**.
**Làm.** Khi TẠO file mới, thay dòng `SECRET_KEY=` bằng khoá ngẫu nhiên
(`crypto.randomBytes(50).toString("base64url")`). Không đè file đã có (giữ nguyên hành vi B9).
Thêm `DEBUG` vào dòng nhắc cuối. **Test/kiểm:** chạy 2 lần trên 2 thư mục tạm → 2 khoá KHÁC nhau;
chạy lần 2 khi đã có `.env` → không đè.

### C3 — hàng rào cấm `client` singleton đang đứng trên file SINH RA
**Bằng chứng.** Hàng rào N3 gồm `packages/api-client/package.json` (bền, viết tay) **và**
`src/index.ts` không re-export `client`. Nhưng `codegen.mjs:54` `rmSync(srcDir)` xoá + sinh lại
`index.ts` mỗi lần codegen.
**Hậu quả.** `@hey-api/openapi-ts` bản sau đổi cách sinh `index.ts` (thêm
`export * from './client.gen'`) ⇒ `import { client }` sống lại ⇒ luật trong `CLAUDE.md` thành văn
xuôi. Phase 3 forward cookie qua singleton = request user B đọc dữ liệu bằng session user A,
trang vẫn 200. Repo **không có test JS nào** canh.
**Làm.** Cuối `codegen.mjs`: đọc `src/index.ts`, nếu có export tên `client` → `console.error` +
`process.exit(1)`. **Thử phá:** tự thêm dòng `export { client } from "./client.gen";` vào
`index.ts` rồi chạy `pnpm codegen` → phải exit ≠ 0. Dán output.

### C4 — không có gì canh `sort_keys=True`
**Bằng chứng.** Phiên chính tự phá: đổi `sort_keys=True` → `False` trong `export_openapi.py:48`
→ `pytest api/tests/test_export_openapi.py -q` → **`4 passed`**.
**Hậu quả.** Plan 3.2 chốt `sort_keys=True` là điều kiện ổn định byte, mà bỏ nó đi không có gì
đỏ. Bộ test hiện bắt được mutant kiểu `set` (đã chứng minh) nhưng **không** canh chính cái khoá
chốt đó.
**Làm.** Thêm test đọc file schema ghi ra và khẳng định khoá đã sắp xếp (đệ quy hoặc ít nhất ở
tầng gốc + `paths` + `components`). **Phải ĐỎ khi bỏ `sort_keys=True`** — dán output đỏ.

### C5 — comment trong `urls.py` khẳng định SAI về resolver Django
`api/config/urls.py:24` viết đại ý *"phải đứng TRƯỚC mọi mount `/api/admin/` khác thì nhánh con
mới khớp trước"*. Sai: `URLResolver.resolve` bắt `Resolver404` từ resolver con rồi **đi tiếp**
pattern kế, nên đảo thứ tự vẫn chạy đúng. Thứ thật sự giữ cho cơ chế đúng là **Ninja không có
catch-all, còn `admin.site.urls` thì có**. Sửa comment cho đúng lý do thật — comment sai dạy sai
người làm Phase 4.

### C6 — ghi chú nội bộ rò vào hợp đồng API công khai
`api/api/v1.py:59-60` — docstring của `health` nói về `django-ninja deprecate tuple` và
`filterwarnings = ["error"]`. Ninja đưa docstring vào `description` của OpenAPI ⇒ nó nằm trong
`packages/api-client/openapi.json` và JSDoc của `sdk.gen.ts`, và được `/api/v1/openapi.json` phục
vụ khi `DEBUG=True`. Chuyển thành comment `#` ngoài docstring. Nhớ chạy lại `pnpm codegen`.

## 2. Tiêu chí nghiệm thu

| # | Tiêu chí | Cách đo |
|---|---|---|
| C1a | `export_openapi --list` in JSON khoá registry | chạy lệnh |
| C1b | `codegen.mjs` lặp theo registry, output của `v1` **không đổi đường dẫn/nội dung** | `pnpm codegen` → `codegen:check` khớp |
| C1c | Thêm khoá thứ 2 vào registry → codegen **không im lặng exit 0** | thử phá, dán output |
| C2a | 2 lần `setup:env` trên 2 thư mục tạm → 2 `SECRET_KEY` khác nhau | chạy, so chuỗi |
| C2b | Đã có `.env` → không đè | chạy lần 2 |
| C2c | B9 không hồi quy: clone sạch → `setup:env` → `pnpm test` xanh | chạy |
| C3 | Thêm `export { client }` vào `index.ts` → `pnpm codegen` exit ≠ 0 | thử phá, dán output |
| C4 | Bỏ `sort_keys=True` → test ĐỎ | thử phá, dán output |
| C5 | Comment `urls.py` nêu đúng lý do (catch-all), không nói sai về thứ tự | đọc |
| C6 | `openapi.json` và `sdk.gen.ts` **không còn** chữ `filterwarnings` / `deprecate` | `grep` |
| C7 | **Không hồi quy**: A1–A17 (bản đã sửa A14/A15) + B1–B16 | chạy lại |
| C8 | Vẫn 0 commit, vẫn 0 warning | `git rev-list --count --all` = 0; `pnpm test`; `pnpm lint` |

## 3. Ngoài phạm vi
Bộ test JS/Playwright (Phase 2 mới có — nên hai `data-testid` hiện chưa ai đọc, chấp nhận);
Docker; CI; mọi thứ của Phase 1+.
