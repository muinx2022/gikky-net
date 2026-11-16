# Chấm tròn thay nhãn «do Gikky tạo»

**Trạng thái:** ĐÃ LÊN PROD 2026-11-15 ~21:19 (`856fbba`). Chỉ admin. Cây cũ `~/gikky-net/src.cu-20261115-211702`. Image cũ `gikkynet-admin:truoc-cham-gikky`. Không migration, không đụng api/web/caddy. Cây bình luận không nằm trong commit này. Spec vẫn lọt vài cách viết cố tình; hết 2 lượt sửa, không siết tiếp.

User (2026-11-15): nhãn chữ «do Gikky tạo» đổi thành một dấu chấm tròn, gắn ở góc phải trên của tên user.

## Bối cảnh

Nhãn chữ đang ở hai chỗ, cùng cờ `u.do_gikky_tao` (Django, không đổi):

- `apps/admin/app/users/page.tsx` — cạnh tên trong ô Tài khoản
- `apps/admin/app/u/[username]/page.tsx` — chip trong hàng nhãn đầu khối hồ sơ

Bảng không có avatar. «User» ở đây là **tên hiển thị** (dòng trên, không phải dòng `u/username`). Mẫu chấm góc đã có ở chuông báo cáo: `absolute -top-1.5 -right-1.5 rounded-full` trong `apps/admin/components/khung/thanh-tren.tsx`.

Cây bẩn, không đụng: `scripts/bai-viet/chu-de.md`, `scripts/bai-viet/dang-bai.py`, và untracked `.claude/`, `scratch/`, `live_og.png`, `apps/web/e2e/bai-viet-xem-truoc.spec.ts.cu`, lock bot-trader, `test_merge_list.txt`, `tts_result.txt`.

## LÀM

Bỏ `NhanTrangThai` chữ «do Gikky tạo» ở cả hai trang.

Khi `u.do_gikky_tao` là true, vẽ một chấm trên **chính khung tên**:

- `/users`: khung là `relative inline-block` bọc `Link` tên (`display_name || username`). Chấm là con của khung đó, không phải của cả hàng, không phải của dòng `u/username`.
- `/u/[username]`: cùng cách trên `h1` tên. Gỡ chip khỏi hàng nhãn trạng thái.

Chấm:

- `absolute -top-1 -right-2 size-2 rounded-full bg-nhan` (token có sẵn, không mã hex, không `bg-[#…]`)
- không chữ nhìn thấy
- `title` và `aria-label` đều là `do Gikky tạo` để rê chuột và trình đọc vẫn hiểu
- không nằm trong vùng `md:group-hover:opacity-0` của cột Trạng thái

Không đổi API, schema, `la_email_do_gikky`, codegen.

Sửa `apps/web/e2e/don-vi/nhan-email-gikky.spec.ts` cho khớp: hai trang vẫn render theo `do_gikky_tao`, có `rounded-full`, `bg-nhan`, `aria-label="do Gikky tạo"`, và trên `/users` chấm đứng trước `md:group-hover:opacity-0`. Bỏ yêu cầu chip `tone="nhan"` + chữ hiện. Vẫn cấm `@gikky.net` ở hai trang. Bài hàm Python giữ nguyên.

## KHÔNG LÀM

Không commit, không push, không deploy. Không checkout nhánh khác. Không đụng file bẩn liệt ở trên. Không thêm bộ lọc, không đụng `/quan-tri-vien`, không đụng `apps/web` ngoài file spec.

## Tiêu chí

1. `pnpm e2e:don-vi -g "nhan-email-gikky"` → exit 0, chỉ spec này. Không đặt `--` trước `-g`.
2. `pnpm --filter @gikky/admin lint` → exit 0, không warning.

Không chạy `pnpm e2e`, không chạy `pnpm test`.

## Vòng sửa 2 — chỉ spec

Hai trang đã đúng. Không sửa `apps/admin/app/users/page.tsx` và `apps/admin/app/u/[username]/page.tsx` (trừ lúc phá tạm rồi khôi phục đúng hash). Chỉ sửa `apps/web/e2e/don-vi/nhan-email-gikky.spec.ts`.

Trong khung tên (`khungTen`, sau `boChuThich`), đúng một chấm, và chấm ấy là con của cờ dương:

- Đúng một lần chuỗi `absolute -top-1 -right-2 size-2 rounded-full bg-nhan`.
- Lần đó nằm trong `<span … />` tự đóng, và span ấy nằm trong `{u.do_gikky_tao && ( … )}`. Dạng `{u.do_gikky_tao && null}` rồi một span luôn hiện phải đỏ.
- Cùng thẻ span đó có `title="do Gikky tạo"`, `aria-label="do Gikky tạo"`, `role="img"`. Gắn `aria-label` lên `h1` không được tính.
- Sau khi gỡ hai thuộc tính `title` và `aria-label` mang đúng chữ ấy, phần còn lại của file không còn chuỗi `do Gikky tạo` (chặn cả `{"do Gikky tạo"}`).

Giữ: cờ dương `(?:^|[^!])u\.do_gikky_tao &&`, khung chứa tên, chấm trước `md:group-hover:opacity-0`, cấm `@gikky.net`, hàm Python.

Trước khi báo xong, phá tạm rồi khôi phục (hash trước = hash sau) và thấy spec đỏ ở cả bốn kiểu: bỏ `absolute -top-1 -right-2`; chấm luôn hiện ngoài cờ; chuyển `aria-label` lên `h1`; thêm `{"do Gikky tạo"}`. Rồi chạy lại tiêu chí 1 và 2 trên cây đã khôi phục.
