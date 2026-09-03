import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

const WEB = resolve(__dirname, "..", "..");

/** **Vùng bấm cụm phải header ≥44px trên màn cảm ứng** — lượt 2026-08-31, đóng
 * P-20260831-1/-2/-3.
 *
 * ## Luật được ghim ở đây, NHÀ của luật ở đâu
 *
 * Câu chữ đầy đủ của luật (ba vế) nằm trong docstring khối `(pointer: coarse)` của
 * `components/tim-kiem-mobile.module.css` — file này chỉ là phép ĐO của luật ấy. Bốn file
 * CSS còn lại trỏ về đó bằng một câu; đừng chép luật ra chỗ thứ sáu.
 *
 * ## Vì sao phải có hàng rào, và vì sao nó lại đọc NGUỒN
 *
 * P-20260831-3: luật 44px trước lượt này **không có hàng rào chạy được**. Mọi project
 * Playwright của repo chạy `devices["Desktop Chrome"]`, tức `pointer: fine` — không bài đo
 * nào bước chân vào được một khối `(pointer: coarse)`. Phép kiểm coarse duy nhất đang có
 * (`loi-vao-tim-kiem.spec.ts`, bài C) cũng là phép đọc nguồn, và nó chỉ hỏi đúng `.nut`
 * của một file. Hệ quả đo được: nút chuông sống suốt với vùng bấm ~29px (P-20260831-2) và
 * công tắc theme nở 12px không bù (P-20260831-1) mà không có gì kêu.
 *
 * Đọc nguồn ở đây không phải để tiện: **cái dễ trôi nhất là quan hệ giữa NĂM file**, không
 * phải hành vi của một file. Một bài đo trình duyệt cảm ứng thật (nếu có) sẽ đo cái nút nó
 * nhìn thấy hôm nay; nó không nói được "nút thứ sáu vừa thêm vào cụm phải chưa ai cho vào
 * luật". Bài A dưới đây làm đúng việc ấy — nó đọc `chrome.tsx` và ép BẢNG phải bằng CỤM.
 *
 * ## Thứ hàng rào này KHÔNG đo được — đọc trước khi tin nó
 *
 * 1. **Vùng chạm THẬT.** `44px` trong nguồn không có nghĩa ngón tay với được 44px: hai
 *    margin âm cạnh nhau ăn hết `gap` thì hai hộp chồng nhau và một bên thua. Bài G dưới
 *    đây ghim *ràng buộc số* sinh ra chuyện đó (tổng bù cặp ≤ gap), nhưng con số cuối cùng
 *    vẫn phải đo bằng `elementFromPoint` trên Chromium coarse — script chạy tay, số dán vào
 *    báo cáo từng lượt. Vòng 1 của chính lượt này xanh hết bảng mà vùng chạm thật chỉ 41px.
 * 2. **Chiều cao hàng.** Bài F cấm bù DỌC, tức cấm đúng cái cơ chế làm header nhảy 12px
 *    theo trạng thái phiên — nhưng nó không đo được chiều cao thật của header.
 * 3. **`margin-inline` với `direction: rtl`**, và margin âm viết bằng `calc()` hay biến CSS:
 *    `leNgang`/`leDoc` là phép đọc chuỗi, không phải engine. Repo chưa có ca nào như vậy;
 *    có thì phải mở rộng chúng chứ đừng tin phép so.
 *
 * **Hướng tương lai (cố ý chưa làm ở lượt này):** một project Playwright riêng chạy
 * `devices["Pixel 7"]` (device mobile ⇒ `pointer: coarse` thật) để đo hộp bấm bằng
 * `elementFromPoint`. Đầu tư lớn hơn hẳn — thêm một project là thêm một vòng `next build`
 * vào mọi lượt `pnpm e2e`.
 *
 * ## Chống rỗng
 *
 * Mọi phép tách ở đây là regex trên CSS/JSX phẳng. Regex hỏng ⇒ trả `undefined`/mảng rỗng
 * ⇒ mọi khẳng định kiểu "không có vi phạm" nghiệm đúng một cách rỗng tuếch. Nên bài E chạy
 * chúng trên nguồn dựng tay, gồm cả những ca đã từng LỌT (`max-width: 44px`,
 * `line-height: 44px`, margin âm một phía, khối `(pointer: coarse) and (max-width: …)`).
 */

