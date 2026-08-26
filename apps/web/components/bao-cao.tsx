"use client";

import { guiBaoCao, type BaoCaoMoiIn } from "@gikky/api-client";
import { useState } from "react";

import { cauLoi, layDuLieu } from "@/lib/ghi";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./bao-cao.module.css";

/** Form "Báo cáo" — PLAN 5.10: *"nút báo cáo trên mạch/mốc/bình luận với lý do … → hàng
 * đợi admin"*. Cài ở lượt vá V1 (L03).
 *
 * ### Vì sao mục menu nằm ở component CHA, còn form ở đây
 *
 * Menu `⋯` là một `<details>` **uncontrolled**, và cả hai chỗ gọi đều đóng nó ngay sau khi
 * chọn một mục (xem `HanhDongBinhLuan.dongMenu`). Một form render *bên trong* hộp menu vì
 * thế biến mất cùng lúc nó mở ra. Nên cha giữ state "đang mở form nào" — đúng lối mà "Sửa"
 * đã dùng — và render component này ở thân, ngoài menu.
 *
 * ### Sáu lý do là ENUM của server, không phải chữ tự do
 *
 * `LyDo` nhập từ `BaoCaoMoiIn` của TS client, không gõ lại (PLAN 8.3): thêm/bớt một lý do
 * ở Django là `pnpm codegen` làm chỗ này đỏ ở `tsc`, thay vì lặng lẽ gửi một giá trị server
 * từ chối. Nhãn tiếng Việt thì phải viết ở đây — `openapi.json` chỉ mang khoá.
 *
 * ### Sau khi gửi xong, form KHÔNG tự đóng
 *
 * Nó đổi thành một dòng xác nhận. Báo cáo là hành động không có phản hồi nhìn thấy được ở
 * đâu khác trên trang (nội dung vẫn nguyên đó — mod chưa xử), nên một form tự đóng im lặng
 * để lại đúng câu hỏi "mình bấm rồi hay chưa?", và câu trả lời sai của người dùng là bấm
 * thêm lần nữa.
 */

type LyDo = BaoCaoMoiIn["ly_do"];
type Dich = BaoCaoMoiIn["target_type"];

/** Nhãn tiếng Việt cho sáu lý do. Khoá lấy từ kiểu sinh ra, nên thiếu một dòng là `tsc`
 * đỏ chứ không phải một `<option>` vắng mặt im lặng — chính nó vừa bắt được lượt mở rộng
 * 2026-08-25.
 *
 * **Bốn dòng đầu khớp ĐÚNG bốn điều cấm của `/luat`** (`lib/phap-ly.ts::DIEU_CAM`), theo
 * đúng thứ tự. Trước lượt này danh sách thiếu hai điều có thật — *cam kết lợi nhuận* và
 * *link nhóm kín* — nên người muốn báo đúng chuyện ấy chỉ còn ô "Khác", tức mod nhận một
 * hàng đợi mà lý do thật nằm trong ghi chú tự do: không lọc được, không đếm được, và
 * không thống kê được điều nào bị vi phạm nhiều nhất.
 *
 * ⚠ Đây **không** phải chỗ suy từ `DIEU_CAM` bằng code. Hai danh sách trùng nghĩa nhưng
 * khác vai: `DIEU_CAM` là văn bản luật (đọc để hiểu), còn đây là **enum của một hợp đồng
 * API** — khoá đã ghi vào hàng `Report` và vào `AuditLog` thì không đổi theo một lần sửa
 * câu chữ ở trang luật được. Chúng phải đổi cùng nhau, nhưng bằng một quyết định, không
 * bằng một phép suy. */
const NHAN_LY_DO: Record<LyDo, string> = {
  phim_hang: "Hô hào mua bán / phím hàng",
  cam_ket_loi_nhuan: "Cam kết lợi nhuận, hứa mức lãi",
  lua_dao: "Mời uỷ thác, room VIP trả phí, lừa đảo",
  link_nhom_kin: "Link nhóm kín (Zalo, Telegram, group riêng)",
  spam: "Spam, lôi kéo, đăng lặp",
  khac: "Khác",
};

export function FormBaoCao({
  dich,
  id,
  moTaDich,
  onHuy,
}: {
  dich: Dich;
  id: number;
  /** "bình luận này" / "mốc 3" — đi vào nhãn cho người đọc biết đang tố cái gì. */
  moTaDich: string;
  onHuy: () => void;
}) {
  const [lyDo, datLyDo] = useState<LyDo>("phim_hang");
  const [ghiChu, datGhiChu] = useState("");
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const [xong, datXong] = useState(false);

  const gui = async () => {
    if (dangGui) return;
    datDangGui(true);
    datLoi(null);
    try {
      layDuLieu(
        await guiBaoCao({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          body: {
            target_type: dich,
            target_id: id,
            ly_do: lyDo,
            ghi_chu: ghiChu.trim(),
          },
        }),
        "Không gửi được báo cáo.",
      );
      datXong(true);
    } catch (e) {
      // Câu của server đã là tiếng Việt cho người đọc (`api/bao_cao.py`), kể cả ca 409
      // "bạn đã báo cáo nội dung này rồi" — hiện thẳng, đừng dịch lại (xem `lib/ghi.ts`).
      datLoi(cauLoi(e, "Không gửi được báo cáo. Kiểm tra kết nối rồi thử lại."));
    } finally {
      datDangGui(false);
    }
  };

  if (xong) {
    return (
      <div className={css.khung} data-testid="bao-cao-xong">
        <p className={css.xong} role="status">
          Đã gửi báo cáo. Quản trị viên sẽ xem — nội dung vẫn hiện cho tới khi có quyết định.
        </p>
        <div className={css.chan}>
          <button type="button" className={css.nhe} onClick={onHuy}>
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={css.khung} data-testid="form-bao-cao">
      <label className={css.nhan} htmlFor={`bao-cao-ly-do-${dich}-${id}`}>
        Báo cáo {moTaDich} — lý do
      </label>
      <select
        id={`bao-cao-ly-do-${dich}-${id}`}
        className={css.chon}
        value={lyDo}
        onChange={(e) => datLyDo(e.target.value as LyDo)}
        data-testid="bao-cao-ly-do"
      >
        {(Object.keys(NHAN_LY_DO) as LyDo[]).map((k) => (
          <option key={k} value={k}>
            {NHAN_LY_DO[k]}
          </option>
        ))}
      </select>
      <textarea
        className={css.o}
        rows={2}
        value={ghiChu}
        onChange={(e) => datGhiChu(e.target.value)}
        placeholder="Nói thêm (không bắt buộc)"
        aria-label="Ghi chú cho quản trị viên"
        data-testid="bao-cao-ghi-chu"
      />
      {loi !== null && (
        <p className={css.loi} role="alert" data-testid="bao-cao-loi">
          {loi}
        </p>
      )}
      <div className={css.chan}>
        <button
          type="button"
          className={css.nhe}
          onClick={onHuy}
          data-testid="bao-cao-huy"
        >
          Huỷ
        </button>
        <button
          type="button"
          className={css.gui}
          onClick={() => void gui()}
          disabled={dangGui}
          data-testid="bao-cao-gui"
        >
          {dangGui ? "Đang gửi…" : "Gửi báo cáo"}
        </button>
      </div>
    </div>
  );
}
