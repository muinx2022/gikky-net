import { expect, test } from "@playwright/test";

import { API_ORIGIN, docNhatKyDangBan } from "../../lib/api";
import { SO_DANG_BAN, chonDangBan } from "../../lib/nhat-ky-dang-ban";

/** Dải "Đang được bàn" của `/` (plan `2026-11-13-nhat-ky-dang-ban.md`): phép đếm nằm ở API
 * (`api/tests/test_api_nhat_ky_dang_ban.py`), phía web chỉ còn bỏ trùng với 8 thẻ của khối
 * "Nhật ký mới" và cắt — ghim ở đây. Việc `/` thật sự vẽ đúng dải nằm ở
 * `e2e/trang-chu-dang-ban.spec.ts`.
 *
 * Thêm ở vòng sửa 1: hàm nạp `docNhatKyDangBan` KHÔNG ném (khuôn `docChuDeTuan`,
 * `chu-de-tuan-rail.spec.ts`) — dải phụ hỏng thì ẩn, không kéo `/` thành 500. Đo bằng HÀNH VI
 * (thay `globalThis.fetch`). */

const muc = (...ids: number[]) => ids.map((id) => ({ mach: { id }, so_binh_luan_gan_day: 2 }));
const idCua = (ds: { mach: { id: number } }[]) => ds.map((m) => m.mach.id);

test.describe("chonDangBan", () => {
  test("rỗng vào thì rỗng ra", () => {
    expect(chonDangBan([], new Set([1, 2]))).toEqual([]);
  });

  test("bỏ mục đã hiện ở khối Nhật ký mới, giữ thứ tự API", () => {
    expect(idCua(chonDangBan(muc(9, 4, 7, 1, 3), new Set([4, 1, 100])))).toEqual([9, 7, 3]);
  });

  test("mọi mục đều đã hiện ⇒ rỗng (component không vẽ section)", () => {
    expect(chonDangBan(muc(1, 2), new Set([1, 2]))).toEqual([]);
  });

  test(`cắt ở ${SO_DANG_BAN} SAU khi bỏ trùng, không phải trước`, () => {
    expect(SO_DANG_BAN).toBe(5);
    const ra = chonDangBan(muc(1, 2, 3, 4, 5, 6, 7, 8), new Set([1, 2]));
    expect(idCua(ra)).toEqual([3, 4, 5, 6, 7]);
    expect(idCua(chonDangBan(muc(1, 2, 3), new Set(), 2))).toEqual([1, 2]);
  });

  test("không đột biến đối số", () => {
    const vao = muc(5, 6, 7, 8, 9, 10, 11);
    const ban_sao = structuredClone(vao);
    const da_hien = new Set([6]);
    chonDangBan(vao, da_hien);
    expect(vao).toEqual(ban_sao);
    expect([...da_hien]).toEqual([6]);
  });
});

test.describe("docNhatKyDangBan", () => {
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

  test("gọi đúng endpoint tới API_ORIGIN, trả nguyên dữ liệu khi 200", async () => {
    const than = { items: [{ mach: { id: 3 }, so_nguoi_ban: 2, so_binh_luan_gan_day: 2 }], cua_so_gio: 48 };
    datFetch({ status: 200, than });
    expect(await docNhatKyDangBan(10)).toEqual(than);
    expect(da_goi).toHaveLength(1);
    const u = new URL(da_goi[0]);
    expect(`${u.origin}${u.pathname}`).toBe(`${API_ORIGIN}/api/v1/feeds/nhat-ky-dang-ban`);
    expect(u.searchParams.get("limit")).toBe("10");
    expect(so_loi_log, "200 không phải lỗi").toBe(0);
  });

  test("API hỏng (500, 404 khi web lên trước api, mất mạng) ⇒ rỗng và có log, KHÔNG ném", async () => {
    for (const tra of [{ status: 500, than: { detail: "x" } }, { status: 404, than: { detail: "x" } }, "chet_mang"] as const) {
      datFetch(tra);
      const ra = await docNhatKyDangBan(10);
      expect(ra.items, JSON.stringify(tra)).toEqual([]);
      expect(ra.cua_so_gio).toBeGreaterThan(0);
    }
    expect(so_loi_log, "mỗi lần hỏng một dòng log server").toBe(3);
  });
});
