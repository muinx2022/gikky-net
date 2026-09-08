import type { Metadata } from "next";

import { Feed } from "@/components/feed";
import { JsonLd } from "@/components/json-ld";
import { Sidebar } from "@/components/sidebar";
import {
  docCacSub,
  docFeed,
  docKhoang,
  docTab,
  type KhoangFeed,
  type TabFeed,
} from "@/lib/api";
import { jsonLdWebSite } from "@/lib/json-ld";
import { GIOI_THIEU, urlTuyetDoi } from "@/lib/site";

// Xem ghi chú ở `app/m/[slugId]/page.tsx`: cơ chế cache của PLAN 8.4 là việc của Phase 3.
// Dòng này cũng giữ cho `pnpm build` không cần Django sống.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: {
    canonical: urlTuyetDoi("/"),
  },
};

// ⚠⚠ **KHÔNG có bộ xương (skeleton) lúc tải, và đây là lý do — đo được, không phải cảm
// tính.** Plan giao diện §2.5 đòi *"skeleton thay cho khoảng trắng"*; lượt 2026-08-23 thử
// hai lối và **bỏ cả hai**. Ghi lại đây vì đây là chỗ người tiếp theo sẽ mở ra để làm nó.
//
// **Lối 1 — `app/loading.tsx`.** Nó bọc CẢ NHÁNH ROUTE bên dưới trong một Suspense
// boundary, và route có Suspense thì Next **stream**: `200 OK` đi ngay cùng phần khung,
// nội dung thật đẩy xuống sau. Sau khi header đã gửi, `notFound()` và
// `permanentRedirect()` **không đổi được status nữa** — chúng im lặng thành 200.
// `app/loading.tsx` nằm ở gốc nên phủ mọi route: `/m/<slug sai>-<id>` thôi redirect 301,
// `/m/…-999999999` trả 200 thay vì 404, `/s/<sub không có>` cũng thế.
// **Đo được: 48 bài đo đỏ cùng lúc.**
//
// **Lối 2 — `<Suspense>` chỉ quanh feed của riêng trang này** (`/` là trang duy nhất
// không gọi `notFound()`/`redirect()` bao giờ, nên lối này tránh được vấn đề trên). Nó
// vẫn hỏng, theo một đường khác: SSR streaming để lại **bản sao ẨN** của nội dung boundary
// trong DOM (`<div hidden>`: 1 → 4 trên trang này), nên mỗi `data-testid` bên trong khớp
// **hai** phần tử. Tám bài đo dùng locator strict đỏ theo, và cái hại thật thì không nằm ở
// bài đo: nó là một bản sao DOM mà không ai dọn.
//
// ⇒ Trang chủ chờ xong hai lời gọi rồi mới trả. Nó là `force-dynamic` và hai lời gọi ấy đi
// thẳng Django trong cùng mạng, nên khoảng trắng ngắn. **Muốn làm lại: phải dời
// `app/page.tsx` vào một route group** (`app/(feed)/page.tsx` + `loading.tsx` cùng chỗ) để
// boundary không phủ route khác, **và** đo lại số `<div hidden>` sau khi làm.

// `GIOI_THIEU` dời sang `lib/site.ts` 2026-08-31 (docstring đầy đủ ở đó): khung tĩnh của
// `/luat` cũng cần nó, mà import từ file route này là kéo cả `docFeed`/`docCacSub` vào
// cây module của đường thoát.

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const tab = docTab(q.tab);
  const khoang = docKhoang(q.khoang);
  const cursor = Array.isArray(q.cursor) ? q.cursor[0] : q.cursor;
  const truongPhai = typeof q.truong_phai === "string" ? q.truong_phai : undefined;

  return (
    <FeedDaNap tab={tab} khoang={khoang} cursor={cursor} truongPhai={truongPhai} />
  );
}

async function FeedDaNap({
  tab,
  khoang,
  cursor,
  truongPhai,
}: {
  tab: TabFeed;
  khoang: KhoangFeed;
  cursor: string | undefined;
  truongPhai: string | undefined;
}) {
  // `?cursor=rac` KHÔNG được làm trang chủ 500: `docFeed` lùi về trang đầu và trả cờ để
  // `Feed` hiện dòng giải thích (vá A1).
  //
  // Còn API hỏng thì trang này PHẢI hỏng theo: `docFeed` (bản không lọc sub) ném thay vì
  // trả `null`, nên ở đây không còn gì để `?? { items: [] }` — xem docstring của nó, vá
  // F1. "Chưa có bài nào ở đây" chỉ được nói khi Django thật sự trả về 0 mạch.
  const [{ du_lieu: feed, cursorHong }, cac_sub] = await Promise.all([
    docFeed(tab, { cursor, khoang, truong_phai: truongPhai }),
    docCacSub(),
  ]);

  return (
    <>
      <JsonLd duLieu={jsonLdWebSite()} />
      <Feed
        feed={feed}
        cursorHong={cursorHong}
        tab={tab}
        khoang={khoang}
        coBan="/"
        truongPhai={truongPhai}
        // `<h1>` KHÔNG còn là chữ "gikky": tên hiệu đã nằm ở thanh trên cùng của mọi trang,
        // nên in lại nó ở đây vừa thừa vừa lấy mất dòng chữ có giá trị nhất của trang chủ
        // đối với người mới và với máy tìm kiếm. Nay nó nói **sản phẩm là gì** trong một
        // câu; lede nói **trang này liệt kê gì**. Phần "site vận hành ra sao" thuộc về
        // `GIOI_THIEU` ở sidebar — xem docstring của hằng ấy.
        tieuDe="Nhật ký giao dịch & Luận điểm thị trường"
        lede="Ghi nhận nhận định trước khi có kết quả. Mọi mốc đều lưu vết thời gian thực và lịch sử minh bạch."
        sidebar={<Sidebar gioiThieu={GIOI_THIEU} cacSub={cac_sub} />}
      />
    </>
  );
}
