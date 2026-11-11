import type { AnhOut, XemTruocOut } from "@gikky/api-client";

/** Số dòng chữ khi bài KHÔNG có ảnh. User (2026-11-10): "nếu không có ảnh thì hiển thị xxx
 * dòng text" — chưa có số, nên lấy 3: đó là độ dài `DAI_TRICH_FEED` (240 ký tự) được thiết
 * kế cho ở bề rộng cột chính. Đổi số này là đổi cả CSS (đi qua biến `--so-dong`). */
export const SO_DONG_TRICH = 3;

/** Số ảnh tối đa trong gallery của hàng bài viết — khớp `SO_ANH_XEM_TRUOC` của API
 * (`anh` + `anh_khac`); bài đo `e2e/don-vi/xem-truoc-anh.spec.ts` đọc `api/api/schemas.py` và
 * ép hai hằng bằng nhau. Ảnh thứ N+1 trở đi không có thumb: hàng chỉ thêm MỘT slide cuối
 * "Xem tất cả {so_anh} ảnh →" dẫn tới bài. */
export const SO_ANH_GALLERY_TOI_DA = 10;

/** Tỉ lệ khung mặc định khi thiếu `w_thumb`/`h_thumb` (ảnh nhúng không có bản ghi). */
export const TY_LE_MAC_DINH = 4 / 3;

/** Tỉ lệ khung của thumb MỘT ẢNH, kẹp trong [0,6 ; 2]: ảnh panorama 10:1 mà để nguyên thì một
 * thumb chiếm cả hàng; kẹp rồi thì `object-fit: cover` cắt bớt chứ không làm méo. Thiếu kích
 * thước ⇒ `TY_LE_MAC_DINH`, để khung vẫn giữ chỗ (không dịch bố cục khi ảnh nạp xong). */
export function tyLeKhung(a: Pick<AnhOut, "w_thumb" | "h_thumb">): number {
  const w = a.w_thumb ?? 0;
  const h = a.h_thumb ?? 0;
  if (w < 1 || h < 1) return TY_LE_MAC_DINH;
  return Math.min(2, Math.max(0.6, w / h));
}

/** Tỉ lệ khung của GALLERY (nhiều ảnh), theo ảnh ĐẦU, kẹp trong [1 ; 16/9]: khung cao hơn
 * vuông thì chiếm quá nhiều màn hình, rộng hơn 16:9 thì quá bẹt để lật. Ảnh lệch khỏi khoảng
 * kẹp vẫn xem đủ (`object-fit: contain`, phần thừa là nền khung). Thiếu kích thước ⇒
 * `TY_LE_MAC_DINH` — khung vẫn giữ chỗ, không dịch bố cục khi ảnh nạp xong. */
export function tyLeKhungGallery(a: Pick<AnhOut, "w_thumb" | "h_thumb">): number {
  const w = a.w_thumb ?? 0;
  const h = a.h_thumb ?? 0;
  if (w < 1 || h < 1) return TY_LE_MAC_DINH;
  return Math.min(16 / 9, Math.max(1, w / h));
}

/** Chọn ảnh cho hàng bài viết từ `xem_truoc` của API — hàm THUẦN để đo được.
 *
 * - `anh === null` ⇒ không ảnh nào (dù `so_anh` có nói gì: không có gì để vẽ);
 * - nếu không thì `[anh, ...anh_khac]` cắt ở `SO_ANH_GALLERY_TOI_DA`. `anh_khac` vắng (API cũ,
 *   cache cũ) coi như `[]` ⇒ một ảnh;
 * - `con_lai` = số ảnh phục vụ được mà gallery KHÔNG mang (`so_anh` - số ảnh trả về): > 0 thì
 *   hàng thêm slide cuối "Xem tất cả {so_anh} ảnh →". Không còn điều kiện "gallery đã đầy": một
 *   slide cuối dẫn tới bài không nói dối về chỗ còn lại như `+N` trên thumb. */
export function chonThumb(xem_truoc: XemTruocOut): { anhs: AnhOut[]; con_lai: number } {
  if (xem_truoc.anh === null) return { anhs: [], con_lai: 0 };
  const anhs = [xem_truoc.anh, ...(xem_truoc.anh_khac ?? [])].slice(0, SO_ANH_GALLERY_TOI_DA);
  return { anhs, con_lai: Math.max(0, xem_truoc.so_anh - anhs.length) };
}
