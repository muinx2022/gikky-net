import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import type { FeedOut, MachTomTatOut, SubChiTietOut, TrangBanTinOut } from "@gikky/api-client";
import { expect, test, type Page } from "@playwright/test";

import { SUB_GIA_SACH, donThuVien, dungThuVien } from "./thu-vien";

/** Homepage v2 (plan `plans/2026-11-10-homepage-v2.md`) — chạy trên BẢN BUILD thật.
 *
 * Đo ba nhóm: **bố cục** (L1–L4: hai cột, không rail trái, `/s/<sub>` cũng hai cột và CÙNG
 * lưới với `/`, 375px, theme tối), **các khối** (B1–B5) và **đường bò của bot** (S3, S5: link `/s/*`, `/luat`,
 * `<a href>` "xem thêm" có thật trong HTML thô). SEO của `<head>` nằm ở
 * `seo-trang-chu.spec.ts`.
 *
 * Dữ liệu là của `seed_e2e` (43 `bai_viet`, 3 `thao_luan` — 1 mở 2 bình luận, 1 đóng 5
 * bình luận có tổng kết, 1 đóng 0 bình luận — và các `nhat_ky` của `seed_dev`). Nguồn sự thật
 * kỳ vọng là **API**, không phải HTML mình vừa render.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

const idsTrenTrang = (page: Page, testid: string) =>
  page
    .getByTestId(testid)
    .evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.machId)));

/* Thư viện bài viết: dữ liệu tạm dựng ở `beforeAll` cấp FILE, xem `./thu-vien.ts` (vì sao cần). */
test.beforeAll(() => {
  donThuVien();
  dungThuVien();
});
test.afterAll(() => donThuVien());

/** Số mạch tối đa của khối "Nhật ký mới" (= `SO_NHAT_KY` của `trang-chu-v2.tsx`) — cũng là
 * `?limit=` mà `/` gửi lên `GET /feeds/nhat-ky-moi-tac-gia`. */
const TRAN_NHAT_KY = 8;
const URL_NHAT_KY_MOI_TAC_GIA = `/api/v1/feeds/nhat-ky-moi-tac-gia?limit=${TRAN_NHAT_KY}`;

/** Kỳ vọng của khối "Nhật ký mới" (plan `2026-11-11-nhat-ky-moi-moi-tac-gia-mot-bai.md`): chính
 * thứ endpoint `GET /feeds/nhat-ky-moi-tac-gia` trả — MỖI tác giả một bài, bài `published_at`
 * lớn nhất. Phép chọn của endpoint được đo riêng bằng pytest (`test_api_nhat_ky_moi_tac_gia.py`)
 * và ở nhóm "U" cuối file trên những ca có đáp án biết trước (bài bị bump, bot đăng dồn). Bài so
 * với API này chỉ chứng minh `/` VẼ đúng thứ API trả, đúng thứ tự, không thêm không bớt. */
async function idsNhatKyMoiTacGia(): Promise<number[]> {
  return (await api<FeedOut>(URL_NHAT_KY_MOI_TAC_GIA)).items.map((m) => m.id);
}

/** Số cột thật của lưới chứa phần tử — đo bằng `getComputedStyle`, không đọc tên lớp CSS
 * (CSS Module băm tên). `grid-template-columns` đã tính ra là danh sách px, một số/một cột. */
const soCot = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const t = getComputedStyle(el).gridTemplateColumns;
    return t === "none" ? 1 : t.trim().split(/\s+/).length;
  });

/** Bố cục hai cột — dùng chung cho `/`, `/?tab=moi` ở cả hai theme. */
async function kiemHaiCot(page: Page, url: string, nhan: string) {
  await page.goto(url);
  const khung = page.getByTestId("khung-hai-cot");
  await expect(khung, `${nhan}: phải là khung hai cột`).toBeVisible();
  expect(await soCot(page, '[data-testid="khung-hai-cot"]'), `${nhan}: số cột`).toBe(2);

  // Rail trái KHÔNG có trong DOM (cột trái đã bỏ ở mọi trang) — tên class bị băm nên bám
  // `aria-label` của `<aside>` cũ. Khối "Tham gia" của khách nay nằm ở rail PHẢI, đúng một
  // chỗ (khách = phiên Playwright mặc định, chưa đăng nhập).
  await expect(page.locator('aside[aria-label="Cột điều hướng"]'), `${nhan}: rail trái`).toHaveCount(0);
  await expect(page.getByTestId("khoi-khach"), `${nhan}: khối khách`).toHaveCount(1);
  await expect(
    page.getByTestId("rail-phai").getByTestId("khoi-khach"),
    `${nhan}: khối khách nằm trong rail phải`,
  ).toBeVisible();

  const chinh = await page.locator("main").first().boundingBox();
  const rail = await page.getByTestId("rail-phai").boundingBox();
  if (chinh === null || rail === null) throw new Error(`${nhan}: không đo được main/rail`);
  expect(Math.round(rail.width), `${nhan}: rail rộng 300px`).toBe(300);
  expect(rail.x, `${nhan}: rail nằm bên PHẢI main`).toBeGreaterThanOrEqual(chinh.x + chinh.width);
  expect(Math.abs(rail.y - chinh.y), `${nhan}: hai cột bắt đầu cùng độ cao`).toBeLessThan(30);
}

/** Chiều cao khung nhìn đủ để chứa cả header (61px) + rail của `/` (1204px cho KHÁCH với seed e2e:
 * khối "Tham gia" 196px + giới thiệu + Chuyên mục + Luật) — dưới ngưỡng `min-height: 1500px` của
 * `khung-hai-cot.module.css` rail KHÔNG dính, nên bài đo "dính" phải đứng trên nó. (Ngưỡng này
 * là 1060px khi rail chưa mang khối khách; hai cột toàn site dời khối khách sang rail.) */
const CAO_DU_CHO_RAIL = 1500;

