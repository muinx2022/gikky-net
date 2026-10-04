import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const GOC = resolve(__dirname, "..", "..");
const LAYOUT_TSX = resolve(GOC, "app", "layout.tsx");
const CHROME_CSS = resolve(GOC, "components", "chrome.module.css");
const THANH_TSX = resolve(GOC, "components", "thanh-dieu-huong-duoi.tsx");
const THANH_CSS = resolve(GOC, "components", "thanh-dieu-huong-duoi.module.css");

const FEED_TSX = resolve(GOC, "components", "feed.tsx");
const FEED_CSS = resolve(GOC, "components", "feed.module.css");

function boChuThichCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

test.describe("thanh dieu huong tren mobile va tablet (giong cafef)", () => {
  test("layout: dat ThanhDieuHuongDuoi ngay duoi Chrome", () => {
    const layout = readFileSync(LAYOUT_TSX, "utf8");
    expect(layout).toMatch(/<Chrome\s*\/>\s*<ThanhDieuHuongDuoi\s*\/>/);
  });

  test("chrome.module.css: mobile & tablet (<=960px) header cuon troi cung trang", () => {
    const css = boChuThichCss(readFileSync(CHROME_CSS, "utf8"));
    expect(css).toMatch(/@media\s*\(max-width:\s*960px\)[\s\S]*?\.chrome\s*\{[\s\S]*?position:\s*relative/);
  });

  test("thanh-dieu-huong-duoi.tsx: co logic cuon len sticky, cuon xuong an (<=960px)", () => {
    const tsx = readFileSync(THANH_TSX, "utf8");
    expect(tsx).toContain('"use client"');
    expect(tsx).toContain('window.addEventListener("scroll"');
    expect(tsx).toContain("window.innerWidth <= 960");
    expect(tsx).toContain('trangThai === "dau_trang"');
    expect(tsx).toContain('setTrangThai("cuon_xuong")');
    expect(tsx).toContain('setTrangThai("cuon_len")');
    expect(tsx).toContain('document.documentElement.dataset.thanhCuon');
  });

  test("thanh-dieu-huong-duoi.module.css: co khung giu cho va cac lop trang thai", () => {
    const css = boChuThichCss(readFileSync(THANH_CSS, "utf8"));
    expect(css).toMatch(/\.khung_giu_cho\s*\{[\s\S]*?height:\s*46px/);
    expect(css).toMatch(/\.cuon_xuong\s*\{[\s\S]*?transform:\s*translateY\(-100%\)/);
    expect(css).toMatch(/\.cuon_len\s*\{[\s\S]*?position:\s*fixed[\s\S]*?top:\s*0/);
    expect(css).toMatch(/@media\s*\(min-width:\s*961px\)[\s\S]*?\.thanh[\s\S]*?display:\s*none\s*!important/);
  });

  test("feed.tsx & feed.module.css: thanh tab feed hien thi trong luong, khong sticky tren mobile va mau nen goc", () => {
    const feed = readFileSync(FEED_TSX, "utf8");
    expect(feed).toContain("className={css.thanh_dinh}");

    const feedCss = boChuThichCss(readFileSync(FEED_CSS, "utf8"));
    // Màu nền gốc của thanh lọc feed là var(--bg), không phải var(--surface) (trắng)
    expect(feedCss).toMatch(/\.thanh_dinh\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--bg\) 95%, transparent\)/);
    // Trên mobile & tablet (<=960px): nằm tự nhiên trong luồng, không sticky
    expect(feedCss).toMatch(/@media\s*\(max-width:\s*960px\)[\s\S]*?\.thanh_dinh\s*\{[\s\S]*?position:\s*relative\s*!important/);
  });
});
