import type { LenhOut } from "@gikky/api-client";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { NHAN_CHIEU_LENH, cacOLenh } from "@/lib/lenh";

import conSo from "./con-so.module.css";
import css from "./dai-lenh.module.css";

/** Dải lệnh — chip MUA/BÁN · mã · Entry · SL · TP · Nhồi · R:R — **MỘT bản cho cả hai chỗ vẽ**
 * *(việc 25)*: thẻ mạch (`TheMach`, mục 3) và đầu trang chi tiết (`trang-mach.tsx`, ngay dưới
 * `<h1>`). Trước việc 25 markup này nằm thẳng trong thẻ, và trang chi tiết không có dải dù API
 * đã trả `lenh`.
 *
 * Người gọi chỉ vẽ khi `mach.lenh` có — `lenh` là dữ liệu có cấu trúc tác giả khai lúc đăng;
 * cố ý KHÔNG parse tiêu đề để suy ra (một dải đoán mò trông y hệt dải thật mà có thể sai số).
 *
 * `tienTo` đặt tên testid: thẻ truyền `"the-nhat-ky"` (giữ testid cũ, ~30 chỗ đo ghim), trang chi
 * tiết truyền `"trang-mach"` ⇒ `<tienTo>-lenh`, `<tienTo>-chieu`, `<tienTo>-<khoa ô>`.
 *
 * Màu TP/SL và chip MUA/BÁN đi qua `con-so.module.css` (file duy nhất `mau-token.spec.ts` cho
 * dùng `--gain`/`--loss`); `dai-lenh.module.css` chỉ token trung tính.
 *
 * Server-safe, không hook: thẻ được `CuonVoHan` (client) dựng lại cho trang nạp thêm.
 */
export function DaiLenh({ lenh, tienTo }: { lenh: LenhOut; tienTo: "the-nhat-ky" | "trang-mach" }) {
  return (
    <div className={css.lenh} data-testid={`${tienTo}-lenh`} role="group" aria-label="Lệnh">
      <span className={css.o_lenh}>
        <span
          className={`${css.chieu} ${lenh.chieu === "mua" ? conSo.mua : conSo.ban}`}
          data-testid={`${tienTo}-chieu`}
        >
          {NHAN_CHIEU_LENH[lenh.chieu]}
        </span>
        <b className={css.ma} {...CHU_NGUOI_DUNG}>
          {lenh.ma}
        </b>
      </span>
      {cacOLenh(lenh).map((o) => (
        <span key={o.khoa} className={css.o_lenh} data-testid={`${tienTo}-${o.khoa}`}>
          <em className={css.nhan_o}>{o.nhan}</em>
          <b className={o.khoa === "tp" ? conSo.gia_tp : o.khoa === "sl" ? conSo.gia_sl : undefined}>
            {o.gia_tri}
          </b>
        </span>
      ))}
    </div>
  );
}
