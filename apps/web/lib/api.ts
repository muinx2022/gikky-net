import {
  lietKeBinhLuanMach,
  lietKeBinhLuanMoc,
  lietKeFeedDangDienRa,
  lietKeFeedMoi,
  xemHoSo,
  xemMach,
  type FeedOut,
  type HoSoOut,
  type KhanDaiOut,
  type MachChiTietOut,
  type NganKeoOut,
} from "@gikky/api-client";

import type { SortKhanDai } from "./khan-dai";

/** Server component gọi **THẲNG** Django, không vòng qua cổng 3000 của chính mình.
 *
 * PLAN 8.4 điểm 3 đã có chiều Django → `localhost:3000` (on-demand revalidate); thêm
 * chiều ngược Node → Node là công thức tự đói tài nguyên khi Phase 3 bật ISR. Đường
 * same-origin `/api/*` (rewrites trong `next.config.ts`) để dành cho lời gọi chạy TRONG
 * TRÌNH DUYỆT, nơi cookie phiên cần đi kèm.
 */
export const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

/** Mọi lời gọi API của 1c đi qua đây — **KHÔNG dùng `client` singleton**.
 *
 * `@gikky/api-client` cố ý không xuất subpath `./client`, và `scripts/rao-can-client.mjs`
 * chặn nó lọt ra qua `index.ts`. Lý do (CLAUDE.md): `client` là object dùng chung CẢ TIẾN
 * TRÌNH Node — ai gọi `client.setConfig({ headers: { cookie } })` rồi await là mở đường
 * cho request của user B đọc dữ liệu bằng session của user A, hỏng im lặng, trang vẫn
 * 200. Cách đúng và duy nhất hiện có: truyền `baseUrl` (và sau này `headers`) **theo
 * từng lời gọi**, đúng như mọi hàm dưới đây làm.
 *
 * `cache: "no-store"` ở 1c là **tạm**: PLAN 8.4 chốt biến thể khách phải là ISR 1 giờ +
 * on-demand revalidate, nhưng cả cơ chế đó là việc của Phase 3. Đừng đọc nó thành "trang
 * mạch cố ý không cache".
 */
const CHUNG = { baseUrl: API_ORIGIN, cache: "no-store" } as const;

/** Mã lỗi ổn định của API (PLAN mục 7 — frontend bắt theo `code`, không parse `detail`).
 * Chỉ khai những mã 1c thật sự phân biệt được hành vi; thêm mã là thêm một nhánh xử lý,
 * không phải thêm một hằng cho đẹp. */
const CURSOR_KHONG_HOP_LE = "cursor_khong_hop_le";

export class LoiApi extends Error {
  constructor(
    readonly viec: string,
    readonly trangThai: number | null,
    readonly chiTiet: string,
  ) {
    super(`Gọi ${viec} thất bại (${trangThai ?? "không có phản hồi"}): ${chiTiet}`);
    this.name = "LoiApi";
  }
}

type KetQua<T> = { data?: T; error?: unknown; response?: Response };

/** Trả `data`, hoặc ném `LoiApi`. `null` khi HTTP 404 — người gọi tự quyết định
 * `notFound()` hay hiện trạng thái rỗng.
 *
 * Phân biệt hai kiểu hỏng, vì cách sửa khác hẳn nhau: `error` KHÔNG kèm `response` là
 * fetch chết trước khi có HTTP (Django chưa chạy, sai cổng) — client-fetch của hey-api
 * **không ném** ở ca đó, nó nhét lỗi vào `error`, nên chỉ `try/catch` là nuốt mất.
 */
function lay<T>(kq: KetQua<T>, viec: string): T | null {
  if (kq.error !== undefined) {
    if (kq.response?.status === 404) return null;
    throw new LoiApi(viec, kq.response?.status ?? null, moTa(kq.error));
  }
  if (kq.data === undefined) {
    throw new LoiApi(viec, kq.response?.status ?? null, "phản hồi không có body");
  }
  return kq.data;
}

function moTa(loi: unknown): string {
  if (loi instanceof Error) return `${loi.name}: ${loi.message}`;
  if (typeof loi === "string") return loi;
  return JSON.stringify(loi);
}

