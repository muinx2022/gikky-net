import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

/** Ngưỡng ký tự của tooltip, đọc từ NGUỒN (`khoi-bai-moi.tsx`) — import component kéo theo
 * `next/link` + CSS module vào tiến trình Playwright. */
const NGUONG = Number(
  /export const NGUONG_TOOLTIP_TIEU_DE = (\d+);/.exec(
    readFileSync(resolve(__dirname, "..", "components", "khoi-bai-moi.tsx"), "utf8"),
  )?.[1] ?? NaN,
);
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
  test("10 link /m/ đúng thứ tự API, <a> không title (B1), <time datetime> mỗi mục, link 'Tất cả bài viết'", async ({
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
    expect(NGUONG, "đọc được NGUONG_TOOLTIP_TIEU_DE từ nguồn").toBeGreaterThan(0);
    const muc = [...khoi.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
    expect(muc).toHaveLength(10);
    for (let i = 0; i < 10; i += 1) {
      const a = /<a\b([^>]*)>([\s\S]*?)<\/a>/.exec(muc[i]);
      expect(a, `mục ${i}: có <a>`).not.toBeNull();
      const thuoc_tinh = a![1];
      expect(/href="([^"]+)"/.exec(thuoc_tinh)?.[1]).toBe(`/m/${mong[i].slug}-${mong[i].id}`);
      // B1 (việc 24 bổ sung, user 2026-11-13): KHÔNG còn `title` — tooltip native tràn khỏi rail.
      // Tiêu đề dài hơn ngưỡng ⇒ `data-tieu-de` = tiêu đề đầy đủ trên `<li>` (tooltip CSS); ngắn ⇒ không.
      expect(thuoc_tinh, `mục ${i}: <a> không có title`).not.toMatch(/\btitle=/);
      const the_li = /^<li\b([^>]*)>/.exec(muc[i])?.[1] ?? "";
      const tt = /data-tieu-de="([^"]*)"/.exec(the_li)?.[1];
      if (mong[i].title.length > NGUONG) expect(giaiMa(tt ?? ""), `mục ${i}: data-tieu-de`).toBe(mong[i].title);
      else expect(tt, `mục ${i}: tiêu đề ngắn (${mong[i].title.length}) không tooltip`).toBeUndefined();
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
 * như tiêu đề thật (bài mới nhất ⇒ đứng đầu rail), rồi XOÁ SẠCH và kiểm lại 0 hàng.
 *
 * Kèm MỘT bài tiêu đề NGẮN (dưới ngưỡng tooltip): từ khi ngưỡng hạ xuống 28 (vòng sửa phản biện),
 * mọi tiêu đề seed (36 ký tự) đều có tooltip — vế "ngắn ⇒ không tooltip" của B1/B2 sẽ đo rỗng. */
const TIEU_DE_DAI_RAIL =
  "[e2e-rail-v24] Vì sao nhà đầu tư cá nhân nên ghi nhật ký giao dịch trước khi biết kết quả của lệnh";
const TIEU_DE_NGAN_RAIL = "[e2e-rail-v24] Ngắn";
/** Ghim ngưỡng 28 (vòng sửa 2): tiêu đề IN HOA có dấu 29–37 ký tự mà BỊ CẮT ở 1280px — đúng loại
 * ngưỡng 40 cũ bỏ sót. Không mang tiền tố `[e2e-…]` vì tiền tố chữ thường làm chuỗi hẹp đi.
 * Phải dày chữ rộng (W/M): đo 2026-11-14, tiêu đề in hoa "thường" 34–37 ký tự (vd "MSN, MWG, MBB:
 * ĐỢT MUA MỚI — MỤC TIÊU") VỪA khít 268px; chuỗi này 36 ký tự rộng 291px — dư 23px, không sát mép. */
const TIEU_DE_HOA_RAIL = "WWWW MMMM ĐỨNG ĐẦU ĐỢT TĂNG GIÁ MẠNH";
const TIEU_DE_TAM_RAIL = [TIEU_DE_NGAN_RAIL, TIEU_DE_HOA_RAIL, TIEU_DE_DAI_RAIL];

test.describe.serial("T6/T7 — `/` desktop 1280px: kiểu chữ của rail, khối bài viết SAU Chuyên mục", () => {
  const dem = () =>
    Number(
      py(
        "from core.models import Mach; " +
          `print(Mach.objects.filter(title__in=${JSON.stringify(TIEU_DE_TAM_RAIL)}).count())`,
      )
        .trim()
        .split(/\r?\n/)
        .pop(),
    );
  const don = () =>
    py(
      "from core.models import Mach; " +
        `Mach.objects.filter(title__in=${JSON.stringify(TIEU_DE_TAM_RAIL)}).delete()`,
    );
  test.beforeAll(() => {
    don();
    py(
      [
        "from core.ghi import tao_mach",
        "from core.models import Mach, Sub",
        "goc = Mach.objects.filter(loai_mach=Mach.LoaiMach.BAI_VIET).order_by('id').first()",
        // Ngắn TRƯỚC, dài SAU (mới nhất ⇒ đứng đầu rail): cả hai nằm trong 10 bài của rail.
        `for td in ${JSON.stringify(TIEU_DE_TAM_RAIL)}:`,
        "    tao_mach(sub=Sub.objects.get(slug='hoi-dap'), author=goc.author,",
        "        title=td, body='Tiêu đề tạm của bộ e2e (rail, việc 24).',",
        "        occurred_at=None, loai=None, loai_mach=Mach.LoaiMach.BAI_VIET)",
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

  /* ------------------------------------------- B1 · B2 — tooltip CSS thay `title` native -- */

  test("B1 — HTML thô `/`: dòng tiêu đề dài có `data-tieu-de` = tiêu đề đầy đủ, dòng ngắn thì không, <a> không title", async ({
    request,
  }) => {
    expect(TIEU_DE_DAI_RAIL.length, "tiêu đề tạm phải dài hơn ngưỡng").toBeGreaterThan(NGUONG);
    expect(TIEU_DE_NGAN_RAIL.length, "tiêu đề tạm ngắn phải ≤ ngưỡng").toBeLessThanOrEqual(NGUONG);
    const html = await (await request.get("/", { headers: { "user-agent": UA_TRINH_DUYET } })).text();
    const khoi = /<section[^>]*data-testid="sidebar-bai-moi"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    const li = [...khoi.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)].find(
      (m) => giaiMa(/<a\b[^>]*>([\s\S]*?)<\/a>/.exec(m[2])?.[1] ?? "") === TIEU_DE_DAI_RAIL,
    );
    expect(li, "đo rỗng: dòng tiêu đề dài phải có trong HTML thô").toBeDefined();
    expect(giaiMa(/data-tieu-de="([^"]*)"/.exec(li![1])?.[1] ?? "")).toBe(TIEU_DE_DAI_RAIL);
    expect(li![2], "<a> không title").not.toMatch(/\btitle=/);
    // Không bản sao thứ hai của tiêu đề trong TEXT HTML: tiêu đề xuất hiện đúng một lần ngoài thuộc tính.
    const chu = giaiMa(li![2].replace(/<[^>]*>/g, ""));
    expect(chu.split(TIEU_DE_DAI_RAIL).length - 1).toBe(1);
    // Dòng ngắn: KHÔNG `data-tieu-de`.
    const li_ngan = [...khoi.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)].find(
      (m) => giaiMa(/<a\b[^>]*>([\s\S]*?)<\/a>/.exec(m[2])?.[1] ?? "") === TIEU_DE_NGAN_RAIL,
    );
    expect(li_ngan, "đo rỗng: dòng tiêu đề ngắn phải có trong HTML thô").toBeDefined();
    expect(li_ngan![1]).not.toContain("data-tieu-de");
  });

  test("B1b — tiêu đề IN HOA có dấu 29–37 ký tự, đang BỊ CẮT ở 1280px ⇒ có `data-tieu-de` (ghim ngưỡng 28)", async ({
    page,
  }) => {
    expect(TIEU_DE_HOA_RAIL.length).toBeGreaterThanOrEqual(29);
    expect(TIEU_DE_HOA_RAIL.length).toBeLessThanOrEqual(37);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const li = page
      .getByTestId("sidebar")
      .getByTestId("sidebar-bai-moi")
      .locator("li", { has: page.locator(`a:text-is(${JSON.stringify(TIEU_DE_HOA_RAIL)})`) });
    await expect(li, "đo rỗng: dòng in hoa phải ở rail").toHaveCount(1);
    const a = await li.locator("a").evaluate((e) => ({ cuon: e.scrollWidth, rong: e.clientWidth }));
    expect(a.cuon, `phải đang bị cắt (đo rỗng nếu vừa): ${JSON.stringify(a)}`).toBeGreaterThan(a.rong);
    await expect(li, "bị cắt mà không tooltip").toHaveAttribute("data-tieu-de", TIEU_DE_HOA_RAIL);
  });

  test("B2 — 1280px: rê chuột lên dòng dài ⇒ sau trễ tooltip hiện, nằm trong bề ngang rail, ngay dưới dòng; rời ⇒ ẩn", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const khoi = page.getByTestId("sidebar").getByTestId("sidebar-bai-moi");
    const li = khoi.locator("li", { has: page.locator(`a:text-is(${JSON.stringify(TIEU_DE_DAI_RAIL)})`) });
    await expect(li, "đo rỗng: dòng tiêu đề dài").toHaveCount(1);
    await li.scrollIntoViewIfNeeded();
    const doTooltip = () =>
      li.evaluate((e) => {
        const s = getComputedStyle(e, "::before");
        const r = e.getBoundingClientRect();
        const rail = document.querySelector('[data-testid="rail-phai"]')!.getBoundingClientRect();
        const ngoai = (v: string) => parseFloat(v) || 0;
        // Hộp border-box của pseudo-element: vị trí resolved + bề rộng/cao (cộng padding + viền
        // nếu `content-box`).
        const them_ngang =
          s.boxSizing === "border-box"
            ? 0
            : ngoai(s.paddingLeft) + ngoai(s.paddingRight) + ngoai(s.borderLeftWidth) + ngoai(s.borderRightWidth);
        const trai = r.left + ngoai(s.left);
        return {
          content: s.content,
          opacity: s.opacity,
          visibility: s.visibility,
          ws: s.whiteSpace,
          // Chiều cao VÙNG CHỮ (bỏ padding + viền nếu `border-box`).
          cao:
            ngoai(s.height) -
            (s.boxSizing === "border-box"
              ? ngoai(s.paddingTop) + ngoai(s.paddingBottom) + ngoai(s.borderTopWidth) + ngoai(s.borderBottomWidth)
              : 0),
          dong: ngoai(s.lineHeight),
          trai,
          phai: trai + ngoai(s.width) + them_ngang,
          tren: r.top + ngoai(s.top),
          li_trai: r.left,
          li_phai: r.right,
          li_day: r.bottom,
          rail_trai: rail.left,
          rail_phai: rail.right,
        };
      });
    await page.mouse.move(0, 0);
    const an = await doTooltip();
    expect(an.visibility, "trước khi rê: ẩn").toBe("hidden");
    // Chuột thô tới giữa dòng (`locator.hover()` chờ mãi vì stretched link `::after` "chặn" con trỏ).
    const h = (await li.boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    const ngay = await doTooltip();
    expect(ngay.visibility, `có trễ: vừa rê vào thì chưa hiện ${JSON.stringify(ngay)}`).toBe("hidden");
    await page.waitForTimeout(600); // trễ 300ms + transition 120ms
    const hien = await doTooltip();
    const m = JSON.stringify(hien);
    // Chữ = tiêu đề đầy đủ, kèm alt rỗng (`/ ""`, vòng sửa phản biện 3).
    expect(hien.content, m).toBe(`${JSON.stringify(TIEU_DE_DAI_RAIL)} / ""`);
    expect(hien.visibility, m).toBe("visible");
    expect(Number(hien.opacity), m).toBe(1);
    expect(hien.ws, m).toBe("normal");
    // Chữ THẬT SỰ xuống dòng: tiêu đề này không vừa một dòng của rail (T6 đã đo nó bị cắt), nên hộp
    // phải cao ≥ 2 dòng. Hộp bị ghim `left/right` thì `nowrap` không làm hộp rộng ra — chữ tràn ra
    // NGOÀI hộp — nên chỉ so bề ngang hộp là không bắt được ca ấy (thử phá B3 lần 1 đã cho thấy).
    expect(hien.dong, m).toBeGreaterThan(0);
    expect(hien.cao, m).toBeGreaterThanOrEqual(1.9 * hien.dong);
    // Trong bề ngang rail VÀ bằng bề ngang dòng.
    expect(hien.trai, m).toBeGreaterThanOrEqual(hien.rail_trai - 0.5);
    expect(hien.phai, m).toBeLessThanOrEqual(hien.rail_phai + 0.5);
    expect(Math.abs(hien.trai - hien.li_trai), m).toBeLessThanOrEqual(0.5);
    expect(Math.abs(hien.phai - hien.li_phai), m).toBeLessThanOrEqual(0.5);
    // Ngay dưới dòng (khe ≤ 4px).
    expect(hien.tren, m).toBeGreaterThanOrEqual(hien.li_day);
    expect(hien.tren - hien.li_day, m).toBeLessThanOrEqual(4);
    // Rời chuột ⇒ ẩn.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    const roi = await doTooltip();
    expect(roi.visibility, JSON.stringify(roi)).toBe("hidden");
    // Dòng ngắn (dưới ngưỡng) không có hộp.
    const ngan = khoi.locator("li", { has: page.locator(`a:text-is(${JSON.stringify(TIEU_DE_NGAN_RAIL)})`) });
    await expect(ngan, "đo rỗng: cần dòng ngắn").toHaveCount(1);
    expect(await ngan.evaluate((e) => getComputedStyle(e, "::before").content)).toBe("none");

    // --- Vòng sửa phản biện 1: focus do CHUỘT không được giữ hộp lại. -----------------------
    // `:focus-within` khớp cả focus do bấm ⇒ hộp kẹt sau khi rời chuột. Ctrl+click (mở tab mới,
    // trang này ở lại) và chuột phải đều để focus trên `<a>`; rời chuột ⇒ hộp phải ẩn.
    const a = li.locator("a");
    const giua = async () => {
      const b = (await li.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    };
    const cach_bam: [string, () => Promise<void>][] = [
      [
        "Ctrl+click",
        async () => {
          const tab_moi = page.context().waitForEvent("page");
          await giua();
          await page.keyboard.down("Control");
          await page.mouse.down();
          await page.mouse.up();
          await page.keyboard.up("Control");
          await (await tab_moi).close();
        },
      ],
      [
        "chuột phải",
        async () => {
          await giua();
          await page.mouse.down({ button: "right" });
          await page.mouse.up({ button: "right" });
        },
      ],
    ];
    for (const [ten, bam] of cach_bam) {
      await page.mouse.move(0, 0);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await bam();
      expect(await a.evaluate((e) => e === document.activeElement), `${ten}: <a> phải đang focus (đo rỗng)`).toBe(
        true,
      );
      await page.mouse.move(0, 0);
      await page.waitForTimeout(600);
      const sau_bam = await doTooltip();
      expect(sau_bam.visibility, `${ten} rồi rời chuột ⇒ ẩn: ${JSON.stringify(sau_bam)}`).toBe("hidden");
    }

    // Bàn phím (Tab) ⇒ VẪN hiện: focus phần tử focus được đứng NGAY TRƯỚC `<a>` rồi bấm Tab.
    await page.mouse.move(0, 0);
    await a.evaluate((dich) => {
      const ds = [...document.querySelectorAll<HTMLElement>("a[href], button, input, [tabindex]")].filter(
        (e) => e.tabIndex >= 0 && e.offsetParent !== null,
      );
      ds[ds.indexOf(dich as HTMLElement) - 1].focus();
    });
    await page.keyboard.press("Tab");
    expect(await a.evaluate((e) => e === document.activeElement && e.matches(":focus-visible"))).toBe(true);
    await page.waitForTimeout(600);
    const ban_phim = await doTooltip();
    expect(ban_phim.visibility, `Tab ⇒ hiện: ${JSON.stringify(ban_phim)}`).toBe("visible");

    // --- Vòng sửa phản biện 3: trình đọc màn hình KHÔNG đọc tiêu đề lần hai. -----------------
    // Cây truy cập THẬT của Chromium (CDP), lúc hộp ĐANG HIỆN (hộp `visibility: hidden` vốn vắng
    // khỏi cây — đo lúc ẩn là đo rỗng). Nút văn bản mang tiêu đề chỉ được là chữ của link. Đo
    // hai lối: `ariaSnapshot` của Playwright (thiếu alt thì nó in thêm `- text: <tiêu đề>` trước
    // link — đã thử phá) và cây AX của Chromium qua CDP.
    await li.hover({ force: true });
    await page.waitForTimeout(600);
    expect((await doTooltip()).visibility, "hộp phải đang hiện khi đo cây truy cập").toBe("visible");
    const snap = await li.ariaSnapshot();
    expect(snap.split(TIEU_DE_DAI_RAIL).length - 1, snap).toBe(1);
    expect(snap, snap).toMatch(new RegExp(`- link "${TIEU_DE_DAI_RAIL.replace(/[[\]\\.*+?^${}()|]/g, "\\$&")}"`));
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
      nodes: { role?: { value?: string }; name?: { value?: string }; ignored?: boolean }[];
    };
    const van_ban = nodes.filter(
      (n) =>
        !n.ignored &&
        (n.role?.value ?? "") === "StaticText" &&
        (n.name?.value ?? "").includes(TIEU_DE_DAI_RAIL),
    );
    expect(van_ban.length, JSON.stringify(van_ban)).toBe(1);
    await cdp.detach();
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
