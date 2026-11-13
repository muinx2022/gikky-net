import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { docToken } from "./token";

/** Việc 18 — plan `2026-11-12-khoi-chu-de-xep-chong-nut-brand.md` §3.4(a) và §10 (vòng 2). Hàng
 * rào đọc mã nguồn: không mạng, không DB, không cổng (`pnpm e2e:don-vi`). Phần trình duyệt (màu
 * tính ra ở cả hai theme, hover, bố cục khối chủ đề) nằm ở `e2e/khoi-chu-de-nut-brand.spec.ts`.
 *
 * Gốc chuyện: nút "Đăng ký" ở header nền `--ink` chữ `#ffffff` gõ cứng. Ở theme tối `--ink` là
 * màu SÁNG ⇒ chữ trắng trên nền gần trắng, tương phản ~1.2:1 (P-20261110-6). Nút đặc nay đi
 * bằng cặp đã đo `--on-brand`/`--brand`.
 *
 * Vòng 2 (sổ P-20261112-8): phần kiểm tách thành HÀM THUẦN nhận chuỗi CSS (`kiemNenInk`,
 * `kiemChuTrenBrand`, `kiemHoverFilter`), và mỗi ca phản biện đã dựng được mà bài cũ vẫn xanh
 * được cài thành CA MẪU ngay dưới đây: ca sai thì hàm phải báo, ca hợp lệ thì hàm phải im. Bản
 * vòng 1 lọt `!important`, `var(--ink-2)`, `color` khai hai lần, và `color` trong khối
 * `@media` cùng selector.
 *
 * ⚠ **Chỗ hở biết trước:** selector CON (`.nut_chinh span { color: #fff }`) không bị bắt — luật
 * khớp theo compound CUỐI của selector, mà compound cuối của selector ấy là `span`. Bắt nó đòi
 * hiểu cây DOM, thứ đọc CSS không biết; phần trình duyệt đo `color` tính ra của chính nút, cũng
 * không thấy chữ của phần tử con. Cùng loại: compound chỉ viết bên trong `:is(…)`/`:where(…)`
 * (`:is(.a, .n):hover`) bị bỏ cùng pseudo-class. Ca mẫu "hở biết trước" bên dưới ghim hai hành
 * vi này: ai vá thì đổi ca ấy thành ca phải báo.
 *
 * Hở biết trước khác của `kiemChuTrenBrand`, ghi ra chứ chưa vá:
 * - LỌT: `!important` giữa các khai trong CÙNG một khối bị luật "khai nền cuối" bỏ qua.
 * - LỌT: `tokenDau` chỉ nhận `var(` ở đầu giá trị — `url(x) var(--brand)`, `VAR(`,
 *   `var(--x, var(--brand))`, gradient đều không được nhận là nền brand.
 * - BÁO NHẦM (đỏ ồn, không lọt): `.tab:hover` mới tô brand thì khối `.tab` gốc cũng bị đòi
 *   `--on-brand`.
 * - BÁO NHẦM: `color` khai ở khối KHÁC cùng selector vẫn bị báo "không khai color".
 * - BÁO NHẦM: `:disabled` có nền `!important` vẫn bị coi theo nền brand `!important` của gốc.
 * - BÁO NHẦM: `unset`/`initial` bị coi là màu gõ cứng.
 *
 * Lượt sửa 1 của vòng 2 (phản biện): khối cùng gốc tự đặt nền mới không còn được miễn trắng (xem
 * `kiemChuTrenBrand`), `gocChon` bỏ cả selector thuộc tính `[…]`, cụm selector tách ở dấu phẩy
 * mức ngoài, khối brand phải tự khai `color`, nền nhận theo token lớp đầu (`tokenDau`). */

const WEB = resolve(__dirname, "..", "..");
const doc = (duong_dan: string) => readFileSync(resolve(WEB, duong_dan), "utf8");
const boChuThichCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** Mọi `*.module.css` dưới `components/` và `app/` (đệ quy), đường dẫn tương đối `WEB`. */
function moiModuleCss(): string[] {
  const ra: string[] = [];
  for (const goc of ["components", "app"]) {
    for (const f of readdirSync(resolve(WEB, goc), { recursive: true, encoding: "utf8" })) {
      if (f.endsWith(".module.css")) ra.push(`${goc}/${f.replace(/\\/g, "/")}`);
    }
  }
  return ra.sort();
}

type Khoi = { chon: string[]; than: string };

/** Tách cụm selector ở dấu phẩy MỨC NGOÀI: `:is(.a, .n)` hay `[data-x="a,b"]` không bị cắt
 * thành hai mảnh vô nghĩa `:is(.a` và `.n)`. */
