/** URL của sản phẩm — PLAN 5.9. Một chỗ dựng, một chỗ đọc.
 *
 * `/m/<slug>-<id>` · `/s/<sub>` · `/u/<username>` · `/luat` · `/` (2 tab qua `?tab=`)
 *
 * **`id` là khoá bền, `slug` chỉ để đọc** (PLAN 5.9): slug đổi được, và `Mach.slug`
 * không unique nên hai mạch trùng tên vẫn ra hai URL khác nhau. Vì thế mọi tra cứu đi
 * theo `id`; slug chỉ được so lại để quyết định redirect.
 */

/** Tách `"nhat-ky-lenh-hpg-1008"` thành `{ slug: "nhat-ky-lenh-hpg", id: 1008 }`.
 *
 * `null` khi đoạn cuối không phải số nguyên dương — không có `id` thì không tra được
 * mạch nào, và đoán mò ở đây là cách nhanh nhất để `/m/khong-co-gi` trả 500 thay vì 404.
 *
 * Slug rỗng (`"-1008"`) **hợp lệ**: `slug_tu_title` của API trả chuỗi rỗng cho title
 * toàn ký tự bị slugify loại (vd chỉ có emoji), và ca đó được xử như mọi slug lệch khác
 * — 301 về dạng chuẩn.
 */
export function tachSlugId(doan: string): { slug: string; id: number } | null {
  const vach = doan.lastIndexOf("-");
  if (vach < 0) return null;
  const duoi = doan.slice(vach + 1);
  if (!/^\d+$/.test(duoi)) return null;
  const id = Number(duoi);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { slug: doan.slice(0, vach), id };
}

export function duongDanMach(slug: string, id: number): string {
  return `/m/${slug}-${id}`;
}

/** `/m/<slug>-<id>` với khán đài **đã bung**, neo tại `#khan-dai`.
 *
 * Một chỗ dựng cho cả `💬 N` trên thẻ feed lẫn chân trang mặt CẶN: hai chỗ tự ghép query
 * string là hai chỗ sẽ lệch nhau ở lần thêm tham số tiếp theo, và cái lệch đó không kêu ở
 * đâu — chỉ có một trong hai cú bấm mở đúng khán đài.
 *
 * `sort=hay_nhat` viết tường minh chứ không để trống: `?khan_dai=1` một mình cũng ra
 * `hay_nhat` (mặc định của `docSort`), nhưng khi đó thanh sort trên trang và URL nói hai
 * chuyện khác nhau, và bấm Back sau khi đổi sort sẽ về một URL không mang sort.
 */
export function duongDanKhanDai(slug: string, id: number): string {
  return `${duongDanMach(slug, id)}?khan_dai=1&sort=hay_nhat#khan-dai`;
}

export function duongDanSub(slug: string): string {
  return `/s/${slug}`;
}

export function duongDanHoSo(username: string): string {
  return `/u/${username}`;
}
