"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { mucTieuCongTac } from "@/lib/theme";

import css from "./cong-tac-theme.module.css";
import { useLuaChonTheme } from "./lua-chon-theme";

/** Công tắc **Sáng ⇄ Tối** trên thanh trên cùng — nút hai trạng thái.
 *
 * Luôn đặt lựa chọn NGƯỢC với thứ đang hiện (`mucTieuCongTac`), nên mỗi cú bấm
 * luôn đổi được cái nhìn thấy được (không bao giờ no-op).
 *
 * Hoạt động tốt cho cả khách chưa đăng nhập lẫn thành viên đã đăng nhập.
 */
export function CongTacTheme() {
  const [chon, doiChon] = useLuaChonTheme();
  const [heToi, datHeToi] = useState(false);

  useEffect(() => {
    const truy_van = window.matchMedia("(prefers-color-scheme: dark)");
    datHeToi(truy_van.matches);
    const nghe = (e: MediaQueryListEvent) => datHeToi(e.matches);
    truy_van.addEventListener("change", nghe);
    return () => truy_van.removeEventListener("change", nghe);
  }, []);

  const muc_tieu = mucTieuCongTac(chon, heToi);
  const nhan = muc_tieu === "toi" ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng";

  return (
    <button
      type="button"
      className={css.khung}
      onClick={() => doiChon(muc_tieu)}
      title={nhan}
      aria-label={nhan}
      data-muc-tieu={muc_tieu}
      data-testid="cong-tac-theme"
    >
      <Moon className={`${css.hinh} ${css.icon_trang}`} size={16} strokeWidth={1.9} aria-hidden />
      <Sun className={`${css.hinh} ${css.icon_troi}`} size={16} strokeWidth={1.9} aria-hidden />
    </button>
  );
}
