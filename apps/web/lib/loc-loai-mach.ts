import {
  KHOANG_MAC_DINH,
  TAB_MAC_DINH,
  type KhoangFeed,
  type LoaiMach,
  type TabFeed,
  type TrangThaiFeed,
} from "./api";

/** Chip lọc theo loại mạch trên trang chuyên mục `/s/<sub>` (plan
 * `2026-11-10-chuyen-muc-loc-loai.md`).
 *
 * Chuyên mục dùng CHUNG cho nhật ký, bài viết và chủ đề, nên một trang `/s/<sub>` lẫn cả ba
 * loại; hàng chip là cách người đọc tách chúng ra, và nhãn nhỏ trên thẻ là cách họ biết
 * mỗi thẻ thuộc loại nào khi chưa lọc.
 *
 * **Chữ NGẮN, khác `NHAN_LOAI_MACH`.** Bảng ở `lib/api.ts` gọi loại thứ ba là "Chủ đề thảo
 * luận" (tên đầy đủ — chip "Loại: …" của `/?loai_mach=…`, form quản trị). Chip và nhãn thẻ
 * cần chữ ngắn để hàng chip không tràn ở 375px, nên có bảng riêng ở đây. Kiểu `Record<
 * LoaiMach, …>` ép đủ hai chiều như `NHAN_LOAI_MACH`: API mọc thêm loại mà thiếu chữ ở đây
 * là lỗi biên dịch.
 */
export const NHAN_NGAN_LOAI_MACH: Readonly<Record<LoaiMach, string>> = {
  nhat_ky: "Nhật ký",
  bai_viet: "Bài viết",
  thao_luan: "Chủ đề",
};

/** Cùng ba loại, viết thường — đứng giữa câu ("Chưa có bài viết nào trong chuyên mục này."). */
export const TEN_THUONG_LOAI_MACH: Readonly<Record<LoaiMach, string>> = {
  nhat_ky: "nhật ký",
  bai_viet: "bài viết",
  thao_luan: "chủ đề",
};

/** Dựng href cho MỘT chip: giữ `tab`, `khoang`, `truong_phai` đang có, đặt `loai_mach` theo
 * chip (`undefined` = chip "Tất cả" = KHÔNG có `loai_mach` trên URL), và **không bao giờ**
 * mang `cursor` theo.
 *
 * - Bỏ `cursor`: cursor mang khoá sort của tập bài sinh ra nó; đổi loại là đổi tập bài, nên
 *   về trang đầu. Hàm này không nhận `cursor` làm tham số — không có đường nào để lọt vào.
 * - Tham số mặc định (`tab=moi`, `khoang=tat_ca`) bị cắt để chip "Tất cả" ở trạng thái mặc
 *   định ra đúng `coBan` trần — URL sạch, link chia sẻ đọc được, và là cùng URL mà bot đã
 *   biết từ trước khi có chip.
 * - `truong_phai` do người dùng gõ nên đi qua `encodeURIComponent` (`&`, `#`, dấu cách,
 *   chữ có dấu không được làm vỡ query string).
 * - Thứ tự `tab` → `khoang` → `truong_phai` → `loai_mach` trùng thứ tự các href của
 *   `Feed` (tab, khoảng): hai nơi dựng URL cùng một trạng thái phải ra cùng một chuỗi.
 * - **Không mang `trang_thai`, cố ý** *(việc 14, đợt C)*: hàng Trạng thái chỉ có nghĩa với loại
 *   Nhật ký, nên đổi loại là bỏ nó — mang `?trang_thai=open` sang "Bài viết" là dựng một bộ lọc
 *   tàng hình (feed rỗng mà trên màn hình không còn hàng nào để tắt). Hàm cũng không nhận nó làm
 *   tham số, nên không có đường nào để nó lọt vào.
 * - **Ở gốc `/` thì LUÔN có `tab=`** *(đợt C)*: `/` không query là trang chủ v2, không phải feed.
 *   Trước đợt C chỉ `/s/*` dùng hàm này nên chip "Tất cả" ra `coBan` trần là đúng; ở `/` nó sẽ
 *   đẩy người đọc từ trang lọc nhật ký về trang chủ — mất cả dải điều khiển. `/?tab=moi` là URL
 *   mà chip "Bỏ lọc" cũ đã trỏ tới.
 */
