import type { BanTinChiTietOut, TrangBanTinOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { py } from "./thu-vien";

/** Việc 20, đợt B — bản tin là bảng RIÊNG, trình bày kiểu tờ tin ngày (plan
 * `2026-11-13-ban-tin-bang-rieng.md` §3.5, §5 B1–B5, B7, B8), trên BẢN BUILD thật.
 *
 * Dữ liệu: bốn ngày bản tin của `seed_e2e` (`_dung_ban_tin`): lùi 1 ngày ĐỦ ba khung (đăng lệch
 * thứ tự), lùi 2 ngày ĐÃ ẨN, lùi 3 ngày THIẾU "Trước phiên VN", lùi 4 ngày chuyển từ một mạch cũ
 * đã lưu trữ (`mach_cu` — ca 301). Nguồn sự thật kỳ vọng là **API** (`/api/v1/ban-tin…`), không
 * phải HTML mình vừa render. Hàm thuần (ngày, thứ tự khung, tách giá trị, allowlist lượt xem) đo ở
 * `e2e/don-vi/ban-tin.spec.ts`. Dải trang chủ (B6) đo ở `dai-ban-tin.spec.ts`. */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Dòng in CUỐI của một đoạn Python (Django shell in thêm "N objects imported automatically"
 * lên stdout). */
const dongCuoi = (ra: string) => ra.trim().split("\n").pop()?.trim() ?? "";

const danhSach = () => api<TrangBanTinOut>("/api/v1/ban-tin?limit=50");
const chiTiet = (ngay: string) => api<BanTinChiTietOut>(`/api/v1/ban-tin/${ngay}`);

/** Bản tin của seed theo ca. Ném nếu seed không có ca đó — bài đo không được chạy RỖNG. */
async function caSeed() {
  const ds = (await danhSach()).items;
  const day_du = ds.find((b) => b.khung_da_co.length === 3);
  const thieu = ds.find(
    (b) => b.khung_da_co.length === 2 && !b.khung_da_co.includes("truoc_phien_vn"),
  );
  expect(day_du, "seed phải có một bản tin đủ ba khung").toBeDefined();
  expect(thieu, "seed phải có một bản tin thiếu 'Trước phiên VN'").toBeDefined();
  return { ds, day_du: day_du!, thieu: thieu! };
}

const giaiMa = (s: string) =>
  s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

/** `DD/MM/YYYY` của một ngày thuần — tính độc lập với `lib/ban-tin.ts`. */
const ddmmyyyy = (ngay: string) => ngay.split("-").reverse().join("/");

/** testid của TRANG MẠCH — bản tin không được mang thứ nào trong số này (không dòng thời gian, không
 * vote, không bình luận, không câu hỏi cho đám đông, không ô soạn). */
const TESTID_TRANG_MACH = [
  'data-testid="the-mach"',
  'data-testid="nhat-ky"',
  'data-testid="khan-dai"',
  'data-testid="o-soan-binh-luan"',
  'data-testid="composer"',
  'data-testid="composer-mat-bao"',
  'data-testid="cot-vote-',
  'data-testid="cau-moi-',
  'data-testid="figures"',
  'data-testid="nut-theo-mach"',
  'data-testid="chu-ky-so-moc"',
];

/* ===================================================================== B1 · trang bản tin */

test.describe("B1 — trang một bản tin /s/tin-tuc/<ngày>", () => {
  test("HTML thô: 200, <h1> = tiêu đề, ngày từ `ngay`, các <section> khung ĐÚNG thứ tự, số liệu TRƯỚC thân, không phần tử nào của trang mạch", async ({
    request,
  }) => {
    const { day_du } = await caSeed();
    const bt = await chiTiet(day_du.ngay);
    const r = await request.get(`/s/tin-tuc/${bt.ngay}`);
    expect(r.status()).toBe(200);
    const html = await r.text();

    expect(giaiMa(/<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1])).toBe(bt.title);
    expect((html.match(/<h1\b/g) ?? []).length, "đúng một <h1>").toBe(1);
    // Ngày đầy đủ đọc từ `ngay` (không phải dấu thời gian): <time datetime="YYYY-MM-DD">Thứ …, DD/MM/YYYY.
    const ngay = /<time\b[^>]*data-testid="ban-tin-ngay"[^>]*>([^<]*)<\/time>/.exec(html);
    expect(ngay, "không thấy dòng ngày").not.toBeNull();
    expect(ngay![0]).toMatch(new RegExp(`datetime="${bt.ngay}"`, "i"));
    expect(ngay![1]).toMatch(new RegExp(`^(Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ Nhật), ${ddmmyyyy(bt.ngay)}$`));

    // Các section khung theo thứ tự hiển thị — seed đăng lệch (Mỹ → đêm qua → VN).
    const khung = [...html.matchAll(/<section\b[^>]*data-testid="ban-tin-khung"[^>]*data-khung="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
    expect(khung.map((k) => k[1])).toEqual(["dem_qua", "truoc_phien_vn", "truoc_phien_my"]);
    expect(khung.map((k) => k[1])).toEqual(bt.khung.map((k) => k.khung));
    // id của section = neo của mục lục.
    expect([...html.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*data-testid="ban-tin-khung"/g)].map((m) => m[1])).toEqual([
      "dem-qua",
      "truoc-phien-vn",
      "truoc-phien-my",
    ]);
    let co_so_lieu = 0;
    for (const [i, k] of khung.entries()) {
      const than = k[2];
      expect(than, `khung ${k[1]}: có <h2>`).toMatch(/<h2\b/);
      expect(than, `khung ${k[1]}: có <time>`).toMatch(/<time\b[^>]*dateTime="/i);
      const i_than = than.indexOf('data-testid="ban-tin-than"');
      expect(i_than, `khung ${k[1]}: có thân`).toBeGreaterThan(0);
      if (bt.khung[i].figures !== null && bt.khung[i].figures!.length > 0) {
        co_so_lieu += 1;
        const i_so = than.indexOf('data-testid="ban-tin-so-lieu"');
        expect(i_so, `khung ${k[1]}: có lưới số liệu`).toBeGreaterThan(0);
        expect(i_so, `khung ${k[1]}: số liệu đứng TRƯỚC thân`).toBeLessThan(i_than);
        for (const f of bt.khung[i].figures!) expect(giaiMa(than)).toContain(f.label);
      } else {
        expect(than).not.toContain('data-testid="ban-tin-so-lieu"');
      }
    }
    expect(co_so_lieu, "seed phải có khung mang số liệu (chống đo rỗng)").toBeGreaterThanOrEqual(1);

    for (const tid of TESTID_TRANG_MACH) {
      expect(html.split(tid).length - 1, tid).toBe(0);
    }
  });

  test("số liệu: phần trong ngoặc tô theo dấu (giảm = lo, tăng = lai), phần chính mực thường", async ({ page }) => {
    const { day_du } = await caSeed();
    await page.goto(`/s/tin-tuc/${day_du.ngay}`);
    const luoi = page.getByTestId("ban-tin-so-lieu").first();
    await expect(luoi).toBeVisible();
    // Seed: "S&P 500" = "5.432,1 (-0,35%)", "VN-Index" = "1.280,5 (+0,42%)", "DXY" = "104,2".
    const sp = luoi.locator("div", { hasText: "S&P 500" });
    await expect(sp.locator("dd")).toHaveText("5.432,1 (-0,35%)");
    await expect(sp.locator("[data-dau]")).toHaveAttribute("data-dau", "lo");
    await expect(sp.locator("[data-dau]")).toHaveText("-0,35%");
    const vn = luoi.locator("div", { hasText: "VN-Index" });
    await expect(vn.locator("[data-dau]")).toHaveAttribute("data-dau", "lai");
    await expect(luoi.locator("div", { hasText: "DXY" }).locator("[data-dau]")).toHaveCount(0);
    const mau = await sp.locator("[data-dau]").evaluate((e) => getComputedStyle(e).color);
    const mau_chinh = await sp.locator("dd").evaluate((e) => getComputedStyle(e).color);
    expect(mau, "phần giảm có màu riêng").not.toBe(mau_chinh);
  });

  test("dòng phụ: 'Cập nhật HH:mm' giờ VN của cap_nhat_luc + lượt xem; điều hướng ngày trước/sau theo API (bỏ qua bản đã ẩn)", async ({
    page,
  }) => {
    const { ds, day_du } = await caSeed();
    const bt = await chiTiet(day_du.ngay);
    await page.goto(`/s/tin-tuc/${bt.ngay}`);
    const gio = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(bt.cap_nhat_luc));
    await expect(page.getByTestId("ban-tin-cap-nhat")).toHaveText(gio);
    await expect(page.getByTestId("ban-tin-luot-xem")).toHaveText(/^[\d.]+ lượt xem$/);
    const ddmm = (n: string) => n.split("-").reverse().slice(0, 2).join("/");
    if (bt.ngay_truoc !== null) {
      await expect(page.getByTestId("ban-tin-truoc")).toHaveAttribute("href", `/s/tin-tuc/${bt.ngay_truoc}`);
      await expect(page.getByTestId("ban-tin-truoc")).toHaveText(`← Bản tin ${ddmm(bt.ngay_truoc)}`);
    }
    // Ngày liền trước trong seed đã ẩn ⇒ điều hướng phải NHẢY qua nó, tới đúng bản liền trước trong danh sách.
    const i = ds.findIndex((b) => b.ngay === bt.ngay);
    expect(bt.ngay_truoc).toBe(ds[i + 1]?.ngay ?? null);
    await expect(page.getByTestId("ban-tin-tat-ca-trang")).toHaveAttribute("href", "/s/tin-tuc");
    if (bt.ngay_sau === null) await expect(page.getByTestId("ban-tin-sau")).toHaveCount(0);
  });

  test("404: ngày không có thật, sub khác, ngày sai dạng, bản tin đã ẩn", async ({ request }) => {
    const an = dongCuoi(
      py(
        "from core.models import BanTin; b = BanTin.objects.filter(hidden_at__isnull=False).order_by('-ngay').first(); print(b.ngay.isoformat() if b else '')",
      ),
    );
    expect(an, "seed phải có một bản tin đã ẩn").toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const { day_du } = await caSeed();
    for (const duong of [
      "/s/tin-tuc/2026-13-45",
      "/s/tin-tuc/20261113",
      `/s/chung-khoan/${day_du.ngay}`,
      `/s/tin-tuc/${an}`,
      "/s/tin-tuc/1999-01-01",
    ]) {
      expect((await request.get(duong)).status(), duong).toBe(404);
    }
  });
});

/* ======================================================================== B2 · mục lục */

test.describe("B2 — mục lục ba khung", () => {
  test("khung có nội dung là link #neo trỏ đúng section; khung thiếu KHÔNG phải link, mờ, kèm giờ dự kiến", async ({
    page,
  }) => {
    const { thieu } = await caSeed();
    await page.goto(`/s/tin-tuc/${thieu.ngay}`);
    const o = page.getByTestId("ban-tin-muc-luc-o");
    await expect(o).toHaveCount(3);
    const hang = await o.evaluateAll((ls) =>
      ls.map((l) => ({
        khung: (l as HTMLElement).dataset.khung,
        thieu: (l as HTMLElement).dataset.thieu ?? null,
        tag: l.tagName,
        href: l.getAttribute("href"),
        chu: (l as HTMLElement).innerText,
      })),
    );
    expect(hang.map((h) => h.khung)).toEqual(["dem_qua", "truoc_phien_vn", "truoc_phien_my"]);
    // Có nội dung ⇒ <a href="#neo"> và section có id ấy tồn tại.
    for (const [i, neo] of [
      [0, "dem-qua"],
      [2, "truoc-phien-my"],
    ] as const) {
      expect(hang[i].tag).toBe("A");
      expect(hang[i].href).toBe(`#${neo}`);
      await expect(page.locator(`section#${neo}[data-testid="ban-tin-khung"]`)).toHaveCount(1);
    }
    // Thiếu ⇒ không phải link, không có <a> bên trong, có giờ dự kiến, không có section.
    expect(hang[1].tag).toBe("LI");
    expect(hang[1].thieu).toBe("true");
    expect(hang[1].chu).toContain("~08:10");
    await expect(o.nth(1).locator("a")).toHaveCount(0);
    await expect(page.locator("section#truoc-phien-vn")).toHaveCount(0);
    // Bấm link neo ⇒ cuộn tới đúng section.
    await page.locator('a[href="#truoc-phien-my"]').click();
    await expect(page).toHaveURL(/#truoc-phien-my$/);
    await expect(page.locator("section#truoc-phien-my")).toBeInViewport();
  });
});

/* ======================================================================= B3 · danh sách */

test.describe("B3 — danh sách /s/tin-tuc", () => {
  test("HTML thô: mỗi ngày một hàng, ngày GIẢM dần, link /s/tin-tuc/<ngày>, chấm khung + dòng số liệu theo API; không còn số mạch / nút theo dõi", async ({
    request,
  }) => {
    const { ds } = await caSeed();
    expect(ds.length, "seed có ≥ 3 bản tin hiện được").toBeGreaterThanOrEqual(3);
    const html = await (await request.get("/s/tin-tuc")).text();
    const hang = [...html.matchAll(/<a\b[^>]*data-testid="ban-tin-hang"[^>]*>([\s\S]*?)<\/a>/g)];
    const ngay = hang.map((h) => /data-ngay="([^"]+)"/.exec(h[0])![1]);
    expect(ngay).toEqual(ds.slice(0, 20).map((b) => b.ngay));
    expect([...ngay].sort().reverse(), "ngày giảm dần").toEqual(ngay);
    for (const [i, h] of hang.entries()) {
      expect(/href="([^"]+)"/.exec(h[0])![1]).toBe(`/s/tin-tuc/${ngay[i]}`);
      const co = [...h[1].matchAll(/data-khung="([^"]+)" data-co="true"/g)].map((m) => m[1]);
      expect(co, `hàng ${ngay[i]}: chấm khung đã có`).toEqual(ds[i].khung_da_co);
      if (ds[i].so_lieu.length > 0) {
        expect(h[1]).toContain('data-testid="ban-tin-hang-so-lieu"');
        expect(giaiMa(h[1])).toContain(ds[i].so_lieu[0].label);
      }
    }
    // Hàng của bản đã ẩn không có mặt.
    expect(html).toContain('data-testid="sub-header"');
    expect(html).not.toContain('data-testid="nut-theo-sub"');
    expect(html).not.toContain('data-testid="sidebar-so-mach"');
    expect(html.split('data-testid="the-mach"').length - 1, "không còn thẻ mạch").toBe(0);
  });

  test("`?cursor=` ra trang sau (cursor của API); cursor rác ⇒ trang đầu + báo", async ({ request }) => {
    const { ds } = await caSeed();
    const dau = await api<TrangBanTinOut>("/api/v1/ban-tin?limit=1");
    expect(dau.cursor_ke_tiep, "seed có > 1 bản tin").not.toBeNull();
    const html = await (await request.get(`/s/tin-tuc?cursor=${encodeURIComponent(dau.cursor_ke_tiep!)}`)).text();
    const ngay = [...html.matchAll(/data-testid="ban-tin-hang"[^>]*data-ngay="([^"]+)"/g)].map((m) => m[1]);
    expect(ngay).toEqual(ds.slice(1, 21).map((b) => b.ngay));
    const rac = await request.get("/s/tin-tuc?cursor=rac");
    expect(rac.status()).toBe(200);
    const html_rac = await rac.text();
    expect(html_rac).toContain('data-testid="bao-cursor-hong"');
    expect([...html_rac.matchAll(/data-testid="ban-tin-hang"[^>]*data-ngay="([^"]+)"/g)][0][1]).toBe(ds[0].ngay);
  });
});

/* ============================================================================= B4 · 301 */

test.describe("B4 — URL /m/ cũ của bản tin đã chuyển", () => {
  test("/m/<slug>-<id mạch cũ> ⇒ 301/308, location = /s/tin-tuc/<ngày>; mạch không có ⇒ 404 như cũ", async ({
    request,
  }) => {
    const [id, slug, ngay] = dongCuoi(
      py(
        "from core.models import BanTin; b = BanTin.objects.filter(mach_cu__isnull=False, hidden_at__isnull=True).select_related('mach_cu').order_by('-ngay').first(); print(b.mach_cu_id, b.mach_cu.slug, b.ngay.isoformat())",
      ),
    ).split(/\s+/);
    expect(Number(id), "seed phải có một bản tin chuyển từ mạch cũ").toBeGreaterThan(0);
    for (const duong of [`/m/${slug}-${id}`, `/m/slug-bat-ky-${id}`]) {
      const r = await request.get(duong, { maxRedirects: 0 });
      expect([301, 308], `${duong}: ${r.status()}`).toContain(r.status());
      expect(r.headers()["location"]).toBe(`/s/tin-tuc/${ngay}`);
    }
    expect((await request.get("/m/khong-co-999999999", { maxRedirects: 0 })).status()).toBe(404);
  });
});

/* ======================================================================= B5 · sitemap + RSS */

test.describe("B5 — sitemap và RSS", () => {
  test("sitemap.xml chứa MỌI /s/tin-tuc/<ngày> hiện được, không chứa bản đã ẩn", async ({ request }) => {
    const { ds } = await caSeed();
    const xml = await (await request.get("/sitemap.xml")).text();
    const loc = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    // Neo cả đường dẫn sau origin (`^https?://host/s/tin-tuc/<ngày>$`), không chỉ đuôi: một URL lệch
    // tiền tố (`/x/s/tin-tuc/…`) vẫn "kết thúc bằng" đúng chuỗi ấy.
    const duong = (l: string) => l.replace(/^https?:\/\/[^/]+/, "");
    for (const b of ds) {
      expect(loc.some((l) => duong(l) === `/s/tin-tuc/${b.ngay}`), `thiếu ${b.ngay}`).toBe(true);
    }
    const tat_ca = loc.filter((l) => /^\/s\/tin-tuc\/\d{4}-\d{2}-\d{2}$/.test(duong(l)));
    expect(tat_ca.length, "đúng số bản tin hiện được").toBe(ds.length);
  });

  test("/s/tin-tuc/feed.xml: RSS hợp lệ, mỗi bản tin một mục, link URL mới", async ({ request, page }) => {
    const { ds } = await caSeed();
    const r = await request.get("/s/tin-tuc/feed.xml");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("application/rss+xml");
    const xml = await r.text();
    // Parse thật bằng DOMParser của trình duyệt: XML hỏng ⇒ <parsererror>.
    await page.goto("about:blank");
    const doc = await page.evaluate((x) => {
      const d = new DOMParser().parseFromString(x, "application/xml");
      return {
        loi: d.getElementsByTagName("parsererror").length,
        link: [...d.querySelectorAll("item > link")].map((e) => e.textContent ?? ""),
      };
    }, xml);
    expect(doc.loi).toBe(0);
    expect(doc.link.length).toBe(Math.min(ds.length, 30));
    expect(doc.link.map((l) => l.replace(/^https?:\/\/[^/]+/, ""))).toEqual(
      ds.slice(0, 30).map((b) => `/s/tin-tuc/${b.ngay}`),
    );
    expect(xml).not.toContain("/m/");
  });
});

/* ======================================================================== B7 · mobile */

test.describe("B7 — mobile 390 và 360", () => {
  for (const rong of [390, 360] as const) {
    test(`${rong}px: hai trang mới không tràn ngang; mục lục cuộn ngang TRONG chính nó, một hàng`, async ({
      page,
    }) => {
      const { day_du } = await caSeed();
      await page.setViewportSize({ width: rong, height: 844 });
      for (const duong of ["/s/tin-tuc", `/s/tin-tuc/${day_du.ngay}`]) {
        await page.goto(duong);
        const r = await page.evaluate(() => ({
          cuon: document.documentElement.scrollWidth,
          khung: window.innerWidth,
        }));
        expect(r.cuon, `${duong} @${rong}: ${JSON.stringify(r)}`).toBeLessThanOrEqual(r.khung);
      }
      const ml = await page.getByTestId("ban-tin-muc-luc").evaluate((e) => ({
        tran: e.scrollWidth > e.clientWidth,
        overflow: getComputedStyle(e).overflowX,
        top: [...e.querySelectorAll('[data-testid="ban-tin-muc-luc-o"]')].map((o) =>
          Math.round(o.getBoundingClientRect().top),
        ),
      }));
      expect(ml.overflow).toBe("auto");
      expect(ml.tran, "ba ô rộng hơn khung ⇒ cuộn trong mục lục").toBe(true);
      expect(new Set(ml.top).size, "ba ô cùng một hàng").toBe(1);
    });
  }
});

/* =========================================================================== B8 · SEO */

test.describe("B8 — SEO trang bản tin", () => {
  test("canonical /s/tin-tuc/<ngày>, title = tiêu đề, JSON-LD NewsArticle (datePublished = created_at, dateModified = cap_nhat_luc)", async ({
    request,
  }) => {
    const { day_du } = await caSeed();
    const bt = await chiTiet(day_du.ngay);
    const html = await (await request.get(`/s/tin-tuc/${bt.ngay}`)).text();
    const can = /<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(html);
    expect(can, "thiếu canonical").not.toBeNull();
    expect(can![1]).toMatch(new RegExp(`/s/tin-tuc/${bt.ngay}$`));
    expect(giaiMa(/<title>([^<]*)<\/title>/.exec(html)![1])).toContain(bt.title);
    const khoi = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
      JSON.parse(m[1]),
    );
    const tin = khoi.find((k) => k["@type"] === "NewsArticle");
    expect(tin, "thiếu JSON-LD NewsArticle").toBeDefined();
    expect(tin.headline).toBe(bt.title);
    expect(tin.datePublished).toBe(bt.created_at);
    expect(tin.dateModified).toBe(bt.cap_nhat_luc);
    expect(tin.url).toMatch(new RegExp(`/s/tin-tuc/${bt.ngay}$`));

    // Vòng sửa 1: ảnh chia sẻ. Khối `openGraph` của trang thay khối của segment cha, nên thiếu
    // khai báo là thẻ chia sẻ không có ảnh.
    const duong_anh = `/s/tin-tuc/${bt.ngay}/opengraph-image`;
    const meta = (thuoc_tinh: string) =>
      [...html.matchAll(new RegExp(`<meta\\b[^>]*(?:property|name)="${thuoc_tinh}"[^>]*content="([^"]+)"`, "g"))].map(
        (m) => giaiMa(m[1]),
      );
    const og = meta("og:image");
    const tw = meta("twitter:image");
    expect(og.length, "thiếu og:image").toBeGreaterThanOrEqual(1);
    expect(tw.length, "thiếu twitter:image").toBeGreaterThanOrEqual(1);
    for (const u of [...og, ...tw]) expect(new URL(u).pathname, u).toBe(duong_anh);
    expect(tin.image, "JSON-LD NewsArticle thiếu image").toBeDefined();
    expect([tin.image].flat().map((u: string) => new URL(u).pathname)).toContain(duong_anh);
    const anh = await request.get(duong_anh);
    expect(anh.status()).toBe(200);
    expect(anh.headers()["content-type"]).toContain("image/png");
    expect((await anh.body()).subarray(1, 4).toString("latin1")).toBe("PNG");
  });

  test("ảnh OG: 404 như trang — ngày sai dạng, sub khác, bản tin đã ẩn", async ({ request }) => {
    const { day_du } = await caSeed();
    const an = dongCuoi(
      py(
        "from core.models import BanTin; b = BanTin.objects.filter(hidden_at__isnull=False).order_by('-ngay').first(); print(b.ngay.isoformat() if b else '')",
      ),
    );
    expect(an).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const duong of [
      "/s/tin-tuc/2026-13-45/opengraph-image",
      `/s/chung-khoan/${day_du.ngay}/opengraph-image`,
      `/s/tin-tuc/${an}/opengraph-image`,
    ]) {
      expect((await request.get(duong)).status(), duong).toBe(404);
    }
  });
});
