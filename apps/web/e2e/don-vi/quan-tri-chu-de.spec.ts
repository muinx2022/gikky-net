import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { quanTriLietKeMach } from "@gikky/api-client/admin";
import { expect, test } from "@playwright/test";

import {
  NHAN_TRANG_THAI_CHU_DE,
  nhanTuan,
  nhomChuDeTheoTuan,
  nutChuDe,
  soPhanTongKetKhiMoLai,
} from "../../../admin/lib/chu-de";
import { NHAN_LOAI_MACH, docLocLoaiMach } from "../../../admin/lib/loai-mach";
import { NHOM_MENU } from "../../../admin/components/khung/menu";
import { boChuThich } from "./quet";

/** Việc 21, đợt C — trang "Chủ đề tuần" + ô lọc loại của `/machs`
 * (plan `2026-11-13-quan-tri-ban-tin-chu-de.md` §5, C4 + C5 + phần thuần của §3.1).
 *
 * Ba tầng như các bài `*-quan-tri.spec.ts` khác: hàm thuần (đo giá trị), client SINH RA (đo
 * request thật đi ra với `fetch` giả — không cần server), và nguồn trang (cái nối dây). Phần
 * "bảng chỉ còn chủ đề" là việc của server và đã có bài pytest
 * `api/tests/test_api_quan_tri_bang_loai_mach.py::test_loc_loai_mach_dung_tung_loai`. */

const ADMIN = resolve(__dirname, "..", "..", "..", "admin");
const nguon = (p: string) => boChuThich(readFileSync(resolve(ADMIN, p), "utf8"));

