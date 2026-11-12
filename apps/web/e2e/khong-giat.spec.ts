import type { FeedOut } from "@gikky/api-client";
import { expect, test, type Page } from "@playwright/test";

import { dungTaiKhoan } from "./danh-tinh";

/** T8 của việc 14 (plan `plans/2026-11-11-thong-nhat-giao-dien-toan-site.md` §4.7 "Hết giật",
 * đợt E) — trên BẢN BUILD thật: tải trang thì rail phải và cụm nút header KHÔNG nhảy giữa lần vẽ
 * đầu (trước hydrate) và lúc `usePhien` đã trả lời.
 *
 * ## Cách bắt "lần vẽ đầu"
 *
 * Giữ mọi chunk JS của Next (`/_next/static/chunks/**`) lại cho tới khi đã đo: trang lúc ấy là
 * HTML server + CSS + script inline trong `<head>` (cờ `data-da-dang-nhap`) — đúng thứ người dùng
 * thấy trước hydrate, và tất định (không đua với tốc độ tải JS). Đo xong mới thả JS, chờ phiên
 * được biết (khách: `thanh-tai-khoan-khach`; thành viên: `nut-tai-khoan`), đo lại.
 *
 * Kèm hai phép đo chạy suốt lượt tải (cài bằng `addInitScript`, trước mọi script của trang):
 * - `PerformanceObserver({ type: "layout-shift", buffered: true })`, gom nguồn theo vùng — không
 *   cú dịch nào được có nguồn trong rail hay header;
 * - mỗi khung hình (`requestAnimationFrame`) ghi khối khách / cụm khách của header có ĐANG HIỆN
 *   không — ca thành viên: chúng không được hiện ở bất kỳ khung nào (không "chớp" lời mời).
 *
 * ## Ở 390px rail đứng DƯỚI nội dung
 *
 * Vị trí tuyệt đối của rail ở mobile còn phụ thuộc chiều cao nội dung chính, mà trang mạch có
 * cửa soạn bình luận (`composer-cua`) chỉ vẽ sau khi biết phiên (+60px — ngoài phạm vi đợt E,
 * đã báo). Nên ở 390px bài đo so vị trí của các khối rail TÍNH TỪ đỉnh rail (rail không tự nhảy)
 * cùng chiều cao từng khối; ở 1280px (rail cạnh nội dung) so vị trí tuyệt đối.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function machNhatKy(): Promise<string> {
  const r = await fetch(`${API}/api/v1/feeds/moi?limit=1&loai_mach=nhat_ky`);
  const f = (await r.json()) as FeedOut;
  const m = f.items[0];
  if (m === undefined) throw new Error("seed không có nhật ký");
  return `/m/${m.slug}-${m.id}`;
}

type SoDo = Record<string, [number, number, number, number] | null>;

/** Chạy trong trang: hộp của các khối rail + cụm phải header. `tuongDoi` ⇒ khối rail tính từ đỉnh rail. */
function doHop(tuongDoi: boolean): SoDo {
  const hop = (el: Element | null, goc = 0): [number, number, number, number] | null => {
    if (el === null) return null;
    const r = el.getBoundingClientRect();
    if (r.height === 0 && r.width === 0) return null;
    return [Math.round(r.left), Math.round(r.top + scrollY - goc), Math.round(r.width), Math.round(r.height)];
  };
  const rail = document.querySelector('[data-testid="rail-phai"]');
  const goc = tuongDoi && rail ? rail.getBoundingClientRect().top + scrollY : 0;
  const ra: SoDo = {};
  const khoi = [...(rail?.querySelectorAll("aside > *") ?? [])].filter((e) => e.getBoundingClientRect().height > 0);
  khoi.slice(0, 3).forEach((e, i) => (ra[`rail${i}:${e.getAttribute("data-testid")}`] = hop(e, goc)));
  const theme = document.querySelector('header [data-testid="cong-tac-theme"]');
  ra["header:theme"] = hop(theme);
  ra["header:cum-phai"] = hop(theme?.parentElement ?? null);
  return ra;
}

