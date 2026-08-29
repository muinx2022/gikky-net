import type { BinhLuanOut, KhanDaiOut, NganKeoOut } from "@gikky/api-client";

/** Ba sort của khán đài — PLAN 5.3.
 *
 * **Đây là chỗ vá nợ 1b #3** (danh sách chuẩn: `plans/2026-08-22-phase-1b-va2.md`
 * §3 — xem `plans/2026-08-22-phase-1d-va3.md` §4b về việc token `1b #N` từng trỏ vào
 * hai hệ đánh số khác nhau). `GET /machs/{id}/comments` khai tham số `sort: str` ở
 * Ninja, nên `LietKeBinhLuanMachData["query"]["sort"]` trong TS client sinh ra là
 * `string`: gõ `?sort=hay_nhaat` không bị TypeScript chặn, chỉ tới runtime mới ăn 400.
 * Hằng union này bọc lại ở tầng 1c.
 *
 * Nó **không** khai lại type của API (PLAN 8.3 cấm) — nguồn sự thật vẫn là
 * `KhanDaiOut["sort"]` do codegen sinh, và hai chiều đều bị ghim bằng trình biên dịch:
 *
 * - `satisfies` dưới đây bắt mọi phần tử của mảng phải là sort API biết;
 * - `NHAN_SORT` khai kiểu theo `Record<KhanDaiOut["sort"], …>` nên API mọc thêm sort thứ
 *   tư mà file này không cập nhật là **lỗi biên dịch** ("thiếu thuộc tính"), chứ không
 *   phải một nhánh UI lặng lẽ biến mất.
 */
export const SORT_KHAN_DAI = [
  "hay_nhat",
  "moi_nhat",
  "cu_nhat",
] as const satisfies readonly KhanDaiOut["sort"][];

export type SortKhanDai = (typeof SORT_KHAN_DAI)[number];

/** Sort khi URL không nói gì — **`moi_nhat` từ 2026-08-26** (user: *"thay đổi hiển thị
 * list cmt, order by created desc"*).
 *
 * ⚠ **`moi_nhat` KHÔNG còn là `ORDER BY (created_at, id) DESC`** *(sửa cuối ngày
 * 2026-08-26, cùng lượt user chốt "nếu có reply mới thì nổi lên")*. Django nay sắp thread
 * gốc theo **hoạt động mới nhất** — `max(created_at)` trên các nút đọc được của cả thread
 * — giảm dần, còn reply bên trong đọc **xuôi** cũ → mới
 * (`core/doc_noi_dung.py::sap_goc_bump_hoat_dong` và `dung_cay_theo_sort`). Nhãn "Mới
 * nhất" trên màn hình giữ nguyên: nó vẫn đúng, và nay đúng hơn — "mới" là *vừa có người
 * nói*, không phải *vừa mở lời*.
 *
 * ⚠ Đổi hằng này là chưa đủ: `lib/url.ts::duongDanKhanDai` **gõ cứng** `sort=hay_nhat`
 * vào link `💬 N` của thẻ feed. Bỏ sót chỗ đó thì vào từ feed ra một sort, vào thẳng
 * `/m/…` ra sort khác, mà cả hai đều "đúng" theo code của chính nó.
 *
 * Mặc định của `?sort=` phía **Ninja** vẫn là `hay_nhat` và **cố ý không đổi**: frontend
 * luôn truyền tường minh, còn mặc định ấy là hợp đồng API có bài đo riêng.
 */
export const SORT_MAC_DINH: SortKhanDai = "moi_nhat";

/** Nhãn tiếng Việt của từng sort. Khai theo union CỦA API — xem docstring trên. */
export const NHAN_SORT: Readonly<Record<KhanDaiOut["sort"], string>> = {
  hay_nhat: "Hay nhất",
  moi_nhat: "Mới nhất",
  cu_nhat: "Cũ nhất",
};

