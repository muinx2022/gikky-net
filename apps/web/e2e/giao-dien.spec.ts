import { expect, test, type Page } from "@playwright/test";

import { KHOA_KIEU_XEM } from "../lib/kieu-xem";
import { KHOA_THEME } from "../lib/theme";
import { TITLE_HPG, duongDan, timMachTheoTitle } from "./du-lieu";

/** Lượt giao diện 2026-08-23 — tiêu chí T1…T8 của
 * `plans/2026-08-23-giao-dien-reddit-va-theme.md`, đo trong **trình duyệt thật**.
 *
 * Nửa không cần trình duyệt (logic script inline, tương phản bằng số, cấu trúc layout) nằm
 * ở `e2e/don-vi/theme.spec.ts` và `e2e/don-vi/tuong-phan.spec.ts`. Ở đây chỉ những khẳng
 * định mà **chỉ một trình duyệt mới trả lời được**: có nháy không, có sống qua reload
 * không, có cuộn ngang không, focus có nhìn thấy không.
 */

const NEN_SANG = "rgb(241, 242, 245)"; // #F1F2F5
const NEN_TOI = "rgb(14, 17, 22)"; //    #0E1116

async function nenBody(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

/** Đặt sẵn `localStorage` **trước khi tài liệu đầu tiên chạy**.
 *
 * `addInitScript` chạy trước mọi script của trang, kể cả script inline trong `<head>` —
 * đúng thứ tự của một người đã chọn theme từ lần truy cập trước. Gọi `page.evaluate` sau
 * `goto` thì muộn mất một lượt tải, và bài đo sẽ đo lượt tải thứ hai.
 */
async function daChon(page: Page, khoa: string, gia_tri: string) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [khoa, gia_tri] as const,
  );
}

test.describe("T1 — ba trạng thái theme, và lựa chọn SỐNG qua tải lại", () => {
  test.use({ colorScheme: "light" });

  test("chọn Tối trên máy đang sáng ⇒ trang tối, và F5 vẫn tối", async ({ page }) => {
    await page.goto("/luat");
    expect(await nenBody(page), "khởi điểm: máy sáng, chưa chọn gì").toBe(NEN_SANG);

    await page.getByTestId("cong-tac-theme").selectOption("toi");
    expect(await nenBody(page), "đổi có tác dụng NGAY, không đợi reload").toBe(NEN_TOI);

    // Vế "được nhớ" — và nó phải đo bằng một lượt tải THẬT. Đọc lại `localStorage` chỉ
    // chứng minh có ghi, không chứng minh lượt tải sau đọc được nó.
    await page.reload();
    expect(await nenBody(page), "sống qua F5").toBe(NEN_TOI);
    expect(
      await page.getByTestId("cong-tac-theme").inputValue(),
      "công tắc hiện đúng lựa chọn đang bật",
    ).toBe("toi");
  });

  test('"Theo hệ thống" trả quyền lại cho máy — XOÁ lựa chọn, không ghi giá trị thứ ba', async ({
    page,
  }) => {
    await daChon(page, KHOA_THEME, "toi");
    await page.goto("/luat");
    expect(await nenBody(page)).toBe(NEN_TOI);

    await page.getByTestId("cong-tac-theme").selectOption("he");
    // Máy đang `colorScheme: light` ⇒ theo hệ thống nghĩa là sáng.
    expect(await nenBody(page)).toBe(NEN_SANG);
    expect(
      await page.evaluate((k) => window.localStorage.getItem(k), KHOA_THEME),
      "khoá phải bị XOÁ, không phải ghi 'he' — một trạng thái, một cách biểu diễn",
    ).toBeNull();
    expect(
      await page.evaluate(() => document.documentElement.hasAttribute("data-theme")),
      "data-theme phải VẮNG MẶT, nếu không @media dark không khớp nhánh nào",
    ).toBe(false);
  });
});

test.describe('T1 — "Theo hệ thống" đi theo prefers-color-scheme THẬT', () => {
  test.use({ colorScheme: "dark" });

  test("máy để tối, chưa chọn gì ⇒ trang tối", async ({ page }) => {
    await page.goto("/luat");
    expect(await nenBody(page)).toBe(NEN_TOI);
  });

  test("chọn Sáng THẮNG máy đang để tối", async ({ page }) => {
    await daChon(page, KHOA_THEME, "sang");
    await page.goto("/luat");
    expect(await nenBody(page)).toBe(NEN_SANG);
  });
});

