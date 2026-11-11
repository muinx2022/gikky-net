import type { FeedOut } from "@gikky/api-client";
import { expect, test, type Page } from "@playwright/test";

import { SUB_NGOAI_DANH_SACH, SUB_RONG } from "./du-lieu";

/** Trang chuyên mục `/s/<sub>`: hàng chip lọc theo loại + nhãn loại trên thẻ (plan
 * `plans/2026-11-10-chuyen-muc-loc-loai.md`, tiêu chí C1–C7) — chạy trên BẢN BUILD thật.
 *
 * `e2e-thu-nghiem` (`seed_e2e`) là sub duy nhất có đủ cả ba loại; `chung-khoan` chỉ có nhật ký
 * (để có ca "lọc ra rỗng"). Nguồn sự thật kỳ vọng là **API**, không phải HTML vừa render, và
 * mỗi bài đo khẳng định tập đối chiếu KHÔNG rỗng trước — đối chiếu hai danh sách rỗng là đo
 * rỗng.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";
const SUB = SUB_NGOAI_DANH_SACH;
const LOAI = ["nhat_ky", "bai_viet", "thao_luan"] as const;
type Loai = (typeof LOAI)[number];
const NHAN: Record<Loai, string> = { nhat_ky: "Nhật ký", bai_viet: "Bài viết", thao_luan: "Chủ đề" };

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

const feedSub = (sub: string, them = "") =>
  api<FeedOut>(`/api/v1/feeds/moi?sub=${sub}&limit=20${them}`);

const idsTrenTrang = (page: Page, vung: string) =>
  page
    .getByTestId(vung)
    .getByTestId("the-mach")
    .evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.machId)));

test.describe("C1 — hàng chip: 4 chip, href đúng, giữ tab/khoảng/trường phái, bỏ cursor", () => {
  test("mặc định: Tất cả đang chọn, href sạch, ba chip thêm `loai_mach`", async ({ page }) => {
    await page.goto(`/s/${SUB}`);
    const hang = page.getByTestId("loc-loai");
    await expect(hang).toHaveAttribute("aria-label", "Lọc theo loại");
    await expect(hang.getByRole("link")).toHaveText(["Tất cả", "Nhật ký", "Bài viết", "Chủ đề"]);

    await expect(page.getByTestId("loc-loai-tat-ca")).toHaveAttribute("href", `/s/${SUB}`);
    await expect(page.getByTestId("loc-loai-tat-ca")).toHaveAttribute("aria-current", "true");
    for (const l of LOAI) {
      const chip = page.getByTestId(`loc-loai-${l}`);
      await expect(chip, l).toHaveAttribute("href", `/s/${SUB}?loai_mach=${l}`);
      await expect(chip, l).not.toHaveAttribute("aria-current", /.*/);
    }
    // Hàng chip mới thay chip "Loại: … ✕ Bỏ lọc" cũ — không hiện cả hai.
    await expect(page.getByTestId("bo-loc-loai-mach")).toHaveCount(0);
  });

  test("trên tab + khoảng + trường phái + cursor: giữ ba thứ đầu, bỏ cursor", async ({ page }) => {
    await page.goto(
      `/s/${SUB}?tab=nhieu-diem&khoang=tuan&truong_phai=a%26b%20c&loai_mach=bai_viet&cursor=rac`,
    );
    const goc = `/s/${SUB}?tab=nhieu-diem&khoang=tuan&truong_phai=a%26b%20c`;
    await expect(page.getByTestId("loc-loai-tat-ca")).toHaveAttribute("href", goc);
    for (const l of LOAI) {
      await expect(page.getByTestId(`loc-loai-${l}`), l).toHaveAttribute(
        "href",
        `${goc}&loai_mach=${l}`,
      );
    }
    await expect(page.getByTestId("loc-loai-bai_viet")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("loc-loai-tat-ca")).not.toHaveAttribute("aria-current", /.*/);
    // Đang lọc mà vẫn chỉ có MỘT bộ điều khiển loại: chip "Loại: … ✕ Bỏ lọc" của `/` không hiện.
    await expect(page.getByTestId("bo-loc-loai-mach")).toHaveCount(0);
    for (const href of await page
      .getByTestId("loc-loai")
      .getByRole("link")
      .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""))) {
      expect(href, "chip không được mang cursor").not.toContain("cursor");
    }
  });

  test("bấm chip: sang đúng URL lọc và chip đó thành đang chọn", async ({ page }) => {
    await page.goto(`/s/${SUB}`);
    await page.getByTestId("loc-loai-thao_luan").click();
    await expect(page).toHaveURL(new RegExp(`/s/${SUB}\\?loai_mach=thao_luan$`));
    await expect(page.getByTestId("loc-loai-thao_luan")).toHaveAttribute("aria-current", "true");
  });
});

