import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { nhanNoiMoc } from "../../lib/dinh-dang";

import { quetNguon } from "./quet";

/** ĐỢT B — thẻ mạch thống nhất (plan `plans/2026-11-11-thong-nhat-giao-dien-toan-site.md` §4.1).
 *
 * Phần đo KHÔNG cần trình duyệt: hàm thuần `nhanNoiMoc` (dòng "nối mốc dd/mm") và hai hàng rào
 * trên mã nguồn — (1) chỉ MỘT component dựng thẻ và mọi danh sách đều dùng nó, (2) nút Thẻ/Gọn
 * không còn dấu vết nào. Phần cần chromium (cấu trúc DOM giống nhau ở mọi danh sách, chip theo
 * loại, mobile 390px) ở `e2e/the-mach-thong-nhat.spec.ts`.
 */

const WEB = resolve(__dirname, "..", "..");

/* ---------------------------------------------------------------------- nhanNoiMoc -- */

test("nhanNoiMoc: mạch một mốc / không có mốc mới nhất đọc được ⇒ null", () => {
  expect(nhanNoiMoc("2026-11-10T03:00:00Z", "2026-11-12T03:00:00Z", 1)).toBeNull();
  expect(nhanNoiMoc("2026-11-10T03:00:00Z", "2026-11-12T03:00:00Z", 0)).toBeNull();
  // Mốc cuối bị ẩn / không đạt chuẩn ⇒ API không trả `moc_moi_nhat` ⇒ KHÔNG in ngày của nó.
  expect(nhanNoiMoc("2026-11-10T03:00:00Z", null, 5)).toBeNull();
  expect(nhanNoiMoc("2026-11-10T03:00:00Z", undefined, 5)).toBeNull();
});

test("nhanNoiMoc: cùng NGÀY (giờ VN) ⇒ null, khác ngày ⇒ 'nối mốc dd/mm'", () => {
  // Cùng ngày 10/11 ở VN (10:00 và 17:00 giờ VN).
  expect(nhanNoiMoc("2026-11-10T03:00:00Z", "2026-11-10T10:00:00Z", 2)).toBeNull();
  expect(nhanNoiMoc("2026-11-10T03:00:00Z", "2026-11-12T03:00:00Z", 2)).toBe("nối mốc 12/11");
  // Số 0 đứng đầu giữ nguyên (cùng dạng `ngayNganCuaThoiDiem`).
  expect(nhanNoiMoc("2026-02-01T03:00:00Z", "2026-03-04T03:00:00Z", 3)).toBe("nối mốc 04/03");
});

test("nhanNoiMoc: ca vắt NỬA ĐÊM — so ngày theo giờ VN chứ không theo UTC", () => {
  // Cùng ngày UTC (10/11) nhưng 23:30 ngày 10 và 00:30 ngày 11 theo giờ VN ⇒ KHÁC ngày.
  expect(nhanNoiMoc("2026-11-10T16:30:00Z", "2026-11-10T17:30:00Z", 2)).toBe("nối mốc 11/11");
  // Khác ngày UTC (10 và 11) nhưng cùng ngày 11 theo giờ VN (03:00 và 17:00) ⇒ CÙNG ngày.
  expect(nhanNoiMoc("2026-11-10T20:00:00Z", "2026-11-11T10:00:00Z", 2)).toBeNull();
});

test("nhanNoiMoc: mốc cuối TRƯỚC ngày đăng (đăng bị dời về sau) ⇒ null, không in ngày lùi", () => {
  // Riêng tư 05/11, nối mốc 08/11, công khai 11/11 (`cong_khai_mach` đặt lại `published_at`).
  expect(nhanNoiMoc("2026-11-11T03:00:00Z", "2026-11-08T03:00:00Z", 2)).toBeNull();
  // Biên: mốc cuối 23:30 giờ VN ngày 10 (16:30Z), đăng 00:30 giờ VN ngày 11 (17:30Z) ⇒ trước ⇒ null.
  expect(nhanNoiMoc("2026-11-10T17:30:00Z", "2026-11-10T16:30:00Z", 2)).toBeNull();
  // Lùi qua năm: đăng 02/01/2027, mốc cuối 30/12/2026.
  expect(nhanNoiMoc("2027-01-02T03:00:00Z", "2026-12-30T03:00:00Z", 2)).toBeNull();
});

