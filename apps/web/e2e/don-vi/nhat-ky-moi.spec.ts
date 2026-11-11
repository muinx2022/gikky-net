import { expect, test } from "@playwright/test";

import { API_ORIGIN, LoiApi, docNhatKyMoiTacGia } from "../../lib/api";

/** Khối "Nhật ký mới" của `/` (plan `2026-11-11-nhat-ky-moi-moi-tac-gia-mot-bai.md`).
 *
 * Phép "mỗi tác giả một bài" nằm ở API (`GET /feeds/nhat-ky-moi-tac-gia`, bài đo ở
 * `api/tests/test_api_nhat_ky_moi_tac_gia.py`), nên phía web chỉ còn hai điều đáng ghim —
 * và cả hai là HÀNH VI của `docNhatKyMoiTacGia`, đo bằng cách thay `globalThis.fetch`:
 *
 *  1. nó gọi ĐÚNG endpoint, với `limit` đúng, tới `API_ORIGIN` (không cổng 3000), không cache;
 *  2. endpoint này không có đường 404 hợp lệ ⇒ 404/5xx/mất mạng phải NÉM `LoiApi`, không quy
 *     về "feed rỗng" (cùng luật vá F1 của `docFeed`). Feed rỗng THẬT (200) vẫn trả rỗng.
 *
 * Bản đầu của lượt này là hàng rào grep trên `app/page.tsx` ("có chuỗi `limit: …`"); nó vỡ
 * khi ai đó xuống dòng khác kiểu và né được bằng một biến trung gian, nên đã thay bằng bài
 * đo hành vi. Việc `/` thật sự vẽ đúng khối nằm ở `e2e/trang-chu-v2.spec.ts` (nhóm U).
 */

type Goi = { url: string; cache: string | undefined };

let fetch_that: typeof globalThis.fetch;
let da_goi: Goi[] = [];

function datFetch(tra: { status: number; than: unknown } | "chet_mang") {
  da_goi = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    da_goi.push({
      url: typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      cache: init?.cache ?? req?.cache,
    });
    if (tra === "chet_mang") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(tra.than), {
      status: tra.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
}

const THE = (id: number, username: string) => ({
  id,
  slug: `bai-${id}`,
  title: `Bài ${id}`,
  author: { username, display_name: username, avatar_url: null },
});

test.beforeEach(() => {
  fetch_that = globalThis.fetch;
});
test.afterEach(() => {
  globalThis.fetch = fetch_that;
});

test("gọi ĐÚNG endpoint với `limit`, tới API_ORIGIN, và trả nguyên thứ API trả", async () => {
  const than = { items: [THE(3, "a"), THE(2, "b")], cursor_ke_tiep: null };
  datFetch({ status: 200, than });
  const ra = await docNhatKyMoiTacGia(8);

  expect(ra).toEqual(than);
  expect(da_goi).toHaveLength(1);
  const u = new URL(da_goi[0].url);
  expect(u.origin).toBe(new URL(API_ORIGIN).origin);
  expect(u.pathname).toBe("/api/v1/feeds/nhat-ky-moi-tac-gia");
  expect([...u.searchParams.keys()]).toEqual(["limit"]);
  expect(u.searchParams.get("limit")).toBe("8");

  // `limit` là tham số THẬT, không phải hằng ngầm: đổi giá trị ⇒ đổi trên dây.
  datFetch({ status: 200, than });
  await docNhatKyMoiTacGia(3);
  expect(new URL(da_goi[0].url).searchParams.get("limit")).toBe("3");
});

test("không cache (`no-store`): bài mới đăng phải lên khối ngay", async () => {
  datFetch({ status: 200, than: { items: [], cursor_ke_tiep: null } });
  await docNhatKyMoiTacGia(8);
  expect(da_goi[0].cache).toBe("no-store");
});

test("feed rỗng THẬT (200) vẫn trả rỗng — vế chống rỗng của các bài NÉM bên dưới", async () => {
  datFetch({ status: 200, than: { items: [], cursor_ke_tiep: null } });
  expect((await docNhatKyMoiTacGia(8)).items).toEqual([]);
});

test("404 phải NÉM LoiApi nói rõ 'hỏng cấu trúc', không quy về feed rỗng", async () => {
  datFetch({ status: 404, than: { detail: "Not Found" } });
  const loi = await docNhatKyMoiTacGia(8).catch((e: unknown) => e);
  expect(loi).toBeInstanceOf(LoiApi);
  expect((loi as LoiApi).message).toContain("hỏng cấu trúc");
});

test("400 (limit sai) và 500 cũng NÉM", async () => {
  datFetch({ status: 400, than: { detail: "limit phải nằm trong 1..20", code: "tham_so_khong_hop_le" } });
  await expect(docNhatKyMoiTacGia(99)).rejects.toThrow(LoiApi);
  datFetch({ status: 500, than: { detail: "toang", code: "loi_may_chu" } });
  await expect(docNhatKyMoiTacGia(8)).rejects.toThrow(LoiApi);
});

test("mất mạng (fetch chết trước khi có HTTP) cũng NÉM, không nuốt thành rỗng", async () => {
  datFetch("chet_mang");
  await expect(docNhatKyMoiTacGia(8)).rejects.toThrow(LoiApi);
});
