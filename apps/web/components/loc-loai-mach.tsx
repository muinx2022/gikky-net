import Link from "next/link";

import { LOAI_MACH, type KhoangFeed, type LoaiMach, type TabFeed } from "@/lib/api";
import { NHAN_NGAN_LOAI_MACH, hrefChipLoai } from "@/lib/loc-loai-mach";

import css from "./feed.module.css";

/** Hàng chip lọc theo loại mạch của `/s/<sub>`: "Tất cả · Nhật ký · Bài viết · Chủ đề".
 *
 * Chuyên mục dùng chung cho cả ba loại (xem `lib/loc-loai-mach.ts`), nên đây là cách người
 * đọc tách chúng ra. Mỗi chip là `<Link>` thật — một `<a href>` trong HTML server-render,
 * bot bò được và người tắt JS vẫn bấm được, đúng như hai hàng tab/khoảng ngay dưới nó.
 *
 * **Hiện ở MỌI trang `Feed`** — `/?…` lẫn `/s/<sub>` *(việc 14, đợt C)*. Trước đó chỉ trang sub
 * dựng nó và `/?loai_mach=…` báo bộ lọc bằng chip "Loại: … ✕ Bỏ lọc"; chip ấy đã bị gỡ vì hàng này
 * thay nó (hiện cả hai là một bộ lọc được báo hai lần). Là hàng 1 trong ba hàng của dải điều khiển
 * (xem docstring `Feed`).
 *
 * "Tất cả" là trạng thái KHÔNG lọc và không đặt `loai_mach` lên URL; lựa chọn đang có mang
 * `aria-current="true"` (cùng kiểu chip khoảng thời gian).
 *
 * CSS nằm trong `feed.module.css` (xem chú thích ở đó vì sao không có CSS Module riêng).
 */
export function LocLoaiMach({
  coBan,
  tab,
  khoang,
  truongPhai,
  loaiMach,
}: {
  coBan: string;
  tab: TabFeed;
  khoang: KhoangFeed;
  truongPhai?: string;
  loaiMach?: LoaiMach;
}) {
  const lua_chon: readonly (LoaiMach | undefined)[] = [undefined, ...LOAI_MACH];
  return (
    <nav className={css.loc_loai} data-testid="loc-loai" aria-label="Lọc theo loại">
      {lua_chon.map((l) => (
        <Link
          key={l ?? "tat-ca"}
          href={hrefChipLoai(coBan, { tab, khoang, truongPhai }, l)}
          prefetch={false}
          className={
            l === loaiMach
              ? `${css.loc_loai_chip} ${css.loc_loai_chip_dang_chon}`
              : css.loc_loai_chip
          }
          aria-current={l === loaiMach ? "true" : undefined}
          data-testid={`loc-loai-${l ?? "tat-ca"}`}
        >
          {l === undefined ? "Tất cả" : NHAN_NGAN_LOAI_MACH[l]}
        </Link>
      ))}
    </nav>
  );
}
