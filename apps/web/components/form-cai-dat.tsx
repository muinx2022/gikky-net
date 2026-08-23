"use client";

import { suaToi } from "@gikky/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./form-tai-khoan.module.css";
import { usePhien } from "./phien";

/** Trang `/cai-dat` — nợ có tên `TRANG-CAI-DAT`, trả 2026-08-23.
 *
 * ## Vì sao nó là một mục CHẶN chứ không một tiện ích
 *
 * `PATCH /api/v1/me` mở ở lượt vá V1 và `GET /me` trả `nhan_digest`, nhưng **không có
 * trang nào bấm vào chúng** — nên digest tuần là một tính năng đã dựng xong cả đường ống
 * (`core/digest.py`, `gui_digest`, mẫu thư, người nhận) mà không ai bật được. Đây là cửa
 * duy nhất.
 *
 * Vế thứ hai: câu cuối thư digest có link **huỷ đăng ký** trỏ về `/cai-dat`. Ở V1 link ấy
 * bị **gỡ khỏi thư** vì trang chưa tồn tại, và `test_digest.py` ghim `"/cai-dat" not in
 * thu.than` để nó không quay lại sớm. Nay trang có thật — nhưng bài đo ấy **ở lại nguyên**
 * trong lượt này: gắn link vào thư là việc của `core/digest.py`, tức đường gửi thư, và
 * SMTP thì "chưa bao giờ chạy thật" (`LOI-VA-NO.md` mục C). Mở lại link trong một lượt
 * không đo được thư là đúng loài "chữ nói quá code" mà sổ đang đếm.
 *
 * ## Cờ đọc từ `/me`, không giữ bản sao
 *
 * `usePhien()` đã có `nhan_digest`. Sau khi PATCH thành công gọi `taiLai()` để nguồn sự
 * thật vẫn là server — cùng lý lẽ với `KhoiChuMach` và với hàng đợi báo cáo của khu quản
 * trị: đoán lại trạng thái ở client là dựng bản thứ hai của một luật domain.
 */
export function FormCaiDat() {
  const { toi, dangTai, taiLai } = usePhien();
  const router = useRouter();
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const [xong, datXong] = useState<string | null>(null);

  // Cùng hàng rào với `/doi-mat-khau`: trang này chỉ có nghĩa khi đã đăng nhập, và một ô
  // công tắc hiện ra cho khách là một ô bấm vào sẽ ăn 401.
  useEffect(() => {
    if (!dangTai && !(toi?.dang_nhap ?? false)) router.replace("/dang-nhap");
  }, [dangTai, toi, router]);

  if (dangTai || toi === null || !toi.dang_nhap) {
    // Không vẽ gì trong nhịp chưa biết mình là ai — cùng lý lẽ với `ThanhTaiKhoan`. Ở đây
    // nó còn nặng hơn: vẽ công tắc ở trạng thái mặc định rồi nhảy sang trạng thái thật là
    // người dùng thấy cờ của mình tự bật/tắt trước mắt.
    return null;
  }

  const doi = async (bat: boolean) => {
    datDangGui(true);
    datLoi(null);
    datXong(null);
    try {
      const kq = await suaToi({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        body: { nhan_digest: bat },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      await taiLai();
      datXong(bat ? "Đã bật digest tuần." : "Đã tắt digest tuần.");
    } catch {
      datLoi("Không lưu được. Thử lại sau ít giây.");
    } finally {
      datDangGui(false);
    }
  };

  return (
    <div className={css.khung}>
      <div className={css.the}>
        <h1 className={css.tieu_de}>Cài đặt</h1>
        <p className={css.mo_ta}>
          Tài khoản <span className="mono">u/{toi.username}</span>
          {toi.email === null ? null : (
            <>
              {" · "}
              <span className="mono">{toi.email}</span>
            </>
          )}
        </p>

        {loi !== null && (
          <p className={css.loi} role="alert">
            {loi}
          </p>
        )}

        <label className={css.cong_tac}>
          <input
            type="checkbox"
            checked={toi.nhan_digest}
            disabled={dangGui}
            onChange={(e) => void doi(e.target.checked)}
            data-testid="cai-dat-digest"
          />
          <span>
            <span className={css.cong_tac_nhan}>Nhận digest tuần qua email</span>
            <span className={css.goi_y}>
              Một thư mỗi tuần: mạch bạn theo có gì mới. Tắt lúc nào cũng được, ngay tại
              đây.
            </span>
          </span>
        </label>

        {/* `role="status"` chứ không `role="alert"`: đây là xác nhận một việc người dùng
            vừa chủ động làm, không phải một tin cần cắt ngang. */}
        {xong !== null && (
          <p className={css.xong} role="status" data-testid="cai-dat-xong">
            {xong}
          </p>
        )}

        {!toi.email_da_xac_thuc && (
          <p className={css.duoi} data-testid="cai-dat-chua-xac-thuc">
            Email của bạn chưa xác thực — thư digest sẽ không gửi tới cho tới khi xác thực
            xong.
          </p>
        )}
      </div>
    </div>
  );
}
