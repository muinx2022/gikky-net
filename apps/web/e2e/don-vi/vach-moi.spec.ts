import { expect, test } from "@playwright/test";

import { docView, matDeRender } from "../../lib/mat";
import { mocDauChuaXem, oChuaXem, type ViTriDoc } from "../../lib/vach-moi";

/** Hai luật thuần của mặt BÃO — PLAN 5.5. Đo ở đây vì cả hai là hàm thuần, và vì cái
 * quan trọng ở `mocDauChuaXem` là những ca nó **KHÔNG** vẽ vạch. */

const AI_DO: ViTriDoc = {
  dang_nhap: true,
  following: true,
  last_seen_entry_seq: 4,
};

test("vạch kẻ trước mốc ĐẦU TIÊN chưa xem", () => {
  expect(mocDauChuaXem(AI_DO, 9)).toBe(5);
  expect(mocDauChuaXem({ ...AI_DO, last_seen_entry_seq: 8 }, 9)).toBe(9);
});

test("KHÔNG vẽ vạch: khách, chưa biết, chưa theo mạch, chưa có vị trí đọc, đã xem hết", () => {
  // Bốn ca này mới là nội dung của luật — một bản cài ẩu vẽ nhầm ở cả bốn.
  expect(mocDauChuaXem(null, 9), "chưa hỏi xong `/me`").toBeNull();
  expect(mocDauChuaXem({ ...AI_DO, dang_nhap: false }, 9), "khách").toBeNull();
  expect(mocDauChuaXem({ ...AI_DO, following: false }, 9), "chưa theo").toBeNull();
  // `0` = hàng `Follow` dựng tay, KHÔNG phải "chưa đọc gì". Vẽ vạch trước mốc 1 ở đây là
  // tuyên bố cả mạch đều mới — đúng câu nói dối mà `core.ghi.dat_follow` tránh.
  expect(mocDauChuaXem({ ...AI_DO, last_seen_entry_seq: 0 }, 9), "chưa có vị trí").toBeNull();
  expect(mocDauChuaXem({ ...AI_DO, last_seen_entry_seq: 9 }, 9), "xem hết").toBeNull();
  // Con số lớn hơn số mốc (mốc bị xoá sau khi đã đọc) cũng là "xem hết", không phải vạch
  // ở một chỗ không tồn tại.
  expect(mocDauChuaXem({ ...AI_DO, last_seen_entry_seq: 99 }, 9)).toBeNull();
});

test("ô spine tô hoàng thổ từ đúng mốc vạch trở đi", () => {
  const vach = mocDauChuaXem(AI_DO, 9);
  expect([1, 2, 3, 4].map((s) => oChuaXem(s, vach))).toEqual([false, false, false, false]);
  expect([5, 6, 9].map((s) => oChuaXem(s, vach))).toEqual([true, true, true]);
  // Không có vạch ⇒ không ô nào tô. Nếu không thì khách sẽ thấy cả spine màu hoàng thổ.
  expect([1, 5, 9].map((s) => oChuaXem(s, null))).toEqual([false, false, false]);
});

test("`?view=` chỉ nhận `bao`/`can`, rác quy về `null` (lấy face của server)", () => {
  expect(docView("bao")).toBe("bao");
  expect(docView("can")).toBe("can");
  expect(docView(["bao", "can"])).toBe("bao");
  expect(docView("BAO")).toBeNull();
  expect(docView("rac")).toBeNull();
  expect(docView(undefined)).toBeNull();
});

test("`?view=` THẮNG face của server, và chỉ nó mới thắng", () => {
  const nguoi = { face: "can" } as Parameters<typeof matDeRender>[0];
  expect(matDeRender(nguoi, null)).toBe("can");
  expect(matDeRender(nguoi, "bao")).toBe("bao");
  const soi = { face: "bao" } as Parameters<typeof matDeRender>[0];
  expect(matDeRender(soi, "can")).toBe("can");
});

// Bài đo "câu mồi composer" XOÁ 2026-08-26 cùng hàm `cauMoiComposer` — composer mặt BÃO
// nay là ô của cả bài, không mồi theo mốc nào. Xem `lib/mat.ts` đầu file.
