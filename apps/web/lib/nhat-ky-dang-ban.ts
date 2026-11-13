/** Dải "Đang được bàn" dưới khối "Nhật ký mới" của `/` (plan `2026-11-13-nhat-ky-dang-ban.md`).
 * Hàm THUẦN — đo được không cần mạng (`e2e/don-vi/nhat-ky-dang-ban.spec.ts`). */

/** Số hàng tối đa của dải. API trả tới 10 để còn đủ hàng sau khi bỏ trùng với 8 thẻ khối trên. */
export const SO_DANG_BAN = 5;

/** Số mục xin API (`?limit=`, trần của endpoint). */
export const SO_DANG_BAN_TAI = 10;

/** Bỏ mục có `mach.id` thuộc `idDaHien` (thẻ đang vẽ ở khối "Nhật ký mới" — khỏi lặp cùng một
 * nhật ký hai lần trên một màn hình), GIỮ thứ tự API (số người bàn → đếm bình luận → bình luận cuối → id), cắt ở
 * `toiDa`. Không đột biến đối số. */
export function chonDangBan<T extends { mach: { id: number } }>(
  muc: readonly T[],
  idDaHien: ReadonlySet<number>,
  toiDa: number = SO_DANG_BAN,
): T[] {
  return muc.filter((m) => !idDaHien.has(m.mach.id)).slice(0, Math.max(0, toiDa));
}
