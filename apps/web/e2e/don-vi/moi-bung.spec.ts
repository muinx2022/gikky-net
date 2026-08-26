import type { BinhLuanOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { tinhDaiGap } from "../../lib/dai-gap";
import { chonMoiBung } from "../../lib/moi-bung";

/** Ba điều kiện của mồi bung (plan con 1c §1). Bộ e2e trên seed thật chỉ chứng minh
 * được điều kiện 2 (dải gập) — vì bình luận ĐƯỢC TRÍCH của seed có điểm gần bét nên nó
 * không bao giờ thắng, và bài đo "loại comment đã trích" ở đó **pass rỗng**.
 *
 * Đây là chỗ dựng đúng ca ngược: cho câu đã trích điểm CAO NHẤT. Nếu bộ lọc bị bỏ, hàm
 * sẽ trả chính nó và test đỏ. */

function nut(p: Partial<BinhLuanOut> & { id: number }): BinhLuanOut {
  return {
    id: p.id,
    parent_id: p.parent_id ?? null,
    depth: p.depth ?? 1,
    anchor_moc_seq: p.anchor_moc_seq ?? null,
    author: p.author ?? { username: "ai_do", display_name: "Ai Đó", avatar_url: null },
    body: p.body ?? `bình luận ${p.id}`,
    body_dinh_dang: "markdown",
    created_at: p.created_at ?? "2026-03-04T02:20:00Z",
    edited_at: null,
    up_count: p.up_count ?? 0,
    down_count: p.down_count ?? 0,
    score: p.score ?? 0,
    trang_thai: p.trang_thai ?? "binh_thuong",
    la_chu_mach: false,
    tu_gap: false,
    replies: p.replies ?? [],
  };
}

const DAI = tinhDaiGap(9); // gập 2..6 (PLAN 5.5, công thức chốt 2026-08-22)

test("lấy điểm cao nhất TRONG dải gập, không phải cao nhất toàn mạch", () => {
  const threads = [
    nut({ id: 1, anchor_moc_seq: 1, score: 99 }), // cao nhất toàn mạch, NGOÀI dải
    nut({ id: 2, anchor_moc_seq: 5, score: 30 }), // cao nhất TRONG dải
    nut({ id: 3, anchor_moc_seq: 9, score: 80 }), // ngoài dải
    nut({ id: 4, anchor_moc_seq: 3, score: 12 }),
  ];
  expect(chonMoiBung(threads, DAI, new Set())?.id).toBe(2);
});

test("LOẠI bình luận đã được trích, kể cả khi nó cao điểm nhất trong dải", () => {
  const threads = [
    nut({ id: 7, anchor_moc_seq: 5, score: 88 }), // đã trích
    nut({ id: 8, anchor_moc_seq: 6, score: 40 }),
  ];
  expect(chonMoiBung(threads, DAI, new Set([7]))?.id).toBe(8);
  // Bỏ bộ lọc thì hàm trả 7 — đây là vế chứng minh bài đo không rỗng.
  expect(chonMoiBung(threads, DAI, new Set())?.id).toBe(7);
});

test("bỏ qua reply, bia mộ và bình luận đã gỡ chip neo", () => {
  const threads = [
    nut({ id: 10, anchor_moc_seq: 4, score: 90, depth: 2 }), // reply
    nut({ id: 11, anchor_moc_seq: 4, score: 85, trang_thai: "da_xoa", body: null }),
    nut({ id: 12, anchor_moc_seq: null, score: 80 }), // đã gỡ chip (nguyên tắc 4)
    nut({ id: 13, anchor_moc_seq: 4, score: 5 }),
  ];
  expect(chonMoiBung(threads, DAI, new Set())?.id).toBe(13);
});

test("không có ứng viên nào thì trả null, không trả bừa", () => {
  const threads = [nut({ id: 20, anchor_moc_seq: 1, score: 50 })];
  expect(chonMoiBung(threads, DAI, new Set())).toBeNull();
  expect(chonMoiBung([], DAI, new Set())).toBeNull();
  expect(chonMoiBung(threads, tinhDaiGap(3), new Set())).toBeNull();
});

test("điểm bằng nhau thì mồi ổn định (id nhỏ hơn thắng)", () => {
  const a = nut({ id: 30, anchor_moc_seq: 2, score: 7 });
  const b = nut({ id: 31, anchor_moc_seq: 3, score: 7 });
  expect(chonMoiBung([a, b], DAI, new Set())?.id).toBe(30);
  expect(chonMoiBung([b, a], DAI, new Set())?.id).toBe(30);
});
