import type { MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { duongDanHoSo, duongDanMach, duongDanSub } from "@/lib/url";

import { Avatar } from "./avatar";
import { CotVote } from "./cot-vote";
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
 *    khán đài mà không phải cuộn hết nhật ký; chỉ hiển thị khi có ≥ 1 bình luận (0 bình luận
 *    thì bỏ qua, không phô số 0);
 * 3. dòng dày đặc hơn (`the-mach.module.css`) — PLAN 9.1 "mật độ là oxy".
 *
 * `entry_count` chỉ hiện khi ≥ 2: một mốc thì nó chưa phải mạch (PLAN 5.1), và "1 mốc"
 * là con số duy nhất nó có thể có.
 */
export function TheMach({ mach }: { mach: MachTomTatOut }) {
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
          <Link
            className={css.sub}
            href={duongDanSub(mach.sub.slug)}
            prefetch={false}
            {...CHU_NGUOI_DUNG}
          >
            s/{mach.sub.slug}
          </Link>
          <span className={css.cham} aria-hidden>
            ·
          </span>
          <span className={css.cum_tac_gia}>
            <Link
              href={duongDanHoSo(mach.author.username)}
              prefetch={false}
              tabIndex={-1}
              aria-hidden="true"
              className={css.ai_avatar}
            >
              <Avatar
                ten={mach.author.username}
                hienThi={mach.author.display_name}
                url={mach.author.avatar_url}
                co={18}
              />
            </Link>
            <Link
              className={css.ai}
              href={duongDanHoSo(mach.author.username)}
              prefetch={false}
              title={`u/${mach.author.username}`}
              {...CHU_NGUOI_DUNG}
            >
              {mach.author.display_name || `u/${mach.author.username}`}
            </Link>
          </span>
          <span className={css.cham} aria-hidden>
            ·
          </span>
          <span className={css.khi}>{ngayCuaThoiDiem(mach.published_at)}</span>
          {mach.status === "closed" && (
            <span className={css.dong_so}>đã đóng sổ</span>
          )}
          {mach.da_luu_tru && (
            <span
              className={css.dong_so}
              data-testid="the-mach-da-luu-tru"
              title="Mạch đã được lưu trữ (soft delete)"
            >
              📦 đã lưu trữ
            </span>
          )}
          {mach.rieng_tu && (
            <span
              className={css.rieng_tu}
              data-testid="the-mach-rieng-tu"
              title="Chỉ bạn và quản trị viên nhìn thấy"
            >
              🔒 riêng tư
            </span>
          )}
        </div>

        <h2 className={css.tieu_de}>
          <Link href={duongDanMach(mach.slug, mach.id)} prefetch={false} {...CHU_NGUOI_DUNG}>
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
      </div>
    </li>
  );
}
