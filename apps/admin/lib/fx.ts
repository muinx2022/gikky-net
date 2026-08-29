/** Check FX — đo chồng lấn giữa các cặp forex.
 *
 * ## Vấn đề trang này giải
 *
 * Quy tắc quản trị rủi ro "mỗi đồng tiền chỉ giữ MỘT vị thế" chặn theo **tên cặp**: đã có
 * `AUDCAD` thì không mở `AUDNZD`, vì cả hai chứa `AUD`. Quy tắc ấy rẻ và bắt đúng những ca
 * chồng lấn nặng nhất, nhưng rủi ro không đi theo tên cặp — nó đi theo **nhân tố** (chiều
 * USD, khẩu vị rủi ro, chênh lãi suất, hàng hoá). Nên nó sai cả hai chiều:
 *
 * - **Bỏ sót**: `AUDCAD` vs `NZDUSD` = +0.655 và vs `EURUSD` = +0.610 (119 phiên, 26/08/2026).
 *   Không chung một ký tự nào, quy tắc cho qua, mà long cả hai là gần như cùng một cược.
 * - **Cấm nhầm**: `AUDCAD` vs `AUDNZD` = +0.341. Chung chữ `AUD` nên bị cấm, dù độc lập hơn
 *   hẳn `NZDUSD` mà quy tắc cho phép.
 *
 * Lý do kinh tế của ca thứ hai đáng ghi lại, vì nó không hiển nhiên: `AUD` và `NZD` gần như
 * song sinh về nhân tố (cùng chu kỳ hàng hoá, cùng độ nhạy Trung Quốc, cùng phản ứng
 * risk-on/risk-off). Lấy tỷ số của hai đồng giống nhau thì **các nhân tố chung triệt tiêu**,
 * chỉ còn lại chênh lệch chính sách RBA vs RBNZ. `AUDCAD` thì ngược lại — `AUD` nhạy rủi ro
 * hơn `CAD` nhiều, nên phần dư vẫn đậm chất beta rủi ro, và nó trôi cùng `EURUSD`.
 *
 * ## Vì sao mọi thứ ở đây là hàm thuần, trừ đúng một hàm tải
 *
 * `apps/web/e2e/don-vi/check-fx.spec.ts` chạy trong nhóm `don-vi` — nhóm cố ý **không có
 * React, không có Next, không chạm mạng, không chạm DB** (xem `playwright.don-vi.config.ts`).
 * Muốn bài đo kiểm được phép tính thật chứ không phải đọc source bằng regex, phần tính toán
 * phải nhập được từ một file không kéo theo gì. Chỉ `taiLichSu` chạm `fetch`, và không bài đo
 * nào gọi nó.
 */

/** Cặp forex trong danh mục theo dõi.
 *
 * Đúng 6 ký tự, viết hoa — `tachDongTien` cắt theo vị trí chứ không phân tách bằng dấu, và
 * mã Yahoo (`AUDCAD=X`) ghép thẳng từ chuỗi này.
 *
 * Danh sách dừng ở G10 + `SGD`: đây là công cụ đo chồng lấn, và chồng lấn chỉ có nghĩa khi cả
 * hai cặp đều đủ thanh khoản để giao dịch thật. Thêm một cặp là thêm một request mỗi lần tải
 * trang — 20 cặp đã là 20 request.
 */
export const CAP_THEO_DOI = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "USDJPY",
  "USDCHF",
  "EURJPY",
  "EURGBP",
  "EURCHF",
  "EURAUD",
  "EURCAD",
  "GBPJPY",
  "GBPCHF",
  "GBPCAD",
  "AUDJPY",
  "AUDCAD",
  "AUDNZD",
  "AUDCHF",
  "NZDCAD",
  "CADJPY",
  "CHFJPY",
] as const;

export type CapFx = (typeof CAP_THEO_DOI)[number];

/** Số phiên cho phép chọn.
 *
 * Ba mốc chứ không phải ô nhập tự do: tương quan trên dưới ~40 phiên là nhiễu chứ không phải
 * tín hiệu, còn trên 250 phiên thì trộn lẫn nhiều chế độ thị trường khác nhau vào một con số.
 */
