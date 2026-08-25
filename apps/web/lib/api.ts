import {
  lietKeBinhLuanMach,
  lietKeBinhLuanMoc,
  lietKeFeedDangDienRa,
  lietKeFeedMoi,
  lietKeSub,
  timKiem,
  xemHoSo,
  xemMach,
  xemSub,
  type FeedOut,
  type HoSoOut,
  type KhanDaiOut,
  type LietKeFeedMoiData,
  type MachChiTietOut,
  type NganKeoOut,
  type SubChiTietOut,
  type TimKiemOut,
} from "@gikky/api-client";

import type { SortKhanDai } from "./khan-dai";
import { GOC_TRINH_DUYET } from "./tai-khoan";

/** Server component gọi **THẲNG** Django, không vòng qua cổng 3000 của chính mình.
 *
 * PLAN 8.4 điểm 3 đã có chiều Django → `localhost:3000` (on-demand revalidate); thêm
 * chiều ngược Node → Node là công thức tự đói tài nguyên khi Phase 3 bật ISR. Đường
 * same-origin `/api/*` (rewrites trong `next.config.ts`) để dành cho lời gọi chạy TRONG
 * TRÌNH DUYỆT, nơi cookie phiên cần đi kèm.
 */
export const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

/** Tuổi cache của trang mạch — PLAN 8.4 điểm 2, *"revalidate nền 1 giờ"*.
 *
 * Một giờ là để bắt hai sự kiện **KHÔNG có signal**: cú lật BÃO→CẶN do 72h trôi, và bình
 * luận mới trên một trang nguội. Mọi sự kiện CÓ signal (nối/sửa/xoá mốc, trích/gỡ trích,
 * đóng/mở/khoá mạch) đi đường on-demand — `core/revalidate.py` → `app/lam-moi-cache`.
 *
 * ⚠ Con số này còn **một bản thứ hai**, và nó bắt buộc: `export const revalidate` của Next
 * phải là literal phân tích tĩnh được, nên `app/m/[slugId]/page.tsx` viết `3600` bằng tay.
 * Bản sao ấy có chuông — `e2e/don-vi/cache-mach.spec.ts` đọc cả hai file và đỏ nếu lệch.
 */
export const TUOI_CACHE_MACH = 3600;

/** Mọi lời gọi API của 1c đi qua đây — **KHÔNG dùng `client` singleton**.
 *
 * `@gikky/api-client` cố ý không xuất subpath `./client`, và `scripts/rao-can-client.mjs`
 * chặn nó lọt ra qua `index.ts`. Lý do (CLAUDE.md): `client` là object dùng chung CẢ TIẾN
 * TRÌNH Node — ai gọi `client.setConfig({ headers: { cookie } })` rồi await là mở đường
 * cho request của user B đọc dữ liệu bằng session của user A, hỏng im lặng, trang vẫn
 * 200. Cách đúng và duy nhất hiện có: truyền `baseUrl` (và sau này `headers`) **theo
 * từng lời gọi**, đúng như mọi hàm dưới đây làm.
 *
 * **Hai hằng, khác nhau đúng một thứ: chính sách cache** (Phase 3, PLAN 8.4). Trang mạch
 * chọn giữa chúng bằng tham số `doc` — xem `ChinhSachDoc`. Feed/sub/hồ sơ giữ nguyên
 * `no-store`: chúng chưa có cửa on-demand revalidate nào, nên một bản cache 1 giờ ở đó là
 * bài mới không lên feed trong một giờ.
 *
 * ⚠ **Vì sao `CHUNG_ISR` phải đi qua `fetch:` chứ không khai thẳng `next:`.** Client mà
 * `@hey-api/openapi-ts` sinh ra khai `next?: never` và nói rõ *"The `next` options won't
 * have any effect"* — nó dựng `new Request(url, init)` rồi `fetch(request)`, mà hàm dựng
 * `Request` **vứt** mọi khoá không chuẩn, nên `next` chết ngay tại đó. Cửa còn lại là
 * `fetch:`, một tuỳ chọn hợp lệ của chính client ấy: ta gọi `fetch` toàn cục (bản Next đã
 * vá) với `init.next`, và bản vá đọc `init.next.revalidate` **trước** khi ngó tới
 * `Request`. Đây là chỗ duy nhất trong repo được phép làm vậy.
 *
 * ⚠ **Và đây là lý do hàng rào `THIEU_BASE_URL` phải hiểu ngoặc LỒNG.** Hằng dưới có
 * object trong object, còn bản trước của `coBaseUrl` (`e2e/don-vi/type-frontend.spec.ts`)
 * dò `\{([^{}]*)\}` — một tầng ngoặc, nên nó không thấy `baseUrl` ở đây và báo vi phạm cho
 * **mọi** lời gọi spread hằng này. Lối thoát rẻ là một dòng giấy miễn trừ, mà đó đúng là
 * luật chống rò session không được có giấy nào. Hàng rào đã học đếm ngoặc cân bằng; đừng
 * làm phẳng hằng này để né nó.
 */
