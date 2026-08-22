import { defineConfig, devices } from "@playwright/test";

/** Bộ e2e của `apps/web` — kéo lên sớm từ Phase 2 (plan con 1c §1).
 *
 * Lý do kéo lên: nghiệm thu Phase 1 của PLAN là **"checklist phần tử, không so ảnh"** —
 * 15 tiêu chí UI. Không có bộ chạy thì chúng thành "đọc bằng mắt", đúng thứ repo này đã
 * phải diệt nhiều lần.
 *
 * Hai project:
 *
 * - **`don-vi`** — test hàm thuần (`lib/*.ts`) và các hàng rào grep trên mã nguồn. Không
 *   mở trình duyệt, không chạm server. Chúng vẫn nằm trong config này để `pnpm e2e` là
 *   MỘT lệnh: hai bộ chạy riêng là hai bộ sẽ có một bộ không ai chạy.
 *
 *   ⚠ **`--project=don-vi` trên config NÀY vẫn dựng server và vẫn seed DB** —
 *   `globalSetup` và `webServer` là cấu hình TOÀN CỤC, Playwright chạy chúng cho mọi
 *   `--project`. Lệnh nhẹ thật sự là `pnpm e2e:don-vi`, đi qua
 *   `playwright.don-vi.config.ts` (vá D2, 2026-08-22).
 * - **`web`** — chromium thật, trên bản BUILD PRODUCTION (`next build` + `next start`),
 *   không phải `next dev`. `next dev` chèn overlay và bundle khác hẳn, đo SEO/DOM trên
 *   nó là đo một trang không ai thấy ngoài đời.
 *
 * ⚠ **Bộ này chiếm cổng 3000 và 8000.** Chạy song song với một agent khác cũng đang chạy
 * server là hai bên cùng ra số rác. `reuseExistingServer` để dev bật sẵn server thì
 * Playwright dùng lại — nhưng khi đó **bản build có thể cũ**, nên trước khi lấy số đi báo
 * cáo phải tắt server rồi chạy lại từ trắng.
 */
/** Thư mục test — dùng chung với `playwright.don-vi.config.ts`. */
export const THU_MUC_E2E = "./e2e";

/** Định nghĩa project `don-vi`, khai **một chỗ** rồi dùng cho cả hai config.
 *
 * Chép tay sang config thứ hai là hai `testMatch` sẽ trôi khỏi nhau, và cái trôi ra sẽ là
 * cái chạy ít hơn — tức bộ nhẹ âm thầm bỏ sót bài đo mà không có gì đỏ.
 *
 * Bản **thứ ba** của cùng cái regex là `testIgnore` của project `web` ngay dưới. Nó cũng
 * dùng thẳng `DU_AN_DON_VI.testMatch` (vá F3, 2026-08-22) — trước đó nó là một literal
 * chép tay, tức chính cái mà docstring này viết ra để cấm.
 */
export const DU_AN_DON_VI = {
  name: "don-vi",
  testMatch: /don-vi[\\/].*\.spec\.ts$/,
} as const;

export default defineConfig({
  testDir: THU_MUC_E2E,
  globalSetup: "./e2e/dung-seed.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { ...DU_AN_DON_VI },
    {
      // CÙNG object regex với `DU_AN_DON_VI.testMatch`, không phải một bản chép giống hệt
      // — `e2e/don-vi/cau-hinh.spec.ts` ghim bằng `toBe` trên chính tham chiếu đó, nên
      // một literal mới (dù chữ y hệt) cũng đỏ.
      name: "web",
      testIgnore: DU_AN_DON_VI.testMatch,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node ../../scripts/py.mjs runserver 8000 --noreload",
      url: "http://localhost:8000/api/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "pnpm run build && pnpm exec next start --port 3000",
      url: "http://localhost:3000/luat",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
