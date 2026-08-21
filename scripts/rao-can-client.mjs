// Hàng rào N3 — TẦNG THỨ HAI, đứng canh chính cái FILE SINH RA.
//
//   node scripts/rao-can-client.mjs      # chạy tay
//   (codegen.mjs gọi nó ở bước cuối mỗi lượt sinh client)
//
// Tầng thứ nhất, bền và viết tay: `packages/api-client/package.json` cố ý KHÔNG có subpath
// `"./client"` trong `exports`. Tầng đó chặn `import { client } from "@gikky/api-client/client"`.
//
// Nhưng `src/index.ts` là file SINH RA — `codegen.mjs` `rmSync` rồi sinh lại nó mỗi lượt.
// Bản `@hey-api/openapi-ts` kế tiếp chỉ cần đổi ý và thêm một dòng `export * from
// './client.gen'` là `import { client } from "@gikky/api-client"` sống lại, hàng rào tụt
// xuống thành văn xuôi trong `CLAUDE.md`, và repo không có bộ test JS nào canh.
//
// Vì sao phải canh: `client` là object dùng chung CẢ TIẾN TRÌNH Node. Ở Phase 3,
// `GET /machs/{id}/me` phải forward cookie; ai viết `client.setConfig({headers:{cookie}})`
// rồi await là mở đường cho request của user B đọc dữ liệu bằng session của user A — hỏng
// IM LẶNG, trang vẫn trả 200. Cách đúng: truyền `baseUrl`/`headers` theo TỪNG lời gọi.
//
// Vì sao dùng type checker của TypeScript chứ không regex: mối lo thật là `export *`, mà
// `export *` thì đọc một file bằng regex không thấy được — phải đi theo cả chuỗi re-export.
// `getExportsOfModule` trả về bề mặt export THẬT sau khi đã nối graph.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { danhSachApi, duongDanCho, repoRoot } from "./api-registry.mjs";

/** Tên bị cấm xuất ra khỏi `@gikky/api-client`. */
const TEN_CAM = "client";

/** Bề mặt export THẬT của một module TS (đã nối `export *` và các bí danh `as`). */
export function tenXuatRa(indexPath) {
  const program = ts.createProgram([indexPath], {
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    // Node10 để `./sdk.gen` (không đuôi, đúng kiểu openapi-ts sinh) resolve ra `sdk.gen.ts`.
    moduleResolution: ts.ModuleResolutionKind.Node10,
  });
  const sourceFile = program.getSourceFile(indexPath);
  if (!sourceFile) throw new Error(`[rào-cản] không đọc được ${indexPath}`);

  const symbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  // Không có module symbol = file không export gì cả.
  if (!symbol) return [];
  return program.getTypeChecker().getExportsOfModule(symbol).map((s) => s.name);
}

/**
 * Hai lớp, và lớp thứ hai quan trọng ngang lớp thứ nhất:
 * 1. có tên `client` trong bề mặt export → vi phạm;
 * 2. bề mặt export RỖNG → hàng rào không đo được gì, phải kêu chứ không được im. Một
 *    checker hỏng mà trả "sạch" còn nguy hơn không có checker, vì màu xanh trấn an người ta.
 *
 * @returns {{than: string[], daSoi: string[]}}
 *   `than` rỗng = sạch. `daSoi` chứa `indexPath` CHỈ KHI hàng rào thật sự đọc được một bề
 *   mặt export để chấm — file không có, hoặc bề mặt rỗng, đều là "chưa soi được gì". Người
 *   gọi in con số lấy từ đây chứ không tự đếm vòng lặp của mình: đếm vòng lặp thì cắt đúng
 *   lời gọi này đi, con số vẫn nguyên (đã xảy ra, vòng 4).
 */
export function kiemTraIndex(indexPath) {
  if (!existsSync(indexPath)) {
    return { than: [`[rào-cản] không thấy ${indexPath} — codegen sinh hụt?`], daSoi: [] };
  }

  const ten = tenXuatRa(indexPath);

  if (ten.length === 0) {
    return {
      than: [
        `[rào-cản] ${indexPath} không xuất ra tên nào. Hàng rào KHÔNG đo được gì — hoặc`,
        "          openapi-ts sinh hụt, hoặc cách nó sinh index.ts đã đổi. Đi xem tận nơi.",
      ],
      daSoi: [],
    };
  }

  if (!ten.includes(TEN_CAM)) return { than: [], daSoi: [indexPath] };

  return {
    than: [
      `[rào-cản] ${indexPath} xuất ra \`${TEN_CAM}\` — CẤM (xem CLAUDE.md, PLAN 8.3).`,
      `          Bề mặt export hiện tại: ${ten.sort().join(", ")}`,
      "          `client` là singleton dùng chung cả tiến trình Node: ai gọi",
      "          `client.setConfig({headers:{cookie}})` trong server component là để request",
      "          của user B đọc dữ liệu bằng session user A — hỏng im lặng, trang vẫn 200.",
      "          Nếu @hey-api/openapi-ts vừa đổi cách sinh index.ts thì phải xử lý tận gốc",
      "          (chốt phiên bản, hoặc lọc lại export), KHÔNG phải nới hàng rào này ra.",
    ],
    daSoi: [indexPath],
  };
}

const goiTrucTiep = process.argv[1] === fileURLToPath(import.meta.url);
if (goiTrucTiep) {
  const than = [];
  const daSoi = [];
  for (const khoa of danhSachApi()) {
    const { srcDir } = duongDanCho(khoa);
    const soi = kiemTraIndex(`${srcDir}/index.ts`.replaceAll("\\", "/"));
    daSoi.push(...soi.daSoi);
    than.push(...soi.than);
  }
  if (than.length > 0) {
    for (const dong of than) console.error(dong);
    process.exit(1);
  }
  console.log(
    `[rào-cản] đã soi ${daSoi.length} index.ts, không client singleton nào rò ra khỏi ` +
      `@gikky/api-client (${repoRoot}).`,
  );
}
