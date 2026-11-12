import type { FeedOut } from "@gikky/api-client";
import { Clock, Flame, Radio, type LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  KHOANG_FEED,
  KHOANG_MAC_DINH,
  NHAN_KHOANG,
  NHAN_TAB,
  NHAN_TRANG_THAI_FEED,
  TAB_FEED,
  TRANG_THAI_FEED,
  tabCoKhoang,
  trangThaiGuiLenApi,
  type KhoangFeed,
  type LoaiMach,
  type TabFeed,
  type TrangThaiFeed,
} from "@/lib/api";
import {
  cauFeedRong,
  hienHangTrangThai,
  hrefChipLoai,
  hrefTrangThai,
  nhanChipTrangThai,
  tieuDeTrangLoc,
} from "@/lib/loc-loai-mach";

import { BaoCursorHong } from "./bao-cursor-hong";
import { CuonVoHan } from "./cuon-vo-han";
import dai from "./dai-tab.module.css";
import css from "./feed.module.css";
import { VoKhungHaiCot } from "./khung-hai-cot-vo";
import { LocLoaiMach } from "./loc-loai-mach";
import { NutVeDauTrang } from "./nut-ve-dau-trang";
import { NutGhiNhatKyDinhDay, OSoanNhatKy } from "./o-soan-nhat-ky";
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
/** ## Dải điều khiển — BA hàng, mọi mục là `<Link>` thật *(việc 14, đợt C, plan §4.2)*
 *
 * Dùng cho CẢ `/?…` lẫn `/s/<sub>` (trước đó `/` có chip "Loại: … ✕ Bỏ lọc", `/s/*` có hàng chip,
 * và chưa ai lọc được theo trạng thái ở `/s/*`). Từ trên xuống:
 *
 * 1. **Loại** — Tất cả · Nhật ký · Bài viết · Chủ đề (`LocLoaiMach`);
 * 2. **Trạng thái** — Tất cả · Đang mở · Đã đóng sổ, CHỈ khi lọc loại Nhật ký và tab ≠ "Đang diễn
 *    ra" (`hienHangTrangThai`). Cùng class (`dai-tab.module.css`), cùng chữ với dải tab của khối
 *    nhật ký trên trang chủ. Có `?trang_thai=` mà hàng này không hiện thì chip "Trạng thái: …
 *    ✕ Bỏ lọc" ở lại: một bộ lọc đang có hiệu lực không bao giờ tàng hình;
 * 3. **Sắp xếp** — Mới nhất · Đang diễn ra · Nổi bật (+ khoảng ở "Nổi bật"): hàng PHỤ, nhỏ, canh
 *    phải, và là hàng duy nhất dính khi cuộn (desktop).
 *
 * Đổi loại thì RỚT `trang_thai` (`hrefChipLoai`); đổi trạng thái giữ tab/khoảng/trường phái/loại và
 * rớt `cursor` (`hrefTrangThai`).
 *
 * **Ô soạn nhanh** (`OSoanNhatKy`) hiện khi lọc loại Nhật ký, đặt DƯỚI các hàng lọc và ngay trên
 * danh sách: đặt trên hàng Loại thì bấm "Nhật ký" làm cả hàng chip nhảy xuống bằng chiều cao ô
 * soạn — chip là thứ người ta vừa bấm, nó phải đứng yên. Mobile thì nút dính đáy "Ghi nhật ký"
 * (`NutGhiNhatKyDinhDay`, cùng trang chủ): trang lọc là danh sách dài cuộn vô hạn, nút dính đáy
 * theo người đọc suốt trang, còn ô soạn ở đầu trang biến mất sau cú cuộn đầu tiên.
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

  /** Trang sub rỗng CHỈ vì bộ lọc loại / trạng thái (không phải vì trường phái hay khoảng thời
   * gian, hai thứ này có câu riêng): nói đúng loại + trạng thái nào trống và chỉ lối về bước rộng
   * hơn kế tiếp (bỏ trạng thái trước; hết trạng thái mới bỏ loại). */
  const rongDoLocLoai =
    sub !== undefined &&
    (loaiMach !== undefined || trangThai !== undefined) &&
    !truongPhai &&
    !(tabCoKhoang(tab) && khoang !== KHOANG_MAC_DINH);

  /** Trang lọc `/?loai_mach=…` có `<h2>` của chính nó ⇒ tiêu đề thẻ xuống `<h3>` (trang 1 lẫn thẻ
   * nạp thêm), cùng luật khối nhật ký trang chủ: thẻ là con của mục ấy, không ngang cấp với nó. */
  const coH2Loai = sub === undefined && loaiMach !== undefined;

  const noiDung = (
    <>
      {header ?? (
        <>
          <h1 className={css.tieu_de}>{tieuDe}</h1>
          <p className={css.lede}>{lede}</p>
        </>
      )}

      {cursorHong && <BaoCursorHong />}

      {/* `<h2>` theo loại đang lọc — chỉ `/?…` (trang lọc cần một câu nói "đây là trang gì"); `/s/*`
          đã có header riêng. Đứng NGAY sau lede nên lede vẫn là `<p>` đầu tiên sau `<h1>`. */}
      {coH2Loai && loaiMach !== undefined && (
        <h2 className={css.tieu_loai} data-testid="feed-tieu-de-loai">
          {tieuDeTrangLoc(tab, loaiMach, trangThai)}
        </h2>
      )}

      {/* Hàng 1 — Loại. Hiện ở CẢ `/?…` và `/s/<sub>`: nó thay chip "Loại: … ✕ Bỏ lọc" cũ của `/`. */}
      <LocLoaiMach
        coBan={coBan}
        tab={tab}
        khoang={khoang}
        truongPhai={truongPhai}
        loaiMach={loaiMach}
      />

      {/* Hàng 2 — Trạng thái sổ (chỉ nhật ký, chỉ tab nhận `trang_thai`). Cùng class với dải tab
          của khối nhật ký trang chủ. */}
      {hienHangTrangThai(tab, loaiMach) && (
        <nav className={dai.tab} aria-label="Lọc theo trạng thái" data-testid="loc-trang-thai">
          {[undefined, ...TRANG_THAI_FEED].map((tt) => (
            <Link
              key={tt ?? "tat-ca"}
              href={hrefTrangThai(coBan, { tab, khoang, truongPhai, loaiMach }, tt)}
              prefetch={false}
              className={tt === trangThai ? `${dai.mot_tab} ${dai.tab_dang_chon}` : dai.mot_tab}
              aria-current={tt === trangThai ? "true" : undefined}
              data-testid={`loc-trang-thai-${tt ?? "tat-ca"}`}
            >
              {tt === undefined ? "Tất cả" : NHAN_TRANG_THAI_FEED[tt]}
            </Link>
          ))}
        </nav>
      )}

      {/* Hàng 3 — Sắp xếp (+ khoảng). Nhãn nhỏ bên trái, các tab canh phải. */}
      <div className={css.thanh_dinh}>
        <div className={css.hang_dieu_khien}>
          <span className={css.nhan_sap_xep} aria-hidden="true">
            Sắp xếp
          </span>
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

      {/* Chip trạng thái sổ — CHỈ khi hàng Trạng thái không hiện (URL cũ kiểu `/?tab=moi&trang_thai=
          open`, hoặc loại khác nhật ký): bộ lọc đang có hiệu lực luôn phải hiện ra. Khi loại là
          nhật ký, hàng 2 đã báo nó (mục `aria-current`), hiện thêm chip là báo hai lần. "Bỏ lọc"
          giữ nguyên các bộ lọc kia. */}
      {trangThai && !hienHangTrangThai(tab, loaiMach) && (
        <div className={css.bo_loc_truong_phai} data-testid="bo-loc-trang-thai">
          <span>
            Trạng thái: <strong>{nhanChipTrangThai(loaiMach, trangThai)}</strong>
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

      {loaiMach === "nhat_ky" && <OSoanNhatKy />}

      {feed.items.length === 0 ? (
        <p className={css.rong} data-testid="feed-rong">
          {truongPhai
            ? `Chưa có mạch nào thuộc trường phái #${truongPhai}.`
            : tabCoKhoang(tab) && khoang !== KHOANG_MAC_DINH
              ? "Chưa có bài nào trong khoảng này."
              : rongDoLocLoai
                ? cauFeedRong(loaiMach, trangThai)
                : "Chưa có bài nào ở đây."}
          {rongDoLocLoai && (
            <>
              {" "}
              <Link
                href={
                  trangThai !== undefined
                    ? hrefTrangThai(coBan, { tab, khoang, truongPhai, loaiMach }, undefined)
                    : hrefChipLoai(coBan, { tab, khoang, truongPhai }, undefined)
                }
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
            <TheMach key={m.id}
              mach={m}
              hienNhanLoai={sub !== undefined}
              capHeading={coH2Loai ? 3 : 2}
            />
          ))}
        </ul>
      )}

      {/* Cuộn vô hạn — nhưng cái `<a href="…cursor=…">` VẪN Ở TRONG HTML server-render:
          `CuonVoHan` render đúng cái link ấy rồi mới phủ `IntersectionObserver` lên
          trên. Bot bò được hết feed, người tắt JS vẫn bấm được, fetch lỗi thì lùi về
          đúng hành vi cũ. Xem docstring `cuon-vo-han.tsx`. */}
      {/* `key` = URL trang 1 của BỘ LỌC hiện tại (coBan/sub, tab, khoảng, trường phái, loại, trạng
          thái hiệu lực — đúng những gì `hrefTab` ghép). Đổi bộ lọc bằng điều hướng client ⇒ remount:
          bài đã nạp thêm của bộ lọc cũ và fetch đang bay của nó bị bỏ. Không có key thì component
          chỉ reset theo `cursorDau`, mà cursor API chỉ mã hoá VỊ TRÍ bài cuối (không mang bộ lọc):
          hai bộ lọc có trang 1 cùng kết thúc ở một bài ⇒ cùng cursor ⇒ thẻ của bộ lọc cũ ở lại dưới
          `<h2>` của bộ lọc mới (vòng sửa 2 của đợt C, tái hiện được trên `gikky_e2e`). */}
      <CuonVoHan
        key={hrefTab(tab)}
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
        capHeading={coH2Loai ? 3 : 2}
      />

      {loaiMach === "nhat_ky" && <NutGhiNhatKyDinhDay />}
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
