import type { BanTinChiTietOut, KhungBanTinOut } from "@gikky/api-client";

import { TZ_VN } from "./dinh-dang";

/** Bản tin thị trường — bảng dữ liệu RIÊNG từ việc 20 (plan `2026-11-13-ban-tin-bang-rieng.md`).
 *
 * Bản tin không còn là `Mach`: không vote, không bình luận, không câu hỏi cho đám đông, không
 * dòng thời gian. Một ngày (giờ VN) một bản, tối đa ba khung giờ. Mọi quyết định thuần của web
 * về bản tin (URL, ngày, thứ tự khung, mục lục, tách giá trị số liệu) sống ở đây để đo được không
 * cần mạng (`e2e/don-vi/ban-tin.spec.ts`).
 *
 * **Ngày hiển thị ở MỌI chỗ là `BanTin.ngay`** (chuỗi `YYYY-MM-DD`, ngày VN server đặt lúc đăng
 * khung đầu tiên), không phải `created_at` / `published_at`: bản tin đăng lúc 23:30 UTC đã là ngày
 * VN hôm sau, và in ngày từ một dấu thời gian là để múi giờ của máy chạy quyết định (sổ
 * `P-20261113-8` (a)). */

/** Chuyên mục cũ của bản tin. Web chỉ còn dùng nó để rẽ nhánh route (`/s/tin-tuc`,
 * `/s/tin-tuc/<ngày>`, `/s/tin-tuc/feed.xml`) và để bỏ nó khỏi ô chọn chuyên mục khi đăng mạch:
 * API chặn `POST /machs` vào đây (`sub_danh_rieng_ban_tin`). Bản gốc ở
 * `api/core/models/ban_tin.py::SUB_BAN_TIN`. */
export const SUB_BAN_TIN = "tin-tuc";

/** Số bản tin VẼ trong dải đầu trang chủ (`DaiBanTin`) *(việc 19, vòng 2 — plan
 * `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.6)*: với tiêu đề thật, bản thứ ba không bao giờ đủ
 * chỗ trong một dòng 1096px, và một link luôn ẩn với người mà vẫn có trong HTML là thứ không nên
 * có. Từ việc 20 đây cũng là `limit` của lời gọi `liet_ke_ban_tin` ở trang chủ. */
export const SO_BAN_TIN_DAI = 2;

/** Số bản tin mỗi trang của `/s/tin-tuc` (cursor `?cursor=`). */
export const SO_BAN_TIN_MOI_TRANG = 20;

/** Tiền tố "Bản tin DD/MM — " (có thể kèm năm; gạch `—`, `–` hoặc `-`) mà mọi tiêu đề bản tin
 * thật đều mang. */
const TIEN_TO_BAN_TIN = /^Bản tin \d{1,2}\/\d{1,2}(\/\d{2,4})?\s*[—–-]\s*/i;

/** Tiêu đề bản tin bỏ tiền tố ngày cho dải đầu trang và danh sách: hai chỗ ấy đã in ngày ngay
 * trước tiêu đề, nên "13/11 · Bản tin 13/11 — S&P 500 …" in ngày HAI lần và mất ~95px của một
 * dòng vốn đã chật. Không khớp tiền tố, hoặc sau tiền tố không còn chữ nào ⇒ trả NGUYÊN tiêu đề. */
export function tieuDeBanTinGon(title: string): string {
  const tien_to = TIEN_TO_BAN_TIN.exec(title);
  if (tien_to === null) return title;
  const gon = title.slice(tien_to[0].length);
  return gon.trim().length === 0 ? title : gon;
}

/** `YYYY-MM-DD` đúng mười ký tự — cùng luật với `api/api/ban_tin.py::_DANG_NGAY`. */
const DANG_NGAY = /^\d{4}-\d{2}-\d{2}$/;

/** `ngay` trên URL có phải một ngày THẬT dạng `YYYY-MM-DD` không. Sai dạng (`20261113`,
 * `2026-1-3`) hoặc ngày không có thật (`2026-13-45`, `2026-02-30`) ⇒ `false` ⇒ trang `notFound()`
 * mà không tốn một vòng gọi API. */
