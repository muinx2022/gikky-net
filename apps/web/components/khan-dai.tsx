import type { KhanDaiOut } from "@gikky/api-client";
import Link from "next/link";

import {
  NHAN_SORT,
  SAU_KHAN_DAI,
  SORT_KHAN_DAI,
  type SortKhanDai,
} from "@/lib/khan-dai";

import { BinhLuan, DanhSachBinhLuan } from "./binh-luan";
import css from "./khan-dai.module.css";

/** Chân trang mặt CẶN khi khán đài **chưa bung** — PLAN 5.5:
 *
 *     💬 247 bình luận · [xem các câu đáng đọc ▾]
 *
 * Bấm là đi tới cùng URL kèm `?khan_dai=1`. Dùng URL chứ không dùng state client là có
 * lý do: PLAN 5.5 đòi khán đài bung ra "đổi được 3 sort", mà sort đã sống trên URL
 * (`?sort=`) — hai nửa của cùng một trạng thái nằm ở hai chỗ thì bấm Back sẽ ra một
 * trang không ai đoán được. Kèm theo: link chia sẻ dẫn thẳng tới khán đài đang mở.
 */
export function LoiMoiBungKhanDai({
  soBinhLuan,
  hienSoDem,
  href,
}: {
  soBinhLuan: number;
  hienSoDem: boolean;
  href: string;
}) {
  return (
    <div className={css.khu} data-testid="chan-trang-khan-dai">
      {hienSoDem ? (
        <p className={css.dem} data-testid="chan-so-binh-luan">
          💬 {soBinhLuan} bình luận
        </p>
      ) : (
        // Nguyên tắc 9: dưới 4 bình luận thì khán đài "thu về một dòng mời", không con
        // số nào. Không bao giờ hiện "💬 0".
        <p className={css.mot_dong_moi} data-testid="chan-mot-dong-moi">
          Chưa có mấy ai nói gì — mở lời trước đi.
        </p>
      )}
      <Link className={css.moi_bung_khan_dai} href={href} data-testid="nut-bung-khan-dai">
        xem các câu đáng đọc ▾
      </Link>
    </div>
  );
}

/** Khán đài đã bung: 3 sort đổi qua URL param + composer ở cuối (PLAN 5.5).
 *
 * `composerTat` là **bắt buộc có mặt** dù chưa dùng được: PLAN 5.1 chốt "mạch đóng vẫn
 * bình luận được", nên chân khán đài phải kết thúc bằng chỗ để viết. Phase 2 mới có
 * auth, nên ở 1c nó là ô nhập `disabled` kèm lời mời đăng nhập — có chỗ đứng, không giả
 * vờ chạy được.
 *
 * **Nguyên tắc 9 áp ở ĐÂY nữa, không chỉ ở chân trang** (vá A2, 2026-08-22). Bản đầu của
 * 1c render `{tong_thread} thread` vô điều kiện, nên:
 *
 * - mạch 0 bình luận (21 mạch của `seed_e2e`) → chân trang nói đúng "Chưa có mấy ai nói
 *   gì", bấm chính cái link ngay dưới nó ra **"Khán đài · 0 thread"** + `<ul>` rỗng.
 *   PLAN nguyên tắc 9: *"Không bao giờ hiển thị '0 bình luận'… không phô sự im lặng"*;
 * - post thường 2 bình luận → **"2 thread"**, trong khi V8 vừa chứng minh trang đó phải
 *   im lặng về mọi con số.
 *
 * Nên: `tong_thread === 0` thay cả khối bằng dòng mời + composer (KHÔNG render `<ul>`
 * rỗng, không render thanh sort của một danh sách trống), và con số chỉ hiện khi
 * `hienSoDem`.
 *
 * **Cửa thứ hai của cùng luật đó: trang RỖNG của một danh sách KHÔNG rỗng** (vá D5,
 * 2026-08-22). `?khan_dai=1&sort=hay_nhat&offset=9999` trả `tong_thread` nguyên vẹn kèm
 * `threads = []` — nhánh trên chỉ hỏi `tong_thread`, nên nó không bắt, và header "N
 * thread" + thanh sort + một `<ul>` rỗng vẫn ra màn hình. Ở đây câu trả lời khác nhánh
 * trên: danh sách có thật, chỉ trang này nằm ngoài dải, nên giữ nguyên header và thanh
 * sort mà đổi phần thân thành lời giải thích kèm đường quay về trang đầu.
 */
