import type { MachChiTietOut } from "@gikky/api-client";

import { ngayCuaThoiDiem } from "@/lib/dinh-dang";

import css from "./chan-dong-so.module.css";

/** Dòng CHỐT SỔ ở **cuối** nhật ký — thay cho `BannerMach` đã xoá *(user chốt
 * 2026-08-27)*.
 *
 * ## Vì sao banner đầu trang bị bỏ hẳn
 *
 * > *"không cần phân biệt bài thường hay mạch, cứ để nó tự nhiên, mạch cũng được, thường
 * > cũng được, nếu là mạch người đọc sẽ kéo xuống và đọc các mốc, không thì thôi"*
 *
 * `BannerMach` có ba nhánh — BÀI THƯỜNG · MẠCH ĐANG MỞ · MẠCH ĐÃ ĐÓNG — và hai nhánh
 * đầu **dán nhãn cho một thứ trang đã tự nói rồi**: có ray thời gian với nhiều mốc thì
 * là mạch, không có thì là bài lẻ. Nhánh `BÀI THƯỜNG` tệ nhất: `ket_qua` chỉ được đặt
 * lúc đóng sổ (`core/ghi.py::dong_so`) và số mốc thì chính banner cố ý giấu, nên nó là
 * một khung viền chiếm trọn chiều ngang để chứa đúng hai chữ.
 *
 * Thứ **không** suy ra được bằng cách đọc là mạch đã CHỐT SỔ: tác giả tuyên bố hết, sẽ
 * không nối mốc nữa, và `ket_qua` là dòng tổng kết. Cuộn tới cuối rồi vẫn không biết —
 * mốc cuối trông y hệt mốc cuối của một mạch còn đang chạy.
 *
 * ⇒ Giữ đúng phần ấy, và **chuyển xuống cuối**: đọc xuôi hết cuốn sổ rồi mới gặp câu
 * chốt, thay vì bị báo trước kết cục ở dòng đầu tiên.
 *
 * ## Mạch đang mở render `null`, không render một dòng rỗng
 *
 * Cùng lý lẽ mà `BannerMach` đã dùng cho `ket_qua`: một dòng rỗng vẫn để lại khoảng
 * trống và một dấu `·` lơ lửng mà người đọc không biết đang thiếu gì. Ở đây còn mạnh
 * hơn — "đang mở" là trạng thái MẶC ĐỊNH, nói ra nó là quay lại đúng cái nhãn vừa bỏ.
 *
 * ⚠ **`data-testid` phải mang tiền tố `chan-`.** `dong-so-ket-qua` ĐÃ tồn tại — nó là
 * Ô NHẬP trong form đóng sổ (`khoi-chu-mach.tsx:270`), và cả hai cùng sống trên một
 * trang khi chủ mạch mở form. Trùng testid ở đây là `getByTestId` khớp hai phần tử ⇒
 * `form-ghi.spec.ts` hỏng theo kiểu strict-mode violation, mà lỗi ấy đọc như lỗi của
 * form chứ không như lỗi của dòng chốt sổ.
 *
 * `closed_at` có thể `null` ngay cả khi `status === "closed"` (dữ liệu nạp tay, mạch cũ
 * trước khi cột ấy ra đời), nên ngày tháng render có điều kiện riêng — không gộp vào
 * phép kiểm `status`.
 */
export function ChanDongSo({
  mach,
}: {
  mach: Pick<MachChiTietOut, "status" | "ket_qua" | "closed_at">;
}) {
  if (mach.status !== "closed") return null;

  return (
    <p className={css.chan} data-testid="chan-dong-so">
      <span className={css.nhan} data-testid="chan-dong-so-nhan">
        Mạch đã đóng
      </span>
      {mach.closed_at !== null && (
        <span className="mono"> ngày {ngayCuaThoiDiem(mach.closed_at)}</span>
      )}
      {mach.ket_qua !== null && (
        <>
          <span className={css.cham} aria-hidden>
            ·
          </span>
          <span className={css.ket_qua} data-testid="chan-dong-so-ket-qua">
            {mach.ket_qua}
          </span>
        </>
      )}
    </p>
  );
}
