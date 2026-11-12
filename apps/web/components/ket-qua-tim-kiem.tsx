import type { KetQuaTronOut } from "@gikky/api-client";
import { Bot } from "lucide-react";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { neoBinhLuan } from "@/lib/khan-dai";
import { tenHienThi } from "@/lib/ten-hien-thi";
import { tachDam } from "@/lib/tim-kiem";
import { duongDanMach } from "@/lib/url";

import { Avatar } from "./avatar";
import css from "./ket-qua-tim-kiem.module.css";
import css2 from "./ket-qua-tron.module.css";
import { TheMach } from "./the-mach";
import khung from "./the-mach.module.css";

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

/** Một dòng kết quả tìm kiếm — Phase 7, **hai loại từ 2026-08-30**, thẻ thống nhất từ đợt D
 * (plan `2026-11-11-thong-nhat-giao-dien-toan-site.md` §4.1, §8.1).
 *
 * ## Kết quả MẠCH = chính `TheMach`
 *
 * Trước đợt D trang này có hình dạng riêng (`DongMach`: không vote, không chân thẻ, chỉ tiêu đề +
 * đoạn khớp), với lý lẽ "trang tìm kiếm để quét mắt, không phải để bỏ phiếu". User đã chốt thẻ
 * mới áp cho cả tìm kiếm: từ feed, hồ sơ hay tìm kiếm, một mạch trông như một — cùng component,
 * cùng DOM, cùng testid (tiêu chí T1), kể cả chân thẻ vote · mốc · bình luận · Theo dõi · Chia sẻ.
 * Dữ liệu thẻ cũng là của feed: API tìm kiếm dựng `mach` bằng `du_lieu_the` như `/feeds/*`, nên
 * ảnh nhỏ, "+N ảnh" và "· nối mốc" có mặt như ở feed (`api/api/tim_kiem.py::_dung_ket_qua`).
 *
 * Thứ RIÊNG của trang này là **đoạn khớp**, và nó được giữ: tiêu đề tô `<mark>` và đoạn trích
 * của API đi vào `TheMach` qua prop `khop` — thay NỘI DUNG của hai ô chữ, không thay khung.
 * `doan_trich === ""` là chuyện BÌNH THƯỜNG, không phải thiếu dữ liệu: mốc 1 đã thành bia mộ
 * hoặc bị mod ẩn (không chữ nào được phép hiện), hoặc mốc 1 đọc được nhưng KHÔNG có chữ (chỉ có
 * ảnh — mạch Bot Trader). Cả hai ca ⇒ `khop.trich = null` ⇒ thẻ không có đoạn trích (ảnh nhỏ
 * của ca sau vẫn hiện từ `xem_truoc`), và **không** rơi về trích tự sinh — nguyên tắc 9, đừng
 * phô một khối rỗng.
 * `hienNhanLoai` bật vì danh sách kết quả lẫn cả ba loại mạch.
 *
 * ## Kết quả BÌNH LUẬN — cùng khung, không cùng component
 *
 * Bình luận không phải mạch nên không ép vào `TheMach` (không vote mạch, không "N mốc"). Nhưng
 * nó nằm **xen kẽ** với thẻ mạch trong một danh sách xếp theo độ liên quan, nên mượn đúng các
 * class khung của `the-mach.module.css` (viền, nền, bo góc, padding, hàng đầu avatar · tên ·
 * ngày) — hai khung khác nhau làm trang trông như hai danh sách bị dán vào nhau, và người đọc
 * sẽ cố tìm ra quy luật nhóm mà không có quy luật nào. Mượn class chứ không chép số: chép là hai
 * chỗ để chúng lệch nhau.
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
 * Dòng bình luận mang `CHU_NGUOI_DUNG` trên ba chuỗi do người dùng gõ: tên người viết, tiêu đề
 * mạch ở dòng ngữ cảnh và câu của họ (luật Y3, như `TheMach`). Nhãn "Bình luận" thì **không** —
 * đó là chữ của ứng dụng.
 */
export function DongKetQua({ ket_qua }: { ket_qua: KetQuaTronOut }) {
  return ket_qua.loai === "binh_luan" ? (
    <DongBinhLuan ket_qua={ket_qua} />
  ) : (
    <TheMach
      mach={ket_qua.mach}
      hienNhanLoai
      khop={{
        tieuDe: <ToDam chuoi={ket_qua.title_to_dam} />,
        trich: ket_qua.doan_trich === "" ? null : <ToDam chuoi={ket_qua.doan_trich} />,
      }}
    />
  );
}

function DongBinhLuan({ ket_qua }: { ket_qua: KetQuaTronOut }) {
  const m = ket_qua.mach;
  const ai = ket_qua.tac_gia;
  // `binh_luan_id` là `number | null` theo hợp đồng (schema trộn, một trường cho hai
  // loại). Loại `binh_luan` luôn có nó; nhánh phòng thủ ở đây để một server mới hơn
  // frontend không làm cả trang nổ — dòng vẫn hiện, chỉ mất cái neo.
  const dich =
    ket_qua.binh_luan_id === null
      ? duongDanMach(m.slug, m.id)
      : `${duongDanMach(m.slug, m.id)}#${neoBinhLuan(ket_qua.binh_luan_id)}`;

  return (
    <li
      className={khung.the}
      data-testid="ket-qua-tim-kiem"
      data-loai="binh_luan"
      data-mach-id={m.id}
      data-binh-luan-id={ket_qua.binh_luan_id ?? undefined}
    >
      {/* Cả dòng là MỘT link tới neo bình luận ⇒ bên trong không có `<a>` nào khác (avatar, tên
          là `<span>`): `<a>` lồng `<a>` là HTML không hợp lệ. */}
      <Link className={css2.den_cau} href={dich} prefetch={false}>
        <span className={khung.dau}>
          <span className={khung.avatar} aria-hidden="true">
            {ai?.la_bot ? (
              <span className={khung.avatar_bot}>
                <Bot size={16} strokeWidth={2} aria-hidden />
              </span>
            ) : (
              <Avatar
                ten={ai?.username ?? ""}
                hienThi={ai?.display_name}
                url={ai?.avatar_url}
                co={34}
              />
            )}
          </span>
          <span className={khung.ai_va_khi}>
            <span className={khung.dong_ten}>
              <span
                className={css2.ten}
                title={ai ? `u/${ai.username}` : undefined}
                {...CHU_NGUOI_DUNG}
              >
                {tenHienThi(ai)}
              </span>
            </span>
            {ket_qua.luc !== null && (
              <span className={khung.khi_va_sub}>
                <time dateTime={ket_qua.luc}>{ngayCuaThoiDiem(ket_qua.luc)}</time>
              </span>
            )}
          </span>
          <span className={khung.dau_phai}>
            <span className={css2.nhan}>Bình luận</span>
          </span>
        </span>

        <span className={css2.trong_mach}>
          trong{" "}
          <span className={css2.ten_mach} {...CHU_NGUOI_DUNG}>
            “{m.title}”
          </span>
        </span>

        {ket_qua.doan_trich !== "" && (
          <span className={css2.cau} {...CHU_NGUOI_DUNG}>
            <ToDam chuoi={ket_qua.doan_trich} />
          </span>
        )}
      </Link>
    </li>
  );
}
