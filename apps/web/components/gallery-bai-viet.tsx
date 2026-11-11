"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import css from "./gallery-bai-viet.module.css";

/** Khung lật từng ảnh của hàng bài viết ở trang chủ (kiểu gallery trong feed Reddit) —
 * `plans/2026-11-10-gallery-kieu-reddit.md`.
 *
 * ## Component client này CHỈ lo phần tương tác
 *
 * Nút trước / sau, bộ đếm `n/N`, cuộn mượt, và nạp sớm ảnh. **Slide là `children` do server
 * dựng** (`khoi-bai-viet.tsx`): mọi `<img>` có trong HTML thô cho bot, cùng một HTML cho mọi
 * User-Agent. Bản "client tự map ảnh" sẽ cho bot một khung rỗng. Vuốt trên cảm ứng và cuộn
 * ngang bằng trackpad chạy nhờ `scroll-snap` của CSS — không cần JS; JS tắt thì còn nguyên
 * khung + ảnh, chỉ mất nút và bộ đếm.
 *
 * ## Nút mũi tên là anh em của track, KHÔNG nằm trong link ảnh
 *
 * Bấm nút lật ảnh; bấm ảnh mở bài. Nút nằm trong link ảnh thì mọi lần lật là một lần điều hướng.
 *
 * ## Nạp ảnh
 *
 * Mọi `<img>` của slide là `loading="lazy"` (slide nằm ngoài khung ngang không bị tải khi
 * trang vừa mở). Lần đầu con trỏ / ngón tay / focus vào khung thì ta đặt `loading="eager"`
 * cho mọi `<img>` để slide kế tiếp không trắng khi lật. Đặt bằng DOM chứ không bằng state:
 * `children` là phần tử server dựng sẵn, React không dựng lại chúng.
 */
