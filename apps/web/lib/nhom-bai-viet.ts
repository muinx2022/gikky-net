import type { MachTomTatOut, SubChiTietOut } from "@gikky/api-client";

/** Khối "Bài viết" của trang chủ: một dải "Mới đăng" + "giá sách" do admin chọn + một dải bản
 * tin (plan `2026-11-11-bai-viet-trang-chu-gia-sach.md`, thay cho bản ghép cứng 6 slug của
 * `2026-11-11-homepage-v2-giao-dien-moi.md` §3.3).
 *
 * Mọi quyết định "bài nào vào đâu" sống ở đây, trong hàm THUẦN, để đo được không cần mạng
 * (`e2e/don-vi/bai-viet-trang-chu.spec.ts`).
 *
 * **Không còn slug nào gõ cứng ngoài `SUB_BAN_TIN`.** Chuyên mục nào lên giá sách là dữ liệu
 * (`Sub.vi_tri_trang_chu`, admin đặt ở `/subs`), đọc từ `GET /subs` — web không giữ danh sách. */

/** Chuyên mục của dải "Bản tin thị trường". Dải Mới đăng loại nó ra (nó có dải riêng). */
export const SUB_BAN_TIN = "tin-tuc";

/** Số bài tải về MỘT lần cho dải Mới đăng + bản tin. 50 = trần `limit` của feed. */
export const SO_BAI_VIET_TAI = 50;
/** Số bài ở dải "Mới đăng" (mọi chuyên mục trừ `SUB_BAN_TIN`). */
export const SO_MOI_DANG = 3;
/** Số bài mỗi cột giá sách (chỉ tiêu đề + ngày). */
export const SO_BAI_MOI_GIA = 3;
/** Số bản tin trong dải (plan: 2–3). */
export const SO_BAN_TIN = 3;
/** Số bản tin VẼ trong dải đầu trang (`DaiBanTin`) *(việc 19, vòng 2 — plan
 * `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.6)*. Ít hơn `SO_BAN_TIN`: với tiêu đề thật, bản
 * thứ ba không bao giờ đủ chỗ trong một dòng 1096px, và một link luôn ẩn với người mà vẫn có trong
 * HTML là thứ không nên có. Giá sách vẫn loại đủ `SO_BAN_TIN` bài. */
export const SO_BAN_TIN_DAI = 2;
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

/** `toiDa` bài `bai_viet` mới nhất thuộc MỌI chuyên mục trừ `SUB_BAN_TIN`. Không đột biến
 * `items`. */
export function chonMoiDang(
  items: readonly MachTomTatOut[],
  toiDa: number = SO_MOI_DANG,
): MachTomTatOut[] {
  return items.filter((m) => m.sub.slug !== SUB_BAN_TIN).slice(0, toiDa);
}

/** `SO_BAN_TIN` bản tin mới nhất (bài của `SUB_BAN_TIN`) trong `items`. */
export function chonBanTin(
  items: readonly MachTomTatOut[],
  toiDa: number = SO_BAN_TIN,
): MachTomTatOut[] {
  return items.filter((m) => m.sub.slug === SUB_BAN_TIN).slice(0, toiDa);
}

/** Tiền tố "Bản tin DD/MM — " (có thể kèm năm; gạch `—`, `–` hoặc `-`) mà mọi tiêu đề bản tin
 * thật đều mang. */
const TIEN_TO_BAN_TIN = /^Bản tin \d{1,2}\/\d{1,2}(\/\d{2,4})?\s*[—–-]\s*/i;

/** Tiêu đề bản tin bỏ tiền tố ngày cho dải đầu trang: dải đã in `<time>` ngay trước tiêu đề, nên
 * "13/11 · Bản tin 13/11 — S&P 500 …" in ngày HAI lần và mất ~95px của một dòng vốn đã chật.
 * Không khớp tiền tố, hoặc sau tiền tố không còn chữ nào ⇒ trả NGUYÊN tiêu đề. */
export function tieuDeBanTinGon(title: string): string {
  // Cắt bằng độ dài của phần khớp, không `replace(…, "")`: hàng rào "không slug cứng" của
  // `e2e/don-vi/bai-viet-trang-chu.spec.ts` coi mọi chuỗi trong file này là ứng viên slug.
  const tien_to = TIEN_TO_BAN_TIN.exec(title);
  if (tien_to === null) return title;
  const gon = title.slice(tien_to[0].length);
  return gon.trim().length === 0 ? title : gon;
}

/** Tập id các bài ĐÃ hiện ở các dải khác (Mới đăng, Bản tin…), để giá sách bỏ trùng. Gộp cả bản
 * tin vì admin có thể chọn `tin-tuc` làm một giá — nếu không, 3 bài của giá ấy trùng đúng dải
 * Bản tin ngay bên dưới. */
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
