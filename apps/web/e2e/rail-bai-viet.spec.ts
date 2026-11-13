import type { FeedOut, MachTomTatOut } from "@gikky/api-client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { py } from "./thu-vien";

/** Việc 24 — khối "Bài viết" của trang chủ dời sang rail phải; `/luat` cũng có (plan
 * `plans/2026-11-13-bai-viet-sang-rail.md`, tiêu chí T4, T6–T10). Chạy trên BẢN BUILD thật.
 *
 * Dữ liệu là của `seed_e2e` (43 `bai_viet` ⇒ đủ 10 bài cho rail). Nguồn sự thật kỳ vọng là
 * **API** — viết lại phép chọn ĐỘC LẬP ở đây (không import `lib/nhom-bai-viet`): 10 bài đầu của
 * `/feeds/moi?loai_mach=bai_viet` trừ `tin-tuc` (lọc phòng thủ mạch bản tin cũ, việc 20).
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";
const UA_TRINH_DUYET =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

async function baiVietMong(): Promise<MachTomTatOut[]> {
  const f = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=50");
  return f.items.filter((m) => m.sub.slug !== "tin-tuc").slice(0, 10);
}

/** Giải mã các thực thể HTML mà React có thể in trong text / thuộc tính. */
function giaiMa(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Kiểu chữ của MỌI tiêu đề trong khối bài mới (T6): 12.5px, 400, một dòng, ellipsis. */
async function kiemKieuChu(khoi: Locator, nhan: string) {
  // `<a>` CHÍNH là phần tử tiêu đề (chỉ bọc tiêu đề — dòng phụ là anh em của nó trong `<li>`).
  const tieu_de = khoi.locator("li > a");
  const n = await tieu_de.count();
  expect(n, `${nhan}: khối phải có bài (đo rỗng)`).toBeGreaterThan(0);
  const kieu = await tieu_de.evaluateAll((ls) =>
    ls.map((e) => {
      const s = getComputedStyle(e);
      return {
        size: s.fontSize,
        weight: s.fontWeight,
        ws: s.whiteSpace,
        to: s.textOverflow,
        ov: s.overflowX,
        cao: e.getBoundingClientRect().height,
        dong: parseFloat(s.lineHeight),
        rong_cuon: e.scrollWidth,
        rong: e.clientWidth,
        chu: e.textContent ?? "",
      };
    }),
  );
  for (const k of kieu) {
    expect(k.size, `${nhan}: ${k.chu}`).toBe("12.5px");
    expect(k.weight, `${nhan}: ${k.chu}`).toBe("400");
    expect(k.ws, `${nhan}: ${k.chu}`).toBe("nowrap");
    expect(k.to, `${nhan}: ${k.chu}`).toBe("ellipsis");
    expect(k.ov, `${nhan}: ${k.chu}`).toBe("hidden");
    // Chiều cao = MỘT dòng.
    expect(k.cao, `${nhan}: một dòng — ${k.chu}`).toBeLessThanOrEqual(k.dong + 1);
  }
  return kieu;
}

const viTriDom = (page: Page) =>
  page.evaluate(() => {
    const rail = document.querySelector('[data-testid="rail-phai"]');
    if (!rail) return null;
    const ds = [...rail.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid"));
    return {
      bai: ds.indexOf("sidebar-bai-moi"),
      cm: ds.indexOf("sidebar-cac-sub"),
      luat: ds.indexOf("sidebar-luat"),
    };
  });

/** Thứ tự user chốt 2026-11-13: Chuyên mục → bài mới → Luật rút gọn. Cả ba phải CÓ (chặn đo rỗng). */
async function kiemThuTu(page: Page) {
  const vt = await viTriDom(page);
  expect(vt, "phải có rail").not.toBeNull();
  expect(vt!.bai, "đo rỗng: không thấy khối bài viết").toBeGreaterThan(-1);
  expect(vt!.cm, "đo rỗng: không thấy khối chuyên mục").toBeGreaterThan(-1);
  expect(vt!.luat, "đo rỗng: không thấy khối luật").toBeGreaterThan(-1);
  expect(vt!.cm, JSON.stringify(vt)).toBeLessThan(vt!.bai);
  expect(vt!.bai, JSON.stringify(vt)).toBeLessThan(vt!.luat);
}

/* ========================================================================== T4 · HTML thô */

test.describe("T4 — `/` HTML thô: khối 'Bài viết' cũ đã gỡ; rail có 10 bài viết khớp API", () => {
  test("10 link /m/ đúng thứ tự API, <a title> = text đầy đủ, <time datetime> mỗi mục, link 'Tất cả bài viết'", async ({
    request,
  }) => {
    const html = await (await request.get("/", { headers: { "user-agent": UA_TRINH_DUYET } })).text();
    expect(html).not.toContain('data-testid="khoi-bai-viet"');
    const khoi = /<section[^>]*data-testid="sidebar-bai-moi"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect(khoi, "khối bài viết phải nằm trong HTML thô").not.toBe("");
    // Khối nằm trong rail phải (không phải trong nội dung chính).
    const i_rail = html.indexOf('data-testid="rail-phai"');
    expect(i_rail).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="sidebar-bai-moi"')).toBeGreaterThan(i_rail);

    const mong = await baiVietMong();
    expect(mong.length, "seed có ≥ 10 bài viết").toBe(10);
    const muc = [...khoi.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
    expect(muc).toHaveLength(10);
    for (let i = 0; i < 10; i += 1) {
      const a = /<a\b([^>]*)>([\s\S]*?)<\/a>/.exec(muc[i]);
      expect(a, `mục ${i}: có <a>`).not.toBeNull();
      const thuoc_tinh = a![1];
      expect(/href="([^"]+)"/.exec(thuoc_tinh)?.[1]).toBe(`/m/${mong[i].slug}-${mong[i].id}`);
      expect(giaiMa(/title="([^"]*)"/.exec(thuoc_tinh)?.[1] ?? ""), `mục ${i}: title`).toBe(mong[i].title);
      // Anchor text = ĐÚNG tiêu đề đầy đủ, không thừa ký tự: textContent của cả `<a>` (bỏ thẻ con)
      // — dòng phụ (tên chuyên mục · ngày) nằm NGOÀI `<a>`, không dính vào anchor text.
      expect(giaiMa(a![2].replace(/<[^>]*>/g, "")), `mục ${i}: anchor text`).toBe(mong[i].title);
      expect(muc[i].indexOf("<time"), `mục ${i}: <time> nằm sau </a>`).toBeGreaterThan(
        muc[i].indexOf("</a>"),
      );
      expect(/<time\b[^>]*\bdatetime="([^"]+)"/i.exec(muc[i])?.[1], `mục ${i}: <time>`).toBe(
        mong[i].published_at,
      );
    }
    expect(khoi).toContain('href="/?tab=moi&amp;loai_mach=bai_viet"');
  });

  test("trình duyệt: textContent của mỗi <a> bài (trừ 'Tất cả') === title API; bấm vào DÒNG PHỤ vẫn mở bài", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const khoi = page.getByTestId("sidebar-bai-moi");
    const chu = await khoi
      .locator("a:not([data-testid='sidebar-bai-moi-tat-ca'])")
      .evaluateAll((ls) => ls.map((a) => a.textContent));
    expect(chu).toEqual((await baiVietMong()).map((m) => m.title));
    // Stretched link: điểm giữa dòng phụ (ngoài `<a>`) vẫn trúng `<a>` của mục (lớp `::after`).
    // Cuộn mục vào khung nhìn trước: `elementFromPoint` trả `null` ngoài khung nhìn, và từ
    // 2026-11-13 khối nằm dưới "Chuyên mục" — có thể dưới mép màn hình 900px.
    await khoi.locator("li").first().scrollIntoViewIfNeeded();
    const trung = await khoi.locator("li").first().evaluate((li) => {
      const t = li.querySelector("time")!.getBoundingClientRect();
      const e = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
      return e === li.querySelector("a");
    });
    expect(trung, "điểm giữa <time> phải trúng link của mục").toBe(true);
    // Hover cả dòng (rê lên dòng phụ): nền dòng đổi và tiêu đề đổi màu — như khi cả dòng là `<a>`.
    const li = khoi.locator("li").first();
    const kieu = () =>
      li.evaluate((e) => ({
        nen: getComputedStyle(e).backgroundColor,
        mau: getComputedStyle(e.querySelector("a")!).color,
      }));
    await page.mouse.move(0, 0);
    const truoc = await kieu();
    // Chuột thô tới giữa `<time>`: `locator.hover()` sẽ chờ mãi vì `::after` của `<a>` "chặn"
    // con trỏ — đó chính là stretched link đang làm đúng việc.
    const t = await li.locator("time").boundingBox();
    await page.mouse.move(t!.x + t!.width / 2, t!.y + t!.height / 2);
    await page.waitForTimeout(200); // `transition: background 0.12s`
    const sau = await kieu();
    expect(sau.nen, JSON.stringify({ truoc, sau })).not.toBe(truoc.nen);
    expect(sau.mau, JSON.stringify({ truoc, sau })).not.toBe(truoc.mau);
  });
});

