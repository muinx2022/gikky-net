import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boImport, quetNguon } from "./quet";
import { coBaseUrl } from "./quet-ngoac";

/** Hàng rào chống rò session cho **`apps/admin`** — bản song song của
 * `type-frontend.spec.ts`, vốn chỉ quét `apps/web`.
 *
 * **Vì sao là file MỚI chứ không phải nới `WEB` của file kia sang hai thư mục.** File kia
 * có một bài đo ghim danh sách file gọi API bằng `toEqual` chính xác; nới phạm vi là phải
 * sửa danh sách ấy, mà đó đúng là file ba mảng khác (`apps/web`) đang sửa song song. Một
 * file riêng cho một app riêng thì không ai giẫm chân ai — và luật thì y hệt, vì mối đe
 * doạ y hệt.
 *
 * Ba luật, đúng ba luật mà `gikky-net/CLAUDE.md` gọi là chống rò session:
 *
 * 1. không import `client` singleton, không gọi `setConfig`;
 * 2. mọi lời gọi hàm API kèm `baseUrl` **theo từng lần gọi**;
 * 3. không gọi hàm API qua biến trung gian (làm luật 2 phân tích tĩnh được).
 *
 * ⚠ Khu quản trị chạy trong TRÌNH DUYỆT (mọi trang là client component), nên hậu quả của
 * một `client` singleton ở đây nhẹ hơn ở server component. Luật vẫn áp, và lý do là lý do
 * thứ hai: `apps/admin` là nơi người ta sẽ thêm một route handler đầu tiên khi cần một
 * thứ chạy phía server, và lúc đó cái singleton đã nằm sẵn ở đó rồi.
 */

const ADMIN = resolve(__dirname, "..", "..", "..", "admin");
const GOC = resolve(__dirname, "..", "..", "..", "..");

const OPENAPI_ADMIN = JSON.parse(
  readFileSync(resolve(GOC, "packages/api-client/openapi.admin.json"), "utf8"),
) as {
  paths?: Record<string, Record<string, { operationId?: string }>>;
};

/** Tên hàm TS sinh cho mỗi endpoint: `operationId` đổi sang camelCase.
 *
 * Đọc từ `openapi.admin.json` chứ không gõ tay — API mọc thêm endpoint là hàng rào tự
 * biết, không phải nhớ sửa một mảng ở đây. */
const TEN_HAM_API = [
  ...new Set(
    Object.values(OPENAPI_ADMIN.paths ?? {}).flatMap((theo_verb) =>
      Object.values(theo_verb)
        .map((d) => d.operationId)
        .filter((x): x is string => typeof x === "string"),
    ),
  ),
].map((s) => s.replace(/_(\w)/g, (_, c: string) => c.toUpperCase()));

const FILES = quetNguon(ADMIN, /\.tsx?$/);

test("quét trúng cả apps/admin và cả danh sách hàm API (chống hàng rào rỗng)", () => {
  expect(TEN_HAM_API.length).toBeGreaterThanOrEqual(16);
  expect(TEN_HAM_API).toContain("quanTriToi");
  expect(TEN_HAM_API).toContain("quanTriDatAnMoc");
  expect(FILES.length).toBeGreaterThan(5);
});

