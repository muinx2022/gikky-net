import type { KhanDaiOut } from "@gikky/api-client";
import Link from "next/link";

import {
  NHAN_SORT,
  SAU_KHAN_DAI,
  SORT_KHAN_DAI,
  type SortKhanDai,
  nenRenderCauDangDoc,
} from "@/lib/khan-dai";

import { BinhLuan, DanhSachBinhLuan } from "./binh-luan";
import { Composer } from "./composer";
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

/** Khối "Câu đáng đọc" — PLAN 5.5, chốt 2026-08-22.
 *
 * **Vì sao nó tồn tại:** cái nút ở chân trang mặt CẶN ghi *"xem các câu đáng đọc ▾"*, và
 * ở 1c cú bấm giao ra **toàn bộ khán đài** — phép hợp `đã trích ∪ top-10 wilson` không
 * tồn tại ở đâu cả. Nhãn hứa một thứ mà cú bấm không giao. PLAN chốt cách chữa: vẫn bung
 * khán đài đầy đủ, nhưng phần TRÊN CÙNG của khối vừa bung là tập hợp ấy, gắn nhãn, rồi
 * mới tới cây đầy đủ.
 *
 * Tập này do **server** tính (`?dang_doc=1`) — PLAN nguyên tắc 10: luật domain ở Django,
 * frontend chỉ render. Tính lại ở đây là dựng bản thứ hai của một công thức mà API đã có,
 * và bản thứ hai chỉ có `hay_nhat` trang 1 để nhìn nên nó sẽ sai ở mạch trên 50 thread.
 *
 * `null` (API hỏng lẻ ở đúng lời gọi này) ⇒ **không render khối**, và đó là lựa chọn có
 * ý thức: cây đầy đủ ngay dưới vẫn còn nguyên, nên mất khối này là mất một lối tắt chứ
 * không mất nội dung. Ngược lại, để cả trang mạch 500 vì một khối phụ mới là hỏng nặng
 * hơn thứ nó chữa.
 */
export function CauDangDoc({
  tap,
  duongDanKhanDai,
}: {
  tap: KhanDaiOut | null;
  duongDanKhanDai: string;
}) {
  // Khối không lọc được gì ⇒ không render: nó sẽ chép lại y nguyên cây ngay dưới nó.
  // "Câu đáng đọc" là một phép LỌC; khi nó không lọc được gì thì thứ nó thêm vào chỉ là
  // hai bản của cùng một danh sách, và người đọc phải tự đoán vì sao mình thấy mọi bình
  // luận hai lần.
  //
  // Phép quyết định nằm ở `lib/khan-dai.ts` và đọc CON SỐ API TRẢ VỀ, không so hai kích
  // thước — xem `nenRenderCauDangDoc` về việc so hai kích thước sai ở đâu (Y1).
  if (!nenRenderCauDangDoc(tap)) return null;
  return (
    <section className={css.dang_doc} data-testid="cau-dang-doc">
      <div className={css.dang_doc_dau}>
        <h3 className={css.dang_doc_tieu_de}>Câu đáng đọc</h3>
        <p className={css.dang_doc_giai_thich}>
          Bình luận đã được chủ mạch trích vào sổ, cộng những câu được đánh giá cao nhất.
        </p>
      </div>
      <DanhSachBinhLuan data-testid="cay-cau-dang-doc">
        {tap.threads.map((n) => (
          <BinhLuan
            key={n.id}
            nut={n}
            doSauToiDa={SAU_KHAN_DAI}
            duongDanKhanDai={duongDanKhanDai}
            // `datNeo` TẮT ở đây: khối này và cây đầy đủ bên dưới render cùng những
            // bình luận ấy, và hai phần tử cùng mang `id="bl-<id>"` là HTML trùng id —
            // trình duyệt cuộn tới cái nào là chuyện hên xui. Neo thuộc về cây đầy đủ.
          />
        ))}
      </DanhSachBinhLuan>
    </section>
  );
}

/** Khán đài đã bung: 3 sort đổi qua URL param + composer ở cuối (PLAN 5.5).
 *
 * Composer ở cuối là **bắt buộc có mặt**: PLAN 5.1 chốt "mạch đóng vẫn bình luận được",
 * nên chân khán đài phải kết thúc bằng chỗ để viết. **Từ Phase 2 nó SỐNG** (`Composer`,
 * thay cho ô `disabled` của 1c) — khách chưa đăng nhập thấy lời mời đăng nhập, mạch bị
 * mod khoá thấy câu giải thích, người đăng nhập thấy ô gõ thật.
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
  cauDangDoc = null,
}: {
  khanDai: KhanDaiOut;
  sort: SortKhanDai;
  hrefSort: (s: SortKhanDai) => string;
  hrefXemThem: string | null;
  duongDanKhanDai: string;
  /** Nguyên tắc 9 — mạch dưới 4 bình luận thì ẩn mọi số đếm. */
  hienSoDem: boolean;
  /** Tập "câu đáng đọc" do server tính (`?dang_doc=1`), hoặc `null` để không render khối. */
  cauDangDoc?: KhanDaiOut | null;
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
        <Composer />
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

      {/* TRÊN CÙNG của khối vừa bung, trước cả thanh sort — PLAN 5.5 chốt đúng vị trí
          này. Đặt nó dưới cây là để cái nhãn trên nút vẫn hứa suông. */}
      <CauDangDoc tap={cauDangDoc} duongDanKhanDai={duongDanKhanDai} />

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

      <Composer />
    </section>
  );
}

// `ComposerTat` (ô nhập `disabled` + "Đăng nhập để bình luận") ĐÃ ĐƯỢC GỠ ở Phase 2 —
// `components/composer.tsx` thay chỗ nó và làm thật. Ghi lại ở đây thay vì xoá không dấu
// vết, vì hai bài đo của 1c (`mach-can.spec.ts`) khẳng định vào `composer-o-nhap` và
// `composer-moi-dang-nhap`; chúng được sửa cùng lượt này, và ai đọc git blame sẽ thấy
// đường nối.