/* ===================================================================== T6 · T7 · trên `/` */

/** Tiêu đề bài viết của seed ngắn ("Bài viết thử nghiệm số 43 của bộ e2e") — vừa khít rail, nên
 * phép đo "tiêu đề dài nhất ĐANG bị cắt" sẽ rỗng. Dựng tạm MỘT bài viết tiêu đề dài, có dấu cách
 * như tiêu đề thật (bài mới nhất ⇒ đứng đầu rail), rồi XOÁ SẠCH và kiểm lại 0 hàng. */
const TIEU_DE_DAI_RAIL =
  "[e2e-rail-v24] Vì sao nhà đầu tư cá nhân nên ghi nhật ký giao dịch trước khi biết kết quả của lệnh";

test.describe.serial("T6/T7 — `/` desktop 1280px: kiểu chữ của rail, khối bài viết SAU Chuyên mục", () => {
  const dem = () =>
    Number(
      py(
        "from core.models import Mach; " +
          `print(Mach.objects.filter(title=${JSON.stringify(TIEU_DE_DAI_RAIL)}).count())`,
      )
        .trim()
        .split(/\r?\n/)
        .pop(),
    );
  const don = () =>
    py(
      "from core.models import Mach; " +
        `Mach.objects.filter(title=${JSON.stringify(TIEU_DE_DAI_RAIL)}).delete()`,
    );
  test.beforeAll(() => {
    don();
    py(
      [
        "from core.ghi import tao_mach",
        "from core.models import Mach, Sub",
        "goc = Mach.objects.filter(loai_mach=Mach.LoaiMach.BAI_VIET).order_by('id').first()",
        "tao_mach(sub=Sub.objects.get(slug='hoi-dap'), author=goc.author,",
        `    title=${JSON.stringify(TIEU_DE_DAI_RAIL)}, body='Tiêu đề dài của bộ e2e (rail, việc 24).',`,
        "    occurred_at=None, loai=None, loai_mach=Mach.LoaiMach.BAI_VIET)",
        "",
      ].join("\n"),
    );
  });
  test.afterAll(() => {
    don();
    expect(dem(), "đã xoá sạch mạch tạm").toBe(0);
  });

  test("T6 — tiêu đề 12.5px / 400 / nowrap / ellipsis; tiêu đề dài nhất đang bị cắt và cao một dòng", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const khoi = page.getByTestId("sidebar").getByTestId("sidebar-bai-moi");
    const kieu = await kiemKieuChu(khoi, "/");
    expect(kieu).toHaveLength(10);
    const dai_nhat = kieu.reduce((a, b) => (b.chu.length > a.chu.length ? b : a));
    expect(dai_nhat.chu, "bài tạm tiêu đề dài phải đang ở rail").toBe(TIEU_DE_DAI_RAIL);
    expect(
      dai_nhat.rong_cuon,
      `tiêu đề dài nhất phải đang bị cắt: "${dai_nhat.chu}" (${dai_nhat.rong_cuon} > ${dai_nhat.rong})`,
    ).toBeGreaterThan(dai_nhat.rong);
  });

  test("T7 — trong rail, `sidebar-bai-moi` đứng SAU `sidebar-cac-sub`, TRƯỚC `sidebar-luat` (thứ tự DOM)", async ({
    page,
  }) => {
    await page.goto("/");
    await kiemThuTu(page);
  });
});

