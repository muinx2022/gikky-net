import type { KetQuaTimKiemOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { tachDam } from "@/lib/tim-kiem";
import { duongDanHoSo, duongDanMach, duongDanSub } from "@/lib/url";

import css from "./ket-qua-tim-kiem.module.css";

/** Chuỗi có dấu `[[…]]` → các đoạn, đoạn khớp bọc `<mark>`.
 *
 * **Không `dangerouslySetInnerHTML`.** API cố ý trả dấu chứ không trả HTML, vì đây là chữ
 * do người dùng viết — xem `lib/tim-kiem.ts`. React escape từng đoạn như thường lệ.
 */
function ToDam({ chuoi }: { chuoi: string }) {
  return (
    <>
      {tachDam(chuoi).map((m, i) =>
        m.dam ? (
          <mark key={i} className={css.dam}>
            {m.chu}
          </mark>
        ) : (
          <span key={i}>{m.chu}</span>
        ),
      )}
    </>
  );
}

/** Một dòng kết quả tìm kiếm — Phase 7.
 *
 * **Không dùng lại `TheMach`**, và đó là một lựa chọn chứ không phải lười: thẻ feed có cột
 * vote với mũi tên sống, mà một trang kết quả tìm kiếm là chỗ người ta **quét mắt** để
 * chọn bài, không phải chỗ bỏ phiếu. Thêm nữa, thứ đáng chiếm chỗ ở đây là **đoạn khớp** —
 * thứ `TheMach` không có khái niệm nào tương ứng. Hai hình dạng khác nhau vì hai việc khác
 * nhau; nhét cả hai vào một component là dựng một component hai chế độ.
 *
 * Bốn nút mang `CHU_NGUOI_DUNG` (slug sub, tên tác giả, tiêu đề, đoạn trích) — cùng luật
 * Y3 với `TheMach`: đó là bốn chuỗi do người dùng gõ.
 */
export function DongKetQua({ ket_qua }: { ket_qua: KetQuaTimKiemOut }) {
  const m = ket_qua.mach;
  return (
    <li className={css.dong} data-testid="ket-qua-tim-kiem" data-mach-id={m.id}>
      <div className={css.dau}>
        <Link className={css.sub} href={duongDanSub(m.sub.slug)} {...CHU_NGUOI_DUNG}>
          s/{m.sub.slug}
        </Link>
        <span className={css.cham} aria-hidden>
          ·
        </span>
        <Link
          className={css.ai}
          href={duongDanHoSo(m.author.username)}
          {...CHU_NGUOI_DUNG}
        >
          u/{m.author.username}
        </Link>
        <span className={css.cham} aria-hidden>
          ·
        </span>
        <time dateTime={m.created_at}>{ngayCuaThoiDiem(m.created_at)}</time>
        {m.status === "closed" && (
          <>
            <span className={css.cham} aria-hidden>
              ·
            </span>
            <span className={css.dong_so}>đã đóng sổ</span>
          </>
        )}
      </div>

      <h2 className={css.title}>
        <Link href={duongDanMach(m.slug, m.id)} {...CHU_NGUOI_DUNG}>
          <ToDam chuoi={ket_qua.title_to_dam} />
        </Link>
      </h2>

      {/* Đoạn trích rỗng là chuyện BÌNH THƯỜNG, không phải thiếu dữ liệu: mốc 1 đã thành
          bia mộ hoặc bị mod ẩn, nên không có chữ nào được phép hiện. Nguyên tắc 9 — đừng
          phô một khối rỗng để giữ chỗ. */}
      {ket_qua.doan_trich !== "" && (
        <p className={css.trich} {...CHU_NGUOI_DUNG}>
          <ToDam chuoi={ket_qua.doan_trich} />
        </p>
      )}
    </li>
  );
}
