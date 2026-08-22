# Plan con — Phase 0: Skeleton

> Nguồn: `PLAN.md` mục 8.1, 8.3, 8.6, 10 (Phase 0). Quy trình: `D:\Projects\CLAUDE.md` (5 chặng).
> Ngày: 2026-08-21. Chặng 1 do phiên chính viết.

## 0. Bối cảnh máy (đã kiểm THẬT, không phỏng đoán)

| Thứ | Kết quả kiểm | Hệ quả |
|---|---|---|
| Node / pnpm | v24.19.0 / 10.34.5 | dùng được |
| Python 3.12 | `C:\Users\Ng Xuan Mui\AppData\Local\Programs\Python\Python312\python.exe` → 3.12.10 | tạo venv bằng ĐƯỜNG DẪN TUYỆT ĐỐI (8.6) |
| git | `C:\Program Files\Git\cmd\git.exe`, repo CHƯA init | `git init` là việc của phase này |
| **Docker Desktop** | **CHƯA CÀI** | plan 8.6: "chưa cài thì báo user, đừng tự cài" → **CẤM tự cài** |
| PostgreSQL local | **17 đang chạy, chiếm port 5432**, auth `scram-sha-256` | dev dùng PG17 local (user chốt 2026-08-21) |
| Port 3000/3001/8000/9000/9001 | trống | đúng sơ đồ 8.6 |
| Dải port Windows loại trừ | 49702-49901, 50000-50261, 64276-64375, 65247-65346 | không đụng port ta dùng |
| `docs/mockup-tham-khao.html` | ĐÃ CÓ (41.467 byte, 893 dòng) | không phải hỏi user |

**Quyết định của user (2026-08-21):** không cài Docker. Dev DB = **PostgreSQL 17 local**.
`docker-compose.dev.yml` vẫn PHẢI viết đúng plan (là tài sản của repo, dùng khi có Docker),
nhưng **không chạy được ở phase này** → tiêu chí "compose up" chuyển thành HOÃN, ghi rõ.

**DB dev đã chốt:** role `gikky` / password ghi trong `api/.env` (KHÔNG commit — chuỗi thật
từng nằm ở dòng này, đã gỡ 2026-08-22 khi repo lên công khai) / database `gikky_dev` /
`127.0.0.1:5432`. User tự chạy lệnh tạo. Agent **không** cần và **không được** hỏi mật khẩu
superuser `postgres`. Nếu kết nối `gikky_dev` thất bại → DỪNG, báo phiên chính, **không** tự đổi
sang SQLite, **không** tự tạo DB bằng đường vòng.

---

## 1. Mục tiêu phase

Bộ khung chạy được của monorepo `gikky-net`: Django boots + healthcheck chạm DB thật, 2 app Next
boots, đường ống type một chiều `Ninja → OpenAPI → TS` chạy và **lặp lại không đổi byte**,
pytest + eslint 0 lỗi 0 warning. **Chưa có model domain, chưa có UI sản phẩm** — đó là Phase 1.

---

## 2. Giá trị đã chốt (đừng để agent tự chế)

| Hạng mục | Giá trị chốt |
|---|---|
| Ports dev | web **3000** · admin **3001** · api **8000** · PG local **5432** |
| Ports trong compose (chưa chạy) | postgres **55432**:5432 (tránh đụng PG17), minio **9000/9001** |
| Python | venv `api/.venv` tạo bằng đường dẫn tuyệt đối Python 3.12.10 |
| Django | `Django>=5.1,<6` |
| API framework | `django-ninja>=1.3` |
| DB driver | `psycopg[binary]>=3.2` |
| Đọc env | `django-environ>=0.11`, file `api/.env` (gitignore) + `api/.env.example` (commit) |
| Test | `pytest>=8`, `pytest-django>=4.9` |
| Next | Next 15.x App Router, TypeScript, ESLint, **KHÔNG Tailwind**, **KHÔNG thư mục `src/`** |
| Vì sao không Tailwind | mockup 9.1 là CSS thuần + custom properties, ngôn ngữ "mực và dấu" rất riêng; Phase 1 sẽ port token sang CSS global + CSS Modules. Chốt ở đây để agent không tự chọn. |
| Codegen | `@hey-api/openapi-ts` (bản mới nhất lúc cài), output `packages/api-client/src` |
| Schema file | `packages/api-client/openapi.json` (nằm trong repo — để kiểm drift) |
| TZ | `TIME_ZONE = "Asia/Ho_Chi_Minh"`, `USE_TZ = True` |
| Healthcheck | `GET /api/v1/health` → 200 `{"status":"ok","db":"ok"}` (db = `SELECT 1` thật) |

