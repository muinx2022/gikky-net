/** Vote — hằng và kiểu dùng chung giữa `components/cot-vote.tsx` và bài đo e2e.
 *
 * Hằng nằm ở `lib/` chứ không trong component để bài đo import được: Playwright biên dịch
 * spec sang CJS và không xử lý được `import css from "./x.module.css"`, nên mọi hằng mà
 * bài đo cần đọc phải sống ngoài component.
 *
 * Bài đo dùng chung hằng với code sản phẩm là chuyện có đánh đổi — đổi chữ ở đây thì hai
 * vế đổi cùng lúc và không có gì đỏ. Chấp nhận được vì thứ đang đo là *"cái nút có nói ra
 * lý do không, và có nói ĐÚNG lý do không"*, không phải *"lý do viết đúng chữ nào"*: bỏ
 * hẳn `title`/`aria-label`, hoặc dùng nhầm một lý do cho ca kia, vẫn đỏ.
 */

/** Đích của một lá phiếu — khớp đúng `POST /votes` (`target_type` + `target_id`).
 *
 * Không khai lại kiểu của API (PLAN 8.3 cấm): `loai` là hai chuỗi hằng của domain, còn
 * hình dạng request thì `datVote` sinh ra từ OpenAPI đã ghim.
 */
export type DichVote = { loai: "moc" | "comment"; id: number };

/** Khách chưa đăng nhập. Từ Phase 2 đây là ca **tạm thời** — bấm Đăng nhập là xong. */
export const LY_DO_CHUA_DANG_NHAP = "Đăng nhập để vote";

/** Nhịp `GET /me` chưa về (L15, 2026-08-23).
 *
 * `usePhien()` trả `{toi: null, dangTai: true}` cho tới khi `/me` trả lời, nên trong
 * khoảng ấy `toi?.dang_nhap === true` là `false` **với cả người đã đăng nhập**. Mọi
 * component khác xử nhịp này bằng cách không vẽ gì (`Composer`, `NutTheoMach`,
 * `KhoiChuMach`, `HanhDongBinhLuan`); `CotVote` **không** có cửa đó — con số điểm là nội
 * dung của trang, không phải một tiện ích ẩn được. Nên nó phải nói ra lý do THẬT: đang
 * hỏi, chứ không phải "bạn chưa đăng nhập".
 *
 * Phải là một câu KHÁC `LY_DO_CHUA_DANG_NHAP` với cùng lý lẽ đã viết cho `LY_DO_KHOA`:
 * bảo người đang đăng nhập đi đăng nhập là chỉ sai đường.
 */
export const LY_DO_DANG_TAI = "Đang tải phiên…";

/** Mạch bị mod khoá (PLAN 5.10: "đọc được, không tương tác").
 *
 * Phải là một câu KHÁC `LY_DO_CHUA_DANG_NHAP`: dùng chung một câu nghĩa là người đang
 * đăng nhập tử tế được bảo đi đăng nhập, rồi đăng nhập lại vòng vòng.
 */
export const LY_DO_KHOA = "Mạch đã bị khoá — không tương tác được";
