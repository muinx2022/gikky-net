import type {
  BinhLuanOut,
  KhanDaiOut,
  MachChiTietOut,
  NganKeoOut,
} from "@gikky/api-client";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { BannerMach } from "@/components/banner-mach";
import { BaoCursorHong } from "@/components/bao-cursor-hong";
import { DaiGapBung } from "@/components/dai-gap";
import { JsonLd } from "@/components/json-ld";
import { KhanDai, LoiMoiBungKhanDai } from "@/components/khan-dai";
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
import { docSort, idTrongTrang, type SortKhanDai } from "@/lib/khan-dai";
import { cauMoiComposer, docView, matDeRender } from "@/lib/mat";
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

  // Mặt BÃO: **khán đài LÀ thân bài** (PLAN 5.5), nên nó mở sẵn, không đợi `?khan_dai=1`.
  // Mặt CẶN thì ngược lại: nhật ký là thân bài, khán đài nằm sau một cú bấm.
  const bung_khan_dai = la_bao || motChuoi(q.khan_dai) === "1";

  const la_mach = mach.entry_count >= 2;
  const hien_so_dem = nenHienSoDem(mach.comment_count);
  const dai = tinhDaiGap(mach.entry_count);
  const co_trich = mach.mocs.some((m) => m.trich !== null);

  // Trang 1 của `hay_nhat` phục vụ HAI việc, và chỉ nạp khi có ít nhất một trong hai
  // (vá C6 — bản đầu gọi vô điều kiện, tức mọi post thường tốn thừa một lời gọi):
  //
  // 1. **mồi bung** của dải gập — tính từ trang đầu của chính sort đó (plan con 1c §1),
  //    KHÔNG theo sort người dùng đang chọn;
  // 2. **deep-link của khối trích** — xem `duong_dan_trich` bên dưới.
  const can_hay_nhat = dai.gap || co_trich || (bung_khan_dai && sort === "hay_nhat");
  const hay_nhat = can_hay_nhat
    ? (await docKhanDai(mach.id, "hay_nhat", doc)).du_lieu
    : null;

  // Trang khán đài ĐANG HIỆN. Chỉ nạp khi thật sự bung ra — trước đợt vá nó được nạp cả
  // khi chân trang còn đang gập, tức một lời gọi thừa nữa.
  // `| null` viết TƯỜNG MINH (vá F1): `TrangCursor<T>` không còn tự thêm `null` vào mọi
  // lời gọi. Ở đây `null` có nghĩa thật — `liet_ke_binh_luan_mach` trả 404 khi mạch biến
  // mất giữa hai lời gọi — nên chỗ này là chỗ được phép khai nullable.
  const trang_dang_xem: TrangCursor<KhanDaiOut | null> = !bung_khan_dai
    ? { du_lieu: null, cursorHong: false }
    : sort === "hay_nhat" && offset === 0 && cursor === undefined && hay_nhat !== null
      ? { du_lieu: hay_nhat, cursorHong: false }
      : await docKhanDai(mach.id, sort, doc, { offset, cursor });
  const khan_dai_trang = trang_dang_xem.du_lieu;
  const cursor_hong = trang_dang_xem.cursorHong || offset_hong;

  // "Câu đáng đọc" (PLAN 5.5) — khối của mặt CẶN, và chỉ của mặt CẶN. Ở mặt BÃO khán đài
  // đã là thân bài và mở sẵn, nên một khối "lọc sẵn 10 câu" ngay trên cây đầy đủ là đúng
  // cái bản-sao-của-chính-nó mà ngoại lệ 2026-08-22 loại bỏ.
  const cau_dang_doc = bung_khan_dai && !la_bao ? await docCauDangDoc(mach.id, doc) : null;

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

  // **Deep-link của khối trích tính trạng thái trên ĐÚNG TRANG mà nó dẫn tới** (vá B3).
  const duong_dan_trich = `${co_ban}?khan_dai=1&sort=hay_nhat`;
  const id_trong_trang = idTrongTrang(hay_nhat?.threads ?? []);

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

  const moc_moi_nhat = mach.mocs.reduce<typeof mach.mocs[number] | undefined>(
    (a, b) => (a === undefined || b.seq > a.seq ? b : a),
    undefined,
  );

  return (
    <main className={css.khung}>
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
              <BannerMach mach={mach} />
              <div className={css.hang_tren}>
                <Link className={css.sub} href={duongDanSub(mach.sub.slug)}>
                  s/{mach.sub.slug}
                </Link>
                <NutTheoMach />
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
                Đang xem <strong>mặt BÃO</strong> — khán đài là thân bài.{" "}
                <Link href={`${co_ban}?view=can`} data-testid="doi-sang-mat-can">
                  xem mặt CẶN (nhật ký thuần)
                </Link>
              </p>
            ) : (
              <LoiMoiDoiMat matDangRender={mat} href={`${co_ban}?view=bao`} />
            )}

            <NganKeoProvider>
              {la_bao && la_mach ? (
                // Mặt BÃO — PLAN 5.5: spine 1 dòng → thẻ mốc mới nhất mở sẵn → "mở cả
                // mạch ▾" (timeline đầy đủ, có vạch mới). Thẻ mốc vẫn render ở SERVER và
                // đi vào đây dưới dạng `ReactNode` — xem docstring `MatBao`.
                <MatBao
                  spine={mach.spine}
                  mocMoiNhat={moc_moi_nhat === undefined ? null : the_moc(moc_moi_nhat.seq)}
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
                        moiBung={moiBung(mach, dai, hay_nhat?.threads ?? [])}
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
            {la_bao && (
              <div className={css.composer_bao} data-testid="composer-mat-bao">
                <Composer
                  anchorMocSeq={moc_moi_nhat?.seq ?? null}
                  neoDoiDuoc
                  moi={cauMoiComposer(moc_moi_nhat, mach.status === "closed")}
                />
              </div>
            )}

            {bung_khan_dai && khan_dai_trang !== null ? (
              <KhanDai
                khanDai={khan_dai_trang}
                sort={sort}
                hrefSort={hrefSort}
                hrefXemThem={hrefXemThem(co_ban, sort, khan_dai_trang, la_bao)}
                duongDanKhanDai={duong_dan_khan_dai}
                hienSoDem={hien_so_dem}
                cauDangDoc={cau_dang_doc}
                anchorMocSeq={moc_moi_nhat?.seq ?? null}
                hienComposer={!la_bao}
              />
            ) : (
              <LoiMoiBungKhanDai
                soBinhLuan={mach.comment_count}
                hienSoDem={hien_so_dem}
                href={`${co_ban}?khan_dai=1&sort=${sort}#khan-dai`}
              />
            )}
          </article>
        </TrangThaiToiProvider>
      </MachProvider>
    </main>
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

function moiBung(
  mach: MachChiTietOut,
  dai: DaiGap,
  threadsHayNhat: readonly BinhLuanOut[],
) {
  const chon = chonMoiBung(threadsHayNhat, dai, idDaTrich(mach));
  if (chon === null || chon.body === null) return null;
  const goi = chon.body.replace(/\s+/g, " ").trim();
  return {
    loi: goi.length > 120 ? `${goi.slice(0, 120)}…` : goi,
    diem: diemCoDau(chon.score),
  };
}
