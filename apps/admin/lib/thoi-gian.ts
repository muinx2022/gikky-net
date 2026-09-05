/** Ngày lịch **Việt Nam** ở phía trình duyệt — cho `max` của ô `<input type="date">`.
 *
 * `occurred_at` cấm ngày tương lai, và "tương lai" tính theo **giờ VN** ở server
 * (`api/ghi_chung.py::kiem_occurred_at`). Máy của mod có thể đặt múi giờ khác; dùng
 * `new Date().toISOString()` là lệch đúng 7 tiếng trong khung 17:00–24:00 giờ VN — ô nhập
 * chặn mất chính ngày hôm nay của người đang gõ, hoặc cho gõ một ngày server sẽ từ chối.
 *
 * `en-CA` cho ra đúng `YYYY-MM-DD`, tức đúng định dạng `<input type="date">` đòi. Không
 * ghép tay từ `getFullYear()`: hàm ấy đọc múi giờ của MÁY, và cả vấn đề ở đây là không
 * được đọc múi giờ của máy.
 *
 * **Bản thứ hai của `apps/web/lib/thoi-gian.ts::homNayVN` — cố ý.** Hai app Next tách
 * biệt, không có package chung cho tầng này; chép một hàm bốn dòng rẻ hơn dựng một
 * package thứ ba. Nó chỉ là hàng rào lịch sự của UI: chốt THẬT vẫn ở server.
 */
export function homNayVN(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const TZ_VN = "Asia/Ho_Chi_Minh";

/** Một mốc thời gian (`Date`) → `YYYY-MM-DDTHH:MM` **theo giờ VN**, dạng naive.
 *
 * Riêng ra làm một hàm để hai lối vào — một ISO có sẵn, và "bây giờ" — dùng chung đúng
 * một phép đổi múi giờ. Nhận `Date` chứ không nhận chuỗi ISO: bắt phía "bây giờ" phải đi
 * vòng qua `new Date().toISOString()` là mời đúng lời gọi mà cả file này (và cả hàng rào
 * T5e) đang cấm, chỉ để rồi `new Date(...)` phân tích ngược lại.
 */
function datetimeLocalVN(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_VN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const gio = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${gio}:${p.minute}`;
}

/** ISO (UTC hay có offset) → `YYYY-MM-DDTHH:MM` theo giờ VN, cho `<input type="datetime-local">`.
 *
 * Không `toISOString()` rồi cắt: chuỗi ấy là UTC, ô datetime-local thì naive. Cắt UTC là
 * hiện lệch 7 tiếng trên ô, và gửi lại là hẹn lệch 7 tiếng — đúng rủi ro plan hẹn giờ.
 */
export function isoSangDatetimeLocalVN(iso: string): string {
  return datetimeLocalVN(new Date(iso));
}

/** Bây giờ, theo giờ VN, dạng `YYYY-MM-DDTHH:MM` — cho `min` của `<input type="datetime-local">`.
 *
 * Cùng loài hàng rào lịch sự với `homNayVN()`, và cùng giới hạn: nó đọc **đồng hồ máy
 * mod**. Máy chạy sai giờ là con số này sai theo, và ô nhập sẽ nhận một mốc mà server coi
 * là quá khứ (⇒ phát hành NGAY, không hẹn — xem `quan_tri_hen_gio.py`). Chốt thật vẫn ở
 * server; ô `min` chỉ để mod khỏi chọn nhầm trong ca thường.
 */
export function bayGioDatetimeLocalVN(): string {
  return datetimeLocalVN(new Date());
}

/** `YYYY-MM-DDTHH:MM` (đang xem là giờ VN, naive) → ISO có `+07:00`.
 *
 * VN không DST. Cấm `new Date(local).toISOString()`: máy mod lệch múi giờ là bài lên
 * lệch 7 tiếng, im lặng.
 */
export function datetimeLocalSangIsoVN(local: string): string {
  const khop = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(local);
  if (khop === null) {
    throw new Error(
      `datetime-local không đúng dạng YYYY-MM-DDTHH:MM: ${local}`,
    );
  }
  return `${khop[1]}:${khop[2] ?? "00"}+07:00`;
}
