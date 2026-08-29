// `pnpm web:dev` — chạy `next dev` của `apps/web` **kèm biến môi trường đọc từ `api/.env`**.
//
//   node scripts/web-dev.mjs
//
// ## Vì sao phải có một lớp bọc, thay vì gọi thẳng `next dev` (L07, vá V1 2026-08-23)
//
// Cửa on-demand revalidate (PLAN 8.4 điểm 3) cần **cùng một chuỗi** ở hai tiến trình:
// Django đọc `REVALIDATE_SECRET` từ `api/.env`, còn tiến trình Next thì **không đọc file
// đó** — Next chỉ nạp `.env*` nằm trong `apps/web`. Trước lượt vá, hệ quả đo được:
//
//     next start (qua playwright.config.ts, có truyền env) → POST /lam-moi-cache → 200
//     pnpm web:dev                                          → 503 "cửa đang tắt"
//
// Nghĩa là ở dev, mọi sự kiện CÓ signal (nối mốc, trích, đóng/mở sổ) **không** làm mới
// cache: trang đứng nguyên tới một giờ, Django ghi đúng một dòng `logger.warning`, và
// không ai được báo. Người đang làm frontend sẽ kết luận sai rằng cơ chế 8.4 hỏng.
//
// Cách chữa khác đã cân nhắc và **bỏ**:
//
//   - `apps/web/.env.local` thứ hai — hai file phải khớp tay, và cái lệch sẽ là cái im
//     lặng (secret khác nhau ⇒ 401, cũng không ai đỏ);
//   - `env: {}` trong `next.config.ts` — Next **nội tuyến** giá trị đó vào cả bundle
//     client, tức đẩy một secret của server ra trình duyệt.
//
// Một nguồn (`api/.env`), đọc ở đúng chỗ cần. Cùng lối với `playwright.config.ts::
// secretLamMoiCache`, và cùng lý do.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const duongDanEnv = join(repoRoot, "api", ".env");

/** Biến của `api/.env` mà **tiến trình Next** cũng cần. Danh sách hẹp có chủ đích: đây
 * không phải một cầu nối env đa dụng. Thêm tên vào đây là một quyết định phải nêu được
 * lý do; hôm nay có hai, và cả hai là **cùng một secret dùng chung cho hai tiến trình**:
 *
 * - `REVALIDATE_SECRET` — cơ chế 8.4, chiều Django → Next (`/lam-moi-cache`);
 * - `DEM_LUOT_XEM_SECRET` — đếm lượt xem, chiều **ngược lại**: `middleware.ts` →
 *   `POST /api/v1/dem-luot-xem` (2026-08-27). Thiếu nó ở dev thì `secretDem()` trả chuỗi
 *   rỗng ⇒ middleware không gọi Django lần nào ⇒ trang `/luot-xem` của khu quản trị đứng
 *   ở 0 mãi mãi, không có gì báo. Đúng bệnh L07 mà dòng trên đã mắc một lần.
 *
 * Không cảnh báo khi thiếu `DEM_LUOT_XEM_SECRET` (khác `REVALIDATE_SECRET` ngay dưới):
 * `pnpm setup:env` cố ý **không** sinh sẵn nó, vì tắt là mặc định ĐÚNG ở máy dev — không
 * ai cần thống kê của chính mình bấm quanh. Một cảnh báo cho một trạng thái đúng là một
 * cảnh báo người ta sẽ học cách bỏ qua.
 */
const CAN_CHUYEN = ["REVALIDATE_SECRET", "DEM_LUOT_XEM_SECRET"];

/** Đọc một biến trong file `.env` dạng `TEN=gia tri`. Không có file / không có dòng ⇒ "".
 *
 * Cố ý **không** dùng một thư viện dotenv: script này đọc đúng một tên, và một dependency
 * mới cho việc đó là một dependency phải cập nhật mãi mãi. Regex cùng dạng với
 * `apps/web/playwright.config.ts` — hai chỗ đọc, một định dạng.
 */
function docEnv(ten) {
  if (!existsSync(duongDanEnv)) return "";
  const noi_dung = readFileSync(duongDanEnv, "utf8");
  return new RegExp(`^${ten}=(.*)$`, "m").exec(noi_dung)?.[1].trim() ?? "";
}

const them = {};
for (const ten of CAN_CHUYEN) {
  // Biến đã có sẵn trong môi trường thì THẮNG file: người gõ `REVALIDATE_SECRET=x pnpm
  // web:dev` đang cố ý ghi đè, và một script lặng lẽ đè ngược lại là thứ không debug được.
  if (process.env[ten] !== undefined && process.env[ten] !== "") continue;
  const gia_tri = docEnv(ten);
  if (gia_tri !== "") them[ten] = gia_tri;
}

if (them.REVALIDATE_SECRET === undefined) {
  // Cảnh báo, không dừng: `next dev` vẫn chạy được, chỉ là cửa làm mới cache tắt. Nói ra
  // ở đây vì đó chính là chỗ trước kia im lặng.
  console.warn(
    "[web:dev] Không thấy REVALIDATE_SECRET trong api/.env — cửa /lam-moi-cache sẽ trả " +
      "503 và on-demand revalidate không chạy. Chạy `pnpm setup:env` trên một clone sạch, " +
      "hoặc thêm dòng đó vào api/.env.",
  );
}

const con = spawn("pnpm", ["--filter", "@gikky/web", "dev"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, ...them },
  // Windows: `pnpm` là một file `.cmd`, `spawn` không tự tìm nó nếu không qua shell.
  shell: process.platform === "win32",
});
con.on("exit", (ma) => process.exit(ma ?? 1));
