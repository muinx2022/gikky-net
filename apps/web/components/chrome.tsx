import Link from "next/link";

import css from "./chrome.module.css";

/** Thanh trên cùng. Cố tình tối giản: 1c chưa có auth (Phase 2), nên không có ô đăng
 * nhập giả để bấm vào không đi đâu.
 *
 * ⚠ **NỢ: hai slug dưới đây được GHI CỨNG, và PLAN mục 7 cấm chuyện đó** *(W13, lượt vá
 * 2 — nợ ghi tại chỗ, không phải ở spec khác)*. Hậu quả thật, không phải lý thuyết: mở
 * sub thứ ba qua admin thì **nó vắng mặt trên thanh nav của MỌI trang**, im lặng, 200 ở
 * mọi cửa; đổi slug trong admin thì mục ở đây trỏ vào 404.
 *
 * `lib/api.ts::docCacSub` đã hỏi `GET /subs` cho sidebar và `sitemap.xml`, nhưng thành
 * phần này **chưa** chuyển sang được: nó nằm trong layout gốc nên nó render cả trên
 * `/luat`, mà `/luat` phải là route TĨNH không gọi API — nó là đường thoát của
 * `error.tsx`/`global-error.tsx` (nợ #14). Một lời gọi API ở đây làm đường thoát hỏng
 * cùng lúc với thứ nó thoát khỏi; `pnpm build` xác nhận `/luat` đang là `○` (tĩnh).
 *
 * **Gỡ được ở Phase 3** khi có nguồn danh sách sub không đi qua request: ISR / cache
 * build-time cho `GET /subs` (PLAN 8.4), hoặc tách nav ra khỏi layout gốc. Giấy miễn trừ
 * tương ứng nằm ở `e2e/don-vi/khong-ghi-cung-sub.spec.ts::CHUA_CHUYEN_DUOC` — gỡ nợ thì
 * phải xoá cả hai chỗ, hàng rào ở đó đỏ nếu chỉ xoá một.
 */
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
