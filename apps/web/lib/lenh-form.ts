import type { LenhIn } from "@gikky/api-client";

import { LoiGhi } from "./ghi";

/** Trạng thái ô nhập của khối "Lệnh (tuỳ chọn)" trong `components/form-dang-mach.tsx`, và phép
 * đổi nó thành `LenhIn` gửi `POST /machs`. Hàm THUẦN — đo được không cần trình duyệt
 * (`e2e/don-vi/trang-chu-giao-dien-moi.spec.ts`).
 *
 * **Lệnh là biên lai: ghi một lần lúc đăng, KHÔNG sửa được sau đó.** Vì thế form kiểm KỸ ở
 * client, bằng tiếng Việt, trước khi gửi — mọi thứ server sẽ từ chối (và cả thứ nó chấp nhận
 * nhầm, như "27,500" thành 27.5):
 *
 * - dấu phẩy thập phân ⇒ LỖI, **không tự đổi thành dấu chấm**: "27,500" có thể là 27.5 (kiểu
 *   Việt) hoặc hai mươi bảy nghìn năm trăm (kiểu nghìn), không đoán được, và đoán sai là lệnh
 *   sai vĩnh viễn;
 * - số dương, tối đa 8 chữ số thập phân và 12 chữ số nguyên (khớp `Decimal(20, 8)` của cột);
 * - thứ tự theo chiều khi có đủ hai đầu: MUA ⇒ `sl < vào < tp`, BÁN ⇒ `tp < vào < sl`. Luật gốc
 *   vẫn là của SERVER (`core/lenh.py`); bản ở đây chỉ để báo lỗi sớm, bằng cùng một câu.
 *
 * Số gửi dạng CHUỖI để không đi qua `float`; so sánh bằng `BigInt` (số nhân 10^8) cùng lý do. */
export type LenhForm = {
  chieu: "mua" | "ban";
  ma: string;
  giaVao: string;
  sl: string;
  tp: string;
  nhoi: string;
};

export const lenhFormRong: LenhForm = {
  chieu: "mua",
  ma: "",
  giaVao: "",
  sl: "",
  tp: "",
  nhoi: "",
};

/** Đọc lại `LenhForm` từ thứ lấy ra khỏi `sessionStorage` (bản nháp chuyển từ ngăn kéo đăng nhanh
 * sang `/dang-mach`). Dữ liệu ở đó là THỨ NGOÀI — có thể hỏng, cũ, hoặc thiếu trường — nên chỉ
 * nhận đúng hình dạng (`chieu` mua/ban + năm ô chuỗi), còn lại `null` (form giữ lệnh trống). */
export function lenhFormTuBanNhap(x: unknown): LenhForm | null {
  if (typeof x !== "object" || x === null) return null;
  const o = x as Record<string, unknown>;
  if (o.chieu !== "mua" && o.chieu !== "ban") return null;
  if (
    typeof o.ma !== "string" ||
    typeof o.giaVao !== "string" ||
    typeof o.sl !== "string" ||
    typeof o.tp !== "string" ||
    typeof o.nhoi !== "string"
  ) {
    return null;
  }
  return { chieu: o.chieu, ma: o.ma, giaVao: o.giaVao, sl: o.sl, tp: o.tp, nhoi: o.nhoi };
}

const SO_DUONG = /^\d+(\.\d+)?$/;
const SO_LE_TOI_DA = 8;
const SO_NGUYEN_TOI_DA = 12;
const MA_HOP_LE = /^[A-Za-z0-9._/-]{1,20}$/;

export const LOI_DAU_PHAY = "Dùng dấu chấm cho phần thập phân (vd 27.5).";
/** Thay cho câu pydantic tiếng Anh khi server từ chối hình dạng của `lenh`. */
export const LOI_LENH_CHUNG = "Lệnh không hợp lệ, kiểm lại các ô giá.";

export type KetQuaLenhForm = { lenh: LenhIn | null; loi: string | null };

/** `"27.5"` → `2_750_000_000n` (nhân 10^8). Chỉ gọi sau khi `SO_DUONG` đã khớp. */
function nhan1e8(s: string): bigint {
  const [nguyen, le = ""] = s.split(".");
  return BigInt(nguyen + le.padEnd(SO_LE_TOI_DA, "0"));
}

/** Form trống hoàn toàn (không mã, không số nào) ⇒ `{ lenh: null, loi: null }` — đăng KHÔNG kèm
 * lệnh. Có ít nhất một ô điền mà không hợp lệ ⇒ lỗi tiếng Việt, không gọi mạng. */
