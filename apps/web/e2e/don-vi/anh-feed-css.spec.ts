import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Hàng rào CSS + JSX ảnh thẻ feed — `plans/2026-09-07-anh-feed-khong-ep-ngang.md` +
 * `plans/2026-09-07-w-thumb-cls-hang-rao.md` (P-20260907-4), chuyển sang thẻ thống nhất ở
 * đợt B của `plans/2026-11-11-thong-nhat-giao-dien-toan-site.md`.
 *
 * Trước đợt B ảnh feed là khối to hết chiều ngang (`noi-dung-the.*`, max-height 420px, chống CLS
 * bằng inline style). Nay thẻ mạch dùng MỘT ảnh nhỏ bên phải trong khung CỐ ĐỊNH
 * (`the-mach.module.css#.anh_o`, 168×104 / mobile 76×76) — chống CLS bằng chính khung cố định
 * ấy cộng `width`/`height` thuộc tính từ `w_thumb`/`h_thumb`. Hai bài đầu canh đúng hai điều đó.
 *
 * Đọc nguồn, không cần server.
 */

const CSS = resolve(__dirname, "..", "..", "components", "the-mach.module.css");
const TSX = resolve(__dirname, "..", "..", "components", "the-mach.tsx");

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
  test("anh feed nam trong khung co dinh 168x104 (mobile 76x76), anh lap day khung", () => {
    const css = boChuThichCss(readFileSync(CSS, "utf8"));
    const khois = cacKhoiAnh(css);
    expect(khois.length, "phải có ít nhất một rule chứa `.anh`").toBeGreaterThan(0);

    const anh = khois[0];
    expect(anh).toMatch(/\bwidth\s*:\s*100%/);
    expect(anh).toMatch(/\bheight\s*:\s*100%/);
    expect(anh).toMatch(/\bobject-fit\s*:\s*cover\b/);

    // Khung `.anh_o` có hai rule: desktop (ngoài @media) và mobile (trong @media). Không có
    // khung kích thước cố định thì ảnh nạp xong đẩy chữ — đúng bệnh CLS mà bài này canh.
    const khungs = [...css.matchAll(/\.anh_o\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(khungs.length, "phải có rule desktop VÀ rule mobile của `.anh_o`").toBe(2);
    expect(khungs[0]).toMatch(/\bwidth\s*:\s*168px/);
    expect(khungs[0]).toMatch(/\bheight\s*:\s*104px/);
    expect(khungs[0]).toMatch(/\boverflow\s*:\s*hidden\b/);
    expect(khungs[1]).toMatch(/\bwidth\s*:\s*76px/);
    expect(khungs[1]).toMatch(/\bheight\s*:\s*76px/);
  });

  test("jsx dung w_thumb/h_thumb chong CLS", () => {
    const src = boChuThichTs(readFileSync(TSX, "utf8"));
    expect(src).toMatch(/w_thumb/);
    expect(src).toMatch(/h_thumb/);
    // Không gắn width thuộc tính từ ảnh chính khi src là thumb.
    expect(src).not.toMatch(/width=\{anh\.w\b/);
    expect(src).not.toMatch(/height=\{anh\.h\b/);
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
