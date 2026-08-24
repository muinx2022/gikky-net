"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "./icon";

/** Ngăn kéo trượt từ mép phải — chỗ đứng chung của MỌI form trong khu quản trị.
 *
 * ## Vì sao form rời khỏi chỗ cũ (mở bung tại chỗ, ngay dưới hàng)
 *
 * Form ban cũ chèn một hàng `<tr>` thứ hai vào giữa bảng: mọi hàng bên dưới nhảy xuống,
 * và nếu mod đang cuộn ở giữa bảng thì thứ vừa mở ra nằm ngoài màn hình. Ngăn kéo không
 * đụng vào bố cục bảng — bảng đứng yên, form nằm chồng lên.
 *
 * ## Ba thứ một hộp thoại phải có, và cả ba đều dễ quên
 *
 * 1. **Lối thoát bằng bàn phím** — `Esc`. Một lớp phủ chỉ đóng được bằng chuột là một cái
 *    bẫy cho người dùng bàn phím.
 * 2. **Bẫy focus** — `Tab` không được chạy tiếp vào trang phía sau. Không có nó, người
 *    dùng bàn phím lạc vào một vùng họ không nhìn thấy và không hiểu vì sao gõ không ăn.
 * 3. **Trả focus về chỗ cũ** khi đóng. Thiếu bước này thì focus rơi về `<body>` và lần
 *    `Tab` kế tiếp bắt đầu lại từ đầu trang — mod vừa bấm "Ban…" ở hàng thứ 20 phải đi
 *    lại từ đầu.
 *
 * ## Vì sao có `dang_hien` tách khỏi `mo`
 *
 * Gỡ thẳng khỏi DOM khi `mo` thành `false` là **không có hoạt cảnh đóng** — panel biến
 * mất tức thì. Nên nó ở lại DOM thêm một nhịp: `mo=false` ⇒ `dang_hien=false` (bắt đầu
 * trượt ra) ⇒ hết `THOI_GIAN_TRUOT` mới gỡ.
 *
 * ⚠ Dùng **hẹn giờ**, không dùng `transitionend`. `app/globals.css` tắt sạch transition
 * dưới `prefers-reduced-motion`, và khi đó `transitionend` **không bao giờ bắn** — panel
 * sẽ kẹt lại trong DOM vĩnh viễn, đè lên trang, đúng với người đã tắt hiệu ứng. Một hẹn
 * giờ thì đúng ở cả hai chế độ.
 */

/** Phải khớp `duration-200` của panel bên dưới. Lệch xuống là panel bị gỡ giữa chừng
 *  hoạt cảnh; lệch lên là một khoảng chết sau khi nó đã trượt xong. */
const THOI_GIAN_TRUOT = 200;

