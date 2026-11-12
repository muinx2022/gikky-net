import type { FeedOut, SubChiTietOut } from "@gikky/api-client";
import { expect, test, type Page } from "@playwright/test";

import { SUB_RONG } from "./du-lieu";

/** Dải điều khiển chung của feed — việc 14, đợt C (plan `2026-11-11-thong-nhat-giao-dien-toan-site.md`
 * §4.2–4.4; tiêu chí T2, T4, T9 phần feed) — chạy trên BẢN BUILD thật, khách chưa đăng nhập.
 *
 * Nguồn sự thật kỳ vọng là **API**; mỗi bài đo khẳng định tập đối chiếu KHÔNG rỗng trước. Phần hàm
 * thuần dựng href + hàng rào grep ở `e2e/don-vi/dai-dieu-khien-feed.spec.ts`. Dữ liệu: `seed_dev` +
 * `seed_e2e` (`e2e-thu-nghiem` có đủ ba loại, ≥ 20 nhật ký, vài nhật ký đã đóng sổ).
 *
 * ⚠ Không bài nào giả định một mạch seed cụ thể còn nằm trên trang 1: gốc đo là THẺ ĐANG CÓ trên
 * trang so với API cùng tham số.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";
const SUB = "e2e-thu-nghiem";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

const idsTrenTrang = (page: Page) =>
  page
    .getByTestId("the-mach")
    .evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.machId)));

/** Chữ chip trạng thái của từng thẻ đang có trên trang. */
const chipTrangThai = (page: Page) =>
  page.getByTestId("the-nhat-ky-trang-thai").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));

test.describe("T2 — từ trang chủ bấm tab nhật ký, trang đích sáng ĐÚNG mục", () => {
  const CA = [
    { tab: "open", href: "/?tab=moi&loai_mach=nhat_ky&trang_thai=open", sang: "open" },
    { tab: "closed", href: "/?tab=moi&loai_mach=nhat_ky&trang_thai=closed", sang: "closed" },
    { tab: "moi", href: "/?tab=moi&loai_mach=nhat_ky", sang: "tat-ca" },
  ] as const;

  for (const ca of CA) {
    test(`bấm tab "${ca.tab}" ở khối nhật ký ⇒ hàng Trạng thái sáng "${ca.sang}", chỉ mục ấy`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/");
      await page.getByTestId(`nhat-ky-tab-${ca.tab}`).click();
      await expect(page).toHaveURL(new RegExp(`${ca.href.replace(/[?&=]/g, (c) => `\\${c}`)}$`));
      const hang = page.getByTestId("loc-trang-thai");
      await expect(hang).toBeVisible();
      for (const k of ["tat-ca", "open", "closed"]) {
        const muc = page.getByTestId(`loc-trang-thai-${k}`);
        if (k === ca.sang) await expect(muc).toHaveAttribute("aria-current", "true");
        else await expect(muc).not.toHaveAttribute("aria-current", /.*/);
      }
    });
  }

  test('bấm "Tất cả nhật ký →" và dải chân khối ⇒ "Tất cả" sáng, hàng Loại sáng "Nhật ký"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const id of ["nhat-ky-tat-ca", "nhat-ky-chan-khoi"]) {
      await page.goto("/");
      await page.getByTestId(id).click();
      await expect(page).toHaveURL(/\/\?tab=moi&loai_mach=nhat_ky$/);
      await expect(page.getByTestId("loc-trang-thai-tat-ca"), id).toHaveAttribute("aria-current", "true");
      await expect(page.getByTestId("loc-loai-nhat_ky"), id).toHaveAttribute("aria-current", "true");
    }
  });

  test("trang chủ `/` (không query) KHÔNG đổi: không dải điều khiển, không `<h2>` của trang lọc", async ({ page }) => {
    await page.goto("/");
    for (const id of ["loc-loai", "loc-trang-thai", "feed-tieu-de-loai", "tab-feed"]) {
      await expect(page.getByTestId(id), id).toHaveCount(0);
    }
    await expect(page.getByTestId("nhat-ky-soan-nhanh")).toHaveCount(1);
  });
});

