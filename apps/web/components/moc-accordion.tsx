"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { hienNutXemThem } from "@/lib/bien-lai-dau";

import css from "./the-moc.module.css";

/** Khớp `max-height: 72px` của `.kep_than` trong `the-moc.module.css`. */
const NGUONG_THAN_PX = 72;

// Server không có layout để đo. Trên client vẫn là `useLayoutEffect` — đo trước paint,
// cùng lối `khoi-phuc-cuon.tsx`, để mốc ngắn không nháy nút.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

/** Chiều cao chữ thật. Lớp ngoài có thể đang `max-height`; con đầu không bị kẹp. */
function caoChu(than: HTMLElement): number {
  const noi = than.firstElementChild;
  if (noi instanceof HTMLElement) return noi.offsetHeight;
  return than.scrollHeight;
}

export function VoThuGonMoc({
  seq,
  laMach,
  laBiaMo,
  coPhanAn,
  children,
}: {
  seq: number;
  laMach: boolean;
  /** Bia mộ không accordion — giữ dòng `[mốc đã xoá]` / `[mốc đã bị ẩn]`. */
  laBiaMo: boolean;
  /** Ảnh, snapshot TradingView, hoặc khối trích — CSS giấu khi thu. */
  coPhanAn: boolean;
  children: ReactNode;
}) {
  const { mocDangMo, moMoc, dongMoc } = useMocAccordion();
  const hopRef = useRef<HTMLDivElement>(null);
  const [daDo, setDaDo] = useState(false);
  const [thanTran, setThanTran] = useState(false);

  const luonHienDu = !laMach || seq === 1 || laBiaMo;
  const dangMo = luonHienDu || mocDangMo === seq;

  useIsomorphicLayoutEffect(() => {
    if (luonHienDu) return;
    const hop = hopRef.current;
    if (hop === null) return;
    const than = hop.querySelector<HTMLElement>(`[data-testid="than-moc-${seq}"]`);
    if (than === null) {
      setDaDo(true);
      setThanTran(false);
      return;
    }

    const doLai = () => {
      // Tổ tiên `display: none` (dải gập) báo cao 0. Đừng kết luận là mốc ngắn.
      if (than.getClientRects().length === 0) return;
      setThanTran(caoChu(than) > NGUONG_THAN_PX);
      setDaDo(true);
    };

    doLai();
    const ro = new ResizeObserver(doLai);
    ro.observe(than);
    const noi = than.firstElementChild;
    if (noi instanceof HTMLElement) ro.observe(noi);
    return () => ro.disconnect();
  }, [luonHienDu, seq]);

  if (luonHienDu) {
    return <div className={css.noi}>{children}</div>;
  }

  const hienNut = daDo && hienNutXemThem(thanTran, coPhanAn);
  const lop = dangMo
    ? `${css.noi} ${css.dang_mo}`
    : `${css.noi} ${css.thu_gon}${daDo && thanTran ? ` ${css.kep_than}` : ""}`;

  return (
    <div ref={hopRef} className={lop}>
      {children}
      {hienNut && !dangMo && (
        <div className={css.phu_mo_thu_gon}>
          <button
            type="button"
            className={css.nut_mo_moc}
            onClick={() => moMoc(seq)}
            aria-expanded={false}
            data-testid={`nut-mo-moc-${seq}`}
          >
            <span>Xem thêm</span>
            <span className={css.mui_ten_mo} aria-hidden>
              ▾
            </span>
          </button>
        </div>
      )}
      {hienNut && dangMo && (
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
      )}
    </div>
  );
}
