import type { MucLucItem } from "@/lib/muc-luc";
import { AlignLeft } from "lucide-react";

import css from "./muc-luc.module.css";

export type MucLucHienThiItem = MucLucItem & {
  so?: string;
  tieuDeHienThi: string;
};

// Regex bắt các dạng tiền tố số thông dụng của tác giả:
// Ví dụ: "1.", "2.1.", "2.1", "1)", "I.", "A."
export const RE_TIEN_TO_SO =
  /^(\d{1,2}(?:\.\d+)*(?:\.|\))?|[A-Z]\.|\b(?:[IVXLCDM]+)\.)\s+(.+)$/;

/** Chuẩn hoá danh sách mục lục:
 * - Nếu tác giả đã tự đánh số (kể cả 1 phần): bóc tách tiền tố số của tác giả, không tự động sinh số đè lên.
 * - Nếu tác giả không đánh số bất kỳ mục nào: tự động sinh số thứ tự phân cấp (1., 1.1., 1.2., 2., 2.1.).
 */
export function chuanHoaMucLuc(
  danhSach: readonly MucLucItem[],
): MucLucHienThiItem[] {
  const coTienToTacGia = danhSach.some((m) =>
    RE_TIEN_TO_SO.test(m.tieuDe.trim()),
  );

  if (coTienToTacGia) {
    return danhSach.map((item) => {
      const match = item.tieuDe.trim().match(RE_TIEN_TO_SO);
      if (match) {
        let tienTo = match[1];
        if (!/[.)]$/.test(tienTo)) {
          tienTo = `${tienTo}.`;
        }
        return {
          ...item,
          so: tienTo,
          tieuDeHienThi: match[2].trim(),
        };
      }
      return {
        ...item,
        so: undefined,
        tieuDeHienThi: item.tieuDe,
      };
    });
  }

  let demH2 = 0;
  let demH3 = 0;
  return danhSach.map((item) => {
    let so: string;
    if (item.cap === 2) {
      demH2 += 1;
      demH3 = 0;
      so = `${demH2}.`;
    } else {
      demH3 += 1;
      so = demH2 > 0 ? `${demH2}.${demH3}.` : `${demH3}.`;
    }
    return {
      ...item,
      so,
      tieuDeHienThi: item.tieuDe,
    };
  });
}

/** Mục lục nội dung bài viết (Table of Contents) — kích hoạt Jump to section trên Google SERP.
 *
 * Tự động trích xuất từ các thẻ `<h2>` và `<h3>` của bài viết dài.
 * Dùng thẻ `<details open>` chuẩn HTML, hoạt động hoàn hảo cả khi không có JS.
 */
export function MucLuc({ danhSach }: { danhSach: readonly MucLucItem[] }) {
  if (danhSach.length < 2) return null;

  const items = chuanHoaMucLuc(danhSach);

  return (
    <nav className={css.khung} aria-label="Mục lục bài viết" data-testid="muc-luc">
      <details open className={css.details}>
        <summary className={css.summary}>
          <span className={css.tieu_de}>
            <AlignLeft size={15} strokeWidth={2} aria-hidden />
            <span>Mục lục nội dung</span>
          </span>
        </summary>
        <ol className={css.danh_sach}>
          {items.map((item) => (
            <li
              key={item.id}
              className={item.cap === 3 ? `${css.muc} ${css.cap_3}` : css.muc}
            >
              <a href={`#${item.id}`} className={css.link}>
                {item.so && <span className={css.so}>{item.so}</span>}
                <span className={css.chu}>{item.tieuDeHienThi}</span>
              </a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
