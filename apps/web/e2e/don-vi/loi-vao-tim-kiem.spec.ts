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
 * ## Vì sao đo bằng cách ĐỌC NGUỒN chứ không mở trình duyệt
 *
 * Bài đo Playwright thật ở khung nhìn 375px kiểm được *"icon có hiện không"*, nhưng nó
 * **không** kiểm được thứ dễ trôi nhất: hai con số 860 ở hai file khác nhau có còn bằng
 * nhau không. Ai đổi mốc ẩn ô tìm sang 900 mà quên mốc hiện icon thì có một dải màn hình
 * 40px **không có cả hai** — đúng lại cái bệnh vừa vá, và một bài đo ở đúng 375px vẫn xanh
 * suốt. Nên ở đây: đọc cả hai file, so **MỘT** hằng số.
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

test("A — `chrome.tsx` có link tới `/tim-kiem` (lối vào DUY NHẤT khi ô tìm bị ẩn)", () => {
  expect(CHROME_TSX, "cả app không còn link nào tới /tim-kiem").toContain(
    'href="/tim-kiem"',
  );
  // Không có nhãn thì nó là một icon câm với người dùng trình đọc màn hình — mà đây lại
  // đúng là lối vào duy nhất của tính năng ở khổ màn hình ấy.
  expect(CHROME_TSX).toContain('aria-label="Tìm mạch"');
  // Và class PHẢI nằm trên ĐÚNG thẻ `<Link href="/tim-kiem">` — không phải "có mặt đâu
  // đó trong file". Thiếu phép so này thì gỡ `className={css.nut_tim}` khỏi Link (hoặc
  // dời nó sang một thẻ khác) là icon vĩnh viễn `display: none` theo luật gốc mà cả bài
  // A lẫn bài B vẫn xanh — bệnh quay lại nguyên vẹn sau một hàng rào toàn màu xanh.
  // Nghiệm thu + phản biện 2026-08-30 lần lượt chỉ ra hai nửa của lỗ này.
  // `[^>]*` không vượt được dấu `>` nên phép khớp gói gọn trong MỘT thẻ mở, bất kể thứ
  // tự thuộc tính hay xuống dòng.
  const the_link = CHROME_TSX.match(/<Link\b[^>]*href="\/tim-kiem"[^>]*>/)?.[0] ?? "";
  expect(the_link, "không tìm thấy thẻ mở <Link href=\"/tim-kiem\">").not.toBe("");
  expect(the_link).toContain("className={css.nut_tim}");
});

test("B — chrome.module.css có ĐÚNG MỘT khối 860, đứng SAU luật gốc `.nut_tim`", () => {
  // `display: inline-flex` trong khối media thắng `display: none` của luật gốc CHỈ nhờ
  // thứ tự nguồn (cùng specificity). Bản đầu có HAI khối `max-width: 860px` trong file;
  // phản biện 2026-08-30 dựng được ca "dọn dẹp" gộp chúng về vị trí khối ĐẦU (trước luật
  // gốc) — icon chết ở mọi bề ngang, build xanh, 6/6 bài khi ấy vẫn xanh. Hai phép so
  // dưới đây đóng đúng cửa đó: một khối duy nhất, và khối ấy đứng sau luật gốc.
  const cac_moc = CHROME_CSS.match(/max-width:\s*860px/g) ?? [];
  expect(cac_moc).toHaveLength(1);
  const luat_goc = CHROME_CSS.indexOf(".nut_tim");
  const khoi_860 = CHROME_CSS.search(/@media \(max-width:\s*860px\)/);
  expect(luat_goc).toBeGreaterThan(-1);
  expect(khoi_860).toBeGreaterThan(luat_goc);
});

