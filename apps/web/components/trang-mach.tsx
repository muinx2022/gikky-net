import type {
  BinhLuanOut,
  KhanDaiOut,
  MachChiTietOut,
  NganKeoOut,
} from "@gikky/api-client";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { BaoCursorHong } from "@/components/bao-cursor-hong";
import { ChanDongSo } from "@/components/chan-dong-so";
import { DaiGapBung } from "@/components/dai-gap";
import { JsonLd } from "@/components/json-ld";
import { KhanDai } from "@/components/khan-dai";
import { KhungHaiCot } from "@/components/khung-hai-cot";
import { HanhDongMod } from "@/components/hanh-dong-mod";
import { NutBaoCaoMach } from "@/components/nut-bao-cao-mach";
import { KhoiChuMach } from "@/components/khoi-chu-mach";
import { LoiMoiDoiMat } from "@/components/loi-moi-doi-mat";
import { MachProvider } from "@/components/mach-ngu-canh";
import { MatBao } from "@/components/mat-bao";
import { NganKeoProvider } from "@/components/ngan-keo";
import { NutTheoMach } from "@/components/nut-theo-mach";
import { TheMoc } from "@/components/the-moc";
import { TrangThaiToiProvider } from "@/components/trang-thai-toi";
import {
  docCauDangDoc,
  docKhanDai,
  docMach,
  docNganKeo,
  type ChinhSachDoc,
  type TrangCursor,
} from "@/lib/api";
import { nenHienSoDem } from "@/lib/dem";
import {
  nhanDaiGap,
  tinhDaiGap,
  tongBinhLuanTrongDai,
  trongDaiGap,
  type DaiGap,
} from "@/lib/dai-gap";
import { diemCoDau, ngayCuaThoiDiem } from "@/lib/dinh-dang";
import { jsonLdMach } from "@/lib/json-ld";
import {
  HIEN_KHOI_DANG_CHU_Y,
  docSort,
  idTrongTrangGop,
  type SortKhanDai,
} from "@/lib/khan-dai";
import { docView, matDeRender } from "@/lib/mat";
import { chonMoiBung, idDaTrich } from "@/lib/moi-bung";
import { urlTuyetDoi } from "@/lib/site";
import { TRAN_NGAN_KEO, chayCoTran } from "@/lib/song-song";
import { duongDanHoSo, duongDanMach, duongDanSub, tachSlugId } from "@/lib/url";

import { Composer } from "./composer";
import css from "./trang-mach.module.css";

/** Thân trang mạch — **dùng chung cho CẢ HAI biến thể route** của PLAN 8.4 điểm 1.
 *
 * ```
 * app/m/[slugId]/page.tsx        doc="isr"        ← khách, không cookie phiên
 * app/m-phien/[slugId]/page.tsx  doc="tuoi-song"  ← middleware rewrite tới khi CÓ cookie
 * ```
 *
 * Hai route, một thân bài. Chép thân bài ra hai chỗ là hai bản sẽ trôi khỏi nhau, và bản
 * trôi sẽ là bản của người đăng nhập — nó chạy ít hơn ở mọi phép đo tự động.
 *
 * ## Vì sao phải là hai ROUTE chứ không phải một
 *
 * App Router hễ đọc `cookies()` là **cả route** thành dynamic, nên không tồn tại kiểu
 * "cùng route, khách ăn cache, người đăng nhập ăn dynamic". PLAN 8.4 chốt cách vòng qua:
 * `middleware.ts` nhìn **sự tồn tại** của cookie phiên (không validate) rồi rewrite nội
 * bộ sang biến thể thứ hai. URL trên thanh địa chỉ không đổi.
 *
 * ⚠ **Hai file page phải sống hoặc chết CÙNG NHAU.** `middleware.ts` một mình thì tệ hơn
 * không có: nó rewrite sang một biến thể không tồn tại ⇒ trang mạch 404 với đúng những
 * người đã đăng nhập.
 *
 * ## Không một trường per-user nào đi qua đây
 *
 * `docMach` và bạn bè gọi Django **không kèm cookie**, ở cả hai biến thể. Phiếu của tôi,
 * đã theo chưa, đọc tới đâu — tất cả đến sau, ở client, qua `TrangThaiToiProvider`. Biến
 * thể `"tuoi-song"` khác biến thể kia đúng một thứ: **độ tươi của dữ liệu công khai**
 * (người vừa nối mốc phải thấy mốc của mình ngay), không phải nội dung.
 */

