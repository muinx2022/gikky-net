/** Nguyên tắc 9 của PLAN mục 3 — "trạng thái vắng phải duyên dáng".
 *
 * > Dưới 4 bình luận: ẩn mọi số đếm, khán đài thu về một dòng mời. Không bao giờ hiển thị
 * > "0 bình luận", "0 người đang xem" — không phô sự im lặng.
 *
 * Luật này áp cho **cả mạch**, không cho từng mốc: ngưỡng đọc trên `Mach.comment_count`.
 * Mốc lẻ có 0 bình luận thì đã có luật riêng (PLAN 5.4 luật 4 — hiện lời mời + câu mồi).
 *
 * `comment_count` là số bình luận **ĐỌC ĐƯỢC** (PLAN mục 6, luật đếm 4 cột): bia mộ vẫn
 * render ra dòng nhưng không được đếm. Nên khán đài có thể hiện nhiều dòng hơn con số
 * này — đó là chủ đích, đừng "sửa" cho khớp.
 */

/** Ngưỡng của nguyên tắc 9. "Dưới 4" ⇒ 0, 1, 2, 3 đều ẩn; 4 trở lên mới hiện. */
export const NGUONG_HIEN_SO_DEM = 4;

export function nenHienSoDem(commentCount: number): boolean {
  return commentCount >= NGUONG_HIEN_SO_DEM;
}