test("A — link ấy KHÔNG kéo `chrome.tsx` sang client (`/luat` phải giữ route tĩnh)", () => {
  // Ràng buộc kiến trúc ghi ở docstring đầu `chrome.tsx`: header nằm trong layout gốc, nên
  // một `"use client"` ở đây làm `/luat` hết tĩnh — mà `/luat` là đường thoát của
  // `error.tsx`. Icon kính lúp là một `Link` trần, không có cớ gì cần hook.
  expect(CHROME_TSX).not.toContain('"use client"');
  expect(CHROME_TSX).not.toMatch(/\buse(State|Effect|Router|SearchParams)\b/);
});

test("B — icon ẩn MẶC ĐỊNH, chỉ hiện trong một khối media", () => {
  const goc = luatGoc(CHROME_CSS).find((r) => r.chon === ".nut_tim");
  expect(goc, "`.nut_tim` không có luật gốc — phép tách luật đã hỏng").toBeDefined();
  expect(goc?.khai, "icon phải ẩn ở khổ màn hình rộng, nơi ô tìm còn đó").toMatch(AN);
  expect(mocCua(CHROME_CSS, ".nut_tim", /display:\s*inline-flex/)).toHaveLength(1);
});

test("B — MỘT mốc duy nhất: chỗ ẩn ô tìm và chỗ hiện icon là cùng con số", () => {
  // Đây là bài chính của file. Ba con số dưới đây nằm ở hai file khác nhau và không có gì
  // ngoài bài đo này buộc chúng bằng nhau; lệch một cái là có một dải bề ngang màn hình
  // không có lối vào tìm kiếm nào — đúng bệnh lượt 2026-08-30 vừa vá.
  const an_o_tim = mocCua(O_TIM_CSS, ".o", AN);
  const an_cho_giu = mocCua(CHROME_CSS, ".cho_o_tim", AN);
  const hien_icon = mocCua(CHROME_CSS, ".nut_tim", /display:\s*inline-flex/);

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

test("C — vùng bấm của icon không nhỏ hơn các nút icon lân cận", () => {
  // T7/trợ năng: cụm phải đã cấm vùng bấm co dưới 44px trên màn hình cảm ứng
  // (`cong-tac-theme.module.css`). Icon mới đứng ngay cạnh nó, cùng luật.
  const coarse = [...CHROME_CSS.matchAll(KHOI_MEDIA)].find((m) =>
    /\(\s*pointer:\s*coarse\s*\)/.test(m[1]),
  );
  expect(coarse, "không có khối `(pointer: coarse)` trong chrome.module.css").toBeDefined();
  const r = docLuat(coarse?.[2] ?? "").find((x) => x.chon === ".nut_tim");
  expect(r?.khai).toMatch(/width:\s*44px/);
  expect(r?.khai).toMatch(/height:\s*44px/);
});

test("D — hai phép tách CSS thật sự chạy (chống hàng rào rỗng)", () => {
  // Trên file thật: nếu regex trôi, mọi bài trên đỏ chứ không xanh — nhưng bài này nói
  // thẳng ra lý do thay vì để người đọc đoán.
  expect(luatGoc(CHROME_CSS).length).toBeGreaterThan(4);
  expect([...CHROME_CSS.matchAll(KHOI_MEDIA)].length).toBeGreaterThanOrEqual(4);

  // Và trên CSS dựng tay, để hai hàm không thể xanh chỉ vì file thật đang tình cờ hợp lệ.
  const gia = ".x {\n  display: none;\n}\n\n@media (max-width: 700px) {\n  .x {\n    display: inline-flex;\n  }\n}\n";
  expect(luatGoc(gia).map((r) => r.chon)).toEqual([".x"]);
  expect(mocCua(gia, ".x", /display:\s*inline-flex/)).toEqual([700]);
  // …và nó KHÔNG khớp bừa một selector khác hay một khai báo khác.
  expect(mocCua(gia, ".y", /display:\s*inline-flex/)).toEqual([]);
  expect(mocCua(gia, ".x", AN)).toEqual([]);
});