const CHUNG = { baseUrl: API_ORIGIN, cache: "no-store" } as const;
const CHUNG_ISR = {
  baseUrl: API_ORIGIN,
  fetch: (yeu_cau: RequestInfo | URL) =>
    fetch(yeu_cau, { next: { revalidate: TUOI_CACHE_MACH } }),
} as const;

/** Trang mạch có hai biến thể route (PLAN 8.4 điểm 1) và chúng đọc Django khác nhau.
 *
 * - `"isr"` — biến thể khách (`/m/<slug>-<id>`): fetch đi vào **data cache** của Next, nên
 *   lượt tải thứ hai trong vòng một giờ không chạm Django. Đây là chỗ ba nợ
 *   `N+1-NGAN-KEO` · `DANG-DOC-ROUND-TRIP` · `ISR-BIEN-THE-ROUTE` được trả: số lời gọi
 *   không giảm, nhưng chúng thôi lặp lại ở mỗi lượt xem.
 * - `"tuoi-song"` — biến thể có cookie phiên (`/m-phien/...`, do `middleware.ts` rewrite
 *   tới): người vừa nối mốc phải thấy mốc của mình **ngay**, không phải đợi hết giờ.
 *
 * Kiểu chuỗi chứ không phải một object tuỳ chọn truyền thẳng xuống hàm API: object đó sẽ
 * là một lời mời nhét `headers: { cookie }` vào, tức forward session của người này vào một
 * lời gọi có thể đang được cache cho người kia.
 */
export type ChinhSachDoc = "isr" | "tuoi-song";

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

/** Trang mạch. `doc` chọn biến thể cache — xem `ChinhSachDoc`.
 *
 * **Hai lời gọi viết thẳng, không đi qua một biến "tuỳ chọn" chung.** Đó không phải thừa:
 * hàng rào `THIEU_BASE_URL` tìm `baseUrl` qua **một lớp spread của một hằng module**, nên
 * `xemMach({ ...tuyChon, … })` với `tuyChon` là tham số hàm là một lời gọi hàng rào không
 * đọc được — và luật ấy không có giấy miễn trừ nào. Cùng lý lẽ với hai lời gọi song sinh ở
 * `feedTho` (vá E2). Bốn hàm dưới đây đều theo khuôn này.
 */
export async function docMach(
  machId: number,
  doc: ChinhSachDoc,
): Promise<MachChiTietOut | null> {
  const kq =
    doc === "isr"
      ? await xemMach({ ...CHUNG_ISR, path: { mach_id: machId } })
      : await xemMach({ ...CHUNG, path: { mach_id: machId } });
  return lay(kq, `xem_mach(${machId})`);
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
  doc: ChinhSachDoc,
  trang: { offset?: number; cursor?: string } = {},
  limit = 50,
): Promise<TrangCursor<KhanDaiOut | null>> {
  const la_hay_nhat = sort === "hay_nhat";
  const xin = cursorHopLe(trang.cursor);
  const offset_xin = trang.offset ?? 0;
  const tham_so_bi_bo = thamSoPhanTrangBiBo(sort, trang);
  const goi = (cursor: string | null) => {
    const path = { mach_id: machId };
    const query = {
      sort,
      limit,
      offset: la_hay_nhat ? offset_xin : 0,
      cursor: la_hay_nhat ? null : cursor,
    };
    if (doc === "isr") return lietKeBinhLuanMach({ ...CHUNG_ISR, path, query });
    return lietKeBinhLuanMach({ ...CHUNG, path, query });
  };
  const viec = `liet_ke_binh_luan_mach(${machId}, ${sort})`;

  const kq = await goi(la_hay_nhat ? null : xin);
  if (maLoi(kq, CURSOR_KHONG_HOP_LE)) {
    return { du_lieu: lay(await goi(null), viec), cursorHong: true };
  }
  return { du_lieu: lay(kq, viec), cursorHong: tham_so_bi_bo };
}

