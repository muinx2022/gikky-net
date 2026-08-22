import { expect, test } from "@playwright/test";

import chung, { DU_AN_DON_VI } from "../../playwright.config";
import donVi from "../../playwright.don-vi.config";

/** Hàng rào cho vá D2: **`pnpm e2e:don-vi` phải nhẹ như tên nó nói.**
 *
 * Bài đo đọc thẳng hai object config đã `defineConfig` — không grep chuỗi. Grep thì một
 * dòng `webServer` viết khác đi (biến, spread, import) là lọt; ở đây thứ được hỏi đúng
 * là thứ Playwright đọc.
 *
 * Vì sao ràng buộc này đáng một bài đo riêng: `D:\Projects\CLAUDE.md` chia độc quyền tài
 * nguyên giữa `nghiem-thu` và `phan-bien` bằng đúng lệnh này. Nếu nó dựng server và seed
 * `gikky_dev` trở lại, hai agent chạy song song cùng ra số rác — và số rác trông y hệt
 * số thật, nên sẽ không ai phát hiện từ chính con số.
 */

test("D2 — config của e2e:don-vi KHÔNG có webServer và KHÔNG có globalSetup", () => {
  expect(donVi.webServer, "mọc lại webServer ⇒ lệnh nhẹ giành cổng 3000/8000").toBeUndefined();
  expect(donVi.globalSetup, "mọc lại globalSetup ⇒ lệnh nhẹ ghi đè gikky_dev").toBeUndefined();
});

test("D2 — bài đo trên phân biệt được hai config (không nghiệm đúng với mọi thứ)", () => {
  // Config chung PHẢI có cả hai. Thiếu vế này thì bài đo trên vẫn xanh kể cả khi
  // `defineConfig` đổi cách trả về và mọi trường đều thành `undefined`.
  expect(chung.webServer).toBeDefined();
  expect(chung.globalSetup).toBeDefined();
});

test("D2 — hai config chạy CÙNG một nhóm bài đo (bộ nhẹ không được bỏ sót)", () => {
  const ten_don_vi = donVi.projects?.map((p) => p.name);
  expect(ten_don_vi).toEqual(["don-vi"]);

  const trong_chung = chung.projects?.find((p) => p.name === "don-vi");
  expect(trong_chung, "config chung mất project don-vi ⇒ pnpm e2e không còn chạy nhóm này")
    .toBeDefined();
  // `testMatch` khai một chỗ trong `playwright.config.ts` rồi dùng cho cả hai. Hai bản
  // chép tay sẽ trôi khỏi nhau, và bản trôi ra là bản chạy ít bài hơn.
  expect(String(donVi.projects?.[0].testMatch)).toBe(String(trong_chung?.testMatch));
});

test("D2 — thư mục test của hai config trỏ cùng chỗ", () => {
  expect(donVi.testDir).toBe(chung.testDir);
});

/** Vá F3 (2026-08-22) — **bản thứ BA của cùng cái regex.**
 *
 * `DU_AN_DON_VI.testMatch` sinh ra để chống chép tay, `cau-hinh.spec.ts` ghim hai bản
 * (`don-vi` của hai config), và bản thứ ba — `testIgnore` của project `web` — nằm ngoài
 * mọi bài đo. Ca hỏng: đổi tên `e2e/don-vi` rồi sửa `DU_AN_DON_VI` cho khớp ⇒ `testIgnore`
 * trôi lại, 65 bài thuần chạy **thêm một lượt** dưới project `web` với chromium thật.
 * Không có gì đỏ — chỉ tốn thời gian và làm con số bài đo trôi khỏi báo cáo.
 */
test("F3 — testIgnore của project `web` là CHÍNH object của DU_AN_DON_VI.testMatch", () => {
  const web = chung.projects?.find((p) => p.name === "web");
  expect(web, "mất project web ⇒ pnpm e2e không còn chạy bộ chromium").toBeDefined();
  // `toBe` trên tham chiếu, KHÔNG `String(...)`: một literal chép tay có chữ y hệt vẫn so
  // bằng chuỗi thành công, mà nó chính là thứ luật này cấm.
  expect(web?.testIgnore).toBe(DU_AN_DON_VI.testMatch);
  expect(chung.projects?.[0].testMatch).toBe(DU_AN_DON_VI.testMatch);
});

test("F3 — regex ấy thật sự khớp file NÀY (đổi tên thư mục mà quên sửa ⇒ đỏ)", () => {
  // Bài đo tự trỏ vào chính mình. Đổi `e2e/don-vi` thành `e2e/thuan` mà không sửa
  // `DU_AN_DON_VI`: file này rơi khỏi project `don-vi`, hết bị `testIgnore` che, nên nó
  // chạy dưới project `web` — và ĐỎ ngay tại dòng dưới. Đó là cái chuông cho ca "cả ba
  // bản đã dùng chung nguồn rồi, nhưng nguồn ấy trỏ vào một thư mục không còn tồn tại".
  const toi = test.info().file;
  expect(toi).toMatch(/cau-hinh\.spec\.ts$/);
  expect(
    DU_AN_DON_VI.testMatch.test(toi),
    `testMatch không khớp chính ${toi} — thư mục don-vi đã đổi tên?`,
  ).toBe(true);
});
