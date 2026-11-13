import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich, quetNguon } from "./quet";

/** T12 của plan `2026-11-13-ban-tin-len-dau-ban-quyen.md` (§3.4): khối "Chủ đề tuần" không còn ô
 * quan điểm, nên trang chủ không gọi API bình luận nào và mọi hàm chỉ phục vụ ô ấy đã xoá — không
 * để lại code chết. Phần DOM thật (T10, T11) ở `e2e/dai-ban-tin.spec.ts`. */

const WEB = resolve(__dirname, "..", "..");

/** Tên đã xoá ở việc 19. Quay lại ở mã sản phẩm ⇒ hoặc ô quan điểm sống lại, hoặc code chết. */
const TEN_DA_XOA = [
  "docBinhLuanGoc",
  "docBinhLuanGocMoiNhat",
  "SO_BINH_LUAN_CHON_QUAN_DIEM",
  "SO_BINH_LUAN_MOI_NHAT",
  "chonQuanDiem",
  "chonQuanDiemNoiBat",
  "trichQuanDiem",
  "SO_QUAN_DIEM_NOI_BAT",
] as const;

/** Mã sản phẩm (không phải bài đo): `components`, `app`, `lib`. */
const nguon = () =>
  quetNguon(WEB, /\.(tsx?|css)$/).filter((f) => /^(components|app|lib)\//.test(f.ten));

test("T12 — bộ file quét được không rỗng và có đúng hai file vừa sửa (chống đo RỖNG)", () => {
  const ten = nguon().map((f) => f.ten);
  expect(ten.length).toBeGreaterThan(100);
  for (const f of ["app/page.tsx", "lib/api.ts", "lib/chu-de.ts", "components/khoi-thao-luan.tsx"]) {
    expect(ten).toContain(f);
  }
});

test("T12 — `app/page.tsx` không gọi API bình luận (`docBinhLuan…`)", () => {
  const trang = readFileSync(resolve(WEB, "app/page.tsx"), "utf8");
  expect(trang).not.toContain("docBinhLuan");
  // …và vẫn tải chủ đề (bài này không xanh vì trang bị viết lại sạch trơn).
  expect(boChuThich(trang)).toMatch(/docFeedChuDe\(\)/);
});

test("T12 — không còn tên nào đã xoá trong mã sản phẩm (kể cả chú thích)", () => {
  const con: string[] = [];
  for (const f of nguon()) {
    for (const t of TEN_DA_XOA) {
      if (new RegExp(`\\b${t}\\b`).test(f.noi_dung)) con.push(`${f.ten}: ${t}`);
    }
  }
  expect(con).toEqual([]);
});

test("T12 — khối chủ đề không còn ô quan điểm trong mã nguồn", () => {
  const tsx = boChuThich(readFileSync(resolve(WEB, "components/khoi-thao-luan.tsx"), "utf8"));
  expect(tsx).not.toMatch(/data-testid="quan-diem/);
  expect(tsx).not.toMatch(/<h3\b/);
  // Phần còn lại vẫn ở đó.
  for (const id of ["chu-de-tieu-de", "chu-de-trang-thai", "chu-de-vao", "chu-de-viet", "chu-de-so-binh-luan"]) {
    expect(tsx, id).toContain(`data-testid="${id}"`);
  }
});
