import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { expect, test } from "@playwright/test";

import { OgThe } from "../../components/og-the";
import {
  KHUNG_OG,
  KIEU_OG,
  MAU_OG,
  TEN_FILE_FONT,
  THU_MUC_FONT,
  TOKEN_CUA_MAU,
  TRAN_O_SPINE,
  catChu,
  docMatChu,
  ghepDongPhu,
  ogMach,
  ogSub,
  ogTrangChu,
} from "../../lib/og";
import { boChuThich } from "./quet";
import { coGlyph, laTtf } from "./ttf";

const WEB = resolve(__dirname, "..", "..");

/** Hàng rào cho ảnh OG (Phase 6 — PLAN mục 10: *"OG card tự sinh mỗi mạch … ảnh để user
 * khoe lên Facebook, kênh phát tán chính"*).
 *
 * Ba lớp, và lớp thứ ba là lớp không thay được bằng đọc mã:
 *
 * 1. **nội dung chữ** — `lib/og.ts` là hàm thuần, so trực tiếp;
 * 2. **vật liệu** — ba file TTF phải có thật, phải là sfnt, và phải có glyph tiếng Việt.
 *    Đây là ca hỏng nguy hiểm nhất và im lặng nhất: satori KHÔNG báo lỗi khi thiếu glyph,
 *    nó vẽ ô vuông rồi trả một PNG hợp lệ. Bản `latin` của Noto Sans (mặc định của
 *    `next/og`) làm mọi chữ có dấu thành ô vuông mà không gì đỏ;
 * 3. **render THẬT ra PNG** — `ImageResponse` chạy được ngay trong `e2e:don-vi`: không
 *    trình duyệt, không server, không cổng, không DB. Nhờ vậy ba bài "đổi dữ liệu ⇒ ảnh
 *    phải khác" dưới đây là bài đo HÀNH VI, không phải phép đọc mã: nếu ai bỏ `{tieuDe}`
 *    khỏi `components/og-the.tsx` thì hai ảnh khác tiêu đề ra **byte y hệt** ⇒ ĐỎ.
 */

/* ---- Lớp 1: nội dung chữ --------------------------------------------------- */

const MACH_MAU = {
  title: "Nhật ký lệnh HPG — mua từ đáy tháng 3",
  ket_qua: "+18.2% · 163 ngày",
  status: "closed",
  entry_count: 9,
  sub: { slug: "chung-khoan", ten: "Chứng khoán VN" },
  author: { username: "ba_muoi_phien" },
} as const;

test("ogMach mang đủ ba thứ hợp đồng đòi: tiêu đề mạch · tên sub · số mốc", () => {
  const d = ogMach(MACH_MAU);
  expect(d.tieuDe).toBe(MACH_MAU.title);
  expect(d.nhan).toContain("s/chung-khoan");
  expect(d.nhan).toContain("Chứng khoán VN");
  expect(d.dongPhu).toContain("9 mốc");
  expect(d.dongPhu).toContain("+18.2%");
  expect(d.dongPhu).toContain("u/ba_muoi_phien");
});

test("mạch đang mở KHÔNG mang nhãn đóng sổ, mạch đã đóng thì có", () => {
  expect(ogMach(MACH_MAU).dongSo).toBe(true);
  expect(ogMach({ ...MACH_MAU, status: "open" }).dongSo).toBe(false);
});

test("spine: post thường không có spine, mạch dài bị kẹp về trần", () => {
  // 1 ô đơn độc trên một post thường chỉ gây hiểu nhầm "mạch mới có 1/N mốc".
  expect(ogMach({ ...MACH_MAU, entry_count: 1 }).soOSpine).toBe(0);
  expect(ogMach({ ...MACH_MAU, entry_count: 5 }).soOSpine).toBe(5);
  expect(ogMach({ ...MACH_MAU, entry_count: 400 }).soOSpine).toBe(TRAN_O_SPINE);
  // …và con SỐ mốc thật vẫn phải nói ra ở dòng chân, không bị cái trần kia làm sai.
  expect(ogMach({ ...MACH_MAU, entry_count: 400 }).dongPhu).toContain("400 mốc");
});

test("mạch chưa đóng sổ (ket_qua null) không để lại dấu ` · ` mồ côi", () => {
  const d = ogMach({ ...MACH_MAU, ket_qua: null, status: "open" });
  expect(d.dongPhu.startsWith("9 mốc")).toBe(true);
  expect(d.dongPhu).not.toContain(" ·  · ");
});

test("catChu cắt theo KÝ TỰ, không cắt giữa một cặp thay thế UTF-16", () => {
  // `"🔥".length === 2`: `slice` cắt giữa cặp cho ra một nửa ký tự hỏng.
  const co_emoji = `${"🔥".repeat(5)}xyz`;
  const cat = catChu(co_emoji, 4);
  expect(Array.from(cat)).toHaveLength(4);
  expect(cat.endsWith("…")).toBe(true);
  expect(cat).not.toContain("�");
  // Chuỗi ngắn thì không thêm dấu gì, và khoảng trắng bị nén (satori không wrap giúp).
  expect(catChu("  a   b  ", 40)).toBe("a b");
});

