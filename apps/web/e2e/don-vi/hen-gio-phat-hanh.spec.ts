import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { TAC_GIA_DOI, TAC_GIA_MAC_DINH } from "../../../admin/lib/tac-gia-doi";
import {
  datetimeLocalSangIsoVN,
  isoSangDatetimeLocalVN,
} from "../../../admin/lib/thoi-gian";
import { boChuThich, quetNguon } from "./quet";

const GOC = resolve(__dirname, "..", "..", "..", "..");
const WEB = resolve(GOC, "apps/web");
const ADMIN = resolve(GOC, "apps/admin");

/** Hàng rào fail-closed cho `plans/2026-09-04-hen-gio-admin-va-front.md` T5.
 *
 * Đọc nguồn đã bỏ chú thích: ngày hiển thị của **mạch** phải là `published_at`. Để
 * `created_at` trôi lại vào thẻ/RSS/JSON-LD là bài soạn trước, đăng sau hiện sai ngày.
 */

function doc(goc: string, tuong_doi: string): string {
  return boChuThich(readFileSync(resolve(goc, tuong_doi), "utf8"));
}

test("T5a — thẻ · trang mạch · tìm kiếm · JSON-LD · RSS dùng published_at, không mach.created_at", () => {
  const files: [string, string][] = [
    [WEB, "components/the-mach.tsx"],
    [WEB, "components/trang-mach.tsx"],
    [WEB, "components/ket-qua-tim-kiem.tsx"],
    [WEB, "lib/json-ld.ts"],
    [WEB, "app/feed.xml/route.ts"],
    [WEB, "app/s/[sub]/feed.xml/route.ts"],
  ];
  const hong: string[] = [];
  for (const [goc, ten] of files) {
    const sach = doc(goc, ten);
    if (!sach.includes("published_at")) {
      hong.push(`${ten}: không nhắc published_at`);
    }
    if (/\bmach\.created_at\b/.test(sach) || /\bm\.created_at\b/.test(sach)) {
      hong.push(`${ten}: còn mach/m.created_at cho ngày bài`);
    }
  }
  expect(hong, hong.join(" · ")).toEqual([]);
});

test("T5b — mốc 1 đọc published_at (nhánh seq === 1)", () => {
  const sach = doc(WEB, "components/the-moc.tsx");
  expect(sach).toMatch(/seq\s*===\s*1/);
  expect(sach).toMatch(/publishedAtMach/);
});

test("T5c — CHU_LOC có khoá hen_gio", () => {
  const sach = doc(ADMIN, "app/machs/page.tsx");
  expect(sach).toMatch(/hen_gio:\s*"Đã hẹn giờ"/);
});

