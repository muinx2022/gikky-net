// Đọc danh sách `NinjaAPI` THẬT từ Django và ánh xạ mỗi khoá sang cặp đường dẫn output.
//
// Vì sao không viết cứng `["v1"]` ở đây — đó đúng là lỗi vòng vá này đi sửa: `codegen.mjs`
// gọi `export_openapi` đúng MỘT lần, không truyền `--api`, nên nó luôn chỉ sinh client cho
// `v1`. Phase 4 thêm `api_admin`: `tests/test_api_registry.py` bắt đỏ → lập trình viên thêm
// một dòng vào `NINJA_APIS` → test XANH TRỞ LẠI → tưởng xong, trong khi `pnpm codegen` vẫn
// exit 0 và TS client vẫn thiếu sạch nhóm admin. Chuông nối 2/3 bước, và bước thứ ba được
// màu xanh của chuông che cho — nguy hơn không có chuông.
//
// Nguồn sự thật DUY NHẤT là `config/api_registry.py::NINJA_APIS`, đọc qua
// `manage.py export_openapi --list`. Một danh sách viết tay thứ hai ở phía Node thì cũng
// bị quên y hệt cái thứ nhất.

import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runManageCapture } from "./py.mjs";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const clientDir = join(repoRoot, "packages", "api-client");

/**
 * `v1` giữ NGUYÊN đường dẫn cũ (`openapi.json` + `src/`).
 *
 * Không phải thẩm mỹ: A9, A10 và `pnpm codegen:check` đều chốt trên hai đường dẫn đó, và
 * `packages/api-client/package.json` trỏ `"." -> "./src/index.ts"`. Đổi là hồi quy.
 */
const KHOA_GIU_DUONG_DAN_CU = "v1";

/** Khoá hợp lệ: chỉ chữ/số/gạch dưới — vì nó đi thẳng vào tên file và tên thư mục. */
const KHOA_HOP_LE = /^[A-Za-z0-9_]+$/;

/** Mảng khoá của `NINJA_APIS`, đọc từ Django. Ném lỗi thay vì đoán bừa. */
export function danhSachApi() {
  const raw = runManageCapture(["export_openapi", "--list"]);

  let khoas;
  try {
    khoas = JSON.parse(raw.trim());
  } catch (loi) {
    throw new Error(
      `\`export_openapi --list\` không in ra JSON hợp lệ.\n--- stdout ---\n${raw}\n--- ${loi.message}`,
    );
  }

  const hong =
    !Array.isArray(khoas) ||
    khoas.length === 0 ||
    khoas.some((k) => typeof k !== "string" || !KHOA_HOP_LE.test(k));
  if (hong) {
    throw new Error(
      "`export_openapi --list` phải in một mảng JSON KHÔNG RỖNG gồm các khoá " +
        `[A-Za-z0-9_]+, nhận được: ${JSON.stringify(khoas)}`,
    );
  }

  if (!khoas.includes(KHOA_GIU_DUONG_DAN_CU)) {
    throw new Error(
      `Registry không còn khoá ${JSON.stringify(KHOA_GIU_DUONG_DAN_CU)}. ` +
        "Nếu đó là cố ý thì phải sửa cả `packages/api-client/package.json` và mọi chỗ " +
        "import `@gikky/api-client` — đừng để codegen lặng lẽ sinh ra một cây khác.",
    );
  }

  return khoas;
}

/** Khoá registry -> nơi ghi schema + nơi sinh TS client. */
export function duongDanCho(khoa) {
  if (khoa === KHOA_GIU_DUONG_DAN_CU) {
    return {
      schemaPath: join(clientDir, "openapi.json"),
      srcDir: join(clientDir, "src"),
    };
  }
  return {
    schemaPath: join(clientDir, `openapi.${khoa}.json`),
    srcDir: join(clientDir, `src-${khoa}`),
  };
}

/**
 * Tập TÊN cấp 1 trong `packages/api-client` mà registry hiện tại được phép sinh ra.
 *
 * Dùng để tìm đồ MỒ CÔI: `openapi.zz.json` / `src-zz` còn nằm lại sau khi khoá `zz` bị gỡ
 * khỏi `NINJA_APIS`. Phép so hash của `codegen:check` KHÔNG thấy được lớp này — rác nằm ở
 * cả lượt chụp trước lẫn lượt chụp sau nên không có gì "lệch", và client cũ cứ thế đóng
 * băng vĩnh viễn trong khi cái cổng dựng lên đúng để chặn client lệch schema nói "khớp".
 *
 * Nằm cạnh `duongDanCho` là cố ý: hai hàm phải đổi cùng nhau, tách ra là sinh lệch.
 */
export function tenSinhRaHopLe(khoas) {
  const ten = new Set();
  for (const khoa of khoas) {
    const { schemaPath, srcDir } = duongDanCho(khoa);
    ten.add(basename(schemaPath));
    ten.add(basename(srcDir));
  }
  return ten;
}
