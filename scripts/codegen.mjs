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
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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

/** Sinh client vào thư mục TẠM rồi **chép đè** lên `srcDir` — không xoá `srcDir` bao giờ.
 *
 * ## Vì sao không `rmSync(srcDir)` rồi sinh thẳng vào đó nữa
 *
 * Bản cũ làm đúng thế, và nó đúng về kết quả: sau khi chạy xong, `srcDir` chứa **đúng**
 * những file schema hiện tại sinh ra, không sót file mồ côi của lần trước. Cái nó không
 * lường là **ai khác đang nhìn thư mục ấy**.
 *
 * `next dev` theo dõi mọi file trong đồ thị module. Giữa `rmSync` và lúc `createClient`
 * ghi xong, `packages/api-client/src/` **không tồn tại** — và nếu Next đọc đúng vào
 * khoảnh khắc đó thì nó cache lại thất bại và **không tự phục hồi** dù file có lại ngay
 * sau đó:
 *
 * ```
 * ⨯ ../../packages/api-client/src/index.ts
 *   Failed to read source code … The system cannot find the file specified.
 * ```
 *
 * Triệu chứng ở trình duyệt **không hề giống nguyên nhân**: trang public "mất hết CSS",
 * khu quản trị kẹt vĩnh viễn ở "Đang kiểm tra phiên…". Cả hai trông như lỗi của đoạn code
 * vừa viết. Cắn **bốn lần trong một phiên** (2026-08-23) trước khi ai đó chịu đọc log của
 * dev server.
 *
 * ## Cách này giữ nguyên tính chất "không file mồ côi"
 *
 * Chép đè xong thì **quét ngược**: file nào còn trong `srcDir` mà không có trong bản vừa
 * sinh thì xoá lẻ. Kết quả cuối cùng giống hệt bản cũ — chỉ khác ở chỗ thư mục không bao
 * giờ biến mất, nên watcher chỉ thấy file bị GHI ĐÈ, đúng như một lượt sửa tay bình
 * thường.
 *
 * ⚠ Vẫn còn một cửa KHÔNG đóng được ở đây: `pnpm build` ghi đè `.next/` của chính app mà
 * `next dev` đang chạy (`Cannot find module './999.js'`). Đó là hai tiến trình tranh nhau
 * một thư mục build, không phải chuyện của codegen — luật nằm ở `CLAUDE.md`.
 */
async function sinhVaTraoDoi(khoa, schemaPath, srcDir) {
  // Thư mục tạm nằm ở **thư mục tạm của hệ điều hành**, KHÔNG nằm cạnh `srcDir`.
  //
  // Bản đầu đặt nó là `${srcDir}.tam-<pid>` — tức bên trong `packages/api-client/`. Mà
  // `scripts/codegen-check.mjs` quét **tên cấp 1** của đúng thư mục ấy và coi mọi tên
  // không có trong registry là **client mồ côi** ⇒ `codegen:check` đỏ với một lời buộc
  // tội hoàn toàn sai ("client mồ côi không bao giờ được sinh lại nhưng vẫn import
  // được"). Chỉ cần một lần chạy bị ngắt giữa chừng để lại thư mục tạm là hàng rào ấy
  // kẹt đỏ cho tới khi có người đi xoá tay.
  //
  // `cpSync` chép nội dung nên khác ổ đĩa cũng không sao — đó là lý do không dùng
  // `renameSync`.
  const tam = join(tmpdir(), `gikky-codegen-${khoa}-${process.pid}`);
  rmSync(tam, { recursive: true, force: true });
  try {
    await createClient({
      input: schemaPath,
      output: { path: tam, postProcess: [] },
      plugins: ["@hey-api/client-fetch", "@hey-api/sdk", "@hey-api/typescript"],
    });

    const moi = new Set(walk(tam).map((f) => relative(tam, f)));
    mkdirSync(srcDir, { recursive: true });
    cpSync(tam, srcDir, { recursive: true, force: true });

    // Quét ngược: gỡ file của lần sinh TRƯỚC mà lần này không còn sinh ra nữa. Không có
    // bước này thì một endpoint bị xoá khỏi Django vẫn để lại type của nó nằm đó, và
    // `codegen:check` sẽ không thấy gì bất thường vì nó chỉ so những file được sinh.
    for (const f of walk(srcDir)) {
      if (!moi.has(relative(srcDir, f))) unlinkSync(f);
    }
    donThuMucRong(srcDir);
  } finally {
    rmSync(tam, { recursive: true, force: true });
  }
}

/** Xoá đệ quy những thư mục con RỖNG còn sót sau khi gỡ file mồ côi. */
function donThuMucRong(thu_muc) {
  for (const ten of readdirSync(thu_muc)) {
    const duong = join(thu_muc, ten);
    if (!statSync(duong).isDirectory()) continue;
    donThuMucRong(duong);
    if (readdirSync(duong).length === 0) rmSync(duong, { recursive: true });
  }
}

for (const khoa of khoas) {
  const { schemaPath, srcDir } = duongDanCho(khoa);

  console.log(`[codegen] [${khoa}] 1/3 export_openapi -> ${ngan(schemaPath)}`);
  const status = runManage(["export_openapi", "--api", khoa, "--output", schemaPath]);
  if (status !== 0) process.exit(status);

  console.log(`[codegen] [${khoa}] 2/3 openapi-ts -> ${ngan(srcDir)}`);
  await sinhVaTraoDoi(khoa, schemaPath, srcDir);

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
