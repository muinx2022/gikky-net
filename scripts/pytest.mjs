// Chạy pytest bằng python của venv, từ gốc repo.
//
//   pnpm test
//   pnpm test -- -k health -x
//
// Trước đây pytest là lệnh DUY NHẤT bắt người dùng phải `cd api` rồi gõ tay đường dẫn
// venv — đủ để người ta bỏ chạy test.

import { spawnSync } from "node:child_process";

import { apiDir, venvPython } from "./py.mjs";

const ket_qua = spawnSync(venvPython(), ["-m", "pytest", ...process.argv.slice(2)], {
  cwd: apiDir,
  stdio: "inherit",
});

if (ket_qua.error) throw ket_qua.error;
process.exit(ket_qua.status ?? 1);
