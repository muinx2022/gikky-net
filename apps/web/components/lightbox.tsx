"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

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

  const dangMoRef = useRef(false);
  const daPushHistoryRef = useRef(false);
  const boQuaPopStateRef = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    setDaMount(true);
  }, []);

  // Tự động đóng lightbox nếu người dùng chuyển sang route khác
  useEffect(() => {
    if (dangMoRef.current) {
      dangMoRef.current = false;
      daPushHistoryRef.current = false;
      setDangMo(false);
      setAnhHienTai(null);
    }
  }, [pathname]);

  const dongLightbox = useCallback(() => {
    if (!dangMoRef.current) return;
    dangMoRef.current = false;
    setDangMo(false);
    setAnhHienTai(null);

    // Nếu trước đó đã đẩy 1 history entry cho lightbox, gọi history.back()
    // để dọn stack trình duyệt, đồng thời đánh dấu bỏ qua popstate kế tiếp
    if (daPushHistoryRef.current && typeof window !== "undefined") {
      daPushHistoryRef.current = false;
      boQuaPopStateRef.current = true;
      window.history.back();
    }
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
      dangMoRef.current = true;

      // Đẩy 1 entry vào history để khi user bấm Back (trình duyệt hoặc cử chỉ vuốt),
      // chỉ đóng lightbox trước thay vì lùi về trang trước ngay lập tức.
      if (!daPushHistoryRef.current && typeof window !== "undefined") {
        daPushHistoryRef.current = true;
        try {
          window.history.pushState(
            { ...(window.history.state || {}), __gikkyLightbox: true },
            "",
            window.location.href,
          );
        } catch {
          // Bỏ qua nếu môi trường không hỗ trợ pushState
        }
      }
    },
    [],
  );

  // Lắng nghe nút Back của trình duyệt (sự kiện popstate)
  useEffect(() => {
    const xuLyPopState = () => {
      if (boQuaPopStateRef.current) {
        boQuaPopStateRef.current = false;
        return;
      }
      if (dangMoRef.current) {
        dangMoRef.current = false;
        daPushHistoryRef.current = false;
        setDangMo(false);
        setAnhHienTai(null);
      }
    };

    window.addEventListener("popstate", xuLyPopState);
    return () => {
      window.removeEventListener("popstate", xuLyPopState);
    };
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
      document.body.style.overflow = overflowGoc === "hidden" ? "" : overflowGoc;
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
              <span className={css.watermark_anh} aria-hidden="true">
                gikky.net
              </span>
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

            <div className={css.watermark_man_hinh} aria-hidden="true">
              <span>gikky.net</span>
            </div>
          </div>,
          document.body,
        )}
    </LightboxContext.Provider>
  );
}
