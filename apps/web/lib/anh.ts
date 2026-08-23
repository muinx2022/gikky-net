import { taiAnhMoc, xoaAnhMoc } from "@gikky/api-client";

import { cauLoi, layDuLieu } from "./ghi";
import { GOC_TRINH_DUYET, headerGhiFile } from "./tai-khoan";

/** Gửi ảnh lên mốc và gỡ ảnh xuống — Phase 5.
 *
 * **Cửa API nhận MỘT ảnh mỗi request** (`api/anh.py` nói rõ vì sao: mỗi ảnh hỏng theo
 * một kiểu khác nhau, và một response cho 5 ảnh thì hoặc mang 5 mã lỗi — một hình dạng
 * lỗi thứ hai ngoài `{detail, code}` của PLAN mục 7 — hoặc huỷ cả lượt vì một tấm sai).
 * File này là chỗ dịch "một ảnh mỗi request" thành thứ UI cần: gửi cả một lượt chọn, và
 * báo lại **từng tấm** hỏng vì sao.
 */

/** Định dạng nhận được, để đặt `accept` trên `<input type="file">`.
 *
 * ⚠ **Đây là gợi ý cho hộp chọn file, KHÔNG phải một phép kiểm.** `accept` chỉ lọc cái
 * hộp thoại mở ra; người dùng đổi bộ lọc sang "All files" là chọn được bất cứ thứ gì, và
 * một request tự viết thì không đi qua hộp thoại nào. Bảy phép kiểm thật nằm ở
 * `api/core/anh.py` và chúng **không tin** gì ở phía này.
 */
export const KIEU_NHAN = "image/jpeg,image/png,image/webp";

/** Kết quả gửi MỘT tấm. `loi === null` là thành công. */
export type KetQuaTaiAnh = {
  ten: string;
  loi: string | null;
};

/** Gửi lần lượt từng ảnh lên một mốc. Trả kết quả **theo từng tấm**, không ném.
 *
 * **Tuần tự chứ không `Promise.all`**, và đó là quyết định chứ không phải lười: trần 10
 * ảnh/mốc được enforce trong khoá hàng `Moc` ở server, nên gửi song song 8 tấm là 8
 * transaction xếp hàng chờ nhau trên cùng một khoá — không nhanh hơn, mà lại làm thứ tự
 * `position` phụ thuộc vào việc request nào tới trước. Tuần tự thì thứ tự trên màn hình
 * đúng bằng thứ tự người dùng đã sắp.
 *
 * Không ném: một tấm hỏng **không được** làm mất chín tấm kia. Người gọi nhận danh sách
 * đầy đủ rồi tự quyết hiện gì.
 */
export async function taiAnhLanLuot(
  mocId: number,
  files: readonly File[],
): Promise<KetQuaTaiAnh[]> {
  const ra: KetQuaTaiAnh[] = [];
  for (const file of files) {
    try {
      layDuLieu(
        await taiAnhMoc({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhiFile(),
          path: { moc_id: mocId },
          body: { file },
        }),
        "Không tải được ảnh lên.",
      );
      ra.push({ ten: file.name, loi: null });
    } catch (e) {
      ra.push({ ten: file.name, loi: cauLoi(e, "Không tải được ảnh lên.") });
    }
  }
  return ra;
}

/** Gỡ một ảnh đã lưu. Ném `LoiGhi` — người gọi bắt bằng `cauLoi`. */
export async function goAnh(anhId: number): Promise<void> {
  layDuLieu(
    await xoaAnhMoc({
      baseUrl: GOC_TRINH_DUYET,
      headers: await headerGhiFile(),
      path: { anh_id: anhId },
    }),
    "Không gỡ được ảnh.",
  );
}

/** Câu tóm tắt cho một lượt gửi nhiều ảnh, hoặc `null` khi cả lượt trót lọt.
 *
 * Gom vào một câu thay vì hiện mười dòng: người dùng vừa bấm Đăng và đang chờ, họ cần
 * biết **cái gì không lên** chứ không cần một bản kê. Tên file có mặt vì đó là thứ duy
 * nhất họ nhận ra tấm nào.
 */
export function cauLoiTaiAnh(ket_qua: readonly KetQuaTaiAnh[]): string | null {
  const hong = ket_qua.filter((k) => k.loi !== null);
  if (hong.length === 0) return null;
  if (hong.length === 1) return `${hong[0].ten}: ${hong[0].loi}`;
  return `${hong.length} ảnh không lên được — ${hong
    .map((h) => `${h.ten} (${h.loi})`)
    .join("; ")}`;
}
