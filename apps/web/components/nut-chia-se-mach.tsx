"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Send, Share2 } from "lucide-react";

import { useDongDetailsKhiBamNgoai } from "@/lib/dong-details";
import css from "./nut-chia-se-mach.module.css";

interface NutChiaSeMachProps {
  duongDan: string;
  tieuDe: string;
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

export function NutChiaSeMach({ duongDan, tieuDe }: NutChiaSeMachProps) {
  const hopRef = useRef<HTMLDetailsElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trangThai, setTrangThai] = useState<TrangThai>("chua");

  useDongDetailsKhiBamNgoai(hopRef);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const dongMenu = () => {
    if (hopRef.current) {
      hopRef.current.open = false;
    }
  };

  const layUrlDayDu = () => {
    if (typeof window === "undefined") return duongDan;
    return `${window.location.origin}${duongDan}`;
  };

  const xuLyChepLink = async () => {
    const url = layUrlDayDu();
    await chepVaoBoNhoTam(url);
    dongMenu();
    setTrangThai("da_chep");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setTrangThai("chua");
    }, 1800);
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
    await chepVaoBoNhoTam(url);
    dongMenu();
    setTrangThai("da_chep_zalo");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setTrangThai("chua");
    }, 2200);
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

  return (
    <details ref={hopRef} className={css.menu}>
      <summary
        className={css.nut}
        data-testid="nut-chia-se-mach"
        title="Chia sẻ bài viết"
        aria-label="Chia sẻ bài viết"
      >
        {trangThai === "chua" ? (
          <Share2 size={13} strokeWidth={2} aria-hidden />
        ) : (
          <Check size={13} strokeWidth={2} aria-hidden />
        )}
        <span>
          {trangThai === "da_chep"
            ? "Đã chép link"
            : trangThai === "da_chep_zalo"
              ? "Đã chép cho Zalo"
              : "Chia sẻ"}
        </span>
      </summary>

      <div className={css.hop} role="menu">
        <button
          type="button"
          className={css.muc}
          data-testid="chia-se-chep-link"
          role="menuitem"
          onClick={xuLyChepLink}
        >
          <Copy size={14} strokeWidth={2} aria-hidden />
          <span>Chép liên kết</span>
        </button>

        <button
          type="button"
          className={css.muc}
          data-testid="chia-se-facebook"
          role="menuitem"
          onClick={xuLyFacebook}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Facebook</span>
        </button>

        <button
          type="button"
          className={css.muc}
          data-testid="chia-se-x"
          role="menuitem"
          onClick={xuLyX}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>X (Twitter)</span>
        </button>

        <button
          type="button"
          className={css.muc}
          data-testid="chia-se-zalo"
          role="menuitem"
          onClick={xuLyZalo}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "var(--f-sans)",
              letterSpacing: -0.5,
              width: 14,
              textAlign: "center",
              display: "inline-block",
            }}
          >
            Z
          </span>
          <span>Zalo</span>
        </button>

        <button
          type="button"
          className={css.muc}
          data-testid="chia-se-telegram"
          role="menuitem"
          onClick={xuLyTelegram}
        >
          <Send size={14} strokeWidth={2} aria-hidden />
          <span>Telegram</span>
        </button>
      </div>
    </details>
  );
}
