/** Chữ cái đại diện cho avatar — hàm THUẦN của tên, PLAN khu người dùng 2026-08-24.
 *
 * Ưu tiên `display_name`, rỗng thì `username`. Lấy ký tự **chữ hoặc số** đầu tiên và viết
 * HOA. Bỏ qua khoảng trắng / dấu câu đứng đầu ("  @tí" → "T"). Rỗng sạch thì trả `"?"` —
 * **không bao giờ** trả chuỗi rỗng, vì một ô avatar trống là một khoảng khó hiểu chứ
 * không phải "không có gì".
 *
 * `\p{L}|\p{N}` (cờ `u`) để chữ có dấu tiếng Việt cũng tính là chữ cái — `docLuaChon`
 * kiểu regex ASCII sẽ nhảy qua "Đ", "Ă" và lấy nhầm ký tự sau.
 *
 * **Đơn sắc, không màu sinh từ hash.** PLAN 9.1 khoá bảng màu và cấm màu ứng biến; một
 * avatar mỗi người một màu là đúng thứ nó cấm. Màu do CSS lo (`components/avatar.module.css`),
 * hàm này chỉ trả chữ.
 */
export function chuCaiAvatar(ten: string): string {
  for (const ch of ten.trim()) {
    if (/\p{L}|\p{N}/u.test(ch)) return ch.toUpperCase();
  }
  return "?";
}
