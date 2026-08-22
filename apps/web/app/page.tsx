import { Feed } from "@/components/feed";
import { Sidebar } from "@/components/sidebar";
import { docCacSub, docFeed, docKhoang, docTab } from "@/lib/api";

// Xem ghi chú ở `app/m/[slugId]/page.tsx`: cơ chế cache của PLAN 8.4 là việc của Phase 3.
// Dòng này cũng giữ cho `pnpm build` không cần Django sống.
export const dynamic = "force-dynamic";

const GIOI_THIEU =
  "Bài viết ở đây không phải khối văn bản chết. Tác giả nối thêm mốc theo thời gian " +
  "thực, và dấu thời gian máy chủ là bất biến — ai cũng kiểm được ai đã ghi gì trước " +
  "khi biết kết quả.";

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const tab = docTab(q.tab);
  const khoang = docKhoang(q.khoang);
  const cursor = Array.isArray(q.cursor) ? q.cursor[0] : q.cursor;
  // `?cursor=rac` KHÔNG được làm trang chủ 500: `docFeed` lùi về trang đầu và trả cờ để
  // `Feed` hiện dòng giải thích (vá A1).
  //
  // Còn API hỏng thì trang này PHẢI hỏng theo: `docFeed` (bản không lọc sub) ném thay vì
  // trả `null`, nên ở đây không còn gì để `?? { items: [] }` — xem docstring của nó, vá
  // F1. "Chưa có bài nào ở đây" chỉ được nói khi Django thật sự trả về 0 mạch.
  const [{ du_lieu: feed, cursorHong }, cac_sub] = await Promise.all([
    docFeed(tab, { cursor, khoang }),
    docCacSub(),
  ]);

  return (
    <Feed
      feed={feed}
      cursorHong={cursorHong}
      tab={tab}
      khoang={khoang}
      coBan="/"
      tieuDe="gikky"
      lede="Bài viết ở đây không phải khối văn bản chết. Tác giả nối thêm mốc theo thời gian thực, dấu thời gian máy chủ bất biến."
      sidebar={<Sidebar gioiThieu={GIOI_THIEU} cacSub={cac_sub} />}
    />
  );
}
