"use client";

import { useState } from "react";

import css from "./gap-nhanh.module.css";

/** Nút `[−]` / `[+]` gập một nhánh bình luận — plan con 1d §2.5.5.
 *
 * Cơ chế Reddit đúng nghĩa: bấm `[−]` là cả bình luận (thân + mọi nhánh con) thu về một
 * dòng tóm tắt, bấm `[+]` mở lại. Nó là thứ làm một cây 24 bình luận đọc được trên điện
 * thoại — không có nó thì cách duy nhất bỏ qua một thread là cuộn.
 *
 * **Nội dung luôn nằm trong HTML, chỉ bị `hidden`** — cùng cách `KhungNganKeo` làm, và vì
 * cùng lý do: mặt CẶN là mặt để Google index (PLAN mục 1), giấu nội dung sau một lần
 * render phía client là tự bịt mắt con bot. `children` do server dựng sẵn, client chỉ
 * bật/tắt.
 *
 * Trạng thái nằm ở TỪNG nút (`useState` cục bộ), khác hẳn ngăn kéo: ngăn kéo là accordion
 * "mở cái này thì đóng cái kia" (PLAN 5.4 luật 1) nên nó cần context dùng chung; gập
 * nhánh thì phải gập được nhiều nhánh cùng lúc, đó chính là công dụng của nó.
 *
 * ⚠ **Mặc định MỞ, không nhớ lựa chọn.** Bình luận điểm ≤ −5 đã có cơ chế tự gập riêng do
 * SERVER quyết (`tu_gap`, PLAN 5.3) và nó dùng `<details>`; hai cơ chế không được chồng
 * nhau — cái này là lựa chọn của người đọc, cái kia là lựa chọn của luật.
 */
export function GapNhanh({
  tomTat,
  children,
}: {
  /** Dòng hiện ra khi đã gập: ai viết, còn bao nhiêu nhánh bên dưới. */
  tomTat: string;
  children: React.ReactNode;
}) {
  const [gap, datGap] = useState(false);
  return (
    <div className={css.khung} data-gap={gap ? "1" : "0"}>
      <button
        type="button"
        className={css.nut}
        aria-expanded={!gap}
        onClick={() => datGap((cu) => !cu)}
        data-testid="nut-gap-nhanh"
        // Nhãn nói ra việc SẼ làm, không nói trạng thái: `[−]` một mình thì trình đọc màn
        // hình phát ra "dấu trừ".
        aria-label={gap ? `Mở lại: ${tomTat}` : `Gập nhánh: ${tomTat}`}
      >
        {gap ? "[+]" : "[−]"}
      </button>
      {gap && (
        <span className={css.tom_tat} data-testid="tom-tat-nhanh">
          {tomTat}
        </span>
      )}
      <div className={css.than} hidden={gap} data-testid="than-nhanh">
        {children}
      </div>
    </div>
  );
}