/** Khối "Câu đáng đọc" của mặt CẶN — PLAN 5.5, `?dang_doc=1`.
 *
 * Lời gọi **RIÊNG**, không dùng lại trang khán đài đang hiện: hai thứ có thứ tự khác nhau
 * (tập này sắp theo wilson thuần, khán đài sắp theo sort người dùng chọn) và tập này
 * không phân trang. Trộn chúng lại là cách "câu đáng đọc" âm thầm biến thành "10 dòng
 * đầu của trang đang xem", tức đúng chỗ 1c đã hụt — nhãn trên nút hứa một thứ mà cú bấm
 * không giao.
 *
 * **Cái giá, nói thẳng: một round-trip nữa mỗi lượt bung khán đài.** Đó là nợ có tên
 * `DANG-DOC-ROUND-TRIP` (`plans/2026-08-22-phase-1d-va3.md` §4) — **trả 2026-08-23**: với
 * `doc = "isr"` lời gọi này nằm trong data cache của Next, nên nó chỉ chạm Django một lần
 * mỗi giờ (hoặc sau một lượt on-demand revalidate) thay vì mỗi lượt bung. Số lời gọi
 * không đổi; số lần đi tới Django thì đổi, và đó mới là thứ nợ ấy nói tới.
 */
export async function docCauDangDoc(
  machId: number,
  doc: ChinhSachDoc,
): Promise<KhanDaiOut | null> {
  const path = { mach_id: machId };
  const query = { dang_doc: true };
  const kq =
    doc === "isr"
      ? await lietKeBinhLuanMach({ ...CHUNG_ISR, path, query })
      : await lietKeBinhLuanMach({ ...CHUNG, path, query });
  return lay(kq, `cau_dang_doc(${machId})`);
}

/** Lát cắt ngăn kéo của MỘT mốc.
 *
 * Nợ `N+1-NGAN-KEO` (`plans/2026-08-22-phase-1d-va3.md` §4) — **trả 2026-08-23 theo đường
 * ISR, không theo đường gộp endpoint**: trang mạch vẫn gọi một lần cho mỗi mốc, nhưng với
 * `doc = "isr"` mỗi lời gọi ấy có bản cache riêng, nên mạch 40 mốc chạm Django 40 lần cho
 * **cả giờ** chứ không phải cho mỗi người đọc. `chayCoTran` vẫn giữ trần đồng thời —
 * lượt làm mới cache đầu tiên vẫn là 40 lời gọi thật.
 */
export async function docNganKeo(
  mocId: number,
  doc: ChinhSachDoc,
): Promise<NganKeoOut | null> {
  const path = { moc_id: mocId };
  const kq =
    doc === "isr"
      ? await lietKeBinhLuanMoc({ ...CHUNG_ISR, path })
      : await lietKeBinhLuanMoc({ ...CHUNG, path });
  return lay(kq, `liet_ke_binh_luan_moc(${mocId})`);
}

export async function docHoSo(username: string, limit = 20): Promise<HoSoOut | null> {
  return lay(
    await xemHoSo({ ...CHUNG, path: { username }, query: { limit } }),
    `xem_ho_so(${username})`,
  );
}

