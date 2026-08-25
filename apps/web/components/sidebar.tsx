import type { SubChiTietOut } from "@gikky/api-client";
import Link from "next/link";

import { dongSoMachSub } from "@/lib/dinh-dang";
import { DIEU_CAM } from "@/lib/phap-ly";
import { duongDanSub } from "@/lib/url";

import css from "./sidebar.module.css";

/** Sidebar phải — bố cục Reddit (plan con 1d §2.5.2 và §2.5.3).
 *
 * Ba khối, và **không có khối thứ tư**:
 *
 * 1. giới thiệu (trang chủ) hoặc mô tả sub + số mạch + ngày lập (trang sub);
 * 2. luật rút gọn dẫn `/luat` — PLAN 5.10 bắt mọi trang công khai phải có đường tới đó,
 *    và chân trang một mình thì ở dưới quá xa để ai đọc;
 * 3. danh sách các sub.
 *
 * **KHÔNG có nút "Tham gia sub"** — PLAN mục 4 loại nó khỏi v1 *(chốt 2026-08-22)* kèm
 * lý do "một cái nút vĩnh viễn không bấm được còn tệ hơn không có nút". Đây là chỗ nó sẽ
 * nằm nếu ai đó tái phát minh, nên câu này để đúng ở đây; `e2e/vo-reddit.spec.ts` khẳng
 * định sự VẮNG MẶT của nó.
 *
 * Trên màn hình hẹp sidebar **xuống dưới feed** chứ không biến mất: nội dung của nó là
 * đường đi (luật, các sub), không phải trang trí.
 */
export function Sidebar({
  gioiThieu,
  sub,
  cacSub,
}: {
  /** Hai dòng giới thiệu — trang chủ dùng, trang sub thay bằng `mo_ta` của chính sub. */
  gioiThieu?: string;
  /** Header của sub đang xem; `null`/thiếu là đang ở trang chủ. */
  sub?: SubChiTietOut | null;
  /** Các chuyên mục để nhảy sang. Trang sub vẫn liệt kê cả chính nó — nó là bản đồ, và
   * một bản đồ thiếu chỗ mình đang đứng thì khó đọc hơn. */
  cacSub: readonly SubChiTietOut[];
}) {
  return (
    <aside className={css.cot} data-testid="sidebar">
      {sub != null ? (
        <section className={css.khoi} data-testid="sidebar-ve-sub">
          <h2 className={css.tieu_de}>Về s/{sub.slug}</h2>
          <p className={css.than}>{sub.mo_ta}</p>
          <p className={`${css.so} mono`} data-testid="sidebar-so-mach">
            {dongSoMachSub(sub.so_mach, sub.created_at)}
          </p>
        </section>
      ) : (
        gioiThieu !== undefined && (
          <section className={css.khoi} data-testid="sidebar-gioi-thieu">
            <h2 className={css.tieu_de}>gikky.net</h2>
            <p className={css.than}>{gioiThieu}</p>
          </section>
        )
      )}

      <section className={css.khoi} data-testid="sidebar-luat">
        <h2 className={css.tieu_de}>Luật rút gọn</h2>
        {/* Bốn dòng này **SUY TỪ `DIEU_CAM`**, không gõ tay *(viết lại 2026-08-24)*.

            Bản cũ là ba dòng viết tay, và cả ba đều sai một kiểu riêng: hai dòng đầu gộp
            bốn điều cấm thành ba nên **rơi mất "cấm link nhóm kín"** — một điều có thật ở
            `/luat`, có chế tài, mà người đọc sidebar không bao giờ thấy. Dòng thứ ba
            ("Ghi lý do trước khi biết kết quả — đó là cả sản phẩm") **không phải một
            luật**: nó là câu quảng cáo nằm nhầm trong hộp luật, và nó chiếm đúng chỗ của
            điều cấm bị rơi.

            Suy từ nguồn thì hai lỗi ấy không tái diễn được: thêm/bớt/sửa điều cấm ở
            `lib/phap-ly.ts` là sidebar đổi theo, không có bản thứ hai để trôi. */}
        <ul className={css.gach_dau_dong}>
          {DIEU_CAM.map((d) => (
            <li key={d.tieu_de}>{d.tieu_de}</li>
          ))}
        </ul>
        <Link className={css.dan} href="/luat" data-testid="sidebar-dan-luat">
          Đọc luật cộng đồng →
        </Link>
      </section>

      <section className={css.khoi} data-testid="sidebar-cac-sub">
        <h2 className={css.tieu_de}>Chuyên mục</h2>
        <ul className={css.danh_sach_sub}>
          {cacSub.map((s) => (
            <li key={s.slug}>
              <Link className={css.mot_sub} href={duongDanSub(s.slug)}>
                <span className={`${css.slug} mono`}>s/{s.slug}</span>
                <span className={css.ten_sub}>{s.ten}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