export const SO_PHIEN_CHON = [60, 120, 250] as const;

export const SO_PHIEN_MAC_DINH = 120;
export const CAP_MAC_DINH: CapFx = "AUDCAD";

/* ===========================================================================
 * Ngưỡng phân loại
 * ========================================================================= */

/** Từ đây trở lên, hai cặp coi như cùng một cược. */
export const NGUONG_CHONG_LAN = 0.45;

/** Dưới ngưỡng này, một cặp chung đồng tiền vẫn coi như độc lập trên thực tế. */
export const NGUONG_DOC_LAP = 0.35;

/** Dưới ngưỡng này thì gần như trực giao — mức "an toàn" thật sự. */
export const NGUONG_TRUC_GIAO = 0.2;

/** Chung đồng tiền và tương quan từ đây trở lên: quy tắc tên cặp đã làm đúng việc. */
export const NGUONG_CHAN_DUNG = 0.7;

export type LoaiKetLuan =
  | "chan-dung"
  | "chong-lan-an"
  | "cam-nham"
  | "truc-giao"
  | "trung-gian";

export const CHU_KET_LUAN: Record<LoaiKetLuan, string> = {
  "chan-dung": "Quy tắc chặn đúng",
  "chong-lan-an": "CHỒNG LẤN ẨN — quy tắc bỏ sót",
  "cam-nham": "Quy tắc cấm nhầm",
  "truc-giao": "Gần như trực giao",
  "trung-gian": "Trung gian",
};

/** Giải thích một dòng cho mỗi kết luận — chữ mà user đọc để biết phải làm gì. */
export const GIAI_THICH_KET_LUAN: Record<LoaiKetLuan, string> = {
  "chan-dung": "Chung đồng tiền và thực sự đi cùng nhau. Quy tắc tên cặp đã chặn đúng.",
  "chong-lan-an":
    "Không chung ký tự nào nên quy tắc cho qua, nhưng hai cặp đi cùng nhau. Mở cả hai là nhân đôi cùng một cược.",
  "cam-nham":
    "Chung đồng tiền nên quy tắc cấm, nhưng thực tế gần như độc lập. Nhân tố chung của hai đồng đã triệt tiêu nhau.",
  "truc-giao": "Không chung đồng tiền và gần như không liên quan. Chồng lấn hằng ngày thấp nhất.",
  "trung-gian": "Nằm giữa các ngưỡng — không đủ để gọi là chồng lấn, cũng không đủ để gọi là độc lập.",
};

/* ===========================================================================
 * Hàm thuần
 * ========================================================================= */

/** Hai đồng tiền của một cặp. `"AUDCAD"` → `["AUD", "CAD"]`. */
export function tachDongTien(cap: string): [string, string] {
  return [cap.slice(0, 3).toUpperCase(), cap.slice(3, 6).toUpperCase()];
}

/** `true` nếu hai cặp dùng chung ít nhất một đồng tiền — tức quy tắc tên cặp sẽ chặn.
 *
 * Đây chính là quy tắc của user, viết thành code để đối chiếu với tương quan đo được.
 */
export function chungDongTien(cap_a: string, cap_b: string): boolean {
  const [a1, a2] = tachDongTien(cap_a);
  const b = tachDongTien(cap_b);
  return b.includes(a1) || b.includes(a2);
}

/** Lợi suất log giữa các phiên liên tiếp. `n` giá → `n-1` lợi suất.
 *
 * Log chứ không phải phần trăm: lợi suất log cộng được theo thời gian, và tương quan trên nó
 * không lệch theo chiều yết giá (`USDJPY` so với `JPYUSD` ra cùng độ lớn, chỉ đảo dấu).
 * Giá ≤ 0 bị bỏ — chúng là dữ liệu hỏng, không phải giá.
 */
export function loiSuatLog(gia: number[]): number[] {
  const ra: number[] = [];
  for (let i = 1; i < gia.length; i++) {
    const truoc = gia[i - 1];
    const nay = gia[i];
    if (!(truoc > 0) || !(nay > 0)) continue;
    ra.push(Math.log(nay / truoc));
  }
  return ra;
}

