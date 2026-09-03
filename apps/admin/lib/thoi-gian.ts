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
