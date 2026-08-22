import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** `globalSetup` của Playwright: dựng dữ liệu THẬT trước khi chạy bộ e2e.
 *
 * Hai lệnh, hai vai (xem docstring của từng command):
 *
 * - `seed_dev` — dữ liệu nghiệm thu Phase 1a. Ba vai của mặt CẶN nằm ở ba hàng khác
 *   nhau, mốc 6 có 0 bình luận kèm câu mồi… mọi con số ở đó là điều kiện để tiêu chí
 *   V1–V8, V15 *đo được gì đó*.
 * - `seed_e2e` — user 21 mạch, chỉ để V16 (hồ sơ bị cắt) không pass rỗng.
 *
 * Cả hai **idempotent**: chạy lại không nhân đôi. Cố ý KHÔNG dùng `--reset` ở đây —
 * `--reset` xoá sạch rồi dựng lại, và một lần lỡ tay chạy bộ e2e trên DB có dữ liệu thật
 * sẽ là mất dữ liệu, không phải phiền toái.
 *
 * Đường dẫn lấy từ `__dirname` chứ không từ `import.meta.url`: `apps/web/package.json`
 * không khai `type: module`, nên Playwright biên dịch file này sang CJS và `import.meta`
 * là lỗi cú pháp ở đó.
 */
async function globalSetup() {
  const goc = resolve(__dirname, "..", "..", "..");
  for (const lenh of ["seed_dev", "seed_e2e"]) {
    execFileSync(process.execPath, [resolve(goc, "scripts/py.mjs"), lenh], {
      cwd: goc,
      stdio: "inherit",
    });
  }
}

export default globalSetup;
