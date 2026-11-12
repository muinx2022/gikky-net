"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Link2, MoreHorizontal, Share2, X } from "lucide-react";

import css from "./nut-chia-se-mach.module.css";

interface NutChiaSeMachProps {
  duongDan: string;
  tieuDe: string;
  kieu?: "menu" | "pill";
}

type TrangThai = "chua" | "da_chep" | "da_chep_zalo";

async function chepVaoBoNhoTam(chuoi: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(chuoi);
      return true;
    } catch {
      // Fallback xuống execCommand nếu quyền clipboard bị chặn
    }
  }
  try {
    const o = document.createElement("textarea");
    o.value = chuoi;
    o.style.position = "fixed";
    o.style.left = "-9999px";
    o.style.top = "-9999px";
    document.body.appendChild(o);
    o.focus();
    o.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(o);
    return ok;
  } catch {
    return false;
  }
}

export function NutChiaSeMach({ duongDan, tieuDe, kieu = "menu" }: NutChiaSeMachProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moModal, setMoModal] = useState(false);
  const [trangThai, setTrangThai] = useState<TrangThai>("chua");

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!moModal) return;
    const xuLyPhim = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoModal(false);
      }
    };
    window.addEventListener("keydown", xuLyPhim);
    return () => window.removeEventListener("keydown", xuLyPhim);
  }, [moModal]);

  const dongMenu = () => {
    setMoModal(false);
  };

  const moHopChiaSe = (e: MouseEvent<HTMLButtonElement>) => {
    const detailsCha = e.currentTarget.closest("details");
    if (detailsCha) {
      detailsCha.open = false;
    }
    setMoModal(true);
  };

  const layUrlDayDu = () => {
    if (typeof window === "undefined") return duongDan;
    return `${window.location.origin}${duongDan}`;
  };

  const datThongBaoTam = (loai: TrangThai, thoiGian = 1800) => {
    setTrangThai(loai);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setTrangThai("chua");
    }, thoiGian);
  };

  const xuLyChepLink = async () => {
    const url = layUrlDayDu();
    await chepVaoBoNhoTam(url);
    datThongBaoTam("da_chep", 1800);
  };

  const xuLyMessenger = () => {
    const url = layUrlDayDu();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const laDiDong =
      /Android|iPhone|iPad|iPod/i.test(ua) ||
      (typeof navigator !== "undefined" &&
        navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1);
    dongMenu();
    if (laDiDong) {
      window.location.href = `fb-messenger://share/?link=${encodeURIComponent(url)}`;
      return;
    }
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const xuLyFacebook = () => {
    const url = layUrlDayDu();
    dongMenu();
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const xuLyX = () => {
    const url = layUrlDayDu();
    dongMenu();
    window.open(
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(tieuDe)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const xuLyZalo = async () => {
    const url = layUrlDayDu();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const laAndroid = /Android/i.test(ua);
    const laIOS =
      /iPhone|iPad|iPod/i.test(ua) ||
      (typeof navigator !== "undefined" &&
        navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1);

    if (laAndroid) {
      dongMenu();
      window.location.href = `intent://zaloapp.com/#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.SUBJECT=;S.android.intent.extra.TEXT=${encodeURIComponent(url)};B.hidePostFeed=false;B.backToSource=true;end`;
      return;
    }

    if (laIOS) {
      dongMenu();
      window.location.href = `zaloshareext://shareext?url=${encodeURIComponent(url)}&type=8&version=1`;
      return;
    }

    await chepVaoBoNhoTam(url);
    dongMenu();
    datThongBaoTam("da_chep_zalo", 2200);
    window.open("https://chat.zalo.me/", "_blank", "noopener,noreferrer");
  };

  const xuLyTelegram = () => {
    const url = layUrlDayDu();
    dongMenu();
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(tieuDe)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const xuLyKhac = async () => {
    const url = layUrlDayDu();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      dongMenu();
      try {
        await navigator.share({ title: tieuDe, url });
        return;
      } catch {
        return;
      }
    }
    await chepVaoBoNhoTam(url);
    datThongBaoTam("da_chep", 1800);
  };

  const iconSize = kieu === "pill" ? 15 : 16;

  return (
    <div className={kieu === "pill" ? `${css.khung} ${css.khung_pill}` : css.khung}>
      <button
        type="button"
        className={css.nut}
        data-testid="nut-chia-se-mach"
        title="Chia sẻ bài viết"
        // Nhãn đọc ra TRẠNG THÁI, không cố định: trên điện thoại chữ trong nút bị ẩn (chỉ còn icon —
        // `the-mach.module.css`, đợt M), nên "đã chép" chỉ còn đến được trình đọc màn hình qua đây.
        aria-label={
          trangThai === "da_chep"
            ? "Đã chép link bài viết"
            : trangThai === "da_chep_zalo"
              ? "Đã chép link cho Zalo"
              : "Chia sẻ bài viết"
        }
        onClick={moHopChiaSe}
      >
        {trangThai === "chua" ? (
          <Share2 size={iconSize} strokeWidth={2} aria-hidden />
        ) : (
          <Check size={iconSize} strokeWidth={2} aria-hidden />
        )}
        <span>
          {trangThai === "da_chep"
            ? "Đã chép link"
            : trangThai === "da_chep_zalo"
              ? "Đã chép cho Zalo"
              : "Chia sẻ"}
        </span>
      </button>

      {moModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={css.nen_modal}
            data-testid="modal-chia-se-mach"
            role="dialog"
            aria-modal="true"
            aria-label="Chia sẻ bài viết"
            onClick={dongMenu}
          >
            <div className={css.hop_modal} onClick={(e) => e.stopPropagation()}>
              <div className={css.dau_modal}>
                <span className={css.tieu_de_modal}>Chia sẻ bài viết</span>
                <button
                  type="button"
                  className={css.nut_dong}
                  data-testid="dong-modal-chia-se"
                  aria-label="Đóng"
                  onClick={dongMenu}
                >
                  <X size={20} strokeWidth={1.8} aria-hidden />
                </button>
              </div>

              <div className={css.than_modal}>
                <div className={css.hang_kenh}>
                  <button
                    type="button"
                    className={css.o_kenh}
                    data-testid="chia-se-messenger"
                    onClick={xuLyMessenger}
                  >
                    <span className={`${css.vong_tron} ${css.mau_messenger}`} aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.13.26.35.27.57l.05 1.78c.04.57.61.94 1.13.71l1.98-.87c.17-.08.36-.1.55-.06.91.25 1.87.38 2.88.38 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm5.89 7.58l-2.93 4.65c-.47.74-1.48.92-2.17.4l-2.33-1.75a.6.6 0 0 0-.72 0l-3.15 2.39c-.42.32-.97-.18-.69-.63l2.93-4.65c.47-.74 1.48-.92 2.17-.4l2.33 1.75c.21.16.51.16.72 0l3.15-2.39c.42-.32.97.18.69.63z" />
                      </svg>
                    </span>
                    <span className={css.nhan_kenh}>Messenger</span>
                  </button>

                  <button
                    type="button"
                    className={css.o_kenh}
                    data-testid="chia-se-zalo"
                    onClick={xuLyZalo}
                  >
                    <span className={`${css.vong_tron} ${css.mau_zalo}`} aria-hidden="true">
                      <span className={css.bong_zalo}>Zalo</span>
                    </span>
                    <span className={css.nhan_kenh}>Zalo</span>
                  </button>

                  <button
                    type="button"
                    className={css.o_kenh}
                    data-testid="chia-se-facebook"
                    onClick={xuLyFacebook}
                  >
                    <span className={`${css.vong_tron} ${css.mau_facebook}`} aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7v2.62H6.61v3.56h3.07V22h3.68v-9.12h3.06l.46-3.56h-3.52V6.65c0-1.05.29-1.73 1.76-1.73z" />
                      </svg>
                    </span>
                    <span className={css.nhan_kenh}>Facebook</span>
                  </button>

                  <button
                    type="button"
                    className={css.o_kenh}
                    data-testid="chia-se-telegram"
                    onClick={xuLyTelegram}
                  >
                    <span className={`${css.vong_tron} ${css.mau_telegram}`} aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z" />
                      </svg>
                    </span>
                    <span className={css.nhan_kenh}>Telegram</span>
                  </button>

                  <button
                    type="button"
                    className={css.o_kenh}
                    data-testid="chia-se-x"
                    onClick={xuLyX}
                  >
                    <span className={`${css.vong_tron} ${css.mau_x}`} aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </span>
                    <span className={css.nhan_kenh}>X</span>
                  </button>
                </div>

                <div className={css.hang_kenh}>
                  <button
                    type="button"
                    className={css.o_kenh}
                    data-testid="chia-se-chep-link"
                    onClick={xuLyChepLink}
                  >
                    <span className={`${css.vong_tron} ${css.vong_vien}`} aria-hidden="true">
                      {trangThai === "da_chep" ? (
                        <Check size={22} strokeWidth={2} />
                      ) : (
                        <Link2 size={22} strokeWidth={1.9} />
                      )}
                    </span>
                    <span className={css.nhan_kenh}>
                      {trangThai === "da_chep" ? "Đã sao chép" : "Sao chép đường dẫn"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={css.o_kenh}
                    data-testid="chia-se-khac"
                    onClick={xuLyKhac}
                  >
                    <span className={`${css.vong_tron} ${css.vong_vien}`} aria-hidden="true">
                      <MoreHorizontal size={22} strokeWidth={2} />
                    </span>
                    <span className={css.nhan_kenh}>Khác</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
