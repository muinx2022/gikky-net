/** Hai hằng của cửa nhận on-demand revalidate — tách khỏi route handler để ĐO ĐƯỢC.
 *
 * `app/lam-moi-cache/route.ts` là một Route Handler, và Next **cấm nó export bất cứ thứ gì
 * ngoài các tên nó biết** (`GET`, `POST`, `dynamic`, `revalidate`, …): thêm một
 * `export const` vào đó làm `next build` đỏ với "Type 'RegExp' is not assignable to type
 * 'never'". Nên hai hằng dưới đây ở riêng — và nhờ vậy bài đo import được chúng thay vì
 * chép lại một bản thứ hai của cùng biểu thức chính quy.
 */

/** Header mang secret. **Không dùng query string**: query nằm lại trong access log của
 * hai tầng proxy, tức secret bị ghi ra đĩa dạng thô ở hai chỗ, vĩnh viễn. */
export const HEADER_SECRET = "x-revalidate-secret";

/** Chỉ nhận đường dẫn trang mạch `/m/<slug>-<id>`.
 *
 * Allowlist bằng regex chứ không nhận đường dẫn tự do: `revalidatePath` nhận bất cứ chuỗi
 * nào, nên một cửa không lọc là một cách bắt Next dựng lại **mọi** trang theo yêu cầu của
 * người gọi — kể cả khi họ chỉ đoán đúng secret một lần. Django hôm nay chỉ gửi đúng dạng
 * này (`core/revalidate.py::lam_moi_mach`); thêm dạng khác thì mở rộng ở đây, có ý thức.
 *
 * ⚠ **Tập ký tự phải khớp ĐÚNG `django.utils.text.slugify`** *(sửa 2026-08-23, mảng B2)*.
 * Bản đầu viết `[a-z0-9-]+` và nó **hẹp hơn thực tế theo hai chiều**, cả hai đều làm cửa
 * âm thầm từ chối một mạch có thật:
 *
 * 1. **dấu gạch dưới**. `slugify` giữ nguyên `_` (tập của nó là `[-a-z0-9_]`), nên một
 *    tiêu đề nhắc tới `u/ba_muoi_phien` ra slug có `_` — cửa trả 400, Django ghi một dòng
 *    WARNING vào log rồi thôi, và trang ấy **không bao giờ được làm mới** cho tới lượt
 *    revalidate nền. Bắt tại trận trong lượt e2e đầu tiên chạy thật cơ chế này;
 * 2. **slug RỖNG**. `slug_tu_title` (`core/models/dien_dan.py`) nói thẳng rằng một tiêu đề
 *    toàn emoji ra chuỗi rỗng và URL thành `/m/-1234`. `+` đòi ít nhất một ký tự nên nó
 *    loại luôn ca đó; `*` thì không.
 *
 * Nới tới đây **không** mở thêm cửa nào: vẫn đúng một tiền tố `/m/`, vẫn phải kết thúc
 * bằng `-<số>`, vẫn không có dấu `/`, không `.`, không query.
 * `e2e/don-vi/cache-mach.spec.ts` ghim cả hai chiều.
 */
export const DUONG_DAN_HOP_LE = /^\/m\/[a-z0-9_-]*-\d+$/;