async function caiDo(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __ls: { v: number; vung: string[] }[];
      __khachHien: boolean;
      __cumKhachHien: boolean;
    };
    w.__ls = [];
    w.__khachHien = false;
    w.__cumKhachHien = false;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources: { node: Node | null }[];
      }[]) {
        if (e.hadRecentInput) continue;
        w.__ls.push({
          v: e.value,
          vung: e.sources.map((s) => {
            const el = s.node instanceof Element ? s.node : s.node?.parentElement;
            if (!el) return "?";
            if (el.closest("header")) return "header";
            if (el.closest('[data-testid="rail-phai"]')) return "rail";
            return el.closest("[data-testid]")?.getAttribute("data-testid") ?? el.tagName;
          }),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
    const hien = (sel: string) => {
      const el = document.querySelector(sel);
      return el !== null && el.checkVisibility() && el.getBoundingClientRect().height > 0;
    };
    const vong = () => {
      if (hien('[data-testid="khoi-khach"]')) w.__khachHien = true;
      if (hien('[data-testid="thanh-tai-khoan-chua-biet"]') || hien('[data-testid="thanh-tai-khoan-khach"]')) {
        w.__cumKhachHien = true;
      }
      requestAnimationFrame(vong);
    };
    requestAnimationFrame(vong);
  });
}

/** Tải `url` với JS bị giữ, đo; thả JS, chờ phiên được biết, đo lại. */
async function taiVaDo(page: Page, url: string, cho: string, tuongDoi: boolean) {
  let tha!: () => void;
  const cong = new Promise<void>((r) => (tha = r));
  await page.route("**/_next/static/chunks/**", async (route) => {
    await cong;
    await route.continue();
  });
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForSelector('[data-testid="rail-phai"] aside', { state: "attached" });
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].every((l) => l.sheet !== null),
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Vế chống rỗng: lúc đo "trước", React CHƯA chạy (chưa có cụm phiên thật nào).
  expect(await page.locator('[data-testid="thanh-tai-khoan-khach"], [data-testid="nut-tai-khoan"]').count(), `${url}: JS chưa được thả`).toBe(0);
  const truoc = await page.evaluate(doHop, tuongDoi);
  tha();
  await page.waitForSelector(cho, { state: "attached" });
  await page.waitForTimeout(600);
  const sau = await page.evaluate(doHop, tuongDoi);
  await page.unroute("**/_next/static/chunks/**");
  const ls = await page.evaluate(() => (window as unknown as { __ls: { v: number; vung: string[] }[] }).__ls);
  return { truoc, sau, ls };
}

function soSanh(url: string, truoc: SoDo, sau: SoDo) {
  const khoa = Object.keys(sau);
  expect(khoa.filter((k) => k.startsWith("rail")).length, `${url}: đo rỗng — rail không có khối nào`).toBeGreaterThan(0);
  expect(Object.keys(truoc), `${url}: tập khối rail đổi giữa trước/sau hydrate`).toEqual(khoa);
  for (const k of khoa) {
    const a = truoc[k];
    const b = sau[k];
    expect(a === null, `${url}: ${k} có mặt trước/sau khác nhau ${JSON.stringify([a, b])}`).toBe(b === null);
    if (a === null || b === null) continue;
    for (let i = 0; i < 4; i += 1) {
      expect(Math.abs(a[i] - b[i]), `${url}: ${k} nhảy ${JSON.stringify(a)} → ${JSON.stringify(b)}`).toBeLessThanOrEqual(1);
    }
  }
}

const KHO = [
  { ten: "1280", viewport: { width: 1280, height: 900 }, mobile: false },
  { ten: "390", viewport: { width: 390, height: 844 }, mobile: true },
] as const;