const CHROME_TSX = boChuThich(
  readFileSync(resolve(WEB, "components/chrome.tsx"), "utf8"),
);

type Muc = {
  tag: string;
  chon: string;
  /** `"can"` = phải có CẶP margin âm ngang; `"cam"` = không được có margin âm ngang nào. */
  bu: "can" | "cam";
  vi_sao: string;
};

/** Mọi phần tử BẤM ĐƯỢC của cụm phải — CẢ HAI nhánh phiên.
 *
 * `ThanhTaiKhoan` xuất hiện ba lần vì nó render ba bộ khác nhau: `.ten` khi đã đăng nhập,
 * `.lien_ket` + `.nut_chinh` khi khách. Vòng 1 của lượt này chỉ ghim `.ten` — tức luật
 * tuyên bố "cả cụm phải" mà bỏ trắng đúng nhánh của người CHƯA có tài khoản, và phản biện
 * đo được "Đăng nhập" cao 15px, "Đăng ký" cao 25.6px.
 */
const BANG: Muc[] = [
  { tag: "TimKiemMobile", chon: ".nut", bu: "can", vi_sao: "nở 32→44 ngang, có hàng xóm" },
  { tag: "NutDangMach", chon: ".nut", bu: "can", vi_sao: "nở ~35→44 ngang, có hàng xóm" },
  { tag: "Chuong", chon: ".nut", bu: "can", vi_sao: "nở ngang bằng padding, có hàng xóm" },
  { tag: "ThuTin", chon: ".nut", bu: "can", vi_sao: "nở ngang bằng padding, có hàng xóm" },
  { tag: "CongTacTheme", chon: ".khung", bu: "can", vi_sao: "nở 32→44 ngang, có hàng xóm" },
  { tag: "ThanhTaiKhoan", chon: ".ten", bu: "cam", vi_sao: "vế 3: nút bấm cuối bên phải" },
  {
    tag: "ThanhTaiKhoan",
    chon: ".lien_ket",
    bu: "cam",
    vi_sao: "nhánh khách, chỉ nở DỌC nên không có gì để bù",
  },
  {
    tag: "ThanhTaiKhoan",
    chon: ".nut_chinh",
    bu: "cam",
    vi_sao: "nhánh khách, vừa ở mép vừa không nở ngang",
  },
];

/** Thứ tự component trong `.phai` — bài A ép bảng trên bằng đúng cụm này. */
const CUM_THAT = [
  "TimKiemMobile",
  "NutDangMach",
  "Chuong",
  // Phong bì tin nhắn, thêm 2026-09-03. Nó đứng GIỮA chuông và công tắc theme, tức nó góp
  // vào HAI cặp của bài G — cả hai đều phải ≤ `gap`.
  "ThuTin",
  "CongTacTheme",
  "ThanhTaiKhoan",
];

/** Một khối `@media` phẳng: điều kiện + thân. Cùng regex với `loi-vao-tim-kiem.spec.ts` —
 * mọi `.module.css` ở đây đều phẳng (không nest). */
const KHOI_MEDIA = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g;
/** Một luật CSS phẳng: selector + khối khai báo. */
const LUAT = /([^{}]+)\{([^{}]*)\}/g;

type Luat = { chon: string[]; khai: string };

function docLuat(nguon: string): Luat[] {
  return [...nguon.matchAll(LUAT)].map((m) => ({
    // Selector nhóm (`.a,\n.b`) là MỘT luật cho NHIỀU selector — tách ra, nếu không
    // `.lien_ket, .nut_chinh` không khớp mục nào trong bảng và cả hai bài C/D xanh rỗng.
    chon: m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")),
    khai: m[2],
  }));
}

/** Mọi khối media có ĐIỀU KIỆN CHỨA `pointer: coarse` — kể cả biến thể `and`.
 *
 * Khớp CHÍNH XÁC chuỗi `(pointer: coarse)` là một cái thủng: thêm
 * `@media (pointer: coarse) and (max-width: 520px) { .nut { min-width: 30px } }` đè lại
 * mọi con số ở dưới mà bảng vẫn xanh. Đếm theo "có chứa" thì khối thứ hai ấy làm bài B đỏ.
 */
