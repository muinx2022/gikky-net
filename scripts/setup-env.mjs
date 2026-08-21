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

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mau = join(repoRoot, "api", ".env.example");
const dich = join(repoRoot, "api", ".env");

/** Dòng `SECRET_KEY=...` trong `.env.example`. `.` của JS không nuốt `\r` nên CRLF vẫn nguyên. */
const DONG_SECRET_KEY = /^SECRET_KEY=.*$/m;

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

// base64url: 50 byte ngẫu nhiên -> 67 ký tự, không có `=`/`+`/`/` để cú pháp .env khỏi vỡ.
const khoaMoi = randomBytes(50).toString("base64url");
const noiDung = goc.replace(DONG_SECRET_KEY, `SECRET_KEY=${khoaMoi}`);

if (noiDung.includes(goc.match(DONG_SECRET_KEY)[0])) {
  console.error("[setup:env] Thay SECRET_KEY thất bại — giá trị mẫu vẫn còn. Dừng.");
  process.exit(1);
}

writeFileSync(dich, noiDung, { encoding: "utf8" });
console.log(`[setup:env] Đã tạo ${dich} từ .env.example, kèm SECRET_KEY ngẫu nhiên mới.`);
console.log("[setup:env] Nhớ kiểm lại DATABASE_URL và DEBUG trước khi chạy.");
