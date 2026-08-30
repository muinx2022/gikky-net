import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

const WEB = resolve(__dirname, "..", "..");

/** **Tìm kiếm phải có lối vào ở MỌI bề ngang màn hình** — lượt 2026-08-30.
 *
 * ## Bệnh mà nhóm bài này ghim lại
 *
 * `o-tim-kiem.module.css` ẩn hẳn ô tìm dưới **860px**, kèm một câu tự trấn an: *"Ẩn ô,
 * KHÔNG bỏ hẳn tính năng: trang `/tim-kiem` vẫn vào được"*. Câu ấy đúng về mặt chữ và sai
 * về mặt sản phẩm: `grep 'href="/tim-kiem'` trên cả `apps/web` ra **0 kết quả**, nên "vẫn
 * vào được" chỉ còn nghĩa là gõ tay URL. User báo đúng chuyện đó — *"xem trên mobile không
 * thấy search"*.
 *
 * ## Lối vào ĐỔI HÌNH DẠNG cuối cùng ngày 2026-08-30 — và bài đo đổi theo, CÓ CHỦ ĐÍCH
 *
 * Bản sáng là `<Link href="/tim-kiem">` trong `chrome.tsx`, và bài A cũ ghim đúng chuỗi
 * ấy. User yêu cầu tiếp: *"bấm icon kính lúp thì form xổ ngay tại chỗ"*. Nên nay nó là
 * `<button>` của `components/tim-kiem-mobile.tsx`, xổ một panel chứa chính `<OTimKiem/>`.
 *
 * **Viết lại bài đo vì hành vi đổi, không phải để lách rào.** Cái bất biến thì không đổi
 * một chữ, và nó là điều duy nhất đáng ghim: *ở mọi bề ngang màn hình, người dùng phải
 * với tới được tìm kiếm, và phải có đường ra trang kết quả đầy đủ*. Ba bài A dưới đây đo
 * lại đúng câu ấy trên hình dạng mới; ba bài B/C/D giữ nguyên vai trò cũ.
 *
 * ## Vì sao đo bằng cách ĐỌC NGUỒN chứ không mở trình duyệt
 *
 * Bài đo Playwright thật ở khung nhìn 375px kiểm được *"icon có hiện không"*, nhưng nó
 * **không** kiểm được thứ dễ trôi nhất: **ba** con số 860 ở **ba** file khác nhau có còn
 * bằng nhau không. Ai đổi mốc ẩn ô tìm sang 900 mà quên mốc hiện icon thì có một dải màn
 * hình 40px **không có cả hai** — đúng lại cái bệnh vừa vá, và một bài đo ở đúng 375px
 * vẫn xanh suốt. Nên ở đây: đọc cả ba file, so **MỘT** hằng số.
 *
 * ## Chống rỗng
 *
 * Cả hai phép tách (khối `@media` và luật CSS) là regex trên CSS **phẳng** — mọi
 * `.module.css` ở đây đều phẳng. Regex hỏng thì nó trả mảng rỗng, mà mảng rỗng làm mọi
 * khẳng định "không có vi phạm" nghiệm đúng một cách rỗng tuếch. Nên mỗi phép tách đều có
 * một bài đo tự chứng minh nó tách được — kể cả một bài chạy trên CSS dựng tay, để nó
 * không xanh chỉ nhờ file thật đang tình cờ hợp lệ.
 */

const CHROME_TSX = boChuThich(
  readFileSync(resolve(WEB, "components/chrome.tsx"), "utf8"),
);
const CHROME_CSS = boChuThich(
  readFileSync(resolve(WEB, "components/chrome.module.css"), "utf8"),
);
const O_TIM_CSS = boChuThich(
  readFileSync(resolve(WEB, "components/o-tim-kiem.module.css"), "utf8"),
);
const O_TIM_TSX = boChuThich(
  readFileSync(resolve(WEB, "components/o-tim-kiem.tsx"), "utf8"),
);
const MOBILE_TSX = boChuThich(
  readFileSync(resolve(WEB, "components/tim-kiem-mobile.tsx"), "utf8"),
);
const MOBILE_CSS = boChuThich(
  readFileSync(resolve(WEB, "components/tim-kiem-mobile.module.css"), "utf8"),
);

