"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import css from "./feed.module.css";

/**
 * Thanh lọc feed bám dính đồng bộ với thanh điều hướng chính:
 * - Khi chưa cuộn tới: nằm tự nhiên trong luồng feed.
 * - Khi cuộn qua và cuộn xuống: tự động trượt ẩn lên trên cùng thanh điều hướng chính.
 * - Khi cuộn qua và cuộn lên: trượt xuống bám dính ở top: 46px ngay dưới thanh điều hướng chính.
 */
export function ThanhLocDinh({ children }: { children: ReactNode }) {
  const khungRef = useRef<HTMLDivElement>(null);
  const thanhRef = useRef<HTMLDivElement>(null);
  const [daQuaDau, setDaQuaDau] = useState(false);
  const [chieuCao, setChieuCao] = useState<number | undefined>(undefined);

  useEffect(() => {
    const handleScroll = () => {
      if (!khungRef.current) return;
      const rect = khungRef.current.getBoundingClientRect();
      // rect.top <= 46: đỉnh khung đã chạm hoặc vượt qua vị trí sticky (46px dưới thanh điều hướng chính)
      setDaQuaDau(rect.top <= 46);
    };

    const doChieuCao = () => {
      if (thanhRef.current) {
        setChieuCao(thanhRef.current.offsetHeight);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", doChieuCao);
    handleScroll();
    doChieuCao();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", doChieuCao);
    };
  }, []);

  return (
    <div
      ref={khungRef}
      className={css.khung_thanh_dinh}
      style={{ minHeight: chieuCao ? `${chieuCao}px` : undefined }}
    >
      <div
        ref={thanhRef}
        className={`${css.thanh_dinh} ${daQuaDau ? css.da_qua_dau : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
