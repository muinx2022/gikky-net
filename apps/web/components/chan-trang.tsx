import Link from "next/link";

import { DISCLAIMER_CHAN_TRANG } from "@/lib/phap-ly";

import css from "./chan-trang.module.css";

/** Footer disclaimer — PLAN 5.10. Nằm ở cột phải trang web. */
export function ChanTrang() {
  return (
    <footer className={css.chan} data-testid="chan-trang">
      <div className={css.trong}>
        <p className={css.disclaimer} data-testid="disclaimer">
          {DISCLAIMER_CHAN_TRANG}
        </p>
        <nav className={css.lien_ket}>
          <Link href="/luat" prefetch={false}>Luật cộng đồng</Link>
          <Link href="/" prefetch={false}>Trang chủ</Link>
        </nav>
      </div>
    </footer>
  );
}
