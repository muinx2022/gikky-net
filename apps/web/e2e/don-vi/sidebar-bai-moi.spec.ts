import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

const WEB = resolve(__dirname, "..", "..");

function doc(duongDanTuongDoi: string): string {
  return readFileSync(resolve(WEB, duongDanTuongDoi), "utf8");
}

/** Mã của MỘT hàm cấp đầu file: từ `dau` tới khai báo cấp đầu kế tiếp (`function` / `async
 * function` / `export` ở cột 0) hoặc hết file. Không dừng ở `\n}` đầu tiên — phần khai tham số
 * kiểu `}: {` cũng có `}` ở cột 0. Không thấy `dau` ⇒ chuỗi rỗng (bài gọi tự chặn đo rỗng). */
function hamTrongFile(nguon: string, dau: string): string {
  const i = nguon.indexOf(dau);
  if (i < 0) return "";
  const sau = nguon.slice(i + dau.length);
  const ke = sau.search(/\n(?:export |async function |function )/);
  return dau + (ke < 0 ? sau : sau.slice(0, ke));
}

test.describe("sidebar-bai-moi", () => {
  test("Sidebar giu nguyen tinh PURE: khong goi API hay fetch truc tiep", () => {
    const sach = boChuThich(doc("components/sidebar.tsx"));
    // Chi duoc phep import type tu @gikky/api-client
    expect(sach).not.toMatch(/from\s+["']@\/lib\/api["']/);
    expect(sach).not.toMatch(/from\s+["']@gikky\/api-client\/client["']/);
    expect(sach).not.toMatch(/\bfetch\s*\(/);
  });

  test("Sidebar co khoi sidebar-bai-moi co dieu kien baiMoi.length > 0 va nhan tieuDeBaiMoi", () => {
    const sach = boChuThich(doc("components/sidebar.tsx"));
    // Markup của khối tách sang `KhoiBaiMoi` (việc 24) để server và trình duyệt (`/luat`) dựng CÙNG
    // một hộp; Sidebar chỉ còn điều kiện + truyền tiêu đề.
    expect(boChuThich(doc("components/khoi-bai-moi.tsx"))).toContain('data-testid="sidebar-bai-moi"');
    expect(sach).toMatch(/baiMoi\s*&&\s*baiMoi\.length\s*>\s*0/);
    expect(sach).toMatch(/<KhoiBaiMoi\s+baiMoi=\{baiMoi\}\s+tieuDe=\{tieuDeBaiMoi\}/);
  });

  /* ---------------------------------------------------------- việc 24 — bài viết sang rail -- */

  test("V24-T7 — Sidebar: khối bài mới đứng SAU Chuyên mục, TRƯỚC Luật (cả hai nhánh tĩnh)", () => {
    // Thứ tự user chốt 2026-11-13: … → Chuyên mục → bài mới → Luật rút gọn.
    const sach = boChuThich(doc("components/sidebar.tsx"));
    const i_bai = sach.indexOf("<KhoiBaiMoi");
    const i_bai_td = sach.indexOf("<BaiMoiTuTrinhDuyet");
    const i_cm = sach.indexOf("<KhoiChuyenMuc");
    const i_cm_td = sach.indexOf("<ChuyenMucTuTrinhDuyet");
    const i_luat = sach.indexOf('data-testid="sidebar-luat"');
    for (const [ten, i] of Object.entries({ i_bai, i_bai_td, i_cm, i_cm_td, i_luat })) {
      expect(i, `đo rỗng: không thấy ${ten}`).toBeGreaterThan(0);
    }
    // Cả hai nhánh Chuyên mục (server + trình duyệt) đứng trước cả hai nhánh bài mới.
    expect(i_cm).toBeLessThan(i_bai);
    expect(i_cm_td).toBeLessThan(i_bai);
    expect(i_cm_td).toBeLessThan(i_bai_td);
    expect(i_bai).toBeLessThan(i_luat);
    expect(i_bai_td).toBeLessThan(i_luat);
  });

  test("V24-T6 — CSS tiêu đề bài mới: 12.5px, chữ thường, MỘT dòng cắt bằng ellipsis, không line-clamp", () => {
    const css = doc("components/sidebar.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
    // Luật GỐC của lớp (đầu dòng), không phải `.muc_bai_moi:hover .tieu_de_bai_moi`.
    const luat = /(?:^|\n)\.tieu_de_bai_moi\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(luat, "đo rỗng: không thấy .tieu_de_bai_moi").not.toBe("");
    expect(luat).toMatch(/font-size:\s*12\.5px/);
    expect(luat).toMatch(/font-weight:\s*400/);
    expect(luat).toMatch(/white-space:\s*nowrap/);
    expect(luat).toMatch(/overflow:\s*hidden/);
    expect(luat).toMatch(/text-overflow:\s*ellipsis/);
    expect(luat).not.toMatch(/line-clamp|-webkit-box/);
  });

  test("V24 — KhoiBaiMoi: tiêu đề ĐẦY ĐỦ trong <a> (không title), dòng phụ tên chuyên mục · <time dateTime>", () => {
    const sach = boChuThich(doc("components/khoi-bai-moi.tsx"));
    expect(sach.trimStart().startsWith('"use client"')).toBe(false);
    // Việc 24 bổ sung (user 2026-11-13): bỏ `title` — tooltip native tràn khỏi rail. Tiêu đề đầy
    // đủ cho người rê chuột nay ở `data-tieu-de` của `<li>` (tooltip CSS), chỉ khi dài hơn ngưỡng.
    expect(sach).not.toMatch(/\btitle=\{/);
    expect(sach).toMatch(
      /data-tieu-de=\{m\.title\.length\s*>\s*NGUONG_TOOLTIP_TIEU_DE\s*\?\s*m\.title\s*:\s*undefined\}/,
    );
    // `<a>` CHỈ bọc tiêu đề: text của nó = đúng `m.title` (không dính dòng phụ vào anchor text).
    const link = /<Link\b[^>]*>([\s\S]*?)<\/Link>/.exec(sach);
    expect(link, "đo rỗng: không thấy <Link> của mục").not.toBeNull();
    expect(link![0]).toMatch(/className=\{css\.tieu_de_bai_moi\}/);
    expect(link![1].trim()).toBe("{m.title}");
    // Dòng phụ là ANH EM của `<a>` trong `<li>`, đứng sau `</Link>`.
    const sau_link = sach.slice(sach.indexOf("</Link>"));
    expect(sau_link).toMatch(/^<\/Link>\s*<span className=\{css\.meta_bai_moi\}>/);
    // Vùng bấm cả dòng: stretched link.
    const css = doc("components/sidebar.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(/(?:^|\n)\.muc_bai_moi\s*\{([^}]*)\}/.exec(css)?.[1] ?? "").toMatch(/position:\s*relative/);
    const sau = /\.tieu_de_bai_moi::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(sau).toMatch(/content:\s*""/);
    expect(sau).toMatch(/position:\s*absolute/);
    expect(sau).toMatch(/inset:\s*0\b/);
    // Cấm cắt chuỗi ở JS — anchor text cho bot là tiêu đề đầy đủ.
    expect(sach).not.toMatch(/title\.(slice|substring|substr)\(|cat(Chuoi|TieuDe)/);
    expect(sach).toMatch(/<time\b[^>]*dateTime=\{m\.published_at\}/);
    // Ngày đi qua helper ghim TZ_VN — cùng chuỗi ở server và trình duyệt (không lệch hydrate).
    expect(sach).toMatch(/ngayCuaThoiDiem\(m\.published_at\)/);
    expect(sach).toMatch(/m\.sub\.ten/);
    expect(sach).toContain('data-testid="sidebar-bai-moi-tat-ca"');
    expect(sach).toContain('"/?tab=moi&loai_mach=bai_viet"');
  });

  test("V24-B — tooltip CSS của dòng: ::before của <li>, alt rỗng, rộng bằng dòng, xuống dòng, không bắt chuột, hover chỉ khi (hover: hover), bàn phím qua :focus-visible", () => {
    const css = doc("components/sidebar.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const goc = /(?:^|\n)\.muc_bai_moi\[data-tieu-de\]::before\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(goc, "đo rỗng: không thấy .muc_bai_moi[data-tieu-de]::before").not.toBe("");
    expect(goc).toMatch(/content:\s*attr\(data-tieu-de\);/);
    // Alt rỗng: trình đọc màn hình không đọc tiêu đề lần hai (anchor text đã đọc). Khai SAU dòng
    // không alt (trình duyệt cũ bỏ dòng này, giữ dòng trên).
    expect(goc).toMatch(/content:\s*attr\(data-tieu-de\);\s*content:\s*attr\(data-tieu-de\)\s*\/\s*""\s*;/);
    expect(goc).toMatch(/position:\s*absolute/);
    expect(goc).toMatch(/left:\s*0;/);
    expect(goc).toMatch(/right:\s*0;/);
    expect(goc).toMatch(/white-space:\s*normal/);
    expect(goc).toMatch(/pointer-events:\s*none/);
    expect(goc).not.toMatch(/--(gain|loss|stamp)|#[0-9a-fA-F]{3,8}\b/);
    // Hiện bằng BÀN PHÍM (`:focus-visible`) ở mọi thiết bị; bằng chuột CHỈ trong `@media (hover:
    // hover)`. `:focus-within` bị cấm: nó khớp cả focus do bấm chuột / chạm ⇒ hộp kẹt lại.
    expect(css).toMatch(/\n\.muc_bai_moi\[data-tieu-de\]:has\(:focus-visible\)::before\s*\{/);
    expect(css).not.toMatch(/\.muc_bai_moi[^{]*:focus-within/);
    expect(css).not.toMatch(/\n\.muc_bai_moi\[data-tieu-de\]:hover::before/);
    expect(css).toMatch(
      /@media \(hover: hover\)\s*\{\s*\.muc_bai_moi\[data-tieu-de\]:hover::before\s*\{[^}]*opacity:\s*1/,
    );
    // Stretched link của `<a>` vẫn là `::after` — tooltip không được chiếm nó.
    expect(css).not.toMatch(/\.muc_bai_moi[^{,]*::after/);
  });

  test("V24-T8 — /luat: khung tĩnh bật khối bài mới ở TRÌNH DUYỆT, không thêm lời gọi API nào", () => {
    const tinh = boChuThich(doc("components/khung-hai-cot-tinh.tsx"));
    expect(tinh).toMatch(/<Sidebar\b[^>]*\bbaiMoiTuTrinhDuyet\b/);
    expect(tinh).toMatch(/<Sidebar\b[^>]*\blinkTatCaBaiViet\b/);
    expect(tinh).not.toMatch(/@\/lib\/api|@gikky\/api-client|\bfetch\s*\(/);
    const client = doc("components/bai-moi-tu-trinh-duyet.tsx");
    expect(client.startsWith('"use client"')).toBe(true);
    expect(boChuThich(client)).toMatch(/docBaiVietMoiOTrinhDuyet\(/);
    expect(boChuThich(client)).toMatch(/<KhoiBaiMoi\b/);
    // Hàm nạp: `baseUrl` trình duyệt, lọc `bai_viet`. (Gọi THẲNG theo tên hàm sinh ra thì
    // `type-frontend.spec.ts` đã canh cho mọi file — không nhắc tên ấy ở đây, kẻo chính hàng rào
    // đó coi file đo này là một lời gọi qua biến.)
    const api = boChuThich(doc("lib/api.ts"));
    const ham = hamTrongFile(api, "export async function docBaiVietMoiOTrinhDuyet(");
    expect(ham, "đo rỗng: không thấy docBaiVietMoiOTrinhDuyet").not.toBe("");
    expect(ham).toMatch(/\(\{\s*baseUrl:\s*GOC_TRINH_DUYET,/);
    expect(ham).toMatch(/loai_mach:\s*"bai_viet"/);
  });

  test("V24-T4 — trang chủ: không còn KhoiBaiViet / giá sách; rail nhận bài viết + link 'Tất cả'", () => {
    const trang = boChuThich(doc("app/page.tsx"));
    expect(trang).not.toMatch(/KhoiBaiViet|khoi-bai-viet|docFeedSub|subLenTrangChu/);
    // Chỉ nhánh v2 (`TrangChuMoi`) — nhánh `/?tab=…` (`FeedDaNap`) giữ rail cũ. Cắt TỚI hàm kế
    // tiếp / hết file chứ không tới `\n}` đầu tiên: phần khai tham số `}: {` của `FeedDaNap` cũng
    // bắt đầu bằng `}` ở cột 0, và regex cũ dừng ở đó — đo phần khai tham số thay vì thân hàm.
    const v2 = hamTrongFile(trang, "async function TrangChuMoi(");
    expect(v2, "đo rỗng: TrangChuMoi phải dựng Sidebar").toMatch(/<Sidebar\b/);
    expect(v2).toMatch(/baiMoi=\{chonMoiDang\(/);
    expect(v2).toMatch(/tieuDeBaiMoi="Bài viết mới"/);
    expect(v2).toMatch(/\blinkTatCaBaiViet\b/);
    const cu = hamTrongFile(trang, "async function FeedDaNap(");
    expect(cu, "đo rỗng: FeedDaNap phải dựng Sidebar").toMatch(/<Sidebar\b/);
    expect(cu).not.toMatch(/baiMoi|linkTatCaBaiViet/);
  });

  test("V24-T9 — rail /s/* KHÔNG có khối bài mới (trang sub không truyền baiMoi)", () => {
    const sub = boChuThich(doc("app/s/[sub]/page.tsx"));
    expect(sub, "đo rỗng: trang sub phải dựng Sidebar").toMatch(/<Sidebar\b/);
    expect(sub).not.toMatch(/baiMoi|linkTatCaBaiViet/);
  });

  test("KhungHaiCot ho tro subSlug: nap docFeedSub va dat tieu de 'Cung chuyen muc'", () => {
    const sach = boChuThich(doc("components/khung-hai-cot.tsx"));
    expect(sach).toMatch(/docFeedSub\s*\(\s*subSlug/);
    expect(sach).toMatch(/subSlug\s*\?\s*["']Cùng chuyên mục["']\s*:\s*["']Bài mới nhất["']/);
    expect(sach).toMatch(/m\.id\s*!==\s*idMachHienTai/);
    expect(sach).toContain("baiMoi={bai_moi}");
    expect(sach).toContain("tieuDeBaiMoi={tieu_de}");
  });

  test("trang-mach truyen idMachHienTai={mach.id} va subSlug={mach.sub.slug} vao KhungHaiCot", () => {
    const sach = boChuThich(doc("components/trang-mach.tsx"));
    expect(sach).toMatch(/<KhungHaiCot\s+idMachHienTai=\{mach\.id\}\s+subSlug=\{mach\.sub\.slug\}/);
  });

  test("Logic loc bai moi khong bao gio chua chinh bai dang xem", () => {
    const mockItems = [
      { id: 101, title: "Bai 1" },
      { id: 102, title: "Bai 2" },
      { id: 103, title: "Bai 3" },
      { id: 104, title: "Bai 4" },
      { id: 105, title: "Bai 5" },
      { id: 106, title: "Bai 6" },
    ];

    // Dang xem bai 101
    const loc101 = mockItems.filter((m) => m.id !== 101).slice(0, 5);
    expect(loc101.length).toBe(5);
    expect(loc101.some((m) => m.id === 101)).toBe(false);
    expect(loc101[0].id).toBe(102);

    // Dang xem bai 999 (khong nam trong top 6)
    const loc999 = mockItems.filter((m) => m.id !== 999).slice(0, 5);
    expect(loc999.length).toBe(5);
    expect(loc999[0].id).toBe(101);
  });
});

/** Trả về `{ boc, than }` của mọi khối cấp đầu (`selector-hoặc-@media { … }`), đếm ngoặc thật —
 * không dừng ở `}` đầu tiên của luật lồng trong `@media`. */
function khoiCapDau(css: string): { boc: string; than: string }[] {
  const ra: { boc: string; than: string }[] = [];
  let bat_dau = 0;
  let i = 0;
  while (i < css.length) {
    const mo = css.indexOf("{", i);
    if (mo < 0) break;
    let muc = 1;
    let j = mo + 1;
    for (; j < css.length && muc > 0; j += 1) {
      if (css[j] === "{") muc += 1;
      else if (css[j] === "}") muc -= 1;
    }
    ra.push({ boc: css.slice(bat_dau, mo).trim(), than: css.slice(mo + 1, j - 1) });
    bat_dau = j;
    i = j;
  }
  return ra;
}

test.describe("rail điện thoại — ẩn Chuyên mục + bài mới (user chốt 2026-11-14)", () => {
  test("`.an_tren_dien_thoai { display: none }` CHỈ nằm trong `@media (max-width: 640px)`", () => {
    const css = doc("components/sidebar.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const co = khoiCapDau(css).filter((k) => /\.an_tren_dien_thoai\b/.test(`${k.boc}{${k.than}}`));
    expect(co.length, "đo rỗng: không thấy .an_tren_dien_thoai").toBeGreaterThan(0);
    for (const k of co) {
      // Ở cấp đầu (ngoài @media) là ẩn ở MỌI bề rộng — desktop mất hai khối.
      expect(k.boc, `.an_tren_dien_thoai nằm ngoài @media 640: "${k.boc}"`).toMatch(
        /^@media\s*\(max-width:\s*640px\)$/,
      );
      const luat = /(?:^|\n)\s*\.an_tren_dien_thoai\s*\{([^}]*)\}/.exec(k.than)?.[1] ?? "";
      expect(luat).toMatch(/display:\s*none/);
    }
  });

  test("lớp gắn ở phần tử GỐC của KhoiChuyenMuc + KhoiBaiMoi (phủ cả nhánh trình duyệt), không gắn khối rail khác", () => {
    for (const [file, id] of [
      ["components/khoi-chuyen-muc.tsx", "sidebar-cac-sub"],
      ["components/khoi-bai-moi.tsx", "sidebar-bai-moi"],
    ] as const) {
      const sach = boChuThich(doc(file));
      const goc = new RegExp(`<section\\b[^>]*data-testid="${id}"[^>]*>`).exec(sach)?.[0] ?? "";
      expect(goc, `đo rỗng: không thấy <section> gốc của ${file}`).not.toBe("");
      expect(goc, file).toContain("css.an_tren_dien_thoai");
    }
    // Nhánh trình duyệt dựng lại ĐÚNG hai khối này, không markup riêng.
    expect(boChuThich(doc("components/chuyen-muc-tu-trinh-duyet.tsx"))).toMatch(/<KhoiChuyenMuc\b/);
    expect(boChuThich(doc("components/bai-moi-tu-trinh-duyet.tsx"))).toMatch(/<KhoiBaiMoi\b/);
    // Các khối rail khác (khách, giới thiệu, chủ đề tuần, luật, chân trang) giữ nguyên trên điện thoại.
    for (const f of ["components/sidebar.tsx", "components/khoi-khach.tsx", "components/chan-trang.tsx"]) {
      expect(boChuThich(doc(f)), f).not.toContain("an_tren_dien_thoai");
    }
  });
});
