import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { quetNguon } from "./quet";

const WEB = resolve(__dirname, "..", "..");

/** Hàng rào chạy được cho PLAN 9.1:
 *
 * > Xanh `#1C7A4F` / đỏ `#B33A2B` **CẤM dùng trang trí** — chỉ được xuất hiện ở con số
 * > lãi/lỗ.
 *
 * Không có hàng rào thì câu trên là một dòng trong plan, và dòng đầu tiên tô đỏ cho một
 * nút "xoá" sẽ không làm gì đỏ cả. Hai luật:
 *
 * 1. Mã hex của **hai hệ màu mà PLAN 9.1 giao luật riêng** — xanh/đỏ lãi lỗ và hoàng thổ
 *    `--stamp`, mỗi hệ 2 sáng + 2 tối — chỉ được xuất hiện ở `app/globals.css`, chỗ KHAI
 *    token. Ở bất kỳ đâu khác là ai đó vừa bỏ qua hệ token (vá E1 thêm hệ hoàng thổ).
 *    Các token còn lại (`--ink*`, `--line*`, `--surface`, `--accent*`) KHÔNG nằm trong
 *    luật này: PLAN không giao chúng cho một ý nghĩa riêng nào, nên gõ cứng một mã trong
 *    số đó là chuyện xấu về phong cách chứ không phá được luật nào cả.
 * 2. `var(--gain)` / `var(--loss)` chỉ được dùng ở đúng một file:
 *    `components/con-so.module.css`. Muốn thêm chỗ dùng thì phải sửa cả file này — và đó
 *    là mục đích: quyết định có chủ đích, không phải một dòng CSS lọt vào lúc nửa đêm.
 * 3. **Hoàng thổ `--stamp` đi theo allowlist từng SELECTOR** (vá C2, 2026-08-22). PLAN
 *    9.1 giao nó riêng cho "thứ mang tính đóng dấu"; một allowlist theo FILE thì không
 *    đủ, vì `the-moc.module.css` chứa cả `.da_sua` (đúng là con dấu) lẫn `.cau_moi`
 *    (lời mời — không phải), tức chính cái ca đã lọt.
 *
 * Quét trên bản **đã bỏ chú thích** (xem `quet.ts`), nên docstring được phép nhắc tới mã
 * màu — kể cả docstring này.
 *
 * ⚠ Luật 2 và 3 quét **cả `.tsx`/`.ts`**, không chỉ `.css` (vá C4). Bản đầu lọc
 * `f.ten.endsWith(".css")` nên `style={{ color: "var(--gain)" }}` viết thẳng trong JSX
 * lọt sạch — mà đó lại là cách nhanh nhất để tô màu một chỗ lẻ.
 */

const HEX_LAI_LO = ["#1C7A4F", "#B33A2B", "#43BE83", "#E4776A"];

/** Hoàng thổ `--stamp` / `--stamp-soft`, 2 sáng + 2 tối (vá E1, 2026-08-22).
 *
 * Trước đợt vá, danh sách chỉ có bốn mã xanh/đỏ, nên **gõ cứng `#b07a2b` ở bất kỳ đâu
 * không làm gì đỏ cả** — trong khi C1 vừa được vá vì đúng một mã hex lọt ra ngoài hệ
 * token, và luật 3 dưới đây đã siết `var(--stamp)` tới từng selector. Siết cửa `var(…)`
 * mà để ngỏ cửa hex là hàng rào có một mặt.
 */
const HEX_STAMP = ["#B07A2B", "#F5EBDA", "#D8A455", "#2A2318"];

/** Hai hệ màu có luật riêng trong PLAN 9.1 — chỉ được xuất hiện ở chỗ KHAI token.
 * KHÔNG phải "mọi màu của bảng token": xem luật 1 ở docstring đầu file. */
const HEX_TOKEN = [...HEX_LAI_LO, ...HEX_STAMP];

