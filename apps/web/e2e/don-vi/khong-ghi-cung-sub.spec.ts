import { expect, test } from "@playwright/test";

import { quetNguon } from "./quet";
import { resolve } from "node:path";

const WEB = resolve(__dirname, "..", "..");

/** Hàng rào cho PLAN mục 7, dòng `GET /subs`: **cấm ghi cứng danh sách slug ở
 * frontend** — vá V8, tiêu chí B10.
 *
 * Trước lượt vá, `lib/api.ts` giữ `SUB_KHOI_DIEM = ["chung-khoan", "crypto"]` và nó nuôi
 * cả `components/sidebar.tsx` lẫn `app/sitemap.ts`. Hai chiều hỏng, cả hai im lặng:
 *
 * - mở sub thứ ba qua admin ⇒ vắng mặt ở **cả hai** chỗ, 200 ở mọi cửa. Với sản phẩm
 *   sống bằng index (PLAN mục 1) đó là một chuyên mục Google không bao giờ biết tới;
 * - đổi slug trong admin ⇒ sidebar âm thầm bỏ mục đó (404 → lọc khỏi danh sách) trong
 *   khi `sitemap.xml` vẫn khai `/s/<slug cũ>` là URL sống.
 *
 * Xoá hằng đi là chưa đủ: cửa mở lại chỉ bằng một dòng `["chung-khoan", "crypto"]` gõ ở
 * chỗ khác, và lúc đó không có gì nói rằng nó từng bị cấm. Nên luật quét theo **giá
 * trị**, không theo tên biến.
 *
 * ⚠ Bài đo và dữ liệu thử thì được nhắc slug: chúng phải trỏ vào một sub CÓ THẬT của
 * seed để đo được gì đó. Miễn trừ theo thư mục `e2e/`, không theo từng file.
 */

/** Slug của `seed_dev` — chính là danh sách từng bị ghi cứng. */
const SLUG_SEED = ["chung-khoan", "crypto"];

const MA_SAN_PHAM = quetNguon(WEB, /\.(tsx?|mjs)$/).filter(
  (f) => !f.ten.startsWith("e2e/"),
);

/** Chỗ **chưa** chuyển được sang `GET /subs`, khai tường minh kèm lý do và kèm nợ.
 *
 * Khai ra chứ không lặng lẽ bỏ qua: một miễn trừ có tên thì lần sau ai đó gỡ được nó sẽ
 * thấy dòng này và xoá; một điều kiện lọc khéo thì không ai nhìn lại bao giờ.
 */
const CHUA_CHUYEN_DUOC: Readonly<Record<string, string>> = {
  // Thanh điều hướng nằm trong layout gốc, tức nó render trên **mọi** trang — kể cả
  // `/luat`. Mà `/luat` phải là route TĨNH KHÔNG gọi API: nó là đường thoát của
  // `error.tsx`/`global-error.tsx` (nợ #14), nên một lời gọi API ở đây làm đường thoát
  // hỏng cùng lúc với thứ nó thoát khỏi. Chuyển được nó cần một nguồn danh sách sub
  // không đi qua request (cache build-time, hoặc tách nav khỏi layout) — một quyết định
  // có plan riêng, không phải hiệu ứng phụ của lượt vá này.
  //
  // ⚠ Nợ THẬT, không phải giấy phép: sub thứ ba mở ra vẫn vắng mặt trên thanh nav.
  "components/chrome.tsx": "layout gốc — /luat phải tĩnh (nợ #14)",
};

test("bộ file quét được không rỗng và có đúng hai chỗ từng ghi cứng", () => {
  const ten = MA_SAN_PHAM.map((f) => f.ten);
  expect(ten.length).toBeGreaterThan(15);
  expect(ten).toContain("lib/api.ts");
  expect(ten).toContain("app/sitemap.ts");
  expect(ten).toContain("components/sidebar.tsx");
});

test("B10 — `SUB_KHOI_DIEM` không còn tồn tại ở bất kỳ đâu", () => {
  // `sach` chứ không `noi_dung`: `lib/api.ts` và `app/sitemap.ts` nhắc tên hằng cũ trong
  // chú thích để kể lại vì sao nó bị xoá, và một hàng rào ăn mất tài liệu của chính nó
  // là thứ `quet.ts` đã bỏ chú thích để tránh.
  const pham = MA_SAN_PHAM.filter((f) => f.sach.includes("SUB_KHOI_DIEM"));
  expect(pham.map((f) => f.ten)).toEqual([]);
});

test("B10 — không file sản phẩm nào gõ cứng slug của một sub", () => {
  const pham: string[] = [];
  for (const f of MA_SAN_PHAM) {
    if (f.ten in CHUA_CHUYEN_DUOC) continue;
    for (const slug of SLUG_SEED) {
      if (f.sach.includes(slug)) pham.push(`${f.ten}: ghi cứng "${slug}"`);
    }
  }
  expect(pham, "danh sách sub phải hỏi `GET /subs` — PLAN mục 7").toEqual([]);
});

test("giấy miễn trừ không có dòng chết (gỡ được nợ thì phải xoá dòng)", () => {
  // Chiều ngược. File hết ghi cứng mà giấy còn nằm lại thì lần sau nó cấp phép cho một
  // dòng mới lọt vào đúng file đó, im lặng.
  const chet = Object.keys(CHUA_CHUYEN_DUOC).filter((ten) => {
    const f = MA_SAN_PHAM.find((x) => x.ten === ten);
    return f === undefined || !SLUG_SEED.some((s) => f.sach.includes(s));
  });
  expect(chet, "giấy miễn trừ không còn ứng với thực tế").toEqual([]);
});

test("luật trên bắt được hàng giả (chứng minh nó không phải hàng rào rỗng)", () => {
  // Không có vế này thì "danh sách vi phạm rỗng" cũng đúng khi `SLUG_SEED` rỗng, khi
  // `MA_SAN_PHAM` rỗng, hoặc khi `boChuThich` nuốt mất cả file.
  const gia = 'export const SUB_KHOI_DIEM = ["chung-khoan", "crypto"] as const;';
  expect(SLUG_SEED.some((s) => gia.includes(s))).toBe(true);
  expect(gia.includes("SUB_KHOI_DIEM")).toBe(true);
});

test("chiều ngược: đúng một cửa hỏi API, và cả hai chỗ dùng đi qua nó", () => {
  // Xoá hằng mà mỗi chỗ tự gọi API riêng cũng là hai bản sẽ trôi khỏi nhau. Sidebar và
  // sitemap phải cùng đi qua `docCacSub` — một chỗ hỏi, một chỗ đọc.
  const api = MA_SAN_PHAM.find((f) => f.ten === "lib/api.ts");
  expect(api?.sach).toMatch(/lietKeSub\s*\(/);

  const goi_lietKeSub = MA_SAN_PHAM.filter((f) => /lietKeSub\s*\(/.test(f.sach));
  expect(goi_lietKeSub.map((f) => f.ten)).toEqual(["lib/api.ts"]);

  for (const ten of ["app/sitemap.ts", "app/page.tsx", "app/s/[sub]/page.tsx"]) {
    const f = MA_SAN_PHAM.find((x) => x.ten === ten);
    expect(f?.sach, `${ten} không lấy danh sách sub từ docCacSub`).toMatch(
      /docCacSub\s*\(/,
    );
  }
});