type Query = Record<string, string | string[] | undefined>;

function motChuoi(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function nap(slugId: string, doc: ChinhSachDoc) {
  const tach = tachSlugId(slugId);
  if (tach === null) notFound();
  const mach = await docMach(tach.id, doc);
  if (mach === null) notFound();
  return { mach, slugTrenUrl: tach.slug };
}

/** `<meta description>` theo mạch. Ưu tiên `ket_qua` vì đó là câu tóm tắt do chính tác
 * giả viết khi đóng sổ (PLAN 5.1); không có thì lấy đoạn đầu của mốc 1. */
export function tomTat(mach: MachChiTietOut): string {
  const dau = mach.ket_qua ? `${mach.ket_qua} · ` : "";
  const than = mach.mocs.find((m) => m.seq === 1)?.body ?? "";
  const gon = than.replace(/\s+/g, " ").trim().slice(0, 150);
  return `${dau}${mach.entry_count} mốc · ${gon}${gon.length >= 150 ? "…" : ""}`;
}

/** Metadata dùng chung cho cả hai biến thể route.
 *
 * `canonical` luôn trỏ `/m/<slug>-<id>` — kể cả khi biến thể đang chạy là `/m-phien/…`.
 * Đó là URL công khai duy nhất; `/m-phien/` là đích của một rewrite nội bộ và
 * `app/robots.ts` cấm bot đi vào đó.
 */
export async function metadataMach(slugId: string, doc: ChinhSachDoc) {
  const { mach } = await nap(slugId, doc);
  const duong_dan = duongDanMach(mach.slug, mach.id);
  const mo_ta = tomTat(mach);
  return {
    title: mach.title,
    description: mo_ta,
    alternates: { canonical: urlTuyetDoi(duong_dan) },
    openGraph: {
      type: "article" as const,
      title: mach.title,
      description: mo_ta,
      url: urlTuyetDoi(duong_dan),
    },
  };
}

export async function TrangMach({
  slugId,
  q,
  doc,
}: {
  slugId: string;
  q: Query;
  doc: ChinhSachDoc;
}) {
  const { mach, slugTrenUrl } = await nap(slugId, doc);

  // PLAN 5.9: `id` bền, slug đổi được ⇒ slug lệch thì redirect về dạng chuẩn, GIỮ NGUYÊN
  // `id`. Query string đi theo, nếu không thì người bấm link chia sẻ tới khán đài đang
  // mở sẽ rơi về đầu trang sau redirect.
  //
  // Đích luôn là `/m/…` (URL công khai), kể cả khi biến thể đang chạy là `/m-phien/…`:
  // người dùng không bao giờ được thấy đường dẫn nội bộ trên thanh địa chỉ.
  if (slugTrenUrl !== mach.slug) {
    const cq = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
      if (typeof v === "string") cq.set(k, v);
      else if (Array.isArray(v) && v[0] !== undefined) cq.set(k, v[0]);
    }
    const duoi = cq.toString();
    permanentRedirect(duongDanMach(mach.slug, mach.id) + (duoi ? `?${duoi}` : ""));
  }

  const sort = docSort(q.sort);
  const mat = matDeRender(mach, docView(q.view));
  const la_bao = mat === "bao";
  const cursor = motChuoi(q.cursor);

  // `?offset=` cùng một hạng với `?cursor=`: nó là chuỗi người ta sửa được bằng tay, và
  // "URL nói trang 3, trang hiện trang 1" mà im lặng thì không ai lần ra. Rác quy về 0
  // **và bật cờ** để nói ra (vá A1).
  const offset_tho = motChuoi(q.offset);
  const offset_so = offset_tho === undefined ? 0 : Number(offset_tho);
  const offset_dung = Number.isSafeInteger(offset_so) && offset_so >= 0;
  const offset = offset_dung ? offset_so : 0;
  const offset_hong = offset_tho !== undefined && !offset_dung;

  const la_mach = mach.entry_count >= 2;
  const hien_so_dem = nenHienSoDem(mach.comment_count);
  const dai = tinhDaiGap(mach.entry_count);
  const co_trich = mach.mocs.some((m) => m.trich !== null);

  // Trang 1 của `hay_nhat` chỉ nạp khi có việc cần tới nó (vá C6 — bản đầu gọi vô điều
  // kiện, tức mọi post thường tốn thừa một lời gọi). Nay còn **một** việc:
  //
  // - **deep-link của khối trích** — nửa KHÁN ĐÀI của `idTrongTrangGop`, xem
  //   `duong_dan_trich` bên dưới.
  //
  // (**Mồi bung** từng là việc thứ hai. Từ §G nó ăn `lat_cat` chứ không ăn khán đài nữa —
  // xem `threadsTrongDai`. `dai.gap` vẫn ở lại trong điều kiện vì một mạch có dải gập gần
  // như luôn có trích, và giữ nó cho `id_trong_trang` đủ nửa khán đài ở trang đầu.)
  const can_hay_nhat = dai.gap || co_trich || sort === "hay_nhat";
  const hay_nhat = can_hay_nhat
    ? (await docKhanDai(mach.id, "hay_nhat", doc)).du_lieu
    : null;

  // Trang khán đài ĐANG HIỆN — **luôn nạp** *(user chốt 2026-08-24)*.
  //
  // Tới hôm ấy mặt CẶN giấu bình luận sau một cú bấm (`?khan_dai=1`) và lời gọi này chỉ
  // chạy khi đã bấm. Nay khán đài mở sẵn ở CẢ HAI mặt, vì hai lý do: người đọc một mạch
  // đã đóng phải bấm mới thấy phần cộng đồng nói gì về kết quả — đúng thứ họ tới để đọc;
  // và mặt CẶN là mặt Google index, giấu nội dung sau một URL khác là tự cắt đi phần lớn
  // thứ mình muốn được index. `?khan_dai=1` **vẫn nhận** và nay là no-op, nên link đã
  // chia sẻ và `hrefSort` không gãy.
  //
  // Cái giá: một lời gọi Django nữa cho mọi lượt xem mặt CẶN. Với `doc = "isr"` nó nằm
  // trong data cache của Next (PLAN 8.4) nên chỉ chạm Django một lần mỗi giờ.
  //
  // `| null` viết TƯỜNG MINH (vá F1): `TrangCursor<T>` không còn tự thêm `null` vào mọi
  // lời gọi. Ở đây `null` có nghĩa thật — `liet_ke_binh_luan_mach` trả 404 khi mạch biến
  // mất giữa hai lời gọi — nên chỗ này là chỗ được phép khai nullable.
  const trang_dang_xem: TrangCursor<KhanDaiOut | null> =
    sort === "hay_nhat" && offset === 0 && cursor === undefined && hay_nhat !== null
      ? { du_lieu: hay_nhat, cursorHong: false }
      : await docKhanDai(mach.id, sort, doc, { offset, cursor });
  const khan_dai_trang = trang_dang_xem.du_lieu;
  const cursor_hong = trang_dang_xem.cursorHong || offset_hong;

  // "Câu đáng đọc" (PLAN 5.5) — khối của mặt CẶN, và chỉ của mặt CẶN. Ở mặt BÃO khán đài
  // đã là thân bài và mở sẵn, nên một khối "lọc sẵn 10 câu" ngay trên cây đầy đủ là đúng
  // cái bản-sao-của-chính-nó mà ngoại lệ 2026-08-22 loại bỏ.
  //
  // **TẮT từ 2026-08-26** — công tắc + lý do ở `lib/khan-dai.ts::HIEN_KHOI_DANG_CHU_Y`.
  // Cờ đứng TRƯỚC `!la_bao` để nó cũng cắt luôn LỜI GỌI: khối không render thì một lượt
  // `?dang_doc=1` mỗi lần xem mặt CẶN là tiền trả cho JSON không ai đọc.
  const cau_dang_doc =
    HIEN_KHOI_DANG_CHU_Y && !la_bao ? await docCauDangDoc(mach.id, doc) : null;

  // Ngăn kéo nạp sẵn cho MỌI mốc của mạch — kể cả mốc `so_binh_luan === 0` (vá B1: mốc
  // chỉ còn bia mộ vẫn có lát cắt), và kể cả mốc nằm trong dải gập, vì dải gập bung ra
  // ngay tại chỗ chứ không tải lại trang.
  //
  // Nợ `N+1-NGAN-KEO` (`plans/2026-08-22-phase-1d-va3.md` §4) — **trả 2026-08-23 theo
  // đường ISR**: số lời gọi vẫn bằng số MỐC, nhưng với `doc = "isr"` mỗi lời gọi có bản
  // cache riêng, nên chúng chỉ chạm Django một lần mỗi giờ chứ không một lần mỗi người
  // đọc. Xem `lib/api.ts::docNganKeo`.
  //
  // `chayCoTran` thay `Promise.all` (vá E4): số lời gọi không đổi, nhưng chúng không còn
  // ập vào Django cùng một lúc — vẫn cần, vì lượt làm mới cache đầu tiên là lượt thật.
  const lat_cat = new Map<number, NganKeoOut>();
  if (la_mach) {
    const ket_qua = await chayCoTran(mach.mocs, TRAN_NGAN_KEO, (m) =>
      docNganKeo(m.id, doc),
    );
    mach.mocs.forEach((m, i) => {
      const k = ket_qua[i];
      if (k !== null) lat_cat.set(m.seq, k);
    });
  }

  const co_ban = duongDanMach(mach.slug, mach.id);
  const duong_dan_khan_dai = `${co_ban}?khan_dai=1&sort=${sort}`;
  const hrefSort = (s: SortKhanDai) =>
    la_bao ? `${co_ban}?view=bao&sort=${s}#khan-dai` : `${co_ban}?khan_dai=1&sort=${s}#khan-dai`;

  // **Deep-link của khối trích tính trạng thái trên ĐÚNG TRANG mà nó dẫn tới** (vá B3),
  // và "trang ấy" từ 2026-08-26 có **hai** khu render bình luận chứ không còn một. Công
  // thức hợp nằm ở `lib/khan-dai.ts::idTrongTrangGop` — nó là luật, không phải hai dòng
  // tiện tay, nên nó ở chỗ don-vi ghim được (§D3). `lat_cat` đã nạp sẵn cho mọi mốc ở
  // trên, nên phép hợp này **không thêm lời gọi API nào**.
  const duong_dan_trich = `${co_ban}?khan_dai=1&sort=hay_nhat`;
  const id_trong_trang = idTrongTrangGop(hay_nhat?.threads ?? null, lat_cat.values());

  const the_moc = (seq: number) => {
    const m = mach.mocs.find((x) => x.seq === seq);
    if (m === undefined) return null;
    return (
      <TheMoc
        key={m.seq}
        moc={m}
        laMach={la_mach}
        hienSoDem={hien_so_dem}
        nganKeo={lat_cat.get(m.seq) ?? null}
        duongDanKhanDai={duong_dan_khan_dai}
        duongDanTrich={duong_dan_trich}
        idTrongTrangKhanDai={id_trong_trang}
      />
    );
  };

  return (
    <KhungHaiCot>
      <JsonLd duLieu={jsonLdMach(mach)} />
      {/* Ba sự thật về mạch, chia cho mọi widget CLIENT nằm sâu bên trong (cột vote,
          composer, menu `⋯`). Provider là client component nhưng children của nó vẫn là
          server component — trang mạch không bị kéo sang client. Xem
          `components/mach-ngu-canh.tsx` để biết vì sao không xâu prop. */}
      <MachProvider
        gia_tri={{
          machId: mach.id,
          khoa: mach.locked,
          chuMach: mach.author.username,
          cacMoc: mach.mocs.map((m) => ({
            id: m.id,
            seq: m.seq,
            coTrich: m.trich !== null,
          })),
        }}
      >
        {/* Nửa PER-USER của trang, và nó bắt đầu ở ĐÂY chứ không ở layout: nó cần `machId`,
            và nó phải bọc cả cột vote lẫn nút "Theo mạch" lẫn spine. Mọi thứ bên trong
            vẫn là server component. */}
        <TrangThaiToiProvider machId={mach.id}>
          <article className={css.the} data-mat={mat} data-testid="the-mach">
            <header className={css.dau}>
              <div className={css.hang_tren}>
                <Link className={css.sub} href={duongDanSub(mach.sub.slug)}>
                  s/{mach.sub.slug}
                </Link>
                <NutTheoMach />
                {/* Công cụ mod của MẠCH: ẩn + khoá. `dangAn` luôn `false` — mạch bị ẩn
                    trả 404 ở cửa công khai nên không tới được đây; xem docstring
                    `HanhDongMod`. */}
                <HanhDongMod
                  loai="mach"
                  id={mach.id}
                  dangAn={false}
                  dangKhoa={mach.locked}
                  nhan="mạch này"
                />
              </div>
              <h1 className={css.tieu_de}>{mach.title}</h1>
              <div className={css.chu_ky}>
                <Link className={css.ai} href={duongDanHoSo(mach.author.username)}>
                  u/{mach.author.username}
                </Link>
                <span className={css.cham} aria-hidden>
                  ·
                </span>
                <span className="mono">mở ngày {ngayCuaThoiDiem(mach.created_at)}</span>
                {la_mach && (
                  <>
                    <span className={css.cham} aria-hidden>
                      ·
                    </span>
                    <span className={css.dem} data-testid="chu-ky-so-moc">
                      {mach.entry_count} mốc
                    </span>
                  </>
                )}
                {hien_so_dem && (
                  <>
                    <span className={css.cham} aria-hidden>
                      ·
                    </span>
                    <span className={css.dem} data-testid="chu-ky-so-binh-luan">
                      {mach.comment_count} bình luận
                    </span>
                  </>
                )}
                {/* Báo cáo cả BÀI — user chốt 2026-08-25. Trước đó chỉ báo cáo được mốc
                    và bình luận, nên một bài vi phạm ngay từ tiêu đề (hoặc vi phạm ở tổng
                    thể) thì người đọc phải chọn bừa một mốc, và mod nhận báo cáo trỏ sai
                    chỗ. Đặt CUỐI hàng chữ ký: nó là thao tác hiếm, không được tranh chỗ
                    với tên tác giả và ngày mở. */}
                <NutBaoCaoMach machId={mach.id} tieuDe={mach.title} />
              </div>
            </header>

            {mach.locked && (
              <p className={css.khoa}>Mạch bị khoá: đọc được, không tương tác được.</p>
            )}

            {/* **Toggle BÃO/CẶN, chiều còn lại** — L21, vá 2026-08-23.
                `grep "view=can"` ngoài e2e từng trả về **0**: cả sản phẩm chỉ có đường
                CẶN → BÃO. Mà PLAN 5.5 dựng cái toggle này với lý do ngược lại — *"người
                nghiêm túc bật 'thuần' một lần rồi vĩnh viễn không thấy bình luận"* — tức
                hướng BÃO → CẶN mới là hướng nó sinh ra để phục vụ, và nó là hướng thiếu.
                Là một `Link` thường, không phải `LoiMoiDoiMat`: chiều kia là một LỜI MỜI
                phụ thuộc dữ liệu per-user (đã follow chưa, đã bình luận chưa), chiều này
                là một lối đi luôn có, không hỏi gì về người xem — nên nó cũng render được
                ở server và nằm được trong HTML đã cache. */}
            {la_bao ? (
              <p className={css.doi_mat} data-testid="doi-mat-bao">
                {/* **Chữ trên màn hình KHÔNG nói "mặt BÃO/CẶN"** *(user chốt 2026-08-25:
                    "câu này khó hiểu quá")*. "Mặt BÃO", "mặt CẶN", "khán đài", "thân bài",
                    "nhật ký thuần" là **từ vựng nội bộ của PLAN 5.5** — chúng gọn cho
                    người viết code, và với người đọc lần đầu thì năm chữ lạ trong một câu
                    mười ba chữ là không đọc được. Tên nội bộ ở lại trong code, trong PLAN
                    và trong `?view=bao|can`; trên màn hình chỉ còn thứ nó THẬT SỰ khác
                    nhau: có bình luận xen giữa các mốc, hay không.

                    Hai tên hiển thị dùng NHẤT QUÁN cả hai chiều — "bản đầy đủ" và "nhật
                    ký của tác giả" — xem `loi-moi-doi-mat.tsx` cho chiều còn lại. Đặt hai
                    tên khác nhau cho cùng một thứ ở hai chỗ là bắt người dùng học hai lần. */}
                Đang xem <strong>bản đầy đủ</strong> — bình luận hiện xen giữa các mốc.{" "}
                <Link href={`${co_ban}?view=can`} data-testid="doi-sang-mat-can">
                  Chỉ đọc nhật ký của tác giả
                </Link>
              </p>
            ) : (
              <LoiMoiDoiMat matDangRender={mat} href={`${co_ban}?view=bao`} />
            )}

            <NganKeoProvider>
              {la_bao && la_mach ? (
                // Mặt BÃO — PLAN 5.5: spine 1 dòng → thẻ mốc 1 + dải gập + thẻ mốc mới
                // nhất → bung ra là timeline đầy đủ, có vạch mới. Thẻ mốc vẫn render ở
                // SERVER và đi vào đây dưới dạng `ReactNode` — xem docstring `MatBao`.
                // Công thức gập của mặt này ở `lib/dai-gap.ts::tinhDaiGapBao`, và `MatBao`
                // tự gọi: cả hai đầu đều lấy từ `tatCaMoc`, không có nguồn thứ hai.
                <MatBao
                  spine={mach.spine}
                  tatCaMoc={mach.mocs.map((m) => ({ seq: m.seq, the: the_moc(m.seq) }))}
                />
              ) : (
                <ol className={css.nhat_ky} data-testid="nhat-ky">
                  {dai.gap ? (
                    <>
                      {the_moc(1)}
                      <DaiGapBung
                        nhan={nhanDaiGap(
                          dai,
                          tongBinhLuanTrongDai(dai, mach.mocs),
                          hien_so_dem,
                        )}
                        moiBung={moiBung(mach, dai, threadsTrongDai(dai, lat_cat))}
                      >
                        {mach.mocs
                          .filter((m) => trongDaiGap(dai, m.seq))
                          .map((m) => the_moc(m.seq))}
                      </DaiGapBung>
                      {dai.seqHien
                        .filter((seq) => seq !== 1)
                        .map((seq) => the_moc(seq))}
                    </>
                  ) : (
                    mach.mocs.map((m) => the_moc(m.seq))
                  )}
                </ol>
              )}
            </NganKeoProvider>

            {/* Dòng chốt sổ — CUỐI nhật ký, không phải đầu trang *(user chốt
                2026-08-27)*. `BannerMach` cũ đứng trong `<header>` và dán nhãn "bài
                thường / mạch đang mở", thứ trang đã tự nói bằng chính sự có mặt hay
                vắng mặt của ray thời gian. Component tự trả `null` khi mạch còn mở, nên
                ở đây không có phép kiểm nào — xem docstring của nó. */}
            <ChanDongSo mach={mach} />

            {/* Khu của chủ mạch — nối mốc · đóng sổ · mở lại (PLAN 5.1). Đặt NGAY DƯỚI
                nhật ký và TRÊN khán đài, đúng thứ tự việc: mốc mới nối vào cuối cuốn sổ,
                không phải vào cuối trang. Component tự quyết có hiện hay không (chỉ chủ
                mạch), nên ở đây không có phép kiểm nào — xem docstring của nó. */}
            <KhoiChuMach
              machId={mach.id}
              chuMach={mach.author.username}
              khoa={mach.locked}
              dong={mach.status === "closed"}
              moLaiDen={mach.mo_lai_den}
              tranMocMoiNgay={mach.tran_moc_moi_ngay}
              soMoc={mach.entry_count}
            />

            {cursor_hong && <BaoCursorHong />}

            {/* Mặt BÃO: composer + câu mồi theo trạng thái đứng TRƯỚC cây khán đài
                (wireframe 9.2). Mặt CẶN thì composer nằm ở cuối khán đài — hai chỗ khác
                nhau vì hai mặt đọc theo hai chiều khác nhau.
                **Đúng MỘT trong hai được render** (L05): `KhanDai` nhận
                `hienComposer={!la_bao}`, nên mặt BÃO không còn hai ô nhập cùng hình dạng
                mà khác luật neo. */}
            {/* **KHÔNG neo mặc định, và KHÔNG câu mồi theo mốc** *(user chốt
                2026-08-26)*. Cả hai thứ vừa gỡ đều nói cùng một câu sai: rằng ô này viết
                *về mốc mới nhất*. Từ lượt này ô chung là ô của CẢ BÀI — câu neo mốc rơi
                vào ngăn kéo mốc đó và không hiện ở đây nữa, nên một mặc định neo sẽ đẩy
                câu vừa viết ra khỏi đúng khu người viết đang nhìn. Ai muốn gửi vào mốc
                vẫn chọn được ở select "Neo vào", và chính cái select nói ra điều đó.
                (Câu mồi cũ — "Mốc 9 vừa lên — bạn nghĩ sao?" — theo `cauMoiComposer`, hàm
                đã xoá cùng lượt; placeholder mặc định của `Composer` thay chỗ.)

                `neoDoiDuoc={la_mach}`: mặt BÃO **có thể xảy ra ở post thường** —
                `core/mat.py::tinh_mat_theo_thoi_gian` chỉ hỏi status · khoá · 72h, không
                hỏi `entry_count`. Post thường không có ngăn kéo (PLAN 5.1), nên một câu
                neo mốc 1 viết từ đây sẽ không hiện ở bất kỳ đâu. */}
            {la_bao && (
              <div className={css.composer_bao} data-testid="composer-mat-bao">
                <Composer neoDoiDuoc={la_mach} />
              </div>
            )}

            {/* `null` = mạch vừa biến mất giữa hai lời gọi (404). Không render gì —
                phần còn lại của trang vẫn đọc được. Tới 2026-08-24 nhánh này còn là chân
                trang `LoiMoiBungKhanDai` ("xem các câu đáng đọc ▾"), thứ nay không còn
                nghĩa: không còn gì để bung. */}
            {khan_dai_trang !== null && (
              <KhanDai
                khanDai={khan_dai_trang}
                sort={sort}
                hrefSort={hrefSort}
                hrefXemThem={hrefXemThem(co_ban, sort, khan_dai_trang, la_bao)}
                duongDanKhanDai={duong_dan_khan_dai}
                hienSoDem={hien_so_dem}
                cauDangDoc={cau_dang_doc}
                neoDoiDuoc={la_mach}
                hienComposer={!la_bao}
              />
            )}
          </article>
        </TrangThaiToiProvider>
      </MachProvider>
    </KhungHaiCot>
  );
}

