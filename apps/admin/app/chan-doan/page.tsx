import { getHealth } from "@gikky/api-client";

import { HealthSameOrigin } from "./health-same-origin";
import { moTaHealth } from "./health-text";
import { KhoiTimKiem } from "./khoi-tim-kiem";

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

// Trang duy nhất của khu quản trị còn là server component, nên nó đặt tiêu đề tab bằng
// `metadata` — mọi trang client khác đi qua `useTieuDeTrang` (xem `lib/tieu-de.ts`).
// Hậu tố phải khớp `HAU_TO` bên đó, kẻo tab này lạc giọng với phần còn lại.
export const metadata = { title: "Chẩn đoán — gikky quản trị" };

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
  // KHÔNG bọc `<main>`: khung quản trị (`components/khung/khung.tsx`) đã có một cái, và
  // hai `<main>` lồng nhau là HTML không hợp lệ — trình đọc màn hình mất mốc "nội dung
  // chính".
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Chẩn đoán</h1>
      <p className="mb-5 text-sm text-muc-mo">
        Hai đường tới Django phải cùng xanh: server component gọi thẳng, và trình duyệt gọi
        same-origin qua rewrite.
      </p>
      <div className="the space-y-3 p-4 text-sm">
        <p>
          server component → Django <code className="mono">{API_ORIGIN}</code>:{" "}
          <strong className="mono" data-testid="health">
            {health}
          </strong>
        </p>
        <p>
          trình duyệt → same-origin <code className="mono">/api/v1/health</code>:{" "}
          <HealthSameOrigin />
        </p>
      </div>

      {/* Khối "Tìm kiếm" — 2026-08-30, trả `P-20260827-2`. Đặt ở trang CHẨN ĐOÁN chứ
          không ở bảng điều khiển: đây là số liệu để soi khi nghi ngờ, không phải số liệu
          để nhìn hằng ngày, và bảng điều khiển đầy thêm một hàng là bảng điều khiển bớt
          đọc được đi một chút. */}
      <h2 className="mt-6 mb-1 text-lg font-semibold">Tìm kiếm</h2>
      <p className="mb-3 text-sm text-muc-mo">
        Chỉ mục Meilisearch phải khớp số hàng công khai trong Postgres. Lệch vài đơn vị
        ngay sau khi có bài mới là bình thường (index chạy bất đồng bộ); lệch dai dẳng
        nghĩa là cron đối soát đang chết — xem <code className="mono">deploy/prod/README.md</code>.
      </p>
      <div className="the p-4">
        <KhoiTimKiem />
      </div>
    </>
  );
}
