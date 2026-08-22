import { getHealth } from "@gikky/api-client";
import type { Metadata } from "next";

import { HealthSameOrigin } from "./health-same-origin";
import { moTaHealth } from "./health-text";

// DI DỜI Ở PHASE 1c: trang này từng nằm ở `/`, nay `/` là feed (PLAN 5.9). Nội dung giữ
// nguyên — nó là bằng chứng nghiệm thu của Phase 0 (server → Django, và trình duyệt →
// same-origin `/api/v1/health`), không phải rác dọn được.
//
// ĐẶC THÙ CHẨN ĐOÁN — ĐỪNG COPY DÒNG NÀY SANG TRANG SẢN PHẨM.
// Trang này là công cụ chẩn đoán: phải gọi Django ở MỖI lần tải, nên `force-dynamic`.
// Trang `/m/[slug]` của Phase 3 theo PLAN 8.4: biến thể khách (không cookie) là **ISR**
// revalidate 1 giờ + on-demand revalidate; chỉ biến thể CÓ cookie mới dynamic no-store.
// Dán `force-dynamic` vào đó là xoá sạch tầng cache của cả sản phẩm.
export const dynamic = "force-dynamic";

/** Trang chẩn đoán KHÔNG được vào chỉ mục (vá C5, 2026-08-22).
 *
 * Từ lúc `/` thành feed, trang này công khai ở `/chan-doan` mà không có `noindex` và
 * không nằm trong sitemap — tức Google có thể index một trang chẩn đoán in ra origin nội
 * bộ của API. Dòng dưới đây là lớp **duy nhất** chặn index, và cố ý là duy nhất: vá F4
 * (2026-08-22) đã bỏ `Disallow: /chan-doan` khỏi `app/robots.ts` vì bot bị chặn crawl thì
 * không đọc được chính thẻ này. Xem docstring `app/robots.ts`.
 */
export const metadata: Metadata = {
  title: "Chẩn đoán kết nối",
  robots: { index: false, follow: false },
};

// Server component gọi THẲNG Django, không vòng qua cổng 3000 của chính mình: PLAN 8.4
// điểm 3 đã có chiều Django -> localhost:3000 (on-demand revalidate); thêm chiều ngược
// Node -> Node là công thức tự đói tài nguyên khi Phase 3 bật ISR.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

async function docHealth(): Promise<string> {
  try {
    return moTaHealth(await getHealth({ baseUrl: API_ORIGIN, cache: "no-store" }));
  } catch (loi) {
    // client-fetch bình thường không ném (lỗi mạng cũng vào `error`); tới đây là chuyện
    // ngoài dự kiến — vẫn phải in ra, không được để trang trắng.
    return `LỖI ngoài dự kiến khi gọi ${API_ORIGIN}: ${loi instanceof Error ? loi.message : String(loi)}`;
  }
}

export default async function Home() {
  const health = await docHealth();
  return (
    <main>
      <h1>gikky.net — chẩn đoán kết nối</h1>
      <p>
        server component → Django <code>{API_ORIGIN}</code>:{" "}
        <strong data-testid="health">{health}</strong>
      </p>
      <p>
        trình duyệt → same-origin <code>/api/v1/health</code>: <HealthSameOrigin />
      </p>
    </main>
  );
}