---

## 3. Hạng mục việc

### 3.1 Nền repo
- `git init` (branch mặc định `main`). **KHÔNG commit** (luật 3: chỉ commit khi user bảo).
- `.gitattributes` **dòng đầu** `* text=auto eol=lf` — 8.3 nói rõ: thiếu nó thì bước kiểm drift
  CRLF-Windows vs LF-CI báo giả 100%.
- `.gitignore`: `node_modules/`, `.venv/`, `__pycache__/`, `*.pyc`, `.next/`, `.env`,
  `.env.local`, `.pytest_cache/`, `dist/`, `*.log`.
- Cây thư mục đúng 8.1: `api/`, `apps/web/`, `apps/admin/`, `packages/api-client/`, `docs/`
  (đã có), `plans/` (đã có), `docker-compose.dev.yml`, `CLAUDE.md`.
- `pnpm-workspace.yaml`: `apps/*`, `packages/*` (thư mục `api/` là Python, KHÔNG vào workspace).

### 3.2 Django (`api/`)
- venv: `"C:\Users\Ng Xuan Mui\AppData\Local\Programs\Python\Python312\python.exe" -m venv .venv`
  (gõ `python` trần trúng stub Microsoft Store — 8.6).
- `pyproject.toml`: `[project]` deps + `[project.optional-dependencies] dev`
  (pytest, pytest-django); cài `pip install -e ".[dev]"`.
- Layout: `config/` (settings, urls, wsgi/asgi), `core/` (app hạ tầng: management command, chỗ
  cho models Phase 1), `api/` (router Ninja v1).
- Settings: đọc `.env` qua django-environ; `DEBUG` từ env; `TIME_ZONE`/`USE_TZ` như bảng mục 2;
  `DATABASES` từ `DATABASE_URL`. **Chưa cấu hình allauth / CSRF cross-domain** — đó là 8.2 /
  Phase 2, đừng làm trước.
- Router Ninja mount tại `/api/v1`, có `GET /health` như bảng mục 2.
- `manage.py export_openapi --output <path>`: management command **tự ghi file**, KHÔNG dùng
  redirect `>` của shell. Lý do: PowerShell 5.1 redirect ra UTF-16/BOM → openapi-ts và bước kiểm
  drift vỡ. Yêu cầu output: UTF-8 không BOM, newline LF, `sort_keys=True`, `ensure_ascii=False`,
  `indent=2`, có newline cuối file (ổn định byte giữa 2 lần chạy).

### 3.3 Đường ống codegen
- `scripts/py.mjs`: resolve python của venv (`api/.venv/Scripts/python.exe` trên win32,
  `api/.venv/bin/python` chỗ khác) rồi spawn `manage.py` với args — **không cú pháp bash trong
  package.json** (8.3).
- `scripts/codegen.mjs` (Node, cross-platform): (1) gọi export_openapi ra
  `packages/api-client/openapi.json`; (2) chạy openapi-ts sinh `packages/api-client/src`;
  (3) **chuẩn hoá CRLF→LF** mọi file vừa ghi. Chạy bằng `pnpm codegen` ở root.
- `packages/api-client/package.json`: name `@gikky/api-client`, `exports` trỏ vào `src`.
  File sinh ra mang header "KHÔNG SỬA TAY" (8.1).

### 3.4 Hai app Next
- `apps/web` (3000) và `apps/admin` (3001), preset ở bảng mục 2, mỗi app một trang tối giản
  (`app/page.tsx`) hiển thị kết quả gọi `/api/v1/health` **qua rewrites** để chứng minh đường
  same-origin sống.
- `next.config`: rewrites `/api/:path*` → `http://localhost:8000/api/:path*` (8.2, phần dev).
  Origin API lấy từ env `API_ORIGIN`, mặc định `http://localhost:8000`.
- ESLint chạy `--max-warnings=0`.

### 3.5 docker-compose.dev.yml (viết, KHÔNG chạy)
- `postgres:16` (port **55432**:5432, volume, POSTGRES_DB/USER/PASSWORD khớp `.env.example`),
  `minio/minio` (9000/9001) + service init đặt **CORS bucket** (AllowedOrigins localhost:3000,
  AllowedMethods PUT — 8.5).
