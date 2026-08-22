import type { MachChiTietOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { DISCLAIMER_CHAN_TRANG } from "../lib/phap-ly";
import {
  TITLE_HPG,
  TITLE_POST_THUONG,
  USER_NHIEU_MACH,
  duongDan,
  hoSo,
  lamMoiCacheTrang,
  timMachTheoTitle,
} from "./du-lieu";

/** V9–V12, V14 (render), V16 của plan con 1c §3. */

let hpg: MachChiTietOut;

test.beforeAll(async () => {
  hpg = await timMachTheoTitle(TITLE_HPG);
});


/** ⚠ **Làm mới cache trang KHÁCH trước khi đọc** — bắt buộc từ Phase 3.
 *
 * Cả file này đọc trang của một mạch seed **không đăng nhập**, rồi so từng con số với
 * Django. Từ 2026-08-23 trang ấy có bản cache 1 giờ (PLAN 8.4), và bản cache **sống qua
 * cả các lần chạy `pnpm e2e`** (`.next/cache` nằm trên đĩa) trong khi DB thì lớn dần —
 * lượt chạy trước ghi thêm bình luận và phiếu vào đúng mạch seed ấy. Bình luận và vote là
 * hai loại thay đổi **cố ý KHÔNG có signal revalidate** (PLAN 8.4 điểm 2), nên không có
 * gì tự dọn.
 *
 * Nên: gọi đúng cửa mà Django vẫn gọi, một lần cho cả file. Xem `lamMoiCacheTrang`.
 */
test.beforeAll(async () => {
  await lamMoiCacheTrang(duongDan(hpg));
});

test.describe("V9 — slug lệch", () => {
  test("redirect vĩnh viễn về slug chuẩn, giữ nguyên id", async ({ request }) => {
    const res = await request.get(`/m/slug-cu-hoan-toan-khac-${hpg.id}`, {
      maxRedirects: 0,
    });
    // ⚠ LỆCH HỢP ĐỒNG, CỐ Ý VÀ ĐÃ BÁO CÁO: plan con V9 ghi **301**, còn App Router chỉ
    // phát 308 (`permanentRedirect`) — không có API nào đặt 301 ngoài `middleware.ts`,
    // mà middleware là phạm vi Phase 3 (PLAN 8.4). 308 là "permanent redirect" giữ
    // nguyên method; Google xử lý nó y hệt 301 cho mục đích hợp nhất URL. Bài đo ghim
    // đúng con số THẬT chứ không nới thành `[301, 308]` để trông như đạt.
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe(duongDan(hpg));
  });

  test("giữ query string khi redirect", async ({ request }) => {
    const res = await request.get(
      `/m/slug-cu-${hpg.id}?khan_dai=1&sort=cu_nhat`,
      { maxRedirects: 0 },
    );
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe(
      `${duongDan(hpg)}?khan_dai=1&sort=cu_nhat`,
    );
  });

  test("slug đúng thì KHÔNG redirect (nếu không, bài đo trên vô nghĩa)", async ({
    request,
  }) => {
    const res = await request.get(duongDan(hpg), { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });

  test("id không tồn tại → 404, không phải 500", async ({ request }) => {
    const res = await request.get("/m/khong-co-mach-nay-999999999");
    expect(res.status()).toBe(404);
  });
});

test.describe("V11 — JSON-LD", () => {
  test("DiscussionForumPosting hợp lệ, đủ trường bắt buộc", async ({ page }) => {
    await page.goto(duongDan(hpg));
    const khoi = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(khoi.length).toBe(1);

    const d = JSON.parse(khoi[0]) as Record<string, unknown>;
    expect(d["@context"]).toBe("https://schema.org");
    expect(d["@type"]).toBe("DiscussionForumPosting");
    expect(d.headline).toBe(hpg.title);
    expect(d.url).toContain(duongDan(hpg));
    expect(d.inLanguage).toBe("vi-VN");
    expect((d.author as Record<string, unknown>)["@type"]).toBe("Person");
    expect((d.author as Record<string, unknown>).name).toBe(
      hpg.author.display_name,
    );

    // `datePublished` phải là lúc mốc 1 ra đời, KHÔNG trôi theo mốc mới nhất — với sản
    // phẩm bán "ghi trước khi biết kết quả" thì khai sai chỗ này là tự xoá giá trị lõi.
    expect(Date.parse(String(d.datePublished))).toBe(Date.parse(hpg.created_at));
    expect(Date.parse(String(d.dateModified))).toBe(Date.parse(hpg.last_entry_at));

    const dem = d.interactionStatistic as Record<string, unknown>;
    expect(dem.userInteractionCount).toBe(hpg.comment_count);
  });

  test("JSON-LD phải PARSE được, không phải chỉ tồn tại", async ({ page }) => {
    for (const url of [duongDan(hpg), "/luat", "/"]) {
      await page.goto(url);
      for (const t of await page
        .locator('script[type="application/ld+json"]')
        .allTextContents()) {
        expect(() => JSON.parse(t)).not.toThrow();
      }
    }
  });
});

test.describe("V12 — sitemap", () => {
  test("có trang mạch seed, `<loc>` tuyệt đối", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const post = await timMachTheoTitle(TITLE_POST_THUONG);
    for (const m of [hpg, post]) {
      expect(xml).toContain(`<loc>http://localhost:3000${duongDan(m)}</loc>`);
    }
    expect(xml).toContain("<loc>http://localhost:3000/luat</loc>");
    expect(xml).toContain("<loc>http://localhost:3000/s/chung-khoan</loc>");
  });
});

test.describe("V10 — footer disclaimer + /luat", () => {
  const TRANG = ["/", "/luat", "/s/chung-khoan", `/u/${USER_NHIEU_MACH}`];

  test("disclaimer có trên MỌI trang", async ({ page }) => {
    for (const url of [...TRANG, duongDan(hpg)]) {
      await page.goto(url);
      await expect(
        page.getByTestId("disclaimer"),
        `thiếu disclaimer ở ${url}`,
      ).toHaveText(DISCLAIMER_CHAN_TRANG);
    }
  });

  test("`/luat` sống, mang nhãn DRAFT và đủ bốn điều cấm của PLAN 5.10", async ({
    page,
  }) => {
    await page.goto("/luat");
    await expect(page.getByTestId("nhan-draft")).toBeVisible();
    await expect(page.getByTestId("nhan-draft")).toContainText("DRAFT");
    const than = await page.locator("main").innerText();
    for (const tu of ["phím hàng", "cam kết lợi nhuận", "uỷ thác", "nhóm kín"]) {
      expect(than.toLowerCase(), `thiếu điều cấm: ${tu}`).toContain(tu.toLowerCase());
    }
  });
});

test.describe("V16 — hồ sơ cắt danh sách thì phải NÓI RA", () => {
  test("so_mach > số mạch trả về ⇒ hiện dòng giải thích", async ({ page }) => {
    const hs = await hoSo(USER_NHIEU_MACH);
    expect(
      hs.so_mach,
      "seed_e2e phải dựng nhiều mạch hơn `limit` mặc định",
    ).toBeGreaterThan(hs.machs.length);

    await page.goto(`/u/${USER_NHIEU_MACH}`);
    await expect(page.getByTestId("chi-so-mach")).toHaveText(String(hs.so_mach));
    const bao = page.getByTestId("ho-so-bi-cat");
    await expect(bao).toBeVisible();
    await expect(bao).toContainText(String(hs.so_mach - hs.machs.length));
    await expect(page.getByTestId("the-mach")).toHaveCount(hs.machs.length);
  });

  test("hồ sơ KHÔNG bị cắt thì im lặng", async ({ page }) => {
    const hs = await hoSo(hpg.author.username);
    expect(hs.so_mach).toBe(hs.machs.length);
    await page.goto(`/u/${hpg.author.username}`);
    await expect(page.getByTestId("ho-so-bi-cat")).toHaveCount(0);
  });

  test("chỉ số 'Được trích vào sổ ×N' hiện đúng nghĩa", async ({ page }) => {
    const nguoi = hpg.mocs.find((m) => m.trich !== null)!.trich!.author.username;
    const hs = await hoSo(nguoi);
    expect(hs.duoc_trich).toBeGreaterThan(0);
    await page.goto(`/u/${nguoi}`);
    await expect(page.getByTestId("chi-so-duoc-trich")).toHaveText(
      `×${hs.duoc_trich}`,
    );
    await expect(page.locator("main")).toContainText("Được trích vào sổ");
  });
});

test.describe("feed", () => {
  // Tab thứ ba ("Nhiều điểm nhất", plan con 1d §2.5.4) đo ở `e2e/vo-reddit.spec.ts`.
  test("tab Mới / Đang diễn ra đổi qua ?tab= và đổi thật nội dung", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("tab-moi")).toHaveAttribute("aria-current", "page");
    await page.getByTestId("tab-dang-dien-ra").click();
    await expect(page).toHaveURL(/tab=dang-dien-ra/);
    await expect(page.getByTestId("tab-dang-dien-ra")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Mạch HPG đã đóng sổ ⇒ KHÔNG được nằm trong feed "Đang diễn ra".
    await expect(
      page.locator(`[data-mach-id="${hpg.id}"]`),
      "mạch đã đóng lọt vào feed Đang diễn ra",
    ).toHaveCount(0);

    await page.goto("/?tab=moi");
    await expect(page.locator(`[data-mach-id="${hpg.id}"]`)).toHaveCount(1);
  });

  test("sub không tồn tại → 404", async ({ request }) => {
    expect((await request.get("/s/khong-co-sub-nay")).status()).toBe(404);
  });
});

test.describe("W1 — cursor rác trên hai feed", () => {
  /** `apps/web/app` không có `error.tsx` cho tới vá A1, và `lib/api.ts` chỉ quy **404**
   * về `null`. Django trả 400 `cursor_khong_hop_le` cho cursor không giải được
   * (`api/phan_trang.py` cố ý không có nhánh "đoán bừa"), nên `?cursor=rac` ném `LoiApi`
   * và **cả trang chủ lẫn trang sub đều 500** — một chuỗi ai đó gõ vào URL quyết định
   * được mã lỗi của trang. */
  const URL_RAC = [
    "/?cursor=",
    "/?cursor=rac",
    "/?tab=dang-dien-ra&cursor=rac",
    "/s/chung-khoan?cursor=rac",
  ];

  test("bốn URL rác đều 200, không phải 500", async ({ request }) => {
    for (const url of URL_RAC) {
      expect((await request.get(url)).status(), `HTTP của ${url}`).toBe(200);
    }
  });

  test("và mỗi trang NÓI RA là đang hiện lại từ trang đầu", async ({ page }) => {
    for (const url of URL_RAC) {
      await page.goto(url);
      await expect(page.getByTestId("bao-cursor-hong"), url).toBeVisible();
      // Feed vẫn phải ra dữ liệu thật — "lùi về trang 1" chứ không phải "trang trắng".
      await expect(page.getByTestId("feed"), url).toBeVisible();
    }
  });

  test("không có ?cursor= thì KHÔNG báo gì — nếu không, dòng báo là vô nghĩa", async ({
    page,
  }) => {
    for (const url of ["/", "/?tab=dang-dien-ra", "/s/chung-khoan"]) {
      await page.goto(url);
      await expect(page.getByTestId("bao-cursor-hong"), url).toHaveCount(0);
    }
  });

  test("cursor THẬT vẫn phân trang được (bài trên không được biến mọi cursor thành rác)", async ({
    page,
    request,
  }) => {
    // Lấy cursor thật từ chính API, `limit` nhỏ để chắc chắn còn trang sau.
    const r = await request.get("http://localhost:8000/api/v1/feeds/moi?limit=1");
    const feed = (await r.json()) as { cursor_ke_tiep: string | null };
    expect(feed.cursor_ke_tiep, "seed phải có hơn 1 mạch").not.toBeNull();

    await page.goto(`/?cursor=${encodeURIComponent(feed.cursor_ke_tiep!)}`);
    await expect(page.getByTestId("bao-cursor-hong")).toHaveCount(0);
    await expect(page.getByTestId("feed")).toBeVisible();
  });
});

test.describe("C5 — robots.txt + noindex cho trang chẩn đoán", () => {
  test("/robots.txt sống và KHAI sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const txt = await res.text();
    // Không khai ở đây thì `sitemap.xml` chỉ tồn tại cho ai submit tay trong Search
    // Console — tức nửa việc SEO của một sản phẩm sống bằng index.
    expect(txt).toContain("Sitemap: http://localhost:3000/sitemap.xml");
    // Và KHÔNG có `Disallow` nào (vá F4, 2026-08-22). Bản C5 chặn crawl `/chan-doan` rồi
    // nói nó "bổ trợ" cho thẻ `noindex` của chính trang đó — ngược chiều: bot không tải
    // trang thì không đọc được thẻ, và URL bị chặn vẫn lên index dạng URL trần. Bài đo
    // này ghim chiều đúng, để `Disallow` không bò lại vào cùng một chỗ.
    expect(txt).not.toContain("Disallow:");
  });

  test("/chan-doan mang noindex; trang sản phẩm thì KHÔNG", async ({ page }) => {
    await page.goto("/chan-doan");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );

    // Vế đối chứng: nếu `noindex` rơi vào layout thì cả site biến mất khỏi Google mà
    // bài đo trên vẫn xanh.
    await page.goto(duongDan(hpg));
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  });
});

