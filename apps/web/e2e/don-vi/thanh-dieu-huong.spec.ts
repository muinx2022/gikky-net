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
const KHUNG_HAI_COT_CSS = resolve(GOC, "components", "khung-hai-cot.module.css");
const TRANG_MACH_CSS = resolve(GOC, "components", "trang-mach.module.css");
const GLOBALS_CSS = resolve(GOC, "app", "globals.css");

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

  test("trang-mach.module.css: hang_tren khong sticky, cuon tu nhien tren moi man hinh", () => {
    const tmCss = boChuThichCss(readFileSync(TRANG_MACH_CSS, "utf8"));
    expect(tmCss).not.toMatch(/\.hang_tren\s*\{[^}]*position:\s*sticky/);
    expect(tmCss).not.toMatch(/@media\s*\(min-width:\s*961px\)[\s\S]*?\.hang_tren\s*\{[\s\S]*?position:\s*sticky/);
  });

  test("khung-hai-cot.module.css: .khung desktop co padding 0 24px (khong dat padding-bottom day rail), .chinh dat padding 16px 0 56px; feed.module.css KHONG con luoi rieng", () => {
    // Hai cột toàn site (2026-11-10): lưới chỉ còn MỘT bản ở `khung-hai-cot.module.css`. Trước
    // đó vòng lặp này kiểm cả `feed.module.css` vì `Feed` có lưới ba cột riêng; nay file ấy
    // không được mọc lại `.khung` / `.chinh` / `.rail` (ba nguồn sự thật = cột nhảy ngang).
    const khungCss = boChuThichCss(readFileSync(KHUNG_HAI_COT_CSS, "utf8"));
    const feedCss = boChuThichCss(readFileSync(FEED_CSS, "utf8"));

    // .khung desktop không đặt padding-bottom để tránh đẩy rail khi cuộn tới cuối bài
    expect(khungCss).toMatch(/\.khung\s*\{[\s\S]*?padding:\s*0 24px;/);
    expect(khungCss).not.toMatch(/\.khung\s*\{[\s\S]*?padding:\s*0 24px 56px;/);
    // .chinh desktop nhận padding-bottom 56px
    expect(khungCss).toMatch(/\.chinh\s*\{[\s\S]*?padding:\s*16px 0 56px;/);

    expect(feedCss).not.toMatch(/\.khung\s*\{/);
    expect(feedCss).not.toMatch(/\.chinh\s*\{/);
    expect(feedCss).not.toMatch(/\.rail(_trai)?\s*[{,]/);
  });

  test("globals.css: --cao-chrome duoc cap nhat khop chieu cao that cua chrome tren desktop (61px)", () => {
    const globalsCss = boChuThichCss(readFileSync(GLOBALS_CSS, "utf8"));
    expect(globalsCss).toMatch(/--cao-chrome:\s*61px;/);
  });
});
