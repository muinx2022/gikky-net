import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BanTinChiTietOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import {
  DUONG_DAN_TRANG_BAN_TIN,
  anhOgBanTin,
  KHUNG_BAN_TIN,
  SUB_BAN_TIN,
  duongDanBanTin,
  gioVN,
  khungTheoThuTu,
  ngayBanTinHopLe,
  ngayDayDuBanTin,
  subDangDuoc,
  tachGiaTri,
  thuNganBanTin,
} from "../../lib/ban-tin";
import { nenDem } from "../../lib/dem-luot-xem";
import { ogBanTin } from "../../lib/og";
import { boChuThich } from "./quet";

const WEB = resolve(__dirname, "..", "..");
const GOC = resolve(WEB, "..", "..");
const doc = (duong: string) => readFileSync(resolve(GOC, duong), "utf8");

/** Bản tin bảng riêng — phần HÀM THUẦN của đợt B (plan `2026-11-13-ban-tin-bang-rieng.md` §3.5,
 * §5 B1–B8). Phần DOM thật ở `e2e/ban-tin.spec.ts`. */

test("SUB_BAN_TIN khớp hằng của Django (một bản sao bắt buộc, không được lệch)", () => {
  const py = doc("api/core/models/ban_tin.py");
  const m = /^SUB_BAN_TIN\s*=\s*"([^"]+)"/m.exec(py);
  expect(m, "không thấy SUB_BAN_TIN trong api/core/models/ban_tin.py").not.toBeNull();
  expect(SUB_BAN_TIN).toBe(m![1]);
  expect(duongDanBanTin("2026-11-13")).toBe("/s/tin-tuc/2026-11-13");
});

test("ngayBanTinHopLe: chỉ YYYY-MM-DD của một ngày CÓ THẬT", () => {
  for (const d of ["2026-11-13", "2024-02-29", "2026-01-01", "2026-12-31"]) {
    expect(ngayBanTinHopLe(d), d).toBe(true);
  }
  for (const d of [
    "2026-13-45",
    "2026-02-30",
    "2025-02-29",
    "2026-00-10",
    "20261113",
    "2026-1-03",
    "2026-11-13 ",
    "2026-11-13x",
    "",
    "tin-tuc",
  ]) {
    expect(ngayBanTinHopLe(d), JSON.stringify(d)).toBe(false);
  }
});

test("ngày đầy đủ + thứ: tính trên NGÀY thuần, không qua múi giờ máy chạy", () => {
  expect(ngayDayDuBanTin("2026-11-13")).toBe("Thứ Sáu, 13/11/2026");
  expect(ngayDayDuBanTin("2026-11-15")).toBe("Chủ Nhật, 15/11/2026");
  expect(ngayDayDuBanTin("2026-11-16")).toBe("Thứ Hai, 16/11/2026");
  expect(thuNganBanTin("2026-11-13")).toBe("T6");
  expect(thuNganBanTin("2026-11-15")).toBe("CN");
  expect(thuNganBanTin("2026-11-14")).toBe("T7");
});

test("gioVN: giờ Việt Nam của dấu thời gian server (23:30 UTC = 06:30 hôm sau)", () => {
  expect(gioVN("2026-11-12T23:30:00Z")).toBe("06:30");
  expect(gioVN("2026-11-13T06:12:00+07:00")).toBe("06:12");
  expect(gioVN("2026-11-13T12:35:00Z")).toBe("19:35");
});

const khung = (k: BanTinChiTietOut["khung"][number]["khung"]): BanTinChiTietOut["khung"][number] => ({
  khung: k,
  ten: k,
  created_at: "2026-11-13T00:00:00Z",
  body: `<p>${k}</p>`,
  figures: null,
});

test("khungTheoThuTu: ĐÚNG thứ tự đêm qua → trước phiên VN → trước phiên Mỹ dù mảng vào lệch; khung thiếu = null", () => {
  expect(KHUNG_BAN_TIN.map((k) => k.khoa)).toEqual(["dem_qua", "truoc_phien_vn", "truoc_phien_my"]);
  expect(KHUNG_BAN_TIN.map((k) => k.neo)).toEqual(["dem-qua", "truoc-phien-vn", "truoc-phien-my"]);
  const day_du = khungTheoThuTu([khung("truoc_phien_my"), khung("dem_qua"), khung("truoc_phien_vn")]);
  expect(day_du.map((h) => h.khung?.khung)).toEqual(["dem_qua", "truoc_phien_vn", "truoc_phien_my"]);
  const thieu = khungTheoThuTu([khung("truoc_phien_my"), khung("dem_qua")]);
  expect(thieu.map((h) => h.khoa)).toEqual(["dem_qua", "truoc_phien_vn", "truoc_phien_my"]);
  expect(thieu.map((h) => h.khung === null)).toEqual([false, true, false]);
  expect(thieu[1].gioDuKien).toBe("~08:10");
  expect(khungTheoThuTu([]).every((h) => h.khung === null)).toBe(true);
});