export function ngayBanTinHopLe(ngay: string): boolean {
  if (!DANG_NGAY.test(ngay)) return false;
  const [y, m, d] = ngay.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** `/s/tin-tuc/<ngày>` — URL một bản tin (user chốt 2026-11-13). Bản gốc phía API:
 * `api/api/ban_tin.py::url_ban_tin`. */
export function duongDanBanTin(ngay: string): string {
  return `/s/${SUB_BAN_TIN}/${ngay}`;
}

/** Đường dẫn ảnh OG của một bản tin (`app/s/[sub]/[ngay]/opengraph-image.tsx`) — cho JSON-LD
 * `image`. Thẻ `og:image` / `twitter:image` do Next tự sinh từ chính file ấy, cùng đường này. */
export function anhOgBanTin(ngay: string): string {
  return `${duongDanBanTin(ngay)}/opengraph-image`;
}

/** Đường dẫn trang một bản tin cho bộ lọc lượt xem (`lib/dem-luot-xem.ts::DUONG_DAN_HOP_LE`).
 * Bản Django là `api/api/dem_luot_xem.py::DUONG_DAN_BAN_TIN`. Chỉ đúng sub bản tin, đúng một
 * đoạn ngày dạng `YYYY-MM-DD` — `/s/x/y` bất kỳ không được đếm. */
export const DUONG_DAN_TRANG_BAN_TIN = new RegExp(
  `^/s/${SUB_BAN_TIN}/\\d{4}-\\d{2}-\\d{2}/?$`,
);

const THU = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"] as const;
const THU_NGAN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

/** Thứ trong tuần của một NGÀY thuần — tính trên lịch UTC của chính ngày ấy, không đi qua múi giờ
 * máy chạy (cùng lý lẽ với `ngayTuChuoi` ở `lib/dinh-dang.ts`: ngày không có giờ để quy đổi). */
function thuTrongTuan(ngay: string): number {
  const [y, m, d] = ngay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** `Thứ Sáu, 13/11/2026` — dòng ngày đầy đủ ở đầu trang bản tin. */
export function ngayDayDuBanTin(ngay: string): string {
  const [y, m, d] = ngay.split("-");
  return `${THU[thuTrongTuan(ngay)]}, ${d}/${m}/${y}`;
}

/** `T6` / `CN` — cột thứ của một hàng ở trang danh sách. */
export function thuNganBanTin(ngay: string): string {
  return THU_NGAN[thuTrongTuan(ngay)];
}

const GIO_VN = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ_VN,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `06:12` — giờ VN của một dấu thời gian server (`cap_nhat_luc`, `created_at` của khung). */
export function gioVN(iso: string): string {
  const p: Record<string, string> = {};
  for (const x of GIO_VN.formatToParts(new Date(iso))) p[x.type] = x.value;
  return `${p.hour}:${p.minute}`;
}

export type KhoaKhung = KhungBanTinOut["khung"];

/** Ba khung giờ, ĐÚNG thứ tự hiển thị (đêm qua → trước phiên VN → trước phiên Mỹ) — bản web của
 * `api/core/models/ban_tin.py::KhungBanTin`. API đã trả khung theo thứ tự này; trang vẫn vẽ theo
 * bảng này (không theo thứ tự mảng) để mục lục và section không bao giờ lệch nhau.
 *
 * `neo` là `id` của `<section>` và đích của link mục lục. `gioDuKien` là giờ bot thường đăng
 * khung đó, in cạnh ô mục lục khi khung chưa có. */
export const KHUNG_BAN_TIN: readonly {
  khoa: KhoaKhung;
  ten: string;
  neo: string;
  gioDuKien: string;
}[] = [
  { khoa: "dem_qua", ten: "Đêm qua", neo: "dem-qua", gioDuKien: "~06:15" },
  { khoa: "truoc_phien_vn", ten: "Trước phiên VN", neo: "truoc-phien-vn", gioDuKien: "~08:10" },
  { khoa: "truoc_phien_my", ten: "Trước phiên Mỹ", neo: "truoc-phien-my", gioDuKien: "~19:35" },
];

/** Khung của một bản tin xếp theo `KHUNG_BAN_TIN`, kèm khung CHƯA có (`khung: null`) — một hàng
 * cho mỗi khung giờ. Mục lục vẽ cả ba; thân trang chỉ vẽ các hàng có `khung`. */
export function khungTheoThuTu(
  khung: BanTinChiTietOut["khung"],
): { khoa: KhoaKhung; ten: string; neo: string; gioDuKien: string; khung: KhungBanTinOut | null }[] {
  return KHUNG_BAN_TIN.map((k) => ({ ...k, khung: khung.find((x) => x.khung === k.khoa) ?? null }));
}

/** Tách một giá trị số liệu thành phần chính và phần TRONG NGOẶC CUỐI:
 * `"5.432,1 (-0,35%)"` → `{ chinh: "5.432,1", ngoac: "-0,35%" }`. Không có ngoặc cuối ⇒
 * `ngoac: null`. Phần trong ngoặc là thứ được tô màu tăng / giảm (qua `SoLaiLo`, nơi duy nhất
 * được dùng `--gain`/`--loss`); phần chính giữ mực thường. */
export function tachGiaTri(value: string): { chinh: string; ngoac: string | null } {
  const k = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(value);
  if (k === null || k[1].trim() === "") return { chinh: value, ngoac: null };
  return { chinh: k[1], ngoac: k[2] };
}

/** Bỏ chuyên mục bản tin khỏi danh sách chọn khi đăng mạch (`/dang-mach`, ngăn đăng nhanh): API
 * trả 400 `sub_danh_rieng_ban_tin` cho mọi mạch vào đó, nên để nó trong ô chọn là mời người ta
 * gõ xong mới bị từ chối. Không đột biến đầu vào. */
export function subDangDuoc<T extends { slug: string }>(cacSub: readonly T[]): T[] {
  return cacSub.filter((s) => s.slug !== SUB_BAN_TIN);
}
