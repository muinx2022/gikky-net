import type { MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import { chonChuDeNoi, chuChipChuDe, khoangTuanVN } from "@/lib/chu-de";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import {
  duongDanKhanDai,
  duongDanMach,
  duongDanSub,
  duongDanVietBinhLuan,
} from "@/lib/url";

import css from "./khoi-thao-luan.module.css";

/** Từ ngần này bình luận trở lên mới phô con số — PLAN nguyên tắc 9 (không phô sự im lặng).
 * Dưới ngưỡng: không hiện con số nào (nút "Vào thảo luận" đã là lời mời). */
export const NGUONG_PHO_SO_BINH_LUAN = 4;

/** Khối "Chủ đề tuần" — TIÊU ĐIỂM của trang chủ *(plan
 * `2026-11-11-homepage-v2-giao-dien-moi.md` §3.1; user 2026-11-11: "Chủ đề thảo luận sẽ là
 * focus của home")*. Thay cho "thẻ nổi" `TheChuDe` của homepage v2 bản đầu.
 *
 * ## Chọn chủ đề
 *
 * MỘT chủ đề: cái XUẤT BẢN SAU CÙNG (`chonChuDeNoi`, luật vòng sửa 4 — feed `moi` sắp theo
 * `last_content_at` nên phần tử đầu có thể là chủ đề cũ vừa được nối mốc). **Không có danh sách
 * "chủ đề trước" trên `/`**: mỗi tuần một chủ đề, hết tuần đóng, mở chủ đề khác; kho cũ vẫn ở
 * `/chu-de`, lối vào là link trên rail phải.
 *
 * ## Xếp chồng *(việc 18, plan `2026-11-12-khoi-chu-de-xep-chong-nut-brand.md`)*
 *
 * Bản đầu là lưới hai cột: tiêu đề bị ép còn ~380px và gãy 5 dòng. Nay phần chủ đề luôn rộng
 * hết khối: nhãn tuần · khoảng tuần (thứ Hai–Chủ nhật giờ VN của `published_at`) · chip trạng
 * thái · câu hỏi (`<h2>` cỡ lớn — `<h1>` của trang là dòng giới thiệu SEO, không phải chỗ này)
 * · bối cảnh (TRỌN đoạn trích server đã cắt; CSS chỉ chặn ở 6 dòng — việc 19 §3.5) · tổng kết
 * (chủ đề đã đóng) · hai nút. Hai nút khác `href`: "Vào thảo luận" tới mạch, "Viết quan điểm của bạn" tới Ô SOẠN (`duongDanVietBinhLuan`); con số bình
 * luận (từ ngưỡng) dẫn tới khán đài (`duongDanKhanDai`).
 *
 * **Không có ô quan điểm** *(việc 19, plan `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.4 —
 * user: "bỏ luôn các list cmt của các user đi")*. Việc 18 từng xếp dưới phần chủ đề một ô liệt
 * kê bình luận gốc; nay khối không vẽ bình luận nào, nên trang chủ cũng không gọi API bình luận.
 *
 * Hai nút chọn phe trong mockup ("Ưu tiên quản trị rủi ro" / "Canh nhịp chỉnh để gom hàng")
 * KHÔNG làm: chúng cần mô hình dữ liệu "lựa chọn quan điểm" chưa có (plan §3.1).
 *
 * ## Màu chip trạng thái
 *
 * "Đang mở" dùng `--accent-soft`/`--accent`, **không** `--gain` như bản đồ màu của plan §2.1:
 * `mau-token.spec.ts` chỉ cho `--gain`/`--loss` ở ba file khai tên, và PLAN 9.1 giữ hai màu ấy
 * cho con số lãi/lỗ (lý do này đã nằm ở bản cũ của file này). "Đã đóng" dùng `--inset`.
 *
 * Luật đếm (PLAN nguyên tắc 9): dưới `NGUONG_PHO_SO_BINH_LUAN` bình luận thì KHÔNG phô số.
 * Không dùng chữ "tham gia": `vo-reddit.spec.ts` (A8) cấm nó trên `/`. */
export function KhoiThaoLuan({
  chu_de,
  bay_gio,
}: {
  chu_de: readonly MachTomTatOut[];
  /** Thời điểm hiện tại — tham số để đo được ranh giới tuần; trang truyền `new Date()`. */
  bay_gio: Date;
}) {
  const [moi_nhat] = chonChuDeNoi(chu_de);
  if (moi_nhat === undefined) return null;

  const dang_mo = moi_nhat.status !== "closed";
  const tuan = khoangTuanVN(moi_nhat.published_at, bay_gio);
  const href = duongDanMach(moi_nhat.slug, moi_nhat.id);
  const href_khan_dai = duongDanKhanDai(moi_nhat.slug, moi_nhat.id);
  const href_viet = duongDanVietBinhLuan(moi_nhat.slug, moi_nhat.id);
  const co_ket_qua = !dang_mo && moi_nhat.ket_qua !== null && moi_nhat.ket_qua !== "";
  const boi_canh = moi_nhat.xem_truoc?.trich ?? "";

  return (
    <section
      className={css.khoi}
      data-testid="khoi-thao-luan"
      aria-labelledby="tieu-khoi-thao-luan"
    >
      {/* `chu-de-the` + `data-mach-id`: giữ nguyên mốc cho các bài đo đã nhắm "thẻ chủ đề" của
          trang chủ (`chu-de.spec.ts`, `trang-chu-v2.spec.ts`) — đúng MỘT cái trong khối. */}
      <div
        className={css.the}
        data-testid="chu-de-the"
        data-mach-id={moi_nhat.id}
      >
        <div className={css.trai}>
          <div className={css.dau}>
            <span className={css.nhan} data-testid="chu-de-nhan">
              {tuan.trongTuan ? "Chủ đề tuần này" : "Chủ đề gần nhất"}
            </span>
            <span className={css.tuan} data-testid="chu-de-tuan">
              {tuan.nhan}
            </span>
            <Link
              className={css.sub}
              href={duongDanSub(moi_nhat.sub.slug)}
              prefetch={false}
              {...CHU_NGUOI_DUNG}
            >
              s/{moi_nhat.sub.slug}
            </Link>
            <span
              className={dang_mo ? `${css.chip} ${css.chip_mo}` : `${css.chip} ${css.chip_dong}`}
              data-testid="chu-de-trang-thai"
            >
              {chuChipChuDe(dang_mo, tuan)}
            </span>
          </div>

          <h2 className={css.cau_hoi} id="tieu-khoi-thao-luan">
            <Link href={href} prefetch={false} data-testid="chu-de-tieu-de" {...CHU_NGUOI_DUNG}>
              {moi_nhat.title}
            </Link>
          </h2>

          {boi_canh !== "" && (
            <p className={css.boi_canh} data-testid="chu-de-boi-canh" {...CHU_NGUOI_DUNG}>
              {boi_canh}
            </p>
          )}

          {co_ket_qua && (
            <p className={css.ket_qua} data-testid="chu-de-ket-qua">
              <span className={css.ket_qua_nhan}>Tổng kết:</span> {moi_nhat.ket_qua}
            </p>
          )}

          <div className={css.hanh_dong}>
            <Link className={css.nut_chinh} href={href} prefetch={false} data-testid="chu-de-vao">
              {dang_mo ? "Vào thảo luận" : "Xem lại thảo luận"}
            </Link>
            <Link
              className={css.nut_phu}
              href={href_viet}
              prefetch={false}
              data-testid="chu-de-viet"
            >
              Viết quan điểm của bạn
            </Link>
            {moi_nhat.comment_count >= NGUONG_PHO_SO_BINH_LUAN && (
              <Link
                className={css.so_binh_luan}
                href={href_khan_dai}
                prefetch={false}
                title={`${moi_nhat.comment_count} bình luận`}
                data-testid="chu-de-so-binh-luan"
              >
                💬 {moi_nhat.comment_count}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
