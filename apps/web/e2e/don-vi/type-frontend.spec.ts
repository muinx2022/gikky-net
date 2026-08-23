import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { KHOANG_FEED, SORT_API } from "../../lib/api";
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
  paths?: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        parameters?: { name: string; schema?: { enum?: unknown } }[];
      }
    >
  >;
};

const TEN_SCHEMA = Object.keys(OPENAPI.components?.schemas ?? {});

/** Mọi file `.ts`/`.tsx` của `apps/web`. **KHÔNG lọc bớt** — xem `TU_TRU`. */
const FILES = quetNguon(WEB, /\.tsx?$/);

/** Năm luật của hàng rào này, mỗi luật một khoá. Miễn trừ khai theo TỪNG LUẬT. */
type Luat =
  | "KHAI_LAI_SCHEMA"
  | "NHAC_MA_KHONG_IMPORT"
  | "CLIENT_SINGLETON"
  | "THIEU_BASE_URL"
  | "GOI_QUA_BIEN";

/** File **nói VỀ** tên schema / tên hàm API thay vì dùng chúng — miễn trừ **theo LUẬT**,
 * kèm lý do *(vá W2, lượt vá 2)*.
 *
 * Một hàng rào grep không phân biệt được "gọi hàm" với "nhắc tên hàm trong một biểu thức
 * chính quy", nên mọi hàng rào soi chính bề mặt API đều tự tố cáo mình. Nhưng bản trước
 * lọc **cả file khỏi cả 6 luật**, và cái giá đo được: thêm hai lời gọi thiếu `baseUrl`
 * vào `khong-ghi-cung-sub.spec.ts` cho **120 passed, 0 failed**. Tức luật "mọi lời gọi
 * API phải có `baseUrl`" — đúng đường rò session của user A sang user B mà
 * `gikky-net/CLAUDE.md` cấm — **mù với cả một file**, và giấy miễn trừ ấy chỉ cần cho
 * MỘT luật khác hẳn.
 *
 * Danh sách tường minh chứ không phải quy ước theo thư mục: bài đo bình thường trong
 * `e2e/` vẫn phải tuân luật (chúng gọi API thật), chỉ những file đọc MÃ NGUỒN mới được
 * miễn — và chỉ ở đúng luật chúng vướng.
 */
const TU_TRU: Readonly<Record<Luat, Readonly<Record<string, string>>>> = {
  KHAI_LAI_SCHEMA: {
    "e2e/don-vi/type-frontend.spec.ts":
      "chính nó — chuỗi hàng giả `export interface MachChiTietOut { … }`",
  },
  NHAC_MA_KHONG_IMPORT: {
    "e2e/don-vi/type-frontend.spec.ts": "chính nó — nêu tên schema trong chuỗi kỳ vọng",
  },
  // ⚠ RỖNG, và phải rỗng: đây là hai luật chống rò session. Không file nào — kể cả
  // chính hàng rào này — được miễn khỏi chúng.
  CLIENT_SINGLETON: {},
  THIEU_BASE_URL: {},
  GOI_QUA_BIEN: {
    "e2e/don-vi/type-frontend.spec.ts": "chính nó — nêu tên hàm API trong chuỗi kỳ vọng",
    "e2e/don-vi/khong-ghi-cung-sub.spec.ts":
      "hàng rào PLAN mục 7 — phải nêu tên `lietKeSub` để ghim 'đúng một cửa hỏi API'",
  },
};

/** Một luật = một hàm thuần trả về danh sách vi phạm của MỘT file.
 *
 * Tách ra khỏi `test()` là điều kiện để hai chuyện dưới đây làm được: chạy luật trên một
 * file ĐANG được miễn trừ (để chứng minh giấy miễn trừ còn cần), và chạy nó trên chuỗi
 * hàng giả (để chứng minh luật không rỗng).
 */
