"use client";

import { useEffect, useRef } from "react";

import css from "./modal-xac-nhan.module.css";

/** Modal xác nhận thao tác (thay thế window.confirm).
 *
 * Sử dụng `<dialog>` gốc với `showModal()` tương tự `modal-dang-nhap.tsx`:
 * - Tự động bẫy focus, đóng bằng phím Esc và backdrop.
 * - Khôi phục focus cho phần tử kích hoạt trước đó khi đóng.
 * - Không cho đóng khi `dangXuLy === true`.
 */
export function ModalXacNhan({
  dangMo,
  tieuDe,
  noiDung,
  nhanXacNhan = "Xác nhận",
  nhanHuy = "Hủy",
  dangXuLy = false,
  onXacNhan,
  onDong,
}: {
  dangMo: boolean;
  tieuDe: string;
  noiDung: React.ReactNode;
  nhanXacNhan?: string;
  nhanHuy?: string;
  dangXuLy?: boolean;
  onXacNhan: () => void | Promise<void>;
  onDong: () => void;
}) {
  if (!dangMo) return null;

  return (
    <HopThoai
      tieuDe={tieuDe}
      noiDung={noiDung}
      nhanXacNhan={nhanXacNhan}
      nhanHuy={nhanHuy}
      dangXuLy={dangXuLy}
      onXacNhan={onXacNhan}
      onDong={onDong}
    />
  );
}

function HopThoai({
  tieuDe,
  noiDung,
  nhanXacNhan,
  nhanHuy,
  dangXuLy,
  onXacNhan,
  onDong,
}: {
  tieuDe: string;
  noiDung: React.ReactNode;
  nhanXacNhan: string;
  nhanHuy: string;
  dangXuLy: boolean;
  onXacNhan: () => void | Promise<void>;
  onDong: () => void;
}) {
  const hop = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = hop.current;
    if (d === null || d.open) return;

    // Ai đang giữ focus trước khi mở để trả lại khi đóng
    const truoc = document.activeElement;
    d.showModal();

    return () => {
      if (d.open) d.close();
      if (truoc instanceof HTMLElement && truoc.isConnected) truoc.focus();
    };
  }, []);

  const dong = () => {
    if (dangXuLy) return;
    onDong();
  };

  return (
    <dialog
      ref={hop}
      className={css.hop}
      onClick={(e) => {
        if (e.target === hop.current) dong();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        dong();
      }}
      data-testid="modal-xac-nhan"
    >
      <div className={css.trong}>
        <div className={css.than}>
          <h2 className={css.tieuDe}>{tieuDe}</h2>
          <div className={css.noiDung}>{noiDung}</div>
          <div className={css.hangNut}>
            <button
              type="button"
              className={css.nutHuy}
              onClick={dong}
              disabled={dangXuLy}
              data-testid="modal-xac-nhan-huy"
            >
              {nhanHuy}
            </button>
            <button
              type="button"
              className={css.nutXacNhan}
              onClick={() => onXacNhan()}
              disabled={dangXuLy}
              data-testid="modal-xac-nhan-dong-y"
            >
              {dangXuLy ? "Đang xử lý…" : nhanXacNhan}
            </button>
          </div>
        </div>
        <button
          type="button"
          className={css.dong}
          onClick={dong}
          disabled={dangXuLy}
          aria-label="Đóng"
          data-testid="modal-xac-nhan-dong"
        >
          ✕
        </button>
      </div>
    </dialog>
  );
}
