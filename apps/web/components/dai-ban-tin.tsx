import type { BanTinTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import { SUB_BAN_TIN, duongDanBanTin, tieuDeBanTinGon } from "@/lib/ban-tin";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayNgan } from "@/lib/dinh-dang";
import { duongDanSub } from "@/lib/url";

import css from "./dai-ban-tin.module.css";

/** Dải "Bản tin thị trường": MỘT dòng mảnh ngay dưới header của trang chủ `/` *(việc 19, plan
 * `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.1, sửa ở vòng 2 §3.6)*. Trước đó nó nằm cuối
 * section "Bài viết", sau 4–5 màn hình — nên không ai thấy.
 *
 * **Nguồn từ việc 20** (plan `2026-11-13-ban-tin-bang-rieng.md` §3.5): bảng bản tin RIÊNG —
 * `app/page.tsx` gọi `liet_ke_ban_tin({limit: SO_BAN_TIN_DAI})` (tối đa 2), không còn lọc feed bài
 * viết theo sub. Rỗng ⇒ không vẽ gì. Vì sao 2 chứ không 3: xem docstring `SO_BAN_TIN_DAI`.
 *
 * - Nhãn là `<span>`, KHÔNG phải heading: dải đứng TRƯỚC `<h1>` của trang. Cũng không có `<p>`
 *   nào trong dải, để không ai đọc HTML mà nhầm nó với lede.
 * - Mỗi mục: `<time datetime>` · tiêu đề đã bỏ tiền tố "Bản tin DD/MM — " (`tieuDeBanTinGon`:
 *   ngày đã in ở `<time>`); `title` của link giữ tiêu đề đầy đủ. Link `/s/tin-tuc/<ngày>`.
 * - **Ngày là `BanTin.ngay`**, không phải `cap_nhat_luc` hay một dấu thời gian nào: bản tin đăng
 *   lệch giờ không được in sai ngày (đóng sổ `P-20261113-8` (a)).
 * - Ở ≤ 960px CSS chỉ HIỆN bản đầu. Lối vào đầy đủ là "Tất cả bản tin →" ngay cạnh.
 * - Ở ≤ 640px nhãn rút còn "Bản tin", link rút còn "Tất cả →": phần chữ thừa bọc trong `.phu`
 *   rồi ẩn bằng CSS — chữ trong HTML không đổi. */
export function DaiBanTin({ banTin }: { banTin: readonly BanTinTomTatOut[] }) {
  if (banTin.length === 0) return null;
  return (
    <section className={css.dai} data-testid="ban-tin" aria-label="Bản tin thị trường">
      <div className={css.trong}>
        <span className={css.nhan}>
          Bản tin<span className={css.phu}> thị trường</span>
        </span>
        <ul className={css.ds}>
          {banTin.map((b) => (
            <li key={b.ngay} className={css.muc_goc} data-ngay={b.ngay}>
              <Link
                className={css.muc}
                href={duongDanBanTin(b.ngay)}
                prefetch={false}
                title={b.title}
                data-testid="ban-tin-muc"
                {...CHU_NGUOI_DUNG}
              >
                <time className={css.ngay} dateTime={b.ngay}>
                  {ngayNgan(b.ngay)}
                </time>
                <span aria-hidden> · </span>
                {tieuDeBanTinGon(b.title)}
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
