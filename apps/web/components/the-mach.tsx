import type { MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import { nenHienSoDem } from "@/lib/dem";
import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { duongDanHoSo, duongDanMach, duongDanSub } from "@/lib/url";

import css from "./the-mach.module.css";

/** Thẻ mạch trong feed và trong hồ sơ — plan con 1c §2.3.
 *
 * `comment_count` chịu nguyên tắc 9 y như trên trang mạch: mạch dưới 4 bình luận thì
 * KHÔNG hiện con số nào. Luật này áp cho từng thẻ, không phải cho cả feed — một feed 20
 * bài có bài đông bài vắng, và thẻ vắng vẫn phải im lặng về chuyện đó.
 *
 * `entry_count` chỉ hiện khi ≥ 2: một mốc thì nó chưa phải mạch (PLAN 5.1), và "1 mốc"
 * là con số duy nhất nó có thể có.
 */
export function TheMach({ mach }: { mach: MachTomTatOut }) {
  const hien_so_dem = nenHienSoDem(mach.comment_count);
  return (
    <li className={css.the} data-testid="the-mach" data-mach-id={mach.id}>
      <Link className={css.sub} href={duongDanSub(mach.sub.slug)}>
        s/{mach.sub.slug}
      </Link>
      <h2 className={css.tieu_de}>
        <Link href={duongDanMach(mach.slug, mach.id)}>{mach.title}</Link>
      </h2>
      <div className={css.chu_ky}>
        <Link className={css.ai} href={duongDanHoSo(mach.author.username)}>
          u/{mach.author.username}
        </Link>
        <span className={css.cham} aria-hidden>
          ·
        </span>
        <span className={css.khi}>{ngayCuaThoiDiem(mach.created_at)}</span>
        {mach.entry_count >= 2 && (
          <>
            <span className={css.cham} aria-hidden>
              ·
            </span>
            <span className={css.dem} data-testid="the-mach-so-moc">
              {mach.entry_count} mốc
            </span>
          </>
        )}
        {hien_so_dem && (
          <>
            <span className={css.cham} aria-hidden>
              ·
            </span>
            <span className={css.dem} data-testid="the-mach-so-binh-luan">
              {mach.comment_count} bình luận
            </span>
          </>
        )}
        {mach.status === "closed" && (
          <>
            <span className={css.cham} aria-hidden>
              ·
            </span>
            <span className={css.dong_so}>đã đóng sổ</span>
          </>
        )}
        {mach.ket_qua !== null && (
          <span className={css.ket_qua} data-testid="the-mach-ket-qua">
            {mach.ket_qua}
          </span>
        )}
      </div>
    </li>
  );
}