for (const kho of KHO) {
  test.describe(`T8 @${kho.ten} — khách: rail + header không nhảy khi tải`, () => {
    test.use({ viewport: kho.viewport, isMobile: kho.mobile, hasTouch: kho.mobile, serviceWorkers: "block" });

    test("`/`, `/s/<sub>`, `/m/<mạch>`", async ({ page }) => {
      await caiDo(page);
      for (const url of ["/", "/s/chung-khoan", await machNhatKy()]) {
        const { truoc, sau, ls } = await taiVaDo(page, url, '[data-testid="thanh-tai-khoan-khach"]', kho.mobile);
        // Vế dương: khách THẤY khối khách — ngay từ lần vẽ đầu.
        expect(Object.keys(truoc).some((k) => k.endsWith(":khoi-khach")), `${url}: khối khách không có trong lần vẽ đầu`).toBe(true);
        soSanh(url, truoc, sau);
        const lech = ls.filter((e) => e.vung.some((v) => v === "rail" || v === "header"));
        expect(lech, `${url}: layout-shift có nguồn ở rail/header`).toEqual([]);
      }
    });
  });

  test.describe(`T8 @${kho.ten} — đã đăng nhập: khối khách không chớp, header + rail không nhảy`, () => {
    test.use({ viewport: kho.viewport, isMobile: kho.mobile, hasTouch: kho.mobile, serviceWorkers: "block" });

    test("`/`, `/s/<sub>`, `/m/<mạch>`", async ({ page }) => {
      await dungTaiKhoan(page, `giat${kho.ten}`);
      // Vế tiền đề: helper để lại phiên trong `localStorage` — chính thứ script `<head>` đọc.
      expect(await page.evaluate(() => localStorage.getItem("gikky:phien"))).toContain('"dang_nhap":true');
      await caiDo(page);
      for (const url of ["/", "/s/chung-khoan", await machNhatKy()]) {
        const { truoc, sau, ls } = await taiVaDo(page, url, '[data-testid="nut-tai-khoan"]', kho.mobile);
        expect(Object.keys(sau).some((k) => k.endsWith(":khoi-khach")), `${url}: khối khách cho thành viên`).toBe(false);
        soSanh(url, truoc, sau);
        const co = await page.evaluate(() => {
          const w = window as unknown as { __khachHien: boolean; __cumKhachHien: boolean };
          return { khoi: w.__khachHien, cum: w.__cumKhachHien };
        });
        expect(co.khoi, `${url}: khối khách chớp hiện với thành viên`).toBe(false);
        expect(co.cum, `${url}: cụm "Đăng nhập/Đăng ký" chớp hiện với thành viên`).toBe(false);
        const lech = ls.filter((e) => e.vung.some((v) => v === "rail" || v === "header"));
        expect(lech, `${url}: layout-shift có nguồn ở rail/header`).toEqual([]);
      }
    });
  });
}

/* ------------------------------------------------ vòng sửa 3 (phản biện đợt E) -- */