test.describe("C2/C3 — lọc ra đúng tập API; nhãn trên thẻ khớp loại", () => {
  for (const l of LOAI) {
    test(`lọc ${l}: id và thứ tự trùng API, mọi thẻ mang nhãn "${NHAN[l]}"`, async ({ page }) => {
      const api_feed = await feedSub(SUB, `&loai_mach=${l}`);
      expect(api_feed.items.length, `seed phải có ${l} ở ${SUB}`).toBeGreaterThan(0);
      expect(api_feed.items.every((m) => m.loai_mach === l)).toBe(true);

      await page.goto(`/s/${SUB}?loai_mach=${l}`);
      expect(await idsTrenTrang(page, "feed")).toEqual(api_feed.items.map((m) => m.id));
      const nhan = await page.getByTestId("feed").getByTestId("nhan-loai").allTextContents();
      expect(nhan).toEqual(api_feed.items.map(() => NHAN[l]));
    });
  }

  test('"Tất cả": mỗi thẻ có đúng MỘT nhãn, khớp `loai_mach` của mạch theo API (trang đầu + trang cursor)', async ({
    page,
  }) => {
    // Trang đầu của seed là toàn nhật ký; chỉ trang sau cursor mới lẫn bài viết + chủ đề. Đo CẢ
    // HAI, và đòi tập loại ≥ 2 trên hợp của chúng — một bài đo chỉ thấy một loại thì "mỗi thẻ có
    // nhãn khớp" cũng đúng với một nhãn dán cứng.
    const trang1 = await feedSub(SUB);
    expect(trang1.cursor_ke_tiep).not.toBeNull();
    const trang2 = await api<FeedOut>(
      `/api/v1/feeds/moi?sub=${SUB}&limit=20&cursor=${encodeURIComponent(trang1.cursor_ke_tiep!)}`,
    );
    const loai_thay = new Set([...trang1.items, ...trang2.items].map((m) => m.loai_mach));
    expect(loai_thay.size, "hai trang phải lẫn đủ ba loại").toBe(3);

    const urls = [`/s/${SUB}`, `/s/${SUB}?cursor=${encodeURIComponent(trang1.cursor_ke_tiep!)}`];
    for (const [i, api_feed] of [trang1, trang2].entries()) {
      await page.goto(urls[i]);
      expect(await page.getByTestId("feed").getByTestId("the-mach").count(), urls[i]).toBe(
        api_feed.items.length,
      );
      for (const m of api_feed.items) {
        const the = page.locator(`[data-testid="the-mach"][data-mach-id="${m.id}"]`);
        await expect(the.getByTestId("nhan-loai"), `mạch ${m.id}`).toHaveCount(1);
        await expect(the.getByTestId("nhan-loai"), `mạch ${m.id}`).toHaveText(NHAN[m.loai_mach]);
      }
    }
  });

  test("nhãn chỉ bật ở trang chuyên mục: `/?tab=moi` và hồ sơ không có nhãn nào", async ({
    page,
  }) => {
    for (const url of ["/?tab=moi", "/u/e2e_nhieu_mach", "/?tab=moi&loai_mach=bai_viet"]) {
      await page.goto(url);
      expect(await page.getByTestId("the-mach").count(), `${url} phải có thẻ`).toBeGreaterThan(0);
      await expect(page.getByTestId("nhan-loai"), url).toHaveCount(0);
      await expect(page.getByTestId("loc-loai"), url).toHaveCount(0);
    }
  });
});

