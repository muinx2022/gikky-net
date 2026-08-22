"use client";

import { useState, type ReactNode } from "react";

import css from "./dai-gap.module.css";

/** Dải gập giữa mặt CẶN — PLAN 5.5, wireframe 9.2:
 *
 *     ▤ Mốc 2–6 · 5 mốc · 43 bình luận
 *       ❝ "DCA lúc này là tự sát" +28 ❞   ← mồi bung
 *
 * Các mốc bị gập **vẫn nằm trong HTML** (truyền qua `children`, chỉ ẩn bằng `hidden`),
 * không phải nạp thêm khi bấm. Mặt CẶN là mặt Google index (PLAN mục 1 — "mạch đã đóng
 * là tư liệu lưu trữ được Google index"); giấu 5 mốc sau một lời gọi fetch là tự cắt đi
 * phần lớn nội dung của chính trang mình muốn được index.
 *
 * Công thức dải gập không nằm ở đây mà ở `lib/dai-gap.ts` — một chỗ định nghĩa duy nhất.
 * Component này chỉ nhận nhãn đã tính sẵn và lo việc bung/gập.
 *
 * **Bung được thì phải gập lại được** (vá C3, 2026-08-22). Bản đầu dùng `datBung(true)`
 * một chiều và `hidden` cả hàng tóm tắt, nên: đọc xong 5 mốc không có đường quay về, và
 * `aria-expanded` nằm trên một nút vừa bị `hidden` — trình đọc màn hình không đọc thuộc
 * tính của phần tử đã ẩn, tức trạng thái "đang mở" không được thông báo cho ai cả. Nay
 * hàng tóm tắt **luôn hiện** và chính nó là công tắc hai chiều; mồi bung là lời quảng
 * cáo nên chỉ có mặt lúc còn gập.
 */
export function DaiGapBung({
  nhan,
  moiBung,
  children,
}: {
  /** Chuỗi `Mốc 2–6 · 5 mốc · 43 bình luận` — đã tính ở tầng trên. */
  nhan: string;
  /** Mồi bung, hoặc `null` khi dải gập không có bình luận nào đủ điều kiện. */
  moiBung: { loi: string; diem: string } | null;
  children: ReactNode;
}) {
  const [bung, datBung] = useState(false);

  return (
    <>
      <li className={css.hang} data-testid="dai-gap">
        <div className={css.ray} />
        <button
          type="button"
          className={css.nut}
          onClick={() => datBung((cu) => !cu)}
          aria-expanded={bung}
          aria-controls="dai-gap-noi-dung"
          data-testid="dai-gap-nut"
        >
          <span className={css.nhan} data-testid="dai-gap-nhan">
            ▤ {nhan}
          </span>
          {!bung && moiBung !== null && (
            <span className={css.moi} data-testid="moi-bung">
              ❝ {moiBung.loi} ❞
              <span className={css.moi_diem} data-testid="moi-bung-diem">
                {moiBung.diem}
              </span>
            </span>
          )}
          <span className={css.chi_bao} data-testid="dai-gap-chi-bao">
            {bung ? "▴ gập lại" : "▾ bung ra"}
          </span>
        </button>
      </li>
      <li id="dai-gap-noi-dung" hidden={!bung} data-testid="dai-gap-noi-dung">
        <ol className={css.trong_gap}>{children}</ol>
      </li>
    </>
  );
}
