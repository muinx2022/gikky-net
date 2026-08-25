import type { Metadata } from "next";

import { FormCaiDat } from "@/components/form-cai-dat";
import { KhungHaiCot } from "@/components/khung-hai-cot";
import css from "@/components/form-tai-khoan.module.css";

// `KhungHaiCot` gọi `GET /subs` ở phía SERVER với `cache: "no-store"`
// (`lib/api.ts::CHUNG`) ⇒ route này không tiền dựng được nữa. Thiếu dòng dưới thì
// `next build` ĐỎ ở bước export: Next ném `DynamicServerError`, `lay()` bọc nó lại
// nên Next không tự chuyển route sang dynamic được.
// Thêm 2026-08-25 lúc dựng bản Docker đầu tiên —
// xem `plans/2026-08-25-deploy-vps-docker.md` §"Trang tĩnh vỡ vì KhungHaiCot".
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cài đặt",
  // `noindex` cùng lý do với `/doi-mat-khau`: trang chỉ có nghĩa với người đang đăng
  // nhập, và với bot nó là một khung rỗng. Nó cũng là đích của link **huỷ đăng ký**
  // trong thư digest — một URL đi vào chỉ mục tìm kiếm.
  robots: { index: false, follow: false },
};

/** `/cai-dat` — **tuỳ chọn tài khoản**, không phải hồ sơ.
 *
 * Ảnh đại diện / tên / giới thiệu ở `/sua-ho-so` (user chốt 2026-08-24); xem docstring
 * trang ấy cho lý do tách. Ranh giới: trang này giữ những thứ **không ai khác nhìn thấy**
 * — hiện là digest tuần, sau này thêm gì thì hỏi câu đó trước.
 *
 * Link **huỷ đăng ký** cuối thư digest trỏ về đây, nên đường dẫn `/cai-dat` là một hợp
 * đồng với thư đã gửi đi: đừng đổi nó thành `/cai-dat/thong-bao` cho gọn.
 */
export default function TrangCaiDat() {
  return (
    <KhungHaiCot>
      <div className={css.cot_cai_dat}>
        <header>
          <h1 className={css.tieu_de}>Cài đặt</h1>
          <p className={css.mo_ta}>Tuỳ chọn nhận thư của tài khoản.</p>
        </header>
        <FormCaiDat />
      </div>
    </KhungHaiCot>
  );
}