for (const theme of ["sang", "toi"] as const) {
  test.describe(`L — bố cục trang chủ (theme ${theme})`, () => {
    test.use({ colorScheme: theme === "toi" ? "dark" : "light" });

    test("L4 — theme đúng thật (không đo hai lần cùng một theme)", async ({ page }) => {
      await page.goto("/");
      const nen = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(nen).toBe(theme === "toi" ? "rgb(14, 17, 22)" : "rgb(255, 255, 255)");
    });

    test("L1 — `/` và `/?tab=moi`: hai cột, KHÔNG có rail trái, rail phải 300px", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await kiemHaiCot(page, "/", "/");
      await kiemHaiCot(page, "/?tab=moi", "/?tab=moi");
    });

    test("L1 — rail DÍNH khi cuộn, ở viewport đủ cao để chứa cả rail", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: CAO_DU_CHO_RAIL });
      await page.goto("/");
      const rail = page.getByTestId("rail-phai");
      expect(await rail.evaluate((e) => getComputedStyle(e).position)).toBe("sticky");

      // Trang đủ dài để cuộn: 1 + 8 + 10 mục. Không dài thì bài đo này là rỗng. Cuộn 600px (không
      // phải 1200 như khi khung nhìn chỉ 1100px): ở khung nhìn 1500px trang chỉ dài hơn nó ~1000px.
      const dai = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(dai, "trang phải dài hơn khung nhìn thì mới cuộn được").toBeGreaterThan(
        CAO_DU_CHO_RAIL + 600,
      );

      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(100);
      const cao_chrome = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cao-chrome")),
      );
      const hop = await rail.boundingBox();
      expect(hop, "rail còn trong khung nhìn sau khi cuộn").not.toBeNull();
      expect(Math.abs(hop!.y - cao_chrome), "rail bám mép dưới header").toBeLessThan(3);
      // Dính mà vẫn đủ cao: cả rail nằm trong khung nhìn, không cắt đuôi.
      expect(hop!.y + hop!.height, "đáy rail nằm trong khung nhìn").toBeLessThanOrEqual(
        CAO_DU_CHO_RAIL + 1,
      );
    });

    // Phép đo MẠNH hơn bản cũ (chỉ đo `position: sticky` ở 1280x900 nên xanh dù rail bị cắt):
    // ở màn laptop thấp, MỌI khối của rail — kể cả dòng miễn trừ ở `ChanTrang` — phải tới được
    // bằng cuộn TRANG. Không vùng cuộn con ẩn thanh cuộn, không tổ tiên nào cắt phần tử cuối.
    for (const [w, h] of [
      [1366, 768],
      [1280, 720],
    ] as const) {
      for (const url of ["/", "/chu-de"]) {
        test(`L1 — rail không bị cắt ở ${w}x${h} (${url}): khối cuối tới được bằng cuộn trang`, async ({
          page,
        }) => {
          await page.setViewportSize({ width: w, height: h });
          await page.goto(url);
          const rail = page.getByTestId("rail-phai");
          await expect(rail).toBeVisible();
          // Khối khách vẽ SAU khi biết phiên (client) và làm rail cao thêm ~196px: đo trước lúc ấy
          // là đo một rail ngắn hơn rail người thật nhìn thấy.
          await expect(rail.getByTestId("khoi-khach")).toBeVisible();

          const do_dac = await rail.evaluate((goc) => {
            // Phần tử cuối cùng (sâu nhất) của rail = dòng miễn trừ / link cuối của `ChanTrang`.
            let cuoi: Element = goc;
            while (cuoi.lastElementChild) cuoi = cuoi.lastElementChild;
            const vung_cuon: string[] = [];
            for (const e of [goc, ...goc.querySelectorAll("*")]) {
              const o = getComputedStyle(e).overflowY;
              if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight + 1) {
                vung_cuon.push(`${e.tagName}.${e.className} ${e.scrollHeight}>${e.clientHeight}`);
              }
            }
            // Tổ tiên nào cắt (overflow khác visible) mà đáy nó nằm trên đáy phần tử cuối ⇒ bị cắt.
            const r = cuoi.getBoundingClientRect();
            const bi_cat: string[] = [];
            for (let e = cuoi.parentElement; e && e !== document.body; e = e.parentElement) {
              const st = getComputedStyle(e);
              if (st.overflowY === "visible") continue;
              const rr = e.getBoundingClientRect();
              if (r.bottom > rr.bottom + 1) bi_cat.push(`${e.tagName}.${e.className}`);
            }
            return {
              vung_cuon,
              bi_cat,
              vi_tri: getComputedStyle(goc).position,
              rail_scroll: goc.scrollHeight,
              rail_client: goc.clientHeight,
              day_cuoi_trong_trang: r.bottom + window.scrollY,
              cao_tai_lieu: document.documentElement.scrollHeight,
              co_chan_trang: cuoi.closest('[data-testid="chan-trang"]') !== null,
            };
          });
          const so_do = JSON.stringify(do_dac);
          expect(do_dac.co_chan_trang, `phần tử cuối của rail phải thuộc ChanTrang: ${so_do}`).toBe(true);
          expect(do_dac.vung_cuon, `không vùng cuộn con: ${so_do}`).toEqual([]);
          expect(do_dac.bi_cat, `không tổ tiên nào cắt phần tử cuối: ${so_do}`).toEqual([]);
          expect(do_dac.rail_scroll, `rail không tràn: ${so_do}`).toBeLessThanOrEqual(
            do_dac.rail_client + 1,
          );
          expect(do_dac.vi_tri, `rail cao hơn khung nhìn thì KHÔNG dính: ${so_do}`).not.toBe(
            "sticky",
          );
          expect(do_dac.day_cuoi_trong_trang).toBeLessThanOrEqual(do_dac.cao_tai_lieu);

          // Cuộn trang tới phần tử cuối: nó phải vào hẳn khung nhìn.
          await rail.evaluate((goc) => {
            let cuoi: Element = goc;
            while (cuoi.lastElementChild) cuoi = cuoi.lastElementChild;
            cuoi.scrollIntoView({ block: "end" });
          });
          const sau_cuon = await rail.evaluate((goc) => {
            let cuoi: Element = goc;
            while (cuoi.lastElementChild) cuoi = cuoi.lastElementChild;
            const r = cuoi.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, khung: window.innerHeight };
          });
          expect(sau_cuon.top, JSON.stringify(sau_cuon)).toBeGreaterThanOrEqual(0);
          expect(sau_cuon.bottom, JSON.stringify(sau_cuon)).toBeLessThanOrEqual(sau_cuon.khung + 1);
        });
      }
    }

    test("L3 — 375px: một cột, không cuộn ngang, rail nằm DƯỚI nội dung", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      for (const url of ["/", "/?tab=moi"]) {
        await page.goto(url);
        expect(await soCot(page, '[data-testid="khung-hai-cot"]'), `${url}: số cột`).toBe(1);
        const rong = await page.evaluate(() => ({
          cuon: document.documentElement.scrollWidth,
          khung: window.innerWidth,
        }));
        expect(rong.cuon, `${url}: cuộn ngang`).toBeLessThanOrEqual(rong.khung);

        const chinh = await page.locator("main").first().boundingBox();
        const rail = await page.getByTestId("rail-phai").boundingBox();
        if (chinh === null || rail === null) throw new Error("không đo được main/rail");
        expect(rail.y, `${url}: rail dưới nội dung`).toBeGreaterThanOrEqual(
          chinh.y + chinh.height - 1,
        );
        // Rail trên điện thoại vẫn chứa đường tới `/s/*` và `/luat` (không còn cột trái nào).
        await expect(page.getByTestId("sidebar-cac-sub")).toBeAttached();
        await expect(page.getByTestId("sidebar-dan-luat")).toBeAttached();
      }
    });
  });
}

test.describe("L2 — `/s/<sub>` cũng HAI cột, cùng lưới với `/`", () => {
  test("không rail trái, lưới 2 cột, cột nội dung cùng x / bề rộng với trang chủ", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const trang_chu = await page.locator("main").first().boundingBox();
    await page.goto("/s/chung-khoan");
    await expect(page.locator('aside[aria-label="Cột điều hướng"]')).toHaveCount(0);
    await expect(page.getByTestId("khung-hai-cot")).toHaveCount(1);
    expect(await soCot(page, '[data-testid="khung-hai-cot"]')).toBe(2);
    const sub = await page.locator("main").first().boundingBox();
    if (trang_chu === null || sub === null) throw new Error("không đo được main");
    // Điều hướng `/` → `/s/<sub>` từng làm cột nội dung nhảy 193px (x=85,w=760 → x=278,w=635).
    expect(sub.x, "x của main").toBe(trang_chu.x);
    expect(sub.width, "bề rộng main").toBe(trang_chu.width);
  });
});

