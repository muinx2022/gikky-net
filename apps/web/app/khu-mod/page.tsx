import type { Metadata } from "next";

import { KhungHaiCot } from "@/components/khung-hai-cot";
import { DanhSachSubMod } from "@/components/danh-sach-sub-mod";
import css from "@/components/form-tai-khoan.module.css";

// `KhungHaiCot` gọi `GET /subs` ở phía SERVER với `cache: "no-store"`
// (`lib/api.ts::CHUNG`) ⇒ route này không tiền dựng được nữa. Thiếu dòng dưới thì
// `next build` ĐỎ ở bước export: Next ném `DynamicServerError`, `lay()` bọc nó lại
// nên Next không tự chuyển route sang dynamic được.
// Thêm 2026-08-25 lúc dựng bản Docker đầu tiên —
// xem `plans/2026-08-25-deploy-vps-docker.md` §"Trang tĩnh vỡ vì KhungHaiCot".
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Khu mod",
  // `noindex` cùng lý do với `/cai-dat`: chỉ có nghĩa với người đang đăng nhập.
  robots: { index: false, follow: false },
};

/** `/khu-mod` — chuyên mục **tôi được phân công làm mod** (user chốt 2026-08-24).
 *
 * Một danh sách và một đường đi: bấm vào chuyên mục là ra `/s/<slug>`, nơi công cụ mod
 * nằm ngay trên từng thẻ bài.
 *
 * ## Nó KHÔNG phải khu quản trị
 *
 * Khu quản trị thật ở `apps/admin` (cổng 3001, `admin.gikky.net` + allowlist IP — PLAN
 * 8.2). Trang này chỉ là **lối đi tắt** trên site công khai: ban user, quản lý sub, đọc
 * `AuditLog` đều **không** ở đây và không được mang về đây (xem docstring `api/mod.py`).
 */
export default function TrangKhuMod() {
  return (
    <KhungHaiCot>
      <div className={css.cot_cai_dat}>
        <header>
          <h1 className={css.tieu_de}>Khu mod</h1>
          <p className={css.mo_ta}>
            Chuyên mục bạn được phân công phụ trách. Mở một chuyên mục để dùng công cụ mod
            ngay trên từng bài.
          </p>
        </header>
        <DanhSachSubMod />
      </div>
    </KhungHaiCot>
  );
}
