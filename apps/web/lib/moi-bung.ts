import type { BinhLuanOut, MachChiTietOut } from "@gikky/api-client";

import { trongDaiGap, type DaiGap } from "./dai-gap";

/** MỘT trích dẫn nóng nhất làm mồi bung cho dải gập — PLAN 5.5, wireframe 9.2.
 *
 * **API không cấp trường này** (nợ 1b #4 — danh sách chuẩn:
 * `plans/2026-08-22-phase-1b-va2.md` §3) nên 1c tự tính, theo đúng
 * ba điều kiện của plan con §1:
 *
 * 1. chỉ **bình luận gốc** (`depth === 1`) — mồi là một câu đứng riêng, không phải reply
 *    lơ lửng giữa thread;
 * 2. `anchor_moc_seq` phải nằm **trong dải gập**. Đây là chỗ dễ cài sai nhất: lấy "điểm
 *    cao nhất toàn mạch" cho ra một câu neo ở mốc đang hiện ngay trên màn hình, tức mồi
 *    quảng cáo cho thứ người ta đã đọc rồi;
 * 3. **loại bình luận đã được trích vào sổ** — nó đã có mặt dưới dạng blockquote trên
 *    thẻ mốc, mồi lại lần nữa là kể hai lần cùng một câu.
 *
 * Bia mộ bị loại: `body` của nó là `null`, không có chữ nào để làm mồi.
 *
 * ⚠ **GIỚI HẠN ĐÃ BIẾT — chỉ đúng khi mạch có ≤ 50 thread gốc.** Nguồn dữ liệu là trang
 * đầu của `GET /machs/{id}/comments?sort=hay_nhat&limit=50` (PLAN 5.3 chốt 1 trang 50).
 * Mạch đông hơn thế thì câu điểm cao nhất trong dải gập có thể nằm ở trang sau và mồi sẽ
 * là câu cao nhì. Ghi ra thay vì giả vờ đủ; xử thật cần một trường do server tính.
 */
export function chonMoiBung(
  threads: readonly BinhLuanOut[],
  daiGap: DaiGap,
  idDaTrich: ReadonlySet<number>,
): BinhLuanOut | null {
  const ung_vien = threads.filter(
    (n) =>
      n.depth === 1 &&
      n.trang_thai === "binh_thuong" &&
      n.body !== null &&
      n.anchor_moc_seq !== null &&
      trongDaiGap(daiGap, n.anchor_moc_seq) &&
      !idDaTrich.has(n.id),
  );
  if (ung_vien.length === 0) return null;
  // Điểm bằng nhau thì lấy `id` nhỏ hơn: mồi phải ổn định giữa hai lần tải, không đổi
  // theo thứ tự API trả về.
  return ung_vien.reduce((a, b) =>
    b.score > a.score || (b.score === a.score && b.id < a.id) ? b : a,
  );
}

/** `comment_id` của mọi khối trích còn hiệu lực trên các mốc của mạch. */
export function idDaTrich(mach: Pick<MachChiTietOut, "mocs">): Set<number> {
  return new Set(
    mach.mocs.flatMap((m) => (m.trich === null ? [] : [m.trich.comment_id])),
  );
}
