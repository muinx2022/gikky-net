import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

const WEB = resolve(__dirname, "..", "..");

/** Hàng rào cho vá F2 + nợ #13 + nợ #14: **trang lỗi luôn còn ÍT NHẤT MỘT đường thoát
 * không khoá được, luôn được render, và dẫn tới một route KHÔNG cần máy chủ.**
 *
 * Ba điều kiện, ba kiểu hỏng khác nhau và không cái nào suy ra cái nào:
 *
 * 1. **không `disabled`** (vá F2). `app/error.tsx` gói `router.refresh() + reset()` trong
 *    `useTransition`, và `isPending` chỉ hạ khi payload RSC về. Upstream TREO — Django
 *    nhận TCP rồi không trả lời — là `isPending` đứng `true` vĩnh viễn ⇒ nút `disabled`
 *    vĩnh viễn. Đúng loài "banner kẹt vĩnh viễn" mà `D:\Projects\CLAUDE.md` ghi lại từ
 *    2026-08-04;
 * 2. **được render VÔ ĐIỀU KIỆN** (nợ #13, 2026-08-22). Luật (1) chỉ nhìn vào THÂN thẻ
 *    `<button>`, nên `{!dangThu && <button onClick={() => location.reload()}>…}` đi lọt:
 *    nút không mang `disabled`, nó chỉ **biến mất** đúng lúc cần. Cùng một cái kẹt vĩnh
 *    viễn, khác đúng một cách viết. Đây là lượt vá thứ năm của khuôn mẫu "mỗi lượt vá tự
 *    đẻ ra một cửa mới của chính cái luật nó đang đóng", nên lần này luật nhìn cả NGỮ
 *    CẢNH của nút chứ không chỉ thân nó;
 * 3. **đích là route TĨNH** (nợ #14, 2026-08-22). `location.reload()` nạp lại đúng route
 *    vừa treo, và `assign("/")` dẫn vào trang chủ — trang gọi `docFeed` + `docCacSub`.
 *    Cả hai đều hỏng lại vì đúng cái vừa làm hỏng lần đầu, tức "đường thoát" là một vòng
 *    lặp chậm hơn. Chỉ `/luat` không gọi API nào.
 *
 * **Giới hạn thành thật:** đây là phép đọc mã nguồn, không phải phép bấm nút. Nó bắt được
 * ca "ai đó bỏ đường thoát đi" — ca đã xảy ra thật — chứ không chứng minh được cái nút
 * chạy. Phép đo hành vi phải dựng một `next start` thứ hai trỏ `API_ORIGIN` vào một
 * upstream treo, tức thêm một cổng và một entry `webServer`; nợ đó vẫn còn tên trong
 * docstring của `app/error.tsx`.
 */

/** Thân từng `<button …>…</button>` trong một file JSX, kèm vị trí mở thẻ.
 *
 * Cắt chuỗi, không phải parser — cùng hạng với `quet.ts`. Không dùng regex
 * `/<button[\s\S]*?>/` vì mũi tên `=>` trong `onClick={() => …}` có dấu `>`, nên nó cắt
 * cụt ngay giữa handler và bài đo đọc nhầm một nút thành nút rỗng.
 */
function cacNut(nguon: string): { than: string; tai: number }[] {
  const sach = boChuThich(nguon);
  const ra: { than: string; tai: number }[] = [];
  let tu = 0;
  for (;;) {
    const i = sach.indexOf("<button", tu);
    if (i < 0) return ra;
    const het = sach.indexOf("</button>", i);
    ra.push({ than: sach.slice(i + 7, het < 0 ? sach.length : het), tai: i });
    tu = i + 7;
  }
}

function thanNut(nguon: string): string[] {
  return cacNut(nguon).map((n) => n.than);
}