function tachCum(s: string): string[] {
  const ra: string[] = [];
  let sau = 0;
  let tu = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[") sau += 1;
    else if (c === ")" || c === "]") sau -= 1;
    else if (c === "," && sau === 0) {
      ra.push(s.slice(tu, i));
      tu = i + 1;
    }
  }
  ra.push(s.slice(tu));
  return ra.map((x) => x.trim()).filter((x) => x !== "");
}

/** Khối luật `selector { … }` — kể cả khối lồng trong `@media` (regex không vượt qua `{`, nên
 * phần `@media (…) {` rơi ra ngoài và khối con được bắt như khối thường). */
function khoiLuat(css: string): Khoi[] {
  return [...boChuThichCss(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    chon: tachCum(m[1]),
    than: m[2],
  }));
}

type Khai = { gia_tri: string; quan_trong: boolean };

/** Mọi khai của một thuộc tính trong thân khối, theo thứ tự khai. `!important` (kể cả `! important`
 * có dấu cách — CSS vẫn nhận) bị tách khỏi giá trị nhưng GIỮ lại thành cờ: nền brand `!important`
 * thì nền của khối trạng thái không thắng được. Thuộc tính phải đứng RIÊNG: `color` không bắt
 * `background-color`/`border-color`, `filter` không bắt `backdrop-filter` (ký tự đứng trước là
 * `-`, không phải đầu khối, `;` hay khoảng trắng). */
function khaiDu(than: string, thuoc_tinh: string): Khai[] {
  const mau = new RegExp(`(?:^|[;\\s])${thuoc_tinh}\\s*:\\s*([^;]+)`, "g");
  return [...than.matchAll(mau)].map((m) => {
    const tho = m[1].trim();
    return { gia_tri: tho.replace(/\s*!\s*important$/i, "").trim(), quan_trong: /!\s*important$/i.test(tho) };
  });
}
const khai = (than: string, thuoc_tinh: string) => khaiDu(than, thuoc_tinh).map((k) => k.gia_tri);

/** Nền: `background` và `background-color`, chung một danh sách theo thứ tự khai. */
const khaiNenDu = (than: string) => khaiDu(than, "background(?:-color)?");
const khaiNen = (than: string) => khai(than, "background(?:-color)?");

/** Token ở LỚP ĐẦU của một giá trị, nếu giá trị mở bằng `var(--x)`: nhận cả fallback
 * (`var(--brand, #1f5fd1)`) và lớp theo sau (`var(--brand) url(x.png)`). `color-mix(… var(--x) …)`
 * không mở bằng `var(` nên ra `null` — lớp phủ mờ, không phải nền đặc. */
function tokenDau(v: string): string | null {
  return /^var\(\s*(--[\w-]+)\s*[,)]/.exec(v)?.[1] ?? null;
}

/** Compound CUỐI của một selector sau khi bỏ selector thuộc tính `[…]` và pseudo-CLASS (kể cả
 * `:not(…)`, `:global(…)`): `.gui:hover:not(:disabled)` ⇒ `.gui`, `[data-theme] .nut_chinh` ⇒
 * `.nut_chinh`, `.nut_mo[aria-current="page"]` ⇒ `.nut_mo`, `.vung_keo:active .thanh_keo` ⇒
 * `.thanh_keo`, `.nut_chinh span` ⇒ `span` (chỗ hở biết trước). Compound chỉ có thuộc tính/pseudo
 * (`:root`, `[data-theme]`) ra chuỗi rỗng — không khớp với gì.
 * Pseudo-ELEMENT thì GIỮ: `.hieu::after` là một hộp riêng (chấm brand sau chữ hiệu), gộp nó về
 * `.hieu` là bắt chữ của `.hieu` phải mang màu `--on-brand` dù chữ ấy không nằm trên brand. */
function gocChon(chon: string): string {
  const cum = chon
    .replace(/\[[^\]]*\]/g, "")
    .replace(/::?[\w-]+(\((?:[^()]|\([^()]*\))*\))?/g, (p) => (p.startsWith("::") ? p : ""))
    .trim()
    .split(/\s*[\s>+~]\s*/);
  return cum[cum.length - 1];
}

/** Gốc (`gocChon`) khác rỗng của các selector trong khối mà có mặt trong `tap`. */
const gocTrong = (k: Khoi, tap: ReadonlySet<string>) =>
  k.chon.map(gocChon).filter((g) => g !== "" && tap.has(g));

/** Cặp nền/chữ trong bảng token: `--T` ⇒ `--on-T` (hiện là brand và accent). */
function capNenChu(theme: Readonly<Record<string, Record<string, string>>>): Record<string, string> {
  const bang = Object.values(theme)[0];
  const ra: Record<string, string> = {};
  for (const t of Object.keys(bang).sort()) {
    if (!t.startsWith("--on-") && bang[`--on-${t.slice(2)}`] !== undefined) ra[t] = `--on-${t.slice(2)}`;
  }
  return ra;
}