test.describe("C4 — `?loai_mach=` hỏng không làm trang chết", () => {
  for (const q of ["loai_mach=abc", "loai_mach=", "loai_mach=nhat_ky&loai_mach=abc"]) {
    test(`/s/${SUB}?${q} → 200 và vẫn có feed`, async ({ page, request }) => {
      expect((await request.get(`/s/${SUB}?${q}`)).status()).toBe(200);
      await page.goto(`/s/${SUB}?${q}`);
      await expect(page.getByTestId("sub-header")).toBeVisible();
      expect(await page.getByTestId("the-mach").count()).toBeGreaterThan(0);
    });
  }

  test("giá trị lạ / rỗng ⇒ 'Tất cả' (không phải một loại ngầm); lặp tham số lấy giá trị ĐẦU như `/`", async ({
    page,
  }) => {
    for (const q of ["loai_mach=abc", "loai_mach="]) {
      await page.goto(`/s/${SUB}?${q}`);
      await expect(page.getByTestId("loc-loai-tat-ca"), q).toHaveAttribute("aria-current", "true");
    }
    // Cùng `docLoaiMach` với `/`: tham số lặp lấy phần tử đầu, hợp lệ ⇒ lọc theo nó.
    await page.goto(`/s/${SUB}?loai_mach=nhat_ky&loai_mach=abc`);
    await expect(page.getByTestId("loc-loai-nhat_ky")).toHaveAttribute("aria-current", "true");
  });
});

test.describe("C5 — lọc ra rỗng", () => {
  test("chuyên mục có nhật ký mà không có bài viết: câu đúng loại + link về Tất cả", async ({
    page,
  }) => {
    expect((await feedSub("chung-khoan")).items.length, "chung-khoan phải có mạch").toBeGreaterThan(0);
    expect((await feedSub("chung-khoan", "&loai_mach=bai_viet")).items, "phải RỖNG").toHaveLength(0);

    await page.goto("/s/chung-khoan?loai_mach=bai_viet");
    const rong = page.getByTestId("feed-rong");
    await expect(rong).toContainText("Chưa có bài viết nào trong chuyên mục này.");
    await expect(rong).not.toContainText("0");
    await expect(page.getByTestId("feed-rong-ve-tat-ca")).toHaveAttribute("href", "/s/chung-khoan");
    await expect(page.getByTestId("the-mach")).toHaveCount(0);
    // Hàng chip vẫn ở đó để đổi sang loại khác.
    await expect(page.getByTestId("loc-loai-bai_viet")).toHaveAttribute("aria-current", "true");

    await page.getByTestId("feed-rong-ve-tat-ca").click();
    await expect(page).toHaveURL(/\/s\/chung-khoan$/);
    expect(await page.getByTestId("the-mach").count()).toBeGreaterThan(0);
  });

  test('câu theo từng loại: "nhật ký" / "bài viết" / "chủ đề" (viết thường giữa câu)', async ({
    page,
  }) => {
    const mong: Record<Loai, string> = {
      nhat_ky: "Chưa có nhật ký nào trong chuyên mục này.",
      bai_viet: "Chưa có bài viết nào trong chuyên mục này.",
      thao_luan: "Chưa có chủ đề nào trong chuyên mục này.",
    };
    for (const l of LOAI) {
      await page.goto(`/s/${SUB_RONG}?loai_mach=${l}`);
      await expect(page.getByTestId("feed-rong"), l).toContainText(mong[l]);
    }
  });

  test("sub rỗng KHÔNG lọc giữ câu cũ và không có link 'Xem tất cả'", async ({ page }) => {
    await page.goto(`/s/${SUB_RONG}`);
    await expect(page.getByTestId("feed-rong")).toHaveText("Chưa có bài nào ở đây.");
    await expect(page.getByTestId("feed-rong-ve-tat-ca")).toHaveCount(0);
  });
});