/** Ba tab của feed — PLAN 5.9 (hai tab đầu) + plan con 1d §2.5.4 (tab thứ ba).
 *
 * Khoá `tab` cũng chính là giá trị `?tab=` trên URL. Trạng thái nằm trên URL chứ không
 * trong state React: feed là thứ người ta gửi link cho nhau, và PLAN nguyên tắc 7 cấm
 * "tự đổi sort ngầm" — sort sống trên URL thì không có chỗ nào để đổi ngầm.
 *
 * **`nhieu-diem` KHÔNG phải feed Hot mà PLAN mục 4 loại.** Cái bị loại là "mốc mới bump
 * bài lên feed Hot" — cơ chế dạy tác giả băm mốc. Tab này sắp theo điểm **bài gốc**
 * (`Mach.diem_bai_goc`), con số mà nối thêm mốc không đụng tới.
 */
export const TAB_FEED = ["moi", "dang-dien-ra", "nhieu-diem"] as const;
export type TabFeed = (typeof TAB_FEED)[number];
export const TAB_MAC_DINH: TabFeed = "moi";
export const NHAN_TAB: Readonly<Record<TabFeed, string>> = {
  moi: "Mới nhất",
  "dang-dien-ra": "Đang diễn ra",
  "nhieu-diem": "Nổi bật",
};

/** Tham số query của hai feed, **SUY từ TS client** — không gõ lại (W9, PLAN 8.3).
 *
 * `LietKeFeedMoiData` là kiểu do `pnpm codegen` sinh ra từ `openapi.json`, và từ W9 thì
 * `sort`/`khoang` ở đó là **enum** chứ không phải `string` trơn (`api/api/feeds.py` khai
 * `Literal`). Trước đó frontend phải tự viết `"tu_nhien" | "nhieu_diem"` và
 * `["ngay","tuan","thang","tat_ca"]` — bản sao thứ hai của hợp đồng API, thứ trôi khỏi
 * bản gốc mà không có gì đỏ, đúng loài `type-frontend.spec.ts` sinh ra để chặn (nó không
 * bắt được vì nó chỉ soi TÊN schema, không soi giá trị enum — W9 thêm luật cho nó).
 *
 * `lietKeFeedDangDienRa` có cùng bộ tham số; lấy một cửa làm nguồn là đủ, và
 * `e2e/don-vi/api-feed.spec.ts` ghim rằng hai cửa vẫn khớp nhau.
 */
type ThamSoFeed = NonNullable<LietKeFeedMoiData["query"]>;
type SortFeedApi = NonNullable<ThamSoFeed["sort"]>;

/** `?sort=` mà từng tab gửi xuống API. Bảng chứ không phải `if`: thêm tab mà quên sort là
 * lỗi biên dịch ("thiếu thuộc tính"), không phải một tab lặng lẽ trả feed Mới.
 *
 * `export` để `e2e/don-vi/type-frontend.spec.ts` đối chiếu được VALUE của nó với `enum`
 * trong `openapi.json` (W9). Trình biên dịch đã ghim `SortFeedApi`, nhưng nó chỉ ghim
 * *bảng khớp kiểu*; bài đo kia ghim thêm rằng **mọi** giá trị API cho phép đều có tab
 * dùng tới — API mọc thêm một sort mà UI không bày ra cửa nào là một tính năng chết. */
export const SORT_API: Readonly<Record<TabFeed, SortFeedApi>> = {
  moi: "tu_nhien",
  "dang-dien-ra": "tu_nhien",
  "nhieu-diem": "nhieu_diem",
};

/** Tab nào cho chọn khoảng thời gian. Chỉ "Nhiều điểm nhất" — với hai tab kia, "top ngày"
 * không có nghĩa gì thêm ngoài việc cắt bớt feed. API vẫn nhận `khoang` cho mọi sort
 * (nó không được nuốt im lặng tham số nào), UI thì chỉ bày ra chỗ nó có ích. */
export function tabCoKhoang(tab: TabFeed): boolean {
  return tab === "nhieu-diem";
}

export function docTab(gia_tri: string | string[] | undefined): TabFeed {
  const t = Array.isArray(gia_tri) ? gia_tri[0] : gia_tri;
  return (TAB_FEED as readonly string[]).includes(t ?? "") ? (t as TabFeed) : TAB_MAC_DINH;
}