export function KhanDai({
  khanDai,
  sort,
  hrefSort,
  hrefXemThem,
  duongDanKhanDai,
  hienSoDem,
}: {
  khanDai: KhanDaiOut;
  sort: SortKhanDai;
  hrefSort: (s: SortKhanDai) => string;
  hrefXemThem: string | null;
  duongDanKhanDai: string;
  /** Nguyên tắc 9 — mạch dưới 4 bình luận thì ẩn mọi số đếm. */
  hienSoDem: boolean;
}) {
  if (khanDai.tong_thread === 0) {
    return (
      <section className={css.khu} id="khan-dai" data-testid="khan-dai">
        <div className={css.dau}>
          <h2>Khán đài</h2>
        </div>
        <p className={css.mot_dong_moi} data-testid="khan-dai-mot-dong-moi">
          Chưa có mấy ai nói gì — mở lời trước đi.
        </p>
        <ComposerTat />
      </section>
    );
  }

  return (
    <section className={css.khu} id="khan-dai" data-testid="khan-dai">
      <div className={css.dau}>
        <h2>Khán đài</h2>
        {hienSoDem && (
          <span className={css.dem} data-testid="khan-dai-tong-thread">
            {khanDai.tong_thread} thread
          </span>
        )}
      </div>

      <div className={css.thanh_sort} data-testid="thanh-sort">
        <span className={css.nhan_sort}>Sắp xếp:</span>
        {SORT_KHAN_DAI.map((s) => (
          <Link
            key={s}
            href={hrefSort(s)}
            className={s === sort ? `${css.sort} ${css.sort_dang_chon}` : css.sort}
            aria-current={s === sort ? "true" : undefined}
            data-testid={`sort-${s}`}
          >
            {NHAN_SORT[s]}
          </Link>
        ))}
      </div>

      {khanDai.threads.length === 0 ? (
        // `tong_thread > 0` mà trang này rỗng ⇒ người ta đang đứng ở một trang NGOÀI dải,
        // gần như luôn là `?offset=` gõ tay (vá D5, 2026-08-22). Trước đợt vá chỗ này
        // render một `<ul>` rỗng dưới header "24 thread" + thanh sort — đúng cái A2 vừa
        // cấm ở nhánh trên, chỉ khác lối vào. Có đường quay về, không chỉ có lời báo.
        <p className={css.trang_rong} data-testid="khan-dai-trang-rong" role="status">
          Trang này không còn bình luận nào.{" "}
          <Link href={duongDanKhanDai} data-testid="khan-dai-ve-trang-dau">
            Về trang đầu
          </Link>
        </p>
      ) : (
        <div className={css.danh_sach}>
          <DanhSachBinhLuan data-testid="cay-khan-dai">
            {khanDai.threads.map((n) => (
              <BinhLuan
                key={n.id}
                nut={n}
                doSauToiDa={SAU_KHAN_DAI}
                duongDanKhanDai={duongDanKhanDai}
                datNeo
              />
            ))}
          </DanhSachBinhLuan>
        </div>
      )}

      {hrefXemThem !== null && (
        <Link className={css.xem_them} href={hrefXemThem} data-testid="khan-dai-xem-them">
          xem thêm bình luận ↓
        </Link>
      )}

      <ComposerTat />
    </section>
  );
}

/** Composer **disabled** — 1c không có thao tác ghi nào hoạt động được (Phase 2). */
export function ComposerTat() {
  return (
    <div className={css.composer} data-testid="composer">
      <textarea
        className={css.o_nhap}
        disabled
        data-testid="composer-o-nhap"
        aria-label="Viết bình luận"
        placeholder="Chém gió với chủ mạch…"
      />
      <p className={css.moi_dang_nhap} data-testid="composer-moi-dang-nhap">
        Đăng nhập để bình luận.
      </p>
    </div>
  );
}
