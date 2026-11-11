import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import * as ts from "typescript";

import {
  LOC_CHU_DE_DANG_MO,
  canKiemChuDeMo,
  dinhDangGioHen,
  laChuDeDangMo,
  quyetDinhCanhBaoChuDe,
  type HangChuDe,
  type KetQuaDanhSachChuDe,
} from "../../../admin/lib/canh-bao-chu-de";
import { boChuThich } from "./quet";

/** V3-2 — cảnh báo "đang có chủ đề đang mở" khi tạo chủ đề thứ hai
 * (`apps/admin/lib/canh-bao-chu-de.ts`, plan homepage-v2 vòng sửa 3).
 *
 * Luật cần ghim: cảnh báo là THÔNG TIN, không phải cổng.
 * - có chủ đề thật sự đang mở ⇒ cảnh báo, kèm tiêu đề;
 * - không có ⇒ không cảnh báo;
 * - loại khác "Chủ đề thảo luận" ⇒ không gọi danh sách, không cảnh báo;
 * - lỗi gọi danh sách ⇒ KHÔNG cảnh báo (và form vẫn đăng — xem bài đọc nguồn cuối file);
 * - chủ đề ẩn / khoá / chờ giờ hẹn / lưu trữ / đã đóng không kích hoạt cảnh báo.
 * Hai tầng canh như `loai-mach-quan-tri.spec.ts`: hàm thuần (đo giá trị) và nguồn của form
 * (cái nối dây). Lần chạy thật trên trình duyệt + DB nháp là phần của báo cáo, không nằm trong bộ này. */

const ADMIN = resolve(__dirname, "..", "..", "..", "admin");
const form = () =>
  boChuThich(readFileSync(resolve(ADMIN, "components/form-dang-bai.tsx"), "utf8"));

function hang(id: number, title: string, ghi_de: Partial<HangChuDe> = {}): HangChuDe {
  return {
    id,
    title,
    status: "open",
    da_bi_an: false,
    da_khoa: false,
    da_luu_tru: false,
    da_hen_gio: false,
    loai_mach: "thao_luan",
    ...ghi_de,
  };
}
const ok = (items: HangChuDe[], tong?: number): KetQuaDanhSachChuDe => ({ ok: true, items, tong });
const LOI: KetQuaDanhSachChuDe = { ok: false };

test("có một chủ đề đang mở ⇒ cảnh báo, nêu đúng tiêu đề và đúng câu hỏi", () => {
  const qd = quyetDinhCanhBaoChuDe("thao_luan", ok([hang(1, "Vàng đi đâu?")]));
  expect(qd.canh_bao).toBe(true);
  if (!qd.canh_bao) return;
  expect(qd.tieu_de).toEqual(["Vàng đi đâu?"]);
  expect(qd.con_lai).toBe(0);
  expect(qd.thong_diep).toBe(
    "Đang có chủ đề đang mở: «Vàng đi đâu?». " +
      "Chủ đề mới sẽ thay nó ở trang chủ (chủ đề cũ vẫn còn ở /chu-de). Vẫn tạo?",
  );
  expect(qd.dong_gio).toBeNull();
});

test("không có chủ đề đang mở ⇒ không cảnh báo, không đánh dấu lỗi", () => {
  expect(quyetDinhCanhBaoChuDe("thao_luan", ok([]))).toEqual({
    canh_bao: false,
    khong_kiem_duoc: false,
  });
});

test("ẩn / khoá / chờ giờ hẹn / lưu trữ / đã đóng KHÔNG kích hoạt cảnh báo", () => {
  const khong_tinh = [
    hang(1, "Bị ẩn", { da_bi_an: true }),
    hang(2, "Bị khoá", { da_khoa: true }),
    // Mỗi cờ đo RIÊNG: server luôn trả chờ-hẹn-giờ kèm `da_bi_an=true`, nhưng bài đo không được
    // dựa vào đó — bỏ một cờ mà cờ kia che thì bài đo vẫn xanh.
    hang(3, "Chờ hẹn giờ (chỉ cờ da_hen_gio)", { da_hen_gio: true }),
    hang(9, "Chờ hẹn giờ (như server trả)", { da_hen_gio: true, da_bi_an: true }),
    hang(4, "Đã lưu trữ", { da_luu_tru: true }),
    hang(5, "Đã đóng", { status: "closed" }),
    hang(6, "Nhật ký lạc vào", { loai_mach: "nhat_ky" }),
  ];
  for (const h of khong_tinh) {
    expect(laChuDeDangMo(h), h.title).toBe(false);
    expect(quyetDinhCanhBaoChuDe("thao_luan", ok([h])).canh_bao, h.title).toBe(false);
  }
  expect(quyetDinhCanhBaoChuDe("thao_luan", ok(khong_tinh)).canh_bao).toBe(false);
  // …nhưng một chủ đề mở thật nằm lẫn trong đám ấy vẫn kích hoạt, và chỉ nó được nêu tên.
  const lan = quyetDinhCanhBaoChuDe("thao_luan", ok([...khong_tinh, hang(7, "Còn mở")]));
  expect(lan.canh_bao).toBe(true);
  if (lan.canh_bao) expect(lan.tieu_de).toEqual(["Còn mở"]);
});