const NOI_KHAI_TOKEN = "app/globals.css";
const NOI_DUOC_DUNG = "components/con-so.module.css";
/** Chính file này liệt kê mọi mã hex trong `HEX_TOKEN` — mã thật, không phải chú thích. */
const TU_TRU = "e2e/don-vi/mau-token.spec.ts";

/** `file#selector` được phép dùng `--stamp` / `--stamp-soft`, kèm lý do theo PLAN 9.1.
 *
 * Danh sách của PLAN: *"vạch mới, 'đã sửa', trích vào sổ, số mốc chưa xem trên spine"*.
 * Vạch mới và spine thuộc mặt BÃO (Phase 3) nên chưa có mặt ở đây.
 */
const STAMP_DUOC_PHEP = [
  // Trích vào sổ — PLAN 9.1 nêu đích danh. Cả khối, chú thích và link nhảy của nó.
  "components/khoi-trich.module.css#.khoi",
  "components/khoi-trich.module.css#.chu_thich",
  "components/khoi-trich.module.css#.nhay",
  // "ĐÃ ĐÓNG SỔ" trên thẻ feed: con dấu theo nghĩa đen nhất của từ.
  "components/the-mach.module.css#.dong_so",
  // "đã sửa" — PLAN 9.1 nêu đích danh.
  "components/the-moc.module.css#.da_sua",
  // Chỉ số "Được trích vào sổ ×N" trên hồ sơ: cùng một con dấu, chiếu ở cửa thứ hai.
  "app/u/[username]/ho-so.module.css#.trich dt, .trich dd",
  // Nhãn DRAFT của `/luat` — con dấu theo đúng nghĩa đen; nó nói "bản này chưa duyệt".
  "app/luat/luat.module.css#.draft",
];

const FILES = quetNguon(WEB, /\.(css|tsx?|mjs)$/);

/** `file#selector` của mọi khối CSS có nhắc tới `--stamp`.
 *
 * Phép tách khối là regex, không phải parser: nó bắt các rule KHÔNG lồng nhau, và với
 * `@media { … }` thì các rule bên trong vẫn ra còn dòng `@media` thì không. Đủ cho hàng
 * rào này vì mọi file `.module.css` ở đây đều phẳng — và nếu ai đó viết CSS lồng thật,
 * bài đo "danh sách không rỗng" bên dưới sẽ hụt và đỏ.
 */