test.describe("C6 — cuộn vô hạn giữ loại và nhãn; link cursor có trong HTML thô", () => {
  test("`?loai_mach=bai_viet`: trang 2 cùng loại, cùng thứ tự API, có nhãn", async ({
    page,
    request,
  }) => {
    const trang1 = await feedSub(SUB, "&loai_mach=bai_viet");
    expect(trang1.cursor_ke_tiep, "seed phải có > 20 bài viết").not.toBeNull();
    const trang2 = await api<FeedOut>(
      `/api/v1/feeds/moi?sub=${SUB}&loai_mach=bai_viet&limit=20&cursor=${encodeURIComponent(trang1.cursor_ke_tiep!)}`,
    );
    expect(trang2.items.length).toBeGreaterThan(0);

    // HTML thô (không JS): `<a href>` cursor tồn tại và mang `loai_mach`.
    const html = await (await request.get(`/s/${SUB}?loai_mach=bai_viet`)).text();
    const link = [...html.matchAll(/<a [^>]*href="([^"]*cursor=[^"]*)"/g)].map((m) =>
      m[1].replace(/&amp;/g, "&"),
    );
    expect(link.length, "phải có link cursor thật trong HTML thô").toBeGreaterThan(0);
    expect(link[0]).toContain("loai_mach=bai_viet");

    await page.goto(`/s/${SUB}?loai_mach=bai_viet`);
    await page.getByTestId("feed-xem-them").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("feed-them").getByTestId("the-mach").first()).toBeVisible({
      timeout: 15_000,
    });
    const ids2 = await idsTrenTrang(page, "feed-them");
    expect(ids2.slice(0, trang2.items.length)).toEqual(trang2.items.map((m) => m.id));
    const nhan2 = await page.getByTestId("feed-them").getByTestId("nhan-loai").allTextContents();
    expect(nhan2.length, "mỗi thẻ nạp thêm có đúng một nhãn").toBe(ids2.length);
    expect(new Set(nhan2)).toEqual(new Set(["Bài viết"]));
  });

  test("C6b — `?loai_mach=nhat_ky`: trang 2 CHỈ còn phần nhật ký còn lại (đúng số lượng, đúng thứ tự), không lẫn loại khác", async ({
    page,
  }) => {
    // Seed xếp loại liền khối (nhật ký mới nhất → chủ đề → bài viết cũ hơn), nên đây là ca mà
    // `loai_mach` có / không có trong lời gọi trang 2 cho KẾT QUẢ KHÁC NHAU: lọc ⇒ phần nhật ký
    // còn lại; không lọc ⇒ tiếp theo cursor là chủ đề / bài viết cũ hơn. Với `bai_viet` (trang 2
    // của nó toàn bài viết dù lọc hay không) thì bài đo không phân biệt được hai trường hợp.
    const trang1 = await feedSub(SUB, "&loai_mach=nhat_ky");
    expect(trang1.cursor_ke_tiep, "seed phải có > 20 nhật ký thì mới có trang 2").not.toBeNull();
    const cursor = encodeURIComponent(trang1.cursor_ke_tiep!);
    const trang2 = await api<FeedOut>(
      `/api/v1/feeds/moi?sub=${SUB}&loai_mach=nhat_ky&limit=20&cursor=${cursor}`,
    );
    expect(trang2.items.length, "phần còn lại phải khác rỗng").toBeGreaterThan(0);
    expect(trang2.items.every((m) => m.loai_mach === "nhat_ky")).toBe(true);
    // Điều kiện để bài đo phân biệt được: cùng cursor mà KHÔNG lọc thì ra loại khác.
    const khong_loc = await api<FeedOut>(`/api/v1/feeds/moi?sub=${SUB}&limit=20&cursor=${cursor}`);
    expect(
      khong_loc.items.some((m) => m.loai_mach !== "nhat_ky"),
      "đo rỗng: trang 2 không lọc phải lẫn loại khác",
    ).toBe(true);

    await page.goto(`/s/${SUB}?loai_mach=nhat_ky`);
    await page.getByTestId("feed-xem-them").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("feed-them").getByTestId("the-mach").first()).toBeVisible({
      timeout: 15_000,
    });
    const ids2 = await idsTrenTrang(page, "feed-them");
    expect(ids2, "trang 2: đúng phần nhật ký còn lại, đúng thứ tự API").toEqual(
      trang2.items.map((m) => m.id),
    );
    const nhan2 = await page.getByTestId("feed-them").getByTestId("nhan-loai").allTextContents();
    expect(nhan2, "mọi thẻ trang 2 mang nhãn Nhật ký, không có nhãn nào khác").toEqual(
      ids2.map(() => "Nhật ký"),
    );
  });

  test('"Tất cả": thẻ nạp thêm cũng có nhãn (đủ nhãn như trang đầu)', async ({ page }) => {
    await page.goto(`/s/${SUB}`);
    await page.getByTestId("feed-xem-them").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("feed-them").getByTestId("the-mach").first()).toBeVisible({
      timeout: 15_000,
    });
    const so_the = (await idsTrenTrang(page, "feed-them")).length;
    await expect(page.getByTestId("feed-them").getByTestId("nhan-loai")).toHaveCount(so_the);
  });
});