/** Bốn khoảng của tab "Nhiều điểm nhất" — `?khoang=`. Ranh giới là nửa đêm **giờ VN**;
 * luật nằm ở `api/core/thoi_gian.py::moc_khoang_vn`.
 *
 * **Kiểu SUY từ TS client, danh sách SUY từ bảng nhãn** *(W9, lượt vá 2)*. Trước đó đây
 * là `["ngay","tuan","thang","tat_ca"] as const` gõ tay — API mọc thêm một khoảng thì
 * frontend không biết, bỏ bớt một khoảng thì frontend vẫn bày ra một nút gọi đi 400.
 *
 * Bảng nhãn là chỗ duy nhất còn liệt kê bốn giá trị, và nó **bị `Record<KhoangFeed, …>`
 * ép đủ hai chiều**: thiếu một khoá là lỗi biên dịch, thừa một khoá cũng vậy. Mảng thì
 * `Object.keys` sinh ra, nên nó không thể lệch với bảng nhãn — và thứ tự bày ra UI là
 * thứ tự viết ở đây, không phải thứ tự Django trả về. */
export type KhoangFeed = NonNullable<ThamSoFeed["khoang"]>;
export const NHAN_KHOANG: Readonly<Record<KhoangFeed, string>> = {
  ngay: "Hôm nay",
  tuan: "Tuần",
  thang: "Tháng",
  tat_ca: "Mọi thời điểm",
};
export const KHOANG_FEED = Object.keys(NHAN_KHOANG) as readonly KhoangFeed[];
export const KHOANG_MAC_DINH: KhoangFeed = "tat_ca";

/** Đọc `?khoang=` từ URL. Giá trị lạ → `tat_ca`.
 *
 * Quy rác về mặc định **ở tầng URL** chứ không đẩy xuống API: API trả 400 cho khoảng sai
 * (nó không được nuốt im lặng), và cả trang chủ sẽ chết vì một query string ai đó gõ tay.
 * Cùng lý lẽ với `docSort` của khán đài — PLAN nguyên tắc 7 cấm đổi lựa chọn HỢP LỆ của
 * người dùng, không cấm quy rác về mặc định.
 */
export function docKhoang(gia_tri: string | string[] | undefined): KhoangFeed {
  const k = Array.isArray(gia_tri) ? gia_tri[0] : gia_tri;
  return (KHOANG_FEED as readonly string[]).includes(k ?? "")
    ? (k as KhoangFeed)
    : KHOANG_MAC_DINH;
}

/** `?khoang=` mà tab này được phép GỬI LÊN API — vá V2, 2026-08-22.
 *
 * `khoang` sống trên URL ở **mọi** tab (`components/feed.tsx`: đổi tab không được làm
 * rơi lựa chọn của người dùng), nhưng nó chỉ được ÁP DỤNG ở tab thật sự bày ra hàng chọn
 * khoảng. Hai chuyện khác nhau, và gộp chúng lại là hỏng theo một trong hai chiều:
 *
 * - gộp về phía URL (bản trước bản vá): `khoang` bị xoá khỏi href của tab khác ⇒ vòng
 *   `nhieu-diem&khoang=tuan` → `moi` → `nhieu-diem` rơi về `tat_ca`;
 * - gộp về phía API (cách sửa quá tay): `?tab=moi&khoang=tuan` gõ tay trên URL sẽ **lọc
 *   thật** — API cố ý cho `khoang` áp cho mọi sort (`api/feeds.py::_kiem_sort_khoang`,
 *   nó không được nuốt im lặng tham số nào). Feed teo lại mà trên màn hình không có chữ
 *   nào nói ra và không có control nào tắt được: một **bộ lọc tàng hình**, đâm PLAN
 *   nguyên tắc 7 nặng hơn hẳn cái lỗi đang vá.
 *
 * Hàm thuần, tách riêng để `e2e/don-vi/api-feed.spec.ts` ghim được mà không cần mạng.
 */
export function khoangGuiLenApi(tab: TabFeed, khoang: KhoangFeed): KhoangFeed {
  return tabCoKhoang(tab) ? khoang : KHOANG_MAC_DINH;
}

