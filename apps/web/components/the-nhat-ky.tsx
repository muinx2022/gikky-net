import type { MachTomTatOut } from "@gikky/api-client";
import { Bot, GitCommitHorizontal, MessageCircle } from "lucide-react";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { NHAN_CHIEU_LENH, cacOLenh } from "@/lib/lenh";
import { tenHienThi } from "@/lib/ten-hien-thi";
import { duongDanHoSo, duongDanMach, duongDanSub } from "@/lib/url";

import { Avatar } from "./avatar";
import conSo from "./con-so.module.css";
import { CotVote } from "./cot-vote";
import { HanhDongMod } from "./hanh-dong-mod";
import { NutChiaSeMach } from "./nut-chia-se-mach";
import { NutTheoUser } from "./nut-theo-user";
import theMach from "./the-mach.module.css";
import css from "./the-nhat-ky.module.css";

/** Thẻ NHẬT KÝ của khối "Nhật ký mới" trên `/` (plan
 * `2026-11-11-homepage-v2-giao-dien-moi.md` §3.2). Component RIÊNG chứ không phải một cờ trên
 * `TheMach`: `TheMach` còn nuôi `/s/*`, hồ sơ, tìm kiếm và feed cũ với DOM không được đổi một
 * byte, còn thẻ này có hình dạng khác hẳn (dải lệnh, ảnh nhỏ bên phải, chip trạng thái).
 *
 * Năm phần, đúng thứ tự mockup:
 *
 * 1. hàng đầu — avatar · tên (+ nhãn BOT · DEMO theo cờ `author.la_bot`, KHÔNG so username) ·
 *    thời gian · `s/sub` · chip trạng thái bên phải;
 * 2. tiêu đề = câu quyết định của tác giả (link tới mạch);
 * 3. **dải lệnh — CHỈ khi `mach.lenh` có** (dữ liệu có cấu trúc do tác giả khai lúc đăng).
 *    Không có thì không có dải: cố ý KHÔNG parse tiêu đề "Mua X tại …" để suy ra, vì một dải
 *    đoán mò trông y hệt dải thật mà có thể sai số;
 * 4. đoạn trích (kẹp 3 dòng) + ẢNH NHỎ bên phải nếu mốc 1 có ảnh — thay cho biểu đồ to toàn
 *    chiều ngang của `TheMach`;
 * 5. chân thẻ — vote · "N mốc" · bình luận · (phải) Theo dõi tác giả · Chia sẻ.
 *
 * Màu: `--gain`/`--loss` của TP/SL và chip MUA/BÁN nằm ở `con-so.module.css` (file duy nhất
 * `mau-token.spec.ts` cho phép); chip "Đã đóng sổ" dùng lại selector `.dong_so` của
 * `the-mach.module.css` — `--stamp` bị khoá theo TỪNG selector, một class mới trong file này
 * làm hàng rào đỏ.
 *
 * `data-testid="the-mach"` GIỮ NGUYÊN so với `TheMach`: mọi bài đo đã nhắm "thẻ nhật ký của
 * trang chủ" (nhóm U của `trang-chu-v2.spec.ts`: mỗi tác giả một thẻ, đúng thứ tự API) vẫn đo
 * đúng thứ chúng đo mà không phải sửa; `data-kieu="nhat-ky-moi"` phân biệt thẻ này khi cần.
 * Các testid con thì mang tên riêng (`the-nhat-ky-*`) vì DOM bên trong khác hẳn.
 *
 * Server component, một HTML cho mọi người. Các nút có state (vote, theo dõi, chia sẻ) là
 * client component riêng, dùng lại đúng những cái `TheMach` đang dùng.
 */