// ---------------------------------------------------------------------------------------------
// Ba hàm thuần — mỗi hàm nhận MỘT chuỗi CSS (một file), trả vi phạm dạng chữ đọc được.
// ---------------------------------------------------------------------------------------------

/** Nền đặc họ `--ink` (`--ink`, `--ink-2`, `--ink-3`) ở ĐẦU giá trị `background`/
 * `background-color`. Ở theme tối cả họ này là màu SÁNG, nên chữ trắng/chữ "nền trang" đặt lên
 * đều mất. Trả MỖI selector một dòng `"<selector>: background <giá trị>"` để allowlist ghim được
 * theo selector. `color-mix(… var(--ink) …)` không khớp — đó là lớp phủ mờ, không phải nền đặc. */
function kiemNenInk(css: string): string[] {
  const ra: string[] = [];
  for (const k of khoiLuat(css)) {
    for (const v of khaiNen(k.than)) {
      if (!/^--ink(?:-\d)?$/.test(tokenDau(v) ?? "")) continue;
      for (const c of k.chon) ra.push(`${c}: background ${v}`);
    }
  }
  return ra;
}

/** Màu chữ KHÔNG gõ cứng: chỉ nhận token (`var(--…)`), `inherit`, `currentColor`. Hex,
 * `rgb()`/`hsl()`, tên màu (`white`) đều là màu không đổi theo theme — đúng hình dạng lỗi gốc
 * P-20261110-6. */
const laMauTheoTheme = (v: string) => /^(var\(|inherit$|currentcolor$)/i.test(v);

/** Chữ trên nền brand. Khối nền `var(--brand)` (lớp đầu, kể cả fallback/`!important`) là "khối
 * brand"; mọi khối cùng gốc (`gocChon`: `:hover`, `:active`, thuộc tính `[…]`, tiền tố theme,
 * cụm `.a, .b`, ở mọi `@media`) chịu luật theo NỀN mà khối ấy tự đặt (khai nền cuối cùng):
 *
 * - không đặt nền, hoặc đặt lại brand, hoặc khối brand cùng gốc khai nền `!important` (nền mới
 *   không thắng được ⇒ chữ vẫn nằm trên brand) ⇒ mọi `color` phải là `var(--on-brand)`;
 * - đặt nền `var(--T)` mà `cap` có `--on-T` (accent…) ⇒ mọi `color` phải là `var(--on-T)`;
 * - đặt nền khác (`--surface-2`, `transparent`…) ⇒ miễn luật cặp, nhưng `color` không được gõ
 *   cứng (`laMauTheoTheme`) và không được là token `--on-…` (chữ của một nền đặc khác);
 * - tự đổi nền khác brand thì BẮT BUỘC khai `color` (trừ khối chứa `:disabled`): không khai thì
 *   chữ thừa hưởng `--on-brand` của khối gốc.
 *
 * Thêm: khối brand không phải pseudo-element BẮT BUỘC khai `color` — không khai thì chữ thừa
 * hưởng màu cha (`--ink`), ở theme tối là chữ sáng trên brand. Pseudo-element (`::after` chấm
 * trang trí) không có chữ nên miễn. */
function kiemChuTrenBrand(
  css: string,
  cap: Readonly<Record<string, string>>,
): { so_khoi_brand: number; vi_pham: string[] } {
  const ds = khoiLuat(css);
  const goc_brand = new Set<string>();
  const goc_brand_cung = new Set<string>();
  let so_khoi_brand = 0;
  const vi_pham: string[] = [];
  for (const k of ds) {
    const nen_brand = khaiNenDu(k.than).filter((n) => tokenDau(n.gia_tri) === "--brand");
    if (nen_brand.length === 0) continue;
    so_khoi_brand += 1;
    for (const c of k.chon) {
      const g = gocChon(c);
      if (g === "") continue;
      goc_brand.add(g);
      if (nen_brand.some((n) => n.quan_trong)) goc_brand_cung.add(g);
    }
    const co_chu = k.chon.filter((c) => !c.includes("::"));
    if (co_chu.length > 0 && khai(k.than, "color").length === 0) {
      vi_pham.push(`${co_chu.join(", ")}: nền brand mà không khai color — chữ thừa hưởng màu của cha`);
    }
  }
  for (const k of ds) {
    const goc = gocTrong(k, goc_brand);
    if (goc.length === 0) continue;
    const nen = khaiNen(k.than);
    const t = nen.length > 0 ? tokenDau(nen[nen.length - 1]) : "--brand";
    const van_brand = t === "--brand" || goc.some((g) => goc_brand_cung.has(g));
    const can = van_brand ? "--on-brand" : t !== null && cap[t] !== undefined ? cap[t] : null;
    const chu = khai(k.than, "color");
    // Tự đổi nền mà không khai `color` ⇒ chữ thừa hưởng `--on-brand` (trắng) của khối gốc, nằm
    // trên nền mới: accent tối 2.41:1, `--surface` sáng gần 1:1. `:disabled` miễn — trạng thái
    // ấy không ai đọc như một nút đang mời bấm, và khuôn của repo luôn tự khai chữ cho nó.
    if (!van_brand && chu.length === 0 && !k.chon.some((c) => c.includes(":disabled"))) {
      vi_pham.push(`${k.chon.join(", ")}: đổi nền sang ${nen[nen.length - 1]} mà không khai color — chữ thừa hưởng var(--on-brand)`);
    }
    for (const mau of chu) {
      if (can !== null) {
        if (tokenDau(mau) !== can) vi_pham.push(`${k.chon.join(", ")}: color ${mau} — chữ trên nền này phải là var(${can})`);
      } else if (!laMauTheoTheme(mau)) {
        vi_pham.push(`${k.chon.join(", ")}: color ${mau} — màu gõ cứng trên khối cùng gốc với nút brand`);
      } else if ((tokenDau(mau) ?? "").startsWith("--on-")) {
        // `--on-T` chỉ đúng trên đúng nền `--T`; trên nền ngoài cặp nó là chữ trắng trên nền
        // trắng (`--surface` sáng).
        vi_pham.push(`${k.chon.join(", ")}: color ${mau} — chữ --on-… trên nền ngoài cặp ${nen[nen.length - 1]}`);
      }
    }
  }
  return { so_khoi_brand, vi_pham };
}

type Rgb = readonly [number, number, number];

function hexRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const day = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(day.slice(i, i + 2), 16)) as unknown as Rgb;
}