/** Hệ số tương quan Pearson. `null` khi không tính được (quá ngắn, hoặc một chuỗi phẳng).
 *
 * Trả `null` chứ không phải `0`: một chuỗi phẳng (mọi lợi suất bằng nhau) có phương sai 0 nên
 * tương quan **không xác định**, và `0` ở đây đọc thành "đã đo, thấy độc lập" — đúng cái kết
 * luận nguy hiểm nhất để bịa ra. Hai chuỗi lệch độ dài thì cắt theo chuỗi ngắn hơn.
 */
export function tuongQuan(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 20) return null;
  const a = x.slice(x.length - n);
  const b = y.slice(y.length - n);

  let tong_a = 0;
  let tong_b = 0;
  for (let i = 0; i < n; i++) {
    tong_a += a[i];
    tong_b += b[i];
  }
  const tb_a = tong_a / n;
  const tb_b = tong_b / n;

  let tich = 0;
  let bp_a = 0;
  let bp_b = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - tb_a;
    const db = b[i] - tb_b;
    tich += da * db;
    bp_a += da * da;
    bp_b += db * db;
  }
  if (bp_a === 0 || bp_b === 0) return null;

  const r = tich / Math.sqrt(bp_a * bp_b);
  return Number.isFinite(r) ? r : null;
}

/** Xếp một cặp vào một trong năm nhóm, từ tương quan và việc có chung đồng tiền hay không.
 *
 * Thứ tự nhánh có ý: hai nhóm CẢNH BÁO (`chong-lan-an`, `cam-nham`) phải được hỏi trước nhóm
 * yên ả, nếu không một cặp chồng lấn ẩn ở mức 0.5 sẽ rơi vào `trung-gian` và biến mất khỏi
 * phần user cần đọc nhất.
 */
export function phanLoai(r: number, chung: boolean): LoaiKetLuan {
  const do_lon = Math.abs(r);
  if (!chung && do_lon >= NGUONG_CHONG_LAN) return "chong-lan-an";
  if (chung && do_lon < NGUONG_DOC_LAP) return "cam-nham";
  if (chung && do_lon >= NGUONG_CHAN_DUNG) return "chan-dung";
  if (!chung && do_lon < NGUONG_TRUC_GIAO) return "truc-giao";
  return "trung-gian";
}

/** Mức độ để tô màu — chỉ ba bậc, và chúng ánh xạ sang token `xau` / `chu-y` / `tot`. */
export function mucDo(loai: LoaiKetLuan): "xau" | "chu-y" | "tot" | "trung-tinh" {
  if (loai === "chong-lan-an") return "xau";
  if (loai === "cam-nham") return "chu-y";
  if (loai === "truc-giao") return "tot";
  return "trung-tinh";
}

export type DongKetQua = {
  cap: CapFx;
  r: number;
  chung: boolean;
  loai: LoaiKetLuan;
};

/** So cặp đang giữ với mọi cặp còn lại, xếp theo độ lớn tương quan giảm dần.
 *
 * Nhận sẵn bảng lợi suất nên hàm này thuần và test được. Cặp thiếu dữ liệu hoặc không tính
 * được tương quan bị **bỏ khỏi kết quả**, không đưa vào với `r = 0` — xem lý do ở `tuongQuan`.
 */
