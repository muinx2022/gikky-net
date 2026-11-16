import type { BinhLuanOut } from "@gikky/api-client";

import { tenHienThi } from "./ten-hien-thi";

/** Bình luận trang mạch kiểu TikTok — hai tầng phẳng *(2026-11-16, user chốt)*.
 *
 * > *"hiển thị cmt theo kiểu tiktok, ưu tiên cmt của user đang đăng nhập"* — *"hiện tại
 * > chưa có nhiều cmt, nên hiển thị sao cho dễ nhìn thấy nhiều dữ liệu"*
 *
 * Dữ liệu VẪN là cây (`replies` lồng, nút trả lời vẫn gửi `parent_id` = id reply được
 * bấm); chỉ cách HIỆN là phẳng: gốc, rồi mọi hậu duệ của nó thành một danh sách thụt một
 * bậc. Reply không trả lời thẳng gốc mang dòng `↪ trả lời @cha` để mạch hội thoại không
 * mất khi cây bị dẹt.
 *
 * File này là **hàm thuần** — không React — để `e2e/don-vi/binh-luan-phang.spec.ts` ghim
 * được thứ tự, dòng `↪`, luật ưu tiên và luật gập đuôi mà không dựng trang. Plan:
 * `plans/2026-11-16-binh-luan-kieu-tiktok.md`.
 */

/** Cha của một reply phẳng, đủ để in dòng `↪ trả lời …`. `null` = KHÔNG in dòng này:
 * cha là chính gốc (reply thẳng vào gốc đứng ngay dưới gốc rồi), hoặc cha còn sống mà không
 * có tên nào để gọi (`author: null`) — in `@?` là bịa ra một cái tên. */
export type ChaReply =
  | { loai: "nguoi"; ten: string }
  | { loai: "da_xoa" }
  | { loai: "da_an" };

export type ReplyPhang = {
  nut: BinhLuanOut;
  cha: ChaReply | null;
};

/** Gốc hiện tối đa ngần này reply khi thread chưa bung; phần còn lại vào đuôi gập. */
export const SO_REPLY_HIEN_SAN = 3;

function moTaCha(cha: BinhLuanOut): ChaReply | null {
  if (cha.trang_thai === "da_xoa") return { loai: "da_xoa" };
  if (cha.trang_thai === "da_an") return { loai: "da_an" };
  const ten = tenHienThi(cha.author);
  return ten === "" ? null : { loai: "nguoi", ten };
}

/** Chữ của dòng `↪` — một chỗ sinh, component chỉ in. Tên người là phần cuối của chuỗi
 * để component tách được ra mà đánh dấu chữ người dùng (`CHU_NGUOI_DUNG`). */
export function chuTraLoi(cha: ChaReply): string {
  if (cha.loai === "da_xoa") return "↪ trả lời [bình luận đã xoá]";
  if (cha.loai === "da_an") return "↪ trả lời [đã bị ẩn]";
  return `↪ trả lời @${cha.ten}`;
}