/** Một khối `@media` phẳng: điều kiện + thân. */
const KHOI_MEDIA = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g;
/** Một luật CSS phẳng: selector + khối khai báo. */
const LUAT = /([^{}]+)\{([^{}]*)\}/g;

type Luat = { chon: string; khai: string };

function docLuat(nguon: string): Luat[] {
  return [...nguon.matchAll(LUAT)].map((m) => ({
    chon: m[1].trim().replace(/\s+/g, " "),
    khai: m[2],
  }));
}

/** Luật nằm NGOÀI mọi khối `@media` — tức trạng thái mặc định. */
function luatGoc(nguon: string): Luat[] {
  return docLuat(nguon.replaceAll(KHOI_MEDIA, ""));
}

/** Mọi mốc `max-width` mà tại đó `<chon>` được khai báo khớp `<khai>`.
 *
 * Trả về MẢNG chứ không phải một số: hai khối media cùng đụng một selector là chuyện có
 * thật (`.trong` có ba mốc), và bài đo phải thấy được "đúng một mốc" thay vì lặng lẽ lấy
 * cái đầu tiên.
 */
function mocCua(nguon: string, chon: string, khai: RegExp): number[] {
  const ra: number[] = [];
  for (const k of [...nguon.matchAll(KHOI_MEDIA)]) {
    const so = /^\(\s*max-width:\s*(\d+)px\s*\)$/.exec(k[1].trim());
    if (so === null) continue;
    if (docLuat(k[2]).some((r) => r.chon === chon && khai.test(r.khai))) {
      ra.push(Number(so[1]));
    }
  }
  return ra;
}

const AN = /display:\s*none/;

test("A — `chrome.tsx` nhúng `TimKiemMobile` (lối vào DUY NHẤT khi ô tìm bị ẩn)", () => {
  // Nhúng **và** import: một chuỗi `<TimKiemMobile />` không có import là code không
  // biên dịch được, nhưng phép so thứ hai nói ra chỗ sai thay vì để `next build` nói.
  expect(CHROME_TSX, "chrome.tsx không còn nhúng lối vào tìm kiếm nào").toContain(
    "<TimKiemMobile />",
  );
  expect(CHROME_TSX).toMatch(/import\s*\{\s*TimKiemMobile\s*\}\s*from\s*"\.\/tim-kiem-mobile"/);
});

test("A — `TimKiemMobile` xổ ĐÚNG ô tìm chung, không phải một bản sao", () => {
  // Hai ô tìm kiếm là hai chỗ để logic debounce / huỷ request / phím ↑↓ trôi khỏi nhau,
  // và cái trôi ấy không kêu ở đâu cả. Quyết định 2 của user: **một** component, dùng ở
  // cả hai nơi.
  expect(MOBILE_TSX).toContain("<OTimKiem");
  expect(MOBILE_TSX).toMatch(/import\s*\{\s*OTimKiem\s*\}\s*from\s*"\.\/o-tim-kiem"/);
  // Nút phải là `<button>` có `aria-expanded`: một panel xổ ra mà không khai trạng thái
  // là một cái nút câm với trình đọc màn hình — và đây lại đúng là lối vào duy nhất của
  // tính năng ở khổ màn hình ấy.
  expect(MOBILE_TSX).toMatch(/<button\b/);
  expect(MOBILE_TSX).toContain("aria-expanded={mo}");
  expect(MOBILE_TSX).toMatch(/aria-label=/);
});

