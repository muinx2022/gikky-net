import type { Metadata } from "next";

import { Feed } from "@/components/feed";
import { JsonLd } from "@/components/json-ld";
import { KhoiBaiViet } from "@/components/khoi-bai-viet";
import { VoKhungHaiCot } from "@/components/khung-hai-cot-vo";
import { NutVeDauTrang } from "@/components/nut-ve-dau-trang";
import { Sidebar } from "@/components/sidebar";
import { SO_NHAT_KY_TAI, TrangChuV2 } from "@/components/trang-chu-v2";
import {
  docBinhLuanGoc,
  docBinhLuanGocMoiNhat,
  docCacSub,
  docChuDeTuan,
  docFeed,
  docFeedChuDe,
  docFeedSub,
  docKhoang,
  docLoaiMach,
  docNhatKyMoiTacGia,
  docTab,
  docTrangThai,
  type KhoangFeed,
  type LoaiMach,
  type TabFeed,
  type TrangThaiFeed,
} from "@/lib/api";
import { chonChuDeNoi } from "@/lib/chu-de";
import { jsonLdWebSite } from "@/lib/json-ld";
import { SO_BAI_TAI_MOI_GIA, SO_BAI_VIET_TAI, subLenTrangChu } from "@/lib/nhom-bai-viet";
import { GIOI_THIEU, urlTuyetDoi } from "@/lib/site";

import css from "./trang-chu.module.css";

// Xem ghi chú ở `app/m/[slugId]/page.tsx`: cơ chế cache của PLAN 8.4 là việc của Phase 3.
// Dòng này cũng giữ cho `pnpm build` không cần Django sống.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "gikky.net — Nhật ký giao dịch chứng khoán, phân tích vĩ mô & quản trị vốn",
  description:
    "Mạng xã hội nhật ký giao dịch chứng khoán, tiền mã hoá, dữ liệu kinh tế vĩ mô và quản trị vốn. Ghi nhận nhận định theo thời gian thực minh bạch, lịch sử bất biến.",
  alternates: {
    canonical: urlTuyetDoi("/"),
  },
  openGraph: {
    title: "gikky.net — Nhật ký giao dịch chứng khoán, phân tích vĩ mô & quản trị vốn",
    description:
      "Mạng xã hội nhật ký giao dịch chứng khoán, tiền mã hoá, dữ liệu kinh tế vĩ mô và quản trị vốn. Ghi nhận nhận định theo thời gian thực minh bạch, lịch sử bất biến.",
    url: urlTuyetDoi("/"),
    siteName: "gikky.net",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "gikky.net — Nhật ký giao dịch chứng khoán, phân tích vĩ mô & quản trị vốn",
    description:
      "Mạng xã hội nhật ký giao dịch chứng khoán, tiền mã hoá, dữ liệu kinh tế vĩ mô và quản trị vốn. Ghi nhận nhận định theo thời gian thực minh bạch, lịch sử bất biến.",
  },
};

// ⚠⚠ **KHÔNG có bộ xương (skeleton) lúc tải, và đây là lý do — đo được, không phải cảm
// tính.** Plan giao diện §2.5 đòi *"skeleton thay cho khoảng trắng"*; lượt 2026-08-23 thử
// hai lối và **bỏ cả hai**. Ghi lại đây vì đây là chỗ người tiếp theo sẽ mở ra để làm nó.
//
// **Lối 1 — `app/loading.tsx`.** Nó bọc CẢ NHÁNH ROUTE bên dưới trong một Suspense
// boundary, và route có Suspense thì Next **stream**: `200 OK` đi ngay cùng phần khung,
// nội dung thật đẩy xuống sau. Sau khi header đã gửi, `notFound()` và
// `permanentRedirect()` **không đổi được status nữa** — chúng im lặng thành 200.
// `app/loading.tsx` nằm ở gốc nên phủ mọi route: `/m/<slug sai>-<id>` thôi redirect 301,
// `/m/…-999999999` trả 200 thay vì 404, `/s/<sub không có>` cũng thế.
// **Đo được: 48 bài đo đỏ cùng lúc.**
//
// **Lối 2 — `<Suspense>` chỉ quanh feed của riêng trang này** (`/` là trang duy nhất
// không gọi `notFound()`/`redirect()` bao giờ, nên lối này tránh được vấn đề trên). Nó
// vẫn hỏng, theo một đường khác: SSR streaming để lại **bản sao ẨN** của nội dung boundary
// trong DOM (`<div hidden>`: 1 → 4 trên trang này), nên mỗi `data-testid` bên trong khớp
// **hai** phần tử. Tám bài đo dùng locator strict đỏ theo, và cái hại thật thì không nằm ở
// bài đo: nó là một bản sao DOM mà không ai dọn.
//
// ⇒ Trang chủ chờ xong hai lời gọi rồi mới trả. Nó là `force-dynamic` và hai lời gọi ấy đi
// thẳng Django trong cùng mạng, nên khoảng trắng ngắn. **Muốn làm lại: phải dời
// `app/page.tsx` vào một route group** (`app/(feed)/page.tsx` + `loading.tsx` cùng chỗ) để
// boundary không phủ route khác, **và** đo lại số `<div hidden>` sau khi làm.