export function lenhTuForm(f: LenhForm): KetQuaLenhForm {
  const ma = f.ma.trim();
  const so = {
    giaVao: f.giaVao.trim(),
    sl: f.sl.trim(),
    tp: f.tp.trim(),
    nhoi: f.nhoi.trim(),
  };
  if (ma === "" && so.giaVao === "" && so.sl === "" && so.tp === "" && so.nhoi === "") {
    return { lenh: null, loi: null };
  }
  const loi = (l: string): KetQuaLenhForm => ({ lenh: null, loi: l });

  if (ma === "") return loi("Lệnh cần có mã (vd HPG, USD/JPY).");
  if (!MA_HOP_LE.test(ma)) {
    return loi("Mã chỉ gồm chữ, số và các ký tự . _ / - (tối đa 20 ký tự).");
  }
  if (so.giaVao === "") return loi("Lệnh cần có giá vào.");

  const o: ReadonlyArray<readonly [keyof typeof so, string]> = [
    ["giaVao", "Giá vào"],
    ["sl", "SL"],
    ["tp", "TP"],
    ["nhoi", "Giá nhồi"],
  ];
  for (const [k, ten] of o) {
    const v = so[k];
    if (v === "") continue;
    if (v.includes(",")) return loi(LOI_DAU_PHAY);
    if (!SO_DUONG.test(v)) return loi(`${ten} phải là số dương.`);
    const [nguyen, le = ""] = v.split(".");
    if (le.length > SO_LE_TOI_DA) return loi(`${ten} tối đa ${SO_LE_TOI_DA} chữ số thập phân.`);
    if (nguyen.replace(/^0+(?=\d)/, "").length > SO_NGUYEN_TOI_DA) {
      return loi(`${ten} quá lớn (tối đa ${SO_NGUYEN_TOI_DA} chữ số nguyên).`);
    }
    if (nhan1e8(v) <= BigInt(0)) return loi(`${ten} phải lớn hơn 0.`);
  }

  const vao = nhan1e8(so.giaVao);
  const sl = so.sl === "" ? null : nhan1e8(so.sl);
  const tp = so.tp === "" ? null : nhan1e8(so.tp);
  if (f.chieu === "mua") {
    if (sl !== null && !(sl < vao)) return loi("Lệnh MUA: SL phải thấp hơn giá vào.");
    if (tp !== null && !(vao < tp)) return loi("Lệnh MUA: TP phải cao hơn giá vào.");
  } else {
    if (tp !== null && !(tp < vao)) return loi("Lệnh BÁN: TP phải thấp hơn giá vào.");
    if (sl !== null && !(vao < sl)) return loi("Lệnh BÁN: SL phải cao hơn giá vào.");
  }

  const lenh: LenhIn = { chieu: f.chieu, ma, gia_vao: so.giaVao };
  if (so.sl !== "") lenh.sl = so.sl;
  if (so.tp !== "") lenh.tp = so.tp;
  if (so.nhoi !== "") lenh.nhoi = so.nhoi;
  return { lenh, loi: null };
}

const CO_DAU_TIENG_VIET =
  /[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

/** Câu lỗi để HIỆN khi `POST /machs` mang `lenh` bị server từ chối.
 *
 * Lỗi nghiệp vụ của server (`du_lieu_khong_hop_le`: sai thứ tự, chỉ cho nhật ký…) đã là tiếng
 * Việt — giữ nguyên. Lỗi HÌNH DẠNG do pydantic sinh ra (`tham_so_khong_hop_le`, chuỗi kiểu
 * `body.du_lieu.lenh.gia_vao: Input should be…`) là tiếng Anh, người dùng không đọc được và
 * không biết ô nào sai ⇒ thay bằng `LOI_LENH_CHUNG`. Tiêu chí là "body có chữ tiếng Việt hay
 * không", không chỉ theo `code`, để một mã lỗi mới của server cũng không lọt câu tiếng Anh.
 * Lỗi KHÔNG phải 400 (mạng, 401, 429…) giữ nguyên câu của chúng; bài KHÔNG kèm lệnh (`coLenh`
 * = false) cũng giữ nguyên câu. */
export function cauLoiGuiLenh(e: unknown, macDinh: string, coLenh: boolean): string {
  if (e instanceof LoiGhi) {
    // Chỉ khi bài đăng CÓ `lenh`: không có thì lỗi 400 không thể do lệnh, đừng đổ cho nó.
    if (coLenh && e.trangThai === 400 && !CO_DAU_TIENG_VIET.test(e.message)) return LOI_LENH_CHUNG;
    return e.message;
  }
  return macDinh;
}