test.describe("B — các khối của trang chủ v2", () => {
  test("B1/B3 — thứ tự Chủ đề → Nhật ký mới → Bài viết (đo vị trí DOM và y thật), trần số mục 1 / 8 / 10", async ({
    page,
  }) => {
    await page.goto("/");
    const thu_tu = await page.evaluate(() => {
      const bao = (id: string) => document.querySelector(`[data-testid="${id}"]`);
      const chu_de = bao("khoi-thao-luan"),
        nhat_ky = bao("khoi-nhat-ky"),
        bai_viet = bao("khoi-bai-viet");
      if (!chu_de || !nhat_ky || !bai_viet) return null;
      const truoc = (x: Element, y: Element) =>
        Boolean(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
      const y = (x: Element) => x.getBoundingClientRect().top + window.scrollY;
      return {
        dom: { chu_de_nhat_ky: truoc(chu_de, nhat_ky), nhat_ky_bai_viet: truoc(nhat_ky, bai_viet) },
        y: { chu_de: y(chu_de), nhat_ky: y(nhat_ky), bai_viet: y(bai_viet) },
      };
    });
    expect(thu_tu, "ba khối phải cùng có mặt (seed có đủ ba loại)").not.toBeNull();
    expect(thu_tu!.dom, "thứ tự trong DOM").toEqual({ chu_de_nhat_ky: true, nhat_ky_bai_viet: true });
    // Thứ tự HIỂN THỊ (CSS không đảo): y tăng dần.
    expect(thu_tu!.y.chu_de, JSON.stringify(thu_tu!.y)).toBeLessThan(thu_tu!.y.nhat_ky);
    expect(thu_tu!.y.nhat_ky, JSON.stringify(thu_tu!.y)).toBeLessThan(thu_tu!.y.bai_viet);

    const nhat_ky = await page.getByTestId("khoi-nhat-ky").getByTestId("the-mach").count();
    const chu_de = await page.getByTestId("khoi-thao-luan").getByTestId("chu-de-the").count();
    const moi_dang = await page
      .getByTestId("khoi-bai-viet")
      .getByTestId("bai-viet-moi-dang-muc")
      .count();
    const muc_gia = await page.getByTestId("khoi-bai-viet").getByTestId("bai-viet-gia-muc").count();
    const cot = await page.getByTestId("khoi-bai-viet").getByTestId("bai-viet-gia").count();
    expect(nhat_ky).toBeGreaterThan(0);
    expect(nhat_ky).toBeLessThanOrEqual(8);
    // Số thẻ = min(8, số tác giả) — không phải min(8, số bài).
    expect(nhat_ky, "số thẻ nhật ký = số tác giả (tối đa 8)").toBe((await idsNhatKyMoiTacGia()).length);
    // Seed có 3 chủ đề nhưng trang chủ chỉ hiện MỘT (mới nhất) — bài đo không rỗng vì có 3.
    expect((await api<FeedOut>("/api/v1/feeds/moi?loai_mach=thao_luan&limit=50")).items.length).toBe(3);
    expect(chu_de, "chỉ MỘT chủ đề mới nhất").toBe(1);
    // Khối Bài viết = dải Mới đăng (đúng 3) + giá sách (mỗi sub được chọn một cột, ≤ 3 bài).
    // `beforeAll` cấp file đặt 3 sub lên giá sách và dựng đủ bài ⇒ ĐÚNG 3 cột (bài đo không rỗng);
    // số bài từng cột phụ thuộc phần trùng với Mới đăng nên chỉ chặn hai đầu — con số chính xác
    // được so với API ở bài B1 kế tiếp.
    expect(moi_dang, "dải Mới đăng").toBe(3);
    expect(cot, "ba giá sách").toBe(3);
    expect(muc_gia).toBeGreaterThanOrEqual(3);
    expect(muc_gia).toBeLessThanOrEqual(9);
  });

  test("B1 — mỗi khối mang ĐÚNG loại mạch của nó (khớp API)", async ({ page }) => {
    await page.goto("/");
    const ids = (loai: string, limit: number) =>
      api<FeedOut>(`/api/v1/feeds/moi?loai_mach=${loai}&limit=${limit}`).then((f) =>
        f.items.map((m) => m.id),
      );
    // Nhật ký: KHÔNG còn là 8 bài đầu của `/feeds/moi` (hợp đồng cũ) mà là endpoint riêng "mỗi
    // tác giả một bài" (plan `2026-11-11-nhat-ky-moi-moi-tac-gia-mot-bai.md`). Vẫn là phép so
    // với API và vẫn là mảng ĐÚNG THỨ TỰ; chỉ nguồn kỳ vọng đổi.
    expect(await idsTrenTrang(page, "the-mach")).toEqual(await idsNhatKyMoiTacGia());
    expect(await idsTrenTrang(page, "chu-de-the")).toEqual(await ids("thao_luan", 1));
    // Bài viết: kỳ vọng viết lại ĐỘC LẬP ở đây (không import `lib/nhom-bai-viet`) từ chính API.
    //  · Mới đăng = 3 bài đầu của `/feeds/moi` trừ tin-tuc, mọi sub (việc 20: bản tin là bảng riêng;
    //    lọc tin-tuc ở lại để phòng thủ mạch bản tin cũ mà lệnh chuyển bỏ qua);
    //  · giá sách = mỗi sub có `vi_tri_trang_chu` (theo vị trí) một cột: 3 bài đầu của feed RIÊNG
    //    sub ấy trừ bài đã ở Mới đăng; cột rỗng ẩn.
    const moi = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=50");
    const moi_dang_mong = moi.items.filter((m) => m.sub.slug !== "tin-tuc").slice(0, 3);
    expect(
      await page
        .getByTestId("bai-viet-moi-dang-muc")
        .evaluateAll((ls) => ls.map((l) => Number((l as HTMLElement).dataset.machId))),
    ).toEqual(moi_dang_mong.map((m) => m.id));
    const cac_sub = await api<SubChiTietOut[]>("/api/v1/subs");
    const chon = cac_sub
      .filter((s) => s.vi_tri_trang_chu !== null)
      .sort((a, b) => a.vi_tri_trang_chu! - b.vi_tri_trang_chu!);
    expect(chon.map((s) => s.slug), "seed tạm đặt ba sub lên giá sách").toEqual(SUB_GIA_SACH);
    const da_hien = new Set(moi_dang_mong.map((m) => m.id));
    const gia_mong: { slug: string; ids: number[] }[] = [];
    for (const s of chon) {
      const f = await api<FeedOut>(
        `/api/v1/feeds/moi?sub=${s.slug}&loai_mach=bai_viet&limit=6`,
      );
      const ids = f.items.filter((m) => !da_hien.has(m.id)).slice(0, 3).map((m) => m.id);
      if (ids.length > 0) gia_mong.push({ slug: s.slug, ids });
    }
    const co = await page.getByTestId("bai-viet-gia").evaluateAll((cols) =>
      cols.map((c) => ({
        slug: (c as HTMLElement).dataset.sub!,
        ids: [...c.querySelectorAll('[data-testid="bai-viet-gia-muc"]')].map((e) =>
          Number((e as HTMLElement).dataset.machId),
        ),
      })),
    );
    expect(co).toEqual(gia_mong);
    // Ca đo được "giá không trùng dải": giá quan-tri-von mất đúng bài mới nhất vào Mới đăng.
    const tat_ca_gia = co.flatMap((c) => c.ids);
    for (const id of da_hien) expect(tat_ca_gia, `bài ${id} trùng dải Mới đăng`).not.toContain(id);
    // Dải bản tin (đầu trang): 2 bản tin mới nhất của bảng RIÊNG (`liet_ke_ban_tin`, việc 20) —
    // `SO_BAN_TIN_DAI`, việc 19 vòng 2.
    const ban_tin = await api<TrangBanTinOut>("/api/v1/ban-tin?limit=2");
    expect(ban_tin.items.length, "seed có ≥ 2 bản tin").toBe(2);
    expect(
      await page
        .getByTestId("ban-tin")
        .locator("li[data-ngay]")
        .evaluateAll((ls) => ls.map((l) => (l as HTMLElement).dataset.ngay)),
    ).toEqual(ban_tin.items.map((b) => b.ngay));
  });

  test("B4 — nút 'Mở nhật ký' trỏ /dang-mach, kèm dòng phụ đúng với sản phẩm", async ({
    page,
  }) => {
    await page.goto("/");
    const nut = page.getByTestId("nut-mo-nhat-ky");
    await expect(nut).toHaveAttribute("href", "/dang-mach");
    await expect(nut).toHaveText("Mở nhật ký");
    // Câu phụ KHÔNG hứa riêng tư là mặc định (form mặc định công khai): "Có thể ghi riêng tư…".
    await expect(page.getByTestId("trang-chu-v2")).toContainText(
      "Có thể ghi riêng tư, công khai khi bạn muốn.",
    );
  });

  // Giao diện mới (plan 2026-11-11 §3.1): KHÔNG còn danh sách / link "Các chủ đề trước" trong
  // khối chủ đề trên `/`; lối vào kho `/chu-de` chỉ còn ở rail phải.
  test("link 'Tất cả' của nhật ký / bài viết và lối vào kho chủ đề (chỉ ở rail)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("nhat-ky-tat-ca")).toHaveAttribute(
      "href",
      "/?tab=moi&loai_mach=nhat_ky",
    );
    await expect(page.getByTestId("bai-viet-tat-ca")).toHaveAttribute(
      "href",
      "/?tab=moi&loai_mach=bai_viet",
    );
    await expect(page.getByTestId("chu-de-tat-ca")).toHaveCount(0);
    await expect(page.locator('main a[href="/chu-de"]')).toHaveCount(0);
    await expect(page.getByTestId("sidebar-dan-chu-de")).toHaveAttribute("href", "/chu-de");
  });
});

