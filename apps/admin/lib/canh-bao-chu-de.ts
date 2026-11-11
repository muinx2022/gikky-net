import type { LuaChonLoaiMach } from "./loai-mach";

/** Cảnh báo "đang có chủ đề đang mở" của form đăng bài ở khu quản trị *(homepage v2, vòng sửa 3)*.
 *
 * Luật của user: tạo chủ đề thứ hai khi chủ đề cũ còn mở thì **cảnh báo rồi vẫn cho lưu**;
 * trang chủ chỉ hiện chủ đề MỚI NHẤT. Cảnh báo là THÔNG TIN, không phải cổng — nên file này
 * chỉ trả lời "có nên hỏi lại hay không", không có nhánh nào dẫn tới "cấm tạo":
 *
 * - loại khác "Chủ đề thảo luận" ⇒ không hỏi gì, không gọi danh sách (`canKiemChuDeMo`);
 * - gọi danh sách LỖI ⇒ không cảnh báo, không chặn; chỉ đánh dấu `khong_kiem_duoc` để form
 *   nói một dòng nhỏ "không kiểm được chủ đề đang mở";
 * - danh sách có chủ đề thật sự đang mở ⇒ cảnh báo.
 *
 * ## "Đang mở" ở đây nghĩa là gì
 *
 * Server lọc `trang_thai=mo` = `status=open` VÀ không ẩn VÀ không khoá (`api/api/quan_tri_loc.py`).
 * Tức chủ đề **bị ẩn, bị khoá, hoặc đang chờ giờ hẹn** (một dạng ẩn) KHÔNG tính — chúng không
 * phải thứ trang chủ đang hiện, nên cảnh báo vì chúng là cảnh báo giả. Server KHÔNG loại mạch
 * đã lưu trữ khỏi nhóm `mo` (trục `archived_at` tách riêng), mà feed công khai thì loại; nên
 * ở đây lọc lại các cờ của từng hàng thay vì tin tuyệt đối vào bộ lọc phía server. Hàm lọc
 * lại cố ý khai đủ các cờ: thêm một cờ ẩn mới ở API mà quên ở đây thì bài đo bên cạnh đỏ.
 *
 * Hàm thuần, không nhập React hay `fetch`: bộ `don-vi` nạp được nó. */

/** Phần của một hàng `MachDongOut` mà quyết định cần. Khai cấu trúc (không nhập type sinh ra)
 * để bài đo dựng được hàng giả mà không phải điền mười mấy trường vô can. */
export type HangChuDe = {
  id: number;
  title: string;
  status: string;
  da_bi_an: boolean;
  da_khoa: boolean;
  da_luu_tru?: boolean;
  da_hen_gio: boolean;
  loai_mach?: string;
};

/** Kết quả gọi danh sách, đã chuẩn hoá: lỗi HTTP và lỗi mạng đều là `{ ok: false }`. */
export type KetQuaDanhSachChuDe =
  | { ok: true; items: readonly HangChuDe[]; tong?: number }
  | { ok: false };

/** Tham số `query` của lời gọi danh sách: một nơi cho form và bài đo, để hai bên không lệch. */
export const LOC_CHU_DE_DANG_MO = {
  loai_mach: "thao_luan",
  trang_thai: "mo",
  limit: 5,
} as const;

/** `datetime-local` ("2026-11-12T09:00", giờ VN) → "12/11/2026 09:00" để nêu trong cảnh báo. */
export function dinhDangGioHen(o_gio: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(o_gio);
  return m === null ? o_gio : `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

/** Có cần hỏi danh sách chủ đề đang mở không: chỉ khi đang chọn "Chủ đề thảo luận". */
export function canKiemChuDeMo(lua_chon: LuaChonLoaiMach): boolean {
  return lua_chon === "thao_luan";
}

/** Hàng này có phải một chủ đề đang MỞ và đang hiện không (xem "Đang mở nghĩa là gì" ở đầu file). */
export function laChuDeDangMo(h: HangChuDe): boolean {
  return (
    h.status === "open" &&
    !h.da_bi_an &&
    !h.da_khoa &&
    !h.da_hen_gio &&
    h.da_luu_tru !== true &&
    (h.loai_mach === undefined || h.loai_mach === "thao_luan")
  );
}

export type QuyetDinhCanhBao =
  | { canh_bao: false; khong_kiem_duoc: boolean }
  | {
      canh_bao: true;
      khong_kiem_duoc: false;
      /** Tiêu đề các chủ đề đang mở (tối đa `TOI_DA_TIEU_DE`), mới nhất trước như server trả. */
      tieu_de: string[];
      /** Số chủ đề đang mở không nêu tên (khi nhiều hơn `TOI_DA_TIEU_DE`). */
      con_lai: number;
      /** Câu hỏi đầy đủ để hiện nguyên văn. */
      thong_diep: string;
      /** Dòng phụ khi chủ đề mới được HẸN giờ lên sóng; `null` khi đăng ngay. */
      dong_gio: string | null;
    };

export const TOI_DA_TIEU_DE = 3;

/** Quyết định có cảnh báo hay không.
 *
 * @param lua_chon  "Loại mạch" đang chọn trong form.
 * @param ket_qua   kết quả gọi danh sách, hoặc `null` nếu chưa/không gọi.
 * @param gio_len_song  giờ lên sóng (đã định dạng, giờ VN) khi chủ đề MỚI được hẹn ở tương lai;
 *                      `null` khi đăng ngay. Chỉ để nêu trong cảnh báo, không ảnh hưởng quyết định. */
export function quyetDinhCanhBaoChuDe(
  lua_chon: LuaChonLoaiMach,
  ket_qua: KetQuaDanhSachChuDe | null,
  gio_len_song: string | null = null,
): QuyetDinhCanhBao {
  if (!canKiemChuDeMo(lua_chon) || ket_qua === null) {
    return { canh_bao: false, khong_kiem_duoc: false };
  }
  if (!ket_qua.ok) return { canh_bao: false, khong_kiem_duoc: true };

  const mo = ket_qua.items.filter(laChuDeDangMo);
  if (mo.length === 0) return { canh_bao: false, khong_kiem_duoc: false };

  const tieu_de = mo.slice(0, TOI_DA_TIEU_DE).map((h) => h.title);
  // Ngoài các hàng đã nhận: `tong` của server lớn hơn số hàng trả về khi `limit` cắt bớt.
  const bi_cat = Math.max(0, (ket_qua.tong ?? ket_qua.items.length) - ket_qua.items.length);
  const con_lai = mo.length - tieu_de.length + bi_cat;

  const ten = tieu_de.map((t) => `«${t}»`).join(", ");
  const them = con_lai > 0 ? ` và ${con_lai} chủ đề khác` : "";
  return {
    canh_bao: true,
    khong_kiem_duoc: false,
    tieu_de,
    con_lai,
    thong_diep:
      `Đang có chủ đề đang mở: ${ten}${them}. ` +
      "Chủ đề mới sẽ thay nó ở trang chủ (chủ đề cũ vẫn còn ở /chu-de). Vẫn tạo?",
    dong_gio:
      gio_len_song === null
        ? null
        : `Chủ đề mới đã hẹn lên sóng lúc ${gio_len_song} (giờ Việt Nam); tới lúc đó trang chủ vẫn hiện chủ đề cũ.`,
  };
}