/** Vị trí này có nằm TRONG một biểu thức JSX `{…}` không?
 *
 * Đếm ngoặc nhọn từ `return (` (mốc bắt đầu phần JSX) tới vị trí cần hỏi. Thuộc tính như
 * `className={css.nut}` và `{" "}` đều cân bằng trước khi tới thẻ sau, nên một nút render
 * vô điều kiện có độ sâu **0**; nút nằm trong `{cond && <button …>}` có độ sâu ≥ 1.
 *
 * Cắt chuỗi, không parser: một dấu `{` trong literal chuỗi sẽ làm nó đếm lệch. Đủ dùng vì
 * hai file này không có, và **hỏng về phía an toàn** — đếm lệch cho ra độ sâu > 0, tức
 * BÁO VI PHẠM chứ không bỏ qua.
 */
export function trongBieuThuc(nguon: string, viTri: number): boolean {
  const goc = Math.max(nguon.indexOf("return ("), 0);
  if (viTri < goc) return true;
  let sau = 0;
  for (let i = goc; i < viTri; i += 1) {
    if (nguon[i] === "{") sau += 1;
    else if (nguon[i] === "}") sau -= 1;
  }
  return sau > 0;
}

/** Route mà một đường thoát được phép dẫn tới: **không gọi API nào**.
 *
 * Danh sách chứ không phải một chuỗi: nó là một *loại* route, và bài đo
 * "`/luat` đúng là tĩnh" bên dưới kiểm điều kiện chứ không kiểm cái tên.
 */
const ROUTE_TINH = ["/luat"];

/** File này có nút thoát nào KHÔNG bao giờ bị khoá và KHÔNG bao giờ biến mất không?
 *
 * "Thoát" = bỏ hẳn tài liệu hiện tại bằng `window.location.assign(<route tĩnh>)`. Ba thứ
 * KHÔNG tính: `router.refresh()` và `next/link` (đi qua đúng cây router đang chờ lời gọi
 * treo), và `window.location.reload()` (nạp lại chính route vừa treo — nợ #14).
 */
export function coDuongThoat(nguon: string): boolean {
  const sach = boChuThich(nguon);
  return cacNut(sach).some(
    (n) =>
      ROUTE_TINH.some((r) =>
        new RegExp(`window\\.location\\.assign\\s*\\(\\s*["'\`]${r}["'\`]`).test(n.than),
      ) &&
      !/\bdisabled\b/.test(n.than) &&
      !trongBieuThuc(sach, n.tai),
  );
}

const TRANG_LOI = ["app/error.tsx", "app/global-error.tsx"];

function doc(ten: string): string {
  return readFileSync(resolve(WEB, ten), "utf8");
}

test("F2 — đọc được cả hai file trang lỗi (không có thì hàng rào rỗng)", () => {
  for (const ten of TRANG_LOI) {
    const nguon = doc(ten);
    expect(nguon.length, `${ten} rỗng`).toBeGreaterThan(200);
    expect(thanNut(nguon).length, `${ten} không có <button> nào`).toBeGreaterThan(0);
  }
});

test("F2 — mọi trang lỗi đều có đường thoát không khoá được", () => {
  const thieu = TRANG_LOI.filter((ten) => !coDuongThoat(doc(ten)));
  expect(thieu, "trang lỗi mất đường thoát ⇒ upstream treo là hết cửa").toEqual([]);
});

test("F2 — `error.tsx` vẫn giữ nút thử lại CÓ khoá (bài trên không nghiệm đúng với mọi thứ)", () => {
  // Vế đối chứng hai chiều: nếu `coDuongThoat` trả `true` cho bất cứ thứ gì, hoặc nếu
  // nút "Thử lại" biến mất, bài trên vẫn xanh mà trang lỗi đã khác hẳn.
  const than = thanNut(doc("app/error.tsx"));
  expect(than.filter((t) => /\bdisabled\b/.test(t)).length).toBe(1);
});

