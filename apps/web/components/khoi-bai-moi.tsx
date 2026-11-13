import type { MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { duongDanMach } from "@/lib/url";

import css from "./sidebar.module.css";

/** Đích của link "Tất cả bài viết →": feed "Mới" lọc `bai_viet` (nhánh `FeedDaNap` của `/`). */
export const HREF_TAT_CA_BAI_VIET = "/?tab=moi&loai_mach=bai_viet";

/** Khối bài mới của rail phải ("Bài viết mới" / "Bài mới nhất" / "Cùng chuyên mục").
 *
 * Tách khỏi `Sidebar` để **hai nơi dựng ra cùng một cái hộp** — y như `KhoiChuyenMuc`: `Sidebar`
 * (server-render, khi trang đã có `baiMoi`) và `BaiMoiTuTrinhDuyet` (khung tĩnh của `/luat`, tự nạp
 * ở trình duyệt).
 *
 * Mỗi dòng *(việc 24)*: tiêu đề MỘT dòng, chữ thường, cắt bằng CSS (`.tieu_de_bai_moi`) — chuỗi
 * ĐẦY ĐỦ vẫn là text của `<a>` (anchor text cho bot) và nằm cả ở `title` cho người rê chuột; cấm cắt
 * chuỗi ở JS. **`<a>` CHỈ bọc tiêu đề**: dòng phụ nằm trong `<a>` thì anchor text thành
 * "…tiêu đềChứng khoán·13/11/2026" (dính chữ). Vùng bấm cả dòng giữ bằng "stretched link":
 * `<li>` `position: relative`, `<a>::after` phủ `inset: 0` (xem `sidebar.module.css`).
 * Dòng phụ: tên chuyên mục · ngày đăng trong `<time dateTime>`, ANH EM của `<a>`. Ngày đi qua
 * `ngayCuaThoiDiem` (ghim `TZ_VN`) nên server và trình duyệt ra cùng chuỗi — không lệch hydrate.
 *
 * Không `"use client"`, không hook: dùng được từ cả server lẫn client component.
 */
export function KhoiBaiMoi({
  baiMoi,
  tieuDe,
  coLinkTatCa = false,
}: {
  baiMoi: readonly MachTomTatOut[];
  tieuDe: string;
  /** Link "Tất cả bài viết →" cuối khối — chỉ `/` và `/luat` bật (khối ở đó toàn `bai_viet`). */
  coLinkTatCa?: boolean;
}) {
  return (
    <section className={css.khoi} data-testid="sidebar-bai-moi">
      <h2 className={css.tieu_de}>{tieuDe}</h2>
      <ul className={css.danh_sach_bai_moi}>
        {baiMoi.map((m) => (
          <li key={m.id} className={css.muc_bai_moi}>
            <Link
              className={css.tieu_de_bai_moi}
              href={duongDanMach(m.slug, m.id)}
              prefetch={false}
              title={m.title}
            >
              {m.title}
            </Link>
            <span className={css.meta_bai_moi}>
              <span className={css.sub_bai_moi}>{m.sub.ten || `s/${m.sub.slug}`}</span>
              <span className={css.cham_phan_cach}>·</span>
              <time className={css.ngay_bai_moi} dateTime={m.published_at}>
                {ngayCuaThoiDiem(m.published_at)}
              </time>
            </span>
          </li>
        ))}
      </ul>
      {coLinkTatCa && (
        <Link
          className={css.dan}
          href={HREF_TAT_CA_BAI_VIET}
          prefetch={false}
          data-testid="sidebar-bai-moi-tat-ca"
        >
          Tất cả bài viết →
        </Link>
      )}
    </section>
  );
}