- Đầu file ghi comment: "máy dev hiện tại không có Docker; dev dùng PG17 local port 5432. File
  này dùng khi có Docker — khi đó đổi `DATABASE_URL` sang port 55432."

### 3.6 Test + gate 0 warning
- pytest cấu hình trong `api/pyproject.toml`: `DJANGO_SETTINGS_MODULE`, và
  **`filterwarnings = ["error"]`** — đây là cách ĐO được "0 warning" (luật 2), không phải đọc
  bằng mắt. Nếu buộc phải ignore warning của thư viện bên thứ ba: được, nhưng **liệt kê từng
  dòng ignore + lý do** trong báo cáo; ignore mù cả `DeprecationWarning` là KHÔNG ĐẠT.
- Test tối thiểu (đều phải THỬ PHÁ — luật 4):
  1. `GET /api/v1/health` → 200, body `{"status":"ok","db":"ok"}`, có chạm DB thật.
  2. Settings: `TIME_ZONE == "Asia/Ho_Chi_Minh"` và `USE_TZ is True`.
  3. `export_openapi` chạy 2 lần ra **cùng byte** (chống schema không ổn định).
- **THỬ PHÁ bắt buộc:** với mỗi test, sửa ngược code cho hỏng → chạy → test phải ĐỎ → khôi phục.
  Báo cáo phải dán output ĐỎ đó, không chỉ nói "đã thử".

### 3.7 `CLAUDE.md` của repo
Chỉ phần RIÊNG (không chép lại quy trình chung): lệnh dev/build/test/codegen; đường dẫn Python
tuyệt đối; bảng port; ghi chú DB local PG17 vs compose; lệnh chẩn đoán port Windows
`netsh interface ipv4 show excludedportrange protocol=tcp`; ghi chú "Docker chưa cài".

---

## 4. Tiêu chí nghiệm thu (ĐO ĐƯỢC — chấm ĐẠT/KHÔNG ĐẠT từng cái, tự chạy lại lệnh)

| # | Tiêu chí | Cách đo |
|---|---|---|
| A1 | Cây thư mục khớp 8.1 | liệt kê từng đường dẫn ở 3.1 |
| A2 | `.gitattributes` có `* text=auto eol=lf`; `.git` tồn tại; **chưa có commit nào** | đọc file; `git rev-list --count --all` = 0 |
| A3 | venv Python 3.12.10 tồn tại | `api/.venv/Scripts/python.exe --version` |
| A4 | Django kết nối DB thật | `manage.py check --database default` → 0 issue |
| A5 | `migrate` chạy sạch trên `gikky_dev` | `manage.py migrate` → không lỗi |
| A6 | Healthcheck sống | dựng runserver 8000 → `curl -s localhost:8000/api/v1/health` = `{"status":"ok","db":"ok"}`, HTTP 200 |
| A7 | pytest **0 fail, 0 warning** | `pytest -q` → `N passed`, KHÔNG có dòng warnings summary |
| A8 | Đủ 3 test ở 3.6 và **đã THỬ PHÁ** | đọc code test; đối chiếu output ĐỎ trong báo cáo chặng 2 |
| A9 | `pnpm codegen` sinh client từ **schema thật** | `packages/api-client/openapi.json` chứa path `/api/v1/health`; `src` có hàm gọi health |
| A10 | Codegen **idempotent** | băm sha256 toàn bộ `packages/api-client` → chạy `pnpm codegen` lần 2 → băm lại → **trùng khít**. (Không dùng `git diff` vì repo chưa có commit — A2.) |
| A11 | File sinh ra toàn LF | không có byte `\r` trong `packages/api-client/**` |
| A12 | `apps/web` build + lint sạch | `next build` và eslint `--max-warnings=0` → 0 error 0 warning |
| A13 | `apps/admin` build + lint sạch | như A12 |
| A14 | 3 tiến trình dev chạy SONG SONG không lỗi | runserver 8000 + web 3000 + admin 3001 cùng lúc; **đo rewrites bằng `curl -s -w "%{http_code}" http://localhost:3000/api/v1/health` và `:3001/...` → 200 + `{"status":"ok","db":"ok"}`** |
| A15 | `docker-compose.dev.yml` đúng nội dung 3.5 | đọc file: **postgres:17** port 55432, minio 9000/9001, cấu hình CORS bucket, comment giải thích |
| A16 | `CLAUDE.md` repo đủ mục 3.7, KHÔNG chép lại quy trình chung | đọc file |
| A17 | `docs/mockup-tham-khao.html` còn nguyên | kích thước = 41467 byte |

