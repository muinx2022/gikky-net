import { GIOI_THIEU } from "@/lib/site";

import css from "./khung-hai-cot.module.css";
import { Sidebar } from "./sidebar";

/** Biến thể **TĨNH** của `KhungHaiCot` — cùng lưới, KHÔNG gọi API *(2026-08-31)*.
 *
 * ## Vì sao có hai bản
 *
 * `KhungHaiCot` tự hỏi `GET /subs` ở phía server để vẽ khối "Chuyên mục". Đó là lựa chọn
 * đúng cho mọi trang nội dung thường — nhưng nó biến trang thành route động, và có một
 * trang KHÔNG được phép động: `/luat` là **đường thoát** của `app/error.tsx` và
 * `app/global-error.tsx`. Django chết ⇒ trang lỗi hiện ra ⇒ người dùng bấm "về Luật"; nếu
 * `/luat` cũng phải hỏi `GET /subs` thì đường thoát hỏng cùng lúc với thứ nó thoát khỏi,
 * và người dùng đi từ một trang lỗi sang một trang lỗi khác.
 *
 * Chuyện ấy đã xảy ra thật: 2026-08-25 `/luat` chuyển sang `KhungHaiCot` và phải khai
 * `dynamic = "force-dynamic"` cho `next build` khỏi đỏ — hợp đồng vỡ im lặng, xem
 * `plans/2026-08-25-deploy-vps-docker.md` §"Trang tĩnh vỡ vì KhungHaiCot" và
 * `plans/2026-08-31-luat-tinh-tro-lai.md`.
 *
 * ## Vì sao không quay về `<main>` trần
 *
 * Bản trước 08-25 của `/luat` là một `<main>` tự khai bề rộng, và đó chính là thứ
 * `KhungHaiCot` sinh ra để diệt: cột nội dung **nhảy ngang** mỗi lần điều hướng. Nên bản
 * tĩnh này dùng **chung** `khung-hai-cot.module.css` và **chung** `Sidebar` — một nguồn
 * sự thật cho lưới, khác đúng một chỗ là danh sách sub rỗng.
 *
 * `Sidebar` bỏ hẳn khối "Chuyên mục" khi `cacSub` rỗng (xem docstring của nó), nên ở đây
 * không có hộp tiêu đề rỗng và cũng không phải chế một API riêng.
 *
 * ## Luật của file này
 *
 * **Cấm mọi lời gọi API**: không `@/lib/api`, không `@gikky/api-client`, không `fetch(`.
 * Thêm một trong ba là `/luat` hết tĩnh, và cái hỏng đó không có triệu chứng nào ở dev.
 * `e2e/don-vi/trang-loi.spec.ts` canh chính file này — nhưng chỉ **một bậc import**, xem
 * giới hạn ghi ở đó.
 */
export function KhungHaiCotTinh({ children }: { children: React.ReactNode }) {
  return (
    <div className={css.khung}>
      <main className={css.chinh}>{children}</main>
      {/* Lớp bọc `sticky` — cùng vai với `khung-hai-cot.tsx`; giữ nguyên để rail dính
          giống hệt các trang khác, tức không "nhảy nhót" theo chiều dọc. */}
      <div className={css.rail}>
        {/* `gioiThieu` để rail không thành 288px trống trơ (phản biện 2026-08-31): khối
            "Chuyên mục" đã vắng vì `cacSub` rỗng, và khối giới thiệu lại hợp đúng cảnh
            người ta rơi vào trang này — từ một trang lỗi, chưa chắc biết site là gì. */}
        <Sidebar gioiThieu={GIOI_THIEU} cacSub={[]} />
      </div>
    </div>
  );
}
