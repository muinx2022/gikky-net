import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { OgThe } from "@/components/og-the";
import { docBanTin } from "@/lib/api";
import { SUB_BAN_TIN, ngayBanTinHopLe } from "@/lib/ban-tin";
import { KHUNG_OG, KIEU_OG, docMatChu, ogBanTin } from "@/lib/og";

/** Ảnh OG của một bản tin `/s/tin-tuc/<ngày>` (việc 20, vòng sửa 1). Trước việc 20 mỗi bản tin
 * là một mạch và có ảnh OG của mạch; trang mới khai `openGraph` riêng nên ảnh của segment cha
 * (`app/s/[sub]/opengraph-image.tsx`) KHÔNG đi xuống — thiếu file này là thẻ chia sẻ trống.
 *
 * Cùng cổng 404 với `page.tsx` cạnh nó: sub khác bản tin, ngày sai dạng, bản tin không có / đã ẩn
 * ⇒ 404, không vẽ khung rỗng (lý lẽ ở `app/m/[slugId]/opengraph-image.tsx`). Nội dung chữ ở
 * `lib/og.ts::ogBanTin`. */
export const dynamic = "force-dynamic";

export const alt = "Thẻ chia sẻ của một bản tin thị trường trên gikky.net";
export const size = KHUNG_OG;
export const contentType = KIEU_OG;

export default async function AnhOgBanTin({
  params,
}: {
  params: Promise<{ sub: string; ngay: string }>;
}) {
  const { sub, ngay } = await params;
  if (sub !== SUB_BAN_TIN || !ngayBanTinHopLe(ngay)) notFound();
  const ban_tin = await docBanTin(ngay);
  if (ban_tin === null) notFound();

  return new ImageResponse(<OgThe du_lieu={ogBanTin(ban_tin)} />, {
    ...size,
    fonts: await docMatChu(),
  });
}
