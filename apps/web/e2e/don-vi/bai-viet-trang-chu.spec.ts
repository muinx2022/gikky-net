import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { MachTomTatOut, SubChiTietOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import {
  SO_BAI_MOI_GIA,
  SO_BAI_TAI_MOI_GIA,
  SO_MOI_DANG,
  SUB_BAN_TIN,
  chonBanTin,
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

test("Mới đăng: bài mới nhất của MỌI chuyên mục, trừ tin-tuc; giữ thứ tự feed; tối đa 3", () => {
  const items = [
    bai(1, "tin-tuc"),
    bai(2, "ngoai-hoi"), // sub không ai chọn lên giá — vẫn vào Mới đăng
    bai(3, "chung-khoan"),
    bai(4, "tin-tuc"),
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

test("giá sách: admin chọn tin-tuc làm giá ⇒ bỏ bài trùng dải Bản tin (và dải Mới đăng)", () => {
  const items = [
    bai(1, "tin-tuc"),
    bai(2, "vi-mo"),
    bai(3, "tin-tuc"),
    bai(4, "tin-tuc"),
    bai(5, "tin-tuc"),
    bai(6, "tin-tuc"),
  ];
  const moi_dang = chonMoiDang(items);
  const ban_tin = chonBanTin(items); // 1, 3, 4
  const gia = [{ sub: sub("tin-tuc", 1), items: items.filter((m) => m.sub.slug === "tin-tuc") }];

  // Chỉ gộp Mới đăng (cách cũ): giá tin-tuc lặp lại đúng 3 bài của dải Bản tin.
  expect(dungGiaSach(gia, idDaHien(moi_dang))[0].baiViet.map((m) => m.id)).toEqual([1, 3, 4]);
  // Gộp cả Bản tin: giá chỉ còn bài CHƯA hiện.
  const daHien = idDaHien(moi_dang, ban_tin);
  expect([...daHien].sort()).toEqual([1, 2, 3, 4]);
  expect(dungGiaSach(gia, daHien)[0].baiViet.map((m) => m.id)).toEqual([5, 6]);
  expect(idDaHien()).toEqual(new Set());
});

test("giá sách: không đột biến đầu vào", () => {
  const items = [bai(1, "a"), bai(2, "a")];
  const gia = [{ sub: sub("a", 1), items }];
  dungGiaSach(gia, new Set([1]));
  expect(items.map((m) => m.id)).toEqual([1, 2]);
  expect(gia).toHaveLength(1);
});

test("lib/nhom-bai-viet.ts không còn slug cứng nào ngoài SUB_BAN_TIN", () => {
  const nguon = readFileSync(resolve(__dirname, "..", "..", "lib", "nhom-bai-viet.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const chuoi = [...nguon.matchAll(/"([^"\n]*)"/g)].map((m) => m[1]);
  // Cho phép: slug bản tin, đường import, và tên trường trong `Pick<…>`. Mọi chuỗi còn lại là
  // slug cứng → cấm.
  const TEN_TRUONG = new Set(["slug", "ten", "vi_tri_trang_chu"]);
  const la = chuoi.filter(
    (s) => s !== SUB_BAN_TIN && !s.startsWith("@gikky/") && !TEN_TRUONG.has(s),
  );
  expect(la, "slug chuyên mục là dữ liệu (Sub.vi_tri_trang_chu), không gõ cứng ở web").toEqual([]);
  expect(SUB_BAN_TIN).toBe("tin-tuc");
});
