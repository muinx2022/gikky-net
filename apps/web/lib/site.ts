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

/** Khối "gikky.net" ở sidebar — **giải thích CƠ CHẾ**, không phải khẩu hiệu.
 *
 * Sống ở `lib/` từ 2026-08-31 vì có HAI chỗ dùng: trang chủ (`app/page.tsx`) và khung
 * tĩnh của `/luat` (`components/khung-hai-cot-tinh.tsx`). Đặt ở một trong hai là chỗ kia
 * phải import chéo — mà khung tĩnh import `app/page.tsx` là kéo cả `docFeed`/`docCacSub`
 * vào cây module của đường thoát.
 *
 * ## Chia việc với `<h1>` + lede của feed, và đó là cả điểm của lượt viết lại 2026-08-24
 *
 * Trước 2026-08-24 hai chỗ này in **gần như cùng một câu** cạnh nhau trên cùng một màn
 * hình — `<h1>` là chữ "gikky" cộng nguyên đoạn giới thiệu, rồi sidebar lặp lại đoạn ấy.
 * Nay:
 * - `<h1>` + lede nói **trang này bày ra cái gì** (một feed, gồm những gì);
 * - khối này nói **site vận hành thế nào**.
 * Thêm chữ vào một trong hai thì kiểm lại chỗ kia có nói mất phần ấy chưa.
 *
 * ## Câu chữ phải ĐÚNG với code, không được nói quá
 *
 * Bản cũ viết "dấu thời gian máy chủ là bất biến" và dừng ở đó — người đọc dễ suy ra cả
 * BÀI là bất biến, trong khi `sua_moc` có thật và mốc sửa được. Sự thật đầy đủ: **dấu
 * thời gian** không đổi, **thân mốc** sửa được nhưng bản cũ ở lại và ai cũng xem được
 * (`MocRevision`, nhãn "đã sửa N lần" ở `components/ban-cu-moc.tsx`). Nói đủ hai vế thì
 * câu vừa đúng vừa mạnh hơn.
 */
export const GIOI_THIEU =
  "Mỗi bài là một mạch: tác giả nối thêm mốc theo thời gian, mỗi mốc mang dấu thời " +
  "gian máy chủ. Sửa mốc được, nhưng bản cũ vẫn công khai — đọc xong là biết ai đã ghi " +
  "gì, vào lúc nào.";
