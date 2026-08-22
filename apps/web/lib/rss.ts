/** Dựng RSS 2.0 — Phase 6, PLAN mục 10 ("RSS mạch").
 *
 * **Hàm thuần, không chạm mạng**: hai route `app/feed.xml/route.ts` và
 * `app/s/[sub]/feed.xml/route.ts` chỉ lo lấy dữ liệu rồi gọi `dungRss`. Nhờ vậy toàn bộ
 * phần dễ sai — thoát ký tự, định dạng ngày, thứ tự thẻ — đo được ở `e2e:don-vi`, không
 * cần cổng nào.
 *
 * **Vì sao tự ghép chuỗi thay vì thêm một thư viện:** RSS 2.0 là bảy cái thẻ, và cái
 * nguy hiểm duy nhất trong nó là phép thoát ký tự — thứ mà một thư viện cũng chỉ làm
 * đúng chừng đó. Đổi lại là không thêm một phụ thuộc runtime vào `apps/web` cho một
 * endpoint mỗi giờ được gọi vài lần.
 */

/** Ký tự **không hợp lệ trong XML 1.0** ở mọi ngữ cảnh, kể cả khi đã escape.
 *
 * `&#x1;` không phải cách cứu một byte điều khiển — nó vẫn là tài liệu XML hỏng. Cách
 * duy nhất đúng là bỏ hẳn ký tự đó đi. Đường ghi của Phase 2 chưa lọc chúng khỏi `title`
 * `/ket_qua`, nên chỗ này là lớp cuối cùng trước khi một byte U+0001 do ai đó dán vào
 * làm **cả feed** không parse được (không phải một item — cả feed).
 */
// Viết bằng `\uXXXX` chứ không dán ký tự thật vào nguồn: một byte 0x01 nằm trong file
// `.ts` là thứ không editor nào hiện ra, và nó làm chính file này thành "binary" với
// `grep`. (Không kèm `eslint-disable no-control-regex`: bộ luật của `eslint-config-next`
// không bật rule đó, và một directive thừa lại LÀ một warning — mốc là 0 warning.)
const KY_TU_CAM = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

/** Thoát một chuỗi để nhét vào **nội dung phần tử hoặc giá trị thuộc tính** XML.
 *
 * Thoát cả `"` và `'` dù nội dung phần tử không cần: một hàm dùng được ở cả hai chỗ thì
 * không có chỗ nào để nhớ nhầm. `&` phải đi TRƯỚC, nếu không nó thoát lại chính dấu `&`
 * của bốn thực thể vừa sinh ra.
 */
export function thoatXml(s: string): string {
  return s
    .replace(KY_TU_CAM, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** `pubDate` theo RFC 822 — `Sat, 22 Aug 2026 08:00:00 GMT`.
 *
 * `toUTCString()` cho đúng dạng đó và **không phụ thuộc locale của máy chủ**, khác hẳn
 * `toLocaleString`. Múi giờ sản phẩm là Asia/Ho_Chi_Minh (PLAN mục 1) nhưng RSS là giao
 * thức máy đọc: mọi trình đọc quy về UTC rồi hiển thị theo múi giờ của người dùng, nên
 * đổi sang giờ VN ở đây chỉ thêm một chỗ sai được.
 *
 * **Ngày hỏng thì NÉM.** `new Date("rác").toUTCString()` trả `"Invalid Date"` — một chuỗi
 * lọt vào XML êm ru, hợp lệ về cú pháp, và làm mọi trình đọc bỏ qua item đó **im lặng**.
 */
export function ngayRfc822(ngay: Date): string {
  if (Number.isNaN(ngay.getTime())) {
    throw new TypeError("RSS: pubDate không phải một mốc thời gian hợp lệ.");
  }
  return ngay.toUTCString();
}

export type MucRss = {
  tieuDe: string;
  /** URL **tuyệt đối** của trang HTML tương ứng. Cũng dùng làm `guid`. */
  lienKet: string;
  moTa: string;
  ngay: Date;
};

export type KenhRss = {
  tieuDe: string;
  moTa: string;
  /** URL tuyệt đối của trang HTML mà feed này nói về. */
  lienKet: string;
  /** URL tuyệt đối của CHÍNH file feed — `<atom:link rel="self">`. Thiếu nó thì các
   * trình kiểm feed báo cảnh báo và một số dịch vụ không tự khám phá được. */
  tuLienKet: string;
  muc: readonly MucRss[];
};

/** Header của cả hai route feed.
 *
 * `s-maxage` chứ không `max-age`: trình đọc RSS poll rất chăm, nhưng cache đứng trước
 * (Caddy/CDN) mới là chỗ đỡ tải — trình duyệt của người dùng gần như không mở URL này
 * hai lần.
 *
 * Hằng này nằm ở đây chứ không cạnh chỗ dùng vì **Next kiểm bề mặt export của
 * `route.ts`**: một hằng lạ trong file đó là lỗi build, không phải một cảnh báo.
 */
export const DAU_TRANG_RSS: Readonly<Record<string, string>> = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600",
};

/** Số mạch tối đa trong một feed. 30 là mức các trình đọc quen thuộc — đủ để người mới
 * đăng ký thấy có nội dung, đủ nhỏ để feed không thành một bản sao của cả database. */
export const SO_MUC_RSS = 30;

export function dungRss(kenh: KenhRss): string {
  const dong = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${thoatXml(kenh.tieuDe)}</title>`,
    `    <link>${thoatXml(kenh.lienKet)}</link>`,
    `    <description>${thoatXml(kenh.moTa)}</description>`,
    "    <language>vi</language>",
    `    <atom:link href="${thoatXml(kenh.tuLienKet)}" rel="self" type="application/rss+xml"/>`,
  ];
  for (const m of kenh.muc) {
    dong.push(
      "    <item>",
      `      <title>${thoatXml(m.tieuDe)}</title>`,
      `      <link>${thoatXml(m.lienKet)}</link>`,
      // `isPermaLink="true"` là mặc định của RSS, nhưng viết ra thì trình đọc không phải
      // đoán — và ở đây nó đúng: `guid` chính là URL của trang mạch, một URL bền theo
      // PLAN 5.9 (slug đổi thì `id` vẫn thế, và trang cũ 308 về dạng chuẩn).
      `      <guid isPermaLink="true">${thoatXml(m.lienKet)}</guid>`,
      `      <pubDate>${ngayRfc822(m.ngay)}</pubDate>`,
      `      <description>${thoatXml(m.moTa)}</description>`,
      "    </item>",
    );
  }
  dong.push("  </channel>", "</rss>", "");
  return dong.join("\n");
}

/** Một dòng mô tả cho item RSS.
 *
 * Feed API (`MachTomTatOut`) **không trả `body`**, nên không có cách nào lấy đoạn mở đầu
 * của mốc 1 mà không gọi thêm một request cho từng mạch — 30 request cho một feed. Mô tả
 * vì thế là các con số của thẻ feed, đúng những gì trang danh sách hiện: kết quả (nếu đã
 * đóng sổ), số mốc, số bình luận, tác giả.
 */
export function moTaMuc(mach: {
  ket_qua: string | null;
  entry_count: number;
  comment_count: number;
  author: { username: string };
}): string {
  const manh = [
    mach.ket_qua,
    `${mach.entry_count} mốc`,
    `${mach.comment_count} bình luận`,
    `u/${mach.author.username}`,
  ];
  return manh.filter((x): x is string => typeof x === "string" && x !== "").join(" · ");
}
