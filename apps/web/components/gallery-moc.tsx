import type { AnhOut } from "@gikky/api-client";

import css from "./gallery-moc.module.css";

/** Gallery ảnh trong thẻ mốc — PLAN 5.2, plan con Phase 5 §3.
 *
 * **Server component** (không `"use client"`), cùng nhánh với `TheMoc` chứa nó: nó chỉ
 * render, không có trạng thái nào. Một `"use client"` ở đây kéo cả nhánh thẻ mốc vào
 * bundle trình duyệt mà không đổi được gì trên màn hình.
 *
 * **Nguyên tắc 9: mốc không ảnh thì không render GÌ CẢ.** `null` chứ không phải một
 * `<div>` rỗng — một khung trống có viền là một câu nói "ở đây đáng lẽ có gì đó".
 *
 * Bia mộ và mốc bị mod ẩn không bao giờ tới được đây: `MocOut.anhs` đã là `[]` từ phía
 * server (`api/trinh_bay.py::moc_ra`), và file trên đĩa cũng đã bị chuyển sang kho cách
 * ly (`core/anh_luu.py` — A9). Hai vế, và vế thứ hai mới là vế làm URL cũ chết.
 */
export function GalleryMoc({ anhs, seq }: { anhs: readonly AnhOut[]; seq: number }) {
  if (anhs.length === 0) return null;

  return (
    <ul
      className={css.luoi}
      data-testid={`gallery-moc-${seq}`}
      data-so-anh={anhs.length}
    >
      {anhs.map((a) => (
        <li key={a.id} className={css.o}>
          <a href={a.url} target="_blank" rel="noopener noreferrer">
            {/*
              `next/image` cố ý KHÔNG dùng ở đây. Ảnh đã được server thu về cạnh
              `CANH_TOI_DA` và có sẵn bản thumbnail lúc upload (`core/anh.py` — tái mã
              hoá đồng bộ), nên bộ tối ưu ảnh của Next chỉ thêm một tầng nữa làm đúng
              việc đã làm rồi, và nó cần `images.remotePatterns` cho một origin mà prod
              phục vụ bằng Caddy. `width`/`height` đặt thẳng từ `w`/`h` của server —
              đó là thứ chống layout shift, không phải `next/image`.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url_thumb}
              width={a.w ?? undefined}
              height={a.h ?? undefined}
              // `alt=""` là CỐ Ý, không phải quên: ảnh này không có mô tả nào server
              // biết được, và một `alt` bịa ra ("ảnh của mốc 3") tệ hơn rỗng — trình
              // đọc màn hình sẽ đọc nó thay vì bỏ qua một ảnh trang trí.
              alt=""
              loading="lazy"
              decoding="async"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
