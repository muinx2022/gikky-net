import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { DAI_BOI_CANH_CHU_DE, catBoiCanhChuDe } from "../../lib/boi-canh-chu-de";
import { boChuThich } from "./quet";

/** Khối chủ đề cắt `xem_truoc.trich` về 240 ở client. API feed giữ 400 cho thẻ ảnh
 * (`plans/2026-11-15-fill-trich-cao-anh.md`, lượt sửa V1). Hàm thuần + đọc nguồn —
 * không mạng, không DB, không cổng. */

const WEB = resolve(__dirname, "..", "..");
const doc = (duong: string) => readFileSync(resolve(WEB, duong), "utf8");

test("hằng 240 và khối chủ đề gọi cắt trên trich", () => {
  expect(DAI_BOI_CANH_CHU_DE).toBe(240);
  // Bỏ chú thích trước: chữ "240" trong docstring không được làm bài xanh.
  const lib = boChuThich(doc("lib/boi-canh-chu-de.ts"));
  expect(lib, "240 phải là dòng gán, không phải chữ trong chú thích").toMatch(
    /^export const DAI_BOI_CANH_CHU_DE = 240;\s*$/m,
  );

  const tsx = boChuThich(doc("components/khoi-thao-luan.tsx"));
  expect(tsx).toMatch(/from "@\/lib\/boi-canh-chu-de"/);
  expect(tsx).toMatch(/const boi_canh = catBoiCanhChuDe\(moi_nhat\.xem_truoc\?\.trich \?\? ""\)/);
  expect(tsx).not.toMatch(/const boi_canh = moi_nhat\.xem_truoc\?\.trich/);
  // Chỗ in ra màn hình phải dùng biến đã cắt — chỉ ghim dòng gán thì vẫn xanh nếu
  // JSX in thẳng `xem_truoc.trich` (lỗ phản biện V1).
  expect(tsx).toMatch(
    /data-testid="chu-de-boi-canh"[\s\S]*?\{boi_canh\}/,
  );
  expect(tsx).not.toMatch(
    /data-testid="chu-de-boi-canh"[\s\S]*?xem_truoc\?\.trich/,
  );
});

test("CSS khối chủ đề vẫn kẹp bối cảnh ở 6 dòng", () => {
  const css = doc("components/khoi-thao-luan.module.css").replace(/\/\*[\s\S]*?\*\//g, " ");
  const khoi = /\.boi_canh\s*\{([^}]*)\}/.exec(css);
  expect(khoi, "thiếu rule .boi_canh").not.toBeNull();
  expect(khoi![1]).toMatch(/-webkit-line-clamp:\s*6\s*;/);
});

test("ngắn hơn hoặc đúng 240 giữ nguyên, không thêm …", () => {
  expect(catBoiCanhChuDe("")).toBe("");
  expect(catBoiCanhChuDe("Bối cảnh ngắn")).toBe("Bối cảnh ngắn");
  const dung = "á".repeat(DAI_BOI_CANH_CHU_DE);
  expect(catBoiCanhChuDe(dung)).toBe(dung);
  expect(catBoiCanhChuDe(dung)).not.toContain("…");
  // Đúng trần thì không cắt, nên cũng không tỉa khoảng trắng cuối.
  const chan = `${"a".repeat(DAI_BOI_CANH_CHU_DE - 1)} `;
  expect(chan).toHaveLength(DAI_BOI_CANH_CHU_DE);
  expect(catBoiCanhChuDe(chan)).toBe(chan);
});

test("dài hơn 240 và có khoảng trắng trong cửa sổ: cắt ở khoảng trắng, thêm …, không cắt giữa từ", () => {
  const s = `${"a".repeat(200)} ${"tuvung".repeat(20)}`;
  expect(s.length).toBeGreaterThan(DAI_BOI_CANH_CHU_DE);
  const ra = catBoiCanhChuDe(s);
  expect(ra).toBe(`${"a".repeat(200)}…`);
  expect(ra.endsWith("…")).toBe(true);
  expect(ra.includes("tuvung")).toBe(false);
  expect(ra.endsWith(" …")).toBe(false);

  // Khoảng trắng cuối bị bỏ trước dấu cắt — không để "… " lửng.
  const du = `${"a".repeat(230)}${" ".repeat(15)}${"b".repeat(20)}`;
  expect(catBoiCanhChuDe(du)).toBe(`${"a".repeat(230)}…`);
});

test("không có khoảng trắng thì cắt cứng đúng 240 rồi thêm …", () => {
  const s = "b".repeat(DAI_BOI_CANH_CHU_DE + 30);
  expect(catBoiCanhChuDe(s)).toBe(`${"b".repeat(DAI_BOI_CANH_CHU_DE)}…`);
});

test("khoảng trắng nằm trước 60% trần thì cắt cứng, cùng nhánh trich_van_ban", () => {
  // `khoang > DAI * 0.6`: index 144 không đủ, 145 thì cắt ở đó.
  const som = `${"a".repeat(144)} ${"b".repeat(200)}`;
  expect(catBoiCanhChuDe(som)).toBe(`${som.slice(0, DAI_BOI_CANH_CHU_DE)}…`);

  const du = `${"a".repeat(145)} ${"b".repeat(200)}`;
  expect(catBoiCanhChuDe(du)).toBe(`${"a".repeat(145)}…`);
  expect(catBoiCanhChuDe(du).includes("b")).toBe(false);
});
