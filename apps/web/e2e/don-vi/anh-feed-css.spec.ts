import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Hàng rào CSS + JSX ảnh thẻ feed — `plans/2026-09-07-anh-feed-khong-ep-ngang.md` +
 * `plans/2026-09-07-w-thumb-cls-hang-rao.md` (P-20260907-4).
 *
 * Đọc nguồn, không cần server. Canh cả CSS module lẫn JSX: quyền quyết `width` sau
 * bản vá CLS nằm ở inline style (`noi-dung-the.tsx`), nên chỉ quét `.module.css` là mù.
 */

const CSS = resolve(
  __dirname,
  "..",
  "..",
  "components",
  "noi-dung-the.module.css",
);
const TSX = resolve(__dirname, "..", "..", "components", "noi-dung-the.tsx");

/** Bỏ chú thích CSS `/* … *\/` để chuỗi trong comment không làm bài xanh giả. */
function boChuThichCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Bỏ chú thích JS/TS thông dụng. */
function boChuThichTs(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Mọi khối rule có selector chứa `.anh` (kể cả trong `@media` / selector lồng). */
function cacKhoiAnh(css: string): string[] {
  const ra: string[] = [];
  const re = /([^{}]+)\.anh\b([^{]*)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    ra.push(m[3]);
  }
  return ra;
}

test.describe("anh-feed-css", () => {
  test("anh feed rong 100% va khung tran 420", () => {
    const css = boChuThichCss(readFileSync(CSS, "utf8"));
    const khois = cacKhoiAnh(css);
    expect(khois.length, "phải có ít nhất một rule chứa `.anh`").toBeGreaterThan(0);

    const anhChinh = khois[0];
    expect(anhChinh).toMatch(/\bmax-width\s*:\s*100%/);
    expect(anhChinh).toMatch(/\bwidth\s*:\s*100%/);

    const khungM = css.match(/(?:^|\n)\.khung_anh\s*\{([^}]*)\}/);
    expect(khungM, "phải có rule `.khung_anh { … }`").not.toBeNull();
    const khung = khungM![1];
    expect(khung).toMatch(/\bwidth\s*:\s*100%/);
    expect(khung).toMatch(/\bmax-height\s*:\s*420px\b/);
    expect(khung).toMatch(/\boverflow\s*:\s*hidden\b/);
    expect(khung).toMatch(/\bmax-width\s*:\s*100%/);
  });

  test("jsx dung w_thumb/h_thumb chong CLS", () => {
    const src = boChuThichTs(readFileSync(TSX, "utf8"));
    expect(src).toMatch(/w_thumb/);
    expect(src).toMatch(/h_thumb/);
    // Không gắn width thuộc tính từ ảnh chính khi src là thumb.
    expect(src).not.toMatch(/width=\{xem_truoc\.anh\.w\b/);
    expect(src).not.toMatch(/height=\{xem_truoc\.anh\.h\b/);
  });

  test("phanTramChieuRongAnh phan bo ngau nhien on dinh trong khoang 72% - 92%", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { phanTramChieuRongAnh } = require("../../lib/anh");
    const urls = [
      "/media/anh/2026/09/a.webp",
      "/media/anh/2026/09/b.webp",
      "/media/anh/2026/09/c.webp",
      "/media/anh/2026/09/d.webp",
      "/media/anh/2026/09/e.webp",
    ];

    const ketQua = urls.map((u) => phanTramChieuRongAnh(u));
    for (const pt of ketQua) {
      expect(pt).toBeGreaterThanOrEqual(72);
      expect(pt).toBeLessThanOrEqual(92);
    }

    // Tinh deterministic: goi lai cung URL tra ve dung ket qua cu
    expect(phanTramChieuRongAnh(urls[0])).toBe(ketQua[0]);

    // Co su bien thien giua cac URL khac nhau (khong bang nhau ca luot)
    const setGiaTri = new Set(ketQua);
    expect(setGiaTri.size).toBeGreaterThan(1);
  });
});
