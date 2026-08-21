// Hàng rào cho `exports` của `packages/api-client/package.json`.
//
//   node scripts/rao-can-exports.mjs      # chạy tay
//   (codegen.mjs và codegen-check.mjs đều gọi nó)
//
// MỘT mệnh đề, và nó là ALLOWLIST chứ không phải danh sách cấm:
//
//   Tập subpath trong `exports` phải BẰNG ĐÚNG tập sinh từ registry —
//   `{"."} ∪ {"./<khoá>" : khoá ≠ v1}` — và mỗi subpath trỏ ĐÚNG `index.ts` của cây khoá đó,
//   file ấy phải có thật trên đĩa.
//
// Vì sao allowlist. Bản trước liệt kê hai điều CẤM (wildcard; thiếu subpath cho một khoá) và
// thế là đủ để lọt một hình dạng không ai nghĩ tới: subpath THỪA trỏ vào một file nội bộ CÓ
// THẬT. Chuỗi tái hiện, không cần wildcard, không cần đợi Phase 4:
//   dev gõ `import { client } from "@gikky/api-client/client.gen"`
//   → `ERR_PACKAGE_PATH_NOT_EXPORTED` in ra đúng tên subpath còn thiếu
//   → dev thêm một dòng `"./client.gen": "./src/client.gen.ts"`
//   → không có `*`, khoá `v1` vẫn trỏ đúng chỗ ⇒ hàng rào cũ QUA; `rao-can-client.mjs` mù
//     (nó canh bề mặt export của `index.ts`, còn subpath này đi VÒNG qua `index.ts`);
//     codegen + codegen:check + test + lint XANH HẾT
//   → `src/client.gen.ts` `export const client` sống lại. Hỏng IM LẶNG, và hậu quả ở Phase 3
//     là request của user B đọc dữ liệu bằng session user A, trang vẫn trả 200.
// Một danh sách cấm luôn thiếu một hình dạng. Danh sách CHO PHÉP thì hình dạng nào không có
// tên trong registry cũng chặn: wildcard · subpath nội bộ · subpath treo · đích gõ nhầm ·
// đích trỏ vào thư mục của khoá đã gỡ (kể cả khi thư mục đó vẫn còn nằm trên đĩa).
//
// Wildcard giữ thông điệp RIÊNG dù allowlist đã bao: nó là ca hay gặp nhất — cách chữa nhanh
// nhất khi `ERR_PACKAGE_PATH_NOT_EXPORTED` đập vào mặt là gõ `"./*": "./src/*"` — nên nó đáng
// được giải thích vì sao cấm, thay vì chỉ bị báo "không có tên trong registry".

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { clientDir, danhSachApi, duongDanCho } from "./api-registry.mjs";

/** `v1` xuất qua `"."` (root import) — A9/A10/C1b chốt trên đó, xem `api-registry.mjs`. */
const SUBPATH_CUA_V1 = ".";
const KHOA_DUNG_SUBPATH_GOC = "v1";

const packageJsonPath = join(clientDir, "package.json");

/** Mọi chuỗi đích nằm trong một giá trị subpath (chuỗi trần, mảng, hoặc object điều kiện). */
function moiDich(gia_tri) {
  if (typeof gia_tri === "string") return [gia_tri];
  if (Array.isArray(gia_tri)) return gia_tri.flatMap(moiDich);
  if (gia_tri && typeof gia_tri === "object") return Object.values(gia_tri).flatMap(moiDich);
  return [];
}

/** subpath ĐƯỢC PHÉP có -> đích DUY NHẤT hợp lệ của nó. Sinh từ registry, không viết tay. */
function chuoiSubpathChoPhep(khoas) {
  const chophep = new Map();
  for (const khoa of khoas) {
    const { srcDir } = duongDanCho(khoa);
    const subpath = khoa === KHOA_DUNG_SUBPATH_GOC ? SUBPATH_CUA_V1 : `./${khoa}`;
    chophep.set(subpath, `./${basename(srcDir)}/index.ts`);
  }
  return chophep;
}

/**
 * @returns {{than: string[], daSoi: string[]}}
 *   `than` rỗng = sạch. `daSoi` là những subpath THẬT SỰ được chấm (có trong file, hoặc
 *   registry đòi phải có) — để dòng "xong" in được SỐ ĐO thay vì câu "exports sạch", vốn
 *   đúng y nguyên kể cả khi hàng rào không hề chạy.
 */
