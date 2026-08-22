import css from "./bao-cursor-hong.module.css";

/** "URL nói trang sau, thực tế là trang đầu" — phải NÓI RA (vá A1, 2026-08-22).
 *
 * `giai_ma_cursor` của API cố ý không có nhánh "đoán bừa", với lý do viết thẳng trong
 * `api/phan_trang.py`: *"cursor rác mà bị hiểu thành 'trang đầu' là người dùng nhận lại
 * trang 1 trong khi tưởng mình đang đọc trang 5, im lặng và không lặp lại được"*. Tầng
 * frontend không được phá lý do đó khi nó nuốt 400 để trang khỏi 500 — nên nó nuốt lỗi
 * **kèm theo dòng này**.
 *
 * Một chỗ sinh chuỗi, dùng cho cả feed lẫn khán đài: hai câu chữ khác nhau cho cùng một
 * sự kiện là hai thứ sẽ trôi khỏi nhau.
 */
export function BaoCursorHong() {
  return (
    <p className={css.bao} data-testid="bao-cursor-hong" role="status">
      Địa chỉ có tham số phân trang không dùng được — đang hiện lại từ trang đầu.
    </p>
  );
}
