"use client";

import { useRouter } from "next/navigation";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";

import { MucLuc } from "./muc-luc";
import { xuLyMucLuc } from "@/lib/muc-luc";
import { useLightbox } from "./lightbox";
import css from "./than-html.module.css";
import { ThanVan } from "./than-van";

/**
 * Kiểm tra xem một đường link có phải là liên kết nội bộ của gikky.net không.
 */
function laLinkNoiBo(href: string): boolean {
  if (!href) return false;
  const s = href.trim();
  if (s.startsWith("#")) return false;
  if (s.startsWith("/") && !s.startsWith("//")) return true;
  if (
    s.startsWith("https://gikky.net") ||
    s.startsWith("http://gikky.net") ||
    s.startsWith("https://www.gikky.net") ||
    s.startsWith("http://www.gikky.net")
  ) {
    return true;
  }
  return false;
}

/**
 * Chuyển đổi link nội bộ tuyệt đối sang đường dẫn tương đối (ví dụ https://gikky.net/m/xyz -> /m/xyz)
 */
function chuyenSangDuongDanTuongDoi(href: string): string {
  try {
    const url = new URL(href, "https://gikky.net");
    if (
      url.hostname === "gikky.net" ||
      url.hostname === "www.gikky.net" ||
      url.hostname === "localhost"
    ) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // Giữ nguyên nếu không parse được
  }
  return href;
}

/**
 * Xử lý các thẻ <a> trong chuỗi HTML:
 * Đối với link nội bộ: gỡ bỏ target="_blank" và rel="nofollow ugc noopener",
 * chuyển href về đường dẫn tương đối để người dùng mở ngay tại tab hiện tại.
 */
function xuLyLinkTrongHtml(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (khop, attrs: string = "") => {
    const hrefMatch = attrs.match(/\bhref=(["'])(.*?)\1/i);
    if (!hrefMatch) return khop;
    const href = hrefMatch[2].trim();

    if (laLinkNoiBo(href)) {
      const duongDanTuongDoi = chuyenSangDuongDanTuongDoi(href);
      const attrsMoi = attrs
        .replace(/\btarget=(["'])_blank\1/gi, "")
        .replace(/\brel=(["'])[^"']*\1/gi, "")
        .replace(/\bhref=(["'])(.*?)\1/i, `href="${duongDanTuongDoi}"`)
        .trim();
      return `<a ${attrsMoi}>`;
    }
    return khop;
  });
}

/** Thân của **MỐC và BÌNH LUẬN** — HTML do Tiptap soạn (user chốt 2026-08-24, mở cho
 * bình luận 2026-08-26).
 *
 * Tích hợp Lightbox: nhấp vào bất kỳ thẻ `<img>` nào trong nội dung sẽ phóng to trong Lightbox.
 * Tích hợp Mục lục (TOC): tự động trích xuất h2/h3 và chèn anchor id cho mốc 1 khi `coMucLuc = true`.
 * Tích hợp Điều hướng nội bộ: giữ nguyên tab đang mở khi bấm link trong site.
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
  const router = useRouter();
  const { moLightbox } = useLightbox();

  const xuLyBam = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. Phóng to ảnh trong Lightbox nếu click vào ảnh
    const img =
      target.closest("img") ??
      target.closest(`.${css.khung_anh_noi_dung}`)?.querySelector("img");
    if (img) {
      const src = img.currentSrc || img.getAttribute("src") || "";
      if (src) {
        e.preventDefault();
        e.stopPropagation();
        moLightbox(src, { alt: img.getAttribute("alt") ?? undefined });
        return;
      }
    }

    // 2. Điều hướng liên kết nội bộ trong cùng tab hiện tại (không mở tab mới)
    const a = target.closest("a");
    if (a) {
      const rawHref = a.getAttribute("href") || "";
      if (laLinkNoiBo(rawHref)) {
        // Cho phép người dùng chủ động mở tab mới nếu bấm Ctrl, Cmd, Shift, Alt hoặc click chuột giữa
        if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          const duongDan = chuyenSangDuongDanTuongDoi(rawHref);
          router.push(duongDan);
          return;
        }
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

  const htmlSauImg = htmlMucLuc.replace(
    /<img\b([^>]*)>/gi,
    (_khop, attrs: string = "") => {
      const attrsSach = attrs.replace(/\/+$/, "").trim();
      return `<span class="${css.khung_anh_noi_dung}"><img ${attrsSach} /><span class="${css.watermark_noi_dung}" aria-hidden="true">gikky.net</span></span>`;
    },
  );

  const htmlCuoi = xuLyLinkTrongHtml(htmlSauImg);

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
