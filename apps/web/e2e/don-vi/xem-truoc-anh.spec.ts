import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnhOut, XemTruocOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import {
  SO_ANH_GALLERY_TOI_DA,
  SO_DONG_TRICH,
  TY_LE_MAC_DINH,
  chonThumb,
  tyLeKhung,
  tyLeKhungGallery,
} from "../../lib/xem-truoc-anh";
import { boChuThich } from "./quet";

const WEB = resolve(__dirname, "..", "..");
const GOC = resolve(WEB, "..", "..");
const doc = (duong: string) => readFileSync(resolve(GOC, duong), "utf8");

/** Hàng "Bài viết" ở trang chủ có xem trước theo ảnh — hàng rào ĐỌC NGUỒN và hàm thuần
 * (`plans/2026-11-10-bai-viet-xem-truoc-anh.md`, gallery kiểu Reddit:
 * `plans/2026-11-10-gallery-kieu-reddit.md`). Phần chạy trên trình duyệt thật nằm ở
 * `e2e/bai-viet-xem-truoc.spec.ts`.
 *
 * Hai nhóm:
 * - **L** — `lib/xem-truoc-anh.ts`: chọn bao nhiêu ảnh, khi nào có slide "Xem tất cả", tỉ lệ
 *   khung, và hằng `SO_ANH_GALLERY_TOI_DA` = `SO_ANH_XEM_TRUOC` của API;
 * - **N** — nguồn: màu (C1), hợp đồng API có `anh_khac`, và `TheMach` / `GalleryMoc` KHÔNG bị
 *   đụng. (Việc 24 gỡ khối "Bài viết" + gallery cùng các bài N đọc nguồn của chúng — xem ghi chú
 *   trước nhóm N.)
 */

const anh = (id: number, w: number | null = 480, h: number | null = 360): AnhOut => ({
  id,
  url: `/media/anh/${id}.jpg`,
  url_thumb: `/media/anh-thumb/${id}.jpg`,
  w: w === null ? null : w * 2,
  h: h === null ? null : h * 2,
  w_thumb: w,
  h_thumb: h,
  position: id,
  exif_taken_at: null,
});

/** `xem_truoc` của một mốc có `n` ảnh, đúng như API dựng (ảnh đầu ở `anh`, ảnh 2..10 ở
 * `anh_khac`, tối đa `SO_ANH_GALLERY_TOI_DA - 1` phần tử). */
const xemTruoc = (n: number): XemTruocOut => ({
  trich: "chữ",
  anh: n === 0 ? null : anh(1),
  anh_khac: Array.from({ length: Math.max(0, Math.min(n, SO_ANH_GALLERY_TOI_DA) - 1) }, (_, i) =>
    anh(i + 2),
  ),
  so_anh: n,
});