test.describe("hàng Trạng thái chỉ hiện khi loại Nhật ký và tab ≠ Đang diễn ra", () => {
  const CO_HANG = [
    "/?tab=moi&loai_mach=nhat_ky",
    "/?tab=nhieu-diem&loai_mach=nhat_ky",
    `/s/${SUB}?loai_mach=nhat_ky`,
  ];
  const KHONG_HANG = [
    "/?tab=moi",
    "/?tab=moi&loai_mach=bai_viet",
    "/?tab=moi&loai_mach=thao_luan",
    "/?tab=dang-dien-ra&loai_mach=nhat_ky",
    `/s/${SUB}`,
    `/s/${SUB}?loai_mach=bai_viet`,
  ];

  for (const url of CO_HANG) {
    test(`có hàng: ${url}`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByTestId("loc-trang-thai")).toBeVisible();
      await expect(page.getByTestId("loc-trang-thai").getByRole("link")).toHaveText(["Tất cả", "Đang mở", "Đã đóng sổ"]);
      await expect(page.getByTestId("loc-trang-thai-tat-ca")).toHaveAttribute("aria-current", "true");
    });
  }

  for (const url of KHONG_HANG) {
    test(`không hàng: ${url}`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByTestId("loc-trang-thai")).toHaveCount(0);
      // Hàng Loại thì LUÔN có, ở cả `/` lẫn `/s/*`.
      await expect(page.getByTestId("loc-loai")).toBeVisible();
    });
  }

  test("href của hàng: giữ tab/khoảng/loại, rớt `cursor`; tab Nổi bật giữ khoảng", async ({ page }) => {
    await page.goto("/?tab=nhieu-diem&khoang=tuan&loai_mach=nhat_ky&trang_thai=open");
    await expect(page.getByTestId("loc-trang-thai-open")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("loc-trang-thai-tat-ca")).toHaveAttribute(
      "href",
      "/?tab=nhieu-diem&khoang=tuan&loai_mach=nhat_ky",
    );
    await expect(page.getByTestId("loc-trang-thai-closed")).toHaveAttribute(
      "href",
      "/?tab=nhieu-diem&khoang=tuan&loai_mach=nhat_ky&trang_thai=closed",
    );
    // Tab "Đang diễn ra" bỏ `trang_thai` (API không nhận) và hàng biến mất cùng nó.
    await expect(page.getByTestId("tab-dang-dien-ra")).not.toHaveAttribute("href", /trang_thai/);
    // Có cursor trên URL ⇒ link trong hàng không mang nó theo.
    const t1 = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=nhat_ky&limit=20");
    expect(t1.cursor_ke_tiep, "seed phải có > 20 nhật ký").not.toBeNull();
    await page.goto(`/?tab=moi&loai_mach=nhat_ky&cursor=${encodeURIComponent(t1.cursor_ke_tiep!)}`);
    for (const k of ["tat-ca", "open", "closed"]) {
      await expect(page.getByTestId(`loc-trang-thai-${k}`)).not.toHaveAttribute("href", /cursor/);
    }
  });

  test("bấm 'Đang mở' ⇒ mọi thẻ là nhật ký đang mở, đúng tập API; 'Đã đóng sổ' ⇒ mọi thẻ đã đóng", async ({
    page,
  }) => {
    for (const tt of ["open", "closed"] as const) {
      const mong = await api<FeedOut>(`/api/v1/feeds/moi?loai_mach=nhat_ky&trang_thai=${tt}&limit=20`);
      expect(mong.items.length, `seed phải có nhật ký ${tt}`).toBeGreaterThan(0);
      await page.goto("/?tab=moi&loai_mach=nhat_ky");
      await page.getByTestId(`loc-trang-thai-${tt}`).click();
      await expect(page.getByTestId(`loc-trang-thai-${tt}`)).toHaveAttribute("aria-current", "true");
      expect(await idsTrenTrang(page)).toEqual(mong.items.map((m) => m.id));
      const chu = tt === "open" ? "Đang mở" : "Đã đóng sổ";
      const chip = await chipTrangThai(page);
      expect(chip.length, "đo rỗng: phải có chip trạng thái trên thẻ").toBeGreaterThan(0);
      expect(chip.every((c) => c === chu), `mọi thẻ phải là "${chu}"`).toBe(true);
    }
  });
});