/** Đọc `?sort=` từ URL. Giá trị lạ → sort mặc định.
 *
 * Chuẩn hoá rác ở ĐÂY (tầng URL) chứ không đẩy xuống API là có chủ đích: API trả 400 cho
 * sort sai, và cả trang mạch sẽ chết vì một query string ai đó gõ tay. PLAN nguyên tắc 7
 * cấm "tự đổi sort ngầm **dưới tay người dùng**" — tức cấm đổi cái sort họ đã chọn hợp
 * lệ, không phải cấm quy rác về mặc định.
 */
export function docSort(gia_tri: string | string[] | undefined): SortKhanDai {
  const s = Array.isArray(gia_tri) ? gia_tri[0] : gia_tri;
  return (SORT_KHAN_DAI as readonly string[]).includes(s ?? "")
    ? (s as SortKhanDai)
    : SORT_MAC_DINH;
}

/** Có render khối "Đáng chú ý" (PLAN 5.5) không — **TẮT từ 2026-08-26 (user chốt)**.
 *
 * > *"trước mắt ta chưa tính đến điểm, mà chỉ tính đến việc cái nào cmt mới nhất thì lên
 * > trước"*
 *
 * Khối ấy là `đã trích ∪ top-10 wilson`, tức nó **xếp hạng bằng điểm** và đặt kết quả lên
 * trên cây. Cùng lượt user chốt danh sách chỉ đi theo trục thời gian, nên nó không còn
 * chỗ đứng.
 *
 * **Con số làm nó chết, không phải cảm giác:** trên mạch HPG cây có 14 thread gốc, khối
 * hiện **11** trong số đó — cùng nội dung, khác thứ tự, ngay phía trên. Chốt chặn cũ
 * (`nenRenderCauDangDoc`) chỉ hỏi *"có ứng viên nào bị bỏ lại không"*, ở đây bỏ lại 3 nên
 * nó render. "Lọc ra 11 trên 14" thì không còn là lọc.
 *
 * **Đây là một CÔNG TẮC, không phải một lượt gỡ.** User nói *"trước mắt"*, nên component
 * `CauDangDoc`, `lib/api.ts::docCauDangDoc` và cả `?dang_doc=1` phía Django đều còn
 * nguyên và còn bài đo riêng (`api/tests/test_api_cau_dang_doc.py`). Bật lại = đổi `false`
 * thành `true` ở đây, không phải viết lại gì.
 *
 * Khai `: boolean` chứ không để TS suy ra literal `false`: literal biến mọi biểu thức
 * dùng nó thành hằng, và `no-constant-binary-expression` sẽ bắt đúng cái nhánh mà ta cố ý
 * giữ sống để bật lại được.
 */
export const HIEN_KHOI_DANG_CHU_Y: boolean = false;

/** Độ sâu render tối đa của khán đài — PLAN 5.3 "UI render tối đa 6 tầng rồi
 * *tiếp tục thread →*". API trả đủ cây, cắt là việc của UI.
 *
 * Hằng nằm ở `lib/` chứ không ở `components/binh-luan.tsx` vì `idTrongTrang` dưới đây
 * **phải** dừng ở đúng con số này (nợ B4 của đợt vá 2026-08-22): nút sâu hơn ngưỡng
 * không có `<li id="bl-N">` nào trong trang, nên báo "cuộn được" cho nó là hứa một cú
 * bấm rồi trang đứng yên, không thông báo gì. Hai hằng ở hai file là hai sự thật.
 */
export const SAU_KHAN_DAI = 6;

/** Ngăn kéo — **bằng đúng `SAU_KHAN_DAI`** từ 2026-08-26.
 *
 * PLAN 5.4 luật 2 vế "render tối đa 2 tầng reply" (ngưỡng 3, vì gốc là tầng 1) **chết**
 * cùng lượt tách bình luận chung khỏi bình luận mốc. Lý lẽ của con số 3 là *"ngăn kéo chỉ
 * là cửa sổ chiếu vào khán đài"*: cụt ở tầng 3 không mất gì, vì link "tiếp tục thread →"
 * dẫn sang một cái nhà đầy đủ ở dưới. Từ lượt ấy **không còn cái nhà đó** — thread neo mốc
 * N chỉ sống trong ngăn kéo mốc N, nên nhà duy nhất không được cụt hơn nhà cũ.
 *
 * Giữ tên riêng thay vì thay hết bằng `SAU_KHAN_DAI` ở chỗ dùng: hai khu vẫn là hai khu,
 * và ngày chúng tách con số ra lần nữa thì chỗ sửa là ĐÂY. Gán bằng chứ không chép số:
 * hai hằng kể hai câu chuyện là cách chúng trôi khỏi nhau lặng lẽ.
 */
