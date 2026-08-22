import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boImport, quetNguon } from "./quet";

const WEB = resolve(__dirname, "..", "..");
const GOC = resolve(WEB, "..", "..");

/** Hàng rào cho PLAN 8.3: **frontend CẤM tự khai interface trùng với API**.
 *
 * Type đi MỘT CHIỀU `Ninja → OpenAPI → TS`. Ai gõ tay một `interface MachChiTietOut` ở
 * `apps/web` là dựng bản sao thứ hai của hợp đồng: nó vẫn biên dịch được, vẫn chạy được,
 * và sẽ trôi khỏi bản gốc đúng lúc API đổi — không có gì đỏ, chỉ có một trường `null`
 * bất ngờ trên production.
 *
 * Danh sách tên KHÔNG gõ tay ở đây: nó đọc thẳng `packages/api-client/openapi.json`, nên
 * API mọc thêm schema là hàng rào tự biết.
 */

const OPENAPI = JSON.parse(
  readFileSync(resolve(GOC, "packages/api-client/openapi.json"), "utf8"),
) as {
  components?: { schemas?: Record<string, unknown> };
  paths?: Record<string, Record<string, { operationId?: string }>>;
};

const TEN_SCHEMA = Object.keys(OPENAPI.components?.schemas ?? {});

/** Chính file này nhắc tên schema trong chuỗi kỳ vọng mà không import chúng. */
const TU_TRU = "e2e/don-vi/type-frontend.spec.ts";

const FILES = quetNguon(WEB, /\.tsx?$/).filter((f) => f.ten !== TU_TRU);

test("đọc được danh sách schema của API (không có thì hàng rào rỗng)", () => {
  expect(TEN_SCHEMA.length).toBeGreaterThan(10);
  expect(TEN_SCHEMA).toContain("MachChiTietOut");
  expect(TEN_SCHEMA).toContain("BinhLuanOut");
  expect(FILES.length).toBeGreaterThan(15);
});

test("không file nào ở apps/web tự khai lại một schema của API", () => {
  const pham: string[] = [];
  for (const f of FILES) {
    // Bỏ chú thích VÀ bỏ import: `import { xemMach, type FeedOut }` chứa đúng chuỗi
    // `type FeedOut` mà luật này đi tìm, dù đó là nhập khẩu chứ không phải khai báo.
    const than = boImport(f.sach);
    for (const ten of TEN_SCHEMA) {
      if (new RegExp(`\\b(interface|type|class|enum)\\s+${ten}\\b`).test(than)) {
        pham.push(`${f.ten}: khai lại ${ten}`);
      }
    }
  }
  expect(pham).toEqual([]);
});

test("luật trên bắt được hàng giả (chứng minh nó không phải hàng rào rỗng)", () => {
  const gia = boImport("export interface MachChiTietOut { id: number }");
  expect(/\b(interface|type|class|enum)\s+MachChiTietOut\b/.test(gia)).toBe(true);
  // …và KHÔNG bắt nhầm một dòng import hợp lệ.
  const that = boImport('import { xemMach, type MachChiTietOut } from "@gikky/api-client";\n');
  expect(/\b(interface|type|class|enum)\s+MachChiTietOut\b/.test(that)).toBe(false);
});

/** Tên đã `import` từ `@gikky/api-client` trong một file — gộp mọi khối import, cả
 * `import type { … }` lẫn `import { hamA, type TypeB }`.
 *
 * ⚠ `[^{}]` chứ **không** `[\s\S]` (sửa 2026-08-22, vá E2). Bản `[\s\S]*?` nuốt qua cả
 * một câu lệnh import khác: gặp `import { expect, test } from "@playwright/test";` đứng
 * TRƯỚC, nó lùi rồi khớp `{` của khối đầu với `}` của khối sau, nên nhóm bắt được là
 * `expect, test } from "@playwright/test"; import type { MocOut` — và cái tên thật rơi
 * mất. Hỏng về phía **báo vi phạm giả**, nên nó chỉ lộ ra khi có file thật xếp import
 * theo thứ tự đó. `[^{}]` không vượt được dấu ngoặc nhọn nào, tức không trèo sang câu
 * lệnh khác.
 */
function tenDaNhap(noi_dung: string): Set<string> {
  const ra = new Set<string>();
  for (const k of noi_dung.matchAll(
    /import\s+(?:type\s+)?\{([^{}]*?)\}\s*from\s*"@gikky\/api-client"/g,
  )) {
    for (const x of k[1].split(",")) {
      const ten = x.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (ten !== "") ra.add(ten);
    }
  }
  return ra;
}