test("tachGiaTri: tách phần TRONG NGOẶC CUỐI để tô màu theo dấu; không ngoặc ⇒ nguyên", () => {
  expect(tachGiaTri("5.432,1 (-0,35%)")).toEqual({ chinh: "5.432,1", ngoac: "-0,35%" });
  expect(tachGiaTri("1.280,5 (+0,42%)")).toEqual({ chinh: "1.280,5", ngoac: "+0,42%" });
  expect(tachGiaTri("78,3 (−1,1%)")).toEqual({ chinh: "78,3", ngoac: "−1,1%" });
  expect(tachGiaTri("104,2")).toEqual({ chinh: "104,2", ngoac: null });
  expect(tachGiaTri("(-0,35%)")).toEqual({ chinh: "(-0,35%)", ngoac: null });
  expect(tachGiaTri("4.100 (đỉnh) USD")).toEqual({ chinh: "4.100 (đỉnh) USD", ngoac: null });
});

test("subDangDuoc: bỏ chuyên mục bản tin khỏi ô chọn khi đăng mạch, giữ thứ tự, không đột biến", () => {
  const vao = [{ slug: "vi-mo" }, { slug: SUB_BAN_TIN }, { slug: "hoi-dap" }];
  expect(subDangDuoc(vao).map((s) => s.slug)).toEqual(["vi-mo", "hoi-dap"]);
  expect(vao.length).toBe(3);
});

test("form đăng mạch + ngăn đăng nhanh lọc qua subDangDuoc (không còn tin-tuc trong ô chọn)", () => {
  const trang = boChuThich(doc("apps/web/app/dang-mach/page.tsx"));
  expect(trang).toMatch(/cacSub=\{subDangDuoc\(cac_sub\)\}/);
  const drawer = boChuThich(doc("apps/web/components/drawer-dang-nhanh.tsx"));
  expect(drawer).toMatch(/docCacSubOTrinhDuyet\(\)\s*\.then\(subDangDuoc\)/);
});

test("lượt xem: nhận `/s/tin-tuc/<YYYY-MM-DD>`, không nhận `/s/x/y` bất kỳ", () => {
  for (const d of ["/s/tin-tuc/2026-11-13", "/s/tin-tuc/2026-11-13/"]) {
    expect(nenDem(d), d).toBe(true);
    expect(DUONG_DAN_TRANG_BAN_TIN.test(d), d).toBe(true);
  }
  for (const d of [
    "/s/chung-khoan/2026-11-13",
    "/s/tin-tuc/abc",
    "/s/tin-tuc/20261113",
    "/s/tin-tuc/2026-11-13/x",
    "/s/x/y",
    "/s/tin-tuc/opengraph-image",
  ]) {
    expect(nenDem(d), d).toBe(false);
  }
  // Trang danh sách vẫn được đếm như mọi trang sub.
  expect(nenDem("/s/tin-tuc")).toBe(true);
  // Bản Django nhận đúng cùng dạng đường dẫn (không có dấu `/` cuối — Next đã bỏ trước khi gửi).
  const py = doc("api/api/dem_luot_xem.py");
  expect(py).toContain(
    'DUONG_DAN_BAN_TIN = re.compile(rf"^/s/{re.escape(SUB_BAN_TIN)}/(\\d{{4}}-\\d{{2}}-\\d{{2}})$")',
  );
});

test("trang chủ + KhoiBaiViet không còn chọn bản tin từ feed bài viết", () => {
  const nhom = boChuThich(doc("apps/web/lib/nhom-bai-viet.ts"));
  // `SUB_BAN_TIN` còn đúng một chỗ dùng — lọc phòng thủ của `chonMoiDang` (vòng sửa 1) — và đi
  // qua import, không gõ lại slug.
  expect(nhom).not.toMatch(/chonBanTin|tin-tuc/);
  const trang_chu = boChuThich(doc("apps/web/app/page.tsx"));
  expect(trang_chu).toMatch(/docDanhSachBanTin\(\{\s*limit:\s*SO_BAN_TIN_DAI\s*\}\)/);
  expect(trang_chu).not.toMatch(/chonBanTin/);
});

