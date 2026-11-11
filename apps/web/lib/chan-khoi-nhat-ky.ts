import { tuanVNCua } from "./chu-de";

/** Dải gợi ý ở CHÂN khối "Nhật ký mới" (plan `2026-11-11-homepage-v2-giao-dien-moi.md` §3.2):
 * thay cho nút viền xám "Xem thêm nhật ký". Hàm THUẦN — đo được không cần mạng.
 *
 * Nguồn số liệu là chính danh sách `docNhatKyMoiTacGia` đã tải (MỘT bài mới nhất của mỗi tác
 * giả, tối đa `SO_NHAT_KY_TAI` tác giả): các tác giả đứng sau `SO_NHAT_KY` thẻ đầu là "những
 * người còn lại". Phép đếm là theo NGƯỜI nên chữ chỉ nói số NGƯỜI — không nói số nhật ký (mỗi
 * người có thể đã ghi nhiều bài, mà danh sách chỉ mang bài mới nhất của họ). **Không bịa số**:
 *
 * - có `M > 0` người còn lại, và đã tải CHƯA đầy trần ⇒ M đúng ⇒ "+M người khác vừa ghi nhật
 *   ký". Chỉ thêm "trong tuần này" khi MỌI người được đếm đều có bài trong tuần (thứ Hai–Chủ
 *   nhật, giờ VN) chứa `bayGio`; lẫn một người ngoài tuần thì bỏ cụm đó;
 * - `daDay` (đã tải ĐÚNG trần ⇒ còn bao nhiêu người nữa không biết) hoặc `M = 0` ⇒ không có
 *   con số nào để nói ⇒ "Xem tất cả nhật ký".
 */
export type ChanKhoiNhatKy = {
  /** Số người còn lại; `null` khi không nói số (đã tải đúng trần, hoặc không còn ai). */
  n: number | null;
  /** Dòng đậm. */
  dam: string;
  /** Dòng nhạt, đi sau dòng đậm; rỗng khi không có. */
  nhat: string;
};

export function tomTatChanKhoi(
  conLai: readonly { published_at: string }[],
  daDay: boolean,
  bayGio: Date,
): ChanKhoiNhatKy {
  if (daDay || conLai.length === 0) {
    return { n: null, dam: "Xem tất cả nhật ký", nhat: "" };
  }
  const tuan_nay = tuanVNCua(bayGio.toISOString()).khoa;
  const het_trong_tuan = conLai.every((m) => tuanVNCua(m.published_at).khoa === tuan_nay);
  return {
    n: conLai.length,
    dam: `+${conLai.length} người khác`,
    nhat: `vừa ghi nhật ký${het_trong_tuan ? " trong tuần này" : ""}`,
  };
}
