import { expect, test } from "@playwright/test";

import { locCanLam, tomTatHangLoat } from "../../../admin/lib/hang-loat";

/** Hai hàm thuần của hành động hàng loạt trong khu quản trị
 * (`apps/admin/lib/hang-loat.ts`).
 *
 * **Vì sao bài đo của `apps/admin` lại nằm trong `apps/web/e2e/don-vi`.** Bộ `don-vi` là
 * bộ chạy-được-song-song duy nhất của repo (không DB, không cổng — xem
 * `playwright.don-vi.config.ts`), và `apps/admin` không có bộ chạy nào của riêng nó. Vài
 * hàng rào ở đây đã quét sang `apps/admin` bằng đường dẫn (`type-admin.spec.ts`,
 * `quan-tri-giao-dien.spec.ts`); file này chỉ khác ở chỗ nó `import` thật thay vì đọc
 * nguồn bằng regex — làm được vì `lib/hang-loat.ts` cố ý không kéo theo React hay `fetch`.
 *
 * **Vì sao hai hàm này đáng có bài đo riêng.** Vòng lặp gọi API quanh chúng thì không đo
 * được ở tầng này (nó cần server), nhưng hai luật dễ trôi nhất lại nằm gọn ở đây: *chỉ
 * gọi trên hàng thật sự đổi trạng thái*, và *câu tóm tắt đếm theo chuyện ĐÃ xảy ra*.
 * Bỏ phép lọc no-op đi thì mọi thứ vẫn chạy, vẫn 200 (server tự chặn no-op trước khi ghi
 * `AuditLog` — xem docstring `locCanLam`), chỉ có số request phình lên và câu tóm tắt
 * phải nói dối để giữ phép cộng.
 */

type Hang = { id: number; da_bi_an: boolean; da_khoa?: boolean };

const BANG: Hang[] = [
  { id: 1, da_bi_an: false, da_khoa: false },
  { id: 2, da_bi_an: true, da_khoa: false },
  { id: 3, da_bi_an: false, da_khoa: true },
  { id: 4, da_bi_an: true, da_khoa: true },
];

test('locCanLam — "Ẩn" bỏ qua hàng ĐÃ ẩn', () => {
  const chon = new Set([1, 2, 3, 4]);
  expect(locCanLam(BANG, chon, (x) => x.da_bi_an, true)).toEqual([1, 3]);
});

test('locCanLam — "Gỡ ẩn" bỏ qua hàng ĐANG hiện', () => {
  const chon = new Set([1, 2, 3, 4]);
  expect(locCanLam(BANG, chon, (x) => x.da_bi_an, false)).toEqual([2, 4]);
});

test("locCanLam — trục KHOÁ độc lập với trục ẩn", () => {
  const chon = new Set([1, 2, 3, 4]);
  expect(locCanLam(BANG, chon, (x) => x.da_khoa === true, true)).toEqual([1, 2]);
  expect(locCanLam(BANG, chon, (x) => x.da_khoa === true, false)).toEqual([3, 4]);
});

test("locCanLam — chỉ đụng hàng ĐANG CHỌN", () => {
  expect(locCanLam(BANG, new Set([3]), (x) => x.da_bi_an, true)).toEqual([3]);
  expect(locCanLam(BANG, new Set(), (x) => x.da_bi_an, true)).toEqual([]);
});

test("locCanLam — id đã chọn mà KHÔNG còn trên trang thì bị bỏ", () => {
  // Ca thật: mod chọn ở trang 1, lật sang trang 2 rồi bấm. Đi theo `items` nên kết quả
  // luôn là tập con của thứ đang nhìn thấy — không bao giờ thi hành lên hàng vô hình.
  expect(locCanLam(BANG, new Set([1, 99, 100]), (x) => x.da_bi_an, true)).toEqual([1]);
});

test("locCanLam — giữ đúng thứ tự của bảng (thứ tự vòng lặp tuần tự)", () => {
  const dao = [...BANG].reverse();
  expect(locCanLam(dao, new Set([1, 3]), (x) => x.da_bi_an, true)).toEqual([3, 1]);
});

test("locCanLam — không sửa mảng đầu vào", () => {
  const truoc = JSON.stringify(BANG);
  locCanLam(BANG, new Set([1, 2, 3, 4]), (x) => x.da_bi_an, true);
  expect(JSON.stringify(BANG)).toBe(truoc);
});

test("tomTatHangLoat — nói ra CẢ hai con số khi trót lọt", () => {
  expect(tomTatHangLoat({ da_doi: 3, von_vay: 0, that_bai: [], bo_do: 0 })).toBe(
    "Đã đổi 3/3.",
  );
});

test("tomTatHangLoat — liệt kê đủ id hỏng, không cắt bớt", () => {
  expect(tomTatHangLoat({ da_doi: 3, von_vay: 0, that_bai: [12, 34], bo_do: 0 })).toBe(
    "Đã đổi 3/5. Lỗi ở: 12, 34.",
  );
});

test("tomTatHangLoat — hỏng hết vẫn là một câu đọc được", () => {
  expect(tomTatHangLoat({ da_doi: 0, von_vay: 0, that_bai: [7, 8], bo_do: 0 })).toBe(
    "Đã đổi 0/2. Lỗi ở: 7, 8.",
  );
});

test("tomTatHangLoat — không có gì cần đổi thì NÓI RA, không im lặng", () => {
  // Bấm "Ẩn" khi cả 25 hàng đã ẩn sẵn: không request nào được gửi, và màn hình phải nói
  // vì sao — một cú bấm không phản hồi gì đọc y hệt một cú bấm hỏng.
  expect(tomTatHangLoat({ da_doi: 0, von_vay: 0, that_bai: [], bo_do: 0 })).toBe(
    "Không có hàng nào cần đổi — đã bỏ qua tất cả.",
  );
});

test("tomTatHangLoat — hàng server trả `da_doi=false` KHÔNG được đếm là đã đổi", () => {
  // Mod B ẩn bài #7 trước; `items` của mod A còn cũ nên #7 vẫn vào mục tiêu. Server
  // nhận nhưng không đổi gì — báo "đổi 5 bài" cho một lượt đổi 4 là báo dôi.
  expect(tomTatHangLoat({ da_doi: 4, von_vay: 1, that_bai: [], bo_do: 0 })).toBe(
    "Đã đổi 4/5. 1 hàng vốn đã ở trạng thái đích.",
  );
});

test("tomTatHangLoat — dừng sớm vì hết phiên: hàng CHƯA xử lý không được đếm là xong", () => {
  // Lỗi thật đã bắt được ở lượt phản biện 2026-08-27: vòng lặp dừng ở hàng thứ 4/10 mà
  // màn hình nói "10/10 thành công" — 6 hàng chưa hề được gửi thành 6 lời khai khống.
  // Câu đúng phải nói thẳng phần chưa làm.
  expect(tomTatHangLoat({ da_doi: 4, von_vay: 0, that_bai: [], bo_do: 6 })).toBe(
    "Đã đổi 4/10. Hết phiên — 6 hàng CHƯA xử lý.",
  );
});

test("tomTatHangLoat — đủ bốn số phận trong MỘT câu, tổng khớp số mục tiêu", () => {
  expect(
    tomTatHangLoat({ da_doi: 2, von_vay: 1, that_bai: [5], bo_do: 3 }),
  ).toBe(
    "Đã đổi 2/7. 1 hàng vốn đã ở trạng thái đích. Lỗi ở: 5. Hết phiên — 3 hàng CHƯA xử lý.",
  );
});