/** Thân lỗi của API có `code` này không?
 *
 * `error` mà client-fetch trả về chính là **body đã parse** của phản hồi không-2xx
 * (`{detail, code}` — PLAN mục 7), hoặc chuỗi thô khi body không phải JSON, hoặc một
 * `TypeError` khi fetch chết trước lúc có HTTP. Nên phải soi cả ba, không được `as`.
 */
function maLoi(kq: KetQua<unknown>, ma: string): boolean {
  const than = kq.error;
  return (
    typeof than === "object" &&
    than !== null &&
    "code" in than &&
    (than as { code?: unknown }).code === ma
  );
}

/** Một trang dữ liệu đi bằng cursor, kèm câu trả lời cho "cursor vừa rồi có dùng được
 * không".
 *
 * **Vì sao cần trường thứ hai** (vá A1, 2026-08-22): `?cursor=rac` do người ta sửa query
 * string bằng tay làm Django trả 400 `cursor_khong_hop_le`, mà `lay()` chỉ quy 404 về
 * `null` ⇒ 400 ném `LoiApi` ⇒ **cả trang chủ, trang sub và trang mạch đều 500**. Chữa
 * bằng cách nuốt lỗi rồi trả trang 1 thì tệ hơn: người ta tưởng mình đang đọc trang 5.
 * `giai_ma_cursor` của API cố ý không có nhánh "đoán bừa" vì đúng lý do đó — nên tầng
 * này lùi về trang 1 **và bắt UI nói ra**.
 *
 * ⚠ `T` **không** tự mang `| null` (vá F1, 2026-08-22). Bản đầu khai `du_lieu: T | null`,
 * nên mọi người gọi — kể cả những lời gọi mà API **không có đường 404 nào** — đều nhận về
 * một kiểu nullable và phải nghĩ ra một câu trả lời cho ca `null`. Câu trả lời rẻ nhất là
 * `?? {rỗng}`, và đó đúng là cách trang chủ nuốt lỗi cấu trúc thành "chưa có bài nào".
 * Nay `null` chỉ xuất hiện ở nơi người khai kiểu **cố ý** viết `TrangCursor<X | null>`.
 */
export type TrangCursor<T> = {
  du_lieu: T;
  /** `true` ⇒ đã bỏ `?cursor=` và đang hiện trang đầu. UI **phải** hiện câu giải thích. */
  cursorHong: boolean;
};

/** Cursor rỗng (`?cursor=`) tính là cursor hỏng, không tính là "không có cursor".
 *
 * `opts.cursor ?? null` của bản đầu không bắt `""` (nullish coalescing chỉ bắt
 * `null`/`undefined`) và `createQuerySerializer` cũng chỉ bỏ `undefined`/`null`, nên
 * chuỗi rỗng đi thẳng xuống Django và ăn 400 y như `rac`. Xử ở đây thay vì tốn một vòng
 * mạng để nhận về đúng câu trả lời đã biết trước.
 */
function cursorHopLe(cursor: string | undefined): string | null {
  if (cursor === undefined) return null;
  const g = cursor.trim();
  return g === "" ? null : g;
}

export async function docMach(machId: number): Promise<MachChiTietOut | null> {
  return lay(
    await xemMach({ ...CHUNG, path: { mach_id: machId } }),
    `xem_mach(${machId})`,
  );
}

/** Tham số phân trang trên URL có bị vứt đi không? — **BA đường**, không phải hai.
 *
 * Cả ba đều dẫn tới cùng một chuyện: *"URL nói trang sau, trang đang hiện trang đầu"*,
 * và cả ba đều phải NÓI RA (xem `TrangCursor` + `BaoCursorHong`).
 *
 * 1. cursor rỗng hoặc rác;
 * 2. cursor gửi kèm `sort=hay_nhat` — sort đó phân trang bằng `offset`, API trả 400 nếu
 *    nhận cả hai nên chỗ này vứt cursor đi;
 * 3. **`offset` khác 0 kèm một sort thời gian** (vá D5, 2026-08-22) — chiều đối xứng của
 *    (2). Trước đợt vá nó bị vứt HOÀN TOÀN im lặng, và chú thích ngay tại chỗ còn đếm
 *    *"hai đường"* trong khi code đã có ba: `?khan_dai=1&sort=moi_nhat&offset=20` trả
 *    200 kèm trang 1, không một dòng nào cho biết `offset` đã đi đâu.
 *
 * Tách khỏi `docKhanDai` để đo được mà không cần mạng — `e2e/don-vi/khan-dai-va-dem.spec.ts`.
 */