export const SAU_NGAN_KEO = SAU_KHAN_DAI;

/** Duyệt cây bình luận theo chiều sâu, gốc trước con.
 *
 * `doSauToiDa` cắt đúng như `components/binh-luan.tsx` cắt khi render: nút ở đúng ngưỡng
 * vẫn ra, con của nó thì không (chỗ đó UI thay bằng link "tiếp tục thread →").
 */
export function duyetCay(
  threads: readonly BinhLuanOut[],
  doSauToiDa = Number.POSITIVE_INFINITY,
): BinhLuanOut[] {
  const ra: BinhLuanOut[] = [];
  const di = (nut: BinhLuanOut) => {
    if (nut.depth > doSauToiDa) return;
    ra.push(nut);
    nut.replies.forEach(di);
  };
  threads.forEach(di);
  return ra;
}

/** Tập `id` của mọi bình luận **được RENDER RA** trong trang khán đài đang cầm.
 *
 * "Có trong response" khác "có trong trang": khán đài cắt ở `SAU_KHAN_DAI` tầng, nên một
 * nút `depth ≥ 7` nằm trong JSON nhưng không có phần tử HTML nào mang `id` của nó.
 */
export function idTrongTrang(
  threads: readonly BinhLuanOut[],
  doSauToiDa = SAU_KHAN_DAI,
): Set<number> {
  return new Set(duyetCay(threads, doSauToiDa).map((n) => n.id));
}

/** Tập `id` được render ra trong **cả trang mạch**: khán đài ∪ mọi lát cắt ngăn kéo.
 *
 * ## Vì sao nó là một HÀM, không phải hai dòng trong `trang-mach.tsx` *(§D3, 2026-08-27)*
 *
 * Đây là hậu duệ trực tiếp của B3 và W7 — hai lượt vá cùng dạy đúng một câu: *trạng thái
 * deep-link phải tính trên đúng tập mà trang SẼ render, không phải trên một tập gần đúng*.
 * Bản đầu của 1c hỏi trang người dùng đang xem thay vì trang mà link dẫn tới; hỏng theo cả
 * hai chiều và không có gì đỏ, vì cái sai nằm trong một biểu thức inline không ai đo được.
 * Cùng lối ấy, phép hợp này nằm inline thì việc bỏ quên một vế là một dòng biến mất trong
 * diff — và hậu quả là một câu "chưa nhảy tới được" in ra cho một bình luận đang nằm cách
 * chỗ bấm vài trăm pixel.
 *
 * ## Vì sao phải có VẾ THỨ HAI kể từ 2026-08-26
 *
 * Trang mạch nay có **hai** khu render bình luận, không còn một: khán đài giữ thread
 * `anchor_moc_seq IS NULL`, phần còn lại sống trong ngăn kéo — và ngăn kéo là bản CHÍNH
 * (`the-moc.tsx` bật `datNeo`), tức `id="bl-N"` của thread neo nằm ở đó. Tính tập này chỉ
 * từ khán đài là báo "chưa nhảy tới được" cho đúng những bình luận đang có mặt trong trang.
 *
 * Hai vế cắt ở **cùng** một ngưỡng, và đó không phải trùng hợp: `SAU_NGAN_KEO` nay bằng
 * `SAU_KHAN_DAI` (§C1), nên `idTrongTrang` mặc định đúng con số cho cả hai. Ngày hai khu
 * tách ngưỡng ra lần nữa thì chỗ sửa là ĐÂY, không phải ở `trang-mach.tsx`.
 *
 * `hayNhat` nhận `null` vì `trang-mach.tsx` **cố ý** không nạp trang 1 `hay_nhat` khi
 * không cần (vá C6): post thường không gập, không trích, không xem sort ấy thì lời gọi
 * không xảy ra. `null` ở đây nghĩa là "khu chung không đóng góp id nào", không phải lỗi.
 *
 * `latCat` nhận `Iterable` chứ không `Array` để `trang-mach.tsx` truyền thẳng
 * `Map.values()` — không dựng thêm một mảng trung gian chỉ để duyệt một lần.
 */