function khoiCoarse(nguon: string): string[] {
  return [...nguon.matchAll(KHOI_MEDIA)]
    .filter((m) => /pointer:\s*coarse/.test(m[1]))
    .map((m) => m[2]);
}

/** ≥44px theo chiều đã cho.
 *
 * `(?:^|[;{\s])` là phần đắt nhất của regex này: không có nó thì `max-width: 44px` (kẹp
 * TRẦN, ngược hẳn ý) và `line-height: 44px` (không phải vùng bấm) đều được tính là đạt —
 * cả hai đã chạy thử và lọt ở vòng 1.
 */
const doBam = (chieu: "width" | "height") =>
  new RegExp(`(?:^|[;{\\s])(?:min-)?${chieu}:\\s*44px`);

function giaTri(khai: string, ten: string): string | null {
  const m = new RegExp(`(?:^|[;{])\\s*${ten}\\s*:\\s*([^;}]+)`).exec(khai);
  return m === null ? null : m[1].trim();
}

/** `margin` shorthand → [trên, phải, dưới, trái]. */
function tachMargin(v: string): [string, string, string, string] {
  const p = v.split(/\s+/);
  if (p.length === 1) return [p[0], p[0], p[0], p[0]];
  if (p.length === 2) return [p[0], p[1], p[0], p[1]];
  if (p.length === 3) return [p[0], p[1], p[2], p[1]];
  return [p[0], p[1], p[2], p[3]];
}

const am = (v: string | null) => v !== null && /^-\s*\d/.test(v);

/** Hai lề NGANG (trái, phải) mà khối khai báo này đặt ra — `null` = không đặt. */
function leNgang(khai: string): [string | null, string | null] {
  let trai: string | null = null;
  let phai: string | null = null;
  const tat = giaTri(khai, "margin");
  if (tat !== null) {
    const t = tachMargin(tat);
    trai = t[3];
    phai = t[1];
  }
  const inl = giaTri(khai, "margin-inline");
  if (inl !== null) {
    const p = inl.split(/\s+/);
    trai = p[0];
    phai = p[1] ?? p[0];
  }
  const dau = giaTri(khai, "margin-inline-start") ?? giaTri(khai, "margin-left");
  const cuoi = giaTri(khai, "margin-inline-end") ?? giaTri(khai, "margin-right");
  if (dau !== null) trai = dau;
  if (cuoi !== null) phai = cuoi;
  return [trai, phai];
}

/** Hai lề DỌC (trên, dưới). */
function leDoc(khai: string): [string | null, string | null] {
  let tren: string | null = null;
  let duoi: string | null = null;
  const tat = giaTri(khai, "margin");
  if (tat !== null) {
    const t = tachMargin(tat);
    tren = t[0];
    duoi = t[2];
  }
  const blk = giaTri(khai, "margin-block");
  if (blk !== null) {
    const p = blk.split(/\s+/);
    tren = p[0];
    duoi = p[1] ?? p[0];
  }
  const dau = giaTri(khai, "margin-block-start") ?? giaTri(khai, "margin-top");
  const cuoi = giaTri(khai, "margin-block-end") ?? giaTri(khai, "margin-bottom");
  if (dau !== null) tren = dau;
  if (cuoi !== null) duoi = cuoi;
  return [tren, duoi];
}

/** CẶP bù âm: âm ở CẢ HAI phía. Âm một phía là nút bị kéo lệch, không phải bù chỗ — vòng 1
 * nhận nhầm nó là "cặp". */
const capBuAm = (khai: string) => leNgang(khai).every(am);
/** Có margin âm ngang NÀO không (dù một phía) — dùng cho nhóm `bu: "cam"`. */
const coBuAmNao = (khai: string) => leNgang(khai).some(am);