test.describe("B5 — `?loai_mach=` đi xuyên qua feed cũ", () => {
  test("`/?tab=moi&loai_mach=nhat_ky`: chỉ nhật ký, chip, cuộn vô hạn trang 2 cùng loại", async ({
    page,
  }) => {
    const trang1 = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=nhat_ky&limit=20");
    expect(trang1.cursor_ke_tiep, "seed phải có >20 nhật ký thì mới có trang 2").not.toBeNull();
    const trang2 = await api<FeedOut>(
      `/api/v1/feeds/moi?loai_mach=nhat_ky&limit=20&cursor=${encodeURIComponent(trang1.cursor_ke_tiep!)}`,
    );
    const bai_viet = new Set(
      (await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=50")).items.map((m) => m.id),
    );

    await page.goto("/?tab=moi&loai_mach=nhat_ky");
    // Đợt C (việc 14): chip "Loại: … ✕ Bỏ lọc" bị hàng chip Loại thay — chip "Nhật ký" đang chọn.
    await expect(page.getByTestId("bo-loc-loai-mach")).toHaveCount(0);
    await expect(page.getByTestId("loc-loai-nhat_ky")).toHaveAttribute("aria-current", "true");
    const ids1 = await idsTrenTrang(page, "the-mach");
    expect(ids1).toEqual(trang1.items.map((m) => m.id));

    // Chip "Tất cả" của hàng Loại quay về feed không lọc loại (cùng URL mà chip "Bỏ lọc" cũ trỏ tới).
    await expect(page.getByTestId("loc-loai-tat-ca")).toHaveAttribute("href", "/?tab=moi");

    // Cuộn vô hạn: kéo mốc "xem thêm" vào khung nhìn ⇒ trang 2, CÙNG loại.
    await page.getByTestId("feed-xem-them").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("feed-them").getByTestId("the-mach").first()).toBeVisible({
      timeout: 15_000,
    });
    const ids2 = await page
      .getByTestId("feed-them")
      .getByTestId("the-mach")
      .evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.machId)));
    expect(ids2.slice(0, trang2.items.length)).toEqual(trang2.items.map((m) => m.id));
    for (const id of [...ids1, ...ids2]) {
      expect(bai_viet.has(id), `mạch ${id} là bài viết lọt vào feed nhật ký`).toBe(false);
    }
  });

  test("tab, khoảng giữ `loai_mach` trên URL; giá trị lạ bị bỏ qua (không 500)", async ({
    page,
    request,
  }) => {
    await page.goto("/?tab=moi&loai_mach=bai_viet");
    await expect(page.getByTestId("bo-loc-loai-mach")).toHaveCount(0);
    await expect(page.getByTestId("loc-loai-bai_viet")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("tab-nhieu-diem")).toHaveAttribute(
      "href",
      "/?tab=nhieu-diem&loai_mach=bai_viet",
    );

    const r = await request.get("/?loai_mach=abc");
    expect(r.status()).toBe(200);
    await page.goto("/?loai_mach=abc");
    await expect(page.getByTestId("loc-loai-tat-ca")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("feed-tieu-de-loai")).toHaveCount(0);
    // Không lọc: ra đúng feed không lọc (mọi loại), không phải một loại ngầm nào.
    const khong_loc = await api<FeedOut>("/api/v1/feeds/moi?limit=20");
    expect(await idsTrenTrang(page, "the-mach")).toEqual(khong_loc.items.map((m) => m.id));
  });
});

test.describe("S — đường bò của bot (HTML thô, không JS)", () => {
  test("S3 — `/` có link tới MỌI chuyên mục `/s/*` và `/luat`", async ({ request }) => {
    const cac_sub = await api<SubChiTietOut[]>("/api/v1/subs");
    const html = await (await request.get("/")).text();
    const hrefs = new Set([...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]));
    for (const s of cac_sub) expect(hrefs.has(`/s/${s.slug}`), `thiếu /s/${s.slug}`).toBe(true);
    expect(hrefs.has("/luat")).toBe(true);
  });

  // ĐỔI (giao diện mới, plan 2026-11-11 §3.3): bản cũ đo link cursor "Xem thêm bài viết →" bắt
  // đầu NGAY SAU bài thứ 10 của khối. Thư viện mới không phân trang theo cursor — nó chia 50
  // bài mới nhất theo nhóm sub, nên "bài thứ 10 của khối" không còn nghĩa. Đường bò của bot vẫn
  // phải có thật: link "Tất cả bài viết →" và "Xem thêm bài viết" là `<a href>` trong HTML thô,
  // trỏ feed bài viết (feed cũ có cursor + cuộn vô hạn), và link "Xem thêm →" của từng cột.
  test("S5 — 'Tất cả bài viết', 'Xem thêm bài viết', 'Xem thêm →' của cột là <a href> THẬT trong HTML thô", async ({
    request,
    page,
  }) => {
    const html = await (await request.get("/")).text();
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    const tat_ca = hrefs.filter((h) => h === "/?tab=moi&loai_mach=bai_viet");
    expect(tat_ca.length, "cả 'Tất cả bài viết →' lẫn 'Xem thêm bài viết' trỏ feed bài viết").toBe(2);
    for (const sub of ["hoi-dap", "vi-mo", "quan-tri-von", "tin-tuc"]) {
      expect(hrefs, `thiếu link tới /s/${sub}`).toContain(`/s/${sub}`);
    }
    // Đi theo link ra feed cũ: có bài viết, cùng loại.
    await page.goto("/?tab=moi&loai_mach=bai_viet");
    const mong = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=20");
    expect(await idsTrenTrang(page, "the-mach")).toEqual(mong.items.map((x) => x.id));
  });
});

/** B1 — khối Chủ đề VẮNG khi không có `thao_luan` nào. Dựng ca này bằng cách ẩn tạm các chủ đề
 * của seed (`hidden_at`, cơ chế soft-hide của sản phẩm) rồi HOÀN LẠI trong `afterAll`.
 * Serial và tự khôi phục ở cả `beforeAll`: một lần chạy trước bị ngắt giữa chừng không được để
 * ba chủ đề seed ẩn vĩnh viễn (các bài đo B1–B3 phía trên sẽ đỏ vì lý do không liên quan). */
test.describe.serial("B1 — khối Chủ đề ẩn hẳn khi chưa có chủ đề nào", () => {
  const goc = resolve(__dirname, "..", "..", "..");
  const dat = (an: boolean) =>
    execFileSync(
      process.execPath,
      [
        resolve(goc, "scripts/py.mjs"),
        "shell",
        "-c",
        "from django.utils import timezone; from core.models import Mach, User; " +
          // CHECK `mach_an_phai_co_nguoi_an_hoac_hen_gio`: ẩn thì phải có người ẩn (hoặc hẹn giờ).
          "mod = User.objects.filter(is_staff=True).first(); " +
          "Mach.objects.filter(loai_mach='thao_luan', title__startswith='Chủ đề e2e')" +
          `.update(hidden_at=${an ? "timezone.now()" : "None"}, hidden_by=${an ? "mod" : "None"})`,
      ],
      { cwd: goc, stdio: "pipe" },
    );

  test.beforeAll(() => dat(false));
  test.afterAll(() => dat(false));

  test("không có chủ đề ⇒ không khung rỗng, không placeholder; hai khối kia còn", async ({
    page,
    request,
  }) => {
    dat(true);
    const conLai = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=thao_luan&limit=6");
    expect(conLai.items, "không còn chủ đề công khai nào").toHaveLength(0);

    await page.goto("/");
    await expect(page.getByTestId("khoi-thao-luan")).toHaveCount(0);
    await expect(page.getByTestId("khoi-nhat-ky")).toBeVisible();
    await expect(page.getByTestId("khoi-bai-viet")).toBeVisible();
    // Chỉ xét phần NỘI DUNG (`main`): rail phải cố ý có link "Chủ đề thảo luận →" tới kho `/chu-de`.
    await expect(page.locator("main")).not.toContainText("Chủ đề thảo luận");
    await expect(page.locator("main")).not.toContainText("Chủ đề tuần");
    // Lối vào kho chủ đề vẫn ở rail (khối ẩn thì rail vẫn là cửa duy nhất).
    await expect(page.getByTestId("sidebar-dan-chu-de")).toHaveAttribute("href", "/chu-de");
    expect((await request.get("/")).status()).toBe(200);
  });
});

