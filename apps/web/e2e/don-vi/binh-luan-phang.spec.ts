import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { BinhLuanOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import {
  SO_REPLY_HIEN_SAN,
  chiaReply,
  chuTraLoi,
  hienReply,
  idTuNeo,
  lamPhangThread,
  nguoiThamGia,
  sapThreadUuTien,
} from "../../lib/binh-luan-phang";
import { boChuThich } from "./quet";

/** Bình luận trang mạch kiểu TikTok — `plans/2026-11-16-binh-luan-kieu-tiktok.md`.
 *
 * Ghim hai hàm thuần mà khu bình luận đứng trên: làm phẳng thread (thứ tự, dòng `↪`, bia
 * mộ cha, nút "mồ côi") và luật ưu tiên người đang đăng nhập (stable, chưa đăng nhập không
 * đổi gì, reply của tôi không bao giờ vào đuôi gập). Phần nối dây vào component đọc từ
 * nguồn — không dựng trang.
 */

let dem = 0;
function nut(
  id: number,
  o: {
    ai?: string | null;
    ten?: string | null;
    khi?: string;
    trang_thai?: BinhLuanOut["trang_thai"];
    parent_id?: number | null;
    depth?: number;
    replies?: BinhLuanOut[];
  } = {},
): BinhLuanOut {
  dem += 1;
  const ai = o.ai === undefined ? `u${id}` : o.ai;
  return {
    id,
    parent_id: o.parent_id ?? null,
    depth: o.depth ?? 1,
    anchor_moc_seq: null,
    author: ai === null ? null : { username: ai, display_name: o.ten ?? "", avatar_url: null },
    body: `thân ${id}`,
    body_dinh_dang: "markdown",
    created_at: o.khi ?? `2026-11-16T00:00:${String(dem % 60).padStart(2, "0")}Z`,
    edited_at: null,
    up_count: 0,
    down_count: 0,
    score: 0,
    trang_thai: o.trang_thai ?? "binh_thuong",
    la_chu_mach: false,
    tu_gap: false,
    replies: o.replies ?? [],
  };
}

const t = (giay: number) => `2026-11-16T10:00:${String(giay).padStart(2, "0")}Z`;

test("làm phẳng: MỌI tầng ra một danh sách, created_at tăng dần, hoà thì id tăng dần", () => {
  // Server sắp sibling theo sort đang xem (hay_nhat = wilson), nên thứ tự trong `replies`
  // KHÔNG phải thứ tự thời gian — cố ý dựng ngược để bài đo phân biệt được.
  const goc = nut(1, {
    khi: t(0),
    replies: [
      nut(30, {
        khi: t(30),
        replies: [nut(40, { khi: t(40), replies: [nut(50, { khi: t(5) })] })],
      }),
      nut(20, { khi: t(20) }),
      nut(11, { khi: t(10) }),
      nut(10, { khi: t(10) }),
    ],
  });
  const ra = lamPhangThread(goc).map((r) => r.nut.id);
  expect(ra).toEqual([50, 10, 11, 20, 30, 40]);
  expect(ra, "gốc không nằm trong danh sách reply").not.toContain(1);
  expect(new Set(ra).size, "mỗi nút đúng một lần").toBe(ra.length);
});

test("dòng ↪: reply thẳng vào gốc KHÔNG có; reply vào reply có @tên hiển thị của cha", () => {
  const goc = nut(1, {
    replies: [
      nut(2, {
        ai: "an",
        ten: "An Nguyễn",
        replies: [nut(3, { ai: "binh", replies: [nut(4)] })],
      }),
    ],
  });
  const theo = new Map(lamPhangThread(goc).map((r) => [r.nut.id, r.cha]));
  expect(theo.get(2), "cha là gốc ⇒ không dòng ↪").toBeNull();
  expect(theo.get(3)).toEqual({ loai: "nguoi", ten: "An Nguyễn" });
  // Không có display_name ⇒ username (`tenHienThi`).
  expect(theo.get(4)).toEqual({ loai: "nguoi", ten: "binh" });
  expect(chuTraLoi(theo.get(3)!)).toBe("↪ trả lời @An Nguyễn");
});

test("dòng ↪: cha là bia mộ ⇒ nhãn bia mộ, không lộ tên", () => {
  const goc = nut(1, {
    replies: [
      nut(2, { ai: "x", trang_thai: "da_xoa", replies: [nut(3)] }),
      nut(4, { ai: "y", trang_thai: "da_an", replies: [nut(5)] }),
    ],
  });
  const theo = new Map(lamPhangThread(goc).map((r) => [r.nut.id, r.cha]));
  expect(theo.get(3)).toEqual({ loai: "da_xoa" });
  expect(theo.get(5)).toEqual({ loai: "da_an" });
  expect(chuTraLoi(theo.get(3)!)).toBe("↪ trả lời [bình luận đã xoá]");
  expect(chuTraLoi(theo.get(5)!)).toBe("↪ trả lời [đã bị ẩn]");
});

test("dòng ↪: cha còn sống mà KHÔNG có tác giả (author null) ⇒ không in dòng, không bịa '@?'", () => {
  const goc = nut(1, { replies: [nut(2, { ai: null, replies: [nut(3)] })] });
  expect(lamPhangThread(goc).find((r) => r.nut.id === 3)!.cha).toBeNull();
  // display_name trống nhưng có username ⇒ vẫn gọi được bằng username.
  const goc2 = nut(1, { replies: [nut(2, { ai: "binh", ten: "  ", replies: [nut(3)] })] });
  expect(lamPhangThread(goc2).find((r) => r.nut.id === 3)!.cha).toEqual({
    loai: "nguoi",
    ten: "binh",
  });
});

test("nút 'mồ côi' (parent_id không khớp ai trong thread) vẫn ra đúng một lần, cha theo cấu trúc", () => {
  // Cha lấy theo CẤU TRÚC cây server dựng, không tra `parent_id` — nên dữ liệu lệch
  // (parent_id trỏ ra ngoài thread, hoặc null ở tầng sâu) không làm rơi nút nào.
  const goc = nut(1, {
    replies: [
      nut(2, {
        ai: "an",
        parent_id: 1,
        replies: [nut(3, { parent_id: 999 }), nut(4, { parent_id: null, depth: 3 })],
      }),
    ],
  });
  const ra = lamPhangThread(goc);
  expect(ra.map((r) => r.nut.id).sort()).toEqual([2, 3, 4]);
  for (const id of [3, 4]) {
    expect(ra.find((r) => r.nut.id === id)!.cha).toEqual({ loai: "nguoi", ten: "an" });
  }
});

test("người tham gia = tác giả gốc + mọi reply mọi tầng, không trùng, bỏ tác giả null", () => {
  const goc = nut(1, {
    ai: "goc",
    replies: [nut(2, { ai: "an", replies: [nut(3, { ai: "sau" }), nut(4, { ai: "an" })] }), nut(5, { ai: null })],
  });
  expect(nguoiThamGia(goc).sort()).toEqual(["an", "goc", "sau"]);
});

type T = { id: number; nguoiThamGia: string[] };
const threads: T[] = [
  { id: 1, nguoiThamGia: ["a"] },
  { id: 2, nguoiThamGia: ["toi", "b"] },
  { id: 3, nguoiThamGia: ["c"] },
  { id: 4, nguoiThamGia: ["d", "toi"] },
  { id: 5, nguoiThamGia: ["e"] },
];

test("thread có tôi lên đầu, STABLE ở cả hai nhóm", () => {
  expect(sapThreadUuTien(threads, "toi").map((x) => x.id)).toEqual([2, 4, 1, 3, 5]);
});

test("chưa đăng nhập / phiên đang tải (toi = null): thứ tự server, không đổi gì", () => {
  expect(sapThreadUuTien(threads, null).map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
  expect(sapThreadUuTien(threads, "").map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
  // Không ai khớp ⇒ cũng không đổi.
  expect(sapThreadUuTien(threads, "nguoi_la").map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
});

type R = { id: number; tacGia: string | null };
const r = (id: number, tacGia: string | null): R => ({ id, tacGia });

test(`gập đuôi: ≤ ${SO_REPLY_HIEN_SAN} reply hiện hết, > ${SO_REPLY_HIEN_SAN} thì phần sau vào đuôi`, () => {
  expect(SO_REPLY_HIEN_SAN).toBe(3);
  const ba = [r(1, "a"), r(2, "b"), r(3, "c")];
  expect(chiaReply(ba, null)).toEqual({ dau: ba, duoi: [] });

  const nam = [...ba, r(4, "d"), r(5, "e")];
  const { dau, duoi } = chiaReply(nam, null);
  expect(dau.map((x) => x.id)).toEqual([1, 2, 3]);
  expect(duoi.map((x) => x.id)).toEqual([4, 5]);
});

test("reply của tôi lên đầu (stable) và KHÔNG BAO GIỜ nằm trong đuôi gập", () => {
  const ds = [r(1, "a"), r(2, "b"), r(3, "c"), r(4, "toi"), r(5, "d"), r(6, "toi")];
  const { dau, duoi } = chiaReply(ds, "toi");
  expect(dau.map((x) => x.id)).toEqual([4, 6, 1]);
  expect(duoi.map((x) => x.id)).toEqual([2, 3, 5]);

  // Tôi có NHIỀU hơn số hiện sẵn ⇒ phần hiện sẵn nở ra đủ chứa hết reply của tôi.
  const nhieu = [r(1, "a"), r(2, "toi"), r(3, "toi"), r(4, "b"), r(5, "toi"), r(6, "toi")];
  const kq = chiaReply(nhieu, "toi");
  expect(kq.dau.map((x) => x.id)).toEqual([2, 3, 5, 6]);
  expect(kq.duoi.map((x) => x.id)).toEqual([1, 4]);
  expect(kq.duoi.some((x) => x.tacGia === "toi"), "reply của tôi lọt vào đuôi").toBe(false);

  // Chưa đăng nhập: thứ tự gốc, cắt đúng 3.
  expect(chiaReply(nhieu, null).dau.map((x) => x.id)).toEqual([1, 2, 3]);
});

test("nối dây: component đọc `usePhien().toi.username` và đi qua đúng hai hàm luật", () => {
  const src = boChuThich(
    readFileSync(resolve(__dirname, "..", "..", "components/binh-luan-uu-tien.tsx"), "utf8"),
  );
  expect(src).toMatch(/^"use client";/);
  expect(src).toMatch(/sapThreadUuTien\(threads, toi\?\.username \?\? null\)/);
  expect(src).toMatch(
    /hienReply\(\s*replies,\s*toi\?\.username \?\? null,\s*moRong,\s*idTuNeo\(neo\),?\s*\)/,
  );
  // Đuôi gập ở lại HTML (`hidden` trên từng `<li>` trong MỘT `<ul>`), và công tắc khai
  // `aria-controls` = id các `<li>` ấy — chỗ bám của `ngan-keo.tsx::moToTienDangGap`.
  expect(src).toMatch(/hidden=\{an\}/);
  expect(src).toMatch(/aria-controls=\{idsDuoi/);
  expect(
    src.match(/<ul\b/g)?.length,
    "một <ul> cho thread, một cho reply — đuôi KHÔNG tách <ul> riêng",
  ).toBe(2);

  const nk = boChuThich(
    readFileSync(resolve(__dirname, "..", "..", "components/ngan-keo.tsx"), "utf8"),
  );
  // Đi từ CHÍNH đích (đuôi gập ẩn chính `<li>`), khớp một id trong danh sách `aria-controls`.
  expect(nk).toMatch(/let el: HTMLElement \| null = dich;/);
  expect(nk).toMatch(/\[aria-controls~=/);

  const bl = boChuThich(
    readFileSync(resolve(__dirname, "..", "..", "components/binh-luan.tsx"), "utf8"),
  );
  expect(bl).toMatch(/lamPhangThread\(nut\)/);
  expect(bl).toMatch(/nguoiThamGia: nguoiThamGia\(n\)/);
});

test("idTuNeo: chỉ nhận đúng neo bình luận", () => {
  expect(idTuNeo("#bl-123")).toBe(123);
  expect(idTuNeo("bl-7")).toBe(7);
  for (const x of ["", "#", "#bl-", "#bl-12a", "#khan-dai", "#ngan-keo-2"]) {
    expect(idTuNeo(x), x).toBeNull();
  }
});

test("hienReply: MỘT danh sách (đầu rồi đuôi), đuôi ẩn khi chưa mở, mở ra thì hết ẩn", () => {
  const ds = [r(1, "a"), r(2, "b"), r(3, "c"), r(4, "d"), r(5, "e")];
  const dong = hienReply(ds, null, false, null);
  expect(dong.ds.map((x) => [x.r.id, x.trongDuoi, x.an])).toEqual([
    [1, false, false],
    [2, false, false],
    [3, false, false],
    [4, true, true],
    [5, true, true],
  ]);
  expect(dong).toMatchObject({ coDuoi: true, soAn: 2 });
  const mo = hienReply(ds, null, true, null);
  expect(mo.ds.every((x) => !x.an)).toBe(true);
  expect(mo).toMatchObject({ coDuoi: true, soAn: 0 });
  expect(hienReply(ds.slice(0, 3), null, false, null)).toMatchObject({
    coDuoi: false,
    soAn: 0,
  });
});

test("hienReply: đích deep-link KHÔNG BAO GIỜ bị ẩn — kể cả khi `toi` về và đẩy nó vào đuôi", () => {
  // Ca 3 của phản biện: lúc hydrate (toi = null) đích #3 ở phần hiện sẵn, trang cuộn tới
  // nó; rồi `toi` về, reply của tôi (#5) chen lên đầu và đẩy #3 vào đuôi.
  const ds = [r(1, "a"), r(2, "b"), r(3, "c"), r(4, "d"), r(5, "toi")];
  expect(hienReply(ds, null, false, 3).ds.find((x) => x.r.id === 3)!.an).toBe(false);
  const sau = hienReply(ds, "toi", false, 3);
  const dich = sau.ds.find((x) => x.r.id === 3)!;
  expect(dich.trongDuoi, "vế chống rỗng: đích thật sự đã rơi vào đuôi").toBe(true);
  expect(dich.an, "đích vừa được dẫn tới mà biến mất").toBe(false);
  expect(sau.ds.find((x) => x.r.id === 4)!.an, "phần còn lại của đuôi vẫn gập").toBe(true);
  expect(sau.soAn).toBe(1);
  // Đích là reply MỚI NHẤT của một thread dài (link thông báo) ⇒ cũng hiện.
  const thong_bao = hienReply(ds.slice(0, 4), null, false, 4);
  expect(thong_bao.ds.find((x) => x.r.id === 4)).toMatchObject({ trongDuoi: true, an: false });
});
