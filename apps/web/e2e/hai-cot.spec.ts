import type { FeedOut, SubChiTietOut } from "@gikky/api-client";
import { expect, test, type Page } from "@playwright/test";

import { dungTaiKhoan } from "./danh-tinh";

/** Hai cột toàn site (user 2026-11-10: "thống nhất giao diện chung của web là 2 cột, 1 cột
 * content và cột bên phải"; plan `2026-11-10-hai-cot-toan-site.md` W1–W5, W9, W10) — đo trên
 * BẢN BUILD thật. Hàng rào tĩnh (không file `cot-trai.*`, một lưới duy nhất) ở
 * `don-vi/hai-cot.spec.ts`.
 *
 * Tiêu chí chính: cột nội dung có CÙNG `x` và CÙNG bề rộng trên MỌI trang ở cùng viewport.
 * Trước đó: `/` x=85,w=760; `/s/x`, `/m/…`, `/u/…`, `/luat`, đăng nhập… x=278,w=635 — mỗi lần
 * điều hướng giữa hai nhóm là cột nhảy 193px.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

async function mot(loai: string): Promise<string> {
  const f = await api<FeedOut>(
    `/api/v1/feeds/moi?sort=tu_nhien&khoang=tat_ca&limit=1&loai_mach=${loai}`,
  );
  const m = f.items[0];
  if (m === undefined) throw new Error(`seed không có mạch loại ${loai}`);
  return `/m/${m.slug}-${m.id}`;
}

/** Mọi URL có khung hai cột mà KHÁCH vào được. `/dang-mach` đẩy khách về đăng nhập ở client
 * nhưng vẫn render khung trước đó. */
async function urlKhach(): Promise<Record<string, string>> {
  return {
    "/": "/",
    "/?tab=moi": "/?tab=moi",
    "/chu-de": "/chu-de",
    "/s/chung-khoan": "/s/chung-khoan",
    "/s/e2e-thu-nghiem": "/s/e2e-thu-nghiem",
    "/s/e2e-sub-rong": "/s/e2e-sub-rong",
    "/m/ nhật ký": await mot("nhat_ky"),
    "/m/ chủ đề": await mot("thao_luan"),
    "/m/ bài viết": await mot("bai_viet"),
    "/u/e2e_nhieu_mach": "/u/e2e_nhieu_mach",
    "/tim-kiem?q=e2e": "/tim-kiem?q=e2e",
    "/luat": "/luat",
    "/dang-nhap": "/dang-nhap",
    "/dang-ky": "/dang-ky",
    "/dang-mach": "/dang-mach",
    "/quen-mat-khau": "/quen-mat-khau",
  };
}

const soCot = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const t = getComputedStyle(el).gridTemplateColumns;
    return t === "none" ? 1 : t.trim().split(/\s+/).length;
  });

const hopMain = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector("main")?.getBoundingClientRect();
    return r ? { x: Math.round(r.x * 10) / 10, w: Math.round(r.width * 10) / 10 } : null;
  });

