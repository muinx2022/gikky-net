import type { SubChiTietOut, TrangBanTinOut } from "@gikky/api-client";
import Link from "next/link";

import {
  KHUNG_BAN_TIN,
  duongDanBanTin,
  thuNganBanTin,
  tieuDeBanTinGon,
} from "@/lib/ban-tin";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayNgan } from "@/lib/dinh-dang";
import { duongDanSub } from "@/lib/url";

import { BaoCursorHong } from "./bao-cursor-hong";
import css from "./danh-sach-ban-tin.module.css";

/** Trang danh sách `/s/tin-tuc` *(việc 20, plan `2026-11-13-ban-tin-bang-rieng.md` §3.5)* — mỗi
 * NGÀY một hàng, mới → cũ, thay cho feed thẻ mạch của các chuyên mục khác.
 *
 * - Đầu trang giữ tên + mô tả của sub (`xem_sub`); BỎ số mạch và nút theo dõi sub (bản tin không
 *   có ai để theo, và số mạch của `tin-tuc` nay luôn là 0).
 * - Mỗi hàng là MỘT link khối tới `/s/tin-tuc/<ngày>`: cột ngày (thứ + DD/MM, từ `ngay` — không
 *   từ dấu thời gian), tiêu đề gọn (`tieuDeBanTinGon`: ngày đã ở cột trái), các chấm khung đã có,
 *   và một dòng ≤ 4 số liệu cắt "…".
 * - Phân trang `?cursor=` bằng link thật (bot đi được), cursor hỏng ⇒ `BaoCursorHong` như feed. */
export function DanhSachBanTin({
  sub,
  trang,
  cursorHong,
}: {
  sub: SubChiTietOut;
  trang: TrangBanTinOut;
  cursorHong: boolean;
}) {
  return (
    <>
      <header className={css.dau} data-testid="sub-header">
        <p className={`${css.slug} mono`}>s/{sub.slug}</p>
        <h1 className={css.ten}>{sub.ten}</h1>
        <p className={css.mo_ta}>{sub.mo_ta}</p>
      </header>

      {cursorHong && <BaoCursorHong />}

      {trang.items.length === 0 ? (
        <p className={css.rong}>Chưa có bản tin nào.</p>
      ) : (
        <ol className={css.ds} data-testid="ban-tin-ds">
          {trang.items.map((b) => (
            <li key={b.ngay} className={css.hang_goc}>
              <Link
                className={css.hang}
                href={duongDanBanTin(b.ngay)}
                prefetch={false}
                title={b.title}
                data-testid="ban-tin-hang"
                data-ngay={b.ngay}
              >
                <time className={css.cot_ngay} dateTime={b.ngay}>
                  <span className={css.thu}>{thuNganBanTin(b.ngay)}</span>
                  <span className={css.dd_mm}>{ngayNgan(b.ngay)}</span>
                </time>
                <span className={css.than}>
                  <span className={css.tieu_de} {...CHU_NGUOI_DUNG}>
                    {tieuDeBanTinGon(b.title)}
                  </span>
                  <span className={css.khung} aria-label="Các khung đã có">
                    {KHUNG_BAN_TIN.map((k) => {
                      const co = b.khung_da_co.includes(k.khoa);
                      return (
                        <span
                          key={k.khoa}
                          className={co ? `${css.cham} ${css.cham_co}` : css.cham}
                          data-testid="ban-tin-cham"
                          data-khung={k.khoa}
                          data-co={co ? "true" : "false"}
                          title={co ? k.ten : `${k.ten} (chưa có)`}
                        >
                          {k.ten}
                        </span>
                      );
                    })}
                  </span>
                  {b.so_lieu.length > 0 && (
                    <span className={css.so_lieu} data-testid="ban-tin-hang-so-lieu" {...CHU_NGUOI_DUNG}>
                      {b.so_lieu.map((f, i) => (
                        <span key={i}>
                          {i > 0 && <span aria-hidden> · </span>}
                          {f.label} {f.value}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {trang.cursor_ke_tiep !== null && (
        <p className={css.xem_them}>
          <Link
            href={`${duongDanSub(sub.slug)}?cursor=${encodeURIComponent(trang.cursor_ke_tiep)}`}
            prefetch={false}
            data-testid="ban-tin-trang-sau"
          >
            Bản tin cũ hơn →
          </Link>
        </p>
      )}
    </>
  );
}
