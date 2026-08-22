import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { OgThe } from "@/components/og-the";
import { docMach } from "@/lib/api";
import { KHUNG_OG, KIEU_OG, docMatChu, ogMach } from "@/lib/og";
import { tachSlugId } from "@/lib/url";

/** Ảnh OG của một mạch — PLAN mục 10 Phase 6: *"OG card tự sinh mỗi mạch (title +
 * ket_qua + spine — ảnh để user khoe lên Facebook, kênh phát tán chính)"*.
 *
 * **Vẫn `force-dynamic`, và nó KHÔNG phải sót lại từ 1c** *(soát lại 2026-08-23)*. Trang
 * mạch cạnh đây nay chạy ISR 1 giờ (`page.tsx`), nhưng ảnh OG thì khác hai chuyện: nó
 * được tải đúng một lần cho mỗi lượt chia sẻ (Facebook/Zalo tự cache rất lâu ở phía họ),
 * và một bản dựng sẵn ở đây nghĩa là `pnpm build` phải có Django sống để render ảnh. Lời
 * gọi Django bên dưới vẫn đi qua data cache của biến thể `"isr"`, nên nó không thành một
 * round-trip mới cho mỗi lượt bot ghé.
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
  const mach = await docMach(tach.id, "isr");
  if (mach === null) notFound();

  return new ImageResponse(<OgThe du_lieu={ogMach(mach)} />, {
    ...size,
    fonts: await docMatChu(),
  });
}
