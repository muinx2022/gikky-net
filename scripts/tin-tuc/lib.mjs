/** Phần **không chạm mạng** của bot bản tin — `plans/2026-08-25-bot-tin-tuc.md` §5 H2.
 *
 * ## Vì sao tách ra khỏi `scripts/dang-tin.mjs`
 *
 * Ba việc mà bot làm sai là hỏng nặng nhất — *đăng bản tin ôi*, *đăng trùng*, *đăng một
 * thân bài server sẽ từ chối* — đều quyết được **trước khi mở socket đầu tiên**. Gom
 * chúng vào một module không I/O mạng nghĩa là chúng test được bằng `node --test` trong
 * vài mili giây, không cần DB, không cần cổng, không cần server nào đang chạy. Phần còn
 * lại (`dang-tin.mjs`) chỉ là chuỗi ba request và việc dịch lỗi HTTP sang mã thoát.
 *
 * ## Mọi hàm ở đây nhận "bây giờ" làm THAM SỐ
 *
 * Không hàm nào gọi `new Date()` ngầm, và không hàm nào đọc `process.env` trực tiếp —
 * `docCauHinh`/`thoiDiemBayGio` nhận `env` như một đối số. Đó là điều kiện để bài đo
 * dựng được ca "đã 14:00 giờ VN" mà không phải đổi đồng hồ máy; tầng CLI là chỗ **duy
 * nhất** biết `process.env` và `Date` thật.
 *
 * ## Giờ VN, không phải giờ máy
 *
 * PLAN mục 1 chốt mọi ranh giới ngày của gikky là **`Asia/Ho_Chi_Minh`**. Hạn mức
 * 10 mạch/ngày ở server đếm theo mốc đó (`api/core/han_muc.py`), nên sổ cái chống trùng
 * ở đây phải đếm theo cùng mốc — nếu không, hai "ngày" lệch nhau vài giờ và sổ nói một
 * đằng, server nói một nẻo. Máy chạy lịch hôm nay đứng ở VN; ngày nó đi qua chỗ khác
 * (hay ai đó chạy tay từ một VPS ở EU) thì luật vẫn phải đúng.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Múi giờ chuẩn của gikky — PLAN mục 1. */
export const MUI_GIO_VN = "Asia/Ho_Chi_Minh";

/** Trần độ dài `title` — PHẢI khớp `DAI_TITLE` ở `api/api/schemas_ghi.py`.
 *
 * Bản sao có chủ đích: script này chạy trên một máy **khác** máy chạy Django (xem plan
 * §2), nên không có đường nào import hằng thật. Cái giá của bản sao là nó trôi được;
 * cái được là bài tin quá dài bị chặn tại chỗ với một câu tiếng Việt, thay vì đi hết
 * chuỗi đăng nhập rồi ăn một `422` mà scheduled task không ai đọc.
 * `api/tests/test_bot_dang_tin.py` ghim hai con số này khớp với phía Python.
 */
export const DAI_TITLE = 160;

/** Trần độ dài `body` — PHẢI khớp `DAI_BODY_MOC` ở `api/core/models/moc.py`. */
export const DAI_BODY = 50000;

/** Trần độ dài `sub` — khớp `MachMoiIn.sub` (`max_length=40`). */
export const DAI_SUB = 40;

/** Trần `loai` — khớp `DAI_LOAI` ở `api/api/schemas_ghi.py`. Nhãn mốc: `Đêm qua`… */
export const DAI_LOAI = 20;

/** Trần `question_for_crowd` — khớp `DAI_CAU_MOI` ở `api/api/schemas_ghi.py`. */
export const DAI_CAU_MOI = 200;

/** Trần **mỗi ô** của một cặp `figures` — khớp `FigureIn.label`/`.value` (`max_length=24`).
 *
 * Một con số duy nhất cho cả hai ô vì phía Python cũng vậy; tách làm hai hằng ở đây là
 * mở đường cho chúng trôi khỏi nhau mà không có gì đỏ.
 */
export const DAI_O_FIGURE = 24;

/** Số cặp `figures` tối đa — PHẢI KHỚP `SO_FIGURES_TOI_DA` ở `api/core/models/moc.py`.
 *
 * ## Vì sao trần này nguy hiểm hơn mọi trần khác trong file
 *
 * `kiem_figures` phía server ném `ValidationError` — và `api/api/machs.py` **không bắt**
 * nó (khác `api/api/mocs.py`). Tức vượt trần không ra 400 với một câu tiếng Việt, nó ra
 * **HTTP 500** kèm một mẩu HTML lỗi của Django. Bot dịch thành mã thoát 1 ("bot hỏng, đi
 * sửa") và **ngày đó không có bản tin nào**, với một stderr không ai đọc nổi.
 *
 * Ba file `lich/*.md` từng dạy "4–8 cặp" — một khoảng mà nửa trên của nó luôn nổ. Bản
 * sao này tồn tại để lần sau hai bên trôi khỏi nhau thì có cái đỏ;
 * `api/tests/test_bot_dang_tin.py::test_hai_tran_do_dai_KHOP_giua_python_va_javascript`
 * ghim nó.
 */
export const SO_FIGURES_TOI_DA = 6;

/** **Hợp đồng mã thoát** của `scripts/dang-tin.mjs`.
 *
 * Nó là hợp đồng chứ không phải chi tiết nội bộ: scheduled task không đọc được stdout,
 * nên mã thoát là kênh duy nhất nói cho người xem lịch biết *"hôm nay không có bản tin
 * vì lý do gì"*. Ba số 2/3/4 tách ra khỏi `1` để phân biệt **bot từ chối có lý do** với
 * **bot hỏng**: 3 và 4 là hành vi ĐÚNG, không phải sự cố cần đi sửa.
 */
