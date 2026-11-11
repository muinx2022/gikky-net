import type { FeedOut, MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { nhomTheoTuan } from "@/lib/chu-de";
import { duongDanMach, duongDanSub } from "@/lib/url";

import { BaoCursorHong } from "./bao-cursor-hong";
import feedCss from "./feed.module.css";
import khoiCss from "./khoi-thao-luan.module.css";
import css from "./kho-chu-de.module.css";

/** Số chủ đề mỗi trang của kho `/chu-de` (plan `2026-11-10-homepage-v2.md` §3.8). */
export const SO_CHU_DE_MOI_TRANG = 50;

/** Một hàng chủ đề trong kho: `s/sub` · chip **Đang mở / Đã đóng** · "N bình luận" (khi ≥ 1),
 * tiêu đề (link `/m/…`), và dòng tổng kết khi chủ đề đã đóng VÀ có `ket_qua`.
 *
 * Dòng tổng kết là `ket_qua`, không phải `bai_hoc`: thẻ feed (`MachTomTatOut`) không mang
 * `bai_hoc` (TextField tới 5000 ký tự) — `ket_qua` ≤ 40 ký tự mới là chỗ thiết kế cho một dòng
 * tóm tắt. `bai_hoc` đầy đủ nằm ở phần "Tổng kết" của chính trang chủ đề.
 *
 * Luật "dưới 4 bình luận thì ẩn con số" (PLAN nguyên tắc 9) là của THẺ ở trang chủ, nơi con số
 * là lời mời tham gia. Ở kho, hàng gọn nói thẳng "N bình luận" từ 1 trở lên — cùng hàng gọn của
 * khối Bài viết. */
export function HangChuDe({ mach }: { mach: MachTomTatOut }) {
  const dang_mo = mach.status !== "closed";
  return (
    <li className={css.hang} data-testid="chu-de-hang" data-mach-id={mach.id}>
      <div className={css.dau}>
        <Link
          className={css.sub}
          href={duongDanSub(mach.sub.slug)}
          prefetch={false}
          {...CHU_NGUOI_DUNG}
        >
          s/{mach.sub.slug}
        </Link>
        <span
          className={
            dang_mo ? `${khoiCss.chip} ${khoiCss.chip_mo}` : `${khoiCss.chip} ${khoiCss.chip_dong}`
          }
          data-testid="chu-de-trang-thai"
        >
          {dang_mo ? "Đang mở" : "Đã đóng"}
        </span>
        {mach.comment_count >= 1 && (
          <span data-testid="chu-de-so-binh-luan">{mach.comment_count} bình luận</span>
        )}
      </div>
      <h3 className={css.tieu_de}>
        <Link href={duongDanMach(mach.slug, mach.id)} prefetch={false} {...CHU_NGUOI_DUNG}>
          {mach.title}
        </Link>
      </h3>
      {!dang_mo && mach.ket_qua !== null && mach.ket_qua !== "" && (
        <p className={css.tong_ket} data-testid="chu-de-tong-ket">
          <span className={css.tong_ket_nhan}>Tổng kết:</span> {mach.ket_qua}
        </p>
      )}
    </li>
  );
}

/** Nội dung chính của `/chu-de`: `h1` + lede + danh sách chủ đề **nhóm theo tuần** (mới nhất
 * trước; trong trang, mục sắp theo `published_at` giảm dần chứ không theo thứ tự feed — xem
 * `nhomTheoTuan`) + phân trang bằng `<a href="/chu-de?cursor=…">` THẬT.
 *
 * Mọi thứ ở đây là server component, một HTML cho mọi người: link "Xem thêm chủ đề" nằm trong
 * HTML đầu tiên để bot bò hết kho (cùng lý lẽ `CuonVoHan`: cuộn vô hạn thuần JS cắt đường bot).
 * Kho không có cuộn vô hạn — mỗi trang 50 chủ đề, tức ~một năm chủ đề hằng tuần — nên link thật
 * là cơ chế phân trang duy nhất, không phải lớp dự phòng của một cơ chế khác.
 *
 * Rỗng ⇒ một dòng "Chưa có chủ đề nào." (không lỗi, không khung rỗng). `cursorHong`: `?cursor=`
 * không dùng được ⇒ đang hiện trang đầu, và nói ra như `Feed` làm. */
export function KhoChuDe({
  feed,
  cursorHong,
  cocCursor,
}: {
  feed: FeedOut;
  cursorHong: boolean;
  /** Trang này được mở bằng một `?cursor=` hợp lệ (không phải trang đầu). */
  cocCursor: boolean;
}) {
  const nhom = nhomTheoTuan(feed.items);
  return (
    <div data-testid="kho-chu-de">
      <h1 className={feedCss.tieu_de}>Chủ đề thảo luận</h1>
      <p className={feedCss.lede}>
        Mỗi chủ đề là một vấn đề cả cộng đồng cùng bàn trong tuần. Chủ đề đã đóng vẫn đọc được ở
        đây.
      </p>

      {cursorHong && <BaoCursorHong />}

      {cocCursor && !cursorHong && (
        <Link className={css.ve_dau} href="/chu-de" prefetch={false} data-testid="chu-de-ve-dau">
          ← Chủ đề mới nhất
        </Link>
      )}

      {feed.items.length === 0 ? (
        <p className={feedCss.rong} data-testid="chu-de-rong">
          Chưa có chủ đề nào.
        </p>
      ) : (
        nhom.map((t) => (
          <section
            key={t.khoa}
            className={css.tuan}
            data-testid="chu-de-tuan"
            data-tuan={t.khoa}
            aria-labelledby={`tuan-${t.khoa}`}
          >
            <h2 className={css.tieu_tuan} id={`tuan-${t.khoa}`} data-testid="chu-de-tuan-nhan">
              {t.nhan}
            </h2>
            <ul className={css.danh_sach}>
              {t.items.map((m) => (
                <HangChuDe key={m.id} mach={m} />
              ))}
            </ul>
          </section>
        ))
      )}

      {feed.cursor_ke_tiep !== null && (
        <Link
          className={feedCss.xem_them}
          href={`/chu-de?cursor=${encodeURIComponent(feed.cursor_ke_tiep)}`}
          prefetch={false}
          data-testid="chu-de-xem-them"
        >
          Xem thêm chủ đề →
        </Link>
      )}
    </div>
  );
}
