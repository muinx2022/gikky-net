// Chạy `api/manage.py` bằng python của venv — KHÔNG viết cú pháp bash trong package.json
// (PLAN 8.3: script phải cross-platform).
//
//   node scripts/py.mjs runserver 8000
//   node scripts/py.mjs migrate

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const apiDir = join(repoRoot, "api");

export function venvPython() {
  const candidate =
    process.platform === "win32"
      ? join(apiDir, ".venv", "Scripts", "python.exe")
      : join(apiDir, ".venv", "bin", "python");
  if (!existsSync(candidate)) {
    throw new Error(
      `Không thấy python của venv tại ${candidate}. Tạo venv theo CLAUDE.md trước đã.`,
    );
  }
  return candidate;
}

/** Chạy manage.py với args; trả về exit code. */
export function runManage(args, options = {}) {
  const result = spawnSync(venvPython(), [join(apiDir, "manage.py"), ...args], {
    cwd: apiDir,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/**
 * Chạy manage.py và TRẢ VỀ stdout (không in ra). Ném lỗi nếu exit ≠ 0.
 *
 * Dùng cho lệnh mà output LÀ dữ liệu (`export_openapi --list`), không phải log.
 * Ném kèm stderr: một lệnh chết mà nuốt stderr thì người đọc chỉ thấy "JSON hỏng".
 */
export function runManageCapture(args, options = {}) {
  const result = spawnSync(venvPython(), [join(apiDir, "manage.py"), ...args], {
    cwd: apiDir,
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `manage.py ${args.join(" ")} thoát với mã ${result.status}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(runManage(process.argv.slice(2)));
}