test("nhanNoiMoc: so cả NĂM — cùng dd/mm nhưng cách một năm vẫn là ngày khác", () => {
  expect(nhanNoiMoc("2025-11-10T03:00:00Z", "2026-11-10T03:00:00Z", 2)).toBe("nối mốc 10/11");
  expect(nhanNoiMoc("2026-12-31T10:00:00Z", "2027-01-02T10:00:00Z", 2)).toBe("nối mốc 02/01");
});

/* ---------------------------------------------------------------- một thẻ duy nhất -- */

test("chỉ MỘT component dựng thẻ (`data-testid=\"the-mach\"`), và mọi danh sách dùng nó", () => {
  const nguon = [
    ...quetNguon(resolve(WEB, "app"), /\.tsx$/).map((f) => ({ ...f, ten: `app/${f.ten}` })),
    ...quetNguon(resolve(WEB, "components"), /\.tsx$/).map((f) => ({ ...f, ten: `components/${f.ten}` })),
  ];
  expect(nguon.length, "đo rỗng").toBeGreaterThan(50);

  // Thẻ trong DANH SÁCH là một `<li data-testid="the-mach">`. (`trang-mach.tsx` cũng dùng chuỗi
  // testid ấy cho phần thân của TRANG mạch — đó không phải thẻ danh sách nên không tính.)
  const dung = nguon
    .filter((f) => /<li\b[^>]*data-testid="the-mach"/.test(f.sach))
    .map((f) => f.ten);
  expect(dung, "chỉ the-mach.tsx được phép dựng thẻ danh sách").toEqual(["components/the-mach.tsx"]);

  // Năm nơi bày danh sách thẻ mạch (đợt B): khối nhật ký `/`, feed `/?…` + `/s/*`, cuộn vô hạn,
  // tab hồ sơ, trang hồ sơ. Mỗi nơi phải dựng `<TheMach`, không bản sao riêng.
  for (const f of [
    "components/trang-chu-v2.tsx",
    "components/feed.tsx",
    "components/cuon-vo-han.tsx",
    "components/tab-ho-so.tsx",
    "app/u/[username]/page.tsx",
  ]) {
    const file = nguon.find((x) => x.ten === f);
    expect(file, `${f} phải tồn tại`).toBeDefined();
    expect(file!.sach, f).toContain("<TheMach ");
  }
  // `TheNhatKy` / `NoiDungThe` đã bị gỡ: không file nào còn nhắc tới như một component.
  for (const f of nguon) {
    expect(f.sach, f.ten).not.toMatch(/\b(TheNhatKy|NoiDungThe)\b/);
  }
  for (const gone of ["components/the-nhat-ky.tsx", "components/the-nhat-ky.module.css", "components/noi-dung-the.tsx", "components/noi-dung-the.module.css"]) {
    expect(existsSync(resolve(WEB, gone)), `${gone} đã bị gỡ`).toBe(false);
  }
});

