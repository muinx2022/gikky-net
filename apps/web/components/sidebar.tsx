import type { MachTomTatOut, SubChiTietOut } from "@gikky/api-client";
import Link from "next/link";

import { dongSoMachSub } from "@/lib/dinh-dang";
import { hrefLoaiTrongSub } from "@/lib/loc-loai-mach";
import { DIEU_CAM } from "@/lib/phap-ly";
import { duongDanMach, duongDanSub } from "@/lib/url";

import { ChanTrang } from "./chan-trang";
import { ChuyenMucTuTrinhDuyet } from "./chuyen-muc-tu-trinh-duyet";
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
 * 2. luật rút gọn dẫn `/luat` — PLAN 5.10 bắt mọi trang công khai phải có đường tới đó,
 *    và chân trang một mình thì ở dưới quá xa để ai đọc;
 * 3. danh sách các sub — **vắng mặt hẳn khi `cacSub` rỗng** *(2026-08-31)*. Một hộp mang
 *    tiêu đề "Chuyên mục" mà không có chuyên mục nào là biển chỉ đường chết: nó chiếm chỗ
 *    và hứa một lối đi không tồn tại. Đây cũng là điều kiện để `KhungHaiCotTinh` dùng lại
 *    đúng `Sidebar` này với `cacSub={[]}` thay vì chế một sidebar thứ hai.
 *    **Có ở MỌI trang có rail** *(hai cột toàn site, 2026-11-10)*: cột trái từng đặt 13 link
 *    `/s/*` + `/luat` trên mọi trang (bot vào trang mạch ~12.000 lượt / 30 ngày); bỏ cột trái
 *    mà không chuyển danh sách vào đây là bớt link nội bộ từ mọi bài.
 *    Trang TĨNH (`/luat`) không có `cacSub` từ server: truyền `chuyenMucTuTrinhDuyet` để khối
 *    tự nạp ở trình duyệt (`ChuyenMucTuTrinhDuyet`) — xem `khung-hai-cot-tinh.tsx`;
 * 4. bài mới nhất — **vắng mặt hẳn khi `baiMoi` rỗng** *(2026-09-10)*. Lấp khoảng trống
 *    ở rail phải khi xem trang chi tiết mạch `/m/[slugId]` và các trang dùng `KhungHaiCot`.
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
  chuyenMucTuTrinhDuyet = false,
  khachTieuDe,
  khachMoTa,
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
  /** Tiêu đề khối bài mới: "Bài mới nhất" hoặc "Cùng chuyên mục" (khi ở trang mạch). */
  tieuDeBaiMoi?: string;
  /** Chỉ cho trang TĨNH không có `cacSub` từ server (`/luat`): khối "Chuyên mục" tự nạp
   * danh sách ở trình duyệt. Vô nghĩa khi `cacSub` đã có. */
  chuyenMucTuTrinhDuyet?: boolean;
  /** Tiêu đề + dòng phụ riêng của khối khách — chỉ trang chủ truyền ("Bắt đầu nhật ký của
   * bạn", plan giao diện mới §3.4); các trang khác để trống ⇒ "Tham gia Gikky.net". */
  khachTieuDe?: string;
  khachMoTa?: string;
}) {
  return (
    <aside className={css.cot} data-testid="sidebar" aria-label="Thanh bên">
      <KhoiKhach tieuDe={khachTieuDe} moTa={khachMoTa} />

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
                `/s/*` của API. Cùng kiểu link `dan` của khối luật. */}
            <Link
              className={css.dan}
              href="/chu-de"
              prefetch={false}
              data-testid="sidebar-dan-chu-de"
            >
              Chủ đề thảo luận →
            </Link>
          </section>
        )
      )}

      {cacSub.length > 0 ? (
        <KhoiChuyenMuc cacSub={cacSub} />
      ) : (
        chuyenMucTuTrinhDuyet && <ChuyenMucTuTrinhDuyet />
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

      {baiMoi && baiMoi.length > 0 && (
        <section className={css.khoi} data-testid="sidebar-bai-moi">
          <h2 className={css.tieu_de}>{tieuDeBaiMoi}</h2>
          <ul className={css.danh_sach_bai_moi}>
            {baiMoi.map((m) => (
              <li key={m.id} className={css.muc_bai_moi}>
                <Link
                  className={css.link_bai_moi}
                  href={duongDanMach(m.slug, m.id)}
                  prefetch={false}
                >
                  <span className={css.tieu_de_bai_moi}>{m.title}</span>
                  <span className={css.meta_bai_moi}>
                    <span className={`${css.slug_bai_moi} mono`}>s/{m.sub.slug}</span>
                    {m.entry_count > 1 && (
                      <>
                        <span className={css.cham_phan_cach}>·</span>
                        <span>{m.entry_count} mốc</span>
                      </>
                    )}
                    {m.comment_count > 0 && (
                      <>
                        <span className={css.cham_phan_cach}>·</span>
                        <span>{m.comment_count} bình luận</span>
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ChanTrang />
    </aside>
  );
}

