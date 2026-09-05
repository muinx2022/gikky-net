"use client";

import type { AnhOut } from "@gikky/api-client";

import css from "./gallery-moc.module.css";
import { useLightbox } from "./lightbox";

/** Gallery ảnh trong thẻ mốc — PLAN 5.2, plan con Phase 5 §3.
 *
 * Mở ảnh trong Lightbox phóng to khi click, thay vì mở trực tiếp URL file ảnh.
 */
export function GalleryMoc({ anhs, seq }: { anhs: readonly AnhOut[]; seq: number }) {
  const { moLightbox } = useLightbox();
  if (anhs.length === 0) return null;

  const danhSach = anhs.map((a) => a.url);

  return (
    <ul
      className={css.luoi}
      data-testid={`gallery-moc-${seq}`}
      data-so-anh={anhs.length}
    >
      {anhs.map((a, i) => (
        <li key={a.id} className={css.o}>
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              moLightbox(a.url, { danhSach, index: i });
            }}
            title="Nhấp để xem ảnh phóng to"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url_thumb}
              width={a.w ?? undefined}
              height={a.h ?? undefined}
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
