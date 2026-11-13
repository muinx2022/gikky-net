import type { MachTomTatOut } from "@gikky/api-client";

import { SUB_BAN_TIN } from "./ban-tin";

/** Khối "Bài viết mới" ở rail phải của `/` và `/luat` (việc 24, plan
 * `2026-11-13-bai-viet-sang-rail.md`). Thay cho khối "Bài viết" to của trang chủ (dải Mới đăng +
 * giá sách, plan `2026-11-11-bai-viet-trang-chu-gia-sach.md`) — khối ấy đã gỡ cùng các hàm giá sách.
 *
 * Phép chọn bài sống ở đây, trong hàm THUẦN, để đo được không cần mạng
 * (`e2e/don-vi/bai-viet-trang-chu.spec.ts`). Server (`app/page.tsx`) và trình duyệt
 * (`BaiMoiTuTrinhDuyet` của `/luat`) đi qua CÙNG hàm, nên hai trang ra cùng một danh sách.
 *
 * **Không slug nào gõ cứng.** Còn đúng MỘT lọc theo `SUB_BAN_TIN` (import từ `lib/ban-tin.ts`, không
 * gõ lại slug) — lớp phòng thủ của `chonMoiDang`. */

/** Số bài tải về MỘT lần để chọn ra `SO_BAI_VIET_RAIL` bài. 50 = trần `limit` của feed — chừa chỗ
 * cho các mạch bản tin cũ mà `chonMoiDang` loại ra. */
export const SO_BAI_VIET_TAI = 50;
/** Số bài ở khối "Bài viết mới" của rail (`/` và `/luat`). */
export const SO_BAI_VIET_RAIL = 10;

/** `toiDa` bài `bai_viet` mới nhất thuộc mọi chuyên mục TRỪ chuyên mục bản tin. Không đột biến
 * `items`.
 *
 * **Bộ lọc `SUB_BAN_TIN` là PHÒNG THỦ** (việc 20, vòng sửa 1): API đã chặn mạch mới vào `tin-tuc`,
 * nhưng lệnh `chuyen_ban_tin` cố ý BỎ QUA một số mạch cũ (`loai` lạ, có ảnh, trùng ngày, của người
 * thường…) — chúng ở lại là `bai_viet` công khai trong `tin-tuc` và, không có dòng này, chui vào khối
 * bài viết như một bản tin dạng nhật ký. Đừng gỡ khi chưa chắc sub ấy đã sạch trên prod. */
export function chonMoiDang(
  items: readonly MachTomTatOut[],
  toiDa: number = SO_BAI_VIET_RAIL,
): MachTomTatOut[] {
  return items.filter((m) => m.sub.slug !== SUB_BAN_TIN).slice(0, toiDa);
}
