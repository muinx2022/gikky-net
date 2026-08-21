// Kiểm DRIFT của đường ống codegen: sinh lại rồi so hash với thứ đang nằm trong repo.
//
//   pnpm codegen:check
//
// exit 0  = client trong repo khớp với schema hiện tại của Django.
// exit 1  = một trong bốn thứ:
//           - LỆCH: ai đó sửa Django mà quên chạy `pnpm codegen`, hoặc sửa tay
//             `packages/api-client/src` (PLAN 8.3 cấm);
//           - THIẾU: khoá trong `NINJA_APIS` không được sinh client;
//           - MỒ CÔI: có tên nằm trong `packages/api-client/` mà registry hiện tại không
//             sinh ra (`openapi.X.json` / `src-X` của khoá đã gỡ, và cả `src-X.bak`,
//             `openapi.X.json.tmp` — xem khối MỒ CÔI dưới);
//           - HÀNG RÀO: `index.ts` xuất `client`, hoặc tập subpath trong `exports` của
//             package.json không bằng đúng tập registry sinh ra.
//
// PLAN 8.3 nói CI kiểm drift bằng `git diff --exit-code`. Repo chưa có commit nào nên
// `git diff` chưa đo được gì — bản này so hash, dùng được ngay và vẫn dùng được sau khi
// có CI.
//
// Lưu ý: lệnh này GHI ĐÈ `packages/api-client` bằng bản sinh mới (đúng ý đồ — CI muốn
// thấy bản mới để so). Chạy ở máy dev khi đang có sửa tay thì sửa tay đó mất.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  clientDir,
  danhSachApi,
  duongDanCho,
  repoRoot,
  tenSinhRaHopLe,
} from "./api-registry.mjs";
import { kiemTraIndex } from "./rao-can-client.mjs";
import { kiemTraExports } from "./rao-can-exports.mjs";

// Những tên cấp 1 trong `packages/api-client/` KHÔNG do codegen sinh ra mà vẫn hợp lệ.
// Danh sách này phải viết TAY và phải ngắn — khối MỒ CÔI dưới đây nêu rác bằng cách lấy
// phần bù của nó với `tenSinhRaHopLe(khoas)`, nên thêm file hợp lệ mới (`README.md`,
// `tsconfig.json`...) là phải thêm một dòng vào đây. Đó là ma sát CỐ Ý: nới một regex thì
// nới luôn cho cả `src-zz.bak`, còn thêm một tên thì chỉ thêm đúng tên đó.
const TEN_HOP_LE_KHONG_SINH_RA = new Set([
  "package.json",
  // `node_modules/` của pnpm nằm ngay trong thư mục này và đổi theo `pnpm install` chứ
  // không theo schema — vừa hợp lệ, vừa KHÔNG được đem đi băm (đo nó là tự chuốc báo
  // drift giả).
  "node_modules",
]);

/** Gốc để băm: đúng những tên registry hiện tại sinh ra, không phải một mẫu tên.
 *
 * Liệt kê theo registry chứ không theo regex là chỗ khoản 9 (plan vòng 4) chết: regex khớp
 * chính xác bỏ sót `src-zz.bak` / `openapi.zz.json.tmp`, nên rác kiểu đó vô hình với CẢ
 * phép so hash lẫn khối mồ côi. Nay mọi tên không có trong registry đều bị khối MỒ CÔI
 * chặn TRƯỚC, và cái được băm là đúng tập registry đòi.
 */
function goTheoDoi(hopLe) {
  return readdirSync(clientDir)
    .filter((ten) => hopLe.has(ten))
    .map((ten) => join(clientDir, ten));
}

function walk(duongDan) {
  if (!statSync(duongDan, { throwIfNoEntry: false })) return [];
  if (!statSync(duongDan).isDirectory()) return [duongDan];
  return readdirSync(duongDan).flatMap((entry) => walk(join(duongDan, entry)));
}

/** Bản đồ đường-dẫn-tương-đối -> sha256 của mọi file được theo dõi.
 *
 * Liệt kê LẠI thư mục mỗi lần gọi (không cache): lượt sinh có thể đẻ ra `src-<khoá>/` mới,
 * mà một danh sách chụp trước khi chạy thì không bao giờ nhìn thấy nó.
 */
function bamCay(hopLe) {
  const bang = new Map();
  for (const goc of goTheoDoi(hopLe)) {
    for (const file of walk(goc)) {
      const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
      bang.set(relative(repoRoot, file).replace(/\\/g, "/"), hash);
    }
  }
  return bang;
}

const khoas = danhSachApi();