// `GIOI_THIEU` dời sang `lib/site.ts` 2026-08-31 (docstring đầy đủ ở đó): khung tĩnh của
// `/luat` cũng cần nó, mà import từ file route này là kéo cả `docFeed`/`docCacSub` vào
// cây module của đường thoát.

// `<h1>` KHÔNG còn là chữ "gikky": tên hiệu đã nằm ở thanh trên cùng của mọi trang, nên in
// lại nó ở đây vừa thừa vừa lấy mất dòng chữ có giá trị nhất của trang chủ đối với người
// mới và với máy tìm kiếm. Nay nó nói **sản phẩm là gì** trong một câu; lede nói **trang này
// liệt kê gì**. Phần "site vận hành ra sao" thuộc về `GIOI_THIEU` ở sidebar — xem docstring
// của hằng ấy.
//
// ⚠ **Hai chuỗi này là SEO, không phải copy**: chúng giữ NGUYÊN chữ qua homepage v2, và
// `e2e/seo-trang-chu.spec.ts` ghim chúng cùng với `metadata` ở trên. Đổi chữ là đổi thứ bot
// đang đọc (GHI-CHU việc 11, "Ràng buộc SEO").
const TIEU_DE = "Nhật ký giao dịch chứng khoán & Luận điểm thị trường";
const LEDE =
  "Ghi nhận nhận định trước khi có kết quả. Mọi mốc đều lưu vết thời gian thực và lịch sử minh bạch.";

/** Có tham số nào của FEED CŨ trên URL không? Có ⇒ `Feed` cũ (nhưng trong khung hai cột);
 * không ⇒ trang v2. Xét **sự có mặt của khoá**, không xét giá trị hợp lệ: `?cursor=rac`,
 * `?tab=abc`, `?loai_mach=abc` đều phải ra feed cũ (và được quy về mặc định / bỏ qua ở
 * `docTab`, `docLoaiMach`, `docFeed`), không phải trang v2 — mọi URL `/?tab=…&khoang=…&
 * cursor=…` bot đã index vẫn trả đúng feed như cũ. Tham số lạ (`?utm_source=…`) thì không
 * tính: nó không phải thứ của feed. */
const KHOA_FEED_CU = [
  "tab",
  "khoang",
  "cursor",
  "truong_phai",
  "loai_mach",
  "trang_thai",
] as const;

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  if (KHOA_FEED_CU.some((k) => q[k] !== undefined)) {
    const tab = docTab(q.tab);
    const khoang = docKhoang(q.khoang);
    const cursor = Array.isArray(q.cursor) ? q.cursor[0] : q.cursor;
    const truongPhai = typeof q.truong_phai === "string" ? q.truong_phai : undefined;
    const loaiMach = docLoaiMach(q.loai_mach);
    const trangThai = docTrangThai(q.trang_thai);
    return (
      <FeedDaNap
        tab={tab}
        khoang={khoang}
        cursor={cursor}
        truongPhai={truongPhai}
        loaiMach={loaiMach}
        trangThai={trangThai}
      />
    );
  }
  return <TrangChuMoi />;
}