export function hrefChipLoai(
  coBan: string,
  hienTai: { tab: TabFeed; khoang: KhoangFeed; truongPhai?: string },
  loai: LoaiMach | undefined,
): string {
  const phan: string[] = [];
  if (coBan === "/" || hienTai.tab !== TAB_MAC_DINH) phan.push(`tab=${hienTai.tab}`);
  if (hienTai.khoang !== KHOANG_MAC_DINH) phan.push(`khoang=${hienTai.khoang}`);
  if (hienTai.truongPhai) phan.push(`truong_phai=${encodeURIComponent(hienTai.truongPhai)}`);
  if (loai !== undefined) phan.push(`loai_mach=${loai}`);
  return phan.length === 0 ? coBan : `${coBan}?${phan.join("&")}`;
}

/** `<h2>` của trang lọc `/?loai_mach=…` *(việc 14, đợt C)*: nói một câu "đây là trang gì" ngay dưới
 * lede, vì ngoài hàng chip loại thì trang không có chữ nào cho biết nó đang liệt kê nhật ký / bài
 * viết / chủ đề. Chỉ `/?…` dựng nó; không lọc loại ⇒ không có `<h2>`. Chữ của `<h1>` + lede KHÔNG
 * nằm ở đây và không đổi (SEO, `seo-trang-chu.spec.ts`). */
export const TIEU_DE_TRANG_LOC: Readonly<Record<LoaiMach, string>> = {
  nhat_ky: "Tất cả nhật ký",
  bai_viet: "Tất cả bài viết",
  thao_luan: "Chủ đề thảo luận",
};

/** Hàng Trạng thái (Tất cả · Đang mở · Đã đóng sổ) có hiện không?
 *
 * Chỉ khi lọc loại **Nhật ký**: "đóng sổ" là khái niệm của nhật ký (chủ đề chỉ "đóng", bài viết
 * không có trạng thái). Và không ở tab "Đang diễn ra": tab ấy vốn chỉ gồm mạch đang mở và API
 * không nhận `trang_thai` ở đó (`lib/api.ts::trangThaiGuiLenApi`) — một hàng cho chọn "Đã đóng
 * sổ" ở đó là nút nói dối.
 *
 * `?trang_thai=` có trên URL mà hàng này KHÔNG hiện (loại khác nhật ký, hoặc không lọc loại — URL
 * cũ kiểu `/?tab=moi&trang_thai=open`) thì `Feed` rơi về chip "Trạng thái: … ✕ Bỏ lọc": bộ lọc
 * đang có hiệu lực luôn phải hiện ra ở đâu đó. */
export function hienHangTrangThai(tab: TabFeed, loaiMach: LoaiMach | undefined): boolean {
  return loaiMach === "nhat_ky" && tab !== "dang-dien-ra";
}

/** Href cho MỘT mục của hàng Trạng thái (`undefined` = "Tất cả" = không có `trang_thai`).
 *
 * **Dựng TỪ `hrefChipLoai`** rồi nối `trang_thai` *(vòng sửa 2 của đợt C)*: một trạng thái lọc chỉ
 * có MỘT URL. Bản đầu luôn đặt `tab=` nên ở `/s/*` mục "Tất cả" ra `/s/x?tab=moi&loai_mach=nhat_ky`
 * trong khi chip "Nhật ký" và link rail ra `/s/x?loai_mach=nhat_ky` — hai URL, hai bản cache, hai
 * thứ để bot index cho cùng một trang. Theo luật của `hrefChipLoai`: bỏ `tab=` mặc định, trừ ở gốc
 * `/` (nơi `/?…` trần là trang chủ v2) — nên ở `/` chuỗi vẫn là `/?tab=moi&loai_mach=nhat_ky[&
 * trang_thai=…]`, đúng chuỗi dải tab khối nhật ký của trang chủ dựng bằng chính hàm này.
 *
 * Giữ `tab`, `khoang`, `truong_phai`, `loai_mach`; **rớt `cursor`** (đổi tập bài thì về trang đầu). */
