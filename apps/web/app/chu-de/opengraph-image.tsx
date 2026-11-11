/** Ảnh OG của `/chu-de` = ảnh OG mặc định của trang chủ (`app/opengraph-image.tsx`).
 *
 * **Vì sao phải có file này:** `/` có `og:image` / `twitter:image` còn `/chu-de` thì không, dù
 * cả hai cùng khai `metadata.openGraph`. Lý do là cách Next 15 ghép metadata: ảnh từ file
 * `opengraph-image` được gắn vào *segment* chứa file; `app/page.tsx` nằm cùng segment gốc nên
 * nhận ảnh, còn `/chu-de` là segment con khai `openGraph` riêng — khối `openGraph` của trang
 * THAY cả khối của layout (kể cả ảnh layout kế thừa), không gộp. `/luat` có ảnh vì nó không
 * khai `openGraph` nên kế thừa nguyên.
 *
 * Không thể bỏ `openGraph` của `/chu-de` cho kế thừa: nó mang `og:url` riêng và `og:title` riêng
 * (bài đo K4). Đặt một file `opengraph-image` NGAY trong segment này là cách Next chuẩn để
 * segment có ảnh của riêng nó; ở đây dùng lại đúng ảnh của trang chủ (không gọi API, nên vẫn
 * là tệp tĩnh tiền dựng). */
export { default, alt, size, contentType } from "../opengraph-image";
