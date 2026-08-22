import type { BinhLuanOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { thamSoPhanTrangBiBo } from "../../lib/api";
import { NGUONG_HIEN_SO_DEM, nenHienSoDem } from "../../lib/dem";
import {
  SAU_KHAN_DAI,
  SORT_KHAN_DAI,
  docSort,
  idTrongTrang,
  neoBinhLuan,
  trangThaiDeepLink,
} from "../../lib/khan-dai";
import { tachSlugId, duongDanMach } from "../../lib/url";

test(`nguyên tắc 9: dưới ${NGUONG_HIEN_SO_DEM} bình luận thì ẩn số đếm`, () => {
  expect([0, 1, 2, 3].map(nenHienSoDem)).toEqual([false, false, false, false]);
  expect([4, 5, 24, 247].map(nenHienSoDem)).toEqual([true, true, true, true]);
});

test("docSort: ba giá trị hợp lệ giữ nguyên, rác quy về hay_nhat", () => {
  for (const s of SORT_KHAN_DAI) expect(docSort(s)).toBe(s);
  expect(docSort("hay_nhaat")).toBe("hay_nhat");
  expect(docSort(undefined)).toBe("hay_nhat");
  expect(docSort("")).toBe("hay_nhat");
  expect(docSort(["cu_nhat", "moi_nhat"])).toBe("cu_nhat");
});

test("deep-link: có trong trang thì cuộn được, không có thì phải NÓI RA", () => {
  const co = new Set([11, 22]);
  expect(trangThaiDeepLink(11, co)).toBe("cuon_duoc");
  // Nợ 1b #8 — bình luận nằm ở trang sau của khán đài. Trạng thái này bắt buộc phải tồn
  // tại: im lặng ở đây nghĩa là một nút bấm rồi không đi đâu.
  expect(trangThaiDeepLink(99, co)).toBe("trang_sau");
  expect(trangThaiDeepLink(11, new Set())).toBe("trang_sau");
});

/** Một chuỗi thẳng `depth = 1 … sau`, gốc ở đầu. `id` trùng `depth` cho dễ đọc. */
function chuoiSau(sau: number): BinhLuanOut[] {
  const nut = (depth: number, replies: BinhLuanOut[]): BinhLuanOut => ({
    id: depth,
    parent_id: depth === 1 ? null : depth - 1,
    depth,
    anchor_moc_seq: depth === 1 ? 1 : null,
    author: { username: "ai_do", display_name: "Ai Đó" },
    body: `tầng ${depth}`,
    created_at: "2026-03-04T02:20:00Z",
    edited_at: null,
    up_count: 0,
    down_count: 0,
    score: 0,
    trang_thai: "binh_thuong",
    la_chu_mach: false,
    tu_gap: false,
    replies,
  });
  let cay = nut(sau, []);
  for (let d = sau - 1; d >= 1; d -= 1) cay = nut(d, [cay]);
  return [cay];
}

test(`W8 — idTrongTrang dừng ở tầng ${SAU_KHAN_DAI}, đúng chỗ UI cắt render`, () => {
  const cay = chuoiSau(SAU_KHAN_DAI + 3);
  const co = idTrongTrang(cay);

  // Tầng 1..6 có `<li id="bl-N">` thật trong trang.
  for (let d = 1; d <= SAU_KHAN_DAI; d += 1) {
    expect(co.has(d), `tầng ${d} phải nằm trong trang`).toBe(true);
  }
  // Tầng 7 trở đi KHÔNG được render (`components/binh-luan.tsx` thay bằng link "tiếp tục
  // thread →"), nên không có neo nào để cuộn tới.
  for (let d = SAU_KHAN_DAI + 1; d <= SAU_KHAN_DAI + 3; d += 1) {
    expect(co.has(d), `tầng ${d} KHÔNG được coi là nằm trong trang`).toBe(false);
  }
});

test("W8 — deep-link tới bình luận sâu quá ngưỡng phải nói 'nằm ở trang sau'", () => {
  // Nợ B4: `idTrongTrang` từng duyệt cả cây, nên nút `depth ≥ 7` được báo "cuộn được" —
  // bấm xong trang đứng yên, không thông báo gì. Đó là ca người dùng không có cách nào
  // hiểu, tệ hơn hẳn một câu giải thích.
  const co = idTrongTrang(chuoiSau(SAU_KHAN_DAI + 2));
  expect(trangThaiDeepLink(SAU_KHAN_DAI, co)).toBe("cuon_duoc");
  expect(trangThaiDeepLink(SAU_KHAN_DAI + 1, co)).toBe("trang_sau");
  expect(trangThaiDeepLink(SAU_KHAN_DAI + 2, co)).toBe("trang_sau");
});

test("neo bình luận là một chỗ sinh một chỗ đọc", () => {
  expect(neoBinhLuan(1234)).toBe("bl-1234");
});

test("tách `<slug>-<id>`: id là khoá, slug chỉ để đọc", () => {
  expect(tachSlugId("nhat-ky-lenh-hpg-1008")).toEqual({
    slug: "nhat-ky-lenh-hpg",
    id: 1008,
  });
  // Slug rỗng hợp lệ — `slug_tu_title` của API trả chuỗi rỗng cho title toàn emoji.
  expect(tachSlugId("-1008")).toEqual({ slug: "", id: 1008 });
  expect(tachSlugId("khong-co-so")).toBeNull();
  expect(tachSlugId("khongcogach")).toBeNull();
  expect(tachSlugId("am-0")).toBeNull();
  expect(tachSlugId("qua-lon-99999999999999999999")).toBeNull();
});

test("dựng lại URL từ slug + id là phép đảo của phép tách", () => {
  for (const [slug, id] of [
    ["nhat-ky-lenh-hpg", 1008],
    ["", 7],
    ["a-b-c", 42],
  ] as const) {
    expect(tachSlugId(duongDanMach(slug, id).replace("/m/", ""))).toEqual({
      slug,
      id,
    });
  }
});

/* ---- Vá D5: tham số phân trang bị vứt phải NÓI RA -------------------------- */

test("D5 — offset khác 0 kèm sort thời gian là tham số BỊ BỎ, phải nói ra", () => {
  // Đường thứ ba, thứ mà bản đầu vứt im lặng. `?khan_dai=1&sort=moi_nhat&offset=20`:
  // hai sort thời gian phân trang bằng `cursor` (PLAN 5.3), nên `offset` không đi đâu cả.
  expect(thamSoPhanTrangBiBo("moi_nhat", { offset: 20 })).toBe(true);
  expect(thamSoPhanTrangBiBo("cu_nhat", { offset: 1 })).toBe(true);
  expect(thamSoPhanTrangBiBo("moi_nhat", { offset: 9999 })).toBe(true);
});

test("D5 — offset 0 / vắng mặt kèm sort thời gian thì KHÔNG báo (không vá quá tay)", () => {
  expect(thamSoPhanTrangBiBo("moi_nhat", {})).toBe(false);
  expect(thamSoPhanTrangBiBo("moi_nhat", { offset: 0 })).toBe(false);
  expect(thamSoPhanTrangBiBo("cu_nhat", {})).toBe(false);
});

test("D5 — offset là tham số HỢP LỆ của hay_nhat, không được báo bỏ", () => {
  // Chiều đối xứng: `hay_nhat` phân trang bằng `offset`, nên `offset=20` ở đây đi thẳng
  // xuống API. Báo "đã bỏ" ở ca này là nói dối theo chiều ngược lại.
  expect(thamSoPhanTrangBiBo("hay_nhat", { offset: 20 })).toBe(false);
  expect(thamSoPhanTrangBiBo("hay_nhat", { offset: 9999 })).toBe(false);
});

test("D5 — hai đường cũ (vá A1) vẫn còn nguyên", () => {
  // Cursor rỗng/rác…
  expect(thamSoPhanTrangBiBo("moi_nhat", { cursor: "" })).toBe(true);
  expect(thamSoPhanTrangBiBo("moi_nhat", { cursor: "   " })).toBe(true);
  // …và cursor gửi kèm `hay_nhat`.
  expect(thamSoPhanTrangBiBo("hay_nhat", { cursor: "abc" })).toBe(true);
  // Cursor trông hợp lệ kèm sort thời gian thì để API phán, chưa báo gì ở đây.
  expect(thamSoPhanTrangBiBo("moi_nhat", { cursor: "abc" })).toBe(false);
});
