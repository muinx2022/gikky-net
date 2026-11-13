import { expect, test } from "@playwright/test";

import { namBanQuyen } from "../../lib/ban-quyen";

/** T7 của plan `2026-11-13-ban-tin-len-dau-ban-quyen.md`: năm của dòng `© {năm} gikky.net` đổi
 * theo giờ Việt Nam (UTC+7), không theo múi giờ máy chạy Node. Phần DOM thật (T6) ở
 * `e2e/dai-ban-tin.spec.ts`. */

test("T7 — namBanQuyen: 17:00Z ngày 31/12 đã là 00:00 01/01 giờ VN ⇒ năm mới", () => {
  expect(namBanQuyen(new Date("2026-12-31T17:00:00Z"))).toBe(2027);
});

test("T7 — namBanQuyen: 16:59:59Z ngày 31/12 còn là 23:59:59 giờ VN ⇒ năm cũ", () => {
  expect(namBanQuyen(new Date("2026-12-31T16:59:59Z"))).toBe(2026);
});
