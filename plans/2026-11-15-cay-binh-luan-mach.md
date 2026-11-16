# Cây bình luận trên trang mạch quản trị

**Trạng thái:** CODE XONG, CHƯA LÊN PROD. Nghiệm thu vòng cuối: e2e cây 15/15, lint admin sạch. Phản biện (Opus) không thấy lỗi nặng. Còn hai mép chưa sửa (đã hết 2 lượt): `soSanh` mất tính bắc cầu khi `created_at` không parse được; câu lỗi của lần bấm Ẩn có thể che câu lỗi nạp (`loi ?? loiNap`).

User (2026-11-15): https://admin.gikky.net/m/1364 — trình bày lại phần bình luận theo dạng cây.

## Bối cảnh đã đo

- Khối «Khán đài» là `BinhLuanCuaMach` trong `apps/admin/app/m/[machId]/page.tsx`. Nó gọi `quanTriLietKeBinhLuan` lọc `mach_id`, 25 hàng một trang, vẽ **bảng phẳng**, mới nhất trước.
- `BinhLuanDongOut` không có `parent_id`. Không có cha thì frontend không dựng được cây.
- `Comment.parent` có thật (`api/core/models/binh_luan.py`). Cửa liệt kê ở `api/api/quan_tri_bang.py::liet_ke_binh_luan`.
- Mạch 1364 trên prod: **2** bình luận, **1** gốc. Một trang là đủ cho bài này.
- `limit` tối đa của API là 50 (`GIOI_HAN_TOI_DA`). Bảng `/binh-luan` dùng chung endpoint và phải **giữ dạng phẳng**.
- Một agent khác đang sửa nhãn user. **Không đụng** `apps/admin/app/users/page.tsx`, `apps/admin/app/u/[username]/page.tsx`, `apps/web/e2e/don-vi/nhan-email-gikky.spec.ts`, `scripts/bai-viet/chu-de.md`, `scripts/bai-viet/dang-bai.py`.

## LÀM

### 1. API trả cha

Thêm field bắt buộc `parent_id: int | None` vào `BinhLuanDongOut`. Docstring: id bình luận cha, `None` khi là gốc. Không phải cột mới, không migration.

`liet_ke_binh_luan` gán `parent_id=c.parent_id`. Không đổi thứ tự API (vẫn `-created_at, -pk`), không đổi bộ lọc, không endpoint mới.

`pnpm codegen`. Không sửa tay `packages/api-client/`.

### 2. Dựng cây, hàm thuần

`apps/admin/lib/cay-binh-luan.ts` — không React, không `fetch`, để `e2e/don-vi` import được.

`dungCay(items)`:

- Mỗi phần tử có `id`, `parent_id`, `created_at`.
- Con nằm trong `con` của cha khi `parent_id` trỏ tới một id **có trong tập**.
- `parent_id` null, hoặc cha không có trong tập → nút gốc. Không bỏ sót bình luận.
- Anh em sắp `created_at` tăng dần, hoà thì `id` tăng dần (đọc từ trên xuống: gốc cũ trước, reply cũ trước).
- Chu trình (A cha của B, B cha của A) không đệ quy vô hạn: nút đã nằm trong chuỗi tổ tiên thì dừng, coi như không gắn lại.

### 3. Khối «Khán đài» vẽ cây

Chỉ `BinhLuanCuaMach`. Bỏ bảng của khối này.

Nạp **hết** các trang của mạch này: gọi thẳng `quanTriLietKeBinhLuan({ baseUrl: GOC_API, …, query: { mach_id, limit: 50, cursor } })` — không đưa hàm API qua biến. Lặp cursor tới khi `cursor_ke_tiep` null, tối đa **4** lần (200 hàng). Lần nào lỗi thì hiện lỗi và không vẽ một cây cụt như thể đã đủ. Còn cursor sau lần 4 thì một dòng «Còn bình luận chưa đưa vào cây.»

Vẽ `<ul>` lồng nhau. Mỗi nút giữ đúng thông tin đang có: trích yếu (đã `boTheHtml`), giờ, link `u/username`, điểm, nhãn «đã ẩn» / «bia mộ», nút ẩn/gỡ ẩn (`data-testid` giữ `hang-binh-luan-mach-${id}` và `nut-an-binh-luan-mach-${id}`).

Nhánh con: `ml-4 border-l border-vien pl-3`. Không màu hex, không `bg-[#…]`.

Bỏ `ThanhPhanTrang` của khối này — cây là cả tập đã nạp, không phải từng trang 25 dòng mới-nhất-trước.

Trang `/binh-luan` không đổi dáng.

## KHÔNG LÀM

Không commit, không push, không deploy. Không checkout nhánh khác. Không đụng file của việc chấm tròn / bài viết liệt ở trên. Không vote, không form trả lời, không gập nhánh, không đổi luật ẩn.

## Tiêu chí

1. `pnpm test -- tests/test_api_quan_tri_bang.py -q` → exit 0. Có bài mới: reply trả `parent_id` đúng id cha, gốc trả `null`. Bài cũ của file không đỏ. (cwd pytest là `api/`.)
2. `pnpm e2e:don-vi -g "cay-binh-luan"` → exit 0, chỉ spec mới. Không đặt `--` trước `-g`. Spec import `dungCay` và đo: một cha một con, hai gốc sắp cũ trước, reply mồ côi vẫn là gốc, chu trình không treo.
3. `pnpm codegen:check` → exit 0. `types.gen.ts` có `parent_id: number | null` trên `BinhLuanDongOut`.
4. `pnpm --filter @gikky/admin lint` → exit 0, không warning.

Không chạy `pnpm e2e`, không chạy cả `pnpm test`.
