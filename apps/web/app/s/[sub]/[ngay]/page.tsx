import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SoLaiLo } from "@/components/con-so";
import { JsonLd } from "@/components/json-ld";
import { VoKhungHaiCot } from "@/components/khung-hai-cot-vo";
import { NutVeDauTrang } from "@/components/nut-ve-dau-trang";
import { Sidebar } from "@/components/sidebar";
import { ThanHtml } from "@/components/than-html";
import { docBanTin, docCacSub, docChuDeTuan } from "@/lib/api";
import {
  SUB_BAN_TIN,
  duongDanBanTin,
  gioVN,
  khungTheoThuTu,
  ngayBanTinHopLe,
  ngayDayDuBanTin,
  tachGiaTri,
} from "@/lib/ban-tin";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayNgan } from "@/lib/dinh-dang";
import { jsonLdBanTin, moTaBanTin } from "@/lib/json-ld";
import { GIOI_THIEU, urlTuyetDoi } from "@/lib/site";
import { duongDanSub } from "@/lib/url";

import css from "./ban-tin.module.css";

// Không `loading.tsx` / `<Suspense>` (docstring dài ở `app/page.tsx`): `notFound()` phải đổi được
// status. Đếm lượt xem không gọi gì ở đây — middleware gửi `POST /dem-luot-xem` cho đường
// `/s/tin-tuc/<ngày>` như mọi trang (`lib/dem-luot-xem.ts::DUONG_DAN_HOP_LE`).
export const dynamic = "force-dynamic";

type ThamSo = { sub: string; ngay: string };

/** Sub khác bản tin hoặc ngày sai dạng ⇒ 404 ngay, không gọi API. Bản tin không có / đã ẩn ⇒ API
 * 404 ⇒ `notFound()`. */
async function nap(sub: string, ngay: string) {
  if (sub !== SUB_BAN_TIN || !ngayBanTinHopLe(ngay)) notFound();
  const ban_tin = await docBanTin(ngay);
  if (ban_tin === null) notFound();
  return ban_tin;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ThamSo>;
}): Promise<Metadata> {
  const { sub, ngay } = await params;
  const ban_tin = await nap(sub, ngay);
  const url = urlTuyetDoi(duongDanBanTin(ban_tin.ngay));
  const mo_ta = moTaBanTin(ban_tin);
  // Không khai `images`: `opengraph-image.tsx` cạnh đây là metadata dạng FILE, Next tự sinh
  // `og:image` + `twitter:image` từ nó và nó thắng khối `openGraph` khai ở đây (đã đo: xoá file ⇒
  // mất cả hai thẻ). Khai thêm bằng tay là hai nguồn cho một URL. JSON-LD lấy cùng đường qua
  // `anhOgBanTin`.
  return {
    title: ban_tin.title,
    description: mo_ta,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: ban_tin.title,
      description: mo_ta,
      url,
      publishedTime: ban_tin.created_at,
      modifiedTime: ban_tin.cap_nhat_luc,
      section: "Bản tin thị trường",
    },
    twitter: {
      card: "summary_large_image",
      title: ban_tin.title,
      description: mo_ta,
    },
  };
}

/** `/s/tin-tuc/<YYYY-MM-DD>` — một tờ bản tin ngày *(việc 20, plan
 * `2026-11-13-ban-tin-bang-rieng.md` §3.5)*. Đọc như một tờ tin, KHÔNG phải dạng nhật ký: không
 * dòng thời gian, không vote, không bình luận, không ô "bạn nghĩ sao", không nút theo dõi.
 *
 * 1. Đầu trang: nhãn, ngày đầy đủ (từ `ngay`, KHÔNG từ dấu thời gian), `<h1>`, "Cập nhật HH:mm"
 *    giờ VN + lượt xem.
 * 2. Mục lục ba khung: có nội dung ⇒ link neo; chưa có ⇒ ô mờ + giờ dự kiến.
 * 3. Mỗi khung một `<section id>`: `<h2>` tên + `<time>` giờ đăng, LƯỚI SỐ LIỆU trước, thân HTML
 *    sau. Thứ tự khung theo `KHUNG_BAN_TIN`, không theo thứ tự đăng.
 * 4. Điều hướng ngày trước / tất cả / ngày sau.
 *
 * Rail là rail chung (giới thiệu + chủ đề tuần + chuyên mục + luật), không phải rail "Về s/…":
 * hai lối "Nhật ký / Bài viết trong chuyên mục" của rail sub vô nghĩa với bản tin. */