export function GalleryBaiViet({
  children,
  tieuDe,
  soAnh,
  soSlideAnh,
  coXemHet,
  tyLe,
}: {
  /** Các `<li>` slide: `soSlideAnh` slide ảnh, rồi (nếu `coXemHet`) một slide "Xem tất cả". */
  children: ReactNode;
  tieuDe: string;
  /** Tổng số ảnh THẬT của mốc (`so_anh` của API) — mẫu số của bộ đếm. */
  soAnh: number;
  /** Số slide là ảnh (không tính slide "Xem tất cả"). */
  soSlideAnh: number;
  coXemHet: boolean;
  /** Tỉ lệ khung (rộng / cao), từ ảnh đầu, đã kẹp — `tyLeKhungGallery`. */
  tyLe: number;
}) {
  const track = useRef<HTMLUListElement>(null);
  const truoc = useRef<HTMLButtonElement>(null);
  const sau = useRef<HTMLButtonElement>(null);
  const khungHinh = useRef<number | null>(null);
  const daNapSom = useRef(false);
  // Nút vừa MẤT focus vì bị ẩn (`hidden`): "truoc" | "sau". Xem `khiNutMatFocus`.
  const nutMatFocus = useRef<"truoc" | "sau" | null>(null);
  // Chỉ số slide ĐÍCH của lần cuộn mượt đang chạy dở (`null` = đứng yên / người dùng đang tự
  // cuộn). Bấm dồn / giữ phím mũi tên mà tính đích từ `scrollLeft` đang chạy dở thì lần bấm kế
  // trong lúc animation chưa quá nửa slide ra đúng đích cũ và bị nuốt (đã đo: 3 lần bấm ⇒ slide 1-2).
  const dichDen = useRef<number | null>(null);
  const henXongCuon = useRef<number | null>(null);
  const [chi, datChi] = useState(0);
  const soSlide = soSlideAnh + (coXemHet ? 1 : 0);
  // Nút và bộ đếm chỉ HIỆN sau hydrate: SSR vẫn có chúng trong HTML (ở trạng thái `hidden`) nhưng
  // chưa có handler — tắt JS / chưa hydrate mà hiện thì bấm vô tác dụng. `useSyncExternalStore`
  // trả `false` ở server và ở lượt render hydrate đầu (không lệch markup), `true` ngay sau đó.
  const daNap = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Slide đang nằm trong khung = slide có phần lớn bề rộng thấy được — hoặc slide ĐÍCH khi đang
  // cuộn mượt tới đó (bộ đếm và nút không nháy qua các slide trung gian).
  const docChi = useCallback(() => {
    const el = track.current;
    if (el === null) return;
    const roi = dichDen.current ?? Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    datChi(Math.min(soSlide - 1, Math.max(0, roi)));
  }, [soSlide]);

  // Hết lần cuộn do `lat` gây ra: quay về đo vị trí thật.
  const xongCuon = useCallback(() => {
    if (henXongCuon.current !== null) clearTimeout(henXongCuon.current);
    henXongCuon.current = null;
    dichDen.current = null;
    docChi();
  }, [docChi]);

  // Dự phòng cho trình duyệt chưa có `scrollend`, và cho lần `lat` không cuộn gì (đã ở đích):
  // 150ms không còn sự kiện cuộn nào thì coi như xong.
  const henLai = useCallback(() => {
    if (henXongCuon.current !== null) clearTimeout(henXongCuon.current);
    henXongCuon.current = window.setTimeout(xongCuon, 150);
  }, [xongCuon]);

  useEffect(() => {
    const el = track.current;
    docChi();
    // `scrollend` có thể bắn khi một lần cuộn bị lần cuộn mới thay thế: chỉ tin nó khi đã tới đích.
    const khiScrollEnd = () => {
      const d = dichDen.current;
      if (d === null || (el !== null && Math.abs(el.scrollLeft - d * el.clientWidth) <= 2)) xongCuon();
    };
    window.addEventListener("resize", docChi);
    el?.addEventListener("scrollend", khiScrollEnd);
    return () => {
      window.removeEventListener("resize", docChi);
      el?.removeEventListener("scrollend", khiScrollEnd);
      if (khungHinh.current !== null) cancelAnimationFrame(khungHinh.current);
      // Đặt lại `null`: nếu không, rAF bị huỷ ở đây để lại cờ "đang chờ" và `khiCuon` return sớm
      // vĩnh viễn (bộ đếm đứng im) khi `soSlide` đổi giữa lúc có rAF chờ.
      khungHinh.current = null;
      if (henXongCuon.current !== null) clearTimeout(henXongCuon.current);
      henXongCuon.current = null;
    };
  }, [docChi, xongCuon]);

  // Cuộn mượt bắn `scroll` theo từng khung hình: gộp lại, mỗi khung hình đọc vị trí một lần.
  const khiCuon = () => {
    if (dichDen.current !== null) henLai();
    if (khungHinh.current !== null) return;
    khungHinh.current = requestAnimationFrame(() => {
      khungHinh.current = null;
      docChi();
    });
  };

  // Người dùng tự cuộn / chạm / bấm vào track: huỷ "đích" của lần lật trước, đo lại từ vị trí thật.
  const huyDichDen = () => {
    if (dichDen.current !== null) xongCuon();
  };

  const napSom = () => {
    if (daNapSom.current) return;
    daNapSom.current = true;
    track.current
      ?.querySelectorAll<HTMLImageElement>("img")
      .forEach((img) => (img.loading = "eager"));
  };

  const lat = (huong: -1 | 1) => {
    const el = track.current;
    if (el === null) return;
    const rong = Math.max(1, el.clientWidth);
    // Đang cuộn mượt thì cộng dồn vào ĐÍCH đang chạy; đứng yên thì tính từ vị trí đo được.
    const goc = dichDen.current ?? Math.round(el.scrollLeft / rong);
    const dich = Math.min(soSlide - 1, Math.max(0, goc + huong));
    dichDen.current = dich;
    datChi(dich);
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: dich * rong, behavior: giamChuyenDong ? "auto" : "smooth" });
    henLai();
  };

  // Mũi tên trái / phải khi focus ở track (hoặc link trong nó) cũng lật slide, như nút.
  const khiNhanPhim = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      lat(e.key === "ArrowRight" ? 1 : -1);
    }
  };

  // Nút đang giữ focus mà vừa tới cuối / đầu thì nó ẩn (`hidden`) và focus rơi về <body>: chuyển
  // focus sang nút còn lại. Ba điều đã đo được ở Chromium:
  // 1. Chuyển focus ngay lúc bấm vô tác dụng — nút đích còn `hidden` (hàng chỉ 2 slide: nút
  //    trước đang ẩn). Phải làm SAU khi trạng thái mới đã render;
  // 2. Trình duyệt bỏ focus của nút NGAY khi thuộc tính `hidden` được gán (focusout bắn đồng bộ
  //    giữa lúc React commit), tức TRƯỚC `useLayoutEffect` — `document.activeElement` lúc đó đã là
  //    <body>;
  // 3. `onBlur` của React KHÔNG nhận sự kiện đó (đã thử: handler không chạy) — phải là
  //    `addEventListener("focusout")` gốc.
  // Nên ghi nhớ nút nào vừa mất focus vì bị ẩn, rồi trả focus cho nút còn lại trong
  // `useLayoutEffect`, khi cả hai nút đã ở trạng thái mới.
  useEffect(() => {
    const nutTruoc = truoc.current;
    const nutSau = sau.current;
    if (nutTruoc === null || nutSau === null) return;
    const matTruoc = () => {
      if (nutTruoc.hidden) nutMatFocus.current = "truoc";
    };
    const matSau = () => {
      if (nutSau.hidden) nutMatFocus.current = "sau";
    };
    nutTruoc.addEventListener("focusout", matTruoc);
    nutSau.addEventListener("focusout", matSau);
    return () => {
      nutTruoc.removeEventListener("focusout", matTruoc);
      nutSau.removeEventListener("focusout", matSau);
    };
  }, []);
  useLayoutEffect(() => {
    const mat = nutMatFocus.current;
    nutMatFocus.current = null;
    const dangFocus = document.activeElement;
    if (mat === "sau" || (chi === soSlide - 1 && dangFocus === sau.current)) truoc.current?.focus();
    else if (mat === "truoc" || (chi === 0 && dangFocus === truoc.current)) sau.current?.focus();
  }, [chi, soSlide]);

  // Link "Xem tất cả" chỉ nằm trong thứ tự Tab khi slide của nó đang hiện: bản luôn tab được làm
  // phím Tab đầu tiên của hàng nhảy thẳng tới slide cuối (trình duyệt tự cuộn tới phần tử được
  // focus) và bỏ qua mọi ảnh. Vẫn là link thật cho trình đọc màn hình và bot (không aria-hidden).
  useLayoutEffect(() => {
    if (!coXemHet) return;
    const lienKet = track.current?.querySelector<HTMLAnchorElement>(
      '[data-testid="bai-viet-gallery-xem-het"] a',
    );
    if (lienKet) lienKet.tabIndex = chi === soSlide - 1 ? 0 : -1;
  }, [chi, coXemHet, soSlide]);

  const dangOXemHet = coXemHet && chi === soSlide - 1;

  return (
    <div
      className={css.gallery}
      style={{ "--ty-le": tyLe } as CSSProperties}
      role="group"
      aria-roledescription="carousel"
      aria-label={`Ảnh của bài: ${tieuDe}`}
      data-testid="bai-viet-gallery"
      data-so-anh={soAnh}
      data-so-slide={soSlide}
      onPointerEnter={napSom}
      onTouchStart={napSom}
      onFocus={napSom}
    >
      {/* `tabIndex={0}`: track là điểm dừng Tab CÓ CHỦ Ý (không dựa vào việc trình duyệt tự cho
          vùng cuộn nhận focus — Chromium bỏ điều đó khi trong track có link), để bàn phím dùng
          ←/→ lật ảnh. Tên truy cập là `aria-label` bên dưới; viền focus vẽ bên TRONG khung (css). */}
      <ul
        className={css.track}
        ref={track}
        tabIndex={0}
        aria-label="Ảnh của bài, dùng phím mũi tên trái phải để chuyển ảnh"
        onScroll={khiCuon}
        onWheel={huyDichDen}
        onTouchStart={huyDichDen}
        onPointerDown={huyDichDen}
        onKeyDown={khiNhanPhim}
        data-testid="bai-viet-gallery-track"
      >
        {children}
      </ul>
      <button
        type="button"
        ref={truoc}
        className={`${css.nut} ${css.nut_truoc}`}
        aria-label="Ảnh trước"
        hidden={!daNap || chi === 0}
        onClick={() => lat(-1)}
        data-testid="bai-viet-gallery-truoc"
      >
        <MuiTen huong="truoc" />
      </button>
      <button
        type="button"
        ref={sau}
        className={`${css.nut} ${css.nut_sau}`}
        aria-label="Ảnh sau"
        hidden={!daNap || chi === soSlide - 1}
        onClick={() => lat(1)}
        data-testid="bai-viet-gallery-sau"
      >
        <MuiTen huong="sau" />
      </button>
      {/* Vùng live luôn có mặt trong DOM (chỉ ruột đổi) để trình đọc màn hình đăng ký nó từ đầu. */}
      <div className={css.bo_dem} aria-live="polite" hidden={!daNap || dangOXemHet}>
        <span aria-hidden="true" data-testid="bai-viet-gallery-dem">
          {chi + 1}/{soAnh}
        </span>
        <span className={css.chi_doc_man_hinh}>
          Ảnh {chi + 1} trên {soAnh}
        </span>
      </div>
    </div>
  );
}

function MuiTen({ huong }: { huong: "truoc" | "sau" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={huong === "truoc" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}
