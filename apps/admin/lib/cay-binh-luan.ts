/** Dựng cây bình luận từ danh sách phẳng của cửa quản trị.

 * Không React, không `fetch`: trang chi tiết mạch chỉ việc vẽ, và
 * `apps/web/e2e/don-vi` import được file này (cùng lý do `lib/hang-loat.ts`).
 *
 * Luật gắn:
 *
 * - `parent_id` trỏ tới một id **có trong tập** thì nút nằm trong `con` của cha,
 *   `khongThayCha` false;
 * - `parent_id` null → nút gốc, `khongThayCha` false;
 * - cha không có trong tập (reply mồ côi) → vẫn là nút gốc, không bỏ sót, nhưng
 *   `khongThayCha` true. UI chỉ đọc cờ này, không tự suy từ `parent_id`: nút đứng
 *   đầu một chu trình cũng có `parent_id` khác null, mà cha của nó thì có trong tập;
 * - anh em sắp `created_at` tăng dần, hoà thì `id` tăng dần. So thời điểm
 *   (`Date.parse`), không so chuỗi: `2026-11-15T08:00:00.500Z` đứng trước
 *   `2026-11-15T08:00:00Z` theo từ điển dù muộn hơn nửa giây. Hai chuỗi cùng
 *   một thời điểm — hoặc không parse được — thì `id` quyết định.
 *
 * Chu trình (A cha của B, B cha của A) không được đệ quy vô hạn. Nút đã nằm trong
 * chuỗi tổ tiên thì không gắn lại. Thành phần không có gốc tự nhiên thì bắt đầu
 * từ nút **cũ nhất còn nằm trong vòng** — cạnh quay về nút đó chính là cạnh bị
 * bỏ, và nút trỏ vào vòng vẫn là con của nút trong vòng chứ không bị cắt thành gốc.
 */

export type HangCay = {
  id: number;
  parent_id: number | null;
  created_at: string;
};

export type NutCay<T> = T & {
  con: NutCay<T>[];
  /** Cha không nằm trong tập đã nạp. Gốc thật và nút trong chu trình đều false. */
  khongThayCha: boolean;
};

/** Thời điểm trước, rồi `id`. `<` / `>` bỏ qua `NaN`, nên chuỗi hỏng rơi vào hoà. */
function soSanh(a: HangCay, b: HangCay): number {
  const ta = Date.parse(a.created_at);
  const tb = Date.parse(b.created_at);
  if (ta < tb) return -1;
  if (ta > tb) return 1;
  return a.id - b.id;
}

/** `id` có nằm trong một vòng khi đi theo `parent_id` hay không.
 *
 * Gặp lại đúng `id` thì có. Gặp một vòng khác (đi vào vòng rồi quay, không quay
 * về `id`) thì không — nút đó là con của vòng, không phải một gốc mới.
 */
function trongVong(id: number, theoId: ReadonlyMap<number, HangCay>): boolean {
  const thay = new Set<number>();
  let cur = id;
  while (!thay.has(cur)) {
    thay.add(cur);
    const nut = theoId.get(cur);
    if (nut === undefined) return false;
    const cha = nut.parent_id;
    if (cha === null || !theoId.has(cha)) return false;
    cur = cha;
  }
  return cur === id;
}

export function dungCay<T extends HangCay>(items: readonly T[]): NutCay<T>[] {
  // Id trùng thì giữ hàng đầu. Pk bình luận là duy nhất; hàng sau là cùng một nút.
  const theoId = new Map<number, T>();
  for (const item of items) {
    if (!theoId.has(item.id)) theoId.set(item.id, item);
  }

  const conTheoCha = new Map<number, T[]>();
  for (const item of theoId.values()) {
    const cha = item.parent_id;
    if (cha === null || !theoId.has(cha)) continue;
    const ds = conTheoCha.get(cha);
    if (ds !== undefined) ds.push(item);
    else conTheoCha.set(cha, [item]);
  }
  for (const ds of conTheoCha.values()) ds.sort(soSanh);

  const daDat = new Set<number>();

  function lap(item: T, toTien: Set<number>): NutCay<T> | null {
    // Đã nằm trong chuỗi tổ tiên, hoặc đã gắn ở nhánh khác: không gắn lại.
    if (toTien.has(item.id) || daDat.has(item.id)) return null;
    daDat.add(item.id);
    toTien.add(item.id);
    const con: NutCay<T>[] = [];
    for (const c of conTheoCha.get(item.id) ?? []) {
      const nut = lap(c, toTien);
      if (nut !== null) con.push(nut);
    }
    toTien.delete(item.id);
    const khongThayCha = item.parent_id !== null && !theoId.has(item.parent_id);
    return { ...item, con, khongThayCha };
  }

  const goc: NutCay<T>[] = [];
  const thuTu = [...theoId.values()].sort(soSanh);
  const laGocTuNhien = (item: T) =>
    item.parent_id === null || !theoId.has(item.parent_id);

  for (const item of thuTu) {
    if (daDat.has(item.id) || !laGocTuNhien(item)) continue;
    const nut = lap(item, new Set());
    if (nut !== null) goc.push(nut);
  }
  // Phần sót là chu trình không có gốc tự nhiên. Nút cũ nhất trong vòng thành gốc;
  // nút chỉ trỏ vào vòng thì `trongVong` loại, để lượt `lap` gắn nó vào cha.
  for (const item of thuTu) {
    if (daDat.has(item.id) || !trongVong(item.id, theoId)) continue;
    const nut = lap(item, new Set());
    if (nut !== null) goc.push(nut);
  }

  goc.sort(soSanh);
  return goc;
}

/** Màn hình khán đài sau một lượt nạp.
 *
 * Có `loiNap` thì không vẽ cây — kể cả khi `items` vẫn còn bản của lượt trước.
 * `[]` mới là «chưa ai bình luận». `null` cộng lỗi là chỉ câu lỗi, không skeleton
 * và không câu «chưa ai».
 */
export type ManHinhCay = "skeleton" | "chi-loi" | "chua-ai" | "cay";

export function manHinhCay(
  items: readonly unknown[] | null,
  loiNap: string | null,
  soNutGoc: number,
): ManHinhCay {
  if (loiNap !== null) return "chi-loi";
  if (items === null) return "skeleton";
  if (soNutGoc === 0) return "chua-ai";
  return "cay";
}

/** Còn hàng chưa vào cây.
 *
 * `dungViTran`: dừng vì hết số lần nạp mà cursor vẫn còn.
 * Hết cursor mà `tong` của trang cuối vẫn lớn hơn số hàng đã gom: bình luận mới
 * chèn phía trước cursor (sau trang 1) không được lật tới. `tong` nhỏ hơn số
 * hàng đã gom thì không báo — hàng biến mất giữa chừng không phải «còn thiếu».
 */
export function conThieuSauNap(tin: {
  tong: number;
  soHangDaGom: number;
  dungViTran: boolean;
}): boolean {
  if (tin.dungViTran) return true;
  return tin.tong > tin.soHangDaGom;
}
