import Link from "next/link";
import { Suspense } from "react";

import { Chuong } from "./chuong";
import css from "./chrome.module.css";
import { CongTacTheme } from "./cong-tac-theme";
import { DieuHuongSub } from "./dieu-huong-sub";
import { NutDangMach } from "./nut-dang-mach";
import { OTimKiem } from "./o-tim-kiem";
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
        {/* `OTimKiem` đọc `useSearchParams` để giữ lại câu vừa gõ khi bấm back. Hook đó
            **bắt buộc phải nằm trong `Suspense`**, nếu không Next từ chối render tĩnh
            **mọi** trang mang layout này — và `/luat` phải giữ `○`, vì nó là đường thoát
            của `error.tsx` (nợ #14 của 1c). Với biên này, phần còn lại của trang vẫn
            tĩnh; chỉ riêng ô nhập hoàn tất ở client.
            `fallback` là một hộp rỗng cùng kích thước, không phải `null`: `null` làm thanh
            trên cùng nhảy một nhịp ngay chỗ mắt người ta nhìn đầu tiên. */}
        <Suspense fallback={<div className={css.cho_o_tim} />}>
          <OTimKiem />
        </Suspense>
        {/* Bọc trong một hộp riêng thay vì để ba phần tử rời: `ThanhTaiKhoan` mang sẵn
            `margin-left: auto`, và hai `auto` cùng hàng thì flexbox **chia đôi** khoảng
            trống — nút "Đăng bài" trôi ra giữa thanh. Trong hộp này nó không còn khoảng
            trống nào để chia. */}
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
