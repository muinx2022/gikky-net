import type { HomNayOut, KhungHomNayOut } from "@gikky/api-client/admin";

/** Phần thuần của trang "Bản tin" `/ban-tin` (việc 21, đợt D — plan
 * `2026-11-13-quan-tri-ban-tin-chu-de.md` §3.2).
 *
 * Mọi phép tính giờ nằm ở SERVER (`api/api/quan_tri_ban_tin.py`): ngày VN hôm nay, hạn chót
 * từng khung (`HAN_CHOT_KHUNG`), trạng thái "chưa / quá hạn / không có lịch". File này chỉ đặt
 * nhãn + tông màu và so bảng số liệu — không đọc đồng hồ, không gõ một giờ hạn chót nào.
 *
 * Hàm thuần, không nhập React hay `fetch`: bộ `don-vi` nạp được nó. */

export type TrangThaiKhungHomNay = KhungHomNayOut["trang_thai"];
export type KhoaKhung = KhungHomNayOut["khung"];

/** Nhãn + tông của bốn trạng thái. `Record` khoá bằng type sinh ra: server thêm một trạng thái
 * thì `tsc` đỏ ở đây. "Chưa" XÁM trước hạn chót, "quá hạn" ĐỎ sau hạn chót (plan §3.2). */
export const NHAN_TRANG_THAI_KHUNG: Record<
  TrangThaiKhungHomNay,
  { nhan: string; tone: "tot" | "trung-tinh" | "xau" }
> = {
  da_dang: { nhan: "đã đăng", tone: "tot" },
  // Mod đã xoá khung này qua khu quản trị — không phải bot trễ, nên xám, không đỏ.
  da_xoa: { nhan: "đã xoá", tone: "trung-tinh" },
  chua: { nhan: "chưa", tone: "trung-tinh" },
  qua_han: { nhan: "chưa · quá hạn", tone: "xau" },
  khong_lich: { nhan: "không có lịch", tone: "trung-tinh" },
};

/** Tên ngắn của ba khung cho cột "Khung đã có" — khoá bằng type sinh ra. Tên đầy đủ ("Đêm
 * qua"…) server trả kèm từng khung; bảng chỉ cần chữ gọn. */
export const TEN_GON_KHUNG: Record<KhoaKhung, string> = {
  dem_qua: "Đêm qua",
  truoc_phien_vn: "Phiên VN",
  truoc_phien_my: "Phiên Mỹ",
};

/** Số khung bot đăng mỗi ngày — độ dài danh sách server trả, không gõ `3`. */
export function soKhungMoiNgay(hom_nay: Pick<HomNayOut, "khung">): number {
  return hom_nay.khung.length;
}

const THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** `"2026-11-13"` → `"Thứ Sáu, 13/11/2026"`. Ngày server trả đã là ngày lịch VN; đọc bằng
 * `Date.UTC` để không đi qua múi giờ máy (nếp `lib/chu-de.ts::nhanTuan`). */
export function nhanNgayBanTin(ngay: string): string {
  const [n, t, d] = ngay.split("-").map(Number);
  const thu = THU[new Date(Date.UTC(n, t - 1, d)).getUTCDay()];
  const hai = (x: number) => String(x).padStart(2, "0");
  return `${thu}, ${hai(d)}/${hai(t)}/${n}`;
}

/** `HH:mm` giờ VN của một mốc ISO — ô "đã đăng lúc …". */
export function gioPhutVN(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type CapSo = { label: string; value: string };

/** Bảng số liệu trên form → thân gửi API: bỏ khoảng trắng hai đầu, bỏ hàng thiếu một vế, rỗng
 * ⇒ `null` (bỏ bảng). Cùng luật với `form-sua-moc.tsx::chiPhanDoi`. */
export function chuanHoaFigures(figures: readonly CapSo[]): CapSo[] | null {
  const cap = figures
    .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
    .filter((f) => f.label !== "" && f.value !== "");
  return cap.length === 0 ? null : cap;
}

/** Ô tiêu đề sau một lượt nạp lại: lần nạp đầu (`da_nap = null`) hoặc ô còn đúng tiêu đề đã nạp
 * lần trước ⇒ lấy tiêu đề mới của server; mod đang gõ dở ⇒ GIỮ chữ đang gõ. Mọi nút trên trang
 * (lưu khung, ẩn, xoá) đều nạp lại cả bản tin — ghi đè ô là nuốt chữ mod chưa kịp lưu. */
export function tieuDeSauKhiNap(o_nhap: string, da_nap: string | null, moi: string): string {
  return da_nap === null || o_nhap === da_nap ? moi : o_nhap;
}

/** HTML Tiptap xuất ra → đúng dáng thân bot đăng, TRƯỚC khi gửi `PATCH` (vòng sửa 1, đợt D).
 *
 * Hai thứ Tiptap tự thêm mà bản tin của bot không có:
 *
 * 1. `<li><p>x</p></li>` — schema `listItem` đòi khối con, nên mọi `<li>x</li>` của bot nạp vào
 *    thành `<li><p>x</p></li>`. Gỡ về `<li>x</li>` **chỉ khi `li` có đúng MỘT `<p>` con và không
 *    gì khác** (`<li><p>a</p><ul>…</ul></li>` giữ nguyên: bỏ `<p>` ở đó là dính chữ vào danh sách
 *    con). Trang công khai vẽ hai dạng khác nhau (khoảng cách đoạn trong mục danh sách).
 * 2. `<p></p>` cuối thân — extension `trailingNode` của StarterKit luôn chừa một đoạn trống cuối.
 *
 * Chỉ dùng ở đường lưu của trang bản tin; mốc của người dùng KHÔNG đi qua đây. Thuần chuỗi —
 * đầu vào là HTML Tiptap tự sinh (thẻ `li`/`p` không thuộc tính), không phải HTML tự do. */
export function chuanHoaThanBanTin(html: string): string {
  let ra = html;
  // Lặp tới khi đứng yên: danh sách lồng nhau gỡ từ trong ra ngoài.
  for (;;) {
    const moi = ra.replace(
      /<li><p>((?:(?!<\/?(?:p|li)[\s>])[\s\S])*?)<\/p><\/li>/g,
      "<li>$1</li>",
    );
    if (moi === ra) break;
    ra = moi;
  }
  return ra.replace(/(?:\s*<p>\s*<\/p>)+\s*$/, "");
}

/** Khung có đổi gì so với bản đang lưu không — để nút Lưu không gửi một lượt "sửa" rỗng.
 *
 * Thân so trên bản ĐÃ CHUẨN HOÁ của cả hai bên (`chuanHoaThanBanTin`). Chỗ gọi truyền `cu.body`
 * là HTML Tiptap dựng từ thân đang lưu (`SoanThaoQuanTri.onTaoXong`), không phải thân thô:
 * Tiptap đổi dáng ngay lúc nạp, nên so với thân thô thì "gõ rồi xoá lại" cũng thành "đã sửa"
 * và để lại một dòng nhật ký rỗng nghĩa. */
export function khungDaDoi(
  cu: { body: string; figures: readonly CapSo[] | null },
  moi: { body: string; figures: readonly CapSo[] },
): boolean {
  if (chuanHoaThanBanTin(moi.body) !== chuanHoaThanBanTin(cu.body)) return true;
  const dang = (x: readonly CapSo[] | null) =>
    JSON.stringify((x ?? []).map((f) => [f.label, f.value]));
  return dang(cu.figures) !== dang(chuanHoaFigures(moi.figures));
}