export const MA = Object.freeze({
  /** Đăng xong. */
  OK: 0,
  /** Mọi lỗi khác: cấu hình thiếu, mạng chết, server trả mã lạ. */
  LOI: 1,
  /** Dữ liệu bài không hợp lệ — chặn TRƯỚC khi gọi mạng. */
  BAI_HONG: 2,
  /** Slot này đã đăng trong ngày VN hôm nay rồi. */
  TRUNG: 3,
  /** **Ngoài khung giờ** hợp lệ của slot — quá muộn *hoặc* quá sớm. Bỏ bản tin. */
  NGOAI_KHUNG: 4,
  /** Mạch của ngày **có tồn tại** nhưng không nối mốc vào được — plan 2026-08-26 §3.3.
   *
   * Ca thật: mod khoá mạch lúc 10:00, tới 19:33 `noi_moc` trả 403. Đó **không** phải
   * "bot hỏng, đi sửa" — code đúng, dữ liệu đúng, chỉ là mạch đã bị đóng cửa. Trộn nó
   * vào `LOI` là bắt người trực mở log ra đọc mới phân biệt được hai chuyện chẳng liên
   * quan gì nhau, mà mã thoát là **kênh duy nhất** scheduled task có.
   */
  KHONG_NOI_DUOC: 5,
});

/** Mã HTTP của `noi_moc` nghĩa là **"mạch không nhận thêm mốc"**, không phải "bot hỏng".
 *
 * Bốn mã, kể tên — **không** lấy cả dải 4xx. Bản đầu lấy cả dải cho gọn, và cái giá là
 * một `400` do chính bot gửi thân bài sai cũng ra mã 5. Ca dựng lại được: file bài mang
 * `occurred_at` dạng ISO đầy đủ thì cùng MỘT file hỏng cho hai mã trái ngược — nhánh TẠO
 * ra mã 1 ("đi sửa"), nhánh NỐI ra mã 5 mà `lich/*.md` dạy là "Dừng, không phải lỗi
 * code". Người trực đọc mã 5 rồi bỏ qua, và bot hỏng cả tuần.
 *
 * Danh sách đóng thì một mã lạ rơi về `LOI` — hướng hỏng ĐÚNG: `LOI` bảo người ta đi
 * xem, `KHONG_NOI_DUOC` bảo người ta đừng.
 */
export const MA_HTTP_KHONG_NOI_DUOC = Object.freeze([
  403, // mach_bi_khoa — mod khoá
  404, // mạch bị ẩn hoặc xoá (`nap_mach` lọc `hidden_at__isnull=True`)
  409, // mach_da_dong — tác giả đóng sổ
  429, // qua_han_muc_moc — đã đủ 3 mốc trong ngày lịch VN
]);

/** `noi_moc` trả mã này thì thoát `KHONG_NOI_DUOC` (5) thay vì `LOI` (1)? */
export function khongNoiDuoc(trangThai) {
  return MA_HTTP_KHONG_NOI_DUOC.includes(trangThai);
}

/** **Ba slot là một tập ĐÓNG, và mỗi slot mang theo khung giờ của nó** — plan §3.
 *
 * ## Vì sao khung giờ sống ở đây chứ không ở dòng lệnh
 *
 * Bản đầu để `--han-chot` là một cờ rời, tuỳ chọn, và `--slot` nhận mọi chuỗi. Lượt phản
 * biện 2026-08-25 phá được cả hai:
 *
 * - `--slot dem_qua` (gạch dưới thay gạch ngang) là một **khoá sổ cái khác** ⇒ hàng rào
 *   chống trùng biến mất im lặng, exit 0, hai bản tin trong một ngày;
 * - quên `--han-chot` ⇒ không còn hạn chót nào, bản tin "đêm qua" đăng lúc 14:00, exit 0.
 *
 * Người gõ dòng lệnh này là **một LLM chép từ `lich/*.md` lúc 6h sáng**, không phải một
 * lập trình viên đọc `--help`. Mọi hàng rào phụ thuộc vào việc nó gõ đúng một cờ tuỳ chọn
 * là hàng rào đã hỏng. Nên khung giờ đi kèm slot, và slot phải nằm trong bảng này.
 *
 * ## `som_nhat` — cái bản đầu KHÔNG có, và nó là lỗ nặng nhất
 *
 * `quaHanChot` cũ chỉ hỏi *"đã quá 07:00 chưa"*, nên cửa sổ hợp lệ của `dem-qua` là
 * **00:00 → 07:00**, không phải 06:12 → 07:00. Ca thật, tái hiện được: máy đóng từ tối,
 * user mở lại **00:20 giờ VN**, task fire bù ⇒ script đăng một bản tin "phiên Mỹ đêm qua"
 * viết lúc phiên Mỹ **chưa đóng cửa** (đóng 03:00–04:00 giờ VN), rồi ghi sổ cái cho
 * NGÀY MỚI ⇒ bản tin thật lúc 06:12 ăn exit 3 và **biến mất**, với đúng cái mã mà tài
 * liệu dạy người đọc là "hành vi đúng, không cần đi sửa".
 *
 * Sàn giờ vì thế không phải một phép kiểm thêm cho đẹp — nó là nửa còn lại của hàng rào.
 *
 * Số cụ thể: sàn đặt ở lúc **sớm nhất mà dữ liệu của slot đã tồn tại**, không phải ở giờ
 * chạy. Chạy tay sớm hơn lịch vài chục phút là việc hợp lệ; chạy trước khi phiên đóng cửa
 * thì không.
 */
