import type { MetadataRoute } from "next";

import { docFeed } from "@/lib/api";
import { urlTuyetDoi } from "@/lib/site";
import { duongDanMach, duongDanSub } from "@/lib/url";

// Sinh lúc có request, không lúc build: xem ghi chú ở `app/m/[slugId]/page.tsx`.
export const dynamic = "force-dynamic";

/** Trần số trang feed sẽ đi qua. 40 × 50 = 2000 URL — quá con số đó thì sitemap phải
 * tách thành sitemap index, và đó là việc của lúc thật sự có ngần ấy mạch. Có trần là
 * để một cursor lỗi không biến trang này thành vòng lặp vô hạn. */
const TRAN_TRANG = 40;

/** Sub khởi điểm — PLAN mục 1. v1 tạo tay qua admin nên chưa có endpoint liệt kê sub;
 * ghi cứng ở đây và ghi luôn lý do, thay vì để sitemap thiếu hai trang chuyên mục. */
const SUB_KHOI_DIEM = ["chung-khoan", "crypto"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const trang: MetadataRoute.Sitemap = [
    { url: urlTuyetDoi("/"), changeFrequency: "hourly", priority: 1 },
    { url: urlTuyetDoi("/luat"), changeFrequency: "monthly", priority: 0.3 },
    ...SUB_KHOI_DIEM.map((s) => ({
      url: urlTuyetDoi(duongDanSub(s)),
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
  ];

  let cursor: string | undefined;
  for (let i = 0; i < TRAN_TRANG; i += 1) {
    // Không có nhánh `if (feed === null) break;` nữa (vá F1): `docFeed` ném khi API hỏng.
    // Nhánh cũ làm `sitemap.xml` **âm thầm teo còn 4 URL tĩnh** — vẫn 200, vẫn hợp lệ XML,
    // không gì đỏ. Với sản phẩm sống bằng index (PLAN mục 1), đó là mất sạch mạch khỏi
    // Google mà không ai biết; 500 ở đây là cái Search Console báo được.
    const { du_lieu: feed } = await docFeed("moi", { cursor, limit: 50 });
    for (const m of feed.items) {
      trang.push({
        url: urlTuyetDoi(duongDanMach(m.slug, m.id)),
        // `last_entry_at` chứ không `created_at`: mốc mới là nội dung mới, và mặt CẶN
        // của một mạch đã đóng chính là thứ PLAN mục 1 muốn Google index.
        lastModified: new Date(m.last_entry_at),
        changeFrequency: m.status === "closed" ? "yearly" : "daily",
        priority: 0.8,
      });
    }
    if (feed.cursor_ke_tiep === null) break;
    cursor = feed.cursor_ke_tiep;
  }

  return trang;
}
