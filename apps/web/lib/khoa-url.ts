/** Khoá allauth lấy từ path param của Next — **phải giải mã percent-encoding**.
 *
 * allauth ghép khoá vào URL trong email, nên nó bị mã hoá:
 * `Nw:1wxoxp:pfQ…` → `Nw%3A1wxoxp%3ApfQ…`. Gửi thẳng chuỗi đã mã hoá xuống
 * `/auth/email/verify` là **400** — một mã trông y hệt "khoá sai hoặc hết hạn", nên lỗi
 * này rất dễ bị chẩn đoán nhầm thành "luồng xác thực hỏng". Nó đã hỏng đúng như vậy một
 * lần trong lúc làm Phase 2, và bài đo e2e `tai-khoan-va-ghi.spec.ts` là thứ tìm ra.
 *
 * **Vì sao giải mã ở đây chứ không tin `params` của Next:** hành vi decode của path param
 * khác nhau giữa các bản Next và giữa dev/prod build, và cả hai chiều đều im lặng — chiều
 * này ra 400, chiều kia ra một khoá đúng. Hàm dưới an toàn ở CẢ HAI:
 *
 * - Next đã giải mã ⇒ chuỗi không còn ký tự `%` nào, `decodeURIComponent` trả nguyên si;
 * - Next chưa giải mã ⇒ nó giải mã.
 *
 * Điều đó đúng nhờ một tính chất của chính khoá, không phải nhờ may: khoá allauth là
 * base64url (`A–Z a–z 0–9 - _`) nối bằng `:`, **không bao giờ chứa `%`**. Nếu ngày nào
 * allauth đổi bảng chữ cái của khoá thì lập luận này gãy — và đó là lý do câu này được
 * viết ra thay vì chỉ gọi `decodeURIComponent` cho gọn.
 */
export function giaiMaKhoa(tho: string): string {
  try {
    return decodeURIComponent(tho);
  } catch {
    // Chuỗi có `%` nhưng không phải escape hợp lệ ⇒ không phải khoá của ta. Trả nguyên
    // si để server là chỗ từ chối, chứ không tự bịa ra một khoá khác.
    return tho;
  }
}