type Nguon = { ten: string; sach: string };
const KIEM: Readonly<Record<Luat, (f: Nguon) => string[]>> = {
  KHAI_LAI_SCHEMA: (f) => {
    // Bỏ chú thích VÀ bỏ import: `import { xemMach, type FeedOut }` chứa đúng chuỗi
    // `type FeedOut` mà luật này đi tìm, dù đó là nhập khẩu chứ không phải khai báo.
    const than = boImport(f.sach);
    return TEN_SCHEMA.filter((ten) =>
      new RegExp(`\\b(interface|type|class|enum)\\s+${ten}\\b`).test(than),
    ).map((ten) => `${f.ten}: khai lại ${ten}`);
  },
  NHAC_MA_KHONG_IMPORT: (f) => {
    const da_nhap = tenDaNhap(f.sach);
    return TEN_SCHEMA.filter(
      (ten) => new RegExp(`\\b${ten}\\b`).test(f.sach) && !da_nhap.has(ten),
    ).map((ten) => `${f.ten}: dùng ${ten} mà không import từ @gikky/api-client`);
  },
  CLIENT_SINGLETON: (f) => {
    const ra: string[] = [];
    if (/from\s+"@gikky\/api-client\/client(\.gen)?"/.test(f.sach)) {
      ra.push(`${f.ten}: import thẳng \`client\` singleton`);
    }
    // Và không ai GỌI `setConfig` — đó là đường rò session của user A sang user B:
    // `client` là object dùng chung cả tiến trình Node.
    // Thông điệp cố ý KHÔNG viết `setConfig` kèm dấu ngoặc mở: chính dòng này nằm trong
    // `apps/web`, nên một chuỗi trông giống lời gọi ở đây là file tự tố cáo mình — và
    // cách chữa duy nhất còn lại sẽ là một giấy miễn trừ cho đúng cái luật chống rò
    // session mà W2 vừa dọn sạch giấy miễn trừ.
    if (/\bsetConfig\s*\(/.test(f.sach)) ra.push(`${f.ten}: gọi setConfig`);
    return ra;
  },
  THIEU_BASE_URL: (f) =>
    loiGoiApi(f.sach)
      .filter((g) => !coBaseUrl(g.doi_so, f.sach))
      .map((g) => `${f.ten}: ${g.ten}(…) thiếu baseUrl`),
  GOI_QUA_BIEN: (f) => {
    const than = boImport(f.sach);
    const ra: string[] = [];
    for (const ten of TEN_HAM_API) {
      for (const m of than.matchAll(new RegExp(`\\b${ten}\\b`, "g"))) {
        const sau = than.slice(m.index + ten.length);
        const truoc = than.slice(0, m.index);
        if (/^\s*\(/.test(sau)) continue;
        if (/\btypeof\s+$/.test(truoc)) continue;
        ra.push(`${f.ten}: ${ten} được nhắc tới mà không phải một lời gọi trực tiếp`);
      }
    }
    return ra;
  },
};

/** Vi phạm của một luật trên TOÀN BỘ `apps/web`, đã trừ đúng giấy miễn trừ của luật đó. */
function viPham(luat: Luat): string[] {
  const mien = TU_TRU[luat];
  return FILES.filter((f) => !(f.ten in mien)).flatMap((f) => KIEM[luat](f));
}

test("giấy miễn trừ không có dòng chết, và mỗi dòng phải THẬT SỰ cần", () => {
  // Hai chiều, và chiều thứ hai là chiều W2 vừa dạy: một miễn trừ rộng hơn nhu cầu là
  // một cái lỗ, không phải một sự rộng lượng. Ở đây "cần" được ĐO: chạy đúng luật đó
  // trên đúng file đó, và nó phải ra vi phạm. Không ra ⇒ dòng giấy phải bị xoá.
  const co_that = new Map(FILES.map((f) => [f.ten, f]));
  const chet: string[] = [];
  const thua: string[] = [];
  for (const luat of Object.keys(TU_TRU) as Luat[]) {
    for (const ten of Object.keys(TU_TRU[luat])) {
      const f = co_that.get(ten);
      if (f === undefined) {
        chet.push(`${luat} → ${ten} (file không tồn tại)`);
      } else if (KIEM[luat](f).length === 0) {
        thua.push(`${luat} → ${ten} (file không vi phạm luật này)`);
      }
    }
  }
  expect(chet).toEqual([]);
  expect(thua).toEqual([]);
});

test("W2 — hai luật chống rò session KHÔNG có giấy miễn trừ nào", () => {
  // Ghim thẳng cái chốt của W2 thay vì để nó là một dòng chú thích: thêm một file vào
  // hai bảng này là mở lại đúng cửa mà lượt vá 2 vừa đóng, và nó phải đỏ ngay tại đây
  // chứ không phải ba tháng sau, lúc một trang mới quên `baseUrl`.
  expect(Object.keys(TU_TRU.CLIENT_SINGLETON)).toEqual([]);
  expect(Object.keys(TU_TRU.THIEU_BASE_URL)).toEqual([]);
});

test("đọc được danh sách schema của API (không có thì hàng rào rỗng)", () => {
  expect(TEN_SCHEMA.length).toBeGreaterThan(10);
  expect(TEN_SCHEMA).toContain("MachChiTietOut");
  expect(TEN_SCHEMA).toContain("BinhLuanOut");
  expect(FILES.length).toBeGreaterThan(15);
});

test("không file nào ở apps/web tự khai lại một schema của API", () => {
  expect(viPham("KHAI_LAI_SCHEMA")).toEqual([]);
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
  expect(viPham("NHAC_MA_KHONG_IMPORT")).toEqual([]);
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
  expect(viPham("CLIENT_SINGLETON")).toEqual([]);
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

/** Thân của object literal khởi tạo hằng `ten`, hoặc `null` nếu không thấy.
 *
 * ⚠ **Đếm ngoặc CÂN BẰNG, không phải `\{([^{}]*)\}`** *(sửa 2026-08-23, mảng B2)*. Bản cũ
 * dừng ở tầng ngoặc thứ nhất, nên nó **mù** với đúng hình dạng Phase 3 cần:
 *
 *     const CHUNG_ISR = { baseUrl: API_ORIGIN, next: { revalidate: 3600 } } as const;
 *
 * `[^{}]*` không vượt qua được dấu `{` của `next:`, regex không khớp gì, `khai === null`,
 * và mọi lời gọi `{ ...CHUNG_ISR, … }` bị báo **thiếu baseUrl**. Hỏng về phía an toàn —
 * nhưng nó chặn cứng cơ chế ISR của PLAN 8.4, và hai lối thoát còn lại đều xấu: một dòng
 * giấy miễn trừ cho đúng cái luật W2 vừa dọn sạch giấy, hoặc chép `baseUrl:` vào từng lời
 * gọi để chiều một hàng rào đọc kém. Nên hàng rào học đọc ngoặc lồng.
 *
 * **Luật KHÔNG bị nới**: hàm vẫn chỉ đi theo đúng MỘT lớp spread của một hằng khai bằng
 * object literal ở tầng module, và vẫn chỉ nhận `baseUrl` xuất hiện trong thân hằng đó.
 * Thứ đổi là nó đọc được cả thân có ngoặc lồng, chứ không phải nó chấp nhận thêm ca nào.
 */
function thanHang(ten: string, than: string): string | null {
  const dau = new RegExp(`\\b(?:const|let|var)\\s+${ten}\\s*=\\s*\\{`).exec(than);
  if (dau === null) return null;
  const mo = dau.index + dau[0].length - 1;
  let sau = 0;
  for (let i = mo; i < than.length; i += 1) {
    if (than[i] === "{") sau += 1;
    else if (than[i] === "}") {
      sau -= 1;
      if (sau === 0) return than.slice(mo + 1, i);
    }
  }
  return null;
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
    const khai = thanHang(m[1], than);
    if (khai !== null && /\bbaseUrl\b/.test(khai)) return true;
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
  //
  // Vá W2 (lượt vá 2): luật này quét **mọi** file, không trừ file nào. Trước đó
  // `TU_TRU_THEO_FILE` lọc cả file khỏi cả sáu luật, nên hai lời gọi thiếu `baseUrl`
  // thêm vào `khong-ghi-cung-sub.spec.ts` cho `120 passed, 0 failed`.
  expect(viPham("THIEU_BASE_URL")).toEqual([]);
});

test("luật trên có quét trúng lời gọi THẬT ở MỌI cửa (không quét vào chỗ trống)", () => {
  // Đây là vế chống rỗng. Nếu `loiGoiApi` hỏng và trả về mảng rỗng thì bài trên vẫn
  // xanh, y hệt cách bản cũ xanh.
  //
  // Danh sách viết cứng chứ không đếm tổng: **mỗi file mới gọi API là một chỗ mới có thể
  // rò session**, nên nó phải nằm trong diff và phải được nhìn. Phase 2 thêm bốn file —
  // tất cả đều là **client component chạy trong trình duyệt**, nên `baseUrl` của chúng là
  // chuỗi RỖNG (same-origin, đi qua `rewrites`) chứ không phải `API_ORIGIN`: cookie phiên
  // và cookie CSRF là cookie của origin đang mở, một lời gọi thẳng sang `localhost:8000`
  // từ trình duyệt là cross-origin và không mang cookie nào.
  const theo_file = new Map<string, number>();
  for (const f of FILES) {
    const n = loiGoiApi(f.sach).length;
    if (n > 0) theo_file.set(f.ten, n);
  }
  //
  // Danh sách xếp theo A→Z (nó là kết quả của `.sort()`), nên **không nhóm theo phase
  // được**; phase ghi ở cuối từng dòng. Bốn dòng của mảng B2 (Phase 3) đều là client
  // component chạy trong TRÌNH DUYỆT: `baseUrl` của chúng là chuỗi RỖNG (same-origin qua
  // `rewrites`), không phải `API_ORIGIN` — cookie phiên là cookie của origin đang mở.
  expect([...theo_file.keys()].sort()).toEqual([
    "app/chan-doan/health-same-origin.tsx",
    "app/chan-doan/page.tsx",
    "components/chuong.tsx", // B2 — chuông thông báo, poll 60s
    "components/composer.tsx", // Phase 2
    "components/cot-vote.tsx", // Phase 2
    "components/form-dang-mach.tsx", // form ghi
    "components/hanh-dong-binh-luan.tsx", // form ghi
    "components/hanh-dong-moc.tsx", // form ghi
    "components/khoi-chu-mach.tsx", // form ghi
    "components/nut-theo-mach.tsx", // B2 — theo / bỏ theo mạch
    "components/phien.tsx", // Phase 2
    // B2 — cửa PER-USER duy nhất của trang mạch (`/machs/{id}/me` + `/seen`). Nó nằm
    // trong danh sách này để mọi lượt thêm một chỗ đọc dữ liệu per-user đều phải qua diff.
    "components/trang-thai-toi.tsx",
    "components/trich.tsx", // B2 — trích / gỡ trích vào sổ
    // Phase 5 — hai cửa ảnh (`taiAnhMoc`, `xoaAnhMoc`). Đây là file DUY NHẤT của Phase 5
    // gọi API: ô chọn ảnh (`components/chon-anh.tsx`) và ba form ghi đi qua
    // `taiAnhLanLuot`/`goAnh` ở đây, nên chúng không xuất hiện trong danh sách này.
    //
    // Hai lời gọi ấy là **multipart**, và đó là chỗ chúng khác mọi dòng còn lại: chúng
    // truyền `headerGhiFile()` chứ không `headerGhi()`. `headerGhi` đặt
    // `Content-Type: application/json`, thứ ghi đè lên `Content-Type` mà `FormData` phải
    // tự sinh kèm `boundary` — server nhận một thân không parse được. `baseUrl` thì vẫn
    // là `GOC_TRINH_DUYET` (rỗng, same-origin) như mọi lời gọi trong trình duyệt.
    "lib/anh.ts",
    "lib/api.ts",
  ]);
  expect(theo_file.get("lib/api.ts")).toBeGreaterThanOrEqual(6);
});

/** `"xemMach"` **ghép từ hai mảnh, cố ý** *(W2, lượt vá 2)*.
 *
 * Hàng giả dưới đây là một chuỗi TRÔNG NHƯ lời gọi API thiếu `baseUrl` — mà chính file
 * này nằm trong `apps/web`, nên viết nó liền một mạch là tự nộp mình cho luật
 * `THIEU_BASE_URL`. Bản trước xử bằng cách miễn trừ cả file khỏi cả sáu luật, và cái giá
 * đo được là hàng rào chống rò session mù với một file thật. Ghép chuỗi rẻ hơn nhiều so
 * với một dòng giấy phép, và nó không mở cửa cho ai khác.
 */
const XEM_MACH = "xem" + "Mach";

test("luật trên bắt được hàng giả (lời gọi thiếu baseUrl)", () => {
  const gia = `const r = await ${XEM_MACH}({ path: { mach_id: 1 } });`;
  const goi = loiGoiApi(gia);
  expect(goi).toHaveLength(1);
  expect(coBaseUrl(goi[0].doi_so, gia)).toBe(false);
  // …và KHÔNG bắt nhầm lời gọi đi qua một lớp spread hằng số.
  const that = `const C = { baseUrl: X };\nconst r = await ${XEM_MACH}({ ...C, path: {} });`;
  expect(coBaseUrl(loiGoiApi(that)[0].doi_so, that)).toBe(true);
});

test("coBaseUrl đọc được hằng có ngoặc LỒNG (`next: { revalidate }`)", () => {
  // Ca thật của Phase 3, và là cái bẫy `plans/2026-08-23-mang-b1-backend-phase-3.md` §5
  // đo trước: bản `\{([^{}]*)\}` không khớp gì ở đây ⇒ báo vi phạm cho một lời gọi ĐÚNG.
  const long =
    `const C = { baseUrl: X, next: { revalidate: 3600 } } as const;\n` +
    `const r = await ${XEM_MACH}({ ...C, path: { mach_id: 1 } });`;
  expect(coBaseUrl(loiGoiApi(long)[0].doi_so, long)).toBe(true);

  // Ngoặc lồng KHÔNG được biến thành cửa cho một hằng thật sự thiếu `baseUrl`: hằng dưới
  // đây có `baseUrl` nằm trong một hằng KHÁC, và hàm không được vin vào đó.
  const thieu =
    `const D = { baseUrl: X };\n` +
    `const C = { next: { revalidate: 3600 } } as const;\n` +
    `const r = await ${XEM_MACH}({ ...C, path: { mach_id: 1 } });`;
  expect(coBaseUrl(loiGoiApi(thieu)[0].doi_so, thieu)).toBe(false);
});

test("thanHang cắt đúng thân hằng, không tràn sang câu lệnh sau", () => {
  const nguon =
    `const A = { baseUrl: X, next: { revalidate: 1 } };\n` +
    `const B = { cache: "no-store" };\n`;
  expect(thanHang("A", nguon)).toBe(` baseUrl: X, next: { revalidate: 1 } `);
  expect(thanHang("B", nguon)).toBe(` cache: "no-store" `);
  expect(thanHang("KhongCo", nguon)).toBeNull();
  // Ngoặc không đóng ⇒ `null`, tức "không tìm thấy baseUrl" ⇒ hỏng về phía BÁO VI PHẠM.
  expect(thanHang("C", "const C = { baseUrl: X")).toBeNull();
});

test("hai mảnh ghép ra ĐÚNG một tên hàm API có thật (chống hàng giả mục ruỗng)", () => {
  // Nếu `XEM_MACH` gõ sai thì `loiGoiApi` không tìm thấy gì, `goi` rỗng, và bài trên đỏ
  // ở `toHaveLength(1)` — nhưng thông điệp sẽ nói về `loiGoiApi` chứ không nói về chỗ
  // sai thật. Một dòng ở đây tiết kiệm nửa giờ đọc nhầm.
  expect(TEN_HAM_API).toContain(XEM_MACH);
});

/** `enum` của một tham số query, đọc thẳng `openapi.json`. `null` nếu không có. */
function enumThamSo(duong_dan: string, ten: string): string[] | null {
  const tham_so = OPENAPI.paths?.[duong_dan]?.get?.parameters ?? [];
  const s = tham_so.find((p) => p.name === ten)?.schema;
  return Array.isArray(s?.enum) ? (s.enum as string[]) : null;
}

/** W9 — **frontend không được khai lại tập giá trị của một enum API**.
 *
 * Luật này bổ sung cho `KHAI_LAI_SCHEMA`, thứ chỉ soi **TÊN** schema. `KHOANG_FEED` và
 * `SORT_API` từng là hai mảng/union gõ tay (`["ngay","tuan","thang","tat_ca"]`,
 * `"tu_nhien" | "nhieu_diem"`) — bản sao thứ hai của hợp đồng API mà không mang tên
 * schema nào, nên hàng rào cũ đi qua mà không thấy gì. PLAN 8.3 và `gikky-net/CLAUDE.md`
 * cấm đúng loài đó.
 *
 * Bài đo so **giá trị lúc chạy** với `openapi.json`, không grep mã nguồn: nó đọc hợp
 * đồng, nên nó đúng dù frontend viết bằng mảng, union, `Object.keys`, hay gì khác.
 * Đi cả hai chiều — API thêm một giá trị mà UI không bày ra cửa nào cũng là hỏng, chỉ
 * theo chiều ngược lại.
 */
test("W9 — `khoang` mà UI bày ra khớp ĐÚNG enum trong openapi.json", () => {
  const cho_phep = enumThamSo("/api/v1/feeds/moi", "khoang");
  expect(cho_phep, "`khoang` không còn là enum ⇒ Django lại khai `str` trơn").not.toBeNull();
  expect([...KHOANG_FEED].sort()).toEqual([...cho_phep!].sort());

  // Hai feed phải cùng một tập — lấy một cửa làm nguồn ở `lib/api.ts` chỉ đúng khi thế.
  expect(enumThamSo("/api/v1/feeds/dang-dien-ra", "khoang")).toEqual(cho_phep);
});

test("W9 — `sort` mà UI gửi lên khớp ĐÚNG enum trong openapi.json", () => {
  const cho_phep = enumThamSo("/api/v1/feeds/moi", "sort");
  expect(cho_phep, "`sort` không còn là enum ⇒ Django lại khai `str` trơn").not.toBeNull();
  expect([...new Set(Object.values(SORT_API))].sort()).toEqual([...cho_phep!].sort());
  expect(enumThamSo("/api/v1/feeds/dang-dien-ra", "sort")).toEqual(cho_phep);
});

test("W9 — hai bài trên KHÔNG nghiệm đúng với mọi thứ (chống hàng rào rỗng)", () => {
  // `enumThamSo` trả `null` cho tham số không phải enum, và cả hai bài trên đỏ ở
  // `not.toBeNull()` trong ca đó — đây là chỗ chứng minh nhánh ấy có thật.
  expect(enumThamSo("/api/v1/feeds/moi", "cursor")).toBeNull();
  expect(enumThamSo("/api/v1/feeds/moi", "khong-co-tham-so-nay")).toBeNull();
  expect(KHOANG_FEED.length).toBeGreaterThan(1);
});

test("hàm API không được đi qua biến trung gian — hàng rào tìm callee theo TÊN", () => {
  // `const ham = tab === "moi" ? lietKeFeedMoi : lietKeFeedDangDienRa; ham({…})` không
  // sai `baseUrl`, nhưng nó là cái lỗ khiến bài đo trên không thể nói "mọi": callee lúc
  // gọi là `ham`, không phải một tên hàm API. Cấm luôn kiểu viết đó thì chữ "mọi" mới
  // đúng. Hai ngoại lệ hợp lệ: dòng `import`, và `typeof <ten>` (dùng ở TẦNG KIỂU, không
  // sinh ra lời gọi nào lúc chạy — `app/chan-doan/health-text.ts`).
  expect(viPham("GOI_QUA_BIEN")).toEqual([]);
});
