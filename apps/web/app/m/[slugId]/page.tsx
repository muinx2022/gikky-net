import type { Metadata } from "next";

import { TrangMach, metadataMach } from "@/components/trang-mach";

/** Trang mạch, **biến thể KHÁCH** — PLAN 8.4 điểm 1 và 2.
 *
 * Đây là URL công khai (`/m/<slug>-<id>`): sitemap trỏ vào đây, `canonical` trỏ vào đây,
 * bot đọc cái này. Nó **cache được**, và cả cơ chế 8.4 dựng lên để chuyện đó an toàn:
 *
 * - `GET /machs/{id}` cố ý không chứa trường nào phụ thuộc người xem (hàng rào ở
 *   `api/tests/test_api_mach.py::MANH_PER_USER`);
 * - mọi thứ per-user đến sau, ở client, qua `components/trang-thai-toi.tsx`.
 *
 * ## `revalidate = 3600` là gì và KHÔNG là gì
 *
 * Nó đặt tuổi cache cho **route** này. Trang có đọc `searchParams` (khán đài, sort,
 * cursor) nên Next vẫn render động theo từng request — thứ thật sự tiết kiệm là **data
 * cache của `fetch`**: `lib/api.ts` gắn `next: { revalidate }` vào từng lời gọi Django,
 * nên lượt tải thứ hai trong vòng một giờ không chạm Django lần nào. Đó là cái trả ba nợ
 * `ISR-BIEN-THE-ROUTE` · `N+1-NGAN-KEO` · `DANG-DOC-ROUND-TRIP`.
 *
 * Một giờ bắt hai sự kiện KHÔNG có signal (cú lật BÃO→CẶN do 72h trôi, bình luận mới trên
 * trang nguội). Sự kiện CÓ signal đi đường on-demand: `core/revalidate.py` gọi
 * `app/lam-moi-cache/route.ts` → `revalidatePath("/m/<slug>-<id>")`.
 *
 * ⚠ **`3600` viết bằng số, cố ý.** `export const revalidate` phải là literal Next phân
 * tích tĩnh được — một hằng import vào đây sẽ không được nhận. Bản gốc của con số là
 * `lib/api.ts::TUOI_CACHE_MACH`, và `e2e/don-vi/cache-mach.spec.ts` đọc cả hai file rồi đỏ
 * nếu chúng lệch.
 */
export const revalidate = 3600;

type ThamSo = { slugId: string };
type Query = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<ThamSo>;
}): Promise<Metadata> {
  return metadataMach((await params).slugId, "isr");
}

export default async function TrangMachKhach({
  params,
  searchParams,
}: {
  params: Promise<ThamSo>;
  searchParams: Promise<Query>;
}) {
  const { slugId } = await params;
  return <TrangMach slugId={slugId} q={await searchParams} doc="isr" />;
}