/* ---------------------------------------------------------------------------------------- */

const GOC = resolve(__dirname, "..", "..", "..");

/** Chạy một đoạn Python trong Django shell của `gikky_e2e` (DATABASE_URL kế thừa từ lệnh chạy
 * e2e — KHÔNG đặt ở đây), trả stdout. */
function py(ma: string): string {
  return execFileSync(process.execPath, [resolve(GOC, "scripts/py.mjs"), "shell", "-c", ma], {
    cwd: GOC,
    stdio: "pipe",
  }).toString();
}
const dongCuoi = (ra: string) => ra.trim().split("\n").pop()?.trim() ?? "";

/** Ẩn / hiện (soft-hide của sản phẩm) các chủ đề seed có tiêu đề bắt đầu bằng một trong
 * `tien_to`. CHECK `mach_an_phai_co_nguoi_an_hoac_hen_gio` đòi có người ẩn ⇒ dùng chính tác giả. */
function anChuDe(tien_to: string[], an: boolean): void {
  py(
    "from django.utils import timezone; from django.db.models import F, Q; from core.models import Mach; " +
      `loc = Q(pk__in=[]); [loc.add(Q(title__startswith=t), Q.OR) for t in ${JSON.stringify(tien_to)}]; ` +
      "Mach.objects.filter(Q(loai_mach='thao_luan') & loc)" +
      `.update(hidden_at=${an ? "timezone.now()" : "None"}, hidden_by=${an ? "F('author')" : "None"})`,
  );
}

/* Kỳ vọng về TUẦN của chủ đề, viết ĐỘC LẬP với `lib/chu-de.ts` (khác thuật toán: đọc ngày lịch
 * VN và thứ trong tuần bằng `Intl`, không cộng 7 giờ rồi đọc `getUTC*`) để hai bên không cùng
 * sai một kiểu. Ngày lịch VN → số ngày kể từ epoch để trừ nhau. */
const NGAY_MS = 86_400_000;
const ngayVN = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
};
/** 0 = thứ Hai … 6 = Chủ nhật, theo lịch VN. */
const thuVN = (d: Date) =>
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }).format(d),
  );
const hai = (n: number) => String(n).padStart(2, "0");
function tuanMong(published_at: string, bay_gio: Date) {
  const xb = new Date(published_at);
  const thu_hai = ngayVN(xb) - thuVN(xb) * NGAY_MS;
  const chu_nhat = thu_hai + 6 * NGAY_MS;
  const hom_nay = ngayVN(bay_gio);
  const dd = (ms: number) => `${hai(new Date(ms).getUTCDate())}/${hai(new Date(ms).getUTCMonth() + 1)}`;
  return {
    nhan: `${dd(thu_hai)} – ${dd(chu_nhat)}`,
    trong_tuan: hom_nay >= thu_hai && hom_nay <= chu_nhat,
    con_lai: Math.round((chu_nhat - hom_nay) / NGAY_MS),
  };
}
const khoangTuanMong = (published_at: string) => tuanMong(published_at, new Date()).nhan;
const nhanMong = (published_at: string, bay_gio: Date) =>
  tuanMong(published_at, bay_gio).trong_tuan ? "Chủ đề tuần này" : "Chủ đề gần nhất";
function chipMong(m: Pick<MachTomTatOut, "status" | "published_at">, bay_gio: Date) {
  if (m.status === "closed") return "Đã đóng";
  const t = tuanMong(m.published_at, bay_gio);
  if (!t.trong_tuan) return "Đang mở";
  return t.con_lai > 0 ? `Đang mở · còn ${t.con_lai} ngày` : "Đang mở · đóng hôm nay";
}

const TD_MO = "Chủ đề e2e đang mở";
const TD_TONG_KET = "Chủ đề e2e đã đóng có tổng kết";
const TD_KHONG = "Chủ đề e2e đã đóng không tổng kết";

/** B2 + K7 — MỘT thẻ nổi, ba trạng thái. Ẩn dần các chủ đề seed để lần lượt biến từng cái thành
 * "chủ đề mới nhất"; nguồn sự thật là API (`limit=1`) VÀ ba giá trị cứng của seed (để bài đo
 * không tự đúng khi cả hai cùng sai). Serial và tự khôi phục ở cả `beforeAll`/`afterAll`. */
