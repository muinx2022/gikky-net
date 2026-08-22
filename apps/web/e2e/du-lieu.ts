import type {
  BinhLuanOut,
  FeedOut,
  HoSoOut,
  KhanDaiOut,
  MachChiTietOut,
  NganKeoOut,
} from "@gikky/api-client";

/** Nguồn sự thật cho bài đo: gọi thẳng Django, KHÔNG đọc lại từ HTML mình vừa render.
 *
 * Một bài đo so HTML với HTML là bài đo chỉ chứng minh trang bằng chính nó. Ở đây trang
 * web nói một đằng và API nói một nẻo thì phải ĐỎ, nên mọi con số kỳ vọng lấy từ API.
 */
const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function json<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Tiêu đề khoá của hai mạch seed — trùng đúng hằng trong
 * `api/core/management/commands/seed_dev.py`. Tra theo tiêu đề chứ không theo `id`: `id`
 * đổi sau mỗi `seed_dev --reset`, và một bài đo ghim `id` cứng sẽ hỏng vì lý do không
 * liên quan gì tới thứ nó đo. */
export const TITLE_HPG = "Nhật ký lệnh HPG — vào 27.80, không bán trước tháng 8";
export const TITLE_POST_THUONG =
  "Sàn nào rút USDT về ngân hàng VN nhanh nhất tuần này?";
/** Mạch mang cả ba kiểu bia mộ (vá B2). Nó ở RIÊNG chứ không nhét vào mạch HPG vì HPG là
 * dữ liệu nghiệm thu của 1a/1b và từng con số của nó bị ghim ở 8 file test Python. */
export const TITLE_BIA_MO = "Nhật ký lệnh VNM — vào 62.5, thoát khi gãy nền";
export const USER_NHIEU_MACH = "e2e_nhieu_mach";

export async function timMachTheoTitle(title: string): Promise<MachChiTietOut> {
  const feed = await json<FeedOut>("/api/v1/feeds/moi?limit=50");
  const the = feed.items.find((m) => m.title === title);
  if (the === undefined) {
    throw new Error(`Không thấy mạch "${title}" trong feed — seed chưa chạy?`);
  }
  return json<MachChiTietOut>(`/api/v1/machs/${the.id}`);
}

export function machTheoId(id: number): Promise<MachChiTietOut> {
  return json<MachChiTietOut>(`/api/v1/machs/${id}`);
}

export function khanDai(
  machId: number,
  sort: string,
  them = "",
): Promise<KhanDaiOut> {
  return json<KhanDaiOut>(
    `/api/v1/machs/${machId}/comments?sort=${sort}&limit=50${them}`,
  );
}

export function nganKeo(mocId: number): Promise<NganKeoOut> {
  return json<NganKeoOut>(`/api/v1/mocs/${mocId}/comments`);
}

export function hoSo(username: string): Promise<HoSoOut> {
  return json<HoSoOut>(`/api/v1/users/${username}`);
}

/** Duyệt cây bình luận, gốc trước con — cùng thứ tự mà UI render ra DOM. */
export function duyet(threads: readonly BinhLuanOut[]): BinhLuanOut[] {
  const ra: BinhLuanOut[] = [];
  const di = (n: BinhLuanOut) => {
    ra.push(n);
    n.replies.forEach(di);
  };
  threads.forEach(di);
  return ra;
}

/** `/m/<slug>-<id>` của một mạch. */
export function duongDan(mach: MachChiTietOut): string {
  return `/m/${mach.slug}-${mach.id}`;
}

/** `dd/mm` theo giờ VN — phải khớp `lib/dinh-dang.ts`, nhưng cài đặt ĐỘC LẬP.
 *
 * Cố ý không import hàm của `lib/`: bài đo dùng chung cài đặt với thứ nó đo thì một lỗi
 * định dạng sẽ xuất hiện ở cả hai vế và tự triệt tiêu.
 */
export function ngayNganVN(iso: string): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(d);
  const lay = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${lay("day")}/${lay("month")}`;
}
