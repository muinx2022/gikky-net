import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import type { BinhLuanOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { chonQuanDiem } from "../../lib/chu-de";
import { ID_O_SOAN_BINH_LUAN } from "../../lib/khan-dai";
import { tenHienThi } from "../../lib/ten-hien-thi";
import { duongDanKhanDai, duongDanVietBinhLuan } from "../../lib/url";

/** Đợt A của plan `2026-11-11-thong-nhat-giao-dien-toan-site.md` (§4.5 khối chủ đề, §4.6 tên hiển
 * thị). Hàm THUẦN + hàng rào đọc mã nguồn: không mạng, không DB, không cổng — chạy song song được
 * (`pnpm e2e:don-vi`). Phần DOM thật nằm ở `e2e/trang-chu-v2.spec.ts` (nhóm B2/B7). */

const WEB = resolve(__dirname, "..", "..");
const doc = (duong_dan: string) => readFileSync(resolve(WEB, duong_dan), "utf8");
const boChuThich = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function bl(id: number, over: Partial<BinhLuanOut> = {}): BinhLuanOut {
  return {
    id,
    depth: 1,
    trang_thai: "binh_thuong",
    score: 0,
    created_at: "2026-11-11T07:50:00Z",
    body: `Bình luận ${id}`,
    body_dinh_dang: "markdown",
    ...over,
  } as BinhLuanOut;
}

/* ---------------------------------------------------------------- chonQuanDiem -- */

test("quan điểm: toàn điểm 0 ⇒ chế độ 'moi', MỚI VIẾT nhất trước (không theo thứ tự API)", () => {
  const ds = [
    bl(1, { created_at: "2026-11-11T07:50:00Z" }),
    bl(2, { created_at: "2026-11-11T09:00:00Z" }),
    bl(3, { created_at: "2026-11-10T20:00:00Z" }),
  ];
  const kq = chonQuanDiem(ds, ds, 3);
  expect(kq.kieu).toBe("moi");
  expect(kq.muc.map((b) => b.id)).toEqual([2, 1, 3]);
  expect(chonQuanDiem(ds, ds, 2).muc.map((b) => b.id), "cắt ở toiDa SAU khi sắp").toEqual([2, 1]);
});

test("quan điểm: hoà thời điểm ⇒ id lớn trước; mốc hỏng xếp cuối, không ném", () => {
  const cung_luc = "2026-11-11T07:50:00Z";
  const ds = [
    bl(1, { created_at: cung_luc }),
    bl(2, { created_at: "không phải ngày" }),
    bl(3, { created_at: cung_luc }),
  ];
  const kq = chonQuanDiem(ds, ds, 3);
  expect(kq.kieu).toBe("moi");
  expect(kq.muc.map((b) => b.id)).toEqual([3, 1, 2]);
});

test("quan điểm: có ít nhất MỘT điểm dương ⇒ 'noi_bat', điểm cao nhất trước, điểm 0 đứng sau", () => {
  const ds = [
    bl(1, { score: 0, created_at: "2026-11-11T12:00:00Z" }),
    bl(2, { score: 3 }),
    bl(3, { score: 1 }),
    bl(4, { score: 0 }),
  ];
  const kq = chonQuanDiem(ds, ds, 3);
  expect(kq.kieu).toBe("noi_bat");
  expect(kq.muc.map((b) => b.id)).toEqual([2, 3, 1]);
});

test("quan điểm: một bình luận điểm dương nhưng là REPLY / bị ẩn thì KHÔNG đủ để thành 'noi_bat'", () => {
  const ds = [
    bl(1, { score: 0, created_at: "2026-11-11T10:00:00Z" }),
    bl(2, { score: 9, depth: 2 }),
    bl(3, { score: 9, trang_thai: "da_an" }),
  ];
  const kq = chonQuanDiem(ds, ds, 3);
  expect(kq.kieu).toBe("moi");
  expect(kq.muc.map((b) => b.id)).toEqual([1]);
});

test("quan điểm: điểm âm bị loại; chỉ có điểm âm hoặc rỗng ⇒ không quan điểm nào", () => {
  const ds_am = [bl(1, { score: -2 }), bl(2, { score: -1 })];
  const am = chonQuanDiem(ds_am, ds_am, 3);
  expect(am.muc).toEqual([]);
  expect(chonQuanDiem([], [], 3)).toEqual({ kieu: "moi", muc: [] });
  // Điểm âm không chen vào danh sách 'moi' dù còn chỗ.
  const ds_lan = [bl(1, { score: 0 }), bl(2, { score: -1 })];
  expect(chonQuanDiem(ds_lan, ds_lan, 3).muc.map((b) => b.id)).toEqual([1]);
});

test("quan điểm: không đột biến mảng gốc", () => {
  const ds = [
    bl(1, { created_at: "2026-11-10T00:00:00Z" }),
    bl(2, { created_at: "2026-11-11T00:00:00Z" }),
  ];
  const truoc = ds.map((b) => b.id);
  chonQuanDiem(ds, ds, 3);
  expect(ds.map((b) => b.id)).toEqual(truoc);
});

test("quan điểm mới: nguồn hay_nhat toàn 0 điểm và KHÔNG chứa bình luận mới nhất ⇒ lấy đúng cái mới nhất từ nguồn moi_nhat", () => {
  // `sort=hay_nhat` khi chưa ai vote trả các bình luận CŨ NHẤT trước (hoà điểm ⇒ created_at tăng dần).
  const hay_nhat = [
    bl(1, { created_at: "2026-11-01T00:00:00Z" }),
    bl(2, { created_at: "2026-11-02T00:00:00Z" }),
    bl(3, { created_at: "2026-11-03T00:00:00Z" }),
  ];
  const moi_nhat = [
    bl(9, { created_at: "2026-11-11T09:00:00Z" }),
    bl(8, { created_at: "2026-11-10T09:00:00Z" }),
    bl(7, { created_at: "2026-11-09T09:00:00Z" }),
    bl(6, { created_at: "2026-11-08T09:00:00Z", trang_thai: "da_xoa" }), // bia mộ — loại
  ];
  const kq = chonQuanDiem(hay_nhat, moi_nhat, 3);
  expect(kq.kieu).toBe("moi");
  expect(kq.muc.map((b) => b.id), "lấy từ nguồn moi_nhat, không từ 50 cái cũ nhất").toEqual([9, 8, 7]);
});

test("quan điểm nổi bật lấy từ nguồn hay_nhat, nguồn moi_nhat không được xen vào", () => {
  const hay_nhat = [bl(1, { score: 4 }), bl(2, { score: 1 }), bl(3, { score: 0 })];
  const moi_nhat = [bl(9, { score: 0, created_at: "2026-11-11T09:00:00Z" })];
  const kq = chonQuanDiem(hay_nhat, moi_nhat, 3);
  expect(kq.kieu).toBe("noi_bat");
  expect(kq.muc.map((b) => b.id)).toEqual([1, 2, 3]);
  // Nguồn moi_nhat rỗng (lời gọi 404 / chưa có) mà hay_nhat toàn 0 ⇒ 'moi' rỗng, không bịa từ hay_nhat.
  expect(chonQuanDiem([bl(1)], [], 3)).toEqual({ kieu: "moi", muc: [] });
});

/* ----------------------------------------------------------------- tenHienThi -- */

test("tenHienThi: có display_name thì in nó, kể cả khi username khác", () => {
  expect(tenHienThi({ username: "muinx", display_name: "Mùi" })).toBe("Mùi");
});

test("tenHienThi: không có display_name (null / undefined / rỗng / toàn khoảng trắng) ⇒ username TRẦN, không 'u/'", () => {
  for (const display_name of [null, undefined, "", "   "]) {
    const ten = tenHienThi({ username: "ngxuanmui", display_name });
    expect(ten).toBe("ngxuanmui");
    expect(ten.startsWith("u/")).toBe(false);
  }
  expect(tenHienThi({ username: "ai_do" }), "thiếu hẳn khoá display_name").toBe("ai_do");
});

test("tenHienThi: author null/undefined ⇒ chuỗi `khiKhongCo` do chỗ gọi truyền (mặc định rỗng)", () => {
  expect(tenHienThi(null)).toBe("");
  expect(tenHienThi(undefined)).toBe("");
  expect(tenHienThi(null, "?")).toBe("?");
  expect(tenHienThi({ username: "", display_name: null }, "?")).toBe("?");
  // `khiKhongCo` KHÔNG che display_name / username có thật.
  expect(tenHienThi({ username: "a", display_name: "B" }, "?")).toBe("B");
  expect(tenHienThi({ username: "a", display_name: null }, "?")).toBe("a");
});

/* -------------------------------------------------------------- hàng rào mã nguồn -- */

test("không còn chỗ nào trong components/ chép tay `display_name || `u/${…}`` — mọi tên đi qua tenHienThi", () => {
  const dir = resolve(WEB, "components");
  const vi_pham: string[] = [];
  for (const f of readdirSync(dir).filter((t) => t.endsWith(".tsx"))) {
    const src = boChuThich(readFileSync(resolve(dir, f), "utf8"));
    // Dạng cũ: `x.display_name || \`u/${x.username}\`` — tiền tố `u/` lẫn với tên không tiền tố.
    if (/display_name\s*(\|\||\?\?)\s*`u\//.test(src)) vi_pham.push(f);
  }
  expect(vi_pham, "chỗ chép tay display_name || `u/…` — dùng lib/ten-hien-thi.ts").toEqual([]);
  // Chống pass rỗng: hàm thật sự được dùng ở các chỗ plan §4.6 nêu tên.
  for (const f of [
    "binh-luan",
    "ket-qua-tim-kiem",
    "khoi-thao-luan",
    "khoi-trich",
    "thanh-tai-khoan",
    "the-mach",
    "the-nhat-ky",
    "thanh-dieu-huong-duoi",
  ]) {
    expect(doc(`components/${f}.tsx`), f).toContain("tenHienThi(");
  }
});

/** Chữ hiển thị dựng bằng `` `u/${…}` `` mà CỐ Ý giữ nguyên tiền tố — khoá bằng đoạn dòng, kèm lý do.
 * Mục không còn khớp dòng nào ⇒ đỏ (allowlist không được mục nát). */
const GIU_TIEN_TO_U: readonly { file: string; chua: string; ly_do: string }[] = [
  { file: "components/binh-luan.tsx", chua: "bình luận của u/", ly_do: "nhãn trợ năng của nút hành động, gọi đúng tài khoản (handle)" },
  { file: "components/chuong.tsx", chua: "u/${payload.boi}", ly_do: "thông báo trong chuông: payload chỉ mang username" },
  { file: "lib/thong-bao.ts", chua: "u/${p.boi}", ly_do: "thông báo: payload chỉ mang username" },
  { file: "components/hanh-dong-binh-luan.tsx", chua: "Trả lời u/${tacGia}", ly_do: "placeholder ô trả lời: prop chỉ mang username" },
  { file: "components/nut-theo-user.tsx", chua: "theo dõi u/${username}", ly_do: "toast: prop chỉ mang username (2 dòng)" },
  { file: "components/nut-theo-user-bo.tsx", chua: "theo dõi u/${username}", ly_do: "toast: prop chỉ mang username" },
  { file: "components/form-ho-so.tsx", chua: "hồ sơ hiện u/${", ly_do: "giải thích ô tên: nói rõ tên mặc định là handle u/<username>" },
  { file: "components/xuat-case-study.tsx", chua: "u/${mach.author.username}", ly_do: "văn bản xuất ra ngoài, ghi cả handle lẫn tên (2 dòng)" },
  { file: "lib/og.ts", chua: "u/${mach.author.username}", ly_do: "ảnh OG / SEO: không đổi byte" },
  { file: "lib/rss.ts", chua: "u/${mach.author.username}", ly_do: "RSS / SEO: không đổi byte" },
  { file: "app/u/[username]/page.tsx", chua: "u/${username_giai_ma}", ly_do: "trang hồ sơ: u/ là danh tính của trang" },
];

test("chữ hiển thị `u/${…}` chỉ còn ở allowlist có lý do — mọi chỗ khác đi qua tenHienThi", () => {
  const tep: string[] = [];
  const duyet = (rel: string) => {
    for (const ent of readdirSync(resolve(WEB, rel), { withFileTypes: true })) {
      const duong = `${rel}/${ent.name}`;
      if (ent.isDirectory()) duyet(duong);
      else if (/\.(tsx?|ts)$/.test(ent.name)) tep.push(duong);
    }
  };
  for (const g of ["components", "lib", "app"]) duyet(g);

  const trung_allowlist = new Set<number>();
  const vi_pham: string[] = [];
  for (const f of tep) {
    const dong = boChuThich(doc(f)).split("\n");
    for (const d of dong) {
      // Template literal chứa `u/${` KHÔNG đứng sau `/` hay chữ (loại `/u/${…}` là đường dẫn).
      if (!/`[^`]*(?<![/\w])u\/\$\{/.test(d)) continue;
      // Thuộc tính `title` / `aria-label` luôn được phép mang handle.
      if (/title=|aria-label/.test(d)) continue;
      const i = GIU_TIEN_TO_U.findIndex((m) => m.file === f && d.includes(m.chua));
      if (i < 0) vi_pham.push(`${f}: ${d.trim()}`);
      else trung_allowlist.add(i);
    }
  }
  expect(vi_pham, "chữ hiển thị tự dựng u/${…}: dùng lib/ten-hien-thi.ts hoặc thêm vào GIU_TIEN_TO_U kèm lý do").toEqual([]);
  GIU_TIEN_TO_U.forEach((m, i) => expect(trung_allowlist.has(i), `allowlist mục nát: ${m.file} «${m.chua}»`).toBe(true));
  // `tomTatNhanh` (dòng "ai viết" của nhánh bị gập) đi qua tenHienThi, không `u/${username}`.
  expect(boChuThich(doc("components/binh-luan.tsx"))).toMatch(/tenHienThi\(nut\.author, "u\/"\)/);
});

test("'Viết quan điểm của bạn' và 'Xem tất cả quan điểm' trỏ HAI đích khác nhau; nút Viết kết thúc bằng id ô soạn", () => {
  const viet = duongDanVietBinhLuan("chu-de-tuan", 1484);
  const tat_ca = duongDanKhanDai("chu-de-tuan", 1484);
  expect(viet).not.toBe(tat_ca);
  expect(viet.endsWith(`#${ID_O_SOAN_BINH_LUAN}`)).toBe(true);
  expect(tat_ca.endsWith("#khan-dai")).toBe(true);
  // Cùng trang mạch, cùng cách bung khán đài: chỉ phần neo khác.
  expect(viet.split("#")[0]).toBe(tat_ca.split("#")[0]);
  expect(viet.startsWith("/m/chu-de-tuan-1484?")).toBe(true);

  const tsx = boChuThich(doc("components/khoi-thao-luan.tsx"));
  expect(tsx).toMatch(/data-testid="chu-de-viet"/);
  // Nút "Viết" lấy href từ duongDanVietBinhLuan, nút "Xem tất cả" từ duongDanKhanDai.
  expect(tsx).toMatch(/href_viet\s*=\s*duongDanVietBinhLuan\(/);
  expect(tsx).toMatch(/href=\{href_viet\}[\s\S]{0,80}data-testid="chu-de-viet"/);
  expect(tsx).toMatch(/href=\{href_khan_dai\}[\s\S]{0,80}data-testid="quan-diem-tat-ca"/);
});

test("id ô soạn bình luận tồn tại trong HTML SERVER của cả hai mặt trang mạch (cái bọc, không phải Composer client)", () => {
  expect(ID_O_SOAN_BINH_LUAN).toBe("viet-binh-luan");
  // Mặt CẶN: cái bọc trong KhanDai. Mặt BÃO: div `composer_bao` trong trang-mach.
  const khan_dai = boChuThich(doc("components/khan-dai.tsx"));
  expect(khan_dai).toMatch(/<div id=\{ID_O_SOAN_BINH_LUAN\}[^>]*>\s*<Composer/);
  const trang_mach = boChuThich(doc("components/trang-mach.tsx"));
  expect(trang_mach).toMatch(/id=\{ID_O_SOAN_BINH_LUAN\}[\s\S]{0,80}data-testid="composer-mat-bao"/);
  // `Composer` KHÔNG tự mang id (nó trả null tới khi biết phiên ⇒ không có trong HTML server).
  expect(boChuThich(doc("components/composer.tsx"))).not.toContain("ID_O_SOAN_BINH_LUAN");
});

test("khối chủ đề: không in `▲ 0`, tên + avatar là link hồ sơ kiểu TheNhatKy", () => {
  const tsx = boChuThich(doc("components/khoi-thao-luan.tsx"));
  expect(tsx, "chỉ in điểm khi ≠ 0").toMatch(/b\.score\s*!==\s*0\s*&&/);
  expect(tsx).toContain("duongDanHoSo(b.author.username)");
  expect(tsx, "avatar link ẩn khỏi cây trợ năng và tab, như TheNhatKy").toMatch(
    /tabIndex=\{-1\}\s*aria-hidden="true"/,
  );
  expect(tsx, "title u/<username> ở link tên").toContain("title={`u/${b.author.username}`}");
  expect(tsx, "tác giả null (đã xoá) thì không link").toMatch(/b\.author === null \?/);
  expect(tsx).toContain('"Quan điểm mới"');
  expect(tsx).toContain('"Quan điểm nổi bật"');
});

test("màu: CSS của đợt A không thêm mã hex / --gain / --loss / --stamp", () => {
  for (const f of [
    "components/khoi-thao-luan.module.css",
    "components/khan-dai.module.css",
  ]) {
    const css = boChuThich(doc(f));
    expect(css, `${f}: không mã hex`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css, f).not.toMatch(/--(gain|loss|stamp)/);
  }
});
