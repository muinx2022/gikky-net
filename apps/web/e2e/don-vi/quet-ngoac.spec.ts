import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich, quetNguon } from "./quet";
import { coBaseUrl, coKhoaTangDau, thanHang } from "./quet-ngoac";

const WEB = resolve(__dirname, "..", "..");

/** Bài đo cho chính phép quét dùng chung — **L25** (một bản, không hai) và **L37**
 * (`baseUrl` phải ở tầng đầu).
 *
 * Hai hàng rào `type-frontend.spec.ts` / `type-admin.spec.ts` chỉ khẳng định *"không có
 * vi phạm nào"*. Một phép quét trả `true` cho mọi thứ cũng làm cả hai xanh. Nhóm bài dưới
 * đây đo **chính phép quét**: nó nhận cái gì, nó từ chối cái gì, và hai file kia có thật
 * sự dùng nó không.
 */

test("L37 — `baseUrl` nằm SÂU trong thân hằng KHÔNG được tính", () => {
  // Đúng ca `LOI-VA-NO.md` mô tả. Chuỗi `baseUrl` ở đây thuộc về một lời gọi `fetch` bên
  // trong; `{ ...C }` không đặt `baseUrl` cho lời gọi API nào.
  const than = "const C = { fetch: (u) => fetch(u, { baseUrl: 0 }) };";
  expect(coBaseUrl("{ ...C }", than)).toBe(false);
});

test("L37 — và ca THẬT vẫn phải qua (không được chữa bằng cách siết chết)", () => {
  // `lib/api.ts::CHUNG_ISR` — `baseUrl` ở tầng đầu, `fetch` lồng bên cạnh nó. Bịt L37 mà
  // làm ca này đỏ là chặn cứng cơ chế ISR của PLAN 8.4.
  const than =
    "const CHUNG_ISR = { baseUrl: API_ORIGIN, fetch: (y) => fetch(y, { next: { revalidate: 3600 } }) } as const;";
  expect(coBaseUrl("{ ...CHUNG_ISR, path: { id } }", than)).toBe(true);
});

test("coKhoaTangDau phân biệt được tầng — cả ba loại ngoặc", () => {
  expect(coKhoaTangDau(" baseUrl: X, cache: 'no-store' ", "baseUrl")).toBe(true);
  expect(coKhoaTangDau(" a: { baseUrl: X } ", "baseUrl")).toBe(false);
  expect(coKhoaTangDau(" a: [baseUrl] ", "baseUrl")).toBe(false);
  expect(coKhoaTangDau(" a: f(baseUrl) ", "baseUrl")).toBe(false);
});

test("baseUrl viết THẲNG trong đối số vẫn qua (đường đi phổ biến nhất)", () => {
  expect(coBaseUrl("{ baseUrl: GOC, path: { id } }", "")).toBe(true);
});

test("chỉ đi theo ĐÚNG MỘT lớp spread — hai lớp là không", () => {
  const than = "const B = { baseUrl: X };\nconst A = { ...B };";
  expect(coBaseUrl("{ ...A }", than)).toBe(false);
});

test("thanHang đọc được thân có ngoặc lồng, và trả null khi không có hằng", () => {
  expect(thanHang("K", "const K = { a: { b: 1 }, c: 2 };")).toBe(" a: { b: 1 }, c: 2 ");
  expect(thanHang("K", "const J = { a: 1 };")).toBeNull();
});

test("L25 — CẢ HAI hàng rào dùng phép quét chung, không ai giữ bản riêng", () => {
  // Vế then chốt. Ba bài trên đo module chung; bài này ghim rằng hai spec THẬT SỰ gọi nó.
  // Thiếu nó thì `quet-ngoac.ts` có thể đúng tuyệt đối mà nằm mồ côi, còn `type-admin`
  // lặng lẽ quay về bản một-tầng-ngoặc của mình.
  for (const ten of ["type-frontend.spec.ts", "type-admin.spec.ts"]) {
    const nguon = readFileSync(resolve(__dirname, ten), "utf8");
    expect(nguon, `${ten} phải import phép quét chung`).toContain(
      'from "./quet-ngoac"',
    );
    // Và không được khai lại một bản riêng — đó chính là hình dạng của L25.
    expect(
      boChuThich(nguon),
      `${ten} không được tự khai lại coBaseUrl/thanHang`,
    ).not.toMatch(/function\s+(coBaseUrl|thanHang)\s*\(/);
  }
});

test("module chung KHÔNG phải file .spec (nếu không, bài đo chạy hai lần)", () => {
  const ten = quetNguon(WEB, /quet-ngoac/).map((f) => f.ten);
  expect(ten).toContain("e2e/don-vi/quet-ngoac.ts");
  expect(ten).not.toContain("e2e/don-vi/quet-ngoac.spec.ts.ts");
});
