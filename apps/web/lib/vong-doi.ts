import { TZ_VN } from "./dinh-dang";

/** Ba mốc thời gian của vòng đời mạch/mốc mà **giao diện** phải biết — PLAN 5.1, 5.2.
 *
 * ## Nợ `API-THIEU-MOC-THOI-GIAN` — TRẢ 2026-08-23
 *
 * File này từng giữ **ba hằng chép từ `api/core/ghi.py`** (`SO_MOC_TOI_DA_MOI_NGAY = 3`,
 * `PHUT_SUA_IM_LANG = 15`, `NGAY_MO_LAI = 7`) cùng một cái chuông đọc thẳng file Python để
 * chúng khỏi trôi. Lý do có bản sao: ba quyết định RENDER không có cửa API nào trả lời —
 * *"nút Mở lại có được vẽ ra không"*, *"bấm Lưu bây giờ có để lại dấu «đã sửa» không"*,
 * *"429 rồi thì bao giờ viết tiếp được"*.
 *
 * Nay API trả sẵn cả ba **dưới dạng MỐC THỜI GIAN**, và frontend chỉ còn so với `now`:
 *
 * | câu hỏi | trường API |
 * |---|---|
 * | nút Mở lại | `MachChiTietOut.mo_lai_den` (`null` ⇒ chưa đóng sổ) |
 * | dấu "đã sửa" | `MocOut.sua_im_lang_den` |
 * | 429 hết hạn mức | `LoiThoiGianOut.thu_lai_tu` trên chính thân lỗi |
 *
 * Ba hằng **đã bị xoá**, không để lại "cho chắc": hai bản của một luật là bản sẽ trôi khỏi
 * nhau, và cái chuông giữ chúng khớp nhau chỉ là chi phí của việc có bản thứ hai. Con số
 * duy nhất còn đi từ Django ra UI là **trần mốc/ngày** (`MachChiTietOut.tran_moc_moi_ngay`)
 * — nó là một con số phải NÓI RA trước khi người ta gõ, và nó cũng do server nói.
 *
 * Cái còn lại ở đây thuần là **phép tính múi giờ**: mọi chữ "ngày" của sản phẩm là ngày
 * lịch **Asia/Ho_Chi_Minh** (PLAN mục 1), và trình duyệt của người dùng thì không.
 */

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

const GIO_PHUT_VN = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ_VN,
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  hour12: false,
});

/** `"00:00 ngày 24/08 (giờ VN)"` — một mốc thời gian **của server** nói bằng giờ VN.
 *
 * Nhận `thu_lai_tu` / `mo_lai_den` từ API và chỉ ĐỊNH DẠNG chúng. Trước 2026-08-23 hàm
 * tương ứng (`moiVietTiep`) tự cộng một ngày vào "hôm nay giờ VN" để đoán ra mốc hạn mức
 * — tức nó dựng lại luật "ranh giới là nửa đêm VN" ở phía client, và nó sẽ sai ngay lúc
 * Django đổi luật ấy. Nay server nói, đây chỉ đọc.
 *
 * Chuỗi rác trả `null`: một `Invalid Date` in ra màn hình còn tệ hơn không nói gì, và
 * người gọi có sẵn câu của server để hiện thay.
 */
export function gioPhutVN(iso: string): string | null {
  const khi = new Date(iso);
  if (Number.isNaN(khi.getTime())) return null;
  const phan = Object.fromEntries(
    GIO_PHUT_VN.formatToParts(khi).map((p) => [p.type, p.value]),
  );
  return `${phan.hour}:${phan.minute} ngày ${phan.day}/${phan.month} (giờ VN)`;
}

/** Mạch còn mở lại được không? Nhận thẳng `MachChiTietOut.mo_lai_den`.
 *
 * PLAN 5.1: "Mở lại được trong 7 ngày (sau đó nút biến mất)". Trả `false` là lệnh **không
 * render nút**, chứ không phải render nút xám — PLAN mục 4: "một cái nút vĩnh viễn không
 * bấm được còn tệ hơn không có nút".
 *
 * `null` ⇒ mạch chưa đóng sổ ⇒ không có gì để mở lại. Con số 7 không còn ở đây: nó là hạn
 * server đã cộng sẵn (`api/trinh_bay.py::han_mo_lai`).
 */
export function conMoLaiDuoc(
  moLaiDen: string | null,
  khi: Date = new Date(),
): boolean {
  if (moLaiDen === null) return false;
  const han = new Date(moLaiDen).getTime();
  if (Number.isNaN(han)) return false;
  // `<=` chứ không `<`: server từ chối bằng `>` (`api/machs.py::mo_lai_mach`), nên đúng
  // giây thứ 7×24h vẫn còn mở lại được. Hai bên phải nói cùng một chuyện ở đúng cái biên.
  return khi.getTime() <= han;
}

/** Số phút sửa im lặng còn lại của một mốc — `0` nghĩa là hết, lần sửa tới để lại dấu.
 *
 * Nhận thẳng `MocOut.sua_im_lang_den`; con số 15 nằm ở Django (`core/ghi.py`).
 *
 * Làm tròn LÊN: còn 30 giây thì trả `1`, không trả `0`. Nói "hết rồi" trong lúc server còn
 * cho sửa im lặng chỉ làm người ta chần chừ; nói "còn 1 phút" trong lúc server vừa hết hạn
 * thì họ bấm và thấy dấu "đã sửa" — mà câu cảnh báo ở cả hai nhánh đều đã nêu dấu đó
 * (xem `components/hanh-dong-moc.tsx`), nên không ai bị bất ngờ.
 */
export function phutSuaImLangConLai(
  suaImLangDen: string,
  khi: Date = new Date(),
): number {
  const han = new Date(suaImLangDen).getTime();
  if (Number.isNaN(han)) return 0;
  const con = han - khi.getTime();
  return con <= 0 ? 0 : Math.ceil(con / 60000);
}
