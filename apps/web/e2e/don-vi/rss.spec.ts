import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import {
  DAU_TRANG_RSS,
  SO_MUC_RSS,
  dungRss,
  moTaMuc,
  ngayRfc822,
  thoatXml,
} from "../../lib/rss";
import { boChuThich } from "./quet";
import { kiemXml, laXmlHopLe } from "./xml";

const WEB = resolve(__dirname, "..", "..");

/** Hàng rào cho RSS (Phase 6 — PLAN mục 10: *"RSS mạch"*).
 *
 * Cả feed đi qua MỘT hàm thuần `dungRss`, nên toàn bộ phần dễ sai đo được ở đây, không
 * cần cổng nào: một feed hỏng cú pháp là **cả kênh** biến mất khỏi mọi trình đọc, không
 * phải một item — và nó hỏng êm ru, HTTP vẫn 200.
 *
 * Bài chống mutant của nhóm này: `KHONG_THAN_THIEN` bên dưới nhét đúng những ký tự phá
 * XML vào mọi trường. Bỏ phép thoát trong `lib/rss.ts::thoatXml` ⇒ `kiemXml` ĐỎ.
 */

const NGAY = new Date("2026-08-22T01:00:00Z");

/** Dữ liệu cố tình xấu tính: dấu `&`, `<`, `>`, nháy đơn, nháy kép, và một byte điều
 * khiển U+0001 — đúng bộ ký tự mà một tiêu đề mạch người dùng gõ có thể mang. */
const KHONG_THAN_THIEN = {
  tieuDe: `M&M < 5% "rẻ" & 'ngon' \u0001`,
  moTa: "R&D > 3 & <b>đậm</b>",
  lienKet: "https://gikky.net/m/a-b-1?x=1&y=2",
  tuLienKet: "https://gikky.net/feed.xml?a=1&b=2",
};

function feedMau(so_muc = 2) {
  return dungRss({
    tieuDe: KHONG_THAN_THIEN.tieuDe,
    moTa: KHONG_THAN_THIEN.moTa,
    lienKet: "https://gikky.net/",
    tuLienKet: KHONG_THAN_THIEN.tuLienKet,
    muc: Array.from({ length: so_muc }, (_, i) => ({
      tieuDe: `${KHONG_THAN_THIEN.tieuDe} #${i}`,
      lienKet: `${KHONG_THAN_THIEN.lienKet}&i=${i}`,
      moTa: KHONG_THAN_THIEN.moTa,
      ngay: NGAY,
    })),
  });
}

/* ---- Trình kiểm XML phải biết nói "không" (chống hàng rào rỗng) ------------ */

test("kiemXml bắt được XML hỏng — nếu không, mọi bài dưới nghiệm đúng vô nghĩa", () => {
  expect(laXmlHopLe("<a><b></b></a>")).toBe(true);
  expect(laXmlHopLe("<a><b></a></b>"), "lồng sai thứ tự").toBe(false);
  expect(laXmlHopLe("<a><b></b>"), "thẻ chưa đóng").toBe(false);
  expect(laXmlHopLe("<a>M&M</a>"), "dấu & trần").toBe(false);
  expect(laXmlHopLe("<a>M&amp;M</a>")).toBe(true);
  expect(laXmlHopLe('<a href=1/>'), "thuộc tính không có nháy").toBe(false);
  expect(laXmlHopLe('<a href="x&y"/>'), "dấu & trần trong thuộc tính").toBe(false);
  expect(laXmlHopLe("<a>\u0001</a>"), "ký tự điều khiển").toBe(false);
  expect(laXmlHopLe("chỉ là văn bản"), "không có phần tử nào").toBe(false);
  // …và nó KHÔNG bắt nhầm những thứ RSS thật sự dùng.
  expect(laXmlHopLe('<?xml version="1.0"?><a><b x="1" y=\'2\'/><!-- ghi chú --></a>')).toBe(
    true,
  );
  expect(laXmlHopLe('<a x="1 &gt; 0"/>'), "dấu > trong giá trị thuộc tính").toBe(true);
});

/* ---- Feed sinh ra phải đúng cú pháp và đủ thẻ ------------------------------ */

test("feed với dữ liệu xấu tính vẫn là XML đúng cú pháp", () => {
  // Đây là bài chống mutant: bỏ `.replaceAll("&", "&amp;")` khỏi `thoatXml` là bài này ĐỎ.
  expect(() => kiemXml(feedMau())).not.toThrow();
});

test("kênh khai đủ title · link · description · language · atom:link self", () => {
  const xml = feedMau(0);
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(xml).toContain('<rss version="2.0"');
  expect(xml).toContain("<language>vi</language>");
  expect(xml).toContain('rel="self"');
  expect(xml).toContain('type="application/rss+xml"');
  // `atom:link` dùng namespace `atom`, nên nó phải được khai ở thẻ gốc.
  expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
  expect(xml).toContain("<link>https://gikky.net/</link>");
});

