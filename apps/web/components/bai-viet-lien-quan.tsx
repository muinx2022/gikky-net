import Link from "next/link";

import { docFeedSub } from "@/lib/api";
import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { duongDanMach, duongDanSub } from "@/lib/url";

import css from "./bai-viet-lien-quan.module.css";

/** Khối Bài viết liên quan (Internal Links & PageRank booster).
 *
 * Tự động nạp các bài viết cùng chuyên mục (sub) và cùng trường phái
 * để tạo dòng chảy liên kết nội bộ, giúp bot tìm kiếm (Googlebot) cào sâu
 * và giữ chân độc giả khám phá các bài viết liên quan.
 *
 * Hoạt động mượt mà trên cả Desktop lẫn Mobile (kể cả khi thanh Sidebar bên phải bị ẩn).
 */
export async function BaiVietLienQuan({
  machHienTaiId,
  subSlug,
  subTen,
  truongPhai,
}: {
  machHienTaiId: number;
  subSlug: string;
  subTen: string;
  truongPhai?: string | null;
}) {
  try {
    const items = (
      await docFeedSub(subSlug, "moi", {
        limit: 6,
        truong_phai: truongPhai ?? undefined,
      })
    ).du_lieu?.items ?? [];

    let lienQuan = items.filter((m) => m.id !== machHienTaiId);

    // Nếu lọc theo trường phái không đủ 3 bài, lấy thêm bài mới trong sub
    if (lienQuan.length < 3 && truongPhai) {
      const feedSub = await docFeedSub(subSlug, "moi", { limit: 6 });
      const them = (feedSub.du_lieu?.items ?? []).filter(
        (m) => m.id !== machHienTaiId && !lienQuan.some((x) => x.id === m.id),
      );
      lienQuan = [...lienQuan, ...them];
    }

    lienQuan = lienQuan.slice(0, 3);
    if (lienQuan.length === 0) return null;

    return (
      <section
        className={css.khung}
        data-testid="bai-viet-lien-quan"
        aria-label="Bài viết liên quan"
      >
        <div className={css.dau}>
          <div className={css.cum_tieu_de}>
            <span className={css.bieu_tuong} aria-hidden="true">
              📚
            </span>
            <h3 className={css.tieu_de}>
              Bài viết liên quan trong s/{subSlug}
            </h3>
          </div>
          <Link
            className={css.xem_them}
            href={duongDanSub(subSlug)}
            prefetch={false}
          >
            Xem tất cả trong {subTen} →
          </Link>
        </div>

        <div className={css.danh_sach}>
          {lienQuan.map((m) => (
            <article key={m.id} className={css.the_bai}>
              <div className={css.phan_dau_the}>
                <Link
                  className={css.tag_sub}
                  href={duongDanSub(m.sub.slug)}
                  prefetch={false}
                >
                  s/{m.sub.slug}
                </Link>
                {m.truong_phai && (
                  <Link
                    className={css.tag_truong_phai}
                    href={`/?truong_phai=${encodeURIComponent(m.truong_phai)}`}
                    prefetch={false}
                  >
                    #{m.truong_phai}
                  </Link>
                )}
              </div>

              <h4 className={css.tieu_de_bai}>
                <Link
                  className={css.link_bai}
                  href={duongDanMach(m.slug, m.id)}
                  prefetch={false}
                  title={m.title}
                >
                  {m.title}
                </Link>
              </h4>

              <div className={css.chu_ky_bai}>
                <span className={css.tac_gia}>
                  u/{m.author.display_name || m.author.username}
                </span>
                <span className={css.cham} aria-hidden>
                  ·
                </span>
                <span className="mono">{ngayCuaThoiDiem(m.published_at)}</span>
                {m.comment_count > 0 && (
                  <>
                    <span className={css.cham} aria-hidden>
                      ·
                    </span>
                    <span className="mono">{m.comment_count} bình luận</span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  } catch {
    return null;
  }
}
