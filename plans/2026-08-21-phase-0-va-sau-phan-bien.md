# Plan con — Phase 0, đợt vá sau phản biện

> Nguồn: báo cáo chặng 4 (`phan-bien`) của `plans/2026-08-21-phase-0-skeleton.md`, đã được phiên
> chính **tự kiểm lại từng cáo buộc nặng** (không tin báo cáo). Ngày 2026-08-21.
> Quy trình: `D:\Projects\CLAUDE.md` (5 chặng).

## 0. Vì sao có đợt này

Chặng 3 chấm **ĐẠT 17/17**. Chặng 4 vẫn tìm ra 3 lỗi NẶNG mà 17 tiêu chí kia không đo tới —
đúng lý do `CLAUDE.md` tách nghiệm thu khỏi phản biện. Phiên chính đã tự tái hiện:

| Mã | Cáo buộc | Phiên chính kiểm bằng gì | Kết |
|---|---|---|---|
| N1 | `AUTH_USER_MODEL` chưa đặt mà `migrate` đã chạy | `psql`: `auth_user` tồn tại, `select count(*) from django_migrations where app='auth'` = **12**; `grep AUTH_USER_MODEL settings.py` = rỗng; `api/core/` không có `models.py` | **ĐÚNG** |
| N2 | `/api/admin/` bị Django admin chiếm catch-all | `urls.py:13` `path("api/admin/", admin.site.urls)`; `django/contrib/admin/sites.py` `final_catch_all_view=True` + `re_path(r"(?P<url>.*)$")`; PLAN.md:383 đặt router Ninja admin **cùng prefix** | **ĐÚNG** |
| T1 | test health là phép đo RỖNG | Áp mutant (`with connection.cursor(): pass` + trả hằng số `db="ok"`) → `pytest api/tests/test_health.py -q` → **`2 passed`** | **ĐÚNG** |
| T2 | `/api/v1/docs` public prod | `api/api/v1.py:9` `NinjaAPI(title=..., version=...)` — không truyền `docs_url`/`openapi_url` | **ĐÚNG** |
| T6 | `catch` nuốt lỗi, in sai sự thật | `apps/web/app/page.tsx:13` `if (!data) return "không đọc được body"` — `getHealth` có `ThrowOnError=false` nên 500 rơi vào nhánh này | **ĐÚNG** |
| T4 | clone sạch không chạy được | `CLAUDE.md` khối setup (dòng 25-32) không có bước copy `.env`; `settings.py:19` `env("SECRET_KEY")` không default | **ĐÚNG** |

Cây làm việc tại thời điểm viết plan này: **sạch** (3 file bị thử phá đã khớp md5 gốc,
`pytest` → `6 passed`), 64 file untracked, **0 commit** — đúng luật 3.

## 1. Quyết định của phiên chính (agent thực thi làm theo, đừng thiết kế lại)

### Q1 — PostgreSQL 17, không phải 16 *(user chốt 2026-08-21)*
DB dev thật là **17.10**; PLAN viết 16 từ trước khi biết. Sửa `docker-compose.dev.yml` thành
`postgres:17` **và sửa luôn `PLAN.md`** (mục 6 dòng đầu, và chỗ nào khác nhắc "PostgreSQL 16")
thành 17. Một con số duy nhất từ dev tới prod.

### Q2 — Django admin xuống `/api/admin/django/`, KHÔNG phải `/api/dj-admin/`
`phan-bien` đề xuất `/api/dj-admin/`. **Bác** — nó buộc PLAN 8.2 phải thêm luật Caddy thứ hai,
và quên một luật là lộ form đăng nhập Django admin ra internet. Cách chốt:

