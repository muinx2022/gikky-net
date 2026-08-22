import { getHealth } from "@gikky/api-client";

import { HealthSameOrigin } from "./health-same-origin";
import { moTaHealth } from "./health-text";

// DI DỜI Ở PHASE 4: trang này từng nằm ở `/` của app admin, nay `/` là hàng đợi báo cáo
// (PLAN 9.3 mục 1). Nội dung giữ NGUYÊN — nó là bằng chứng nghiệm thu của Phase 0
// (server → Django, và trình duyệt → same-origin `/api/v1/health`), không phải rác dọn
// được. `apps/web` đã đi đúng đường này ở Phase 1c.
//
// Không cần `noindex` riêng như bên `apps/web`: `app/layout.tsx` của khu quản trị đặt
// `robots: { index: false }` cho TOÀN BỘ app.
//
// ĐẶC THÙ PHASE 0 — ĐỪNG COPY DÒNG NÀY SANG TRANG SẢN PHẨM.
// Xem chú thích đầy đủ ở `apps/web/app/chan-doan/page.tsx` (Phase 1c dời trang chẩn đoán khỏi
// `/` để nhường chỗ cho feed): PLAN 8.4 quy định biến thể khách của
// `/m/[slug]` là ISR, chỉ biến thể có cookie mới dynamic no-store.
export const dynamic = "force-dynamic";

// Gọi THẲNG Django, không vòng qua cổng 3001 của chính mình (xem `apps/web`).
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

async function docHealth(): Promise<string> {
  try {
    return moTaHealth(await getHealth({ baseUrl: API_ORIGIN, cache: "no-store" }));
  } catch (loi) {
    return `LỖI ngoài dự kiến khi gọi ${API_ORIGIN}: ${loi instanceof Error ? loi.message : String(loi)}`;
  }
}

export default async function Home() {
  const health = await docHealth();
  return (
    <main>
      <h1>gikky.net — admin</h1>
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
