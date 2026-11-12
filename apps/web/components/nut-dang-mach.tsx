"use client";

import { Plus } from "lucide-react";

import { useDrawerDangNhanh } from "./drawer-dang-nhanh";
import css from "./nut-dang-mach.module.css";
import { useDaHydrate, usePhien } from "./phien";

/** Lối vào trượt form đăng bài nhanh (kiểu Cloudflare) hoặc nối mốc nếu đang ở bài của mình.
 *
 * **Khách không thấy nút này**, và đó không phải sự keo kiệt: ngay cạnh nó đã có "Đăng
 * nhập" và "Đăng ký" (`ThanhTaiKhoan`).
 *
 * **Trong lúc chưa biết mình là ai thì giữ chỗ, không vẽ nút** — cùng lý lẽ với
 * `ThanhTaiKhoan`: chớp một cái nút rồi rút nó đi là cú nhảy bố cục ngay chỗ mắt người ta
 * nhìn đầu tiên.
 */
export function NutDangMach() {
  const { toi, dangTai } = usePhien();
  const daHydrate = useDaHydrate();
  const { moDrawer } = useDrawerDangNhanh();

  // Giữ chỗ tới khi `/me` trả lời. Trước hydrate cờ CSS `data-da-dang-nhap` định cỡ ô; sau hydrate
  // cờ ấy mất hễ có phiên lưu — thành viên và khách quay lại (lượt hydrate lệch #418 ⇒ React render lại root — đã đo, sổ P-20261111-21),
  // nên phiên ĐÃ LƯU (`fallbackData`) giữ cỡ thay nó — không thì ô sập về 0 rồi nút mới hiện, cụm
  // phải header giật hai lần (việc 14, đợt E; xem `useDaHydrate`). Sửa #418 thì xem lại để gỡ.
  if (!daHydrate || dangTai) {
    const giu = daHydrate && toi?.dang_nhap === true;
    return <span className={giu ? `${css.cho_nut} ${css.cho_nut_giu}` : css.cho_nut} aria-hidden />;
  }

  if (!(toi?.dang_nhap ?? false)) return null;

  return (
    <button
      type="button"
      onClick={moDrawer}
      className={css.nut}
      data-testid="nut-dang-mach"
      aria-label="Đăng bài nhanh"
      title="Đăng bài nhanh"
    >
      <Plus size={18} strokeWidth={2} aria-hidden />
    </button>
  );
}