test.describe("C4 — lọc loại ở /machs", () => {
  test("URL → giá trị gửi API: ba loại đi nguyên, giá trị lạ / vắng ⇒ null (Tất cả)", () => {
    expect(docLocLoaiMach("thao_luan")).toBe("thao_luan");
    expect(docLocLoaiMach("nhat_ky")).toBe("nhat_ky");
    expect(docLocLoaiMach("bai_viet")).toBe("bai_viet");
    expect(docLocLoaiMach(null)).toBeNull();
    expect(docLocLoaiMach("")).toBeNull();
    expect(docLocLoaiMach("THAO_LUAN")).toBeNull();
    // Khoá thừa kế từ Object.prototype không được lọt qua phép tra.
    expect(docLocLoaiMach("toString")).toBeNull();
  });

  test("ô lọc có đúng ba loại của API, nhãn 'Chủ đề' cho thao_luan", () => {
    expect(Object.keys(NHAN_LOAI_MACH)).toEqual(["nhat_ky", "bai_viet", "thao_luan"]);
    expect(NHAN_LOAI_MACH.thao_luan).toBe("Chủ đề");
  });

  test("chọn 'Chủ đề' ⇒ request của client sinh ra mang loai_mach=thao_luan", async () => {
    const da_goi: string[] = [];
    const fetch_gia = async (req: Request) => {
      da_goi.push(req.url);
      return new Response(JSON.stringify({ items: [], cursor_ke_tiep: null, tong: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    await quanTriLietKeMach({
      baseUrl: "http://quan-tri.test",
      fetch: fetch_gia as unknown as typeof fetch,
      query: { trang_thai: "chua_go", loai_mach: docLocLoaiMach("thao_luan"), limit: 25 },
    });
    expect(da_goi).toHaveLength(1);
    const url = new URL(da_goi[0]);
    expect(url.pathname).toBe("/api/admin/machs");
    expect(url.searchParams.get("loai_mach")).toBe("thao_luan");
  });

  test("trang /machs đọc ?loai_mach= qua docLocLoaiMach và chuyển xuống query + deps", () => {
    const trang = nguon("app/machs/page.tsx");
    expect(trang).toMatch(/const loai_mach = docLocLoaiMach\(tham_so\.get\("loai_mach"\)\)/);
    const goi = trang.slice(trang.indexOf("quanTriLietKeMach({"));
    const than = goi.slice(0, goi.indexOf("}),"));
    expect(than).toMatch(/\bloai_mach,/);
    expect(trang).toMatch(/\[q, sub, tac_gia, trang_thai, loai_mach\]/);
    expect(trang).toMatch(/data-testid="loc-loai-mach"/);
    expect(trang).toMatch(/onChange=\{\(e\) => datLoc\("loai_mach", e\.target\.value\)\}/);
    // Cột loại đọc nhãn từ cùng bảng với ô lọc.
    expect(trang).toMatch(/\{NHAN_LOAI_MACH\[m\.loai_mach\]\}/);
  });
});

test.describe("C5 — menu", () => {
  test("nhóm 'Nội dung' đứng giữa 'Tổng quan' và 'Kiểm duyệt', có đúng mục 'Chủ đề tuần'", () => {
    const ten = NHOM_MENU.map((n) => n.ten);
    const i = ten.indexOf("Nội dung");
    expect(i).toBeGreaterThan(-1);
    expect(ten[i - 1]).toBe("Tổng quan");
    expect(ten[i + 1]).toBe("Kiểm duyệt");
    // Đợt C chỉ thêm "Chủ đề tuần"; "Bản tin" vào cùng trang thật của nó (đợt D).
    expect(NHOM_MENU[i].muc.map((m) => [m.duong_dan, m.nhan])).toEqual([
      ["/chu-de", "Chủ đề tuần"],
    ]);
  });
});

test.describe("§3.1 — phần thuần của /chu-de", () => {
  test("nhãn tuần DD/MM–DD/MM, vắt tháng và vắt năm", () => {
    expect(nhanTuan("2026-11-09")).toBe("09/11–15/11");
    expect(nhanTuan("2026-11-30")).toBe("30/11–06/12");
    expect(nhanTuan("2026-12-28", "2027-01-03")).toBe("28/12–03/01");
  });

  test("gom theo tuan_bat_dau, giữ thứ tự server, hai hàng cùng tuần chung nhóm dù không liền kề", () => {
    const n = nhomChuDeTheoTuan([
      { id: 5, tuan_bat_dau: "2026-11-16" },
      { id: 4, tuan_bat_dau: "2026-11-09" },
      { id: 3, tuan_bat_dau: "2026-11-16" },
      { id: 1, tuan_bat_dau: "2026-11-02" },
    ]);
    expect(n.map((x) => [x.khoa, x.nhan, x.items.map((i) => i.id)])).toEqual([
      ["2026-11-16", "16/11–22/11", [5, 3]],
      ["2026-11-09", "09/11–15/11", [4]],
      ["2026-11-02", "02/11–08/11", [1]],
    ]);
  });

  test("nút trên hàng: Đóng khi đang mở và không khoá; Mở lại theo co_the_mo_lai của server", () => {
    expect(nutChuDe({ trang_thai: "mo", da_khoa: false, co_the_mo_lai: false })).toBe("dong");
    expect(nutChuDe({ trang_thai: "mo", da_khoa: true, co_the_mo_lai: false })).toBeNull();
    expect(nutChuDe({ trang_thai: "dong", da_khoa: false, co_the_mo_lai: true })).toBe("mo_lai");
    expect(nutChuDe({ trang_thai: "dong", da_khoa: false, co_the_mo_lai: false })).toBeNull();
    expect(nutChuDe({ trang_thai: "hen_gio", da_khoa: false, co_the_mo_lai: false })).toBeNull();
    expect(nutChuDe({ trang_thai: "bi_an", da_khoa: false, co_the_mo_lai: false })).toBeNull();
  });

  test("bốn trạng thái đều có nhãn", () => {
    expect(Object.keys(NHAN_TRANG_THAI_CHU_DE).sort()).toEqual(["bi_an", "dong", "hen_gio", "mo"]);
  });

  test("trang /chu-de đọc ba ô từ server và mở form đăng bài dùng chung", () => {
    const trang = nguon("app/chu-de/page.tsx");
    expect(trang).toMatch(/du_lieu\.dang_tren_trang_chu/);
    expect(trang).toMatch(/du_lieu\.tuan_nay/);
    expect(trang).toMatch(/du_lieu\.tuan_sau/);
    expect(trang).toMatch(/<FormDangBai\b/);
    // Hai cửa ghi đi qua đúng endpoint của trang chủ đề, mỗi cửa một lần.
    expect(trang.match(/quanTriDongChuDe\(\{/g)).toHaveLength(1);
    expect(trang.match(/quanTriMoLaiChuDe\(\{/g)).toHaveLength(1);
  });
});

test("nút 'Tạo chủ đề tuần sau' mở ngăn kéo có form đặt sẵn loại thao_luan", () => {
  const trang = nguon("app/chu-de/page.tsx");
  // Ô tuần sau nối `onTao` mở ngăn kéo tạo…
  expect(trang).toMatch(
    /<OTuan\s+ten="Tuần sau"[\s\S]*?onTao=\{\(\) => datMoTao\(true\)\}[\s\S]*?\/>/,
  );
  // …nút trong ô gọi đúng `onTao`…
  expect(trang).toMatch(/onClick=\{onTao\}[\s\S]*?data-testid=\{`\$\{testid\}-tao`\}/);
  // …và ngăn kéo `mo_tao` vẽ FormDangBai với loại đặt sẵn.
  const ngan = trang.slice(trang.indexOf("mo={mo_tao}"));
  const the = /<FormDangBai\b[\s\S]*?\/>/.exec(ngan)?.[0] ?? "";
  expect(the).toMatch(/\bloai_mach_ban_dau="thao_luan"/);
});


test.describe("vòng sửa 1", () => {
  test("hàng bị ẩn / hẹn giờ: không nút nào, kể cả khi co_the_mo_lai = true", () => {
    expect(nutChuDe({ trang_thai: "bi_an", da_khoa: false, co_the_mo_lai: true })).toBeNull();
    expect(nutChuDe({ trang_thai: "hen_gio", da_khoa: false, co_the_mo_lai: true })).toBeNull();
    expect(nutChuDe({ trang_thai: "dong", da_khoa: false, co_the_mo_lai: true })).toBe("mo_lai");
  });

  test("hộp xác nhận mở lại: tác giả là mod đang đăng nhập ⇒ mất hẳn; người khác ⇒ lưu nhật ký", () => {
    expect(soPhanTongKetKhiMoLai("mod_a", "mod_a")).toBe("mat_han");
    expect(soPhanTongKetKhiMoLai("gikky", "mod_a")).toBe("luu_nhat_ky");
    const trang = nguon("app/chu-de/page.tsx");
    expect(trang).toMatch(
      /soPhanTongKetKhiMoLai\(mo_mo_lai\.tac_gia, mod\.username\) === "mat_han"/,
    );
    expect(trang).toMatch(/data-testid="mo-lai-mat-han"/);
    expect(trang).toMatch(/data-testid="mo-lai-luu-nhat-ky"/);
  });

  test("đóng ngăn kéo tạo chủ đề cũng nạp lại trang", () => {
    const trang = nguon("app/chu-de/page.tsx");
    const ngan = trang.slice(trang.indexOf("mo={mo_tao}"));
    const the = /<FormDangBai\b[\s\S]*?\/>/.exec(ngan)?.[0] ?? "";
    expect(the).toMatch(/dong=\{\(\) => \{\s*dongNganTao\(\);\s*void nap\(\);\s*\}\}/);
  });
});
