import type { FeedOut } from "@gikky/api-client";
import { Clock, Flame, Radio, type LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  KHOANG_FEED,
  KHOANG_MAC_DINH,
  NHAN_KHOANG,
  NHAN_LOAI_MACH,
  NHAN_TAB,
  NHAN_TRANG_THAI_FEED,
  TAB_FEED,
  tabCoKhoang,
  trangThaiGuiLenApi,
  type KhoangFeed,
  type LoaiMach,
  type TabFeed,
  type TrangThaiFeed,
} from "@/lib/api";
import { TEN_THUONG_LOAI_MACH, hrefChipLoai } from "@/lib/loc-loai-mach";

import { BaoCursorHong } from "./bao-cursor-hong";
import { CuonVoHan } from "./cuon-vo-han";
import css from "./feed.module.css";
import { VoKhungHaiCot } from "./khung-hai-cot-vo";
import { LocLoaiMach } from "./loc-loai-mach";
import { NutVeDauTrang } from "./nut-ve-dau-trang";
import { TheMach } from "./the-mach";

/** Feed ba tab — PLAN 5.9 (Mới · Đang diễn ra) + plan con 1d §2.5.4 ("Nhiều điểm nhất").
 *
 * **"Đang diễn ra" KHÔNG phải "Hot".** Nó sort theo `last_entry_at`, tức theo lúc tác
 * giả nối mốc, chứ không theo lượng tương tác. PLAN mục 4 đã loại hẳn cơ chế "mốc mới
 * bump bài lên feed Hot" vì động cơ ngược: tác giả băm "chốt 1/3" thành 3 mốc để ăn 3
 * lượt đẩy. Đừng thêm bất cứ trọng số nào vào đây.
 *
 * **"Nhiều điểm nhất" cũng không phải Hot**: khoá của nó là điểm **bài gốc**, con số mà
 * nối thêm mốc không đụng tới — xem `lib/api.ts::TAB_FEED`.
 *
 * **Tab, khoảng và cursor của TRANG ĐẦU nằm trên URL** chứ không trong state: feed là thứ
 * người ta gửi link cho nhau, và PLAN nguyên tắc 7 cấm "tự đổi sort ngầm dưới tay người
 * dùng" — không có state ẩn thì không có chỗ nào để đổi ngầm.
 *
 * ⚠ **Từ 2026-09-03 có một ngoại lệ, và nó phải được nói ra**: những trang nối thêm bằng
 * CUỘN VÔ HẠN (`CuonVoHan`) sống trong state client, không lên URL. Câu "toàn bộ trạng
 * thái nằm trên URL" ở bản trước vì thế không còn đúng nguyên văn.
 *
 * Vì sao vẫn không phá nguyên tắc 7: nguyên tắc ấy cấm đổi ngầm **CÁI GÌ** được bày —
 * sort, bộ lọc. Cuộn vô hạn không đụng tab/khoảng/sort, nó chỉ đổi **BAO NHIÊU** đã bày,
 * và đổi vì chính người dùng cuộn xuống. Mở lại link vẫn ra đúng feed ấy, chỉ là từ đầu.
 * Không có gì ẩn: danh sách dài ra ngay trước mắt người làm nó dài ra.
 *
 * **Đổi tab thì RỚT `cursor`, và giữ `khoang`.** Cursor mang khoá sort của tab sinh ra nó
 * (API trả 400 `cursor_khong_hop_le` nếu đem sang tab khác), nên tha nó theo là biến một
 * cú bấm tab thành một trang lỗi. `khoang` thì không dính khoá nào — người đang xem "top
 * tuần" bấm sang tab khác rồi quay lại mà mất mốc thời gian là mất đúng thứ họ vừa chọn.
 *
 * **`khoang` đi theo URL ở MỌI tab, kể cả tab không bày ra nó** *(vá V2, 2026-08-22)*.
 * Bản đầu hỏi `tabCoKhoang(t)` của tab ĐÍCH ngay trong `duoi()`, nên `khoang` chỉ sống
 * sót khi tab đích là `nhieu-diem` — tức chỉ khi KHÔNG đổi tab, đúng ngược lại kịch bản
 * mà câu trên nói nó bảo vệ. Vòng `nhieu-diem&khoang=tuan` → `moi` → `nhieu-diem` rơi về
 * `tat_ca`.
 * ⚠ Mang theo URL **không phải** là gửi lên API: `lib/api.ts::khoangGuiLenApi` cắt
 * `khoang` ở tab không có control chọn khoảng. Gửi kèm là dựng một **bộ lọc tàng hình** —
 * feed bị cắt bớt mà trên màn hình không có gì nói ra và không có cách nào tắt, tức đâm
 * PLAN nguyên tắc 7 còn nặng hơn cái lỗi vừa vá.
 */
