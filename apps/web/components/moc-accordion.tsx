"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import css from "./the-moc.module.css";

type MocAccordionCtxType = {
  mocDangMo: number | null;
  moMoc: (seq: number) => void;
  dongMoc: (seq: number) => void;
  toggleMoc: (seq: number) => void;
};

const MocAccordionContext = createContext<MocAccordionCtxType | null>(null);

export function useMocAccordion(): MocAccordionCtxType {
  const ctx = useContext(MocAccordionContext);
  if (!ctx) {
    return {
      mocDangMo: null,
      moMoc: () => {},
      dongMoc: () => {},
      toggleMoc: () => {},
    };
  }
  return ctx;
}

export function MocAccordionProvider({ children }: { children: ReactNode }) {
  const [mocDangMo, setMocDangMo] = useState<number | null>(null);

  const moMoc = (seq: number) => {
    setMocDangMo(seq);
  };

  const dongMoc = (seq: number) => {
    setMocDangMo((cur) => (cur === seq ? null : cur));
  };

  const toggleMoc = (seq: number) => {
    setMocDangMo((cur) => (cur === seq ? null : seq));
  };

  useEffect(() => {
    function kiemTraHash() {
      const hash = window.location.hash;
      if (!hash) return;
      if (hash.startsWith("#moc-")) {
        const seq = parseInt(hash.replace("#moc-", ""), 10);
        if (!isNaN(seq) && seq > 1) {
          moMoc(seq);
        }
      } else if (hash.startsWith("#bl-")) {
        const el = document.querySelector(hash);
        const mocEl = el?.closest("[data-testid^='moc-']");
        if (mocEl) {
          const match = mocEl.getAttribute("data-testid")?.match(/^moc-(\d+)$/);
          if (match) {
            const seq = parseInt(match[1], 10);
            if (seq > 1) moMoc(seq);
          }
        }
      }
    }

    kiemTraHash();
    window.addEventListener("hashchange", kiemTraHash);
    return () => window.removeEventListener("hashchange", kiemTraHash);
  }, []);

  useEffect(() => {
    function xuLyToiBinhLuan(e: Event) {
      const custom = e as CustomEvent<string>;
      const id = custom.detail;
      const el = document.getElementById(id);
      const mocEl = el?.closest("[data-testid^='moc-']");
      if (mocEl) {
        const match = mocEl.getAttribute("data-testid")?.match(/^moc-(\d+)$/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > 1) moMoc(seq);
        }
      }
    }

    window.addEventListener("gikky:toi-binh-luan", xuLyToiBinhLuan);
    return () => window.removeEventListener("gikky:toi-binh-luan", xuLyToiBinhLuan);
  }, []);

  return (
    <MocAccordionContext.Provider
      value={{
        mocDangMo,
        moMoc,
        dongMoc,
        toggleMoc,
      }}
    >
      {children}
    </MocAccordionContext.Provider>
  );
}

export function VoThuGonMoc({
  seq,
  laMach,
  children,
}: {
  seq: number;
  laMach: boolean;
  children: ReactNode;
}) {
  const { mocDangMo, moMoc, dongMoc } = useMocAccordion();

  const luonHienDu = !laMach || seq === 1;
  const dangMo = luonHienDu || mocDangMo === seq;

  if (luonHienDu) {
    return <div className={css.noi}>{children}</div>;
  }

  if (!dangMo) {
    return (
      <div
        className={`${css.noi} ${css.thu_gon}`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button, a, input, textarea")) return;
          moMoc(seq);
        }}
        title="Nhấp để mở rộng mốc này"
      >
        <div className={css.than_thu_gon}>{children}</div>
        <div className={css.phu_mo_thu_gon}>
          <button
            type="button"
            className={css.nut_mo_moc}
            onClick={(e) => {
              e.stopPropagation();
              moMoc(seq);
            }}
            aria-expanded={false}
            data-testid={`nut-mo-moc-${seq}`}
          >
            <span>Xem thêm</span>
            <span className={css.mui_ten_mo} aria-hidden>
              ▾
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${css.noi} ${css.dang_mo}`}>
      {children}
      <div className={css.chan_thu_gon}>
        <button
          type="button"
          className={css.nut_dong_moc}
          onClick={() => dongMoc(seq)}
          aria-expanded={true}
          data-testid={`nut-thu-gon-moc-${seq}`}
        >
          <span>Thu gọn</span>
          <span className={css.mui_ten_dong} aria-hidden>
            ▴
          </span>
        </button>
      </div>
    </div>
  );
}