test.describe("URL cũ không có loại: chip Trạng thái thay hàng (không có bộ lọc tàng hình)", () => {
  test("`/?tab=moi&trang_thai=open`: có chip + 'Bỏ lọc', không có hàng 2", async ({ page }) => {
    await page.goto("/?tab=moi&trang_thai=open");
    const chip = page.getByTestId("bo-loc-trang-thai");
    await expect(chip).toContainText("Trạng thái: Đang mở");
    await expect(chip.getByRole("link")).toHaveAttribute("href", "/?tab=moi");
    await expect(page.getByTestId("loc-trang-thai")).toHaveCount(0);
    // Tập bài vẫn đúng như trước đợt C (cùng API).
    const mong = await api<FeedOut>("/api/v1/feeds/moi?trang_thai=open&limit=20");
    expect(await idsTrenTrang(page)).toEqual(mong.items.map((m) => m.id));
  });

  test("chủ đề + `trang_thai=closed`: chip ghi 'Đã đóng' (chủ đề không phải sổ), ở `/` và `/s/*`", async ({ page }) => {
    for (const url of ["/?tab=moi&loai_mach=thao_luan&trang_thai=closed", `/s/${SUB}?loai_mach=thao_luan&trang_thai=closed`]) {
      await page.goto(url);
      const chip = page.getByTestId("bo-loc-trang-thai");
      await expect(chip, url).toContainText("Trạng thái: Đã đóng");
      await expect(chip, url).not.toContainText("Đã đóng sổ");
    }
  });

  test("loại khác nhật ký + trang_thai: chip ở lại, 'Bỏ lọc' giữ loại", async ({ page }) => {
    await page.goto("/?tab=moi&loai_mach=bai_viet&trang_thai=open");
    const chip = page.getByTestId("bo-loc-trang-thai");
    await expect(chip).toBeVisible();
    await expect(chip.getByRole("link")).toHaveAttribute("href", "/?tab=moi&loai_mach=bai_viet");
    await expect(page.getByTestId("loc-trang-thai")).toHaveCount(0);
  });

  test("lọc nhật ký + trạng thái thì KHÔNG có chip (hàng 2 đã báo)", async ({ page }) => {
    await page.goto("/?tab=moi&loai_mach=nhat_ky&trang_thai=closed");
    await expect(page.getByTestId("bo-loc-trang-thai")).toHaveCount(0);
    await expect(page.getByTestId("bo-loc-loai-mach")).toHaveCount(0);
  });
});

test.describe("đổi loại rớt `trang_thai`", () => {
  test("mọi chip Loại ở trang đang lọc trạng thái đều KHÔNG mang `trang_thai`; bấm 'Bài viết' ra feed bài viết", async ({
    page,
  }) => {
    await page.goto("/?tab=moi&loai_mach=nhat_ky&trang_thai=open");
    for (const l of ["tat-ca", "nhat_ky", "bai_viet", "thao_luan"]) {
      await expect(page.getByTestId(`loc-loai-${l}`)).not.toHaveAttribute("href", /trang_thai/);
    }
    await expect(page.getByTestId("loc-loai-tat-ca")).toHaveAttribute("href", "/?tab=moi");
    const mong = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=20");
    expect(mong.items.length).toBeGreaterThan(0);
    await page.getByTestId("loc-loai-bai_viet").click();
    await expect(page).toHaveURL(/\/\?tab=moi&loai_mach=bai_viet$/);
    expect(await idsTrenTrang(page)).toEqual(mong.items.map((m) => m.id));
    await expect(page.getByTestId("loc-trang-thai")).toHaveCount(0);
    await expect(page.getByTestId("bo-loc-trang-thai")).toHaveCount(0);
  });

  test('chip "Tất cả" của hàng Loại ở `/` về `/?tab=moi` (feed), không về trang chủ v2', async ({ page }) => {
    await page.goto("/?tab=moi&loai_mach=nhat_ky");
    await page.getByTestId("loc-loai-tat-ca").click();
    await expect(page).toHaveURL(/\/\?tab=moi$/);
    await expect(page.getByTestId("trang-chu-v2")).toHaveCount(0);
    await expect(page.getByTestId("feed")).toBeVisible();
  });
});

