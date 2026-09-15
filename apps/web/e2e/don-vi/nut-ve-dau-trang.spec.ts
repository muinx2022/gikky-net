import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const GOC = resolve(__dirname, "..", "..");
const LOGO_CSS = resolve(GOC, "components", "logo.module.css");
const FEED_TSX = resolve(GOC, "components", "feed.tsx");
const NUT_TSX = resolve(GOC, "components", "nut-ve-dau-trang.tsx");
const NUT_CSS = resolve(GOC, "components", "nut-ve-dau-trang.module.css");

function boChuThichCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

test.describe("logo va nut ve dau trang", () => {
  test("logo: svg_g khong bi scale khi hover (giu nguyen logo)", () => {
    const css = boChuThichCss(readFileSync(LOGO_CSS, "utf8"));
    expect(css).not.toMatch(/\.khung_hieu:hover\s+\.svg_g/);
    expect(css).not.toMatch(/transform:\s*scale/);
  });

  test("feed: nhung NutVeDauTrang vao khung feed", () => {
    const feed = readFileSync(FEED_TSX, "utf8");
    expect(feed).toContain('import { NutVeDauTrang } from "./nut-ve-dau-trang"');
    expect(feed).toContain("<NutVeDauTrang />");
  });

  test("nut-ve-dau-trang: component co data-testid, bat su kien scroll va cuon ve 0", () => {
    const tsx = readFileSync(NUT_TSX, "utf8");
    expect(tsx).toContain('"use client"');
    expect(tsx).toContain('data-testid="nut-ve-dau-trang"');
    expect(tsx).toContain('window.addEventListener("scroll"');
    expect(tsx).toContain("top: 0");
    expect(tsx).toContain("window.innerHeight");
  });

  test("nut-ve-dau-trang.module.css: dung fixed position va token hop le", () => {
    const css = boChuThichCss(readFileSync(NUT_CSS, "utf8"));
    expect(css).toContain("position: fixed");
    expect(css).toContain("z-index: 40");
    // Không dùng mã hex màu cấm hoặc token cấm
    expect(css).not.toMatch(/var\(--gain\)|var\(--loss\)|var\(--stamp\)/);
  });
});