export function kiemTraExports(khoas) {
  let goi;
  try {
    goi = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch (loi) {
    return {
      than: [`[rào-cản-exports] không đọc được ${packageJsonPath}: ${loi.message}`],
      daSoi: [],
    };
  }

  const xuat = goi.exports;

  if (xuat === undefined || xuat === null) {
    return {
      than: [
        `[rào-cản-exports] ${packageJsonPath} không có \`exports\`.`,
        "          Không có nó thì Node xuất SẠCH mọi file trong package — kể cả client.gen.ts.",
      ],
      daSoi: [],
    };
  }

  if (typeof xuat !== "object" || Array.isArray(xuat)) {
    return {
      than: [
        `[rào-cản-exports] \`exports\` của ${packageJsonPath} phải là object subpath, đang là ${Array.isArray(xuat) ? "mảng" : typeof xuat}.`,
        "          Dạng chuỗi/mảng KHÔNG xuất sạch package — nó xuất đúng đường ghi trong đó,",
        "          nhưng gộp cả vào mỗi subpath `.`, nên không khai nổi khoá thứ hai và hàng rào",
        "          này không đối chiếu được subpath nào với khoá nào. Viết dạng object.",
      ],
      daSoi: [],
    };
  }

  const chophep = chuoiSubpathChoPhep(khoas);
  const coThat = Object.keys(xuat);
  const daSoi = [...new Set([...coThat, ...chophep.keys()])];
  const than = [];

  for (const subpath of coThat) {
    if (subpath.includes("*")) {
      than.push(
        `[rào-cản-exports] subpath wildcard ${JSON.stringify(subpath)} — CẤM.`,
        "          Wildcard mở lại đường `import { client } from \"@gikky/api-client/client.gen\"`,",
        "          đi VÒNG qua index.ts nên `rao-can-client.mjs` không thấy. Khai từng subpath",
        "          tường minh, mỗi khoá registry một dòng.",
      );
      continue;
    }

    if (!chophep.has(subpath)) {
      than.push(
        `[rào-cản-exports] subpath THỪA ${JSON.stringify(subpath)} — không khoá nào trong registry sinh ra nó.`,
        `          Được phép đúng ${[...chophep.keys()].map((s) => JSON.stringify(s)).join(", ")} (theo NINJA_APIS: ${khoas.join(", ")}).`,
        "          Mọi subpath khác là một lối vào thẳng file nội tuyến, đi VÒNG qua index.ts —",
        "          `./client.gen` là ca kinh điển: nó dựng lại `client` singleton mà",
        "          `rao-can-client.mjs` không thấy, và không lệnh nào của repo đỏ.",
        "          Cần một khoá mới thì đăng ký vào NINJA_APIS, đừng thêm tay dòng này.",
      );
      continue;
    }

    const dichCan = chophep.get(subpath);
    const dich = moiDich(xuat[subpath]);

    if (dich.length !== 1 || dich[0] !== dichCan) {
      than.push(
        `[rào-cản-exports] subpath ${JSON.stringify(subpath)} phải trỏ đúng một đích ${JSON.stringify(dichCan)}, đang là ${JSON.stringify(dich)}.`,
        "          Một khoá một lối vào: nhiều đích là hai bản sao module ở runtime, còn đích",
        "          khác `index.ts` là mở cửa cho file nội tuyến.",
      );
      continue;
    }

    if (!existsSync(join(clientDir, dichCan))) {
      than.push(
        `[rào-cản-exports] subpath ${JSON.stringify(subpath)} trỏ ${dichCan} — KHÔNG có file đó trên đĩa.`,
        "          Subpath treo: `import` chết ở người dùng cuối chứ không chết ở cổng này.",
        "          Chạy `pnpm codegen`, hoặc sửa lại đích cho khớp cây codegen sinh ra.",
      );
    }
  }

  for (const [subpath, dichCan] of chophep) {
    if (coThat.includes(subpath)) continue;
    than.push(
      `[rào-cản-exports] thiếu subpath ${JSON.stringify(subpath)} trỏ ${dichCan}.`,
      `          Thêm vào "exports" của ${packageJsonPath}:`,
      `            ${JSON.stringify(subpath)}: ${JSON.stringify(dichCan)}`,
      "          Không khai thì codegen vẫn exit 0 nhưng `import` ra ERR_PACKAGE_PATH_NOT_EXPORTED.",
    );
  }

  return { than, daSoi };
}

const goiTrucTiep = process.argv[1] === fileURLToPath(import.meta.url);
if (goiTrucTiep) {
  const { than, daSoi } = kiemTraExports(danhSachApi());
  if (than.length > 0) {
    for (const dong of than) console.error(dong);
    process.exit(1);
  }
  console.log(`[rào-cản-exports] ${daSoi.length} subpath đã chấm, không thừa không thiếu — ${packageJsonPath}`);
}
