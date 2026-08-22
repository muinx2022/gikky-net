import type {
  BinhLuanOut,
  KhanDaiOut,
  MachChiTietOut,
  NganKeoOut,
} from "@gikky/api-client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { BannerMach } from "@/components/banner-mach";
import { BaoCursorHong } from "@/components/bao-cursor-hong";
import { DaiGapBung } from "@/components/dai-gap";
import { JsonLd } from "@/components/json-ld";
import { KhanDai, LoiMoiBungKhanDai } from "@/components/khan-dai";
import { KhoiChuMach } from "@/components/khoi-chu-mach";
import { MachProvider } from "@/components/mach-ngu-canh";
import { NganKeoProvider } from "@/components/ngan-keo";
import { TheMoc } from "@/components/the-moc";
import {
  docCauDangDoc,
  docKhanDai,
  docMach,
  docNganKeo,
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
import { chonMoiBung, idDaTrich } from "@/lib/moi-bung";
import { urlTuyetDoi } from "@/lib/site";
import { TRAN_NGAN_KEO, chayCoTran } from "@/lib/song-song";
import { duongDanHoSo, duongDanMach, duongDanSub, tachSlugId } from "@/lib/url";

import css from "./mach.module.css";

// TẠM CỦA 1c — Phase 3 PHẢI thay. PLAN 8.4 chốt trang mạch có hai biến thể: khách không
// cookie ăn ISR (revalidate 1 giờ + on-demand), chỉ biến thể CÓ cookie mới dynamic. Cả
// cơ chế đó (middleware tách hai nhánh, `GET /machs/{id}/me`) nằm ngoài phạm vi 1c, nên
// ở đây trang chạy dynamic thuần. Đừng đọc dòng này thành "trang mạch cố ý không cache".
// Nó cũng giữ cho `pnpm build` không cần Django sống.
export const dynamic = "force-dynamic";

type ThamSo = { slugId: string };
type Query = Record<string, string | string[] | undefined>;

function motChuoi(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function nap(slugId: string) {
  const tach = tachSlugId(slugId);
  if (tach === null) notFound();
  const mach = await docMach(tach.id);
  if (mach === null) notFound();
  return { mach, slugTrenUrl: tach.slug };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ThamSo>;
}): Promise<Metadata> {
  const { mach } = await nap((await params).slugId);
  const duong_dan = duongDanMach(mach.slug, mach.id);
  const mo_ta = tomTat(mach);
  return {
    title: mach.title,
    description: mo_ta,
    alternates: { canonical: urlTuyetDoi(duong_dan) },
    openGraph: {
      type: "article",
      title: mach.title,
      description: mo_ta,
      url: urlTuyetDoi(duong_dan),
    },
  };
}

/** `<meta description>` theo mạch. Ưu tiên `ket_qua` vì đó là câu tóm tắt do chính tác
 * giả viết khi đóng sổ (PLAN 5.1); không có thì lấy đoạn đầu của mốc 1. */
function tomTat(mach: MachChiTietOut): string {
  const dau = mach.ket_qua ? `${mach.ket_qua} · ` : "";
  const than = mach.mocs.find((m) => m.seq === 1)?.body ?? "";
  const gon = than.replace(/\s+/g, " ").trim().slice(0, 150);
  return `${dau}${mach.entry_count} mốc · ${gon}${gon.length >= 150 ? "…" : ""}`;
}

export default async function TrangMach({
  params,
  searchParams,
}: {
  params: Promise<ThamSo>;
  searchParams: Promise<Query>;
}) {
  const { slugId } = await params;
  const q = await searchParams;
  const { mach, slugTrenUrl } = await nap(slugId);

  // PLAN 5.9: `id` bền, slug đổi được ⇒ slug lệch thì redirect về dạng chuẩn, GIỮ NGUYÊN
  // `id`. Query string đi theo, nếu không thì người bấm link chia sẻ tới khán đài đang
  // mở sẽ rơi về đầu trang sau redirect.
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
  const bung_khan_dai = motChuoi(q.khan_dai) === "1";
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

  // Trang 1 của `hay_nhat` phục vụ HAI việc, và chỉ nạp khi có ít nhất một trong hai
  // (vá C6 — bản đầu gọi vô điều kiện, tức mọi post thường tốn thừa một lời gọi):
  //
  // 1. **mồi bung** của dải gập — tính từ trang đầu của chính sort đó (plan con 1c §1),
  //    KHÔNG theo sort người dùng đang chọn;
  // 2. **deep-link của khối trích** — xem `duong_dan_trich` bên dưới.
  const can_hay_nhat = dai.gap || co_trich || (bung_khan_dai && sort === "hay_nhat");
  const hay_nhat = can_hay_nhat
    ? (await docKhanDai(mach.id, "hay_nhat")).du_lieu
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
      : await docKhanDai(mach.id, sort, { offset, cursor });
  const khan_dai_trang = trang_dang_xem.du_lieu;
  const cursor_hong = trang_dang_xem.cursorHong || offset_hong;

  // "Câu đáng đọc" (PLAN 5.5) — chỉ nạp khi khán đài thật sự bung ra, cùng lý lẽ với
  // `trang_dang_xem`. Lời gọi RIÊNG: tập này có thứ tự riêng (wilson thuần) và không
  // phân trang, nên nó không tái dụng được trang khán đài đang hiện.
  const cau_dang_doc = bung_khan_dai ? await docCauDangDoc(mach.id) : null;

  // Ngăn kéo nạp sẵn cho MỌI mốc của mạch — kể cả mốc `so_binh_luan === 0` (vá B1: mốc
  // chỉ còn bia mộ vẫn có lát cắt), và kể cả mốc nằm trong dải gập, vì dải gập bung ra
  // ngay tại chỗ chứ không tải lại trang.
  //
  // Đây là mặt sau của nợ có tên `N+1-NGAN-KEO` (danh sách nợ:
  // `plans/2026-08-22-phase-1d-va3.md` §4; nêu lần đầu ở
  // `plans/2026-08-22-phase-1c-va.md` §5): số lời gọi nay bằng
  // số MỐC chứ không bằng số mốc có bình luận. Đổi lại là cái nút và cái ngăn kéo nói
  // cùng một chuyện. Xử thật ở Phase 3, cùng lúc bật ISR.
  // (Tên cũ "#1" trỏ nhầm sang khoản keyset của cùng danh sách — sửa ở Y5, lượt vá 4.)
  //
  // `chayCoTran` thay `Promise.all` (vá E4): số lời gọi không đổi, nhưng chúng không còn
  // ập vào Django cùng một lúc. Mạch 40 mốc từng là 40 kết nối đồng thời cho MỘT lượt
  // tải một URL công khai — hệ số khuếch đại do người ngoài điều khiển.
  const lat_cat = new Map<number, NganKeoOut>();
  if (la_mach) {
    const ket_qua = await chayCoTran(mach.mocs, TRAN_NGAN_KEO, (m) =>
      docNganKeo(m.id),
    );
    mach.mocs.forEach((m, i) => {
      const k = ket_qua[i];
      if (k !== null) lat_cat.set(m.seq, k);
    });
  }

  const co_ban = duongDanMach(mach.slug, mach.id);
  const duong_dan_khan_dai = `${co_ban}?khan_dai=1&sort=${sort}`;
  const hrefSort = (s: SortKhanDai) => `${co_ban}?khan_dai=1&sort=${s}#khan-dai`;

  // **Deep-link của khối trích tính trạng thái trên ĐÚNG TRANG mà nó dẫn tới** (vá B3).
  // Bản đầu dựng link trỏ trang 1 nhưng hỏi `khan_dai_trang` — trang người dùng đang
  // xem — nên sai cả hai chiều: đang ở trang 2 thì một bình luận nằm ở trang 1 bị báo
  // "nằm ở trang sau" (giấu mất một link vốn chạy được), còn bình luận ở trang 2 thì
  // link trỏ trang 1 không có neo, bấm xong trang đứng yên.
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
        }}
      >
      <article className={css.the}>
        <header className={css.dau}>
          <BannerMach mach={mach} />
          <Link className={css.sub} href={duongDanSub(mach.sub.slug)}>
            s/{mach.sub.slug}
          </Link>
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
          <p className={css.khoa}>
            Mạch bị khoá: đọc được, không tương tác được.
          </p>
        )}

        <NganKeoProvider>
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
        </NganKeoProvider>

        {/* Khu của chủ mạch — nối mốc · đóng sổ · mở lại (PLAN 5.1). Đặt NGAY DƯỚI nhật ký
            và TRÊN khán đài, đúng thứ tự việc: mốc mới nối vào cuối cuốn sổ, không phải
            vào cuối trang. Component tự quyết có hiện hay không (chỉ chủ mạch), nên ở đây
            không có phép kiểm nào — xem docstring của nó. */}
        <KhoiChuMach
          machId={mach.id}
          chuMach={mach.author.username}
          khoa={mach.locked}
          dong={mach.status === "closed"}
          closedAt={mach.closed_at}
          soMoc={mach.entry_count}
        />

        {cursor_hong && <BaoCursorHong />}

        {bung_khan_dai && khan_dai_trang !== null ? (
          <KhanDai
            khanDai={khan_dai_trang}
            sort={sort}
            hrefSort={hrefSort}
            hrefXemThem={hrefXemThem(co_ban, sort, khan_dai_trang)}
            duongDanKhanDai={duong_dan_khan_dai}
            hienSoDem={hien_so_dem}
            cauDangDoc={cau_dang_doc}
          />
        ) : (
          <LoiMoiBungKhanDai
            soBinhLuan={mach.comment_count}
            hienSoDem={hien_so_dem}
            href={`${co_ban}?khan_dai=1&sort=${sort}#khan-dai`}
          />
        )}
      </article>
      </MachProvider>
    </main>
  );
}

function hrefXemThem(
  coBan: string,
  sort: SortKhanDai,
  trang: { offset_ke_tiep: number | null; cursor_ke_tiep: string | null },
): string | null {
  if (sort === "hay_nhat") {
    return trang.offset_ke_tiep === null
      ? null
      : `${coBan}?khan_dai=1&sort=hay_nhat&offset=${trang.offset_ke_tiep}#khan-dai`;
  }
  return trang.cursor_ke_tiep === null
    ? null
    : `${coBan}?khan_dai=1&sort=${sort}&cursor=${encodeURIComponent(trang.cursor_ke_tiep)}#khan-dai`;
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
