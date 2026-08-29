/** Phần THUẦN của hành động hàng loạt ở `/machs` và `/binh-luan`.
 *
 * Không có `fetch`, không có React, không có tên endpoint nào ở đây — cố ý ba lần:
 *
 * 1. vòng lặp gọi API phải nằm ngay trong trang, vì hàng rào
 *    `apps/web/e2e/don-vi/type-admin.spec.ts` cấm hàm API đi qua biến trung gian;
 * 2. hai hàm dưới đây là chỗ DUY NHẤT của tính năng này **đo được bằng bài kiểm tra
 *    thường** — xem `apps/web/e2e/don-vi/hang-loat-quan-tri.spec.ts`;
 * 3. lọc no-op và câu tóm tắt là hai luật dễ trôi nhất khi thêm cột hành động thứ ba.
 */

/** Id của những hàng ĐANG CHỌN mà thao tác thật sự đổi được trạng thái.
 *
 * ## Vì sao phải lọc no-op, chứ không cứ gọi hết cho gọn
 *
 * Mod chọn cả trang rồi bấm "Ẩn" trong khi 20/25 hàng đã ẩn sẵn. Gọi hết là 25 request
 * cho 5 việc, và câu tóm tắt phải tự trừ ra 20 lời gọi vô nghĩa mới nói đúng được.
 * ⚠ `AuditLog` thì KHÔNG cần phép lọc này bảo vệ: server tự thoát trước khi ghi khi
 * trạng thái không đổi (`api/core/ghi.py::dat_an_mach` và họ hàng đều `return False`
 * trước `ghi_audit`). Lọc ở đây là chuyện của số request và của câu tóm tắt — đừng dựa
 * vào nó như một hàng rào toàn vẹn nhật ký.
 *
 * ## Vì sao đi theo `items` chứ không theo `da_chon`
 *
 * `da_chon` có thể còn giữ id của trang trước hoặc của hàng vừa biến mất khỏi bộ lọc.
 * Duyệt `items` thì kết quả luôn là tập con của thứ mod ĐANG NHÌN THẤY, và giữ đúng thứ
 * tự trên bảng — thứ tự ấy là thứ tự vòng lặp tuần tự sẽ chạy, nên câu "lỗi ở id …" đọc
 * được theo bảng.
 *
 * @param dangO trạng thái HIỆN TẠI của hàng theo đúng trục đang thao tác (`da_bi_an`,
 *   `da_khoa`, …).
 * @param muon giá trị mod muốn có sau thao tác. `dangO(x) === muon` ⇒ không cần làm gì.
 */
export function locCanLam<T extends { id: number }>(
  items: readonly T[],
  da_chon: ReadonlySet<number>,
  dangO: (x: T) => boolean,
  muon: boolean,
): number[] {
  return items.filter((x) => da_chon.has(x.id) && dangO(x) !== muon).map((x) => x.id);
}

/** Câu tiếng Việt tổng kết một lượt chạy hàng loạt.
 *
 * Câu này là **nhật ký duy nhất** mod có về việc mình vừa làm cho N hàng, nên nó phải
 * đếm theo chuyện ĐÃ XẢY RA, không theo dự định. Bốn số phân biệt bốn số phận một hàng
 * có thể nhận:
 *
 * - `da_doi` — server xác nhận trạng thái ĐÃ đổi (`da_doi=true` trong response);
 * - `von_vay` — server nhận nhưng trả `da_doi=false`: một mod khác vừa đổi trước, hàng
 *   đã ở trạng thái đích sẵn. Gộp nó vào "thành công" là báo "đổi 5 bài" cho một lượt
 *   chỉ đổi 4;
 * - `that_bai` — server từ chối. In đủ id, không cắt bớt: đây là danh sách việc mod phải
 *   làm tay tiếp theo;
 * - `bo_do` — chưa được xử lý vì vòng lặp dừng sớm (hết phiên). Nhánh này TỪNG bị đếm
 *   nhầm là thành công — dừng ở hàng thứ 4/10 mà màn hình nói "10/10 thành công" — nên
 *   nó phải là một con số riêng, nói thẳng ra là chưa làm.
 *
 * Tổng của bốn số luôn bằng số mục tiêu sau khi lọc no-op — không hàng nào biến mất
 * khỏi lời kể.
 */
export function tomTatHangLoat(ket: {
  da_doi: number;
  von_vay: number;
  that_bai: readonly number[];
  bo_do: number;
}): string {
  const { da_doi, von_vay, that_bai, bo_do } = ket;
  const tong = da_doi + von_vay + that_bai.length + bo_do;
  if (tong === 0) return "Không có hàng nào cần đổi — đã bỏ qua tất cả.";
  let cau = `Đã đổi ${da_doi}/${tong}.`;
  if (von_vay > 0) cau += ` ${von_vay} hàng vốn đã ở trạng thái đích.`;
  if (that_bai.length > 0) cau += ` Lỗi ở: ${that_bai.join(", ")}.`;
  if (bo_do > 0) cau += ` Hết phiên — ${bo_do} hàng CHƯA xử lý.`;
  return cau;
}
