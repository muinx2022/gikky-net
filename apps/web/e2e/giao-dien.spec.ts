import { expect, test, type Page } from "@playwright/test";

import { TEN_DAU_CHU_NGUOI_DUNG } from "../lib/chu-nguoi-dung";
import { KHOA_KIEU_XEM } from "../lib/kieu-xem";
import { KHOA_THEME } from "../lib/theme";
import { dungTaiKhoan } from "./danh-tinh";
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

/** Thoát ký tự đặc biệt để một chuỗi dữ liệu dùng được làm mẫu regex.
 *
 * Username của e2e hiện chỉ có chữ và số, nên hôm nay chuỗi nào cũng an toàn — và đó
 * chính là lý do phải thoát: ngày `danhTinhMoi` đổi bộ ký tự, một dấu `.` hay `+` lọt vào
 * sẽ làm mẫu khớp RỘNG hơn ý định, tức bài đo xanh trong khi tên đã sai. Hỏng kiểu ấy
 * không đỏ ở đâu cả.
 */
function thoatRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("T1 — công tắc hai trạng thái, và lựa chọn SỐNG qua tải lại", () => {
  test.use({ colorScheme: "light" });

  test("bấm công tắc trên máy đang sáng ⇒ trang tối, và F5 vẫn tối", async ({ page }) => {
    await page.goto("/luat");
    expect(await nenBody(page), "khởi điểm: máy sáng, chưa chọn gì").toBe(NEN_SANG);

    const nut = page.getByTestId("cong-tac-theme");
    await expect(nut, "đang sáng ⇒ đích của cú bấm là TỐI").toHaveAttribute(
      "data-muc-tieu",
      "toi",
    );
    await nut.click();
    expect(await nenBody(page), "đổi có tác dụng NGAY, không đợi reload").toBe(NEN_TOI);

    // Vế "được nhớ" — và nó phải đo bằng một lượt tải THẬT. Đọc lại `localStorage` chỉ
    // chứng minh có ghi, không chứng minh lượt tải sau đọc được nó.
    await page.reload();
    expect(await nenBody(page), "sống qua F5").toBe(NEN_TOI);
    await expect(
      page.getByTestId("cong-tac-theme"),
      "đang tối ⇒ đích lật sang SÁNG",
    ).toHaveAttribute("data-muc-tieu", "sang");
  });

  test("MỌI cú bấm đều đổi nền — không nước đi nào là no-op", async ({ page }) => {
    /* **Bài đo của chính cái lỗi user báo 2026-08-24.**
     *
     * Ô chọn ba trạng thái cũ có một nước đi vô hình: trên máy đang để TỐI, mặc định là
     * "theo hệ thống" nên trang đã tối, và chọn "Tối" đổi `data-theme` mà không đổi một
     * pixel nào. Người dùng kết luận công tắc hỏng — kết luận đúng với thứ họ thấy.
     *
     * Nút hai trạng thái luôn đặt lựa chọn NGƯỢC với thứ đang hiện, nên vòng lặp dưới đây
     * phải thấy nền **đổi ở mọi bước**. Đo trên máy để TỐI, tức đúng ca đã hỏng.
     */
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/luat");
    expect(await nenBody(page), "máy tối, chưa chọn gì").toBe(NEN_TOI);

    const nut = page.getByTestId("cong-tac-theme");
    const mong = [NEN_SANG, NEN_TOI, NEN_SANG, NEN_TOI];
    for (const [i, nen] of mong.entries()) {
      await nut.click();
      expect(await nenBody(page), `cú bấm thứ ${i + 1} phải đổi nền`).toBe(nen);
    }
  });
});

