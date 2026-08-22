import { expect, test } from "@playwright/test";

import { TITLE_HPG, duongDan, timMachTheoTitle } from "./du-lieu";

/** V14 (nửa render) — light/dark đều ra đúng token của PLAN 9.1.
 *
 * Nửa còn lại ("xanh/đỏ không dùng trang trí") là hàng rào grep ở
 * `don-vi/mau-token.spec.ts`.
 *
 * Đo bằng màu THẬT sau khi trình duyệt tính, không đọc lại chuỗi CSS: một `@media` viết
 * sai chỗ vẫn nằm nguyên trong file mà không bao giờ khớp.
 */

const NEN_SANG = "rgb(241, 242, 245)"; // #F1F2F5
const NEN_TOI = "rgb(14, 17, 22)"; //     #0E1116
const MUC_SANG = "rgb(20, 22, 27)"; //    #14161B
const MUC_TOI = "rgb(231, 234, 240)"; //  #E7EAF0

async function mau(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { nen: s.backgroundColor, muc: s.color };
  });
}

test.describe("light", () => {
  test.use({ colorScheme: "light" });
  test("nền giấy lạnh + mực đen", async ({ page }) => {
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(duongDan(hpg));
    expect(await mau(page)).toEqual({ nen: NEN_SANG, muc: MUC_SANG });
  });
});

test.describe("dark", () => {
  test.use({ colorScheme: "dark" });
  test("nền tối + mực sáng", async ({ page }) => {
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(duongDan(hpg));
    expect(await mau(page)).toEqual({ nen: NEN_TOI, muc: MUC_TOI });
  });

  test("[data-theme=light] ghi đè được prefers-color-scheme:dark", async ({ page }) => {
    await page.goto("/luat");
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "light"),
    );
    expect(await mau(page)).toEqual({ nen: NEN_SANG, muc: MUC_SANG });
  });
});

test.describe("con số lãi/lỗ", () => {
  test("figures có dấu + thì tô màu lãi, không dấu thì mực thường", async ({ page }) => {
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(duongDan(hpg));

    const co_dau = page.locator('[data-dau="lai"], [data-dau="lo"]');
    expect(
      await co_dau.count(),
      "seed phải có ít nhất một figure mang dấu (mốc 9: LỜI +18.2%)",
    ).toBeGreaterThan(0);

    const khong_dau = page.locator('[data-dau="khong"]').first();
    const mau_thuong = await khong_dau.evaluate((e) => getComputedStyle(e).color);
    const mau_lai = await co_dau.first().evaluate((e) => getComputedStyle(e).color);
    expect(mau_lai).not.toBe(mau_thuong);
    expect(mau_lai).toBe("rgb(28, 122, 79)"); // --gain sáng = #1C7A4F
  });
});
