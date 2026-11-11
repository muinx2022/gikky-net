import type { MachHenGioMoiIn } from "@gikky/api-client/admin";

/** Ô chọn "Loại mạch" của form đăng bài ở khu quản trị *(homepage v2, plan §3.7)*.
 *
 * Tên trường là `loai_mach`, KHÔNG phải `loai`: `loai` đã là chip tự do của MỐC (ô "Loại" ngay
 * bên dưới trong cùng form). Nhãn trên màn hình vì thế là "Loại mạch", không chỉ "Loại".
 *
 * Giá trị `""` là **"Theo tác giả"** (mặc định) và có nghĩa là KHÔNG gửi trường — để server
 * phân giải như mọi đường ống đăng bài khác (`core/ghi.py::tao_mach`: tài khoản đội → `bai_viet`).
 * Gửi `null` hay chuỗi rỗng cũng "gần như" như vậy, nhưng "không có khoá" mới đúng là hành vi
 * mặc định đã được đo, và bài đo `loai-mach-quan-tri.spec.ts` ghim đúng điều đó.
 *
 * Hàm thuần, không nhập React hay `fetch`: bộ `don-vi` nạp được nó. */

export type LoaiMachGui = NonNullable<MachHenGioMoiIn["loai_mach"]>;

/** Lựa chọn trong ô: `""` = theo tác giả, còn lại là giá trị API. */
export type LuaChonLoaiMach = "" | LoaiMachGui;

export const LUA_CHON_LOAI_MACH: readonly { gia_tri: LuaChonLoaiMach; nhan: string }[] = [
  { gia_tri: "", nhan: "Theo tác giả (mặc định)" },
  { gia_tri: "nhat_ky", nhan: "Nhật ký" },
  { gia_tri: "bai_viet", nhan: "Bài viết" },
  { gia_tri: "thao_luan", nhan: "Chủ đề thảo luận" },
];

/** Phần thân request cho lựa chọn này: `{}` khi theo tác giả, `{ loai_mach }` khi khác.
 * Dùng bằng `...truongLoaiMach(loai_mach)` để khoá KHÔNG xuất hiện ở lựa chọn mặc định. */
export function truongLoaiMach(lua_chon: LuaChonLoaiMach): { loai_mach?: LoaiMachGui } {
  return lua_chon === "" ? {} : { loai_mach: lua_chon };
}