export const SLOT = Object.freeze({
  /** Phiên Mỹ đóng 03:00–04:00 giờ VN ⇒ 05:00 là lúc sớm nhất có đủ số đóng cửa. */
  "dem-qua": Object.freeze({ som_nhat: "05:00", han_chot: "07:00", chay: "06:12" }),
  /** Tin trong nước trước giờ mở cửa; sớm hơn 06:30 thì báo VN chưa ra tin buổi sáng. */
  "truoc-phien-vn": Object.freeze({ som_nhat: "06:30", han_chot: "09:00", chay: "08:07" }),
  /** Châu Á đóng cửa quanh 15:00–16:00 giờ VN ⇒ sàn 16:00. */
  "truoc-phien-my": Object.freeze({ som_nhat: "16:00", han_chot: "21:00", chay: "19:33" }),
});

/** Tra khung giờ của một slot. Ném khi slot không có trong bảng — **không** fallback.
 *
 * Fallback im lặng ở đây chính là lỗ mà `SLOT` sinh ra để bịt: một slot lạ vẫn chạy được
 * nghĩa là gõ nhầm vẫn đăng được, và đăng bằng một khoá sổ cái không ai tra.
 */
export function khungGioCuaSlot(slot) {
  const khung = Object.hasOwn(SLOT, slot) ? SLOT[slot] : undefined;
  if (khung === undefined) {
    throw new Error(
      `--slot phải là một trong: ${Object.keys(SLOT).join(", ")} — nhận được: ` +
        `${slot === "" ? "(rỗng)" : slot}`,
    );
  }
  return khung;
}

/** Trường mà `MachMoiIn` nhận — thân `POST /machs`, tức nhánh **TẠO**.
 *
 * Đây cũng là hợp đồng của **file bài** mà `lich/*.md` bảo LLM ghi ra: file luôn mang đủ
 * `sub` + `title`, kể cả ở một lượt chạy rốt cuộc chỉ nối mốc. Lý do ở plan §3.2 — khung
 * `dem-qua` lỡ thì `truoc-phien-vn` phải TẠO được mạch, và nó chỉ tạo được nếu có sẵn
 * tiêu đề trong tay. Một file bài không có `title` là một lượt chạy chết ở đúng cái ca
 * hiếm mà ta thêm nhánh này vào để cứu.
 */
export const TRUONG_TAO = Object.freeze([
  "sub",
  "title",
  "body",
  "occurred_at",
  "loai",
  "question_for_crowd",
  "figures",
]);

/** Trường mà `MocMoiIn` nhận — thân `POST /machs/{id}/mocs`, tức nhánh **NỐI**.
 *
 * **Suy ra từ `TRUONG_TAO`, không gõ lại.** Hai danh sách gõ tay cạnh nhau là hai danh
 * sách sẽ trôi khỏi nhau: thêm một trường vào hợp đồng mà quên danh sách thứ hai thì
 * nhánh nối lặng lẽ vứt trường đó đi, và không có gì đỏ vì server vẫn trả 201.
 */
export const TRUONG_NOI = Object.freeze(
  TRUONG_TAO.filter((ten) => ten !== "sub" && ten !== "title"),
);

const TRUONG_CHO_PHEP = new Set(TRUONG_TAO);

/** Thân của `POST /machs/{id}/mocs`, dựng từ file bài bằng cách **bỏ** `sub` và `title`.
 *
 * Bỏ chứ không để nguyên: pydantic nuốt trường thừa im lặng, nên gửi cả `title` lên
 * `MocMoiIn` vẫn 201 — và người viết sẽ tin rằng tiêu đề mốc 2 "đã được gửi", trong khi
 * §0 ràng buộc 1 nói rõ **không có endpoint nào sửa được tiêu đề mạch**. Cắt ở đây là
 * cách duy nhất để cái tưởng ấy không hình thành.
 */
export function thanNoiMoc(bai) {
  const than = {};
  for (const ten of TRUONG_NOI) {
    if (Object.hasOwn(bai, ten)) than[ten] = bai[ten];
  }
  return than;
}

// --- Luật tiêu đề (plan 2026-08-26 §4) ---------------------------------------

/** Tiền tố bị cấm ở `title`. So sánh sau khi hạ chữ thường và gộp khoảng trắng.
 *
 * Vì sao cấm hẳn dạng này chứ không chỉ khuyên: năm tiêu đề gần trùng nhau mỗi tuần thì
 * mắt trượt qua cả năm, và thẻ `<title>` trùng với hàng triệu trang khác nên vô giá trị
 * với tìm kiếm. Tiêu đề **không sửa được sau khi tạo** (§0 ràng buộc 1), nên chỗ duy
 * nhất chặn được là ở đây, trước khi gọi mạng.
 */
export const TIEN_TO_TIEU_DE_CAM = Object.freeze(["tổng hợp tin tức"]);

/** Tính từ đánh giá cấm xuất hiện trong `title` — plan §4, cùng luật với nội dung thân bài.
 *
 * Năm từ đầu là danh sách plan nêu đích danh. Phần còn lại là **mở rộng có chủ đích**:
 * luật thật là "cấm MỌI tính từ đánh giá", và một danh sách đúng năm từ thì lượt soạn
 * bài kế tiếp chỉ cần viết "khởi sắc" là đi lọt — tức hàng rào tồn tại để yên lòng chứ
 * không để chặn. Danh sách vẫn hữu hạn nên vẫn lách được; nó là cái chuông cho lỗi
 * thường gặp, không phải bộ lọc ngữ nghĩa.
 *
 * Chỉ nhận những từ mà **không có** cách đọc trung tính nào: `kỷ lục`, `cao nhất`,
 * `giảm mạnh` cố ý KHÔNG nằm đây — chúng mô tả được bằng số và là sự việc, không phải
 * đánh giá.
 */
