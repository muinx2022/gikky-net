/** Dấu đánh lên nút DOM chứa **chữ do NGƯỜI DÙNG gõ** — Y3, lượt vá 4 (2026-08-22).
 *
 * **Vì sao nó tồn tại.** Hàng rào `khongQuaQuyetVeQuaKhu` (`e2e/vo-reddit.spec.ts`) quét
 * cả `main` của trang hồ sơ để bắt ứng dụng quả quyết về quá khứ người ta, hoặc rò ra
 * rằng có nội dung vừa bị kiểm duyệt. X1 mở phạm vi ra cả `main` rồi chống đỏ giả bằng
 * **ranh giới từ** — và cách ấy không đủ: trong *gỡ gạc* thì `gỡ` là một từ **trọn vẹn**,
 * trong *ẩn dật* thì `ẩn` cũng vậy. Một `bio` gõ đúng hai chữ đó làm bài đo đỏ, và người
 * sửa sau sẽ thu hẹp phạm vi lại — đúng cái cửa X1 vừa đóng.
 *
 * Cách chữa đúng loài: **đừng quét chữ của người dùng**. Ranh giới không nằm ở hình dạng
 * chuỗi mà ở chỗ *ai nói câu đó*. Nút mang dấu này bị loại khỏi phép quét; phạm vi còn
 * lại vẫn là cả `main`.
 *
 * **Đánh dấu ở đâu — danh sách ĐẦY ĐỦ, và nó phải đầy đủ** *(§3 rủi ro 2 của plan)*: sót
 * một chỗ là đỏ giả quay lại, thừa một chỗ là bịt mắt hàng rào ở chỗ đó.
 *
 * - `components/than-van.tsx` — thân văn của **mọi** mốc và **mọi** bình luận, tức chỗ
 *   duy nhất `body` do người dùng gõ được in ra;
 * - `app/u/[username]/page.tsx` — `display_name` (h1), `u/{username}` (dòng dưới h1 và
 *   khúc sau chữ "Mạch của" ở h2), `bio`;
 * - `components/the-mach.tsx` — `s/{sub.slug}`, `u/{author.username}`, `title`, `ket_qua`;
 * - `components/binh-luan.tsx` — `u/{author.username}` trên đầu mỗi bình luận.
 *
 * **Cố ý KHÔNG đánh dấu** những chỗ ứng dụng tự nói về nội dung người dùng, kể cả khi nó
 * đứng ngay cạnh: `[bình luận đã xoá]`, `[bình luận đã bị ẩn]`, `đã đóng sổ`, `CHỦ MẠCH`,
 * `‹mốc N›`. Đó là chữ của ứng dụng — nếu một ngày hàng rào mở sang trang mạch thì đúng
 * chúng là thứ phải soi, và đánh dấu chúng bây giờ là tự tay tạo ra một điểm mù.
 *
 * Dùng bằng cách spread để **tên thuộc tính có đúng một nguồn**: viết tay chuỗi
 * `data-chu-nguoi-dung` ở 9 chỗ là 9 chỗ có thể gõ sai, mà gõ sai thì không gì đỏ — nút
 * ấy chỉ lặng lẽ quay lại nằm trong phép quét.
 *
 *     <p className={css.bio} {...CHU_NGUOI_DUNG}>{ho_so.bio}</p>
 */
export const TEN_DAU_CHU_NGUOI_DUNG = "data-chu-nguoi-dung";

export const CHU_NGUOI_DUNG = { [TEN_DAU_CHU_NGUOI_DUNG]: "" } as const;
