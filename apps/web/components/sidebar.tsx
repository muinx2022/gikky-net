import type { MachTomTatOut, SubChiTietOut } from "@gikky/api-client";
import Link from "next/link";

import type { ChuDeTuan } from "@/lib/chu-de";
import { dongSoMachSub } from "@/lib/dinh-dang";
import { hrefLoaiTrongSub } from "@/lib/loc-loai-mach";
import { DIEU_CAM } from "@/lib/phap-ly";
import { duongDanKhanDai, duongDanMach, duongDanSub } from "@/lib/url";

import { BaiMoiTuTrinhDuyet } from "./bai-moi-tu-trinh-duyet";
import { ChanTrang } from "./chan-trang";
import { ChuyenMucTuTrinhDuyet } from "./chuyen-muc-tu-trinh-duyet";
import { KhoiBaiMoi } from "./khoi-bai-moi";
import { KhoiChuyenMuc } from "./khoi-chuyen-muc";
import { KhoiKhach } from "./khoi-khach";
import css from "./sidebar.module.css";

/** Sidebar phải — cột phải DUY NHẤT của web (plan con 1d §2.5.2 và §2.5.3; hai cột toàn site
 * 2026-11-10: không còn cột trái, nên rail này mang cả những gì cột trái từng giữ).
 *
 * Các khối:
 *
 * 0. **khách** — "Tham gia Gikky.net" (`KhoiKhach`, client): chỉ hiện với người CHƯA đăng
 *    nhập, ở mọi trang có rail. Người đã đăng nhập có "Hồ sơ của tôi" + "Cài đặt" ở menu tài
 *    khoản trên header, nên không có khối "Tài khoản" ở đây;
 * 1. giới thiệu (trang chủ) hoặc, ở trang sub, số mạch + ngày lập + hai lối nhanh "Nhật ký / Bài
 *    viết trong chuyên mục →". **KHÔNG còn mô tả sub** *(việc 14, đợt C, T4)*: header của trang
 *    sub đã in nó — in lại ở rail là hai bản của cùng một đoạn chữ trên một trang;
 * 1b. **"Chủ đề tuần này"** *(việc 14, đợt E — plan §4.7)*: câu hỏi của chủ đề đang nổi (link
 *    tới mạch) + "Vào thảo luận →" (khán đài) + "Các chủ đề trước →" (`/chu-de`). Chủ đề do trang
 *    nạp bằng `docChuDeTuan` — cùng lời gọi, cùng phép chọn với khối tiêu điểm của `/`. Vắng mặt
 *    ở `/` (khối tiêu điểm đã có), ở trang tĩnh, khi chưa có chủ đề / nạp hỏng, và ở trang mạch
 *    của CHÍNH chủ đề ấy (`KhungHaiCot`);
 * 2. danh sách các sub — **vắng mặt hẳn khi `cacSub` rỗng** *(2026-08-31)*. Một hộp mang
 *    tiêu đề "Chuyên mục" mà không có chuyên mục nào là biển chỉ đường chết: nó chiếm chỗ
 *    và hứa một lối đi không tồn tại. Đây cũng là điều kiện để `KhungHaiCotTinh` dùng lại
 *    đúng `Sidebar` này với `cacSub={[]}` thay vì chế một sidebar thứ hai.
 *    **Có ở MỌI trang có rail** *(hai cột toàn site, 2026-11-10)*: cột trái từng đặt 13 link
 *    `/s/*` + `/luat` trên mọi trang (bot vào trang mạch ~12.000 lượt / 30 ngày); bỏ cột trái
 *    mà không chuyển danh sách vào đây là bớt link nội bộ từ mọi bài.
 *    Trang TĨNH (`/luat`) không có `cacSub` từ server: truyền `chuyenMucTuTrinhDuyet` để khối
 *    tự nạp ở trình duyệt (`ChuyenMucTuTrinhDuyet`) — xem `khung-hai-cot-tinh.tsx`;
 * 3. bài mới (`KhoiBaiMoi`) — **vắng mặt hẳn khi `baiMoi` rỗng** *(2026-09-10)*. "Bài mới nhất" /
 *    "Cùng chuyên mục" ở trang mạch `/m/[slugId]` và các trang dùng `KhungHaiCot`; "Bài viết
 *    mới" ở `/` — thay cho khối "Bài viết" to đã gỡ khỏi trang chủ *(việc 24)*. Đứng SAU
 *    "Chuyên mục", TRƯỚC "Luật rút gọn" (user chốt 2026-11-13). Trang TĨNH (`/luat`) truyền
 *    `baiMoiTuTrinhDuyet` để khối tự nạp ở trình duyệt (`BaiMoiTuTrinhDuyet`). Rail `/s/*` không
 *    có khối này;
 * 4. luật rút gọn dẫn `/luat` — PLAN 5.10 bắt mọi trang công khai phải có đường tới đó,
 *    và chân trang một mình thì ở dưới quá xa để ai đọc;
 * 5. `ChanTrang` — chỉ còn dòng miễn trừ (đợt E bỏ "Luật cộng đồng" + "Trang chủ": khối luật
 *    ngay trên đã dẫn `/luat`, logo header dẫn `/`).
 *
 * **Sidebar không gọi API.** Danh sách chuyên mục / bài mới do trang (hoặc `KhungHaiCot`) nạp ở
 * server rồi truyền xuống; nhánh tự nạp ở trình duyệt nằm trong component client riêng.
 *
 * **KHÔNG có nút "Tham gia sub"** — PLAN mục 4 loại nó khỏi v1 *(chốt 2026-08-22)* kèm
 * lý do "một cái nút vĩnh viễn không bấm được còn tệ hơn không có nút". Đây là chỗ nó sẽ
 * nằm nếu ai đó tái phát minh, nên câu này để đúng ở đây; `e2e/vo-reddit.spec.ts` khẳng
 * định sự VẮNG MẶT của nó.
 *
 * Trên màn hình hẹp sidebar **xuống dưới feed** chứ không biến mất: nội dung của nó là
 * đường đi (luật, các sub), không phải trang trí.
 */