export function hrefTrangThai(
  coBan: string,
  hienTai: { tab: TabFeed; khoang: KhoangFeed; truongPhai?: string; loaiMach?: LoaiMach },
  trangThai: TrangThaiFeed | undefined,
): string {
  const goc = hrefChipLoai(coBan, hienTai, hienTai.loaiMach);
  if (trangThai === undefined) return goc;
  return `${goc}${goc.includes("?") ? "&" : "?"}trang_thai=${trangThai}`;
}

/** `<h2>` của trang lọc theo loại VÀ trạng thái *(vòng sửa 2)*: lọc nhật ký đang mở thì trang nói
 * "Nhật ký đang mở", không nói "Tất cả nhật ký". Trạng thái chỉ đổi chữ khi hàng Trạng thái đang
 * hiện (`hienHangTrangThai`) — ở loại khác, `trang_thai` đi bằng chip và `<h2>` giữ chữ theo loại. */
export function tieuDeTrangLoc(
  tab: TabFeed,
  loaiMach: LoaiMach,
  trangThai: TrangThaiFeed | undefined,
): string {
  if (trangThai !== undefined && hienHangTrangThai(tab, loaiMach)) {
    return trangThai === "open" ? "Nhật ký đang mở" : "Nhật ký đã đóng sổ";
  }
  return TIEU_DE_TRANG_LOC[loaiMach];
}

/** Chữ của chip "Trạng thái: …" *(vòng sửa 2)*. "Đã đóng sổ" là chữ của NHẬT KÝ; chủ đề không phải
 * sổ, nó chỉ "Đã đóng" (cùng luật chữ với chip trên thẻ, `the-mach.tsx`). `NHAN_TRANG_THAI_FEED`
 * giữ nguyên vì nó còn nuôi hàng Trạng thái (chỉ hiện với nhật ký) và dải tab trang chủ. */
export function nhanChipTrangThai(loaiMach: LoaiMach | undefined, trangThai: TrangThaiFeed): string {
  if (trangThai === "open") return "Đang mở";
  return loaiMach === "nhat_ky" ? "Đã đóng sổ" : "Đã đóng";
}

/** Câu của trang SUB khi feed rỗng CHỈ vì bộ lọc loại / trạng thái *(việc 14, đợt C: `/s/*` nhận
 * `?trang_thai=`)*. "Chưa có nhật ký đang mở nào trong chuyên mục này." — nói đúng loại VÀ trạng
 * thái nào trống, để người đọc biết bộ lọc nào làm trống chứ không tưởng cả chuyên mục chưa có gì.
 * Chỉ loại ⇒ câu cũ nguyên văn ("Chưa có bài viết nào trong chuyên mục này."). Vắng loại ⇒ "bài".
 * "Đã đóng sổ" là chữ của nhật ký; chủ đề chỉ "đã đóng" (xem `the-mach.tsx`). */
export function cauFeedRong(loaiMach: LoaiMach | undefined, trangThai: TrangThaiFeed | undefined): string {
  const ten = loaiMach === undefined ? "bài" : TEN_THUONG_LOAI_MACH[loaiMach];
  const tt =
    trangThai === undefined
      ? ""
      : trangThai === "open"
        ? " đang mở"
        : loaiMach === "nhat_ky"
          ? " đã đóng sổ"
          : " đã đóng";
  return `Chưa có ${ten}${tt} nào trong chuyên mục này.`;
}

/** Link nhanh "Nhật ký / Bài viết trong chuyên mục →" ở rail trang sub *(đợt C)*: `/s/<slug>?loai_mach=…`.
 * Đúng URL mà chip loại của `Feed` sinh ra từ trạng thái mặc định (tab `moi`, khoảng `tat_ca`) — nên
 * bấm ở rail thì chip ấy sáng ở trang đích. Có hàm riêng để `Sidebar` (cố ý KHÔNG import `lib/api`,
 * `sidebar-bai-moi.spec.ts`) không phải tự mang hai hằng mặc định tới đây. */
export function hrefLoaiTrongSub(duongDanSub: string, loai: LoaiMach): string {
  return hrefChipLoai(duongDanSub, { tab: TAB_MAC_DINH, khoang: KHOANG_MAC_DINH }, loai);
}