```python
urlpatterns = [
    path("api/admin/django/", admin.site.urls),   # LỒNG BÊN TRONG, phải đứng TRƯỚC
    path("api/v1/", api_v1.urls),
    # Phase 4: path("api/admin/", api_admin.urls)  ← đặt SAU dòng django/ ở trên
]
```
Vì `api/admin/django/` khớp trước, catch-all của Django admin chỉ nuốt nhánh con của nó; mọi
đường `/api/admin/*` còn lại để dành cho Ninja ở Phase 4. **Luật Caddy `gikky.net/api/admin/*`
→ 403 ở PLAN 8.2 phủ được cả hai, không phải sửa gì.** Ghi chú này phải thêm vào PLAN 8.2.

### Q3 — Healthcheck DB chết thì trả **503**, không phải 200
Hiện trạng tệ nhất: có nhánh `db="fail"` mà không test nào chạm, và đời thực không bao giờ chạy
tới (DB chết → `OperationalError` → 500). Chốt: `response={200: HealthOut, 503: HealthOut}`;
truy vấn lỗi HOẶC ra kết quả sai → **503 + `db="fail"`**. Monitoring bắt được bằng status code.

### Q4 — Đợt vá này chỉ vá, KHÔNG lấn Phase 1
`core.User` chỉ là `class User(AbstractUser): pass`. **Không** thêm `display_name/bio/banned_until/
ban_permanent/ban_reason` — đó là Phase 1 (PLAN mục 6), và thêm trường vào custom user model đã
tồn tại chỉ là một migration bình thường. Cái không đảo ngược được là `AUTH_USER_MODEL`, chỉ vá
đúng cái đó.

---

## 2. Hạng mục việc

### 2.1 N1 — custom user model (NẶNG, làm trước tiên)
- `api/core/models.py`: `class User(AbstractUser): pass` + docstring trỏ PLAN mục 6 (Phase 1 sẽ
  thêm trường).
- `settings.py`: `AUTH_USER_MODEL = "core.User"`. Xác nhận `core` đã có trong `INSTALLED_APPS`.
- `api/core/admin.py`: đăng ký `User` với `UserAdmin` mặc định (PLAN 9.3: Django admin là cửa hậu,
  "không tốn công gì").
- `makemigrations core` → **DROP DATABASE `gikky_dev` rồi tạo lại** → `migrate`.
  DB hiện chỉ có bảng của Django (`auth_*`, `django_*`), **không có dữ liệu domain nào** — xoá an
  toàn. Lệnh: kết nối `psql -U gikky -d postgres` (role `gikky` là owner, có CREATEDB) →
  `DROP DATABASE gikky_dev;` → `CREATE DATABASE gikky_dev OWNER gikky;`.
- Sau khi migrate: bảng phải là `core_user`, **không còn `auth_user`**.

### 2.2 N2 — dọn prefix `/api/admin/`
Theo Q2. Sửa cả docstring đầu `urls.py`.

### 2.3 T1 + Q3 — healthcheck thật + test giết được mutant
- Endpoint theo Q3.
- Test phải ĐỎ với mutant `with connection.cursor(): pass` + trả hằng số. Cách đạt: assert trên
  **body trả về** ở nhánh kết quả sai (monkeypatch `fetchone()` → `(2,)` ⇒ mong đợi 503 +
  `db="fail"`), chứ không chỉ assert "cursor có được gọi không".
- Giữ luôn test cũ (chặn `cursor()` → phải 503, không được 200 "ok").

### 2.4 T2 — che `/docs` và `/openapi.json` ngoài DEBUG
`docs_url` / `openapi_url` = `None` khi `not settings.DEBUG`. Codegen không ảnh hưởng
(`export_openapi` gọi `get_openapi_schema()` trực tiếp, không qua HTTP).
**Test phải ĐỎ nếu bỏ gate** — tự chọn cách (tách helper để test được cả 2 chiều là gợi ý).

