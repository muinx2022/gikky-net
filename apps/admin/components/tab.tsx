"use client";

import { useId, useRef, useState } from "react";

/** Bộ tab của khu quản trị — dựng 2026-09-04 cho phần chi tiết `/luot-xem`.
 *
 * ## Vì sao có nó, và vì sao KHÔNG kéo thư viện về
 *
 * `/luot-xem` có sáu bảng chi tiết xếp trong một lưới 2 cột: chúng cao thấp so le nên
 * mép dưới răng cưa, và hai cặp cùng chủ đề (Bot theo nhóm / Top bot, Trình duyệt /
 * Thiết bị) bị tách rời nhau bởi một bảng khác. Tab gom lại theo chủ đề mà không bỏ đi
 * một con số nào — đó là lý do user chọn cách này chứ không phải "cho gọn màn hình".
 *
 * Khu quản trị trước lượt này **không có tab nào** (`grep role="tablist"` = 0). Một
 * thư viện tab kéo theo cả cụm phụ thuộc để đổi lấy chừng bảy chục dòng dưới đây; phần
 * khó của tab không nằm ở việc đổi state mà ở khuôn ARIA, và khuôn ấy viết ra được.
 *
 * ## Khuôn WAI-ARIA Tabs — bốn thứ dễ quên, quên cái nào cũng hỏng im
 *
 * 1. **Roving tabindex.** Chỉ tab ĐANG CHỌN có `tabIndex={0}`; các tab kia `-1`. Thiếu
 *    luật này thì `Tab` phải đi qua từng nút một trước khi tới được nội dung — đúng thứ
 *    bàn phím phải chịu mà chuột không bao giờ thấy.
 * 2. **`aria-labelledby` trên panel, và `aria-controls` CHỈ trên tab đang chọn.** Panel
 *    của ba tab kia không nằm trong DOM (xem mục dưới), nên một `aria-controls` trỏ vào
 *    id không tồn tại là con trỏ treo — axe báo `aria-valid-attr-value`, trình đọc màn
 *    hình không nối được gì. APG cho phép bỏ `aria-controls` khi panel vắng mặt; đặt nó
 *    có điều kiện là cách duy nhất để hai quyết định trong file này không mâu thuẫn nhau.
 *    Lượt phản biện 2026-09-04 tìm ra; bản đầu gắn cứng cả bốn.
 * 3. **Phím `←/→` có VÒNG, thêm `Home`/`End`.** `preventDefault` bắt buộc — không có nó
 *    thì `Home`/`End` cuộn cả trang lên/xuống cùng lúc với việc đổi tab.
 * 4. **Focus đi theo lựa chọn** (*automatic activation*) — cả khi đổi bằng PHÍM lẫn bằng
 *    CHUỘT. Vế chuột không thừa: Safari (macOS/iPadOS) **không** focus `<button>` khi
 *    click, nên nếu `onClick` chỉ đổi state thì focus ở lại nút cũ (nay `tabIndex=-1`) và
 *    lần bấm `→` kế tiếp nhảy từ nút cũ, không phải từ nút vừa chọn.
 *
 * ## Chỉ mount panel ĐANG CHỌN — và panel phải có `key`
 *
 * Không mount cả bốn rồi `hidden`: mỗi panel ở đây là một bảng tới 20 dòng, và ba bảng
 * ẩn vẫn nằm trong cây a11y của vài trình duyệt cũ.
 *
 * ⚠ `key={khoa}` trên panel là BẮT BUỘC, không phải trang trí. Không có nó, React
 * reconcile theo vị trí + loại phần tử: hai panel cùng gốc `<The>` + `<KhungBang>` thì
 * DOM được **tái dùng**, và state DOM chảy sang tab kia — cuộn bảng "Xem nhiều nhất" sang
 * phải hết cỡ rồi bấm "Nguồn truy cập" là bảng Nguồn hiện ra đã cuộn sẵn, cột đầu nằm
 * ngoài khung. Với panel có `<input>` thì chữ gõ ở tab A hiện nguyên trong tab B. Bản đầu
 * của file này thiếu `key` mà docstring lại hứa "state mất khi rời tab" — hứa sai theo
 * chiều nguy hiểm; lượt phản biện 2026-09-04 dựng được ca cuộn ở 640px. Có `key`, hợp
 * đồng thật là: **rời tab là panel bị huỷ, quay lại là dựng mới** — state trong panel
 * không sống qua lần đổi tab, và cũng không rò sang panel khác.
 *
 * Cái giá đã chấp nhận (user chọn tab, biết giá): `Ctrl+F` và in trang chỉ thấy panel
 * đang mở — ba bảng kia không nằm trong DOM.
 *
 * ## KHÔNG đồng bộ URL, KHÔNG localStorage
 *
 * Chưa ai xin. Thêm `?tab=` là thêm một nguồn sự thật thứ hai kèm câu hỏi "khoá lạ trong
 * URL thì hiện gì" — trả lời được, nhưng trả lời cho một nhu cầu chưa có.
 */

export type MucTab = {
  /** Khoá máy đọc: đi vào `data-testid` và vào id của cặp tab/panel. Chữ thường + gạch
   *  dưới, cùng lối đặt tên với khoá dữ liệu của trang. */
  khoa: string;
  /** Chữ trên nút. Đổi nhãn không được đổi khoá — bài đo bám theo khoá. */
  nhan: string;
  noi_dung: React.ReactNode;
};

