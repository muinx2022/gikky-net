import type { TrangBanTinOut } from "@gikky/api-client";
import { expect, test, type Page } from "@playwright/test";

import { donThuVien, dungThuVien, py } from "./thu-vien";

/** Việc 19 — plan `2026-11-13-ban-tin-len-dau-ban-quyen.md` §5, trên BẢN BUILD thật.
 *
 * - T1–T5: dải "Bản tin thị trường" là MỘT dòng mảnh ngay dưới header của `/` (trước đó nằm cuối
 *   section "Bài viết", sau 4–5 màn hình).
 * - T6: dòng `© {năm} gikky.net` trong chân trang cột phải. Hàm năm (T7) đo ở
 *   `e2e/don-vi/ban-quyen.spec.ts`.
 * - T10–T11: khối "Chủ đề tuần" không còn ô quan điểm; phần còn lại nguyên vẹn.
 * - T13: bối cảnh của chủ đề hiện trọn đoạn trích (kẹp 6 dòng, không còn 2).
 * - V2–V5 (vòng 2, plan §3.6): dải vẽ 2 bản tin, đọc được với tiêu đề THẬT (bỏ tiền tố ngày, bản 1
 *   không trần phần trăm), thẳng mép với `<h1>` và rail. V1 (hàm cắt tiền tố) ở
 *   `e2e/don-vi/bai-viet-trang-chu.spec.ts`.
 *
 * Dữ liệu: bản tin là bảng RIÊNG từ việc 20 (plan `2026-11-13-ban-tin-bang-rieng.md`) — dải đọc
 * `GET /ban-tin?limit=2`; `seed_e2e` có 3 bản tin hiện được (+1 đã ẩn). Thư viện bài viết TẠM của
 * `./thu-vien.ts` vẫn dựng ở `beforeAll` cấp file (khối Bài viết, T2) và dọn ở `afterAll`. Chủ đề +
 * bình luận là của `seed_e2e`. Nguồn sự thật kỳ vọng là **API**, không phải HTML mình vừa render.
 * T13 dựng thêm MỘT chủ đề tạm có bối cảnh dài (xem nhóm T13: bối cảnh của seed quá ngắn để đo). */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

test.beforeAll(() => {
  donThuVien();
  dungThuVien();
});
test.afterAll(() => donThuVien());

/** Hộp (theo toạ độ TRANG, cộng `scrollY`) của phần tử đầu khớp `selector`. */
const hop = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, h: r.height };
  });

/** Hai bản tin mới nhất theo đúng lời gọi trang chủ dùng (`liet_ke_ban_tin`, `SO_BAN_TIN_DAI` = 2). */
async function banTinMong() {
  return (await api<TrangBanTinOut>("/api/v1/ban-tin?limit=2")).items;
}

/** Hai tiêu đề kiểu THẬT (dạng "Bản tin DD/MM — …", rộng ~470–550px ở 13px — số đo của phản biện
 * vòng 1). Cái đầu là tiêu đề dài nhất plan §3.6 trích; cái sau cùng khuôn, cùng cỡ. */
const TIEU_DE_THAT = [
  "Bản tin 10/11 — Dow Jones tăng 1.104 điểm, S&P 500 tăng 2,35%, Nasdaq lên 25.253",
  "Bản tin 11/11 — Dow Jones giảm 452 điểm, giá vàng vượt 4.150 USD, dầu Brent quanh 64 USD",
] as const;

/** Ghi đè chữ tiêu đề (nút chữ CUỐI của link, sau `<time>` và " · ") của từng mục bằng `chu`. */
const datTieuDe = (page: Page, chu: readonly string[]) =>
  page.getByTestId("ban-tin").evaluate((dai, ds) => {
    const muc = dai.querySelectorAll('[data-testid="ban-tin-muc"]');
    ds.forEach((t, i) => {
      muc[i].lastChild!.textContent = t;
    });
  }, chu);

