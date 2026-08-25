import type { MachCuaToiOut } from "@gikky/api-client";

/** Vạch mới của mặt BÃO — PLAN 5.5.
 *
 * > spine 1 dòng (… **số của các mốc chưa xem đổi màu hoàng thổ** theo
 * > `last_seen_entry_seq`) → thẻ **mốc 1** + thẻ mốc mới nhất mở sẵn, dải gập nằm giữa
 * > (… bung timeline đầy đủ, trong đó **vạch mới** kẻ trước mốc đầu tiên chưa xem)
 *
 * *(Trích cập nhật 2026-08-24 theo lượt sửa "mốc 1 luôn hiện" — bản cũ chép câu "thẻ mốc
 * mới nhất mở sẵn" và nay PLAN 5.5 không còn câu đó. Một trích dẫn lệch với nguồn thì
 * người sau tin bản chép, không đi mở nguồn.)*
 *
 * Hàm THUẦN, tách khỏi component để đo được mà không cần trình duyệt — và vì đây là chỗ
 * duy nhất biết luật "khi nào KHÔNG vẽ vạch", thứ khó hơn hẳn luật "vẽ ở đâu".
 */

/** Trạng thái người xem, ở mức vạch mới cần. Rút gọn từ `MachCuaToiOut` để hàm này gọi
 * được từ bài đo mà không phải dựng cả một response. */
export type ViTriDoc = Pick<
  MachCuaToiOut,
  "dang_nhap" | "following" | "last_seen_entry_seq"
>;

/** `seq` của mốc **đầu tiên chưa xem** — vạch kẻ ngay TRƯỚC nó. `null` ⇒ không vẽ vạch.
 *
 * Bốn ca trả `null`, và ba trong số đó là những ca một bản cài ẩu sẽ vẽ nhầm:
 *
 * 1. **chưa biết / khách** (`trangThai === null` hoặc `dang_nhap === false`) — vạch mới là
 *    thứ per-user, và trang mạch có bản cache. Khách thấy vạch nghĩa là vạch của ai đó đã
 *    bị nướng vào HTML;
 * 2. **chưa theo mạch** — `last_seen_entry_seq` sống trên hàng `Follow` (PLAN mục 6), nên
 *    người chưa theo luôn nhận `0` từ API. Đó là "không có dữ liệu", không phải "chưa đọc
 *    gì";
 * 3. **`last_seen_entry_seq === 0`** — cùng lý lẽ: một hàng `Follow` dựng bằng tay mang
 *    giá trị mặc định `0`. Vẽ vạch trước mốc 1 là tuyên bố *cả mạch đều mới*, đúng câu nói
 *    dối mà `core.ghi.dat_follow` tránh khi nó đặt `last_seen_entry_seq = entry_count` cho
 *    lượt theo đầu tiên;
 * 4. **đã xem hết** (`>= soMoc`) — không còn gì mới để ngăn cách.
 */
export function mocDauChuaXem(
  trangThai: ViTriDoc | null,
  soMoc: number,
): number | null {
  if (trangThai === null || !trangThai.dang_nhap || !trangThai.following) return null;
  const da_xem = trangThai.last_seen_entry_seq;
  if (da_xem <= 0 || da_xem >= soMoc) return null;
  return da_xem + 1;
}

/** Ô spine này có tô **hoàng thổ** không — PLAN 9.1 giao màu ấy cho "số mốc chưa xem".
 *
 * Suy từ đúng con số đã quyết định vạch mới, không tính lại từ `last_seen_entry_seq`: hai
 * phép tính song song là hai phép sẽ lệch, và lúc lệch thì spine tô một đằng còn vạch kẻ
 * một nẻo — người đọc không có cách nào biết bên nào đúng.
 */
export function oChuaXem(seq: number, mocDau: number | null): boolean {
  return mocDau !== null && seq >= mocDau;
}
