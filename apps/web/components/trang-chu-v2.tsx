import type { BinhLuanOut, FeedOut } from "@gikky/api-client";
import { Bot, Plus } from "lucide-react";
import Link from "next/link";

import { tomTatChanKhoi } from "@/lib/chan-khoi-nhat-ky";

import { Avatar } from "./avatar";
import feedCss from "./feed.module.css";
import { KhoiThaoLuan } from "./khoi-thao-luan";
import { LoiVaoNhatKy } from "./loi-vao-nhat-ky";
import { TheMach } from "./the-mach";
import css from "./trang-chu-v2.module.css";

/** Số mục của từng khối — một nguồn cho cả `app/page.tsx` (gọi API với `limit`) lẫn các bài đo.
 *
 * - `SO_NHAT_KY` = số THẺ nhật ký vẽ ra (mỗi tác giả một bài, endpoint
 *   `/feeds/nhat-ky-moi-tac-gia`). Trang TẢI `SO_NHAT_KY_TAI` tác giả (trần của endpoint) để
 *   dải chân khối biết còn bao nhiêu người đứng sau 8 thẻ đầu mà không gọi thêm API;
 * - chủ đề chỉ VẼ MỘT (user 2026-11-10), nhưng TẢI `SO_CHU_DE_TAI` cái để `KhoiThaoLuan` chọn
 *   cái xuất bản sau cùng: feed `moi` sắp theo `last_content_at`, nên phần tử đầu của nó có thể
 *   là chủ đề cũ vừa được nối mốc (vòng sửa 4);
 * - bài viết: MỘT lời gọi `SO_BAI_VIET_TAI` bài rồi chia nhóm ở web (`lib/nhom-bai-viet.ts`). */
export const SO_NHAT_KY = 8;
export const SO_NHAT_KY_TAI = 20;
export const SO_CHU_DE_TAI = 5;

/** Tab của khối nhật ký — LINK THẬT tới feed cũ có lọc `trang_thai` (plan §6.3), không phải
 * nút đổi state: feed cũ là nơi duy nhất xem hết, và link là thứ bot bò được. "Mới nhất" là
 * chính khối này (mỗi tác giả một bài) nên `aria-current`; hai tab kia rời khối đi xem feed. */
const TAB_NHAT_KY = [
  { khoa: "moi", nhan: "Mới nhất", href: "/?tab=moi&loai_mach=nhat_ky" },
  { khoa: "open", nhan: "Đang mở", href: "/?tab=moi&loai_mach=nhat_ky&trang_thai=open" },
  { khoa: "closed", nhan: "Đã đóng sổ", href: "/?tab=moi&loai_mach=nhat_ky&trang_thai=closed" },
] as const;

/** Nội dung CHÍNH (trong khung hai cột) của trang chủ v2: dòng giới thiệu → **Chủ đề tuần →
 * Nhật ký mới** *(plan `2026-11-11-homepage-v2-giao-dien-moi.md`; nối tiếp
 * `2026-11-10-homepage-v2.md`)*. Section "Bài viết" (`KhoiBaiViet`) là phần THỨ BA của trang
 * và **ra ngoài khung hai cột**, trải hết chiều ngang dưới cả rail — nên `app/page.tsx` dựng
 * `<VoKhungHaiCot>` quanh component này rồi đặt `KhoiBaiViet` ngay sau nó, cả hai trong một
 * `data-testid="trang-chu-v2"`. Cả hai nằm trong HTML đầu tiên (server component) để bot thấy đủ.
 *
 * `<h1>` và lede nhận từ ngoài để chữ của chúng sống ở MỘT chỗ (`app/page.tsx`) cho cả trang v2
 * lẫn feed cũ ở `/?tab=…` — và GIỮ TỪNG BYTE (SEO, `seo-trang-chu.spec.ts`); chỉ cỡ chữ nhỏ đi,
 * vì tiêu điểm nay là câu hỏi của chủ đề. Lede PHẢI là thẻ `<p>` đầu tiên sau `<h1>`: bài đo SEO
 * đọc nó theo thứ tự tài liệu — nên nút "Mở nhật ký" dời xuống ô soạn nhanh của khối nhật ký.
 *
 * Mọi thứ ở đây là **server component**, một HTML cho mọi người: không có nhánh theo User-Agent. */
