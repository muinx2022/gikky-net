import { docFeed } from "@/lib/api";
import { DAU_TRANG_RSS, SO_MUC_RSS, dungRss, moTaMuc } from "@/lib/rss";
import { urlTuyetDoi } from "@/lib/site";
import { duongDanMach } from "@/lib/url";

/** `/feed.xml` — RSS 2.0 của feed "Mới" toàn site (Phase 6, PLAN mục 10).
 *
 * **Tab "Mới", không phải "Đang diễn ra".** RSS dedupe theo `guid`: một mạch đã nằm
 * trong feed thì mốc thứ hai của nó không làm nó hiện lại ở trình đọc, nên feed sắp theo
 * `last_entry_at` chỉ tạo ra một danh sách xáo trộn liên tục mà không ai thấy gì mới.
 * `published_at` (tab "Mới") là thứ hợp với giao thức này. Mốc mới của mạch đang theo là
 * việc của notification/digest (PLAN 5.8), không phải của RSS.
 *
 * Lỗi cấu trúc của API **không được nuốt**: `docFeed` ném thay vì trả `null` (vá F1), nên
 * Django chết cho ra 500 ở đây. Một feed rỗng nhưng 200 là cách các trình đọc lặng lẽ
 * kết luận "kênh này không còn bài nào" — và một số bỏ đăng ký.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { du_lieu: feed } = await docFeed("moi", { limit: SO_MUC_RSS });

  const xml = dungRss({
    tieuDe: "gikky.net — mạch mới",
    moTa:
      "Nhật ký giao dịch của người Việt: mỗi bài là một mạch, tác giả nối thêm mốc theo "
      + "thời gian thực với dấu thời gian máy chủ bất biến.",
    lienKet: urlTuyetDoi("/"),
    tuLienKet: urlTuyetDoi("/feed.xml"),
    muc: feed.items.map((m) => ({
      tieuDe: m.title,
      lienKet: urlTuyetDoi(duongDanMach(m.slug, m.id)),
      moTa: moTaMuc(m),
      ngay: new Date(m.published_at),
    })),
  });

  // Header nằm ở `lib/rss.ts`, KHÔNG khai ở đây: Next kiểm bề mặt export của `route.ts`
  // và một hằng lạ trong đó là lỗi build ("is not a valid Route export field").
  return new Response(xml, { headers: DAU_TRANG_RSS });
}
