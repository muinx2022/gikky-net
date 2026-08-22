import type { MetadataRoute } from "next";

import { urlTuyetDoi } from "@/lib/site";

/** `/robots.txt` — vá C5 (2026-08-22).
 *
 * Repo không có file này cho tới đợt vá, nên `sitemap.xml` **không được khai ở đâu cả**:
 * con bot chỉ tìm thấy nó nếu ai đó submit tay trong Search Console. Với sản phẩm mà mặt
 * CẶN chính là thứ để Google index (PLAN mục 1), đó là bỏ quên một nửa việc SEO.
 *
 * **Không `Disallow: /chan-doan`** (vá F4, 2026-08-22 — bản C5 có, và nó SAI). Trang chẩn
 * đoán mang `robots: noindex` ở chính nó, và hai thứ đó không bổ trợ nhau: `Disallow` làm
 * bot **không tải trang**, nên nó không bao giờ đọc được thẻ `noindex`. Đó đúng là ca
 * Google ghi rõ — URL bị chặn crawl vẫn lên index dạng URL trần nếu có link trỏ tới, vì
 * chỉ dòng `Disallow` là thứ bot đọc được về URL đó. Hai lớp hoá ra là một lớp phá lớp
 * kia, và lớp bị phá lại là lớp mạnh hơn.
 *
 * Bản C5 khẳng định ngược lại trong chính docstring của nó. Hậu quả thật lúc đó bằng 0
 * (không file nào link tới `/chan-doan`), nhưng chữ sai đã ở lại — nên sửa cả cơ chế lẫn
 * lời giải thích.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: urlTuyetDoi("/sitemap.xml"),
  };
}