export function KhungTab({
  nhan_nhom,
  khoa_mac_dinh,
  muc,
  chu,
}: {
  /** `aria-label` của `role="tablist"`. Bắt buộc: một trang có thể có hai bộ tab, và
   *  "tablist" trần thì trình đọc màn hình đọc y hệt nhau cả hai. */
  nhan_nhom: string;
  khoa_mac_dinh: string;
  muc: readonly MucTab[];
  /** Dòng chú đứng GIỮA tablist và panel — chỗ dành cho câu áp cho **mọi** tab.
   *
   * Nó là một prop chứ không phải một khối viết ngoài `<Tabs>` vì "ngoài" chỉ có hai
   * chỗ: trên tablist (đọc trước khi biết có tab) hoặc dưới panel (chôn sau 20 dòng
   * bảng, tức không ai đọc). Câu áp cho cả bốn tab phải đứng đúng chỗ ranh giới ấy. */
  chu?: React.ReactNode;
}) {
  const [dang_chon, datDangChon] = useState(khoa_mac_dinh);

  // Tiền tố id ổn định qua SSR. Hai bộ tab trên cùng một trang mà trùng id là
  // `aria-controls` trỏ nhầm panel — hỏng im lặng, chỉ trình đọc màn hình thấy.
  const goc = useId();
  const idTab = (khoa: string) => `tab-${goc}-${khoa}`;
  const idPanel = (khoa: string) => `panel-${goc}-${khoa}`;

  // Focus phải chuyển bằng tay: roving tabindex đổi `tabIndex` của nút cũ về -1, mà đổi
  // `tabIndex` không tự dời focus đang đứng ở đó.
  const nut = useRef(new Map<string, HTMLButtonElement>());

  // ⚠ Không tin thẳng `dang_chon`: `khoa_mac_dinh` gõ sai (hoặc `muc` đổi mà quên đổi
  // khoá) là **không tab nào được chọn và không panel nào hiện** — một khối trắng trông
  // y hệt "chưa có dữ liệu". Rơi về mục đầu là cách tránh khối trắng, nhưng nó IM LẶNG
  // (trông y hệt hoạt động bình thường) — nên kèm một `console.warn` để lỗi gõ nhầm còn
  // có chỗ lộ ra. `muc` rỗng cũng vậy: `null` không cảnh báo là mất cả khối chi tiết mà
  // không ai biết. Lượt phản biện 2026-09-04 chỉ ra bản đầu khai "hỏng TO" — sai.
  const co_khoa = muc.some((m) => m.khoa === dang_chon);
  if (!co_khoa && muc.length > 0) {
    console.warn(`KhungTab "${nhan_nhom}": khoá "${dang_chon}" không có trong muc, rơi về "${muc[0].khoa}".`);
  }
  const chon = co_khoa ? dang_chon : muc[0]?.khoa;
  const dang_mo = muc.find((m) => m.khoa === chon);

  if (dang_mo === undefined) {
    console.warn(`KhungTab "${nhan_nhom}": muc rỗng — không render gì.`);
    return null;
  }

  function diChuyen(e: React.KeyboardEvent, vi_tri: number) {
    const n = muc.length;
    let dich: number;
    switch (e.key) {
      case "ArrowRight":
        dich = (vi_tri + 1) % n;
        break;
      case "ArrowLeft":
        dich = (vi_tri - 1 + n) % n;
        break;
      case "Home":
        dich = 0;
        break;
      case "End":
        dich = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const khoa = muc[dich].khoa;
    datDangChon(khoa);
    nut.current.get(khoa)?.focus();
  }

  return (
    <div>
      {/* Cùng khuôn với bộ chọn khoảng ngay phía trên trang `/luot-xem`: `nut nut-nho`,
          đang chọn thì thêm `nut-chinh`. Hai hàng nút trên một màn hình mà hai kiểu
          khác nhau là mod phải học hai lần cùng một thao tác. */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={nhan_nhom}>
        {muc.map((m, i) => {
          const dang = m.khoa === chon;
          return (
            <button
              key={m.khoa}
              ref={(el) => {
                if (el === null) nut.current.delete(m.khoa);
                else nut.current.set(m.khoa, el);
              }}
              type="button"
              role="tab"
              id={idTab(m.khoa)}
              aria-selected={dang}
              aria-controls={dang ? idPanel(m.khoa) : undefined}
              tabIndex={dang ? 0 : -1}
              className={`nut nut-nho ${dang ? "nut-chinh" : ""}`}
              onClick={() => {
                datDangChon(m.khoa);
                // Safari không tự focus `<button>` khi click — xem mục 4 docstring.
                nut.current.get(m.khoa)?.focus();
              }}
              onKeyDown={(e) => diChuyen(e, i)}
              data-testid={`tab-${m.khoa}`}
            >
              {m.nhan}
            </button>
          );
        })}
      </div>

      {chu !== undefined && <div className="mt-3">{chu}</div>}

      {/* `tabIndex={0}`: panel không có gì focus được (bảng tĩnh) thì bàn phím đi từ
          tablist thẳng qua cả bảng; có nó, `Tab` một nhịp là đứng được TRÊN panel và
          trình đọc màn hình đọc nhãn của nó. ⚠ Nó KHÔNG làm vùng cuộn ngang của bảng
          cuộn được bằng phím — vùng cuộn là `div.overflow-x-auto` bên trong `KhungBang`,
          một con cháu, không phải chính panel (nợ chung của mọi bảng admin, xem sổ).
          `key={khoa}`: xem docstring — thiếu nó là DOM tái dùng chảy sang tab khác. */}
      <div
        key={dang_mo.khoa}
        className="mt-4"
        role="tabpanel"
        id={idPanel(dang_mo.khoa)}
        aria-labelledby={idTab(dang_mo.khoa)}
        tabIndex={0}
        data-testid={`tabpanel-${dang_mo.khoa}`}
      >
        {dang_mo.noi_dung}
      </div>
    </div>
  );
}