/* ============================================================================ T8 · `/luat` */

test.describe("T8 — `/luat` (TĨNH): khối bài viết nạp ở trình duyệt; API chết thì khối vắng", () => {
  test("HTML thô KHÔNG có khối; sau hydrate có, ≤ 10 link /m/ đúng API, sau Chuyên mục, trước Luật", async ({
    page,
    request,
  }) => {
    const html = await (await request.get("/luat")).text();
    expect(html).not.toContain("sidebar-bai-moi");
    await page.goto("/luat");
    const khoi = page.getByTestId("sidebar-bai-moi");
    await expect(khoi).toBeVisible();
    await expect(khoi.getByRole("heading", { level: 2 })).toHaveText("Bài viết mới");
    const hrefs = await khoi
      .locator("li a")
      .evaluateAll((ls) => ls.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.length).toBeLessThanOrEqual(10);
    expect(hrefs).toEqual((await baiVietMong()).map((m) => `/m/${m.slug}-${m.id}`));
    await expect(khoi.getByTestId("sidebar-bai-moi-tat-ca")).toHaveAttribute(
      "href",
      "/?tab=moi&loai_mach=bai_viet",
    );
    await kiemKieuChu(khoi, "/luat");
    // Chuyên mục cũng nạp ở trình duyệt; chờ nó rồi mới so thứ tự.
    await expect(page.getByTestId("sidebar-cac-sub")).toBeVisible();
    await kiemThuTu(page);
  });

  test("chặn `/api/v1/feeds/moi` ⇒ khối vắng mặt, nội dung luật còn đủ, không lỗi JS", async ({ page }) => {
    const loi: string[] = [];
    page.on("pageerror", (e) => loi.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      // Chính request bị chặn thì Chromium in "Failed to load resource" — đó là phép chặn của bài
      // đo, không phải lỗi của trang.
      if (/\/api\/v1\/feeds\/moi/.test(m.location().url ?? "")) return;
      loi.push(`console: ${m.text()}`);
    });
    let bi_chan = 0;
    await page.route(/\/api\/v1\/feeds\/moi(\?|$)/, (r) => {
      bi_chan += 1;
      return r.abort();
    });
    await page.goto("/luat");
    // Chờ khối Chuyên mục (nạp ở trình duyệt cùng lúc) để chắc effect đã chạy.
    await expect(page.getByTestId("sidebar-cac-sub")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(bi_chan, "đo rỗng: trang phải đã thử gọi feed").toBeGreaterThan(0);
    await expect(page.getByTestId("sidebar-bai-moi")).toHaveCount(0);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByTestId("sidebar-luat")).toBeVisible();
    expect(loi, loi.join("\n")).toEqual([]);
  });
});

