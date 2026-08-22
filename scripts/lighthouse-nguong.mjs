// Đọc ngưỡng điểm cho `lighthouse-seo.mjs` — nợ #12.
//
// Tách khỏi script đo vì script đó `await lighthouse(...)` ngay ở tầng module: import nó
// để kiểm một phép `Number()` là mở một tiến trình Chrome. Ở đây là hàm thuần, và
// `apps/web/e2e/don-vi/lighthouse-nguong.spec.ts` đo được nó mà không cần gì cả.
//
// **Vì sao cần đo cái này.** Bản cũ viết `Number(process.argv[3] ?? 90)`, nên
// `node scripts/lighthouse-seo.mjs <url> ""` (hoặc `abc`, hoặc một biến shell rỗng trong
// CI) cho `nguong = NaN`, và `diem < NaN` là `false` — **mọi điểm đều qua**, exit 0, in
// ra dòng "Lighthouse SEO: 31/100 (ngưỡng NaN)" mà không ai đọc. Một ngưỡng mà ca "không
// đọc được ngưỡng" đi lọt qua cửa thì nó không còn là ngưỡng, đúng thứ vá F5 vừa chữa cho
// vế bên kia (điểm không đo được).

export const NGUONG_MAC_DINH = 90;

export class NguongKhongHopLe extends Error {}

/** Ngưỡng từ đối số dòng lệnh. `undefined` ⇒ mặc định; mọi thứ khác phải là số 0..100.
 *
 * Ném chứ không lùi về mặc định: `""` và `"abc"` là dấu hiệu người gọi TƯỞNG mình đang
 * đặt một ngưỡng. Âm thầm dùng 90 thay cho ý định đó cũng là một kiểu nói dối, chỉ nhẹ
 * hơn kiểu cũ.
 */
export function docNguong(tho) {
  if (tho === undefined) return NGUONG_MAC_DINH;
  // `Number("")` và `Number("   ")` đều là **0**, không phải `NaN` — nên một phép kiểm
  // chỉ hỏi `Number.isFinite` vẫn cho chuỗi rỗng đi qua thành ngưỡng 0, và `diem < 0`
  // cũng luôn `false`. Cùng cái hỏng, chỉ đổi con số. Chặn trước khi ép kiểu.
  const n = String(tho).trim() === "" ? Number.NaN : Number(tho);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new NguongKhongHopLe(
      `ngưỡng phải là số trong 0..100, nhận ${JSON.stringify(tho)} → ${n}. ` +
        "Bỏ hẳn đối số thứ hai nếu muốn mặc định " +
        `${NGUONG_MAC_DINH}.`,
    );
  }
  return n;
}