test.describe("L — chonThumb / tyLeKhung / tyLeKhungGallery", () => {
  test("hằng: 3 dòng chữ, tối đa 10 ảnh trong gallery", () => {
    expect(SO_DONG_TRICH).toBe(3);
    expect(SO_ANH_GALLERY_TOI_DA).toBe(10);
  });

  test("SO_ANH_GALLERY_TOI_DA (TS) = SO_ANH_XEM_TRUOC (api/api/schemas.py)", () => {
    // Hai hằng ở hai ngôn ngữ phải bằng nhau: API mang ít hơn thì slide cuối "Xem tất cả" xuất
    // hiện sớm; mang nhiều hơn thì web cắt mà API vẫn gửi (payload phí).
    const py = doc("api/api/schemas.py");
    const so = /^SO_ANH_XEM_TRUOC\s*=\s*(\d+)\s*$/m.exec(py)?.[1];
    expect(so, "không thấy SO_ANH_XEM_TRUOC trong api/api/schemas.py").toBeDefined();
    expect(Number(so)).toBe(SO_ANH_GALLERY_TOI_DA);
  });

  for (const [n, anhs, con_lai] of [
    [0, 0, 0],
    [1, 1, 0],
    [2, 2, 0],
    [3, 3, 0],
    [5, 5, 0],
    [10, 10, 0],
    [11, 10, 1],
    [12, 10, 2],
    [40, 10, 30],
  ] as const) {
    test(`${n} ảnh ⇒ ${anhs} ảnh trong gallery, slide "Xem tất cả" khi còn dư (con_lai = ${con_lai})`, () => {
      const r = chonThumb(xemTruoc(n));
      expect(r.anhs).toHaveLength(anhs);
      expect(r.con_lai).toBe(con_lai);
      expect(r.anhs.map((a) => a.id)).toEqual(Array.from({ length: anhs }, (_, i) => i + 1));
    });
  }

  test("`anh` null thì không ảnh nào, dù `so_anh` nói gì", () => {
    expect(chonThumb({ trich: "x", anh: null, anh_khac: [], so_anh: 4 })).toEqual({
      anhs: [],
      con_lai: 0,
    });
  });

  test("API cũ không có `anh_khac`: một ảnh (nhánh thumb đơn bỏ qua con_lai)", () => {
    const cu = { trich: "x", anh: anh(1), so_anh: 5 } as XemTruocOut;
    expect(chonThumb(cu)).toEqual({ anhs: [anh(1)], con_lai: 4 });
  });

  test("gallery ít ảnh hơn `so_anh` ⇒ `con_lai` = phần chênh (không còn điều kiện 'đầy 3')", () => {
    const r = chonThumb({ trich: "x", anh: anh(1), anh_khac: [anh(2)], so_anh: 6 });
    expect(r.anhs).toHaveLength(2);
    expect(r.con_lai).toBe(4);
  });

  test("`anh_khac` dài hơn 9 vẫn chỉ lấy tối đa 10 ảnh, đúng thứ tự", () => {
    const r = chonThumb({
      trich: "x",
      anh: anh(1),
      anh_khac: Array.from({ length: 14 }, (_, i) => anh(i + 2)),
      so_anh: 15,
    });
    expect(r.anhs.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.con_lai).toBe(5);
  });

  test("tỉ lệ khung thumb một ảnh: theo w/h, kẹp [0,6 ; 2], thiếu kích thước ⇒ 4:3", () => {
    expect(tyLeKhung({ w_thumb: 480, h_thumb: 360 })).toBeCloseTo(4 / 3, 5);
    expect(tyLeKhung({ w_thumb: 360, h_thumb: 480 })).toBeCloseTo(0.75, 5);
    expect(tyLeKhung({ w_thumb: 480, h_thumb: 48 })).toBe(2);
    expect(tyLeKhung({ w_thumb: 48, h_thumb: 480 })).toBe(0.6);
    expect(tyLeKhung({ w_thumb: null, h_thumb: null })).toBe(TY_LE_MAC_DINH);
    expect(tyLeKhung({ w_thumb: 0, h_thumb: 100 })).toBe(TY_LE_MAC_DINH);
    expect(tyLeKhung({ w_thumb: 100, h_thumb: null })).toBe(TY_LE_MAC_DINH);
  });

  test("tỉ lệ khung gallery: theo ảnh đầu, kẹp [1 ; 16/9], thiếu kích thước ⇒ 4:3", () => {
    expect(tyLeKhungGallery({ w_thumb: 480, h_thumb: 360 })).toBeCloseTo(4 / 3, 5);
    expect(tyLeKhungGallery({ w_thumb: 480, h_thumb: 270 })).toBeCloseTo(16 / 9, 5);
    // Panorama rộng hơn 16:9 ⇒ kẹp ở 16:9 (không bẹt hơn).
    expect(tyLeKhungGallery({ w_thumb: 480, h_thumb: 48 })).toBeCloseTo(16 / 9, 5);
    // Ảnh dọc ⇒ kẹp ở vuông (không cao hơn vuông).
    expect(tyLeKhungGallery({ w_thumb: 360, h_thumb: 480 })).toBe(1);
    expect(tyLeKhungGallery({ w_thumb: 48, h_thumb: 480 })).toBe(1);
    expect(tyLeKhungGallery({ w_thumb: null, h_thumb: null })).toBe(TY_LE_MAC_DINH);
    expect(tyLeKhungGallery({ w_thumb: 0, h_thumb: 100 })).toBe(TY_LE_MAC_DINH);
    expect(tyLeKhungGallery({ w_thumb: 100, h_thumb: null })).toBe(TY_LE_MAC_DINH);
  });
});

/* Việc 24 (plan `2026-11-13-bai-viet-sang-rail.md`): khối "Bài viết" của trang chủ
 * (`khoi-bai-viet.*`) và component gallery (`gallery-bai-viet.*`, đã không ai dùng từ khi trang chủ
 * thôi vẽ gallery) ĐÃ GỠ — các bài N đọc nguồn hai cặp file ấy (thumb 104×72, kẹp dòng, vùng bấm,
 * bàn phím / nút / lật của gallery…) bỏ theo. Còn lại: màu của `lib/xem-truoc-anh.ts`, hợp đồng API
 * `anh_khac`, và `TheMach` / `GalleryMoc` không bị đụng. */

test.describe("N — nguồn", () => {
  test("N1 (C1) — không mã màu thô trong lib/xem-truoc-anh.ts", () => {
    const re = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\bhwb\(|\blab\(|\boklch\(/;
    const sach = boChuThich(doc("apps/web/lib/xem-truoc-anh.ts"));
    expect(sach).not.toMatch(re);
  });

  test("N5 — hợp đồng: client sinh có `anh_khac`; OpenAPI có `anh_khac` là mảng AnhOut", () => {
    const ts = doc("packages/api-client/src/types.gen.ts");
    const kieu = /XemTruocOut = \{[\s\S]*?\n\};/.exec(ts)?.[0] ?? "";
    expect(kieu).toMatch(/anh_khac\??: Array<AnhOut>/);
    const spec = JSON.parse(doc("packages/api-client/openapi.json"));
    const p = spec.components.schemas.XemTruocOut.properties.anh_khac;
    expect(p.type).toBe("array");
    expect(p.items.$ref).toBe("#/components/schemas/AnhOut");
  });

  test("N6 — TheMach / GalleryMoc KHÔNG bị đụng: không biết gì về anh_khac / lib mới / gallery bài viết", () => {
    // `noi-dung-the.*` đã bị gỡ ở đợt B (thẻ thống nhất) nên không còn trong danh sách.
    for (const f of [
      "apps/web/components/the-mach.tsx",
      "apps/web/components/gallery-moc.tsx",
      "apps/web/components/gallery-moc.module.css",
    ]) {
      const s = doc(f);
      expect(s, f).not.toMatch(
        /anh_khac|xem-truoc-anh|SO_THUMB_TOI_DA|SO_ANH_GALLERY_TOI_DA|gallery-bai-viet|GalleryBaiViet/,
      );
    }
  });
});