/* ===========================================================================
 * Phase 6 — ảnh OG · RSS · trang 404
 * ===========================================================================
 *
 * ⚠ **CẢ KHỐI NÀY CHƯA BAO GIỜ CHẠY.** Nó được viết trong một worktree bị cấm chiếm cổng
 * 3000/8000 (hai agent chạy song song — `D:\Projects\CLAUDE.md`, chia độc quyền tài
 * nguyên), nên `pnpm e2e` không chạy được ở đó. Phần đo được mà KHÔNG cần server đã nằm
 * ở `e2e/don-vi/og-anh.spec.ts` (render PNG thật, so byte), `e2e/don-vi/rss.spec.ts`
 * (dựng + kiểm cú pháp XML) và `e2e/don-vi/trang-loi.spec.ts`.
 *
 * Khối này thêm vào ba câu **chỉ trả lời được khi có server thật**, và câu đáng ngờ nhất
 * là câu đầu: Next có thật sự gắn ảnh từ file `opengraph-image.tsx` vào
 * `<meta property="og:image">` của một trang mà `generateMetadata` đã tự khai `openGraph`
 * không. Tài liệu nói metadata dạng FILE thắng metadata dạng object; ở đây chưa ai đo.
 * Nếu nó ĐỎ ở lượt nghiệm thu thì đó là một lỗi thật, không phải bài đo viết ẩu:
 * `app/m/[slugId]/page.tsx` sẽ phải khai `openGraph.images` tường minh.
 */