export function thamSoPhanTrangBiBo(
  sort: SortKhanDai,
  trang: { offset?: number; cursor?: string },
): boolean {
  const la_hay_nhat = sort === "hay_nhat";
  return (
    (trang.cursor !== undefined &&
      (la_hay_nhat || cursorHopLe(trang.cursor) === null)) ||
    (!la_hay_nhat && (trang.offset ?? 0) !== 0)
  );
}

/** Khán đài. **Hai kiểu phân trang không dùng lẫn nhau** và API trả 400 nếu lẫn:
 * `hay_nhat` đi bằng `offset`, hai sort thời gian đi bằng `cursor` (PLAN 5.3). Chỗ này
 * là chỗ duy nhất trong `apps/web` biết luật đó, nên nó tự vứt tham số sai kiểu thay vì
 * chuyển tiếp — người ta sửa query string bằng tay không được phép làm cả trang mạch
 * trả 500.
 *
 * Cursor rác cũng vậy: lùi về trang 1 và trả `cursorHong = true` để UI nói ra (xem
 * `TrangCursor`). `offset` rác đã được tầng gọi chuẩn hoá trước — nó là số, không phải
 * chuỗi mờ đục.
 */
export async function docKhanDai(
  machId: number,
  sort: SortKhanDai,
  trang: { offset?: number; cursor?: string } = {},
  limit = 50,
): Promise<TrangCursor<KhanDaiOut | null>> {
  const la_hay_nhat = sort === "hay_nhat";
  const xin = cursorHopLe(trang.cursor);
  const offset_xin = trang.offset ?? 0;
  const tham_so_bi_bo = thamSoPhanTrangBiBo(sort, trang);
  const goi = (cursor: string | null) =>
    lietKeBinhLuanMach({
      ...CHUNG,
      path: { mach_id: machId },
      query: {
        sort,
        limit,
        offset: la_hay_nhat ? offset_xin : 0,
        cursor: la_hay_nhat ? null : cursor,
      },
    });
  const viec = `liet_ke_binh_luan_mach(${machId}, ${sort})`;

  const kq = await goi(la_hay_nhat ? null : xin);
  if (maLoi(kq, CURSOR_KHONG_HOP_LE)) {
    return { du_lieu: lay(await goi(null), viec), cursorHong: true };
  }
  return { du_lieu: lay(kq, viec), cursorHong: tham_so_bi_bo };
}

export async function docNganKeo(mocId: number): Promise<NganKeoOut | null> {
  return lay(
    await lietKeBinhLuanMoc({ ...CHUNG, path: { moc_id: mocId } }),
    `liet_ke_binh_luan_moc(${mocId})`,
  );
}

export async function docHoSo(username: string, limit = 20): Promise<HoSoOut | null> {
  return lay(
    await xemHoSo({ ...CHUNG, path: { username }, query: { limit } }),
    `xem_ho_so(${username})`,
  );
}

/** Hai tab của feed — PLAN 5.9. Khoá `tab` cũng chính là giá trị `?tab=` trên URL. */
export const TAB_FEED = ["moi", "dang-dien-ra"] as const;
export type TabFeed = (typeof TAB_FEED)[number];
export const TAB_MAC_DINH: TabFeed = "moi";
export const NHAN_TAB: Readonly<Record<TabFeed, string>> = {
  moi: "Mới",
  "dang-dien-ra": "Đang diễn ra",
};

export function docTab(gia_tri: string | string[] | undefined): TabFeed {
  const t = Array.isArray(gia_tri) ? gia_tri[0] : gia_tri;
  return (TAB_FEED as readonly string[]).includes(t ?? "") ? (t as TabFeed) : TAB_MAC_DINH;
}