/** Header của một chuyên mục. `null` khi slug không tồn tại (404) — trang `/s/<sub>` phải
 * `notFound()` chứ không hiện một cái header trống. */
export async function docSub(slug: string): Promise<SubChiTietOut | null> {
  return lay(await xemSub({ ...CHUNG, path: { slug } }), `xem_sub(${slug})`);
}

/** MỌI chuyên mục, hỏi thẳng `GET /subs` — sidebar và `app/sitemap.ts` dùng chung.
 *
 * **Danh sách slug KHÔNG được ghi cứng ở frontend** (PLAN mục 7, chốt cùng endpoint này).
 * Trước lượt vá, đây là hằng `SUB_KHOI_DIEM = ["chung-khoan", "crypto"]` nuôi cả hai chỗ:
 *
 * - mở sub thứ ba qua admin ⇒ **cả sidebar lẫn `sitemap.xml` cùng bỏ sót nó**, im lặng,
 *   200 ở mọi cửa — với sản phẩm sống bằng index (PLAN mục 1) đó là một chuyên mục không
 *   bao giờ được Google biết tới;
 * - đổi slug trong admin ⇒ sidebar âm thầm bỏ mục đó (404 → lọc khỏi danh sách) trong khi
 *   sitemap vẫn khai `/s/<slug cũ>` là URL sống. Hai chỗ hỏng theo hai kiểu khác nhau, và
 *   không chỗ nào kêu.
 *
 * Cũng hết luôn N+1: một lời gọi thay cho `Promise.all` trên từng slug.
 *
 * `null` không có nghĩa gì ở đây — `GET /subs` không có đường 404 nào — nên `lay()` trả
 * `null` chỉ có thể là hỏng cấu trúc, và `?? []` sẽ biến nó thành "chưa có chuyên mục
 * nào" (đúng loài lỗi mà vá F1 diệt ở `docFeed`). Vì thế: ném.
 */
export async function docCacSub(): Promise<SubChiTietOut[]> {
  const ra = lay(await lietKeSub({ ...CHUNG }), "liet_ke_sub");
  if (ra === null) {
    throw new LoiApi(
      "liet_ke_sub",
      404,
      "404 trên GET /subs — endpoint này không có đường 404 hợp lệ nào, nên đây là " +
        "hỏng cấu trúc chứ không phải 'chưa có chuyên mục nào'",
    );
  }
  return ra;
}

/** Cùng danh sách sub, nhưng hỏi **từ TRÌNH DUYỆT** — cho thanh điều hướng.
 *
 * Nợ `NAV-GHI-CUNG` (`components/chrome.tsx`, giấy miễn trừ ở
 * `e2e/don-vi/khong-ghi-cung-sub.spec.ts`) — **trả 2026-08-23**. Nợ ấy nói: nav nằm trong
 * layout gốc nên nó render trên MỌI trang, kể cả `/luat`; mà `/luat` phải là route TĨNH
 * (đường thoát của `error.tsx`), nên một lời gọi API **ở phía server** tại đó làm đường
 * thoát hỏng cùng lúc với thứ nó thoát khỏi.
 *
 * Lối ra là lối `PhienProvider` đã đi: hỏi ở trình duyệt. `/luat` giữ nguyên `○`,
 * `pnpm build` vẫn không cần Django sống, và danh sách sub thôi là hai chuỗi gõ cứng.
 *
 * **Cái giá, nói thẳng:** link sub trên thanh nav **không có trong HTML lần đầu** — bot đọc
 * trang không thấy chúng ở đó. Chấp nhận được vì cùng những link ấy đã nằm trong HTML
 * server-render ở **sidebar** (`/` và `/s/*`) và trong `sitemap.xml`; nav là tiện cho
 * người, không phải đường duy nhất để Google tìm ra một chuyên mục.
 *
 * `baseUrl` là **chuỗi rỗng** (same-origin, qua `rewrites`), không phải `API_ORIGIN`: đây
 * là lời gọi chạy trong trình duyệt — xem `lib/tai-khoan.ts::GOC_TRINH_DUYET`.
 */
