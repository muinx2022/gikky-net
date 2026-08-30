"use client";

import { Search, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";

import { OTimKiem } from "./o-tim-kiem";
import css from "./tim-kiem-mobile.module.css";

/** Lối vào tìm kiếm ở khổ màn hình hẹp — icon kính lúp **xổ form ngay tại chỗ**.
 *
 * ## Vì sao nó thay một `<Link href="/tim-kiem">`
 *
 * Bản 2026-08-30 (sáng) là một link: bấm là rời trang, tải trang kết quả, rồi mới gõ.
 * User yêu cầu thẳng — *"bấm icon kính lúp thì form xổ ngay tại chỗ"*. Xổ tại chỗ giữ
 * người ta ở lại trang đang đọc cho tới khi họ thật sự chọn đi đâu, và nó là chỗ duy
 * nhất gợi ý-khi-gõ có nghĩa trên di động.
 *
 * `<OTimKiem/>` bên trong là **cùng một component** với ô ở header rộng — không phải một
 * bản sao. Hai ô tìm kiếm là hai chỗ để logic debounce/huỷ/bàn phím trôi khỏi nhau, và
 * cái trôi ấy không kêu ở đâu cả.
 *
 * ## Đánh đổi đã biết: noscript mất lối vào trên di động
 *
 * Nút này là `<button>` + state React, nên **không có JS thì panel không mở được**. Form
 * bên trong vẫn là một `<form method="get" action="/tim-kiem">` thật (fallback noscript
 * của `OTimKiem`), nhưng fallback ấy chỉ cứu được người đã mở được panel — mà mở panel
 * lại cần JS. Chấp nhận: cả `apps/web` đã cần JS cho chuông, vote, bình luận; và bản
 * `<Link>` cũ chỉ dẫn tới một trang mà ở đó vẫn phải gõ. Ai vào bằng URL tay thì
 * `/tim-kiem` vẫn còn nguyên và vẫn có ô nhập riêng.
 *
 * ## Ràng buộc kiến trúc phải giữ
 *
 * `chrome.tsx` **không được** thành client component: nó nằm trong layout gốc, nên một
 * `"use client"` ở đó làm `/luat` hết tĩnh — mà `/luat` là đường thoát của `error.tsx`
 * (nợ #14 của 1c). Vì thế state sống ở đây, trong một component riêng; `chrome.tsx` chỉ
 * nhúng nó như nhúng `<Chuong/>`.
 *
 * `<Suspense>` bọc `OTimKiem` vì nó đọc `useSearchParams`. Bọc **ở đây** chứ không phó
 * mặc cho `chrome.tsx`: panel chỉ render khi mở, nên biên Suspense của header không phủ
 * được nó ở lần render đầu tiên sau khi bấm.
 */
export function TimKiemMobile() {
  const [mo, datMo] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  // Mở ra là con trỏ nhảy thẳng vào ô nhập: người ta bấm kính lúp để GÕ, không phải để
  // ngắm một ô trống rồi bấm thêm một lần nữa.
  useEffect(() => {
    if (!mo) return;
    panel.current?.querySelector("input")?.focus();
  }, [mo]);

  return (
    <>
      <button
        type="button"
        className={css.nut}
        aria-expanded={mo}
        aria-label={mo ? "Đóng ô tìm" : "Tìm mạch"}
        title="Tìm mạch"
        onClick={() => datMo((x) => !x)}
        data-testid="nut-tim-kiem"
      >
        {mo ? (
          <X size={16} strokeWidth={1.9} aria-hidden />
        ) : (
          <Search size={16} strokeWidth={1.9} aria-hidden />
        )}
      </button>

      {mo && (
        <div
          className={css.panel}
          ref={panel}
          data-testid="panel-tim-kiem"
          // Esc đóng panel. `OTimKiem` **chặn** phím này khi dropdown gợi ý đang mở (xem
          // `phim` ở đó), nên Esc thứ nhất đóng gợi ý và Esc thứ hai đóng panel — thứ tự
          // người dùng chờ đợi, không phải một cú đóng nuốt cả hai.
          onKeyDown={(e) => {
            if (e.key === "Escape") datMo(false);
          }}
        >
          <Suspense fallback={<div className={css.cho} />}>
            <OTimKiem trongPanel onDi={() => datMo(false)} />
          </Suspense>
        </div>
      )}
    </>
  );
}
