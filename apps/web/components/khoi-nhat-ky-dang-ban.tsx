import type { NhatKyDangBanMucOut } from "@gikky/api-client";
import { Bot } from "lucide-react";
import Link from "next/link";

import { dauThoiGianServer } from "@/lib/dinh-dang";
import { hrefChipLoai } from "@/lib/loc-loai-mach";
import { tenHienThi } from "@/lib/ten-hien-thi";
import { duongDanMach } from "@/lib/url";

import { Avatar } from "./avatar";
import css from "./khoi-nhat-ky-dang-ban.module.css";

/** "Xem thêm →": feed "Đang diễn ra" lọc nhật ký — dựng bằng CÙNG hàm với chip loại của `Feed`. */
const HREF_XEM_THEM = hrefChipLoai("/", { tab: "dang-dien-ra", khoang: "tat_ca" }, "nhat_ky");

/** Dải "Đang được bàn" ngay dưới khối "Nhật ký mới" của `/` (plan `2026-11-13-nhat-ky-dang-ban.md`):
 * nhật ký có nhiều bình luận gần đây, kể cả bài CŨ mà khối trên (mỗi tác giả một bài mới nhất) đã
 * đẩy ra. `muc` đã bỏ trùng với 8 thẻ khối trên và đã cắt (`lib/nhat-ky-dang-ban.ts::chonDangBan`).
 *
 * **Rỗng thì không vẽ gì cả** — không khung trống, không câu "chưa có": site vắng thì dải biến mất.
 * Mỗi mục một hàng gọn (không dùng `TheMach` to), link thẳng tới khán đài (`#khan-dai`, neo có
 * sẵn của trang mạch — cùng neo con số 💬 trên thẻ mạch). Server component. */
export function KhoiNhatKyDangBan({
  muc,
  cuaSoGio,
}: {
  muc: readonly NhatKyDangBanMucOut[];
  cuaSoGio: number;
}) {
  if (muc.length === 0) return null;
  return (
    <section
      className={css.khoi}
      data-testid="khoi-nhat-ky-dang-ban"
      aria-labelledby="tieu-khoi-nhat-ky-dang-ban"
    >
      <header className={css.dau}>
        <div>
          <h2 className={css.tieu} id="tieu-khoi-nhat-ky-dang-ban">
            Đang được bàn
          </h2>
          <p className={css.mo_ta}>Nhật ký có nhiều bình luận trong {cuaSoGio} giờ qua</p>
        </div>
        <Link
          className={css.xem_them}
          href={HREF_XEM_THEM}
          prefetch={false}
          data-testid="dang-ban-xem-them"
        >
          Xem thêm →
        </Link>
      </header>
      <ul className={css.danh_sach}>
        {muc.map(({ mach, so_binh_luan_gan_day, binh_luan_cuoi_at }) => (
          <li key={mach.id} className={css.hang} data-testid="dang-ban-muc" data-mach-id={mach.id}>
            <Link
              className={css.tieu_de}
              href={`${duongDanMach(mach.slug, mach.id)}#khan-dai`}
              prefetch={false}
            >
              {mach.title}
            </Link>
            <span className={css.phu}>
              <span className={css.tac_gia}>
                {mach.author.la_bot ? (
                  <span className={css.avatar_bot}>
                    <Bot size={12} aria-hidden />
                  </span>
                ) : (
                  <Avatar
                    ten={mach.author.username}
                    hienThi={mach.author.display_name}
                    url={mach.author.avatar_url}
                    co={20}
                  />
                )}
                <span className={css.ten}>{tenHienThi(mach.author)}</span>
              </span>
              <span className={css.dem}>{so_binh_luan_gan_day} bình luận mới</span>
              <time className={css.luc} dateTime={binh_luan_cuoi_at}>
                {dauThoiGianServer(binh_luan_cuoi_at)}
              </time>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