/** `<base>` của `./<base>` trong `import { <Tag> } from "./<base>"` của `chrome.tsx`. */
function fileCssCua(tag: string): string {
  const m = new RegExp(
    `import\\s*\\{\\s*${tag}\\s*\\}\\s*from\\s*"\\./([\\w-]+)"`,
  ).exec(CHROME_TSX);
  expect(m, `\`chrome.tsx\` không import \`${tag}\` từ một module cùng thư mục`).not.toBeNull();
  return `components/${m?.[1]}.module.css`;
}

const CSS_CUA = new Map(
  CUM_THAT.map((tag) => [
    tag,
    boChuThich(readFileSync(resolve(WEB, fileCssCua(tag)), "utf8")),
  ]),
);

function luatCua(tag: string, chon: string): Luat | undefined {
  return docLuat(khoiCoarse(CSS_CUA.get(tag) ?? "")[0] ?? "").find((r) =>
    r.chon.includes(chon),
  );
}

test("A — BẢNG trên bằng đúng CỤM PHẢI thật trong `chrome.tsx`", () => {
  // Bài chống mục ruỗng của cả nhóm. Thêm nút thứ sáu vào `.phai` mà quên luật 44px thì
  // trước lượt này KHÔNG có gì kêu — đúng cách nút chuông lọt qua.
  const cum = /<div className=\{css\.phai\}>([\s\S]*?)<\/div>/.exec(CHROME_TSX);
  expect(cum, "không tìm thấy `<div className={css.phai}>` — phép tách cụm đã trôi").not.toBeNull();
  const than = cum?.[1] ?? "";
  // Phép tách trên dừng ở `</div>` ĐẦU TIÊN. Một `<div>` lồng bên trong sẽ cắt cụt thân và
  // giấu mất phần tử nằm sau — nên nó bị cấm thẳng, thay vì để bài đo âm thầm nhìn thiếu.
  expect(than, "có `<div>` lồng trong `.phai` — phép tách cụm không còn đọc hết cụm").not.toContain(
    "<div",
  );

  // Bắt MỌI thẻ mở, không chỉ thẻ tự đóng không prop: `<NutNgonNgu size={16} />` và
  // `<Link href=…>…</Link>` là hai dạng đã từng nằm trong cụm này (xem `06cf49b`), và mẫu
  // cũ `<([A-Z]\w*)\s*\/>` cho cả hai đi qua.
  const the = [...than.matchAll(/<\s*([A-Za-z][\w.]*)/g)].map((m) => m[1]);
  expect(the, "cụm phải đổi thành phần mà bảng luật 44px chưa đổi theo").toEqual(CUM_THAT);

  // …và mọi component trong cụm phải có ít nhất một dòng trong bảng.
  expect([...new Set(BANG.map((d) => d.tag))].sort()).toEqual([...CUM_THAT].sort());
});

for (const ten of [...new Set(BANG.map((d) => fileCssCua(d.tag)))]) {
  test(`B — \`${ten}\` có ĐÚNG MỘT khối media \`pointer: coarse\``, () => {
    // Đúng lý do của "một khối 860 duy nhất" ở `loi-vao-tim-kiem.spec.ts`: hai khối cùng
    // điều kiện trong một file là chỗ một lượt dọn dẹp đảo được thứ tự nguồn mà build vẫn
    // xanh — và ở đây thứ bị đảo là vùng bấm, thứ không ai nhìn thấy trên máy tính bàn.
    // Đếm theo "điều kiện CÓ CHỨA `pointer: coarse`", nên một khối `and (max-width: …)` đè
    // lại số cũng làm bài này đỏ chứ không lọt.
    const css = boChuThich(readFileSync(resolve(WEB, ten), "utf8"));
    expect(khoiCoarse(css)).toHaveLength(1);
  });

  test(`F — \`${ten}\`: khối coarse KHÔNG được có margin âm DỌC`, () => {
    // Bù DỌC là cơ chế đã làm header nhảy 12px theo trạng thái phiên (vòng 1 của lượt này):
    // nó thu chiều cao chiếm chỗ của hai nút icon về 32px, nên chiều cao hàng rơi vào tay
    // những nút chỉ có khi ĐÃ ĐĂNG NHẬP — khách 53px, đăng nhập 65px, thân trang tụt 12px
    // giữa hai thời điểm. Luật: chiều cao hàng không được phụ thuộc nút nào.
    const css = boChuThich(readFileSync(resolve(WEB, ten), "utf8"));
    for (const r of docLuat(khoiCoarse(css)[0] ?? "")) {
      expect(
        leDoc(r.khai).some(am),
        `\`${r.chon.join(", ")}\` bù DỌC ⇒ chiều cao header đổi theo trạng thái phiên`,
      ).toBe(false);
    }
  });
}

