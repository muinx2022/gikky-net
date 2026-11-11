import {
  KHOANG_MAC_DINH,
  TAB_MAC_DINH,
  type KhoangFeed,
  type LoaiMach,
  type TabFeed,
} from "./api";

/** Chip lọc theo loại mạch trên trang chuyên mục `/s/<sub>` (plan
 * `2026-11-10-chuyen-muc-loc-loai.md`).
 *
 * Chuyên mục dùng CHUNG cho nhật ký, bài viết và chủ đề, nên một trang `/s/<sub>` lẫn cả ba
 * loại; hàng chip là cách người đọc tách chúng ra, và nhãn nhỏ trên thẻ là cách họ biết
 * mỗi thẻ thuộc loại nào khi chưa lọc.
 *
 * **Chữ NGẮN, khác `NHAN_LOAI_MACH`.** Bảng ở `lib/api.ts` gọi loại thứ ba là "Chủ đề thảo
 * luận" (tên đầy đủ — chip "Loại: …" của `/?loai_mach=…`, form quản trị). Chip và nhãn thẻ
 * cần chữ ngắn để hàng chip không tràn ở 375px, nên có bảng riêng ở đây. Kiểu `Record<
 * LoaiMach, …>` ép đủ hai chiều như `NHAN_LOAI_MACH`: API mọc thêm loại mà thiếu chữ ở đây
 * là lỗi biên dịch.
 */
export const NHAN_NGAN_LOAI_MACH: Readonly<Record<LoaiMach, string>> = {
  nhat_ky: "Nhật ký",
  bai_viet: "Bài viết",
  thao_luan: "Chủ đề",
};

/** Cùng ba loại, viết thường — đứng giữa câu ("Chưa có bài viết nào trong chuyên mục này."). */
export const TEN_THUONG_LOAI_MACH: Readonly<Record<LoaiMach, string>> = {
  nhat_ky: "nhật ký",
  bai_viet: "bài viết",
  thao_luan: "chủ đề",
};

/** Dựng href cho MỘT chip: giữ `tab`, `khoang`, `truong_phai` đang có, đặt `loai_mach` theo
 * chip (`undefined` = chip "Tất cả" = KHÔNG có `loai_mach` trên URL), và **không bao giờ**
 * mang `cursor` theo.
 *
 * - Bỏ `cursor`: cursor mang khoá sort của tập bài sinh ra nó; đổi loại là đổi tập bài, nên
 *   về trang đầu. Hàm này không nhận `cursor` làm tham số — không có đường nào để lọt vào.
 * - Tham số mặc định (`tab=moi`, `khoang=tat_ca`) bị cắt để chip "Tất cả" ở trạng thái mặc
 *   định ra đúng `coBan` trần — URL sạch, link chia sẻ đọc được, và là cùng URL mà bot đã
 *   biết từ trước khi có chip.
 * - `truong_phai` do người dùng gõ nên đi qua `encodeURIComponent` (`&`, `#`, dấu cách,
 *   chữ có dấu không được làm vỡ query string).
 * - Thứ tự `tab` → `khoang` → `truong_phai` → `loai_mach` trùng thứ tự các href của
 *   `Feed` (tab, khoảng): hai nơi dựng URL cùng một trạng thái phải ra cùng một chuỗi.
 */
export function hrefChipLoai(
  coBan: string,
  hienTai: { tab: TabFeed; khoang: KhoangFeed; truongPhai?: string },
  loai: LoaiMach | undefined,
): string {
  const phan: string[] = [];
  if (hienTai.tab !== TAB_MAC_DINH) phan.push(`tab=${hienTai.tab}`);
  if (hienTai.khoang !== KHOANG_MAC_DINH) phan.push(`khoang=${hienTai.khoang}`);
  if (hienTai.truongPhai) phan.push(`truong_phai=${encodeURIComponent(hienTai.truongPhai)}`);
  if (loai !== undefined) phan.push(`loai_mach=${loai}`);
  return phan.length === 0 ? coBan : `${coBan}?${phan.join("&")}`;
}