/** `filter: brightness(k)` trên một màu: nhân từng kênh sRGB với `k`, làm tròn, chặn ở 255 —
 * khớp pixel thật phản biện đọc được (`#2563eb`×1.08 ⇒ `rgb(40,107,254)`). */
function nhanSang(mau: Rgb, k: number): Rgb {
  return mau.map((v) => Math.min(255, Math.round(v * k))) as unknown as Rgb;
}

/** Tương phản WCAG 2.1 giữa hai màu (kênh 0–255) — cùng công thức `tuong-phan.spec.ts`. */
function tiSo(a: Rgb, b: Rgb): number {
  const sang = (m: Rgb) => {
    const [r, g, bl] = m.map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [sang(a), sang(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const AA = 4.5;
/** Đo 2026-11-13: 11 khối hover `filter: brightness(1.08)` trên nền đặc, đếm theo cặp (khối,
 * token) —
 * - 6 nền `--brand`: `.nut_chinh` (thanh-tai-khoan, khoi-thao-luan), `.nut_mo`, `.gui`
 *   (form-dang-mach), `.nut_gui`, `.nut_dang_chinh`;
 * - 5 nền `--accent`: `.gui` (form-tai-khoan), `.nut_cai_dat`, `.nut_da_hieu`, `.chinh`,
 *   `.nutXacNhan`.
 * Tụt dưới mốc nghĩa là phép tách khối/khớp selector đã trôi, không phải "ít nút hơn" — đếm lại
 * bằng mắt rồi mới hạ. */
const SO_KHOI_HOVER_FILTER = 11;

/** Đo 2026-11-13: 13 khối nền `var(--brand)` trong mọi CSS module —
 * - 10 khối có chữ: `chuong .cham`, `drawer-dang-nhanh .nut_gui`, `form-dang-mach .gui`,
 *   `khoi-thao-luan .nut_chinh`, `logo .bieu_tuong`, `o-soan-nhat-ky .nut_mo` và `.nut_ghi`,
 *   `tab-ho-so .dang_chon, .dang_chon:hover`, `thanh-dieu-huong-duoi .nut_dang_chinh`,
 *   `thanh-tai-khoan .nut_chinh`;
 * - 3 khối pseudo-element trang trí: `chrome .hieu::after`, `drawer-dang-nhanh .dau::before`,
 *   `khoi-chu-mach .nhan_khoi::before, .dau::before`.
 * Tụt dưới mốc là phép nhận nền/tách khối đã trôi — đếm lại bằng mắt rồi mới hạ. */
const SO_KHOI_NEN_BRAND = 13;

/** Hover của nút nền đặc. Với mỗi token `--T` mà bảng có `--on-T` (cặp nền/chữ đã khai), tìm
 * mọi khối cùng selector với một khối nền `var(--T)` có khai `filter`. Giá trị chỉ được là
 * `brightness(<số>)`/`brightness(<số>%)` hoặc `none` — giá trị khác thì không tính được tương
 * phản, và báo đúng như thế. Tương phản tính cho `brightness(k)·nền` với `brightness(k)·chữ` (filter
 * áp lên CẢ phần tử, chữ cũng sáng lên) ở MỌI theme trong `theme`, ngưỡng AA 4.5.
 *
 * Khối có filter mà tự đặt nền khác `--T` thì cũng "không tính được": filter đang nhân một màu
 * hàm này không biết. */
function kiemHoverFilter(
  css: string,
  theme: Readonly<Record<string, Record<string, string>>>,
): { so_khoi: number; vi_pham: string[] } {
  const ds = khoiLuat(css);
  let so_khoi = 0;
  const vi_pham: string[] = [];
  for (const [t, on_t] of Object.entries(capNenChu(theme))) {
    const laNenT = (v: string) => tokenDau(v) === t;
    const goc_t = new Set<string>();
    for (const k of ds) {
      if (!khaiNen(k.than).some(laNenT)) continue;
      for (const c of k.chon) if (gocChon(c) !== "") goc_t.add(gocChon(c));
    }
    for (const k of ds) {
      const loc = khai(k.than, "filter");
      if (loc.length === 0 || gocTrong(k, goc_t).length === 0) continue;
      so_khoi += 1;
      const ten = `${k.chon.join(", ")} (nền ${t})`;
      const nen = khaiNen(k.than);
      if (nen.length > 0 && !nen.some(laNenT)) {
        vi_pham.push(`${ten}: filter trên nền ${nen.join(" / ")} — không tính được tương phản`);
        continue;
      }
      for (const v of loc) {
        if (v === "none") continue;
        const m = /^brightness\(\s*(\d*\.?\d+)\s*(%?)\s*\)$/.exec(v);
        if (m === null) {
          vi_pham.push(`${ten}: filter ${v} — không tính được tương phản (chỉ nhận brightness(k) hoặc none)`);
          continue;
        }
        const he_so = Number(m[1]) / (m[2] === "%" ? 100 : 1);
        for (const [ten_theme, bang] of Object.entries(theme)) {
          const r = tiSo(nhanSang(hexRgb(bang[t]), he_so), nhanSang(hexRgb(bang[on_t]), he_so));
          if (r < AA) vi_pham.push(`${ten}: ${v} ở theme ${ten_theme} = ${r.toFixed(2)}:1 < ${AA}`);
        }
      }
    }
  }
  return { so_khoi, vi_pham };
}

// ---------------------------------------------------------------------------------------------

const FILES = moiModuleCss();
const GLOBALS = doc("app/globals.css");
const THEME: Readonly<Record<string, Record<string, string>>> = {
  sáng: docToken(GLOBALS, ":root {"),
  tối: docToken(GLOBALS, ':root[data-theme="dark"]'),
};
const CAP = capNenChu(THEME);

/** Allowlist nền họ `--ink`, ghim theo file + selector. Đúng MỘT mục: thanh kéo 5px của bottom
 * sheet, không có chữ, cần đổi màu theo theme khi đang kéo. Thêm mục ở đây là quyết định của
 * phiên chính, không phải cách làm bài xanh. */
const CHO_PHEP_NEN_INK: readonly { file: string; chon: string }[] = [
  { file: "components/thanh-dieu-huong-duoi.module.css", chon: ".vung_keo:active .thanh_keo" },
];

test("danh sách file CSS module đọc được và không rỗng (chống bài đo rỗng)", () => {
  expect(FILES.length, "quét ra quá ít file — phép liệt kê đã trôi").toBeGreaterThan(30);
  for (const f of [
    "components/thanh-tai-khoan.module.css",
    "components/khoi-thao-luan.module.css",
    "components/o-soan-nhat-ky.module.css",
  ]) {
    expect(FILES).toContain(f);
  }
});

test("ca mẫu — `kiemNenInk` báo đúng ca sai, im ở ca hợp lệ", () => {
  const BAO = [
    ".n { background: var(--ink); }",
    ".n { background: var(--ink) !important; }",
    ".n { background: var(--ink-2); }",
    ".n { background-color: var(--ink-3) }",
    "@media (pointer: coarse) { .n { color: var(--bg); background:var(--ink) } }",
  ];
  for (const css of BAO) expect(kiemNenInk(css), css).toHaveLength(1);
  const IM = [
    ".n { background: color-mix(in srgb, var(--ink) 6%, transparent); }",
    ".n { color: var(--ink); border-color: var(--ink-2); }",
    ".n { background: var(--inset); }",
    "/* .n { background: var(--ink); } */",
  ];
  for (const css of IM) expect(kiemNenInk(css), css).toEqual([]);
  expect(kiemNenInk(".a, .b { background: var(--ink); }")).toEqual([
    ".a: background var(--ink)",
    ".b: background var(--ink)",
  ]);
});

test("ca mẫu — `tachCum`, `gocChon`, `tokenDau`, `khaiDu`", () => {
  expect(tachCum(":is(.a, .n), .b[data-x='1,2']")).toEqual([":is(.a, .n)", ".b[data-x='1,2']"]);
  expect(gocChon('.nut_mo[aria-current="page"]')).toBe(".nut_mo");
  expect(gocChon(".nut_mo[href]:hover")).toBe(".nut_mo");
  expect(gocChon(":global(html[data-da-dang-nhap='1']) .chua_biet")).toBe(".chua_biet");
  expect(gocChon(".gui:hover:not(:disabled)")).toBe(".gui");
  expect(gocChon(".hieu::after")).toBe(".hieu::after");
  expect(gocChon('[data-theme="dark"]')).toBe("");
  expect(tokenDau("var(--brand) url(x.png)")).toBe("--brand");
  expect(tokenDau("var(--brand, #1f5fd1)")).toBe("--brand");
  expect(tokenDau("var( --brand )")).toBe("--brand");
  expect(tokenDau("var(--brand-2)")).toBe("--brand-2");
  expect(tokenDau("color-mix(in srgb, var(--brand) 35%, transparent)")).toBeNull();
  expect(khaiDu("background: var(--brand) ! important;", "background")).toEqual([
    { gia_tri: "var(--brand)", quan_trong: true },
  ]);
  expect(khaiDu("color: #fff", "color")).toEqual([{ gia_tri: "#fff", quan_trong: false }]);
});

test("ca mẫu — `kiemChuTrenBrand` báo đúng ca sai, im ở ca hợp lệ", () => {
  const BAO = [
    // `color` khai hai lần, lần sau thắng (bản vòng 1 chỉ đọc lần đầu).
    ".n { background: var(--brand); color: var(--on-brand); color: #fff; }",
    ".n { background: var(--brand) !important; color: #fff; }",
    ".n { background-color: var(--brand); color: var(--ink); }",
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover { color: #fff; }",
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover:not(:disabled) { color: #fff !important; }",
    // Khối cùng selector trong `@media`, gộp chung cụm với selector khác (dạng `(pointer: coarse)`
    // của `thanh-tai-khoan.module.css`).
    ".n { background: var(--brand); color: var(--on-brand); } @media (pointer: coarse) { .l, .n { min-height: 44px; color: #fff; } }",
    ".n { background: var(--brand); color: var(--on-brand); } :global([data-theme='dark']) .n { color: #fff; }",
    // Phản biện lượt 1, điểm 1 (đã chạy thật: 10 passed, tối 2.41:1): hover đổi nền sang cặp
    // khác mà chữ gõ cứng.
    ".nut_thu { background: var(--brand); color: var(--on-brand); }\n.nut_thu:hover { background: var(--accent); color: #ffffff; }",
    // … và biến thể: nền gốc `!important` ⇒ nền hover không thắng, chữ vẫn nằm trên brand.
    ".nut_thu { background: var(--brand) !important; color: var(--on-brand); }\n.nut_thu:hover { background: var(--surface-2); color: var(--ink-2); }",
    // Nền mới ngoài cặp: miễn luật cặp nhưng cấm gõ cứng (hình dạng P-20261110-6).
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover { background: var(--surface); color: white; }",
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover { background: transparent; color: rgb(255, 255, 255); }",
    // Điểm 2: selector thuộc tính và `:is(…)` không còn làm khối rơi khỏi luật.
    '.nut_mo { background: var(--brand); color: var(--on-brand); } .nut_mo[aria-current="page"] { color: #ffffff; }',
    // Điểm 3: khối brand không khai `color` ⇒ chữ thừa hưởng `--ink`.
    ".x { background: var(--brand); }",
    // Điểm 4: các cách viết nền brand vẫn hợp lệ CSS.
    ".n { background: var(--brand) url(x.png); color: #fff; }",
    ".n { background: var(--brand, #1f5fd1); color: #fff; }",
    ".n { background: var(--brand) ! important; color: #fff; }",
    // Lượt sửa 2, phản biện điểm 1: tự đổi nền mà không khai `color` ⇒ chữ thừa hưởng
    // `--on-brand` trắng (accent tối 2.41:1).
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover { background: var(--accent); }",
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover { background: var(--surface); }",
    '.n { background: var(--brand); color: var(--on-brand); } .n[aria-pressed="false"] { background: transparent; }',
    // Điểm 2: nền ngoài cặp mà chữ `--on-…` — trắng trên trắng ở theme sáng.
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover { background: var(--surface); color: var(--on-brand) }",
    // Nghiệm thu: giữ phần nối `tachCum` vào `khoiLuat` — tách thô ở mọi dấu phẩy thì selector
    // thành `.n[data-x="a` và `b"]`, gốc không khớp `.n`, khối rơi khỏi luật.
    '.n { background: var(--brand); color: var(--on-brand) } .n[data-x="a,b"] { color: #fff }',
  ];
  for (const css of BAO) expect(kiemChuTrenBrand(css, CAP).vi_pham, css).not.toEqual([]);
  const IM = [
    ".n { background: var(--brand); color: var(--on-brand) !important; }",
    ".n { background: var(--brand); color: var(--on-brand); } .n:disabled { background: var(--inset); color: var(--ink-3); }",
    ".n { background: var(--brand); color: var(--on-brand); } .khac { color: #fff; }",
    ".n { background: color-mix(in srgb, var(--brand) 35%, transparent); color: var(--ink); }",
    ".n { background: var(--brand); color: var(--on-brand); border-color: var(--line); accent-color: red; }",
    // Hover sang cặp khác với đúng chữ của cặp ấy; nền ngoài cặp với chữ token/inherit.
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover { background: var(--accent); color: var(--on-accent); }",
    ".n { background: var(--brand); color: var(--on-brand); } .n[aria-expanded='true'] { background: var(--surface-2); color: var(--ink-2); }",
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover { background: transparent; color: inherit; }",
    ".n { background: var(--brand); color: var(--on-brand); } .n:hover { background: none; color: currentColor; }",
    // `:disabled` đổi nền mà không khai chữ: miễn luật "bắt buộc khai color".
    ".n { background: var(--brand); color: var(--on-brand); } .n:disabled { background: var(--inset); opacity: 0.6; }",
    // Nền brand trên pseudo-element (chấm sau chữ hiệu, vạch trước nhãn) — chữ của phần tử gốc
    // không nằm trên nền ấy, và pseudo-element không có chữ nên không bắt khai `color`.
    ".n::after { background: var(--brand); } .n { color: var(--ink); } .n:hover { color: var(--accent); }",
    // Hở biết trước (chú thích đầu file): selector con không bị bắt. Vá thì chuyển ca này lên BAO.
    ".n { background: var(--brand); color: var(--on-brand); } .n span { color: #fff; }",
    // Hở biết trước thứ hai: compound viết trong `:is(…)`/`:where(…)` bị bỏ cùng pseudo-class.
    // `tachCum` chỉ bảo đảm cụm không bị cắt sai ở dấu phẩy bên trong.
    ".n { background: var(--brand); color: var(--on-brand); } :is(.a, .n):hover { color: #fff; }",
  ];
  for (const css of IM) expect(kiemChuTrenBrand(css, CAP).vi_pham, css).toEqual([]);
});

test("ca mẫu — `kiemHoverFilter`: nhân sáng khớp pixel thật, báo đúng ca sai, im ở ca hợp lệ", () => {
  // Mốc: pixel phản biện đọc được trên nút brand theme tối đang hover.
  expect(nhanSang(hexRgb("#2563eb"), 1.08)).toEqual([40, 107, 254]);
  expect(nhanSang(hexRgb("#ffffff"), 1.08)).toEqual([255, 255, 255]);
  expect(tiSo([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  // Ở theme tối brand/on-brand còn ~4.54 khi hover 1.08 — sát ngưỡng, nên 1.2 phải đỏ.
  const n = ".n { background: var(--brand); color: var(--on-brand); }";
  const hop_le = kiemHoverFilter(`${n} .n:hover { filter: brightness(1.08); }`, THEME);
  expect(hop_le).toEqual({ so_khoi: 1, vi_pham: [] });
  expect(kiemHoverFilter(`${n} .n:hover { filter: brightness(108%); }`, THEME).vi_pham).toEqual([]);
  expect(kiemHoverFilter(`${n} .n:hover { filter: none; }`, THEME)).toEqual({ so_khoi: 1, vi_pham: [] });
  const sang_qua = kiemHoverFilter(`${n} .n:hover { filter: brightness(1.2); }`, THEME).vi_pham;
  expect(sang_qua.some((v) => v.includes("theme tối")), sang_qua.join("\n")).toBe(true);
  expect(kiemHoverFilter(`${n} .n:hover { filter: saturate(2); }`, THEME).vi_pham).toHaveLength(1);
  expect(
    kiemHoverFilter(`${n} .n:hover { background: var(--ink); filter: brightness(1.08); }`, THEME).vi_pham,
  ).toHaveLength(1);
  // `backdrop-filter` không phải `filter`; khối không cùng selector không tính.
  expect(kiemHoverFilter(`${n} .n:hover { backdrop-filter: blur(2px); }`, THEME).so_khoi).toBe(0);
  expect(kiemHoverFilter(`${n} .khac:hover { filter: brightness(3); }`, THEME).so_khoi).toBe(0);
  // Phản biện lượt 1, điểm 2 (đã chạy thật: tối 3.68): selector thuộc tính không còn che hover.
  const nut_mo = ".nut_mo { background: var(--brand); color: var(--on-brand); }";
  expect(kiemHoverFilter(`${nut_mo} .nut_mo[href]:hover { filter: brightness(1.3); }`, THEME).vi_pham).not.toEqual(
    [],
  );
  // Điểm 4: nền viết kèm fallback / lớp sau / `! important` vẫn được nhận.
  for (const nen of ["var(--brand, #1f5fd1)", "var(--brand) url(x.png)", "var(--brand) ! important"]) {
    const r = kiemHoverFilter(`.n { background: ${nen}; } .n:hover { filter: brightness(1.3); }`, THEME);
    expect(r.so_khoi, nen).toBe(1);
    expect(r.vi_pham, nen).not.toEqual([]);
  }
  // Nền accent cũng được đo (bảng có `--on-accent`).
  expect(
    kiemHoverFilter(".a { background: var(--accent); } .a:hover { filter: brightness(1.08); }", THEME).so_khoi,
  ).toBe(1);
});

test("(a)1 — không khối nào nền đặc họ `--ink` trong mọi CSS module (trừ đúng allowlist)", () => {
  const vi_pham = FILES.flatMap((f) =>
    kiemNenInk(doc(f))
      .filter((v) => !CHO_PHEP_NEN_INK.some((a) => a.file === f && v.startsWith(`${a.chon}:`)))
      .map((v) => `${f} ${v}`),
  );
  expect(vi_pham, "nền đặc họ `--ink`: ở theme tối nó là màu sáng — dùng `--brand` + `--on-brand`").toEqual([]);
});

test("(a)1 — mục allowlist nền `--ink` còn tồn tại (allowlist không được mục)", () => {
  for (const a of CHO_PHEP_NEN_INK) {
    const thay = kiemNenInk(doc(a.file)).filter((v) => v.startsWith(`${a.chon}:`));
    expect(thay, `${a.file} ${a.chon}: hết nền họ --ink thì gỡ mục này khỏi allowlist`).toHaveLength(1);
  }
});

test("(a)2 — khối nền `var(--brand)` và mọi khối cùng selector: `color` chỉ là `var(--on-brand)`", () => {
  let so_khoi_brand = 0;
  const vi_pham: string[] = [];
  for (const f of FILES) {
    const r = kiemChuTrenBrand(doc(f), CAP);
    so_khoi_brand += r.so_khoi_brand;
    vi_pham.push(...r.vi_pham.map((v) => `${f} ${v}`));
  }
  expect(so_khoi_brand, "số khối nền brand đã trôi — đếm lại rồi đặt mốc mới").toBeGreaterThanOrEqual(
    SO_KHOI_NEN_BRAND,
  );
  expect(vi_pham).toEqual([]);
});

test("(H1) hover `filter` của nút nền đặc giữ tương phản ≥ 4.5 ở CẢ HAI theme", () => {
  // Chống rỗng: bảng token phải có ít nhất hai cặp nền/chữ (`brand`, `accent`).
  expect(Object.keys(THEME["sáng"])).toEqual(expect.arrayContaining(["--brand", "--on-brand", "--accent", "--on-accent"]));
  expect(Object.keys(THEME["tối"])).toEqual(expect.arrayContaining(["--brand", "--on-brand", "--accent", "--on-accent"]));
  let so_khoi = 0;
  const vi_pham: string[] = [];
  for (const f of FILES) {
    const r = kiemHoverFilter(doc(f), THEME);
    so_khoi += r.so_khoi;
    vi_pham.push(...r.vi_pham.map((v) => `${f} ${v}`));
  }
  expect(so_khoi, "số khối hover-filter trên nền đặc đã trôi — đếm lại rồi đặt mốc mới").toBeGreaterThanOrEqual(
    SO_KHOI_HOVER_FILTER,
  );
  expect(vi_pham).toEqual([]);
});

test("(a)3 — nút bo tròn hẳn (999px) ở năm selector của việc 18", () => {
  const CAN: readonly (readonly [string, string])[] = [
    ["components/thanh-tai-khoan.module.css", ".nut_chinh"],
    ["components/khoi-thao-luan.module.css", ".nut_chinh"],
    ["components/khoi-thao-luan.module.css", ".nut_phu"],
    ["components/o-soan-nhat-ky.module.css", ".nut_mo"],
    ["components/o-soan-nhat-ky.module.css", ".nut_ghi"],
  ];
  for (const [f, chon] of CAN) {
    // Mọi khối nhắm ĐÚNG selector ấy (không pseudo) mà khai bo góc — ở mọi media query.
    const bo = khoiLuat(doc(f))
      .filter((k) => k.chon.includes(chon))
      .map((k) => /border-radius\s*:\s*([^;]+)/.exec(k.than)?.[1].trim())
      .filter((v): v is string => v !== undefined);
    expect(bo.length, `${f} ${chon}: không thấy khai border-radius`).toBeGreaterThan(0);
    for (const v of bo) expect(v, `${f} ${chon}`).toBe("999px");
  }
});