/* =================================================================== T9 · T10 · trang khác */

test.describe("T9/T10 — rail các trang khác", () => {
  test("T9 — `/s/<sub>` có bài: KHÔNG có khối bài mới", async ({ page }) => {
    const f = await api<FeedOut>("/api/v1/feeds/moi?sub=chung-khoan&limit=5");
    expect(f.items.length, "đo rỗng: sub phải có bài").toBeGreaterThan(0);
    await page.goto("/s/chung-khoan");
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("sidebar-bai-moi")).toHaveCount(0);
  });

  test("T10 — `/m/<slug>-<id>`: còn khối 'Cùng chuyên mục', sau Chuyên mục, trước Luật, kiểu chữ như T6", async ({
    page,
  }) => {
    // Một bài viết trong sub có ≥ 2 bài ⇒ khối "Cùng chuyên mục" chắc chắn có bài khác.
    const ds = (await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=50")).items;
    const dem = new Map<string, number>();
    for (const m of ds) dem.set(m.sub.slug, (dem.get(m.sub.slug) ?? 0) + 1);
    const mach = ds.find((m) => (dem.get(m.sub.slug) ?? 0) >= 2 && m.sub.slug !== "tin-tuc");
    expect(mach, "đo rỗng: cần một sub có ≥ 2 bài viết").toBeDefined();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/m/${mach!.slug}-${mach!.id}`);
    const khoi = page.getByTestId("sidebar-bai-moi");
    await expect(khoi).toBeVisible();
    await expect(khoi.getByRole("heading", { level: 2 })).toHaveText(/^(Cùng chuyên mục|Bài mới nhất)$/);
    // Trang mạch giữ 5 bài, không có link "Tất cả bài viết".
    expect(await khoi.locator("li").count()).toBeLessThanOrEqual(5);
    await expect(khoi.getByTestId("sidebar-bai-moi-tat-ca")).toHaveCount(0);
    await kiemThuTu(page);
    await kiemKieuChu(khoi, "/m/");
  });
});
