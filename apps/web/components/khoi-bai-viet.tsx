import type { MachTomTatOut, SubChiTietOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayNganCuaThoiDiem } from "@/lib/dinh-dang";
import {
  chiaNhomBaiViet,
  chonBanTin,
  slugChipChuyenMuc,
  SUB_BAN_TIN,
} from "@/lib/nhom-bai-viet";
import { duongDanMach, duongDanSub } from "@/lib/url";

import css from "./khoi-bai-viet.module.css";

/** Một mục đánh số của cột. Trích 2 dòng là `xem_truoc.trich` (chữ thuần server đã cắt); CSS
 * kẹp. */
function MucBaiViet({ mach, so }: { mach: MachTomTatOut; so: number }) {
  const href = duongDanMach(mach.slug, mach.id);
  const anh = mach.xem_truoc?.anh ?? null;
  const trich = mach.xem_truoc?.trich ?? "";
  return (
    <li className={css.muc_goc}>
      <article className={css.muc} data-testid="bai-viet-muc" data-mach-id={mach.id}>
        <span className={css.so} aria-hidden="true">
          {String(so).padStart(2, "0")}
        </span>
        <div className={css.than}>
          <h4 className={css.tieu_de}>
            <Link href={href} prefetch={false} {...CHU_NGUOI_DUNG}>
              {mach.title}
            </Link>
          </h4>
          {trich !== "" && (
            <p className={css.trich} {...CHU_NGUOI_DUNG}>
              {trich}
            </p>
          )}
          <div className={css.meta}>
            <span className={css.nhan} {...CHU_NGUOI_DUNG}>
              s/{mach.sub.slug}
            </span>
            <time dateTime={mach.published_at}>{ngayNganCuaThoiDiem(mach.published_at)}</time>
          </div>
        </div>
        {/* Ảnh minh hoạ của bài (mốc 1) — khung CỐ ĐỊNH 104×72 (mobile 88×66), nên ảnh nạp xong
            không đẩy chữ (CLS = 0). Bài không ảnh ⇒ ô `--surface-2`. `aria-hidden`: nó chỉ minh
            hoạ cho đúng tiêu đề bên cạnh; `alt` ở lại cho bot (HTML thô). `next/image` cố ý
            KHÔNG dùng — server đã sinh thumbnail lúc upload (cùng lý lẽ `NoiDungThe`). */}
        <span
          className={css.thumb}
          aria-hidden="true"
          data-testid="bai-viet-thumb"
          data-co-anh={anh !== null ? "true" : "false"}
        >
          {anh !== null && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={css.anh}
              src={anh.url_thumb}
              width={anh.w_thumb ?? undefined}
              height={anh.h_thumb ?? undefined}
              alt={`Ảnh minh họa: ${mach.title}`}
              loading="lazy"
              decoding="async"
            />
          )}
        </span>
      </article>
    </li>
  );
}

/** Section "Bài viết" của trang chủ — kiểu THƯ VIỆN kiến thức, nằm CUỐI trang và trải hết chiều
 * ngang (ra ngoài khung hai cột, dưới cả rail) *(plan `2026-11-11-homepage-v2-giao-dien-moi.md`
 * §3.3; user: "phần bài viết cũng cần vì dính SEO… nhưng nhìn giống các trang tin quá")*.
 *
 * `bai_viet` là MỘT lời gọi `docFeed("moi", { limit: 50, loai_mach: "bai_viet" })`; việc chia
 * cột là của `lib/nhom-bai-viet.ts` (hàm thuần, nhóm là hằng cấu hình): ba cột theo nhóm chuyên
 * mục, mỗi cột tối đa `SO_BAI_MOI_NHOM` bài đánh số, rồi dải "Bản tin thị trường" gồm bài mới
 * nhất của `s/tin-tuc`. **Nhóm rỗng ⇒ ẩn cột; không còn gì để bày ⇒ ẩn cả section** (không
 * khung rỗng).
 *
 * Mọi bài là `<article>` có `<a href>` thật ở tiêu đề (heading), ngày trong `<time datetime>`.
 * Chip chuyên mục lấy NHÃN từ `GET /subs` (`cac_sub`) — web không giữ bản sao tên chuyên mục;
 * chuyên mục chưa tồn tại thì không có chip. HTML như nhau cho mọi UA.
 *
 * Gallery lật ảnh kiểu Reddit của homepage v2 bản đầu (`gallery-bai-viet.tsx`) không còn được
 * dùng ở đây: thư viện chỉ có MỘT thumbnail nhỏ mỗi bài. */
