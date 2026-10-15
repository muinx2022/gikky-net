import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import manifest from "../../app/manifest";

const WEB = resolve(__dirname, "..", "..");
const LAYOUT_TSX = resolve(WEB, "app", "layout.tsx");
const GOI_Y_TSX = resolve(WEB, "components", "goi-y-cai-app.tsx");
const GOI_Y_CSS = resolve(WEB, "components", "goi-y-cai-app.module.css");
const THANH_TSX = resolve(WEB, "components", "thanh-dieu-huong-duoi.tsx");

function boChuThichCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

test.describe("goi-y-cai-app (PWA Web App)", () => {
  test("manifest.ts: tra ve manifest hop le cho PWA standalone", () => {
    const m = manifest();
    expect(m.name).toContain("gikky.net");
    expect(m.short_name).toBe("gikky");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.background_color).toBe("#f1f2f5");
    expect(m.theme_color).toBe("#3a46a8");

    const sizes = m.icons?.map((icon) => icon.sizes);
    expect(sizes).toContain("32x32");
    expect(sizes).toContain("180x180");
    expect(sizes).toContain("512x512");
  });

  test("layout.tsx: chua appleWebApp va render GoiYCaiApp", () => {
    const layout = readFileSync(LAYOUT_TSX, "utf8");
    expect(layout).toContain("appleWebApp");
    expect(layout).toMatch(/capable:\s*true/);
    expect(layout).toMatch(/title:\s*["']gikky["']/);
    expect(layout).toContain('import { GoiYCaiApp } from "@/components/goi-y-cai-app"');
    expect(layout).toContain("<GoiYCaiApp />");
  });

  test("goi-y-cai-app.module.css: tuan thu token mau va an tren desktop", () => {
    const css = boChuThichCss(readFileSync(GOI_Y_CSS, "utf8"));

    // Không chứa token cấm (--gain, --loss, --stamp)
    const TOKEN_CAM = ["--ga" + "in", "--lo" + "ss", "--st" + "amp"];
    for (const t of TOKEN_CAM) {
      expect(css).not.toContain(t);
    }

    // Không chứa mã hex của hệ màu lãi lỗ và hoàng thổ
    const HEX_CAM = [
      "#1C7A" + "4F",
      "#B33A" + "2B",
      "#43BE" + "83",
      "#E477" + "6A",
      "#B07A" + "2B",
      "#F5EB" + "DA",
      "#D8A4" + "55",
      "#2A23" + "18",
    ];
    for (const h of HEX_CAM) {
      expect(css.toLowerCase()).not.toContain(h.toLowerCase());
    }

    // Nổi ở đáy di động và ẩn hoàn toàn trên desktop (> 960px)
    expect(css).toMatch(/@media\s*\(min-width:\s*961px\)[\s\S]*?\.banner\s*\{[\s\S]*?display:\s*none\s*!important/);
  });

  test("thanh-dieu-huong-duoi.tsx: co nut Cai dat ung dung goi moModalCaiApp", () => {
    const thanh = readFileSync(THANH_TSX, "utf8");
    expect(thanh).toContain('import { moModalCaiApp } from "./goi-y-cai-app"');
    expect(thanh).toContain("Cài đặt ứng dụng");
    expect(thanh).toMatch(/moModalCaiApp\(\)/);
  });

  test("goi-y-cai-app.tsx: la Client Component va co day du logic PWA", () => {
    const tsx = readFileSync(GOI_Y_TSX, "utf8");
    expect(tsx).toContain('"use client"');
    expect(tsx).toContain("export function moModalCaiApp");
    expect(tsx).toContain("beforeinstallprompt");
    expect(tsx).toContain("appinstalled");
    expect(tsx).toContain("gikky:mo-cai-app");
    expect(tsx).toContain("gikky_an_goi_y_cai_app");
    expect(tsx).toContain("display-mode: standalone");
  });
});
