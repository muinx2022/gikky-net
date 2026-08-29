"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import css from "./ngan-keo.module.css";

/** Ngăn kéo — PLAN 5.4, bốn luật. Ba luật quyết định file này:
 *
 * 1. **Accordion**: mở ngăn kéo mốc khác thì cái đang mở gập lại. Đó là lý do trạng thái
 *    nằm ở MỘT context dùng chung cho cả timeline, không phải `useState` trong từng thẻ
 *    mốc — mỗi thẻ tự giữ trạng thái thì bốn ngăn kéo mở cùng lúc và luật 1 chỉ còn là
 *    lời hứa trong plan.
 * 2. Sort trong ngăn kéo **không cho chỉnh** — không có nút sort nào ở đây, server đã sắp
 *    sẵn (`GET /mocs/{id}/comments`). Chiều thì **không còn là một chiều**: từ 2026-08-26
 *    ngăn kéo dùng đúng cặp khoá của `moi_nhat` — thread gốc theo **hoạt động mới nhất**
 *    (một reply mới đẩy cả cuộc trao đổi lên đầu), reply bên trong đọc **xuôi** cũ → mới.
 *    Vì thế tiêu đề khoang **bỏ hẳn hậu tố chiều**: câu "cũ → mới" cũ đã sai (server sắp
 *    ngược), mà "mới → cũ" cũng sai nốt (nó chỉ đúng cho gốc). Một nhãn sai tệ hơn không
 *    có nhãn. Luật đầy đủ ở `core/doc_noi_dung.py::lat_cat_ngan_keo`.
 * 4. Mốc 0 bình luận **không hiện `💬 0`** mà hiện lời mời + `question_for_crowd` nếu có
 *    (cũng là nguyên tắc 9 — không phô sự im lặng).
 *
 * ⚠ **Ngăn kéo nay là PHÒNG, không còn là cửa sổ** *(user chốt 2026-08-26)*. Thread neo
 * mốc N render **duy nhất** ở đây; khán đài chỉ giữ thread không neo. Hai hệ quả sống
 * trong file này: nó phải mở được từ một deep-link `#bl-N` (xem `NganKeoProvider`), và độ
 * sâu render của nó bằng khán đài (`SAU_NGAN_KEO`, `lib/khan-dai.ts`).
 *
 * Luật 3 (composer tự neo mốc) thuộc Phase 2: 1c chưa có thao tác ghi nào hoạt động.
 */

type Ctx = {
  dangMo: number | null;
  doiMo: (seq: number) => void;
};

const NganKeoCtx = createContext<Ctx | null>(null);

function useNganKeo(): Ctx {
  const c = useContext(NganKeoCtx);
  if (c === null) {
    throw new Error(
      "Thiếu <NganKeoProvider> bọc ngoài — accordion không có chỗ giữ trạng thái.",
    );
  }
  return c;
}

/** Bấm mở MỌI tổ tiên đang gập của `dich`, bằng **chính công tắc của chúng**.
 * Trả `true` nếu có bấm ít nhất một cái — tức còn phải chờ React commit rồi thử lại.
 *
 * ## Vì sao đi theo `aria-controls` chứ không gọi thẳng state
 *
 * Trang mạch có **BA** thứ gập được, ba `useState` ở ba component khác nhau:
 *
 * | khoang | `id` | công tắc |
 * |---|---|---|
 * | ngăn kéo mốc N | `ngan-keo-<N>` | `NutNganKeo` (file này) |
 * | dải gập mặt CẶN | `dai-gap-noi-dung` | `DaiGapBung` (`dai-gap.tsx`) |
 * | dải gập mặt BÃO | `dai-gap-bao-noi-dung` | `MatBao` (`mat-bao.tsx`) |
 *
 * Cả ba đã sẵn cặp `id` ↔ `aria-controls` vì lý do trợ năng, nên cái "sổ đăng ký" mà cơ
 * chế này cần **đã tồn tại trong HTML** — không phải dựng thêm context, không phải xâu
 * prop qua ba tầng, và không phải nâng state của người khác lên chỗ này. Thêm một khoang
 * gập thứ tư mà khai đúng `aria-controls` là nó tự được phục vụ.
 *
 * Chỉ bấm khi khoang **đang** `hidden`, nên một công tắc hai chiều (`doiMo` của ngăn kéo,
 * `datBung((cu) => !cu)` của dải gập) không bao giờ bị bấm thành ĐÓNG.
 *
 * ⚠ **Đây là chỗ NẶNG-1 từng chết** *(phản biện 2026-08-27)*: bản trước chỉ biết mở ngăn
 * kéo, nên một bình luận neo mốc nằm TRONG dải gập vẫn `display:none` sau khi ngăn kéo mở
 * — `scrollIntoView` thành lệnh rỗng, và cờ đã-xử-lý vẫn bị đóng dấu nên không lần nào
 * thử lại. Ca ấy có thật trên seed: khối trích ở mốc 7 trỏ bình luận neo mốc 5, mà mốc 5
 * nằm trong dải gập `2..6` của mạch HPG.
 */
