/** Nhóm chủ đề thảo luận theo TUẦN (thứ Hai–Chủ nhật, giờ Việt Nam) cho kho `/chu-de`.
 *
 * Hàm thuần, không nhập React hay `fetch`: bộ `don-vi` nạp được nó nguyên vẹn và đo các
 * ranh giới tuần (23:59 Chủ nhật / 00:00 thứ Hai giờ VN, đầu năm) mà bản build thật khó dựng.
 *
 * ## Vì sao tính tay chứ không qua `Intl`
 *
 * Việt Nam không có giờ mùa hè — `Asia/Ho_Chi_Minh` là UTC+7 cố định, nên cộng 7 giờ rồi đọc
 * các trường `getUTC*` cho đúng ngày lịch VN, KHÔNG phụ thuộc múi giờ của máy chạy Node
 * (server render ở UTC, trình duyệt ở GMT+7: đọc `getDay()` là lệch tuần ngay đêm Chủ nhật).
 * `TZ_VN` ở `lib/dinh-dang.ts` là múi giờ chuẩn của sản phẩm; hằng 7 giờ dưới đây là cùng
 * một sự thật viết dưới dạng số, và bài đo `chu-de-theo-tuan.spec.ts` ghim hai đầu ranh giới.
 */

import { trichVanBanThuan } from "./van-ban";

const MS_NGAY = 86_400_000;
const LECH_VN_MS = 7 * 3_600_000;

export type TuanVN = {
  /** Ngày thứ Hai của tuần, `YYYY-MM-DD` — khoá nhóm. */
  khoa: string;
  /** `Tuần 10/11 – 16/11/2026`; tuần vắt qua năm thì ghi năm ở cả hai đầu. */
  nhan: string;
};

const hai = (n: number) => String(n).padStart(2, "0");

/** Tuần (thứ Hai–Chủ nhật theo GIỜ VN) chứa mốc `iso`. Ném khi `iso` không đọc được: một ngày
 * hỏng không được lặng lẽ rơi vào một tuần bịa. */
export function tuanVNCua(iso: string): TuanVN {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`tuanVNCua: không đọc được thời điểm ${JSON.stringify(iso)}`);

  const vn = new Date(ms + LECH_VN_MS);
  // 0 = Chủ nhật … 6 = thứ Bảy ⇒ số ngày lùi về thứ Hai.
  const lui = (vn.getUTCDay() + 6) % 7;
  const thu_hai = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() - lui));
  const chu_nhat = new Date(thu_hai.getTime() + 6 * MS_NGAY);

  const ngayThang = (d: Date) => `${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}`;
  const day_du = (d: Date) => `${ngayThang(d)}/${d.getUTCFullYear()}`;
  const khac_nam = thu_hai.getUTCFullYear() !== chu_nhat.getUTCFullYear();

  return {
    khoa: `${thu_hai.getUTCFullYear()}-${hai(thu_hai.getUTCMonth() + 1)}-${hai(thu_hai.getUTCDate())}`,
    nhan: `Tuần ${khac_nam ? day_du(thu_hai) : ngayThang(thu_hai)} – ${day_du(chu_nhat)}`,
  };
}

type MucXuatBan = { id: number; published_at: string };

/** Mới xuất bản trước: `published_at` giảm dần, hoà thì `id` giảm dần. Mốc không đọc được xếp
 * CUỐI (không bao giờ thắng) chứ không ném: hàm này chạy trên trang chủ, nơi một ngày hỏng
 * không được làm cả trang 500 (còn `tuanVNCua` ném là việc của kho `/chu-de`). */
export function sapMoiXuatBanTruoc<T extends MucXuatBan>(items: readonly T[]): T[] {
  const ms = (it: T) => {
    const t = Date.parse(it.published_at);
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  };
  return [...items].sort((a, b) => {
    const lech = ms(b) - ms(a);
    // `-Infinity - -Infinity` là NaN: hai mốc hỏng coi như hoà.
    return lech !== 0 && !Number.isNaN(lech) ? lech : b.id - a.id;
  });
}

