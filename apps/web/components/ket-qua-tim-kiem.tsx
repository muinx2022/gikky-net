import type { KetQuaTronOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { neoBinhLuan } from "@/lib/khan-dai";
import { tachDam } from "@/lib/tim-kiem";
import { duongDanHoSo, duongDanMach, duongDanSub } from "@/lib/url";

import css from "./ket-qua-tim-kiem.module.css";
import css2 from "./ket-qua-tron.module.css";

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

/** Một dòng kết quả tìm kiếm — Phase 7, **hai loại từ 2026-08-30**.
 *
 * **Không dùng lại `TheMach`**, và đó là một lựa chọn chứ không phải lười: thẻ feed có cột
 * vote với mũi tên sống, mà một trang kết quả tìm kiếm là chỗ người ta **quét mắt** để
 * chọn bài, không phải chỗ bỏ phiếu. Thêm nữa, thứ đáng chiếm chỗ ở đây là **đoạn khớp** —
 * thứ `TheMach` không có khái niệm nào tương ứng. Hai hình dạng khác nhau vì hai việc khác
 * nhau; nhét cả hai vào một component là dựng một component hai chế độ.
 *
 * ## Hai loại, hai hình dạng, MỘT danh sách
 *
 * `ket_qua.loai` rẽ nhánh ngay ở đây. Chúng dùng chung khung `<li>` (cùng viền, cùng nền,
 * cùng khoảng thở) vì chúng nằm **xen kẽ** trong một danh sách xếp theo độ liên quan —
 * hai khung khác nhau làm trang trông như hai danh sách bị dán vào nhau, và người đọc sẽ
 * cố tìm ra quy luật nhóm mà không có quy luật nào.
 *
 * Dòng bình luận nhảy tới `/m/<slug>-<id>#bl-<binh_luan_id>`. Neo `bl-` **đã có sẵn** từ
 * lượt khán đài (`lib/khan-dai.ts::neoBinhLuan`, gắn trong `binh-luan.tsx`) — dùng lại nó
 * chứ không đẻ một hệ neo `cmt-` thứ hai: hai cách neo cho cùng một bình luận là hai chỗ
 * để chúng lệch nhau, và `:target { scroll-margin-top }` ở `globals.css` đã né header
 * dính cho đúng một trong hai.
 *
 * ⚠ **Giới hạn đã biết, không sửa ở lượt này**: bình luận nằm trong một nhánh đang gập
 * (`GapNhanh`) hoặc ở trang sau của khán đài thì neo không cuộn tới được. Mở nhánh tự
 * động đụng nợ `P-20260830-8`; nó là một lượt riêng.
 *
 * Bốn nút mang `CHU_NGUOI_DUNG` (slug sub, tên tác giả, tiêu đề, đoạn trích) — cùng luật
 * Y3 với `TheMach`: đó là bốn chuỗi do người dùng gõ. Dòng bình luận thêm hai: tên người
 * viết và câu của họ. Nhãn "Bình luận" thì **không** — đó là chữ của ứng dụng.
 */
export function DongKetQua({ ket_qua }: { ket_qua: KetQuaTronOut }) {
  return ket_qua.loai === "binh_luan" ? (
    <DongBinhLuan ket_qua={ket_qua} />
  ) : (
    <DongMach ket_qua={ket_qua} />
  );
}

function DongMach({ ket_qua }: { ket_qua: KetQuaTronOut }) {
  const m = ket_qua.mach;
  return (
    <li
      className={css.dong}
      data-testid="ket-qua-tim-kiem"
      data-loai="mach"
      data-mach-id={m.id}
    >
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
        <time dateTime={m.published_at}>{ngayCuaThoiDiem(m.published_at)}</time>
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

function DongBinhLuan({ ket_qua }: { ket_qua: KetQuaTronOut }) {
  const m = ket_qua.mach;
  // `binh_luan_id` là `number | null` theo hợp đồng (schema trộn, một trường cho hai
  // loại). Loại `binh_luan` luôn có nó; nhánh phòng thủ ở đây để một server mới hơn
  // frontend không làm cả trang nổ — dòng vẫn hiện, chỉ mất cái neo.
  const dich =
    ket_qua.binh_luan_id === null
      ? duongDanMach(m.slug, m.id)
      : `${duongDanMach(m.slug, m.id)}#${neoBinhLuan(ket_qua.binh_luan_id)}`;

  return (
    <li
      className={css.dong}
      data-testid="ket-qua-tim-kiem"
      data-loai="binh_luan"
      data-mach-id={m.id}
      data-binh-luan-id={ket_qua.binh_luan_id ?? undefined}
    >
      <Link className={css2.den_cau} href={dich}>
        <span className={css.dau}>
          <span className={css2.nhan}>Bình luận</span>
          <span className={css.cham} aria-hidden>
            ·
          </span>
          <span className={css.ai} {...CHU_NGUOI_DUNG}>
            u/{ket_qua.tac_gia?.username ?? ""}
          </span>
          {ket_qua.luc !== null && (
            <>
              <span className={css.cham} aria-hidden>
                ·
              </span>
              <time dateTime={ket_qua.luc}>{ngayCuaThoiDiem(ket_qua.luc)}</time>
            </>
          )}
        </span>

        <p className={css2.trong_mach}>
          trong{" "}
          <span className={css2.ten_mach} {...CHU_NGUOI_DUNG}>
            “{m.title}”
          </span>
        </p>

        {ket_qua.doan_trich !== "" && (
          <p className={css2.cau} {...CHU_NGUOI_DUNG}>
            <ToDam chuoi={ket_qua.doan_trich} />
          </p>
        )}
      </Link>
    </li>
  );
}