export function TheNhatKy({ mach }: { mach: MachTomTatOut }) {
  const href = duongDanMach(mach.slug, mach.id);
  const dang_mo = mach.status !== "closed";
  const lenh = mach.lenh ?? null;
  const anh = mach.xem_truoc?.anh ?? null;
  const trich = mach.xem_truoc?.trich ?? "";
  const ten = tenHienThi(mach.author);

  return (
    <li className={css.the} data-testid="the-mach" data-kieu="nhat-ky-moi" data-mach-id={mach.id}>
      <div className={css.dau}>
        <Link
          href={duongDanHoSo(mach.author.username)}
          prefetch={false}
          tabIndex={-1}
          aria-hidden="true"
          className={css.avatar}
        >
          {mach.author.la_bot ? (
            <span className={css.avatar_bot}>
              <Bot size={16} strokeWidth={2} aria-hidden />
            </span>
          ) : (
            <Avatar
              ten={mach.author.username}
              hienThi={mach.author.display_name}
              url={mach.author.avatar_url}
              co={34}
            />
          )}
        </Link>
        <div className={css.ai_va_khi}>
          <span className={css.dong_ten}>
            <Link
              className={css.ten}
              href={duongDanHoSo(mach.author.username)}
              prefetch={false}
              title={`u/${mach.author.username}`}
              {...CHU_NGUOI_DUNG}
            >
              {ten}
            </Link>
            {mach.author.la_bot && (
              <span className={css.nhan_bot} data-testid="the-nhat-ky-bot">
                BOT · DEMO
              </span>
            )}
          </span>
          <span className={css.khi_va_sub}>
            <time dateTime={mach.published_at}>{ngayCuaThoiDiem(mach.published_at)}</time>
            <span aria-hidden> · </span>
            <Link
              className={css.sub}
              href={duongDanSub(mach.sub.slug)}
              prefetch={false}
              {...CHU_NGUOI_DUNG}
            >
              s/{mach.sub.slug}
            </Link>
          </span>
        </div>
        {dang_mo ? (
          <span className={`${css.chip} ${css.chip_mo}`} data-testid="the-nhat-ky-trang-thai">
            Đang mở
          </span>
        ) : (
          <span
            className={`${css.chip} ${theMach.dong_so}`}
            data-testid="the-nhat-ky-trang-thai"
          >
            Đã đóng sổ
          </span>
        )}
      </div>

      <h3 className={css.tieu_de}>
        <Link href={href} prefetch={false} {...CHU_NGUOI_DUNG}>
          {mach.title}
        </Link>
      </h3>

      {lenh !== null && (
        <div className={css.lenh} data-testid="the-nhat-ky-lenh" role="group" aria-label="Lệnh">
          <span className={css.o_lenh}>
            <span
              className={`${css.chieu} ${lenh.chieu === "mua" ? conSo.mua : conSo.ban}`}
              data-testid="the-nhat-ky-chieu"
            >
              {NHAN_CHIEU_LENH[lenh.chieu]}
            </span>
            <b className={css.ma} {...CHU_NGUOI_DUNG}>
              {lenh.ma}
            </b>
          </span>
          {cacOLenh(lenh).map((o) => (
            <span key={o.khoa} className={css.o_lenh} data-testid={`the-nhat-ky-${o.khoa}`}>
              <em className={css.nhan_o}>{o.nhan}</em>
              <b
                className={
                  o.khoa === "tp" ? conSo.gia_tp : o.khoa === "sl" ? conSo.gia_sl : undefined
                }
              >
                {o.gia_tri}
              </b>
            </span>
          ))}
        </div>
      )}

      {(trich !== "" || anh !== null) && (
        <div className={css.than}>
          {trich !== "" ? (
            <p className={css.trich} data-testid="the-nhat-ky-trich" {...CHU_NGUOI_DUNG}>
              {trich}
            </p>
          ) : (
            <span className={css.trich} />
          )}
          {anh !== null && (
            <Link
              className={css.anh_o}
              href={href}
              prefetch={false}
              aria-hidden="true"
              tabIndex={-1}
              data-testid="the-nhat-ky-anh"
            >
              {/* `next/image` cố ý KHÔNG dùng — cùng lý lẽ với `NoiDungThe`: server đã thu ảnh
                  và sinh sẵn thumbnail lúc upload. Khung `.anh_o` có kích thước CỐ ĐỊNH
                  (168×104 / 76×76) nên ảnh nạp xong không đẩy chữ (CLS = 0); `width`/`height`
                  của thẻ chỉ là kích thước nội tại cho trình duyệt. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={css.anh}
                src={anh.url_thumb}
                width={anh.w_thumb ?? undefined}
                height={anh.h_thumb ?? undefined}
                alt={`Ảnh minh họa: ${mach.title}`}
                loading="lazy"
                decoding="async"
              />
            </Link>
          )}
        </div>
      )}

      <div className={css.chan}>
        <span className={css.chan_vote}>
          <CotVote
            diem={mach.diem}
            nhan={mach.title}
            cai_gi="mach"
            nam_ngang
            dich={mach.moc_1_id === null ? null : { loai: "moc", id: mach.moc_1_id }}
          />
        </span>
        <Link
          href={
            mach.entry_count > 1 ? `${href}#moc-${mach.entry_count}` : href
          }
          prefetch={false}
          className={css.nut_chan}
          data-testid="the-nhat-ky-so-moc"
          title="Số mốc ghi nhận trong mạch"
        >
          <GitCommitHorizontal size={15} strokeWidth={2} aria-hidden />
          <span>{mach.entry_count} mốc</span>
        </Link>
        <Link
          href={`${href}#khan-dai`}
          prefetch={false}
          className={css.nut_chan}
          data-testid="the-nhat-ky-so-binh-luan"
          title="Bình luận"
        >
          <MessageCircle size={15} strokeWidth={2} aria-hidden />
          <span>
            {mach.comment_count > 0 ? `${mach.comment_count} bình luận` : "Bình luận"}
          </span>
        </Link>
        <span className={css.chan_phai}>
          <span className={css.theo_user}>
            <NutTheoUser username={mach.author.username} />
          </span>
          <NutChiaSeMach duongDan={href} tieuDe={mach.title} kieu="pill" />
          <HanhDongMod
            loai="mach"
            id={mach.id}
            dangAn={false}
            nhan={`mạch “${mach.title}”`}
            kieu="pill"
          />
        </span>
      </div>
    </li>
  );
}