test.describe("T1c — hai control, MỘT trạng thái", () => {
  test.use({ colorScheme: "light" });

  test("bấm nút ở header ⇒ ô chọn ở chân trang đi theo NGAY", async ({ page }) => {
    /* Lỗi đo được ở bản đầu của lượt 2026-08-24: mỗi control giữ `useState` riêng và đọc
     * `localStorage` đúng một lần lúc mount. Bấm nút ⇒ trang đổi màu, `localStorage` đổi,
     * mà ô chọn ở chân trang **vẫn hiện giá trị cũ**. Hai control nói hai chuyện khác
     * nhau về cùng một trạng thái, và không có gì báo.
     *
     * Cách vá: cả hai đi qua `useLuaChonTheme` — `<html>[data-theme]` làm bus, đọc lại
     * `localStorage` mỗi lần nó đổi. Bài này ghim rằng chúng còn dính nhau.
     */
    await page.goto("/luat");
    const nut = page.getByTestId("cong-tac-theme");
    const o_chon = page.getByTestId("chon-giao-dien-select");

    expect(await o_chon.inputValue(), "chưa chọn gì ⇒ theo hệ thống").toBe("he");

    await nut.click();
    expect(await o_chon.inputValue(), "ô chọn phải đi theo cú bấm ở header").toBe("toi");

    await nut.click();
    expect(await o_chon.inputValue()).toBe("sang");
  });
});