test("F2 — luật bắt được hàng giả (đường thoát bị khoá, hoặc không có)", () => {
  const khong_co =
    '<button type="button" onClick={thuLai} disabled={dangThu}>Thử lại</button>';
  expect(coDuongThoat(khong_co)).toBe(false);

  // Ca xảo quyệt hơn: CÓ đường thoát nhưng lại gắn `disabled` — tức vẫn kẹt vĩnh viễn,
  // chỉ là kẹt ở một cái nút khác.
  const bi_khoa =
    '<button type="button" onClick={() => window.location.assign("/luat")} disabled={dangThu}>Sang Luật</button>';
  expect(coDuongThoat(bi_khoa)).toBe(false);

  const dat =
    '<button type="button" onClick={() => window.location.assign("/luat")}>Sang Luật</button>';
  expect(coDuongThoat(dat)).toBe(true);

  // Và điều hướng phía client KHÔNG tính là đường thoát.
  const gia_thoat = '<button type="button" onClick={() => router.refresh()}>Tải lại</button>';
  expect(coDuongThoat(gia_thoat)).toBe(false);
});

/* ---- Nợ #13: hàng rào KHÔNG được mù với render có điều kiện ----------------- */

test("#13 — nút thoát nằm trong `{cond && …}` KHÔNG tính là đường thoát", () => {
  // Đây chính là điểm mù của bản trước: nút không mang `disabled`, nó chỉ BIẾN MẤT đúng
  // lúc `dangThu` bật — cùng một cái kẹt vĩnh viễn, khác đúng một cách viết.
  const co_dieu_kien =
    "return (\n<main>\n" +
    '{!dangThu && <button type="button" onClick={() => window.location.assign("/luat")}>Sang Luật</button>}\n' +
    "</main>);";
  expect(coDuongThoat(co_dieu_kien)).toBe(false);
});

test("#13 — biến thể ba ngôi cũng bị bắt", () => {
  const ba_ngoi =
    "return (\n<main>\n" +
    '{dangThu ? <p>Đang thử…</p> : <button type="button" onClick={() => window.location.assign("/luat")}>Sang Luật</button>}\n' +
    "</main>);";
  expect(coDuongThoat(ba_ngoi)).toBe(false);
});

test("#13 — nút vô điều kiện ĐỨNG CẠNH một khối `{cond && …}` vẫn được công nhận", () => {
  // Chiều ngược, và nó là chiều dễ vá quá tay: cả hai file thật đều có
  // `{error.digest !== undefined && (<p>…</p>)}` đứng TRƯỚC nút thoát. Một phép đếm
  // ngoặc sai sẽ coi mọi thứ sau đó là "có điều kiện" và bài F2 đỏ oan.
  const that =
    "return (\n<main>\n" +
    "{co ? <p>a</p> : null}\n" +
    '<button type="button" onClick={() => window.location.assign("/luat")}>Sang Luật</button>\n' +
    "</main>);";
  expect(coDuongThoat(that)).toBe(true);
});

/* ---- Nợ #14: đích của đường thoát phải là route TĨNH ----------------------- */

test("#14 — `location.reload()` KHÔNG còn tính là đường thoát", () => {
  const nap_lai =
    '<button type="button" onClick={() => window.location.reload()}>Tải lại</button>';
  expect(coDuongThoat(nap_lai)).toBe(false);
});

test("#14 — đích `/` KHÔNG tính: trang chủ gọi API, nó hỏng cùng lý do", () => {
  const ve_trang_chu =
    '<button type="button" onClick={() => window.location.assign("/")}>Trang chủ</button>';
  expect(coDuongThoat(ve_trang_chu)).toBe(false);
});

