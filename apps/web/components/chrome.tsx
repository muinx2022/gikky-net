import Link from "next/link";

import { Chuong } from "./chuong";
import css from "./chrome.module.css";
import { CongTacTheme } from "./cong-tac-theme";
import { DieuHuongSub } from "./dieu-huong-sub";
import { NutDangMach } from "./nut-dang-mach";
import { ThanhTaiKhoan } from "./thanh-tai-khoan";

/** Thanh trên cùng.
 *
 * **Mọi thứ động ở đây là client component, và đó là một ràng buộc kiến trúc.** Thanh này
 * nằm trong layout gốc ⇒ nó render trên MỌI trang, kể cả `/luat` — trang phải là route
 * TĨNH vì nó là đường thoát của `error.tsx`/`global-error.tsx` (nợ #14 của 1c). Một lời
 * gọi API **ở phía server** tại đây làm `/luat` thành dynamic, tức đường thoát hỏng cùng
 * lúc với thứ nó thoát khỏi; nó cũng bắt `pnpm build` phải có Django sống. `pnpm build`
 * xác nhận `/luat` đang là `○`.
 *
 * Ba thành phần đi theo luật đó: `DieuHuongSub` hỏi `GET /subs`, `ThanhTaiKhoan` +
 * `Chuong` hỏi `GET /me` và `GET /notifications` — tất cả trong `useEffect`.
 *
 * *(2026-08-23)* Nợ `NAV-GHI-CUNG` đã trả: hai slug `chung-khoan`/`crypto` từng được gõ
 * cứng ngay tại đây, nên mở sub thứ ba qua admin là nó vắng mặt trên nav của mọi trang.
 * Giấy miễn trừ ở `e2e/don-vi/khong-ghi-cung-sub.spec.ts::CHUA_CHUYEN_DUOC` xoá cùng lượt.
 */
export function Chrome() {
  return (
    <header className={css.chrome}>
      <div className={css.trong}>
        <Link href="/" className={css.hieu}>
          gikky
        </Link>
        <nav className={css.dieu_huong}>
          <DieuHuongSub />
          {/* `/luat` là link TĨNH và phải ở lại như thế: nó là đường thoát của trang lỗi,
              nên nó không được phụ thuộc vào một lời gọi API vừa hỏng. */}
          <Link href="/luat">Luật</Link>
        </nav>
        {/* Bọc trong một hộp riêng thay vì để ba phần tử rời: `ThanhTaiKhoan` mang sẵn
            `margin-left: auto`, và hai `auto` cùng hàng thì flexbox **chia đôi** khoảng
            trống — nút "Đăng bài" trôi ra giữa thanh. Trong hộp này nó không còn khoảng
            trống nào để chia. */}
        {/* **Chỗ đứng của ô tìm kiếm — Phase 7 (Meilisearch).**

            Cố ý để TRỐNG, không render một ô search chết: một ô nhập không tìm được gì là
            loài lỗi repo này đã đếm nhiều lần ("nút Thử lại" của trang lỗi 1c). Nhưng chỗ
            đứng thì có thật và nó chiếm khoảng giữa của thanh — nhờ vậy lượt gắn ô thật
            vào không phải bố trí lại cả header. Xem
            `plans/2026-08-23-phase-7-tim-kiem-meilisearch.md`. */}
        <div className={css.cho_tim_kiem} aria-hidden />
        <div className={css.phai}>
          <NutDangMach />
          <Chuong />
          <CongTacTheme />
          <ThanhTaiKhoan />
        </div>
      </div>
    </header>
  );
}