export const TU_DANH_GIA_CAM = Object.freeze([
  // Plan §4 nêu đích danh.
  "lao dốc",
  "bùng nổ",
  "ảm đạm",
  "tích cực",
  "đáng lo",
  // Mở rộng — xem docstring.
  "tiêu cực",
  "khởi sắc",
  "bứt phá",
  "thăng hoa",
  "thảm hại",
  "rực rỡ",
  "u ám",
  "hoảng loạn",
  "đáng ngại",
  "đáng mừng",
]);

/** Hạ chữ thường + gộp mọi khoảng trắng thành một dấu cách. Dùng cho phép so tiêu đề.
 *
 * Gộp khoảng trắng vì `"Tổng  hợp   tin tức"` (thừa dấu cách) là cùng một tiêu đề với
 * mắt người đọc và cùng một thứ vô giá trị với tìm kiếm — nhưng là một chuỗi khác với
 * `startsWith`.
 */
function chuanHoaDeSo(chuoi) {
  return chuoi.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Soát `title` theo luật §4. Trả **mảng câu lỗi**; rỗng = hợp lệ. */
export function kiemTraTieuDe(title) {
  if (typeof title !== "string") return [];
  const sach = chuanHoaDeSo(title);
  const loi = [];

  for (const tien_to of TIEN_TO_TIEU_DE_CAM) {
    if (sach.startsWith(tien_to)) {
      loi.push(
        `\`title\` không được bắt đầu bằng "${tien_to}" — năm tiêu đề gần trùng nhau ` +
          "mỗi tuần thì không ai phân biệt được bài nào với bài nào. Dạng đúng: " +
          '`Bản tin <dd/mm> — <mệnh đề sự việc + số>`, ví dụ "Bản tin 26/08 — ' +
          'Nasdaq -1,2%, Brent lên 68 USD".',
      );
    }
  }

  for (const tu of TU_DANH_GIA_CAM) {
    if (sach.includes(tu)) {
      loi.push(
        `\`title\` chứa tính từ đánh giá "${tu}" — bản tin chỉ tổng hợp, không nhận ` +
          "định. Thay bằng con số nói ra chính chuyện đó.",
      );
    }
  }
  return loi;
}

// --- Soát ba trường của mốc (plan 2026-08-26 §5) -----------------------------

/** Soát `occurred_at`: đúng dạng `YYYY-MM-DD` và **không phải ngày tương lai**.
 *
 * Đây là trường duy nhất trong hợp đồng từng không có hàng rào nào: nó nằm trong
 * `TRUONG_TAO` nên không bị bắt như "trường lạ", mà cũng không ai soát. Hai ca hỏng thật:
 *
 * 1. **ISO đầy đủ** (`"2026-08-26T19:33:00Z"`). Pydantic parse `date` từ chuỗi có giờ sẽ
 *    **422/400**, và ở nhánh nối thì mã đó từng ra `KHONG_NOI_DUOC` — tức cùng một file
 *    bài hỏng cho hai mã trái ngược tuỳ khung giờ nào chạy trước.
 * 2. **Ngày tương lai.** Server cấm (`api/api/ghi_chung.py::kiem_occurred_at`) vì mốc
 *    tiên tri đứng sẵn trên timeline phá đúng lời hứa "dấu thời gian bất biến". Bot lệch
 *    múi giờ một nhịp là chạm ca này lúc gần nửa đêm.
 *
 * `ngayHomNay` là ngày VN của tầng CLI (`ngayVN(bay_gio)`). Không truyền ⇒ chỉ soát dạng:
 * hàm vẫn thuần, và bài đo dựng được ca "đã sang ngày" mà không đổi đồng hồ máy.
 * So sánh chuỗi là đủ và đúng — `YYYY-MM-DD` xếp theo từ điển trùng với xếp theo thời gian.
 */
function kiemTraOccurredAt(occurred_at, ngayHomNay) {
  if (occurred_at === undefined || occurred_at === null) return [];
  if (typeof occurred_at !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(occurred_at)) {
    return [
      "`occurred_at` phải đúng dạng `YYYY-MM-DD` (ngày, KHÔNG có giờ), nhận được: " +
        `${JSON.stringify(occurred_at)}. Bỏ hẳn trường này thì server lấy hôm nay giờ VN.`,
    ];
  }
  if (typeof ngayHomNay === "string" && occurred_at > ngayHomNay) {
    return [
      `\`occurred_at\` là ${occurred_at} — ngày tương lai so với hôm nay giờ VN ` +
        `(${ngayHomNay}). Server từ chối mốc tiên tri.`,
    ];
  }
  return [];
}

/** Trường **không bắt buộc** nhưng vắng thì bản tin nghèo đi. Trả mảng câu cảnh báo.
 *
 * Tách khỏi `kiemTraBaiViet` vì hai loại câu này đi hai đường khác nhau: lỗi thì chặn
 * trước khi gọi mạng, cảnh báo thì ra stderr **sau khi đã đăng**. Nâng chúng thành lỗi
 * là để một bản tin đầy đủ số liệu bị vứt vì thiếu một câu mời — cái giá cao hơn hẳn.
 */
export function canhBaoThieuTruong(bai) {
  if (bai === null || typeof bai !== "object" || Array.isArray(bai)) return [];
  const canh = [];
  const vang = (ten) => bai[ten] === undefined || bai[ten] === null;
  if (vang("figures") || (Array.isArray(bai.figures) && bai.figures.length === 0)) {
    canh.push(
      "`figures` vắng — dải số là thứ đọc lướt được của một bản tin; thiếu nó thì mọi " +
        "con số nằm chôn trong thân bài. 4–6 cặp.",
    );
  }
  if (vang("question_for_crowd")) {
    canh.push(
      "`question_for_crowd` vắng — không có câu mời thì bản tin là thứ để đọc, không " +
        "phải chỗ để đứng.",
    );
  }
  return canh;
}

/** Soát `figures`: mảng cặp `{label, value}`, mỗi ô 1…24 ký tự. Trả mảng câu lỗi. */
function kiemTraFigures(figures) {
  if (figures === undefined || figures === null) return [];
  if (!Array.isArray(figures)) {
    return ["`figures` phải là một mảng các cặp {label, value}."];
  }
  const loi = [];
  // Đếm phần tử TRƯỚC mọi phép soát từng cặp: vượt trần này là ca duy nhất mà server trả
  // **500** thay vì 400 (xem docstring `SO_FIGURES_TOI_DA`), nên nó phải chết ở đây.
  if (figures.length > SO_FIGURES_TOI_DA) {
    loi.push(
      `\`figures\` có ${figures.length} cặp, trần là ${SO_FIGURES_TOI_DA}. ` +
        "Bỏ bớt cặp ít quan trọng nhất — số nào cũng còn nguyên trong thân bài.",
    );
  }
  figures.forEach((cap, i) => {
    if (cap === null || typeof cap !== "object" || Array.isArray(cap)) {
      loi.push(`\`figures[${i}]\` phải là object {label, value}.`);
      return;
    }
    for (const ten of ["label", "value"]) {
      const o = cap[ten];
      if (typeof o !== "string" || o.trim() === "") {
        loi.push(`\`figures[${i}].${ten}\` phải là chuỗi không rỗng.`);
        continue;
      }
      const dai = demKyTu(o);
      if (dai > DAI_O_FIGURE) {
        loi.push(`\`figures[${i}].${ten}\` dài ${dai} ký tự, trần là ${DAI_O_FIGURE}.`);
      }
    }
    for (const ten of Object.keys(cap)) {
      if (ten !== "label" && ten !== "value") {
        loi.push(`\`figures[${i}].${ten}\` không có trong hợp đồng FigureIn.`);
      }
    }
  });
  return loi;
}

/** Đếm **điểm mã Unicode**, không đếm đơn vị UTF-16.
 *
 * Pydantic đếm ký tự Python (điểm mã); `"x".length` của JS đếm đơn vị UTF-16 — một emoji
 * ngoài BMP tính là 2. Đếm khác nhau nghĩa là hàng rào phía này chặt hơn server và loại
 * oan một bài hợp lệ, hoặc lỏng hơn và để bài đi hết chuỗi đăng nhập mới ăn 422. Bản tin
 * toàn chữ Việt thì hai cách bằng nhau, nên đây là ca biên — và ca biên là chỗ duy nhất
 * một hàng rào sao chép hằng số sai được mà không ai thấy.
 */
export function demKyTu(chuoi) {
  return [...chuoi].length;
}

const _DINH_DANG_NGAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: MUI_GIO_VN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const _DINH_DANG_GIO = new Intl.DateTimeFormat("en-US", {
  timeZone: MUI_GIO_VN,
  // `hourCycle: "h23"` chứ không `hour12: false`: với vài locale/ICU, `hour12: false`
  // vẫn ra chu kỳ h24 và nửa đêm hiện thành `"24"` — tức `phutTrongNgayVN` trả 1440 và
  // mọi phép so hạn chót lệch đúng một ngày, mỗi ngày một lần, vào đúng lúc không ai
  // nhìn.
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

/** Ngày lịch **giờ VN** của một thời điểm, dạng `YYYY-MM-DD`. Đây là khoá của sổ cái. */
export function ngayVN(luc) {
  return _DINH_DANG_NGAY.format(luc);
}

/** Số phút đã trôi qua kể từ nửa đêm **giờ VN** (0…1439). */
export function phutTrongNgayVN(luc) {
  const phan = _DINH_DANG_GIO.formatToParts(luc);
  const lay = (ten) => Number(phan.find((p) => p.type === ten).value);
  return lay("hour") * 60 + lay("minute");
}

/** `HH:MM` giờ VN của một thời điểm — chỉ để in vào câu lỗi cho người đọc log.
 *
 * Dựng lại từ `phutTrongNgayVN` chứ không format lần nữa: nếu hai đường cho hai kết quả
 * khác nhau thì câu lỗi sẽ nói một giờ mà phép so lại dùng một giờ khác, và đó là kiểu
 * mâu thuẫn tốn cả buổi sáng để hiểu.
 */
export function gioVN(luc) {
  const phut = phutTrongNgayVN(luc);
  const hai = (n) => String(n).padStart(2, "0");
  return `${hai(Math.floor(phut / 60))}:${hai(phut % 60)}`;
}

/** `"07:00"` → `420`. Ném khi chuỗi không đúng dạng `HH:MM` 24 giờ.
 *
 * Ném chứ không trả `null`: một `--han-chot` gõ sai mà bị bỏ qua im lặng là bot mất luôn
 * hàng rào chống-đăng-tin-ôi, và mất nó ở đúng cái ngày người ta vừa sửa lịch.
 */
export function phanTichHanChot(chuoi) {
  const khop = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(chuoi).trim());
  if (khop === null) {
    throw new Error(`--han-chot phải có dạng HH:MM (24 giờ), nhận được: ${chuoi}`);
  }
  return Number(khop[1]) * 60 + Number(khop[2]);
}

/** Giờ VN tại `luc` đã **quá** hạn chót của slot chưa?
 *
 * So sánh là `>`, không phải `>=`: `--han-chot 07:00` nghĩa là "07:00 vẫn còn kịp".
 * Ranh giới phải nói ra vì nó là thứ duy nhất phân biệt được một task fire đúng phút
 * chót với một task fire trễ.
 */
export function quaHanChot(hanChot, luc) {
  return phutTrongNgayVN(luc) > phanTichHanChot(hanChot);
}

/** Giờ VN tại `luc` còn **chưa tới** sàn của slot chưa?
 *
 * Nửa còn lại của `quaHanChot` — xem khối `som_nhat` trong docstring của `SLOT` cho ca
 * thật đã tái hiện được (task fire bù lúc 00:20 và giết bản tin của ngày mới).
 *
 * `<` chứ không `<=`: đúng phút sàn là còn hợp lệ, cùng quy ước với đầu kia của khoảng.
 */
export function chuaToiSom(somNhat, luc) {
  return phutTrongNgayVN(luc) < phanTichHanChot(somNhat);
}

/** Thời điểm `luc` có nằm trong khung giờ `[som_nhat, han_chot]` của slot không?
 *
 * Trả `null` khi hợp lệ, hoặc một **câu tiếng Việt nói rõ lệch đầu nào** khi không —
 * hai đầu hỏng vì hai lý do khác nhau và cần hai câu khác nhau: "quá muộn ⇒ tin ôi" với
 * "quá sớm ⇒ tin chưa tồn tại". Người đọc log lúc 6h sáng cần biết ngay là cái nào.
 */
export function ngoaiKhungGio({ som_nhat, han_chot }, luc) {
  if (quaHanChot(han_chot, luc)) {
    return (
      `đã quá hạn chót ${han_chot} giờ VN — bản tin đã ôi. ` +
      "Đăng muộn còn tệ hơn không đăng."
    );
  }
  if (chuaToiSom(som_nhat, luc)) {
    return (
      `chưa tới ${som_nhat} giờ VN — dữ liệu của khung này chưa tồn tại đầy đủ. ` +
      "Đây gần như luôn là một lượt chạy bù sau khi máy mở lại; đăng bây giờ sẽ " +
      "vừa ra bản tin sai, vừa chiếm mất chỗ của bản tin thật lát nữa."
    );
  }
  return null;
}

/** Soát thân bài trước khi gọi mạng. Trả **mảng câu lỗi**; rỗng = hợp lệ.
 *
 * Trả cả danh sách chứ không ném ở lỗi đầu tiên: người soạn bản tin sửa một lượt, không
 * phải chạy lại năm lần để lộ ra năm lỗi.
 */
export function kiemTraBaiViet(bai, { ngayHomNay } = {}) {
  if (bai === null || typeof bai !== "object" || Array.isArray(bai)) {
    return ["Thân bài phải là một object JSON {sub, title, body}."];
  }
  const loi = [];

  // ⚠ `loai` nằm trong danh sách BẮT BUỘC, không phải danh sách tuỳ chọn.
  //
  // Ở tầng hợp đồng API nó nhận `null` thoải mái, nên bản đầu chỉ soát khi có mặt. Nhưng
  // thiếu `loai` thì server vẫn 201, script vẫn exit 0, vẫn in URL — và cái mất là sản
  // phẩm của cả đợt này: ba mốc không phân biệt được nhau, mạch quay về đúng hình dạng
  // "ba khối chữ liền" mà một-mạch-một-ngày sinh ra để thay thế. Chính `lich/*.md` viết
  // "đây là thứ duy nhất phân biệt ba mốc trên trang bài".
  for (const [ten, tran] of [
    ["sub", DAI_SUB],
    ["title", DAI_TITLE],
    ["body", DAI_BODY],
    ["loai", DAI_LOAI],
  ]) {
    const gia_tri = bai[ten];
    if (typeof gia_tri !== "string" || gia_tri.trim() === "") {
      loi.push(`Thiếu \`${ten}\` (chuỗi, không rỗng).`);
      continue;
    }
    const dai = demKyTu(gia_tri);
    if (dai > tran) {
      loi.push(`\`${ten}\` dài ${dai} ký tự, trần là ${tran}.`);
    }
  }

  loi.push(...kiemTraTieuDe(bai.title));

  loi.push(...kiemTraOccurredAt(bai.occurred_at, ngayHomNay));

  // `question_for_crowd` — câu mời. **Bắt buộc là câu HỎI**, và đó không phải luật hình
  // thức: hỏi thì không phải nhận định, nên dấu `?` là thứ giữ cho trường này không trở
  // thành cửa sau để lách luật "chỉ tổng hợp, không đánh giá" (plan §5). Một câu mời
  // kết thúc bằng dấu chấm gần như luôn là một câu khẳng định trá hình.
  const cau_moi = bai.question_for_crowd;
  if (cau_moi !== undefined && cau_moi !== null) {
    if (typeof cau_moi !== "string" || cau_moi.trim() === "") {
      loi.push("`question_for_crowd` phải là chuỗi không rỗng.");
    } else {
      const dai = demKyTu(cau_moi);
      if (dai > DAI_CAU_MOI) {
        loi.push(`\`question_for_crowd\` dài ${dai} ký tự, trần là ${DAI_CAU_MOI}.`);
      }
      if (!cau_moi.trim().endsWith("?")) {
        loi.push(
          "`question_for_crowd` phải là một câu HỎI (kết thúc bằng `?`). Câu mời không " +
            "hỏi là một nhận định trá hình, và bản tin này chỉ được tổng hợp.",
        );
      }
    }
  }

  loi.push(...kiemTraFigures(bai.figures));

  // Trường lạ là **lỗi**, không phải thứ bỏ qua: pydantic mặc định NUỐT trường thừa, nên
  // một `titl` gõ thiếu chữ sẽ đi lọt tới tận server rồi hỏng ở chỗ khác. Ở đây nó là
  // một câu chỉ đúng chỗ.
  for (const ten of Object.keys(bai)) {
    if (!TRUONG_CHO_PHEP.has(ten)) {
      loi.push(`Trường \`${ten}\` không có trong hợp đồng POST /machs.`);
    }
  }
  return loi;
}

// --- Sổ cái chống đăng trùng -------------------------------------------------

/** ## Sổ cái nay khoá theo **NGÀY**, không theo `(slot, ngày)` — plan 2026-08-26 §3.1
 *
 * ```
 * { "2026-08-26": { "mach_id": 1004, "url": "https://gikky.net/m/ban-tin-26-08-1004",
 *                   "slot": { "dem-qua": "<ISO>", "truoc-phien-vn": "<ISO>" } } }
 * ```
 *
 * Cấu trúc cũ (`"<ngày>|<slot>" → url`) trả lời được đúng một câu hỏi — *"slot này đăng
 * chưa"* — và đó là câu hỏi đủ dùng khi mỗi slot ra một mạch rời. Từ lượt này ba slot
 * chung MỘT mạch, nên có câu hỏi thứ hai mà cấu trúc cũ không có chỗ để trả lời:
 * **"mạch của hôm nay là mạch nào"**. `mach_id` chính là thứ quyết định TẠO hay NỐI —
 * không có ⇒ tạo, có ⇒ nối.
 *
 * Không cần bước di trú: khảo sát 2026-08-26 (plan §0) đo được `da-dang.json` **chưa tồn
 * tại** — bot chưa đăng lần nào. Bản ghi sai dạng vì thế chỉ có thể là file hỏng, và ba
 * hàm dưới xử nó cùng một lối với `docSoCai`: **coi như không có**, không ném.
 */

/** Bản ghi của một ngày, hoặc `null` khi không có / sai dạng. */
export function banGhiNgay(soCai, ngay) {
  const ban = Object.hasOwn(soCai, ngay) ? soCai[ngay] : undefined;
  if (ban === null || typeof ban !== "object" || Array.isArray(ban)) return null;
  return ban;
}

/** Mạch của ngày đó — `{ mach_id, url }` hoặc `null`. **Đây là thứ chọn nhánh TẠO/NỐI.**
 *
 * `mach_id` phải là số nguyên dương thật; mọi thứ khác ⇒ `null`, tức **tạo mạch mới**.
 * Chiều fail-open này là chủ đích, cùng lý lẽ với `docSoCai`: một `mach_id` rác mà được
 * tin thì bot nối mốc vào hư vô và ngày đó **không có bản tin nào**, im lặng. Đọc nhầm
 * thành "chưa có mạch" thì tệ nhất là hai mạch trong một ngày — thấy ngay bằng mắt,
 * xoá tay được.
 */
export function machCuaNgay(soCai, ngay) {
  const ban = banGhiNgay(soCai, ngay);
  if (ban === null) return null;
  if (!Number.isInteger(ban.mach_id) || ban.mach_id <= 0) return null;
  return { mach_id: ban.mach_id, url: typeof ban.url === "string" ? ban.url : "" };
}

/** Bảng `slot → ISO` của một bản ghi ngày. Sai dạng ⇒ `{}`. */
function bangSlot(ban) {
  const bang = ban?.slot;
  if (bang === null || typeof bang !== "object" || Array.isArray(bang)) return {};
  return bang;
}

/** Đọc sổ cái. File không có / hỏng ⇒ **sổ rỗng**, không ném.
 *
 * Fail-open ở đúng chỗ này là có chủ đích: sổ cái là hàng rào chống *trùng*, không phải
 * nguồn sự thật. Một file JSON lỗi làm bot im lặng cả ba khung giờ thì cái giá cao hơn
 * hẳn rủi ro nó chặn hụt một lần — và lần chặn hụt ấy chỉ ra một bài trùng, xoá tay
 * được.
 */
export function docSoCai(duong) {
  if (!existsSync(duong)) return {};
  try {
    const doc = JSON.parse(readFileSync(duong, "utf8"));
    return doc !== null && typeof doc === "object" && !Array.isArray(doc) ? doc : {};
  } catch {
    return {};
  }
}

/** Slot này đã đăng trong ngày VN đó chưa? Trả `{ url, luc }` hoặc `null`. */
export function daDang(soCai, slot, ngay) {
  const ban = banGhiNgay(soCai, ngay);
  if (ban === null) return null;
  const bang = bangSlot(ban);
  if (!Object.hasOwn(bang, slot)) return null;
  return {
    url: typeof ban.url === "string" ? ban.url : "",
    luc: typeof bang[slot] === "string" ? bang[slot] : "",
  };
}

/** Ghi nhận một lượt đăng vào sổ (trả về sổ MỚI, không sửa tại chỗ).
 *
 * Đối số gọi tên chứ không xếp thứ tự: năm giá trị, trong đó ba là chuỗi, nên một lần
 * đảo chỗ `slot` với `ngay` sẽ chạy trơn tru và sinh ra một khoá sổ cái không ai tra —
 * đúng loài lỗi mà `khungGioCuaSlot` đã phải dựng ra để bịt một lần rồi.
 *
 * @param mach_id id mạch của NGÀY đó. Ở nhánh nối, truyền lại đúng id cũ.
 */
export function ghiNhanDaDang(soCai, { slot, ngay, mach_id, url, luc }) {
  const ban = banGhiNgay(soCai, ngay) ?? {};
  return {
    ...soCai,
    [ngay]: {
      ...ban,
      mach_id,
      url,
      slot: { ...bangSlot(ban), [slot]: luc.toISOString() },
    },
  };
}

/** Ghi sổ ra đĩa, tạo thư mục cha nếu thiếu. JSON có thụt lề — file này để người đọc. */
export function ghiSoCai(duong, soCai) {
  mkdirSync(dirname(duong), { recursive: true });
  writeFileSync(duong, `${JSON.stringify(soCai, null, 2)}\n`, "utf8");
}

// --- Cấu hình ----------------------------------------------------------------

/** Đọc một file kiểu `.env` thành object. File không có ⇒ `{}`.
 *
 * Parser cố tình tối giản (`KEY=VALUE`, `#` là chú thích, nháy bao ngoài được bóc): file
 * này chỉ giữ ba biến ở plan §2. Thêm một thư viện dotenv cho ba dòng là thêm một
 * dependency vào một repo mà lượt này **cấm thêm dependency**.
 */
export function docEnvFile(duong) {
  if (!existsSync(duong)) return {};
  const ra = {};
  for (const dong of readFileSync(duong, "utf8").split(/\r?\n/)) {
    const sach = dong.trim();
    if (sach === "" || sach.startsWith("#")) continue;
    const cat = sach.indexOf("=");
    if (cat <= 0) continue;
    const ten = sach.slice(0, cat).trim();
    // ⚠ Bóc nháy TRƯỚC, và `trim()` bên trong nháy thì KHÔNG chạy. Bản đầu làm ngược
    // (`.trim()` rồi mới bóc nháy) cộng với một `.trim()` thứ hai ở `docCauHinh`, nên
    // `GIKKY_BOT_PASSWORD="  a b  "` ra `"a b"` — tức **không tồn tại cách nào** viết
    // một mật khẩu có khoảng trắng ở biên. Triệu chứng là "sai mật khẩu" lúc 06:12 sáng,
    // đúng cái mà `.env.example` cảnh báo, chỉ khác là nguyên nhân nằm trong code.
    // Nháy bao ngoài là cách người dùng NÓI RA "khoảng trắng này thuộc về giá trị".
    const tho = sach.slice(cat + 1);
    const goc = tho.trim();
    const co_nhay =
      goc.length >= 2 &&
      ((goc.startsWith('"') && goc.endsWith('"')) ||
        (goc.startsWith("'") && goc.endsWith("'")));
    ra[ten] = co_nhay ? goc.slice(1, -1) : goc;
  }
  return ra;
}

/** Bỏ dấu `/` cuối và soát giao thức. Ném khi origin không dùng được.
 *
 * Soát `http`/`https` chứ không nhận mọi URL: một `--origin file:///…` hay một chuỗi
 * thiếu giao thức làm `fetch` ném một `TypeError` không nói được nó sai ở đâu.
 */
export function chuanHoaOrigin(origin) {
  const chuoi = String(origin ?? "").trim();
  let u;
  try {
    u = new URL(chuoi);
  } catch {
    throw new Error(`GIKKY_ORIGIN không phải URL: ${chuoi || "(rỗng)"}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`GIKKY_ORIGIN phải là http/https, nhận được: ${chuoi}`);
  }
  return `${u.protocol}//${u.host}`;
}

/** Gộp cấu hình theo thứ tự **CLI > biến môi trường > file `.env`**.
 *
 * Thứ tự đó không tuỳ tiện. Bài đo phải trỏ script vào một `live_server` cổng ngẫu
 * nhiên; nếu file `.env` (chứa `GIKKY_ORIGIN=https://gikky.net` thật) thắng, thì một
 * lượt `pnpm test` trên máy đã cấu hình xong sẽ **đăng bài lên site thật**. Nên `--origin`
 * của CLI đứng trên cùng, và `duongEnv` cho phép bài đo trỏ hẳn vào một file không tồn
 * tại.
 *
 * @param env      object kiểu `process.env` (tầng CLI truyền vào).
 * @param duongEnv đường tới file `.env` của bot.
 * @param origin   giá trị `--origin` của CLI, hoặc `undefined`.
 */
export function docCauHinh({ env, duongEnv, origin }) {
  const tep = docEnvFile(duongEnv);
  const lay = (ten) => {
    const v = env[ten] ?? tep[ten] ?? "";
    return String(v).trim();
  };
  /** Như `lay` nhưng **KHÔNG trim** — dành riêng cho mật khẩu.
   *
   * `docEnvFile` đã bóc nháy đúng cách, nên tới đây giá trị là thứ người dùng chủ ý viết.
   * Một `.trim()` nữa ở đây xoá lại đúng cái mà nháy vừa bảo vệ.
   */
  const layNguyen = (ten) => String(env[ten] ?? tep[ten] ?? "");

  const goc = String(origin ?? "").trim() || lay("GIKKY_ORIGIN");
  const email = lay("GIKKY_BOT_EMAIL");
  const matKhau = layNguyen("GIKKY_BOT_PASSWORD");

  const thieu = [];
  if (goc === "") thieu.push("GIKKY_ORIGIN (hoặc --origin)");
  if (email === "") thieu.push("GIKKY_BOT_EMAIL");
  if (matKhau === "") thieu.push("GIKKY_BOT_PASSWORD");
  if (thieu.length > 0) {
    throw new Error(
      `Thiếu cấu hình: ${thieu.join(", ")}.\n` +
        `Điền vào ${duongEnv} (mẫu ở .env.example cạnh nó) hoặc đặt biến môi trường.`,
    );
  }

  return { origin: chuanHoaOrigin(goc), email, matKhau };
}

/** "Bây giờ" của tầng CLI — thật, trừ khi `GIKKY_BOT_GIO_GIA_LAP` (ISO) tiêm vào.
 *
 * Biến giả lập tồn tại **vì bài đo**: ca "task fire trễ, đã 14:00 giờ VN" không dựng
 * được bằng cách nào khác ngoài đổi đồng hồ máy. Nó đọc `env` được truyền vào chứ không
 * `process.env`, nên bản thân hàm vẫn thuần.
 */
export function thoiDiemBayGio(env) {
  const gia_lap = String(env.GIKKY_BOT_GIO_GIA_LAP ?? "").trim();
  if (gia_lap === "") return new Date();
  const luc = new Date(gia_lap);
  if (Number.isNaN(luc.getTime())) {
    throw new Error(`GIKKY_BOT_GIO_GIA_LAP không phải thời điểm ISO: ${gia_lap}`);
  }
  return luc;
}