test("#14 — hai file thật dùng đúng đích tĩnh, không còn `reload()` nào", () => {
  for (const ten of TRANG_LOI) {
    const sach = boChuThich(doc(ten));
    expect(sach, `${ten} còn reload()`).not.toMatch(/window\.location\.reload\s*\(/);
    expect(sach, `${ten} thiếu đích tĩnh`).toMatch(
      /window\.location\.assign\s*\(\s*["'`]\/luat["'`]/,
    );
  }
});

/* ---- Phase 6: trang 404 thật ---------------------------------------------- */

/** `app/not-found.tsx` — thêm ở Phase 6. Trước đó mọi `notFound()` rơi vào trang mặc
 * định của Next: `404 · This page could not be found`, tiếng Anh, không đường đi tiếp.
 *
 * **Luật ở đây KHÁC hai file trên, có chủ đích.** Trang 404 hiện khi máy chủ đã trả lời
 * xong bằng một mã 404 — router sống, Django sống — nên `next/link` là đúng và
 * `window.location` chỉ là một cách chậm hơn. Cái KHÔNG đổi là **đích**: `/luat`, route
 * duy nhất không gọi API nào (nợ #14). Và cái thêm vào: trang 404 **tự nó không được
 * gọi API**, nếu không thì một Django chết biến 404 thành 500.
 */
const TRANG_404 = "app/not-found.tsx";

/** File này có `<Link href="<route tĩnh>">` render VÔ ĐIỀU KIỆN không?
 *
 * Cùng phép đếm ngoặc với `coDuongThoat` (nợ #13): một link chỉ hiện khi `cond` đúng thì
 * đúng lúc cần nó nhất nó có thể vắng mặt.
 */
export function coLinkTinh(nguon: string): boolean {
  const sach = boChuThich(nguon);
  return ROUTE_TINH.some((r) => {
    const re = new RegExp(`<Link[^>]*href="${r}"`, "g");
    return [...sach.matchAll(re)].some((m) => !trongBieuThuc(sach, m.index));
  });
}

test("#14/Phase 6 — trang 404 có link tới route TĨNH, render vô điều kiện", () => {
  const nguon = doc(TRANG_404);
  expect(nguon.length, "app/not-found.tsx rỗng").toBeGreaterThan(200);
  expect(coLinkTinh(nguon), "trang 404 mất đường thoát tới /luat").toBe(true);
});

test("#14/Phase 6 — luật link bắt được hàng giả", () => {
  // Vế chống rỗng: nếu `coLinkTinh` trả `true` với mọi thứ thì bài trên vô nghĩa.
  expect(coLinkTinh('<Link href="/">Trang chủ</Link>')).toBe(false);
  expect(coLinkTinh('<a href="/luat">Luật</a>'), "thẻ <a> không phải Link").toBe(false);
  expect(coLinkTinh('<Link href="/luat">Luật</Link>')).toBe(true);
  // …và link nằm trong `{cond && …}` KHÔNG tính (nợ #13, cùng luật với nút thoát).
  expect(
    coLinkTinh('return (\n<main>\n{co && <Link href="/luat">Luật</Link>}\n</main>);'),
  ).toBe(false);
});

test("Phase 6 — trang 404 KHÔNG gọi API: Django chết thì 404 vẫn phải là 404", () => {
  // Một `not-found.tsx` gọi `docCacSub()` để vẽ sidebar trông rất hợp lý, và nó biến mọi
  // URL gõ sai thành 500 đúng lúc backend đang hỏng — tức đúng lúc người ta gõ sai nhiều
  // nhất. Cùng lý lẽ với bài "`/luat` thật sự là route TĨNH" ngay dưới.
  const sach = boChuThich(doc(TRANG_404));
  expect(sach).not.toMatch(/from\s+"@\/lib\/api"/);
  expect(sach).not.toMatch(/from\s+"@gikky\/api-client"/);
  expect(sach).not.toMatch(/\bfetch\s*\(/);
});

test("#14 — `/luat` thật sự là route TĨNH: không gọi API, không `force-dynamic`", () => {
  // Không có bài này thì "route tĩnh" chỉ là một cái tên trong danh sách: ngày nào
  // `/luat` mọc thêm một lời gọi API, đường thoát lại dẫn vào một trang hỏng và hàng rào
  // trên vẫn xanh.
  const luat = boChuThich(doc("app/luat/page.tsx"));
  expect(luat).not.toMatch(/from\s+"@\/lib\/api"/);
  expect(luat).not.toMatch(/from\s+"@gikky\/api-client"/);
  expect(luat).not.toMatch(/force-dynamic/);
  expect(luat).not.toMatch(/\bfetch\s*\(/);
});