test("file nào NHẮC tới một schema của API thì phải IMPORT nó từ @gikky/api-client", () => {
  const pham: string[] = [];
  for (const f of FILES) {
    const da_nhap = tenDaNhap(f.sach);
    for (const ten of TEN_SCHEMA) {
      if (!new RegExp(`\\b${ten}\\b`).test(f.sach)) continue;
      if (!da_nhap.has(ten)) {
        pham.push(`${f.ten}: dùng ${ten} mà không import từ @gikky/api-client`);
      }
    }
  }
  expect(pham).toEqual([]);
});

test("bài đo trên có bắt được ít nhất một file thật (không quét vào chỗ trống)", () => {
  const co_dung = FILES.filter((f) => tenDaNhap(f.sach).size > 0);
  expect(co_dung.length).toBeGreaterThan(5);
});

test("tenDaNhap không trèo sang câu lệnh import khác (lỗi `[\\s\\S]*?` cũ)", () => {
  // Ca thật đã bắt tại trận: một `import` có ngoặc nhọn đứng TRƯỚC khối api-client.
  const hai_khoi =
    'import { expect, test } from "@playwright/test";\n' +
    'import type { MocOut } from "@gikky/api-client";\n';
  expect([...tenDaNhap(hai_khoi)]).toEqual(["MocOut"]);
  // Và vẫn gộp được nhiều khối api-client trong cùng một file.
  const hai_khoi_api =
    'import { xemMach } from "@gikky/api-client";\n' +
    'import type { FeedOut, MocOut } from "@gikky/api-client";\n';
  expect([...tenDaNhap(hai_khoi_api)].sort()).toEqual(["FeedOut", "MocOut", "xemMach"]);
});