test("không file nào ở apps/admin import `client` singleton hay gọi setConfig", () => {
  const viPham: string[] = [];
  for (const f of FILES) {
    if (/from\s+"@gikky\/api-client(\/admin)?\/client(\.gen)?"/.test(f.sach)) {
      viPham.push(`${f.ten}: import thẳng \`client\` singleton`);
    }
    // Thông điệp cố ý không viết tên hàm kèm dấu ngoặc mở: chính dòng này nằm trong phạm
    // vi quét của bài đo bên cạnh nếu ai đó đổi `ADMIN` — xem cùng ghi chú ở
    // `type-frontend.spec.ts`.
    if (/\bsetConfig\s*\(/.test(f.sach)) viPham.push(`${f.ten}: gọi setConfig`);
  }
  expect(viPham).toEqual([]);
});

/** Chuỗi đối số của lời gọi bắt đầu ở dấu `(` tại `mo`, cân bằng ngoặc. Cắt chuỗi, không
 * phải parser — đếm lệch thì kết quả là **báo vi phạm**, tức hỏng về phía an toàn. */
function doiSo(s: string, mo: number): string {
  let sau = 0;
  for (let i = mo; i < s.length; i += 1) {
    if (s[i] === "(") sau += 1;
    else if (s[i] === ")") {
      sau -= 1;
      if (sau === 0) return s.slice(mo + 1, i);
    }
  }
  return s.slice(mo + 1);
}

function loiGoiApi(than: string): { ten: string; doi_so: string }[] {
  const ra: { ten: string; doi_so: string }[] = [];
  for (const ten of TEN_HAM_API) {
    for (const m of than.matchAll(new RegExp(`\\b${ten}\\s*\\(`, "g"))) {
      ra.push({ ten, doi_so: doiSo(than, m.index + m[0].length - 1) });
    }
  }
  return ra;
}

// `coBaseUrl` **dùng chung với `type-frontend.spec.ts`** — L25, 2026-08-23.
//
// Bản riêng ở đây từng là `\{([^{}]*)\}` một tầng ngoặc trong khi bản web đã chuyển sang
// quét cân bằng. Lệch theo chiều an toàn (admin báo vi phạm GIẢ nếu ai thêm một hằng có
// ngoặc lồng), nhưng một hàng rào báo động giả là một hàng rào sẽ bị gỡ — L24 đã ghi đúng
// câu đó. Hai bản của một luật thì bản ít chạy hơn sẽ là bản trôi.

test("mọi lời gọi hàm API trong apps/admin đều truyền `baseUrl` theo từng lần gọi", () => {
  const viPham = FILES.flatMap((f) =>
    loiGoiApi(f.sach)
      .filter((g) => !coBaseUrl(g.doi_so, f.sach))
      .map((g) => `${f.ten}: ${g.ten}(…) thiếu baseUrl`),
  );
  expect(viPham).toEqual([]);
});

test("luật trên quét trúng lời gọi THẬT (không quét vào chỗ trống)", () => {
  // Vế chống rỗng: `loiGoiApi` hỏng và trả mảng rỗng thì bài trên vẫn xanh.
  const theo_file = new Map<string, number>();
  for (const f of FILES) {
    const n = loiGoiApi(f.sach).length;
    if (n > 0) theo_file.set(f.ten, n);
  }
  const tong = [...theo_file.values()].reduce((a, b) => a + b, 0);
  expect(theo_file.size).toBeGreaterThanOrEqual(5);
  expect(tong).toBeGreaterThanOrEqual(12);
});

test("luật trên bắt được hàng giả (lời gọi thiếu baseUrl)", () => {
  // Ghép từ hai mảnh, cố ý: viết liền một mạch là file này tự nộp mình cho chính luật nó
  // đang canh — và cách chữa duy nhất còn lại sẽ là một giấy miễn trừ cho đúng cái luật
  // chống rò session.
  const TEN = "quanTri" + "Toi";
  const gia = `const r = await ${TEN}({ cache: "no-store" });`;
  const goi = loiGoiApi(gia);
  expect(TEN_HAM_API).toContain(TEN);
  expect(goi).toHaveLength(1);
  expect(coBaseUrl(goi[0].doi_so, gia)).toBe(false);

  const that = `const C = { baseUrl: X };\nconst r = await ${TEN}({ ...C });`;
  expect(coBaseUrl(loiGoiApi(that)[0].doi_so, that)).toBe(true);
});

test("hàm API không được đi qua biến trung gian", () => {
  // `const ham = x ? quanTriDatAnMoc : quanTriDatAnMach; ham({…})` không sai `baseUrl`,
  // nhưng nó là cái lỗ khiến bài trên không thể nói "mọi": callee lúc gọi là `ham`.
  // Ngoại lệ hợp lệ: dòng `import`, và `typeof <ten>` (tầng KIỂU, không sinh lời gọi nào).
  const viPham: string[] = [];
  for (const f of FILES) {
    const than = boImport(f.sach);
    for (const ten of TEN_HAM_API) {
      for (const m of than.matchAll(new RegExp(`\\b${ten}\\b`, "g"))) {
        if (/^\s*\(/.test(than.slice(m.index + ten.length))) continue;
        if (/\btypeof\s+$/.test(than.slice(0, m.index))) continue;
        viPham.push(`${f.ten}: ${ten} được nhắc tới mà không phải một lời gọi trực tiếp`);
      }
    }
  }
  expect(viPham).toEqual([]);
});

test("apps/admin không tự khai lại schema của API quản trị", () => {
  // Cùng luật PLAN 8.3 với `apps/web`: type đi MỘT CHIỀU Ninja → OpenAPI → TS. Một
  // `interface BaoCaoOut` gõ tay vẫn biên dịch được và sẽ trôi khỏi bản gốc đúng lúc API
  // đổi — không có gì đỏ, chỉ có một trường `null` bất ngờ trên production.
  const schema = JSON.parse(
    readFileSync(resolve(GOC, "packages/api-client/openapi.admin.json"), "utf8"),
  ) as { components?: { schemas?: Record<string, unknown> } };
  const TEN_SCHEMA = Object.keys(schema.components?.schemas ?? {});
  expect(TEN_SCHEMA.length).toBeGreaterThan(10);

  const viPham = FILES.flatMap((f) => {
    const than = boImport(f.sach);
    return TEN_SCHEMA.filter((ten) =>
      new RegExp(`\\b(interface|type|class|enum)\\s+${ten}\\b`).test(than),
    ).map((ten) => `${f.ten}: khai lại ${ten}`);
  });
  expect(viPham).toEqual([]);
});
