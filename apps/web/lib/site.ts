/** Origin công khai của site — cho `canonical`, JSON-LD và `sitemap.xml`.
 *
 * Ba chỗ đó phải nói **URL tuyệt đối**: `canonical` tương đối thì Google tự ghép theo
 * host nó đang crawl (kể cả host staging), còn `sitemap.xml` bắt buộc `<loc>` tuyệt đối
 * theo chuẩn sitemaps.org.
 *
 * Mặc định `http://localhost:3000` để dev và Playwright chạy được không cần cấu hình;
 * prod đặt `SITE_ORIGIN=https://gikky.net`.
 */
export const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:3000";

export function urlTuyetDoi(duongDan: string): string {
  return new URL(duongDan, SITE_ORIGIN).toString();
}
