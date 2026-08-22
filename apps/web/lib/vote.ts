/** Vote — phần 1d chạm tới: **mũi tên render nhưng chưa bấm được** (plan con 1d §1).
 *
 * Hằng nằm ở `lib/` chứ không trong `components/cot-vote.tsx` để bài đo e2e import được
 * nó: Playwright biên dịch spec sang CJS và không xử lý được `import css from
 * "./x.module.css"`, nên mọi hằng mà bài đo cần đọc phải sống ngoài component.
 *
 * Bài đo dùng chung hằng với code sản phẩm là chuyện có đánh đổi — đổi chữ ở đây thì hai
 * vế đổi cùng lúc và không có gì đỏ. Chấp nhận được vì thứ đang đo là *"cái nút có nói ra
 * lý do không"*, không phải *"lý do viết đúng chữ nào"*: bỏ hẳn `title`/`aria-label` vẫn
 * đỏ, mà đó mới là ca thật (bài học `error.tsx` của 1c — nút chết).
 */
export const LY_DO_TAT_VOTE = "Đăng nhập để vote";