/** Hộp và trạng thái cắt của các mục, `ul`, nhãn, link "Tất cả" trong dải. */
const doDai = (page: Page) =>
  page.getByTestId("ban-tin").evaluate((dai) => {
    const ra = (e: Element) => e.getBoundingClientRect();
    const ds = [...dai.querySelectorAll('[data-testid="ban-tin-muc"]')] as HTMLElement[];
    const tat_ca = dai.querySelector('[data-testid="ban-tin-tat-ca"]')!;
    return {
      muc: ds.map((e) => ({
        top: ra(e).top,
        w: ra(e).width,
        cat: e.scrollWidth > e.clientWidth,
        tu_nhien: e.scrollWidth,
        chu: e.innerText,
      })),
      ul: ra(dai.querySelector("ul")!).width,
      nhan_left: ra(dai.querySelector("span")!).left,
      cao: ra(dai).height,
      tat_ca: { top: ra(tat_ca).top, right: ra(tat_ca).right },
      khung: document.documentElement.clientWidth,
    };
  });

/* =========================================================================== T1–T5 · dải */

test.describe("T1–T5 — dải bản tin ngay dưới header", () => {
  test("T1 — 1280×800: dải dính sát đáy header (0–2px), trên <h1>, cao ≤ 44px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const header = await hop(page, "header");
    const dai = await hop(page, '[data-testid="ban-tin"]');
    const h1 = await hop(page, "h1");
    const khe = dai.top - header.bottom;
    console.log(`T1 1280×800: header.bottom=${header.bottom} dai.top=${dai.top} khe=${khe} cao=${dai.h}`);
    expect(khe, "khe giữa header và dải").toBeGreaterThanOrEqual(0);
    expect(khe, "khe giữa header và dải").toBeLessThanOrEqual(2);
    expect(dai.bottom, "dải nằm trên <h1>").toBeLessThanOrEqual(h1.top);
    expect(dai.h, "dải cao ≤ 44px").toBeLessThanOrEqual(44);
  });

  test("T2 — đúng MỘT dải trên `/`, không còn trong 'Bài viết'; `/?tab=moi` không có dải", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("ban-tin")).toHaveCount(1);
    await expect(page.locator('[data-testid="khoi-bai-viet"] [data-testid="ban-tin"]')).toHaveCount(0);
    // Con ĐẦU của `trang-chu-v2` (trước khung hai cột).
    expect(
      await page.getByTestId("trang-chu-v2").evaluate((e) => e.firstElementChild?.getAttribute("data-testid")),
    ).toBe("ban-tin");
    await page.goto("/?tab=moi");
    await expect(page.getByTestId("ban-tin")).toHaveCount(0);
  });

  test("T3/V2 — HTML thô: ĐÚNG 2 mục = 2 bản tin mới nhất (liet_ke_ban_tin), đúng thứ tự, <time datetime> = ngày, title đầy đủ; link tất cả; không heading, không <p>", async ({
    request,
  }) => {
    const tin = await banTinMong();
    expect(tin.length, "seed có đủ bản tin").toBe(2);
    // Seed có 3 bản tin hiện được: dải vẽ 2 là do `SO_BAN_TIN_DAI`, không phải do thiếu bài.
    expect((await api<TrangBanTinOut>("/api/v1/ban-tin?limit=50")).items.length).toBeGreaterThanOrEqual(3);
    const html = await (await request.get("/")).text();
    const dai = /<section\b[^>]*data-testid="ban-tin"[^>]*>([\s\S]*?)<\/section>/.exec(html);
    expect(dai, "không tìm thấy dải trong HTML thô").not.toBeNull();
    const than = dai![1];
    const muc = [...than.matchAll(/<a\b[^>]*data-testid="ban-tin-muc"[^>]*>([\s\S]*?)<\/a>/g)];
    expect(muc.length).toBe(2);
    expect((than.match(/<li\b/g) ?? []).length, "đúng 2 <li>").toBe(2);
    const giaiMa = (s: string) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"');
    for (let i = 0; i < 2; i += 1) {
      expect(/href="([^"]+)"/.exec(muc[i][0])![1], `mục ${i}`).toBe(`/s/tin-tuc/${tin[i].ngay}`);
      // Ngày là `BanTin.ngay` (YYYY-MM-DD), không phải một dấu thời gian (sổ P-20261113-8 (a)).
      expect(/<time\b[^>]*\bdatetime="([^"]+)"/i.exec(muc[i][1])?.[1], `mục ${i}: <time datetime>`).toBe(
        tin[i].ngay,
      );
      expect(giaiMa(/\btitle="([^"]*)"/.exec(muc[i][0])?.[1] ?? ""), `mục ${i}: title`).toBe(tin[i].title);
    }
    expect(/<a\b[^>]*data-testid="ban-tin-tat-ca"[^>]*>/.exec(than)?.[0]).toContain('href="/s/tin-tuc"');
    expect(than, "không heading trong dải").not.toMatch(/<h[1-6]\b/);
    expect(than, "không <p> trong dải").not.toMatch(/<p\b/);
    expect(dai![0]).toContain('aria-label="Bản tin thị trường"');
    // Dải đứng TRƯỚC <h1> trong tài liệu.
    expect(html.indexOf('data-testid="ban-tin"')).toBeLessThan(html.indexOf("<h1"));
  });

  for (const rong of [1280, 1024] as const) {
    test(`T4 — ${rong}: cả 2 bản tin hiện trên MỘT dòng; tiêu đề quá dài thì dải vẫn một dòng, 'Tất cả' không bị đẩy ra`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: rong, height: 800 });
      await page.goto("/");
      const muc = page.getByTestId("ban-tin-muc");
      await expect(muc).toHaveCount(2);
      for (let i = 0; i < 2; i += 1) await expect(muc.nth(i)).toBeVisible();
      const tho = await doDai(page);
      console.log(`T4 ${rong} (dữ liệu e2e): ${JSON.stringify(tho)}`);
      for (const h of tho.muc) expect(Math.abs(h.top - tho.muc[0].top), "cùng một dòng").toBeLessThanOrEqual(1);
      expect(tho.muc[0].cat, "bản 1 (tiêu đề ngắn) không bị cắt").toBe(false);

      // Ép chỗ cực đoan: tiêu đề dài hơn cả danh sách. Bản 1 lúc ấy mới co và cắt "…".
      await datTieuDe(page, Array(2).fill("Tiêu đề bản tin rất dài để ép chỗ của dải một dòng ".repeat(4)));
      const ep = await doDai(page);
      console.log(`T4 ${rong} (ép chỗ): ${JSON.stringify(ep)}`);
      for (const h of ep.muc) expect(Math.abs(h.top - ep.muc[0].top), "vẫn một dòng").toBeLessThanOrEqual(1);
      expect(ep.cao, "dải vẫn ≤ 44px").toBeLessThanOrEqual(44);
      expect(ep.muc[0].cat, "bản 1 quá dài thì cắt '…'").toBe(true);
      expect(ep.muc[0].w, "bản 1 không tràn khỏi danh sách").toBeLessThanOrEqual(ep.ul + 0.5);
      expect(Math.abs(ep.tat_ca.top - ep.muc[0].top), "'Tất cả' cùng dòng").toBeLessThanOrEqual(1);
      expect(ep.tat_ca.right, "'Tất cả' không bị đẩy ra ngoài").toBeLessThanOrEqual(ep.khung);
    });

    test(`V3 — ${rong}: hai tiêu đề THẬT — bản 1 không bị cắt, bản 2 hiện ≥ 150px, không in lại "Bản tin DD/MM"`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: rong, height: 800 });
      await page.goto("/");
      // Chữ y như dải sẽ vẽ: `tieuDeBanTinGon` bỏ tiền tố (đo hàm ấy riêng ở V1, don-vi).
      await datTieuDe(
        page,
        TIEU_DE_THAT.map((t) => t.replace(/^Bản tin \d{1,2}\/\d{1,2}\s*—\s*/, "")),
      );
      const d = await doDai(page);
      console.log(`V3 ${rong}: ${JSON.stringify(d)}`);
      expect(d.muc[0].cat, `bản 1 bị cắt: rộng ${d.muc[0].w}px, cần ${d.muc[0].tu_nhien}px`).toBe(false);
      expect(d.muc[1].w, "bản 2 còn đọc được").toBeGreaterThanOrEqual(150);
      for (const h of d.muc) expect(Math.abs(h.top - d.muc[0].top), "cùng một dòng").toBeLessThanOrEqual(1);
      // Chữ dải THẬT đang vẽ (trước khi ghi đè) cũng không lặp ngày.
      await page.reload();
      for (const t of await page.getByTestId("ban-tin-muc").allInnerTexts()) {
        expect(t, "dải không in lại 'Bản tin <ngày>'").not.toMatch(/Bản tin \d/i);
      }
    });
  }

  test("V4 — 1280: chỉ MỘT bản tin thì nó dùng đủ bề rộng tự nhiên, không bị trần", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await datTieuDe(page, [TIEU_DE_THAT[0].replace(/^Bản tin \d{1,2}\/\d{1,2}\s*—\s*/, "")]);
    await page.getByTestId("ban-tin").evaluate((dai) => dai.querySelectorAll("li")[1].remove());
    const d = await doDai(page);
    console.log(`V4: ${JSON.stringify(d)}`);
    expect(d.muc.length).toBe(1);
    expect(d.muc[0].cat, "bản duy nhất không bị cắt").toBe(false);
    expect(Math.abs(d.muc[0].w - d.muc[0].tu_nhien), "rộng = bề rộng tự nhiên").toBeLessThanOrEqual(1);
  });

  for (const rong of [1280, 1440] as const) {
    test(`V5 — ${rong}: nhãn thẳng mép trái <h1>, 'Tất cả bản tin →' thẳng mép phải rail`, async ({ page }) => {
      await page.setViewportSize({ width: rong, height: 900 });
      await page.goto("/");
      const d = await doDai(page);
      const h1 = await page.locator("h1").evaluate((e) => e.getBoundingClientRect().left);
      const rail = await page.getByTestId("rail-phai").evaluate((e) => e.getBoundingClientRect().right);
      console.log(`V5 ${rong}: nhan.left=${d.nhan_left} h1.left=${h1} tat_ca.right=${d.tat_ca.right} rail.right=${rail}`);
      expect(Math.abs(d.nhan_left - h1), "mép trái nhãn = mép trái <h1>").toBeLessThanOrEqual(1);
      expect(Math.abs(d.tat_ca.right - rail), "mép phải 'Tất cả' = mép phải rail").toBeLessThanOrEqual(1);
    });
  }

  test("T4 — 390×844: chỉ bản 1 hiện (bản 2 vẫn trong HTML); không tràn ngang ở 390 và 360", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const muc = page.getByTestId("ban-tin-muc");
    await expect(muc).toHaveCount(2);
    await expect(muc.nth(0)).toBeVisible();
    await expect(muc.nth(1)).toBeHidden();
    for (const rong of [390, 360] as const) {
      await page.setViewportSize({ width: rong, height: 844 });
      await page.goto("/");
      const r = await page.evaluate(() => ({ cuon: document.documentElement.scrollWidth, khung: window.innerWidth }));
      expect(r.cuon, `${rong}px: ${JSON.stringify(r)}`).toBeLessThanOrEqual(r.khung);
    }
  });

  test("T5 — 390×844: dưới header + thanh tab, trên <h1>; vùng bấm ≥ 44px; nhãn/link rút gọn; câu hỏi chủ đề vẫn ở màn đầu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const header = await hop(page, "header");
    const tab = await hop(page, 'nav[aria-label="Điều hướng chính di động"]');
    const dai = await hop(page, '[data-testid="ban-tin"]');
    const h1 = await hop(page, "h1");
    console.log(
      `T5 390×844: header.bottom=${header.bottom} tab.bottom=${tab.bottom} dai.top=${dai.top} cao=${dai.h} khe_tab=${dai.top - tab.bottom}`,
    );
    expect(dai.top, "dải dưới header").toBeGreaterThanOrEqual(header.bottom - 0.5);
    expect(dai.top, "dải dưới thanh tab di động").toBeGreaterThanOrEqual(tab.bottom - 0.5);
    expect(dai.top - tab.bottom, "dải sát thanh tab").toBeLessThanOrEqual(2);
    expect(dai.bottom, "dải trên <h1>").toBeLessThanOrEqual(h1.top);
    for (const id of ["ban-tin-muc", "ban-tin-tat-ca"]) {
      const b = await page.getByTestId(id).first().boundingBox();
      expect(b!.height, `${id} cao`).toBeGreaterThanOrEqual(43.5);
    }
    // Chữ rút gọn ở mobile (chữ trong HTML không đổi).
    // Nhãn là `<span>` đầu của dải; `innerText` đã áp `text-transform: uppercase`.
    const nhan = page.getByTestId("ban-tin").locator("span").first();
    expect((await nhan.innerText()).trim()).toBe("BẢN TIN");
    expect(await nhan.textContent()).toBe("Bản tin thị trường");
    await expect(page.getByTestId("ban-tin-tat-ca")).toHaveText("Tất cả →", { useInnerText: true });
    expect(await page.getByTestId("ban-tin-tat-ca").textContent()).toBe("Tất cả bản tin →");
    const q = await page.getByTestId("khoi-thao-luan").getByRole("heading", { level: 2 }).boundingBox();
    expect(q!.y + q!.height, "câu hỏi chủ đề nằm trong màn hình đầu").toBeLessThan(844);
  });
});

