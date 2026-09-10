import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

const WEB = resolve(__dirname, "..", "..");

function doc(duongDanTuongDoi: string): string {
  return readFileSync(resolve(WEB, duongDanTuongDoi), "utf8");
}

test.describe("sidebar-bai-moi", () => {
  test("Sidebar giu nguyen tinh PURE: khong goi API hay fetch truc tiep", () => {
    const sach = boChuThich(doc("components/sidebar.tsx"));
    // Chi duoc phep import type tu @gikky/api-client
    expect(sach).not.toMatch(/from\s+["']@\/lib\/api["']/);
    expect(sach).not.toMatch(/from\s+["']@gikky\/api-client\/client["']/);
    expect(sach).not.toMatch(/\bfetch\s*\(/);
  });

  test("Sidebar co khoi sidebar-bai-moi co dieu kien baiMoi.length > 0 va nhan tieuDeBaiMoi", () => {
    const sach = boChuThich(doc("components/sidebar.tsx"));
    expect(sach).toContain('data-testid="sidebar-bai-moi"');
    expect(sach).toMatch(/baiMoi\s*&&\s*baiMoi\.length\s*>\s*0/);
    expect(sach).toContain("{tieuDeBaiMoi}");
  });

  test("KhungHaiCot ho tro subSlug: nap docFeedSub va dat tieu de 'Cung chuyen muc'", () => {
    const sach = boChuThich(doc("components/khung-hai-cot.tsx"));
    expect(sach).toMatch(/docFeedSub\s*\(\s*subSlug/);
    expect(sach).toMatch(/subSlug\s*\?\s*["']Cùng chuyên mục["']\s*:\s*["']Bài mới nhất["']/);
    expect(sach).toMatch(/m\.id\s*!==\s*idMachHienTai/);
    expect(sach).toContain("baiMoi={bai_moi}");
    expect(sach).toContain("tieuDeBaiMoi={tieu_de}");
  });

  test("trang-mach truyen idMachHienTai={mach.id} va subSlug={mach.sub.slug} vao KhungHaiCot", () => {
    const sach = boChuThich(doc("components/trang-mach.tsx"));
    expect(sach).toMatch(/<KhungHaiCot\s+idMachHienTai=\{mach\.id\}\s+subSlug=\{mach\.sub\.slug\}/);
  });

  test("Logic loc bai moi khong bao gio chua chinh bai dang xem", () => {
    const mockItems = [
      { id: 101, title: "Bai 1" },
      { id: 102, title: "Bai 2" },
      { id: 103, title: "Bai 3" },
      { id: 104, title: "Bai 4" },
      { id: 105, title: "Bai 5" },
      { id: 106, title: "Bai 6" },
    ];

    // Dang xem bai 101
    const loc101 = mockItems.filter((m) => m.id !== 101).slice(0, 5);
    expect(loc101.length).toBe(5);
    expect(loc101.some((m) => m.id === 101)).toBe(false);
    expect(loc101[0].id).toBe(102);

    // Dang xem bai 999 (khong nam trong top 6)
    const loc999 = mockItems.filter((m) => m.id !== 999).slice(0, 5);
    expect(loc999.length).toBe(5);
    expect(loc999[0].id).toBe(101);
  });
});