test.describe.serial("B2/B7 — khối Chủ đề là MỘT thẻ nổi, nhãn và nút theo trạng thái", () => {
  test.beforeAll(() => anChuDe([TD_MO, TD_TONG_KET, TD_KHONG], false));
  test.afterAll(() => anChuDe([TD_MO, TD_TONG_KET, TD_KHONG], false));

  async function kiemThe(page: Page) {
    const [m] = (await api<FeedOut>("/api/v1/feeds/moi?loai_mach=thao_luan&limit=1")).items;
    expect(m, "phải có chủ đề").toBeDefined();
    await page.goto("/");
    const khoi = page.getByTestId("khoi-thao-luan");
    const the = khoi.getByTestId("chu-de-the");
    await expect(the, "đúng MỘT thẻ").toHaveCount(1);
    await expect(the).toHaveAttribute("data-mach-id", String(m.id));

    const dang_mo = m.status !== "closed";
    // Giao diện mới: câu hỏi của chủ đề là `<h2>` của khối (link tới mạch), không còn nhãn
    // "Chủ đề đang thảo luận" / "Chủ đề đã đóng" — trạng thái nằm ở chip.
    const h2 = khoi.getByRole("heading", { level: 2 });
    await expect(h2).toHaveText(m.title);
    await expect(h2.getByRole("link")).toHaveAttribute("href", `/m/${m.slug}-${m.id}`);
    await expect(the.getByTestId("chu-de-trang-thai")).toHaveText(chipMong(m, new Date()));
    const vao = the.getByTestId("chu-de-vao");
    await expect(vao).toHaveText(dang_mo ? "Vào thảo luận" : "Xem lại thảo luận");
    await expect(vao).toHaveAttribute("href", `/m/${m.slug}-${m.id}`);
    // Nút phụ: tới Ô SOẠN bình luận của CHÍNH chủ đề này (`#viet-binh-luan`), không phải danh sách
    // `#khan-dai` (đợt A, plan thống nhất giao diện §4.5: trước đó hai nút cùng trỏ `#khan-dai`).
    const viet = the.getByTestId("chu-de-viet");
    await expect(viet).toHaveText("Viết quan điểm của bạn");
    expect(await viet.getAttribute("href")).toContain(`/m/${m.slug}-${m.id}?`);
    expect(await viet.getAttribute("href")).toMatch(/#viet-binh-luan$/);
    // Đích của nút có THẬT trong HTML SERVER của trang mạch (không phải chỉ sau hydrate): ô soạn
    // là client component trả null tới khi biết phiên, nên `id` nằm trên cái bọc.
    const href_viet = (await viet.getAttribute("href"))!;
    const html_mach = await (await page.request.get(href_viet.split("#")[0])).text();
    expect(html_mach.match(/id="viet-binh-luan"/g) ?? [], "đúng MỘT phần tử đích").toHaveLength(1);
    // Khoảng tuần = thứ Hai–Chủ nhật (giờ VN) của `published_at`.
    await expect(the.getByTestId("chu-de-tuan")).toHaveText(khoangTuanMong(m.published_at));
    // "Chủ đề tuần này" chỉ khi hôm nay nằm trong tuần ấy; không thì "gần nhất".
    await expect(the.getByTestId("chu-de-nhan")).toHaveText(
      nhanMong(m.published_at, new Date()),
    );

    // Không còn ô quan điểm (việc 19, plan `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.4), bất kể
    // chủ đề có bao nhiêu bình luận; bài T10 ở `dai-ban-tin.spec.ts` chứng minh nó không đo rỗng.
    await expect(the.getByTestId("quan-diem-noi-bat")).toHaveCount(0);
    await expect(the.getByTestId("quan-diem")).toHaveCount(0);

    // Luật đếm: dưới 4 bình luận không phô số; từ 4 trở lên "💬 N".
    if (m.comment_count >= 4) {
      await expect(the.getByTestId("chu-de-so-binh-luan")).toHaveText(`💬 ${m.comment_count}`);
    } else {
      await expect(the.getByTestId("chu-de-so-binh-luan")).toHaveCount(0);
      await expect(the, "không con số nào").not.toContainText("💬");
    }
    // `ket_qua` chỉ hiện khi đã đóng và có.
    if (!dang_mo && m.ket_qua) {
      await expect(the.getByTestId("chu-de-ket-qua")).toContainText(m.ket_qua);
    } else {
      await expect(the.getByTestId("chu-de-ket-qua")).toHaveCount(0);
    }
    // KHÔNG có "Các chủ đề trước" trong khối (lối vào kho chủ đề chỉ còn ở rail) + các chữ đã bỏ.
    await expect(khoi.getByTestId("chu-de-tat-ca")).toHaveCount(0);
    await expect(khoi.locator('a[href="/chu-de"]')).toHaveCount(0);
    await expect(the.getByTestId("chu-de-loi-moi")).toHaveCount(0);
    await expect(khoi).not.toContainText("Cùng thảo luận");
    expect((await khoi.innerText()).toLowerCase(), "chữ 'tham gia' bị cấm trên /").not.toContain(
      "tham gia",
    );
    return m;
  }

  test("chủ đề mới nhất đang mở, 2 bình luận: 'Vào thảo luận →', KHÔNG con số, KHÔNG ket_qua", async ({
    page,
  }) => {
    const m = await kiemThe(page);
    expect(m.title, "seed: chủ đề mở là cái mới nhất").toContain(TD_MO);
    expect(m.status).not.toBe("closed");
    expect(m.comment_count).toBe(2);
  });

  test("chỉ còn chủ đề đã đóng có tổng kết, 5 bình luận: 'Chủ đề đã đóng', '💬 5', ket_qua, 'Xem lại thảo luận →'", async ({
    page,
  }) => {
    anChuDe([TD_MO], true);
    const m = await kiemThe(page);
    expect(m.title).toContain(TD_TONG_KET);
    expect(m.status).toBe("closed");
    expect(m.comment_count).toBe(5);
    expect(m.ket_qua, "seed: chủ đề này có ket_qua").toBeTruthy();
  });

  test("chỉ còn chủ đề đã đóng không tổng kết, 0 bình luận: thẻ vẫn hiện, không số, không ket_qua", async ({
    page,
  }) => {
    anChuDe([TD_MO, TD_TONG_KET], true);
    const m = await kiemThe(page);
    expect(m.title).toContain(TD_KHONG);
    expect(m.status).toBe("closed");
    expect(m.comment_count).toBe(0);
    expect(m.ket_qua).toBeNull();
  });
});

/* ---------------------------------------------------------------------------------------- */

test.describe("H — cấp heading của trang chủ (việc 6)", () => {
  test("`/`: một <h1>, không <h3> nào đứng trước <h2> đầu tiên, khối nhật ký/bài viết có h3 bên dưới (khối chủ đề không), không nhảy cấp", async ({
    page,
  }) => {
    await page.goto("/");
    const cac = await page.evaluate(() =>
      [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => ({
        cap: Number(h.tagName[1]),
        chu: (h.textContent ?? "").trim().slice(0, 40),
        khoi: h.closest("section[data-testid]")?.getAttribute("data-testid") ?? null,
      })),
    );
    const so = JSON.stringify(cac);
    expect(cac.filter((h) => h.cap === 1), `đúng một <h1>: ${so}`).toHaveLength(1);
    const dau_h2 = cac.findIndex((h) => h.cap === 2);
    expect(dau_h2, `có <h2>: ${so}`).toBeGreaterThan(-1);
    expect(
      cac.slice(0, dau_h2).filter((h) => h.cap === 3),
      `<h3> đứng trước <h2> đầu tiên: ${so}`,
    ).toEqual([]);
    // Không nhảy cấp (h1 → h3 ...): mỗi heading chỉ sâu hơn heading liền trước TỐI ĐA một cấp.
    for (let i = 1; i < cac.length; i += 1) {
      expect(cac[i].cap - cac[i - 1].cap, `nhảy cấp ở #${i}: ${so}`).toBeLessThanOrEqual(1);
    }
    // Ba khối: đúng một <h2> đứng đầu, và KHÔNG còn <h2> nào của thẻ bên trong. Nhật ký + bài viết
    // có <h3> bên dưới; khối chủ đề thì KHÔNG còn <h3> nào — <h3> duy nhất của nó là tiêu đề ô quan
    // điểm, ô ấy bỏ ở việc 19 (plan `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.4).
    for (const [khoi, co_h3] of [
      ["khoi-thao-luan", false],
      ["khoi-nhat-ky", true],
      ["khoi-bai-viet", true],
    ] as const) {
      const trong = cac.filter((h) => h.khoi === khoi);
      expect(trong.filter((h) => h.cap === 2), `${khoi}: đúng một <h2>: ${so}`).toHaveLength(1);
      const so_h3 = trong.filter((h) => h.cap === 3).length;
      if (co_h3) expect(so_h3, `${khoi}: có <h3>: ${so}`).toBeGreaterThan(0);
      else expect(so_h3, `${khoi}: không còn <h3>: ${so}`).toBe(0);
      expect(trong[0].cap, `${khoi}: <h2> đứng đầu khối`).toBe(2);
    }
    // Thẻ nhật ký cụ thể: <h3>, không <h2>.
    const nhat_ky = page.getByTestId("khoi-nhat-ky").getByTestId("the-mach");
    const so_the = await nhat_ky.count();
    expect(so_the).toBeGreaterThan(0);
    await expect(nhat_ky.locator("h2")).toHaveCount(0);
    await expect(nhat_ky.locator("h3")).toHaveCount(so_the);
  });

  test("mọi chỗ KHÁC dùng `TheMach` giữ <h2> (feed cũ, trang sub)", async ({ page }) => {
    for (const url of ["/?tab=moi", "/s/chung-khoan"]) {
      await page.goto(url);
      const the = page.getByTestId("the-mach");
      const n = await the.count();
      expect(n, `${url}: có thẻ`).toBeGreaterThan(0);
      await expect(the.locator("h2"), `${url}: mỗi thẻ một <h2>`).toHaveCount(n);
      await expect(the.locator("h3"), `${url}: không <h3>`).toHaveCount(0);
    }
  });
});

/* ---------------------------------------------------------------------------------------- */

/** Việc 4 — tiêu đề KHÔNG có dấu cách (110 chữ `A` liền nhau) không được đẩy trang rộng quá
 * 375px. Dựng tạm một chủ đề (là chủ đề MỚI NHẤT ⇒ thành thẻ nổi ở `/`) và một bài viết (mới
 * nhất ⇒ nằm trong 10 hàng đầu của `/`), rồi XOÁ SẠCH và kiểm lại 0 hàng. */
const TIEU_DE_DAI = "A".repeat(110);

test.describe.serial("O — tiêu đề dài liền nhau không làm trang cuộn ngang ở 375px", () => {
  const dem = () =>
    Number(
      dongCuoi(
        py(
          "from core.models import Mach; " +
            `print(Mach.objects.filter(title=${JSON.stringify(TIEU_DE_DAI)}).count())`,
        ),
      ),
    );
  const don = () =>
    py(
      "from core.models import Mach; " +
        `Mach.objects.filter(title=${JSON.stringify(TIEU_DE_DAI)}).delete()`,
    );

  test.beforeAll(() => {
    don();
    py(
      [
        "from core.ghi import tao_mach",
        "from core.models import Mach, Sub",
        `goc = Mach.objects.get(title__startswith=${JSON.stringify(TD_MO)})`,
        // Bài viết dài vào `hoi-dap` (một sub thật; bài mới nhất nên lên dải Mới đăng của `/`)
        // (sub `e2e-thu-nghiem` của chủ đề không thuộc nhóm nào); chủ đề thì ở sub của chủ đề.
        "for loai in (Mach.LoaiMach.THAO_LUAN, Mach.LoaiMach.BAI_VIET):",
        "    tao_mach(sub=goc.sub if loai == Mach.LoaiMach.THAO_LUAN else Sub.objects.get(slug='hoi-dap'),",
        "        author=goc.author,",
        `        title=${JSON.stringify(TIEU_DE_DAI)}, body='Tiêu đề dài liền nhau của bộ e2e.',`,
        "        occurred_at=None, loai=None, loai_mach=loai)",
        "",
      ].join("\n"),
    );
  });
  test.afterAll(() => {
    don();
    expect(dem(), "đã xoá sạch mạch tạm").toBe(0);
  });

  for (const theme of ["sang", "toi"] as const) {
    test(`375px (${theme}): \`/\` và \`/chu-de\` không cuộn ngang, tiêu đề dài có mặt trong khung`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({
        viewport: { width: 375, height: 800 },
        colorScheme: theme === "toi" ? "dark" : "light",
      });
      const page = await ctx.newPage();
      try {
        for (const url of ["/", "/chu-de"]) {
          await page.goto(url);
          // Bài đo không rỗng: tiêu đề dài PHẢI đang nằm trên trang này.
          const tieu = page.getByRole("link", { name: TIEU_DE_DAI });
          expect(await tieu.count(), `${url}: tiêu đề dài có mặt`).toBeGreaterThan(0);
          const rong = await page.evaluate(() => ({
            cuon: document.documentElement.scrollWidth,
            khung: window.innerWidth,
          }));
          expect(rong.cuon, `${url}: cuộn ngang ${JSON.stringify(rong)}`).toBeLessThanOrEqual(
            rong.khung,
          );
          // Chính tiêu đề cũng nằm trong khung nhìn (không bị cắt tràn ra ngoài mép phải).
          const hop = await tieu.first().boundingBox();
          expect(hop, `${url}: đo được hộp tiêu đề`).not.toBeNull();
          expect(hop!.x + hop!.width, `${url}: tiêu đề tràn mép phải`).toBeLessThanOrEqual(
            rong.khung + 1,
          );
        }
        // Riêng `/`: cả khối chủ đề lẫn khối bài viết đều có tiêu đề dài ấy.
        await page.goto("/");
        await expect(
          page.getByTestId("khoi-thao-luan").getByRole("link", { name: TIEU_DE_DAI }),
        ).toHaveCount(1);
        await expect(
          page.getByTestId("khoi-bai-viet").getByRole("link", { name: TIEU_DE_DAI }),
        ).toHaveCount(1);
      } finally {
        await ctx.close();
      }
    });
  }
});

