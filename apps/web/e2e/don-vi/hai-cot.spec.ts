import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich, quetNguon } from "./quet";

/** Hàng rào TĨNH của "hai cột toàn site" (user 2026-11-10: "thống nhất giao diện chung của web
 * là 2 cột, 1 cột content và cột bên phải"; plan `2026-11-10-hai-cot-toan-site.md`).
 *
 * Đo hình học thật (`x`/`width` của `<main>` ở mọi URL, click `/` → `/s/x` → `/m/…`) nằm ở
 * `e2e/hai-cot.spec.ts` — cần server. File này giữ phần KHÔNG cần server: nó chặn đúng những
 * lối quay lại ba nguồn sự thật cho lưới và cột trái.
 */

const WEB = resolve(__dirname, "..", "..");

function doc(tuongDoi: string): string {
  return readFileSync(resolve(WEB, tuongDoi), "utf8");
}

/** Mã nguồn sản phẩm (không phải bài đo): `components`, `app`, `lib`. */
function nguonSanPham() {
  const tat_ca = quetNguon(WEB, /\.(tsx?|css)$/);
  return tat_ca.filter((f) => /^(components|app|lib)\//.test(f.ten));
}

test("hai cột — hàng rào quét được mã nguồn (chống đo RỖNG)", () => {
  const f = nguonSanPham();
  expect(f.length).toBeGreaterThan(100);
  expect(f.some((x) => x.ten === "components/khung-hai-cot-vo.tsx")).toBe(true);
});

test("hai cột — cột trái đã xoá hẳn: không file, không tham chiếu", () => {
  for (const ten of [
    "components/cot-trai.tsx",
    "components/cot-trai.module.css",
    "components/khung-trang-chu.tsx",
    "components/khung-trang-chu.module.css",
  ]) {
    expect(existsSync(resolve(WEB, ten)), `${ten} phải đã xoá`).toBe(false);
  }
  const loi: string[] = [];
  for (const f of nguonSanPham()) {
    if (/cot-trai|CotTrai|rail_trai|Cột điều hướng|KhungTrangChu|khung-trang-chu|cot_trai/.test(f.sach)) {
      loi.push(f.ten);
    }
  }
  expect(loi, "còn dấu vết cột trái / khung trang chủ cũ").toEqual([]);
});

test("hai cột — MỘT lưới: khung-hai-cot.module.css có đúng hai track, ở MỌI viewport", () => {
  const css = boChuThichCss(doc("components/khung-hai-cot.module.css"));
  // Desktop: hai track `minmax(0, 760px) 300px`, không còn track 226px của cột trái.
  expect(css).toMatch(/\.khung\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*760px\)\s*300px;/);
  expect(css).not.toMatch(/226px/);
  expect(css).not.toMatch(/700px/);
  // Đúng một khai báo lưới hai track; phần còn lại là một track (`minmax(0, 1fr)`) dưới 960px.
  const luoi = [...css.matchAll(/grid-template-columns:\s*([^;]+);/g)].map((m) => m[1].trim());
  expect(luoi).toEqual(["minmax(0, 760px) 300px", "minmax(0, 1fr)"]);
});

test("hai cột — không CSS nào khác khai lưới cột nội dung + rail (không còn ba bản sao)", () => {
  const loi: string[] = [];
  for (const f of nguonSanPham().filter((x) => x.ten.endsWith(".css"))) {
    if (f.ten === "components/khung-hai-cot.module.css") continue;
    const s = boChuThichCss(f.noi_dung);
    // Dấu hiệu của một lưới "nội dung + rail": track cố định 300px (rail) hoặc 226px (cột trái cũ)
    // đứng cạnh một track `minmax(0, …)` của cột nội dung.
    if (/grid-template-columns:[^;]*(226px|300px)[^;]*;/.test(s) && /grid-template-columns:[^;]*minmax\(0,\s*\d+px\)/.test(s)) {
      loi.push(f.ten);
    }
    if (/\.rail(_trai)?\s*[{,]/.test(s)) loi.push(`${f.ten} (.rail)`);
  }
  expect(loi).toEqual([]);
});

test("hai cột — chỉ VoKhungHaiCot dùng khung-hai-cot.module.css và mọi đường vào đều đi qua nó", () => {
  const dung = nguonSanPham()
    .filter((f) => /khung-hai-cot\.module\.css/.test(f.sach) && /\.(tsx?)$/.test(f.ten))
    .map((f) => f.ten);
  expect(dung).toEqual(["components/khung-hai-cot-vo.tsx"]);

  for (const ten of [
    "components/khung-hai-cot.tsx",
    "components/khung-hai-cot-tinh.tsx",
    "components/feed.tsx",
    "app/page.tsx",
    "app/chu-de/page.tsx",
  ]) {
    expect(boChuThich(doc(ten)), `${ten} không dùng VoKhungHaiCot`).toMatch(/<VoKhungHaiCot\b/);
  }
  // `<main>` chỉ do vỏ dựng: một trang một `<main>`.
  expect(boChuThich(doc("components/khung-hai-cot-vo.tsx"))).toMatch(/<main\b/);
  for (const ten of ["components/khung-hai-cot.tsx", "components/khung-hai-cot-tinh.tsx", "components/feed.tsx"]) {
    expect(boChuThich(doc(ten)), `${ten} tự dựng <main>`).not.toMatch(/<main\b/);
  }
});

test("hai cột — rail phải mang khối khách + khối Chuyên mục ở MỌI trang có rail", () => {
  const sb = boChuThich(doc("components/sidebar.tsx"));
  // Khối khách luôn được dựng (tự ẩn nếu đã đăng nhập) — không có cờ nào tắt nó.
  // (Có thể kèm `tieuDe`/`moTa`: trang chủ đổi chữ khối khách, plan giao diện mới §3.4.)
  expect(sb).toMatch(/<KhoiKhach\b[^>]*\/>/);
  // Khối Chuyên mục không còn bị cờ `hienChuyenMuc` chặn: có `cacSub` là có khối.
  expect(sb).not.toMatch(/hienChuyenMuc/);
  expect(sb).toMatch(/cacSub\.length\s*>\s*0\s*\?\s*\(\s*<KhoiChuyenMuc\s+cacSub=\{cacSub\}\s*\/>/);
  expect(boChuThich(doc("components/khoi-chuyen-muc.tsx"))).toContain('data-testid="sidebar-cac-sub"');
  expect(boChuThich(doc("components/khoi-khach.tsx"))).toContain('data-testid="khoi-khach"');
  // Mọi trang tự dựng sidebar đều không truyền cờ cũ.
  for (const ten of ["app/page.tsx", "app/chu-de/page.tsx", "app/s/[sub]/page.tsx"]) {
    expect(boChuThich(doc(ten)), ten).not.toMatch(/hienChuyenMuc|\bhaiCot\b/);
  }
});

test("hai cột — /luat (khung tĩnh) lấy Chuyên mục ở TRÌNH DUYỆT, không ở server", () => {
  const tinh = boChuThich(doc("components/khung-hai-cot-tinh.tsx"));
  expect(tinh).toMatch(/<Sidebar\b[^>]*\bchuyenMucTuTrinhDuyet\b/);
  const client = doc("components/chuyen-muc-tu-trinh-duyet.tsx");
  expect(client.startsWith('"use client"')).toBe(true);
  expect(boChuThich(client)).toMatch(/docCacSubOTrinhDuyet\(\)/);
});

function boChuThichCss(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ");
}