export function NganKeo({
  mo,
  dong,
  tieu_de,
  mo_ta,
  children,
}: {
  mo: boolean;
  dong: () => void;
  tieu_de: string;
  mo_ta?: string;
  children: React.ReactNode;
}) {
  const [trong_dom, datTrongDom] = useState(false);
  const [dang_hien, datDangHien] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const focus_cu = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (mo) {
      focus_cu.current = document.activeElement as HTMLElement | null;
      datTrongDom(true);
      // Một nhịp để trình duyệt kịp vẽ panel ở vị trí ngoài màn hình TRƯỚC khi đổi
      // transform — không có nhịp này thì nó xuất hiện luôn ở chỗ cuối, không trượt.
      //
      // ⚠ **rAF một mình là không đủ, và nó hỏng KÍN.** Trình duyệt *dừng hẳn*
      // `requestAnimationFrame` khi trang không vẽ khung hình nào — tab chạy nền, cửa sổ
      // thu nhỏ, hoặc pane ẩn. Lúc đó callback không bao giờ chạy: `dang_hien` kẹt ở
      // `false`, panel nằm nguyên ngoài màn hình, và người dùng thấy **một lớp phủ tối
      // che cả trang mà không có hộp thoại nào** — bấm gì cũng không được ngoài `Esc`.
      // (Bắt được đúng ca này lúc đo bằng trình duyệt thật, 2026-08-23.)
      //
      // `setTimeout` thì bị *giới hạn tần suất* ở tab nền chứ không bị dừng, nên nó vẫn
      // tới. Chạy cả hai: tab đang hiện thì rAF thắng ở ~16ms và có hoạt cảnh; tab ẩn thì
      // hẹn giờ mở panel không hoạt cảnh — đúng thứ cần, vì tab ẩn có hoạt cảnh cũng
      // chẳng ai thấy.
      const khung = requestAnimationFrame(() => datDangHien(true));
      const du_phong = setTimeout(() => datDangHien(true), 50);
      return () => {
        cancelAnimationFrame(khung);
        clearTimeout(du_phong);
      };
    }
    datDangHien(false);
    const id = setTimeout(() => {
      datTrongDom(false);
      focus_cu.current?.focus();
    }, THOI_GIAN_TRUOT);
    return () => clearTimeout(id);
  }, [mo]);

  // Focus vào ô nhập đầu tiên khi mở: mod bấm "Ban…" là để gõ lý do, không phải để bấm
  // thêm một lần nữa vào ô.
  useEffect(() => {
    if (!dang_hien || panel.current === null) return;
    const dau = panel.current.querySelector<HTMLElement>(
      "input:not([type=hidden]), textarea, select",
    );
    (dau ?? panel.current).focus();
  }, [dang_hien]);

  useEffect(() => {
    if (!trong_dom) return;
    const xu_ly = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dong();
        return;
      }
      if (e.key !== "Tab" || panel.current === null) return;
      const duoc = panel.current.querySelectorAll<HTMLElement>(
        "a[href], button:not(:disabled), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
      if (duoc.length === 0) return;
      const dau = duoc[0];
      const cuoi = duoc[duoc.length - 1];
      if (e.shiftKey && document.activeElement === dau) {
        e.preventDefault();
        cuoi.focus();
      } else if (!e.shiftKey && document.activeElement === cuoi) {
        e.preventDefault();
        dau.focus();
      }
    };
    document.addEventListener("keydown", xu_ly);
    return () => document.removeEventListener("keydown", xu_ly);
  }, [trong_dom, dong]);

  if (!trong_dom) return null;

  return (
    <div className="fixed inset-0 z-50" data-testid="ngan-keo">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200
          ${dang_hien ? "opacity-100" : "opacity-0"}`}
        onClick={dong}
        aria-hidden="true"
        data-testid="ngan-keo-lop-phu"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={tieu_de}
        tabIndex={-1}
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l
          border-vien bg-nen shadow-2xl transition-transform duration-200
          ${dang_hien ? "translate-x-0" : "translate-x-full"}`}
        data-testid="ngan-keo-panel"
        data-mo={dang_hien ? "1" : "0"}
      >
        <div className="flex items-start justify-between gap-3 border-b border-vien p-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{tieu_de}</h2>
            {mo_ta !== undefined && (
              <p className="mt-0.5 text-sm text-muc-mo">{mo_ta}</p>
            )}
          </div>
          <button
            type="button"
            className="nut nut-nho shrink-0"
            onClick={dong}
            aria-label="Đóng"
            data-testid="ngan-keo-dong"
          >
            <Icon ten="dong" className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/** Hàng nút cuối form trong ngăn kéo: **Huỷ** bên trái, hành động chính bên phải.
 *
 * Một component riêng chứ không phải hai cái nút chép đi chép lại: thứ tự và nhãn của
 * cặp nút này là một quy ước — ba form đặt "Huỷ" ở ba chỗ khác nhau là ba lần mod phải
 * đọc lại trước khi bấm, trên đúng những màn hình mà bấm nhầm là ban nhầm người.
 */
export function HangNutForm({
  dong,
  nhan_chinh,
  dang_chay,
}: {
  dong: () => void;
  nhan_chinh: string;
  dang_chay: boolean;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2 border-t border-vien pt-4">
      <button type="button" className="nut" onClick={dong} data-testid="nut-huy">
        Huỷ
      </button>
      <button
        type="submit"
        className="nut nut-chinh"
        disabled={dang_chay}
        data-testid="nut-luu"
      >
        {dang_chay ? "Đang lưu…" : nhan_chinh}
      </button>
    </div>
  );
}
