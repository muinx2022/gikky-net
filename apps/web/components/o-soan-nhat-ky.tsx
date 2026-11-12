import { Plus } from "lucide-react";

import { LoiVaoNhatKy } from "./loi-vao-nhat-ky";
import css from "./o-soan-nhat-ky.module.css";

/** Hai lối vào "ghi nhật ký" dùng chung của trang chủ (`TrangChuV2`) và trang lọc nhật ký (`Feed`
 * khi `loai_mach=nhat_ky`) — tách ra ở việc 14, đợt C. DOM + testid GIỮ NGUYÊN như khi còn nằm
 * trong `trang-chu-v2.tsx`: `nhat-ky-soan-nhanh`, `nhat-ky-o-soan`, `nut-mo-nhat-ky`,
 * `nut-ghi-nhat-ky-di-dong`.
 *
 * Cả hai là server component bọc `LoiVaoNhatKy` (client duy nhất cắm vào): HTML thô vẫn là
 * `<a href="/dang-mach">`, người đã đăng nhập bấm trái thì mở ngăn kéo đăng nhanh. */

/** Ô soạn nhanh (desktop; ≤ 640px bị ẩn và nút dính đáy thay vào): một LINK tới `/dang-mach` — không
 * phải form mới. Riêng tư → công khai là MỘT CHIỀU, và mốc đã ghi sửa được nhưng để lại dấu vết
 * (GHI-CHU việc 7): nên câu phụ chỉ hứa đúng chừng ấy — và KHÔNG gợi ý riêng tư là mặc định (form
 * `/dang-mach` mặc định công khai). */
export function OSoanNhatKy() {
  return (
    <div className={css.soan_nhanh} data-testid="nhat-ky-soan-nhanh">
      <LoiVaoNhatKy className={css.o_soan} data-testid="nhat-ky-o-soan">
        Bạn vừa quyết định gì?
      </LoiVaoNhatKy>
      <div className={css.soan_dong}>
        <span className={css.goi_y}>Có thể ghi riêng tư, công khai khi bạn muốn.</span>
        <LoiVaoNhatKy className={css.nut_mo} data-testid="nut-mo-nhat-ky">
          Mở nhật ký
        </LoiVaoNhatKy>
      </div>
    </div>
  );
}

/** Mobile: nút dính đáy thay cho ô soạn nhanh. `sticky` trong khối chứa nó, nên nó tự nhả khi cuộn
 * qua hết khối ấy (trang chủ: khối nhật ký; trang lọc: cột nội dung). Desktop: ẩn bằng CSS. */
export function NutGhiNhatKyDinhDay() {
  return (
    <div className={css.dinh_day}>
      <LoiVaoNhatKy className={css.nut_ghi} data-testid="nut-ghi-nhat-ky-di-dong">
        <Plus size={16} strokeWidth={2.4} aria-hidden />
        Ghi nhật ký
      </LoiVaoNhatKy>
    </div>
  );
}