/* =========================================================================== T6 · bản quyền */

/** Năm hiện tại theo giờ VN — tính ĐỘC LẬP với `lib/ban-quyen.ts`. */
const namVN = () => Number(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 4));

test.describe("T6 — dòng bản quyền trong chân trang", () => {
  for (const url of ["/", "/s/chung-khoan", "/luat"]) {
    test(`T6 — ${url}: '© ${"{năm}"} gikky.net' trong chan-trang, TRÊN disclaimer, chân trang 0 link`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url);
      const chan = page.getByTestId("chan-trang");
      const bq = chan.getByTestId("ban-quyen");
      await expect(bq).toBeVisible();
      await expect(bq).toHaveText(/^© \d{4} gikky\.net$/);
      await expect(bq).toHaveText(`© ${namVN()} gikky.net`);
      const thu_tu = await chan.evaluate((e) =>
        [...e.children].map((c) => (c as HTMLElement).dataset.testid ?? c.tagName),
      );
      expect(thu_tu, "bản quyền trên, miễn trừ là phần tử cuối").toEqual(["ban-quyen", "disclaimer"]);
      await expect(chan.locator("a")).toHaveCount(0);
    });
  }
});

/* ===================================================================== T10–T11 · khối chủ đề */

test.describe("T10–T11 — khối Chủ đề tuần: không còn ô quan điểm, phần còn lại nguyên vẹn", () => {
  test("T10 — chủ đề đang hiện CÓ bình luận gốc (API) nhưng HTML thô không có ô quan điểm, khối không có <h3>", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const id = Number(await page.getByTestId("chu-de-the").getAttribute("data-mach-id"));
    expect(id, "phải có chủ đề trên trang").toBeGreaterThan(0);
    // Chống đo rỗng: ô quan điểm cũ chỉ vẽ khi có bình luận gốc đọc được.
    const bl = await api<{ threads: { depth: number; trang_thai: string; score: number }[] }>(
      `/api/v1/machs/${id}/comments?sort=moi_nhat&limit=20`,
    );
    const goc = bl.threads.filter((b) => b.depth === 1 && b.trang_thai === "binh_thuong" && b.score >= 0);
    expect(goc.length, `chủ đề ${id} phải có ≥ 1 bình luận gốc trong seed`).toBeGreaterThanOrEqual(1);

    const html = await (await request.get("/")).text();
    for (const tid of ["quan-diem-noi-bat", "quan-diem", "quan-diem-tat-ca", "quan-diem-ten"]) {
      expect(html.split(`data-testid="${tid}"`).length - 1, tid).toBe(0);
    }
    const khoi = /<section\b[^>]*data-testid="khoi-thao-luan"[^>]*>([\s\S]*?)<\/section>/.exec(html);
    expect(khoi, "không tìm thấy khối chủ đề trong HTML thô").not.toBeNull();
    expect(khoi![1], "khối chủ đề không có <h3>").not.toMatch(/<h3\b/);
  });

  test("T11 — tiêu đề, chip, nút Vào thảo luận và Viết quan điểm còn đủ, đúng đích", async ({ page }) => {
    await page.goto("/");
    const the = page.getByTestId("chu-de-the");
    const id = Number(await the.getAttribute("data-mach-id"));
    const m = await api<{ slug: string; id: number }>(`/api/v1/machs/${id}`);
    await expect(the.getByTestId("chu-de-tieu-de")).toHaveAttribute("href", `/m/${m.slug}-${m.id}`);
    await expect(the.getByTestId("chu-de-trang-thai")).toHaveText(/^(Đang mở|Đã đóng)/);
    await expect(the.getByTestId("chu-de-vao")).toHaveAttribute("href", `/m/${m.slug}-${m.id}`);
    const viet = await the.getByTestId("chu-de-viet").getAttribute("href");
    expect(viet).toMatch(new RegExp(`^/m/${m.slug}-${m.id}\\?.*#viet-binh-luan$`));
  });
});