test("loại khác 'Chủ đề thảo luận' ⇒ không gọi danh sách, không cảnh báo dù danh sách có chủ đề mở", () => {
  for (const loai of ["", "nhat_ky", "bai_viet"] as const) {
    expect(canKiemChuDeMo(loai), loai).toBe(false);
    expect(quyetDinhCanhBaoChuDe(loai, ok([hang(1, "Đang mở")])), loai).toEqual({
      canh_bao: false,
      khong_kiem_duoc: false,
    });
    // …kể cả khi lỡ có kết quả lỗi: không phải loại cần kiểm thì cũng không có gì "không kiểm được".
    expect(quyetDinhCanhBaoChuDe(loai, LOI), loai).toEqual({
      canh_bao: false,
      khong_kiem_duoc: false,
    });
  }
  expect(canKiemChuDeMo("thao_luan")).toBe(true);
});

test("lỗi gọi danh sách ⇒ KHÔNG cảnh báo (không phải cổng), chỉ đánh dấu 'không kiểm được'", () => {
  expect(quyetDinhCanhBaoChuDe("thao_luan", LOI)).toEqual({
    canh_bao: false,
    khong_kiem_duoc: true,
  });
});

test("chưa có kết quả (null) ⇒ không cảnh báo", () => {
  expect(quyetDinhCanhBaoChuDe("thao_luan", null)).toEqual({
    canh_bao: false,
    khong_kiem_duoc: false,
  });
});

test("hẹn giờ ở tương lai vẫn cảnh báo và nêu giờ lên sóng; không hẹn thì không có dòng giờ", () => {
  const hen = quyetDinhCanhBaoChuDe("thao_luan", ok([hang(1, "A")]), "12/11/2026 09:00");
  expect(hen.canh_bao).toBe(true);
  if (hen.canh_bao) expect(hen.dong_gio).toContain("12/11/2026 09:00");
  const ngay = quyetDinhCanhBaoChuDe("thao_luan", ok([hang(1, "A")]), null);
  expect(ngay.canh_bao && ngay.dong_gio).toBeNull();
  // Có giờ hẹn mà không có chủ đề mở thì vẫn không cảnh báo: giờ chỉ là chi tiết của cảnh báo.
  expect(quyetDinhCanhBaoChuDe("thao_luan", ok([]), "12/11/2026 09:00").canh_bao).toBe(false);
});

test("giờ hẹn datetime-local được định dạng dd/mm/yyyy HH:mm", () => {
  expect(dinhDangGioHen("2026-11-12T09:05")).toBe("12/11/2026 09:05");
  expect(dinhDangGioHen("không-phải-giờ")).toBe("không-phải-giờ");
});

test("nhiều chủ đề mở: nêu tối đa 3 tiêu đề, phần còn lại đếm đúng (kể cả hàng bị limit cắt)", () => {
  const nam = [1, 2, 3, 4, 5].map((i) => hang(i, `Đề ${i}`));
  const a = quyetDinhCanhBaoChuDe("thao_luan", ok(nam));
  expect(a.canh_bao && a.tieu_de).toEqual(["Đề 1", "Đề 2", "Đề 3"]);
  expect(a.canh_bao && a.con_lai).toBe(2);
  expect(a.canh_bao && a.thong_diep).toContain(" và 2 chủ đề khác. ");
  // Server báo tong=8 nhưng chỉ trả 5 hàng (limit) ⇒ còn 5 chưa nêu tên.
  const b = quyetDinhCanhBaoChuDe("thao_luan", ok(nam, 8));
  expect(b.canh_bao && b.con_lai).toBe(5);
});

test("bộ lọc gửi server: đúng loai_mach=thao_luan, trang_thai=mo, và limit hữu hạn", () => {
  expect(LOC_CHU_DE_DANG_MO.loai_mach).toBe("thao_luan");
  // `mo` là nhóm "đang mở" của khu quản trị (loại ẩn / khoá / chờ hẹn giờ) — KHÔNG phải `chua_go`.
  expect(LOC_CHU_DE_DANG_MO.trang_thai).toBe("mo");
  expect(LOC_CHU_DE_DANG_MO.limit).toBeGreaterThanOrEqual(3);
});

