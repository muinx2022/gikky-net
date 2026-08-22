import type { MachChiTietOut } from "@gikky/api-client";

import css from "./banner-mach.module.css";

/** Banner đầu mặt CẶN — PLAN 5.5, wireframe 9.2:
 *
 *     MẠCH ĐÃ ĐÓNG · +18.2% · 163 ngày · 9 mốc
 *                    └────────┬────────┘
 *                        Mach.ket_qua — **ẩn hẳn khi NULL**
 *
 * Ba nhánh, không phải hai:
 *
 * - `entry_count === 1` ⇒ **BÀI THƯỜNG**. PLAN nguyên tắc 1 chốt post thường là mặc
 *   định và "UI mạch bật từ mốc 2" (5.1) — gọi một bài một mốc là "mạch đang mở" là dán
 *   từ vựng mạch lên thứ chưa phải mạch. Ca này cũng không hiện "1 mốc": đó là con số
 *   duy nhất nó có thể có, nói ra không thêm thông tin gì.
 * - mạch đã đóng ⇒ MẠCH ĐÃ ĐÓNG;
 * - mạch còn mở ⇒ MẠCH ĐANG MỞ.
 *
 * `ket_qua` render **có điều kiện trên `!== null`**, không phải render rỗng: chuỗi rỗng
 * vẫn để lại dấu `·` lơ lửng và một ô trống mà người đọc không biết đang thiếu gì.
 */
export function BannerMach({
  mach,
}: {
  mach: Pick<MachChiTietOut, "entry_count" | "ket_qua" | "status">;
}) {
  const la_bai_thuong = mach.entry_count === 1;
  const trang_thai = la_bai_thuong
    ? "Bài thường"
    : mach.status === "closed"
      ? "Mạch đã đóng"
      : "Mạch đang mở";

  return (
    <p className={css.banner} data-testid="banner">
      <span className={css.trang_thai} data-testid="banner-trang-thai">
        {trang_thai}
      </span>
      {mach.ket_qua !== null && (
        <>
          <span className={css.cham} aria-hidden>
            ·
          </span>
          <span className={css.ket_qua} data-testid="banner-ket-qua">
            {mach.ket_qua}
          </span>
        </>
      )}
      {!la_bai_thuong && (
        <>
          <span className={css.cham} aria-hidden>
            ·
          </span>
          <span data-testid="banner-so-moc">{mach.entry_count} mốc</span>
        </>
      )}
    </p>
  );
}
