"use client";

import css from "./trang-mach.module.css";

/** Cuộn nhanh mượt mà (~380ms) với easing easeOutQuart */
function cuonNhanhXuong(el: HTMLElement) {
  if (typeof window === "undefined") return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.scrollIntoView({ block: "start" });
    return;
  }

  const rect = el.getBoundingClientRect();
  const targetY = Math.max(0, window.scrollY + rect.top - 70);
  const startY = window.scrollY;
  const diff = targetY - startY;

  if (Math.abs(diff) < 10) return;

  const duration = 900; // ms: cuộn từ tốn, êm ái và không vội vã
  const startTime = performance.now();

  function buocCuon(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Easing easeInOutCubic: khởi đầu êm, lướt đầm và hãm phanh từ tốn
    const ease =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    window.scrollTo(0, startY + diff * ease);

    if (progress < 1) {
      requestAnimationFrame(buocCuon);
    }
  }

  requestAnimationFrame(buocCuon);
}

/** Nút "Bình luận" / "N Bình luận" trên hàng chữ ký bài viết, click cuộn nhanh xuống khán đài */
export function NutCuonBinhLuan({ soBinhLuan }: { soBinhLuan: number }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById("khan-dai");
    if (el) {
      e.preventDefault();
      cuonNhanhXuong(el);
      if (typeof history !== "undefined" && history.pushState) {
        history.pushState(null, "", "#khan-dai");
      }
    }
  };

  return (
    <a
      href="#khan-dai"
      onClick={handleClick}
      className={css.link_binh_luan}
      data-testid="chu-ky-so-binh-luan"
      title="Cuộn xuống phần bình luận"
    >
      {soBinhLuan >= 1 ? `${soBinhLuan} Bình luận` : "Bình luận"}
    </a>
  );
}