export function idTrongTrangGop(
  hayNhat: readonly BinhLuanOut[] | null,
  latCat: Iterable<NganKeoOut>,
): Set<number> {
  const ra = new Set<number>(idTrongTrang(hayNhat ?? []));
  for (const lat of latCat) {
    for (const id of idTrongTrang(lat.threads)) ra.add(id);
  }
  return ra;
}

/** Trạng thái của nút "nhảy tới khán đài" trên khối trích — nợ 1b #8.
 *
 * Khối trích chỉ cuộn tới được khi bình luận gốc NẰM TRONG trang khán đài đang tải.
 * `hay_nhat` chỉ trả 50 thread gốc đầu (PLAN 5.3) và bia mộ thường rơi xuống đáy bảng
 * xếp hạng, nên mạch trên 50 thread thì nó không ở trang 1.
 *
 * Ca đó **phải nói ra**, không được im lặng: một nút bấm không nhảy đi đâu là lỗi người
 * dùng không có cách nào hiểu. Trả `"trang_sau"` để UI hiện câu giải thích.
 */
export function trangThaiDeepLink(
  commentId: number,
  idCoTrongTrang: ReadonlySet<number>,
): "cuon_duoc" | "trang_sau" {
  return idCoTrongTrang.has(commentId) ? "cuon_duoc" : "trang_sau";
}

/** Khối "Câu đáng đọc" có đáng render không — PLAN 5.5, ngoại lệ "tập = cả khán đài".
 *
 * **Vì sao câu hỏi này không trả lời được bằng hai kích thước** *(Y1, lượt vá 4)*. Bản
 * trước hỏi `tap.tong_thread >= tongThreadDayDu`, tức so kích thước TẬP với tổng thread
 * của CÂY. Từ X4 hai con số ấy đếm hai thứ khác nhau: cây đếm mọi bia mộ giữ chỗ, còn tập
 * không nhận bia mộ qua vế top-10 nhưng vẫn ôm bia mộ **đã được trích** (PLAN 5.6). Hệ
 * quả đo được trên seed dev — mạch VNM có 6 gốc (1 mod ẩn · 1 tác giả xoá đã trích · 4
 * bình thường) cho tập 5, `5 < 6` ⇒ render ⇒ 5 bình luận in **hai lần** trên một trang và
 * `[bình luận đã xoá]` nằm ngay dưới nhãn "Câu đáng đọc".
 *
 * Con số so được là con số **API tự trả**: có ứng viên nào bị bỏ lại ngoài tập không.
 * Không có thì khối chứa trọn phần **thread GỐC** đọc được của cây, tức nó không lọc gì
 * cả — đúng nghĩa
 * ngoại lệ mà PLAN chốt, và lần này diễn đạt bằng một đại lượng đúng loài.
 *
 * `null` (khán đài thường, hoặc lời gọi hỏng) ⇒ **không render**: fail-closed. Mất khối
 * này là mất một lối tắt; render nhầm nó là in cả cây hai lần.
 */
export function nenRenderCauDangDoc(tap: KhanDaiOut | null): tap is KhanDaiOut {
  if (tap === null || tap.threads.length === 0) return false;
  return (tap.so_ung_vien_bo_lai ?? 0) > 0;
}

/** Neo HTML của một bình luận trong khán đài. Một chỗ sinh, một chỗ đọc. */
export function neoBinhLuan(commentId: number): string {
  return `bl-${commentId}`;
}
