import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const WEB = resolve(__dirname, "..", "..");

function doc(duongDanTuongDoi: string): string {
  return readFileSync(resolve(WEB, duongDanTuongDoi), "utf8");
}

test.describe("chu-ky-binh-luan", () => {
  test("trang-mach su dung NutCuonBinhLuan", () => {
    const tsx = doc("components/trang-mach.tsx");
    expect(tsx).toMatch(/<NutCuonBinhLuan\s+soBinhLuan=\{mach\.comment_count\}/);
  });

  test("nut-cuon-binh-luan co href='#khan-dai' va cuon nhanh muot ma", () => {
    const tsx = doc("components/nut-cuon-binh-luan.tsx");
    expect(tsx).toContain('href="#khan-dai"');
    expect(tsx).toContain('data-testid="chu-ky-so-binh-luan"');
    expect(tsx).toMatch(/soBinhLuan\s*>=\s*1\s*\?\s*`\$\{soBinhLuan\}\s*Bình luận`\s*:\s*["']Bình luận["']/);
    expect(tsx).toMatch(/window\.scrollTo/);
    expect(tsx).toMatch(/requestAnimationFrame/);
  });

  test("khan-dai.module.css co scroll-margin-top tranh bi che boi header", () => {
    const css = doc("components/khan-dai.module.css");
    expect(css).toMatch(/scroll-margin-top/);
  });

  test("trang-mach.module.css co dinh nghia .link_binh_luan", () => {
    const css = doc("components/trang-mach.module.css");
    expect(css).toContain(".link_binh_luan");
  });
});
