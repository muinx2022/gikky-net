import type { CSSProperties } from "react";

import type { MachTomTatOut, SubChiTietOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayNganCuaThoiDiem } from "@/lib/dinh-dang";
import {
  chonBanTin,
  chonMoiDang,
  dungGiaSach,
  idDaHien,
  subLenTrangChu,
  type GiaSachTho,
} from "@/lib/nhom-bai-viet";
import { duongDanMach, duongDanSub } from "@/lib/url";

import css from "./khoi-bai-viet.module.css";

/** Một bài của dải "Mới đăng": tiêu đề + trích 2 dòng (`xem_truoc.trich`, chữ thuần server đã
 * cắt; CSS kẹp) + chip TÊN chuyên mục + ngày, thumbnail bên phải. */
function MucBaiViet({ mach, tenSub }: { mach: MachTomTatOut; tenSub: string }) {
  const href = duongDanMach(mach.slug, mach.id);
  const anh = mach.xem_truoc?.anh ?? null;
  const trich = mach.xem_truoc?.trich ?? "";
  return (
    <li className={css.muc_goc}>
      <article className={css.muc} data-testid="bai-viet-moi-dang-muc" data-mach-id={mach.id}>
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
              {tenSub}
            </span>
            <time dateTime={mach.published_at}>{ngayNganCuaThoiDiem(mach.published_at)}</time>
          </div>
        </div>
        {/* Ảnh minh hoạ của bài (mốc 1) — khung CỐ ĐỊNH 104×72 (mobile 88×66), nên ảnh nạp xong
            không đẩy chữ (CLS = 0). Bài không ảnh ⇒ ô `--surface-2`. `aria-hidden`: nó chỉ minh
            hoạ cho đúng tiêu đề bên cạnh; `alt` ở lại cho bot (HTML thô). `next/image` cố ý
            KHÔNG dùng — server đã sinh thumbnail lúc upload (cùng lý lẽ ở `TheMach`). */}
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

/** Một bài trên giá sách: CHỈ tiêu đề + ngày (không ảnh, không trích). */
function MucGia({ mach }: { mach: MachTomTatOut }) {
  return (
    <li className={css.gia_muc_goc}>
      <article className={css.gia_muc} data-testid="bai-viet-gia-muc" data-mach-id={mach.id}>
        <h4 className={css.gia_tieu_de}>
          <Link href={duongDanMach(mach.slug, mach.id)} prefetch={false} {...CHU_NGUOI_DUNG}>
            {mach.title}
          </Link>
        </h4>
        <time className={css.gia_ngay} dateTime={mach.published_at}>
          {ngayNganCuaThoiDiem(mach.published_at)}
        </time>
      </article>
    </li>
  );
}

/** Section "Bài viết" của trang chủ, nằm CUỐI trang và trải hết chiều ngang (ra ngoài khung hai
 * cột, dưới cả rail) *(plan `2026-11-11-bai-viet-trang-chu-gia-sach.md`)*. Từ trên xuống:
 *
 * 1. Header + chip: chip là các chuyên mục admin đã chọn lên trang chủ (`vi_tri_trang_chu`).
 * 2. **Mới đăng**: `SO_MOI_DANG` bài `bai_viet` mới nhất của MỌI chuyên mục trừ `tin-tuc`, kèm
 *    thumbnail + chip tên chuyên mục — nên chuyên mục không được chọn vẫn lên trang chủ.
 * 3. **Giá sách**: mỗi chuyên mục được chọn là một cột (tiêu đề = `sub.ten`), `SO_BAI_MOI_GIA`
 *    bài chỉ tiêu đề + ngày, KHÔNG trùng bài đã ở Mới đăng. `gia` do trang chủ tải riêng từng
 *    sub (`docFeedSub`) nên sub đăng chậm vẫn có bài. Cột rỗng ⇒ ẩn. Bài đã ở dải "Bản tin
 *    thị trường" cũng bị loại khỏi giá.
 *
 * Dải "Bản tin thị trường" từng là mục 4 ở cuối section này; từ việc 19 nó là `DaiBanTin` ở ĐẦU
 * trang, ngay dưới header (plan `2026-11-13-ban-tin-len-dau-ban-quyen.md`).
 *
 * Việc chọn bài là của `lib/nhom-bai-viet.ts` (hàm thuần). **Mới đăng và giá sách cùng rỗng ⇒ ẩn
 * cả section** (không khung rỗng). Mọi bài là `<article>` có `<a href>` thật ở tiêu đề (heading),
 * ngày trong `<time datetime>`. Web không giữ bản sao tên hay slug chuyên mục nào ngoài `tin-tuc`.
 * HTML như nhau cho mọi UA.
 *
 * Gallery lật ảnh kiểu Reddit của homepage v2 bản đầu (`gallery-bai-viet.tsx`) không còn được
 * dùng ở đây: dải Mới đăng chỉ có MỘT thumbnail nhỏ mỗi bài. */
export function KhoiBaiViet({
  bai_viet,
  cac_sub,
  gia,
}: {
  bai_viet: readonly MachTomTatOut[];
  cac_sub: readonly SubChiTietOut[];
  gia: readonly GiaSachTho[];
}) {
  const moi_dang = chonMoiDang(bai_viet);
  // Bản tin không còn vẽ ở đây (dải riêng ở đầu trang), nhưng giá sách VẪN bỏ các bài ấy: admin
  // có thể chọn `tin-tuc` làm một giá, và ba bài của giá ấy sẽ trùng đúng dải bản tin.
  const cot = dungGiaSach(gia, idDaHien(moi_dang, chonBanTin(bai_viet)));
  if (moi_dang.length === 0 && cot.length === 0) return null;

  const hrefTatCa = "/?tab=moi&loai_mach=bai_viet";
  const ten_sub = new Map(cac_sub.map((s) => [s.slug, s.ten]));
  const chip = subLenTrangChu(cac_sub);

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
            {chip.map((s) => (
              <Link
                key={s.slug}
                className={css.chip}
                href={duongDanSub(s.slug)}
                prefetch={false}
                data-testid={`bai-viet-chip-${s.slug}`}
              >
                {s.ten}
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

        {moi_dang.length > 0 && (
          <div className={css.moi_dang} data-testid="bai-viet-moi-dang">
            <div className={css.lib_t}>
              <h3 className={css.ten_nhom}>Mới đăng</h3>
            </div>
            <ol className={css.ds_moi_dang}>
              {moi_dang.map((m) => (
                <MucBaiViet
                  key={m.id}
                  mach={m}
                  tenSub={ten_sub.get(m.sub.slug) ?? `s/${m.sub.slug}`}
                />
              ))}
            </ol>
          </div>
        )}

        {cot.length > 0 && (
          <div
            className={css.gia_luoi}
            // Số cột = số giá còn bài (≤ 4): giá ít hơn 4 thì chia đều chiều ngang, không chừa
            // ô trống. Biến CSS để media query ở tablet/mobile ghi đè được (style inline thì không).
            style={{ "--so-gia": cot.length } as CSSProperties}
          >
            {cot.map((c) => (
              <div
                key={c.sub.slug}
                className={css.cot}
                data-testid="bai-viet-gia"
                data-sub={c.sub.slug}
              >
                <div className={css.lib_t}>
                  <h3 className={css.ten_nhom} {...CHU_NGUOI_DUNG}>
                    {c.sub.ten}
                  </h3>
                  <Link
                    className={css.xem_them}
                    href={duongDanSub(c.sub.slug)}
                    prefetch={false}
                    data-testid="bai-viet-gia-xem-them"
                  >
                    Xem thêm →
                  </Link>
                </div>
                <ol className={css.gia_ds}>
                  {c.baiViet.map((m) => (
                    <MucGia key={m.id} mach={m} />
                  ))}
                </ol>
              </div>
            ))}
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