/* ---------------------------------------------------------------------------------------- */

/** U — khối "Nhật ký mới": MỖI tác giả MỘT thẻ, và là bài `published_at` LỚN NHẤT của họ (plan
 * `2026-11-11-nhat-ky-moi-moi-tac-gia-mot-bai.md`; endpoint `GET /feeds/nhat-ky-moi-tac-gia`).
 *
 * Bản đầu lọc ở web trên 50 bài của `/feeds/moi` và phản biện tái hiện hai lỗi. Nhóm này dựng
 * ĐÚNG hai ca đó trên DB e2e và đo `/` thật:
 *
 *  - **V1 (bài bị bump)** — tác giả `bump` có X đăng 90 ngày trước rồi được nối mốc (nên
 *    `/feeds/moi` xếp X lên TRƯỚC) và Y đăng gần đây. Khối phải hiện Y, không phải X.
 *  - **V2 (bot đăng dồn)** — `bot` đăng 55 bài, đều mới hơn bài duy nhất của `nguoi_that`; bài
 *    ấy văng khỏi 50 bài đầu của `/feeds/moi`. Khối vẫn phải có `nguoi_that`.
 *
 * Mỗi ca có TIỀN ĐIỀU KIỆN chứng minh feed cũ THẬT SỰ sai ở đó (không thì bài đo xanh rỗng).
 * Thứ tự đăng (cũ → mới): 9 tác giả phụ → `nguoi_that` → 55 bài `bot` → `bump` (X cũ + mốc,
 * rồi Y) → `TAC_GIA_LAP` đăng 3 bài liền. Chín tác giả phụ ép số tác giả > 8 để trần "8 thẻ"
 * tính theo TÁC GIẢ có đất chạy. Mọi thứ XOÁ SẠCH ở `afterAll` (`seed_e2e` không đổi tập dữ
 * liệu seed; chỉ `--reset` của nó được sửa để chịu được rác lạ trong sub e2e).
 *
 * **Tài khoản tạm mang email `@gikky.test`** — miền mà `don_rac_e2e` dọn (`MIEN_E2E`). Bản đầu
 * dùng `@vi-du.gikky.net` (miền của tài khoản seed) nên bị ngắt giữa chừng là rác nằm lại, không
 * lệnh dọn nào nhận. Mạch lạ nằm trong sub e2e còn từng làm `seed_e2e --reset` chết với
 * `ProtectedError` trên `Sub` (`don_rac_e2e` chỉ ẨN mạch, không xoá hàng nào) — đã sửa ở
 * `seed_e2e._xoa`, bài đo ở `api/tests/test_seed_e2e.py`.
 *
 * Serial và tự dọn ở cả `beforeAll`: một lần chạy trước bị ngắt giữa chừng không được để tác
 * giả tạm ở lại làm các bài đo đếm tác giả của file khác sai. */
const TIEN_TO_TAC_GIA_TAM = "e2e_nk_lap_";
const MIEN_EMAIL_TAM = "@gikky.test";
const TAC_GIA_LAP = `${TIEN_TO_TAC_GIA_TAM}tac_gia`;
const TAC_GIA_BUMP = `${TIEN_TO_TAC_GIA_TAM}bump`;
const TAC_GIA_BOT = `${TIEN_TO_TAC_GIA_TAM}bot`;
const TAC_GIA_THAT = `${TIEN_TO_TAC_GIA_TAM}nguoi_that`;
const SO_TAC_GIA_PHU = 9;
const SO_BAI_BOT = 55;
const TIEU_DE_NK = "Nhật ký tạm của bộ e2e";

