import type { Metadata } from "next";

import { TrangMach, metadataMach } from "@/components/trang-mach";

/** Trang mạch, **biến thể CÓ COOKIE PHIÊN** — PLAN 8.4 điểm 1.
 *
 * ## Không ai gõ URL này
 *
 * `/m-phien/<slug>-<id>` là **đích của một rewrite nội bộ**. `middleware.ts` thấy cookie
 * phiên trên một request tới `/m/<slug>-<id>` thì rewrite sang đây; thanh địa chỉ vẫn là
 * `/m/…`, `canonical` vẫn là `/m/…`, và `app/robots.ts` cấm bot đi vào tiền tố này.
 *
 * ⚠ **File này và `app/m/[slugId]/page.tsx` phải sống hoặc chết CÙNG NHAU** — xoá nó mà
 * để `middleware.ts` ở lại là trang mạch 404 với đúng những người đã đăng nhập, và không
 * ai trong nhóm test ẩn danh thấy được điều đó.
 *
 * ## Vì sao nó phải dynamic
 *
 * Không phải vì nội dung khác: thân bài dùng chung `components/trang-mach.tsx`, và cả hai
 * biến thể đều gọi Django **không kèm cookie**. Khác nhau đúng một thứ — **độ tươi**.
 * Người vừa nối một mốc, vừa gửi một bình luận, vừa trích một câu vào sổ phải thấy việc
 * mình vừa làm ngay lập tức; một bản cache một giờ ở đây biến `router.refresh()` sau mỗi
 * lượt ghi thành một cú tải lại chính bản cũ, và không có gì trên màn hình nói ra điều đó.
 *
 * Cache thì được lo bằng revalidate on-demand (Django → `app/lam-moi-cache`), nhưng nó
 * chạy **sau commit và không đồng bộ**: đủ nhanh cho người thứ hai, không đủ nhanh cho
 * chính người vừa bấm nút.
 */
export const dynamic = "force-dynamic";

type ThamSo = { slugId: string };
type Query = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<ThamSo>;
}): Promise<Metadata> {
  return metadataMach((await params).slugId, "tuoi-song");
}

export default async function TrangMachCoPhien({
  params,
  searchParams,
}: {
  params: Promise<ThamSo>;
  searchParams: Promise<Query>;
}) {
  const { slugId } = await params;
  return <TrangMach slugId={slugId} q={await searchParams} doc="tuoi-song" />;
}
