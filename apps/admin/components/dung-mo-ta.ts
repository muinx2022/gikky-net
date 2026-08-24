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
  mach: "Bài viết",
  moc: "Mốc",
  comment: "Bình luận",
};

/** Chữ cho `Report.action` — **một lời GHI CHÉP về quá khứ**, không phải một hành động.
 *
 * Backend nói rõ: `hanh_dong` chỉ được ghi lại, nó **không thi hành gì**
 * (`api/quan_tri_bao_cao.py::dong_bao_cao_endpoint`). Bảng này vì thế chỉ đúng ở đúng một
 * chỗ: cột "Xử lý" của một hàng ĐÃ đóng, nơi nó đọc là *"mod đã ghi: đã ban"*.
 *
 * ⚠ **Đừng dùng nó làm nhãn nút** (L04). Bốn cái nút `Đóng: Đã ban` từng là thứ duy nhất
 * trên hàng trông giống một hành động, trong khi kẻ bị tố không bị ban một giây nào. Nhãn
 * nút nay lấy từ `CHU_GHI_NHAN` ngay dưới, và hành động THẬT có nút riêng.
 */
export const CHU_HANH_DONG: Record<DongBaoCaoIn["hanh_dong"], string> = {
  an: "đã ẩn",
  khoa: "đã khoá",
  ban: "đã ban",
  bo_qua: "bỏ qua",
};

/** Chữ trên NÚT đóng báo cáo — thì hiện tại, chủ ngữ là mod, động từ là "ghi".
 *
 * "Ghi: đã ban" đọc ra đúng thứ cú bấm làm: nó ghi vào sổ rằng mod đã ban ở đâu đó, và
 * nó đóng báo cáo. Nó không ban ai. So với "Đóng: Đã ban" — một câu mà cách đọc tự nhiên
 * nhất là *"đóng báo cáo này BẰNG CÁCH ban"*.
 */
export const CHU_GHI_NHAN: Record<DongBaoCaoIn["hanh_dong"], string> = {
  an: "Ghi: đã ẩn",
  khoa: "Ghi: đã khoá",
  ban: "Ghi: đã ban",
  bo_qua: "Ghi: bỏ qua",
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
