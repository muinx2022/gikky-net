import type { FeedOut } from "@gikky/api-client";
import Link from "next/link";

import { NHAN_TAB, TAB_FEED, type TabFeed } from "@/lib/api";

import { BaoCursorHong } from "./bao-cursor-hong";
import css from "./feed.module.css";
import { TheMach } from "./the-mach";

/** Feed hai tab — PLAN 5.9.
 *
 * **"Đang diễn ra" KHÔNG phải "Hot".** Nó sort theo `last_entry_at`, tức theo lúc tác
 * giả nối mốc, chứ không theo lượng tương tác. PLAN mục 4 đã loại hẳn cơ chế "mốc mới
 * bump bài lên feed Hot" vì động cơ ngược: tác giả băm "chốt 1/3" thành 3 mốc để ăn 3
 * lượt đẩy. Đừng thêm bất cứ trọng số nào vào đây.
 *
 * Trạng thái tab nằm trên URL (`?tab=`) chứ không trong state: feed là thứ người ta gửi
 * link cho nhau.
 */
export function Feed({
  feed,
  tab,
  coBan,
  tieuDe,
  lede,
  cursorHong = false,
}: {
  feed: FeedOut;
  tab: TabFeed;
  /** Đường dẫn gốc của feed: `/` hoặc `/s/<sub>`. */
  coBan: string;
  tieuDe: string;
  lede: string;
  /** `?cursor=` không dùng được ⇒ đang hiện trang đầu. Xem `lib/api.ts::TrangCursor`. */
  cursorHong?: boolean;
}) {
  const href = (t: TabFeed) => `${coBan}?tab=${t}`;

  return (
    <main className={css.khung}>
      <h1 className={css.tieu_de}>{tieuDe}</h1>
      <p className={css.lede}>{lede}</p>

      {cursorHong && <BaoCursorHong />}

      <nav className={css.tab} data-testid="tab-feed">
        {TAB_FEED.map((t) => (
          <Link
            key={t}
            href={href(t)}
            className={t === tab ? `${css.mot_tab} ${css.tab_dang_chon}` : css.mot_tab}
            aria-current={t === tab ? "page" : undefined}
            data-testid={`tab-${t}`}
          >
            {NHAN_TAB[t]}
          </Link>
        ))}
      </nav>

      {feed.items.length === 0 ? (
        <p className={css.rong} data-testid="feed-rong">
          Chưa có bài nào ở đây.
        </p>
      ) : (
        <ul className={css.danh_sach} data-testid="feed">
          {feed.items.map((m) => (
            <TheMach key={m.id} mach={m} />
          ))}
        </ul>
      )}

      {feed.cursor_ke_tiep !== null && (
        <Link
          className={css.xem_them}
          data-testid="feed-xem-them"
          href={`${coBan}?tab=${tab}&cursor=${encodeURIComponent(feed.cursor_ke_tiep)}`}
        >
          xem thêm ↓
        </Link>
      )}
    </main>
  );
}
