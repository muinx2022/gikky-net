import type { MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { nenHienSoDem } from "@/lib/dem";
import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { duongDanHoSo, duongDanKhanDai, duongDanMach, duongDanSub } from "@/lib/url";

import { Avatar } from "./avatar";
import { ChepLink } from "./chep-link";
import { CotVote } from "./cot-vote";
import { HanhDongMod } from "./hanh-dong-mod";
import { NoiDungThe } from "./noi-dung-the";
import css from "./the-mach.module.css";

/** Thẻ mạch trong feed và trong hồ sơ — plan con 1c §2.3, dựng lại theo vỏ Reddit ở 1d.
 *
 * Ba thứ 1d đổi:
 *
 * 1. **cột vote bên trái** (`CotVote`) — con số là `mach.diem`, tức điểm của MỐC 1.
 *    PLAN 5.7 chốt vote nằm trên từng mốc riêng rẽ nên không tồn tại "điểm của mạch";
 *    thẻ feed chiếu điểm bài gốc, đúng như Reddit chiếu điểm của bài. **Từ Phase 2 mũi
 *    tên SỐNG**, và đích của nó là `mach.moc_1_id` — thẻ feed không có `mocs` nên nó cần
 *    `id` ấy đi kèm, nếu không cái nút là nút chết;
 * 2. `💬 N` là **link thật** dẫn thẳng vào khán đài đang mở, không còn là một dòng chữ.
 *    Trên Reddit đó là lối vào chính của một thẻ, và ở đây nó cũng là lối duy nhất tới
 *    khán đài mà không phải cuộn hết nhật ký;
 * 3. dòng dày đặc hơn (`the-mach.module.css`) — PLAN 9.1 "mật độ là oxy".
 *
 * `comment_count` chịu nguyên tắc 9 y như trên trang mạch: mạch dưới 4 bình luận thì
 * KHÔNG hiện con số nào, và khi đó không có cả cái nút — một nút "💬" không số dẫn vào
 * một khán đài trống là phô đúng sự im lặng mà nguyên tắc 9 cấm.
 *
 * `entry_count` chỉ hiện khi ≥ 2: một mốc thì nó chưa phải mạch (PLAN 5.1), và "1 mốc"
 * là con số duy nhất nó có thể có.
 */
export function TheMach({ mach }: { mach: MachTomTatOut }) {
  const hien_so_dem = nenHienSoDem(mach.comment_count);
  return (
    <li className={css.the} data-testid="the-mach" data-mach-id={mach.id}>
      <CotVote
        diem={mach.diem}
        nhan={mach.title}
        cai_gi="mach"
        dich={mach.moc_1_id === null ? null : { loai: "moc", id: mach.moc_1_id }}
      />
      <div className={css.than}>
        <div className={css.dau}>
          {/* Bốn nút mang dấu `CHU_NGUOI_DUNG` trong thẻ này (Y3): slug sub, tên tác giả,
              tiêu đề, kết quả — bốn chuỗi do người dùng gõ. Phần còn lại ("mốc", "bình
              luận", "đã đóng sổ") là chữ của ứng dụng và ở lại trong phép quét. */}
          <Avatar
            ten={mach.author.username}
            hienThi={mach.author.display_name}
            url={mach.author.avatar_url}
            co={18}
          />
          <Link className={css.sub} href={duongDanSub(mach.sub.slug)} {...CHU_NGUOI_DUNG}>
            s/{mach.sub.slug}
          </Link>
          <span className={css.cham} aria-hidden>
            ·
          </span>
          <Link
            className={css.ai}
            href={duongDanHoSo(mach.author.username)}
            {...CHU_NGUOI_DUNG}
          >
            u/{mach.author.username}
          </Link>
          <span className={css.cham} aria-hidden>
            ·
          </span>
          <span className={css.khi}>{ngayCuaThoiDiem(mach.created_at)}</span>
          {mach.status === "closed" && (
            <span className={css.dong_so}>đã đóng sổ</span>
          )}
        </div>

        <h2 className={css.tieu_de}>
          <Link href={duongDanMach(mach.slug, mach.id)} {...CHU_NGUOI_DUNG}>
            {mach.title}
          </Link>
        </h2>

        {/* Nội dung xem trước lấy từ MỐC 1 — ảnh gallery trước, chữ sau (2026-08-23).
            `null` khi mốc 1 là bia mộ hoặc bị mod ẩn: thẻ khi đó về đúng hình dạng cũ
            (chỉ tiêu đề) và **không** thông báo gì. Feed không phải chỗ kể chuyện kiểm
            duyệt — xem `api/trinh_bay.py::du_lieu_the`. */}
        {mach.xem_truoc !== null && (
          <NoiDungThe
            xem_truoc={mach.xem_truoc}
            href={duongDanMach(mach.slug, mach.id)}
            tieu_de={mach.title}
          />
        )}

        <div className={css.chan}>
          {mach.entry_count >= 2 && (
            <span className={css.dem} data-testid="the-mach-so-moc">
              {mach.entry_count} mốc
            </span>
          )}
          {hien_so_dem && (
            <Link
              className={css.nut_binh_luan}
              href={duongDanKhanDai(mach.slug, mach.id)}
              data-testid="the-mach-so-binh-luan"
            >
              💬 {mach.comment_count} bình luận
            </Link>
          )}
          {mach.ket_qua !== null && (
            <span
              className={css.ket_qua}
              data-testid="the-mach-ket-qua"
              {...CHU_NGUOI_DUNG}
            >
              {mach.ket_qua}
            </span>
          )}
          {/* Thao tác thứ hai của thanh, chạy trọn ở trình duyệt — không cần endpoint,
              nên nó không phạm luật "không nút chết" của lượt giao diện. Đặt CUỐI hàng:
              lối vào khán đài mới là thao tác chính. */}
          <ChepLink duongDan={duongDanMach(mach.slug, mach.id)} nhan={mach.title} />
          {/* Công cụ mod ngay trên thẻ — user chốt 2026-08-24 ("vào chuyên mục thì ra
              phần chuyên mục với các action của mod"). Client component, trả `null` cho
              mọi người không phải staff, nên thẻ của người đọc thường **không đổi một
              pixel nào**.

              Chỉ có "Ẩn", không có "Khoá": thẻ feed không biết mạch đang khoá hay không
              (`MachTomTatOut` không mang `locked`) — xem chú thích trong `HanhDongMod`.
              `dangAn` luôn `false` vì mạch bị ẩn không lọt vào feed. */}
          <HanhDongMod
            loai="mach"
            id={mach.id}
            dangAn={false}
            nhan={`mạch “${mach.title}”`}
          />
        </div>
      </div>
    </li>
  );
}
