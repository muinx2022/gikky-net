# Lọc user Gikky trên /users

**Trạng thái (2026-11-16):** ĐỔI CHIỀU XONG («Ẩn user gikky», `an_gikky`), CHƯA COMMIT, CHƯA LÊN PROD. Nghiệm thu ĐẠT (pytest 21, e2e 3, codegen:check, lint). Phản biện: không lỗi nặng/trung bình; `e2e:don-vi` cả bộ 873 passed. Dùng chung file với việc `parent_id` (quan_tri_bang.py + client sinh ra) — commit phải đi cùng nhau. Dưới đây là bản trước: CODE XONG, CHƯA LÊN PROD. Nghiệm thu: pytest `test_nhan_email_gikky` 21 passed, e2e `loc-user-gikky` 3 passed, codegen:check khớp, lint admin exit 0. Phản biện: không lỗi nặng. Bài AND đã siết (bỏ `q` thì đỏ). Còn lệch regex với `\x1c`–`\x1f` và Kelvin — sổ P-20261115-4.

User (2026-11-15): sắp xếp lại form lọc ở https://admin.gikky.net/users, thêm checkbox «Gikky». Tích vào thì chỉ còn user có domain email Gikky. Ảnh chụp khoanh ô trống ngay sau dropdown «Tất cả».

## Bối cảnh

Hàng lọc ở `apps/admin/app/users/page.tsx` (~140–199): ô tìm, nút «Lọc», `<select>` trạng thái (`tat_ca` / `bi_ban` / `moi`). Form `sm:flex-initial` nên bên phải select là một khoảng trống. Nút «Xoá bộ lọc» chỉ hiện khi đang lọc và `ml-auto`.

Luật domain đã có: `la_email_do_gikky` trong `api/api/quan_tri_nguoi_dung.py`. Đúng domain `gikky.net` sau strip + chữ thường. Subdomain, hậu tố, local rỗng, hai `@`, khoảng trắng trong local đều là false. Cờ `do_gikky_tao` trên từng hàng đọc hàm này. Danh sách mặc định **không** lọc theo domain — bài `test_hai_cua_get_tra_co_va_khong_loc_mat_subdomain` ghim điều đó.

Bảng phân trang keyset (`useDanhSach`). Lọc trên 25 hàng đã tải là sai `tong` và sai các trang sau. Lọc phải ở `liet_ke_nguoi_dung`, trước `dem_tong` và trước keyset.

`api/api/quan_tri_bang.py`, `quan_tri_schemas.py`, `test_api_quan_tri_bang.py` và client admin đang bẩn vì cây bình luận chưa commit (`parent_id`). `scripts/bai-viet/*` là việc của phiên khác.

## LÀM

### API

Trong `liet_ke_nguoi_dung` thêm query `gikky: bool = False`. `operation_id` giữ `quan_tri_liet_ke_nguoi_dung`.

Khi `gikky` là true, queryset chỉ giữ email mà `la_email_do_gikky` trả true. Lọc bằng SQL (để đếm và keyset đúng), không kéo cả bảng về Python:

```text
email__iregex = ^[[:space:]]*[^[:space:]@]+@gikky\.net[[:space:]]*$
```

Áp **trước** nhánh `so_staff_an` / loại `is_staff`, cùng chỗ với `q` và `trang_thai`, để `tong` và `so_staff_an` là số của tập đã lọc. `gikky` kết hợp AND với `q` và `trang_thai`. Thiếu tham số hoặc `false` thì danh sách y như hôm nay.

Không thêm cột, không đổi `do_gikky_tao`.

### Trang /users

Một hàng, dính trái, thứ tự:

1. ô tìm
2. nút «Lọc»
3. select trạng thái
4. checkbox nhãn nhìn thấy đúng chữ `Gikky` — đặt ngay sau select, **không** `ml-auto`
5. «Xoá bộ lọc» vẫn `ml-auto`, chỉ khi đang lọc

Checkbox áp ngay khi tích (như select), không đợi nút «Lọc». State vào `useCallback` của `nap` cùng `q` và `trang_thai`. Gửi `gikky: true` khi tích, không gửi (hoặc `false`) khi không tích. `co_bo_loc` gồm checkbox. «Xoá bộ lọc» bỏ tích.

`data-testid="loc-gikky-user"`. Không chữ `@gikky.net`, không `endsWith`, không so domain ở frontend. Gọi thẳng `quanTriLietKeNguoiDung({ baseUrl: GOC_API, ... })`.

### Test

