import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const WEB = resolve(__dirname, "..", "..");

function doc(duongDanTuongDoi: string): string {
  return readFileSync(resolve(WEB, duongDanTuongDoi), "utf8");
}

test.describe("chu-ky-binh-luan", () => {
  test("trang-mach co link href='#khan-dai' de cuon xuong khan dai", () => {
    const tsx = doc("components/trang-mach.tsx");
    expect(tsx).toContain('href="#khan-dai"');
    expect(tsx).toContain('data-testid="chu-ky-so-binh-luan"');
    expect(tsx).toMatch(/mach\.comment_count\s*>=\s*1\s*\?\s*`\$\{mach\.comment_count\}\s*Bình luận`\s*:\s*["']Bình luận["']/);
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
