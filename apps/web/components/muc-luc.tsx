import type { MucLucItem } from "@/lib/muc-luc";
import { AlignLeft } from "lucide-react";

import css from "./muc-luc.module.css";

/** Mục lục nội dung bài viết (Table of Contents) — kích hoạt Jump to section trên Google SERP.
 *
 * Tự động trích xuất từ các thẻ `<h2>` và `<h3>` của bài viết dài.
 * Dùng thẻ `<details open>` chuẩn HTML, hoạt động hoàn hảo cả khi không có JS.
 */
export function MucLuc({ danhSach }: { danhSach: readonly MucLucItem[] }) {
  if (danhSach.length < 2) return null;

  return (
    <nav className={css.khung} aria-label="Mục lục bài viết" data-testid="muc-luc">
      <details open className={css.details}>
        <summary className={css.summary}>
          <span className={css.tieu_de}>
            <AlignLeft size={15} strokeWidth={2} aria-hidden />
            <span>Mục lục nội dung</span>
          </span>
        </summary>
        <ol className={css.danh_sach}>
          {danhSach.map((item, i) => (
            <li
              key={item.id}
              className={item.cap === 3 ? `${css.muc} ${css.cap_3}` : css.muc}
            >
              <a href={`#${item.id}`} className={css.link}>
                <span className={css.so}>{i + 1}.</span>
                <span>{item.tieuDe}</span>
              </a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
