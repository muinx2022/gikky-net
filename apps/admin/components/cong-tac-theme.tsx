"use client";

import { useEffect, useState } from "react";

import {
  CAC_THEME,
  KHOA_THEME,
  NHAN_THEME,
  THEME_MAC_DINH,
  TRUY_VAN_TOI,
  apTheme,
  docLuaChon,
  giaiTheme,
  type LuaChonTheme,
} from "../lib/theme";

/** Công tắc Sáng / Tối / Theo hệ thống.
 *
 * ## Nó KHÔNG quyết định theme lúc tải trang
 *
 * Theme lúc tải do **script inline trong `<head>`** quyết (`lib/theme.ts`), chạy trước
 * lần vẽ đầu tiên. Component này chỉ đọc lại lựa chọn để hiện đúng trạng thái, và ghi
 * lựa chọn mới. Nếu nó cũng gánh việc áp theme lúc tải thì theme đến sau khi React
 * hydrate — tức sau lần vẽ đầu — và đó chính là cái nháy (FOUC) mà cả cơ chế sinh ra để
 * tránh.
 *
 * ## ⚠ `chon` khởi tạo bằng `null`, KHÔNG bằng `THEME_MAC_DINH` *(vá 2026-08-24)*
 *
 * `null` nghĩa là **chưa đọc xong `localStorage`**, và nó phải phân biệt được với "đã
 * đọc, kết quả là theo hệ thống". Bản trước dùng chung một giá trị cho hai trạng thái ấy,
 * và đó là một lỗi thật, người dùng bắt được: *"chọn theme sáng, F5, lại quay về dark"*.
 *
 * Diễn biến, tất cả nằm trong một lần vẽ:
 *
 * 1. script inline đọc `localStorage` → `data-theme="sang"`. **Đúng.**
 * 2. React vẽ lần đầu với `chon = "he"` (giá trị khởi tạo).
 * 3. effect đọc `localStorage` gọi `datChon("sang")` — nhưng `setState` không đổi biến
 *    `chon` của lượt vẽ này, nó chỉ hẹn một lượt vẽ sau.
 * 4. effect theo dõi hệ thống chạy **cùng lượt đó**, closure của nó vẫn thấy `chon = "he"`
 *    ⇒ nó áp theme của hệ điều hành ⇒ **`data-theme="toi"`, đè mất bước 1.**
 * 5. lượt vẽ sau, `chon = "sang"`, effect ấy chạy lại và `return` ngay ở dòng đầu —
 *    **không khôi phục gì cả.** Trang đứng ở "toi" cho tới lần bấm công tắc tiếp theo.
 *
 * Với `null`, bước 4 rơi vào cùng nhánh `return` sớm nên không có gì bị đè, và listener
 * chỉ gắn sau khi lựa chọn thật đã biết.
 *
 * Docstring ngay trên kia — *"Nó KHÔNG quyết định theme lúc tải trang"* — là **đúng ý
 * định và sai thực tế** suốt thời gian lỗi này sống. Đó là khuôn mẫu số 2 trong
 * `LOI-VA-NO.md`: *chữ khẳng định mạnh hơn thứ code làm*.
 *
 * ## `useEffect` chứ không đọc `localStorage` khi render
 *
 * Server không có `localStorage`. Đọc nó trong thân component là HTML server sinh ra và
 * HTML client dựng lại khác nhau ⇒ React vứt cả cây đi dựng lại. Nên render đầu luôn là
 * `null` (hiện ra thành `THEME_MAC_DINH`), rồi `useEffect` sửa. Cái nhảy duy nhất thấy
 * được là ô chọn này đổi chữ, không phải cả trang đổi màu.
 *
 * ## Vì sao phải nghe `matchMedia`
 *
 * Khu quản trị giải "theo hệ thống" thành một giá trị cụ thể ngay lúc tải, nên CSS không
 * còn nhánh `prefers-color-scheme` nào để tự đổi theo (xem docstring `lib/theme.ts`).
 * Đổi lại, khi người dùng đang ở "theo hệ thống" mà đổi theme của **hệ điều hành**, chỉ
 * listener này làm trang đổi theo. Bỏ nó đi thì công tắc vẫn chạy, ba nhãn vẫn đúng, và
 * lỗi chỉ lộ ra ở đúng người để máy tự chuyển tối lúc hoàng hôn.
 */
export function CongTacTheme() {
  /** `null` = chưa đọc `localStorage` xong. Xem docstring — trạng thái này KHÔNG được
   * gộp với `"he"`, gộp lại là dựng lại đúng lỗi đè theme lúc tải. */
  const [chon, datChon] = useState<LuaChonTheme | null>(null);

  useEffect(() => {
    // Ném khi cookie bị chặn hoàn toàn — cùng lý do với `try` trong script inline.
    try {
      datChon(docLuaChon(window.localStorage.getItem(KHOA_THEME)));
    } catch {
      datChon(THEME_MAC_DINH);
    }
  }, []);

  useEffect(() => {
    // `null` (chưa đọc xong) rơi vào đây cùng với mọi lựa chọn tường minh: chưa biết
    // người dùng chọn gì thì **không được đụng** `data-theme` — script inline đã đặt
    // đúng rồi.
    if (chon !== "he") return;
    const mq = window.matchMedia(TRUY_VAN_TOI);
    const theo = () => apTheme(document.documentElement, giaiTheme("he", mq.matches));
    theo();
    mq.addEventListener("change", theo);
    return () => mq.removeEventListener("change", theo);
  }, [chon]);

  const doi = (moi: LuaChonTheme) => {
    datChon(moi);
    apTheme(
      document.documentElement,
      giaiTheme(moi, window.matchMedia(TRUY_VAN_TOI).matches),
    );
    try {
      // "Theo hệ thống" **xoá** khoá thay vì ghi `"he"`: người chưa bao giờ bấm và người
      // vừa chọn lại "theo hệ thống" là cùng một trạng thái, và hai cách biểu diễn cho
      // một trạng thái là chỗ hai nhánh code sẽ lệch nhau.
      if (moi === THEME_MAC_DINH) window.localStorage.removeItem(KHOA_THEME);
      else window.localStorage.setItem(KHOA_THEME, moi);
    } catch {
      // Không lưu được thì lựa chọn chỉ sống trong tab này. Đúng, và không đáng một câu
      // báo lỗi trên thanh trên.
    }
  };

  return (
    <>
      <label className="sr-only" htmlFor="cong-tac-theme">
        Giao diện
      </label>
      <select
        id="cong-tac-theme"
        className="nut cursor-pointer pr-2 text-xs"
        value={chon ?? THEME_MAC_DINH}
        onChange={(e) => doi(e.target.value as LuaChonTheme)}
        data-testid="cong-tac-theme"
      >
        {CAC_THEME.map((t) => (
          <option key={t} value={t}>
            {NHAN_THEME[t]}
          </option>
        ))}
      </select>
    </>
  );
}
