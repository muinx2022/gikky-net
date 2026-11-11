/** Tên người dùng in trên giao diện — MỘT hàm cho mọi chỗ (plan
 * `2026-11-11-thong-nhat-giao-dien-toan-site.md` §4.6).
 *
 * Trước đây bảy file chép tay `display_name || \`u/${username}\``, nên cùng một khối chủ đề lẫn
 * hai dạng (`muinx`, `u/ngxuanmui`): người có tên hiển thị thì in tên, người không có thì in
 * `u/…`. Luật nay: có `display_name` (không rỗng, không toàn khoảng trắng) thì in nó; không thì
 * in `username` TRẦN, không tiền tố `u/`. Tiền tố vẫn ở `title="u/<username>"` của link tên và
 * ở trang hồ sơ — chỗ cần phân biệt "đây là tài khoản" chứ không phải "đây là tên".
 *
 * Hàm thuần, không nhập React: bộ `don-vi` đo được từng nhánh.
 *
 * `khiKhongCo`: chuỗi trả về khi không có tác giả (bình luận/mạch của tài khoản đã xoá,
 * `author: null`) hoặc tác giả không mang chữ nào. Mỗi chỗ gọi truyền đúng chuỗi mà nó từng in
 * trước khi có hàm này — hàm không tự bịa một cách ghi "đã xoá" chung cho cả site.
 */
export function tenHienThi(
  author: { username?: string | null; display_name?: string | null } | null | undefined,
  khiKhongCo = "",
): string {
  const ten = author?.display_name;
  if (typeof ten === "string" && ten.trim() !== "") return ten;
  const username = author?.username;
  if (typeof username === "string" && username !== "") return username;
  return khiKhongCo;
}