test.describe("W1/W2 — cột nội dung cùng x, cùng bề rộng ở MỌI trang; không cột trái", () => {
  test("1280x900: 16 URL của khách — main cùng (x, width=760), đúng một <main>, hai cột", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const urls = await urlKhach();
    const do_duoc: Record<string, { x: number; w: number }> = {};
    for (const [nhan, url] of Object.entries(urls)) {
      await page.goto(url);
      await expect(page.getByTestId("khung-hai-cot"), `${nhan}: khung`).toHaveCount(1);
      await expect(page.locator("main"), `${nhan}: số <main>`).toHaveCount(1);
      await expect(page.locator('aside[aria-label="Cột điều hướng"]'), `${nhan}: cột trái`).toHaveCount(0);
      await expect(page.getByTestId("sidebar"), `${nhan}: rail phải`).toHaveCount(1);
      expect(await soCot(page, '[data-testid="khung-hai-cot"]'), `${nhan}: số cột`).toBe(2);
      const h = await hopMain(page);
      if (h === null) throw new Error(`${nhan}: không có main`);
      do_duoc[nhan] = h;
    }
    const tap = new Set(Object.values(do_duoc).map((h) => `${h.x}/${h.w}`));
    expect([...tap], `main khác nhau giữa các trang: ${JSON.stringify(do_duoc)}`).toHaveLength(1);
    expect(Object.values(do_duoc)[0].w, "bề rộng cột nội dung").toBe(760);
  });

  test("rail phải có tên landmark: đúng MỘT complementary tên «Thanh bên» trên `/` và `/s/<sub>`", async ({
    page,
  }) => {
    // Cột trái cũ mang `aria-label="Cột điều hướng"`; sau khi bỏ nó, mỗi trang còn hai
    // landmark `complementary` (rail và «Đăng bài nhanh») và rail là cái VÔ DANH — người đọc
    // màn hình không phân biệt được hai vùng. Tên nằm ở `<aside>` của `Sidebar`.
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const url of ["/", "/s/chung-khoan"]) {
      await page.goto(url);
      await expect(page.getByTestId("sidebar"), `${url}: rail`).toHaveCount(1);
      await expect(
        page.getByRole("complementary", { name: "Thanh bên", exact: true }),
        `${url}: landmark «Thanh bên»`,
      ).toHaveCount(1);
      // Và chính `<aside data-testid="sidebar">` là cái mang tên đó (không phải một aside khác).
      await expect(page.getByTestId("sidebar")).toHaveAttribute("aria-label", "Thanh bên");
    }
  });

  test("click thật `/` → `/s/chung-khoan` → mạch → hồ sơ tác giả: x của main KHÔNG đổi", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const goc = await hopMain(page);
    expect(goc).not.toBeNull();

    await page.locator('a[href="/s/chung-khoan"]').first().click();
    await page.waitForURL("**/s/chung-khoan");
    await expect(page.getByTestId("khung-hai-cot")).toBeVisible();
    expect(await hopMain(page), "/s/chung-khoan").toEqual(goc);

    await page.getByTestId("the-mach").first().locator('a[href^="/m/"]').first().click();
    await page.waitForURL("**/m/**");
    await expect(page.getByTestId("khung-hai-cot")).toBeVisible();
    expect(await hopMain(page), "/m/…").toEqual(goc);

    // Hồ sơ tác giả: link `/u/…` đầu tiên trong nội dung chính của trang mạch.
    const href = await page.locator('main a[href^="/u/"]').first().getAttribute("href");
    expect(href, "trang mạch có link tới hồ sơ tác giả").not.toBeNull();
    await page.locator('main a[href^="/u/"]').first().click();
    await page.waitForURL(`**${href}`);
    await expect(page.getByTestId("khung-hai-cot")).toBeVisible();
    expect(await hopMain(page), href!).toEqual(goc);
  });

  test("khi đăng nhập: các trang cần phiên cũng cùng (x, width)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const goc = await hopMain(page);
    const ai = await dungTaiKhoan(page, "haicot");
    for (const url of ["/", "/cai-dat", "/sua-ho-so", "/khu-mod", "/doi-mat-khau", `/u/${ai.username}`]) {
      await page.goto(url);
      await expect(page.getByTestId("khung-hai-cot"), url).toHaveCount(1);
      await expect(page.locator("main"), `${url}: số <main>`).toHaveCount(1);
      expect(await hopMain(page), url).toEqual(goc);
      // Đã đăng nhập ⇒ KHÔNG có khối "Tham gia" của khách. Chờ tới lúc phiên đã biết (nút tài
      // khoản hiện) rồi mới đếm: khối khách vẽ SAU khi biết phiên, nên đếm sớm thì 0 là đúng cả
      // khi khối bị vẽ nhầm cho người đã đăng nhập — một phép đo vô nghĩa.
      await expect(page.getByTestId("nut-tai-khoan"), `${url}: phiên`).toBeVisible();
      await expect(page.getByTestId("khoi-khach"), `${url}: khối khách`).toHaveCount(0);
    }
  });
});

