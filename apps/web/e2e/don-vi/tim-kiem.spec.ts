import { expect, test } from "@playwright/test";

import { tachDam } from "../../lib/tim-kiem";

/** Bộ đọc dấu tô đậm `[[…]]` của API tìm kiếm — Phase 7.
 *
 * Hàm thuần, nên nó ở đây chứ không ở bộ e2e thật. Cái đáng đo không phải ca thường (một
 * cặp dấu, một từ) mà là **ba ca méo**: dấu mồ côi do người dùng gõ, cặp bị cắt ngang bởi
 * chỗ cắt đoạn trích, và hai cặp liền nhau. Cả ba đều có thật, và cả ba đều làm một bản
 * cài bằng `split("[[")` cho ra chữ sai — mà sai ở đây nghĩa là **nuốt mất nội dung**,
 * không phải hiện xấu.
 */

test("tách một cặp dấu thành ba đoạn", () => {
  expect(tachDam("Nhật ký lệnh [[HPG]] hôm nay")).toEqual([
    { chu: "Nhật ký lệnh ", dam: false },
    { chu: "HPG", dam: true },
    { chu: " hôm nay", dam: false },
  ]);
});

test("hai cặp liền nhau không dính vào nhau", () => {
  expect(tachDam("[[Nhật]] ký lệnh [[HPG]]")).toEqual([
    { chu: "Nhật", dam: true },
    { chu: " ký lệnh ", dam: false },
    { chu: "HPG", dam: true },
  ]);
});

test("chuỗi không có dấu nào trả về đúng một đoạn thường", () => {
  expect(tachDam("không khớp gì")).toEqual([{ chu: "không khớp gì", dam: false }]);
  expect(tachDam("")).toEqual([]);
});

test("`[[` MỒ CÔI giữ nguyên văn, không nuốt phần đuôi", () => {
  // `[[ghi chú]]` là cú pháp wiki quen tay; một `[[` không có `]]` theo sau là chuyện có
  // thật trong tiêu đề người dùng. Bản cài bằng `split` sẽ mất hết chữ sau nó.
  expect(tachDam("mở ngoặc [[ rồi thôi")).toEqual([
    { chu: "mở ngoặc [[ rồi thôi", dam: false },
  ]);
});

test("cặp bị CẮT NGANG bởi chỗ cắt đoạn trích không làm mất chữ", () => {
  // API cắt đoạn trích ở 220 ký tự, nên đoạn có thể kết thúc giữa một cặp dấu. Phần còn
  // lại phải hiện ra như chữ thường — không được biến mất, cũng không được tô đậm bừa.
  const ra = tachDam("chốt lời [[HP");
  expect(ra.map((m) => m.chu).join("")).toBe("chốt lời [[HP");
  expect(ra.every((m) => !m.dam)).toBe(true);
});

test("ghép lại các đoạn luôn ra đúng chuỗi gốc trừ cặp dấu", () => {
  // Bất biến quan trọng nhất: bộ tách **không được đổi một ký tự nào** của nội dung. Nó
  // chỉ đánh dấu chỗ nào là chỗ khớp.
  const goc = "Mua [[HPG]] vùng giá 26, [[chốt]] một phần.";
  expect(
    tachDam(goc)
      .map((m) => m.chu)
      .join(""),
  ).toBe("Mua HPG vùng giá 26, chốt một phần.");
});
