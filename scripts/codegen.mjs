// Đường ống type MỘT CHIỀU: Ninja -> OpenAPI -> TS (PLAN 8.3).
//
//   pnpm codegen
//
// 0. đọc danh sách NinjaAPI từ `config/api_registry.py` (`export_openapi --list`)
// 1. MỖI khoá: `manage.py export_openapi --api <khoá> --output <schema>`
// 2. MỖI khoá: chạy @hey-api/openapi-ts sinh TS client
// 3. chuẩn hoá CRLF -> LF + gắn header "KHÔNG SỬA TAY" cho mọi file vừa ghi
// 4. hàng rào: `index.ts` sinh ra KHÔNG được xuất `client` singleton
// 5. hàng rào: tập subpath trong `exports` của package.json BẰNG ĐÚNG tập registry sinh ra
//
// Bước 0 là lý do file này không viết cứng `v1`: xem `scripts/api-registry.mjs`.
// Bước 3 là bắt buộc trên Windows: nếu để CRLF lọt vào thì bước kiểm drift ở CI
// (LF) báo giả 100%.
// Bước 4 là hàng rào N3 tầng hai: xem `scripts/rao-can-client.mjs`.
// Bước 5 xem `scripts/rao-can-exports.mjs`.
//
// LƯU Ý cho người sửa file này: bước 4 và bước 5 ở đây KHÔNG phải nơi duy nhất gọi hai
// hàng rào — `codegen-check.mjs` gọi lại cả hai một cách ĐỘC LẬP. Đó là cố ý: xoá dây nối
// ở đây thì `pnpm codegen:check` vẫn bắt được vi phạm.

import { createClient } from "@hey-api/openapi-ts";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { danhSachApi, duongDanCho, repoRoot } from "./api-registry.mjs";
import { runManage } from "./py.mjs";
import { kiemTraIndex } from "./rao-can-client.mjs";
import { kiemTraExports } from "./rao-can-exports.mjs";

const BANNER = [
  "// SINH TỰ ĐỘNG bởi `pnpm codegen` từ OpenAPI của Django Ninja.",
  "// KHÔNG SỬA TAY — mọi thay đổi sẽ mất ở lần codegen kế tiếp.",
  "",
].join("\n");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** CRLF -> LF cho mọi file; thêm header cho file TS. */
function normalize(files) {
  for (const file of files) {
    let text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    if (file.endsWith(".ts") && !text.startsWith(BANNER)) text = BANNER + text;
    writeFileSync(file, text, { encoding: "utf8" });
  }
}

const ngan = (p) => relative(repoRoot, p).replaceAll("\\", "/");

const khoas = danhSachApi();
console.log(`[codegen] registry NINJA_APIS: ${khoas.join(", ")}`);

const than = [];

/** Những `index.ts` mà hàng rào singleton THẬT SỰ chấm được — con số này do CHÍNH hàng rào
 *  trả về (`kiemTraIndex().daSoi`), không phải do vòng lặp dưới đây tự đếm. Bản vòng 4 đẩy
 *  `indexPath` vào đây ngay cạnh lời gọi, nên cắt lời gọi đi thì nó vẫn in "đã soi 1". */
const daSoiIndex = [];

/** Cùng lý do, cho hàng rào `exports`: số subpath THẬT SỰ được chấm. */
const daSoiSubpath = [];

for (const khoa of khoas) {
  const { schemaPath, srcDir } = duongDanCho(khoa);

  console.log(`[codegen] [${khoa}] 1/3 export_openapi -> ${ngan(schemaPath)}`);
  const status = runManage(["export_openapi", "--api", khoa, "--output", schemaPath]);
  if (status !== 0) process.exit(status);

  console.log(`[codegen] [${khoa}] 2/3 openapi-ts -> ${ngan(srcDir)}`);
  rmSync(srcDir, { recursive: true, force: true });
  await createClient({
    input: schemaPath,
    output: { path: srcDir, postProcess: [] },
    plugins: ["@hey-api/client-fetch", "@hey-api/sdk", "@hey-api/typescript"],
  });

  console.log(`[codegen] [${khoa}] 3/3 chuẩn hoá LF + header`);
  normalize([schemaPath, ...walk(srcDir)]);

  const indexPath = join(srcDir, "index.ts");
  const soi = kiemTraIndex(indexPath);
  daSoiIndex.push(...soi.daSoi);
  than.push(...soi.than);
}

const soiExports = kiemTraExports(khoas);
daSoiSubpath.push(...soiExports.daSoi);
than.push(...soiExports.than);

if (than.length > 0) {
  console.error("[codegen] HÀNG RÀO CHẶN — client sinh ra không dùng được như hiện trạng:");
  for (const dong of than) console.error(dong);
  process.exit(1);
}

// Đếm chứ không khẳng định, và đếm bằng số HAI HÀNG RÀO TRẢ VỀ. Dòng "xong" cũ nói "exports
// sạch" — câu đó đúng y nguyên kể cả khi lời gọi hàng rào bị cắt mất, mà đó đúng là lớp lỗi
// các vòng vá này đi diệt. Cắt dây nối ở trên bây giờ in ra "0/1" và "0 subpath".
console.log(
  `[codegen] xong — ${khoas.length} client; hàng rào soi được ${daSoiIndex.length}/${khoas.length} ` +
    `index.ts + ${daSoiSubpath.length} subpath trong exports.`,
);