/** Đầu trang: **hoặc** một `header` riêng, **hoặc** cặp `tieuDe`/`lede` — không bao giờ
 * cả hai *(X9, lượt vá 3)*.
 *
 * Trước X9 cả ba là prop rời và `header` chỉ đơn giản thắng ở chỗ render, nên trang sub
 * truyền đủ ba: `tieuDe={`s/${slug}`}` và `lede={chi_tiet.mo_ta}` **không render ở đâu
 * cả**. Một bản sao thứ hai của `mo_ta` không ai đọc là thứ sẽ lệch khỏi bản thật ở lần
 * sửa sau, và người đọc `page.tsx` không có cách nào biết dòng nào là dòng có tác dụng.
 *
 * Union này biến chuyện đó thành lỗi biên dịch chứ không phải một quy ước: truyền cả hai
 * là `tsc` đỏ ngay tại chỗ gọi. Không thêm bài đo runtime nào cho luật này — kiểu là hàng
 * rào chặt hơn, và `pnpm build` đã chạy `tsc`.
 */
type DauTrang =
  | { header: React.ReactNode; tieuDe?: never; lede?: never }
  | { header?: undefined; tieuDe: string; lede: string };

/** Icon cho từng tab. Đọc từ NGHĨA của tab, không phải trang trí:
 * - `moi` = đồng hồ (mới theo thời gian);
 * - `dang-dien-ra` = sóng radio (đang phát — hợp "đang diễn ra", và cố ý KHÔNG phải ngọn
 *   lửa "hot": tab này sort theo lúc nối mốc, không theo tương tác, xem docstring trên);
 * - `nhieu-diem` = ngọn lửa (điểm cao). */
const ICON_TAB: Readonly<Record<TabFeed, LucideIcon>> = {
  moi: Clock,
  "dang-dien-ra": Radio,
  "nhieu-diem": Flame,
};