test("không ai import `client` singleton (CLAUDE.md — hỏng im lặng, trang vẫn 200)", () => {
  const nhap_thang = FILES.filter((f) =>
    /from\s+"@gikky\/api-client\/client(\.gen)?"/.test(f.sach),
  );
  expect(nhap_thang.map((f) => f.ten)).toEqual([]);

  // Và không ai GỌI `setConfig` — đó là đường rò session của user A sang user B: `client`
  // là object dùng chung cả tiến trình Node.
  const goi_setconfig = FILES.filter((f) => /\bsetConfig\s*\(/.test(f.sach));
  expect(goi_setconfig.map((f) => f.ten)).toEqual([]);
});

/** Tên hàm mà TS client sinh ra cho mỗi endpoint: `operationId` đổi sang camelCase.
 *
 * Đọc từ `openapi.json` chứ không gõ tay, cùng lý do với `TEN_SCHEMA`: API mọc thêm
 * endpoint thì hàng rào tự biết, không phải nhớ sửa danh sách ở đây.
 */
const TEN_HAM_API = [
  ...new Set(
    Object.values(OPENAPI.paths ?? {}).flatMap((theo_verb) =>
      Object.values(theo_verb)
        .map((d) => d.operationId)
        .filter((x): x is string => typeof x === "string"),
    ),
  ),
].map((s) => s.replace(/_(\w)/g, (_, c: string) => c.toUpperCase()));

/** Chuỗi đối số của lời gọi bắt đầu ở dấu `(` tại `mo`, cân bằng ngoặc.
 *
 * Cắt chuỗi, không phải parser: một dấu `(` hay `)` nằm trong literal chuỗi sẽ làm nó
 * đếm lệch. Đủ dùng vì mọi lời gọi API ở đây truyền một object literal. Nếu nó đếm lệch
 * thì kết quả là **báo vi phạm**, không phải bỏ qua — hỏng về phía an toàn.
 */
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

/** Đối số này có mang `baseUrl` không — trực tiếp, hay qua MỘT lớp spread hằng số?
 *
 * `lib/api.ts` gom `{ baseUrl, cache }` vào hằng `CHUNG` rồi `{ ...CHUNG, … }` ở từng
 * lời gọi. Không đi theo được một lớp spread thì hàng rào bắt buộc mọi lời gọi phải chép
 * lại `baseUrl:` — tức nó ép một kiểu viết xấu hơn để chính nó đọc được.
 */
function coBaseUrl(doi_so: string, than: string): boolean {
  if (/\bbaseUrl\b/.test(doi_so)) return true;
  for (const m of doi_so.matchAll(/\.\.\.([A-Za-z_$][\w$]*)/g)) {
    const khai = new RegExp(
      `\\b(?:const|let|var)\\s+${m[1]}\\s*=\\s*\\{([^{}]*)\\}`,
    ).exec(than);
    if (khai !== null && /\bbaseUrl\b/.test(khai[1])) return true;
  }
  return false;
}

/** Mọi vị trí `<tênHàmAPI>(` trong một file, kèm chuỗi đối số. */
function loiGoiApi(than: string): { ten: string; doi_so: string; tai: number }[] {
  const ra: { ten: string; doi_so: string; tai: number }[] = [];
  for (const ten of TEN_HAM_API) {
    for (const m of than.matchAll(new RegExp(`\\b${ten}\\s*\\(`, "g"))) {
      const mo = m.index + m[0].length - 1;
      ra.push({ ten, doi_so: doiSo(than, mo), tai: m.index });
    }
  }
  return ra;
}

test("đọc được danh sách hàm API (không có thì hai luật dưới rỗng)", () => {
  expect(TEN_HAM_API.length).toBeGreaterThan(5);
  expect(TEN_HAM_API).toContain("xemMach");
  expect(TEN_HAM_API).toContain("getHealth");
  expect(TEN_HAM_API).toContain("lietKeBinhLuanMach");
});

test("mọi lời gọi hàm API trong apps/web đều truyền `baseUrl` theo từng lần gọi", () => {
  // Hệ quả trực tiếp của luật "không singleton": không có `client` dùng chung thì
  // `baseUrl` phải đi kèm từng lời gọi.
  //
  // Vá E2 (2026-08-22): bản đầu của bài này tên là *"mọi lời gọi API"* nhưng thân bài
  // chỉ kiểm `lib/api.ts` **có chứa chuỗi** `baseUrl: API_ORIGIN`. Một trang mới gọi
  // thẳng hàm client mà quên `baseUrl` vẫn xanh — và chú thích cũ còn khẳng định
  // *"`lib/api.ts` là cửa duy nhất"*, câu đã sai sẵn lúc viết: `app/chan-doan/page.tsx`
  // gọi `getHealth(...)` ngoài cửa đó.
  const pham: string[] = [];
  for (const f of FILES) {
    for (const g of loiGoiApi(f.sach)) {
      if (!coBaseUrl(g.doi_so, f.sach)) pham.push(`${f.ten}: ${g.ten}(…) thiếu baseUrl`);
    }
  }
  expect(pham).toEqual([]);
});

test("luật trên có quét trúng lời gọi THẬT ở CẢ HAI cửa (không quét vào chỗ trống)", () => {
  // Đây là vế chống rỗng. Nếu `loiGoiApi` hỏng và trả về mảng rỗng thì bài trên vẫn
  // xanh, y hệt cách bản cũ xanh.
  const theo_file = new Map<string, number>();
  for (const f of FILES) {
    const n = loiGoiApi(f.sach).length;
    if (n > 0) theo_file.set(f.ten, n);
  }
  expect([...theo_file.keys()].sort()).toEqual([
    "app/chan-doan/health-same-origin.tsx",
    "app/chan-doan/page.tsx",
    "lib/api.ts",
  ]);
  expect(theo_file.get("lib/api.ts")).toBeGreaterThanOrEqual(6);
});

test("luật trên bắt được hàng giả (lời gọi thiếu baseUrl)", () => {
  const gia = 'const r = await xemMach({ path: { mach_id: 1 } });';
  const goi = loiGoiApi(gia);
  expect(goi).toHaveLength(1);
  expect(coBaseUrl(goi[0].doi_so, gia)).toBe(false);
  // …và KHÔNG bắt nhầm lời gọi đi qua một lớp spread hằng số.
  const that = 'const C = { baseUrl: X };\nconst r = await xemMach({ ...C, path: {} });';
  expect(coBaseUrl(loiGoiApi(that)[0].doi_so, that)).toBe(true);
});

test("hàm API không được đi qua biến trung gian — hàng rào tìm callee theo TÊN", () => {
  // `const ham = tab === "moi" ? lietKeFeedMoi : lietKeFeedDangDienRa; ham({…})` không
  // sai `baseUrl`, nhưng nó là cái lỗ khiến bài đo trên không thể nói "mọi": callee lúc
  // gọi là `ham`, không phải một tên hàm API. Cấm luôn kiểu viết đó thì chữ "mọi" mới
  // đúng. Hai ngoại lệ hợp lệ: dòng `import`, và `typeof <ten>` (dùng ở TẦNG KIỂU, không
  // sinh ra lời gọi nào lúc chạy — `app/chan-doan/health-text.ts`).
  const pham: string[] = [];
  for (const f of FILES) {
    const than = boImport(f.sach);
    for (const ten of TEN_HAM_API) {
      for (const m of than.matchAll(new RegExp(`\\b${ten}\\b`, "g"))) {
        const sau = than.slice(m.index + ten.length);
        const truoc = than.slice(0, m.index);
        if (/^\s*\(/.test(sau)) continue;
        if (/\btypeof\s+$/.test(truoc)) continue;
        pham.push(`${f.ten}: ${ten} được nhắc tới mà không phải một lời gọi trực tiếp`);
      }
    }
  }
  expect(pham).toEqual([]);
});
