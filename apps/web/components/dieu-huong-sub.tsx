"use client";

import type { SubChiTietOut } from "@gikky/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

import { docCacSubOTrinhDuyet } from "@/lib/api";
import { duongDanSub } from "@/lib/url";

/** Danh sách chuyên mục trên thanh nav — hỏi `GET /subs` **ở trình duyệt**.
 *
 * Trả nợ `NAV-GHI-CUNG`: trước 2026-08-23, `components/chrome.tsx` gõ cứng hai slug
 * `chung-khoan` / `crypto`, nên mở sub thứ ba qua admin là nó vắng mặt trên nav của MỌI
 * trang — im lặng, 200 ở mọi cửa. Giấy miễn trừ tương ứng ở
 * `e2e/don-vi/khong-ghi-cung-sub.spec.ts::CHUA_CHUYEN_DUOC` đã được xoá cùng lượt.
 *
 * **Vì sao ở client** (và vì sao đó là điều kiện chứ không phải sở thích): nav nằm trong
 * layout gốc ⇒ nó render trên `/luat`, mà `/luat` phải là route TĨNH — nó là đường thoát
 * của `error.tsx`/`global-error.tsx`. Một lời gọi API phía server ở đây làm `/luat` thành
 * dynamic, tức đường thoát hỏng cùng lúc với thứ nó thoát khỏi; nó cũng bắt `pnpm build`
 * phải có Django sống. Hỏi ở trình duyệt giữ được cả hai, đúng lối `PhienProvider` đã đi.
 *
 * **Cái giá:** link sub không nằm trong HTML lần đầu. Chấp nhận được — cùng những link ấy
 * có trong `sidebar` (server-render ở `/` và `/s/*`) và trong `sitemap.xml`, nên không
 * chuyên mục nào biến mất khỏi tầm mắt Google. Xem `lib/api.ts::docCacSubOTrinhDuyet`.
 *
 * Trong lúc chưa có dữ liệu thì **không vẽ gì** thay vì vẽ khung xám: nav là hàng chữ đầu
 * tiên mắt người ta chạm tới, và một chỗ trống ngắn đỡ chói hơn ba ô nhấp nháy.
 */
export function DieuHuongSub() {
  const [cacSub, datCacSub] = useState<readonly SubChiTietOut[]>([]);

  useEffect(() => {
    let con_song = true;
    void (async () => {
      // Hỏng mạng ⇒ danh sách rỗng ⇒ nav chỉ còn "Luật". Thanh điều hướng không phải chỗ
      // báo sự cố hạ tầng (cùng lý lẽ `PhienProvider`).
      const ds = await docCacSubOTrinhDuyet();
      if (con_song) datCacSub(ds);
    })();
    return () => {
      con_song = false;
    };
  }, []);

  return (
    <>
      {cacSub.map((s) => (
        <Link key={s.slug} href={duongDanSub(s.slug)}>
          {s.ten}
        </Link>
      ))}
    </>
  );
}
