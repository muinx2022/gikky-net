import type { LoiOut } from "@gikky/api-client";

/** Xử lỗi cho MỌI form ghi của `apps/web` — PLAN mục 7 (`{detail, code}`), nguyên tắc 10.
 *
 * Vì sao có file này thay vì mỗi form một `catch { datLoi("Không gửi được") }`: đường ghi
 * của Phase 2 trả **mã lỗi riêng cho từng ca** (`qua_han_muc_moc` 429, `mach_da_dong` 409,
 * `khong_phai_chu` 403…) kèm một câu tiếng Việt do server viết. Nuốt hết thành một câu
 * chung là ném đi đúng phần thông tin mà API cất công phân biệt — và với hạn mức 3 mốc/ngày
 * thì "Không gửi được. Thử lại." là lời khuyên SAI: thử lại bao nhiêu lần cũng vẫn 429.
 *
 * **`detail` của server đã là tiếng Việt cho người đọc** (xem `api/machs.py`), nên UI hiện
 * thẳng nó chứ không dịch lại. Chỗ duy nhất UI nói thêm là những ca mà câu của server thiếu
 * một con số mà chỉ trình duyệt mới biết cách trình bày — xem `moiVietTiep` ở `lib/vong-doi.ts`.
 *
 * **Frontend KHÔNG tính lại luật quyền ở đây** (nguyên tắc 10): mã lỗi là *kết quả đã quyết*
 * của server, file này chỉ chọn câu chữ theo nó.
 */

/** Mã lỗi mà UI **phân nhánh hành vi** theo — không phải toàn bộ bảng mã của API.
 *
 * Thêm một dòng vào đây nghĩa là có thêm một nhánh xử lý thật ở đâu đó; một hằng không ai
 * đọc chỉ là bản sao thứ hai của hợp đồng, đúng thứ PLAN 8.3 cấm. Cùng quy ước với
 * `CURSOR_KHONG_HOP_LE` ở `lib/api.ts`.
 */
export const MA_LOI = {
  /** 429 — quá 3 mốc trong ngày lịch VN của MỘT mạch (PLAN 5.1). */
  QUA_HAN_MUC_MOC: "qua_han_muc_moc",
  /** 409 — hết 7 ngày mở lại. UI ẩn nút trước đó, mã này là lưới an toàn khi tab mở lâu. */
  HET_HAN_MO_LAI: "het_han_mo_lai",
  /** 401 — phiên hết hạn giữa chừng. */
  CHUA_DANG_NHAP: "chua_dang_nhap",
} as const;

/** Một lời từ chối của API v1, đã kéo về hình dạng UI đọc được.
 *
 * Tên khác `LoiTaiKhoan` (`lib/tai-khoan.ts`, lỗi của allauth) và khác `LoiApi`
 * (`lib/api.ts`, lỗi của đường ĐỌC ở server component) là chủ đích: ba đường có ba hình
 * dạng lỗi và ba nơi hiện lỗi khác nhau, gộp tên là mời người sau `catch` nhầm loại.
 */
export class LoiGhi extends Error {
  constructor(
    readonly trangThai: number,
    /** `code` của PLAN mục 7. Chuỗi rỗng khi server không trả mã nào. */
    readonly ma: string,
    message: string,
  ) {
    super(message);
    this.name = "LoiGhi";
  }
}

/** Hình dạng kết quả của `@hey-api` — `response` là **tuỳ chọn** vì lỗi mạng thì không có
 * phản hồi nào (xem `packages/api-client/src/client/types.gen.ts`). */
type KetQua<T> = {
  data?: T;
  error?: unknown;
  response?: Response;
};

/** Lấy `data`, hoặc **ném** `LoiGhi` mang `code` + câu của server.
 *
 * Mọi form ghi gọi qua đây thay vì tự kiểm `kq.data === undefined`. Bản tự kiểm (kiểu
 * `if (kq.data === undefined) throw new Error("phản hồi rỗng")` của Mảng A) vứt mất cả
 * `code` lẫn `detail` ngay tại chỗ chúng vừa về tới — sau đó không còn gì để phân nhánh.
 */
export function layDuLieu<T>(kq: KetQua<T>, macDinh: string): T {
  if (kq.data !== undefined) return kq.data;
  const than = (kq.error ?? null) as LoiOut | null;
  throw new LoiGhi(
    kq.response?.status ?? 0,
    than?.code ?? "",
    than?.detail ?? macDinh,
  );
}

/** Câu hiện cho người dùng từ bất kỳ thứ gì `catch` bắt được.
 *
 * `LoiGhi` mang câu của server — dùng thẳng. Thứ khác (lỗi mạng, JSON hỏng) không có câu
 * nào đọc được, và lúc đó `macDinh` phải nói ra **việc gì** vừa hỏng: "Không gửi được" một
 * mình thì người dùng không biết bài đã đăng chưa.
 */
export function cauLoi(e: unknown, macDinh: string): string {
  return e instanceof LoiGhi ? e.message : macDinh;
}
