/** Bốn tab của trang hồ sơ — PLAN khu người dùng, chốt 2026-08-24.
 *
 * Tab sống trên **URL** (`?tab=`), không phải state client — cùng lý do `?view=` và
 * `?sort=` đang dùng: bấm Back phải đoán được, và link gửi cho nhau phải mở đúng chỗ.
 *
 * Giá trị lạ quy về `bai-viet` thay vì ném: `?tab=` là chuỗi người ta sửa được bằng tay,
 * và PLAN nguyên tắc 7 chỉ cấm đổi lựa chọn HỢP LỆ của người dùng — không cấm bỏ qua rác.
 * Cùng lối `docSort`/`docView`.
 */
export const TAB_HO_SO = ["bai-viet", "da-vote", "dang-theo", "chuyen-muc"] as const;
export type TabHoSo = (typeof TAB_HO_SO)[number];

export const TAB_HO_SO_MAC_DINH: TabHoSo = "bai-viet";

export const NHAN_TAB_HO_SO: Readonly<Record<TabHoSo, string>> = {
  "bai-viet": "Bài viết",
  "da-vote": "Đã vote",
  "dang-theo": "Đang theo",
  // "Chuyên mục" chứ không "Đang theo chuyên mục": bốn nhãn phải còn nằm một hàng, và tab
  // ngay bên cạnh đã mang chữ "Đang theo" — hai nhãn mở đầu giống nhau là mắt phải đọc hết
  // cả câu mới phân biệt được.
  "chuyen-muc": "Chuyên mục",
};

/** Ba tab đọc `/me/*` — **chỉ có nghĩa trên hồ sơ của CHÍNH MÌNH**.
 *
 * Hiện chúng trên hồ sơ người khác là hứa một thứ API sẽ từ chối, và PLAN mục 4 chốt "một
 * cái nút vĩnh viễn không bấm được còn tệ hơn không có nút". Đây cũng là ranh giới riêng
 * tư: "tôi đã vote gì" không phải dữ liệu công khai.
 */
export const TAB_RIENG: readonly TabHoSo[] = ["da-vote", "dang-theo", "chuyen-muc"];

export function laTabRieng(tab: TabHoSo): boolean {
  return TAB_RIENG.includes(tab);
}

export function docTabHoSo(gia_tri: string | string[] | undefined): TabHoSo {
  const v = Array.isArray(gia_tri) ? gia_tri[0] : gia_tri;
  return (TAB_HO_SO as readonly string[]).includes(v ?? "")
    ? (v as TabHoSo)
    : TAB_HO_SO_MAC_DINH;
}