for (const d of BANG) {
  const ten = fileCssCua(d.tag);

  test(`C — \`${ten}\` \`${d.chon}\`: vùng bấm 44×44 ở màn cảm ứng`, () => {
    const r = luatCua(d.tag, d.chon);
    expect(r, `khối coarse không khai gì cho \`${d.chon}\``).toBeDefined();
    expect(r?.khai, "thiếu bề ngang 44px").toMatch(doBam("width"));
    expect(r?.khai, "thiếu chiều cao 44px").toMatch(doBam("height"));
  });

  test(
    d.bu === "can"
      ? `D — \`${ten}\` \`${d.chon}\`: phải có CẶP margin âm ngang (${d.vi_sao})`
      : `D — \`${ten}\` \`${d.chon}\`: KHÔNG được có margin âm ngang (${d.vi_sao})`,
    () => {
      const r = luatCua(d.tag, d.chon);
      expect(r, `khối coarse không khai gì cho \`${d.chon}\``).toBeDefined();
      if (d.bu === "can") {
        expect(
          capBuAm(r?.khai ?? ""),
          "nở 44px mà không bù ⇒ cụm phải nở thêm trên đúng dải 421–520px không có `flex-wrap` cứu",
        ).toBe(true);
      } else {
        expect(
          coBuAmNao(r?.khai ?? ""),
          `${d.vi_sao} — margin âm ở đây đẩy hộp bấm ra ngoài cụm hoặc lấn vùng bấm hàng xóm`,
        ).toBe(false);
      }
    },
  );
}

