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
  // Cùng lỗ với `/luat` (vá 2026-08-31, phản biện chỉ ra bản sao): bọc 404 vào
  // `KhungHaiCot` cho có sidebar là nước đi "trông rất hợp lý" mà docstring trên đã cảnh
  // báo — ba phép grep trên đều câm vì lời gọi API nằm trong component import vào. Quote
  // đóng cho phép bản `-tinh` (không gọi API) nếu ngày nào 404 muốn có khung.
  expect(
    sach,
    "404 import `khung-hai-cot` (bản hỏi `GET /subs`) ⇒ Django chết là 404 thành 500",
  ).not.toMatch(/from\s+"@\/components\/khung-hai-cot"/);
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

  // **Lỗ mà bốn dòng trên KHÔNG bịt được** *(vá 2026-08-31)*: chúng chỉ grep CHÍNH file
  // trang, nên một lời gọi API nằm trong component được import vào là chuông câm. Đó
  // đúng là cách hợp đồng vỡ hôm 2026-08-25 — `/luat` chuyển sang `KhungHaiCot`, thứ tự
  // hỏi `GET /subs` phía server, và chỉ vế `force-dynamic` kêu lên. Nếu ngày nào đó ai
  // bỏ dòng `dynamic` ấy đi cho "gọn" thì bài này xanh trong lúc `/luat` vẫn động.
  //
  // Quote đóng trong mẫu là CÓ CHỦ ĐÍCH: nó cấm `khung-hai-cot` mà vẫn cho
  // `khung-hai-cot-tinh` — hai file khác nhau đúng ở chỗ bản `-tinh` không gọi API.
  expect(
    luat,
    "`/luat` import `khung-hai-cot` (bản hỏi `GET /subs`) ⇒ hết tĩnh",
  ).not.toMatch(/from\s+"@\/components\/khung-hai-cot"/);

  // Phép DƯƠNG (vá 2026-08-31, phản biện chỉ ra): các phép CẤM ở trên không buộc `/luat`
  // dùng khung tĩnh — ai đó viết một khung thứ ba có fetch dưới cái tên khác là mọi chuông
  // câm, và bài "một bậc import" bên dưới thành bài canh một file mã chết. Dòng này nối
  // hai bài lại: `/luat` PHẢI đi qua đúng file mà bài kia đang canh.
  expect(
    luat,
    "`/luat` không còn dùng `khung-hai-cot-tinh` — bài kiểm một-bậc bên dưới đang canh một file không ai import",
  ).toMatch(/from\s+"@\/components\/khung-hai-cot-tinh"/);
});

/** Khung mà `/luat` được phép dùng — bài trên chỉ mới nói nó KHÔNG dùng khung kia.
 *
 * **Giới hạn thành thật, và nó là giới hạn có chủ đích:** đây là phép kiểm **MỘT BẬC
 * import**, không phải phân tích transitive. `khung-hai-cot-tinh.tsx` import `Sidebar`,
 * và nếu ngày nào đó `Sidebar` mọc ra một lời gọi API thì hai bài này đều xanh. Lối chữa
 * "đi hết cây import rồi grep" là viết nửa cái type-checker bằng regex — loài mà repo này
 * đã diệt nhiều lần (xem `CLAUDE.md`, mục hàng rào `client` singleton). Phép đo thật cho
 * bậc sâu là bảng route của `next build`: `/luat` phải mang `○`, và nó ĐỎ ngay khi có bất
 * kỳ lời gọi động nào ở bất kỳ bậc nào.
 *
 * Cái hai bài này thật sự mua được: ca "ai đó đổi import của `/luat` sang khung có fetch"
 * và ca "ai đó thêm fetch thẳng vào khung tĩnh" — hai ca đã xảy ra hoặc suýt xảy ra —
 * đều đỏ ngay ở một lệnh chạy trong 20 giây, không phải chờ một lượt build đầy đủ.
 */
const KHUNG_TINH = "components/khung-hai-cot-tinh.tsx";

test("#14 — khung tĩnh của `/luat` KHÔNG gọi API (kiểm MỘT BẬC import)", () => {
  const sach = boChuThich(doc(KHUNG_TINH));
  // Vế chống rỗng, và nó đo phần MÃ chứ không phần chú thích: file mất, bị rút thành cái
  // vỏ, hay còn mỗi docstring thì mọi `not.toMatch` dưới đây nghiệm đúng một cách vô
  // nghĩa — đúng loài "proof đo RỖNG".
  expect(sach.length, `${KHUNG_TINH} rỗng`).toBeGreaterThan(200);
  expect(sach, `${KHUNG_TINH} không còn render Sidebar`).toMatch(/<Sidebar\b/);

  expect(sach, `${KHUNG_TINH} gọi lib/api`).not.toMatch(/from\s+"@\/lib\/api"/);
  expect(sach, `${KHUNG_TINH} gọi api-client`).not.toMatch(/from\s+"@gikky\/api-client"/);
  expect(sach, `${KHUNG_TINH} có fetch()`).not.toMatch(/\bfetch\s*\(/);
});
