import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Feed } from "@/components/feed";
import { docFeedSub, docTab } from "@/lib/api";
import { duongDanSub } from "@/lib/url";

export const dynamic = "force-dynamic";

type ThamSo = { sub: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<ThamSo>;
}): Promise<Metadata> {
  const { sub } = await params;
  return { title: `s/${sub}` };
}

export default async function TrangSub({
  params,
  searchParams,
}: {
  params: Promise<ThamSo>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sub } = await params;
  const q = await searchParams;
  const tab = docTab(q.tab);
  const cursor = Array.isArray(q.cursor) ? q.cursor[0] : q.cursor;

  // API trả 404 `sub_khong_ton_tai` cho slug lạ — `docFeedSub` quy nó về `null`, và trang
  // sub không tồn tại phải là 404 thật chứ không phải một feed rỗng trông như bình thường.
  // Hàm RIÊNG cho nhánh có sub (vá F1): đây là chỗ duy nhất `null` có nghĩa thật, nên chỉ
  // chỗ này được nhận một kiểu nullable.
  const { du_lieu: feed, cursorHong } = await docFeedSub(sub, tab, { cursor });
  if (feed === null) notFound();

  return (
    <Feed
      feed={feed}
      cursorHong={cursorHong}
      tab={tab}
      coBan={duongDanSub(sub)}
      tieuDe={`s/${sub}`}
      lede="Mọi mạch trong chuyên mục này."
    />
  );
}