export function KhoiBaiViet({
  bai_viet,
  cac_sub,
}: {
  bai_viet: readonly MachTomTatOut[];
  cac_sub: readonly SubChiTietOut[];
}) {
  const cot = chiaNhomBaiViet(bai_viet);
  const ban_tin = chonBanTin(bai_viet);
  if (cot.length === 0 && ban_tin.length === 0) return null;

  const hrefTatCa = "/?tab=moi&loai_mach=bai_viet";
  const ten_sub = new Map(cac_sub.map((s) => [s.slug, s.ten]));
  const chip = slugChipChuyenMuc().filter((slug) => ten_sub.has(slug));

  return (
    <section className={css.khoi} data-testid="khoi-bai-viet" aria-labelledby="tieu-khoi-bai-viet">
      <div className={css.trong}>
        <header className={css.dau_khoi}>
          <div>
            <h2 className={css.tieu_khoi} id="tieu-khoi-bai-viet">
              Bài viết
            </h2>
            <p className={css.mo_ta}>
              Kiến thức nền cho người giao dịch nghiêm túc — đọc một lần, dùng lâu dài.
            </p>
          </div>
          <nav className={css.chips} aria-label="Chuyên mục bài viết" data-testid="bai-viet-chips">
            {chip.map((slug) => (
              <Link
                key={slug}
                className={css.chip}
                href={duongDanSub(slug)}
                prefetch={false}
                data-testid={`bai-viet-chip-${slug}`}
              >
                {ten_sub.get(slug)}
              </Link>
            ))}
            <Link
              className={css.tat_ca}
              href={hrefTatCa}
              prefetch={false}
              data-testid="bai-viet-tat-ca"
            >
              Tất cả bài viết →
            </Link>
          </nav>
        </header>

        {cot.length > 0 && (
          <div className={css.luoi}>
            {cot.map((c) => (
              <div key={c.khoa} className={css.cot} data-testid="bai-viet-nhom" data-nhom={c.khoa}>
                <div className={css.lib_t}>
                  <h3 className={css.ten_nhom}>{c.ten}</h3>
                  <Link
                    className={css.xem_them}
                    href={duongDanSub(c.xemThem)}
                    prefetch={false}
                    data-testid="bai-viet-nhom-xem-them"
                  >
                    Xem thêm →
                  </Link>
                </div>
                <ol className={css.ds}>
                  {c.baiViet.map((m, i) => (
                    <MucBaiViet key={m.id} mach={m} so={i + 1} />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {ban_tin.length > 0 && (
          <div className={css.ban_tin} data-testid="ban-tin">
            <h3 className={css.ban_tin_nhan}>Bản tin thị trường</h3>
            <ul className={css.ban_tin_ds}>
              {ban_tin.map((m) => (
                <li key={m.id} data-mach-id={m.id}>
                  <Link
                    className={css.ban_tin_muc}
                    href={duongDanMach(m.slug, m.id)}
                    prefetch={false}
                    data-testid="ban-tin-muc"
                    {...CHU_NGUOI_DUNG}
                  >
                    <time className={css.ban_tin_ngay} dateTime={m.published_at}>
                      {ngayNganCuaThoiDiem(m.published_at)}
                    </time>
                    <span aria-hidden> · </span>
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              className={css.ban_tin_tat_ca}
              href={duongDanSub(SUB_BAN_TIN)}
              prefetch={false}
              data-testid="ban-tin-tat-ca"
            >
              Tất cả bản tin →
            </Link>
          </div>
        )}

        <Link
          className={css.xem_them_di_dong}
          href={hrefTatCa}
          prefetch={false}
          data-testid="bai-viet-xem-them"
        >
          Xem thêm bài viết
        </Link>
      </div>
    </section>
  );
}
