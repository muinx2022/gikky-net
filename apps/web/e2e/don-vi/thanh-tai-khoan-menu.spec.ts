import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const WEB = resolve(__dirname, "..", "..");

function doc(duongDanTuongDoi: string): string {
  return readFileSync(resolve(WEB, duongDanTuongDoi), "utf8");
}

test.describe("thanh-tai-khoan-menu", () => {
  test("thanh-tai-khoan co ref va lang nghe mousedown/Escape de dong menu khi click ra ngoai", () => {
    const tsx = doc("components/thanh-tai-khoan.tsx");
    expect(tsx).toContain("ref={hopRef}");
    expect(tsx).toMatch(/document\.addEventListener\(\s*["']mousedown["']/);
    expect(tsx).toMatch(/document\.addEventListener\(\s*["']keydown["']/);
    expect(tsx).toMatch(/e\.key\s*===\s*["']Escape["']/);
    expect(tsx).toMatch(/hopRef\.current\.contains\(e\.target/);
  });
});