test("mỗi item có title · link · guid permalink · pubDate · description", () => {
  const xml = feedMau(3);
  expect(xml.split("<item>")).toHaveLength(4);
  expect(xml.split('<guid isPermaLink="true">')).toHaveLength(4);
  expect(xml.split("<pubDate>")).toHaveLength(4);
  // `guid` phải TRÙNG `link`: trình đọc dedupe theo `guid`, hai giá trị khác nhau là một
  // mạch hiện lại mỗi lần feed được sinh.
  const link = [...xml.matchAll(/<link>([^<]*)<\/link>/g)].map((m) => m[1]).slice(1);
  const guid = [...xml.matchAll(/<guid isPermaLink="true">([^<]*)<\/guid>/g)].map((m) => m[1]);
  expect(guid).toEqual(link);
});

test("ký tự nguy hiểm được thoát, ký tự điều khiển bị BỎ HẲN", () => {
  expect(thoatXml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &apos;");
  // `&` phải thoát TRƯỚC, nếu không nó thoát lại dấu `&` của bốn thực thể vừa sinh ra.
  expect(thoatXml("&lt;")).toBe("&amp;lt;");
  // `&#x1;` KHÔNG cứu được một byte điều khiển — XML 1.0 cấm nó ở mọi dạng.
  expect(thoatXml("a\u0001b")).toBe("ab");
  expect(thoatXml("a\u0000b")).toBe("ab");
  // Xuống dòng và tab thì HỢP LỆ, đừng vá quá tay mà bỏ luôn.
  expect(thoatXml("a\nb\tc")).toBe("a\nb\tc");
});

test("pubDate đúng RFC 822, và ngày hỏng thì NÉM chứ không lọt `Invalid Date`", () => {
  expect(ngayRfc822(NGAY)).toBe("Sat, 22 Aug 2026 01:00:00 GMT");
  expect(() => ngayRfc822(new Date("rác"))).toThrow(/pubDate/);
  // Vế chống nuốt: `"Invalid Date"` là một chuỗi lọt vào XML êm ru, hợp lệ về cú pháp, và
  // làm mọi trình đọc bỏ qua item đó IM LẶNG.
  expect(new Date("rác").toUTCString()).toBe("Invalid Date");
});

test("moTaMuc ghép đúng các con số của thẻ feed, bỏ ket_qua khi chưa đóng sổ", () => {
  const chung = { entry_count: 9, comment_count: 24, author: { username: "ba_muoi" } };
  expect(moTaMuc({ ...chung, ket_qua: "+18.2% · 163 ngày" })).toBe(
    "+18.2% · 163 ngày · 9 mốc · 24 bình luận · u/ba_muoi",
  );
  expect(moTaMuc({ ...chung, ket_qua: null })).toBe("9 mốc · 24 bình luận · u/ba_muoi");
});

/* ---- Hai route feed --------------------------------------------------------- */

const ROUTE_FEED = ["app/feed.xml/route.ts", "app/s/[sub]/feed.xml/route.ts"];

function doc(ten: string): string {
  return boChuThich(readFileSync(resolve(WEB, ten), "utf8"));
}

test("cả hai route feed dùng chung header và giới hạn số mục", () => {
  for (const ten of ROUTE_FEED) {
    const sach = doc(ten);
    expect(sach, `${ten} không dùng DAU_TRANG_RSS`).toContain("DAU_TRANG_RSS");
    expect(sach, `${ten} không kẹp số mục`).toMatch(/limit:\s*SO_MUC_RSS/);
    // `force-dynamic`: feed phải phản ánh mạch vừa đăng, không phải bản tiền dựng lúc build.
    expect(sach, `${ten} thiếu force-dynamic`).toContain("force-dynamic");
  }
  expect(DAU_TRANG_RSS["Content-Type"]).toBe("application/rss+xml; charset=utf-8");
  expect(SO_MUC_RSS).toBeGreaterThan(0);
});

test("feed của SUB trả 404 thật khi slug lạ (không phải một kênh rỗng 200)", () => {
  // Một kênh 200-nhưng-rỗng dạy trình đọc rằng chuyên mục có tồn tại và vừa hết bài — nó
  // sẽ không thử lại. Đây là đường 404 duy nhất trong hai route, nên nó phải có mặt.
  const sach = doc("app/s/[sub]/feed.xml/route.ts");
  expect(sach).toMatch(/status:\s*404/);
  expect(sach).toContain("docSub");
});

test("`/feed.xml` được KHAI ở `<head>` — không thì RSS chỉ tồn tại cho ai biết URL", () => {
  const layout = doc("app/layout.tsx");
  expect(layout).toContain("application/rss+xml");
  expect(layout).toContain("/feed.xml");
  // Trang sub phải trỏ feed RIÊNG của nó, không phải feed toàn site.
  const sub = doc("app/s/[sub]/page.tsx");
  expect(sub).toContain("application/rss+xml");
  expect(sub).toMatch(/\$\{duong_dan\}\/feed\.xml/);
});
