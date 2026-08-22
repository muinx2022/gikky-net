import { expect, test } from "@playwright/test";

import {
  KHOANG_FEED,
  LoiApi,
  TAB_FEED,
  docCacSub,
  docFeed,
  docFeedSub,
  khoangGuiLenApi,
  tabCoKhoang,
} from "../../lib/api";

/** Hàng rào cho vá F1: **feed không lọc sub thì `null` là hỏng, không phải "trống".**
 *
 * `GET /feeds/moi` và `GET /feeds/dang-dien-ra` chỉ có MỘT đường 404 —
 * `sub_khong_ton_tai` (`api/api/feeds.py`) — nên khi không truyền `?sub=` thì một 404 chỉ
 * có thể là hỏng cấu trúc: endpoint đổi tên, prefix bị proxy nuốt, `API_ORIGIN` trỏ nhầm
 * origin. Trang chủ quy ca đó về `{ items: [] }` là nói "Chưa có bài nào ở đây" với HTTP
 * **200** trong khi DB đầy mạch — không log, `error.tsx` không chạy, monitoring thấy 200.
 *
 * Bài đo chạy được **không cần mạng và không cần Django**: nó thay `globalThis.fetch`
 * bằng một hàm trả sẵn phản hồi. Đó là lý do nó nằm ở nhóm `don-vi` chứ không phải bộ
 * chromium — hai agent chạy song song không giành cổng nào ở đây.
 */

type TraLoi = { status: number; than: unknown };

let fetch_that: typeof globalThis.fetch;
let so_lan_goi = 0;
/** URL của mọi lời gọi kể từ `datFetch` gần nhất — dùng để soi tham số ĐÃ GỬI LÊN. */
let url_da_goi: string[] = [];

