import { expect, test } from "@playwright/test";

import { TRAN_NGAN_KEO, chayCoTran } from "../../lib/song-song";

/** Vá E4 — fan-out ngăn kéo phải có trần đồng thời.
 *
 * Bài đo **đếm số việc đang chạy cùng lúc** chứ không đọc lại hằng số: đó là điều khác
 * nhau giữa "có trần" và "có một biến tên là trần".
 */

/** Một việc chậm giả, tự ghi lại đỉnh đồng thời mà nó nhìn thấy. */
function viecDo() {
  let dang_chay = 0;
  let dinh = 0;
  const chay = async (x: number): Promise<number> => {
    dang_chay += 1;
    dinh = Math.max(dinh, dang_chay);
    // Nhường vòng lặp sự kiện vài nhịp — không có chỗ `await` thật thì mọi việc chạy
    // tuần tự bất kể trần, và bài đo sẽ xanh vì lý do sai.
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    dang_chay -= 1;
    return x * 10;
  };
  return { chay, dinh: () => dinh };
}

test("E4 — đỉnh đồng thời đo được không vượt `tran`", async () => {
  const d = viecDo();
  const vao = Array.from({ length: 40 }, (_, i) => i);
  await chayCoTran(vao, 6, d.chay);
  expect(d.dinh()).toBeLessThanOrEqual(6);
  // Và phải THẬT SỰ chạy song song tới trần — trần 6 mà đỉnh 1 là tuần tự trá hình.
  expect(d.dinh()).toBe(6);
});

test("E4 — bài đo trên phân biệt được có trần với không trần", async () => {
  // Chứng minh phép đo không phải lúc nào cũng ra số nhỏ: bỏ trần (đặt bằng số việc) thì
  // đỉnh vọt lên đúng 40. Đây chính là hành vi của `Promise.all` mà vá E4 thay thế.
  const d = viecDo();
  const vao = Array.from({ length: 40 }, (_, i) => i);
  await chayCoTran(vao, 40, d.chay);
  expect(d.dinh()).toBe(40);
});

test("E4 — thứ tự kết quả theo ĐẦU VÀO, không theo thứ tự hoàn thành", async () => {
  // Người gọi ghép kết quả về mốc theo chỉ số (`mach.mocs.forEach((m, i) => …)`), nên
  // đây là ràng buộc chứ không phải chi tiết cài đặt. Việc có chỉ số nhỏ cố tình chậm
  // nhất để thứ tự hoàn thành ngược hẳn thứ tự đầu vào.
  const vao = [0, 1, 2, 3, 4, 5, 6, 7];
  const ra = await chayCoTran(vao, 4, async (x) => {
    for (let i = 0; i < (10 - x) * 3; i += 1) await Promise.resolve();
    return `v${x}`;
  });
  expect(ra).toEqual(["v0", "v1", "v2", "v3", "v4", "v5", "v6", "v7"]);
});

test("E4 — danh sách rỗng: không gọi việc nào, trả mảng rỗng", async () => {
  let goi = 0;
  const ra = await chayCoTran([], TRAN_NGAN_KEO, async () => {
    goi += 1;
    return 1;
  });
  expect(ra).toEqual([]);
  expect(goi).toBe(0);
});

test("E4 — mỗi phần tử chạy ĐÚNG một lần", async () => {
  const dem = new Map<number, number>();
  const vao = Array.from({ length: 23 }, (_, i) => i);
  await chayCoTran(vao, 5, async (x) => {
    dem.set(x, (dem.get(x) ?? 0) + 1);
    return x;
  });
  expect(dem.size).toBe(23);
  expect([...dem.values()].every((n) => n === 1)).toBe(true);
});

test("E4 — lỗi KHÔNG bị nuốt (lib/api.ts phân biệt 404 với hỏng thật)", async () => {
  await expect(
    chayCoTran([1, 2, 3], 2, async (x) => {
      if (x === 2) throw new Error("Django ngã");
      return x;
    }),
  ).rejects.toThrow("Django ngã");
});

test("E4 — trần vô nghĩa thì nổ ngay, không âm thầm chạy hết một lượt", async () => {
  await expect(chayCoTran([1, 2], 0, async (x) => x)).rejects.toThrow(RangeError);
  await expect(chayCoTran([1, 2], -1, async (x) => x)).rejects.toThrow(RangeError);
  await expect(chayCoTran([1, 2], 1.5, async (x) => x)).rejects.toThrow(RangeError);
});

test("E4 — trang mạch dùng một trần NHỎ HƠN số mốc mà nó phải nạp", () => {
  // Trần lớn hơn mọi mạch có thật thì nó là số trang trí. Mạch seed 9 mốc, và PLAN không
  // đặt trần trên số mốc — 40 là con số plan vá nêu đích danh.
  expect(TRAN_NGAN_KEO).toBeGreaterThanOrEqual(1);
  expect(TRAN_NGAN_KEO).toBeLessThan(9);
});
