import Link from "next/link";

import { DISCLAIMER_CHAN_TRANG } from "@/lib/phap-ly";

import css from "./chan-trang.module.css";

/** Footer disclaimer — PLAN 5.10. Nằm trong `app/layout.tsx` nên có trên **MỌI** trang;
 * đó là yêu cầu, không phải tiện tay. */
export function ChanTrang() {
  return (
    <footer className={css.chan} data-testid="chan-trang">
      <div className={css.trong}>
        <p className={css.disclaimer} data-testid="disclaimer">
          {DISCLAIMER_CHAN_TRANG}
        </p>
        <nav className={css.lien_ket}>
          <Link href="/luat">Luật cộng đồng</Link>
          <Link href="/">Trang chủ</Link>
        </nav>
      </div>
    </footer>
  );
}