function hrefXemThem(
  coBan: string,
  sort: SortKhanDai,
  trang: { offset_ke_tiep: number | null; cursor_ke_tiep: string | null },
  laBao: boolean,
): string | null {
  const mo = laBao ? "view=bao" : "khan_dai=1";
  if (sort === "hay_nhat") {
    return trang.offset_ke_tiep === null
      ? null
      : `${coBan}?${mo}&sort=hay_nhat&offset=${trang.offset_ke_tiep}#khan-dai`;
  }
  return trang.cursor_ke_tiep === null
    ? null
    : `${coBan}?${mo}&sort=${sort}&cursor=${encodeURIComponent(trang.cursor_ke_tiep)}#khan-dai`;
}

/** Tập thread nuôi mồi bung: gộp lát cắt ngăn kéo của **các mốc nằm trong dải gập**.
 *
 * ## Vì sao nguồn đổi *(§G, 2026-08-27)*
 *
 * Tới 2026-08-26 nguồn là trang 1 `hay_nhat` của khu bình luận chung. Cùng ngày, khu ấy
 * bắt đầu chỉ giữ thread `anchor_moc_seq IS NULL` — mà `chonMoiBung` đòi ứng viên **có**
 * neo và neo phải nằm trong dải. Hai điều kiện loại trừ nhau, nên hàm trả `null` với mọi
 * dữ liệu, ở mọi mạch có dải gập (dải gập cần `entry_count ≥ 5`, phép lọc bật từ `≥ 2`):
 * tính năng chết hẳn chứ không nghèo đi, và chết **im lặng** — component xử `null` gọn tới
 * mức không ai thấy gì.
 *
 * Nguồn mới đúng hơn nguồn cũ về ngữ nghĩa: teaser quảng cáo cho những mốc đang bị gập,
 * mà nhà của những câu nói về chúng CHÍNH LÀ ngăn kéo của chúng.
 *
 * **Luật chọn không đổi một dòng** (`lib/moi-bung.ts`, don-vi `moi-bung.spec.ts` ghim đủ ba
 * điều kiện) — đây chỉ là đổi TẬP ĐẦU VÀO. Vẫn lọc `trongDaiGap` lần nữa bên trong luật,
 * và phép lọc thừa ấy là cố ý: nó giữ cho luật đúng độc lập với việc người gọi đưa vào
 * đúng hay sai tập.
 *
 * Không thêm lời gọi API nào — `lat_cat` đã nạp cho mọi mốc ở trên.
 */
function threadsTrongDai(
  dai: DaiGap,
  latCat: ReadonlyMap<number, NganKeoOut>,
): BinhLuanOut[] {
  const ra: BinhLuanOut[] = [];
  for (const [seq, lat] of latCat) {
    if (trongDaiGap(dai, seq)) ra.push(...lat.threads);
  }
  return ra;
}

function moiBung(
  mach: MachChiTietOut,
  dai: DaiGap,
  ungVien: readonly BinhLuanOut[],
) {
  const chon = chonMoiBung(ungVien, dai, idDaTrich(mach));
  if (chon === null || chon.body === null) return null;
  const goi = chon.body.replace(/\s+/g, " ").trim();
  return {
    loi: goi.length > 120 ? `${goi.slice(0, 120)}…` : goi,
    diem: diemCoDau(chon.score),
  };
}
