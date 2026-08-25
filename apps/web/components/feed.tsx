import type { FeedOut } from "@gikky/api-client";
import { Clock, Flame, Radio, type LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  KHOANG_FEED,
  KHOANG_MAC_DINH,
  NHAN_KHOANG,
  NHAN_TAB,
  TAB_FEED,
  tabCoKhoang,
  type KhoangFeed,
  type TabFeed,
} from "@/lib/api";

import { BaoCursorHong } from "./bao-cursor-hong";
import { ChonKieuXem } from "./chon-kieu-xem";
import css from "./feed.module.css";
import { TheMach } from "./the-mach";

/** Feed ba tab — PLAN 5.9 (Mới · Đang diễn ra) + plan con 1d §2.5.4 ("Nhiều điểm nhất").
 *
 * **"Đang diễn ra" KHÔNG phải "Hot".** Nó sort theo `last_entry_at`, tức theo lúc tác
 * giả nối mốc, chứ không theo lượng tương tác. PLAN mục 4 đã loại hẳn cơ chế "mốc mới
 * bump bài lên feed Hot" vì động cơ ngược: tác giả băm "chốt 1/3" thành 3 mốc để ăn 3
 * lượt đẩy. Đừng thêm bất cứ trọng số nào vào đây.
 *
 * **"Nhiều điểm nhất" cũng không phải Hot**: khoá của nó là điểm **bài gốc**, con số mà
 * nối thêm mốc không đụng tới — xem `lib/api.ts::TAB_FEED`.
 *
 * Toàn bộ trạng thái (tab, khoảng, cursor) nằm trên URL chứ không trong state: feed là
 * thứ người ta gửi link cho nhau, và PLAN nguyên tắc 7 cấm "tự đổi sort ngầm dưới tay
 * người dùng" — không có state ẩn thì không có chỗ nào để đổi ngầm.
 *
 * **Đổi tab thì RỚT `cursor`, và giữ `khoang`.** Cursor mang khoá sort của tab sinh ra nó
 * (API trả 400 `cursor_khong_hop_le` nếu đem sang tab khác), nên tha nó theo là biến một
 * cú bấm tab thành một trang lỗi. `khoang` thì không dính khoá nào — người đang xem "top
 * tuần" bấm sang tab khác rồi quay lại mà mất mốc thời gian là mất đúng thứ họ vừa chọn.
 *
 * **`khoang` đi theo URL ở MỌI tab, kể cả tab không bày ra nó** *(vá V2, 2026-08-22)*.
 * Bản đầu hỏi `tabCoKhoang(t)` của tab ĐÍCH ngay trong `duoi()`, nên `khoang` chỉ sống
 * sót khi tab đích là `nhieu-diem` — tức chỉ khi KHÔNG đổi tab, đúng ngược lại kịch bản
 * mà câu trên nói nó bảo vệ. Vòng `nhieu-diem&khoang=tuan` → `moi` → `nhieu-diem` rơi về
 * `tat_ca`.
 * ⚠ Mang theo URL **không phải** là gửi lên API: `lib/api.ts::khoangGuiLenApi` cắt
 * `khoang` ở tab không có control chọn khoảng. Gửi kèm là dựng một **bộ lọc tàng hình** —
 * feed bị cắt bớt mà trên màn hình không có gì nói ra và không có cách nào tắt, tức đâm
 * PLAN nguyên tắc 7 còn nặng hơn cái lỗi vừa vá.
 */
/** Đầu trang: **hoặc** một `header` riêng, **hoặc** cặp `tieuDe`/`lede` — không bao giờ
 * cả hai *(X9, lượt vá 3)*.
 *
 * Trước X9 cả ba là prop rời và `header` chỉ đơn giản thắng ở chỗ render, nên trang sub
 * truyền đủ ba: `tieuDe={`s/${slug}`}` và `lede={chi_tiet.mo_ta}` **không render ở đâu
 * cả**. Một bản sao thứ hai của `mo_ta` không ai đọc là thứ sẽ lệch khỏi bản thật ở lần
 * sửa sau, và người đọc `page.tsx` không có cách nào biết dòng nào là dòng có tác dụng.
 *
 * Union này biến chuyện đó thành lỗi biên dịch chứ không phải một quy ước: truyền cả hai
 * là `tsc` đỏ ngay tại chỗ gọi. Không thêm bài đo runtime nào cho luật này — kiểu là hàng
 * rào chặt hơn, và `pnpm build` đã chạy `tsc`.
 */
type DauTrang =
  | { header: React.ReactNode; tieuDe?: never; lede?: never }
  | { header?: undefined; tieuDe: string; lede: string };

/** Icon cho từng tab. Đọc từ NGHĨA của tab, không phải trang trí:
 * - `moi` = đồng hồ (mới theo thời gian);
 * - `dang-dien-ra` = sóng radio (đang phát — hợp "đang diễn ra", và cố ý KHÔNG phải ngọn
 *   lửa "hot": tab này sort theo lúc nối mốc, không theo tương tác, xem docstring trên);
 * - `nhieu-diem` = ngọn lửa (điểm cao). */