function moToTienDangGap(dich: HTMLElement): boolean {
  let da_bam = false;
  for (let el = dich.parentElement; el !== null; el = el.parentElement) {
    if (!el.hasAttribute("hidden") || el.id === "") continue;
    const cong_tac = document.querySelector<HTMLElement>(
      `[aria-controls="${CSS.escape(el.id)}"]`,
    );
    if (cong_tac === null) continue;
    cong_tac.click();
    da_bam = true;
  }
  return da_bam;
}

/** Trần số lần thử mở đường cho MỘT hash.
 *
 * Ba khoang lồng nhau thì tối đa cần 1 lượt bấm + 1 lượt cuộn. Trần 5 là chỗ dừng cho ca
 * bệnh lý — công tắc bấm mà khoang không mở ra (bị `disabled`, hoặc CSS ẩn bằng đường
 * khác) — để effect không quay vòng bấm mãi. Chạm trần thì đóng dấu và im: deep-link
 * không tới nơi là một tổn thất nhìn thấy được, một vòng lặp vô hạn thì không.
 */
const TRAN_THU_MO_DUONG = 5;

/** Nhịp chờ giữa hai lượt thử khi đích **chưa có** trong DOM.
 *
 * Đủ dài để một lượt `router.refresh()` kịp về trên máy thật, đủ ngắn để người dùng không
 * kịp thấy trang đứng im. Nhân với `TRAN_THU_MO_DUONG` ra khoảng 0,75 giây — quá số đó thì
 * im lặng, vì một cú cuộn tới muộn hơn thế là một cú giật màn hình không ai xin.
 */
const NHIP_THU_LAI_MS = 150;

/** Sự kiện "dẫn tôi tới bình luận này" — đường **KHÔNG đi qua URL**.
 *
 * ## Vì sao không dùng hash cho ca vừa-gửi-xong
 *
 * Bản đầu của tiêu chí 16 đặt `window.location.hash` sau khi gửi. Nó **không sống nổi**:
 * `router.refresh()` dựng lại cây từ server và trên đường đó App Router ghi lại lịch sử
 * bằng URL nó đang giữ — URL ấy không có hash — nên cái hash vừa đặt bị xoá, im lặng, dù
 * đặt trước hay sau lời gọi refresh (đã đo cả hai chiều).
 *
 * Sự kiện thì không có ai để clobber. Nó cũng đúng hơn về sản phẩm: người vừa bấm "Gửi"
 * không cần một cái hash lạ mọc thêm vào thanh địa chỉ để rồi F5 lại nhảy về đó.
 *
 * Đường đi vào vẫn là **cùng một cơ chế** mở đường (`moToTienDangGap` + luật đóng dấu) —
 * không có bản thứ hai của luật "mở khoang gập" nào được sinh ra.
 */
const SU_KIEN_TOI_BINH_LUAN = "gikky:toi-binh-luan";

/** Yêu cầu trang mở đường và cuộn tới bình luận `id`. An toàn khi không có ai nghe. */
export function toiBinhLuan(id: number): void {
  window.dispatchEvent(
    new CustomEvent(SU_KIEN_TOI_BINH_LUAN, { detail: `bl-${id}` }),
  );
}