function soKhi(s: string): number {
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

/** Mọi hậu duệ của `goc` (mọi tầng), phẳng, `created_at` tăng dần — hoà thì `id` tăng.
 *
 * Cha lấy theo **cấu trúc** (nút chứa nó trong `replies`), không tra `parent_id`: cây do
 * server dựng là nguồn sự thật về quan hệ cha–con, và tra theo `parent_id` sẽ có ca "mồ
 * côi" (id cha không có trong thread) phải chế luật cho. Theo cấu trúc thì mọi nút đều
 * có đúng một cha, và mỗi nút xuất hiện **đúng một lần**.
 *
 * Gốc không nằm trong kết quả. `cha === null` ⇔ cha là gốc, hoặc cha không có tên (xem
 * `ChaReply`).
 */
export function lamPhangThread(goc: BinhLuanOut): ReplyPhang[] {
  const ra: ReplyPhang[] = [];
  const di = (cha: BinhLuanOut) => {
    for (const con of cha.replies) {
      ra.push({ nut: con, cha: cha === goc ? null : moTaCha(cha) });
      di(con);
    }
  };
  di(goc);
  return ra.sort(
    (a, b) => soKhi(a.nut.created_at) - soKhi(b.nut.created_at) || a.nut.id - b.nut.id,
  );
}

/** Username có mặt trong thread: tác giả gốc + tác giả mọi reply (mọi tầng). */
export function nguoiThamGia(goc: BinhLuanOut): string[] {
  const tap = new Set<string>();
  const di = (n: BinhLuanOut) => {
    if (n.author?.username) tap.add(n.author.username);
    n.replies.forEach(di);
  };
  di(goc);
  return [...tap];
}

/** Đưa phần tử "của tôi" lên đầu, **giữ nguyên thứ tự tương đối** ở cả hai nhóm.
 *
 * `toi === null` (chưa đăng nhập, hoặc phiên còn đang tải) ⇒ trả về **đúng thứ tự cũ**:
 * HTML server (ISR, cache chung cho mọi người) là thứ tự của server, và đổi gì ở đây khi
 * chưa biết người xem là ai là đổi theo đoán. */
export function uuTienCuaToi<T>(
  ds: readonly T[],
  toi: string | null,
  coToi: (x: T, toi: string) => boolean,
): T[] {
  if (toi === null || toi === "") return [...ds];
  const cua_toi: T[] = [];
  const con_lai: T[] = [];
  for (const x of ds) (coToi(x, toi) ? cua_toi : con_lai).push(x);
  return [...cua_toi, ...con_lai];
}

/** Username tác giả gốc; `null` khi gốc là bia mộ (server nhả `author` ở bia mộ). */
export function tacGiaGoc(goc: BinhLuanOut): string | null {
  return goc.author?.username ?? null;
}

/** Sắp thread theo 3 bậc, **stable trong từng bậc**:
 * 1. thread có GỐC do `toi` viết;
 * 2. thread `toi` chỉ tham gia bằng reply;
 * 3. còn lại.
 *
 * Bản đầu (2026-11-16) gộp bậc 1 + 2 làm một nhóm "có tôi tham gia" giữ thứ tự server —
 * user báo trên prod: thread người khác mà mình có reply đứng TRÊN bình luận gốc của chính
 * mình (*"nick của tôi lại xuống dưới"*). Gốc bia mộ (`tacGiaGoc === null`) không phải
 * của ai. `toi` rỗng ⇒ thứ tự server, như `uuTienCuaToi`.
 */
export function sapThreadUuTien<
  T extends { tacGiaGoc: string | null; nguoiThamGia: readonly string[] },
>(threads: readonly T[], toi: string | null): T[] {
  const goc_cua_toi = uuTienCuaToi(threads, toi, (t, u) => t.tacGiaGoc === u);
  if (toi === null || toi === "") return goc_cua_toi;
  const so_goc = goc_cua_toi.filter((t) => t.tacGiaGoc === toi).length;
  return [
    ...goc_cua_toi.slice(0, so_goc),
    ...uuTienCuaToi(goc_cua_toi.slice(so_goc), toi, (t, u) => t.nguoiThamGia.includes(u)),
  ];
}

/** Reply của `toi` lên đầu danh sách reply (stable), rồi chia phần hiện sẵn / đuôi gập.
 *
 * Phần hiện sẵn = `SO_REPLY_HIEN_SAN` cái đầu, **nhưng không ít hơn số reply của tôi**:
 * reply của tôi KHÔNG BAO GIỜ nằm trong đuôi gập — người vừa trả lời phải thấy câu mình
 * vừa viết mà không phải bấm gì. Đuôi rỗng ⇔ không cần nút "Xem thêm".
 */
export function chiaReply<T extends { tacGia: string | null }>(
  replies: readonly T[],
  toi: string | null,
  soHienSan = SO_REPLY_HIEN_SAN,
): { dau: T[]; duoi: T[] } {
  const sap = uuTienCuaToi(replies, toi, (r, u) => r.tacGia === u);
  const so_cua_toi = toi === null ? 0 : sap.filter((r) => r.tacGia === toi).length;
  const cat = Math.max(soHienSan, so_cua_toi);
  return { dau: sap.slice(0, cat), duoi: sap.slice(cat) };
}

/** `bl-123` → `123`; mọi thứ khác → `null`. Đọc hash của URL (`neoBinhLuan` sinh ra). */
export function idTuNeo(neo: string): number | null {
  const m = /^#?bl-(\d+)$/.exec(neo);
  return m === null ? null : Number(m[1]);
}

/** Thứ tự + trạng thái ẩn của từng reply — đúng thứ `DanhSachReply` render.
 *
 * Một danh sách duy nhất (`dau` rồi `duoi`), mỗi phần tử tự mang cờ: `trongDuoi` (nằm sau
 * phần hiện sẵn) và `an` (đang bị gập). Một `<ul>`, key giữ nguyên, nên khi `toi` về và
 * một reply đổi phe hiện/gập thì React chỉ DỜI nó — không tháo rồi dựng lại (mất chữ đang
 * gõ dở trong ô trả lời).
 *
 * **Đích deep-link (`dichId`) không bao giờ bị ẩn**, kể cả khi nó nằm trong đuôi và đuôi
 * đang gập. Lý do là ca không có cú bấm nào cứu được: trang cuộn tới X lúc hydrate (khi
 * `toi` còn `null`, X đang ở phần hiện sẵn), rồi `toi` về, reply của tôi chen lên đầu và
 * đẩy X vào đuôi — X biến mất dưới tay người vừa được dẫn tới nó.
 */
export function hienReply<T extends { id: number; tacGia: string | null }>(
  replies: readonly T[],
  toi: string | null,
  moRong: boolean,
  dichId: number | null,
  soHienSan = SO_REPLY_HIEN_SAN,
): { ds: { r: T; trongDuoi: boolean; an: boolean }[]; coDuoi: boolean; soAn: number } {
  const { dau, duoi } = chiaReply(replies, toi, soHienSan);
  const ds = [
    ...dau.map((r) => ({ r, trongDuoi: false, an: false })),
    ...duoi.map((r) => ({ r, trongDuoi: true, an: !moRong && r.id !== dichId })),
  ];
  return { ds, coDuoi: duoi.length > 0, soAn: ds.filter((x) => x.an).length };
}
