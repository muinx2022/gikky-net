import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

/** Việc 25 — plan `2026-11-13-dai-lenh-trang-mach.md`, tiêu chí D7. Đọc nguồn, không mạng/DB.
 *
 * Dải lệnh có MỘT bản markup (`components/dai-lenh.tsx`) cho cả thẻ feed lẫn trang chi tiết. Bài
 * này chặn đường trôi quen thuộc: ai đó chép lại dải vào `the-mach.tsx` / `trang-mach.tsx` "cho
 * nhanh", hai bản lệch nhau từ hôm ấy. Phần HTML thật (SSR, khớp API) ở `e2e/dai-lenh-trang-mach.spec.ts`.
 */

const WEB = resolve(__dirname, "..", "..");
const doc = (duong_dan: string) => readFileSync(resolve(WEB, duong_dan), "utf8");

/** Mọi `.ts`/`.tsx` của mã sản phẩm (`components/`, `app/`, `lib/`), đường dẫn tương đối `WEB`. */
function moiMaNguon(): string[] {
  const ra: string[] = [];
  for (const goc of ["components", "app", "lib"]) {
    for (const f of readdirSync(resolve(WEB, goc), { recursive: true, encoding: "utf8" })) {
      if (/\.tsx?$/.test(f)) ra.push(`${goc}/${f.replace(/\\/g, "/")}`);
    }
  }
  return ra.sort();
}

test.describe("D7 — dải lệnh dùng chung", () => {
  test("`cacOLenh(` chỉ được GỌI trong components/dai-lenh.tsx", () => {
    const files = moiMaNguon();
    expect(files.length, "đo rỗng: không đọc được mã nguồn").toBeGreaterThan(50);
    const goi = files.filter((f) => {
      // Bỏ chính khai báo `function cacOLenh(` ở `lib/lenh.ts`.
      const sach = boChuThich(doc(f)).replace(/function\s+cacOLenh\s*\(/g, "");
      return /\bcacOLenh\s*\(/.test(sach);
    });
    expect(goi).toEqual(["components/dai-lenh.tsx"]);
  });

  test("the-mach.tsx và trang-mach.tsx đều import + dựng <DaiLenh> với tiền tố testid của mình", () => {
    const the = boChuThich(doc("components/the-mach.tsx"));
    const trang = boChuThich(doc("components/trang-mach.tsx"));
    for (const [ten, nguon] of Object.entries({ the, trang })) {
      expect(nguon, `${ten}: import DaiLenh`).toMatch(
        /import\s*\{\s*DaiLenh\s*\}\s*from\s*["'](\.\/|@\/components\/)dai-lenh["']/,
      );
    }
    expect(the).toMatch(/<DaiLenh\s+lenh=\{lenh\}\s+tienTo="the-nhat-ky"\s*\/>/);
    expect(trang).toMatch(/<DaiLenh\s+lenh=\{mach\.lenh\}\s+tienTo="trang-mach"\s*\/>/);
    // Trang chi tiết: chỉ khi `mach.lenh` có.
    expect(trang).toMatch(/\{mach\.lenh\s*&&\s*\(/);
  });

  test("không còn markup dải trong the-mach.tsx / trang-mach.tsx (chỉ ở dai-lenh.tsx)", () => {
    const dau_hieu = [
      /aria-label="Lệnh"/,
      /NHAN_CHIEU_LENH/,
      /\bcacOLenh\b/,
      /data-testid=["{`][^"}`]*-lenh["}`]/, // testid "…-lenh" gõ tay
      /css\.(o_lenh|nhan_o|chieu)\b/,
      /conSo\.(mua|ban|gia_tp|gia_sl)\b/,
    ];
    for (const f of ["components/the-mach.tsx", "components/trang-mach.tsx"]) {
      const sach = boChuThich(doc(f));
      for (const d of dau_hieu) expect(sach, `${f}: ${d}`).not.toMatch(d);
    }
    const dai = boChuThich(doc("components/dai-lenh.tsx"));
    expect(dai).toContain('aria-label="Lệnh"');
    expect(dai).toMatch(/cacOLenh\(lenh\)/);
    // CSS của dải: MỘT bản, ở dai-lenh.module.css.
    const css_the = doc("components/the-mach.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css_the).not.toMatch(/\.(lenh|o_lenh|nhan_o|chieu|ma)\s*\{/);
    const css_dai = doc("components/dai-lenh.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const lop of ["lenh", "o_lenh", "nhan_o", "chieu", "ma"]) {
      expect(css_dai, `.${lop}`).toMatch(new RegExp(`(^|\\n)\\.${lop}\\s*\\{`));
    }
  });
});
