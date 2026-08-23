"use client";

import { useEffect, useState } from "react";

import {
  CAC_THEME,
  KHOA_THEME,
  NHAN_THEME,
  THEME_MAC_DINH,
  apTheme,
  docLuaChon,
  type LuaChonTheme,
} from "@/lib/theme";

import css from "./cong-tac-theme.module.css";

/** Công tắc Sáng / Tối / Theo hệ thống trên thanh trên cùng.
 *
 * ## Nó KHÔNG phải chỗ quyết định theme lúc tải trang
 *
 * Theme lúc tải do **script inline trong `<head>`** quyết (`lib/theme.ts`), chạy trước
 * lần vẽ đầu tiên. Component này chỉ làm hai việc: đọc lại lựa chọn để hiện đúng trạng
 * thái, và ghi lựa chọn mới. Nếu nó cũng gánh việc áp theme lúc tải thì theme sẽ đến sau
 * khi React hydrate — tức sau lần vẽ đầu — và đó chính là cái nháy (FOUC) mà cả cơ chế
 * này sinh ra để tránh.
 *
 * ## Vì sao `useEffect` chứ không đọc `localStorage` khi render
 *
 * Server không có `localStorage`. Đọc nó trong thân component là HTML server sinh ra và
 * HTML client dựng lại khác nhau ⇒ React báo lỗi hydration và **vứt cả cây đi dựng lại**.
 * Nên render đầu luôn là `THEME_MAC_DINH`, rồi `useEffect` sửa. Cái nhảy duy nhất có thể
 * thấy là ô chọn này đổi chữ, không phải cả trang đổi màu.
 *
 * ## `<select>` chứ không ba cái nút
 *
 * Ba nút ăn chỗ ngang của một thanh header vốn còn phải chừa chỗ cho ô tìm kiếm (Phase
 * 7). `<select>` gọn, mở bằng bàn phím và bằng bánh xe gốc của hệ điều hành trên mobile,
 * và có sẵn ngữ nghĩa "chọn một trong nhiều" mà một nhóm `aria-pressed` phải khai bằng
 * tay. Nhãn đi bằng `<label>` thật (ẩn thị giác, không `display:none`) chứ không
 * `aria-label`: `<label for>` là thứ mọi trình đọc màn hình đọc đúng, kể cả bản cũ.
 */
export function CongTacTheme() {
  const [chon, datChon] = useState<LuaChonTheme>(THEME_MAC_DINH);

  useEffect(() => {
    // Ném khi cookie bị chặn hoàn toàn — cùng lý do với `try` trong script inline.
    try {
      datChon(docLuaChon(window.localStorage.getItem(KHOA_THEME)));
    } catch {
      datChon(THEME_MAC_DINH);
    }
  }, []);

  const doi = (moi: LuaChonTheme) => {
    datChon(moi);
    apTheme(document.documentElement, moi);
    try {
      // "Theo hệ thống" **xoá** khoá thay vì ghi `"he"`: người chưa bao giờ bấm và người
      // vừa chọn lại "theo hệ thống" là cùng một trạng thái, và hai cách biểu diễn cho
      // một trạng thái là chỗ hai nhánh code sẽ lệch nhau.
      if (moi === THEME_MAC_DINH) window.localStorage.removeItem(KHOA_THEME);
      else window.localStorage.setItem(KHOA_THEME, moi);
    } catch {
      // Không lưu được thì lựa chọn chỉ sống trong tab này. Đúng, và không đáng một câu
      // báo lỗi trên thanh header.
    }
  };

  return (
    <span className={css.khung}>
      <label className={css.nhan} htmlFor="cong-tac-theme">
        Giao diện
      </label>
      <select
        id="cong-tac-theme"
        className={css.chon}
        value={chon}
        onChange={(e) => doi(e.target.value as LuaChonTheme)}
        data-testid="cong-tac-theme"
      >
        {CAC_THEME.map((t) => (
          <option key={t} value={t}>
            {NHAN_THEME[t]}
          </option>
        ))}
      </select>
    </span>
  );
}
