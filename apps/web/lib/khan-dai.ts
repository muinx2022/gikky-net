import type { BinhLuanOut, KhanDaiOut } from "@gikky/api-client";

/** Ba sort của khán đài — PLAN 5.3.
 *
 * **Đây là chỗ vá nợ 1b #4.** `GET /machs/{id}/comments` khai tham số `sort: str` ở
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

export const SORT_MAC_DINH: SortKhanDai = "hay_nhat";

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

/** Độ sâu render tối đa của khán đài — PLAN 5.3 "UI render tối đa 6 tầng rồi
 * *tiếp tục thread →*". API trả đủ cây, cắt là việc của UI.
 *
 * Hằng nằm ở `lib/` chứ không ở `components/binh-luan.tsx` vì `idTrongTrang` dưới đây
 * **phải** dừng ở đúng con số này (nợ B4 của đợt vá 2026-08-22): nút sâu hơn ngưỡng
 * không có `<li id="bl-N">` nào trong trang, nên báo "cuộn được" cho nó là hứa một cú
 * bấm rồi trang đứng yên, không thông báo gì. Hai hằng ở hai file là hai sự thật.
 */
export const SAU_KHAN_DAI = 6;

/** Ngăn kéo — PLAN 5.4 luật 2: "Render tối đa 2 tầng reply". Gốc là tầng 1, nên
 * ngưỡng tuyệt đối là 3. */
export const SAU_NGAN_KEO = 3;

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

/** Neo HTML của một bình luận trong khán đài. Một chỗ sinh, một chỗ đọc. */
export function neoBinhLuan(commentId: number): string {
  return `bl-${commentId}`;
}