test("301 /m/ cũ: chỉ hỏi `tim_ban_tin_tu_mach_cu` SAU KHI `xem_mach` trả null (không thêm lời gọi vào đường thành công)", () => {
  const nguon = boChuThich(doc("apps/web/components/trang-mach.tsx"));
  const nap = /async function nap\([\s\S]*?\n\}/.exec(nguon);
  expect(nap, "không thấy hàm nap").not.toBeNull();
  const than = nap![0];
  const i_mach = than.indexOf("docMach(");
  const i_null = than.indexOf("mach === null");
  const i_tim = than.indexOf("docNgayBanTinTuMachCu(");
  expect(i_mach).toBeGreaterThan(0);
  expect(i_tim, "phải có lời gọi tìm bản tin từ mạch cũ").toBeGreaterThan(0);
  expect(i_null).toBeGreaterThan(i_mach);
  expect(i_tim, "lời gọi phải nằm SAU nhánh mạch null").toBeGreaterThan(i_null);
  expect(than).toMatch(/if \(mach === null\) \{[\s\S]*docNgayBanTinTuMachCu\([\s\S]*permanentRedirect\(duongDanBanTin\(/);
});

test("301 /m/ cũ: lời tra hỏng (5xx, mạng) ⇒ console.error + 404, KHÔNG thành 500; redirect/notFound đứng ngoài try", () => {
  const nguon = boChuThich(doc("apps/web/components/trang-mach.tsx"));
  const than = /async function nap\([\s\S]*?\n\}/.exec(nguon)![0];
  // `lay()` ném với mọi mã khác 404 ⇒ lời tra phải nằm trong `try`, lỗi đi vào `console.error`.
  // Thân `catch` cắt tới dấu `}` ĐỨNG RIÊNG một dòng — chuỗi log có `${…}` bên trong.
  const khoi = /try \{([\s\S]*?)\} catch \((\w+)\) \{([\s\S]*?)\n\s*\}\n/.exec(than);
  expect(khoi, "lời tra phải bọc trong try/catch").not.toBeNull();
  expect(khoi![1]).toMatch(/docNgayBanTinTuMachCu\(/);
  expect(khoi![3]).toMatch(/console\.error\(/);
  // Catch không ném lại, không tự quyết redirect — để luồng rơi xuống `notFound()`.
  expect(khoi![3]).not.toMatch(/\bthrow\b|permanentRedirect|notFound/);
  // `permanentRedirect`/`notFound` ném lỗi đặc biệt của Next: đặt trong `try` là bị `catch` nuốt.
  expect(khoi![1]).not.toMatch(/permanentRedirect|notFound/);
  const sau = than.slice(than.indexOf(khoi![0]) + khoi![0].length);
  expect(sau).toMatch(/permanentRedirect\(duongDanBanTin\([\s\S]*notFound\(\)/);
});

test("ảnh OG bản tin: nhãn có ngày từ `ngay`, tiêu đề gọn, ≤ 3 cặp số liệu của khung ĐẦU có số liệu", () => {
  const og = ogBanTin({
    ngay: "2026-11-13",
    title: "Bản tin 13/11 — S&P 500 tăng 2,35%",
    khung: [
      { figures: null },
      {
        figures: [
          { label: "VN-Index", value: "1.280,5 (+0,42%)" },
          { label: "DXY", value: "104,2" },
          { label: "Vàng", value: "2.401" },
          { label: "Dầu", value: "78,3" },
        ],
      },
      { figures: [{ label: "KHÁC", value: "1" }] },
    ],
  });
  expect(og.nhan).toBe("Bản tin thị trường · Thứ Sáu, 13/11/2026");
  expect(og.tieuDe).toBe("S&P 500 tăng 2,35%");
  expect(og.dongPhu.startsWith("VN-Index 1.280,5 (+0,42%) · DXY 104,2")).toBe(true);
  expect(og.dongPhu).not.toContain("Dầu");
  expect(og.dongPhu).not.toContain("KHÁC");
  expect(Array.from(og.dongPhu).length).toBeLessThanOrEqual(56);
  expect(og.soOSpine).toBe(0);
  expect(og.dongSo).toBe(false);
  expect(ogBanTin({ ngay: "2026-11-13", title: "X", khung: [] }).dongPhu).toBe("");
  // Trần SỐ CẶP đo riêng bằng cặp ngắn (bốn cặp ngắn vừa trần ký tự, nên chỉ trần số cặp chặn được
  // cặp thứ tư — ca trên thì trần ký tự đã cắt trước).
  const ngan = ["A", "B", "C", "D"].map((l, i) => ({ label: l, value: String(i + 1) }));
  expect(ogBanTin({ ngay: "2026-11-13", title: "X", khung: [{ figures: ngan }] }).dongPhu).toBe(
    "A 1 · B 2 · C 3",
  );
  // Đường ảnh: một chỗ dựng cho metadata + JSON-LD; route ảnh không phải một lượt xem trang.
  expect(anhOgBanTin("2026-11-13")).toBe("/s/tin-tuc/2026-11-13/opengraph-image");
  expect(nenDem(anhOgBanTin("2026-11-13"))).toBe(false);
});
