/** PostCSS chỉ cho `apps/admin` — Tailwind v4.
 *
 * ⚠ **File này PHẢI ở trong `apps/admin/`, không được đặt ở gốc repo.** Next đi ngược
 * cây thư mục để tìm config PostCSS; một `postcss.config.mjs` ở gốc sẽ chui vào **cả
 * `apps/web`** và đổi pipeline CSS của một app mà lượt này không được chạm. Hỏng kiểu đó
 * không đỏ ngay — nó ra một `next build` vẫn xanh với CSS khác đi.
 *
 * `apps/web` cố ý KHÔNG dùng Tailwind: hàng rào màu của PLAN 9.1
 * (`apps/web/e2e/don-vi/mau-token.spec.ts`) ghim allowlist tới từng **selector CSS**, mà
 * Tailwind xoá selector và thay bằng chuỗi class trong TSX. Chuyển `apps/web` sang
 * Tailwind là phải viết lại hàng rào ấy trước — một lượt riêng, không phải phần thưởng
 * kèm theo.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