### 2.5 T3 — `export_openapi` không được im lặng bỏ sót NinjaAPI
Phase 4 thêm `NinjaAPI` thứ hai cho `/api/admin` → hiện tại `pnpm codegen` vẫn exit 0 và sinh
client thiếu sạch endpoint admin → lập trình viên admin sẽ tự khai interface, **vi phạm thẳng
PLAN 8.3**. Vá: một **registry tường minh** (vd `config/api_registry.py`) + **test duyệt URLconf,
tìm mọi instance `NinjaAPI` đang mount, assert từng cái có trong registry**. Test này là cái
chuông cho Phase 4.

### 2.6 T4 — clone sạch phải chạy được
- Thêm bước copy `.env.example` → `.env` vào khối setup của `CLAUDE.md` (repo).
- Thêm script `pnpm setup:env` (Node, cross-platform) copy nếu chưa có, không đè nếu đã có.
- Thông điệp lỗi khi thiếu `SECRET_KEY` phải chỉ đúng việc cần làm.

### 2.7 T5 + T6 — trang skeleton Next
- Server component fetch **thẳng `API_ORIGIN`** (Django). Bỏ `SELF_ORIGIN` và kiểu "tự gọi HTTP
  vòng qua chính origin mình" — PLAN 8.4 điểm 3 đã có Django gọi ngược `localhost:3000`, thêm
  vòng nữa là công thức tự đói tài nguyên khi bật ISR ở Phase 3.
- Chứng minh same-origin bằng **một lời gọi phía client** với URL **tương đối** `/api/v1/health`
  — đó mới là thứ 8.2 lo (trình duyệt gửi cookie/CSRF cùng origin), không phải Node-fetch-Node.
- T6: khi `error` có mặt thì **in ra `error`**, không được in "không đọc được body". Trang này là
  công cụ chẩn đoán — im lặng thành công là phản tác dụng.
- Comment cảnh báo ngay tại `export const dynamic = "force-dynamic"`: *đây là đặc thù Phase 0;
  trang `/m/[slug]` Phase 3 phải theo PLAN 8.4 — biến thể anon là ISR, ĐỪNG copy dòng này.*

### 2.8 T7 — test idempotent phải chạy khác tiến trình
Lượt 2 chạy bằng `subprocess` với `PYTHONHASHSEED` khác lượt 1 (vd `0` và `1`), so byte. Lý do:
nguồn bất định thật của schema JSON là thứ tự lặp `set`, mà seed cố định trong một process ⇒ test
hiện tại **không thể** đỏ vì lớp lỗi đó.

### 2.9 N3 — chặn singleton client rò dữ liệu per-user
`packages/api-client/src/client.gen.ts` xuất `export const client` dùng chung cả tiến trình. Ở
Phase 3, `GET /machs/{id}/me` phải forward cookie; ai viết `client.setConfig({headers:{cookie}})`
rồi gọi là mở đường cho request user B đọc dữ liệu bằng session user A — **hỏng im lặng, trang
vẫn 200**.
- Bỏ subpath `"./client"` khỏi `exports` của `packages/api-client/package.json`.
- Thêm luật cứng vào `CLAUDE.md` repo: *trong server component / route handler, CẤM dùng `client`
  singleton và CẤM gọi `client.setConfig`; mỗi request tự tạo client hoặc truyền
  `baseUrl`/`headers` theo từng lời gọi.*

### 2.10 Việc nhẹ gom một lượt
| Mã | Việc |
|---|---|
| V1 | `api/.env.example`: ghi rõ `DEBUG=True` là **chỉ cho dev**, và `SECRET_KEY` phải sinh mới khi lên prod |
| V2 | `docker-compose.dev.yml` → `postgres:17`; sửa `PLAN.md` mục 6 + mọi chỗ nhắc "PostgreSQL 16" |
| V3 | Ghim tag `minio/minio` và `minio/mc` (không để `:latest`) |
| V4 | Thêm script `pnpm test` chạy pytest (hiện pytest là lệnh duy nhất phải `cd api` + gõ đường dẫn venv tay) |
| V5 | Thêm `pnpm codegen:check` (sinh lại + so hash, exit ≠ 0 khi lệch) — 8.3 sẽ cần khi bật CI |
| V7 | Ghi luật vào `CLAUDE.md`: **mọi endpoint phải khai `operation_id` tường minh**, nếu không tên hàm TS sẽ đổi theo tên hàm Python / route |
| V8 | Thêm `STATIC_ROOT` (thiếu thì `collectstatic` lỗi, Django admin mất CSS ở prod) |

