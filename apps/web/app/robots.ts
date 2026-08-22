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
 *
 * ## Vì sao `/m-phien/` **KHÔNG** bị `Disallow` — cùng bài học F4, lần thứ hai
 *
 * *(2026-08-23, Phase 3)* `/m-phien/<slug>-<id>` là **biến thể route dynamic** của trang
 * mạch, đích của một rewrite nội bộ trong `middleware.ts` (PLAN 8.4 điểm 1). Nó phục vụ
 * đúng nội dung của `/m/<slug>-<id>`, nên phản xạ đầu tiên là chặn crawl cho khỏi trùng
 * nội dung. **Phản xạ ấy sai, và sai đúng theo cách F4 đã ghi lại ở trên.**
 *
 * Thứ gộp hai URL về một là thẻ `canonical`, và nó nằm **trong HTML** của biến thể ấy
 * (`components/trang-mach.tsx` luôn trỏ canonical về `/m/…`). Một dòng `Disallow` làm bot
 * **không tải trang**, nên nó không bao giờ đọc được thẻ canonical — mà URL bị chặn vẫn
 * lên index dạng URL trần nếu có link trỏ tới. Lại là hai lớp mà lớp yếu phá lớp mạnh.
 *
 * Và nguy cơ thấp hơn nhiều so với vẻ ngoài: bot không có cookie phiên, nên `middleware.ts`
 * **không bao giờ** rewrite chúng sang đó. URL ấy chỉ tới tay ai đó cố tình gõ nó.
 *
 * ⇒ `robots.txt` giữ nguyên **không một `Disallow` nào**, và
 * `e2e/seo-va-trang.spec.ts::C5` là hàng rào cho chuyện đó.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: urlTuyetDoi("/sitemap.xml"),
  };
}
