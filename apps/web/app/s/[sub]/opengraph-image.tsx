import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { OgThe } from "@/components/og-the";
import { docSub } from "@/lib/api";
import { KHUNG_OG, KIEU_OG, docMatChu, ogSub } from "@/lib/og";

/** Ảnh OG của một chuyên mục. Cùng khuôn với ảnh mạch, chỉ khác nội dung ba dòng chữ —
 * xem `lib/og.ts::ogSub`.
 *
 * Sub không tồn tại ⇒ 404, giống hệt `page.tsx` cạnh nó: một chuyên mục 404 mà ảnh OG
 * vẫn 200 là hai cửa nói hai chuyện khác nhau về cùng một URL.
 */
export const dynamic = "force-dynamic";

export const alt = "Thẻ chia sẻ của một chuyên mục trên gikky.net";
export const size = KHUNG_OG;
export const contentType = KIEU_OG;

export default async function AnhOgSub({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;
  const chi_tiet = await docSub(sub);
  if (chi_tiet === null) notFound();

  return new ImageResponse(<OgThe du_lieu={ogSub(chi_tiet)} />, {
    ...size,
    fonts: await docMatChu(),
  });
}
