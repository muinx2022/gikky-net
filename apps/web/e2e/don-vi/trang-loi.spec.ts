import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

const WEB = resolve(__dirname, "..", "..");

/** Hàng rào cho vá F2: **trang lỗi luôn còn ÍT NHẤT MỘT đường thoát không khoá được.**
 *
 * `app/error.tsx` gói `router.refresh() + reset()` trong `useTransition`, và `isPending`
 * chỉ hạ khi payload RSC về. Upstream TREO — Django nhận TCP rồi không trả lời: deadlock
 * pool, query treo, blackhole — là `isPending` đứng `true` vĩnh viễn ⇒ nút `disabled`
 * vĩnh viễn, nhãn kẹt ở "Đang thử lại…", và trang lỗi hết đường thoát. Đúng loài "banner
 * kẹt vĩnh viễn" mà `D:\Projects\CLAUDE.md` ghi lại từ đợt 2026-08-04.
 *
 * **Giới hạn thành thật:** đây là phép đọc mã nguồn, không phải phép bấm nút. Nó bắt được
 * ca "ai đó bỏ đường thoát đi" — ca đã xảy ra thật — chứ không chứng minh được cái nút
 * chạy. Phép đo hành vi phải dựng một `next start` thứ hai trỏ `API_ORIGIN` vào một
 * upstream treo, tức thêm một cổng và một entry `webServer`; nợ đó vẫn còn tên trong
 * docstring của `app/error.tsx`.
 */

/** Thân từng `<button …>…</button>` trong một file JSX, chú thích đã bỏ.
 *
 * Cắt chuỗi, không phải parser — cùng hạng với `quet.ts`. Không dùng regex
 * `/<button[\s\S]*?>/` vì mũi tên `=>` trong `onClick={() => …}` có dấu `>`, nên nó cắt
 * cụt ngay giữa handler và bài đo đọc nhầm một nút thành nút rỗng.
 */
function thanNut(nguon: string): string[] {
  return boChuThich(nguon)
    .split(/<button\b/)
    .slice(1)
    .map((s) => s.split("</button>")[0]);
}

/** File này có nút thoát nào KHÔNG bao giờ bị khoá không?
 *
 * "Thoát" = bỏ hẳn tài liệu hiện tại (`window.location.reload/assign`), không phải điều
 * hướng phía client — `router.refresh()` và `next/link` đi qua đúng cây router đang chờ
 * lời gọi treo. "Không khoá" = trong thân nút không có chữ `disabled` nào.
 */
function coDuongThoat(nguon: string): boolean {
  return thanNut(nguon).some(
    (t) => /window\.location\.(reload|assign)\s*\(/.test(t) && !/\bdisabled\b/.test(t),
  );
}

const TRANG_LOI = ["app/error.tsx", "app/global-error.tsx"];

test("F2 — đọc được cả hai file trang lỗi (không có thì hàng rào rỗng)", () => {
  for (const ten of TRANG_LOI) {
    const nguon = readFileSync(resolve(WEB, ten), "utf8");
    expect(nguon.length, `${ten} rỗng`).toBeGreaterThan(200);
    expect(thanNut(nguon).length, `${ten} không có <button> nào`).toBeGreaterThan(0);
  }
});

test("F2 — mọi trang lỗi đều có đường thoát không khoá được", () => {
  const thieu = TRANG_LOI.filter(
    (ten) => !coDuongThoat(readFileSync(resolve(WEB, ten), "utf8")),
  );
  expect(thieu, "trang lỗi mất đường thoát ⇒ upstream treo là hết cửa").toEqual([]);
});

test("F2 — `error.tsx` vẫn giữ nút thử lại CÓ khoá (bài trên không nghiệm đúng với mọi thứ)", () => {
  // Vế đối chứng hai chiều: nếu `coDuongThoat` trả `true` cho bất cứ thứ gì, hoặc nếu
  // nút "Thử lại" biến mất, bài trên vẫn xanh mà trang lỗi đã khác hẳn.
  const than = thanNut(readFileSync(resolve(WEB, "app/error.tsx"), "utf8"));
  expect(than.filter((t) => /\bdisabled\b/.test(t)).length).toBe(1);
  expect(than.filter((t) => /window\.location\.reload\s*\(/.test(t)).length).toBe(1);
});

test("F2 — luật bắt được hàng giả (đường thoát bị khoá, hoặc không có)", () => {
  const khong_co =
    '<button type="button" onClick={thuLai} disabled={dangThu}>Thử lại</button>';
  expect(coDuongThoat(khong_co)).toBe(false);

  // Ca xảo quyệt hơn: CÓ `window.location.reload` nhưng lại gắn `disabled` — tức vẫn kẹt
  // vĩnh viễn, chỉ là kẹt ở một cái nút khác.
  const bi_khoa =
    '<button type="button" onClick={() => window.location.reload()} disabled={dangThu}>Tải lại</button>';
  expect(coDuongThoat(bi_khoa)).toBe(false);

  const dat =
    '<button type="button" onClick={() => window.location.reload()}>Tải lại</button>';
  expect(coDuongThoat(dat)).toBe(true);

  // Và điều hướng phía client KHÔNG tính là đường thoát.
  const gia_thoat = '<button type="button" onClick={() => router.refresh()}>Tải lại</button>';
  expect(coDuongThoat(gia_thoat)).toBe(false);
});