### 2.11 Cập nhật `PLAN.md` (được phép — PLAN tự cho phép ở mục 7)
- Mục 6 + mọi chỗ khác: PostgreSQL 16 → **17**.
- 8.2: thêm dòng Django admin nằm ở `/api/admin/django/`, nằm trong prefix `gikky.net/api/admin/*`
  đã bị Caddy chặn ⇒ không phải thêm luật Caddy mới.
- Mục 7: ghi rằng thêm `NinjaAPI` mới thì **phải** đăng ký vào registry của `export_openapi`.

---

## 3. Tiêu chí nghiệm thu

| # | Tiêu chí | Cách đo |
|---|---|---|
| B1 | `AUTH_USER_MODEL = "core.User"`, migrate sạch | `grep` settings; `manage.py migrate` exit 0 |
| B2 | DB có `core_user`, **KHÔNG còn `auth_user`** | `psql -c "\dt"` |
| B3 | `get_user_model()` là `core.User` — **có test, đã thử phá** | đọc test; gỡ `AUTH_USER_MODEL` → test phải ĐỎ |
| B4 | Django admin ở `/api/admin/django/`, `/api/admin/` còn trống cho Phase 4 | `reverse("admin:index")`; test chứng minh `/api/admin/<gì đó>` KHÔNG bị Django admin nuốt |
| B5 | Healthcheck: DB ok → 200 `db="ok"`; kết quả sai → **503 `db="fail"`**; `cursor()` ném → **503** | 3 test |
| B6 | **Mutant T1 bị giết** | áp `with connection.cursor(): pass` + hằng số → `pytest` phải **ĐỎ**, dán output |
| B7 | `/docs`, `/openapi.json` tắt khi `DEBUG=False`, có test đỏ được | đọc code + test |
| B8 | Test bắt được NinjaAPI mount mà chưa đăng ký registry | thêm tạm 1 NinjaAPI thứ hai vào urls → test phải ĐỎ → gỡ |
| B9 | Clone sạch chạy được | đổi tên `api/.env` → chạy `pnpm setup:env` → `pnpm test` xanh → khôi phục |
| B10 | Trang Next: server fetch `API_ORIGIN`, client fetch `/api/v1/health` tương đối, lỗi in ra `error` thật | đọc code; tắt Django → trang phải in lỗi THẬT, không in "không đọc được body" |
| B11 | Test idempotent chạy 2 `PYTHONHASHSEED` khác nhau | đọc test; chạy |
| B12 | `packages/api-client/package.json` không còn export `"./client"`; `CLAUDE.md` có luật cấm singleton | đọc file |
| B13 | V1–V8 xong | đọc từng file |
| B14 | `PLAN.md` đã cập nhật 3 chỗ ở 2.11 | `grep -n "PostgreSQL" PLAN.md`; đọc 8.2, mục 7 |
| B15 | **Không hồi quy**: A1–A17 của plan Phase 0 vẫn ĐẠT | chạy lại, chú ý A5 (DB mới), A7 (0 warning), A10 (idempotent), A12–A14 |
| B16 | Vẫn **0 commit**, vẫn **0 warning** | `git rev-list --count --all` = 0; `pytest -q` không có warnings summary; eslint `--max-warnings=0` |

## 4. Ngoài phạm vi
Trường domain của `User` (Phase 1), router admin Ninja thật (Phase 4), cơ chế ISR/cache 8.4
(Phase 3), CI (chưa có remote), Docker (máy chưa cài).
