/** Đọc bảng token màu từ `app/globals.css` — dùng chung cho `tuong-phan.spec.ts` và
 * `nut-chinh-brand.spec.ts`. Tách ra file thường (không phải `.spec.ts`) vì Playwright cấm một
 * file spec import file spec khác: import thẳng thì các bài của file kia bị đăng ký hai lần. */

/** Đọc một khối `:root { … }` (hoặc `:root[data-theme="dark"] { … }`) thành bảng token. */
export function docToken(css: string, chon: string): Record<string, string> {
  const tai = css.indexOf(chon);
  if (tai === -1) throw new Error(`Không thấy khối \`${chon}\` trong globals.css`);
  const mo = css.indexOf("{", tai);
  const dong = css.indexOf("}", mo);
  if (mo === -1 || dong === -1) throw new Error(`Khối \`${chon}\` không đóng ngoặc.`);
  const ra: Record<string, string> = {};
  for (const m of css.slice(mo, dong).matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    ra[m[1]] = m[2];
  }
  if (Object.keys(ra).length === 0) {
    throw new Error(`Cắt được \`${chon}\` nhưng không ra token màu nào — bài đo sẽ rỗng.`);
  }
  return ra;
}
