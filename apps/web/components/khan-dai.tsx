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
        <h3 className={css.dang_doc_tieu_de}>Đáng chú ý</h3>
        <p className={css.dang_doc_giai_thich}>
          Bình luận được chủ mạch trích vào sổ, cùng những câu điểm cao nhất.
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
 * ### Chữ trên màn hình ≠ chữ trong code *(user chốt 2026-08-24)*
 *
 * Tiêu đề hiện ra là **"Bình luận"**, con số là **"N cuộc trao đổi"**. Trước đó là
 * "Khán đài" + "N thread" — cả hai đều là tiếng lóng của người dựng sản phẩm, không phải
 * tiếng của người đọc.
 *
 * "N **cuộc trao đổi**" chứ không phải "N bình luận", và khác biệt ấy có thật:
 * `tong_thread` đếm **thread gốc**, không đếm reply lồng bên trong. Một mạch 24 bình luận
 * có thể chỉ có 9 thread — in "9 bình luận" ở đây là nói sai, mà chân trang ngay trên nó
 * lại in `💬 24 bình luận` từ một nguồn khác, nên hai con số sẽ cãi nhau ngay trên cùng
 * một màn hình.
 *
 * **Tên trong code giữ nguyên `khan-dai`** (component, `data-testid`, `id="khan-dai"`,
 * `?khan_dai=`, mọi hàng rào e2e). Đổi cả hai lớp cùng lúc là gộp một việc đổi chữ với
 * một việc đổi API — và PLAN vẫn gọi khu này là khán đài.
 *
 * Composer ở cuối là **bắt buộc có mặt**: PLAN 5.1 chốt "mạch đóng vẫn bình luận được",
 * nên chân khán đài phải kết thúc bằng chỗ để viết. **Từ Phase 2 nó SỐNG** (`Composer`,
 * thay cho ô `disabled` của 1c) — khách chưa đăng nhập thấy lời mời đăng nhập, mạch bị
 * mod khoá thấy câu giải thích, người đăng nhập thấy ô gõ thật.
 *
 * **Hai điều kiện mới của L05 (2026-08-23):**
 *
 * 1. Nó nhận `anchorMocSeq` — mốc mới nhất — và chip **đổi/gỡ được**. Trước đó khán đài
 *    gọi `<Composer />` không prop, nên mọi câu viết ở đây gửi `anchor_moc_seq: null` và
 *    không rơi vào ngăn kéo nào; mọi ngăn kéo cứ nói "Chưa ai neo bình luận vào mốc này"
 *    trong khi khán đài đầy chữ.
 * 2. `hienComposer` — mặt BÃO **tắt** nó. Ở đó `trang-mach.tsx` đã đặt một composer
 *    ngay trên cây khán đài (wireframe 9.2), nên giữ thêm cái ở cuối là dựng lại đúng ca
 *    "hai ô nhập trông y hệt nhau, hai luật neo khác nhau, cùng một trang" của L05. Cờ
 *    chứ không phải `anchorMocSeq === null`: "không neo" là một lựa chọn hợp lệ của
 *    người dùng, nó không được kiêm nghĩa "đừng vẽ ô nhập".
 *
 * **Nguyên tắc 9 áp ở ĐÂY nữa, không chỉ ở chân trang** (vá A2, 2026-08-22). Bản đầu của
 * 1c render `{tong_thread} thread` vô điều kiện, nên:
 *
 * - mạch 0 bình luận (21 mạch của `seed_e2e`) → chân trang nói đúng "Chưa có bình luận
 *   nào", bấm chính cái link ngay dưới nó ra **"Khán đài · 0 thread"** + `<ul>` rỗng.
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
  anchorMocSeq = null,
  hienComposer = true,
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
  /** Mốc composer khán đài neo mặc định — mốc MỚI NHẤT (PLAN 5.4 luật 3). */
  anchorMocSeq?: number | null;
  /** Mặt BÃO tắt cờ này: composer của nó nằm TRÊN cây, không ở cuối. */
  hienComposer?: boolean;
}) {
  if (khanDai.tong_thread === 0) {
    return (
      <section className={css.khu} id="khan-dai" data-testid="khan-dai">
        <div className={css.dau}>
          <h2>Bình luận</h2>
        </div>
        {/* Câu này viết lại 2026-08-25 (user: "nghe hơi phản cảm"). Bản cũ —
            *"Chưa có mấy ai nói gì — mở lời trước đi."* — sai hai chỗ, cả hai đều là
            giọng chứ không phải nội dung:

            1. **"chưa có mấy ai"** không phải một câu trung tính, nó là một nhận xét về
               ĐÁM ĐÔNG: "chẳng mấy ai buồn nói". Đó là quảng cáo sự vắng vẻ — đúng thứ
               PLAN loại `presence realtime` vì nó (*"hiển thị '0 đang xem' là quảng cáo
               công khai sự vắng vẻ — phản social proof"*).
            2. **"mở lời trước đi"** là một mệnh lệnh. Trang không ở vị thế sai bảo người
               đọc, và tiểu từ "đi" đọc lên là kẻ cả.

            Bản mới: nói đúng sự thật một lần, rồi MỜI. Không đếm, không nhận xét ai, và
            **không lặp lại câu hỏi trong ô soạn ngay trên** ("…bạn nghĩ sao?") — hai câu
            gần giống nhau trên một màn hình đọc như lỗi copy. */}
        <p className={css.mot_dong_moi} data-testid="khan-dai-mot-dong-moi">
          Chưa có bình luận nào — mời bạn nêu ý kiến.
        </p>
        {hienComposer && <Composer anchorMocSeq={anchorMocSeq} neoDoiDuoc />}
      </section>
    );
  }

  return (
    <section className={css.khu} id="khan-dai" data-testid="khan-dai">
      <div className={css.dau}>
        <h2>Bình luận</h2>
        {hienSoDem && (
          <span className={css.dem} data-testid="khan-dai-tong-thread">
            {khanDai.tong_thread} cuộc trao đổi
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

      {hienComposer && <Composer anchorMocSeq={anchorMocSeq} neoDoiDuoc />}
    </section>
  );
}

// `ComposerTat` (ô nhập `disabled` + "Đăng nhập để bình luận") ĐÃ ĐƯỢC GỠ ở Phase 2 —
// `components/composer.tsx` thay chỗ nó và làm thật. Ghi lại ở đây thay vì xoá không dấu
// vết, vì hai bài đo của 1c (`mach-can.spec.ts`) khẳng định vào `composer-o-nhap` và
// `composer-moi-dang-nhap`; chúng được sửa cùng lượt này, và ai đọc git blame sẽ thấy
// đường nối.