test.describe("`/s/<sub>` nhận `?trang_thai=`", () => {
  for (const tt of ["open", "closed"] as const) {
    test(`/s/${SUB}?loai_mach=nhat_ky&trang_thai=${tt}: đúng tập API, mọi thẻ cùng trạng thái, cuộn vô hạn giữ bộ lọc`, async ({
      page,
    }) => {
      const mong = await api<FeedOut>(
        `/api/v1/feeds/moi?sub=${SUB}&loai_mach=nhat_ky&trang_thai=${tt}&limit=20`,
      );
      expect(mong.items.length, `seed phải có nhật ký ${tt} trong ${SUB}`).toBeGreaterThan(0);
      expect(mong.items.every((m) => m.status === tt)).toBe(true);
      await page.goto(`/s/${SUB}?loai_mach=nhat_ky&trang_thai=${tt}`);
      expect(await idsTrenTrang(page)).toEqual(mong.items.map((m) => m.id));
      const chu = tt === "open" ? "Đang mở" : "Đã đóng sổ";
      const chip = await chipTrangThai(page);
      expect(chip.length, "đo rỗng: phải có chip trạng thái trên thẻ").toBeGreaterThan(0);
      expect(chip.every((c) => c === chu), `mọi thẻ phải là "${chu}"`).toBe(true);
      await expect(page.getByTestId(`loc-trang-thai-${tt}`)).toHaveAttribute("aria-current", "true");
      if (mong.cursor_ke_tiep !== null) {
        expect(await page.getByTestId("feed-xem-them").getAttribute("href")).toContain(`trang_thai=${tt}`);
      }
    });
  }

  test("bấm 'Đã đóng sổ' ở trang sub: URL đúng, hàng Loại giữ 'Nhật ký'", async ({ page }) => {
    await page.goto(`/s/${SUB}?loai_mach=nhat_ky`);
    await page.getByTestId("loc-trang-thai-closed").click();
    await expect(page).toHaveURL(new RegExp(`/s/${SUB}\\?loai_mach=nhat_ky&trang_thai=closed$`));
    await expect(page.getByTestId("loc-loai-nhat_ky")).toHaveAttribute("aria-current", "true");
  });

  test("sub không có nhật ký đang mở: câu rỗng đúng loại + trạng thái, 'Xem tất cả' bỏ ĐÚNG trạng thái", async ({
    page,
  }) => {
    await page.goto(`/s/${SUB_RONG}?loai_mach=nhat_ky&trang_thai=open`);
    await expect(page.getByTestId("feed-rong")).toContainText(
      "Chưa có nhật ký đang mở nào trong chuyên mục này.",
    );
    await expect(page.getByTestId("feed-rong-ve-tat-ca")).toHaveAttribute(
      "href",
      `/s/${SUB_RONG}?loai_mach=nhat_ky`,
    );
    await page.goto(`/s/${SUB_RONG}?loai_mach=nhat_ky`);
    await expect(page.getByTestId("feed-rong")).toContainText("Chưa có nhật ký nào trong chuyên mục này.");
    await expect(page.getByTestId("feed-rong-ve-tat-ca")).toHaveAttribute("href", `/s/${SUB_RONG}`);
  });

  test("`?trang_thai=` lạ không làm 500 và không thành bộ lọc tàng hình", async ({ page, request }) => {
    const r = await request.get(`/s/${SUB}?loai_mach=nhat_ky&trang_thai=abc`);
    expect(r.status()).toBe(200);
    await page.goto(`/s/${SUB}?loai_mach=nhat_ky&trang_thai=abc`);
    await expect(page.getByTestId("loc-trang-thai-tat-ca")).toHaveAttribute("aria-current", "true");
    const mong = await api<FeedOut>(`/api/v1/feeds/moi?sub=${SUB}&loai_mach=nhat_ky&limit=20`);
    expect(await idsTrenTrang(page)).toEqual(mong.items.map((m) => m.id));
  });
});

