import Link from "next/link";

import css from "./chrome.module.css";

/** Thanh trên cùng. Cố tình tối giản: 1c chưa có auth (Phase 2), nên không có ô đăng
 * nhập giả để bấm vào không đi đâu. */
export function Chrome() {
  return (
    <header className={css.chrome}>
      <div className={css.trong}>
        <Link href="/" className={css.hieu}>
          gikky
        </Link>
        <nav className={css.dieu_huong}>
          <Link href="/s/chung-khoan">Chứng khoán</Link>
          <Link href="/s/crypto">Crypto</Link>
          <Link href="/luat">Luật</Link>
        </nav>
      </div>
    </header>
  );
}