test("form THẬT: chỉ gọi danh sách khi cần, lỗi không chặn, có hai nút và không chặn đăng", () => {
  const sach = form();
  // Danh sách gọi đúng hàm sinh ra, kèm baseUrl và bộ lọc dùng chung.
  expect(sach).toMatch(/quanTriLietKeMach\(\{[\s\S]*?baseUrl:\s*GOC_API[\s\S]*?query:\s*LOC_CHU_DE_DANG_MO/);
  // Chỉ gọi khi `canKiemChuDeMo(loai_mach)`.
  expect(sach).toMatch(/canKiemChuDeMo\(\s*loai_mach\s*\)/);
  // Quyết định đi qua hàm thuần, không tự dựng điều kiện trong form.
  expect(sach).toMatch(/quyetDinhCanhBaoChuDe\(/);
  // Lỗi mạng (ném) và lỗi HTTP đều thành { ok: false } — có try/catch quanh lời gọi.
  expect(sach).toMatch(/try\s*\{[\s\S]*?quanTriLietKeMach\([\s\S]*?\}\s*catch/);
  // Hai nút có đủ chữ và testid.
  expect(sach).toMatch(/data-testid="nut-van-tao-chu-de"/);
  expect(sach).toMatch(/data-testid="nut-huy-canh-bao-chu-de"/);
  expect(sach).toMatch(/Vẫn tạo chủ đề/);
  expect(sach).toMatch(/data-testid="canh-bao-chu-de-dang-mo"/);
  expect(sach).toMatch(/data-testid="khong-kiem-duoc-chu-de-mo"/);
  // Cảnh báo không phải cổng: không có `return` nào chặn đăng ngoài nhánh chờ xác nhận, và
  // nút "Vẫn tạo chủ đề" gọi lại `gui` với cờ đã xác nhận.
  expect(sach).toMatch(/gui\(\s*true\s*\)/);
});

/* ---------------------------------------------------------------------------------------- */
/* Vòng sửa 4 — "cảnh báo THẬT SỰ chặn": phân tích CẤU TRÚC của hàm `gui`, không đọc regex.
 *
 * Bài regex ở trên chỉ chứng minh các token CÓ MẶT. Phá thử xoá `return;` sau
 * `datCanhBao(qd);` vẫn xanh 15/15 — mà đó chính là điều biến cảnh báo thành thứ chạy xong rồi
 * VẪN tạo bài. Bài này đi qua AST của TypeScript: */

type LoiCanhBao = string;

/** Trả danh sách lỗi cấu trúc của hàm `gui` trong nguồn form (rỗng = đúng). Nhận chuỗi nguồn để
 * bài tự-kiểm bên dưới chạy được trên nguồn đã bị làm hỏng. */
function kiemCanhBaoChan(nguon: string): LoiCanhBao[] {
  const loi: LoiCanhBao[] = [];
  const sf = ts.createSourceFile("form.tsx", nguon, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  let gui: ts.FunctionDeclaration | undefined;
  const timGui = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === "gui") gui = n;
    ts.forEachChild(n, timGui);
  };
  timGui(sf);
  if (gui === undefined || gui.body === undefined) return ["không tìm thấy hàm gui"];
  const than: ts.Block = gui.body;

  const goiToi = (n: ts.Node, ten: string): n is ts.CallExpression =>
    ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === ten;
  const tatCa = (goc: ts.Node, loc: (n: ts.Node) => boolean) => {
    const ra: ts.Node[] = [];
    const di = (n: ts.Node) => {
      if (loc(n)) ra.push(n);
      ts.forEachChild(n, di);
    };
    di(goc);
    return ra;
  };

  // Lời gọi đặt cảnh báo: `datCanhBao(qd)` (đối số KHÔNG phải `null`; `datCanhBao(null)` là xoá).
  const dat = tatCa(than, (n) => {
    if (!goiToi(n, "datCanhBao")) return false;
    const [d] = n.arguments;
    return d !== undefined && !(d.kind === ts.SyntaxKind.NullKeyword);
  }) as ts.CallExpression[];
  if (dat.length === 0) return ["gui không còn lời gọi datCanhBao(<quyết định>)"];

  // Lời gọi TẠO mạch (nằm trong `chay(async () => …)`).
  const tao = tatCa(than, (n) => goiToi(n, "quanTriTaoMachHenGio"));
  const chay = tatCa(than, (n) => goiToi(n, "chay"));
  if (tao.length === 0) loi.push("gui không còn lời gọi quanTriTaoMachHenGio");
  if (chay.length === 0) loi.push("gui không còn lời gọi chay(…) bọc việc tạo mạch");
  const tao_dau = chay.length > 0 ? chay[0].getStart(sf) : (tao[0]?.getStart(sf) ?? Infinity);

  for (const lenh of dat) {
    const cau = lenh.parent; // ExpressionStatement
    const khoi = cau?.parent;
    if (!cau || !ts.isExpressionStatement(cau) || !khoi || !ts.isBlock(khoi)) {
      loi.push("datCanhBao(qd) không đứng thành một câu lệnh riêng trong khối if");
      continue;
    }
    // 1. Khối ấy là nhánh `then` của `if (qd.canh_bao)`.
    const nhanh = khoi.parent;
    if (
      !nhanh ||
      !ts.isIfStatement(nhanh) ||
      nhanh.thenStatement !== khoi ||
      nhanh.expression.getText(sf).replace(/\s+/g, "") !== "qd.canh_bao"
    ) {
      loi.push("datCanhBao(qd) không nằm trong nhánh then của if (qd.canh_bao)");
      continue;
    }
    // 2. Câu NGAY SAU nó là `return;` — không có gì chen giữa, không có nhánh else bù.
    const i = khoi.statements.indexOf(cau);
    const ke = khoi.statements[i + 1];
    if (ke === undefined || !ts.isReturnStatement(ke) || ke.expression !== undefined) {
      loi.push(
        "câu ngay sau datCanhBao(qd) không phải 'return;' — cảnh báo đặt xong mà vẫn chạy tiếp xuống tạo mạch",
      );
    }
    // 3. Nhánh cảnh báo đứng TRƯỚC lời gọi tạo mạch (nếu sau, nó chẳng chặn được gì).
    if (nhanh.getEnd() > tao_dau) loi.push("nhánh cảnh báo đứng SAU lời gọi tạo mạch");
  }

  // 4. Lời gọi tạo mạch không được nằm trong chính nhánh `if (qd.canh_bao)`.
  for (const n of [...chay, ...tao]) {
    for (let cha: ts.Node | undefined = n.parent; cha; cha = cha.parent) {
      if (ts.isIfStatement(cha) && cha.expression.getText(sf).replace(/\s+/g, "") === "qd.canh_bao") {
        loi.push("việc tạo mạch nằm TRONG nhánh if (qd.canh_bao)");
        break;
      }
    }
  }
  return loi;
}

test("cảnh báo THẬT SỰ chặn (AST): sau datCanhBao(qd) là 'return;', nhánh đứng trước việc tạo mạch", () => {
  expect(kiemCanhBaoChan(form())).toEqual([]);
});

test("bài đo AST biết nói KHÔNG: nguồn bị làm hỏng theo từng kiểu đều bị bắt", () => {
  const sach = form();
  const co = (mau: RegExp) => {
    expect(mau.test(sach), `mẫu ${mau} phải có trong nguồn form để làm hỏng`).toBe(true);
    return mau;
  };
  const HONG: Record<string, string> = {
    // Ca phản biện đã dựng: xoá `return;` ngay sau `datCanhBao(qd);`.
    "xoá return": sach.replace(co(/(datCanhBao\(qd\);)\s*return;/), "$1"),
    // Chen một câu giữa đặt cảnh báo và return.
    "chen câu trước return": sach.replace(co(/(datCanhBao\(qd\);)(\s*return;)/), "$1 datNhac(null);$2"),
    // Đảo điều kiện: cảnh báo chỉ chặn khi KHÔNG có cảnh báo.
    "đảo điều kiện": sach.replace(co(/if\s*\(\s*qd\.canh_bao\s*\)/), "if (!qd.canh_bao)"),
    // Bỏ hẳn lời đặt cảnh báo.
    "bỏ datCanhBao(qd)": sach.replace(co(/datCanhBao\(qd\);\s*return;/), "return;"),
    // `return` còn đó nhưng có điều kiện ⇒ không chặn khi điều kiện sai.
    "return có điều kiện": sach.replace(co(/(datCanhBao\(qd\);)\s*return;/), "$1 if (da_xac_nhan) return;"),
  };
  for (const [ten, nguon] of Object.entries(HONG)) {
    expect(nguon, `${ten}: nguồn phải thật sự đổi`).not.toBe(sach);
    expect(kiemCanhBaoChan(nguon).length, `${ten}: phải bị bắt`).toBeGreaterThan(0);
  }
  // Không còn hàm gui ⇒ không im lặng báo xanh.
  expect(kiemCanhBaoChan("const x = 1;")).toEqual(["không tìm thấy hàm gui"]);
});
