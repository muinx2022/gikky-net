"use client";

import { boTheoMach, theoMach } from "@gikky/api-client";
import { useState } from "react";

import { cauLoi, layDuLieu } from "@/lib/ghi";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import { useMach } from "./mach-ngu-canh";
import css from "./nut-theo-mach.module.css";
import { usePhien } from "./phien";
import { useTrangThaiToi } from "./trang-thai-toi";

/** Nút **"Theo mạch"** — PLAN 5.7. Follower nhận thông báo khi có mốc mới (PLAN 5.8).
 *
 * ### Ai thấy
 *
 * Chỉ người đã đăng nhập. Khách **không** thấy một nút xám: PLAN mục 4 chốt "một cái nút
 * vĩnh viễn không bấm được còn tệ hơn không có nút", và ở đây cái nút ấy còn có nghĩa sai
 * — khách bấm vào sẽ tưởng mình vừa theo mạch.
 *
 * ### Mạch bị mod khoá VẪN theo được, cố ý
 *
 * Khác composer và cột vote. Follow là **sổ tay riêng của người đọc** (`api/theo_doi.py`):
 * không sinh chữ, không đổi con số nào của mạch, không ai khác nhìn thấy. Và chặn *bỏ*
 * theo trên mạch bị khoá thì có hại thật — người ta không tắt được thông báo của đúng cái
 * mạch mod vừa phải khoá lại. Nên ở đây **không** có nhánh `khoa`.
 *
 * ### Lạc quan, nhưng chỉ tới khi server trả lời
 *
 * Cùng khuôn với `CotVote`: đổi trạng thái ngay, hỏng thì **hoàn lại y nguyên** và nói ra.
 * Giữ lại một trạng thái server không đồng ý là kiểu hỏng im lặng tệ nhất — nó sống tới
 * lần tải trang sau rồi biến mất không dấu vết, và người dùng tưởng mình đang được báo tin.
 */
export function NutTheoMach() {
  const { machId } = useMach();
  const { toi, dangTai: dangTaiPhien } = usePhien();
  const { trangThai, datTheoMach } = useTrangThaiToi();
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  // Ba nhịp "chưa biết" gộp về một: chưa biết mình là ai · chưa biết mình có theo không ·
  // không ở trong mạch nào. Vẽ "Theo mạch" rồi đổi thành "Đang theo" là một cú nhảy ngay
  // chỗ mắt người ta nhìn.
  if (dangTaiPhien || machId === null) return null;
  if (!(toi?.dang_nhap ?? false)) return null;
  if (trangThai === null || !trangThai.dang_nhap) return null;

  const dang_theo = trangThai.following;

  const bam = async () => {
    if (dangGui) return;
    datDangGui(true);
    datLoi(null);
    datTheoMach(!dang_theo);
    try {
      const header = await headerGhi();
      // Hai lời gọi TRỰC TIẾP, và **đối số viết thẳng tại chỗ gọi** — không alias hàm qua
      // một biến, không gom tuỳ chọn vào một object rồi truyền cả cục. Hàng rào
      // `e2e/don-vi/type-frontend.spec.ts` tìm callee theo TÊN rồi soi CHUỖI ĐỐI SỐ để
      // đòi `baseUrl`; cả hai lối viết kia đều làm nó mù với chính lời gọi này (xem
      // `CLAUDE.md`, luật "cấm gọi hàm API qua biến trung gian").
      const kq = dang_theo
        ? await boTheoMach({
            baseUrl: GOC_TRINH_DUYET,
            headers: header,
            path: { mach_id: machId },
          })
        : await theoMach({
            baseUrl: GOC_TRINH_DUYET,
            headers: header,
            path: { mach_id: machId },
          });
      const du_lieu = layDuLieu(kq, "Không đổi được trạng thái theo mạch.");
      datTheoMach(du_lieu.following);
    } catch (e) {
      datTheoMach(dang_theo);
      datLoi(cauLoi(e, "Không đổi được. Kiểm tra kết nối rồi thử lại."));
    } finally {
      datDangGui(false);
    }
  };

  return (
    <span className={css.khung}>
      <button
        type="button"
        className={dang_theo ? `${css.nut} ${css.dang_theo}` : css.nut}
        onClick={() => void bam()}
        disabled={dangGui}
        aria-pressed={dang_theo}
        title={
          dang_theo
            ? "Bỏ theo — không nhận thông báo mốc mới của mạch này nữa"
            : "Theo mạch — nhận thông báo khi có mốc mới"
        }
        data-testid="nut-theo-mach"
      >
        {dang_theo ? "✓ Đang theo" : "＋ Theo mạch"}
      </button>
      {loi !== null && (
        <span className={css.loi} role="alert" data-testid="theo-mach-loi">
          {loi}
        </span>
      )}
    </span>
  );
}