/** Chủ đề nổi của trang chủ: trong các chủ đề feed `moi` trả về, cái **xuất bản sau cùng**.
 * Trả mảng 0 hoặc 1 phần tử (khối Chủ đề nhận mảng).
 *
 * Vì sao không lấy phần tử đầu của feed: feed `moi` sắp theo `last_content_at`
 * (`api/api/feeds.py`), cột bị đẩy lên khi nối một mốc đủ dài vào chủ đề CŨ — chủ đề cũ sẽ
 * giành lại thẻ nổi dù chủ đề mới vừa được tạo. `published_at` thì không đổi sau khi đăng. */
export function chonChuDeNoi<T extends MucXuatBan>(items: readonly T[]): T[] {
  const [dau] = sapMoiXuatBanTruoc(items);
  return dau === undefined ? [] : [dau];
}

export type NhomTuan<T> = TuanVN & { items: T[] };

/** Gom theo tuần của `published_at`, **mới → cũ**: mục được sắp `published_at` giảm dần (hoà ⇒
 * `id` giảm dần) TRƯỚC khi gom, nên thứ tự của feed không còn quyết định gì — feed `moi` sắp theo
 * `last_content_at`, mà chủ đề cũ được nối mốc dài sẽ nhảy lên đầu và kéo cả nhóm tuần cũ của nó
 * lên trước tuần mới. Sắp xong thì nhóm xuất hiện theo lần gặp đầu tiên cũng là mới → cũ. Gom theo
 * khoá (không chỉ "liền kề"): hai mục cùng tuần luôn chung một nhóm. */
export function nhomTheoTuan<T extends MucXuatBan>(items: readonly T[]): NhomTuan<T>[] {
  const nhom = new Map<string, NhomTuan<T>>();
  for (const it of sapMoiXuatBanTruoc(items)) {
    const tuan = tuanVNCua(it.published_at);
    const co = nhom.get(tuan.khoa);
    if (co === undefined) nhom.set(tuan.khoa, { ...tuan, items: [it] });
    else co.items.push(it);
  }
  return [...nhom.values()];
}

/* ---------------------------------------------------------------------------------------- */
/* Khối "Chủ đề tuần" của trang chủ (plan `2026-11-11-homepage-v2-giao-dien-moi.md` §3.1).   */

export type KhoangTuan = {
  /** `09/11 – 15/11`: thứ Hai → Chủ nhật của tuần chứa `published_at`, giờ VN. */
  nhan: string;
  /** `bayGio` (giờ VN) có nằm TRONG tuần ấy không. Chủ đề xuất bản tuần trước mà chưa ai đóng
   * thì không còn là "chủ đề tuần NÀY". */
  trongTuan: boolean;
  /** Số ngày lịch từ hôm nay tới Chủ nhật của tuần (hôm nay không tính): thứ Tư → 4, Chủ nhật
   * → 0. Chỉ có nghĩa khi `trongTuan`; ngoài tuần là 0. */
  soNgayConLai: number;
};

/** Khoảng tuần (thứ Hai–Chủ nhật, GIỜ VN) của một chủ đề và số ngày còn lại tới hết Chủ nhật.
 *
 * Cùng cách tính tay với `tuanVNCua` (cộng 7 giờ rồi đọc `getUTC*`): không phụ thuộc múi giờ
 * máy chạy Node (server render ở UTC) — đêm Chủ nhật 23:30 giờ VN vẫn là Chủ nhật, "còn 0
 * ngày", không phải đã sang thứ Hai. `bayGio` là tham số để bài đo ghim được hai đầu ranh
 * giới mà không phải đợi tới Chủ nhật.
 */