`api/tests/test_nhan_email_gikky.py` (file này sạch):

- `?gikky=true` trả đúng tập `{ user | la_email_do_gikky(user.email) }` trên các email đúng/sai đã có trong file (bỏ `None`; lưu `""` cho ca rỗng). Subdomain không lọt. `?gikky=false` và URL không tham số vẫn chứa subdomain.
- Staff email `@gikky.net` không nằm trong `items` của `/users` nhưng được tính vào `so_staff_an`. Staff email khác không bị đếm khi `gikky=true`.
- AND với `q`: hai user cùng domain, `q` chỉ trúng một người.

`apps/web/e2e/don-vi/loc-user-gikky.spec.ts`: trang `/users` có checkbox nhãn `Gikky`, lời gọi `quanTriLietKeNguoiDung` truyền cờ `gikky` từ state đó, file không chứa `@gikky.net`. Trang `/quan-tri-vien` không có checkbox này.

Rồi `pnpm codegen`. Client admin có `gikky` trên query của `quan_tri_liet_ke_nguoi_dung`.

## KHÔNG LÀM

Không commit, không push, không deploy. Không đụng `scripts/bai-viet/*`, cây bình luận (`parent_id`, `cay-binh-luan.ts`, `app/m/[machId]/page.tsx`, spec cây). Khi sửa `quan_tri_bang.py` chỉ thêm tham số trong `liet_ke_nguoi_dung`. Không checkout hay viết đè các file `M` kia. Không thêm ô tìm theo email. Không đặt checkbox lên `/quan-tri-vien` hay `o-goi-y-user.tsx` — hai chỗ đó không truyền `gikky`, default false. Không sửa `P-20261115-2` (PATCH email không cập nhật `EmailAddress`): bộ lọc và chấm tròn cùng đọc `User.email`.

## Tiêu chí

Chạy ở gốc repo.

1. `pnpm test -- tests/test_nhan_email_gikky.py -q` → exit 0. Không chạy cả `pnpm test`.
2. `pnpm e2e:don-vi -g "loc-user-gikky"` → exit 0, chỉ spec mới. Không đặt `--` trước `-g`.
3. `pnpm codegen:check` → exit 0.
4. `pnpm --filter @gikky/admin lint` → exit 0, không warning.

Không chạy `pnpm e2e`, không chạy `pnpm build`.

## Đổi chiều — 2026-11-16

User (2026-11-16, ảnh prod `/users`, khoanh ô trống sau dropdown «Tất cả»): «thêm 1 checkbox: Ẩn user gikky». Hỏi lại thì user chọn **thay hẳn** checkbox «Gikky» (chỉ hiện gikky, chưa lên prod). Chỉ còn «Ẩn user gikky».

Các mục trên vẫn giữ: vị trí, áp ngay khi tích, lọc ở SQL trước khi loại staff và trước `dem_tong`, AND với `q` và `trang_thai`, không so domain ở frontend, phạm vi KHÔNG LÀM. Chỉ đổi chiều:

- **API:** đổi tên `gikky: bool` thành **`an_gikky: bool = False`**. Khi bật thì **loại** (`.exclude`) mọi email khớp regex cũ, tức đúng tập `la_email_do_gikky` trả true. Không giữ tham số `gikky` cũ vì chưa lên prod và không ai gọi. `so_staff_an` đếm trên cùng `qs` đã loại, nên khi `an_gikky=true` thì staff `@gikky.net` không được đếm.
- **Trang:** nhãn nhìn thấy đúng chữ **`Ẩn user gikky`**. State tên `an_gikky`, `data-testid="an-gikky-user"`, query gửi `an_gikky`.
- **Test Python:**
  - `?an_gikky=true` trả đúng `{ user không staff | not la_email_do_gikky(email) }`: email đúng **mất**; subdomain, `""` và các email sai **còn**.
  - `false` hoặc thiếu cờ thì có cả hai phía.
  - Staff `@gikky.net` không vào `so_staff_an`. Staff domain khác vẫn vào.
  - AND với `q`: `q=chung` cộng `an_gikky` chỉ còn người `chung` ở ngoài domain.
- **Spec** `loc-user-gikky.spec.ts`: đổi theo testid, nhãn và tên cờ mới. `/quan-tri-vien` không có checkbox và không gửi `an_gikky`.
- **`pnpm codegen`:** query của `quan_tri_liet_ke_nguoi_dung` trong client admin có `an_gikky` và không còn `gikky`.

Tiêu chí: 4 lệnh như trên.
