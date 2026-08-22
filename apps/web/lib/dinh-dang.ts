/** Định dạng ngày/giờ + con số cho UI. Mọi chỗ hiện thời gian đi qua đây.
 *
 * **Múi giờ chuẩn của sản phẩm là Asia/Ho_Chi_Minh** (PLAN mục 1) — hằng `TZ_VN` dưới
 * đây được truyền tường minh vào `Intl`, không dựa vào múi giờ của máy chạy Node. Server
 * render ở UTC còn trình duyệt ở GMT+7 mà không ghim thì cùng một mốc ra hai ngày khác
 * nhau, React báo hydration mismatch, và với sản phẩm mà "ghi lúc nào" **là** giá trị lõi
 * thì lệch một ngày không phải lỗi hiển thị.
 */

export const TZ_VN = "Asia/Ho_Chi_Minh";

/** `occurred_at` là DATE thuần (`"2026-03-04"`) — ngày sự việc, người dùng đặt.
 *
 * Cố tình **không** đi qua `new Date()`: chuỗi `"2026-03-04"` được JS hiểu là nửa đêm
 * UTC, quy về giờ VN vẫn đúng ngày, nhưng quy về bất kỳ múi giờ âm nào là lùi một ngày.
 * Ngày ở đây không có giờ để mà quy đổi — cắt chuỗi là cách duy nhất không sinh ra một
 * phép quy đổi vốn không tồn tại.
 */
export function ngayTuChuoi(iso_date: string): { ngay: string; thang: string; nam: string } {
  const [nam, thang, ngay] = iso_date.split("-");
  return { ngay, thang, nam };
}

/** `04/03/2026` */
export function ngayDayDu(iso_date: string): string {
  const { ngay, thang, nam } = ngayTuChuoi(iso_date);
  return `${ngay}/${thang}/${nam}`;
}

/** `04/03` — dùng khi năm đã rõ từ ngữ cảnh (blockquote trích, biên lai). */
export function ngayNgan(iso_date: string): string {
  const { ngay, thang } = ngayTuChuoi(iso_date);
  return `${ngay}/${thang}`;
}

const NGAY_GIO_VN = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ_VN,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const NGAY_VN = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ_VN,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function phan(fmt: Intl.DateTimeFormat, iso: string): Record<string, string> {
  const ra: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(iso))) ra[p.type] = p.value;
  return ra;
}

/** `04/03/2026 · 21:14` — dấu thời gian SERVER (`created_at`), kiểu biên lai. */
export function dauThoiGianServer(iso: string): string {
  const p = phan(NGAY_GIO_VN, iso);
  return `${p.day}/${p.month}/${p.year} · ${p.hour}:${p.minute}`;
}

/** `04/03/2026` từ một `created_at` ISO có giờ. */
export function ngayCuaThoiDiem(iso: string): string {
  const p = phan(NGAY_VN, iso);
  return `${p.day}/${p.month}/${p.year}`;
}

/** `04/03` từ một `created_at` ISO có giờ. */
export function ngayNganCuaThoiDiem(iso: string): string {
  const p = phan(NGAY_VN, iso);
  return `${p.day}/${p.month}`;
}

/** Dòng `12 mạch · lập 04/03/2026` dưới tên một chuyên mục — **một chỗ dựng, hai chỗ
 * đọc** (header `/s/<sub>` và sidebar).
 *
 * `so_mach === 0` **không in số 0** *(vá V6, 2026-08-22)*. PLAN nguyên tắc 9 cấm phô sự
 * im lặng, và ca này là cửa anh em của `×0` vừa đóng ở hồ sơ: v1 tạo sub bằng tay qua
 * admin (PLAN mục 1), nên "0 mạch · lập 22/08/2026" nằm ngay cạnh "Chưa có bài nào ở
 * đây." là hình dạng MẶC ĐỊNH của mọi chuyên mục mới, không phải ca biên. Hai lần nói
 * cùng một chuyện, và lần thứ nhất nói bằng một con số 0.
 *
 * ⚠ **Câu thay thế KHÔNG được nói "mới"** *(W4, lượt vá 2)*. Bản V6 in *"Chuyên mục mới
 * · lập 04/03/2024"* — hai vế tự mâu thuẫn trên cùng một dòng, và nó **sai thật**:
 * `so_mach` đếm mạch **hiện được**, nên một chuyên mục sống hai năm rồi bị mod ẩn sạch
 * bài cũng rơi vào nhánh này. `×0` cũ ít nhất không nói gì thêm; một câu sai về dữ liệu
 * thì tệ hơn một con số vô duyên.
 *
 * Câu hiện tại **không khẳng định gì về nội dung** — nó chỉ nêu ngày lập, thứ đúng trong
 * cả hai ca và **không rò** ra việc có bài bị ẩn (đường suy ra "sub này vừa bị dọn" là
 * một rò rỉ moderation, cùng lý lẽ với mã lỗi `khong_tim_thay` gộp chung ở `api/loi.py`).
 * Ngày lập ở lại vì nó là thông tin thật về nơi chốn này, không phải một số đếm bằng 0.
 *
 * ⚠ Đây là luật **RENDER**, không phải luật API: `GET /subs` vẫn trả `so_mach = 0` và
 * `api/tests/test_api_sub.py` vẫn ghim điều đó. Tầng API không được nói dối về con số;
 * tầng render quyết định có bày nó ra hay không.
 */
export function dongSoMachSub(soMach: number, createdAtIso: string): string {
  const lap = `lập ${ngayCuaThoiDiem(createdAtIso)}`;
  return soMach === 0 ? `Chuyên mục ${lap}` : `${soMach} mạch · ${lap}`;
}

/** Số nguyên có dấu, dùng cho điểm vote: `+28`, `−3`, `0`.
 *
 * Dấu trừ là U+2212 (dấu toán học) chứ không phải hyphen: ở font mono nó cân bằng chiều
 * ngang với dấu `+`, nên cột điểm không nhảy.
 */
export function diemCoDau(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}