test.describe('T1b — "Theo hệ thống" chọn lại được ở CHÂN TRANG, không cần đăng nhập', () => {
  test.use({ colorScheme: "light" });

  test("chọn lại Theo hệ thống ⇒ XOÁ lựa chọn, không ghi giá trị thứ ba", async ({
    page,
  }) => {
    /* Đây là **cái giá của nút hai trạng thái**, và nó phải có một bài đo riêng.
     *
     * Nút ở header không còn đặt được "theo hệ thống": bấm nó luôn ghi `sang` hoặc `toi`.
     * Nếu không có cửa thứ hai thì người đã bấm một lần bị ghim vĩnh viễn vào một theme
     * cứng, và mất mát ấy chỉ lộ ra vào buổi tối — không ai báo lỗi được. Cửa thứ hai là
     * ô chọn ba trạng thái ở CHÂN TRANG; bài này ghim rằng nó còn sống, còn xoá đúng
     * khoá, và **KHÔNG đòi đăng nhập** — chính người báo lỗi gốc đang là khách, nên một
     * cửa nằm sau `/cai-dat` sẽ vá cho đúng người không cần vá.
     *
     * Đo trên `/luat` vì đó là route TĨNH: nó chứng minh luôn rằng ô chọn không kéo cả
     * cây route thành dynamic.
     */
    await daChon(page, KHOA_THEME, "toi");
    await page.goto("/luat");
    expect(await nenBody(page)).toBe(NEN_TOI);

    await page.getByTestId("chon-giao-dien-select").selectOption("he");
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
    // `/tim-kiem` vào danh sách 2026-08-30: từ lượt "lối vào tìm kiếm mobile", nó là ĐÍCH
    // của icon kính lúp trên mọi trang di động — một trang chỉ tới được bằng gõ tay URL
    // thì tràn ngang không ai thấy, một trang có lối vào trên header thì phải chịu T7.
    for (const duong of ["/", "/luat", `/s/chung-khoan`, "/tim-kiem", duongDan(hpg)]) {
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

  test("T7b — đã đăng nhập: header MỘT dòng, không cuộn ngang, ở CẢ BỐN nhánh CSS", async ({
    page,
  }) => {
    /* **Bài đo của lỗi user báo 2026-08-31**: trên điện thoại, đăng nhập xong thanh trên
     * cùng trôi xuống HAI dòng.
     *
     * T7 ngay trên không bắt được vì nó đo **khách**, và bản đầu của chính bài này không
     * bắt hết vì nó chỉ đo **một điểm 360px**. Hai nguyên nhân khác nhau đã trốn qua đúng
     * hai lỗ ấy, nên cả hai đều được đóng ở đây:
     *
     * 1. chữ `u/<username>` (mono, dài theo tên) làm cụm phải không lọt khung 360px, và
     *    `chrome.module.css` ≤420px cho `.trong` `flex-wrap` nên nó xuống dòng thay vì
     *    tràn — tức T7 vẫn xanh trong lúc header vỡ làm đôi;
     * 2. hộp bọc `.boc` của `OTimKiem` vẫn là grid item của `.trong` sau khi ô nhập bên
     *    trong đã bị ẩn ⇒ ba con trong lưới hai cột `1fr auto`, cụm phải bị đẩy xuống
     *    hàng hai trên TOÀN dải 421–860px, **kể cả khách**. Một bài đo ở 360px không thấy
     *    gì vì 360 rơi vào nhánh `flex-wrap`, nơi lưới không còn cầm trịch.
     *
     * Nên bốn mốc dưới đây không phải là "đo cho nhiều": mỗi con số rơi vào ĐÚNG một
     * nhánh CSS của thanh trên cùng — 360 (≤420 `flex-wrap`) · 430 (421–640, lưới, iPhone
     * Plus/Pro Max) · 640 (mép của khối 640) · 768 (641–860, vẫn chưa có ô tìm).
     */
    const ai = await dungTaiKhoan(page, "t7b");
    const chu_ten = `u/${ai.username}`;

    for (const rong of [360, 430, 640, 768]) {
      // Đặt khung nhìn TRƯỚC khi tải: đo sau một `goto` ở khổ khác là đo một bố cục đã
      // được tính bằng con số cũ rồi mới co lại.
      await page.setViewportSize({ width: rong, height: 780 });
      await page.goto("/");

      // Chống pass rỗng: hai phép đầu so hai hình chữ nhật, mà `boundingBox` của thứ
      // không tồn tại là `null` — không chốt "đang đăng nhập" trước thì cả bài đo thành
      // một câu hỏi về hai thứ không có mặt.
      const nut = page.getByTestId("nut-tai-khoan");
      await expect(nut, `${rong}px: phải ĐANG đăng nhập thì bài đo mới có nghĩa`).toBeVisible();
      const hieu = page.locator("header").getByRole("link", { name: "gikky", exact: true });
      await expect(hieu).toBeVisible();

      const hop_hieu = await hieu.boundingBox();
      const hop_nut = await nut.boundingBox();
      if (hop_hieu === null || hop_nut === null) {
        throw new Error(`${rong}px: không đo được hộp bao của hiệu hoặc của nút tài khoản`);
      }

      // 1. MỘT dòng — hiệu và nút tài khoản cùng hàng. So tâm-y chứ không so `y`: hai
      //    phần tử cùng hàng vẫn khác chiều cao (hiệu 23px, nút 32–44px).
      const tam_hieu = hop_hieu.y + hop_hieu.height / 2;
      const tam_nut = hop_nut.y + hop_nut.height / 2;
      expect(
        Math.abs(tam_hieu - tam_nut),
        `${rong}px: header trôi 2 dòng — tâm-y hiệu ${tam_hieu} vs nút tài khoản ${tam_nut}`,
      ).toBeLessThanOrEqual(4);

      // 2. Không cuộn ngang — cùng phép đo của T7, vì "một dòng" cũng đạt được bằng cách
      //    đẩy cụm phải tràn ra ngoài khung nhìn.
      const tran = await page.evaluate(() => ({
        cuon: document.documentElement.scrollWidth,
        nhin: document.documentElement.clientWidth,
      }));
      expect(
        tran.cuon,
        `${rong}px: / cuộn ngang — scrollWidth ${tran.cuon} > clientWidth ${tran.nhin}`,
      ).toBeLessThanOrEqual(tran.nhin + 1);

      // 3. Chữ `u/<username>`: ẩn thị giác ở ≤640px, và **hiện lại** ở trên mốc ấy. Vế
      //    thứ hai không phải phần thừa — nó là thứ chặn một cú "vá" bằng cách giấu tên
      //    người dùng ở mọi khổ màn hình.
      const chu = nut.locator(`[${TEN_DAU_CHU_NGUOI_DUNG}]`);
      const hop_chu = await chu.boundingBox();
      expect(
        hop_chu,
        `${rong}px: span ${chu_ten} phải còn trong bố cục — \`display: none\` là cách vá sai`,
      ).not.toBeNull();
      const rong_chu = hop_chu?.width ?? Number.POSITIVE_INFINITY;
      if (rong <= 640) {
        expect(rong_chu, `${rong}px: chữ tên phải ẩn thị giác (bề ngang ≤ 1px)`).toBeLessThanOrEqual(
          1,
        );
        // …nhưng KHÔNG được biến mất khỏi cây trợ năng: accessible name của nút là tên
        // người đang đăng nhập, và một cái tên đổi theo bề ngang màn hình là một nút
        // "menu" vô danh với trình đọc màn hình.
        await expect(
          nut,
          `${rong}px: accessible name của nút KHÔNG được đổi theo bề ngang màn hình`,
        ).toHaveAccessibleName(new RegExp(thoatRegex(chu_ten)));
      } else {
        expect(rong_chu, `${rong}px: trên mốc 640 chữ tên phải NHÌN THẤY`).toBeGreaterThan(1);
      }
    }
  });

  test("T7c — 430px: bấm kính lúp vẫn xổ ra Ô TÌM THẬT, không phải panel rỗng", async ({
    page,
  }) => {
    /* Bài này là **cái giá của bản vá T7b #2** và phải đi cùng nó.
     *
     * Cách chữa "header vỡ hai dòng ở 421–860px" là ẩn luôn `.boc` — gốc của `OTimKiem` —
     * dưới 860px, để nó thôi chiếm một cột của lưới. Nhưng panel xổ trên di động nhúng lại
     * **chính component ấy**, nên cùng một luật ẩn cũng bắn vào bản trong panel: bấm kính
     * lúp ra một cái hộp trắng, không ô nhập nào. Ghi đè `.boc.boc_panel` chữa chuyện đó.
     *
     * `e2e/don-vi/loi-vao-tim-kiem.spec.ts` đã so mốc của hai luật ấy, nhưng nó đọc NGUỒN:
     * nó không trả lời được câu "ô nhập có thật sự hiện ra không" — thứ phụ thuộc vào
     * specificity, thứ tự nguồn, và cả việc `trongPanel` có được truyền xuống hay không.
     * Mà ≤860px thì panel này là lối vào tìm kiếm DUY NHẤT, nên hỏng ở đây là mất hẳn
     * tính năng trên di động.
     *
     * Locator là `input[name="q"]` chứ không `getByRole("searchbox")`: ô nhập mang vai
     * combobox từ lượt gợi ý-khi-gõ (đúng chỗ T8 đang đỏ, `P-20260830-12`), và bài này
     * không có lý do gì phải chết theo món nợ đó.
     */
    await page.setViewportSize({ width: 430, height: 780 });
    await page.goto("/");

    const nut = page.getByTestId("nut-tim-kiem");
    await expect(nut, "≤860px phải có icon kính lúp — lối vào tìm kiếm duy nhất").toBeVisible();
    await nut.click();

    const panel = page.getByTestId("panel-tim-kiem");
    await expect(panel).toBeVisible();
    const o = panel.locator('input[name="q"]');
    await expect(o, "panel RỖNG: bản `.boc` trong panel không được gỡ ẩn").toBeVisible();

    // Hiện diện trong DOM là chưa đủ — một ô rộng 0px cũng "visible" nếu nó còn viền.
    const hop = await o.boundingBox();
    expect(hop?.width ?? 0, "ô tìm trong panel co còn 0px").toBeGreaterThan(100);

    // …và nó gõ được thật, không phải một hộp trang trí.
    await o.fill("HPG");
    await expect(o).toHaveValue("HPG");
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
