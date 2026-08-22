import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { OgThe } from "@/components/og-the";
import { docMach } from "@/lib/api";
import { KHUNG_OG, KIEU_OG, docMatChu, ogMach } from "@/lib/og";
import { tachSlugId } from "@/lib/url";

/** Ảnh OG của một mạch — PLAN mục 10 Phase 6: *"OG card tự sinh mỗi mạch (title +
 * ket_qua + spine — ảnh để user khoe lên Facebook, kênh phát tán chính)"*.
 *
 * Cùng lý do `force-dynamic` với `page.tsx` cạnh nó: cơ chế ISR của PLAN 8.4 là việc của
 * Phase 3, và dòng này giữ cho `pnpm build` không cần Django sống.
 *
 * **`notFound()` chứ không vẽ một cái khung rỗng.** Ảnh OG của một mạch không tồn tại là
 * thứ sẽ nằm lại trong cache của Facebook rất lâu; trả 404 để chỗ đó trống còn hơn để
 * một tấm ảnh trắng mang thương hiệu gikky đi kèm một link chết.
 */
export const dynamic = "force-dynamic";

export const alt = "Thẻ chia sẻ của một mạch trên gikky.net";
export const size = KHUNG_OG;
export const contentType = KIEU_OG;

export default async function AnhOgMach({
  params,
}: {
  params: Promise<{ slugId: string }>;
}) {
  const { slugId } = await params;
  const tach = tachSlugId(slugId);
  if (tach === null) notFound();
  const mach = await docMach(tach.id);
  if (mach === null) notFound();

  return new ImageResponse(<OgThe du_lieu={ogMach(mach)} />, {
    ...size,
    fonts: await docMatChu(),
  });
}