export function Sidebar({
  gioiThieu,
  sub,
  cacSub,
  baiMoi,
  tieuDeBaiMoi = "Bài mới nhất",
  baiMoiTuTrinhDuyet = false,
  linkTatCaBaiViet = false,
  chuyenMucTuTrinhDuyet = false,
  khachTieuDe,
  chuDeTuan,
  trenTrangChuDe = false,
}: {
  /** Hai dòng giới thiệu — chỉ trang không có `sub` dùng (trang sub không in mô tả ở rail). */
  gioiThieu?: string;
  /** Header của sub đang xem; `null`/thiếu là đang ở trang chủ. */
  sub?: SubChiTietOut | null;
  /** Các chuyên mục để nhảy sang. Trang sub vẫn liệt kê cả chính nó — nó là bản đồ, và
   * một bản đồ thiếu chỗ mình đang đứng thì khó đọc hơn. */
  cacSub: readonly SubChiTietOut[];
  /** Danh sách bài mới nhất; vắng mặt hoặc rỗng thì không render khối. */
  baiMoi?: readonly MachTomTatOut[];
  /** Tiêu đề khối bài mới: "Bài mới nhất" hoặc "Cùng chuyên mục" (khi ở trang mạch), "Bài viết
   * mới" ở `/` và `/luat`. */
  tieuDeBaiMoi?: string;
  /** Chỉ cho trang TĨNH không có `baiMoi` từ server (`/luat`): khối bài mới tự nạp `bai_viet` ở
   * trình duyệt (`BaiMoiTuTrinhDuyet`). Đối xứng với `chuyenMucTuTrinhDuyet`. */
  baiMoiTuTrinhDuyet?: boolean;
  /** Link "Tất cả bài viết →" cuối khối bài mới — chỉ `/` và `/luat` bật. */
  linkTatCaBaiViet?: boolean;
  /** Chỉ cho trang TĨNH không có `cacSub` từ server (`/luat`): khối "Chuyên mục" tự nạp
   * danh sách ở trình duyệt. Vô nghĩa khi `cacSub` đã có. */
  chuyenMucTuTrinhDuyet?: boolean;
  /** Tiêu đề riêng của khối khách — chỉ trang chủ và `/?…` truyền ("Bắt đầu nhật ký của bạn",
   * plan giao diện mới §3.4); các trang khác để trống ⇒ "Tham gia Gikky.net". */
  khachTieuDe?: string;
  /** Chủ đề cho khối "Chủ đề tuần này" (`docChuDeTuan`, nạp ở server). Vắng / `null` ⇒ không có
   * khối. Trang chủ `/` KHÔNG truyền (đã có khối tiêu điểm), trang tĩnh không truyền được. */
  chuDeTuan?: ChuDeTuan | null;
  /** Đang ở `/chu-de`: rail bỏ mọi link trỏ về chính trang ấy. */
  trenTrangChuDe?: boolean;
}) {
  const co_khoi_chu_de = chuDeTuan != null;
  return (
    <aside className={css.cot} data-testid="sidebar" aria-label="Thanh bên">
      <KhoiKhach tieuDe={khachTieuDe} />

      {sub != null ? (
        <section className={css.khoi} data-testid="sidebar-ve-sub">
          <h2 className={css.tieu_de}>Về s/{sub.slug}</h2>
          <p className={`${css.so} mono`} data-testid="sidebar-so-mach">
            {dongSoMachSub(sub.so_mach, sub.created_at)}
          </p>
          {/* Hai lối nhanh vào feed đã lọc loại của CHÍNH chuyên mục này. `hrefLoaiTrongSub` dựng
              href bằng `hrefChipLoai` — cùng hàm với hàng chip Loại của `Feed` — nên bấm ở đây ra
              đúng URL mà chip sinh ra (`/s/<slug>?loai_mach=…`), và chip ấy sáng ở trang đích. */}
          <div>
            <Link
              className={css.dan}
              href={hrefLoaiTrongSub(duongDanSub(sub.slug), "nhat_ky")}
              prefetch={false}
              data-testid="sidebar-dan-nhat-ky-sub"
            >
              Nhật ký trong chuyên mục →
            </Link>
          </div>
          <div>
            <Link
              className={css.dan}
              href={hrefLoaiTrongSub(duongDanSub(sub.slug), "bai_viet")}
              prefetch={false}
              data-testid="sidebar-dan-bai-viet-sub"
            >
              Bài viết trong chuyên mục →
            </Link>
          </div>
        </section>
      ) : (
        gioiThieu !== undefined && (
          <section className={css.khoi} data-testid="sidebar-gioi-thieu">
            <h2 className={css.tieu_de}>Về gikky.net</h2>
            <p className={css.than}>{gioiThieu}</p>
            {/* Lối vào kho chủ đề thảo luận nằm ở rail chứ không chỉ ở khối Chủ đề của trang chủ:
                khối ấy ẩn hẳn khi chưa có chủ đề nào, còn `/chu-de` thì không. Cố ý KHÔNG nằm
                trong khối "Chuyên mục": `vo-reddit.spec.ts` B10 đòi khối đó chứa đúng tập link
                `/s/*` của API. Cùng kiểu link `dan` của khối luật.

                *(việc 14, đợt E)* Có khối "Chủ đề tuần này" thì link này NHƯỜNG cho "Các chủ đề
                trước →" của khối ấy (cùng đích, không in hai lần). Nó CÒN ở `/` và `/luat` — hai
                trang không có khối chủ đề — vì ở đó nó là link `/chu-de` DUY NHẤT của trang: bỏ
                là bớt link nội bộ (luật "SEO chỉ cộng"). Ở `/chu-de` thì bỏ: tự trỏ (T7). */}
            {!co_khoi_chu_de && !trenTrangChuDe && (
              <Link
                className={css.dan}
                href="/chu-de"
                prefetch={false}
                data-testid="sidebar-dan-chu-de"
              >
                Chủ đề thảo luận →
              </Link>
            )}
          </section>
        )
      )}

      {chuDeTuan != null && (
        <section className={css.khoi} data-testid="sidebar-chu-de-tuan">
          <h2 className={css.tieu_de}>
            {chuDeTuan.trongTuan ? "Chủ đề tuần này" : "Chủ đề gần nhất"}
          </h2>
          <Link
            className={css.chu_de_tuan}
            href={duongDanMach(chuDeTuan.mach.slug, chuDeTuan.mach.id)}
            prefetch={false}
            data-testid="sidebar-chu-de-tuan-link"
          >
            {chuDeTuan.mach.title}
          </Link>
          <div>
            <Link
              className={css.dan}
              href={duongDanKhanDai(chuDeTuan.mach.slug, chuDeTuan.mach.id)}
              prefetch={false}
              data-testid="sidebar-chu-de-tuan-vao"
            >
              Vào thảo luận →
            </Link>
          </div>
          {!trenTrangChuDe && (
            <div>
              <Link
                className={css.dan}
                href="/chu-de"
                prefetch={false}
                data-testid="sidebar-chu-de-tuan-truoc"
              >
                Các chủ đề trước →
              </Link>
            </div>
          )}
        </section>
      )}

      {cacSub.length > 0 ? (
        <KhoiChuyenMuc cacSub={cacSub} />
      ) : (
        chuyenMucTuTrinhDuyet && <ChuyenMucTuTrinhDuyet />
      )}

      {/* Khối bài mới đứng SAU "Chuyên mục", TRƯỚC "Luật rút gọn" (user chốt 2026-11-13). */}
      {baiMoi && baiMoi.length > 0 ? (
        <KhoiBaiMoi baiMoi={baiMoi} tieuDe={tieuDeBaiMoi} coLinkTatCa={linkTatCaBaiViet} />
      ) : (
        baiMoiTuTrinhDuyet && (
          <BaiMoiTuTrinhDuyet tieuDe={tieuDeBaiMoi} coLinkTatCa={linkTatCaBaiViet} />
        )
      )}

      <section className={css.khoi} data-testid="sidebar-luat">
        <h2 className={css.tieu_de}>Luật rút gọn</h2>
        {/* Bốn dòng này **SUY TỪ `DIEU_CAM`**, không gõ tay *(viết lại 2026-08-24)*.

            Bản cũ là ba dòng viết tay, và cả ba đều sai một kiểu riêng: hai dòng đầu gộp
            bốn điều cấm thành ba nên **rơi mất "cấm link nhóm kín"** — một điều có thật ở
            `/luat`, có chế tài, mà người đọc sidebar không bao giờ thấy. Dòng thứ ba
            ("Ghi lý do trước khi biết kết quả — đó là cả sản phẩm") **không phải một
            luật**: nó là câu quảng cáo nằm nhầm trong hộp luật, và nó chiếm đúng chỗ của
            điều cấm bị rơi.

            Suy từ nguồn thì hai lỗi ấy không tái diễn được: thêm/bớt/sửa điều cấm ở
            `lib/phap-ly.ts` là sidebar đổi theo, không có bản thứ hai để trôi. */}
        <ul className={css.gach_dau_dong}>
          {DIEU_CAM.map((d) => (
            <li key={d.tieu_de}>{d.tieu_de}</li>
          ))}
        </ul>
        <Link className={css.dan} href="/luat" prefetch={false} data-testid="sidebar-dan-luat">
          Đọc luật cộng đồng →
        </Link>
      </section>

      <ChanTrang />
    </aside>
  );
}