// MỒ CÔI — ALLOWLIST: tên cấp 1 nào trong `packages/api-client` không do registry sinh ra
// và không có trong `TEN_HOP_LE_KHONG_SINH_RA` thì bị nêu, hết. Bản trước lọc trước bằng
// `LA_DO_SINH_RA` (regex khớp chính xác `src-<khoá>` / `openapi.<khoá>.json`) nên `src-zz.bak`,
// `openapi.zz.json.tmp`, `src.old` lọt sạch — mà đó đúng là hình dạng người ta tạo ra khi
// "để dành": giữ `"./zz": "./src-zz.bak/index.ts"` là `import` vẫn chạy, trả về client ĐÓNG
// BĂNG lệch schema, trong khi cái cổng dựng lên đúng để chặn client lệch schema nói "khớp".
//
// Kiểm TRƯỚC khi chạy codegen: thông điệp là "xoá tay đi", nên không có lý do ghi đè repo
// một lượt rồi mới nói. Đây là lớp lỗi mà phép so hash mù hoàn toàn — rác có ở cả hai lượt
// chụp ⇒ không lệch ⇒ exit 0.
const hopLe = tenSinhRaHopLe(khoas);
const tenCap1 = readdirSync(clientDir);
const moCoi = tenCap1.filter((ten) => !hopLe.has(ten) && !TEN_HOP_LE_KHONG_SINH_RA.has(ten));
if (moCoi.length > 0) {
  console.error("[codegen:check] MỒ CÔI — không khoá nào trong NINJA_APIS sinh ra:");
  for (const ten of moCoi) console.error(`  packages/api-client/${ten}`);
  console.error(
    `[codegen:check] registry đang có: ${khoas.join(", ")}; tên hợp lệ: ` +
      `${[...hopLe, ...TEN_HOP_LE_KHONG_SINH_RA].join(", ")}. Hoặc đăng ký lại khoá đã gỡ, ` +
      "hoặc XOÁ những đường dẫn trên — client mồ côi không bao giờ được sinh lại nhưng vẫn import được. " +
      "Nếu đó là file hợp lệ kiểu mới thì thêm ĐÍCH DANH vào TEN_HOP_LE_KHONG_SINH_RA của scripts/codegen-check.mjs.",
  );
  process.exit(1);
}

const truoc = bamCay(hopLe);
if (truoc.size === 0) {
  console.error("[codegen:check] packages/api-client trống — chạy `pnpm codegen` trước.");
  process.exit(1);
}

const chay = spawnSync(process.execPath, [join(repoRoot, "scripts", "codegen.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
});
if (chay.error) throw chay.error;
if (chay.status !== 0) process.exit(chay.status ?? 1);

const sau = bamCay(hopLe);

// Mỗi khoá registry phải để lại DẤU VẾT thật. Không có đoạn này thì một `codegen.mjs` lặp
// hụt (bỏ qua khoá thứ hai) vẫn "khớp — N file không đổi" và exit 0: nó chỉ so cái đã sinh
// với cái đã sinh, khoá bị bỏ qua thì cả hai lượt đều không có, nên không có gì lệch.
const thieu = [];
for (const khoa of khoas) {
  const { schemaPath, srcDir } = duongDanCho(khoa);
  for (const can of [schemaPath, join(srcDir, "index.ts")]) {
    const ten = relative(repoRoot, can).replace(/\\/g, "/");
    if (!sau.has(ten)) thieu.push(`${khoa} -> thiếu ${ten}`);
  }
}
if (thieu.length > 0) {
  console.error("[codegen:check] Khoá trong NINJA_APIS không được sinh client:");
  for (const dong of thieu) console.error(`  ${dong}`);
  console.error("[codegen:check] scripts/codegen.mjs đang bỏ sót API — sửa nó, đừng nới chỗ này.");
  process.exit(1);
}

// Hai hàng rào, gọi ĐỘC LẬP chứ không nhờ `codegen.mjs` gọi hộ.
//
// `codegen.mjs` cũng gọi cả hai ở bước cuối, và đó là dây nối DUY NHẤT trước vòng này —
// xoá một dòng ở đó là mọi lệnh của repo xanh trở lại, kể cả `codegen:check`, vì
// `codegen:check` chỉ đọc exit code của `codegen.mjs`. Hai lời gọi dưới đây là để cắt dây
// bên kia vẫn có người bắt. Chúng rẻ (đọc file + một lượt type-check) so với lượt sinh
// client vừa chạy xong ở trên.
const hangRao = [];
/** Do CHÍNH hàng rào trả về, không phải vòng lặp này tự đếm — xem `kiemTraIndex`. */
const daSoiIndex = [];
const daSoiSubpath = [];
for (const khoa of khoas) {
  const { srcDir } = duongDanCho(khoa);
  const soi = kiemTraIndex(join(srcDir, "index.ts"));
  daSoiIndex.push(...soi.daSoi);
  hangRao.push(...soi.than);
}
const soiExports = kiemTraExports(khoas);
daSoiSubpath.push(...soiExports.daSoi);
hangRao.push(...soiExports.than);

if (hangRao.length > 0) {
  console.error("[codegen:check] HÀNG RÀO CHẶN — client sinh ra không dùng được như hiện trạng:");
  for (const dong of hangRao) console.error(dong);
  process.exit(1);
}

const lech = [];
for (const [file, hash] of sau) {
  if (!truoc.has(file)) lech.push(`+ ${file} (mới sinh, chưa có trong repo)`);
  else if (truoc.get(file) !== hash) lech.push(`~ ${file} (khác nội dung)`);
}
for (const file of truoc.keys()) {
  if (!sau.has(file)) lech.push(`- ${file} (không còn được sinh ra)`);
}

if (lech.length > 0) {
  console.error(`[codegen:check] LỆCH ${lech.length} file:`);
  for (const dong of lech) console.error(`  ${dong}`);
  console.error("[codegen:check] Chạy `pnpm codegen` rồi commit kết quả.");
  process.exit(1);
}

// Dòng kết in SỐ ĐO, và mỗi số phải là số ĐỔI ĐƯỢC. `${moCoi.length}` của bản trước không
// phải số đo: trên đường đi tới đây nó LUÔN bằng 0 vì `moCoi.length > 0` đã `exit 1` từ lâu.
// Số nói được điều gì đó là số TÊN đã quét — nó tụt xuống nếu khối mồ côi thôi không quét.
console.log(
  `[codegen:check] khớp — ${sau.size} file không đổi; đã quét ${tenCap1.length} tên cấp 1 ` +
    `tìm mồ côi; hàng rào soi được ${daSoiIndex.length}/${khoas.length} index.ts + ` +
    `${daSoiSubpath.length} subpath trong exports.`,
);
