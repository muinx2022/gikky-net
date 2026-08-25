"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { mucTieuCongTac } from "@/lib/theme";

import css from "./cong-tac-theme.module.css";
import { useLuaChonTheme } from "./lua-chon-theme";

/** Công tắc **Sáng ⇄ Tối** trên thanh trên cùng — nút hai trạng thái (user chốt
 * 2026-08-24, thay ô chọn ba trạng thái).
 *
 * ## Vì sao bỏ ô chọn ba trạng thái
 *
 * User báo *"chưa đăng nhập không chọn được theme"*. Đo trên `gikky.net` ở trạng thái
 * khách thì công tắc **chạy đúng**: `data-theme` đổi, `localStorage` ghi, sống qua F5.
 * Cái sai nằm ở chỗ khác và nó có thật: mặc định là "Theo hệ thống", máy người đo đang
 * để tối, nên bấm **"Tối"** đổi thuộc tính mà **không đổi một pixel nào** — nền trước và
 * sau đều `rgb(14,17,22)`. Một control không phản hồi thì không phân biệt được với một
 * control hỏng, và người dùng kết luận đúng thứ họ thấy.
 *
 * ⇒ Nút này luôn đặt lựa chọn **NGƯỢC với thứ đang hiện** (`mucTieuCongTac`), nên **mỗi
 * cú bấm luôn đổi được cái gì đó nhìn thấy được**. Không còn nước đi nào là no-op.
 *
 * ## "Theo hệ thống" đi đâu
 *
 * Vẫn là **mặc định** của người chưa bấm bao giờ (khoá vắng mặt trong `localStorage`), và
 * vẫn chọn lại được ở `/cai-dat` → `components/chon-giao-dien.tsx`. Bỏ hẳn nó là lấy mất
 * của người dùng khả năng để trang đi theo lịch sáng/tối của hệ điều hành — một mất mát
 * âm thầm mà không ai báo lỗi được, vì nó chỉ lộ ra vào lúc trời tối.
 *
 * ## Icon là ĐÍCH, không phải trạng thái hiện tại
 *
 * Đang tối ⇒ hiện mặt trời + nhãn "Chuyển sang giao diện sáng". Icon, `title` và
 * `aria-label` **cùng nói một câu**. Lối ngược lại (icon = trạng thái đang bật) làm icon
 * và nhãn nói hai chuyện khác nhau trên cùng một nút. Trạng thái đang bật thì cả trang
 * đang nói rồi — không cần một cái icon 16px nhắc lại.
 *
 * ## Nó KHÔNG phải chỗ quyết định theme lúc tải trang
 *
 * Theme lúc tải do **script inline trong `<head>`** quyết (`lib/theme.ts`), chạy trước
 * lần vẽ đầu. Component này chỉ đọc lại lựa chọn để hiện đúng đích, và ghi lựa chọn mới.
 * Gánh cả việc áp theme lúc tải thì theme đến sau khi React hydrate — tức đúng cái nháy
 * (FOUC) mà cả cơ chế này sinh ra để tránh.
 *
 * ## `useEffect` chứ không đọc lúc render
 *
 * Server không có `localStorage` lẫn `matchMedia`. Đọc chúng trong thân component là HTML
 * server sinh ra khác HTML client dựng lại ⇒ React vứt cả cây đi dựng lại. Nên render đầu
 * luôn là mặc định, rồi `useEffect` sửa. Cái nhảy duy nhất thấy được là **icon 16px** đổi
 * hình, không phải cả trang đổi màu.
 */
export function CongTacTheme() {
  // Lựa chọn dùng CHUNG với ô chọn ở chân trang — xem `lua-chon-theme.ts`. Hai bản state
  // riêng là hai control nói hai chuyện khác nhau về cùng một trạng thái.
  const [chon, doiChon] = useLuaChonTheme();
  const [heToi, datHeToi] = useState(false);

  useEffect(() => {
    // **Phải THEO DÕI, không chỉ đọc một lần.** Người đang ở "theo hệ thống" mà máy tự
    // đổi sang tối lúc hoàng hôn thì trang đổi theo (CSS lo việc đó), nhưng đích của nút
    // này cũng phải đổi theo — nếu không nó vẫn ghi "Chuyển sang tối" trong khi trang đã
    // tối, và cú bấm kế tiếp thành no-op: đúng lại cái lỗi lượt này đang vá.
    const truy_van = window.matchMedia("(prefers-color-scheme: dark)");
    datHeToi(truy_van.matches);
    const nghe = (e: MediaQueryListEvent) => datHeToi(e.matches);
    truy_van.addEventListener("change", nghe);
    return () => truy_van.removeEventListener("change", nghe);
  }, []);

  const muc_tieu = mucTieuCongTac(chon, heToi);

  const Hinh = muc_tieu === "toi" ? Moon : Sun;
  const nhan = muc_tieu === "toi" ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng";

  return (
    <button
      type="button"
      className={css.khung}
      onClick={() => doiChon(muc_tieu)}
      title={nhan}
      aria-label={nhan}
      // Đích của cú bấm kế tiếp, cho bài đo đọc. Trạng thái ĐANG bật thì đọc `data-theme`
      // trên `<html>` — không nhân đôi nó ra đây thành nguồn sự thật thứ hai.
      data-muc-tieu={muc_tieu}
      data-testid="cong-tac-theme"
    >
      <Hinh className={css.hinh} size={16} strokeWidth={1.9} aria-hidden />
    </button>
  );
}