test.describe("W3/W4 — rail phải mang khối Chuyên mục; link nội bộ không bớt", () => {
  test("mọi trang trừ `/luat`: HTML thô có đủ link `/s/*` của GET /subs và `/luat`; khối nằm trong rail", async ({
    page,
    request,
  }) => {
    const subs = await api<SubChiTietOut[]>("/api/v1/subs");
    expect(subs.length, "seed phải có sub").toBeGreaterThan(5);
    const urls = await urlKhach();
    for (const [nhan, url] of Object.entries(urls)) {
      if (url === "/luat") continue;
      const html = await (await request.get(url)).text();
      for (const s of subs) {
        expect(html, `${nhan}: thiếu link /s/${s.slug} trong HTML thô`).toContain(`href="/s/${s.slug}"`);
      }
      expect(html, `${nhan}: thiếu link /luat`).toContain('href="/luat"');

      await page.goto(url);
      const trong_rail = await page
        .getByTestId("rail-phai")
        .getByTestId("sidebar-cac-sub")
        .locator('a[href^="/s/"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      for (const s of subs) {
        expect(trong_rail, `${nhan}: khối Chuyên mục trong rail thiếu /s/${s.slug}`).toContain(`/s/${s.slug}`);
      }
    }
  });

  test("`/luat` (tĩnh): HTML thô không gọi API; Chuyên mục tự nạp ở trình duyệt, đủ danh sách", async ({
    page,
    request,
  }) => {
    const subs = await api<SubChiTietOut[]>("/api/v1/subs");
    const html = await (await request.get("/luat")).text();
    expect(html, "HTML tĩnh của /luat không có khối Chuyên mục từ server").not.toContain(
      'data-testid="sidebar-cac-sub"',
    );
    await page.goto("/luat");
    const khoi = page.getByTestId("rail-phai").getByTestId("sidebar-cac-sub");
    await expect(khoi).toBeVisible();
    const href = await khoi.locator('a[href^="/s/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    for (const s of subs) expect(href).toContain(`/s/${s.slug}`);
  });
});

test.describe("W5 — khối khách ở rail phải", () => {
  test("khách thấy khối; 'Tiếp tục với email' mở modal; 'Tạo tài khoản mới' → /dang-ky", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const url of ["/", "/s/chung-khoan", "/luat"]) {
      await page.goto(url);
      const khoi = page.getByTestId("rail-phai").getByTestId("khoi-khach");
      await expect(khoi, url).toBeVisible();
      // Trang chủ đổi tiêu đề khối khách (plan giao diện mới §3.4); mọi trang khác giữ nguyên.
      await expect(khoi).toContainText(url === "/" ? "Bắt đầu nhật ký của bạn" : "Tham gia Gikky.net");
      await expect(khoi.getByTestId("khoi-khach-nut-email")).toBeVisible();
      await expect(khoi.getByTestId("khoi-khach-nut-dang-ky")).toHaveAttribute("href", "/dang-ky");
      await expect(khoi.getByRole("link", { name: "Luật cộng đồng" })).toHaveAttribute("href", "/luat");
    }
    await page.goto("/");
    await page.getByTestId("khoi-khach-nut-email").click();
    await expect(page.getByTestId("modal-dang-nhap")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/");
    await page.getByTestId("khoi-khach-nut-dang-ky").click();
    await page.waitForURL("**/dang-ky");
  });

  test("đã đăng nhập: không có khối khách; 'Hồ sơ của tôi' + 'Cài đặt' tới được từ menu tài khoản", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const ai = await dungTaiKhoan(page, "haicot_tk");
    await page.goto("/s/chung-khoan");
    await expect(page.getByTestId("nut-tai-khoan")).toBeVisible();
    await expect(page.getByTestId("khoi-khach")).toHaveCount(0);
    await page.getByTestId("nut-tai-khoan").click();
    const menu = page.getByTestId("menu-tai-khoan");
    await expect(menu.getByRole("menuitem", { name: "Hồ sơ của tôi" })).toHaveAttribute("href", `/u/${ai.username}`);
    await expect(menu.getByRole("menuitem", { name: "Cài đặt" })).toHaveAttribute("href", "/cai-dat");
  });
});