export async function docCacSubOTrinhDuyet(): Promise<SubChiTietOut[]> {
  const kq = await lietKeSub({ baseUrl: GOC_TRINH_DUYET });
  return kq.data ?? [];
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
  opts: { cursor?: string; limit?: number; khoang?: KhoangFeed } = {},
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
  opts: { cursor?: string; limit?: number; khoang?: KhoangFeed } = {},
): Promise<TrangCursor<FeedOut | null>> {
  return feedTho(tab, { ...opts, sub });
}

async function feedTho(
  tab: TabFeed,
  opts: { sub?: string; cursor?: string; limit?: number; khoang?: KhoangFeed },
): Promise<TrangCursor<FeedOut | null>> {
  const xin = cursorHopLe(opts.cursor);
  const cursor_bi_bo = xin === null && opts.cursor !== undefined;
  // Hai lời gọi TRỰC TIẾP thay cho `const ham = tab === "moi" ? … : …` rồi `ham(…)` (vá
  // E2, 2026-08-22). Hàm API đi qua một biến trung gian là hàm rào "mọi lời gọi đều
  // truyền `baseUrl`" không còn thấy lời gọi đó — nó tìm callee theo TÊN. Chỗ này không
  // sai `baseUrl`, nhưng nó là cái lỗ khiến hàng rào không thể nói "mọi".
  //
  // Tab thứ ba đi qua CÙNG endpoint với tab "Mới" và chỉ đổi `sort` (plan con 1d §2.1 mở
  // sort đó cho cả hai feed): "Nhiều điểm nhất" nghĩa là top trên **mọi** bài, mà tập
  // "mọi bài" đúng là tập của `/feeds/moi`.
  const goi = (cursor: string | null) => {
    const q = {
      sub: opts.sub ?? null,
      cursor,
      limit: opts.limit ?? 20,
      sort: SORT_API[tab],
      // Không phải `opts.khoang ?? KHOANG_MAC_DINH` (vá V2): `khoang` có mặt trên URL của
      // MỌI tab, nhưng tab không bày ra control chọn khoảng thì không được gửi nó lên —
      // xem `khoangGuiLenApi`.
      khoang: khoangGuiLenApi(tab, opts.khoang ?? KHOANG_MAC_DINH),
    };
    if (tab === "dang-dien-ra") return lietKeFeedDangDienRa({ ...CHUNG, query: q });
    return lietKeFeedMoi({ ...CHUNG, query: q });
  };
  const viec = `feed ${tab}`;

  const kq = await goi(xin);
  if (maLoi(kq, CURSOR_KHONG_HOP_LE)) {
    return { du_lieu: lay(await goi(null), viec), cursorHong: true };
  }
  return { du_lieu: lay(kq, viec), cursorHong: cursor_bi_bo };
}

/** Số kết quả mỗi trang tìm kiếm. */
export const SO_KET_QUA_MOI_TRANG = 20;

/** `GET /tim-kiem` — Phase 7.
 *
 * **`cache: "no-store"` là bắt buộc, không phải mặc định đi theo `CHUNG`.** Kết quả phụ
 * thuộc trạng thái ẩn của nội dung: một trang tìm kiếm được cache là một trang phục vụ
 * lại bài mod vừa gỡ, và nó không có cửa on-demand revalidate nào để chữa.
 *
 * `null` khi 404 — nghĩa duy nhất ở đây là `?sub=` gõ sai. Trang tìm kiếm hiện câu giải
 * thích chứ không `notFound()`: người dùng vẫn đang ở đúng trang họ muốn, chỉ bộ lọc là
 * sai, nên ném cả trang đi là làm mất luôn ô nhập và câu họ vừa gõ.
 */
export async function docTimKiem(opts: {
  q: string;
  sub?: string;
  sort?: "lien_quan" | "moi";
  offset?: number;
}): Promise<TimKiemOut | null> {
  return lay(
    await timKiem({
      ...CHUNG,
      query: {
        q: opts.q,
        sub: opts.sub ?? null,
        sort: opts.sort ?? "lien_quan",
        offset: opts.offset ?? 0,
        limit: SO_KET_QUA_MOI_TRANG,
      },
    }),
    `tim_kiem(${opts.q})`,
  );
}