export function khoangTuanVN(published_at: string, bayGio: Date): KhoangTuan {
  const tuan = tuanVNCua(published_at);
  const [nam, thang, ngay] = tuan.khoa.split("-").map(Number);
  const thu_hai = Date.UTC(nam, thang - 1, ngay);
  const chu_nhat = thu_hai + 6 * MS_NGAY;
  const vn = new Date(bayGio.getTime() + LECH_VN_MS);
  const hom_nay = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());

  const ngayThang = (ms: number) => {
    const d = new Date(ms);
    return `${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}`;
  };
  const trong_tuan = hom_nay >= thu_hai && hom_nay <= chu_nhat;
  return {
    nhan: `${ngayThang(thu_hai)} – ${ngayThang(chu_nhat)}`,
    trongTuan: trong_tuan,
    soNgayConLai: trong_tuan ? Math.round((chu_nhat - hom_nay) / MS_NGAY) : 0,
  };
}

/** Chữ trên chip trạng thái của khối chủ đề.
 *
 * - đã đóng ⇒ "Đã đóng", KHÔNG đếm;
 * - đang mở, còn trong tuần ⇒ "Đang mở · còn N ngày" (N ≥ 1) hoặc "Đang mở · đóng hôm nay"
 *   (Chủ nhật);
 * - đang mở nhưng đã quá tuần của nó (chưa ai đóng) ⇒ "Đang mở" trơn: số ngày âm hay "còn 0
 *   ngày" đều là con số bịa. */
export function chuChipChuDe(dang_mo: boolean, tuan: KhoangTuan): string {
  if (!dang_mo) return "Đã đóng";
  if (!tuan.trongTuan) return "Đang mở";
  return tuan.soNgayConLai > 0
    ? `Đang mở · còn ${tuan.soNgayConLai} ngày`
    : "Đang mở · đóng hôm nay";
}

type CoDiemBinhLuan = { id: number; depth: number; trang_thai: string; score: number };

/** "Quan điểm nổi bật" — bình luận GỐC (`depth === 1`) còn đọc được (`binh_thuong`) và có điểm
 * KHÔNG ÂM (`score >= 0`: một bình luận đang bị dìm không được đặt lên làm "nổi bật" chỉ vì
 * chủ đề có ít bình luận), điểm cao nhất trước, tối đa `toiDa`. Điểm bằng nhau giữ thứ tự API (`sort=hay_nhat`): sắp ổn định.
 * Không đột biến `ds`. Rỗng ⇒ khối ẩn phần phải. */
export function chonQuanDiemNoiBat<T extends CoDiemBinhLuan>(
  ds: readonly T[],
  toiDa: number,
): T[] {
  return ds
    .filter((b) => b.depth === 1 && b.trang_thai === "binh_thuong" && b.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, toiDa);
}

/** Số ký tự tối đa của đoạn trích một quan điểm. CSS kẹp 3 dòng; cắt ở đây để HTML không mang
 * nguyên bình luận dài nghìn chữ chỉ để rồi bị `line-clamp` giấu đi. */
const DAI_TRICH_QUAN_DIEM = 240;

/** Đoạn trích THUẦN CHỮ của một bình luận (HTML hoặc markdown) cho thẻ "Quan điểm nổi bật".
 *
 * HTML ⇒ `trichVanBanThuan`. Markdown ⇒ bỏ ký hiệu đầu dòng (`#`, `>`, `-`, `*`, `1.`), cặp
 * nhấn mạnh và link `[chữ](url)` → `chữ`, rồi gom khoảng trắng. Không cố hiểu markdown cho
 * đúng — đây là đoạn xem trước 3 dòng, không phải renderer (`lib/markdown.ts` mới là
 * renderer). Cắt ở `DAI_TRICH_QUAN_DIEM` ký tự và thêm "…" khi bị cắt. */
export function trichQuanDiem(body: string, dinh_dang: string): string {
  let chu =
    dinh_dang === "html"
      ? trichVanBanThuan(body)
      : body
          .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
          .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/(\*\*|__|\*|_|~~|`)/g, "")
          .replace(/\s+/g, " ")
          .trim();
  if (chu.length > DAI_TRICH_QUAN_DIEM) {
    chu = `${chu.slice(0, DAI_TRICH_QUAN_DIEM).trimEnd()}…`;
  }
  return chu;
}
