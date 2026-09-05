import { docFeedSub, docSub } from "@/lib/api";
import { DAU_TRANG_RSS, SO_MUC_RSS, dungRss, moTaMuc } from "@/lib/rss";
import { urlTuyetDoi } from "@/lib/site";
import { duongDanMach, duongDanSub } from "@/lib/url";

/** `/s/<sub>/feed.xml` — RSS 2.0 của một chuyên mục. Cùng luật với `/feed.xml`; khác
 * đúng bộ lọc `?sub=` và cái tiêu đề kênh.
 *
 * Slug lạ ⇒ **404 thật**, không phải một feed rỗng: `docFeedSub` quy `sub_khong_ton_tai`
 * về `null`, và một kênh 200-nhưng-rỗng dạy trình đọc rằng chuyên mục có tồn tại và vừa
 * hết bài.
 *
 * Trả `Response` 404 trần chứ không `notFound()`: `not-found.tsx` là một trang HTML, mà
 * cái đang gọi URL này là một trình đọc feed — nó chỉ cần con số.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _yeu_cau: Request,
  { params }: { params: Promise<{ sub: string }> },
) {
  const { sub } = await params;
  // Hai nguồn 404 độc lập, hỏi cả hai — cùng lý lẽ với `app/s/[sub]/page.tsx`: chỉ hỏi
  // feed thì sub bị xoá giữa hai lời gọi cho ra header `null` rồi nổ ở dòng dựng XML.
  const [{ du_lieu: feed }, chi_tiet] = await Promise.all([
    docFeedSub(sub, "moi", { limit: SO_MUC_RSS }),
    docSub(sub),
  ]);
  if (feed === null || chi_tiet === null) {
    return new Response("Không có chuyên mục này.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const xml = dungRss({
    tieuDe: `gikky.net · s/${chi_tiet.slug} — ${chi_tiet.ten}`,
    moTa: chi_tiet.mo_ta,
    lienKet: urlTuyetDoi(duongDanSub(chi_tiet.slug)),
    tuLienKet: urlTuyetDoi(`${duongDanSub(chi_tiet.slug)}/feed.xml`),
    muc: feed.items.map((m) => ({
      tieuDe: m.title,
      lienKet: urlTuyetDoi(duongDanMach(m.slug, m.id)),
      moTa: moTaMuc(m),
      ngay: new Date(m.published_at),
    })),
  });

  return new Response(xml, { headers: DAU_TRANG_RSS });
}