function datFetch(tra_loi: TraLoi) {
  so_lan_goi = 0;
  url_da_goi = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    so_lan_goi += 1;
    url_da_goi.push(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url,
    );
    return new Response(JSON.stringify(tra_loi.than), {
      status: tra_loi.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
}

/** `?khoang=` thật sự đã đi lên dây, hoặc `null` khi không có tham số đó. */
function khoangDaGui(): string | null {
  expect(url_da_goi).toHaveLength(1);
  return new URL(url_da_goi[0]).searchParams.get("khoang");
}

const FEED_RONG = { items: [], cursor_ke_tiep: null };
const FEED_MOT_MACH = {
  items: [
    {
      id: 1,
      slug: "mot-mach",
      title: "Một mạch",
      status: "open",
      entry_count: 2,
      comment_count: 0,
      created_at: "2026-08-22T00:00:00Z",
      last_entry_at: "2026-08-22T00:00:00Z",
      ket_qua: null,
      sub: "chung-khoan",
      author: { username: "ai-do", display_name: "Ai Đó" },
    },
  ],
  cursor_ke_tiep: null,
};
const THAN_404 = { detail: "Không có sub 'khong-co'.", code: "sub_khong_ton_tai" };

test.beforeEach(() => {
  fetch_that = globalThis.fetch;
});

test.afterEach(() => {
  globalThis.fetch = fetch_that;
});

test("F1 — feed KHÔNG lọc sub: 404 phải NÉM, không quy về feed rỗng", async () => {
  datFetch({ status: 404, than: THAN_404 });
  // `rejects` chứ không try/catch: try/catch xanh cả khi hàm trả về bình thường.
  await expect(docFeed("moi")).rejects.toThrow(LoiApi);
  await expect(docFeed("dang-dien-ra")).rejects.toThrow(LoiApi);
  expect(so_lan_goi).toBeGreaterThan(0);
});

test("F1 — lỗi ném ra nói RA lý do, không phải một 404 trần", async () => {
  datFetch({ status: 404, than: THAN_404 });
  const loi = await docFeed("moi").catch((e: unknown) => e);
  expect(loi).toBeInstanceOf(LoiApi);
  expect((loi as LoiApi).message).toContain("hỏng cấu trúc");
});

test("F1 — nhánh CÓ sub vẫn trả null: 404 ở đó có nghĩa thật (sub không tồn tại)", async () => {
  datFetch({ status: 404, than: THAN_404 });
  const { du_lieu } = await docFeedSub("khong-co", "moi");
  // Vế này là thứ giữ cho bản vá không thành "ném ở mọi nơi": `/s/[sub]` cần `null` để
  // gọi `notFound()` — 404 thật, không phải 500.
  expect(du_lieu).toBeNull();
});

test("F1 — vế chống rỗng: cùng bộ stub, ca 200 vẫn chảy qua và trả dữ liệu", async () => {
  // Thiếu bài này thì ba bài trên vẫn xanh kể cả khi `docFeed` ném với MỌI phản hồi —
  // tức hàng rào biến thành "hàm này luôn hỏng" mà không ai thấy.
  datFetch({ status: 200, than: FEED_MOT_MACH });
  const { du_lieu, cursorHong } = await docFeed("moi");
  expect(du_lieu.items).toHaveLength(1);
  expect(du_lieu.items[0].slug).toBe("mot-mach");
  expect(cursorHong).toBe(false);

  datFetch({ status: 200, than: FEED_RONG });
  const rong = await docFeed("moi");
  // Feed rỗng THẬT vẫn là 200 và vẫn hiện "Chưa có bài nào ở đây" — vá F1 không đụng ca
  // này, và đó chính là ca mà bản cũ giả mạo.
  expect(rong.du_lieu.items).toEqual([]);
});

test("F1 — 500 của API cũng ném (không có nhánh nào nuốt lỗi 5xx thành rỗng)", async () => {
  datFetch({ status: 500, than: { detail: "toang", code: "loi_may_chu" } });
  await expect(docFeed("moi")).rejects.toThrow(LoiApi);
  await expect(docFeedSub("chung-khoan", "moi")).rejects.toThrow(LoiApi);
});

/* ---- V2 / B4: `khoang` trên URL ≠ `khoang` gửi lên API --------------------- */

/** Hàng rào cho **bộ lọc tàng hình** (vá V2, tiêu chí B4).
 *
 * `khoang` phải sống trên URL ở mọi tab để đổi tab không đánh rơi lựa chọn của người
 * dùng (`components/feed.tsx`). Nhưng API **cố ý** cho `khoang` áp cho MỌI sort
 * (`api/feeds.py::_kiem_sort_khoang` — nó không được nuốt im lặng tham số nào), nên gửi
 * kèm ở tab không bày ra control chọn khoảng là cắt feed mà trên màn hình không có gì
 * nói ra và không có gì tắt được: đâm PLAN nguyên tắc 7 nặng hơn hẳn lỗi đang vá.
 *
 * Bài đo soi **URL thật đã đi lên dây**, không soi giá trị trả về của một hàm thuần: đó
 * là chỗ duy nhất phân biệt được "đã cắt" với "định cắt".
 */
test("B4 — tab `moi`/`dang-dien-ra` KHÔNG gửi `khoang` dù URL có", async () => {
  for (const tab of ["moi", "dang-dien-ra"] as const) {
    datFetch({ status: 200, than: FEED_MOT_MACH });
    await docFeed(tab, { khoang: "tuan" });
    expect(khoangDaGui(), `${tab} đang gửi khoang lên API`).toBe("tat_ca");
  }
});

test("B4 — tab `nhieu-diem` thì VẪN gửi (không vá quá tay thành cấm hẳn)", async () => {
  datFetch({ status: 200, than: FEED_MOT_MACH });
  await docFeed("nhieu-diem", { khoang: "tuan" });
  expect(khoangDaGui()).toBe("tuan");
});

test("B4 — luật áp cho cả nhánh lọc sub, không riêng trang chủ", async () => {
  datFetch({ status: 200, than: FEED_MOT_MACH });
  await docFeedSub("chung-khoan", "moi", { khoang: "ngay" });
  expect(khoangDaGui()).toBe("tat_ca");

  datFetch({ status: 200, than: FEED_MOT_MACH });
  await docFeedSub("chung-khoan", "nhieu-diem", { khoang: "ngay" });
  expect(khoangDaGui()).toBe("ngay");
});

test("B4 — `khoangGuiLenApi` duyệt HẾT tổ hợp tab × khoảng, không chỉ ca đại diện", () => {
  // Bảng nhỏ (3 × 4) nên duyệt hết rẻ hơn chọn ca — và nó tự bắt được tab thứ tư thêm
  // vào mà không ai quyết định nó có khoảng hay không.
  for (const tab of TAB_FEED) {
    for (const k of KHOANG_FEED) {
      expect(khoangGuiLenApi(tab, k), `${tab}/${k}`).toBe(
        tabCoKhoang(tab) ? k : "tat_ca",
      );
    }
  }
});

/* ---- V8: `docCacSub` hỏi `GET /subs` -------------------------------------- */

test("V8 — `docCacSub` gọi ĐÚNG một lần vào /subs (hết N+1 theo từng slug)", async () => {
  datFetch({
    status: 200,
    than: [
      {
        slug: "a-moi-mo",
        ten: "Mới mở",
        mo_ta: "",
        so_mach: 0,
        created_at: "2026-08-22T00:00:00Z",
      },
    ],
  });
  const ra = await docCacSub();
  expect(so_lan_goi).toBe(1);
  expect(new URL(url_da_goi[0]).pathname).toBe("/api/v1/subs");
  // Sub thứ ba (không nằm trong danh sách ghi cứng cũ) đi thẳng ra ngoài — không có
  // bước lọc nào theo một mảng slug nữa.
  expect(ra.map((s) => s.slug)).toEqual(["a-moi-mo"]);
});

test("V8 — 404 trên /subs là hỏng cấu trúc: NÉM, không quy về 'chưa có sub nào'", async () => {
  // Cùng lý lẽ với F1. `GET /subs` không có đường 404 hợp lệ nào, nên `?? []` ở đây là
  // một sidebar trống và một `sitemap.xml` mất sạch URL sub — 200 ở cả hai cửa.
  datFetch({ status: 404, than: { detail: "?", code: "khong_tim_thay" } });
  await expect(docCacSub()).rejects.toThrow(LoiApi);
});