export function NganKeoProvider({ children }: { children: ReactNode }) {
  const [dangMo, datDangMo] = useState<number | null>(null);

  /** Hash đã xử lý XONG — mở hết đường VÀ đã cuộn tới. Chống cuộn lại ở mỗi render.
   *
   * "Xong" ở đây là một điều kiện ĐO ĐƯỢC (`offsetParent !== null`), không phải "đã làm
   * một việc gì đó" — xem luật đóng dấu ở effect dưới. Đóng dấu sớm chính là hình dạng của
   * NẶNG-1. */
  const daXuLy = useRef<string | null>(null);
  /** Số lượt đã thử mở đường cho hash hiện tại — trần ở `TRAN_THU_MO_DUONG`. */
  const soLanThu = useRef(0);
  /** Hash mà `soLanThu` đang đếm cho. Đổi hash ⇒ trả lại trần. */
  const hashDangThu = useRef<string | null>(null);
  /** Hẹn giờ thử lại khi đích chưa có trong DOM — dọn khi rời trang. */
  const hen = useRef<number | undefined>(undefined);
  /** Đích do `toiBinhLuan()` đặt (không qua URL). `null` = đi theo hash như thường. */
  const dichSuKien = useRef<string | null>(null);
  /** Nhịp ép render lại khi `hashchange` bắn: sự kiện ấy không tự làm React render. */
  const [, datNhip] = useState(0);

  /** **Deep-link `#bl-N` mở ngăn kéo chứa nó** — thêm 2026-08-26.
   *
   * Từ lượt tách bình luận chung khỏi bình luận mốc, thread neo mốc N chỉ còn render
   * trong ngăn kéo mốc N, và ngăn kéo mặc định ĐÓNG (`hidden`). Không có effect này thì
   * mọi liên kết `#bl-<id>` trỏ vào một bình luận neo — nút "nhảy tới khán đài ↓" của
   * khối trích, link "tiếp tục thread →", mọi URL người ta đã chia sẻ — dẫn tới một phần
   * tử `hidden`: trình duyệt không cuộn, trang đứng yên, không báo gì.
   *
   * ## BA lối vào, và bản đầu chỉ bắt được hai *(vá 2026-08-27)*
   *
   * | lối vào | remount? | `hashchange`? |
   * |---|---|---|
   * | gõ thẳng URL có hash / F5 | có | không |
   * | bấm link CÙNG trang, chỉ đổi hash | không | **có** |
   * | bấm link cùng ROUTE nhưng đổi query (`?khan_dai=1&sort=…#bl-N`) | **không** | **không** |
   *
   * Hàng thứ ba là lối đi của chính nút *"nhảy tới khán đài ↓"* trên khối trích, và bản
   * đầu (effect `[]` + `hashchange`) **im lặng** ở đó: Next điều hướng trong cùng route
   * nên React giữ nguyên cây — không remount — còn `hashchange` thì chỉ bắn khi **mỗi**
   * hash đổi, không bắn khi cả query đổi theo. Bài đo tiêu chí 9 bắt được: phần tử có
   * trong DOM, URL có hash, mà `viewport ratio 0`.
   *
   * Nên effect này **cố ý không có mảng phụ thuộc** — nó chạy sau MỌI lần render, và
   * `daXuLy` là thứ giữ nó khỏi cuộn lặp. Provider có render lại ở lối vào thứ ba (children
   * là cây mới do server dựng), nên "sau mọi render" phủ được cả ba hàng mà không phải
   * đụng tới `useSearchParams` — hook đó kéo cả trang sang dynamic và đá vào bố cục cache
   * của PLAN 8.4.
   *
   * ## Luật ĐÓNG DẤU: chỉ khi đích THẬT SỰ nhìn thấy được *(sửa NẶNG-1, 2026-08-27)*
   *
   * `daXuLy` là thứ giữ effect khỏi cuộn lặp ở mỗi render, nhưng bản trước đóng dấu ngay
   * sau khi mở ngăn kéo — tức đóng dấu một việc **chưa xong**. Khoang gập thứ hai (dải
   * gập) vẫn `hidden`, `scrollIntoView` thành lệnh rỗng, và cái dấu ấy khoá luôn mọi lần
   * thử lại. Nay dấu chỉ được đóng khi `offsetParent !== null` — phép hỏi rẻ nhất cho
   * "phần tử này có đang chiếm chỗ trên trang không", và nó bắt được **mọi** kiểu ẩn bằng
   * `display:none`, kể cả kiểu do CSS ép từ xa (`globals.css` ép `[hidden]` thành
   * `display:none !important`) mà một phép kiểm `hasAttribute("hidden")` trên chính đích
   * sẽ không thấy.
   *
   * Cuộn ở lần chạy **sau** khi đường đã mở, không phải trong `requestAnimationFrame` ngay
   * sau cú bấm: lúc ấy React chưa commit việc gỡ `hidden`.
   *
   * ⚠ **Không JS ⇒ như cũ**: mọi khoang đóng, deep-link không tới nơi. Chấp nhận ở lượt
   * này — nội dung vẫn nằm nguyên trong HTML đầu tiên (các khoang chỉ `hidden`, không
   * fetch), nên bot và trình đọc màn hình không mất gì; thứ mất là cú cuộn.
   *
   * Effect **cố ý không có mảng phụ thuộc**, và từ bản này nó không đọc/ghi state React
   * nào nữa (mở đường bằng cách bấm công tắc thật), nên `exhaustive-deps` không còn gì để
   * cảnh báo — cái `eslint-disable` của bản trước đã gỡ được.
   */
  useEffect(() => {
    // Đích do SỰ KIỆN đặt thắng hash: nó là ý định vừa xảy ra, còn hash là ý định của lần
    // điều hướng trước và vẫn nằm nguyên trên URL.
    const neo = dichSuKien.current ?? window.location.hash.slice(1);
    if (neo === "" || daXuLy.current === neo) return;
    // Hash đổi qua đường ĐIỀU HƯỚNG (không bắn `hashchange`) cũng phải được trả lại trần.
    if (hashDangThu.current !== neo) {
      hashDangThu.current = neo;
      soLanThu.current = 0;
    }
    if (soLanThu.current >= TRAN_THU_MO_DUONG) {
      daXuLy.current = neo;
      return;
    }
    soLanThu.current += 1;
    const dich = document.getElementById(neo);
    // **Đích chưa có trong DOM ⇒ hẹn thử lại, đừng bỏ cuộc.** Ca thật: `Composer` đặt hash
    // ngay sau `router.refresh()`, nên `hashchange` bắn TRƯỚC khi cây mới của server về —
    // lúc ấy `#bl-<id vừa tạo>` chưa tồn tại. Không có nhịp hẹn này thì effect thoát và
    // không có gì gọi nó lại (một cú re-render do refresh KHÔNG chắc xảy ra ở component
    // này), nên tiêu chí 16 chết im lặng đúng kiểu NẶNG-1 vừa chữa.
    if (dich === null) {
      window.clearTimeout(hen.current);
      hen.current = window.setTimeout(() => datNhip((n) => n + 1), NHIP_THU_LAI_MS);
      return;
    }
    // Còn khoang phải mở ⇒ để React commit rồi lượt render sau tính tiếp. KHÔNG đóng dấu.
    if (moToTienDangGap(dich)) return;
    // Mở hết mà vẫn không chiếm chỗ ⇒ vẫn chưa xong. Vẫn KHÔNG đóng dấu.
    if (dich.offsetParent === null) return;
    daXuLy.current = neo;
    dichSuKien.current = null;
    dich.scrollIntoView({ block: "center" });
  });

  useEffect(() => {
    const doi = () => {
      // Hash mới ⇒ quên dấu cũ VÀ trả lại trần thử, rồi ép một lần render để effect trên
      // chạy lại. Quên `soLanThu` ở đây là để một trang đã đi qua vài deep-link cạn trần
      // rồi im lặng với mọi hash sau đó — hỏng theo kiểu chỉ lộ ra ở lần bấm thứ n.
      daXuLy.current = null;
      soLanThu.current = 0;
      datNhip((n) => n + 1);
    };
    const theoSuKien = (e: Event) => {
      const neo = (e as CustomEvent<string>).detail;
      if (typeof neo !== "string" || neo === "") return;
      dichSuKien.current = neo;
      doi();
    };
    window.addEventListener("hashchange", doi);
    window.addEventListener(SU_KIEN_TOI_BINH_LUAN, theoSuKien);
    return () => {
      window.removeEventListener("hashchange", doi);
      window.removeEventListener(SU_KIEN_TOI_BINH_LUAN, theoSuKien);
      window.clearTimeout(hen.current);
    };
  }, []);

  return (
    <NganKeoCtx.Provider
      value={{ dangMo, doiMo: (seq) => datDangMo((cu) => (cu === seq ? null : seq)) }}
    >
      {children}
    </NganKeoCtx.Provider>
  );
}

