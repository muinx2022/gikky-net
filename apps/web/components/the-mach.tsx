import type { MachTomTatOut } from "@gikky/api-client";
import { Bot, GitCommitHorizontal, MessageCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { nhanNoiMoc, ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { NHAN_CHIEU_LENH, cacOLenh } from "@/lib/lenh";
import { NHAN_NGAN_LOAI_MACH } from "@/lib/loc-loai-mach";
import { tenHienThi } from "@/lib/ten-hien-thi";
import { duongDanHoSo, duongDanMach, duongDanSub } from "@/lib/url";

import { Avatar } from "./avatar";
import conSo from "./con-so.module.css";
import { CotVote } from "./cot-vote";
import { HanhDongMod } from "./hanh-dong-mod";
import { NutChiaSeMach } from "./nut-chia-se-mach";
import { NutTheoUser } from "./nut-theo-user";
import css from "./the-mach.module.css";

/** Thẻ mạch — **MỘT thẻ cho mọi danh sách**: khối "Nhật ký mới" của `/`, feed `/?…`,
 * `/s/<sub>`, cuộn vô hạn, hồ sơ `/u/<x>` (plan `2026-11-11-thong-nhat-giao-dien-toan-site.md`
 * §4.1, đợt B). Trước đó có hai thẻ: `TheMach` (không hộp, ảnh to hết chiều ngang) cho feed và
 * `TheNhatKy` (hộp có viền, ảnh nhỏ bên phải) chỉ cho trang chủ — bấm "Tất cả nhật ký →" ở home
 * là sang một trang mà thẻ đổi hình dạng. Nay hình dạng là của `TheNhatKy` cũ, tên là `TheMach`.
 *
 * Năm phần, đúng thứ tự:
 *
 * 1. hàng đầu — avatar · tên (+ nhãn BOT · DEMO theo cờ `author.la_bot`, KHÔNG so username) ·
 *    ngày (+ "nối mốc dd/mm", xem `nhanNoiMoc`) · `s/sub` · bên phải: nhãn loại / lưu trữ /
 *    riêng tư / chip trạng thái;
 * 2. tiêu đề = link tới mạch;
 * 3. **dải lệnh — CHỈ khi `mach.lenh` có** (dữ liệu có cấu trúc do tác giả khai lúc đăng).
 *    Cố ý KHÔNG parse tiêu đề "Mua X tại …" để suy ra: một dải đoán mò trông y hệt dải thật mà có
 *    thể sai số;
 * 4. đoạn trích (kẹp 3 dòng) + ẢNH NHỎ bên phải nếu mốc 1 có ảnh;
 * 5. chân thẻ — vote · "N mốc" · bình luận · (phải) Theo dõi tác giả · Chia sẻ · mod.
 *
 * ## Khác nhau theo `loai_mach`, cùng một khung
 *
 * - `nhat_ky`: chip "Đang mở" / "Đã đóng sổ";
 * - `thao_luan`: chip "Đang mở" / "Đã đóng" — chủ đề không phải một cuốn sổ, chữ "sổ" là của nhật ký;
 * - `bai_viet`: KHÔNG chip trạng thái (bài viết không có vòng đời mở/đóng), không dải lệnh
 *   (`lenh` luôn `null` ở bài viết / chủ đề).
 *
 * ## Màu
 *
 * `--gain`/`--loss` của TP/SL và chip MUA/BÁN nằm ở `con-so.module.css` (file duy nhất
 * `mau-token.spec.ts` cho phép); chip "Đã đóng sổ" là `.dong_so` của `the-mach.module.css` —
 * `--stamp` bị khoá theo TỪNG selector, một class mới trong file CSS này làm hàng rào đỏ.
 *
 * ## Testid
 *
 * `the-mach` + `data-mach-id` trên `<li>` (mọi bài đo "thẻ" nhắm vào đó). Testid con GIỮ tên
 * `the-nhat-ky-*` của thẻ trang chủ cũ — ~30 chỗ đo ghim chúng, còn testid con của `TheMach` cũ
 * chỉ có MỘT chỗ đo. Tên nay hơi lệch nghĩa (thẻ không còn riêng của nhật ký); đổi tên là việc
 * của một lượt có chủ đích, đừng làm tiện tay. Riêng ba dấu không có đôi bên kia (`nhan-loai`,
 * `the-mach-da-luu-tru`, `the-mach-rieng-tu`) giữ nguyên tên.
 *
 * ## Trang tìm kiếm: `khop` thay NỘI DUNG, không thay khung (đợt D)
 *
 * `/tim-kiem` dùng chính thẻ này (plan §8.1 — user chốt thẻ mới áp cả cho tìm kiếm), chỉ khác hai
 * chỗ chữ: tiêu đề có chỗ khớp tô `<mark>`, và đoạn trích là ĐOẠN KHỚP của API (`doan_trich`) thay
 * cho trích 3 dòng tự sinh từ mốc 1. Hai thứ ấy đi vào qua `khop` dưới dạng node đã dựng sẵn, nên
 * thẻ không biết gì về dấu `[[…]]` hay về tìm kiếm — cùng thẻ, cùng DOM, cùng testid. `khop.trich
 * = null` ⇒ KHÔNG có đoạn trích (mốc 1 là bia mộ / bị ẩn, hoặc đọc được mà chỉ có ảnh), tuyệt đối
 * không rơi về `xem_truoc.trich`; ảnh nhỏ thì vẫn lấy từ `xem_truoc` như mọi trang.
 *
 * Server component, một HTML cho mọi người. Các nút có state (vote, theo dõi, chia sẻ, mod) là
 * client component riêng; thẻ này không import thứ gì server-only nên `CuonVoHan` (client) vẫn
 * dựng được nó cho trang nạp thêm.
 */
export function TheMach({
  mach,
  capHeading = 2,
  hienNhanLoai = false,
  anTheoDoi = false,
  khop,
}: {
  mach: MachTomTatOut;
  /** Cấp heading của tiêu đề thẻ. Mặc định 2 (feed, hồ sơ); trang chủ truyền 3 vì thẻ nằm dưới
   * `<h2>Nhật ký mới</h2>` của khối. */
  capHeading?: 2 | 3;
  /** Hiện nhãn loại ("Nhật ký" / "Bài viết" / "Chủ đề") ở hàng đầu. Mặc định `false` — chỉ
   * trang chuyên mục `/s/<sub>` và trang tìm kiếm bật nó (hai danh sách lẫn cả ba loại nên thẻ
   * phải tự nói mình thuộc loại nào). Mọi chỗ khác để mặc định. */
  hienNhanLoai?: boolean;
  /** Bỏ nút "Theo dõi" tác giả ở chân thẻ. Hồ sơ `/u/<x>` bật nó cho thẻ của CHÍNH chủ trang (header
   * đã có nút ấy; 20 nút trùng chỉ là ồn và là 20 chỗ phải giữ đồng bộ). Mặc định `false`. */
  anTheoDoi?: boolean;
  /** Chỉ trang tìm kiếm: chữ tiêu đề (đặt TRONG link tiêu đề) và đoạn trích (thay trích tự sinh;
   * `null` ⇒ không đoạn trích) đã tô chỗ khớp. Xem mục "Trang tìm kiếm" ở trên. */
  khop?: { tieuDe: ReactNode; trich: ReactNode | null };
}) {
  const Heading = capHeading === 3 ? "h3" : "h2";
  const href = duongDanMach(mach.slug, mach.id);
  const dang_mo = mach.status !== "closed";
  const lenh = mach.lenh ?? null;
  const anh = mach.xem_truoc?.anh ?? null;
  const trich = mach.xem_truoc?.trich ?? "";
  const co_trich = khop ? khop.trich !== null : trich !== "";
  const ten = tenHienThi(mach.author);
  /** Số ảnh còn lại ngoài ảnh đang hiện (huy hiệu "+N" trên ảnh nhỏ) — như thẻ feed cũ. */
  const con_lai = Math.max(0, (mach.xem_truoc?.so_anh ?? 0) - 1);
  const noi_moc = nhanNoiMoc(mach.published_at, mach.moc_moi_nhat?.created_at, mach.entry_count);

  return (
    <li className={css.the} data-testid="the-mach" data-mach-id={mach.id}>
      <div className={css.dau}>
        <Link
          href={duongDanHoSo(mach.author.username)}
          prefetch={false}
          tabIndex={-1}
          aria-hidden="true"
          className={css.avatar}
          data-testid="the-nhat-ky-avatar"
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
        {/* Các chuỗi mang dấu `CHU_NGUOI_DUNG` trong thẻ này (Y3): slug sub, tên tác giả, tiêu
            đề, trích, mã lệnh — do người dùng gõ. Phần còn lại ("mốc", "bình luận", "Đang mở",
            "nối mốc") là chữ của ứng dụng và ở lại trong phép quét. */}
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
            {noi_moc !== null && (
              <>
                <span aria-hidden> · </span>
                <span data-testid="the-mach-noi-moc">{noi_moc}</span>
              </>
            )}
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
        <div className={css.dau_phai}>
          {hienNhanLoai && (
            <span className={css.nhan_loai} data-testid="nhan-loai">
              {NHAN_NGAN_LOAI_MACH[mach.loai_mach]}
            </span>
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
          {mach.loai_mach !== "bai_viet" &&
            (dang_mo ? (
              <span className={`${css.chip} ${css.chip_mo}`} data-testid="the-nhat-ky-trang-thai">
                Đang mở
              </span>
            ) : (
              <span className={`${css.chip} ${css.dong_so}`} data-testid="the-nhat-ky-trang-thai">
                {mach.loai_mach === "thao_luan" ? "Đã đóng" : "Đã đóng sổ"}
              </span>
            ))}
        </div>
      </div>

      <Heading className={css.tieu_de}>
        <Link href={href} prefetch={false} {...CHU_NGUOI_DUNG}>
          {khop ? khop.tieuDe : mach.title}
        </Link>
      </Heading>

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

      {/* Nội dung xem trước lấy từ MỐC 1. `xem_truoc` là `null` khi mốc 1 là bia mộ hoặc bị
          mod ẩn: thẻ khi đó chỉ còn tiêu đề và **không** thông báo gì — feed không phải chỗ kể
          chuyện kiểm duyệt (`api/trinh_bay.py::du_lieu_the`). */}
      {(co_trich || anh !== null) && (
        <div className={css.than} data-testid="the-nhat-ky-than">
          {co_trich ? (
            <p className={css.trich} data-testid="the-nhat-ky-trich" {...CHU_NGUOI_DUNG}>
              {khop ? khop.trich : trich}
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
              {/* `next/image` cố ý KHÔNG dùng: server đã thu ảnh và sinh sẵn thumbnail lúc
                  upload. Khung `.anh_o` có kích thước CỐ ĐỊNH (168×104 / 76×76) nên ảnh nạp
                  xong không đẩy chữ (CLS = 0); `width`/`height` của thẻ chỉ là kích thước nội
                  tại cho trình duyệt. */}
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
              {/* "+N" cho phần gallery không hiện ra (như thẻ feed cũ). `aria-hidden`: cả link ảnh
                  đã `aria-hidden` — số ảnh là chuyện của trang mạch, không phải của thẻ. */}
              {con_lai > 0 && (
                <span className={css.them_anh} aria-hidden="true" data-testid="the-mach-them-anh">
                  +{con_lai}
                </span>
              )}
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
          href={mach.entry_count > 1 ? `${href}#moc-${mach.entry_count}` : href}
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
          <span>{mach.comment_count > 0 ? `${mach.comment_count} bình luận` : "Bình luận"}</span>
        </Link>
        <span className={css.chan_phai}>
          {!anTheoDoi && (
            <span className={css.theo_user} data-testid="the-nhat-ky-theo-user">
              <NutTheoUser username={mach.author.username} />
            </span>
          )}
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