test.describe("T2 — KHÔNG FOUC", () => {
  test.use({ colorScheme: "light" });

  test("tải trang ở chế độ Tối: data-theme đã đặt TRƯỚC khi <body> tồn tại", async ({
    page,
  }) => {
    // Định nghĩa đo được của "không nháy": lúc `<body>` xuất hiện trong DOM, `<html>` đã
    // mang theme đúng rồi. `<body>` chỉ ra đời khi `<head>` đã parse xong, nên nếu script
    // theme nằm trong `<head>` thì nó đã chạy; nếu ai dời nó xuống cuối `<body>` hay đẩy
    // nó vào bundle React thì tại khoảnh khắc này giá trị là `null` — tức trang vẽ một
    // lần bằng theme sai rồi mới đổi, đúng cái nháy trắng vào mặt người ngồi trong tối.
    await daChon(page, KHOA_THEME, "toi");
    await page.addInitScript(() => {
      const w = window as unknown as { __themeKhiCoBody?: string | null };
      // Quan sát `document`, KHÔNG `document.documentElement`: init script chạy trước khi
      // tài liệu được parse, và lúc ấy `documentElement` còn `null` — `observe(null)` ném,
      // observer không bao giờ gắn, và biến ở dưới mãi mãi `undefined`. Ca đó trông y hệt
      // "script theme chạy muộn", tức bài đo đỏ vì chính nó chứ không vì thứ nó đo.
      new MutationObserver(() => {
        if (document.body != null && w.__themeKhiCoBody === undefined) {
          w.__themeKhiCoBody = document.documentElement.getAttribute("data-theme");
        }
      }).observe(document, { childList: true, subtree: true });
    });

    await page.goto("/luat");
    const luc_do = await page.evaluate(
      () => (window as unknown as { __themeKhiCoBody?: string | null }).__themeKhiCoBody,
    );
    expect(luc_do, "theme phải có mặt ngay khi <body> xuất hiện").toBe("dark");
    expect(await nenBody(page)).toBe(NEN_TOI);
  });
});

test.describe("T3 — theme KHÔNG đi qua HTML đã cache", () => {
  test("HTML thô của server không mang data-theme, và giống hệt nhau giữa hai người", async ({
    request,
  }) => {
    // Trang mạch chạy ISR `revalidate=3600`: một bản HTML dùng chung cho MỌI người. Nếu ai
    // đó "cải tiến" bằng cách đọc cookie ở server rồi nướng `data-theme` vào `<html>`, thì
    // người thứ hai nhận theme của người thứ nhất — 200, không có gì đỏ ở đâu khác.
    //
    // Đo trên HTML THÔ (`request.get`, không chạy JS): script inline chưa chạy, nên mọi
    // `data-theme` tìm thấy ở đây đều là do SERVER đặt.
    const hpg = await timMachTheoTitle(TITLE_HPG);
    const duong_dan = duongDan(hpg);

    const khach = await request.get(duong_dan);
    expect(khach.ok()).toBe(true);
    const html_khach = await khach.text();
    const the_html = /<html[^>]*>/.exec(html_khach);
    expect(the_html, "phải cắt được thẻ <html>").not.toBeNull();
    expect(the_html?.[0], "server KHÔNG được đặt data-theme").not.toContain("data-theme");
    expect(the_html?.[0]).not.toContain("data-kieu-xem");

    // Vế thứ hai: một người mang sẵn cookie theme nhận về **đúng cùng một cái thẻ `<html>`**.
    const mang_cookie = await request.get(duong_dan, {
      headers: { cookie: `${KHOA_THEME}=toi; theme=dark; gikky-theme=dark` },
    });
    const the_html_2 = /<html[^>]*>/.exec(await mang_cookie.text());
    expect(the_html_2?.[0], "cookie theme KHÔNG được đổi HTML của server").toBe(
      the_html?.[0],
    );
  });
});