test("A — vẫn còn ĐƯỜNG RA `/tim-kiem` (kết quả đầy đủ, nơi duy nhất có bình luận)", () => {
  // Panel chỉ gợi ý **mạch**. Không có đường ra thì người tìm một câu bình luận đứng
  // trước một dropdown không bao giờ chứa thứ họ tìm, và không có gì nói cho họ biết.
  // Hai đường, cả hai phải còn: fallback noscript của form, và dòng "Xem tất cả".
  expect(O_TIM_TSX, "form mất `action` ⇒ mất luôn fallback khi JS chưa hydrate").toContain(
    'action="/tim-kiem"',
  );
  expect(O_TIM_TSX, "mất dòng 'Xem tất cả kết quả'").toMatch(
    /href=\{`\/tim-kiem\?q=\$\{encodeURIComponent\(/,
  );
  expect(O_TIM_TSX).toContain("Xem tất cả kết quả");
});

test("A — lối vào ấy KHÔNG kéo `chrome.tsx` sang client (`/luat` phải giữ route tĩnh)", () => {
  // Ràng buộc kiến trúc ghi ở docstring đầu `chrome.tsx`: header nằm trong layout gốc, nên
  // một `"use client"` ở đây làm `/luat` hết tĩnh — mà `/luat` là đường thoát của
  // `error.tsx`. State của panel sống trong `tim-kiem-mobile.tsx`, đúng vì lý do đó.
  expect(CHROME_TSX).not.toContain('"use client"');
  expect(CHROME_TSX).not.toMatch(/\buse(State|Effect|Router|SearchParams)\b/);
  // …và chỗ giữ state phải THẬT SỰ ở component kia, nếu không phép so trên chỉ nói rằng
  // không ai giữ state ở đâu cả.
  expect(MOBILE_TSX).toContain('"use client"');
  expect(MOBILE_TSX).toMatch(/\buseState\b/);
});

test("B — `tim-kiem-mobile.module.css` có ĐÚNG MỘT khối 860, đứng SAU luật gốc `.nut`", () => {
  // `display: inline-flex` trong khối media thắng `display: none` của luật gốc CHỈ nhờ
  // thứ tự nguồn (cùng specificity). Bản đầu (khi class còn ở `chrome.module.css`) có HAI
  // khối `max-width: 860px` trong file; phản biện 2026-08-30 dựng được ca "dọn dẹp" gộp
  // chúng về vị trí khối ĐẦU (trước luật gốc) — icon chết ở mọi bề ngang, build xanh, 6/6
  // bài khi ấy vẫn xanh. Hai phép so dưới đây đóng đúng cửa đó.
  const cac_moc = MOBILE_CSS.match(/max-width:\s*860px/g) ?? [];
  expect(cac_moc).toHaveLength(1);
  const luat_goc = MOBILE_CSS.indexOf(".nut");
  const khoi_860 = MOBILE_CSS.search(/@media \(max-width:\s*860px\)/);
  expect(luat_goc).toBeGreaterThan(-1);
  expect(khoi_860).toBeGreaterThan(luat_goc);
});

test("B — `chrome.module.css` cũng chỉ còn ĐÚNG MỘT khối 860", () => {
  // Nó không còn giữ `.nut_tim` (đã dời sang file của component sở hữu), nhưng nó vẫn
  // giữ hai luật cùng mốc — `.cho_o_tim` và `.trong`. Hai khối cùng mốc trong một file là
  // chỗ thứ tự nguồn đảo được mà không ai thấy.
  expect(CHROME_CSS.match(/max-width:\s*860px/g) ?? []).toHaveLength(1);
  // Và class cũ phải BIẾN MẤT hẳn: một `.nut_tim` mồ côi ở đây là luật chết mà người đọc
  // sau vẫn tin là đang chạy.
  expect(CHROME_CSS).not.toContain(".nut_tim");
});

test("B — icon ẩn MẶC ĐỊNH, chỉ hiện trong một khối media", () => {
  const goc = luatGoc(MOBILE_CSS).find((r) => r.chon === ".nut");
  expect(goc, "`.nut` không có luật gốc — phép tách luật đã hỏng").toBeDefined();
  expect(goc?.khai, "icon phải ẩn ở khổ màn hình rộng, nơi ô tìm còn đó").toMatch(AN);
  expect(mocCua(MOBILE_CSS, ".nut", /display:\s*inline-flex/)).toHaveLength(1);
});

test("B — MỘT mốc duy nhất: chỗ ẩn ô tìm và chỗ hiện icon là cùng con số", () => {
  // Đây là bài chính của file. Ba con số dưới đây nằm ở BA file khác nhau và không có gì
  // ngoài bài đo này buộc chúng bằng nhau; lệch một cái là có một dải bề ngang màn hình
  // không có lối vào tìm kiếm nào — đúng bệnh lượt 2026-08-30 vừa vá.
  const an_o_tim = mocCua(O_TIM_CSS, ".o", AN);
  const an_cho_giu = mocCua(CHROME_CSS, ".cho_o_tim", AN);
  const hien_icon = mocCua(MOBILE_CSS, ".nut", /display:\s*inline-flex/);

  expect(an_o_tim, "không tìm thấy mốc ẩn `.o` trong o-tim-kiem.module.css").toHaveLength(
    1,
  );
  expect(an_cho_giu).toHaveLength(1);
  expect(hien_icon).toHaveLength(1);

  expect(
    [an_cho_giu[0], hien_icon[0]],
    `mốc lệch nhau: ô tìm ẩn ở ${an_o_tim[0]}px, chỗ giữ ẩn ở ${an_cho_giu[0]}px, icon ` +
      `hiện ở ${hien_icon[0]}px — có dải màn hình không còn lối vào tìm kiếm`,
  ).toEqual([an_o_tim[0], an_o_tim[0]]);
});

test("B — trong panel mobile, ô tìm được GỠ ẨN ở đúng mốc ấy", () => {
  // Cửa hậu của chính luật trên: `.o { display: none }` dưới 860px cũng ẩn ô nằm TRONG
  // panel, tức bấm kính lúp ra một panel rỗng. Ghi đè phải nằm trong CÙNG khối media —
  // ngoài nó thì nó không bao giờ chạy, và panel rỗng ở mọi khổ mobile.
  expect(mocCua(O_TIM_CSS, ".o.trong_panel", /display:\s*flex/)).toEqual(
    mocCua(O_TIM_CSS, ".o", AN),
  );
  expect(O_TIM_TSX, "component không truyền cờ ⇒ class ghi đè không bao giờ gắn").toContain(
    "css.trong_panel",
  );
  expect(MOBILE_TSX).toContain("trongPanel");
});

test("C — vùng bấm của icon không nhỏ hơn các nút icon lân cận", () => {
  // T7/trợ năng: cụm phải đã cấm vùng bấm co dưới 44px trên màn hình cảm ứng
  // (`cong-tac-theme.module.css`). Icon mới đứng ngay cạnh nó, cùng luật.
  const coarse = [...MOBILE_CSS.matchAll(KHOI_MEDIA)].find((m) =>
    /\(\s*pointer:\s*coarse\s*\)/.test(m[1]),
  );
  expect(
    coarse,
    "không có khối `(pointer: coarse)` trong tim-kiem-mobile.module.css",
  ).toBeDefined();
  const r = docLuat(coarse?.[2] ?? "").find((x) => x.chon === ".nut");
  expect(r?.khai).toMatch(/width:\s*44px/);
  expect(r?.khai).toMatch(/height:\s*44px/);
});

test("D — hai phép tách CSS thật sự chạy (chống hàng rào rỗng)", () => {
  // Trên file thật: nếu regex trôi, mọi bài trên đỏ chứ không xanh — nhưng bài này nói
  // thẳng ra lý do thay vì để người đọc đoán.
  expect(luatGoc(CHROME_CSS).length).toBeGreaterThan(4);
  expect([...CHROME_CSS.matchAll(KHOI_MEDIA)].length).toBeGreaterThanOrEqual(3);
  expect(luatGoc(MOBILE_CSS).length).toBeGreaterThan(3);

  // Và trên CSS dựng tay, để hai hàm không thể xanh chỉ vì file thật đang tình cờ hợp lệ.
  const gia = ".x {\n  display: none;\n}\n\n@media (max-width: 700px) {\n  .x {\n    display: inline-flex;\n  }\n}\n";
  expect(luatGoc(gia).map((r) => r.chon)).toEqual([".x"]);
  expect(mocCua(gia, ".x", /display:\s*inline-flex/)).toEqual([700]);
  // …và nó KHÔNG khớp bừa một selector khác hay một khai báo khác.
  expect(mocCua(gia, ".y", /display:\s*inline-flex/)).toEqual([]);
  expect(mocCua(gia, ".x", AN)).toEqual([]);
});
