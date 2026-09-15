"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

import css from "./nut-ve-dau-trang.module.css";

/** Nút mũi tên nổi giúp cuộn nhanh về đầu trang khi người dùng đã cuộn qua page 1 trên feed.
 *
 * - Chỉ hiện khi vị trí cuộn `window.scrollY` vượt quá chiều cao một khung nhìn (`window.innerHeight`).
 * - Bấm vào thì cuộn mượt về đầu trang (`top: 0`).
 * - Hỗ trợ `prefers-reduced-motion` và chuẩn trợ năng (`aria-label`, `tabIndex`).
 */
export function NutVeDauTrang() {
  const [hien, setHien] = useState(false);

  useEffect(() => {
    const kiemTraCuon = () => {
      // "Qua page 1": Đã cuộn xuống quá 1 khung nhìn (viewport height) của màn hình.
      const nguong = window.innerHeight || 600;
      setHien(window.scrollY > nguong);
    };

    kiemTraCuon();
    window.addEventListener("scroll", kiemTraCuon, { passive: true });
    return () => window.removeEventListener("scroll", kiemTraCuon);
  }, []);

  const cuonVeDau = () => {
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: 0,
      behavior: giamChuyenDong ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      className={`${css.nut_ve_dau} ${hien ? css.hien : css.an}`}
      onClick={cuonVeDau}
      aria-label="Quay về đầu trang"
      title="Quay về đầu trang"
      aria-hidden={!hien}
      tabIndex={hien ? 0 : -1}
      data-testid="nut-ve-dau-trang"
    >
      <ArrowUp size={20} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}
