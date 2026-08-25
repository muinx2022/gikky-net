"use client";

import { useCallback, useEffect, useState } from "react";

import {
  KHOA_THEME,
  THEME_MAC_DINH,
  apTheme,
  docLuaChon,
  luuLuaChon,
  type LuaChonTheme,
} from "@/lib/theme";

/** Lựa chọn theme dùng chung cho **hai** control: nút Sáng⇄Tối ở header và ô chọn ba
 * trạng thái ở chân trang.
 *
 * ## Vì sao phải dùng chung — một lỗi đo được, không phải phòng xa
 *
 * Bản đầu của lượt 2026-08-24 cho mỗi control một `useState` riêng, đọc `localStorage`
 * đúng một lần lúc mount. Đo trên trình duyệt: bấm nút ở header ⇒ `localStorage` thành
 * `"toi"`, trang thành tối, mà ô chọn ở chân trang **vẫn hiện "Sáng"**. Hai control nói
 * hai chuyện khác nhau về cùng một trạng thái, và cái sai không có gì báo.
 *
 * ## `<html>` LÀ cái bus, không dựng thêm provider
 *
 * Cả hai control đã cùng gọi `apTheme` — tức cả hai đã cùng ghi lên `data-theme` của
 * `<html>`. Nên chỗ đồng bộ có sẵn rồi: một `MutationObserver` trên đúng thuộc tính ấy,
 * và mỗi lần nó đổi thì đọc lại `localStorage`.
 *
 * Đọc lại **`localStorage`** chứ không suy từ giá trị thuộc tính, vì `data-theme` không
 * phân biệt được `"he"` với một lựa chọn tường minh trùng theme của máy: cả `he` trên máy
 * tối lẫn `toi` đều cho `data-theme="dark"`… không, `he` GỠ thuộc tính. Nhưng suy ngược
 * từ DOM vẫn là dựng bản sao thứ hai của luật `thuocTinhTheme`; `localStorage` là nguồn,
 * đọc thẳng nguồn.
 *
 * Không thêm một `Provider` vào `app/layout.tsx`: layout gốc render trên **mọi** trang kể
 * cả `/luat` (route TĨNH, đường thoát của `error.tsx`), và mỗi provider thêm vào đó là
 * thêm một thứ phải chứng minh là không làm cây route thành dynamic.
 *
 * ## Không đồng bộ giữa các TAB
 *
 * Cố ý. `storage` event chỉ bắn sang tab khác, và xử lý nó tử tế nghĩa là vừa cập nhật
 * control vừa áp lại theme cho tab đang ẩn — nhiều việc cho một tình huống chưa ai gặp.
 * Ghi ra đây để lần sau ai cần thì biết nó là chỗ trống có chủ đích, không phải bỏ sót.
 */
export function useLuaChonTheme(): [LuaChonTheme, (moi: LuaChonTheme) => void] {
  const [chon, datChon] = useState<LuaChonTheme>(THEME_MAC_DINH);

  useEffect(() => {
    const doc = () => {
      try {
        datChon(docLuaChon(window.localStorage.getItem(KHOA_THEME)));
      } catch {
        // Ném khi cookie bị chặn hoàn toàn — cùng lý do với `try` trong script inline.
        datChon(THEME_MAC_DINH);
      }
    };
    doc();

    const goc = document.documentElement;
    const canh = new MutationObserver(doc);
    canh.observe(goc, { attributes: true, attributeFilter: ["data-theme"] });
    return () => canh.disconnect();
  }, []);

  const doi = useCallback((moi: LuaChonTheme) => {
    datChon(moi);
    apTheme(document.documentElement, moi);
    try {
      luuLuaChon(window.localStorage, moi);
    } catch {
      // Không lưu được thì lựa chọn chỉ sống trong tab này. Đúng, và không đáng một câu
      // báo lỗi trên thanh header hay ở chân trang.
    }
  }, []);

  return [chon, doi];
}