test("G — tổng bù của HAI nút CẠNH NHAU ≤ `gap` hẹp nhất của `.phai`", () => {
  // Ràng buộc số của vế 2, và là thứ vòng 1 KHÔNG có: -6 và -5 cạnh nhau ăn 11px trong khi
  // `gap` ở ≤640px chỉ có 8 ⇒ hai vùng chạm chồng 3px, đo `elementFromPoint` ra 41–42px
  // thay vì 44. Bài này đọc `chrome.module.css` để lấy `gap` thật chứ không gõ cứng 8.
  const CHROME_CSS = boChuThich(
    readFileSync(resolve(WEB, "components/chrome.module.css"), "utf8"),
  );
  const cac_gap = [...CHROME_CSS.matchAll(LUAT)]
    .filter((m) => m[1].includes(".phai"))
    .map((m) => /(?:^|[;{])\s*gap\s*:\s*(\d+)px/.exec(m[2]))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  expect(cac_gap.length, "không đọc được `gap` nào của `.phai` — phép tách đã trôi").toBeGreaterThan(0);
  const gap = Math.min(...cac_gap);

  // Bù của từng nút theo THỨ TỰ trong cụm; nút không bù tính 0. Nhánh khách bỏ kính lúp và
  // hai nút chỉ-khi-đăng-nhập ra, nên nó có một cặp CẠNH NHAU khác: kính lúp ↔ theme.
  const bu = (tag: string, chon: string) => {
    const r = luatCua(tag, chon);
    const [trai, phai] = leNgang(r?.khai ?? "");
    const so = (v: string | null) => (v !== null && am(v) ? Math.abs(parseFloat(v)) : 0);
    return { trai: so(trai), phai: so(phai) };
  };
  const nut = {
    tim: bu("TimKiemMobile", ".nut"),
    dang: bu("NutDangMach", ".nut"),
    chuong: bu("Chuong", ".nut"),
    thu: bu("ThuTin", ".nut"),
    theme: bu("CongTacTheme", ".khung"),
    ten: bu("ThanhTaiKhoan", ".ten"),
  };
  const cap: [string, { phai: number }, string, { trai: number }][] = [
    ["kính lúp", nut.tim, "Đăng bài", nut.dang],
    ["Đăng bài", nut.dang, "chuông", nut.chuong],
    // Phong bì chen vào giữa chuông và theme (2026-09-03) ⇒ cặp `chuông ↔ theme` cũ tách
    // làm hai. Bỏ sót một trong hai là bỏ trắng đúng chỗ nút mới chạm hàng xóm.
    ["chuông", nut.chuong, "thư", nut.thu],
    ["thư", nut.thu, "theme", nut.theme],
    ["theme", nut.theme, "tài khoản", nut.ten],
    // Nhánh KHÁCH: `NutDangMach`, `Chuong` và `ThuTin` đều trả `null`, nên hai nút icon
    // còn lại đứng sát nhau.
    ["kính lúp (khách)", nut.tim, "theme (khách)", nut.theme],
  ];
  for (const [ta, a, tb, b] of cap) {
    expect(
      a.phai + b.trai,
      `bù của "${ta}" (${a.phai}) + "${tb}" (${b.trai}) > gap ${gap}px ⇒ hai vùng chạm chồng nhau`,
    ).toBeLessThanOrEqual(gap);
  }
});

test("E — mọi phép tách thật sự chạy, và biết nói KHÔNG (chống hàng rào rỗng)", () => {
  // Trên file thật trước…
  expect(CSS_CUA.size).toBe(CUM_THAT.length);
  for (const [tag, css] of CSS_CUA) {
    expect(css.length, `đọc rỗng file CSS của ${tag}`).toBeGreaterThan(100);
    expect(khoiCoarse(css).length, `${tag} không có khối coarse nào`).toBe(1);
  }

  // …rồi trên nguồn dựng tay, để mọi hàm trên không thể xanh chỉ vì năm file thật đang
  // tình cờ hợp lệ.
  const gia =
    ".x {\n  width: 32px;\n}\n\n@media (pointer: coarse) {\n  .x,\n  .y {\n    width: 44px;\n    height: 44px;\n    margin-inline: -4px;\n  }\n}\n";
  expect(khoiCoarse(gia)).toHaveLength(1);
  const r = docLuat(khoiCoarse(gia)[0]);
  expect(r[0].chon, "selector nhóm phải tách thành nhiều mục").toEqual([".x", ".y"]);
  expect(r[0].khai).toMatch(doBam("width"));
  expect(r[0].khai).toMatch(doBam("height"));
  expect(capBuAm(r[0].khai)).toBe(true);
  expect(leDoc(r[0].khai).some(am)).toBe(false);

  // Bốn ca đã từng LỌT ở vòng 1 — mỗi ca một dòng, tất cả phải nói KHÔNG.
  expect("  max-width: 44px;\n", "kẹp TRẦN 44px không phải vùng bấm").not.toMatch(doBam("width"));
  expect("  line-height: 44px;\n", "chiều cao DÒNG không phải vùng bấm").not.toMatch(
    doBam("height"),
  );
  expect(capBuAm("  margin-left: -4px;\n"), "âm một phía không phải CẶP bù").toBe(false);
  expect(coBuAmNao("  margin-left: -4px;\n"), "…nhưng vẫn là margin âm ngang").toBe(true);
  expect(
    khoiCoarse("@media (pointer: coarse) and (max-width: 520px) {\n  .x { top: 0; }\n}\n"),
    "khối `and (max-width: …)` vẫn là một khối coarse — phải đếm vào",
  ).toHaveLength(1);

  // …và những cách viết ĐÚNG khác cũng phải được nhận, nếu không luật thành ép một cách gõ.
  expect(capBuAm("  margin-inline-start: -4px;\n  margin-inline-end: -4px;\n")).toBe(true);
  expect(capBuAm("  margin: 0 -4px;\n")).toBe(true);
  expect(leDoc("  margin: -6px;\n").some(am), "`margin: -6px` bù cả DỌC").toBe(true);
  expect(leDoc("  margin-block: -3px;\n").some(am)).toBe(true);
  expect(capBuAm("  margin: 4px;\n"), "margin DƯƠNG không phải bù").toBe(false);
});
