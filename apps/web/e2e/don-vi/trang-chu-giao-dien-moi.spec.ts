import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { BinhLuanOut, LenhOut, MachTomTatOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { docTrangThai, trangThaiGuiLenApi } from "../../lib/api";
import { tomTatChanKhoi } from "../../lib/chan-khoi-nhat-ky";
import {
  chonQuanDiemNoiBat,
  chuChipChuDe,
  khoangTuanVN,
  trichQuanDiem,
} from "../../lib/chu-de";
import { cacOLenh, NHAN_CHIEU_LENH } from "../../lib/lenh";
import { LoiGhi } from "../../lib/ghi";
import {
  cauLoiGuiLenh,
  lenhFormRong,
  lenhFormTuBanNhap,
  lenhTuForm,
} from "../../lib/lenh-form";
import { nenMoNganKeo, type CuBamLoiVao } from "../../lib/loi-vao-nhat-ky";
import {
  NHOM_BAI_VIET,
  SO_BAI_MOI_NHOM,
  chiaNhomBaiViet,
  chonBanTin,
  slugChipChuyenMuc,
} from "../../lib/nhom-bai-viet";

/** Hàm THUẦN của trang chủ giao diện mới (plan `2026-11-11-homepage-v2-giao-dien-moi.md`).
 * Không mạng, không DB, không cổng — chạy được song song với bất cứ thứ gì (`pnpm e2e:don-vi`).
 * Phần DOM thật nằm ở `e2e/trang-chu-v2.spec.ts` (nhóm W). */

const WEB = resolve(__dirname, "..", "..");
const doc = (duong_dan: string) => readFileSync(resolve(WEB, duong_dan), "utf8");

/* ------------------------------------------------------------------------------ lệnh -- */

const LENH_DAY_DU: LenhOut = {
  chieu: "mua",
  ma: "CEO",
  gia_vao: "12.2",
  sl: "11.71",
  tp: "13.37",
  nhoi: "12.69",
  rr: "2.4",
};

test("dải lệnh: đủ ô theo thứ tự Entry · SL · TP · Nhồi · R:R, số in NGUYÊN VĂN từ server", () => {
  expect(cacOLenh(LENH_DAY_DU)).toEqual([
    { khoa: "entry", nhan: "Entry", gia_tri: "12.2" },
    { khoa: "sl", nhan: "SL", gia_tri: "11.71" },
    { khoa: "tp", nhan: "TP", gia_tri: "13.37" },
    { khoa: "nhoi", nhan: "Nhồi", gia_tri: "12.69" },
    { khoa: "rr", nhan: "R:R", gia_tri: "2.4" },
  ]);
});

test("dải lệnh: ô thiếu số thì bỏ hẳn — chỉ còn Entry khi chỉ khai chiều/mã/giá vào", () => {
  const toi_thieu: LenhOut = { chieu: "ban", ma: "USD/CHF", gia_vao: "0.8187" };
  expect(cacOLenh(toi_thieu)).toEqual([{ khoa: "entry", nhan: "Entry", gia_tri: "0.8187" }]);
  // null (API) cũng như vắng mặt.
  expect(
    cacOLenh({ ...toi_thieu, sl: "0.8223", tp: null, nhoi: null, rr: null }).map((o) => o.khoa),
  ).toEqual(["entry", "sl"]);
});

test("nhãn chiều lệnh phủ đủ hai chiều của API", () => {
  expect(NHAN_CHIEU_LENH).toEqual({ mua: "MUA", ban: "BÁN" });
});

test("form lệnh: trống hoàn toàn ⇒ không có lệnh, không lỗi", () => {
  expect(lenhTuForm(lenhFormRong)).toEqual({ lenh: null, loi: null });
  expect(lenhTuForm({ ...lenhFormRong, chieu: "ban" })).toEqual({ lenh: null, loi: null });
});

test("form lệnh: bỏ ô trống, giữ số dạng CHUỖI đúng như gõ (không đổi, không làm tròn)", () => {
  const kq = lenhTuForm({
    chieu: "ban",
    ma: " usd/jpy ",
    giaVao: "150.5",
    sl: "152",
    tp: "",
    nhoi: " 151.25 ",
  });
  expect(kq).toEqual({
    lenh: { chieu: "ban", ma: "usd/jpy", gia_vao: "150.5", sl: "152", nhoi: "151.25" },
    loi: null,
  });
});

test("form lệnh: dấu phẩy KHÔNG được tự đổi — báo lỗi, ở ô nào cũng vậy ('27,500' có thể là 27.5 hoặc 27500)", () => {
  const goc = { ...lenhFormRong, ma: "HPG", giaVao: "27.5" };
  for (const k of ["giaVao", "sl", "tp", "nhoi"] as const) {
    const kq = lenhTuForm({ ...goc, [k]: "27,500" });
    expect(kq, k).toEqual({ lenh: null, loi: "Dùng dấu chấm cho phần thập phân (vd 27.5)." });
  }
});

test("form lệnh: thiếu mã / thiếu giá vào / số sai ⇒ lỗi tiếng Việt, không lệnh", () => {
  expect(lenhTuForm({ ...lenhFormRong, giaVao: "10" }).loi).toContain("mã");
  expect(lenhTuForm({ ...lenhFormRong, ma: "HPG" }).loi).toContain("giá vào");
  expect(lenhTuForm({ ...lenhFormRong, ma: "HPG", giaVao: "10", sl: "abc" }).loi).toContain("SL");
  expect(lenhTuForm({ ...lenhFormRong, ma: "HPG", giaVao: "-5" }).loi).toContain("Giá vào");
  expect(lenhTuForm({ ...lenhFormRong, ma: "HPG", sl: "9" }).loi).toContain("giá vào");
  expect(lenhTuForm({ ...lenhFormRong, ma: "H P G", giaVao: "10" }).loi).toContain("Mã chỉ gồm");
});

test("form lệnh: giá > 0, tối đa 8 chữ số thập phân và 12 chữ số nguyên", () => {
  const f = (giaVao: string) => lenhTuForm({ ...lenhFormRong, ma: "HPG", giaVao });
  expect(f("0").loi).toBe("Giá vào phải lớn hơn 0.");
  expect(f("0.000").loi).toBe("Giá vào phải lớn hơn 0.");
  expect(f("0.00000001").loi).toBeNull();
  expect(f("0.123456789").loi).toBe("Giá vào tối đa 8 chữ số thập phân.");
  expect(f("123456789012.12345678").loi).toBeNull();
  expect(f("1234567890123").loi).toBe("Giá vào quá lớn (tối đa 12 chữ số nguyên).");
  // Số chữ số lẻ đếm theo cách GÕ (như server đếm `Decimal`), kể cả số 0 cuối.
  expect(f("0.0000000100").loi).toBe("Giá vào tối đa 8 chữ số thập phân.");
  expect(f("27.50000000").loi).toBeNull();
});

test("form lệnh: thứ tự SL / vào / TP theo chiều, bằng đúng câu của server", () => {
  const f = (chieu: "mua" | "ban", sl: string, tp: string) =>
    lenhTuForm({ ...lenhFormRong, chieu, ma: "HPG", giaVao: "10", sl, tp }).loi;
  expect(f("mua", "9", "11")).toBeNull();
  expect(f("mua", "10", "")).toBe("Lệnh MUA: SL phải thấp hơn giá vào.");
  expect(f("mua", "11", "")).toBe("Lệnh MUA: SL phải thấp hơn giá vào.");
  expect(f("mua", "", "10")).toBe("Lệnh MUA: TP phải cao hơn giá vào.");
  expect(f("mua", "", "9")).toBe("Lệnh MUA: TP phải cao hơn giá vào.");
  expect(f("ban", "11", "9")).toBeNull();
  expect(f("ban", "", "10")).toBe("Lệnh BÁN: TP phải thấp hơn giá vào.");
  expect(f("ban", "", "11")).toBe("Lệnh BÁN: TP phải thấp hơn giá vào.");
  expect(f("ban", "9", "")).toBe("Lệnh BÁN: SL phải cao hơn giá vào.");
  // Chỉ so cặp có CẢ hai đầu: khai mỗi SL vẫn chỉ kiểm SL với giá vào.
  expect(f("mua", "9.999", "")).toBeNull();
});

test("lỗi 400 của server khi gửi lệnh: không bao giờ hiện câu pydantic tiếng Anh", () => {
  const anh = new LoiGhi(400, "tham_so_khong_hop_le", "body.du_lieu.lenh.gia_vao: Input should be greater than 0");
  expect(cauLoiGuiLenh(anh, "mạng hỏng", true)).toBe("Lệnh không hợp lệ, kiểm lại các ô giá.");
  // Lỗi nghiệp vụ đã là tiếng Việt: giữ nguyên.
  const viet = new LoiGhi(400, "du_lieu_khong_hop_le", "Lệnh MUA: SL phải thấp hơn giá vào.");
  expect(cauLoiGuiLenh(viet, "mạng hỏng", true)).toBe("Lệnh MUA: SL phải thấp hơn giá vào.");
  // Không phải 400 ⇒ giữ câu của nó; không có lệnh ⇒ không đổ cho lệnh.
  expect(cauLoiGuiLenh(new LoiGhi(429, "x", "Quá hạn mức."), "m", true)).toBe("Quá hạn mức.");
  expect(cauLoiGuiLenh(anh, "m", false)).toBe(anh.message);
  expect(cauLoiGuiLenh(new TypeError("fetch failed"), "mạng hỏng", true)).toBe("mạng hỏng");
});

/* ------------------------------------------------------------------- tuần của chủ đề -- */

test("khoảng tuần: thứ Tư 11/11 giờ VN ⇒ 09/11 – 15/11, còn 4 ngày tới hết Chủ nhật", () => {
  const t = khoangTuanVN("2026-11-09T09:00:00+07:00", new Date("2026-11-11T10:00:00+07:00"));
  expect(t).toEqual({ nhan: "09/11 – 15/11", trongTuan: true, soNgayConLai: 4 });
});

test("khoảng tuần: hai đầu ranh giới giờ VN — 00:00 thứ Hai còn 6 ngày, 23:59 Chủ nhật còn 0", () => {
  const xuat_ban = "2026-11-10T08:00:00+07:00";
  expect(khoangTuanVN(xuat_ban, new Date("2026-11-09T00:00:00+07:00")).soNgayConLai).toBe(6);
  const cn = khoangTuanVN(xuat_ban, new Date("2026-11-15T23:59:59+07:00"));
  expect(cn).toMatchObject({ trongTuan: true, soNgayConLai: 0 });
  // 00:00 thứ Hai kế tiếp: đã sang tuần mới ⇒ chủ đề này hết là "tuần này".
  expect(khoangTuanVN(xuat_ban, new Date("2026-11-16T00:00:00+07:00")).trongTuan).toBe(false);
});

test("khoảng tuần KHÔNG phụ thuộc múi giờ máy: 17:30 UTC Chủ nhật = 00:30 thứ Hai giờ VN", () => {
  // Cùng một khoảnh khắc: tính theo giờ VN nó đã là thứ Hai 16/11 ⇒ ngoài tuần 09–15/11.
  const t = khoangTuanVN("2026-11-12T03:00:00Z", new Date("2026-11-15T17:30:00Z"));
  expect(t.trongTuan).toBe(false);
  // 16:30 UTC Chủ nhật = 23:30 Chủ nhật giờ VN ⇒ vẫn trong tuần, còn 0 ngày.
  const con = khoangTuanVN("2026-11-12T03:00:00Z", new Date("2026-11-15T16:30:00Z"));
  expect(con).toMatchObject({ trongTuan: true, soNgayConLai: 0 });
});

test("khoảng tuần: tuần vắt qua năm vẫn ra dd/mm đúng", () => {
  expect(khoangTuanVN("2026-12-30T10:00:00+07:00", new Date("2026-12-30T10:00:00+07:00")).nhan).toBe(
    "28/12 – 03/01",
  );
});

test("chip chủ đề: đang mở có đếm; Chủ nhật 'đóng hôm nay'; quá tuần không số; đã đóng không đếm", () => {
  const trong = { nhan: "09/11 – 15/11", trongTuan: true, soNgayConLai: 4 };
  expect(chuChipChuDe(true, trong)).toBe("Đang mở · còn 4 ngày");
  expect(chuChipChuDe(true, { ...trong, soNgayConLai: 1 })).toBe("Đang mở · còn 1 ngày");
  expect(chuChipChuDe(true, { ...trong, soNgayConLai: 0 })).toBe("Đang mở · đóng hôm nay");
  expect(chuChipChuDe(true, { ...trong, trongTuan: false, soNgayConLai: 0 })).toBe("Đang mở");
  expect(chuChipChuDe(false, trong)).toBe("Đã đóng");
});

/* ------------------------------------------------------------------ quan điểm nổi bật -- */

function bl(id: number, over: Partial<BinhLuanOut> = {}): BinhLuanOut {
  return {
    id,
    depth: 1,
    trang_thai: "binh_thuong",
    score: 0,
    body: `bình luận ${id}`,
    body_dinh_dang: "html",
    ...over,
  } as BinhLuanOut;
}

test("quan điểm nổi bật: chỉ bình luận GỐC đọc được, điểm cao nhất trước, tối đa N, không đột biến", () => {
  const ds = [
    bl(1, { score: 2 }),
    bl(2, { score: 9, depth: 2 }), // reply — loại
    bl(3, { score: 7 }),
    bl(4, { score: 100, trang_thai: "da_xoa" }), // bia mộ — loại
    bl(5, { score: 7 }), // hoà điểm với 3 ⇒ giữ thứ tự API
    bl(6, { score: 5, trang_thai: "da_an" }), // bị ẩn — loại
    bl(7, { score: -1 }),
  ];
  const truoc = ds.map((b) => b.id);
  expect(chonQuanDiemNoiBat(ds, 3).map((b) => b.id)).toEqual([3, 5, 1]);
  expect(chonQuanDiemNoiBat(ds, 1).map((b) => b.id)).toEqual([3]);
  // Còn chỗ trống vẫn KHÔNG nhặt bình luận điểm âm (id 7, score -1); điểm 0 thì được.
  expect(chonQuanDiemNoiBat(ds, 10).map((b) => b.id)).toEqual([3, 5, 1]);
  expect(chonQuanDiemNoiBat([bl(1, { score: -1 }), bl(2, { score: 0 })], 3).map((b) => b.id)).toEqual([2]);
  expect(chonQuanDiemNoiBat([bl(1, { score: -5 })], 3)).toEqual([]);
  expect(ds.map((b) => b.id), "không đột biến mảng gốc").toEqual(truoc);
  expect(chonQuanDiemNoiBat([], 3)).toEqual([]);
  expect(chonQuanDiemNoiBat([bl(1, { depth: 2 })], 3)).toEqual([]);
});

test("đoạn trích quan điểm: HTML gỡ thẻ, markdown gỡ ký hiệu, cắt ở 240 ký tự", () => {
  expect(trichQuanDiem("<p>Giữ <strong>50%</strong> tỷ trọng.</p><p>Hạ nếu thủng 1.250.</p>", "html")).toBe(
    "Giữ 50% tỷ trọng. Hạ nếu thủng 1.250.",
  );
  expect(trichQuanDiem("## Ý chính\n\n- **Giữ** 50%\n- [Xem thêm](https://x.y)", "markdown")).toBe(
    "Ý chính Giữ 50% Xem thêm",
  );
  const dai = trichQuanDiem("a".repeat(500), "markdown");
  expect(dai.length).toBe(241);
  expect(dai.endsWith("…")).toBe(true);
});

/* ---------------------------------------------------------------- thư viện bài viết -- */

function bai(id: number, sub: string): MachTomTatOut {
  return { id, sub: { slug: sub, ten: sub }, title: `Bài ${id}` } as MachTomTatOut;
}

test("ba nhóm theo hằng cấu hình: sub nào vào cột nào, tin-tuc KHÔNG vào cột", () => {
  expect(NHOM_BAI_VIET.map((n) => n.subs)).toEqual([
    ["hoi-dap", "chung-khoan"],
    ["vi-mo", "crypto"],
    ["quan-tri-von", "tam-ly-giao-dich"],
  ]);
  expect(NHOM_BAI_VIET.flatMap((n) => n.subs)).not.toContain("tin-tuc");
  expect(SO_BAI_MOI_NHOM).toBe(3);
});

test("chia nhóm: mỗi cột tối đa 3 bài ĐẦU (mới nhất) của sub thuộc nhóm; giữ thứ tự feed", () => {
  const items = [
    bai(1, "chung-khoan"),
    bai(2, "tin-tuc"),
    bai(3, "hoi-dap"),
    bai(4, "vi-mo"),
    bai(5, "chung-khoan"),
    bai(6, "chung-khoan"), // bài thứ 4 của nhóm 1 ⇒ rớt
    bai(7, "crypto"),
    bai(8, "sub-la"), // sub ngoài mọi nhóm ⇒ không vào cột nào
  ];
  const cot = chiaNhomBaiViet(items);
  expect(cot.map((c) => c.baiViet.map((m) => m.id))).toEqual([
    [1, 3, 5],
    [4, 7],
  ]);
  // Nhóm 3 rỗng ⇒ bị bỏ (ẩn cột), không phải cột rỗng.
  expect(cot).toHaveLength(2);
  expect(cot.map((c) => c.xemThem)).toEqual(["hoi-dap", "vi-mo"]);
});

test("chia nhóm: không bài nào thuộc nhóm ⇒ không cột (section có thể ẩn hẳn)", () => {
  expect(chiaNhomBaiViet([bai(1, "tin-tuc")])).toEqual([]);
  expect(chiaNhomBaiViet([])).toEqual([]);
});

test("bản tin: chỉ bài của tin-tuc, mới nhất trước, tối đa 3", () => {
  const items = [
    bai(1, "tin-tuc"),
    bai(2, "vi-mo"),
    bai(3, "tin-tuc"),
    bai(4, "tin-tuc"),
    bai(5, "tin-tuc"),
  ];
  expect(chonBanTin(items).map((m) => m.id)).toEqual([1, 3, 4]);
  expect(chonBanTin(items, 2).map((m) => m.id)).toEqual([1, 3]);
  expect(chonBanTin([bai(9, "vi-mo")])).toEqual([]);
});

test("chip chuyên mục: mọi sub của các nhóm theo thứ tự khai, không trùng, không có tin-tuc", () => {
  expect(slugChipChuyenMuc()).toEqual([
    "hoi-dap",
    "chung-khoan",
    "vi-mo",
    "crypto",
    "quan-tri-von",
    "tam-ly-giao-dich",
  ]);
});

/* ---------------------------------------------------------------- chân khối nhật ký -- */

const BAY_GIO = new Date("2026-11-11T10:00:00+07:00");
const trong_tuan = { published_at: "2026-11-10T09:00:00+07:00" };
const tuan_truoc = { published_at: "2026-11-05T09:00:00+07:00" };

test("chân khối: không còn ai / đã tải đúng trần ⇒ không có số để nói ⇒ 'Xem tất cả nhật ký'", () => {
  expect(tomTatChanKhoi([], false, BAY_GIO)).toEqual({ n: null, dam: "Xem tất cả nhật ký", nhat: "" });
  // Đã tải ĐÚNG trần: còn bao nhiêu người nữa không biết ⇒ KHÔNG bịa số.
  expect(tomTatChanKhoi([trong_tuan, trong_tuan], true, BAY_GIO)).toEqual({
    n: null,
    dam: "Xem tất cả nhật ký",
    nhat: "",
  });
  expect(tomTatChanKhoi([], true, BAY_GIO).n).toBeNull();
});

test("chân khối: chỉ nói số NGƯỜI, không nói số nhật ký; 'trong tuần này' chỉ khi MỌI người đều có bài trong tuần", () => {
  const ba = tomTatChanKhoi([trong_tuan, trong_tuan, trong_tuan], false, BAY_GIO);
  expect(ba).toEqual({ n: 3, dam: "+3 người khác", nhat: "vừa ghi nhật ký trong tuần này" });
  // Không đâu còn cụm "N nhật ký" (đếm theo tác giả mà ghi là bài thì nói quá).
  expect(`${ba.dam} ${ba.nhat}`).not.toMatch(/\d+\s+nhật ký/);
  // Lẫn một người có bài mới nhất ở tuần trước ⇒ bỏ cụm "trong tuần này".
  const lan = tomTatChanKhoi([trong_tuan, tuan_truoc], false, BAY_GIO);
  expect(lan).toEqual({ n: 2, dam: "+2 người khác", nhat: "vừa ghi nhật ký" });
  expect(`${lan.dam} ${lan.nhat}`).not.toMatch(/\d+\s+nhật ký|trong tuần/);
});

/* --------------------------------------------------------------------- ?trang_thai= -- */

test("docTrangThai: chỉ open|closed; giá trị lạ/mảng/vắng ⇒ không lọc", () => {
  expect(docTrangThai("open")).toBe("open");
  expect(docTrangThai("closed")).toBe("closed");
  expect(docTrangThai(["closed", "open"])).toBe("closed");
  for (const rac of ["OPEN", "dong", "", "1", undefined]) {
    expect(docTrangThai(rac), String(rac)).toBeUndefined();
  }
});

test("trang_thai chỉ gửi lên API ở tab nhận nó: moi/nhieu-diem có, dang-dien-ra BỎ", () => {
  expect(trangThaiGuiLenApi("moi", "closed")).toBe("closed");
  expect(trangThaiGuiLenApi("nhieu-diem", "open")).toBe("open");
  expect(trangThaiGuiLenApi("dang-dien-ra", "closed")).toBeUndefined();
  expect(trangThaiGuiLenApi("moi", undefined)).toBeUndefined();
});

/* ------------------------------------------------------------------------- hàng rào -- */

test("màu: thẻ nhật ký, khối chủ đề, thư viện KHÔNG dùng --gain/--loss/--stamp (khoá theo file)", () => {
  for (const f of [
    "components/the-nhat-ky.module.css",
    "components/khoi-thao-luan.module.css",
    "components/khoi-bai-viet.module.css",
    "components/trang-chu-v2.module.css",
    "components/khoi-lenh.module.css",
  ]) {
    const css = doc(f).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css, f).not.toMatch(/--(gain|loss|stamp)/);
    expect(css, `${f}: không mã hex`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  }
});

test("màu MUA/BÁN/SL/TP nằm trong con-so.module.css (file duy nhất được dùng --gain/--loss)", () => {
  const css = doc("components/con-so.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const lop of [".mua", ".ban", ".gia_tp", ".gia_sl"]) expect(css).toContain(lop);
  const tsx = doc("components/the-nhat-ky.tsx");
  expect(tsx).toContain("conSo.mua");
  expect(tsx).toContain("conSo.gia_tp");
  expect(tsx, "chip Đã đóng sổ mượn selector có sẵn, không tô --stamp ở file mới").toContain(
    "theMach.dong_so",
  );
});

test("thẻ nhật ký KHÔNG parse tiêu đề để suy ra lệnh: dải chỉ đọc mach.lenh", () => {
  const tsx = doc("components/the-nhat-ky.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  expect(tsx).toContain("mach.lenh");
  expect(tsx).not.toMatch(/mach\.title\.(match|split|replace|includes|startsWith)|\.test\(\s*mach\.title/);
});

test("trang chủ không còn danh sách chủ đề trước: khối chủ đề không có link /chu-de", () => {
  const tsx = doc("components/khoi-thao-luan.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  // Chuỗi đường dẫn `"/chu-de"` (không tính `import … "@/lib/chu-de"`: trước dấu `/` là `lib`).
  expect(tsx).not.toMatch(/["'`]\/chu-de/);
  expect(tsx).not.toContain("Các chủ đề trước");
});

/* ------------------------------------------------- lối vào ghi nhật ký → ngăn kéo -- */

const BAM_THUONG: CuBamLoiVao = {
  dangTai: false,
  dangNhap: true,
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  daChan: false,
};

test("lối vào ghi nhật ký: chỉ mở ngăn kéo khi ĐÃ đăng nhập và là cú bấm trái thường", () => {
  expect(nenMoNganKeo(BAM_THUONG)).toBe(true);
  // Khách ⇒ link chạy tới /dang-mach (có lời mời đăng nhập + đăng ký, đủ hơn modal).
  expect(nenMoNganKeo({ ...BAM_THUONG, dangNhap: false })).toBe(false);
  // Phiên chưa tải xong ⇒ chưa biết là ai ⇒ không đoán.
  expect(nenMoNganKeo({ ...BAM_THUONG, dangTai: true })).toBe(false);
  // Muốn tab / cửa sổ mới tới đúng URL ⇒ không cướp.
  for (const k of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) {
    expect(nenMoNganKeo({ ...BAM_THUONG, [k]: true }), k).toBe(false);
  }
  expect(nenMoNganKeo({ ...BAM_THUONG, button: 1 }), "chuột giữa").toBe(false);
  expect(nenMoNganKeo({ ...BAM_THUONG, button: 2 }), "chuột phải").toBe(false);
  // Đã có người chặn trước ta thì ta không chặn thêm / không mở thêm.
  expect(nenMoNganKeo({ ...BAM_THUONG, daChan: true })).toBe(false);
});

test("trang-chu-v2 vẫn là server component; cả 4 lối vào ghi nhật ký đi qua LoiVaoNhatKy", () => {
  const tsx = doc("components/trang-chu-v2.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  expect(tsx, "không biến cả trang thành client").not.toMatch(/^\s*["']use client["']/);
  expect(tsx.match(/<LoiVaoNhatKy\b/g)?.length).toBe(4);
  // Không còn <Link> nào tự trỏ /dang-mach: đường vòng quanh ngăn kéo.
  expect(tsx).not.toContain('href="/dang-mach"');
  // Component client vẽ <a href="/dang-mach"> thật ⇒ HTML thô không đổi (SEO).
  const lien = doc("components/loi-vao-nhat-ky.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  expect(lien).toMatch(/^\s*["']use client["']/);
  expect(lien).toContain('href="/dang-mach"');
  expect(lien).toContain("nenMoNganKeo");
});

test("bản nháp chuyển từ ngăn kéo sang /dang-mach: chỉ nhận lệnh đúng hình dạng", () => {
  const day_du = { chieu: "ban", ma: "HPG", giaVao: "27.8", sl: "28.5", tp: "", nhoi: "" };
  expect(lenhFormTuBanNhap(day_du)).toEqual(day_du);
  expect(lenhFormTuBanNhap(undefined)).toBeNull();
  expect(lenhFormTuBanNhap(null)).toBeNull();
  expect(lenhFormTuBanNhap("mua")).toBeNull();
  expect(lenhFormTuBanNhap({ ...day_du, chieu: "long" })).toBeNull();
  expect(lenhFormTuBanNhap({ ...day_du, giaVao: 27.8 })).toBeNull();
  expect(lenhFormTuBanNhap({ ...day_du, nhoi: undefined })).toBeNull();
});

test("ngăn kéo dùng CHUNG khối lệnh và luật kiểm với /dang-mach; nối mốc không có lệnh", () => {
  const nganKeo = doc("components/drawer-dang-nhanh.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  const trang = doc("components/form-dang-mach.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [ten, ma] of [["ngăn kéo", nganKeo], ["form trang", trang]] as const) {
    expect(ma, ten).toContain('from "./khoi-lenh"');
    expect(ma, ten).toContain("lenhTuForm(");
    expect(ma, ten).toContain("cauLoiGuiLenh(");
  }
  // Hai nơi PHẢI khác tiền tố testid (ngăn kéo có mặt trong DOM của mọi trang, kể cả /dang-mach).
  expect(trang).toContain('tienTo="dang-mach"');
  expect(nganKeo).toContain('tienTo="dang-nhanh"');
  // `lenh` chỉ nằm ở nhánh TẠO mạch, không ở nhánh nối mốc (lệnh ghi một lần lúc tạo mạch).
  const bat_dau = nganKeo.indexOf("if (dangMachHienTai) {");
  const noi_moc = nganKeo.slice(bat_dau, nganKeo.indexOf("} else {", bat_dau));
  expect(noi_moc.length, "tìm đúng nhánh nối mốc").toBeGreaterThan(200);
  expect(noi_moc).not.toMatch(/\blenh/);
  expect(nganKeo.slice(nganKeo.indexOf("} else {", bat_dau))).toMatch(/lenh_gui !== null \? \{ lenh: lenh_gui \}/);
});
