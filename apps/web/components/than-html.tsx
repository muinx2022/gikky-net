"use client";

import { phanTramChieuRongAnh } from "@/lib/anh";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";

import { useLightbox } from "./lightbox";
import css from "./than-html.module.css";
import { ThanVan } from "./than-van";

/** Tự động phân bổ chiều rộng ngẫu nhiên (72% – 92%) cho các ảnh minh hoạ
 * để tránh cảm giác bằng phẳng, rập khuôn 100% cột nội dung.
 */
function phanBoKichThuocAnh(html: string): string {
  if (!html.includes("<img")) return html;
  return html.replace(/<img\b([^>]*?)>/gi, (khop, thuocTinh) => {
    // Nếu đã có width hoặc style thì không can thiệp
    if (/\b(?:width|style)\s*=/i.test(thuocTinh)) return khop;
    const khopSrc = thuocTinh.match(/src="([^"]+)"/i);
    const src = khopSrc ? khopSrc[1] : thuocTinh;
    const phanTram = phanTramChieuRongAnh(src);
    return `<img${thuocTinh} style="width: ${phanTram}%">`;
  });
}

/** Thân của **MỐC và BÌNH LUẬN** — HTML do Tiptap soạn (user chốt 2026-08-24, mở cho
 * bình luận 2026-08-26).
 *
 * Tích hợp Lightbox: nhấp vào bất kỳ thẻ `<img>` nào trong nội dung sẽ phóng to trong Lightbox.
 */
export function ThanHtml({
  body,
  dinhDang,
  className,
}: {
  body: string;
  /** `MocOut.body_dinh_dang` — `"html"` hoặc `"markdown"`. */
  dinhDang: string;
  className?: string;
}) {
  const { moLightbox } = useLightbox();

  const xuLyBam = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const img = target.closest("img");
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
  const noiDungHtml = phanBoKichThuocAnh(body);
  return (
    <div
      className={`${css.than} ${className ?? ""}`}
      {...CHU_NGUOI_DUNG}
      onClick={xuLyBam}
      // Chuỗi này đã qua `lam_sach` ở server trước khi vào DB.
      dangerouslySetInnerHTML={{ __html: noiDungHtml }}
    />
  );
}