test.describe("T4 — hai kiểu xem feed, nhớ lựa chọn", () => {
  test("đổi sang Gọn ⇒ thẻ THẤP hơn, và F5 vẫn Gọn", async ({ page }) => {
    await page.goto("/");
    const the = page.getByTestId("the-mach").first();
    await expect(the).toBeVisible();
    const cao_the = (await the.boundingBox())?.height ?? 0;
    expect(cao_the).toBeGreaterThan(0);

    await page.getByTestId("kieu-xem-gon").click();
    // Chờ thuộc tính lên `<html>` TRƯỚC khi đo: `boundingBox` ép layout, nhưng nó không
    // chờ React commit xong — đo sớm một nhịp là ra chiều cao của kiểu cũ.
    await expect(page.locator("html")).toHaveAttribute("data-kieu-xem", "gon");
    const cao_gon = (await the.boundingBox())?.height ?? 0;
    // Đo CHIỀU CAO THẬT chứ không đọc lại tên lớp: một `data-kieu-xem` đặt đúng mà CSS
    // không khớp selector nào vẫn làm mọi phép kiểm dựa trên thuộc tính xanh.
    expect(cao_gon, "kiểu Gọn phải nén thật, không chỉ đổi một thuộc tính").toBeLessThan(
      cao_the,
    );

    await page.reload();
    await expect(page.getByTestId("the-mach").first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.getAttribute("data-kieu-xem")),
      "lựa chọn sống qua F5",
    ).toBe("gon");
    expect(
      await page.evaluate((k) => window.localStorage.getItem(k), KHOA_KIEU_XEM),
    ).toBe("gon");
    await expect(page.getByTestId("kieu-xem-gon")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test.describe("T6/T7 — bàn phím, focus, và mobile", () => {
  test("T6 — vòng focus THẤY ĐƯỢC ở cả hai theme", async ({ page }) => {
    for (const chon of ["sang", "toi"]) {
      await page.addInitScript(
        ([k, v]) => window.localStorage.setItem(k, v),
        [KHOA_THEME, chon] as const,
      );
      await page.goto("/luat");
      // Tab đầu tiên rơi vào một phần tử bấm được thật (logo hoặc link bỏ qua).
      await page.keyboard.press("Tab");
      const vien = await page.evaluate(() => {
        const e = document.activeElement;
        if (e === null || e === document.body) return null;
        const s = getComputedStyle(e);
        return { rong: s.outlineWidth, kieu: s.outlineStyle, mau: s.outlineColor };
      });
      expect(vien, `theme ${chon}: Tab phải đưa focus vào một phần tử`).not.toBeNull();
      expect(vien?.kieu, `theme ${chon}: vòng focus phải có kiểu nét`).not.toBe("none");
      expect(
        parseFloat(vien?.rong ?? "0"),
        `theme ${chon}: vòng focus phải dày ≥ 2px`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  test("T7 — 360px: KHÔNG trang nào cuộn ngang", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const hpg = await timMachTheoTitle(TITLE_HPG);
    for (const duong of ["/", "/luat", `/s/chung-khoan`, duongDan(hpg)]) {
      await page.goto(duong);
      const tran = await page.evaluate(() => ({
        cuon: document.documentElement.scrollWidth,
        nhin: document.documentElement.clientWidth,
      }));
      // +1 cho sai số làm tròn của thiết bị; không nới hơn — một pixel là làm tròn, mười
      // pixel là một phần tử tràn ra.
      expect(
        tran.cuon,
        `${duong} cuộn ngang: scrollWidth ${tran.cuon} > clientWidth ${tran.nhin}`,
      ).toBeLessThanOrEqual(tran.nhin + 1);
    }
  });
});

test.describe("T8 — không nút CHẾT nào mới", () => {
  test("ô tìm kiếm ở header là ô SỐNG, và không có nút Tham gia sub", async ({ page }) => {
    // Luật không đổi — "không nút chết" — nhưng TIỀN ĐỀ đã đổi: lúc viết bài này Phase 7
    // chưa có, nên nó khẳng định header KHÔNG được có ô search (một ô không tìm được gì
    // là nút chết). Phase 7 gộp vào 2026-08-23 ⇒ ô ấy nay phải **có mặt và tìm được
    // thật**. Khẳng định vì thế CHẶT HƠN bản cũ, không phải nới: bản cũ xanh cả khi
    // header chẳng có gì, bản này đòi gõ vào rồi phải tới được trang kết quả.
    await page.goto("/");
    const header = page.locator("header");
    const o = header.getByRole("searchbox");
    await expect(o, "Phase 7 đã có: header phải có ô tìm kiếm THẬT").toHaveCount(1);

    await o.fill("HPG");
    await o.press("Enter");
    await page.waitForURL(/\/tim-kiem\?/);
    // Trang kết quả phải render được — ô search dẫn tới một route CÓ THẬT, không phải 404.
    await expect(page.locator("main")).toBeVisible();

    // Nút "Tham gia sub" thì vẫn không bao giờ có: PLAN mục 4 loại khỏi v1, và nó khác ô
    // search ở chỗ nó không có endpoint nào và cũng sẽ không có.
    await expect(page.getByRole("button", { name: /tham gia/i })).toHaveCount(0);
  });

  test("mọi nút bị TẮT trên trang mạch đều nói ra lý do", async ({ page }) => {
    // Khách chưa đăng nhập: mũi tên vote và hàng reaction đều tắt. Luật ba đường của
    // `cot-vote.tsx` — `disabled` + `title` + `aria-label` — áp cho mọi nút tắt, và nút
    // reaction là loạt nút mới nhất phải theo nó.
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(duongDan(hpg));
    const tat = page.locator("button[disabled]");
    const n = await tat.count();
    expect(n, "trang này phải có ít nhất một nút tắt để bài đo không rỗng").toBeGreaterThan(
      0,
    );
    for (let i = 0; i < n; i += 1) {
      const nut = tat.nth(i);
      const nhan = await nut.getAttribute("aria-label");
      const title = await nut.getAttribute("title");
      const chu = (await nut.textContent())?.trim() ?? "";
      expect(
        (nhan ?? "").length + (title ?? "").length,
        `nút tắt "${chu}" không nói lý do (thiếu cả aria-label lẫn title)`,
      ).toBeGreaterThan(0);
    }
  });
});
