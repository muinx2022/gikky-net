# Nhãn «do Gikky tạo» trên `/users`

**Trạng thái:** ĐẠT 4/4. Đang deploy chỉ nhãn lên đúng cây VPS (không kèm 8 commit web sau `c9cfbf5`).

**Đo (nghiệm thu tự chạy, 2026-11-15):** pytest 41 passed (18 bài mới + 23 CRUD cũ) · `e2e:don-vi -g nhan-email-gikky` 4 passed · `codegen:check` khớp 34 file · lint admin exit 0, không warning. Phản biện: Opus hết quota, chạy lại bằng Grok — không lỗi chặn. Sổ: `P-20261115-2` (sửa email không cập nhật `EmailAddress`, có từ trước).

**User (2026-11-15):** trên `https://admin.gikky.net/users`, thêm một nhãn cho user do Gikky tạo — nhận bằng email có domain đúng `@gikky.net`. Sửa xong thì deploy VPS. Phạm vi deploy đã chốt: **chỉ nhãn này, lên đúng cây đang chạy trên VPS**, không đưa 8 commit web đang nằm trên `v2` sau `c9cfbf5`.

## Bối cảnh đã đo

- Trang `apps/admin/app/users/page.tsx` liệt kê tài khoản, đã có `email` trong `NguoiDungQuanTriOut` nhưng không hiện nhãn theo domain.
- Luật domain thuộc Django (PLAN nguyên tắc 10). Frontend chỉ render cờ đã tính.
- `git diff c9cfbf5 HEAD -- api packages/api-client apps/admin` chỉ đụng `api/tests/test_cookie_domain_stack_phu.py`. Trang user, schema, client admin **giống** `c9cfbf5`.
- Cây làm việc đang bẩn, **không phải của việc này**, không đụng:
  - `M scripts/bai-viet/chu-de.md`
  - `M scripts/bai-viet/dang-bai.py`
  - untracked: `.claude/`, `scratch/`, `live_og.png`, `apps/web/e2e/bai-viet-xem-truoc.spec.ts.cu`, `scripts/bot-trader/data/trade_2026-11-13.lock`, `test_merge_list.txt`, `tts_result.txt`
- `/users` **loại** `is_staff` (họ ở `/quan-tri-vien`). Nhãn trên bảng chỉ thấy tài khoản không phải staff. Trang hồ sơ `/u/[username]` vẫn hiện nhãn nếu email khớp, kể cả staff — cùng một cờ, không phải màn hình thứ hai.

## LÀM

### 1. Cờ server `do_gikky_tao`

Trong `api/api/quan_tri_nguoi_dung.py`, hàm thuần (không query):

`la_email_do_gikky(email: str | None) -> bool`

True khi và chỉ khi, sau `strip` + chữ thường:

- đúng **một** dấu `@`;
- phần local không rỗng và không chứa khoảng trắng;
- phần domain **bằng đúng** `gikky.net`.

False cho mọi ca còn lại, gồm: rỗng / `None`, subdomain (`a@vi-du.gikky.net`), hậu tố (`a@gikky.net.evil`), `a@notgikky.net`, thiếu local (`@gikky.net`), hai dấu `@` (`a@b@gikky.net`), domain có dấu chấm cuối (`a@gikky.net.`). `a+tag@gikky.net` là True. Không punycode, không so gần đúng.

Gắn vào `NguoiDungQuanTriOut` (`api/api/quan_tri_schemas.py`) một field bắt buộc:

`do_gikky_tao: bool`

Docstring: tài khoản do Gikky tạo, suy từ domain email, **không** phải cột DB, **không** phải `la_tai_khoan_doi` / `la_bot`. Frontend không tự tính lại.

`nguoi_dung_quan_tri_ra` set `do_gikky_tao=la_email_do_gikky(u.email)`. Mọi cửa trả schema này (xem, liệt kê, tạo, sửa, ban, gỡ ban, mật khẩu, quyền mod) đi qua hàm đó — không chép điều kiện ở từng endpoint.

Không endpoint mới, không `operation_id` mới, không migration, không đổi `api_registry`.

### 2. Nhãn trên khu quản trị

Chỉ render khi `u.do_gikky_tao` là true. Chữ hiện: **do Gikky tạo**. Dùng `NhanTrangThai` tone `nhan` (token có sẵn). Không màu ứng biến, không `bg-[#…]`.

- `apps/admin/app/users/page.tsx`: đặt trong ô **Tài khoản**, cạnh tên. Không đặt ở cột Trạng thái — cột đó `md:group-hover:opacity-0`, nhãn sẽ biến mất lúc rê chuột.
- `apps/admin/app/u/[username]/page.tsx`: cùng nhãn trong hàng nhãn đầu trang.

