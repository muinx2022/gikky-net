import type { MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayNganCuaThoiDiem } from "@/lib/dinh-dang";
import { SUB_BAN_TIN, tieuDeBanTinGon } from "@/lib/nhom-bai-viet";
import { duongDanMach, duongDanSub } from "@/lib/url";

import css from "./dai-ban-tin.module.css";

/** Dải "Bản tin thị trường": MỘT dòng mảnh ngay dưới header của trang chủ `/` *(việc 19, plan
 * `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.1, sửa ở vòng 2 §3.6)*. Trước đó nó nằm cuối
 * section "Bài viết", sau 4–5 màn hình — nên không ai thấy.
 *
 * `banTin` đã chọn sẵn ở `app/page.tsx` (`chonBanTin(…, SO_BAN_TIN_DAI)`, tối đa 2); rỗng ⇒ không
 * vẽ gì. Vì sao 2 chứ không 3: xem docstring `SO_BAN_TIN_DAI`.
 *
 * - Nhãn là `<span>`, KHÔNG phải heading: dải đứng TRƯỚC `<h1>` của trang. Cũng không có `<p>`
 *   nào trong dải, để không ai đọc HTML mà nhầm nó với lede.
 * - Mỗi mục: `<time datetime>` · tiêu đề đã bỏ tiền tố "Bản tin DD/MM — " (`tieuDeBanTinGon`:
 *   ngày đã in ở `<time>`); `title` của link giữ tiêu đề đầy đủ.
 * - Ở ≤ 960px CSS chỉ HIỆN bản đầu. Lối vào đầy đủ là "Tất cả bản tin →" ngay cạnh.
 * - Ở ≤ 640px nhãn rút còn "Bản tin", link rút còn "Tất cả →": phần chữ thừa bọc trong `.phu`
 *   rồi ẩn bằng CSS — chữ trong HTML không đổi. */
export function DaiBanTin({ banTin }: { banTin: readonly MachTomTatOut[] }) {
  if (banTin.length === 0) return null;
  return (
    <section className={css.dai} data-testid="ban-tin" aria-label="Bản tin thị trường">
      <div className={css.trong}>
        <span className={css.nhan}>
          Bản tin<span className={css.phu}> thị trường</span>
        </span>
        <ul className={css.ds}>
          {banTin.map((m) => (
            <li key={m.id} className={css.muc_goc} data-mach-id={m.id}>
              <Link
                className={css.muc}
                href={duongDanMach(m.slug, m.id)}
                prefetch={false}
                title={m.title}
                data-testid="ban-tin-muc"
                {...CHU_NGUOI_DUNG}
              >
                <time className={css.ngay} dateTime={m.published_at}>
                  {ngayNganCuaThoiDiem(m.published_at)}
                </time>
                <span aria-hidden> · </span>
                {tieuDeBanTinGon(m.title)}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          className={css.tat_ca}
          href={duongDanSub(SUB_BAN_TIN)}
          prefetch={false}
          data-testid="ban-tin-tat-ca"
        >
          Tất cả<span className={css.phu}> bản tin</span> →
        </Link>
      </div>
    </section>
  );
}
