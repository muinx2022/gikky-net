import { DISCLAIMER_CHAN_TRANG } from "@/lib/phap-ly";

import css from "./chan-trang.module.css";

/** Footer disclaimer — PLAN 5.10. Nằm ở cột phải trang web.
 *
 * Chỉ còn dòng miễn trừ *(việc 14, đợt E — plan §4.7 "Bớt lặp")*. Hai link cũ "Luật cộng đồng" và
 * "Trang chủ" là bản thứ ba / thứ hai của cùng một đích trên mọi trang: khối "Luật rút gọn" ngay
 * trên đã dẫn `/luat` (đủ PLAN 5.10), logo header dẫn `/` — và "Trang chủ" còn nằm ngay trên `/`. */
export function ChanTrang() {
  return (
    <footer className={css.chan} data-testid="chan-trang">
      <p className={css.disclaimer} data-testid="disclaimer">
        {DISCLAIMER_CHAN_TRANG}
      </p>
    </footer>
  );
}