test.describe("SEO — chỉ cộng, không bớt", () => {
  test("`<head>` của mọi biến thể lọc y hệt trang gốc (canonical về trang gốc)", async ({
    request,
  }) => {
    const head = async (url: string) => {
      const html = await (await request.get(url)).text();
      const h = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? "";
      const lay = (re: RegExp) => [...h.matchAll(re)].map((m) => m[0]).sort();
      return {
        title: lay(/<title>[\s\S]*?<\/title>/g),
        meta: lay(/<meta [^>]*(?:name="description"|property="og:|name="twitter:)[^>]*>/g),
        canonical: lay(/<link rel="canonical"[^>]*>/g),
        rss: lay(/<link [^>]*application\/rss\+xml[^>]*>/g),
        h1: [...html.matchAll(/<h1[^>]*>[\s\S]*?<\/h1>/g)].map((m) => m[0]),
      };
    };
    const goc = await head(`/s/${SUB}`);
    expect(goc.canonical.length, "đo rỗng: trang gốc phải có canonical").toBe(1);
    expect(goc.rss.length, "đo rỗng: trang gốc phải có RSS alternate").toBe(1);
    expect(goc.h1.length).toBe(1);
    for (const q of ["?loai_mach=bai_viet", "?loai_mach=thao_luan", "?loai_mach=abc"]) {
      expect(await head(`/s/${SUB}${q}`), q).toEqual(goc);
    }
  });

  test("hàng chip và nhãn là `<a>`/chữ thật trong HTML thô; UA trình duyệt và Googlebot thấy cùng <head>, cùng tập link, cùng thẻ theo cùng thứ tự", async ({
    request,
  }) => {
    // KHÔNG so byte toàn trang: thứ tự / cách gộp chunk RSC của `/s/*` dao động theo thời điểm
    // khi nhiều request đồng thời (cùng lý do `seo-trang-chu.spec.ts` B6 chỉ so phần SEO và link).
    // "Không cloaking" nghĩa là cùng head, cùng link, cùng thẻ — không phải cùng từng byte RSC.
    const lay = async (ua: string) =>
      (await request.get(`/s/${SUB}`, { headers: { "user-agent": ua } })).text();
    const veSeo = (html: string) => {
      const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? "";
      const g = (re: RegExp, nguon = head) => [...nguon.matchAll(re)].map((m) => m[0]);
      return {
        title: g(/<title>[\s\S]*?<\/title>/g),
        moTa: g(/<meta name="description"[^>]*>/g),
        og: g(/<meta property="og:[^>]*>/g).sort(),
        twitter: g(/<meta name="twitter:[^>]*>/g).sort(),
        canonical: g(/<link rel="canonical"[^>]*>/g),
        rss: g(/<link [^>]*application\/rss\+xml[^>]*>/g),
        h1: g(/<h1[^>]*>[\s\S]*?<\/h1>/g, html),
      };
    };
    const hrefs = (h: string) => [...h.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    const idThe = (h: string) => [...h.matchAll(/data-mach-id="(\d+)"/g)].map((m) => Number(m[1]));
    const nhan = (h: string) => [...h.matchAll(/data-testid="nhan-loai"[^>]*>([^<]*)</g)].map((m) => m[1]);

    const trinh_duyet = await lay("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36");
    const bot = await lay("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");

    // Có thật: hai mảng rỗng bằng nhau là bài đo rỗng.
    expect(veSeo(trinh_duyet).canonical, "đo rỗng: phải có canonical").toHaveLength(1);
    expect(idThe(trinh_duyet).length, "đo rỗng: phải có thẻ").toBeGreaterThan(0);
    expect(trinh_duyet).toMatch(/<a [^>]*href="\/s\/e2e-thu-nghiem\?loai_mach=bai_viet"[^>]*>/);
    expect(nhan(trinh_duyet).length).toBe(idThe(trinh_duyet).length);

    expect(veSeo(bot)).toEqual(veSeo(trinh_duyet));
    expect([...new Set(hrefs(bot))].sort()).toEqual([...new Set(hrefs(trinh_duyet))].sort());
    expect(idThe(bot)).toEqual(idThe(trinh_duyet));
    expect(nhan(bot)).toEqual(nhan(trinh_duyet));
  });
});

/** Màu chữ + màu nền hiệu dụng của phần tử (đi ngược lên tổ tiên tới lớp nền đặc đầu tiên),
 * quy về RGBA bằng canvas để chịu được mọi cú pháp màu CSS (`color-mix`, `oklab`…). */
async function tuongPhan(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((el) => {
    const c = document.createElement("canvas").getContext("2d")!;
    const rgba = (css: string) => {
      c.clearRect(0, 0, 1, 1);
      c.fillStyle = "#000";
      c.fillStyle = css;
      c.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const tren = (f: { r: number; g: number; b: number; a: number }, d: { r: number; g: number; b: number }) => ({
      r: f.r * f.a + d.r * (1 - f.a),
      g: f.g * f.a + d.g * (1 - f.a),
      b: f.b * f.a + d.b * (1 - f.a),
    });
    // Nền hiệu dụng: chồng các lớp từ ngoài vào trong.
    const lop: ReturnType<typeof rgba>[] = [];
    for (let n: Element | null = el; n !== null; n = n.parentElement) {
      const nen = rgba(getComputedStyle(n).backgroundColor);
      if (nen.a > 0) lop.push(nen);
      if (nen.a === 1) break;
    }
    let nen = { r: 255, g: 255, b: 255 };
    for (const l of lop.reverse()) nen = tren(l, nen);
    const chu = tren(rgba(getComputedStyle(el).color), nen);
    const dl = (x: { r: number; g: number; b: number }) => {
      const k = [x.r, x.g, x.b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
    };
    const [a, b] = [dl(chu), dl(nen)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
}

for (const theme of ["sang", "toi"] as const) {
  test.describe(`C7 — 375px, theme ${theme}`, () => {
    test.use({ colorScheme: theme === "toi" ? "dark" : "light" });

    for (const url of [`/s/${SUB}`, `/s/${SUB}?loai_mach=thao_luan`]) {
      test(`${url}: không tràn ngang, chip xuống dòng gọn, chữ đọc được`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 800 });
        await page.goto(url);
        const d = await page.evaluate(() => ({
          cuon: document.documentElement.scrollWidth,
          rong: window.innerWidth,
        }));
        expect(d.cuon, `${url} tràn ngang`).toBeLessThanOrEqual(d.rong);

        const hop = await page
          .getByTestId("loc-loai")
          .getByRole("link")
          .evaluateAll((els) =>
            els.map((e) => {
              const r = e.getBoundingClientRect();
              return { trai: r.left, phai: r.right, tren: r.top };
            }),
          );
        expect(hop).toHaveLength(4);
        for (const h of hop) {
          expect(h.trai, "chip tràn mép trái").toBeGreaterThanOrEqual(0);
          expect(h.phai, "chip tràn mép phải").toBeLessThanOrEqual(375);
        }

        // Tương phản chữ chip (đang chọn / không chọn) và nhãn thẻ ≥ 4.5 (WCAG AA, chữ nhỏ).
        const chon = url.includes("loai_mach") ? "loc-loai-thao_luan" : "loc-loai-tat-ca";
        const khong_chon = "loc-loai-nhat_ky";
        for (const t of [chon, khong_chon]) {
          const ti_le = await tuongPhan(page, `[data-testid="${t}"]`);
          expect(ti_le, `${t} (${theme}) tương phản`).toBeGreaterThanOrEqual(4.5);
        }
        const ti_le_nhan = await tuongPhan(page, '[data-testid="nhan-loai"]');
        expect(ti_le_nhan, `nhãn loại (${theme}) tương phản`).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}
