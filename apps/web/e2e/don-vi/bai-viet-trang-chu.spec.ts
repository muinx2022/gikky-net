import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { MachTomTatOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { SO_BAN_TIN_DAI, SUB_BAN_TIN, tieuDeBanTinGon } from "../../lib/ban-tin";
import { SO_BAI_VIET_RAIL, SO_BAI_VIET_TAI, chonMoiDang } from "../../lib/nhom-bai-viet";

/** Hàm THUẦN của khối "Bài viết mới" ở rail phải (`/` và `/luat`, việc 24 — plan
 * `2026-11-13-bai-viet-sang-rail.md`). Không mạng, không DB, không cổng — chạy song song với bất
 * cứ thứ gì (`pnpm e2e:don-vi`). Phần DOM thật ở `e2e/trang-chu-giao-dien-moi.spec.ts` /
 * `e2e/rail-bai-viet.spec.ts`.
 *
 * Việc 24 gỡ khối "Bài viết" to (dải Mới đăng + giá sách) cùng các hàm giá sách (`dungGiaSach`,
 * `idDaHien`, `subLenTrangChu`) và bài đo của chúng; `chonMoiDang` ở lại vì lọc phòng thủ bản tin. */

function bai(id: number, sub: string): MachTomTatOut {
  return { id, sub: { slug: sub, ten: sub }, title: `Bài ${id}` } as MachTomTatOut;
}

test("hằng số theo plan: rail 10 bài, tải đủ dư để bù phần bị lọc", () => {
  expect(SO_BAI_VIET_RAIL).toBe(10);
  // Tải ít hơn số bài vẽ thì một mạch bản tin cũ lọt vào cửa sổ là rail thiếu bài.
  expect(SO_BAI_VIET_TAI).toBeGreaterThan(SO_BAI_VIET_RAIL);
  expect(SO_BAI_VIET_TAI).toBeLessThanOrEqual(50); // trần `limit` của feed
});

// Việc 20, vòng sửa 1: bài `tin-tuc` vẫn bị LOẠI — phòng thủ cho mạch bản tin cũ mà
// `chuyen_ban_tin` cố ý bỏ qua (chúng ở lại là `bai_viet` công khai trong sub ấy).
test("chonMoiDang: bài mới nhất của MỌI chuyên mục, trừ mạch tin-tuc cũ; giữ thứ tự feed; tối đa 10", () => {
  const items = [
    bai(1, SUB_BAN_TIN), // mạch bản tin cũ lệnh chuyển bỏ qua — mới nhất mà vẫn không lên
    bai(2, "ngoai-hoi"),
    bai(3, "chung-khoan"),
    bai(4, SUB_BAN_TIN),
    bai(5, "vi-mo"),
    bai(6, "crypto"),
  ];
  const truoc = items.map((m) => m.id);
  expect(chonMoiDang(items).map((m) => m.id)).toEqual([2, 3, 5, 6]);
  expect(chonMoiDang(items, 2).map((m) => m.id)).toEqual([2, 3]);
  expect(items.map((m) => m.id), "không đột biến mảng gốc").toEqual(truoc);
  expect(chonMoiDang([bai(1, SUB_BAN_TIN)])).toEqual([]);
  expect(chonMoiDang([])).toEqual([]);
  // Mặc định cắt đúng `SO_BAI_VIET_RAIL`, kể cả khi bài bị lọc nằm xen giữa.
  const nhieu = [bai(100, SUB_BAN_TIN), ...Array.from({ length: 30 }, (_, i) => bai(i + 1, "a"))];
  expect(chonMoiDang(nhieu).map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
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
