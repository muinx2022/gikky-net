import type { FeedOut } from "@gikky/api-client";

/** Vòng lật feed của `app/sitemap.ts`, tách ra để đo được mà không cần mạng — nợ #11.
 *
 * **Chạm trần thì KÊU, không im lặng cắt phần còn lại.** Bản 1c `break` ngay khi hết
 * vòng: sitemap trả 200, XML hợp lệ, chỉ thiếu mọi mạch từ URL thứ 2001 trở đi. Với một
 * sản phẩm sống bằng index (PLAN mục 1) đó là mất traffic vĩnh viễn mà không ai biết —
 * cùng loài hỏng mà vá F1 vừa diệt ở chỗ `docFeed` trả `null`, và cách chữa ở đó cũng là
 * cách chữa ở đây: **để nó nổ**, vì 500 là thứ Search Console báo được còn "thiếu 3000
 * URL" thì không.
 *
 * Ném chứ không chỉ `console.error`: log trên server chỉ có người đang mở log mới thấy,
 * và cái cần thấy nằm ở phía Google. Trần 40 trang × 50 = 2000 URL — chạm nó nghĩa là đã
 * tới lúc tách sitemap index, một việc thật chứ không phải một cảnh báo để lờ đi.
 */
export class LoiTranTrang extends Error {
  constructor(readonly tranTrang: number, readonly soUrl: number) {
    super(
      `sitemap chạm trần ${tranTrang} trang feed (${soUrl} URL) mà API vẫn còn cursor. ` +
        "Phần còn lại sẽ bị bỏ im lặng — đã tới lúc tách sitemap index (PLAN mục 1: " +
        "sản phẩm sống bằng index, sitemap teo là mất traffic không ai thấy).",
    );
    this.name = "LoiTranTrang";
  }
}

/** Lật hết feed bằng cursor và gom `items`. Ném `LoiTranTrang` khi chạm trần mà chưa hết.
 *
 * `nap` nhận cursor của trang trước (`undefined` cho trang đầu) và trả một trang feed.
 */
export async function duyetFeedTheoTrang(
  nap: (cursor: string | undefined) => Promise<FeedOut>,
  tranTrang: number,
): Promise<FeedOut["items"]> {
  const ra: FeedOut["items"] = [];
  let cursor: string | undefined;
  for (let i = 0; i < tranTrang; i += 1) {
    const feed = await nap(cursor);
    ra.push(...feed.items);
    if (feed.cursor_ke_tiep === null) return ra;
    cursor = feed.cursor_ke_tiep;
  }
  throw new LoiTranTrang(tranTrang, ra.length);
}