test.describe.serial("U — Nhật ký mới: mỗi tác giả MỘT thẻ, đúng bài mới nhất", () => {
  const ten = (s: string) => JSON.stringify(s);
  const loc = `author__username__startswith=${ten(TIEN_TO_TAC_GIA_TAM)}`;
  const don = () =>
    py(
      "from core.models import Mach, User; " +
        `Mach.objects.filter(${loc}).delete(); ` +
        `User.objects.filter(username__startswith=${ten(TIEN_TO_TAC_GIA_TAM)}).delete()`,
    );

  test.beforeAll(() => {
    don();
    py(
      [
        "from datetime import timedelta",
        "from django.contrib.auth.hashers import make_password",
        "from django.utils import timezone",
        "from core.ghi import tao_mach, them_moc",
        "from core.models import Mach, Sub, User",
        "sub = Sub.objects.get(slug='e2e-thu-nghiem')",
        "def tac_gia(t):",
        `    return User.objects.create(username=t, email=t + ${ten(MIEN_EMAIL_TAM)},`,
        "        password=make_password('seed-dev-khong-dung-that'), display_name='E2E ' + t)",
        "def dang(u, tieu_de, **kw):",
        "    return tao_mach(sub=sub, author=u, title=tieu_de, body='Nhật ký tạm của bộ e2e.',",
        "        occurred_at=None, loai=None, loai_mach=Mach.LoaiMach.NHAT_KY, **kw)[0]",
        `for i in range(1, ${SO_TAC_GIA_PHU} + 1):`,
        `    dang(tac_gia(${ten(TIEN_TO_TAC_GIA_TAM + "phu_")} + str(i)), ${ten(TIEU_DE_NK + " — phụ ")} + str(i))`,
        // V2: người thật (cũ hơn) rồi 55 bài của bot (mới hơn).
        `dang(tac_gia(${ten(TAC_GIA_THAT)}), ${ten(TIEU_DE_NK + " — người thật")})`,
        `bot = tac_gia(${ten(TAC_GIA_BOT)})`,
        `for i in range(${SO_BAI_BOT}):`,
        `    dang(bot, ${ten(TIEU_DE_NK + " — bot ")} + str(i))`,
        // V1: X đăng 90 ngày trước rồi được nối mốc (last_content_at nhảy lên), Y đăng sau.
        `bump = tac_gia(${ten(TAC_GIA_BUMP)})`,
        `x = dang(bump, ${ten(TIEU_DE_NK + " — X cũ 90 ngày")}, _created_at_seed=timezone.now() - timedelta(days=90))`,
        `y = dang(bump, ${ten(TIEU_DE_NK + " — Y mới")})`,
        "them_moc(mach=x, author=bump, body='Cập nhật X ' + 'đủ dài để qua cổng chất lượng. ' * 3)",
        `lap = tac_gia(${ten(TAC_GIA_LAP)})`,
        "for i in (1, 2, 3):",
        `    dang(lap, ${ten(TIEU_DE_NK + " — bài ")} + str(i))`,
        "",
      ].join("\n"),
    );
  });
  test.afterAll(() => {
    don();
    expect(
      Number(
        dongCuoi(
          py(
            "from core.models import Mach, User; " +
              `print(Mach.objects.filter(${loc}).count() + ` +
              `User.objects.filter(username__startswith=${ten(TIEN_TO_TAC_GIA_TAM)}).count())`,
          ),
        ),
      ),
      "đã xoá sạch nhật ký và tác giả tạm",
    ).toBe(0);
  });

  const theoTieuDe = (items: MachTomTatOut[], hau_to: string) => {
    const m = items.find((x) => x.title === `${TIEU_DE_NK} — ${hau_to}`);
    expect(m, `phải có mạch "${hau_to}"`).toBeDefined();
    return m!;
  };

  /** Dựng sẵn mọi đối tượng của các ca, kèm TIỀN ĐIỀU KIỆN chống rỗng của V1 và V2. */
  async function dungCa() {
    const cu = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=nhat_ky&limit=50");
    const moi = await api<FeedOut>(URL_NHAT_KY_MOI_TAC_GIA);
    const lap = cu.items.filter((m) => m.author.username === TAC_GIA_LAP);
    expect(lap, "tiền điều kiện: ba nhật ký của tác giả lặp nằm trong 50 bài đầu").toHaveLength(3);
    expect(lap[0].title, "API trả bài MỚI nhất của tác giả lặp trước").toContain("bài 3");

    const x = theoTieuDe(cu.items, "X cũ 90 ngày");
    const y = theoTieuDe(cu.items, "Y mới");
    // V1: feed cũ xếp X (đã bump) TRƯỚC Y ⇒ bản lọc-ở-web sẽ chọn X.
    const id_cu = cu.items.map((m) => m.id);
    expect(id_cu.indexOf(x.id), "tiền điều kiện V1: feed cũ xếp bài bị bump lên trước").toBeLessThan(
      id_cu.indexOf(y.id),
    );
    // V2: cửa sổ 50 đã đầy và người thật văng ra khỏi nó.
    expect(cu.items, "tiền điều kiện V2: cửa sổ 50 bài đã đầy").toHaveLength(50);
    expect(
      cu.items.some((m) => m.author.username === TAC_GIA_THAT),
      "tiền điều kiện V2: người thật KHÔNG còn trong 50 bài đầu của feed cũ",
    ).toBe(false);
    return { cu, moi, lap, x, y };
  }

  test("U1/U2/V1/V2 — `/` vẽ đúng thứ endpoint trả: một thẻ mỗi tác giả, bài MỚI ĐĂNG (không phải bài bị bump), còn người thật dưới bot đăng dồn", async ({
    page,
  }) => {
    const { moi, lap, x, y } = await dungCa();
    await page.goto("/");
    const ids = await idsTrenTrang(page, "the-mach");

    expect(ids, "đúng thứ `GET /feeds/nhat-ky-moi-tac-gia` trả").toEqual(moi.items.map((m) => m.id));
    expect(ids, "trần 8 tính theo TÁC GIẢ").toHaveLength(TRAN_NHAT_KY);
    const tac_gia_cua = new Map(moi.items.map((m) => [m.id, m.author.username]));
    const tg = ids.map((id) => tac_gia_cua.get(id));
    expect(new Set(tg).size, `tác giả bị lặp: ${JSON.stringify(tg)}`).toBe(ids.length);
    const khi = moi.items.map((m) => m.published_at);
    expect(khi, "thứ tự published_at giảm dần").toEqual([...khi].sort().reverse());

    // U2: tác giả lặp — MỘT thẻ, bài mới nhất, đứng đầu khối.
    expect(ids.filter((id) => lap.some((m) => m.id === id))).toEqual([lap[0].id]);
    expect(ids[0]).toBe(lap[0].id);
    // V1: tác giả bump — thẻ là Y (mới đăng), không phải X (cũ 90 ngày, vừa được nối mốc).
    expect(ids).toContain(y.id);
    expect(ids).not.toContain(x.id);
    // V2: bot đăng dồn 55 bài vẫn chỉ có MỘT thẻ, và người thật còn mặt.
    expect(tg.filter((u) => u === TAC_GIA_BOT)).toHaveLength(1);
    expect(tg, "người thật không biến mất dưới bot đăng dồn").toContain(TAC_GIA_THAT);
  });

  test("U1 — HTML thô (bot): chỉ link của bài mới nhất; bài cũ hơn của cùng tác giả, bài bị bump và các bài bot cũ không có trong trang", async ({
    request,
  }) => {
    const { cu, moi, lap, x, y } = await dungCa();
    const html = await (await request.get("/")).text();
    const link = (m: { slug: string; id: number }) => `href="/m/${m.slug}-${m.id}"`;
    expect(html, "bài mới nhất có link trong HTML thô").toContain(link(lap[0]));
    expect(html, "bài cũ hơn bị lọc").not.toContain(link(lap[1]));
    expect(html, "bài cũ nhất bị lọc").not.toContain(link(lap[2]));
    expect(html, "bài mới đăng của tác giả bump có link").toContain(link(y));
    expect(html, "bài bị bump không có link").not.toContain(link(x));
    // Bot: đúng MỘT bài của họ có link (bài endpoint chọn), 49 bài bot trong cửa sổ cũ thì không.
    const bot = cu.items.filter((m) => m.author.username === TAC_GIA_BOT);
    expect(bot.length, "chống rỗng: bot có nhiều bài trong cửa sổ").toBeGreaterThan(10);
    expect(bot.filter((m) => html.includes(link(m))).map((m) => m.id)).toEqual(
      moi.items.filter((m) => m.author.username === TAC_GIA_BOT).map((m) => m.id),
    );
  });

  test("U3 — 'Xem tất cả nhật ký →' vẫn trỏ feed KHÔNG lọc, ở đó cả ba bài của tác giả lặp đều có", async ({
    page,
  }) => {
    const { lap } = await dungCa();
    await page.goto("/");
    await expect(page.getByTestId("nhat-ky-tat-ca")).toHaveAttribute(
      "href",
      "/?tab=moi&loai_mach=nhat_ky",
    );
    await page.getByTestId("nhat-ky-tat-ca").click();
    await page.waitForURL("**/?tab=moi&loai_mach=nhat_ky");
    const ids = await idsTrenTrang(page, "the-mach");
    const trang1 = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=nhat_ky&limit=20");
    expect(ids, "feed cũ nguyên văn: không lọc").toEqual(trang1.items.map((m) => m.id));
    for (const m of lap) expect(ids, `thiếu bài ${m.id} ở feed không lọc`).toContain(m.id);
  });

  test("N1 — tài khoản tạm mang đúng miền email mà `don_rac_e2e` dọn (`MIEN_E2E`)", () => {
    const ra = py(
      "from core.management.commands.don_rac_e2e import MIEN_E2E; from core.models import User; " +
        `qs = User.objects.filter(username__startswith=${ten(TIEN_TO_TAC_GIA_TAM)}); ` +
        "print(qs.count(), qs.filter(email__endswith=MIEN_E2E).count(), MIEN_E2E)",
    );
    const [tong, dung_mien, mien] = dongCuoi(ra).split(" ");
    expect(mien).toBe(MIEN_EMAIL_TAM);
    expect(Number(tong), "chống rỗng: có đủ tài khoản tạm").toBe(SO_TAC_GIA_PHU + 4);
    expect(Number(dung_mien), "MỌI tài khoản tạm đúng miền được dọn").toBe(Number(tong));
  });
});
