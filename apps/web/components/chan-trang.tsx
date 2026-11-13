import { namBanQuyen } from "@/lib/ban-quyen";
import { DISCLAIMER_CHAN_TRANG } from "@/lib/phap-ly";

import css from "./chan-trang.module.css";

/** Footer disclaimer — PLAN 5.10. Nằm ở cột phải trang web.
 *
 * Hai dòng chữ, KHÔNG link nào. Hai link cũ "Luật cộng đồng" và "Trang chủ" bỏ ở việc 14 (đợt E —
 * plan §4.7 "Bớt lặp"): chúng là bản thứ ba / thứ hai của cùng một đích trên mọi trang — khối
 * "Luật rút gọn" ngay trên đã dẫn `/luat` (đủ PLAN 5.10), logo header dẫn `/`, và "Trang chủ"
 * còn nằm ngay trên `/`.
 *
 * Dòng bản quyền `© {năm} gikky.net` đứng TRÊN dòng miễn trừ, không link *(việc 19, plan
 * `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.3)*: dòng miễn trừ phải là phần tử cuối của chân
 * trang (bài đo L1 của `trang-chu-v2.spec.ts` và `mobile-390.spec.ts` đo trên nó). */
export function ChanTrang() {
  return (
    <footer className={css.chan} data-testid="chan-trang">
      <p className={css.ban_quyen} data-testid="ban-quyen">
        © {namBanQuyen(new Date())} gikky.net
      </p>
      <p className={css.disclaimer} data-testid="disclaimer">
        {DISCLAIMER_CHAN_TRANG}
      </p>
    </footer>
  );
}