for (const theme of ["light", "dark"] as const) {
  test.describe(`W9 — hẹp: một cột, rail DƯỚI nội dung (theme ${theme})`, () => {
    test.use({ colorScheme: theme });
    for (const w of [375, 768]) {
      test(`${w}px: không tràn ngang, main và rail không chồng nhau`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 900 });
        const urls = await urlKhach();
        for (const nhan of ["/", "/s/e2e-thu-nghiem", "/m/ nhật ký", "/luat", "/dang-nhap"]) {
          await page.goto(urls[nhan]);
          expect(await soCot(page, '[data-testid="khung-hai-cot"]'), `${nhan}@${w}: số cột`).toBe(1);
          const rong = await page.evaluate(() => ({
            cuon: document.documentElement.scrollWidth,
            khung: window.innerWidth,
          }));
          expect(rong.cuon, `${nhan}@${w}: cuộn ngang`).toBeLessThanOrEqual(rong.khung);
          const chinh = await page.locator("main").first().boundingBox();
          const rail = await page.getByTestId("rail-phai").boundingBox();
          if (chinh === null || rail === null) throw new Error(`${nhan}: không đo được main/rail`);
          expect(rail.y, `${nhan}@${w}: rail dưới nội dung`).toBeGreaterThanOrEqual(chinh.y + chinh.height - 1);
        }
      });
    }
  });
}

test.describe("W10 — rail tới được bằng cuộn TRANG ở laptop thấp", () => {
  for (const [w, h] of [
    [1366, 768],
    [1280, 720],
  ] as const) {
    test(`${w}x${h} trên trang mạch: không vùng cuộn con trong rail, phần tử cuối vào được khung nhìn`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      const urls = await urlKhach();
      await page.goto(urls["/m/ nhật ký"]);
      const rail = page.getByTestId("rail-phai");
      await expect(rail).toBeVisible();
      // Khối khách vẽ sau khi biết phiên và làm rail cao thêm: đo SAU lúc ấy.
      await expect(rail.getByTestId("khoi-khach")).toBeVisible();
      const do_dac = await rail.evaluate((goc) => {
        const vung_cuon: string[] = [];
        for (const e of [goc, ...goc.querySelectorAll("*")]) {
          const o = getComputedStyle(e).overflowY;
          if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight + 1) {
            vung_cuon.push(`${e.tagName}.${e.className}`);
          }
        }
        return {
          vung_cuon,
          vi_tri: getComputedStyle(goc).position,
          cao_rail: goc.getBoundingClientRect().height,
        };
      });
      expect(do_dac.vung_cuon, JSON.stringify(do_dac)).toEqual([]);
      expect(do_dac.vi_tri, "rail cao hơn khung nhìn thì KHÔNG dính").not.toBe("sticky");

      await rail.evaluate((goc) => {
        let cuoi: Element = goc;
        while (cuoi.lastElementChild) cuoi = cuoi.lastElementChild;
        cuoi.scrollIntoView({ block: "end" });
      });
      const sau = await rail.evaluate((goc) => {
        let cuoi: Element = goc;
        while (cuoi.lastElementChild) cuoi = cuoi.lastElementChild;
        const r = cuoi.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, khung: window.innerHeight };
      });
      expect(sau.top, JSON.stringify(sau)).toBeGreaterThanOrEqual(0);
      expect(sau.bottom, JSON.stringify(sau)).toBeLessThanOrEqual(sau.khung + 1);
    });
  }
});
