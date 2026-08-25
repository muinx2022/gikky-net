"use client";

import { CAC_THEME, NHAN_THEME, type LuaChonTheme } from "@/lib/theme";

import css from "./chon-giao-dien.module.css";
import { useLuaChonTheme } from "./lua-chon-theme";

/** Ô chọn giao diện **ba trạng thái** ở CHÂN TRANG — Sáng · Tối · Theo hệ thống.
 *
 * ## Vì sao nó tồn tại tách khỏi nút trên header
 *
 * Nút ở header (`cong-tac-theme.tsx`) cố ý chỉ có HAI trạng thái, để mỗi cú bấm luôn đổi
 * được cái gì nhìn thấy được — xem docstring bên đó. Cái giá của quyết định ấy là **"Theo
 * hệ thống" không còn chọn lại được** một khi người ta đã bấm nút một lần: khoá nằm trong
 * `localStorage` và không có cửa nào xoá nó.
 *
 * Mất thứ đó là mất thật, và mất âm thầm — nó chỉ lộ ra vào lúc hệ điều hành tự chuyển
 * sang tối buổi tối mà trang thì vẫn sáng trắng, và người dùng không có cách nào biết vì
 * sao. Nên "Theo hệ thống" **chuyển chỗ chứ không biến mất**; đây là chỗ nó ở.
 *
 * ## Vì sao chân trang chứ không `/cai-dat`
 *
 * Theme là tuỳ chọn của **trình duyệt**, không của tài khoản: nó nằm trong `localStorage`
 * và mỗi máy một kiểu. Đặt nó sau `/cai-dat` là bắt phải đăng nhập mới đổi lại được —
 * mà chính người báo lỗi này **đang chưa đăng nhập**. Chân trang có trên mọi trang, kể cả
 * `/luat` (route tĩnh), nên nó là chỗ duy nhất khách cũng với tới.
 *
 * ## `<select>` ở đây, `<button>` ở kia — cùng một luật ghi
 *
 * Cả hai gọi `luuLuaChon` và `apTheme` của `lib/theme.ts`. Hai control, một luật: "Theo hệ
 * thống" là **xoá khoá**, không phải ghi chuỗi `"he"`. Chép luật ấy ra hai bản là dựng
 * đúng chỗ hai nhánh sẽ lệch nhau.
 *
 * Không đọc `localStorage` lúc render — server không có nó. Xem docstring
 * `cong-tac-theme.tsx`.
 */
export function ChonGiaoDien() {
  // Dùng CHUNG lựa chọn với nút ở header: bấm nút xong mà ô này còn hiện giá trị cũ là
  // lỗi đã đo được một lần rồi — xem `lua-chon-theme.ts`.
  const [chon, doi] = useLuaChonTheme();

  return (
    <div className={css.khung}>
      <label className={css.nhan} htmlFor="chon-giao-dien">
        Giao diện
      </label>
      <select
        id="chon-giao-dien"
        className={css.chon}
        value={chon}
        onChange={(e) => doi(e.target.value as LuaChonTheme)}
        data-testid="chon-giao-dien-select"
      >
        {CAC_THEME.map((t) => (
          <option key={t} value={t}>
            {NHAN_THEME[t]}
          </option>
        ))}
      </select>
    </div>
  );
}
