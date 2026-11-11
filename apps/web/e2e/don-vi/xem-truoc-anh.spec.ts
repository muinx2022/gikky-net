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
 * - **N** — nguồn: màu (C1), ảnh lazy, số dòng chữ đi qua một hằng, hợp đồng API có
 *   `anh_khac`, gallery (khung / track / nút / bộ đếm), và `TheMach` / `NoiDungThe` /
 *   `GalleryMoc` KHÔNG bị đụng.
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

const TSX = "apps/web/components/khoi-bai-viet.tsx";
const CSS = "apps/web/components/khoi-bai-viet.module.css";
const GAL_TSX = "apps/web/components/gallery-bai-viet.tsx";
const GAL_CSS = "apps/web/components/gallery-bai-viet.module.css";

/** Thân của luật CSS đầu tiên khớp selector (đã bỏ chú thích). */
const luat = (css: string, selector: string) => {
  const mau = selector.replace(/[.[\]]/g, "\\$&");
  return new RegExp(`${mau}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
};

test.describe("N — nguồn", () => {
  test("N1 (C1) — không mã màu thô trong tsx / css / lib của hàng bài viết và gallery", () => {
    const re = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\bhwb\(|\blab\(|\boklch\(/;
    for (const f of [TSX, CSS, GAL_TSX, GAL_CSS, "apps/web/lib/xem-truoc-anh.ts"]) {
      const sach = boChuThich(doc(f));
      expect(sach, `${f} có mã màu thô`).not.toMatch(re);
    }
    // Màu chỉ đi qua token: mọi `color`/`background`/`border` dùng var(--…) hoặc color-mix từ token.
    for (const f of [CSS, GAL_CSS]) {
      const css = boChuThich(doc(f));
      for (const m of css.matchAll(/(?:^|[;{\s])(color|background|border(?:-color)?)\s*:\s*([^;}]+)/g)) {
        const v = m[2].trim();
        expect(
          /var\(--|color-mix\(|^(inherit|transparent|none|0)\b|^\d+px solid var\(/.test(v) ||
            /^\d+px solid /.test(v),
          `${f} ${m[1]}: ${v}`,
        ).toBe(true);
      }
    }
  });

  test("N2 — mọi <img> của thư viện: lazy + decoding async + width/height từ w_thumb/h_thumb + alt (đúng MỘT thẻ)", () => {
    const src = boChuThich(doc(TSX));
    const imgs = src.match(/<img\b[\s\S]*?\/>/g) ?? [];
    expect(imgs, "thư viện chỉ có một thẻ <img>: thumb của mục bài viết").toHaveLength(1);
    const khoi = imgs[0];
    expect(khoi).toMatch(/loading="lazy"/);
    expect(khoi).toMatch(/decoding="async"/);
    expect(khoi).toMatch(/width=\{[\w.[\]]+\.w_thumb \?\? undefined\}/);
    expect(khoi).toMatch(/height=\{[\w.[\]]+\.h_thumb \?\? undefined\}/);
    expect(khoi).toMatch(/src=\{[\w.[\]]+\.url_thumb\}/);
    expect(khoi).toMatch(/alt=\{`Ảnh minh họa: \$\{mach\.title\}`\}/);
  });

  test("N3 — thư viện: tiêu đề kẹp 3 dòng, đoạn trích kẹp 2 dòng (CSS), mobile ẩn trích", () => {
    const css = boChuThich(doc(CSS));
    expect(luat(css, ".tieu_de")).toMatch(/-webkit-line-clamp:\s*3\b/);
    expect(luat(css, ".trich")).toMatch(/-webkit-line-clamp:\s*2\b/);
    expect(luat(css, ".trich")).toMatch(/overflow:\s*hidden/);
    // Chữ trích lấy từ `xem_truoc.trich` do server cắt, không tự cắt ở web.
    expect(boChuThich(doc(TSX))).toMatch(/mach\.xem_truoc\?\.trich/);
  });

  test("N4 — thumb của mục: khung CỐ ĐỊNH 104×72 (mobile 88×66) chống CLS, ảnh cover, ô nền khi không ảnh", () => {
    const css = boChuThich(doc(CSS));
    const t = luat(css, ".thumb");
    expect(t).toMatch(/width:\s*104px/);
    expect(t).toMatch(/height:\s*72px/);
    expect(t).toMatch(/overflow:\s*hidden/);
    expect(t).toMatch(/background:\s*var\(--surface-2\)/);
    const a = luat(css, ".anh");
    expect(a).toMatch(/object-fit:\s*cover/);
    expect(a).toMatch(/width:\s*100%/);
    expect(a).toMatch(/height:\s*100%/);
    // Mobile: 88×66.
    const mobile = /@media \(max-width: 640px\) \{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? "";
    expect(luat(mobile, ".thumb")).toMatch(/width:\s*88px/);
    expect(luat(mobile, ".thumb")).toMatch(/height:\s*66px/);
    // Dấu vết của hàng bài viết kiểu gallery đã gỡ khỏi trang chủ.
    expect(css).not.toMatch(/\.dai_gallery|\.them_anh|\.dai_mot_anh|--cao-thumb/);
    const tsx = boChuThich(doc(TSX));
    expect(tsx).not.toMatch(/GalleryBaiViet|gallery-bai-viet|chonThumb|tyLeKhung/);
  });

  test("N4b — khung gallery: aspect-ratio theo biến, trần 360px, track cuộn có snap, ảnh contain", () => {
    const css = boChuThich(doc(GAL_CSS));
    const g = luat(css, ".gallery");
    expect(g).toMatch(/aspect-ratio:\s*var\(--ty-le/);
    expect(g).toMatch(/max-height:\s*360px/);
    expect(g).toMatch(/overflow:\s*hidden/);
    expect(g).toMatch(/width:\s*100%/);
    const t = luat(css, ".track");
    expect(t).toMatch(/display:\s*flex/);
    expect(t).toMatch(/overflow-x:\s*auto/);
    expect(t).toMatch(/scroll-snap-type:\s*x mandatory/);
    expect(t).toMatch(/overscroll-behavior-x:\s*contain/);
    expect(t).toMatch(/scrollbar-width:\s*none/);
    const sl = luat(css, ".slide");
    expect(sl).toMatch(/flex:\s*0 0 100%/);
    expect(sl).toMatch(/scroll-snap-align:\s*center/);
    expect(sl).toMatch(/scroll-snap-stop:\s*always/);
    const a = luat(css, ".anh");
    expect(a).toMatch(/object-fit:\s*contain/);
    expect(a).toMatch(/width:\s*100%/);
    expect(a).toMatch(/height:\s*100%/);
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

  test("N6 — TheMach / NoiDungThe / GalleryMoc KHÔNG bị đụng: không biết gì về anh_khac / lib mới / gallery bài viết", () => {
    for (const f of [
      "apps/web/components/noi-dung-the.tsx",
      "apps/web/components/noi-dung-the.module.css",
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

  test("N7 — ảnh chỉ vẽ khi mốc 1 có ảnh (`xem_truoc.anh` khác null); ô thumb luôn có (không lệch cột)", () => {
    const tsx = boChuThich(doc(TSX));
    expect(tsx).toMatch(/anh !== null &&/);
    expect(tsx).toMatch(/data-co-anh=\{anh !== null \? "true" : "false"\}/);
    expect(tsx.match(/data-testid="bai-viet-thumb"/g)).toHaveLength(1);
  });

  test("N8 — a11y: thumb là aria-hidden (chỉ minh hoạ cho tiêu đề bên cạnh), trích là <p> NGOÀI mọi aria-hidden, gallery (component còn lại) là carousel có tên", () => {
    const tsx = boChuThich(doc(TSX));
    const thumb = /<span\s+className=\{css\.thumb\}[\s\S]*?>/.exec(tsx)?.[0] ?? "";
    expect(thumb, "phải tìm thấy ô thumb").not.toBe("");
    expect(thumb).toMatch(/aria-hidden="true"/);
    const p = /<p\s+className=\{css\.trich\}[\s\S]*?>/.exec(tsx)?.[0] ?? "";
    expect(p, "trich phải là một <p>").not.toBe("");
    expect(p).not.toMatch(/aria-hidden/);
    // Tiêu đề là heading chứa link thật; ngày trong <time datetime>.
    expect(tsx).toMatch(/<h4 className=\{css\.tieu_de\}>\s*<Link href=\{href\}/);
    expect(tsx).toMatch(/<time dateTime=\{mach\.published_at\}>/);
    // Component gallery vẫn còn trong repo (không còn dùng ở trang chủ): giữ nguyên hợp đồng a11y của nó.
    const g = boChuThich(doc(GAL_TSX));
    const khung = /<div\s+className=\{css\.gallery\}[\s\S]*?>/.exec(g)?.[0] ?? "";
    expect(khung).toMatch(/role="group"/);
    expect(khung).toMatch(/aria-roledescription="carousel"/);
    expect(khung).toMatch(/aria-label=\{`Ảnh của bài: \$\{tieuDe\}`\}/);
    expect(khung).not.toMatch(/aria-hidden/);
  });

  test("N9 — vùng bấm cả mục: .muc relative + ::after của link tiêu đề phủ inset 0", () => {
    const css = boChuThich(doc(CSS));
    expect(luat(css, ".muc")).toMatch(/position:\s*relative/);
    const sau = /\.tieu_de a::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(sau).toMatch(/content:\s*""/);
    expect(sau).toMatch(/position:\s*absolute/);
    expect(sau).toMatch(/inset:\s*0\b/);
    // Gallery (component còn lại): khung nằm trên lớp phủ nếu ai đó dùng lại nó trong một hàng.
    const g = luat(boChuThich(doc(GAL_CSS)), ".gallery");
    expect(g, ".gallery phải nằm trên lớp phủ").toMatch(/z-index:\s*1\b/);
    expect(g, ".gallery phải được định vị").toMatch(/position:\s*relative/);
  });

  test("N10 — component gallery: client, slide là children (server), nút là anh em của track, có nhãn / aria-live / giảm chuyển động / nạp sớm", () => {
    const g = boChuThich(doc(GAL_TSX));
    expect(g.trimStart().startsWith('"use client"')).toBe(true);
    // Slide server-render: component client không tự dựng ảnh / link (bot sẽ thấy khung rỗng).
    expect(g).not.toMatch(/<img\b|next\/link|<Link\b/);
    expect(g).toMatch(/\{children\}/);
    expect(boChuThich(doc(TSX)).trimStart().startsWith('"use client"')).toBe(false);
    // Hai nút: type="button", nhãn tiếng Việt, ẩn ở hai đầu bằng thuộc tính hidden.
    const nut = g.match(/<button\b[\s\S]*?>/g) ?? [];
    expect(nut).toHaveLength(2);
    expect(nut[0]).toMatch(/type="button"/);
    expect(nut[0]).toMatch(/aria-label="Ảnh trước"/);
    expect(nut[0]).toMatch(/hidden={!daNap || chi === 0}/);
    expect(nut[1]).toMatch(/type="button"/);
    expect(nut[1]).toMatch(/aria-label="Ảnh sau"/);
    expect(nut[1]).toMatch(/hidden={!daNap || chi === soSlide - 1}/);
    // Nút KHÔNG nằm trong track (bấm nút không được mở bài): </ul> đứng trước nút đầu tiên.
    expect(g.indexOf("</ul>")).toBeGreaterThan(-1);
    expect(g.indexOf("</ul>")).toBeLessThan(g.indexOf("<button"));
    // Bộ đếm: vùng live lịch sự, đọc "Ảnh n trên N".
    expect(g).toMatch(/aria-live="polite"/);
    expect(g).toMatch(/Ảnh \{chi \+ 1\} trên \{soAnh\}/);
    // Cuộn mượt, đổi sang tức thì khi người dùng giảm chuyển động.
    expect(g).toMatch(/prefers-reduced-motion: reduce/);
    expect(g).toMatch(/behavior: giamChuyenDong \? "auto" : "smooth"/);
    // Nạp sớm ở lần chạm / rê / focus đầu tiên.
    expect(g).toMatch(/img\.loading = "eager"/);
    for (const ev of ["onPointerEnter", "onTouchStart", "onFocus"]) expect(g).toContain(`${ev}={napSom}`);
  });

  test("N11 — nút chỉ hiện khi có chuột: ẩn mặc định, (hover: hover) mới hiện, hidden thắng display", () => {
    const css = boChuThich(doc(GAL_CSS));
    expect(luat(css, ".nut")).toMatch(/display:\s*none/);
    const media = /@media \(hover: hover\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(media, "phải có @media (hover: hover)").not.toBe("");
    expect(media).toMatch(/\.nut\s*\{[^}]*display:\s*grid[^}]*opacity:\s*0/);
    expect(media).toMatch(/\.gallery:hover \.nut/);
    // Không `:focus-within` thuần (giữ nút "dính" sau khi bấm chuột): chỉ `:hover` và `:has(:focus-visible)`.
    expect(media).toMatch(/\.gallery:has\(:focus-visible\) \.nut\s*\{[^}]*opacity:\s*1/);
    expect(css).not.toContain(":focus-within");
    expect(css).toMatch(/\.nut\[hidden\][^{]*\{\s*display:\s*none/);
    // Bộ đếm không bắt chuột: bấm xuyên xuống ảnh.
    expect(luat(css, ".bo_dem")).toMatch(/pointer-events:\s*none/);
  });
  test("N12 — bàn phím: track là điểm dừng Tab có tên + ←/→; focus nút chuyển SAU khi render (không đồng bộ trong lat); link 'Xem tất cả' có thứ tự Tab theo slide", () => {
    const g = boChuThich(doc(GAL_TSX));
    const ul = /<ul\b[\s\S]*?>/.exec(g)?.[0] ?? "";
    expect(ul, "phải có thẻ <ul> của track").not.toBe("");
    expect(ul).toMatch(/tabIndex=\{0\}/);
    expect(ul).toMatch(/aria-label="[^"]+"/);
    expect(ul).toMatch(/onKeyDown=\{khiNhanPhim\}/);
    expect(g).toMatch(/e\.key === "ArrowRight"/);
    expect(g).toMatch(/e\.key === "ArrowLeft"/);
    // Gốc lỗi cũ: `lat()` gọi `.focus()` ngay khi bấm, lúc nút đích còn `hidden` (hàng 2 slide) ⇒
    // focus rơi về <body>. Nay chỉ được chuyển focus trong `useLayoutEffect` sau khi render.
    const lat = /const lat = [\s\S]*?\n {2}\};\n/.exec(g)?.[0] ?? "";
    expect(lat, "phải tìm thấy hàm lat").not.toBe("");
    expect(lat, "lat() không được tự chuyển focus").not.toMatch(/\.focus\(\)/);
    const hieu_ung = /useLayoutEffect\(\(\) => \{[\s\S]*?\}, \[chi, soSlide\]\);/.exec(g)?.[0] ?? "";
    expect(hieu_ung, "phải có useLayoutEffect chuyển focus").toMatch(/\.focus\(\)/);
    // Chromium blur nút NGAY khi `hidden` được gán (trước useLayoutEffect) và onBlur của React không nhận: dùng focusout gốc.
    expect(g).toContain('nutTruoc.addEventListener("focusout", matTruoc)');
    expect(g).toContain('nutSau.addEventListener("focusout", matSau)');
    expect(g).not.toMatch(/onBlur=/);
    // Link "Xem tất cả" chỉ tab được khi slide của nó hiện.
    expect(g).toMatch(/lienKet\.tabIndex = chi === soSlide - 1 \? 0 : -1/);
  });

  test("N13 — viền focus của track, link 'Xem tất cả' và nút vẽ BÊN TRONG khung (offset âm cho phần tử phủ kín khung), chỉ token", () => {
    const css = boChuThich(doc(GAL_CSS));
    const khoi = /\.track:focus-visible,\s*\.xem_het:focus-visible\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(khoi, "phải có luật focus-visible cho track + .xem_het").not.toBe("");
    expect(khoi).toMatch(/outline:\s*\d+px solid var\(--[a-z-]+\)/);
    const off = /outline-offset:\s*(-?\d+)px/.exec(khoi)?.[1];
    expect(Number(off), "outline-offset phải ÂM: `.gallery` có overflow:hidden cắt viền ngoài").toBeLessThan(0);
    const day = /outline:\s*(\d+)px/.exec(khoi)?.[1];
    expect(Math.abs(Number(off)), "viền thụt vào ít nhất bằng độ day").toBeGreaterThanOrEqual(Number(day));
    const nut = /\.nut:focus-visible\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(nut).toMatch(/outline:\s*\d+px solid var\(--/);
    expect(luat(css, ".gallery")).toMatch(/overflow:\s*hidden/);
  });
  test("N14 — lật: đích cộng dồn (không đọc scrollLeft đang chạy dở), làm tròn bằng Math.round, hết cuộn thì xoá đích; rAF mồ côi; nút chỉ hiện sau hydrate", () => {
    const g = boChuThich(doc(GAL_TSX));
    // Gốc lỗi "mất bước": đích tính từ vị trí cuộn đang chạy dở của lần smooth trước.
    const lat = /const lat = [\s\S]*?\n {2}\};\n/.exec(g)?.[0] ?? "";
    expect(lat, "phải tìm thấy hàm lat").not.toBe("");
    expect(lat).toContain("dichDen.current ?? Math.round(el.scrollLeft / rong)");
    expect(lat).toContain("dichDen.current = dich;");
    expect(lat).toContain("datChi(dich);");
    // `Math.floor` ở đây làm vị trí lệch 1px (k·w − 1) nhảy lùi một slide; chỉ `Math.round`.
    expect(g).not.toMatch(/Math\.floor|Math\.ceil|Math\.trunc/);
    expect(g.match(/Math\.round\(/g)?.length, "docChi và lat đều làm tròn").toBe(2);
    // Đích bị xoá khi hết cuộn (scrollend, hẹn giờ dự phòng) và khi người dùng tự cuộn / chạm / bấm.
    expect(g).toContain('el?.addEventListener("scrollend", khiScrollEnd)');
    expect(g).toContain("window.setTimeout(xongCuon, 150)");
    for (const ev of ["onWheel", "onTouchStart", "onPointerDown"]) expect(g).toContain(`${ev}={huyDichDen}`);
    // rAF mồ côi: sau khi huỷ phải đặt lại null.
    expect(g).toMatch(/cancelAnimationFrame\(khungHinh\.current\);\s*(\/\/[^\n]*\n\s*)*khungHinh\.current = null;/);
    // Nút + bộ đếm chỉ hiện sau hydrate.
    expect(g).toContain("useSyncExternalStore");
    expect(g).toMatch(/hidden=\{!daNap \|\| chi === 0\}/);
    expect(g).toMatch(/hidden=\{!daNap \|\| chi === soSlide - 1\}/);
    expect(g).toMatch(/aria-live="polite" hidden=\{!daNap \|\| dangOXemHet\}/);
  });
});
