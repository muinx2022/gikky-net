/** Chọn khoá credential cho `POST /api/_allauth/browser/v1/auth/login`.
 *
 * ## Vì sao phải chọn, không gửi cả hai
 *
 * `ACCOUNT_LOGIN_METHODS = {"email", "username"}` làm allauth dựng `LoginInput` với **hai
 * field**, rồi `clean()` đếm credential theo **khoá CÓ MẶT trong body** và đòi đúng một:
 *
 *     if len(credentials) != 1: raise validation_error("invalid_login")
 *
 * Gửi cả `email` lẫn `username` là **400 kể cả khi cả hai đều đúng**. Nên client bắt buộc
 * phải quyết định, và quyết định ấy là hàm này.
 *
 * ## Luật: có `@` thì là email
 *
 * Thô, và đúng ở đây vì `username` của gikky **không chứa `@`** — nó đi vào URL công khai
 * `/u/<username>`. Không cần validate email cho chuẩn: server mới là chỗ phán xử, và một
 * regex email viết tay ở client chỉ thêm một cách từ chối sai người dùng thật.
 *
 * ⚠ **Có bản sao ở `apps/admin/lib/dang-nhap.ts`.** Hai app Next không dùng chung package
 * nào cho tầng này, nên đây là hai file phải khớp nhau. Sửa một bên thì sửa cả hai —
 * lệch nhau nghĩa là đăng nhập được ở app này mà 400 ở app kia, với cùng một chuỗi.
 */
export function taoThongTinDangNhap(
  dinh_danh: string,
  mat_khau: string,
): { email: string; password: string } | { username: string; password: string } {
  const gon = dinh_danh.trim();
  return gon.includes("@")
    ? { email: gon, password: mat_khau }
    : { username: gon, password: mat_khau };
}
