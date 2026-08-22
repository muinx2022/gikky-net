/** Chạy nhiều việc bất đồng bộ **có trần đồng thời** — vá E4, 2026-08-22.
 *
 * Vì sao cần: trang mạch nạp sẵn ngăn kéo cho MỌI mốc, và bản đầu làm bằng
 * `Promise.all(mach.mocs.map(docNganKeo))` — fan-out song song không có trần. Một mạch 40
 * mốc là **40 kết nối đồng thời** vào Django cho MỘT lượt tải một URL công khai, và
 * `force-dynamic` nghĩa là không tầng cache nào hấp thụ giúp. Ai cũng mở được URL đó,
 * nên hệ số khuếch đại 40× là thứ người ngoài điều khiển được.
 *
 * Đây **không phải** bản vá cho nợ có tên `N+1-NGAN-KEO` (danh sách nợ:
 * `plans/2026-08-22-phase-1d-va3.md` §4). Số lời gọi vẫn bằng số mốc; chỗ này chỉ chặn
 * chúng ập vào cùng một lúc. Xử thật ở Phase 3 cùng lúc bật ISR.
 *
 * *(Tên cũ ở đây là "#1" — số ấy trỏ vào một khoản KHÁC trong cùng danh sách; sửa ở Y5,
 * lượt vá 4, và danh sách nay định danh bằng tên chứ không bằng số.)*
 */

/** Trần mặc định cho fan-out ngăn kéo.
 *
 * Chọn 6 theo đúng số kết nối tối đa mà trình duyệt tự đặt cho một origin HTTP/1.1 — một
 * con số đã sống lâu và đủ nhỏ để 40 mốc không thành 40 kết nối, đủ lớn để mạch cỡ seed
 * (9 mốc) vẫn xong trong hai lượt. Nó là một lựa chọn, không phải một hằng số của tự
 * nhiên: đo rồi đổi thì đổi ở đây.
 */
export const TRAN_NGAN_KEO = 6;

/** Như `Promise.all(dau_vao.map(viec))` nhưng không quá `tran` việc chạy cùng lúc.
 *
 * **Thứ tự kết quả giữ nguyên theo `dau_vao`**, không theo thứ tự hoàn thành — người gọi
 * ghép kết quả về mốc theo chỉ số, nên đây là ràng buộc chứ không phải chi tiết cài đặt.
 *
 * Một việc ném lỗi thì `chayCoTran` ném lỗi đó, y như `Promise.all`. Cố ý không nuốt:
 * `lib/api.ts` phân biệt 404 (trả `null`) với hỏng thật (`LoiApi`), và nuốt ở đây là xoá
 * mất phân biệt ấy — trang sẽ hiện ngăn kéo rỗng thay vì báo hỏng.
 */
export async function chayCoTran<T, R>(
  dau_vao: readonly T[],
  tran: number,
  viec: (x: T, i: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(tran) || tran < 1) {
    throw new RangeError(`trần đồng thời phải là số nguyên ≥ 1, nhận ${tran}`);
  }
  const ra = new Array<R>(dau_vao.length);
  let ke_tiep = 0;
  const tho = async (): Promise<void> => {
    for (;;) {
      const i = ke_tiep;
      ke_tiep += 1;
      if (i >= dau_vao.length) return;
      ra[i] = await viec(dau_vao[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(tran, dau_vao.length) }, () => tho()),
  );
  return ra;
}
