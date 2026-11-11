import type { BinhLuanOut, MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";

import {
  chonChuDeNoi,
  chonQuanDiem,
  chuChipChuDe,
  khoangTuanVN,
  trichQuanDiem,
} from "@/lib/chu-de";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { diemCoDau } from "@/lib/dinh-dang";
import { tenHienThi } from "@/lib/ten-hien-thi";
import {
  duongDanHoSo,
  duongDanKhanDai,
  duongDanMach,
  duongDanSub,
  duongDanVietBinhLuan,
} from "@/lib/url";

import { Avatar } from "./avatar";
import css from "./khoi-thao-luan.module.css";

/** Từ ngần này bình luận trở lên mới phô con số — PLAN nguyên tắc 9 (không phô sự im lặng).
 * Dưới ngưỡng: không hiện con số nào (nút "Vào thảo luận" đã là lời mời). */
export const NGUONG_PHO_SO_BINH_LUAN = 4;

/** Số quan điểm nổi bật tối đa ở desktop (mobile chỉ HIỆN 1, bằng CSS — cả ba cùng nằm trong
 * HTML, một nội dung cho mọi UA). */
export const SO_QUAN_DIEM_NOI_BAT = 3;

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
 * ## Hai nửa
 *
 * - trái: nhãn tuần · khoảng tuần (thứ Hai–Chủ nhật giờ VN của `published_at`) · chip trạng
 *   thái · câu hỏi (`<h2>` cỡ lớn — `<h1>` của trang là dòng giới thiệu SEO, không phải chỗ này)
 *   · một dòng bối cảnh · hai nút;
 * - phải: quan điểm — bình luận GỐC (`chonQuanDiem`). Có ít nhất một bình luận điểm > 0 ⇒
 *   "Quan điểm nổi bật", điểm cao nhất trước; toàn điểm 0 ⇒ "Quan điểm mới", mới nhất trước và
 *   KHÔNG in điểm. Chỉ in `▲ N` cho bình luận có N ≠ 0. Tên + avatar là link hồ sơ (cùng kiểu
 *   `TheMach`). Chưa có bình luận nào ⇒ **ẩn cả nửa phải**, nửa trái chiếm hết (không khung
 *   rỗng);
 * - hai nút khác `href`: "Viết quan điểm của bạn" tới Ô SOẠN (`duongDanVietBinhLuan`), "Xem tất
 *   cả quan điểm →" tới danh sách (`duongDanKhanDai`).
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
  binh_luan_goc,
  binh_luan_moi,
  bay_gio,
}: {
  chu_de: readonly MachTomTatOut[];
  /** Bình luận gốc của CHÍNH chủ đề được chọn (`docBinhLuanGoc`); rỗng ⇒ ẩn nửa phải. */
  binh_luan_goc: readonly BinhLuanOut[];
  /** Bình luận gốc MỚI NHẤT của chính chủ đề ấy (`docBinhLuanGocMoiNhat`) — chỉ dùng khi chưa ai
   * bỏ phiếu ("Quan điểm mới"). */
  binh_luan_moi: readonly BinhLuanOut[];
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
  const { kieu: kieu_quan_diem, muc: quan_diem } = chonQuanDiem(
    binh_luan_goc,
    binh_luan_moi,
    SO_QUAN_DIEM_NOI_BAT,
  );

  return (
    <section
      className={css.khoi}
      data-testid="khoi-thao-luan"
      aria-labelledby="tieu-khoi-thao-luan"
    >
      {/* `chu-de-the` + `data-mach-id`: giữ nguyên mốc cho các bài đo đã nhắm "thẻ chủ đề" của
          trang chủ (`chu-de.spec.ts`, `trang-chu-v2.spec.ts`) — đúng MỘT cái trong khối. */}
      <div
        className={quan_diem.length > 0 ? css.hai_nua : css.mot_nua}
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

        {quan_diem.length > 0 && (
          <div className={css.phai} data-testid="quan-diem-noi-bat" data-kieu={kieu_quan_diem}>
            <h3 className={css.tieu_phai}>
              {kieu_quan_diem === "noi_bat" ? "Quan điểm nổi bật" : "Quan điểm mới"}
            </h3>
            <ul className={css.ds_quan_diem}>
              {quan_diem.map((b) => {
                const avatar = (
                  <Avatar
                    ten={b.author?.username ?? "?"}
                    hienThi={b.author?.display_name}
                    url={b.author?.avatar_url}
                    co={34}
                  />
                );
                return (
                  <li key={b.id} className={css.quan_diem} data-testid="quan-diem" data-binh-luan-id={b.id}>
                    {/* Tác giả `null` = tài khoản đã xoá: không có hồ sơ để trỏ tới ⇒ không link. */}
                    {b.author === null ? (
                      avatar
                    ) : (
                      <Link
                        href={duongDanHoSo(b.author.username)}
                        prefetch={false}
                        tabIndex={-1}
                        aria-hidden="true"
                        className={css.quan_diem_avatar}
                      >
                        {avatar}
                      </Link>
                    )}
                    <div className={css.quan_diem_than}>
                      <div className={css.quan_diem_dong}>
                        {b.author === null ? (
                          <b className={css.quan_diem_ten} {...CHU_NGUOI_DUNG}>
                            {tenHienThi(b.author, "?")}
                          </b>
                        ) : (
                          <Link
                            className={css.quan_diem_ten}
                            href={duongDanHoSo(b.author.username)}
                            prefetch={false}
                            title={`u/${b.author.username}`}
                            data-testid="quan-diem-ten"
                            {...CHU_NGUOI_DUNG}
                          >
                            {tenHienThi(b.author, "?")}
                          </Link>
                        )}
                        {/* Điểm 0 không in: "▲ 0" là phô sự im lặng (PLAN nguyên tắc 9). */}
                        {b.score !== 0 && (
                          <span className={css.quan_diem_diem} title="Điểm của bình luận">
                            ▲ {diemCoDau(b.score)}
                          </span>
                        )}
                      </div>
                      <p className={css.quan_diem_trich} {...CHU_NGUOI_DUNG}>
                        {trichQuanDiem(b.body ?? "", b.body_dinh_dang)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link
              className={css.xem_tat_ca}
              href={href_khan_dai}
              prefetch={false}
              data-testid="quan-diem-tat-ca"
            >
              Xem tất cả quan điểm →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
