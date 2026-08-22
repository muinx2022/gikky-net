import { TZ_VN } from "./dinh-dang";

/** Ba cái mốc thời gian của vòng đời mạch/mốc mà **giao diện** phải biết — PLAN 5.1, 5.2.
 *
 * ⚠ **Đây là ba con số ĐÃ CÓ ở Django** (`api/core/ghi.py`: `SO_MOC_TOI_DA_MOI_NGAY = 3`,
 * `PHUT_SUA_IM_LANG = 15`, `NGAY_MO_LAI = 7`), và có một bản thứ hai ở đây là chuyện phải
 * ghi ra chứ không giấu đi — PLAN nguyên tắc 10 nói "luật domain ở Django, frontend chỉ
 * render".
 *
 * **Vì sao vẫn phải có bản thứ hai:** luật *thi hành* nằm ở server và không đổi (server vẫn
 * là bên từ chối), nhưng ba quyết định RENDER dưới đây không có cửa API nào trả lời:
 *
 * 1. *"nút Mở lại có được vẽ ra không"* — PLAN 5.1 nói "sau đó **nút biến mất**", mà
 *    `MachChiTietOut` chỉ có `closed_at`, không có cờ `mo_lai_duoc`;
 * 2. *"bấm Lưu bây giờ có để lại dấu «đã sửa» không"* — phải nói TRƯỚC khi bấm, mà
 *    `MocOut` chỉ có `created_at`, không có `sua_im_lang_den`;
 * 3. *"429 rồi thì bao giờ viết tiếp được"* — server nói "mai nối tiếp nhé", không nói mốc.
 *
 * Cả ba là **nợ có tên `API-THIEU-MOC-THOI-GIAN`**: đường đúng là API trả sẵn ba mốc ấy
 * (`mo_lai_den`, `sua_im_lang_den`, `noi_moc_lai_tu`) và frontend chỉ so với `now`. Đến lúc
 * đó thì ba hằng dưới đây phải bị xoá, không phải để lại "cho chắc" — hai bản của một luật
 * là bản sẽ trôi khỏi nhau.
 *
 * Cho tới lúc đó, hỏng ở đây **hỏng về phía an toàn**: lệch giờ chỉ làm UI vẽ thừa một cái
 * nút hoặc nói hơi sai một câu cảnh báo; server vẫn từ chối bằng `het_han_mo_lai` /
 * `qua_han_muc_moc`, và mọi form đều hiện lại câu đó (xem `lib/ghi.ts`).
 *
 * ⚠ **Ba hằng dưới đây có CHUÔNG**: `e2e/don-vi/vong-doi.spec.ts` đọc thẳng
 * `api/core/ghi.py` và đỏ nếu con số hai bên lệch nhau. Bản sao không có chuông mới là bản
 * sao nguy hiểm; bản này thì đổi ở Django là đỏ ở đây ngay lượt chạy sau.
 */

/** PLAN 5.1 — mở lại được trong 7 ngày kể từ khi đóng sổ. */
export const NGAY_MO_LAI = 7;

/** PLAN 5.2 — sửa im lặng trong 15 phút đầu; sau đó mỗi lần sửa tạo `MocRevision`. */
export const PHUT_SUA_IM_LANG = 15;

/** PLAN 5.1 — tối đa 3 mốc mỗi ngày lịch VN cho MỘT mạch. UI chỉ *nói ra* con số này
 * trước khi người ta gõ; bên từ chối vẫn là server (429 `qua_han_muc_moc`). */
export const SO_MOC_TOI_DA_MOI_NGAY = 3;

const NGAY_SO_VN = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_VN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `"2026-08-23"` — hôm nay theo **giờ VN**, đúng định dạng `<input type="date">` đòi.
 *
 * `en-CA` cho ra sẵn `YYYY-MM-DD`; ghim `timeZone` thay vì tin vào múi giờ của máy, cùng
 * lý lẽ với cả `lib/dinh-dang.ts`. Máy dev chạy UTC mà người dùng ở GMT+7 thì trong khung
 * 17:00–24:00 giờ VN, "hôm nay" của hai bên lệch nhau đúng một ngày — và server sẽ từ chối
 * `occurred_at` mà chính người dùng thấy là hôm nay.
 */
export function homNayVN(khi: Date = new Date()): string {
  return NGAY_SO_VN.format(khi);
}

/** `{nam, thang, ngay}` của một thời điểm, tính theo giờ VN. */
function boNgayVN(khi: Date): { nam: number; thang: number; ngay: number } {
  const [nam, thang, ngay] = homNayVN(khi).split("-").map(Number);
  return { nam, thang, ngay };
}

/** `"00:00 ngày 24/08 (giờ VN)"` — thời điểm hạn mức mốc được nạp lại.
 *
 * Hạn mức của PLAN 5.1 tính theo **ngày lịch VN**, không phải 24 giờ trượt (xem docstring
 * `noi_moc` ở `api/machs.py`), nên mốc được viết tiếp luôn là nửa đêm VN kế tiếp. Câu của
 * server dừng ở "mai nối tiếp nhé" — đúng nhưng thiếu con số, và "mai" lúc 23:50 nghĩa là
 * mười phút nữa chứ không phải một ngày nữa.
 *
 * Cộng ngày bằng `Date.UTC`: Việt Nam không có DST nên phép cộng trên lịch là an toàn, và
 * đi qua UTC thì không dính múi giờ của máy đang chạy.
 */
export function moiVietTiep(khi: Date = new Date()): string {
  const { nam, thang, ngay } = boNgayVN(khi);
  const mai = new Date(Date.UTC(nam, thang - 1, ngay + 1));
  const dd = String(mai.getUTCDate()).padStart(2, "0");
  const mm = String(mai.getUTCMonth() + 1).padStart(2, "0");
  return `00:00 ngày ${dd}/${mm} (giờ VN)`;
}

/** Mạch đóng sổ lúc `closedAt` còn mở lại được không? `null` ⇒ chưa đóng ⇒ `false`.
 *
 * PLAN 5.1: "Mở lại được trong 7 ngày (sau đó nút biến mất)". Trả `false` là lệnh **không
 * render nút**, chứ không phải render nút xám — PLAN mục 4: "một cái nút vĩnh viễn không
 * bấm được còn tệ hơn không có nút".
 */
export function conMoLaiDuoc(
  closedAt: string | null,
  khi: Date = new Date(),
): boolean {
  if (closedAt === null) return false;
  const dong = new Date(closedAt).getTime();
  if (Number.isNaN(dong)) return false;
  return khi.getTime() - dong <= NGAY_MO_LAI * 24 * 60 * 60 * 1000;
}

/** Số phút sửa im lặng còn lại của một mốc — `0` nghĩa là hết, lần sửa tới để lại dấu.
 *
 * Làm tròn LÊN: còn 30 giây thì trả `1`, không trả `0`. Nói "hết rồi" trong lúc server còn
 * cho sửa im lặng chỉ làm người ta chần chừ; nói "còn 1 phút" trong lúc server vừa hết hạn
 * thì họ bấm và thấy dấu "đã sửa" — mà câu cảnh báo ở cả hai nhánh đều đã nêu dấu đó
 * (xem `components/hanh-dong-moc.tsx`), nên không ai bị bất ngờ.
 */
export function phutSuaImLangConLai(
  createdAt: string,
  khi: Date = new Date(),
): number {
  const tao = new Date(createdAt).getTime();
  if (Number.isNaN(tao)) return 0;
  const con = tao + PHUT_SUA_IM_LANG * 60 * 1000 - khi.getTime();
  return con <= 0 ? 0 : Math.ceil(con / 60000);
}
