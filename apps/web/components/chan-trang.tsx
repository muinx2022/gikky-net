import Link from "next/link";

import { DISCLAIMER_CHAN_TRANG } from "@/lib/phap-ly";

import css from "./chan-trang.module.css";
import { ChonGiaoDien } from "./chon-giao-dien";

/** Footer disclaimer — PLAN 5.10. Nằm trong `app/layout.tsx` nên có trên **MỌI** trang;
 * đó là yêu cầu, không phải tiện tay.
 *
 * ## Ô chọn giao diện ở ĐÂY, không ở `/cai-dat`
 *
 * *(2026-08-24)* Nút trên header thu về **hai** trạng thái Sáng ⇄ Tối để mỗi cú bấm luôn
 * đổi được cái gì nhìn thấy được (xem `cong-tac-theme.tsx`). Cái giá: bấm nó một lần là
 * ghim vào một theme cứng, không còn đường về "Theo hệ thống".
 *
 * Cửa lấy lại lựa chọn ấy **phải mở cho khách**, không được nằm sau đăng nhập: chính
 * người báo lỗi này đang **chưa đăng nhập**, và theme là tuỳ chọn của TRÌNH DUYỆT chứ
 * không phải của tài khoản — nó không nên đi qua một trang chỉ chủ tài khoản vào được.
 * Chân trang có mặt trên mọi trang, kể cả `/luat` (route tĩnh, đường thoát của
 * `error.tsx`), nên nó là chỗ duy nhất thoả cả hai.
 */
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
        <ChonGiaoDien />
      </div>
    </footer>
  );
}
