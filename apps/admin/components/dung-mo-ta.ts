// Chữ hiển thị cho các mã enum của API quản trị.
//
// **Không phải bản khai lại một schema** (PLAN 8.3 cấm chuyện đó): đây là ánh xạ
// `mã → tiếng Việt`, tức phần mà OpenAPI không mang theo. Kiểu khoá thì vẫn lấy từ client
// sinh ra (`BaoCaoOut["ly_do"]`), nên thêm một lý do ở Python mà quên chỗ này là **lỗi
// biên dịch**, không phải một ô trống trên bảng của mod.

import type { BaoCaoOut, DongBaoCaoIn } from "@gikky/api-client/admin";

export const CHU_LY_DO: Record<BaoCaoOut["ly_do"], string> = {
  phim_hang: "Hô hào mua bán / phím hàng",
  lua_dao: "Lừa đảo, mời uỷ thác, room VIP",
  spam: "Spam",
  khac: "Khác",
};

export const CHU_DICH: Record<NonNullable<BaoCaoOut["dich"]>["loai"], string> = {
  mach: "Mạch",
  moc: "Mốc",
  comment: "Bình luận",
};

export const CHU_HANH_DONG: Record<DongBaoCaoIn["hanh_dong"], string> = {
  an: "Đã ẩn",
  khoa: "Đã khoá",
  ban: "Đã ban",
  bo_qua: "Bỏ qua",
};

/** Mọi hành động đóng báo cáo, theo thứ tự bày ra nút. Suy từ bảng chữ ở trên, không gõ
 * lại — thêm một hành động ở Python là nó tự có nút, không phải nhớ sửa hai chỗ. */
export const HANH_DONG_DONG = Object.keys(CHU_HANH_DONG) as DongBaoCaoIn["hanh_dong"][];

/** Dấu thời gian dạng `dd/mm/yyyy hh:mm`, giờ VN. Mod đọc log theo giờ VN, không theo UTC. */
export function gioVN(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
