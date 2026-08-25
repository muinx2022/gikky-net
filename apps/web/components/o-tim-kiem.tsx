"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import css from "./o-tim-kiem.module.css";

/** Ô tìm kiếm trên thanh trên cùng — Phase 7 (PLAN 8.7, mục 9).
 *
 * **Chỗ này từng bị cấm.** `plans/2026-08-23-giao-dien-reddit-va-theme.md` §0 cấm ô search
 * vì PLAN mục 4 xếp full-text vào danh sách đã bác; user lật quyết định 2026-08-23 nên
 * lệnh cấm ấy hết hiệu lực, và chỗ trống mà lượt giao diện chừa lại nay được lấp.
 *
 * **Là `<form>` thật với `action`/`method`, không phải `onSubmit` + `router.push` trần.**
 * Một form thật gửi được bằng Enter, bằng nút "Tìm" của bàn phím ảo trên di động, và bằng
 * `submit` của trình duyệt khi JS chưa kịp hydrate — cả ba đều là đường vào có thật. Ta
 * vẫn chặn `submit` để điều hướng bằng router (giữ SPA, không tải lại cả trang), nhưng
 * nếu JS hỏng thì `action="/tim-kiem"` với `method="get"` vẫn đưa người ta tới đúng nơi.
 *
 * `defaultValue` **không** dùng được ở đây: người dùng bấm từ `/tim-kiem?q=A` sang một kết
 * quả rồi bấm back, ô phải mang lại chữ `A`. `defaultValue` chỉ đọc một lần lúc mount, mà
 * Next tái dùng component qua các lần điều hướng — nên phải đồng bộ bằng `useEffect`.
 */
export function OTimKiem() {
  const router = useRouter();
  const tham_so = useSearchParams();
  const q_tren_url = tham_so.get("q") ?? "";
  const [cau, datCau] = useState(q_tren_url);

  useEffect(() => {
    datCau(q_tren_url);
  }, [q_tren_url]);

  return (
    <form
      className={css.o}
      action="/tim-kiem"
      method="get"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const sach = cau.trim();
        if (!sach) return;
        router.push(`/tim-kiem?q=${encodeURIComponent(sach)}`);
      }}
    >
      {/* `⌕` (U+2315) trước đây: nửa số font Windows không có glyph này nên nó ra ô
          vuông rỗng. Icon vẽ bằng SVG thì mọi máy thấy như nhau. */}
      <Search className={css.kinh} size={15} strokeWidth={2} aria-hidden />
      <input
        type="search"
        name="q"
        value={cau}
        onChange={(e) => datCau(e.target.value)}
        placeholder="Tìm mạch…"
        aria-label="Tìm mạch"
        className={css.nhap}
        data-testid="o-tim-kiem"
      />
    </form>
  );
}