test.describe("Phase 6 — ảnh OG", () => {
  test("ảnh OG của trang chủ là PNG thật", async ({ request }) => {
    const res = await request.get("/opengraph-image");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
    const b = await res.body();
    expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(b.length).toBeGreaterThan(10_000);
  });

  test("mỗi mạch có ảnh OG riêng, mạch không tồn tại thì 404", async ({ request }) => {
    const res = await request.get(`${duongDan(hpg)}/opengraph-image`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");

    // Ảnh OG của một link chết sẽ nằm lại trong cache của Facebook rất lâu — để trống
    // còn hơn một tấm ảnh mang thương hiệu gikky đi kèm một URL không mở được.
    const khong_co = await request.get("/m/khong-co-mach-nay-999999999/opengraph-image");
    expect(khong_co.status()).toBe(404);
  });

  test("trang mạch KHAI ảnh OG ra `<meta property=og:image>`", async ({ page }) => {
    await page.goto(duongDan(hpg));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/opengraph-image/,
    );
  });
});

test.describe("Phase 6 — RSS", () => {
  test("/feed.xml có mạch seed và link tuyệt đối", async ({ request }) => {
    const res = await request.get("/feed.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(TITLE_HPG);
    expect(xml).toContain(`<link>http://localhost:3000${duongDan(hpg)}</link>`);
  });

  test("feed của sub nói đúng sub, và slug lạ thì 404", async ({ request }) => {
    const res = await request.get("/s/chung-khoan/feed.xml");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("s/chung-khoan");

    // Một kênh 200-nhưng-rỗng dạy trình đọc rằng chuyên mục có tồn tại và vừa hết bài.
    const la = await request.get("/s/khong-co-sub-nay/feed.xml");
    expect(la.status()).toBe(404);
  });

  test("trang chủ KHAI feed ra `<link rel=alternate>`", async ({ page }) => {
    // Không khai thì RSS chỉ tồn tại cho ai đã biết URL — cùng loài thiếu sót mà vá C5
    // vừa vá cho `sitemap.xml`.
    await page.goto("/");
    await expect(
      page.locator('link[rel="alternate"][type="application/rss+xml"]'),
    ).toHaveAttribute("href", /\/feed\.xml$/);
  });
});

test.describe("Phase 6 — trang 404 thật", () => {
  test("URL không tồn tại: 404, tiếng Việt, có đường sang /luat", async ({ page }) => {
    const res = await page.goto("/khong-co-trang-nay-dau");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("trang-404")).toBeVisible();
    await expect(page.getByTestId("trang-404-ve-luat")).toHaveAttribute("href", "/luat");
  });

  test("đường thoát dẫn tới một trang SỐNG, không phải một 404 nữa", async ({ page }) => {
    await page.goto("/khong-co-trang-nay-dau");
    await page.getByTestId("trang-404-ve-luat").click();
    await expect(page).toHaveURL(/\/luat$/);
  });
});
