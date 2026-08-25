import type { Metadata } from "next";

import { FormHoSo } from "@/components/form-ho-so";
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
  title: "Sửa hồ sơ",
  // `noindex` cùng lý do với `/cai-dat` và `/doi-mat-khau`: trang chỉ có nghĩa với người
  // đang đăng nhập; với bot nó là một khung rỗng.
  robots: { index: false, follow: false },
};

/** `/sua-ho-so` — ảnh đại diện + tên hiển thị + giới thiệu (user chốt 2026-08-24).
 *
 * ## Vì sao TÁCH khỏi `/cai-dat`
 *
 * Hai thứ này lúc đầu ở chung một trang vì cả hai đều là `PATCH /me`. Nhưng "chung
 * endpoint" là chuyện của server, không phải chuyện của người dùng: menu tài khoản có hai
 * mục **Sửa hồ sơ** và **Cài đặt**, và bấm hai mục khác nhau mà ra đúng một trang là một
 * cái menu nói dối. Neo `#ho-so` không cứu được chuyện đó — nó chỉ cuộn, tiêu đề trang
 * vẫn ghi "Cài đặt".
 *
 * ⇒ Ranh giới nay là **danh tính công khai** (trang này) so với **tuỳ chọn riêng tư của
 * tài khoản** (`/cai-dat`: digest). Thêm mục mới thì hỏi nó thuộc vế nào, đừng hỏi nó gọi
 * endpoint nào.
 *
 * ## Hàng rào cho khách nằm TRONG `FormHoSo`
 *
 * Trước lượt tách, `FormHoSo` cố ý **không** tự chuyển trang: nó ở chung trang với
 * `FormCaiDat`, và hai component cùng gọi `router.replace` là hai lệnh điều hướng đua
 * nhau. Tách ra rồi thì nó là component DUY NHẤT của trang này, nên hàng rào phải chuyển
 * vào nó — nếu không, khách vào đây gặp một trang trắng thay vì màn đăng nhập.
 */
export default function TrangSuaHoSo() {
  return (
    <KhungHaiCot>
      <div className={css.cot_cai_dat}>
        <header>
          <h1 className={css.tieu_de}>Sửa hồ sơ</h1>
          <p className={css.mo_ta}>
            Ảnh, tên và giới thiệu hiện ở trang hồ sơ công khai của bạn.
          </p>
        </header>
        <FormHoSo />
      </div>
    </KhungHaiCot>
  );
}