/** Feed **không lọc sub** — `/` và `sitemap.xml`.
 *
 * `du_lieu` KHÔNG nullable, và đó là cả nội dung của vá F1 (2026-08-22). `GET /feeds/moi`
 * và `/feeds/dang-dien-ra` **không có đường 404 nào** khi thiếu `?sub=`: 404 duy nhất của
 * `api/api/feeds.py` là `sub_khong_ton_tai`. Nên một `null` ở đây không bao giờ nghĩa là
 * "chưa có bài" — nó là hỏng CẤU TRÚC (endpoint đổi tên, prefix bị proxy nuốt,
 * `API_ORIGIN` trỏ nhầm origin), và nó phải ném để `error.tsx` chạy và phản hồi là 500.
 *
 * Trước vá, `app/page.tsx` viết `feed ?? { items: [], cursor_ke_tiep: null }` và
 * `app/sitemap.ts` viết `if (feed === null) break;`. Cả hai biến đúng ca đó thành **200
 * trông như bình thường**: trang chủ nói "Chưa có bài nào ở đây" trong khi DB đầy mạch,
 * sitemap teo còn 4 URL tĩnh. Không log, không gì đỏ, monitoring thấy 200.
 *
 * **Vì sao chặn ở TẦNG NÀY chứ không sửa hai chỗ gọi.** Sửa chỗ gọi là đóng hai cửa của
 * một luật mà để ngỏ cửa thứ ba cho trang tiếp theo — đúng loài lỗi repo này đã dính ba
 * lượt liên tiếp trong Phase 1c. Ở đây kiểu trả về **không còn `null`**, nên trang mới
 * không có gì để `??`.
 */
export async function docFeed(
  tab: TabFeed,
  opts: { cursor?: string; limit?: number } = {},
): Promise<TrangCursor<FeedOut>> {
  const trang = await feedTho(tab, opts);
  if (trang.du_lieu === null) {
    throw new LoiApi(
      `feed ${tab}`,
      404,
      "404 trên feed không lọc sub — endpoint này không có đường 404 hợp lệ nào, " +
        "nên đây là hỏng cấu trúc chứ không phải feed rỗng",
    );
  }
  return { du_lieu: trang.du_lieu, cursorHong: trang.cursorHong };
}

/** Feed **lọc theo sub** — `/s/[sub]`. Đây là chỗ duy nhất `null` có nghĩa thật:
 * `sub_khong_ton_tai` (404), và trang sub phải `notFound()` chứ không hiện feed rỗng. */
export async function docFeedSub(
  sub: string,
  tab: TabFeed,
  opts: { cursor?: string; limit?: number } = {},
): Promise<TrangCursor<FeedOut | null>> {
  return feedTho(tab, { ...opts, sub });
}

async function feedTho(
  tab: TabFeed,
  opts: { sub?: string; cursor?: string; limit?: number },
): Promise<TrangCursor<FeedOut | null>> {
  const xin = cursorHopLe(opts.cursor);
  const cursor_bi_bo = xin === null && opts.cursor !== undefined;
  // Hai lời gọi TRỰC TIẾP thay cho `const ham = tab === "moi" ? … : …` rồi `ham(…)` (vá
  // E2, 2026-08-22). Hàm API đi qua một biến trung gian là hàm rào "mọi lời gọi đều
  // truyền `baseUrl`" không còn thấy lời gọi đó — nó tìm callee theo TÊN. Chỗ này không
  // sai `baseUrl`, nhưng nó là cái lỗ khiến hàng rào không thể nói "mọi".
  const goi = (cursor: string | null) => {
    const q = { sub: opts.sub ?? null, cursor, limit: opts.limit ?? 20 };
    return tab === "moi"
      ? lietKeFeedMoi({ ...CHUNG, query: q })
      : lietKeFeedDangDienRa({ ...CHUNG, query: q });
  };
  const viec = `feed ${tab}`;

  const kq = await goi(xin);
  if (maLoi(kq, CURSOR_KHONG_HOP_LE)) {
    return { du_lieu: lay(await goi(null), viec), cursorHong: true };
  }
  return { du_lieu: lay(kq, viec), cursorHong: cursor_bi_bo };
}
