import { expect, test } from "@playwright/test";

import { LoiApi, docFeed, docFeedSub } from "../../lib/api";

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

function datFetch(tra_loi: TraLoi) {
  so_lan_goi = 0;
  globalThis.fetch = (async () => {
    so_lan_goi += 1;
    return new Response(JSON.stringify(tra_loi.than), {
      status: tra_loi.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
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
