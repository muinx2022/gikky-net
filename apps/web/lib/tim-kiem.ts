/** Đọc dấu tô đậm `[[…]]` của API tìm kiếm — Phase 7.
 *
 * ## Vì sao API trả dấu chứ không trả HTML
 *
 * `title_to_dam` và `doan_trich` là **chữ do người dùng viết**. Trả `<mark>…</mark>` về
 * đây nghĩa là trang kết quả phải `dangerouslySetInnerHTML` để hiện được nó — tức mở một
 * đường XSS đi thẳng từ ô tiêu đề bài viết ra DOM của mọi người tìm kiếm. Cặp `[[` `]]`
 * đi qua JSON như chữ thường, và hàm dưới biến nó thành **mảng đoạn**, để React tự escape
 * từng đoạn như nó vẫn làm.
 *
 * Đây cũng là lý do không dùng `_formatted` của Meilisearch: nó trả HTML, và nó trả chữ
 * lấy từ **chỉ mục** chứ không từ Postgres — hai vấn đề khác nhau, cùng một câu trả lời.
 */

/** Một mẩu chữ, kèm cờ "có phải chỗ khớp không". */
export type Manh = { chu: string; dam: boolean };

const MO = "[[";
const DONG = "]]";

/** Tách chuỗi có dấu `[[…]]` thành mảng đoạn.
 *
 * Viết bằng vòng lặp chỉ số chứ không bằng `split`/regex, vì hai lý do đều có thật:
 *
 * - chuỗi gốc **có thể chứa sẵn** `[[` do người dùng gõ (`[[ghi chú]]` là cú pháp wiki
 *   quen tay). Một `[[` không có `]]` theo sau phải ở lại nguyên văn, không được nuốt
 *   phần đuôi của đoạn trích;
 * - `dai` của đoạn trích cắt ở giữa chừng, nên đoạn có thể **kết thúc giữa một cặp dấu**.
 *   Cặp không đóng thì phần còn lại là chữ thường.
 */
export function tachDam(chuoi: string): Manh[] {
  const ra: Manh[] = [];
  let i = 0;
  let thuong = "";

  const xa = () => {
    if (thuong) ra.push({ chu: thuong, dam: false });
    thuong = "";
  };

  while (i < chuoi.length) {
    if (!chuoi.startsWith(MO, i)) {
      thuong += chuoi[i];
      i += 1;
      continue;
    }
    const dong = chuoi.indexOf(DONG, i + MO.length);
    if (dong < 0) {
      // `[[` mồ côi — giữ nguyên văn, đừng đoán ý người viết.
      thuong += chuoi.slice(i);
      break;
    }
    xa();
    ra.push({ chu: chuoi.slice(i + MO.length, dong), dam: true });
    i = dong + DONG.length;
  }
  xa();
  return ra;
}
