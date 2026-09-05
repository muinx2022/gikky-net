"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import css from "./lightbox.module.css";

type LightboxOption = {
  alt?: string;
  danhSach?: string[];
  index?: number;
};

type LightboxCtxType = {
  moLightbox: (src: string, options?: LightboxOption) => void;
  dongLightbox: () => void;
};

const LightboxContext = createContext<LightboxCtxType | null>(null);

export function useLightbox(): LightboxCtxType {
  const ctx = useContext(LightboxContext);
  if (!ctx) {
    return {
      moLightbox: () => {},
      dongLightbox: () => {},
    };
  }
  return ctx;
}

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [dangMo, setDangMo] = useState(false);
  const [anhHienTai, setAnhHienTai] = useState<string | null>(null);
  const [altHienTai, setAltHienTai] = useState<string>("");
  const [danhSach, setDanhSach] = useState<string[]>([]);
  const [viTri, setViTri] = useState(0);
  const [daMount, setDaMount] = useState(false);

  useEffect(() => {
    setDaMount(true);
  }, []);

  const moLightbox = useCallback(
    (src: string, options?: LightboxOption) => {
      const list = options?.danhSach && options.danhSach.length > 0
        ? options.danhSach
        : [src];
      const idx = options?.index !== undefined && options.index >= 0
        ? options.index
        : list.indexOf(src);

      setDanhSach(list);
      setViTri(idx >= 0 ? idx : 0);
      setAnhHienTai(src);
      setAltHienTai(options?.alt ?? "");
      setDangMo(true);
    },
    [],
  );

  const dongLightbox = useCallback(() => {
    setDangMo(false);
    setAnhHienTai(null);
  }, []);

  const toiAnhTiep = useCallback(() => {
    if (danhSach.length <= 1) return;
    setViTri((cur) => {
      const tiep = (cur + 1) % danhSach.length;
      setAnhHienTai(danhSach[tiep]);
      return tiep;
    });
  }, [danhSach]);

  const veAnhTruoc = useCallback(() => {
    if (danhSach.length <= 1) return;
    setViTri((cur) => {
      const truoc = (cur - 1 + danhSach.length) % danhSach.length;
      setAnhHienTai(danhSach[truoc]);
      return truoc;
    });
  }, [danhSach]);

  // Khóa cuộn trang và lắng nghe phím khi mở Lightbox
  useEffect(() => {
    if (!dangMo) return;

    const overflowGoc = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function xuLyPhim(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dongLightbox();
      } else if (e.key === "ArrowRight") {
        toiAnhTiep();
      } else if (e.key === "ArrowLeft") {
        veAnhTruoc();
      }
    }

    window.addEventListener("keydown", xuLyPhim);

    return () => {
      document.body.style.overflow = overflowGoc;
      window.removeEventListener("keydown", xuLyPhim);
    };
  }, [dangMo, dongLightbox, toiAnhTiep, veAnhTruoc]);

  return (
    <LightboxContext.Provider value={{ moLightbox, dongLightbox }}>
      {children}
      {daMount &&
        dangMo &&
        anhHienTai &&
        createPortal(
          <div
            className={css.man_che}
            onClick={(e) => {
              // Nhấp vào vùng nền bên ngoài ảnh để đóng
              if (e.target === e.currentTarget) {
                dongLightbox();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Xem ảnh phóng to"
          >
            <button
              type="button"
              className={css.nut_dong}
              onClick={dongLightbox}
              aria-label="Đóng ảnh (Escape)"
              title="Đóng (Esc)"
            >
              ✕
            </button>

            {danhSach.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${css.nut_chuyen} ${css.nut_truoc}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    veAnhTruoc();
                  }}
                  aria-label="Ảnh trước đó (Mũi tên trái)"
                  title="Ảnh trước"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${css.nut_chuyen} ${css.nut_sau}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toiAnhTiep();
                  }}
                  aria-label="Ảnh tiếp theo (Mũi tên phải)"
                  title="Ảnh tiếp theo"
                >
                  ›
                </button>
              </>
            )}

            <div
              className={css.khung_anh}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  dongLightbox();
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={anhHienTai}
                src={anhHienTai}
                alt={altHienTai}
                className={css.anh_chinh}
              />
            </div>

            <div className={css.thong_tin_duoi}>
              {danhSach.length > 1 && (
                <span>
                  {viTri + 1} / {danhSach.length}
                </span>
              )}
              <a
                href={anhHienTai}
                target="_blank"
                rel="noopener noreferrer"
                className={css.link_goc}
                onClick={(e) => e.stopPropagation()}
              >
                <span>Mở ảnh gốc ↗</span>
              </a>
            </div>
          </div>,
          document.body,
        )}
    </LightboxContext.Provider>
  );
}