const ICON_TAB: Readonly<Record<TabFeed, LucideIcon>> = {
  moi: Clock,
  "dang-dien-ra": Radio,
  "nhieu-diem": Flame,
};

export function Feed({
  feed,
  tab,
  khoang,
  coBan,
  tieuDe,
  lede,
  cursorHong = false,
  sidebar,
  header,
}: {
  feed: FeedOut;
  tab: TabFeed;
  khoang: KhoangFeed;
  /** Đường dẫn gốc của feed: `/` hoặc `/s/<sub>`. */
  coBan: string;
  /** `?cursor=` không dùng được ⇒ đang hiện trang đầu. Xem `lib/api.ts::TrangCursor`. */
  cursorHong?: boolean;
  /** Cột phải. Bắt buộc có mặt — cả hai trang feed đều dựng nó. */
  sidebar: React.ReactNode;
} & DauTrang) {
  /** `?khoang=` đi kèm MỌI tab, nhưng chỉ khi khác mặc định: URL sạch thì link chia sẻ
   * đọc được, và `?khoang=tat_ca` không nói thêm gì so với việc thiếu nó.
   *
   * **Không hỏi `tabCoKhoang` ở đây** — xem docstring component. Hỏi nó tại chỗ này là
   * đánh rơi lựa chọn của người dùng ngay lúc họ bấm sang tab khác. Cửa "gửi lên API"
   * đóng ở `lib/api.ts`, không đóng bằng cách xoá tham số khỏi URL. */
  const duoi = (k: KhoangFeed) => (k !== KHOANG_MAC_DINH ? `&khoang=${k}` : "");
  const hrefTab = (t: TabFeed) => `${coBan}?tab=${t}${duoi(khoang)}`;
  const hrefKhoang = (k: KhoangFeed) => `${coBan}?tab=${tab}${duoi(k)}`;

  return (
    <div className={css.khung}>
      <main className={css.chinh}>
        {header ?? (
          <>
            <h1 className={css.tieu_de}>{tieuDe}</h1>
            <p className={css.lede}>{lede}</p>
          </>
        )}

        {cursorHong && <BaoCursorHong />}

        {/* Hàng tab và nút đổi kiểu xem đi CHUNG một hàng, đúng chỗ Reddit đặt chúng:
            cả hai đều nói về "danh sách này bày ra thế nào". `ChonKieuXem` tự đẩy mình
            sang phải bằng `margin-left: auto`. */}
        <div className={css.hang_dieu_khien}>
          <nav className={css.tab} data-testid="tab-feed" aria-label="Sắp xếp feed">
            {TAB_FEED.map((t) => {
              const Hinh = ICON_TAB[t];
              return (
                <Link
                  key={t}
                  href={hrefTab(t)}
                  className={
                    t === tab ? `${css.mot_tab} ${css.tab_dang_chon}` : css.mot_tab
                  }
                  aria-current={t === tab ? "page" : undefined}
                  data-testid={`tab-${t}`}
                >
                  <Hinh size={15} strokeWidth={2} aria-hidden />
                  {NHAN_TAB[t]}
                </Link>
              );
            })}
          </nav>
          <ChonKieuXem />
        </div>

        {tabCoKhoang(tab) && (
          <nav className={css.khoang} data-testid="chon-khoang" aria-label="Khoảng thời gian">
            {KHOANG_FEED.map((k) => (
              <Link
                key={k}
                href={hrefKhoang(k)}
                className={
                  k === khoang ? `${css.mot_khoang} ${css.khoang_dang_chon}` : css.mot_khoang
                }
                aria-current={k === khoang ? "true" : undefined}
                data-testid={`khoang-${k}`}
              >
                {NHAN_KHOANG[k]}
              </Link>
            ))}
          </nav>
        )}

        {feed.items.length === 0 ? (
          <p className={css.rong} data-testid="feed-rong">
            {tabCoKhoang(tab) && khoang !== KHOANG_MAC_DINH
              ? "Chưa có bài nào trong khoảng này."
              : "Chưa có bài nào ở đây."}
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
            href={`${hrefTab(tab)}&cursor=${encodeURIComponent(feed.cursor_ke_tiep)}`}
          >
            xem thêm ↓
          </Link>
        )}
      </main>

      {/* Rail phải DÍNH khi cuộn — plan giao diện §2.2.
          Bọc thêm một lớp thay vì đặt `position: sticky` lên chính `<Sidebar>`: hai trang
          feed truyền hai component khác nhau vào đây, và một luật bố cục thuộc về chỗ
          BỐ TRÍ chứ không thuộc về thứ được bố trí.

          ⚠ `<div>` chứ không `<aside>` *(sửa 2026-08-24)*: chú thích cũ ở đây nói
          `<Sidebar>` là "một `<div>`" — nay nó **đã là `<aside>`** (`sidebar.tsx`), nên
          bọc thêm một `<aside>` là hai landmark lồng nhau cho cùng một khối. Lớp bọc này
          chỉ còn làm đúng việc của nó: `position: sticky`. */}
      <div className={css.rail}>{sidebar}</div>
    </div>
  );
}
