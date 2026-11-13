import type { MachTomTatOut, SubChiTietOut } from "@gikky/api-client";

import { SUB_BAN_TIN } from "./ban-tin";

/** Khối "Bài viết" của trang chủ: một dải "Mới đăng" + "giá sách" do admin chọn (plan
 * `2026-11-11-bai-viet-trang-chu-gia-sach.md`, thay cho bản ghép cứng 6 slug của
 * `2026-11-11-homepage-v2-giao-dien-moi.md` §3.3).
 *
 * Mọi quyết định "bài nào vào đâu" sống ở đây, trong hàm THUẦN, để đo được không cần mạng
 * (`e2e/don-vi/bai-viet-trang-chu.spec.ts`).
 *
 * **Không còn slug nào gõ cứng.** Chuyên mục nào lên giá sách là dữ liệu (`Sub.vi_tri_trang_chu`,
 * admin đặt ở `/subs`), đọc từ `GET /subs` — web không giữ danh sách. Bản tin là bảng RIÊNG từ việc
 * 20 (plan `2026-11-13-ban-tin-bang-rieng.md`): `chonBanTin` đã bỏ; còn đúng MỘT lọc theo
 * `SUB_BAN_TIN` (import từ `lib/ban-tin.ts`, không gõ lại slug) — lớp phòng thủ của `chonMoiDang`. */

/** Số bài tải về MỘT lần cho dải Mới đăng. 50 = trần `limit` của feed. */
export const SO_BAI_VIET_TAI = 50;
/** Số bài ở dải "Mới đăng" (mọi chuyên mục trừ `SUB_BAN_TIN`). */
export const SO_MOI_DANG = 3;
/** Số bài mỗi cột giá sách (chỉ tiêu đề + ngày). */
export const SO_BAI_MOI_GIA = 3;
/** Số bài xin cho MỖI giá: đủ để sau khi bỏ bài đã ở dải Mới đăng (tối đa `SO_MOI_DANG`) vẫn
 * còn `SO_BAI_MOI_GIA`. Lời gọi riêng theo sub nên sub đăng chậm vẫn có bài, không phụ thuộc
 * cửa sổ `SO_BAI_VIET_TAI` của feed chung. */
export const SO_BAI_TAI_MOI_GIA = SO_BAI_MOI_GIA + SO_MOI_DANG;

/** Một giá sách: sub + các bài `bai_viet` mới nhất của riêng nó (mới → cũ, như API trả). */
export type GiaSachTho = {
  sub: Pick<SubChiTietOut, "slug" | "ten">;
  items: readonly MachTomTatOut[];
};

/** Giá sách đã dựng xong, sẵn để vẽ cột. */
export type GiaSach = {
  sub: Pick<SubChiTietOut, "slug" | "ten">;
  baiViet: MachTomTatOut[];
};

/** `toiDa` bài `bai_viet` mới nhất thuộc mọi chuyên mục TRỪ chuyên mục bản tin. Không đột biến
 * `items`.
 *
 * **Bộ lọc `SUB_BAN_TIN` là PHÒNG THỦ** (việc 20, vòng sửa 1): API đã chặn mạch mới vào `tin-tuc`,
 * nhưng lệnh `chuyen_ban_tin` cố ý BỎ QUA một số mạch cũ (`loai` lạ, có ảnh, trùng ngày, của người
 * thường…) — chúng ở lại là `bai_viet` công khai trong `tin-tuc` và, không có dòng này, chui vào dải
 * "Mới đăng" như một bản tin dạng nhật ký. Đừng gỡ khi chưa chắc sub ấy đã sạch trên prod. */
export function chonMoiDang(
  items: readonly MachTomTatOut[],
  toiDa: number = SO_MOI_DANG,
): MachTomTatOut[] {
  return items.filter((m) => m.sub.slug !== SUB_BAN_TIN).slice(0, toiDa);
}

/** Tập id các bài ĐÃ hiện ở các dải khác (Mới đăng…), để giá sách bỏ trùng. */
export function idDaHien(...cac_dai: readonly (readonly MachTomTatOut[])[]): Set<number> {
  return new Set(cac_dai.flatMap((d) => d.map((m) => m.id)));
}

/** Các sub admin đã chọn lên trang chủ (`vi_tri_trang_chu != null`), theo vị trí tăng dần.
 * Không đột biến `cac_sub`. */
export function subLenTrangChu<T extends Pick<SubChiTietOut, "vi_tri_trang_chu">>(
  cac_sub: readonly T[],
): T[] {
  return cac_sub
    .filter((s) => s.vi_tri_trang_chu !== null && s.vi_tri_trang_chu !== undefined)
    .sort((a, b) => (a.vi_tri_trang_chu as number) - (b.vi_tri_trang_chu as number));
}

/** Dựng các cột giá sách từ `gia` (đã đúng thứ tự vị trí): bỏ bài có id trong `daHien` (đã ở
 * dải Mới đăng), cắt `toiDa` bài đầu, và BỎ giá không còn bài nào (ẩn cột, không khung rỗng).
 * Giữ thứ tự `gia` và thứ tự bài trong từng giá. Không đột biến đầu vào. */
export function dungGiaSach(
  gia: readonly GiaSachTho[],
  daHien: ReadonlySet<number>,
  toiDa: number = SO_BAI_MOI_GIA,
): GiaSach[] {
  return gia
    .map((g) => ({
      sub: g.sub,
      baiViet: g.items.filter((m) => !daHien.has(m.id)).slice(0, toiDa),
    }))
    .filter((g) => g.baiViet.length > 0);
}