/** Cái nút `💬 N` (hoặc lời mời) ở chân thẻ mốc.
 *
 * **Ba trạng thái, không phải hai** (vá B1, 2026-08-22):
 *
 * | lát cắt | `so_binh_luan` | nút nói gì |
 * |---|---|---|
 * | rỗng hẳn | 0 | `＋ nói gì đó về mốc này` — PLAN 5.4 luật 4 |
 * | chỉ còn bia mộ | 0 | `💬 bình luận về mốc này` — có thứ để mở, nhưng KHÔNG có số |
 * | có bình luận đọc được | > 0 | `💬 N bình luận` (nguyên tắc 9 tắt N khi mạch < 4) |
 *
 * Hàng giữa là hàng bị bỏ quên: `so_binh_luan` đếm bình luận đọc được, ngăn kéo thì vẫn
 * trả bia mộ (PLAN 5.3 — bia mộ ở lại để nhánh con và khối trích còn đầu kia). Hỏi con
 * số thay vì hỏi lát cắt là mời người ta viết vào một mốc đang có sẵn nội dung, rồi mở
 * ra "Chưa ai neo bình luận vào mốc này" bên dưới đúng blockquote trích từ đó.
 *
 * Ở hàng giữa cũng **không được** hiện `💬 0`: nguyên tắc 9 cấm phô sự im lặng, và 0 là
 * con số đúng của "bình luận đọc được".
 */