/* ========================================================================= T13 · bối cảnh */

test.describe.serial("T13 — bối cảnh chủ đề hiện trọn đoạn trích (kẹp 6 dòng)", () => {
  // Chủ đề TẠM: bối cảnh của chủ đề trong `seed_e2e` chỉ dài 59 ký tự — vừa trong 2 dòng cũ, nên
  // đo trên nó thì bài không phân biệt được 2 với 6 (đo rỗng). Chủ đề này xuất bản SAU CÙNG nên là
  // cái `chonChuDeNoi` chọn; server tự cắt đoạn trích (~240 ký tự) từ thân bài.
  const TD = "Chủ đề e2e T13 — bối cảnh dài";
  const THAN =
    "Bối cảnh dài của bài đo T13: lãi suất liên ngân hàng tăng ba phiên liền, tỷ giá chạm trần biên độ, " +
    "khối ngoại bán ròng mười phiên, thanh khoản sàn HOSE co về dưới mười lăm nghìn tỷ, còn nhóm ngân hàng " +
    "thì giữ giá nhờ kỳ vọng nới room. Câu hỏi là nên giữ tỷ trọng hay hạ bớt trước kỳ họp chính sách " +
    "tiền tệ cuối tháng, khi mà dữ liệu lạm phát lõi vẫn chưa ra và thị trường đang đoán theo tin đồn.";
  const xoa = () => py(`from core.models import Mach; Mach.objects.filter(title=${JSON.stringify(TD)}).delete()`);
  test.beforeAll(() => {
    xoa();
    py(
      [
        "from core.ghi import tao_mach",
        "from core.models import Mach, User",
        "doi = User.objects.get(username='e2e_tai_khoan_doi')",
        "sub = Mach.objects.filter(loai_mach='thao_luan').first().sub",
        `tao_mach(sub=sub, author=doi, title=${JSON.stringify(TD)}, body=${JSON.stringify(THAN)},`,
        "    occurred_at=None, loai=None, loai_mach=Mach.LoaiMach.THAO_LUAN)",
        "",
      ].join("\n"),
    );
  });
  test.afterAll(() => xoa());

  for (const [rong, cao] of [
    [1280, 800],
    [390, 844],
  ] as const) {
    test(`T13 — ${rong}×${cao}: line-clamp 6, đoạn trích ≥ 150 ký tự không bị cắt`, async ({ page }) => {
      await page.setViewportSize({ width: rong, height: cao });
      await page.goto("/");
      await expect(page.getByTestId("chu-de-tieu-de")).toHaveText(TD);
      const bc = page.getByTestId("chu-de-boi-canh");
      await expect(bc).toBeVisible();
      const s = await bc.evaluate((e) => ({
        clamp: getComputedStyle(e).getPropertyValue("-webkit-line-clamp"),
        cuon: e.scrollHeight,
        thay: e.clientHeight,
        dai: (e.textContent ?? "").length,
        dong: parseFloat(getComputedStyle(e).lineHeight),
      }));
      console.log(`T13 ${rong}: ${JSON.stringify(s)}`);
      // Chống đo rỗng: đoạn ngắn thì 2 dòng cũ cũng vừa, bài không phân biệt được.
      expect(s.dai, "đoạn trích của chủ đề tạm phải dài ≥ 150 ký tự").toBeGreaterThanOrEqual(150);
      // …và dài hơn 2 dòng ở khổ này — không thì kẹp 2 cũng không cắt gì.
      expect(s.cuon, "đoạn trích chiếm hơn 2 dòng").toBeGreaterThan(2 * s.dong + 1);
      expect(s.clamp.trim()).toBe("6");
      expect(s.cuon, "bối cảnh không bị cắt").toBeLessThanOrEqual(s.thay + 1);
      if (rong === 390) {
        const vao = await page.getByTestId("chu-de-vao").boundingBox();
        expect(vao!.y + vao!.height, "nút Vào thảo luận vẫn gần màn đầu").toBeLessThan(1044);
      }
    });
  }
});

