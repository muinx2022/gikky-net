import type { MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { duongDanMach } from "@/lib/url";

import css from "./sidebar.module.css";

/** Đích của link "Tất cả bài viết →": feed "Mới" lọc `bai_viet` (nhánh `FeedDaNap` của `/`). */
export const HREF_TAT_CA_BAI_VIET = "/?tab=moi&loai_mach=bai_viet";

/** Tiêu đề dài hơn số ký tự này mới có tooltip. Ngắn hơn thì dòng hiện đủ chữ — tooltip chỉ lặp
 * lại đúng chữ đang thấy. Đo 2026-11-14 trên bản build, rail 300px (vùng chữ 268px), 12.5px — số ký
 * tự dài nhất còn vừa MỘT dòng:
 * - chữ thường có dấu (7 tiêu đề thật): 45–48;
 * - IN HOA có dấu, có dấu cách: 37–38 ("HPG MWG VNM FPT: AI DẪN SÓNG CUỐI NĂM" vừa 37 — bản 38 ký
 *   tự thêm "?" bị cắt), "WWWW MMMM ĐỨNG ĐẦU…" 33, "MƯỜNG ĐỒNG WƯỢM…" 32, "WM WM WM…" 30;
 * - chuỗi bệnh lý không dấu cách: "Đ"×n 30, "M"×n 23, "W"×n 22.
 * Chọn 28 (vòng sửa phản biện; bản đầu là 40 và bỏ sót tiêu đề IN HOA 38–39 ký tự đã bị cắt): mọi
 * chuỗi có dấu cách đo được đều được phủ. Chỉ chuỗi liền toàn "W"/"M" 23–28 ký tự lọt — không phải
 * tiêu đề thật. Cái giá: tiêu đề chữ thường 29–45 ký tự có tooltip dù chưa bị cắt, rẻ hơn tiêu đề
 * bị cắt mà không xem được. */
export const NGUONG_TOOLTIP_TIEU_DE = 28;

/** Khối bài mới của rail phải ("Bài viết mới" / "Bài mới nhất" / "Cùng chuyên mục").
 *
 * Tách khỏi `Sidebar` để **hai nơi dựng ra cùng một cái hộp** — y như `KhoiChuyenMuc`: `Sidebar`
 * (server-render, khi trang đã có `baiMoi`) và `BaiMoiTuTrinhDuyet` (khung tĩnh của `/luat`, tự nạp
 * ở trình duyệt).
 *
 * Mỗi dòng *(việc 24)*: tiêu đề MỘT dòng, chữ thường, cắt bằng CSS (`.tieu_de_bai_moi`) — chuỗi
 * ĐẦY ĐỦ vẫn là text của `<a>` (anchor text cho bot); cấm cắt chuỗi ở JS. Người rê chuột đọc tiêu đề
 * đầy đủ ở tooltip CSS (`data-tieu-de` trên `<li>`, xem `NGUONG_TOOLTIP_TIEU_DE`) — KHÔNG dùng
 * `title`: tooltip native là một dải dài tràn khỏi rail mà CSS không chỉnh được (user 2026-11-13). **`<a>` CHỈ bọc tiêu đề**: dòng phụ nằm trong `<a>` thì anchor text thành
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
          <li
            key={m.id}
            className={css.muc_bai_moi}
            data-tieu-de={m.title.length > NGUONG_TOOLTIP_TIEU_DE ? m.title : undefined}
          >
            <Link className={css.tieu_de_bai_moi} href={duongDanMach(m.slug, m.id)} prefetch={false}>
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