test.describe("`<h2>` theo loại ở trang lọc `/?…`", () => {
  const CA = [
    ["nhat_ky", "Tất cả nhật ký"],
    ["bai_viet", "Tất cả bài viết"],
    ["thao_luan", "Chủ đề thảo luận"],
  ] as const;

  for (const [loai, chu] of CA) {
    test(`/?tab=moi&loai_mach=${loai}: <h2> "${chu}", đứng sau lede, h1 + lede giữ nguyên`, async ({ page }) => {
      await page.goto(`/?tab=moi&loai_mach=${loai}`);
      await expect(page.getByTestId("feed-tieu-de-loai")).toHaveText(chu);
      const thu_tu = await page.evaluate(() => {
        const h1 = document.querySelector("main h1")!;
        const lede = h1.nextElementSibling!;
        const h2 = lede.nextElementSibling!;
        return {
          lede: [lede.tagName, lede.textContent],
          h2: [h2.tagName, h2.getAttribute("data-testid")],
          h1: h1.textContent,
        };
      });
      expect(thu_tu.h1).toBe("Nhật ký giao dịch chứng khoán & Luận điểm thị trường");
      expect(thu_tu.lede).toEqual([
        "P",
        "Ghi nhận nhận định trước khi có kết quả. Mọi mốc đều lưu vết thời gian thực và lịch sử minh bạch.",
      ]);
      expect(thu_tu.h2).toEqual(["H2", "feed-tieu-de-loai"]);
    });
  }

  test("`<h2>` theo trạng thái: 'Nhật ký đang mở' / 'Nhật ký đã đóng sổ'; chip chủ đề không đổi `<h2>`", async ({ page }) => {
    for (const [url, chu] of [
      ["/?tab=moi&loai_mach=nhat_ky&trang_thai=open", "Nhật ký đang mở"],
      ["/?tab=moi&loai_mach=nhat_ky&trang_thai=closed", "Nhật ký đã đóng sổ"],
      ["/?tab=dang-dien-ra&loai_mach=nhat_ky&trang_thai=closed", "Tất cả nhật ký"],
      ["/?tab=moi&loai_mach=thao_luan&trang_thai=closed", "Chủ đề thảo luận"],
    ] as const) {
      await page.goto(url);
      await expect(page.getByTestId("feed-tieu-de-loai"), url).toHaveText(chu);
    }
  });

  test("có `<h2>` loại ⇒ tiêu đề thẻ là `<h3>`, cả trang 1 lẫn thẻ cuộn vô hạn; trang không lọc loại giữ `<h2>`", async ({
    page,
  }) => {
    await page.goto("/?tab=moi&loai_mach=nhat_ky");
    const the = page.getByTestId("feed").getByTestId("the-mach");
    const n = await the.count();
    expect(n).toBeGreaterThan(0);
    await expect(the.locator("h2")).toHaveCount(0);
    await expect(the.locator("h3")).toHaveCount(n);
    await page.getByTestId("feed-xem-them").scrollIntoViewIfNeeded();
    const them = page.getByTestId("feed-them").getByTestId("the-mach");
    await expect(them.first()).toBeVisible({ timeout: 15_000 });
    const m = await them.count();
    await expect(them.locator("h2")).toHaveCount(0);
    await expect(them.locator("h3")).toHaveCount(m);
    // Không lọc loại (không có `<h2>` loại) và trang sub: thẻ vẫn `<h2>` như cũ.
    for (const url of ["/?tab=moi", `/s/${SUB}?loai_mach=nhat_ky`]) {
      await page.goto(url);
      const t = page.getByTestId("feed").getByTestId("the-mach");
      expect(await t.count(), url).toBeGreaterThan(0);
      await expect(t.locator("h3"), url).toHaveCount(0);
    }
  });

  test("không lọc loại ⇒ không có <h2> này; trang sub không có nó", async ({ page }) => {
    for (const url of ["/?tab=moi", "/?tab=moi&loai_mach=abc", `/s/${SUB}`, `/s/${SUB}?loai_mach=nhat_ky`]) {
      await page.goto(url);
      await expect(page.getByTestId("feed-tieu-de-loai"), url).toHaveCount(0);
    }
  });
});

