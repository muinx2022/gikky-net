"use client";

import type { SpineOut } from "@gikky/api-client";
import { useRef, useState } from "react";

import { mocDauChuaXem, oChuaXem } from "@/lib/vach-moi";

import css from "./mat-bao.module.css";
import { useTrangThaiToi } from "./trang-thai-toi";

/** Khung nhật ký của **mặt BÃO** — PLAN 5.5 và wireframe 9.2.
 *
 * ```
 * ①──②──③──④──⑤──⑥──⑦──⑧──◉⑨   ← spine ghim, số mốc chưa xem màu hoàng thổ
 * ┌──────────────────────────┐
 * │ ⑨ … chỉ mốc mới nhất mở  │
 * └──────────────────────────┘
 *   [ mở cả mạch ▾ ]           ← bung timeline đầy đủ, có VẠCH MỚI
 * ```
 *
 * ### Vì sao là client component, và vì sao thẻ mốc vẫn là server component
 *
 * Ba thứ ở đây cần trình duyệt: trạng thái mở/đóng của timeline, cú cuộn khi bấm một số
 * trên spine, và **vị trí đọc** (per-user, đến sau qua `GET /machs/{id}/me`). Thẻ mốc thì
 * không: chúng được **truyền vào dưới dạng `ReactNode` đã render sẵn ở server**, nên
 * `TheMoc`, `KhoiTrich`, `ThanVan` và cả cây markdown vẫn nằm ngoài bundle client. Nếu
 * component này nhận `MocOut[]` rồi tự render, cả nhật ký sẽ bị kéo sang client.
 *
 * ### Vạch mới đến SAU một nhịp, và đó là chủ đích
 *
 * Server không biết người xem là ai (trang mạch có bản cache — PLAN 8.4), nên lượt render
 * đầu không có vạch và không có ô hoàng thổ nào. Chúng xuất hiện khi `/me` về. Đổi lại:
 * không có vạch của người này lọt vào HTML phục vụ người kia.
 */
export function MatBao({
  spine,
  mocMoiNhat,
  tatCaMoc,
}: {
  spine: readonly SpineOut[];
  /** Thẻ mốc **mới nhất**, đã render ở server. Hiện khi timeline còn gập. */
  mocMoiNhat: React.ReactNode;
  /** Cả nhật ký theo `seq` tăng dần, đã render ở server. Hiện khi bung. */
  tatCaMoc: readonly { seq: number; the: React.ReactNode }[];
}) {
  const { trangThai } = useTrangThaiToi();
  const [mo, datMo] = useState(false);
  const khungRef = useRef<HTMLDivElement>(null);

  const so_moc = spine.length;
  const moc_dau_chua_xem = mocDauChuaXem(trangThai, so_moc);

  /** Bấm một số trên spine: bung cả mạch rồi cuộn tới đúng thẻ — PLAN 5.5 "bấm số → peek
   * mốc". Cuộn phải đợi React vẽ xong thẻ, nên nó đi sau một `requestAnimationFrame`;
   * `scrollIntoView` gọi ngay lúc `datMo(true)` sẽ tìm một phần tử chưa tồn tại. */
  const nhayToiMoc = (seq: number) => {
    datMo(true);
    requestAnimationFrame(() => {
      khungRef.current
        ?.querySelector(`[data-testid="moc-${seq}"]`)
        ?.scrollIntoView({ block: "start" });
    });
  };

  return (
    <div ref={khungRef} data-testid="mat-bao">
      <nav className={css.spine} aria-label="Các mốc của mạch" data-testid="spine">
        <ol className={css.day}>
          {spine.map((o) => {
            const chua_xem = oChuaXem(o.seq, moc_dau_chua_xem);
            return (
              <li key={o.seq} className={css.o}>
                <button
                  type="button"
                  className={chua_xem ? `${css.so} ${css.chua_xem}` : css.so}
                  onClick={() => nhayToiMoc(o.seq)}
                  data-testid={`spine-o-${o.seq}`}
                  data-chua-xem={chua_xem ? "1" : "0"}
                  aria-label={
                    chua_xem ? `Mốc ${o.seq} — chưa xem` : `Mốc ${o.seq}`
                  }
                >
                  {o.seq}
                </button>
              </li>
            );
          })}
        </ol>
        {moc_dau_chua_xem !== null && (
          <p className={css.chu_thich_spine} data-testid="spine-chu-thich">
            Số màu hoàng thổ là mốc bạn chưa xem.
          </p>
        )}
      </nav>

      <ol className={css.nhat_ky} data-testid="nhat-ky">
        {mo ? (
          tatCaMoc.map(({ seq, the }) => (
            <li key={seq} className={css.hang_bung}>
              {seq === moc_dau_chua_xem && <VachMoi />}
              {the}
            </li>
          ))
        ) : (
          <li className={css.hang_bung}>{mocMoiNhat}</li>
        )}
      </ol>

      {so_moc > 1 && (
        <div className={css.hang_nut}>
          <button
            type="button"
            className={css.mo_ca_mach}
            onClick={() => datMo((x) => !x)}
            aria-expanded={mo}
            data-testid="nut-mo-ca-mach"
          >
            {mo ? "thu lại ▴" : `mở cả mạch ▾ (${so_moc} mốc)`}
          </button>
        </div>
      )}
    </div>
  );
}

/** Cái vạch. Một `<hr>` mang chữ, không phải một `<div>` trang trí: nó **ngăn cách** hai
 * đoạn nội dung, đúng nghĩa ngữ nghĩa của thẻ ấy, nên trình đọc màn hình cũng nghe được.
 */
function VachMoi() {
  return (
    <p className={css.vach_moi} role="separator" data-testid="vach-moi">
      <span className={css.vach_chu}>mới từ đây</span>
    </p>
  );
}
