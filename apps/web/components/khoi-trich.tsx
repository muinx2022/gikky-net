import type { TrichOut } from "@gikky/api-client";
import Link from "next/link";

import { ngayNganCuaThoiDiem } from "@/lib/dinh-dang";
import { neoBinhLuan, trangThaiDeepLink } from "@/lib/khan-dai";
import { duongDanHoSo } from "@/lib/url";

import css from "./khoi-trich.module.css";
import { ThanVan } from "./than-van";

/** Khối "trích vào sổ" gắn trên thẻ mốc — PLAN 5.6, rào 2 và rào 4.
 *
 * **Rào 2 — ĐỦ HAI DẤU THỜI GIAN.** "viết 10/06, trích 21/08". Đây không phải chi tiết
 * trang trí: bỏ một trong hai là mở đường cho trích hậu nghiệm — chủ mạch đợi tới lúc
 * biết kết quả rồi mới trích câu "hoá ra đúng", và cuốn sổ đọc như tiên tri. Khoảng cách
 * giữa hai con số CHÍNH LÀ thông tin. Hai `data-testid` riêng để bài đo bắt được từng
 * cái một.
 *
 * **Rào 4 — render tách bạch khỏi thân mốc**, ghi rõ "trích từ khán đài, bởi chủ mạch":
 * nó là chú thích, không phải nội dung sổ.
 *
 * `trang_thai === "da_xoa"`: người viết đã xoá bình luận gốc SAU khi nó vào sổ. Chữ vẫn
 * ở nguyên đây — PLAN 5.6 dựng "cuốn sổ không-xoá-được" đúng để chống việc rút chữ ra.
 * (Bị **mod ẩn** thì API đã bỏ hẳn khối này, không có trạng thái nào tới được đây.)
 */
export function KhoiTrich({
  trich,
  mocSeq,
  idTrongTrangKhanDai,
  duongDanKhanDai,
}: {
  trich: TrichOut;
  mocSeq: number;
  /** `id` bình luận có mặt trong TRANG khán đài mà trang này sẽ render. */
  idTrongTrangKhanDai: ReadonlySet<number>;
  duongDanKhanDai: string;
}) {
  const nhay = trangThaiDeepLink(trich.comment_id, idTrongTrangKhanDai);

  return (
    <figure className={css.khoi} data-testid={`trich-moc-${mocSeq}`}>
      <figcaption className={css.chu_thich} data-testid="trich-chu-thich">
        Trích từ khán đài, bởi chủ mạch
      </figcaption>
      <blockquote className={css.loi} data-testid="trich-loi">
        <ThanVan body={trich.body} />
      </blockquote>
      <div className={css.ky}>
        <Link href={duongDanHoSo(trich.author.username)}>u/{trich.author.username}</Link>
        <span className={css.dau_thoi_gian} data-testid="trich-viet">
          viết {ngayNganCuaThoiDiem(trich.comment_created_at)}
        </span>
        <span className={css.dau_thoi_gian} data-testid="trich-trich">
          trích {ngayNganCuaThoiDiem(trich.trich_created_at)}
        </span>
        {trich.trang_thai === "da_xoa" && (
          <span className={css.da_xoa} data-testid="trich-goc-da-xoa">
            (người viết đã xoá bình luận gốc — chữ ở đây thuộc về sổ)
          </span>
        )}
        {nhay === "cuon_duoc" ? (
          <Link
            className={css.nhay}
            data-testid="trich-nhay-khan-dai"
            href={`${duongDanKhanDai}#${neoBinhLuan(trich.comment_id)}`}
          >
            nhảy tới khán đài ↓
          </Link>
        ) : (
          // Nợ 1b #8 — `hay_nhat` chỉ trả 50 thread gốc đầu, bia mộ nằm đáy bảng xếp
          // hạng. Không nhảy được thì phải NÓI RA: một nút bấm rồi không đi đâu là lỗi
          // người dùng không có cách nào hiểu.
          <span className={css.khong_nhay} data-testid="trich-khong-nhay-duoc">
            bình luận này nằm ở trang sau của khán đài — chưa nhảy tới được
          </span>
        )}
      </div>
    </figure>
  );
}
