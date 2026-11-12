import { expect, test } from "@playwright/test";

import { API_ORIGIN, LoiApi, docChuDeTuan, docFeedChuDe } from "../../lib/api";

/** Khối "Chủ đề tuần này" của rail phải (việc 14, đợt E — plan §4.7): hàm nạp `docChuDeTuan`.
 *
 * Ba điều đáng ghim, đo bằng HÀNH VI (thay `globalThis.fetch`), không bằng grep:
 *
 *  1. cùng lời gọi với khối tiêu điểm của `/` (`docFeedChuDe`: feed `moi`, `loai_mach=thao_luan`,
 *     `limit=5`, tới `API_ORIGIN`) và cùng phép chọn — chủ đề XUẤT BẢN sau cùng, KHÔNG phải phần tử
 *     đầu của feed (feed sắp theo `last_content_at`);
 *  2. API hỏng (5xx, 404, mất mạng) ⇒ `null` (khối ẩn), KHÔNG ném — khối phụ ở rail của mọi trang
 *     không được kéo trang mạch / hồ sơ thành 500;
 *  3. trong khi chính `docFeedChuDe` (trang chủ dùng) VẪN ném — luật vá F1 của `/` không đổi.
 */

let fetch_that: typeof globalThis.fetch;
let console_that: typeof console.error;
let da_goi: string[] = [];
let so_loi_log = 0;

function datFetch(tra: { status: number; than: unknown } | "chet_mang") {
  da_goi = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    da_goi.push(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    if (tra === "chet_mang") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(tra.than), {
      status: tra.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
}

const CHU_DE = (id: number, published_at: string) => ({
  id,
  slug: `chu-de-${id}`,
  title: `Chủ đề ${id}`,
  published_at,
  loai_mach: "thao_luan",
});

test.beforeEach(() => {
  fetch_that = globalThis.fetch;
  console_that = console.error;
  so_loi_log = 0;
  console.error = () => {
    so_loi_log += 1;
  };
});
test.afterEach(() => {
  globalThis.fetch = fetch_that;
  console.error = console_that;
});

// Thứ Tư 12/11/2026 10:00 giờ VN.
const BAY_GIO = new Date("2026-11-12T03:00:00Z");

test("cùng lời gọi với trang chủ: feed `moi`, thao_luan, limit 5, tới API_ORIGIN", async () => {
  datFetch({ status: 200, than: { items: [CHU_DE(1, "2026-11-10T01:00:00Z")], cursor_ke_tiep: null } });
  await docChuDeTuan(BAY_GIO);
  expect(da_goi).toHaveLength(1);
  const u = new URL(da_goi[0]);
  expect(`${u.origin}${u.pathname}`).toBe(`${API_ORIGIN}/api/v1/feeds/moi`);
  expect(u.searchParams.get("loai_mach")).toBe("thao_luan");
  expect(u.searchParams.get("limit")).toBe("5");

  datFetch({ status: 200, than: { items: [], cursor_ke_tiep: null } });
  await docFeedChuDe();
  expect(da_goi.map((x) => new URL(x).search)).toEqual([u.search]);
});

test("chọn chủ đề XUẤT BẢN sau cùng, không phải phần tử đầu feed; nhãn tuần theo `bayGio`", async () => {
  // Phần tử đầu (id 7) là chủ đề CŨ vừa được nối mốc — feed sắp theo `last_content_at`.
  datFetch({
    status: 200,
    than: {
      items: [CHU_DE(7, "2026-11-01T01:00:00Z"), CHU_DE(9, "2026-11-10T01:00:00Z"), CHU_DE(8, "2026-11-05T01:00:00Z")],
      cursor_ke_tiep: null,
    },
  });
  const ra = await docChuDeTuan(BAY_GIO);
  expect(ra?.mach.id).toBe(9);
  expect(ra?.trongTuan).toBe(true);

  // Cùng chủ đề, nhìn từ thứ Hai tuần sau ⇒ không còn "tuần này".
  datFetch({ status: 200, than: { items: [CHU_DE(9, "2026-11-10T01:00:00Z")], cursor_ke_tiep: null } });
  expect((await docChuDeTuan(new Date("2026-11-17T03:00:00Z")))?.trongTuan).toBe(false);
});

test("không có chủ đề nào ⇒ null (khối ẩn)", async () => {
  datFetch({ status: 200, than: { items: [], cursor_ke_tiep: null } });
  expect(await docChuDeTuan(BAY_GIO)).toBeNull();
  expect(so_loi_log, "rỗng THẬT không phải lỗi").toBe(0);
});

test("API hỏng (500, 404, mất mạng) ⇒ null và có log, KHÔNG ném", async () => {
  for (const tra of [{ status: 500, than: { detail: "x" } }, { status: 404, than: { detail: "x" } }, "chet_mang"] as const) {
    datFetch(tra);
    expect(await docChuDeTuan(BAY_GIO), JSON.stringify(tra)).toBeNull();
  }
  expect(so_loi_log, "mỗi lần hỏng một dòng log server").toBe(3);
});

test("ngày xuất bản hỏng ⇒ null, KHÔNG ném (rail của mọi trang)", async () => {
  datFetch({ status: 200, than: { items: [CHU_DE(1, "khong-phai-ngay")], cursor_ke_tiep: null } });
  expect(await docChuDeTuan(BAY_GIO)).toBeNull();
});

test("`docFeedChuDe` (trang chủ) VẪN ném khi API hỏng — vá F1 của `/` không đổi", async () => {
  datFetch({ status: 500, than: { detail: "x" } });
  await expect(docFeedChuDe()).rejects.toThrow(LoiApi);
  datFetch({ status: 404, than: { detail: "x" } });
  await expect(docFeedChuDe()).rejects.toThrow(LoiApi);
});