export default async function TrangBanTin({ params }: { params: Promise<ThamSo> }) {
  const { sub, ngay } = await params;
  const [ban_tin, cac_sub, chu_de_tuan] = await Promise.all([
    nap(sub, ngay),
    docCacSub(),
    docChuDeTuan(new Date()),
  ]);
  const hang = khungTheoThuTu(ban_tin.khung);

  return (
    <>
      <JsonLd duLieu={jsonLdBanTin(ban_tin)} />
      <VoKhungHaiCot
        sidebar={<Sidebar gioiThieu={GIOI_THIEU} cacSub={cac_sub} chuDeTuan={chu_de_tuan} />}
      >
        <article className={css.to} data-testid="ban-tin-trang" data-ngay={ban_tin.ngay}>
          <header className={css.dau}>
            <p className={css.nhan}>
              <Link href={duongDanSub(SUB_BAN_TIN)} prefetch={false}>
                Bản tin thị trường
              </Link>
            </p>
            <p className={css.ngay}>
              <time dateTime={ban_tin.ngay} data-testid="ban-tin-ngay">
                {ngayDayDuBanTin(ban_tin.ngay)}
              </time>
            </p>
            <h1 className={css.tieu_de} {...CHU_NGUOI_DUNG}>
              {ban_tin.title}
            </h1>
            <p className={css.phu}>
              Cập nhật{" "}
              <time dateTime={ban_tin.cap_nhat_luc} data-testid="ban-tin-cap-nhat">
                {gioVN(ban_tin.cap_nhat_luc)}
              </time>
              <span aria-hidden> · </span>
              {/* Trang `force-dynamic` nên số này tươi; tối thiểu 1 vì người đang đọc là một lượt
                  (cùng lý lẽ với `ChuKyLuotXem` của trang mạch). */}
              <span data-testid="ban-tin-luot-xem">
                {Math.max(1, ban_tin.view_count).toLocaleString("vi-VN")} lượt xem
              </span>
            </p>
          </header>

          <nav className={css.muc_luc} aria-label="Các khung giờ" data-testid="ban-tin-muc-luc">
            <ol className={css.muc_luc_ds}>
              {hang.map((h) =>
                h.khung !== null ? (
                  <li key={h.khoa} className={css.o}>
                    <a
                      className={css.o_link}
                      href={`#${h.neo}`}
                      data-testid="ban-tin-muc-luc-o"
                      data-khung={h.khoa}
                    >
                      <span className={css.o_ten}>{h.ten}</span>
                      <time className={css.o_gio} dateTime={h.khung.created_at}>
                        {gioVN(h.khung.created_at)}
                      </time>
                    </a>
                  </li>
                ) : (
                  <li
                    key={h.khoa}
                    className={`${css.o} ${css.o_thieu}`}
                    data-testid="ban-tin-muc-luc-o"
                    data-khung={h.khoa}
                    data-thieu="true"
                  >
                    <span className={css.o_ten}>{h.ten}</span>
                    <span className={css.o_gio}>{h.gioDuKien}</span>
                  </li>
                ),
              )}
            </ol>
          </nav>

          {hang.map((h) =>
            h.khung === null ? null : (
              <section
                key={h.khoa}
                id={h.neo}
                className={css.khung}
                data-testid="ban-tin-khung"
                data-khung={h.khoa}
                aria-labelledby={`${h.neo}-tieu-de`}
              >
                <h2 className={css.khung_tieu_de} id={`${h.neo}-tieu-de`}>
                  {h.ten}
                  <time className={css.khung_gio} dateTime={h.khung.created_at}>
                    {gioVN(h.khung.created_at)}
                  </time>
                </h2>
                {h.khung.figures !== null && h.khung.figures.length > 0 && (
                  <dl className={css.so_lieu} data-testid="ban-tin-so-lieu">
                    {h.khung.figures.map((f, i) => {
                      const { chinh, ngoac } = tachGiaTri(f.value);
                      return (
                        <div key={i} className={css.the}>
                          <dt className={css.the_nhan} {...CHU_NGUOI_DUNG}>
                            {f.label}
                          </dt>
                          <dd className={css.the_gia_tri} {...CHU_NGUOI_DUNG}>
                            {chinh}
                            {ngoac !== null && (
                              <span className={css.the_ngoac}>
                                {" ("}
                                <SoLaiLo value={ngoac} />
                                {")"}
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                <div data-testid="ban-tin-than">
                  <ThanHtml body={h.khung.body} dinhDang="html" className={css.than} />
                </div>
              </section>
            ),
          )}

          <nav className={css.dieu_huong} aria-label="Bản tin khác" data-testid="ban-tin-dieu-huong">
            {ban_tin.ngay_truoc !== null ? (
              <Link
                className={css.dh_truoc}
                href={duongDanBanTin(ban_tin.ngay_truoc)}
                prefetch={false}
                data-testid="ban-tin-truoc"
              >
                ← Bản tin {ngayNgan(ban_tin.ngay_truoc)}
              </Link>
            ) : (
              <span className={css.dh_truoc} />
            )}
            <Link
              className={css.dh_tat_ca}
              href={duongDanSub(SUB_BAN_TIN)}
              prefetch={false}
              data-testid="ban-tin-tat-ca-trang"
            >
              Tất cả bản tin
            </Link>
            {ban_tin.ngay_sau !== null ? (
              <Link
                className={css.dh_sau}
                href={duongDanBanTin(ban_tin.ngay_sau)}
                prefetch={false}
                data-testid="ban-tin-sau"
              >
                Bản tin {ngayNgan(ban_tin.ngay_sau)} →
              </Link>
            ) : (
              <span className={css.dh_sau} />
            )}
          </nav>
        </article>
      </VoKhungHaiCot>
      <NutVeDauTrang />
    </>
  );
}
