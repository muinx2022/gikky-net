import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB = resolve(__dirname, "../..");

function doc(tep: string): string {
  return readFileSync(resolve(WEB, tep), "utf-8");
}

test.describe("hang-tren-actions", () => {
  test("trang-mach.tsx nhóm cum_trai và cum_phai trong hang_tren", () => {
    const code = doc("components/trang-mach.tsx");
    expect(code).toContain("className={css.cum_trai}");
    expect(code).toContain("className={css.cum_phai}");
    expect(code).toContain("<TrangThaiToiProvider key={mach.id} machId={mach.id}>");
  });

  test("trang-mach.module.css định nghĩa cum_trai và cum_phai", () => {
    const css = doc("components/trang-mach.module.css");
    expect(css).toContain(".cum_trai");
    expect(css).toContain(".cum_phai");
  });

  test("nut-theo-mach.tsx không ẩn (return null) khi trangThai chưa tải xong", () => {
    const code = doc("components/nut-theo-mach.tsx");
    expect(code).not.toContain("if (trangThai === null || !trangThai.dang_nhap) return null;");
    expect(code).toContain("const dang_theo = trangThai?.following ?? false;");
    expect(code).toContain("const dangTaiTrangThai = trangThai === null;");
  });
});
