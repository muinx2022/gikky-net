import { defineConfig } from "@playwright/test";

import { DU_AN_DON_VI, THU_MUC_E2E } from "./playwright.config";

/** Config **nhẹ thật** cho nhóm `don-vi` — `pnpm e2e:don-vi` (vá D2, 2026-08-22).
 *
 * **Vì sao phải là file riêng, không phải `--project=don-vi`.** `globalSetup` và
 * `webServer` trong `playwright.config.ts` là cấu hình TOÀN CỤC: Playwright chạy chúng
 * cho **mọi** `--project`. Nên `playwright test --project=don-vi` trên config chung vẫn
 * seed `gikky_dev`, vẫn `next build`, vẫn chiếm cổng 3000 và 8000 — trong khi cả tên
 * lệnh lẫn dòng mô tả trong `CLAUDE.md` đều nói nó không chạm gì.
 *
 * Đó không phải một chỗ sai giấy tờ vô hại: `D:\Projects\CLAUDE.md` chia độc quyền tài
 * nguyên giữa hai agent chạy song song bằng đúng lệnh này ("unit test không cần DB/cổng").
 * Một lệnh được xếp vào vùng nhẹ mà lại giành cổng và ghi đè DB là hai bên cùng ra số
 * rác, và số rác trông y hệt số thật.
 *
 * Cái phải giữ: config này **không được** mọc lại `webServer` hay `globalSetup`.
 * `e2e/don-vi/cau-hinh.spec.ts` đọc thẳng hai object config và ghim ràng buộc đó.
 */
export default defineConfig({
  testDir: THU_MUC_E2E,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  projects: [{ ...DU_AN_DON_VI }],
});
