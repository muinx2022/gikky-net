import type { Metadata } from "next";

import { KhoChuDe, SO_CHU_DE_MOI_TRANG } from "@/components/kho-chu-de";
import { VoKhungHaiCot } from "@/components/khung-hai-cot-vo";
import { NutVeDauTrang } from "@/components/nut-ve-dau-trang";
import { Sidebar } from "@/components/sidebar";
import { docCacSub, docFeed } from "@/lib/api";
import { GIOI_THIEU, urlTuyetDoi } from "@/lib/site";

// Xem ghi chú ở `app/m/[slugId]/page.tsx` và docstring dài ở `app/page.tsx`: không có
// `loading.tsx` / `<Suspense>` dưới route này — chúng làm `notFound()`/redirect im lặng thành
// 200. Hai lời gọi API chạy song song bằng `Promise.all`.
export const dynamic = "force-dynamic";

const TIEU_DE = "Chủ đề thảo luận — gikky.net";
const MO_TA =
  "Các chủ đề thảo luận của cộng đồng gikky.net, nhóm theo tuần: chủ đề đang mở và kho chủ đề đã đóng, kèm dòng tổng kết.";

// **Metadata RIÊNG, và canonical riêng là điểm chính** *(plan homepage-v2 §3.8)*: `app/page.tsx`
// khai canonical `/` cho MỌI biến thể `?…`, nên `/?loai_mach=thao_luan` không bao giờ thành một
// trang index được. Kho chủ đề cần một URL sạch của riêng nó, và OG đầy đủ vì Next KHÔNG gộp sâu
// `openGraph` của trang với layout (trang khai thì thay cả khối).
//
// `title.absolute` để tránh template `%s · gikky.net` của layout làm đôi chữ "gikky.net".
export const metadata: Metadata = {
  title: { absolute: TIEU_DE },
  description: MO_TA,
  alternates: {
    canonical: urlTuyetDoi("/chu-de"),
  },
  openGraph: {
    title: TIEU_DE,
    description: MO_TA,
    url: urlTuyetDoi("/chu-de"),
    siteName: "gikky.net",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TIEU_DE,
    description: MO_TA,
  },
};

export default async function TrangChuDe({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const cursor = Array.isArray(q.cursor) ? q.cursor[0] : q.cursor;
  // `?cursor=rac` ⇒ `docFeed` lùi về trang đầu và trả `cursorHong` (không 500) — cùng đường
  // với `/?cursor=rac`. API hỏng thì `docFeed` ném, nên "Chưa có chủ đề nào." chỉ được nói khi
  // Django thật sự trả 0.
  const [{ du_lieu: feed, cursorHong }, cac_sub] = await Promise.all([
    docFeed("moi", { limit: SO_CHU_DE_MOI_TRANG, loai_mach: "thao_luan", cursor }),
    docCacSub(),
  ]);

  return (
    <>
      <VoKhungHaiCot sidebar={<Sidebar gioiThieu={GIOI_THIEU} cacSub={cac_sub} />}>
        <KhoChuDe feed={feed} cursorHong={cursorHong} cocCursor={cursor !== undefined && cursor !== ""} />
      </VoKhungHaiCot>
      <NutVeDauTrang />
    </>
  );
}