export function TrangChuV2({
  tieuDe,
  lede,
  chuDe,
  quanDiemGoc,
  quanDiemMoi,
  nhatKy,
  bayGio,
}: {
  tieuDe: string;
  lede: string;
  chuDe: FeedOut;
  /** Bình luận gốc của chủ đề được chọn (`docBinhLuanGoc`); rỗng nếu chưa có / không có chủ đề. */
  quanDiemGoc: readonly BinhLuanOut[];
  /** Bình luận gốc MỚI NHẤT của cùng chủ đề (`docBinhLuanGocMoiNhat`) — nguồn của "Quan điểm mới". */
  quanDiemMoi: readonly BinhLuanOut[];
  /** Mỗi tác giả một bài, tối đa `SO_NHAT_KY_TAI` (API lọc sẵn); `cursor_ke_tiep` luôn `null`. */
  nhatKy: FeedOut;
  bayGio: Date;
}) {
  const hien = nhatKy.items.slice(0, SO_NHAT_KY);
  const con_lai = nhatKy.items.slice(SO_NHAT_KY);
  const chan = tomTatChanKhoi(con_lai, nhatKy.items.length >= SO_NHAT_KY_TAI, bayGio);

  return (
    <>
      <h1 className={css.gioi_thieu_h1}>{tieuDe}</h1>
      <p className={css.gioi_thieu_lede}>{lede}</p>

      {/* Chủ đề đứng ĐẦU và là tiêu điểm; ẩn hẳn khi chưa có chủ đề nào. */}
      <KhoiThaoLuan
        chu_de={chuDe.items}
        binh_luan_goc={quanDiemGoc}
        binh_luan_moi={quanDiemMoi}
        bay_gio={bayGio}
      />

      <section
        className={css.khoi}
        data-testid="khoi-nhat-ky"
        aria-labelledby="tieu-khoi-nhat-ky"
      >
        <header className={css.dau_khoi}>
          <div>
            <h2 className={css.tieu_khoi} id="tieu-khoi-nhat-ky">
              Nhật ký mới
            </h2>
            <p className={css.mo_ta}>
              Mỗi người ghi quyết định của mình trước khi có kết quả. Mọi mốc mang dấu thời gian
              máy chủ.
            </p>
          </div>
          <Link
            className={css.xem_tat_ca}
            href="/?tab=moi&loai_mach=nhat_ky"
            prefetch={false}
            data-testid="nhat-ky-tat-ca"
          >
            Tất cả nhật ký →
          </Link>
        </header>

        {/* Ô soạn nhanh (desktop): một LINK tới `/dang-mach` — không phải form mới. Người đã đăng
            nhập bấm vào thì mở NGĂN KÉO đăng nhanh (`LoiVaoNhatKy`); HTML vẫn là `<a href>`.
            Riêng tư → công khai là MỘT CHIỀU, và mốc đã ghi sửa được nhưng để lại dấu vết
            (GHI-CHU việc 7): nên câu phụ chỉ hứa đúng chừng ấy — và KHÔNG gợi ý riêng tư là mặc định (form `/dang-mach` mặc định công khai). */}
        <div className={css.soan_nhanh} data-testid="nhat-ky-soan-nhanh">
          <LoiVaoNhatKy className={css.o_soan} data-testid="nhat-ky-o-soan">
            Bạn vừa quyết định gì?
          </LoiVaoNhatKy>
          <div className={css.soan_dong}>
            <span className={css.goi_y}>Có thể ghi riêng tư, công khai khi bạn muốn.</span>
            <LoiVaoNhatKy className={css.nut_mo} data-testid="nut-mo-nhat-ky">
              Mở nhật ký
            </LoiVaoNhatKy>
          </div>
        </div>

        <nav className={css.tab} aria-label="Lọc nhật ký" data-testid="nhat-ky-tab">
          {TAB_NHAT_KY.map((t) => (
            <Link
              key={t.khoa}
              className={t.khoa === "moi" ? `${css.mot_tab} ${css.tab_dang_chon}` : css.mot_tab}
              href={t.href}
              prefetch={false}
              aria-current={t.khoa === "moi" ? "true" : undefined}
              data-testid={`nhat-ky-tab-${t.khoa}`}
            >
              {t.nhan}
            </Link>
          ))}
        </nav>

        {hien.length === 0 ? (
          <p className={feedCss.rong} data-testid="nhat-ky-rong">
            Chưa có nhật ký công khai nào —{" "}
            <LoiVaoNhatKy className={css.loi_moi}>mở nhật ký đầu tiên</LoiVaoNhatKy>
          </p>
        ) : (
          <ul className={css.danh_sach} data-testid="feed-nhat-ky">
            {hien.map((m) => (
              <TheMach key={m.id} mach={m} capHeading={3} />
            ))}
          </ul>
        )}

        {/* Chân khối thay nút "Xem thêm nhật ký": cả dải là MỘT `<a>`. */}
        <Link
          className={css.chan_khoi}
          href="/?tab=moi&loai_mach=nhat_ky"
          prefetch={false}
          data-testid="nhat-ky-chan-khoi"
        >
          {con_lai.length > 0 && (
            <span className={css.chan_avatar} aria-hidden="true">
              {con_lai.slice(0, 3).map((m) => (
                <span key={m.id} className={css.chan_avatar_o}>
                  {m.author.la_bot ? (
                    <span className={css.chan_avatar_bot}>
                      <Bot size={13} aria-hidden />
                    </span>
                  ) : (
                    <Avatar
                      ten={m.author.username}
                      hienThi={m.author.display_name}
                      url={m.author.avatar_url}
                      co={26}
                    />
                  )}
                </span>
              ))}
            </span>
          )}
          <span className={css.chan_chu}>
            <b>{chan.dam}</b> {chan.nhat !== "" && <span>{chan.nhat}</span>}
          </span>
          {chan.n !== null && <span className={css.chan_xem}>Xem tất cả →</span>}
        </Link>

        {/* Mobile: nút dính đáy thay cho ô soạn nhanh. `sticky` trong chính khối, nên nó tự
            nhả khi cuộn qua hết khối nhật ký. */}
        <div className={css.dinh_day}>
          <LoiVaoNhatKy className={css.nut_ghi} data-testid="nut-ghi-nhat-ky-di-dong">
            <Plus size={16} strokeWidth={2.4} aria-hidden />
            Ghi nhật ký
          </LoiVaoNhatKy>
        </div>
      </section>
    </>
  );
}