test("ghepDongPhu bỏ mảnh rỗng thay vì để hai dấu chấm giữa dòng", () => {
  expect(ghepDongPhu(["a", null, "", undefined, "  ", "b"])).toBe("a · b");
  expect(ghepDongPhu([null, undefined])).toBe("");
});

test("ogSub và ogTrangChu đều có tiêu đề không rỗng", () => {
  const sub = ogSub({ slug: "crypto", ten: "Crypto", mo_ta: "Bàn về crypto", so_mach: 12 });
  expect(sub.nhan).toBe("s/crypto");
  expect(sub.tieuDe).toBe("Crypto");
  expect(sub.dongPhu).toContain("12 mạch");
  expect(ogTrangChu().tieuDe.length).toBeGreaterThan(10);
});

/* ---- Lớp 1b: bảng màu không được trôi khỏi globals.css --------------------- */

/** Giá trị của các `--token: …` trong khối `:root { … }` ĐẦU TIÊN của `globals.css` —
 * tức bản SÁNG. Ảnh OG là PNG tĩnh, nó không biết theme của người xem. */
function tokenSang(): Map<string, string> {
  const css = readFileSync(resolve(WEB, "app/globals.css"), "utf8");
  const khoi = /:root\s*\{([^{}]*)\}/.exec(boChuThich(css));
  if (khoi === null) throw new Error("globals.css không còn khối `:root { … }`");
  const ra = new Map<string, string>();
  for (const m of khoi[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    ra.set(m[1], m[2].trim().toLowerCase());
  }
  return ra;
}

test("MAU_OG khớp ĐÚNG token tương ứng trong globals.css", () => {
  // satori không giải được `var(--ink)`, nên `MAU_OG` buộc phải là một bản SAO — và bản
  // sao thì trôi. Đây là chốt chặn: đổi `--ink` trong globals.css mà không đổi ở đây là
  // ảnh OG dùng màu của tháng trước, không gì đỏ.
  const token = tokenSang();
  expect(token.size).toBeGreaterThan(10);
  for (const [vai, ma] of Object.entries(MAU_OG)) {
    const ten_token = TOKEN_CUA_MAU[vai as keyof typeof MAU_OG];
    expect(token.has(ten_token), `globals.css không còn ${ten_token}`).toBe(true);
    expect(token.get(ten_token), `${vai} lệch khỏi ${ten_token}`).toBe(ma.toLowerCase());
  }
});

test("khổ ảnh và content-type đúng chuẩn OG", () => {
  expect(KHUNG_OG).toEqual({ width: 1200, height: 630 });
  expect(KIEU_OG).toBe("image/png");
});

/* ---- Lớp 2: ba file TTF ---------------------------------------------------- */

/** Mã Unicode chỉ tiếng Việt mới cần. `ế` U+1EBF và `ộ` U+1ED9 nằm ở Latin Extended
 * Additional — đúng khối mà bản font `latin` KHÔNG có. */
const CHU_VIET = { "ế": 0x1ebf, "ộ": 0x1ed9, "ữ": 0x1eef, "đ": 0x0111 };

test("ba file font có thật, là sfnt, và có glyph tiếng Việt", () => {
  const ten = Object.values(TEN_FILE_FONT);
  expect(ten).toHaveLength(3);
  for (const t of ten) {
    const b = readFileSync(resolve(THU_MUC_FONT, t));
    expect(b.length, `${t} quá nhỏ để là một font đủ chữ`).toBeGreaterThan(50_000);
    expect(laTtf(b), `${t} không phải sfnt — CRLF của git đã ăn file?`).toBe(true);
    for (const [chu, ma] of Object.entries(CHU_VIET)) {
      expect(coGlyph(b, ma), `${t} thiếu glyph "${chu}" ⇒ ảnh OG ra ô vuông`).toBe(true);
    }
  }
});

test("luật glyph KHÔNG nghiệm đúng với mọi mã (chống hàng rào rỗng)", () => {
  // Nếu `coGlyph` trả `true` với mọi thứ thì bài trên xanh kể cả khi font là bản latin.
  // Ba mặt chữ này đều không có chữ Hán, và đó là chỗ chứng minh hàm biết nói "không".
  const b = readFileSync(resolve(THU_MUC_FONT, TEN_FILE_FONT.ui));
  expect(coGlyph(b, 0x4e2d)).toBe(false);
});

test("docMatChu trả ba mặt chữ của PLAN 9.1 và có bộ đệm", async () => {
  const a = await docMatChu();
  expect(a.map((f) => f.name).sort()).toEqual([
    "Be Vietnam Pro",
    "IBM Plex Mono",
    "Newsreader",
  ]);
  for (const f of a) expect(f.data.byteLength).toBeGreaterThan(50_000);
  // Đọc lại phải ra CÙNG object: ba file ≈ 360 KB, đọc lại mỗi request là ba lần chạm đĩa
  // cho một ảnh mà CDN sẽ cache.
  expect(await docMatChu()).toBe(a);
});

/* ---- Lớp 3: render thật ra PNG -------------------------------------------- */

async function ve(du_lieu: Parameters<typeof OgThe>[0]["du_lieu"]): Promise<Buffer> {
  // `next/og.js` chứ không `next/og`: bộ chạy Playwright là Node thuần, nó phân giải
  // `exports` của package theo đúng chuẩn ESM và `next/og` không có entry cho nó.
  const { ImageResponse } = await import("next/og.js");
  const res = new ImageResponse(createElement(OgThe, { du_lieu }), {
    ...KHUNG_OG,
    fonts: await docMatChu(),
  });
  return Buffer.from(await res.arrayBuffer());
}

const CHU_KY_PNG = "89504e470d0a1a0a";

test("ba khuôn ảnh đều render ra PNG thật", async () => {
  for (const d of [ogTrangChu(), ogMach(MACH_MAU), ogSub({ slug: "crypto", ten: "Crypto", mo_ta: "Bàn về crypto", so_mach: 12 })]) {
    const png = await ve(d);
    expect(png.subarray(0, 8).toString("hex")).toBe(CHU_KY_PNG);
    // Một PNG 1200×630 gần như trắng trơn vẫn > 1 KB; ngưỡng này bắt ca "render ra khung
    // rỗng vì mọi chữ đã biến mất".
    expect(png.length).toBeGreaterThan(10_000);
  }
});

test("ĐỔI TIÊU ĐỀ ⇒ ảnh phải KHÁC (thiếu tiêu đề là ảnh y hệt)", async () => {
  // Đây là bài chống mutant của cả nhóm: bỏ `{du_lieu.tieuDe}` khỏi `og-the.tsx` thì hai
  // ảnh dưới đây ra byte y hệt nhau ⇒ ĐỎ. Không có nó thì "OG image có tiêu đề mạch" chỉ
  // là một câu trong docstring — mọi bài đo khác vẫn xanh với một cái khung trống.
  const a = await ve(ogMach({ ...MACH_MAU, title: "Nhật ký lệnh HPG" }));
  const b = await ve(ogMach({ ...MACH_MAU, title: "Nhật ký lệnh VNM" }));
  expect(a.equals(b)).toBe(false);
});

test("ĐỔI TÊN SUB và ĐỔI SỐ MỐC ⇒ ảnh phải KHÁC", async () => {
  const goc = await ve(ogMach(MACH_MAU));
  const khac_sub = await ve(
    ogMach({ ...MACH_MAU, sub: { slug: "crypto", ten: "Crypto" } }),
  );
  const khac_so_moc = await ve(ogMach({ ...MACH_MAU, entry_count: 4 }));
  expect(goc.equals(khac_sub)).toBe(false);
  expect(goc.equals(khac_so_moc)).toBe(false);
});

test("cùng dữ liệu ⇒ cùng byte (nếu không, ba bài trên nghiệm đúng vô nghĩa)", async () => {
  // Vế chống rỗng: nếu `ImageResponse` sinh ra byte khác nhau mỗi lần (timestamp trong
  // chunk PNG chẳng hạn) thì "ảnh phải KHÁC" luôn đúng và không đo được gì.
  const a = await ve(ogMach(MACH_MAU));
  const b = await ve(ogMach(MACH_MAU));
  expect(a.equals(b)).toBe(true);
});

/* ---- Lớp 4: ba route phải TRUYỀN font vào ImageResponse -------------------- */

const ROUTE_OG = [
  "app/opengraph-image.tsx",
  "app/m/[slugId]/opengraph-image.tsx",
  "app/s/[sub]/opengraph-image.tsx",
];

test("mọi route ảnh OG đều truyền `fonts` và khai đủ size/contentType/alt", () => {
  // `fonts` thiếu thì `next/og` lặng lẽ dùng Noto Sans **latin** ⇒ chữ có dấu ra ô vuông,
  // mà lớp 3 vẫn xanh (ảnh vẫn khác nhau khi đổi tiêu đề, chỉ là toàn ô vuông). Đây là
  // lớp duy nhất bắt được ca đó, nên nó là phép đọc mã có chủ đích chứ không phải chỗ
  // lười.
  for (const ten of ROUTE_OG) {
    const sach = boChuThich(readFileSync(resolve(WEB, ten), "utf8"));
    expect(sach, `${ten} không truyền fonts`).toMatch(/fonts:\s*await\s+docMatChu\(\)/);
    expect(sach, `${ten} thiếu export size`).toMatch(/export const size\b/);
    expect(sach, `${ten} thiếu export contentType`).toMatch(/export const contentType\b/);
    expect(sach, `${ten} thiếu export alt`).toMatch(/export const alt\b/);
  }
});