**HOÃN, ghi rõ là CHƯA ĐO (không được chấm ĐẠT):**
- `docker compose -f docker-compose.dev.yml up -d` — máy chưa có Docker (user chốt không cài).
- CI kiểm drift codegen (8.3) — repo chưa có remote/commit; A10 là bản thay thế đo được tại chỗ.

---

## 5. Ngoài phạm vi phase này (đừng lấn — PLAN mục 10)

Model domain (mục 6), allauth / CSRF cross-domain (8.2), middleware ISR + cache (8.4),
media (8.5), UI sản phẩm (mục 9), seed data, admin app thật. Phase 0 **chỉ** là khung.

## 6. Rủi ro đã biết, xử lý sẵn

1. **PowerShell 5.1 redirect `>` ra UTF-16** → chặn bằng cách cho command tự ghi file (3.2).
2. **CRLF Windows** → `.gitattributes` + bước chuẩn hoá trong `codegen.mjs` (3.1, 3.3).
3. **Port 5432 đã bị PG17 giữ** → compose map 55432 (3.5); `.env` dev trỏ 5432.
4. **`pytest -W error` vỡ vì deprecation của thư viện** → được ignore có chọn lọc, phải liệt kê.
5. **3 dev server cùng chạy** → A14 là việc của **nghiem-thu**; `phan-bien` KHÔNG được dựng
   server / build (tranh port 3000/3001/8000 và DB `gikky_dev`) — phân vai theo
   `D:\Projects\CLAUDE.md`.

---

## 7. Nhật ký chặng (phiên chính cập nhật)

- [x] Chặng 1 — plan (phiên chính, 2026-08-21)
- [x] Chặng 2 — thực thi (`opus-dev`): dựng xong, tự khai 8 chỗ lệch khỏi plan con
- [x] Chặng 3 — nghiệm thu (`nghiem-thu`): **ĐẠT 17/17**, tự phá lại 3 lượt, cổng đã trả sạch
- [x] Chặng 4 — phản biện (`phan-bien`): tìm ra **3 lỗi NẶNG + 7 trung bình** mà 17 tiêu chí
      trên KHÔNG đo tới — N1 `AUTH_USER_MODEL`, N2 `/api/admin/` catch-all, T1 test health đo RỖNG
- [ ] Chặng 5 — chốt việc (phiên chính): đã tự tái hiện cả 3 lỗi nặng ⇒ **mở đợt vá**
      `plans/2026-08-21-phase-0-va-sau-phan-bien.md`. Phase 0 **chưa chốt** cho tới khi đợt vá
      xong và A1–A17 chạy lại không hồi quy.

> **Hai tiêu chí đã bị đợt vá sửa (phiên chính sửa 2026-08-21, viện dẫn Q1 và phản biện vòng 2):**
> - **A15** `postgres:16` → **`postgres:17`** — theo Q1 của plan vá (user chốt). Không sửa dòng này
>   thì B15 ("A1–A17 vẫn ĐẠT") tự mâu thuẫn với chính compose, buộc người chấm phải tự diễn giải
>   lại tiêu chí — đúng cái cửa mà 5 chặng dựng lên để bịt.
> - **A14** — mệnh đề cũ "`localhost:3000` trả health ok ⇒ đi qua rewrites" **đã sai sau đợt vá**:
>   server component nay gọi thẳng `API_ORIGIN` (cổng 8000) theo PLAN 8.4, còn phần same-origin
>   nằm trong `useEffect` client nên không có trong HTML. Xoá sạch khối `rewrites` thì lệnh cũ
>   vẫn in "ok". Đổi sang đo thẳng `curl localhost:3000/api/v1/health` — đó mới là probe của
>   chính cái rewrite.
>
> Bài học ghi lại: A1–A17 đo "có làm đúng plan không" và cả 17 đều ĐẠT thật. Cái chúng không đo
> được là "quyết định nào vừa bị đóng vĩnh viễn" (N1) và "test có thật sự đo cái nó tự nhận
> không" (T1). Tiêu chí nghiệm thu của phase sau nên có ít nhất một mục dạng *"liệt kê những
> quyết định không đảo ngược được mà phase này vừa chốt"*.