/** Trang v2: các lời gọi API + danh sách chuyên mục chạy **song song** (`Promise.all`) — KHÔNG
 * `<Suspense>`/`loading.tsx` (docstring dài ở trên đã đo là vỡ 48 bài). Mỗi lời gọi ném khi API
 * hỏng cấu trúc, nên "chưa có nhật ký" chỉ được nói khi Django thật sự trả 0.
 *
 * - Nhật ký: endpoint RIÊNG, **mỗi tác giả một bài** (bài có `published_at` lớn nhất), tải
 *   `SO_NHAT_KY_TAI` tác giả — 8 thẻ đầu vẽ ra, phần còn lại nuôi dải chân khối (xem
 *   `lib/chan-khoi-nhat-ky.ts`). "Xem tất cả" đi tới feed `moi` không lọc.
 * - Chủ đề + quan điểm nổi bật: lời gọi bình luận cần `id` của chủ đề được chọn
 *   (`chonChuDeNoi`), nên nó nối đuôi lời gọi chủ đề BÊN TRONG một phần tử của `Promise.all`
 *   — vẫn song song với các lời gọi khác, không thêm một vòng chờ ở ngoài.
 * - Bài viết: MỘT lời gọi `SO_BAI_VIET_TAI` bài cho dải Mới đăng + bản tin (chọn ở web,
 *   `lib/nhom-bai-viet.ts`), và MỖI giá sách một lời gọi riêng `docFeedSub` — sub nào lên giá
 *   là dữ liệu (`vi_tri_trang_chu` trong `GET /subs`, admin đặt), nên các lời gọi ấy phải chờ
 *   danh sách sub: chúng nối đuôi `docCacSub()` BÊN TRONG một phần tử của `Promise.all` (cùng
 *   mẫu chủ đề + quan điểm). Gọi theo từng sub (không lọc từ cửa sổ 50 bài) để sub đăng chậm
 *   vẫn có bài. `null` (404, sub vừa bị xoá) ⇒ giá rỗng ⇒ ẩn. */
async function TrangChuMoi() {
  const [nhat_ky, chu_de_va_quan_diem, bai_viet, sub_va_gia] = await Promise.all([
    docNhatKyMoiTacGia(SO_NHAT_KY_TAI),
    // Cùng lời gọi với khối "Chủ đề tuần này" ở rail các trang khác (`docFeedChuDe`), nên hai
    // nơi luôn chọn CÙNG một chủ đề. Ở đây nó ném khi API hỏng (vá F1); ở rail thì không.
    docFeedChuDe().then(async (chu_de) => {
      const [chon] = chonChuDeNoi(chu_de.items);
      // Hai nguồn song song (không thêm vòng chờ): `hay_nhat` quyết "nổi bật", `moi_nhat` nuôi
      // "mới" — xem `lib/chu-de.ts::chonQuanDiem`.
      const [binh_luan_goc, binh_luan_moi] =
        chon === undefined
          ? [[], []]
          : await Promise.all([docBinhLuanGoc(chon.id), docBinhLuanGocMoiNhat(chon.id)]);
      return { chu_de, binh_luan_goc, binh_luan_moi };
    }),
    docFeed("moi", { limit: SO_BAI_VIET_TAI, loai_mach: "bai_viet" }),
    docCacSub().then(async (cac_sub) => ({
      cac_sub,
      gia: await Promise.all(
        subLenTrangChu(cac_sub).map(async (sub) => {
          const trang = await docFeedSub(sub.slug, "moi", {
            limit: SO_BAI_TAI_MOI_GIA,
            loai_mach: "bai_viet",
          });
          return { sub, items: trang.du_lieu?.items ?? [] };
        }),
      ),
    })),
  ]);
  const { cac_sub, gia } = sub_va_gia;

  return (
    <>
      <JsonLd duLieu={jsonLdWebSite()} />
      {/* Khung hai cột chứa dòng giới thiệu + chủ đề + nhật ký; section "Bài viết" đứng NGOÀI
          khung (dưới cả rail) nên là anh em của nó. `css.vo`: trên điện thoại "Bài viết" HIỆN
          trước rail bằng CSS, DOM giữ thứ tự này (đợt M, M7 — `trang-chu.module.css`). */}
      {/* Rail của `/` KHÔNG có khối "Chủ đề tuần này" (đã có khối tiêu điểm ngay trong trang) và
          KHÔNG có dòng phụ của khối khách: câu "Có thể ghi riêng tư, công khai khi bạn muốn." đã
          nằm trong ô soạn nhanh cùng trang (việc 14, đợt E — plan §4.7 "Bớt lặp"). */}
      <div className={css.vo} data-testid="trang-chu-v2">
        <VoKhungHaiCot
          sidebar={
            <Sidebar
              gioiThieu={GIOI_THIEU}
              cacSub={cac_sub}
              khachTieuDe="Bắt đầu nhật ký của bạn"
            />
          }
        >
          <TrangChuV2
            tieuDe={TIEU_DE}
            lede={LEDE}
            chuDe={chu_de_va_quan_diem.chu_de}
            quanDiemGoc={chu_de_va_quan_diem.binh_luan_goc}
            quanDiemMoi={chu_de_va_quan_diem.binh_luan_moi}
            nhatKy={nhat_ky}
            bayGio={new Date()}
          />
        </VoKhungHaiCot>
        <KhoiBaiViet bai_viet={bai_viet.du_lieu.items} cac_sub={cac_sub} gia={gia} />
      </div>
      <NutVeDauTrang />
    </>
  );
}

