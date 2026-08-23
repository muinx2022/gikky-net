"use client";

import { useEffect, useState } from "react";

import {
  CAC_KIEU_XEM,
  KHOA_KIEU_XEM,
  KIEU_XEM_MAC_DINH,
  NHAN_KIEU_XEM,
  apKieuXem,
  docKieuXem,
  type KieuXem,
} from "@/lib/kieu-xem";

import css from "./chon-kieu-xem.module.css";

/** Nút đổi kiểu xem feed — thẻ / gọn.
 *
 * Hai nút `aria-pressed` chứ không một `<select>` như công tắc theme, và khác biệt ấy có
 * lý do chứ không phải tuỳ hứng: đây là hai lựa chọn, cả hai đều đáng bấm một cú, và
 * chúng nằm trong thân trang chứ không trên thanh header chật chỗ. Một `<select>` hai
 * mục là bắt người ta bấm hai lần cho một việc.
 *
 * Không tự áp kiểu lúc tải — script inline trong `<head>` làm việc đó (`lib/kieu-xem.ts`).
 * Ở đây `useEffect` chỉ **đọc lại** để hai cái nút hiện đúng cái nào đang bật.
 */
export function ChonKieuXem() {
  const [kieu, datKieu] = useState<KieuXem>(KIEU_XEM_MAC_DINH);

  useEffect(() => {
    try {
      datKieu(docKieuXem(window.localStorage.getItem(KHOA_KIEU_XEM)));
    } catch {
      datKieu(KIEU_XEM_MAC_DINH);
    }
  }, []);

  const doi = (moi: KieuXem) => {
    datKieu(moi);
    apKieuXem(document.documentElement, moi);
    try {
      if (moi === KIEU_XEM_MAC_DINH) window.localStorage.removeItem(KHOA_KIEU_XEM);
      else window.localStorage.setItem(KHOA_KIEU_XEM, moi);
    } catch {
      // Không lưu được thì lựa chọn sống trong tab này. Không đáng một dòng báo lỗi.
    }
  };

  return (
    <div className={css.khung} role="group" aria-label="Kiểu xem" data-testid="chon-kieu-xem">
      {CAC_KIEU_XEM.map((k) => (
        <button
          key={k}
          type="button"
          className={k === kieu ? `${css.nut} ${css.dang_chon}` : css.nut}
          aria-pressed={k === kieu}
          onClick={() => doi(k)}
          data-testid={`kieu-xem-${k}`}
        >
          {NHAN_KIEU_XEM[k]}
        </button>
      ))}
    </div>
  );
}
