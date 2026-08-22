import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Feed } from "@/components/feed";
import { Sidebar } from "@/components/sidebar";
import { docCacSub, docFeedSub, docKhoang, docSub, docTab } from "@/lib/api";
import { dongSoMachSub } from "@/lib/dinh-dang";
import { duongDanSub } from "@/lib/url";

import css from "./sub.module.css";

export const dynamic = "force-dynamic";

type ThamSo = { sub: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<ThamSo>;
}): Promise<Metadata> {
  const { sub } = await params;
  const chi_tiet = await docSub(sub);
  if (chi_tiet === null) return { title: `s/${sub}` };
  return {
    title: `s/${chi_tiet.slug} — ${chi_tiet.ten}`,
    description: chi_tiet.mo_ta,
  };
}

/** `/s/<sub>` — plan con 1d §2.5.2.
 *
 * Trước 1d trang này chỉ là feed đã lọc: không header, không sidebar, tiêu đề đúng một
 * dòng `s/<slug>`. Nghĩa là "chuyên mục" không tồn tại như một nơi chốn — nó chỉ là một
 * tham số. Header + sidebar là thứ biến nó thành một trang có bản sắc, đúng bố cục Reddit
 * mà PLAN 9.2 mô tả cho feed.
 *
 * **KHÔNG có nút "Tham gia"** — PLAN mục 4 loại nó khỏi v1 *(chốt 2026-08-22)*, kể cả
 * dạng `disabled` làm chỗ đứng. Đây là chỗ nó sẽ nằm nếu ai đó tái phát minh.
 */
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
  const khoang = docKhoang(q.khoang);
  const cursor = Array.isArray(q.cursor) ? q.cursor[0] : q.cursor;

  // API trả 404 `sub_khong_ton_tai` cho slug lạ — `docFeedSub` quy nó về `null`, và trang
  // sub không tồn tại phải là 404 thật chứ không phải một feed rỗng trông như bình thường.
  // Hàm RIÊNG cho nhánh có sub (vá F1): đây là chỗ duy nhất `null` có nghĩa thật, nên chỉ
  // chỗ này được nhận một kiểu nullable.
  const [{ du_lieu: feed, cursorHong }, chi_tiet, cac_sub] = await Promise.all([
    docFeedSub(sub, tab, { cursor, khoang }),
    docSub(sub),
    docCacSub(),
  ]);
  // Hai lời gọi, hai nguồn 404 độc lập — hỏi CẢ HAI. Chỉ hỏi feed thì một sub bị xoá giữa
  // hai lời gọi cho ra header `null` và trang nổ ở dòng render; chỉ hỏi header thì mất
  // đường 404 mà `docFeedSub` vốn có.
  if (feed === null || chi_tiet === null) notFound();

  return (
    <Feed
      feed={feed}
      cursorHong={cursorHong}
      tab={tab}
      khoang={khoang}
      coBan={duongDanSub(sub)}
      sidebar={<Sidebar sub={chi_tiet} cacSub={cac_sub} />}
      // X9 — **không** truyền kèm `tieuDe`/`lede` nữa: có `header` thì hai prop ấy không
      // render ở đâu, và `lede={chi_tiet.mo_ta}` là bản sao thứ hai của `mo_ta` không ai
      // đọc. Nay kiểu `DauTrang` của `Feed` cấm hẳn — truyền cả hai là `tsc` đỏ.
      header={
        <header className={css.dau} data-testid="sub-header">
          <p className={`${css.slug} mono`}>s/{chi_tiet.slug}</p>
          <h1 className={css.ten}>{chi_tiet.ten}</h1>
          <p className={css.mo_ta}>{chi_tiet.mo_ta}</p>
          <p className={`${css.so} mono`} data-testid="sub-header-so">
            {dongSoMachSub(chi_tiet.so_mach, chi_tiet.created_at)}
          </p>
        </header>
      }
    />
  );
}
