"use client";

import { phanTramChieuRongAnh } from "@/lib/anh";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";

import { useLightbox } from "./lightbox";
import css from "./than-html.module.css";
import { ThanVan } from "./than-van";

/** Tự động phân bổ chiều rộng ngẫu nhiên (60% – 95%) cho các ảnh minh hoạ
 * để tránh cảm giác bằng phẳng, rập khuôn 100% cột nội dung.
 */
function phanBoKichThuocAnh(html: string): string {
  if (!html.includes("<img")) return html;
  return html.replace(/<img\b([^>]*?)>/gi, (khop, thuocTinh) => {
    const khopSrc = thuocTinh.match(/src="([^"]+)"/i);
    const src = khopSrc ? khopSrc[1] : thuocTinh;
    const phanTram = phanTramChieuRongAnh(src);

    // Nếu đã có style thì cập nhật hoặc chèn width
    if (/\bstyle\s*=/i.test(thuocTinh)) {
      if (/style\s*=\s*["'][^"']*width\s*:[^"']*["']/i.test(thuocTinh)) {
        return `<img${thuocTinh.replace(/width\s*:\s*[^;"]+;?/i, `width: ${phanTram}%;`)}>`;
      }
      return `<img${thuocTinh.replace(/style\s*=\s*(["'])/i, `$1width: ${phanTram}%; `)}>`;
    }

    // Nếu có width thuộc tính HTML thì bỏ đi và thêm style width
    const thuocTinhSach = thuocTinh.replace(/\bwidth\s*=\s*["'][^"']*["']/gi, "");
    return `<img${thuocTinhSach} style="width: ${phanTram}%">`;
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
