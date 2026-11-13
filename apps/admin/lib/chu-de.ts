import type { ChuDeOut } from "@gikky/api-client/admin";

/** Phần thuần của trang "Chủ đề tuần" `/chu-de` (việc 21, đợt C — plan §3.1).
 *
 * Tuần tính ở SERVER (`api/api/quan_tri_chu_de.py`, giờ VN): mỗi hàng mang sẵn `tuan_bat_dau`
 * (`YYYY-MM-DD`, ngày thứ Hai). File này chỉ gom và đặt nhãn — không đọc đồng hồ, không đổi
 * múi giờ, nên trình duyệt ở múi nào cũng ra cùng một nhóm.
 *
 * Hàm thuần, không nhập React hay `fetch`: bộ `don-vi` nạp được nó. */

export type TrangThaiChuDe = ChuDeOut["trang_thai"];

/** Nhãn + tông màu của bốn trạng thái. `Record` khoá bằng type sinh ra: server thêm một trạng
 * thái thì `tsc` đỏ ở đây. */
export const NHAN_TRANG_THAI_CHU_DE: Record<
  TrangThaiChuDe,
  { nhan: string; tone: "tot" | "trung-tinh" | "chu-y" | "xau" }
> = {
  mo: { nhan: "đang mở", tone: "tot" },
  dong: { nhan: "đã đóng", tone: "trung-tinh" },
  hen_gio: { nhan: "hẹn giờ", tone: "chu-y" },
  bi_an: { nhan: "bị ẩn", tone: "xau" },
};

const MS_NGAY = 86_400_000;
const hai = (n: number) => String(n).padStart(2, "0");

/** `"2026-11-09"` (+ ngày cuối tuỳ chọn) → `"09/11–15/11"`. Thiếu ngày cuối thì lấy thứ Hai + 6.
 * Đọc chuỗi ngày bằng `Date.UTC` — không qua múi giờ máy. */
export function nhanTuan(bat_dau: string, ket_thuc?: string): string {
  const doc = (s: string) => {
    const [n, t, d] = s.split("-").map(Number);
    return new Date(Date.UTC(n, t - 1, d));
  };
  const dau = doc(bat_dau);
  const cuoi = ket_thuc === undefined ? new Date(dau.getTime() + 6 * MS_NGAY) : doc(ket_thuc);
  const dd = (x: Date) => `${hai(x.getUTCDate())}/${hai(x.getUTCMonth() + 1)}`;
  return `${dd(dau)}–${dd(cuoi)}`;
}

export type NhomTuanChuDe<T> = { khoa: string; nhan: string; items: T[] };

/** Gom theo `tuan_bat_dau`, GIỮ thứ tự server trả (mới xuất bản → cũ): nhóm xuất hiện theo lần
 * gặp đầu tiên. Gom theo khoá (không chỉ "liền kề"): hai hàng cùng tuần luôn chung một nhóm. */
export function nhomChuDeTheoTuan<T extends { tuan_bat_dau: string }>(
  items: readonly T[],
): NhomTuanChuDe<T>[] {
  const nhom = new Map<string, NhomTuanChuDe<T>>();
  for (const it of items) {
    const co = nhom.get(it.tuan_bat_dau);
    if (co === undefined) {
      nhom.set(it.tuan_bat_dau, {
        khoa: it.tuan_bat_dau,
        nhan: nhanTuan(it.tuan_bat_dau),
        items: [it],
      });
    } else co.items.push(it);
  }
  return [...nhom.values()];
}

/** Nút nào hiện trên một hàng: "Đóng" chỉ khi chủ đề đang mở và không bị khoá; "Mở lại" khi
 * server nói được (`co_the_mo_lai` — đã đóng, không khoá, còn trong hạn). Bài bị ẩn / hẹn giờ:
 * không nút nào — gỡ ẩn hay phát hành ở trang chi tiết trước. */
export function nutChuDe(
  c: Pick<ChuDeOut, "trang_thai" | "da_khoa" | "co_the_mo_lai">,
): "dong" | "mo_lai" | null {
  // Xét trạng thái TRƯỚC cờ của server: hàng bị ẩn / hẹn giờ không có nút nào dù cờ nói gì
  // (server cũng trả 409 `chu_de_dang_an` cho hai loài này).
  if (c.trang_thai === "bi_an" || c.trang_thai === "hen_gio") return null;
  if (c.trang_thai === "mo" && !c.da_khoa) return "dong";
  if (c.co_the_mo_lai) return "mo_lai";
  return null;
}

/** Mở lại xoá tổng kết (`core/ghi.py::mo_lai`). Bản cũ chỉ được lưu vào AuditLog khi người bấm
 * KHÔNG phải tác giả chủ đề (`_ghi_audit_chu_de`) — nên câu cảnh báo phải tuỳ theo hàng:
 * `"mat_han"` = mod đang đăng nhập chính là tác giả, tổng kết mất hẳn; `"luu_nhat_ky"` = bản cũ
 * nằm ở nhật ký quản trị. */
export function soPhanTongKetKhiMoLai(
  tac_gia: string,
  mod_dang_nhap: string,
): "mat_han" | "luu_nhat_ky" {
  return tac_gia === mod_dang_nhap ? "mat_han" : "luu_nhat_ky";
}
