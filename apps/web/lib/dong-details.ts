"use client";

import { useEffect, type RefObject } from "react";

/** Đóng `<details>` khi `mousedown` ngoài phần tử — cùng ý `chuong.tsx`.
 *
 * Menu `⋯` (mốc / bình luận) là `<details>` uncontrolled: chỉ bấm `summary` mới
 * toggle. Không có listener này thì người dùng phải bấm đúng nút `⋯` mới ẩn được.
 *
 * Khi đóng vì bấm ngoài, gắn thêm một listener `click` (capture, once) để **nuốt**
 * cú click kế tiếp — nếu không, trên trang mạch cú bấm ấy đi xuyên xuống
 * `VoThuGonMoc` và làm accordion nhảy sang mốc đang thu gọn.
 */
export function useDongDetailsKhiBamNgoai(
  hopRef: RefObject<HTMLDetailsElement | null>,
): void {
  useEffect(() => {
    const ngoai = (e: MouseEvent) => {
      const hop = hopRef.current;
      if (hop === null || !hop.open) return;
      if (!hop.contains(e.target as Node)) {
        hop.open = false;
        // Nuốt click kế tiếp (cùng cử chỉ chuột) — không để accordion/link phía dưới
        // nhận nó như một cú bấm có chủ đích.
        const nuot = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        document.addEventListener("click", nuot, { capture: true, once: true });
      }
    };
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, [hopRef]);
}