test("T5d — khối hẹn giờ: datetime-local + lời gọi thẳng kèm baseUrl", () => {
  const sach = doc(ADMIN, "components/khoi-hen-gio.tsx");
  expect(sach).toMatch(/type="datetime-local"/);
  expect(sach).toMatch(/quanTriHenGioMach\s*\(/);
  expect(sach).toMatch(/baseUrl:\s*GOC_API/);
});

test("T5e — datetimeLocalSangIsoVN trả +07:00, không toISOString", () => {
  expect(datetimeLocalSangIsoVN("2026-09-10T08:00")).toBe(
    "2026-09-10T08:00:00+07:00",
  );
  expect(datetimeLocalSangIsoVN("2026-09-10T08:00:30")).toBe(
    "2026-09-10T08:00:30+07:00",
  );
  const nguon = readFileSync(resolve(ADMIN, "lib/thoi-gian.ts"), "utf8");
  expect(boChuThich(nguon)).not.toMatch(/toISOString\s*\(/);

  const iso = "2026-09-10T01:00:00.000Z"; // 08:00 VN
  expect(isoSangDatetimeLocalVN(iso)).toBe("2026-09-10T08:00");
});

test("T5e mutant — chuỗi lệch dạng ném, không bịa +07:00", () => {
  expect(() => datetimeLocalSangIsoVN("2026-09-10 08:00")).toThrow(/YYYY-MM-DDTHH:MM/);
});

test("T5f — dang-bai.py có --hen", () => {
  const nguon = readFileSync(resolve(GOC, "scripts/bai-viet/dang-bai.py"), "utf8");
  expect(nguon).toMatch(/--hen/);
  expect(nguon).toMatch(/kiem_offset/);
  expect(nguon).toMatch(/\/api\/admin\/machs\/hen-gio/);
});

test("quét trúng apps/web và apps/admin (chống hàng rào rỗng)", () => {
  expect(quetNguon(WEB, /\.tsx$/).length).toBeGreaterThan(10);
  expect(quetNguon(ADMIN, /\.tsx$/).length).toBeGreaterThan(10);
});

/* ===========================================================================
 * FORM ĐĂNG BÀI TỪ ADMIN — `plans/2026-09-04-dang-bai-tu-admin.md` §2.3
 * ========================================================================= */

/** Sáu hàng rào cho trang `/machs/moi`. Chúng canh đúng những thứ **không có type nào
 * giữ**: một lời gọi đi mất, một helper múi giờ bị thay bằng `toISOString()`, một
 * allowlist tác giả trôi khỏi bản Python, một mục menu mọc thêm làm hai mục sáng cùng lúc.
 * Cả bốn đều build xanh, lint xanh, và ba trong bốn chỉ lộ ra trên production.
 */

const TRANG_MOI = "app/machs/moi/page.tsx";

test("T2a — trang /machs/moi tồn tại và đọc được", () => {
  expect(() => doc(ADMIN, TRANG_MOI)).not.toThrow();
  expect(doc(ADMIN, TRANG_MOI).length).toBeGreaterThan(2000);
});

test("T2b — form gọi thẳng quanTriTaoMachHenGio kèm baseUrl", () => {
  const sach = doc(ADMIN, TRANG_MOI);
  expect(sach).toMatch(/quanTriTaoMachHenGio\s*\(/);
  expect(sach).toMatch(/baseUrl:\s*GOC_API/);
});

test("T2c — ô hẹn giờ là datetime-local và đi qua datetimeLocalSangIsoVN", () => {
  const sach = doc(ADMIN, TRANG_MOI);
  expect(sach).toMatch(/type="datetime-local"/);
  // Ba chuỗi RỜI RẠC cùng có mặt trong một file thì chưa nói được gì: `published_at` vẫn
  // có thể lấy giá trị từ chỗ khác trong khi helper ngồi đó phục vụ ô `min`. Ghim đúng
  // đường đi — công tắc `hen` → helper → ô giờ → trường gửi lên.
  expect(sach).toMatch(
    /if\s*\(hen\)\s*\{\s*try\s*\{\s*published_at\s*=\s*datetimeLocalSangIsoVN\(\s*o_gio\s*\)/,
  );
  expect(sach).toMatch(/^\s*published_at,\s*$/m);
  // Vế cấm: `toISOString()` ở đây là hẹn lệch 7 tiếng, im lặng.
  expect(sach).not.toMatch(/toISOString\s*\(/);
});

test("T2g — giờ hẹn lệch dạng được BẮT trước khi vào chay(), không ném ra ngoài", () => {
  // `useHanhDong.chay` không có `catch`: một cú ném bên trong callback của nó là unhandled
  // rejection — nút hết "đang gửi", màn hình câm, không câu lỗi nào. Mà
  // `datetimeLocalSangIsoVN` NÉM thật (T5e mutant), và ô `datetime-local` đẻ ra chuỗi lệch
  // dạng thật (năm 5 chữ số ở vài trình duyệt).
  const sach = doc(ADMIN, TRANG_MOI);
  const vi_tri_helper = sach.search(/datetimeLocalSangIsoVN\(\s*o_gio\s*\)/);
  const vi_tri_chay = sach.search(/await\s+chay\(/);
  expect(vi_tri_helper).toBeGreaterThan(0);
  expect(vi_tri_chay).toBeGreaterThan(0);
  expect(vi_tri_helper).toBeLessThan(vi_tri_chay);
  expect(sach).toMatch(/catch\s*\{\s*datNhac\(/);
});

test("T2h — cửa CHÈN ảnh mở cho mọi staff (nới quyền 2026-09-04, không còn gác superuser)", () => {
  // Chốt cũ (`plans/2026-09-04-dang-bai-tu-admin.md`): hai cửa ẢNH superuser-only, form
  // phải gác theo `mod.is_superuser`. Chốt mới (`plans/2026-09-04-noi-quyen-chen-anh-
  // staff.md`): user nới quyền CHÈN ảnh cho mọi staff — gác ấy phải BIẾN MẤT khỏi form,
  // và hàng rào ở UI chỉ có nghĩa nếu backend đúng là đã bỏ chặn.
  const sach = doc(ADMIN, TRANG_MOI);
  expect(sach).not.toMatch(/choPhepAnh=\{mod\.is_superuser\}/);
  expect(sach).not.toMatch(/anh-chi-superuser/);
  expect(sach).not.toMatch(/!mod\.is_superuser\s*\?/);
  expect(sach).not.toMatch(/\bmod\.is_superuser\b/);
  // `useQuanTri` không còn lý do để import ở trang này — không còn chỗ nào đọc `mod` nữa.
  expect(sach).not.toMatch(/useQuanTri/);

  const cua = readFileSync(resolve(GOC, "api/api/quan_tri_sua_bai.py"), "utf8");
  const than = (ham: string): string => {
    const dau = cua.indexOf(`def ${ham}(`);
    expect(dau, `${ham}: không tìm thấy trong quan_tri_sua_bai.py`).toBeGreaterThan(0);
    const ke_tiep = cua.indexOf("\ndef ", dau + 1);
    return cua.slice(dau, ke_tiep > 0 ? ke_tiep : dau + 2000);
  };

  // Cửa đổi tiêu đề mạch vẫn PHẢI còn chặn — đổi tiêu đề làm đổi slug toàn mạch.
  // Các cửa sửa mốc và gỡ ảnh đã được nới cho mod.
  for (const ham of [
    "sua_moc_quan_tri",
    "tai_anh_moc_quan_tri",
    "tai_anh_noi_dung_quan_tri",
    "xoa_anh_moc_quan_tri",
  ]) {
    expect(
      than(ham),
      `${ham}: còn chan_neu_khong_phai_superuser — cửa này đã mở cho mọi mod`,
    ).not.toMatch(/chan_neu_khong_phai_superuser/);
  }
  expect(
    than("sua_tieu_de_mach_quan_tri"),
    "sua_tieu_de_mach_quan_tri: mất chan_neu_khong_phai_superuser — cửa này phải superuser-only",
  ).toMatch(/chan_neu_khong_phai_superuser/);

  // Prop mới vẫn MẶC ĐỊNH true, nếu không trang sửa mốc (không truyền) mất nút ảnh.
  const editor = doc(ADMIN, "components/soan-thao-quan-tri.tsx");
  expect(editor).toMatch(/choPhepAnh\s*=\s*true/);
  expect(editor).toMatch(/khoa\s*\|\|\s*!choPhepAnh/);
  // …và trang sửa mốc đúng là KHÔNG truyền prop ấy (nó khoá cả editor bằng `khoa`).
  expect(doc(ADMIN, "app/m/[machId]/moc/[mocId]/page.tsx")).not.toMatch(/choPhepAnh/);
});

test("T2h mutant — trang /machs/moi phải THẬT SỰ chèn được ảnh (ô ảnh luôn hiện)", () => {
  // Đối chứng dương: bỏ hẳn khối "Ảnh đính kèm" cũng làm bài trên xanh (vì không còn
  // `mod.is_superuser` để tìm) — bài này ghim rằng ô ảnh còn ĐÓ, luôn hiện, không rơi vào
  // một nhánh điều kiện nào khác.
  const sach = doc(ADMIN, TRANG_MOI);
  expect(sach).toMatch(/data-testid="o-anh"/);
  expect(sach).toMatch(/tieu_de="Ảnh đính kèm"/);
});

test("T2i — 201 rồi vẫn đọc da_hen_gio của server, không tin công tắc hen", () => {
  const sach = doc(ADMIN, TRANG_MOI);
  // Mốc quá khứ ⇒ `hen_gio=False` ⇒ bài lên sóng NGAY kèm chuông thật. Form không được
  // in "bài nằm ẩn tới giờ đã hẹn" trong ca ấy, và không được điều hướng đi mất trước khi
  // mod kịp đọc cảnh báo.
  expect(sach).toMatch(/da_len_ngay\s*=\s*hen\s*&&\s*!kq\.data\.da_hen_gio/);
  expect(sach).toMatch(/canh-bao-da-len-ngay/);
  expect(sach).toMatch(/if\s*\(!da_len_ngay\)\s*router\.push\(/);
  // Ô giờ có `min` (hàng rào lịch sự phía UI).
  expect(sach).toMatch(/min=\{bay_gio_vn\}/);
});

test("T2j — lỗi mạng sau khi gửi KHÔNG được mời bấm lại trần", () => {
  // Nhánh `kq.error` và `kq.data === undefined` là "KHÔNG BIẾT", không phải "chưa gửi
  // được": mất mạng đúng lúc response bay về là bài đã commit. Cửa này không idempotent.
  const sach = doc(ADMIN, TRANG_MOI);
  expect(sach).toMatch(/Không chắc bài đã được tạo hay chưa/);
  expect(sach).toMatch(/kẻo tạo trùng/);
});

/** Username của các tài khoản **đăng bài** cắt từ bảng nguồn Python, đúng thứ tự khai.
 *
 * Cắt từ `tao_tai_khoan_doi.py::TAI_KHOAN` chứ không từ `quan_tri_hen_gio.py`: chỗ sau chỉ
 * chứa một biểu thức generator (`... for _, username, _, la_super in TAI_KHOAN ...`), tức
 * không có chuỗi username nào để đọc. Bài đo bên dưới vẫn ghim rằng chỗ sau lọc đúng theo
 * cờ superuser, nếu không hàng rào này canh một bảng mà API không dùng.
 */
function tacGiaTuPython(): string[] {
  const nguon = readFileSync(
    resolve(GOC, "api/core/management/commands/tao_tai_khoan_doi.py"),
    "utf8",
  );
  return [
    ...nguon.matchAll(
      /\(\s*"[A-Z0-9_]+"\s*,\s*"([^"]+)"\s*,\s*"[^"]*"\s*,\s*(True|False)\s*\)/g,
    ),
  ]
    .filter((m) => m[2] === "False")
    .map((m) => m[1]);
}

test("T2d — TAC_GIA_DOI khớp đúng tập và đúng thứ tự với bảng tài khoản đội của Python", () => {
  const tu_python = tacGiaTuPython();
  // FAIL-CLOSED: regex mục ⇒ mảng rỗng ⇒ phép so dưới sẽ "khớp" với một TAC_GIA_DOI rỗng
  // nếu ai đó cũng xoá nó. Chặn ở đây, trước khi so.
  expect(tu_python, "regex không cắt được username nào — hàng rào đã mục").not.toEqual([]);
  expect(tu_python.length).toBeGreaterThanOrEqual(2);
  expect(TAC_GIA_DOI.map((t) => t.username)).toEqual(tu_python);
  // Mặc định là một chuỗi gõ tay thứ ba: nó phải nằm TRONG danh sách, nếu không ô chọn mở
  // ra với một `value` không option nào mang — trình duyệt lặng lẽ hiện option đầu tiên,
  // và mod đăng bài dưới tên khác cái họ nhìn thấy.
  expect(tu_python).toContain(TAC_GIA_MAC_DINH);

  // …và cửa API phải đang lọc theo đúng cờ superuser trên đúng bảng ấy.
  const cua = readFileSync(resolve(GOC, "api/api/quan_tri_hen_gio.py"), "utf8");
  expect(cua).toMatch(/TAI_KHOAN_DANG_BAI/);
  expect(cua).toMatch(/for .*in TAI_KHOAN if not la_super/);
});

test("T2e — /machs có nút dẫn tới /machs/moi", () => {
  expect(doc(ADMIN, "app/machs/page.tsx")).toContain('href="/machs/moi"');
});

test("T2f — /machs/moi KHÔNG được thêm vào menu (hai mục sáng cùng lúc)", () => {
  const menu = readFileSync(resolve(ADMIN, "components/khung/menu.ts"), "utf8");
  // Chống rỗng: đọc trúng file menu thật, không phải một chuỗi rỗng.
  expect(menu).toContain('duong_dan: "/machs"');
  expect(menu).not.toContain("/machs/moi");
});