function khoiDungStamp(): string[] {
  const ra: string[] = [];
  for (const f of FILES) {
    if (!f.ten.endsWith(".css")) continue;
    for (const m of f.sach.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // Selector nhiều dòng gộp về một dòng, nếu không thì allowlist phải chép cả ký tự
      // xuống dòng và không ai đọc ra nó.
      const ten = m[1].trim().replace(/\s+/g, " ");
      if (/var\(\s*--stamp/.test(m[2])) ra.push(`${f.ten}#${ten}`);
    }
  }
  return ra.sort();
}

test("bộ file quét được không rỗng (bài đo này tự chứng minh mình có quét)", () => {
  expect(FILES.length).toBeGreaterThan(20);
  const ten = FILES.map((f) => f.ten);
  expect(ten).toContain(NOI_KHAI_TOKEN);
  expect(ten).toContain(NOI_DUOC_DUNG);
  expect(ten).toContain(TU_TRU);
});

test("mã hex xanh/đỏ + hoàng thổ chỉ nằm ở chỗ khai token", () => {
  const pham = FILES.filter(
    (f) =>
      f.ten !== NOI_KHAI_TOKEN &&
      f.ten !== TU_TRU &&
      HEX_TOKEN.some((h) => f.sach.toUpperCase().includes(h)),
  );
  expect(pham.map((f) => f.ten)).toEqual([]);
});

test("luật hex bắt được hàng giả — kể cả mã hoàng thổ viết thường", () => {
  // Không có vế này thì "danh sách vi phạm rỗng" cũng đúng khi `HEX_TOKEN` rỗng, khi
  // `FILES` rỗng, hoặc khi phép so sánh hoa/thường lệch. Ở đây thử đúng chuỗi mà một
  // người gõ cứng sẽ viết.
  const gia = "color: #b07a2b;";
  expect(HEX_TOKEN.some((h) => gia.toUpperCase().includes(h))).toBe(true);
  expect(HEX_TOKEN.some((h) => "color: var(--stamp);".toUpperCase().includes(h))).toBe(
    false,
  );
});

test("var(--gain) / var(--loss) chỉ được dùng ở con-so.module.css — CẢ trong .tsx", () => {
  const pham = FILES.filter(
    (f) =>
      f.ten !== NOI_KHAI_TOKEN &&
      f.ten !== NOI_DUOC_DUNG &&
      f.ten !== TU_TRU &&
      /var\(\s*--(gain|loss)\s*\)/.test(f.sach),
  );
  expect(pham.map((f) => f.ten)).toEqual([]);
});

test("hàng rào .tsx của luật trên KHÔNG rỗng — nó phải quét được file JSX", () => {
  // Nếu bộ file quét lại chỉ còn `.css` thì luật vừa rồi trở về đúng điểm mù của vá C4
  // mà không có gì đỏ. Đây là chốt chặn cho chính nó.
  expect(FILES.filter((f) => /\.tsx$/.test(f.ten)).length).toBeGreaterThan(10);
});

test("chỗ được phép DÙNG thật sự có dùng — nếu không, hai luật trên vô nghĩa", () => {
  const f = FILES.find((x) => x.ten === NOI_DUOC_DUNG);
  expect(f?.sach).toMatch(/var\(--gain\)/);
  expect(f?.sach).toMatch(/var\(--loss\)/);
});

test("globals.css khai đủ mọi giá trị (light + dark) của xanh/đỏ và hoàng thổ", () => {
  // Chiều ngược của luật trên: xoá một token khỏi `globals.css` mà quên xoá khỏi danh
  // sách thì luật kia vẫn xanh (không ai vi phạm một mã không tồn tại), và hàng rào cứ
  // thế rỗng dần.
  const g = FILES.find((x) => x.ten === NOI_KHAI_TOKEN)?.sach.toUpperCase() ?? "";
  for (const h of HEX_TOKEN) expect(g, `thiếu ${h}`).toContain(h);
});

test("hoàng thổ --stamp không rơi vào file con-so (hai hệ dấu không được lẫn)", () => {
  // PLAN 9.1 giao hoàng thổ cho "thứ mang tính đóng dấu"; con số lãi/lỗ không thuộc nhóm
  // đó. Luật nhỏ, nhưng nó chặn đúng kiểu trôi mà hai luật trên không thấy.
  const f = FILES.find((x) => x.ten === NOI_DUOC_DUNG);
  expect(f?.sach).not.toMatch(/var\(\s*--stamp/);
});

test("--stamp chỉ nằm ở những SELECTOR mang tính đóng dấu (PLAN 9.1)", () => {
  expect(khoiDungStamp()).toEqual([...STAMP_DUOC_PHEP].sort());
});

test("allowlist --stamp không rỗng và không có dòng chết", () => {
  // Hai chiều: danh sách rỗng nghĩa là phép tách khối đã hỏng và luật trên nghiệm đúng
  // với mọi thứ; dòng chết nghĩa là ai đó xoá chỗ dùng mà quên xoá giấy phép, và giấy
  // phép còn đó thì lần sau nó cấp lại cho một chỗ dùng khác.
  const thuc_te = khoiDungStamp();
  expect(thuc_te.length).toBeGreaterThan(0);
  expect(STAMP_DUOC_PHEP.filter((x) => !thuc_te.includes(x))).toEqual([]);
});

test("var(--stamp) KHÔNG được viết thẳng trong .tsx (cùng điểm mù với vá C4)", () => {
  const pham = FILES.filter(
    (f) =>
      /\.tsx?$/.test(f.ten) &&
      f.ten !== TU_TRU &&
      /var\(\s*--stamp/.test(f.sach),
  );
  expect(pham.map((f) => f.ten)).toEqual([]);
});
