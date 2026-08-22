import { expect, test } from "@playwright/test";

import { dongSoMachSub } from "../../lib/dinh-dang";

/** `dongSoMachSub` — dòng `N mạch · lập dd/mm/yyyy` dưới tên chuyên mục (vá V6, B8).
 *
 * PLAN nguyên tắc 9 cấm phô sự im lặng, và `so_mach === 0` là cửa anh em của `×0` vừa
 * đóng ở hồ sơ: v1 tạo sub bằng tay qua admin (PLAN mục 1) nên "0 mạch · lập 22/08/2026"
 * ngay cạnh "Chưa có bài nào ở đây." là hình dạng MẶC ĐỊNH của mọi chuyên mục mới.
 *
 * Bài đo hàm thuần ở đây, bài đo render trên trang thật ở `e2e/vo-reddit.spec.ts` — hai
 * tầng vì hàm đúng mà một trong hai chỗ render quên gọi nó thì vẫn in ra số 0.
 */

const KHI = "2026-08-22T03:00:00Z";
/** Chuyên mục lập từ 2024 — dùng cho ca "có bài rồi bị mod ẩn sạch" (W4). */
const KHI_CU = "2024-03-04T03:00:00Z";

test("B8 — 0 mạch: KHÔNG có chữ số 0 nào, và vẫn giữ ngày lập", () => {
  const dong = dongSoMachSub(0, KHI);
  expect(dong).not.toMatch(/\b0\s*mạch/);
  expect(dong).not.toContain("0 mạch");
  expect(dong).toContain("lập 22/08/2026");
  expect(dong).toBe("Chuyên mục lập 22/08/2026");
});

test("W4 — nhánh 0 KHÔNG được quả quyết 'mới': nó cũng là ca 'bị ẩn sạch bài'", () => {
  // `so_mach` đếm mạch **hiện được** (`api/tests/test_api_sub.py::
  // test_sub_LAU_DOI_bi_an_het_bai_cung_tra_so_mach_0`), nên cùng một lời gọi
  // `dongSoMachSub(0, …)` phục vụ CẢ HAI ca — hàm này không phân biệt được, và vì thế
  // câu nó in ra phải đúng trong cả hai. Bản V6 in "Chuyên mục mới · lập 04/03/2024":
  // hai vế mâu thuẫn nhau trên cùng một dòng, và vế đầu là một khẳng định sai về dữ liệu.
  const dong = dongSoMachSub(0, KHI_CU);
  expect(dong).toBe("Chuyên mục lập 04/03/2024");

  for (const cam of ["mới", "chưa", "trống", "rỗng"]) {
    expect(dong.toLowerCase(), `không được quả quyết "${cam}"`).not.toContain(cam);
  }
  // …và KHÔNG rò ra rằng có nội dung vừa bị gỡ: người lạ không được suy ra chuyện
  // moderation từ một dòng header (cùng lý lẽ với mã lỗi gộp ở `api/loi.py`).
  for (const ro of ["ẩn", "gỡ", "xoá", "kiểm duyệt"]) {
    expect(dong.toLowerCase(), `không được rò "${ro}"`).not.toContain(ro);
  }
});

test("B8 — sub CÓ mạch thì vẫn in số (không vá quá tay thành giấu luôn)", () => {
  expect(dongSoMachSub(1, KHI)).toBe("1 mạch · lập 22/08/2026");
  expect(dongSoMachSub(21, KHI)).toBe("21 mạch · lập 22/08/2026");
});

test("ngưỡng nằm đúng ở 0, không phải ở một con số 'nhỏ' nào khác", () => {
  // Nguyên tắc 9 có một ngưỡng khác (dưới 4 bình luận thì ẩn số đếm) và nó KHÔNG áp cho
  // đây: một chuyên mục có 2 mạch thì "2 mạch" là thông tin thật, không phải sự im lặng.
  for (const n of [1, 2, 3]) {
    expect(dongSoMachSub(n, KHI)).toContain(`${n} mạch`);
  }
});
