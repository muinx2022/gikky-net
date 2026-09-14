"use client";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";

import { MucLuc } from "./muc-luc";
import { xuLyMucLuc } from "@/lib/muc-luc";
import { useLightbox } from "./lightbox";
import css from "./than-html.module.css";
import { ThanVan } from "./than-van";

/** Thân của **MỐC và BÌNH LUẬN** — HTML do Tiptap soạn (user chốt 2026-08-24, mở cho
 * bình luận 2026-08-26).
 *
 * Tích hợp Lightbox: nhấp vào bất kỳ thẻ `<img>` nào trong nội dung sẽ phóng to trong Lightbox.
 * Tích hợp Mục lục (TOC): tự động trích xuất h2/h3 và chèn anchor id cho mốc 1 khi `coMucLuc = true`.
 */
export function ThanHtml({
  body,
  dinhDang,
  className,
  coMucLuc = false,
}: {
  body: string;
  /** `MocOut.body_dinh_dang` — `"html"` hoặc `"markdown"`. */
  dinhDang: string;
  className?: string;
  coMucLuc?: boolean;
}) {
  const { moLightbox } = useLightbox();

  const xuLyBam = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const img =
      target.closest("img") ??
      target.closest(`.${css.khung_anh_noi_dung}`)?.querySelector("img");
    if (img) {
      const src = img.currentSrc || img.getAttribute("src") || "";
      if (src) {
        e.preventDefault();
        e.stopPropagation();
        moLightbox(src, { alt: img.getAttribute("alt") ?? undefined });
      }
    }
  };

  if (dinhDang !== "html") {
    return (
      <div onClick={xuLyBam}>
        <ThanVan body={body} className={className} />
      </div>
    );
  }
  const { htmlMoi: htmlMucLuc, mucLuc } =
    coMucLuc && dinhDang === "html"
      ? xuLyMucLuc(body)
      : { htmlMoi: body, mucLuc: [] };

  const htmlCuoi = htmlMucLuc.replace(
    /<img\b([^>]*)>/gi,
    (_khop, attrs: string = "") => {
      const attrsSach = attrs.replace(/\/+$/, "").trim();
      return `<span class="${css.khung_anh_noi_dung}"><img ${attrsSach} /><span class="${css.watermark_noi_dung}" aria-hidden="true">gikky.net</span></span>`;
    },
  );

  return (
    <>
      {mucLuc.length >= 2 && <MucLuc danhSach={mucLuc} />}
      <div
        className={`${css.than} ${className ?? ""}`}
        {...CHU_NGUOI_DUNG}
        onClick={xuLyBam}
        // Chuỗi này đã qua `lam_sach` ở server trước khi vào DB.
        dangerouslySetInnerHTML={{ __html: htmlCuoi }}
      />
    </>
  );
}