test.describe("ô soạn nhanh ở trang lọc nhật ký", () => {
  test("desktop: có ô soạn + nút Mở nhật ký trên `/?…loai_mach=nhat_ky` và `/s/<sub>?…`, cùng testid với trang chủ", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const url of ["/?tab=moi&loai_mach=nhat_ky", `/s/${SUB}?loai_mach=nhat_ky`]) {
      await page.goto(url);
      await expect(page.getByTestId("nhat-ky-soan-nhanh"), url).toBeVisible();
      await expect(page.getByTestId("nhat-ky-o-soan"), url).toHaveAttribute("href", "/dang-mach");
      await expect(page.getByTestId("nhat-ky-o-soan")).toContainText("Bạn vừa quyết định gì?");
      await expect(page.getByTestId("nut-mo-nhat-ky")).toHaveAttribute("href", "/dang-mach");
      await expect(page.getByTestId("nut-ghi-nhat-ky-di-dong")).toBeHidden();
      // Ô soạn đứng trên danh sách thẻ, dưới các hàng lọc (chip loại không nhảy khi bấm).
      const [soan, loai, the] = await Promise.all(
        ["nhat-ky-soan-nhanh", "loc-loai", "the-mach"].map(async (id) =>
          (await page.getByTestId(id).first().boundingBox())!.y,
        ),
      );
      expect(loai).toBeLessThan(soan);
      expect(soan).toBeLessThan(the);
    }
  });

  test("không có ô soạn ở loại khác / không lọc loại / tab Đang diễn ra không đổi luật", async ({ page }) => {
    for (const url of ["/?tab=moi", "/?tab=moi&loai_mach=bai_viet", "/?tab=moi&loai_mach=thao_luan", `/s/${SUB}`, `/s/${SUB}?loai_mach=bai_viet`]) {
      await page.goto(url);
      await expect(page.getByTestId("nhat-ky-soan-nhanh"), url).toHaveCount(0);
      await expect(page.getByTestId("nut-ghi-nhat-ky-di-dong"), url).toHaveCount(0);
    }
  });

  test("câu 'Có thể ghi riêng tư…' chỉ in MỘT lần trên trang lọc nhật ký (không lặp ở rail)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/?tab=moi&loai_mach=nhat_ky");
    // Khối khách ở rail là client component: đợi nó vẽ rồi mới đếm, kẻo đếm lúc nó chưa có.
    await expect(page.getByTestId("rail-phai").getByTestId("khoi-khach")).toBeVisible();
    const than = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(than.match(/Có thể ghi riêng tư, công khai khi bạn muốn\./g)?.length).toBe(1);
  });

  test("khối khách ở rail của `/?…` mang tiêu đề của trang chủ; trang sub giữ 'Tham gia Gikky.net'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [url, chu] of [
      ["/?tab=moi&loai_mach=nhat_ky", "Bắt đầu nhật ký của bạn"],
      ["/?tab=moi", "Bắt đầu nhật ký của bạn"],
      [`/s/${SUB}?loai_mach=nhat_ky`, "Tham gia Gikky.net"],
    ] as const) {
      await page.goto(url);
      const khoi = page.getByTestId("rail-phai").getByTestId("khoi-khach");
      await expect(khoi, url).toBeVisible();
      await expect(khoi, url).toContainText(chu);
    }
  });
});

test.describe("T4 — trang chuyên mục: mô tả và dòng số mạch mỗi thứ MỘT lần", () => {
  test("`/s/chung-khoan`: mô tả đúng 1 lần (header), dòng 'N mạch · lập' đúng 1 lần (rail)", async ({ page }) => {
    const s = await api<SubChiTietOut>("/api/v1/subs/chung-khoan");
    expect(s.mo_ta.length, "đo rỗng: sub phải có mô tả").toBeGreaterThan(10);
    expect(s.so_mach).toBeGreaterThan(0);
    for (const url of ["/s/chung-khoan", "/s/chung-khoan?loai_mach=nhat_ky"]) {
      await page.goto(url);
      const chu = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      const dem = (mau: string) => chu.split(mau).length - 1;
      expect(dem(s.mo_ta), `${url}: mô tả`).toBe(1);
      expect(dem(`${s.so_mach} mạch`), `${url}: số mạch`).toBe(1);
      await expect(page.getByTestId("sub-header-so")).toHaveCount(0);
      await expect(page.getByTestId("sub-header")).toContainText(s.mo_ta);
      await expect(page.getByTestId("sidebar-ve-sub")).not.toContainText(s.mo_ta);
      await expect(page.getByTestId("sidebar-so-mach")).toContainText(`${s.so_mach} mạch`);
    }
  });

  test("rail 'Về s/…' có hai link nhanh tới feed đã lọc loại, và chip loại ở trang đích sáng đúng", async ({ page }) => {
    await page.goto("/s/chung-khoan");
    const nhat_ky = page.getByTestId("sidebar-dan-nhat-ky-sub");
    const bai_viet = page.getByTestId("sidebar-dan-bai-viet-sub");
    await expect(nhat_ky).toHaveAttribute("href", "/s/chung-khoan?loai_mach=nhat_ky");
    await expect(nhat_ky).toHaveText("Nhật ký trong chuyên mục →");
    await expect(bai_viet).toHaveAttribute("href", "/s/chung-khoan?loai_mach=bai_viet");
    await expect(bai_viet).toHaveText("Bài viết trong chuyên mục →");
    await nhat_ky.click();
    await expect(page).toHaveURL(/\/s\/chung-khoan\?loai_mach=nhat_ky$/);
    await expect(page.getByTestId("loc-loai-nhat_ky")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("loc-trang-thai")).toBeVisible();
    // Trang chủ không có khối "Về s/…" ⇒ không có hai link này.
    await page.goto("/");
    await expect(page.getByTestId("sidebar-dan-nhat-ky-sub")).toHaveCount(0);
  });
});