test.describe("T8 — ô giữ chỗ nút Google", () => {
  test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });

  // Môi trường e2e TẮT Google (`GOOGLE_CLIENT_ID` rỗng), nên không có bài này thì bỏ hẳn ô giữ chỗ
  // vẫn xanh: khối không bao giờ phải đón nút. Giả lập Google BẬT bằng cách sửa câu trả lời của
  // `GET /me` (chỉ trường `google_bat`, phần còn lại là phản hồi thật của Django).
  test("Google BẬT, khách lượt đầu: nút Google hiện mà khối khách KHÔNG đổi chiều cao", async ({ page }) => {
    await page.route(/\/api\/v1\/me(\?|$)/, async (route) => {
      const that = await route.fetch();
      const than = (await that.json()) as Record<string, unknown>;
      await route.fulfill({ response: that, json: { ...than, google_bat: true } });
    });
    await caiDo(page);
    for (const url of ["/s/chung-khoan", "/"]) {
      const { truoc, sau, ls } = await taiVaDo(page, url, '[data-testid="thanh-tai-khoan-khach"]', false);
      await expect(page.getByTestId("khoi-khach-nut-google"), `${url}: đo rỗng — nút Google phải hiện`).toBeVisible();
      soSanh(url, truoc, sau);
      expect(ls.filter((e) => e.vung.includes("rail")), `${url}: layout-shift ở rail`).toEqual([]);
      // Chỉ lượt ĐẦU mới là "khách chưa từng vào" — lượt sau đã có phiên lưu.
      await page.evaluate(() => localStorage.clear());
    }
  });

  // Việc 17: gương JS `googleTatLucTai` đã gỡ, nên cờ `html[data-google-tat]` của script `<head>` là
  // thứ DUY NHẤT bỏ ô giữ chỗ ở lượt tải sau. Thiếu cờ thì không có cú giật nào để các bài trên bắt
  // (ô ở lại suốt lượt tải, trước = sau) — chỉ có một ô trống 40px thừa. Bài này hỏi thẳng điều đó.
  test("Google TẮT, khách QUAY LẠI: ô giữ chỗ Google không có từ lần vẽ đầu tới sau khi biết phiên", async ({ page }) => {
    expect((await page.goto("/s/chung-khoan"))?.status(), "/s/chung-khoan").toBe(200);
    await expect(page.getByTestId("thanh-tai-khoan-khach")).toBeVisible();
    // Vế tiền đề: phiên đã lưu nói Google tắt — chính thứ script `<head>` đọc.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("gikky:phien"))).toContain('"google_bat":false');
    let tha!: () => void;
    const cong = new Promise<void>((r) => (tha = r));
    await page.route("**/_next/static/chunks/**", async (route) => {
      await cong;
      await route.continue();
    });
    expect((await page.goto("/", { waitUntil: "commit" }))?.status(), "/").toBe(200);
    await page.waitForSelector('[data-testid="khoi-khach"]', { state: "attached" });
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].every((l) => l.sheet !== null),
    );
    const hien = () =>
      page.evaluate(() => {
        const o = document.querySelector('[data-testid="khoi-khach-cho-google"]');
        return o !== null && o.getBoundingClientRect().height > 0;
      });
    // Vế chống rỗng: lúc đo "trước", React CHƯA chạy (ô có trong HTML server, chỉ CSS mới ẩn được nó).
    expect(await page.getByTestId("thanh-tai-khoan-khach").count(), "JS chưa được thả").toBe(0);
    await expect(page.getByTestId("khoi-khach-cho-google"), "ô phải có trong HTML server").toHaveCount(1);
    expect(await hien(), "lần vẽ đầu: ô giữ chỗ Google hiện dù phiên lưu nói Google tắt").toBe(false);
    tha();
    await expect(page.getByTestId("thanh-tai-khoan-khach")).toBeVisible();
    await page.waitForTimeout(300);
    expect(await hien(), "sau khi biết phiên: ô giữ chỗ Google hiện").toBe(false);
    await page.unroute("**/_next/static/chunks/**");
  });

  test("Google TẮT: ô giữ chỗ chỉ sống ở lượt tải đầu; điều hướng client sang trang khác thì không còn, rail không giật", async ({
    page,
  }) => {
    await page.goto("/s/chung-khoan");
    await expect(page.getByTestId("thanh-tai-khoan-khach")).toBeVisible();
    // Lượt đầu, `/me` chưa trả lời lúc vẽ ⇒ ô ĐƯỢC giữ (và giữ tiếp: co lại là giật).
    await expect(page.getByTestId("khoi-khach-cho-google")).toHaveCount(1);

    const dich = await page
      .getByTestId("sidebar-cac-sub")
      .locator('a[href^="/s/"]:not([href="/s/chung-khoan"])')
      .first()
      .getAttribute("href");
    expect(dich, "đo rỗng: cần một chuyên mục khác để điều hướng").not.toBeNull();
    // Ghi chiều cao khối khách ở MỌI khung hình kể từ lúc URL đổi (trang mới).
    await page.evaluate((d) => {
      const w = window as unknown as { __cao: number[]; __choHien: boolean };
      w.__cao = [];
      w.__choHien = false;
      const vong = () => {
        if (location.pathname === d) {
          const k = document.querySelector('[data-testid="khoi-khach"]');
          if (k) w.__cao.push(Math.round(k.getBoundingClientRect().height));
          const o = document.querySelector('[data-testid="khoi-khach-cho-google"]');
          if (o && o.getBoundingClientRect().height > 0) w.__choHien = true;
        }
        requestAnimationFrame(vong);
      };
      requestAnimationFrame(vong);
    }, dich!);
    await page.getByTestId("sidebar-cac-sub").locator(`a[href="${dich}"]`).click();
    await page.waitForURL(`**${dich}`);
    await expect(page.getByTestId("khoi-khach")).toBeVisible();
    await page.waitForTimeout(800);
    // Vế chống rỗng: điều hướng là CLIENT (cùng `window`, vòng đo còn sống).
    const kq = await page.evaluate(() => {
      const w = window as unknown as { __cao?: number[]; __choHien?: boolean };
      return { cao: w.__cao ?? null, choHien: w.__choHien ?? null };
    });
    expect(kq.cao, "điều hướng không phải client — vòng đo đã mất").not.toBeNull();
    expect(kq.cao!.length, "đo rỗng: không khung nào ở trang mới").toBeGreaterThan(0);
    await expect(page.getByTestId("khoi-khach-cho-google")).toHaveCount(0);
    expect(kq.choHien, "ô giữ chỗ Google hiện ở trang mới").toBe(false);
    expect(new Set(kq.cao), "khối khách đổi chiều cao ở trang mới").toEqual(new Set([kq.cao![0]]));
  });
});

test("đăng xuất bằng menu ⇒ bề ngang cụm tài khoản đã lưu bị xoá (người kế không nhận)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await dungTaiKhoan(page, "rongtk");
  await page.goto("/");
  await expect(page.getByTestId("nut-tai-khoan")).toBeVisible();
  // Vế tiền đề: khoá đã được ghi khi cụm đăng nhập hiện.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gikky:rong-tai-khoan"))).not.toBeNull();
  await page.getByTestId("nut-tai-khoan").click();
  await page.getByTestId("nut-dang-xuat").click();
  await expect(page.getByTestId("thanh-tai-khoan-khach")).toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.getItem("gikky:rong-tai-khoan"))).toBeNull();
});
