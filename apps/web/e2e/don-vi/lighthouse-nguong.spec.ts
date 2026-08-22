import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

const GOC = resolve(__dirname, "..", "..", "..", "..");

/** Nợ #12 — **ngưỡng Lighthouse rỗng/`NaN` không được cho mọi điểm đi lọt.**
 *
 * `Number("")` là `0` và `Number("abc")` là `NaN`; bản cũ viết
 * `const nguong = Number(process.argv[3] ?? 90)` rồi so `diem < nguong`. Với `NaN`, phép
 * so là `false` ⇒ **mọi điểm đều qua**, lệnh exit 0, và dòng in ra là
 * "Lighthouse SEO: 31/100 (ngưỡng NaN)" — thứ không ai đọc trong log CI. `""` thì tệ theo
 * kiểu khác: nó thành `0`, một ngưỡng "hợp lệ" mà không điểm nào trượt được.
 *
 * `scripts/lighthouse-nguong.mjs` là ESM thuần nằm NGOÀI `apps/web`, nên nạp bằng
 * `import()` động qua `file://` — Playwright biên dịch spec sang CJS, và đó là đường duy
 * nhất còn chạy được. Hình dạng module khai tay ở đây (`ModNguong`): nó không phải schema
 * của API nên không đụng luật "cấm khai lại type" của PLAN 8.3.
 */

type ModNguong = {
  docNguong: (tho: string | undefined) => number;
  NGUONG_MAC_DINH: number;
  NguongKhongHopLe: new (thong_diep?: string) => Error;
};

const DUONG_DAN = resolve(GOC, "scripts/lighthouse-nguong.mjs");

async function nap(): Promise<ModNguong> {
  return (await import(pathToFileURL(DUONG_DAN).href)) as unknown as ModNguong;
}

test("#12 — thiếu đối số thì dùng mặc định 90", async () => {
  const { docNguong, NGUONG_MAC_DINH } = await nap();
  expect(NGUONG_MAC_DINH).toBe(90);
  expect(docNguong(undefined)).toBe(90);
});

test("#12 — số hợp lệ đi qua nguyên vẹn", async () => {
  const { docNguong } = await nap();
  expect(docNguong("95")).toBe(95);
  expect(docNguong("0")).toBe(0);
  expect(docNguong("100")).toBe(100);
});

test("#12 — chuỗi RỖNG phải NÉM, không được thành 0 (0 thì mọi điểm đều qua)", async () => {
  // `Number("")` là `0`, không phải `NaN` — và `diem < 0` cũng luôn `false`. Ca này lọt
  // qua cả một phép kiểm chỉ hỏi `Number.isFinite`.
  const { docNguong, NguongKhongHopLe } = await nap();
  expect(() => docNguong("")).toThrow(NguongKhongHopLe);
  expect(() => docNguong("   ")).toThrow(NguongKhongHopLe);
});

test("#12 — chuỗi không phải số phải NÉM, không được thành NaN", async () => {
  const { docNguong, NguongKhongHopLe } = await nap();
  for (const xau of ["abc", "9x", "NaN", "Infinity"]) {
    expect(() => docNguong(xau), xau).toThrow(NguongKhongHopLe);
  }
});

test("#12 — số ngoài 0..100 phải NÉM", async () => {
  const { docNguong, NguongKhongHopLe } = await nap();
  expect(() => docNguong("-1")).toThrow(NguongKhongHopLe);
  expect(() => docNguong("101")).toThrow(NguongKhongHopLe);
});

test("#12 — script đo KHÔNG còn tự `Number(argv)` (cửa cũ phải bị bịt ở nguồn)", () => {
  // Bài trên đo hàm mới; bài này ghim rằng script thật đã DÙNG nó. Thiếu vế thứ hai thì
  // hàm đúng có thể nằm mồ côi trong khi `lighthouse-seo.mjs` giữ nguyên phép `Number`.
  const nguon = boChuThich(
    readFileSync(resolve(GOC, "scripts/lighthouse-seo.mjs"), "utf8"),
  );
  expect(nguon).toMatch(/docNguong\s*\(\s*process\.argv\[3\]\s*\)/);
  expect(nguon).not.toMatch(/Number\s*\(\s*process\.argv/);
});