Không ô lọc mới, không in email ra bảng, không đụng `/quan-tri-vien`, không đụng `apps/web`.

Frontend **không** chứa chuỗi so sánh `@gikky.net`.

### 3. Client sinh ra

Sau khi sửa schema: `pnpm codegen`. Không sửa tay `packages/api-client/`.

### 4. Bài đo

`api/tests/test_nhan_email_gikky.py` (pytest, `filterwarnings = error`):

- tham số hoá đúng các ca True/False ở mục 1, gọi thẳng `la_email_do_gikky`;
- `GET /api/admin/users/{username}` và `GET /api/admin/users`: một user `a@gikky.net` → `do_gikky_tao true`; một user `cu@vi-du.gikky.net` → false. User subdomain vẫn nằm trong danh sách (nhãn không phải bộ lọc).

`apps/web/e2e/don-vi/nhan-email-gikky.spec.ts` (đọc file, không server, không DB):

- `users/page.tsx` và `app/u/[username]/page.tsx` có `do_gikky_tao` và chữ `do Gikky tạo`;
- hai file đó không có `@gikky.net`;
- `quan_tri_nguoi_dung.py` có domain `gikky.net` trong `la_email_do_gikky`.

## KHÔNG LÀM

- Không commit, không push, không deploy (phiên chính làm sau khi nghiệm thu + phản biện).
- Không checkout nhánh khác, không đụng file `M` / untracked liệt ở trên.
- Không sửa `la_tai_khoan_doi`, `la_bot`, form tạo user, bộ lọc bảng.
- Không rebuild `web` / `caddy`, không migration.

## Tiêu chí đo được

Chạy ở gốc repo. Nền: các file dưới đây đang xanh trước khi sửa (chưa có `do_gikky_tao`).

1. `pnpm test -- api/tests/test_nhan_email_gikky.py api/tests/test_api_quan_tri_crud_user.py -q` → exit 0. Bài mới phủ đủ ca mục 1 và hai cửa GET. Bài CRUD cũ không đỏ.
2. `pnpm e2e:don-vi -g "nhan-email-gikky"` → chỉ file spec mới, mọi bài passed. **Không** thêm `--` trước `-g` (thêm `--` là chạy cả bộ).
3. `pnpm codegen:check` → exit 0. `packages/api-client/src-admin/types.gen.ts` có `do_gikky_tao: boolean`.
4. `pnpm --filter @gikky/admin lint` → exit 0, không warning.

Không chạy `pnpm e2e` (chiếm 3000 + 8000, ghi `gikky_dev`). Không chạy cả `pnpm test`.

## Deploy (phiên chính, sau khi phản biện không chặn)

User đã bảo deploy, và đã chốt **chỉ nhãn, trên đúng cây VPS đang chạy**.

1. `ssh vps-muinx 'cat ~/gikky-net/src/.deploy-commit'`. Gọi commit đó `PROD`.
2. `git diff PROD --` các file của việc này. Khác nội dung so với lúc lập plan (khi `PROD=c9cfbf5` thì diff rỗng) → **dừng**, không giải nén.
3. Commit **chỉ** file của việc này trên `v2` (bỏ qua file `M` của phiên khác). Rồi worktree từ `PROD`, `cherry-pick` commit đó. `git diff --stat PROD <cherry>` chỉ được chứa file nhãn + client sinh ra + test. Nhiều hơn, hoặc cherry-pick không sạch → **dừng**.
4. `git archive` **commit cherry-pick**, không archive `v2`. File tar → `scp` → so kích thước hai đầu → dời `~/gikky-net/src` sang `src.cu-<ts>` (không `rm -rf`) → giải nén → ghi `.deploy-commit` = hash cherry-pick.
5. `showmigrations core`: còn dòng `[ ]` → **dừng** (việc này không có migration). Không `[ ]` thì không dump.
6. Tag image đang chạy `api` và `admin` (`:truoc-nhan-gikky`). Build **tuần tự** `api` rồi `admin`. `up -d --no-deps api` rồi `up -d --no-deps admin`. Không build/up `web`, `caddy`.
7. Đo: cổng Caddy `127.0.0.1:8091` (không phải 8090) — `/` và health 200, đường không tồn tại 404, admin host 200. Trên container api, `la_email_do_gikky` đúng vài ca. Bundle admin có chữ `do Gikky tạo`. Log api/admin không traceback.
8. Rollback: `up` lại hai image tag cũ, dời `src.cu-<ts>` về `src`. Không đụng DB.