async function FeedDaNap({
  tab,
  khoang,
  cursor,
  truongPhai,
  loaiMach,
  trangThai,
}: {
  tab: TabFeed;
  khoang: KhoangFeed;
  cursor: string | undefined;
  truongPhai: string | undefined;
  loaiMach: LoaiMach | undefined;
  trangThai: TrangThaiFeed | undefined;
}) {
  // `?cursor=rac` KHÔNG được làm trang chủ 500: `docFeed` lùi về trang đầu và trả cờ để
  // `Feed` hiện dòng giải thích (vá A1).
  //
  // Còn API hỏng thì trang này PHẢI hỏng theo: `docFeed` (bản không lọc sub) ném thay vì
  // trả `null`, nên ở đây không còn gì để `?? { items: [] }` — xem docstring của nó, vá
  // F1. "Chưa có bài nào ở đây" chỉ được nói khi Django thật sự trả về 0 mạch.
  // `docChuDeTuan` (khối "Chủ đề tuần này" của rail) KHÔNG ném: hỏng thì khối ẩn — xem docstring.
  const [{ du_lieu: feed, cursorHong }, cac_sub, chu_de_tuan] = await Promise.all([
    docFeed(tab, {
      cursor,
      khoang,
      truong_phai: truongPhai,
      loai_mach: loaiMach,
      trang_thai: trangThai,
    }),
    docCacSub(),
    docChuDeTuan(new Date()),
  ]);

  return (
    <>
      <JsonLd duLieu={jsonLdWebSite()} />
      <Feed
        feed={feed}
        cursorHong={cursorHong}
        tab={tab}
        khoang={khoang}
        coBan="/"
        truongPhai={truongPhai}
        loaiMach={loaiMach}
        trangThai={trangThai}
        tieuDe={TIEU_DE}
        lede={LEDE}
        // Khối khách dùng tiêu đề của trang chủ ("Bắt đầu nhật ký của bạn") ở MỌI trang `/?…`
        // (việc 14, đợt C). KHÔNG truyền `khachMoTa`: câu "Có thể ghi riêng tư, công khai khi bạn
        // muốn." đã nằm trong ô soạn nhanh của trang lọc nhật ký — lặp nó ở rail là in hai lần
        // trên cùng một trang.
        sidebar={
          <Sidebar
            gioiThieu={GIOI_THIEU}
            cacSub={cac_sub}
            chuDeTuan={chu_de_tuan}
            khachTieuDe="Bắt đầu nhật ký của bạn"
          />
        }
      />
    </>
  );
}