test("thẻ in tên qua `tenHienThi` và chip trạng thái theo `loai_mach` (nguồn)", () => {
  const f = quetNguon(resolve(WEB, "components"), /^the-mach\.tsx$/)[0];
  expect(f).toBeDefined();
  const s = f.sach;
  expect(s).toContain("tenHienThi(");
  // Bài viết không có chip; chủ đề đóng in "Đã đóng" (không "sổ"); nhật ký đóng in "Đã đóng sổ".
  // "nối mốc" đọc `moc_moi_nhat` (chỉ có khi mốc cuối ĐỌC ĐƯỢC + đạt chuẩn), KHÔNG `last_entry_at`
  // (đo cả mốc bị ẩn ⇒ lộ ngày của một mốc người xem không đọc được). Seed e2e không có mạch bị ẩn
  // mốc cuối nên bài đo trình duyệt không bắt được lỗi này — hàng rào nguồn này bắt.
  expect(s).toContain("moc_moi_nhat");
  expect(s).not.toContain("last_entry_at");
  expect(s).toMatch(/loai_mach\s*!==\s*"bai_viet"/);
  expect(s).toMatch(/loai_mach\s*===\s*"thao_luan"\s*\?\s*"Đã đóng"\s*:\s*"Đã đóng sổ"/);
});

/* ------------------------------------------------------------------ hết nút Thẻ/Gọn -- */

test("không còn dấu vết nút Thẻ/Gọn trong app / components / lib (kể cả chú thích)", () => {
  const nguon = ["app", "components", "lib"].flatMap((d) => quetNguon(resolve(WEB, d), /\.(css|tsx?|mjs)$/));
  expect(nguon.length, "đo rỗng").toBeGreaterThan(100);
  const xau = nguon
    .filter((f) => /kieu-xem|ChonKieuXem|KieuXem|KIEU_XEM|data-kieu-xem/.test(f.noi_dung))
    .map((f) => f.ten);
  expect(xau, "còn dấu vết kiểu xem Thẻ/Gọn").toEqual([]);
  for (const gone of ["components/chon-kieu-xem.tsx", "components/chon-kieu-xem.module.css", "lib/kieu-xem.ts"]) {
    expect(existsSync(resolve(WEB, gone)), `${gone} đã bị gỡ`).toBe(false);
  }
});

/* ------------------------------------------------------ vòng sửa 1: nguồn của thẻ / feed -- */

test("link ảnh của thẻ: `aria-hidden` + `tabIndex={-1}` (cùng đích với link tiêu đề); '+N' `aria-hidden`", () => {
  const s = quetNguon(resolve(WEB, "components"), /^the-mach\.tsx$/)[0].sach;
  const link = /<Link[^>]*data-testid="the-nhat-ky-anh"[^>]*>|<Link(?:(?!<Link)[\s\S])*?data-testid="the-nhat-ky-anh"[\s\S]*?>/.exec(s)?.[0] ?? "";
  expect(link, "phải tìm thấy link ảnh").not.toBe("");
  expect(link).toContain('aria-hidden="true"');
  expect(link).toContain("tabIndex={-1}");
  const them = /<span[^>]*data-testid="the-mach-them-anh"[^>]*>|<span(?:(?!<span)[\s\S])*?data-testid="the-mach-them-anh"[\s\S]*?>/.exec(s)?.[0] ?? "";
  expect(them, "phải tìm thấy huy hiệu +N").not.toBe("");
  expect(them).toContain('aria-hidden="true"');
  expect(s, "'+N' tính từ so_anh - 1 như thẻ feed cũ").toMatch(/so_anh\s*\?\?\s*0\)\s*-\s*1/);
});

test("chỗ nối trang 1 ↔ trang cuộn thêm: margin-top của danh sách nối thêm = `gap` (cùng một biến)", () => {
  const css = quetNguon(resolve(WEB, "components"), /^feed\.module\.css$/)[0].sach;
  const goc = /\.danh_sach\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  expect(goc).toMatch(/--khoang-the\s*:\s*14px/);
  expect(goc).toMatch(/gap\s*:\s*var\(--khoang-the\)/);
  const them = /\.danh_sach_them\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  expect(them, "thiếu margin chỗ nối").toMatch(/margin-top\s*:\s*var\(--khoang-the\)/);
  const cuon = quetNguon(resolve(WEB, "components"), /^cuon-vo-han\.tsx$/)[0].sach;
  expect(cuon).toMatch(/css\.danh_sach\}\s*\$\{css\.danh_sach_them\}[^>]*data-testid="feed-them"/);
});
