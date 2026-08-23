// Chép `api/.env.example` -> `api/.env` nếu chưa có, và SINH `SECRET_KEY` ngẫu nhiên.
//
//   pnpm setup:env
//
// Vì sao cần: clone sạch không có `api/.env`, mà `config/settings.py` đọc SECRET_KEY
// không default => mọi lệnh Python chết ngay từ dòng đầu. Trước đây bước này chỉ nằm
// trong đầu người đã dựng repo.
//
// Vì sao phải sinh khoá chứ không chép nguyên xi giá trị trong `.env.example`: giá trị đó
// NẰM TRONG REPO, ai cũng đọc được. Từ Phase 2 (allauth, session cookie ký bằng
// `SECRET_KEY`), máy nào chạy đúng lệnh repo dạy mà quên sửa một dòng là ký cookie phiên
// bằng một khoá công khai — giả mạo phiên được, mà không có gì đỏ và không có gì vào log.
// Cảnh báo bằng chữ ở `.env.example` đã có sẵn từ trước; cái thiếu là CƠ CHẾ.
//
// KHÔNG bao giờ đè file `.env` đang có — nó chứa cấu hình thật của máy đó.
//
// ## Vì sao `REVALIDATE_SECRET` cũng được sinh ở đây (L07, vá V1 2026-08-23)
//
// Trước lượt vá, dòng đó ra `.env` ở dạng RỖNG, và rỗng nghĩa là cửa on-demand revalidate
// **tắt hẳn** (fail-closed, `app/lam-moi-cache/route.ts`). Hai hậu quả, cả hai im lặng:
//
//   1. ở dev, mọi sự kiện CÓ signal (nối mốc, trích, đóng/mở sổ) không làm mới cache —
//      trang khách đứng nguyên tới một giờ, và Django chỉ ghi một dòng `logger.warning`;
//   2. `apps/web/e2e/du-lieu.ts::lamMoiCacheTrang` **ném** khi secret rỗng, và nó được gọi
//      trong `beforeAll` của ba file spec ⇒ **một máy vừa clone chạy `pnpm e2e` ăn ≥42 bài
//      đỏ**, ở một file nói về cột vote. Con số "365 e2e" chỉ tái lập được trên máy đã đặt
//      tay biến này.
//
// Sinh sẵn một chuỗi ngẫu nhiên là cách rẻ nhất để "clone sạch → `pnpm setup:env` →
// `pnpm e2e`" chạy đúng. Secret này chỉ có nghĩa giữa hai tiến trình trên cùng một máy,
// nên sinh ngẫu nhiên mỗi máy là đúng — y hệt `SECRET_KEY`.

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Gốc repo. Cho phép ghi đè để bài đo chạy được kịch bản "clone sạch" trong thư mục tạm
 * — xem `apps/web/e2e/don-vi/setup-env.spec.ts`. Không có nó thì phép đo duy nhất cho
 * script này là đọc bằng mắt. */
const repoRoot =
  process.env.GIKKY_GOC_REPO ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mau = join(repoRoot, "api", ".env.example");
const dich = join(repoRoot, "api", ".env");

/** Dòng `SECRET_KEY=...` trong `.env.example`. `.` của JS không nuốt `\r` nên CRLF vẫn nguyên. */
const DONG_SECRET_KEY = /^SECRET_KEY=.*$/m;

/** Dòng `REVALIDATE_SECRET=` (giá trị rỗng trong mẫu). */
const DONG_REVALIDATE_SECRET = /^REVALIDATE_SECRET=.*$/m;

if (!existsSync(mau)) {
  console.error(`[setup:env] Không thấy ${mau} — repo hỏng?`);
  process.exit(1);
}

if (existsSync(dich)) {
  console.log(`[setup:env] ${dich} đã có — giữ nguyên, không đè.`);
  process.exit(0);
}

const goc = readFileSync(mau, "utf8");

// Không tìm thấy dòng để thay thì DỪNG, không chép bừa: chép bừa nghĩa là lặng lẽ cài đặt
// khoá công khai của repo làm khoá ký session — đúng cái lỗ vừa vá.
if (!DONG_SECRET_KEY.test(goc)) {
  console.error(`[setup:env] Không thấy dòng \`SECRET_KEY=\` trong ${mau}.`);
  console.error("[setup:env] Không chép — sẽ sinh ra .env ký session bằng khoá nằm sẵn trong repo.");
  process.exit(1);
}
if (!DONG_REVALIDATE_SECRET.test(goc)) {
  console.error(`[setup:env] Không thấy dòng \`REVALIDATE_SECRET=\` trong ${mau}.`);
  console.error("[setup:env] Không chép — .env thiếu nó là cửa làm mới cache tắt hẳn (L07).");
  process.exit(1);
}

// base64url: byte ngẫu nhiên -> không có `=`/`+`/`/` để cú pháp .env khỏi vỡ.
const khoaMoi = randomBytes(50).toString("base64url");
const secretLamMoi = randomBytes(32).toString("base64url");
const noiDung = goc
  .replace(DONG_SECRET_KEY, `SECRET_KEY=${khoaMoi}`)
  .replace(DONG_REVALIDATE_SECRET, `REVALIDATE_SECRET=${secretLamMoi}`);

// Kiểm bằng cách đòi **giá trị mới có mặt trên đúng dòng đó**, không bằng
// `noiDung.includes(<dòng mẫu>)`. Lối `includes` đúng với `SECRET_KEY` (giá trị mẫu không
// rỗng) nhưng SAI hẳn với `REVALIDATE_SECRET=`: dòng mẫu của nó là một tiền tố của mọi
// dòng thay thế, nên phép kiểm luôn báo "vẫn còn" và script dừng ở mọi lần chạy — bắt tại
// trận khi viết `e2e/don-vi/setup-env.spec.ts` (lượt vá V1).
for (const [ten, gia_tri] of [
  ["SECRET_KEY", khoaMoi],
  ["REVALIDATE_SECRET", secretLamMoi],
]) {
  if (!new RegExp(`^${ten}=${gia_tri}$`, "m").test(noiDung)) {
    console.error(`[setup:env] Thay ${ten} thất bại — giá trị mới không có trong file. Dừng.`);
    process.exit(1);
  }
}

writeFileSync(dich, noiDung, { encoding: "utf8" });
console.log(`[setup:env] Đã tạo ${dich} từ .env.example.`);
console.log("[setup:env] SECRET_KEY và REVALIDATE_SECRET đều là chuỗi ngẫu nhiên mới.");
console.log("[setup:env] Nhớ kiểm lại DATABASE_URL và DEBUG trước khi chạy.");