export function Feed({
  feed,
  tab,
  khoang,
  coBan,
  sub,
  tieuDe,
  lede,
  cursorHong = false,
  sidebar,
  header,
  truongPhai,
  loaiMach,
  trangThai: trangThaiTho,
}: {
  feed: FeedOut;
  tab: TabFeed;
  khoang: KhoangFeed;
  /** Đường dẫn gốc của feed: `/` hoặc `/s/<sub>`. */
  coBan: string;
  /** Slug sub ở `/s/<sub>`; vắng ở `/`. Cuộn vô hạn cần nó để lời gọi trang 2 lọc đúng
   * tập bài — suy nó ra từ `coBan` bằng cách cắt chuỗi là dựng một bản sao thứ hai của
   * quy tắc đường dẫn (`lib/url.ts::duongDanSub`), và bản sao ấy sẽ lệch. */
  sub?: string;
  /** `?cursor=` không dùng được ⇒ đang hiện trang đầu. Xem `lib/api.ts::TrangCursor`. */
  cursorHong?: boolean;
  /** Cột phải (duy nhất). Bắt buộc có mặt — cả hai trang feed đều dựng nó. */
  sidebar: React.ReactNode;
  /** Bộ lọc trường phái giao dịch trên feed (nếu có). */
  truongPhai?: string;
  /** Lọc theo loại mạch (`?loai_mach=`); vắng = mọi loại. Đi xuyên qua href của tab/khoảng,
   * chip "bỏ lọc" và `CuonVoHan` đúng như `truongPhai` — xem docstring `lib/api.ts::LoaiMach`. */
  loaiMach?: LoaiMach;
  /** Lọc theo trạng thái sổ (`?trang_thai=open|closed`, plan giao diện mới §6.3): tab "Đang mở"
   * / "Đã đóng sổ" của khối nhật ký trang chủ trỏ vào đây. Đi xuyên qua href của tab/khoảng,
   * chip "Bỏ lọc" và `CuonVoHan` đúng như `loaiMach`. Ở tab "Đang diễn ra" (vốn chỉ gồm mạch
   * mở, API không nhận tham số này) nó bị bỏ — xem `trangThaiGuiLenApi`. */
  trangThai?: TrangThaiFeed;
} & DauTrang) {
  const trangThai = trangThaiGuiLenApi(tab, trangThaiTho);
  /** `?khoang=` đi kèm MỌI tab, nhưng chỉ khi khác mặc định: URL sạch thì link chia sẻ
   * đọc được, và `?khoang=tat_ca` không nói thêm gì so với việc thiếu nó.
   *
   * **Không hỏi `tabCoKhoang` ở đây** — xem docstring component. Hỏi nó tại chỗ này là
   * đánh rơi lựa chọn của người dùng ngay lúc họ bấm sang tab khác. Cửa "gửi lên API"
   * đóng ở `lib/api.ts`, không đóng bằng cách xoá tham số khỏi URL. */
  const duoi = (k: KhoangFeed) => (k !== KHOANG_MAC_DINH ? `&khoang=${k}` : "");
  const duoiTruongPhai = truongPhai ? `&truong_phai=${encodeURIComponent(truongPhai)}` : "";
  const duoiLoaiMach = loaiMach ? `&loai_mach=${loaiMach}` : "";
  /** `?trang_thai=` đi theo tab ĐÍCH: tab "Đang diễn ra" không nhận nó (xem
   * `trangThaiGuiLenApi`), nên href của tab ấy bỏ nó thay vì mang một bộ lọc nói dối. */
  const duoiTrangThai = (t: TabFeed) => {
    const tt = trangThaiGuiLenApi(t, trangThaiTho);
    return tt ? `&trang_thai=${tt}` : "";
  };
  const hrefTab = (t: TabFeed) =>
    `${coBan}?tab=${t}${duoi(khoang)}${duoiTruongPhai}${duoiLoaiMach}${duoiTrangThai(t)}`;
  const hrefKhoang = (k: KhoangFeed) =>
    `${coBan}?tab=${tab}${duoi(k)}${duoiTruongPhai}${duoiLoaiMach}${duoiTrangThai(tab)}`;

  /** Trang sub rỗng CHỈ vì bộ lọc loại (không phải vì trường phái hay khoảng thời gian, hai
   * thứ này có câu riêng): nói đúng loại nào trống và chỉ lối về "Tất cả". */
  const rongDoLocLoai =
    sub !== undefined &&
    loaiMach !== undefined &&
    !truongPhai &&
    !(tabCoKhoang(tab) && khoang !== KHOANG_MAC_DINH);

  const noiDung = (
    <>
      {header ?? (
        <>
          <h1 className={css.tieu_de}>{tieuDe}</h1>
          <p className={css.lede}>{lede}</p>
        </>
      )}

      {cursorHong && <BaoCursorHong />}

      {/* Trang chuyên mục (`/s/<sub>`) lẫn cả ba loại mạch: hàng chip lọc loại đứng ngay dưới
          header, trên thanh tab. Chỉ nhánh có `sub` dựng nó — `/` giữ nguyên DOM. */}
      {sub !== undefined && (
        <LocLoaiMach
          coBan={coBan}
          tab={tab}
          khoang={khoang}
          truongPhai={truongPhai}
          loaiMach={loaiMach}
        />
      )}

      {/* Thanh tab feed */}
      <div className={css.thanh_dinh}>
        <div className={css.hang_dieu_khien}>
          <nav className={css.tab} data-testid="tab-feed" aria-label="Sắp xếp feed">
            {TAB_FEED.map((t) => {
              const Hinh = ICON_TAB[t];
              return (
                <Link
                  key={t}
                  href={hrefTab(t)}
                  prefetch={false}
                  className={
                    t === tab ? `${css.mot_tab} ${css.tab_dang_chon}` : css.mot_tab
                  }
                  aria-current={t === tab ? "page" : undefined}
                  title={NHAN_TAB[t]}
                  data-testid={`tab-${t}`}
                >
                  <Hinh size={15} strokeWidth={2} aria-hidden />
                  <span className={css.chu_tab}>{NHAN_TAB[t]}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {tabCoKhoang(tab) && (
          <nav className={css.khoang} data-testid="chon-khoang" aria-label="Khoảng thời gian">
            {KHOANG_FEED.map((k) => (
              <Link
                key={k}
                href={hrefKhoang(k)}
                prefetch={false}
                className={
                  k === khoang ? `${css.mot_khoang} ${css.khoang_dang_chon}` : css.mot_khoang
                }
                aria-current={k === khoang ? "true" : undefined}
                data-testid={`khoang-${k}`}
              >
                {NHAN_KHOANG[k]}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {truongPhai && (
        <div className={css.bo_loc_truong_phai} data-testid="bo-loc-truong-phai">
          <span>
            Trường phái: <strong>#{truongPhai}</strong>
          </span>
          <Link
            href={`${coBan}?tab=${tab}${duoi(khoang)}${duoiLoaiMach}${duoiTrangThai(tab)}`}
            className={css.xoa_bo_loc}
            title="Bỏ lọc trường phái"
            prefetch={false}
          >
            ✕ Bỏ lọc
          </Link>
        </div>
      )}

      {/* Chip loại mạch — cùng khuôn với chip trường phái ngay trên. "Bỏ lọc" giữ nguyên
          trường phái (nếu có): bỏ MỘT bộ lọc thì không được kéo theo bộ lọc kia.
          Trên trang sub (`sub` có mặt) hàng chip `LocLoaiMach` ở trên đã thay nó — hiện cả hai
          là một bộ lọc được báo hai lần. */}
      {loaiMach && sub === undefined && (
        <div className={css.bo_loc_truong_phai} data-testid="bo-loc-loai-mach">
          <span>
            Loại: <strong>{NHAN_LOAI_MACH[loaiMach]}</strong>
          </span>
          <Link
            href={`${coBan}?tab=${tab}${duoi(khoang)}${duoiTruongPhai}${duoiTrangThai(tab)}`}
            className={css.xoa_bo_loc}
            title="Bỏ lọc loại"
            prefetch={false}
          >
            ✕ Bỏ lọc
          </Link>
        </div>
      )}

      {/* Chip trạng thái sổ — cùng khuôn với hai chip trên, và cũng chỉ ở `/` (trang sub chưa
          nhận `?trang_thai=`). "Bỏ lọc" giữ nguyên hai bộ lọc kia. */}
      {trangThai && sub === undefined && (
        <div className={css.bo_loc_truong_phai} data-testid="bo-loc-trang-thai">
          <span>
            Trạng thái: <strong>{NHAN_TRANG_THAI_FEED[trangThai]}</strong>
          </span>
          <Link
            href={`${coBan}?tab=${tab}${duoi(khoang)}${duoiTruongPhai}${duoiLoaiMach}`}
            className={css.xoa_bo_loc}
            title="Bỏ lọc trạng thái"
            prefetch={false}
          >
            ✕ Bỏ lọc
          </Link>
        </div>
      )}

      {feed.items.length === 0 ? (
        <p className={css.rong} data-testid="feed-rong">
          {truongPhai
            ? `Chưa có mạch nào thuộc trường phái #${truongPhai}.`
            : tabCoKhoang(tab) && khoang !== KHOANG_MAC_DINH
              ? "Chưa có bài nào trong khoảng này."
              : rongDoLocLoai && loaiMach
                ? `Chưa có ${TEN_THUONG_LOAI_MACH[loaiMach]} nào trong chuyên mục này.`
                : "Chưa có bài nào ở đây."}
          {rongDoLocLoai && (
            <>
              {" "}
              <Link
                href={hrefChipLoai(coBan, { tab, khoang, truongPhai }, undefined)}
                prefetch={false}
                className={css.xoa_bo_loc}
                data-testid="feed-rong-ve-tat-ca"
              >
                Xem tất cả
              </Link>
            </>
          )}
        </p>
      ) : (
        <ul className={css.danh_sach} data-testid="feed">
          {feed.items.map((m) => (
            <TheMach key={m.id} mach={m} hienNhanLoai={sub !== undefined} />
          ))}
        </ul>
      )}

      {/* Cuộn vô hạn — nhưng cái `<a href="…cursor=…">` VẪN Ở TRONG HTML server-render:
          `CuonVoHan` render đúng cái link ấy rồi mới phủ `IntersectionObserver` lên
          trên. Bot bò được hết feed, người tắt JS vẫn bấm được, fetch lỗi thì lùi về
          đúng hành vi cũ. Xem docstring `cuon-vo-han.tsx`. */}
      <CuonVoHan
        cursorDau={feed.cursor_ke_tiep}
        href={
          feed.cursor_ke_tiep === null
            ? hrefTab(tab)
            : `${hrefTab(tab)}&cursor=${encodeURIComponent(feed.cursor_ke_tiep)}`
        }
        tab={tab}
        khoang={khoang}
        sub={sub}
        truongPhai={truongPhai}
        loaiMach={loaiMach}
        trangThai={trangThai}
      />
    </>
  );

  // Một khung hai cột cho cả web (nội dung + rail phải): `VoKhungHaiCot` lo lưới, thẻ `<main>`
  // và lớp bọc rail — `/`, `/?tab=…` và `/s/<sub>` cùng một lưới với mọi trang khác, nên cột
  // nội dung không nhảy ngang khi điều hướng giữa chúng.
  return (
    <>
      <VoKhungHaiCot sidebar={sidebar}>{noiDung}</VoKhungHaiCot>
      <NutVeDauTrang />
    </>
  );
}