/* ============================================ V3 · tiêu đề thật đi qua đúng đường render của trang */

test.describe.serial("V3 — một bản tin TẠM mang tiêu đề thật: dải vẽ tiêu đề gọn, title đầy đủ, không bị cắt", () => {
  // Các bài V3 ở trên ghi đè chữ trên DOM — chúng đo CSS, không đo việc trang có gọi
  // `tieuDeBanTinGon` hay không. Bài này đăng MỘT bản tin mới nhất mang đúng khuôn tiêu đề thật
  // rồi đọc chữ trang vẽ. Dấu `[e2e-viec-19]` ở CUỐI: tiêu đề không thể trùng một bản tin thật,
  // nên lệnh xoá theo tiêu đề bên dưới không bao giờ chạm bài thật kể cả khi lỡ chạy vào DB có dữ
  // liệu thật. Tiền tố giữ nguyên để bài vẫn đo việc cắt tiền tố.
  //
  // Việc 20: bản tin là bảng RIÊNG (`BanTin`), không còn là mạch `tin-tuc`. Ngày = ngày mới nhất
  // + 1 (UNIQUE, và để nó đứng ĐẦU dải). `created_at` / `cap_nhat_luc` cố ý rơi vào một NGÀY VN
  // KHÁC (23:30 UTC hai hôm trước = 06:30 VN hôm trước): dải phải in `ngay`, không in ngày của
  // một dấu thời gian — bài đo đóng sổ `P-20261113-8` (a).
  const TD = `${TIEU_DE_THAT[0]} [e2e-viec-19]`;
  const xoa = () => py(`from core.models import BanTin; BanTin.objects.filter(title=${JSON.stringify(TD)}).delete()`);
  let ngay = "";
  test.beforeAll(() => {
    xoa();
    ngay = py(
      [
        "from datetime import datetime, time, timedelta, timezone",
        "from django.db.models import Max",
        "from core.models import BanTin, BanTinKhung, User",
        "from core.thoi_gian import ngay_vn",
        "doi = User.objects.get(username='e2e_tai_khoan_doi')",
        "moi_nhat = BanTin.objects.aggregate(m=Max('ngay'))['m'] or ngay_vn()",
        "ngay = moi_nhat + timedelta(days=1)",
        "khi = datetime.combine(ngay - timedelta(days=2), time(23, 30), tzinfo=timezone.utc)",
        `bt = BanTin.objects.create(ngay=ngay, title=${JSON.stringify(TD)}, tac_gia=doi, created_at=khi, cap_nhat_luc=khi)`,
        "BanTinKhung.objects.create(ban_tin=bt, khung='dem_qua', body='<p>Bản tin tạm của bài đo V3.</p>', created_at=khi)",
        "print(ngay.isoformat())",
        "",
      ].join("\n"),
    )
      // Django shell in thêm "N objects imported automatically" lên stdout: giá trị là dòng CUỐI.
      .trim()
      .split("\n")
      .pop()!
      .trim();
  });
  test.afterAll(() => xoa());

  test("P-20261113-8 (a) — dải in NGÀY của bản tin (`ngay`), không phải ngày VN của cap_nhat_luc", async ({
    page,
  }) => {
    expect(ngay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.goto("/");
    const dau = page.getByTestId("ban-tin-muc").first();
    await expect(dau).toHaveAttribute("title", TD);
    await expect(dau).toHaveAttribute("href", `/s/tin-tuc/${ngay}`);
    const t = dau.locator("time");
    await expect(t).toHaveAttribute("datetime", ngay);
    const [, mm, dd] = ngay.split("-");
    await expect(t).toHaveText(`${dd}/${mm}`);
    // Chống đo rỗng: ngày VN của cap_nhat_luc phải KHÁC `ngay`, nếu không bài này không phân biệt
    // được hai nguồn.
    const ban_tin = (await api<TrangBanTinOut>("/api/v1/ban-tin?limit=1")).items[0];
    expect(ban_tin.ngay).toBe(ngay);
    const ngay_cap_nhat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(ban_tin.cap_nhat_luc),
    );
    expect(ngay_cap_nhat, "dấu thời gian rơi vào ngày khác").not.toBe(ngay);
  });

  test("V3 — 1280: mục đầu là '<ngày> · Dow Jones …' (không 'Bản tin 10/11 —'), title = tiêu đề đầy đủ, không bị cắt", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const dau = page.getByTestId("ban-tin-muc").first();
    await expect(dau).toHaveAttribute("title", TD);
    const chu = await dau.innerText();
    expect(chu).toMatch(
      /^\d{2}\/\d{2} · Dow Jones tăng 1\.104 điểm, S&P 500 tăng 2,35%, Nasdaq lên 25\.253 \[e2e-viec-19\]$/,
    );
    expect(chu, "không in lại ngày").not.toMatch(/Bản tin \d/i);
    const d = await doDai(page);
    console.log(`V3 tạm 1280: ${JSON.stringify(d)}`);
    expect(d.muc[0].cat, "bản 1 không bị cắt").toBe(false);
    expect(d.muc[1].w, "bản 2 vẫn hiện").toBeGreaterThanOrEqual(150);
  });
});