test.describe("cuộn vô hạn: đổi bộ lọc bằng điều hướng client không giữ thẻ của bộ lọc cũ", () => {
  /** Mọi id của một feed qua API, theo cursor, tới `tran` bài — tập đối chiếu "thuộc bộ lọc mới". */
  async function tapApi(query: string, tran = 200): Promise<Set<number>> {
    const ids = new Set<number>();
    let cursor: string | null = null;
    do {
      const q: string = `/api/v1/feeds/moi?${query}&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const t: FeedOut = await api<FeedOut>(q);
      for (const m of t.items) ids.add(m.id);
      cursor = t.cursor_ke_tiep;
    } while (cursor !== null && ids.size < tran);
    return ids;
  }

  const CA = [
    { tu: "/?tab=moi", bam: "loc-loai-nhat_ky", den: /\/\?tab=moi&loai_mach=nhat_ky$/, api: "loai_mach=nhat_ky" },
    { tu: "/?tab=moi&loai_mach=nhat_ky", bam: "loc-loai-tat-ca", den: /\/\?tab=moi$/, api: "" },
    {
      tu: `/s/${SUB}?trang_thai=open`,
      bam: "loc-loai-nhat_ky",
      den: new RegExp(`/s/${SUB}\\?loai_mach=nhat_ky$`),
      api: `sub=${SUB}&loai_mach=nhat_ky`,
    },
  ];

  for (const ca of CA) {
    test(`${ca.tu} → cuộn nạp trang 2 → bấm ${ca.bam}: mọi thẻ thuộc bộ lọc mới`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(ca.tu);
      await page.getByTestId("feed-xem-them").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("feed-them").getByTestId("the-mach").first()).toBeVisible({ timeout: 15_000 });
      // Điều hướng CLIENT (không `page.goto`): bấm chip ngay trên trang đã cuộn.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByTestId(ca.bam).click();
      await expect(page).toHaveURL(ca.den);
      await expect(page.getByTestId(ca.bam)).toHaveAttribute("aria-current", "true");
      // Cho cuộn vô hạn (nếu có) kịp làm hỏng trang trước khi đếm.
      await page.waitForTimeout(1500);
      const ids = await idsTrenTrang(page);
      expect(ids.length, "đo rỗng").toBeGreaterThan(0);
      const tap = await tapApi(ca.api);
      expect(tap.size).toBeGreaterThan(0);
      const sai = ids.filter((i) => !tap.has(i));
      expect(sai, "thẻ của bộ lọc cũ còn nằm lại").toEqual([]);
      // Không trùng thẻ (bài trang 1 của bộ lọc mới bị nối lại lần nữa).
      expect(new Set(ids).size).toBe(ids.length);
    });
  }
});

test.describe("T9 — 390px: không tràn ngang, vùng bấm chip ≥ 44px chiều cao", () => {
  const URLS = ["/?tab=moi&loai_mach=nhat_ky", `/s/${SUB}?loai_mach=nhat_ky`, `/s/${SUB}`, "/?tab=nhieu-diem&khoang=tuan"];

  for (const url of URLS) {
    test(`${url}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      const d = await page.evaluate(() => ({ cuon: document.documentElement.scrollWidth, rong: window.innerWidth }));
      expect(d.cuon, `${url} tràn ngang`).toBeLessThanOrEqual(d.rong);
      const cao = async (testid: string) =>
        page.getByTestId(testid).getByRole("link").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      for (const hang of ["loc-loai", "tab-feed"]) {
        const hs = await cao(hang);
        expect(hs.length, `${url}: ${hang} đo rỗng`).toBeGreaterThan(0);
        for (const h of hs) expect(h, `${url}: chip ${hang} cao ${h}`).toBeGreaterThanOrEqual(44);
      }
      if (await page.getByTestId("loc-trang-thai").count()) {
        for (const h of await cao("loc-trang-thai")) expect(h).toBeGreaterThanOrEqual(44);
      }
      if (await page.getByTestId("chon-khoang").count()) {
        for (const h of await cao("chon-khoang")) expect(h, `${url}: chip khoảng`).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test("lọc nhật ký: ô soạn ẩn, nút dính đáy 'Ghi nhật ký' ≥ 44px nằm trong khung nhìn", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ["/?tab=moi&loai_mach=nhat_ky", `/s/${SUB}?loai_mach=nhat_ky`]) {
      await page.goto(url);
      await expect(page.getByTestId("nhat-ky-soan-nhanh"), url).toBeHidden();
      const nut = page.getByTestId("nut-ghi-nhat-ky-di-dong");
      await expect(nut, url).toBeVisible();
      const r = (await nut.boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(44);
      // Dính đáy: nút nằm trong màn hình dù đang ở đầu trang (danh sách dài hơn một màn).
      expect(r.y + r.height, `${url}: nút phải dính đáy khung nhìn`).toBeLessThanOrEqual(844);
      expect(r.y).toBeGreaterThan(400);
      await page.mouse.wheel(0, 1500);
      const sau = (await nut.boundingBox())!;
      expect(sau.y + sau.height, `${url}: cuộn xuống nút vẫn dính`).toBeLessThanOrEqual(844);
      expect(sau.y).toBeGreaterThan(400);
    }
  });

  test("nút về đầu trang KHÔNG đè nút dính đáy 'Ghi nhật ký' (trang lọc và trang chủ); cả hai ≥ 44px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ["/?tab=moi&loai_mach=nhat_ky", `/s/${SUB}?loai_mach=nhat_ky`, "/"]) {
      await page.goto(url);
      const ghi = page.getByTestId("nut-ghi-nhat-ky-di-dong");
      // Cuộn xuống quá một khung nhìn (nút về đầu trang chỉ hiện từ đó), và ở trang chủ thì dừng GIỮA
      // khối nhật ký — nút ghi chỉ dính đáy trong khối ấy.
      if (url === "/") {
        await page
          .getByTestId("feed-nhat-ky")
          .getByTestId("the-mach")
          .nth(4)
          .evaluate((el) => el.scrollIntoView({ block: "start" }));
      } else {
        await page.mouse.wheel(0, 1200);
      }
      const ve = page.getByTestId("nut-ve-dau-trang");
      await expect(ve, url).toHaveClass(/hien/, { timeout: 5_000 });
      await expect(ghi, url).toBeVisible();
      const a = (await ghi.boundingBox())!;
      const b = (await ve.boundingBox())!;
      expect(a.y + a.height, `${url}: nút ghi phải nằm trong khung nhìn`).toBeLessThanOrEqual(844);
      expect(a.height).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      const chong =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(chong, `${url}: hai nút chồng nhau ghi=${JSON.stringify(a)} ve=${JSON.stringify(b)}`).toBe(false);
      // Điểm bấm ở mép phải nút ghi (chỗ nút về đầu trang từng đè) phải trúng chính nút ghi.
      const trung = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return el?.closest("[data-testid]")?.getAttribute("data-testid") ?? null;
        },
        { x: a.x + a.width - 10, y: a.y + a.height / 2 },
      );
      expect(trung, url).toBe("nut-ghi-nhat-ky-di-dong");
    }
  });
});
