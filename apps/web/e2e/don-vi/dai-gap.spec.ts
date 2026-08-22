import type { MocOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import {
  NGUONG_KHONG_GAP,
  nhanDaiGap,
  nhanKhoangMoc,
  tinhDaiGap,
  tongBinhLuanTrongDai,
  trongDaiGap,
} from "../../lib/dai-gap";

/** Công thức dải gập của PLAN 5.5 (khối "Công thức dải gập, chốt 2026-08-22"): `n` mốc
 * ⇒ gập seq 2 … **n−3**, hiện 1, n−2, n−1, n; `n ≤ 5` thì không gập.
 *
 * ⚠ Ngưỡng là **5**, không phải 4 (USER DUYỆT 2026-08-22, plan con 1d §2.5.9): chỉ gập
 * khi giấu được ít nhất 2 mốc. Con số 5 ở đây gõ tay trong tên bài đo lẫn trong thân —
 * xem bài `n = 5 KHÔNG gập` và `n = 6 gập ĐÚNG 2 mốc` bên dưới, hai vế của cùng một mốc
 * chuyển. Bài đo nào cũng dựng kỳ vọng từ `NGUONG_KHONG_GAP` thì hạ ngưỡng về 4 sẽ không
 * làm gì đỏ.
 *
 * Con số ở đây **gõ tay**, cố ý không dựng từ `tinhDaiGap` — đó là điều làm nó khác bài
 * đo trên trang thật: bài đo Playwright từng import chính hàm này cho vế kỳ vọng, và
 * lượt thử phá bắt tại trận là hai vế sai bằng nhau nên vẫn xanh.
 *
 * Nợ 1a: trước 1c, công thức chỉ sống trong `api/tests/test_seed_dev.py`. Nay có hai bản
 * độc lập (Python cho seed, TS cho render) và cả hai đều gõ tay từ PLAN.
 */

test("mạch 9 mốc: gập 2–6 (đúng '5 mốc' của PLAN 5.5), hiện 1, 7, 8, 9", () => {
  const d = tinhDaiGap(9);
  expect(d.gap).toBe(true);
  if (!d.gap) return;
  expect(d.seqDau).toBe(2);
  expect(d.seqCuoi).toBe(6);
  expect(d.soMoc).toBe(5);
  expect([...d.seqHien]).toEqual([1, 7, 8, 9]);
  expect(nhanKhoangMoc(d)).toBe("Mốc 2–6");
});

test("mốc 7 của mạch 9 mốc nằm TRÊN MẶT TIỀN — khối trích của seed không bị gập", () => {
  // Đây là hệ quả sản phẩm của việc lùi công thức về `n−3`, không phải một phép tính
  // phụ: mốc 7 là mốc mang khối "trích vào sổ" trong `seed_dev`, tức cơ chế thưởng chủ
  // lực của PLAN 5.6. Với `n−2` thì nó rơi vào dải gập và chỉ hiện sau một cú bấm.
  const d = tinhDaiGap(9);
  expect(trongDaiGap(d, 7)).toBe(false);
  expect([...d.seqHien]).toContain(7);
});

test("số mốc gập + số mốc hiện luôn bằng entry_count", () => {
  for (let n = 1; n <= 40; n += 1) {
    const d = tinhDaiGap(n);
    const gap = d.gap ? d.soMoc : 0;
    expect(gap + d.seqHien.length).toBe(n);
  }
});

test("mọi seq 1..n rơi vào ĐÚNG MỘT chỗ: gập hoặc hiện", () => {
  for (let n = 1; n <= 40; n += 1) {
    const d = tinhDaiGap(n);
    for (let seq = 1; seq <= n; seq += 1) {
      const trong_gap = trongDaiGap(d, seq);
      const dang_hien = d.seqHien.includes(seq);
      expect(
        Number(trong_gap) + Number(dang_hien),
        `n=${n} seq=${seq}: gập=${trong_gap} hiện=${dang_hien}`,
      ).toBe(1);
    }
  }
});

test("ba mốc cuối LUÔN hiện, không phải hai — PLAN 5.5 đã ghi chú lại chỗ này", () => {
  for (let n = NGUONG_KHONG_GAP + 1; n <= 40; n += 1) {
    const d = tinhDaiGap(n);
    expect([...d.seqHien], `n=${n}`).toEqual([1, n - 2, n - 1, n]);
  }
});

test(`n ≤ ${NGUONG_KHONG_GAP} thì KHÔNG gập, hiện đủ`, () => {
  for (let n = 0; n <= NGUONG_KHONG_GAP; n += 1) {
    const d = tinhDaiGap(n);
    expect(d.gap, `n=${n}`).toBe(false);
    expect([...d.seqHien]).toEqual(
      Array.from({ length: n }, (_, i) => i + 1),
    );
  }
});

test("A11 — ngưỡng đúng bằng 5 (USER DUYỆT 2026-08-22, PLAN 5.5)", () => {
  // Gõ tay con số, không đọc từ hằng: bài đo phải đỏ khi ai đó hạ nó về 4.
  expect(NGUONG_KHONG_GAP).toBe(5);
});

test("A11 — n = 5 thì KHÔNG gập (dải gập 1 mốc là lỗ: giấu 1, tốn 2 dòng khung)", () => {
  const d = tinhDaiGap(5);
  expect(d.gap).toBe(false);
  expect([...d.seqHien]).toEqual([1, 2, 3, 4, 5]);
});

test("A11 — n = 6 là mốc bắt đầu gập, và gập ĐÚNG 2 mốc", () => {
  // Đây là mạch VNM của seed (`entry_count = 6`): nó phải còn gập, nếu không thì bia mộ
  // đặt trong dải gập ở `seed_dev` mất chỗ đứng và cả nhóm bài đo đó đo vào chỗ trống.
  const d = tinhDaiGap(6);
  expect(d.gap).toBe(true);
  if (!d.gap) return;
  expect([d.seqDau, d.seqCuoi]).toEqual([2, 3]);
  expect(d.soMoc).toBe(2);
  expect([...d.seqHien]).toEqual([1, 4, 5, 6]);
  expect(nhanKhoangMoc(d)).toBe("Mốc 2–3");
});

test("A11 — mọi dải gập sinh ra đều giấu ÍT NHẤT 2 mốc", () => {
  // Vế tổng quát của cùng một luật: ngưỡng chỉ là cách CÀI, còn đây là điều phải đúng.
  for (let n = 0; n <= 40; n += 1) {
    const d = tinhDaiGap(n);
    if (d.gap) expect(d.soMoc, `n=${n}`).toBeGreaterThanOrEqual(2);
  }
});

/** Mốc tối giản cho `tongBinhLuanTrongDai` — chỉ hai trường mà hàm đó đọc.
 *
 * `MocOut` nhập từ `@gikky/api-client` (PLAN 8.3: type đi một chiều, cấm khai lại), phần
 * còn lại đắp bằng giá trị vô hại. Nếu API thêm trường **bắt buộc** thì dòng `as` này là
 * chỗ duy nhất phải sửa, và `tsc` của `pnpm build` chỉ ra ngay.
 */
function moc(seq: number, so_binh_luan: number): MocOut {
  return { seq, so_binh_luan } as MocOut;
}

/* ---- Vá D1: nhãn dải gập không được phô "· 0 bình luận" -------------------- */

test("D1 — dải gập cộng dồn 0 bình luận thì nhãn KHÔNG có vế số đếm", () => {
  // Đường đi MẶC ĐỊNH, không phải ca biên: PLAN nguyên tắc 4 chốt "viết ở khán đài →
  // mặc định neo mốc mới nhất", mà mốc mới nhất (`n = 10`) luôn nằm NGOÀI dải `2…n−3`.
  // Cả mạch 247 bình luận ⇒ `hienSoDem = true`, mà dải gập giấu đúng 0 bình luận.
  const d = tinhDaiGap(10);
  expect(nhanDaiGap(d, 0, true)).toBe("Mốc 2–7 · 6 mốc");
  // Chuỗi mà PLAN nguyên tắc 9 cấm — gõ tay, không dựng từ công thức của code.
  expect(nhanDaiGap(d, 0, true)).not.toContain("0 bình luận");
  expect(nhanDaiGap(d, 0, true)).not.toContain("bình luận");
});

test("D1 — dải gập CÓ bình luận thì vế số đếm vẫn hiện đủ (không vá quá tay)", () => {
  const d = tinhDaiGap(9);
  expect(nhanDaiGap(d, 43, true)).toBe("Mốc 2–6 · 5 mốc · 43 bình luận");
  expect(nhanDaiGap(d, 1, true)).toBe("Mốc 2–6 · 5 mốc · 1 bình luận");
});

test("D1 — nguyên tắc 9 ở tầng CẢ MẠCH vẫn tắt vế số đếm dù dải gập có bình luận", () => {
  // Hai điều kiện tách rời, không cái nào thay được cái nào: đây là chiều còn lại.
  const d = tinhDaiGap(9);
  expect(nhanDaiGap(d, 3, false)).toBe("Mốc 2–6 · 5 mốc");
});

test("D1 — tổng cộng dồn ĐÚNG các mốc trong dải, không tính mốc mặt tiền", () => {
  // n = 9 ⇒ gập 2–6, mặt tiền 1, 7, 8, 9. Tổng kỳ vọng gõ tay: 2+3+4+5+6 = 20.
  const d = tinhDaiGap(9);
  const mocs = [
    moc(1, 100),
    moc(2, 2),
    moc(3, 3),
    moc(4, 4),
    moc(5, 5),
    moc(6, 6),
    moc(7, 700),
    moc(8, 800),
    moc(9, 900),
  ];
  expect(tongBinhLuanTrongDai(d, mocs)).toBe(20);
});

test("D1 — mọi bình luận nằm ở mốc MẶT TIỀN ⇒ tổng trong dải = 0 ⇒ nhãn im lặng", () => {
  // Ca thật của nguyên tắc 4 ghép hai hàm lại: mạch 10 mốc, 247 bình luận, tất cả neo
  // vào mốc 10. Vế kỳ vọng gõ tay từ PLAN 5.5 + 9.2.
  const d = tinhDaiGap(10);
  const mocs = Array.from({ length: 10 }, (_, i) =>
    moc(i + 1, i + 1 === 10 ? 247 : 0),
  );
  const tong = tongBinhLuanTrongDai(d, mocs);
  expect(tong).toBe(0);
  expect(nhanDaiGap(d, tong, true)).toBe("Mốc 2–7 · 6 mốc");
});

test("D1 — dải không gập thì nhãn rỗng, kể cả khi truyền số dương", () => {
  const d = tinhDaiGap(3);
  expect(nhanDaiGap(d, 9, true)).toBe("");
  expect(tongBinhLuanTrongDai(d, [moc(1, 5), moc(2, 5), moc(3, 5)])).toBe(0);
});