export function NutNganKeo({
  seq,
  soBinhLuan,
  coHang,
  hienSoDem,
}: {
  seq: number;
  soBinhLuan: number;
  /** Lát cắt có HÀNG nào không — kể cả bia mộ. */
  coHang: boolean;
  /** Nguyên tắc 9 — mạch dưới 4 bình luận thì ẩn mọi số đếm. */
  hienSoDem: boolean;
}) {
  const { dangMo, doiMo } = useNganKeo();
  const mo = dangMo === seq;

  return (
    <button
      type="button"
      className={coHang ? css.nut : `${css.nut} ${css.moi}`}
      aria-expanded={mo}
      aria-controls={`ngan-keo-${seq}`}
      onClick={() => doiMo(seq)}
      data-testid={`nut-ngan-keo-${seq}`}
    >
      {coHang ? (
        soBinhLuan > 0 && hienSoDem ? (
          <>
            💬{" "}
            <span className={css.dem} data-testid="so-binh-luan-moc">
              {soBinhLuan}
            </span>{" "}
            bình luận
          </>
        ) : (
          <>💬 bình luận về mốc này</>
        )
      ) : (
        <>＋ nói gì đó về mốc này</>
      )}
    </button>
  );
}

/** Khoang chứa lát cắt bình luận. Nội dung do server render sẵn và truyền vào
 * `children`; client chỉ bật/tắt. Nhờ vậy cả mạch nằm trong HTML đầu tiên — mặt CẶN là
 * mặt để Google index (PLAN mục 1), giấu nội dung sau một lời gọi fetch là tự bịt mắt
 * con bot. */
export function KhungNganKeo({ seq, children }: { seq: number; children: ReactNode }) {
  const { dangMo } = useNganKeo();
  return (
    <div
      id={`ngan-keo-${seq}`}
      className={css.khung}
      hidden={dangMo !== seq}
      data-testid={`ngan-keo-${seq}`}
    >
      {/* Hậu tố chiều ("· cũ → mới") gỡ 2026-08-26 — xem luật 2 ở đầu file: gốc và reply
          nay chạy hai chiều khác nhau, một câu ngắn không tả nổi cả hai. Chữ "Lát cắt"
          cũng đi theo: ngăn kéo không còn là lát cắt của khu nào cả, nó LÀ chỗ ở. */}
      <p className={css.tieu_de}>Bình luận neo vào mốc {seq}</p>
      {children}
    </div>
  );
}
