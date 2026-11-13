import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { MachTomTatOut, SubChiTietOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { SO_BAN_TIN_DAI, SUB_BAN_TIN, tieuDeBanTinGon } from "../../lib/ban-tin";
import {
  SO_BAI_MOI_GIA,
  SO_BAI_TAI_MOI_GIA,
  SO_MOI_DANG,
  chonMoiDang,
  dungGiaSach,
  idDaHien,
  subLenTrangChu,
} from "../../lib/nhom-bai-viet";

/** Hàm THUẦN của khối "Bài viết" trang chủ (plan `2026-11-11-bai-viet-trang-chu-gia-sach.md`).
 * Không mạng, không DB, không cổng — chạy song song với bất cứ thứ gì (`pnpm e2e:don-vi`).
 * Phần DOM thật ở `e2e/trang-chu-v2.spec.ts` / `e2e/trang-chu-giao-dien-moi.spec.ts`. */

function bai(id: number, sub: string): MachTomTatOut {
  return { id, sub: { slug: sub, ten: sub }, title: `Bài ${id}` } as MachTomTatOut;
}

function sub(slug: string, vi_tri: number | null): SubChiTietOut {
  return { slug, ten: `Tên ${slug}`, vi_tri_trang_chu: vi_tri } as SubChiTietOut;
}

test("hằng số theo plan: 3 bài Mới đăng, 3 bài mỗi giá, mỗi giá xin đủ bù phần trùng", () => {
  expect(SO_MOI_DANG).toBe(3);
  expect(SO_BAI_MOI_GIA).toBe(3);
  // Xin ít hơn thì ca "3 bài mới nhất của sub đều đã ở Mới đăng" làm giá thiếu bài.
  expect(SO_BAI_TAI_MOI_GIA).toBeGreaterThanOrEqual(SO_BAI_MOI_GIA + SO_MOI_DANG);
});

// Việc 20, vòng sửa 1: bài `tin-tuc` vẫn bị LOẠI khỏi Mới đăng — phòng thủ cho mạch bản tin cũ
// mà `chuyen_ban_tin` cố ý bỏ qua (chúng ở lại là `bai_viet` công khai trong sub ấy).
test("Mới đăng: bài mới nhất của MỌI chuyên mục, trừ mạch tin-tuc cũ; giữ thứ tự feed; tối đa 3", () => {
  const items = [
    bai(1, SUB_BAN_TIN), // mạch bản tin cũ lệnh chuyển bỏ qua — mới nhất mà vẫn không lên
    bai(2, "ngoai-hoi"), // sub không ai chọn lên giá — vẫn vào Mới đăng
    bai(3, "chung-khoan"),
    bai(4, SUB_BAN_TIN),
    bai(5, "vi-mo"),
    bai(6, "crypto"), // bài thứ 4 hợp lệ ⇒ rớt
  ];
  const truoc = items.map((m) => m.id);
  expect(chonMoiDang(items).map((m) => m.id)).toEqual([2, 3, 5]);
  expect(chonMoiDang(items, 2).map((m) => m.id)).toEqual([2, 3]);
  expect(items.map((m) => m.id), "không đột biến mảng gốc").toEqual(truoc);
  expect(chonMoiDang([bai(1, SUB_BAN_TIN)])).toEqual([]);
  expect(chonMoiDang([])).toEqual([]);
});

test("sub lên trang chủ: chỉ sub có vị trí, sắp theo vị trí, không đột biến", () => {
  const cac = [sub("a", null), sub("b", 3), sub("c", 1), sub("d", null), sub("e", 2)];
  const truoc = cac.map((s) => s.slug);
  expect(subLenTrangChu(cac).map((s) => s.slug)).toEqual(["c", "e", "b"]);
  expect(cac.map((s) => s.slug), "không đột biến danh sách gốc").toEqual(truoc);
  expect(subLenTrangChu([sub("a", null)])).toEqual([]);
  expect(subLenTrangChu([])).toEqual([]);
});

test("giá sách: bỏ bài đã ở Mới đăng, cắt 3, giữ thứ tự giá và thứ tự bài", () => {
  const gia = [
    { sub: sub("a", 1), items: [bai(1, "a"), bai(2, "a"), bai(3, "a"), bai(4, "a"), bai(5, "a")] },
    { sub: sub("b", 2), items: [bai(6, "b"), bai(7, "b")] },
  ];
  const cot = dungGiaSach(gia, new Set([1, 2]));
  expect(cot.map((c) => c.sub.slug)).toEqual(["a", "b"]);
  expect(cot.map((c) => c.baiViet.map((m) => m.id))).toEqual([
    [3, 4, 5],
    [6, 7],
  ]);
  // Không trùng bài nào đã hiện.
  expect(cot.flatMap((c) => c.baiViet.map((m) => m.id))).not.toContain(1);
  expect(cot.flatMap((c) => c.baiViet.map((m) => m.id))).not.toContain(2);
});

test("giá sách: giá không còn bài (rỗng, hoặc toàn bài đã ở Mới đăng) bị BỎ — ẩn cột, không khung rỗng", () => {
  const gia = [
    { sub: sub("a", 1), items: [bai(1, "a"), bai(2, "a")] }, // toàn bài đã hiện
    { sub: sub("b", 2), items: [] }, // sub chưa có bài / 404 → items rỗng
    { sub: sub("c", 3), items: [bai(9, "c")] },
  ];
  const cot = dungGiaSach(gia, new Set([1, 2]));
  expect(cot.map((c) => c.sub.slug)).toEqual(["c"]);
  expect(dungGiaSach([], new Set())).toEqual([]);
  expect(dungGiaSach([{ sub: sub("a", 1), items: [] }], new Set())).toEqual([]);
});

test("giá sách: đúng ca xin SO_BAI_TAI_MOI_GIA bài mà cả 3 bài đầu đã ở Mới đăng vẫn còn đủ 3", () => {
  const items = Array.from({ length: SO_BAI_TAI_MOI_GIA }, (_, i) => bai(i + 1, "a"));
  const cot = dungGiaSach([{ sub: sub("a", 1), items }], new Set([1, 2, 3]));
  expect(cot[0].baiViet.map((m) => m.id)).toEqual([4, 5, 6]);
});

// Bài "admin chọn tin-tuc làm giá ⇒ bỏ bài trùng dải Bản tin" đã BỎ ở việc 20 cùng `chonBanTin`:
// dải bản tin đọc bảng riêng, không chung bài nào với giá sách. Phần còn lại của nó — gộp nhiều
// dải vào tập đã hiện — đo ở đây.
test("idDaHien: gộp id của mọi dải đã hiện; không dải nào ⇒ tập rỗng", () => {
  expect([...idDaHien([bai(1, "a"), bai(2, "b")], [bai(3, "c")])].sort()).toEqual([1, 2, 3]);
  expect(idDaHien()).toEqual(new Set());
});

test("giá sách: không đột biến đầu vào", () => {
  const items = [bai(1, "a"), bai(2, "a")];
  const gia = [{ sub: sub("a", 1), items }];
  dungGiaSach(gia, new Set([1]));
  expect(items.map((m) => m.id)).toEqual([1, 2]);
  expect(gia).toHaveLength(1);
});

test("lib/nhom-bai-viet.ts không còn slug cứng nào (kể cả slug bản tin — việc 20)", () => {
  const nguon = readFileSync(resolve(__dirname, "..", "..", "lib", "nhom-bai-viet.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const chuoi = [...nguon.matchAll(/"([^"\n]*)"/g)].map((m) => m[1]);
  // Cho phép: đường import (gói và tương đối) và tên trường trong `Pick<…>`. Mọi chuỗi còn lại là
  // slug cứng → cấm.
  // `SUB_BAN_TIN` từng là ngoại lệ; từ việc 20 nó sống ở `lib/ban-tin.ts` và chỉ còn rẽ nhánh route.
  const TEN_TRUONG = new Set(["slug", "ten", "vi_tri_trang_chu"]);
  // `./ban-tin`: lọc phòng thủ của `chonMoiDang` (vòng sửa 1) lấy `SUB_BAN_TIN` qua import.
  const la = chuoi.filter(
    (s) => !s.startsWith("@gikky/") && !s.startsWith("./") && !TEN_TRUONG.has(s),
  );
  expect(la, "slug chuyên mục là dữ liệu (Sub.vi_tri_trang_chu), không gõ cứng ở web").toEqual([]);
});

/* -------------------------------------------- V1 — tiêu đề gọn của dải bản tin (việc 19 §3.6) -- */

test("V1 — tieuDeBanTinGon: bỏ tiền tố 'Bản tin DD/MM — ' vì dải đã in ngày ở <time>", () => {
  expect(tieuDeBanTinGon("Bản tin 11/11 — Dow Jones 52.231 điểm")).toBe("Dow Jones 52.231 điểm");
  // Gạch ngắn / gạch nối, có năm, khoảng trắng lệch, hoa thường.
  expect(tieuDeBanTinGon("Bản tin 1/2 – Vàng giữ 4.100 USD")).toBe("Vàng giữ 4.100 USD");
  expect(tieuDeBanTinGon("Bản tin 13/11/2026 - S&P 500 tăng 2,35%")).toBe("S&P 500 tăng 2,35%");
  expect(tieuDeBanTinGon("Bản tin 13/11/26—Nasdaq lên 25.253")).toBe("Nasdaq lên 25.253");
  expect(tieuDeBanTinGon("BẢN TIN 10/11 — Lãi suất")).toBe("Lãi suất");
  expect(tieuDeBanTinGon("bản tin 10/11 — Lãi suất")).toBe("Lãi suất");
});

test("V1 — tieuDeBanTinGon: không khớp, hoặc sau tiền tố không còn chữ ⇒ trả NGUYÊN", () => {
  for (const t of [
    "Bản tin 11/11 —",
    "Bản tin 11/11 —   ",
    "Dow Jones 52.231 điểm",
    "Bản tin sáng — Dow Jones",
    "Tổng hợp Bản tin 11/11 — Dow Jones",
    "Bản tin 11/11 Dow Jones",
    "",
  ]) {
    expect(tieuDeBanTinGon(t), JSON.stringify(t)).toBe(t);
  }
});

// Việc 20: `SO_BAN_TIN` (3, số bài giá sách loại theo dải) và `chonBanTin` đã bỏ — dải đọc
// `liet_ke_ban_tin({limit: SO_BAN_TIN_DAI})` thẳng từ API (ghim ở `e2e/don-vi/ban-tin.spec.ts`).
test("V1 — dải đầu trang vẽ 2 bản tin", () => {
  expect(SO_BAN_TIN_DAI).toBe(2);
});