export function soSanhVoiDanhMuc(
  cap_dang_giu: CapFx,
  loi_suat: Partial<Record<CapFx, number[]>>,
): DongKetQua[] {
  const goc = loi_suat[cap_dang_giu];
  if (goc === undefined) return [];

  const ra: DongKetQua[] = [];
  for (const cap of CAP_THEO_DOI) {
    if (cap === cap_dang_giu) continue;
    const kia = loi_suat[cap];
    if (kia === undefined) continue;
    const r = tuongQuan(goc, kia);
    if (r === null) continue;
    const chung = chungDongTien(cap_dang_giu, cap);
    ra.push({ cap, r, chung, loai: phanLoai(r, chung) });
  }
  return ra.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

/** Đọc `?cap=` thành một cặp hợp lệ. Giá trị lạ → cặp mặc định, không phải lỗi 500. */
export function docCap(tho: string | string[] | undefined): CapFx {
  const chuoi = (Array.isArray(tho) ? tho[0] : tho)?.toUpperCase();
  const khop = CAP_THEO_DOI.find((c) => c === chuoi);
  return khop ?? CAP_MAC_DINH;
}

/** Đọc `?phien=` thành một mốc hợp lệ. */
export function docSoPhien(tho: string | string[] | undefined): number {
  const chuoi = Array.isArray(tho) ? tho[0] : tho;
  const so = Number(chuoi);
  const khop = SO_PHIEN_CHON.find((p) => p === so);
  return khop ?? SO_PHIEN_MAC_DINH;
}

/* ===========================================================================
 * Tải dữ liệu — phần DUY NHẤT chạm mạng
 * ========================================================================= */

/** Bao nhiêu phiên cần tải để còn đủ sau khi cắt. Dư ra vì ngày nghỉ và ngày thiếu dữ liệu. */
function khoangTai(so_phien: number): string {
  if (so_phien <= 60) return "6mo";
  if (so_phien <= 120) return "1y";
  return "2y";
}

/** Giá đóng cửa của một cặp, cũ → mới.
 *
 * Nguồn là Yahoo Finance chart API. Không đi qua `@gikky/api-client`: đây là **nguồn ngoài**,
 * không phải API của gikky, nên nó không có chỗ trong OpenAPI và không được sinh client
 * (PLAN 8.3 cấm khai type trùng API — luật ấy nói về API của mình, còn đây là chuyện khác).
 *
 * `revalidate: 3600` — dữ liệu là nến NGÀY, gọi lại mỗi lần tải trang là 22 request cho một
 * con số không đổi trong ngày.
 */
export async function taiLichSu(cap: CapFx, so_phien: number): Promise<number[] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cap}=X?interval=1d&range=${khoangTai(so_phien)}`;
  try {
    const phan_hoi = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; gikky-admin/1.0)" },
      next: { revalidate: 3600 },
    });
    if (!phan_hoi.ok) return null;

    const json: unknown = await phan_hoi.json();
    const dong = docDongCua(json);
    if (dong === null) return null;

    const sach = dong.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
    return sach.length >= 20 ? sach.slice(-so_phien) : null;
  } catch {
    return null;
  }
}

/** Bóc mảng giá đóng cửa khỏi JSON của Yahoo, hoặc `null` nếu hình dạng không như mong đợi.
 *
 * Viết tay thay vì ép kiểu: đây là JSON của bên thứ ba, và một `as` ở đây là lời hứa suông
 * — hình dạng đổi thì trang vỡ lúc chạy chứ không phải lúc biên dịch.
 */
function docDongCua(json: unknown): (number | null)[] | null {
  if (typeof json !== "object" || json === null) return null;
  const chart = (json as { chart?: unknown }).chart;
  if (typeof chart !== "object" || chart === null) return null;
  const result = (chart as { result?: unknown }).result;
  if (!Array.isArray(result) || result.length === 0) return null;
  const dau = result[0];
  if (typeof dau !== "object" || dau === null) return null;
  const indicators = (dau as { indicators?: unknown }).indicators;
  if (typeof indicators !== "object" || indicators === null) return null;
  const quote = (indicators as { quote?: unknown }).quote;
  if (!Array.isArray(quote) || quote.length === 0) return null;
  const q = quote[0];
  if (typeof q !== "object" || q === null) return null;
  const close = (q as { close?: unknown }).close;
  return Array.isArray(close) ? (close as (number | null)[]) : null;
}

/** Tải toàn bộ danh mục song song. Cặp nào hỏng thì vắng mặt, không làm hỏng cả trang. */
export async function taiDanhMuc(so_phien: number): Promise<Partial<Record<CapFx, number[]>>> {
  const cap_va_gia = await Promise.all(
    CAP_THEO_DOI.map(async (cap) => [cap, await taiLichSu(cap, so_phien)] as const),
  );
  const ra: Partial<Record<CapFx, number[]>> = {};
  for (const [cap, gia] of cap_va_gia) {
    if (gia !== null) ra[cap] = gia;
  }
  return ra;
}
