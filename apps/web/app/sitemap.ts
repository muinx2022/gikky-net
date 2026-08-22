import type { MetadataRoute } from "next";

import { docCacSub, docFeed } from "@/lib/api";
import { urlTuyetDoi } from "@/lib/site";
import { duyetFeedTheoTrang } from "@/lib/sitemap";
import { duongDanMach, duongDanSub } from "@/lib/url";

// Sinh lúc có request, không lúc build: xem ghi chú ở `app/m/[slugId]/page.tsx`.
export const dynamic = "force-dynamic";

/** Trần số trang feed sẽ đi qua. 40 × 50 = 2000 URL — quá con số đó thì sitemap phải
 * tách thành sitemap index, và đó là việc của lúc thật sự có ngần ấy mạch. Có trần là
 * để một cursor lỗi không biến trang này thành vòng lặp vô hạn.
 *
 * Chạm trần **ném `LoiTranTrang`** chứ không cắt im lặng — xem `lib/sitemap.ts` (nợ #11).
 */
const TRAN_TRANG = 40;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Danh sách sub hỏi `GET /subs`, KHÔNG ghi cứng (PLAN mục 7 — xem `docCacSub`). Hằng
  // `SUB_KHOI_DIEM` cũ nuôi cả file này lẫn sidebar, nên sub thứ ba mở ra là vắng mặt ở
  // cả hai chỗ cùng lúc: sitemap teo đi một URL sống mà vẫn 200, đúng loài hỏng mà nợ
  // #11 ngay dưới vừa được vá để diệt.
  const cac_sub = await docCacSub();
  const trang: MetadataRoute.Sitemap = [
    { url: urlTuyetDoi("/"), changeFrequency: "hourly", priority: 1 },
    { url: urlTuyetDoi("/luat"), changeFrequency: "monthly", priority: 0.3 },
    ...cac_sub.map((s) => ({
      url: urlTuyetDoi(duongDanSub(s.slug)),
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
  ];

  // Không có nhánh `if (feed === null) break;` nữa (vá F1): `docFeed` ném khi API hỏng.
  // Nhánh cũ làm `sitemap.xml` **âm thầm teo còn 4 URL tĩnh** — vẫn 200, vẫn hợp lệ XML,
  // không gì đỏ. Với sản phẩm sống bằng index (PLAN mục 1), đó là mất sạch mạch khỏi
  // Google mà không ai biết; 500 ở đây là cái Search Console báo được.
  //
  // Vòng lật nằm ở `lib/sitemap.ts` để đo được mà không cần mạng, và để cái trần cũng
  // biết kêu — nợ #11, cùng lý lẽ với đoạn trên.
  const items = await duyetFeedTheoTrang(
    async (cursor) => (await docFeed("moi", { cursor, limit: 50 })).du_lieu,
    TRAN_TRANG,
  );
  for (const m of items) {
    trang.push({
      url: urlTuyetDoi(duongDanMach(m.slug, m.id)),
      // `last_entry_at` chứ không `created_at`: mốc mới là nội dung mới, và mặt CẶN
      // của một mạch đã đóng chính là thứ PLAN mục 1 muốn Google index.
      lastModified: new Date(m.last_entry_at),
      changeFrequency: m.status === "closed" ? "yearly" : "daily",
      priority: 0.8,
    });
  }

  return trang;
}
