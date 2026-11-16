import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { AnhOut, FeedOut, MachTomTatOut } from "@gikky/api-client";
import { expect, test, type Locator, type Page } from "@playwright/test";

/** Hàng "Bài viết" của trang chủ có xem trước THEO ẢNH — plan
 * `plans/2026-11-10-bai-viet-xem-truoc-anh.md` (tiêu chí B1–B8, S3) và, cho phần nhiều ảnh,
 * `plans/2026-11-10-gallery-kieu-reddit.md` (tiêu chí R1–R11). Chạy trên BẢN BUILD thật.
 *
 * Nhiều ảnh ⇒ MỘT khung gallery lật từng ảnh kiểu Reddit (tối đa 10 ảnh; dư thì slide cuối
 * "Xem tất cả N ảnh →") · một ảnh ⇒ một thumb · không ảnh ⇒ `SO_DONG_TRICH` (3) dòng chữ.
 *
 * Dữ liệu là của `seed_e2e` (`SO_ANH_BAI_VIET_MOI`: 10 bài viết mới nhất có 0/1/2/3/5/1/3/2/12/0
 * ảnh, có file thumb trên đĩa; hàng 12 ảnh là ảnh NHÚNG trong body vì gallery `MocAnh` chỉ
 * chứa tối đa 10). Nguồn sự thật kỳ vọng là **API** (`GET /feeds/moi?loai_mach=bai_viet`),
 * không phải HTML mình vừa render. Mỗi bài đo có một vế "tập dữ liệu không rỗng" để không xanh
 * giả khi seed mất ảnh.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";
const GOC = resolve(__dirname, "..", "..", "..");
const SO_BAI_VIET = 10;
/** = `SO_ANH_XEM_TRUOC` của API (bài don-vi `xem-truoc-anh.spec.ts` ép hai hằng bằng nhau). */
const SO_ANH_GALLERY_TOI_DA = 10;
/** Trần chiều cao khung gallery (`max-height` ở `gallery-bai-viet.module.css`). */
const CAO_TOI_DA = 360;

async function layFeed(): Promise<MachTomTatOut[]> {
  const r = await fetch(`${API}/api/v1/feeds/moi?loai_mach=bai_viet&limit=${SO_BAI_VIET}`);
  if (!r.ok) throw new Error(`feed bài viết → HTTP ${r.status}`);
  return ((await r.json()) as FeedOut).items;
}

/** Ảnh mà hàng PHẢI vẽ, theo đúng hợp đồng API (`anh` + `anh_khac`, tối đa 10). */
const anhCanCo = (m: MachTomTatOut): AnhOut[] =>
  m.xem_truoc?.anh == null
    ? []
    : [m.xem_truoc.anh, ...(m.xem_truoc.anh_khac ?? [])].slice(0, SO_ANH_GALLERY_TOI_DA);

const soAnh = (m: MachTomTatOut) => m.xem_truoc?.so_anh ?? 0;
const hang = (page: Page, id: number) =>
  page.locator(`[data-testid="bai-viet-hang"][data-mach-id="${id}"]`);
const khungCua = (page: Page, id: number) => hang(page, id).getByTestId("bai-viet-gallery");
const demCua = (khung: Locator) => khung.getByTestId("bai-viet-gallery-dem");
const nutTruoc = (khung: Locator) => khung.getByRole("button", { name: "Ảnh trước" });
const nutSau = (khung: Locator) => khung.getByRole("button", { name: "Ảnh sau" });

/** `src` của `<img>` so với `url_thumb` của API: bỏ origin nếu có. */
const duongDan = (u: string) => new URL(u, "http://x").pathname;

/** Vị trí cuộn của track gallery + bề rộng một slide. */
const doTrack = (khung: Locator) =>
  khung.getByTestId("bai-viet-gallery-track").evaluate((e) => ({
    trai: e.scrollLeft,
    rong: e.clientWidth,
    tong: e.scrollWidth,
  }));

/** Đợi track dừng đúng ở slide thứ `i` (cuộn mượt mất vài trăm ms). */
async function denSlide(khung: Locator, i: number) {
  await expect
    .poll(async () => {
      const t = await doTrack(khung);
      return Math.abs(t.trai - i * t.rong) < 2;
    }, { message: `track chưa dừng ở slide ${i}`, timeout: 5000 })
    .toBe(true);
}

/** Cuộn track tức thì tới slide `i` (mô phỏng vuốt: sự kiện `scroll` thật vẫn bắn). */
const cuonToi = (khung: Locator, i: number) =>
  khung.getByTestId("bai-viet-gallery-track").evaluate((e, k) => {
    e.scrollLeft = k * e.clientWidth;
  }, i);

/* ---- File thumb tạm ẩn (B8 / R10) ------------------------------------------------------
 *
 * B8 / R10 đổi tên một thumb thật trong `api/media` để ép ảnh 404. Bản đầu đổi tên NGOÀI `try`:
 * một timeout giữa chừng bỏ lại `*.bvxt-tam` và mọi bài đo sau đó (R6, R6c, B7, B5…) đỏ giả vì
 * thiếu ảnh. Nay đổi tên + khôi phục nằm trong MỘT hàm `voiFileTamAn` (try/finally), và một lưới
 * an toàn quét + trả lại MỌI `*.bvxt-tam` còn sót — chạy trước cả file và sau mỗi bài B8. */
const HAU_TO_TAM = ".bvxt-tam";
const thuMucMedia = () => process.env.MEDIA_ROOT ?? resolve(GOC, "api", "media");

/** Đổi `file` → `file.bvxt-tam`, chạy `fn`, và LUÔN trả lại tên cũ — kể cả khi `fn` ném lỗi. */
async function voiFileTamAn<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const tam = file + HAU_TO_TAM;
  try {
    renameSync(file, tam);
    return await fn();
  } finally {
    if (existsSync(tam)) renameSync(tam, file);
  }
}

/** Lưới an toàn: trả lại tên mọi `*.bvxt-tam` dưới `goc` (đệ quy). Đã có tên gốc thì xoá bản tạm.
 * Trả số file đã xử lý; không có `goc` thì bỏ qua. */
function khoiPhucFileTam(goc: string): number {
  if (!existsSync(goc)) return 0;
  let n = 0;
  for (const e of readdirSync(goc, { withFileTypes: true })) {
    const duong = join(goc, e.name);
    if (e.isDirectory()) n += khoiPhucFileTam(duong);
    else if (e.name.endsWith(HAU_TO_TAM)) {
      const dich = duong.slice(0, -HAU_TO_TAM.length);
      if (existsSync(dich)) rmSync(duong);
      else renameSync(duong, dich);
      n++;
    }
  }
  return n;
}

const quetMedia = () => {
  for (const t of ["anh-thumb", "anh"]) khoiPhucFileTam(join(thuMucMedia(), t));
};
test.beforeAll(quetMedia);

test.describe("B — hàng bài viết xem trước theo ảnh (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("seed đủ cả ba nhánh và ca vượt trần — chống bài đo rỗng", async () => {
    const feed = await layFeed();
    const so = feed.map(soAnh);
    expect(feed).toHaveLength(SO_BAI_VIET);
    expect(so.some((n) => n === 0), `không có hàng 0 ảnh: ${so}`).toBe(true);
    expect(so.some((n) => n === 1), `không có hàng 1 ảnh: ${so}`).toBe(true);
    expect(so.some((n) => n === 2), `không có hàng 2 ảnh: ${so}`).toBe(true);
    expect(so.some((n) => n === 3), `không có hàng 3 ảnh: ${so}`).toBe(true);
    expect(so.some((n) => n === 5), `không có hàng 5 ảnh: ${so}`).toBe(true);
    expect(
      so.some((n) => n > SO_ANH_GALLERY_TOI_DA),
      `không có hàng vượt ${SO_ANH_GALLERY_TOI_DA} ảnh: ${so}`,
    ).toBe(true);
    expect(so.filter((n) => n >= 1).length, "cần ≥ 6 hàng có ảnh để đo CLS").toBeGreaterThanOrEqual(6);
  });

  test("B1 — hàng 0 ảnh: có trích (kẹp 3 dòng), KHÔNG có <img>", async ({ page }) => {
    const feed = await layFeed();
    const khong_anh = feed.filter((m) => soAnh(m) === 0 && m.xem_truoc?.trich);
    expect(khong_anh.length, "tiền đề: seed có hàng 0 ảnh").toBeGreaterThan(0);
    await page.goto("/");
    for (const m of khong_anh) {
      const h = hang(page, m.id);
      await expect(h.locator("img"), `mạch ${m.id}`).toHaveCount(0);
      const trich = h.getByTestId("bai-viet-trich");
      await expect(trich, `mạch ${m.id}`).toHaveCount(1);
      await expect(trich).toHaveText(m.xem_truoc!.trich);
      const kep = await trich.evaluate((e) => {
        const cs = getComputedStyle(e);
        return {
          dong: cs.getPropertyValue("-webkit-line-clamp"),
          cao: e.getBoundingClientRect().height,
          dong_cao: parseFloat(cs.lineHeight),
        };
      });
      expect(kep.dong, "line-clamp = 3").toBe("3");
      expect(kep.cao, "không quá 3 dòng").toBeLessThanOrEqual(kep.dong_cao * 3 + 1);
    }
  });

  test("B2 — hàng 1 ảnh: đúng 1 <img> có width/height/lazy/alt + 1 dòng chữ, KHÔNG gallery", async ({
    page,
  }) => {
    const feed = await layFeed();
    const mot = feed.filter((m) => soAnh(m) === 1);
    expect(mot.length, "tiền đề: seed có hàng 1 ảnh").toBeGreaterThan(0);
    await page.goto("/");
    for (const m of mot) {
      const h = hang(page, m.id);
      const img = h.locator("img");
      await expect(img, `mạch ${m.id}`).toHaveCount(1);
      await expect(img).toHaveAttribute("width", /^\d+$/);
      await expect(img).toHaveAttribute("height", /^\d+$/);
      await expect(img).toHaveAttribute("loading", "lazy");
      await expect(img).toHaveAttribute("alt", `Ảnh minh họa: ${m.title}`);
      // Đổi so với bản thumb ba-cạnh-nhau: không còn "+N", và 1 ảnh KHÔNG được vào gallery.
      await expect(h.getByTestId("bai-viet-gallery")).toHaveCount(0);
      await expect(h.getByRole("button")).toHaveCount(0);
      const trich = h.getByTestId("bai-viet-trich");
      await expect(trich).toHaveCount(1);
      expect(await trich.evaluate((e) => getComputedStyle(e).getPropertyValue("-webkit-line-clamp"))).toBe("1");
      // "Không ép ngang": thumb 200px cao, KHÔNG kéo hết hàng rộng ~700px.
      const o = await img.locator("xpath=..").boundingBox();
      const hang_box = await h.boundingBox();
      expect(o!.width, "thumb đơn không được kéo hết hàng").toBeLessThan(hang_box!.width * 0.7);
      expect(o!.height).toBeLessThanOrEqual(201);
    }
  });

  test("R1 — hàng 2 / 3 / 5 / 12 ảnh: đúng MỘT khung, MỘT slide chiếm ≥ 90% bề rộng, đủ slide, không ba thumb cạnh nhau", async ({
    page,
  }) => {
    const feed = await layFeed();
    await page.goto("/");
    const da_do = new Set<number>();
    for (const m of feed) {
      const so = soAnh(m);
      if (so < 2) continue;
      const h = hang(page, m.id);
      await expect(h.getByTestId("bai-viet-gallery"), `mạch ${m.id} (${so} ảnh)`).toHaveCount(1);
      const khung = khungCua(page, m.id);
      await expect(khung.getByTestId("bai-viet-gallery-slide")).toHaveCount(
        Math.min(so, SO_ANH_GALLERY_TOI_DA),
      );
      await expect(khung).toHaveAttribute("data-so-anh", String(so));
      da_do.add(so);

      const hinh = await khung.evaluate((e) => {
        const t = e.querySelector('[data-testid="bai-viet-gallery-track"]')!.getBoundingClientRect();
        const slide = [...e.querySelectorAll("li")].map((li) => {
          const r = li.getBoundingClientRect();
          const chong = Math.max(0, Math.min(r.right, t.right) - Math.max(r.left, t.left));
          return chong / t.width;
        });
        const cha = e.parentElement!.getBoundingClientRect();
        return { slide, khung: e.getBoundingClientRect().width, cha: cha.width };
      });
      expect(
        hinh.slide.filter((x) => x >= 0.9),
        `mạch ${m.id}: đúng một slide ≥ 90% bề rộng ${JSON.stringify(hinh.slide)}`,
      ).toHaveLength(1);
      expect(hinh.slide[0], "slide đầu là slide đang hiện").toBeGreaterThanOrEqual(0.9);
      expect(
        hinh.slide.slice(1).every((x) => x < 0.01),
        `mạch ${m.id}: các slide còn lại nằm ngoài khung ${JSON.stringify(hinh.slide)}`,
      ).toBe(true);
      expect(hinh.khung, `mạch ${m.id}: khung phủ cả bề rộng cột nội dung`).toBeGreaterThanOrEqual(
        hinh.cha * 0.99,
      );
    }
    for (const n of [2, 3, 5]) expect(da_do.has(n), `seed thiếu hàng ${n} ảnh`).toBe(true);
    expect([...da_do].some((n) => n > SO_ANH_GALLERY_TOI_DA), "seed thiếu hàng vượt trần").toBe(true);
  });

  test("R1b — từng <img> của từng hàng đúng url_thumb + đúng thứ tự của API", async ({ page }) => {
    const feed = await layFeed();
    await page.goto("/");
    let tong = 0;
    for (const m of feed) {
      const can = anhCanCo(m).map((a) => duongDan(a.url_thumb));
      const co = (
        await hang(page, m.id)
          .locator("img")
          .evaluateAll((es) => es.map((e) => e.getAttribute("src") ?? ""))
      ).map(duongDan);
      expect(co, `mạch ${m.id}`).toEqual(can);
      tong += co.length;
    }
    expect(tong, "tập đối chiếu không rỗng").toBeGreaterThan(20);
  });

  test("R4 — bấm vào ảnh (không phải nút) mở đúng bài, kể cả ảnh thứ hai sau khi lật", async ({
    page,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) >= 2 && soAnh(x) <= SO_ANH_GALLERY_TOI_DA)!;
    expect(m, "tiền đề: có hàng gallery").toBeTruthy();
    await page.goto("/");
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();
    await khung.locator("img").first().click();
    await expect(page).toHaveURL(new RegExp(`/m/${m.slug}-${m.id}$`));

    await page.goto("/");
    const k2 = khungCua(page, m.id);
    await k2.scrollIntoViewIfNeeded();
    await k2.hover();
    await nutSau(k2).click();
    await denSlide(k2, 1);
    await expect(page, "bấm nút lật không được điều hướng").toHaveURL(/\/$/);
    await k2.locator("img").nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/m/${m.slug}-${m.id}$`));
  });

  test("R4b — hàng có gallery: bấm đoạn trích mở bài; bấm s/<sub> mở sub (khung nằm trên lớp phủ, không nuốt chữ bên dưới)", async ({
    page,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) >= 2 && x.xem_truoc?.trich)!;
    expect(m, "tiền đề: hàng gallery có trích").toBeTruthy();
    await page.goto("/");
    const trich = hang(page, m.id).getByTestId("bai-viet-trich");
    await trich.scrollIntoViewIfNeeded();
    const b = (await trich.boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page).toHaveURL(new RegExp(`/m/${m.slug}-${m.id}$`));

    await page.goto("/");
    await hang(page, m.id).getByRole("link", { name: `s/${m.sub.slug}` }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${m.sub.slug}$`));
  });

  test("R2 — nút Ảnh sau / Ảnh trước: cuộn đúng một slide, bộ đếm đổi, ẩn ở hai đầu, KHÔNG điều hướng", async ({
    page,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 5)!;
    expect(m, "tiền đề: seed có hàng 5 ảnh").toBeTruthy();
    await page.goto("/");
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();
    await khung.hover();
    const url = page.url();

    await expect(demCua(khung)).toHaveText("1/5");
    await expect(nutTruoc(khung), "ảnh đầu: không có nút trước").toBeHidden();
    await expect(nutSau(khung)).toBeVisible();

    await nutSau(khung).click();
    await denSlide(khung, 1);
    await expect(demCua(khung)).toHaveText("2/5");
    const t = await doTrack(khung);
    expect(Math.round(t.trai), "tăng đúng một slide").toBe(Math.round(t.rong));
    await expect(nutTruoc(khung)).toBeVisible();
    expect(page.url(), "bấm nút không điều hướng").toBe(url);

    await nutTruoc(khung).click();
    await denSlide(khung, 0);
    await expect(demCua(khung)).toHaveText("1/5");
    await expect(nutTruoc(khung)).toBeHidden();

    for (let i = 1; i <= 4; i++) {
      await nutSau(khung).click();
      await denSlide(khung, i);
      await expect(demCua(khung)).toHaveText(`${i + 1}/5`);
    }
    await expect(nutSau(khung), "ảnh cuối: không có nút sau").toBeHidden();
    await expect(nutTruoc(khung)).toBeVisible();
    expect(page.url()).toBe(url);
  });

  test("R7 — nút bấm được bằng bàn phím (Enter, Space); có nhãn; bộ đếm là vùng aria-live; focus không rơi khi nút ẩn", async ({
    page,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 3)!;
    expect(m, "tiền đề: seed có hàng 3 ảnh").toBeTruthy();
    await page.goto("/");
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();

    await expect(khung).toHaveAttribute("role", "group");
    await expect(khung).toHaveAttribute("aria-roledescription", "carousel");
    await expect(khung).toHaveAttribute("aria-label", `Ảnh của bài: ${m.title}`);
    const live = khung.locator('[aria-live="polite"]');
    await expect(live).toHaveCount(1);
    await expect(live).toContainText("Ảnh 1 trên 3");

    // Chỉ bàn phím: Tab vào nút sau (nút trước đang hidden nên không có trong thứ tự Tab).
    await nutSau(khung).focus();
    await expect(nutSau(khung)).toBeFocused();
    await page.keyboard.press("Enter");
    await denSlide(khung, 1);
    await expect(demCua(khung)).toHaveText("2/3");
    await expect(live).toContainText("Ảnh 2 trên 3");
    await page.keyboard.press("Space");
    await denSlide(khung, 2);
    await expect(demCua(khung)).toHaveText("3/3");
    // Tới cuối: nút sau ẩn ⇒ focus phải chuyển sang nút trước, không rơi về <body>.
    await expect(nutSau(khung)).toBeHidden();
    await expect(nutTruoc(khung)).toBeFocused();
    await page.keyboard.press("Enter");
    await denSlide(khung, 1);
    await expect(demCua(khung)).toHaveText("2/3");

    // Cây accessibility: nhóm carousel có tên, hai nút có nhãn, ảnh KHÔNG lộ thêm link nào.
    const cay = await khung.ariaSnapshot();
    expect(cay).toContain('button "Ảnh trước"');
    expect(cay).toContain('button "Ảnh sau"');
    expect(cay).not.toMatch(/- '?link/);
  });

  test("R2c — giảm chuyển động ⇒ cuộn tức thì; bình thường ⇒ cuộn mượt", async ({ page }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 5)!;
    await page.goto("/");
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();
    await khung.hover();
    // Bấm bằng DOM `click()` rồi đọc `scrollLeft` NGAY trong cùng một tác vụ: cuộn tức thì đã
    // xong, cuộn mượt thì chưa nhích tới đích.
    const doNgay = () =>
      khung.evaluate((e) => {
        const track = e.querySelector('[data-testid="bai-viet-gallery-track"]') as HTMLElement;
        const sau = [...e.querySelectorAll("button")].find(
          (b) => b.getAttribute("aria-label") === "Ảnh sau",
        ) as HTMLButtonElement;
        const truoc = track.scrollLeft;
        sau.click();
        return { truoc, ngay: track.scrollLeft, rong: track.clientWidth };
      });

    const muot = await doNgay();
    expect(muot.ngay, "cuộn mượt: chưa tới đích ngay").toBeLessThan(muot.rong - 1);
    await denSlide(khung, 1);

    await page.emulateMedia({ reducedMotion: "reduce" });
    const tucThi = await doNgay();
    expect(Math.round(tucThi.ngay), "giảm chuyển động: tới đích ngay").toBe(
      Math.round(tucThi.truoc + tucThi.rong),
    );
  });

  test("R3 — cuộn ngang (mô phỏng vuốt) cập nhật bộ đếm và nút; không cần bấm nút", async ({
    page,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 5)!;
    await page.goto("/");
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();
    await khung.hover();
    await expect(demCua(khung)).toHaveText("1/5");

    await cuonToi(khung, 2);
    await expect(demCua(khung)).toHaveText("3/5");
    await expect(nutTruoc(khung)).toBeVisible();
    await expect(nutSau(khung)).toBeVisible();
    await cuonToi(khung, 4);
    await expect(demCua(khung)).toHaveText("5/5");
    await expect(nutSau(khung)).toBeHidden();
    await cuonToi(khung, 0);
    await expect(demCua(khung)).toHaveText("1/5");
    await expect(nutTruoc(khung)).toBeHidden();
    // Hết đoạn mượt rồi bấm tiếp từ vị trí vừa cuộn: nút đi theo vị trí thật chứ không theo state cũ.
    await cuonToi(khung, 3);
    await expect(demCua(khung)).toHaveText("4/5");
    await nutSau(khung).click();
    await denSlide(khung, 4);
    await expect(demCua(khung)).toHaveText("5/5");
  });

  test("R5 — hàng vượt trần: slide cuối 'Xem tất cả N ảnh →' là link thật tới bài, bộ đếm ẩn ở đó; hàng 5 ảnh không có", async ({
    page,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) > SO_ANH_GALLERY_TOI_DA)!;
    const m5 = feed.find((x) => soAnh(x) === 5)!;
    expect(m, "tiền đề: seed có hàng vượt trần").toBeTruthy();
    const so = soAnh(m);
    await page.goto("/");
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();
    await khung.hover();

    await expect(khung.getByTestId("bai-viet-gallery-slide")).toHaveCount(SO_ANH_GALLERY_TOI_DA);
    const het = khung.getByTestId("bai-viet-gallery-xem-het").getByRole("link");
    await expect(het).toHaveCount(1);
    await expect(het).toHaveText(`Xem tất cả ${so} ảnh →`);
    await expect(het).toHaveAttribute("href", new RegExp(`/m/${m.slug}-${m.id}$`));
    await expect(het, "link thật: không aria-hidden").not.toHaveAttribute(
      "aria-hidden",
      /.*/,
    );
    // Chưa tới slide của nó thì ngoài thứ tự Tab (không kéo gallery nhảy tới cuối); vẫn là link thật.
    await expect(het).toHaveAttribute("tabindex", "-1");
    await expect(demCua(khung)).toHaveText(`1/${so}`);

    await cuonToi(khung, SO_ANH_GALLERY_TOI_DA - 1);
    await expect(demCua(khung)).toHaveText(`${SO_ANH_GALLERY_TOI_DA}/${so}`);
    await expect(nutSau(khung), "còn slide 'Xem tất cả' nên nút sau còn").toBeVisible();
    await nutSau(khung).click();
    await denSlide(khung, SO_ANH_GALLERY_TOI_DA);
    await expect(demCua(khung), "bộ đếm ẩn ở slide 'Xem tất cả'").toBeHidden();
    await expect(nutSau(khung)).toBeHidden();
    await expect(het).toBeVisible();
    await expect(het, "tới slide của nó thì vào thứ tự Tab").toHaveAttribute("tabindex", "0");
    await het.click();
    await expect(page).toHaveURL(new RegExp(`/m/${m.slug}-${m.id}$`));

    // Hàng 5 ảnh: đủ ảnh, không slide "Xem tất cả".
    await page.goto("/");
    await expect(khungCua(page, m5.id).getByTestId("bai-viet-gallery-xem-het")).toHaveCount(0);
    await expect(khungCua(page, m5.id).getByTestId("bai-viet-gallery-slide")).toHaveCount(5);
  });

  test("R10b — hàng vượt trần: trong HTML thô có đúng 10 <img> thumb + link 'Xem tất cả N ảnh' (bot thấy)", async ({
    request,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) > SO_ANH_GALLERY_TOI_DA)!;
    const html = await (await request.get("/")).text();
    const hang_html = new RegExp(
      `<li[^>]*data-mach-id="${m.id}"[\\s\\S]*?</li>\\s*(?=<li[^>]*data-testid="bai-viet-hang"|</ul>)`,
    ).exec(html)?.[0];
    expect(hang_html, "không cắt được hàng khỏi HTML thô").toBeTruthy();
    expect(hang_html!.match(/<img\b[^>]*\/media\/anh-thumb\//g) ?? []).toHaveLength(
      SO_ANH_GALLERY_TOI_DA,
    );
    expect(hang_html).toContain(`Xem tất cả ${soAnh(m)} ảnh →`);
  });

  test("B6 — mọi <img> của khối đều lazy + decoding async lúc mới tải; số <img> đúng bằng tổng ảnh API trả", async ({
    page,
  }) => {
    const feed = await layFeed();
    const can = feed.reduce((n, m) => n + anhCanCo(m).length, 0);
    await page.goto("/");
    const r = await page
      .getByTestId("khoi-bai-viet")
      .locator("img")
      .evaluateAll((es) => ({
        n: es.length,
        khong_lazy: es.filter((e) => e.getAttribute("loading") !== "lazy").length,
        khong_decoding: es.filter((e) => e.getAttribute("decoding") !== "async").length,
      }));
    expect(r.n, "có ảnh để đo").toBeGreaterThan(20);
    expect(r.n, "mọi ảnh API trả đều có <img> (không cắt thêm ở web)").toBe(can);
    expect(r.khong_lazy).toBe(0);
    expect(r.khong_decoding).toBe(0);
  });

  test("R6c — lần rê đầu vào khung: mọi <img> CỦA KHUNG ấy thành eager và nạp xong; khung khác vẫn lazy", async ({
    page,
  }) => {
    const feed = await layFeed();
    const [a, b] = feed.filter((x) => soAnh(x) >= 3 && soAnh(x) <= SO_ANH_GALLERY_TOI_DA);
    expect(b, "tiền đề: ≥ 2 hàng gallery ≥ 3 ảnh").toBeTruthy();
    await page.goto("/");
    const ka = khungCua(page, a.id);
    const kb = khungCua(page, b.id);
    const trangThai = (k: Locator) =>
      k.locator("img").evaluateAll((es) => ({
        loading: es.map((e) => e.getAttribute("loading")),
        nap: es.map((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0),
      }));
    expect((await trangThai(ka)).loading.every((l) => l === "lazy")).toBe(true);
    await ka.scrollIntoViewIfNeeded();
    await ka.hover();
    await expect
      .poll(async () => (await trangThai(ka)).nap.every(Boolean), { timeout: 8000 })
      .toBe(true);
    expect((await trangThai(ka)).loading.every((l) => l === "eager")).toBe(true);
    expect((await trangThai(kb)).loading.every((l) => l === "lazy"), "khung khác không bị nạp sớm lây").toBe(true);
  });

  test("B5 — dịch bố cục (CLS) của khối bài viết ≤ 0,01 khi cuộn hết trang", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: { tong: number; khoi: number } };
      w.__cls = { tong: 0, khoi: 0 };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
          sources?: { node?: Node | null }[];
        }[]) {
          if (e.hadRecentInput) continue;
          w.__cls.tong += e.value;
          const trong = (e.sources ?? []).some((s) => {
            const n = s.node;
            const el = n && n.nodeType === 1 ? (n as Element) : (n?.parentElement ?? null);
            return !!el?.closest('[data-testid="khoi-bai-viet"]');
          });
          if (trong) w.__cls.khoi += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    const cao = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= cao; y += 350) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(120);
    }
    // Đợi mọi ảnh NHÌN THẤY ĐƯỢC của khối nạp xong (thumb đơn + slide đầu của mỗi gallery);
    // slide 2.. nằm ngoài khung ngang và lazy nên không được tính là "đang hiện".
    const hien = '[data-testid="bai-viet-mot-anh"] img, [data-testid="bai-viet-gallery-slide"]:first-child img';
    await page.waitForFunction(
      (sel) =>
        [...document.querySelectorAll(sel)].every((i) => (i as HTMLImageElement).complete),
      hien,
    );
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => (window as unknown as { __cls: { tong: number; khoi: number } }).__cls);
    const nap_that = await page
      .getByTestId("khoi-bai-viet")
      .locator(hien)
      .evaluateAll((es) => es.filter((e) => (e as HTMLImageElement).naturalWidth > 0).length);
    expect(nap_that, "ảnh phải nạp THẬT (không phải ảnh vỡ) thì CLS mới có nghĩa").toBeGreaterThan(6);
    expect(r.khoi, `CLS riêng khối bài viết (tổng cả trang ${r.tong})`).toBeLessThanOrEqual(0.01);
  });

  test("R6 — khung giữ chỗ: cao > 0 và đúng tỉ lệ ảnh đầu (kẹp [1 ; 16/9], trần 360px) TRƯỚC khi ảnh nạp; chiều cao hàng / khối không đổi khi ảnh nạp xong", async ({
    page,
  }) => {
    // B5 (PerformanceObserver) chỉ tính dịch chuyển của phần tử đang NẰM TRONG khung nhìn, nên
    // bỏ `aspect-ratio` đi B5 vẫn xanh (đã thử phá ở vòng trước). Bài này đo THẲNG điều B5 muốn
    // bảo vệ: giữ ảnh lại ở tầng mạng, đo khi ảnh CHƯA có, thả ra, đo lại khi ảnh ĐÃ có.
    //
    // ⚠ "Hai số bằng nhau" một mình là bài đo MÙ: ảnh nằm `position: absolute` / trong track
    // tuyệt đối nên chiều cao hàng không bao giờ phụ thuộc ảnh — bỏ `aspect-ratio` thì khung
    // sụp về cao 0 CẢ TRƯỚC LẪN SAU, hai số vẫn bằng nhau. Nên bài đo khẳng định thêm: khi ảnh
    // CHƯA nạp, khung cao > 0 và đúng tỉ lệ của API (min(rộng / tỉ lệ, 360)).
    const feed = await layFeed();
    let tha!: () => void;
    const cho = new Promise<void>((r) => (tha = r));
    await page.route("**/media/anh-thumb/**", async (route) => {
      await cho;
      await route.continue();
    });
    await page.goto("/");
    // Ép mọi ảnh của khối yêu cầu NGAY (chúng đang bị giữ), để "chưa có ảnh" là có thật.
    await page.evaluate(() =>
      document
        .querySelectorAll<HTMLImageElement>('[data-testid="khoi-bai-viet"] img')
        .forEach((i) => (i.loading = "eager")),
    );
    const do_cao = () =>
      page.evaluate(() => ({
        khoi: document.querySelector('[data-testid="khoi-bai-viet"]')!.getBoundingClientRect().height,
        hang: [...document.querySelectorAll('[data-testid="bai-viet-hang"]')].map(
          (h) => h.getBoundingClientRect().height,
        ),
        da_nap: [...document.querySelectorAll('[data-testid="khoi-bai-viet"] img')].filter(
          (i) => (i as HTMLImageElement).naturalWidth > 0,
        ).length,
        tong: document.querySelectorAll('[data-testid="khoi-bai-viet"] img').length,
        // Khung gallery và khung thumb đơn của từng hàng (id mạch → {w, h}).
        khung: Object.fromEntries(
          [...document.querySelectorAll('[data-testid="bai-viet-hang"]')].map((h) => {
            const k = h.querySelector('[data-testid="bai-viet-gallery"], [data-testid="bai-viet-mot-anh"] > span');
            const r = k?.getBoundingClientRect();
            return [h.getAttribute("data-mach-id"), r ? { w: r.width, h: r.height } : null];
          }),
        ) as Record<string, { w: number; h: number } | null>,
      }));
    const truoc = await do_cao();
    expect(truoc.tong, "có ảnh để đo").toBeGreaterThan(20);
    expect(truoc.da_nap, "tiền đề: chưa ảnh nào nạp (đang bị giữ)").toBe(0);

    let so_khung = 0;
    for (const m of feed) {
      const can = anhCanCo(m);
      const k = truoc.khung[String(m.id)];
      if (can.length < 2) continue; // thumb đơn đã có bài đo từ vòng trước (B5b cũ) — xem bên dưới
      expect(k, `mạch ${m.id}: phải có khung gallery`).not.toBeNull();
      const w = can[0].w_thumb ?? 0;
      const h = can[0].h_thumb ?? 0;
      const ty_le = w >= 1 && h >= 1 ? Math.min(16 / 9, Math.max(1, w / h)) : 4 / 3;
      const cao_mong = Math.min(k!.w / ty_le, CAO_TOI_DA);
      expect(k!.h, `mạch ${m.id}: khung chưa có ảnh phải cao > 0`).toBeGreaterThan(0);
      expect(
        Math.abs(k!.h - cao_mong) / cao_mong,
        `mạch ${m.id}: khung ${k!.w}x${k!.h}, mong ${cao_mong} (tỉ lệ ${ty_le})`,
      ).toBeLessThan(0.03);
      so_khung++;
    }
    expect(so_khung, "tập khung gallery đã đo không rỗng").toBeGreaterThanOrEqual(5);
    // Thumb đơn: khung giữ chỗ cũng cao > 0 và đúng tỉ lệ kẹp [0,6 ; 2] khi ảnh chưa nạp.
    for (const m of feed.filter((x) => soAnh(x) === 1)) {
      const a = anhCanCo(m)[0];
      const k = truoc.khung[String(m.id)]!;
      const ty_le = a.w_thumb && a.h_thumb ? Math.min(2, Math.max(0.6, a.w_thumb / a.h_thumb)) : 4 / 3;
      expect(k.h, `mạch ${m.id}: thumb đơn chưa có ảnh phải cao > 0`).toBeGreaterThan(0);
      expect(Math.abs(k.w / k.h - ty_le) / ty_le).toBeLessThan(0.03);
    }

    tha();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[data-testid="khoi-bai-viet"] img')].every(
        (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
      ),
    );
    const sau = await do_cao();
    expect(sau.da_nap).toBe(sau.tong);
    expect(Math.abs(sau.khoi - truoc.khoi), "chiều cao cả khối đổi khi ảnh nạp").toBeLessThanOrEqual(1);
    sau.hang.forEach((h, i) =>
      expect(Math.abs(h - truoc.hang[i]), `hàng ${i} đổi chiều cao khi ảnh nạp`).toBeLessThanOrEqual(1),
    );
    for (const [id, k] of Object.entries(truoc.khung)) {
      if (k === null) continue;
      expect(Math.abs(sau.khung[id]!.h - k.h), `mạch ${id}: khung đổi cao`).toBeLessThanOrEqual(1);
      expect(Math.abs(sau.khung[id]!.w - k.w), `mạch ${id}: khung đổi rộng`).toBeLessThanOrEqual(1);
    }
  });

  /* ---- Accessibility: chữ của xem trước phải còn trong cây accessibility --------------- */

  test("A11Y — `trich` KHÔNG nằm trong phần tử aria-hidden; ảnh thì có (hàng 0 ảnh và hàng có ảnh)", async ({
    page,
  }) => {
    // Bản đầu bọc CẢ ảnh lẫn `trich` trong một link `aria-hidden` ⇒ đoạn chữ duy nhất của hàng
    // 0 ảnh biến mất khỏi cây accessibility (`ariaSnapshot()` chỉ còn heading + link + ngày).
    const feed = await layFeed();
    const co_trich = feed.filter((m) => m.xem_truoc?.trich);
    const khong_anh = co_trich.filter((m) => soAnh(m) === 0);
    const co_anh = co_trich.filter((m) => soAnh(m) >= 1);
    expect(khong_anh.length, "tiền đề: có hàng 0 ảnh").toBeGreaterThan(0);
    expect(co_anh.length, "tiền đề: có hàng có ảnh").toBeGreaterThan(0);
    await page.goto("/");

    for (const m of [...khong_anh, ...co_anh]) {
      const h = hang(page, m.id);
      const trich = h.getByTestId("bai-viet-trich");
      // 1. Không tổ tiên nào (kể cả chính nó) là aria-hidden.
      expect(
        await trich.evaluate((e) => e.closest('[aria-hidden="true"]') !== null),
        `mạch ${m.id}: trich nằm trong phần tử aria-hidden`,
      ).toBe(false);
      // 2. Và chữ THẬT SỰ có trong cây accessibility của hàng (không chỉ "không bị gắn cờ").
      const cay = await h.ariaSnapshot();
      const dau = m.xem_truoc!.trich.slice(0, 40);
      expect(cay, `mạch ${m.id}: cây accessibility thiếu đoạn trích
${cay}`).toContain(dau);
    }

    // Phía ảnh: mọi <img> của khối nằm trong link ẩn (lựa chọn có chủ ý — ảnh chỉ minh hoạ cho
    // tiêu đề + đoạn trích vừa đọc), nên `getByRole("img")` trong hàng ra 0.
    const anh_ha = await page
      .getByTestId("khoi-bai-viet")
      .locator("img")
      .evaluateAll((es) => es.map((e) => e.closest('a[aria-hidden="true"]') !== null));
    expect(anh_ha.length, "có ảnh để đo").toBeGreaterThan(20);
    expect(anh_ha.every(Boolean), "mọi <img> của khối nằm trong link aria-hidden").toBe(true);
  });

  test("A11Y — mỗi hàng chỉ có hai link nhìn thấy với trình đọc màn hình (tiêu đề, s/<sub>), không trùng tên; hàng vượt trần có thêm đúng một link 'Xem tất cả N ảnh →'", async ({
    page,
  }) => {
    // Bài `O` của trang-chu-v2.spec.ts đòi `getByRole("link", { name: tiêu đề })` ra 1 phần tử.
    const feed = await layFeed();
    await page.goto("/");
    let tong_link = 0;
    for (const m of feed) {
      const cay = await hang(page, m.id).ariaSnapshot();
      // `'link "Ảnh minh họa: …"':` — tên có dấu `:` thì ariaSnapshot bọc cả dòng trong nháy đơn
      // (YAML), nên regex phải nhận cả hai dạng; bản không nhận sẽ MÙ đúng với link ảnh đầu.
      const ten = [...cay.matchAll(/^\s*- '?link "([^"]*)"/gm)].map((x) => x[1]);
      expect(new Set(ten).size, `mạch ${m.id}: hai link cùng tên ${JSON.stringify(ten)}
${cay}`).toBe(
        ten.length,
      );
      const mong = [m.title, `s/${m.sub.slug}`];
      if (soAnh(m) > SO_ANH_GALLERY_TOI_DA) mong.push(`Xem tất cả ${soAnh(m)} ảnh →`);
      expect(ten, `mạch ${m.id}`).toEqual(mong);
      tong_link += ten.length;
    }
    expect(tong_link, "tập đối chiếu không rỗng").toBeGreaterThan(10);
  });

  test("cả hàng vẫn bấm được: bấm vào đoạn trích mở bài; bấm s/<sub> vẫn mở sub (không bị lớp phủ nuốt)", async ({
    page,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 0 && x.xem_truoc?.trich)!;
    expect(m, "tiền đề: có hàng 0 ảnh").toBeTruthy();
    await page.goto("/");
    const trich = hang(page, m.id).getByTestId("bai-viet-trich");
    await trich.scrollIntoViewIfNeeded();
    const b = (await trich.boundingBox())!;
    // Chuột thật tại giữa đoạn trích: chữ không phải link, nên đích là lớp phủ của link tiêu đề.
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page).toHaveURL(new RegExp(`/m/${m.slug}-${m.id}$`));

    await page.goto("/");
    await hang(page, m.id).getByRole("link", { name: `s/${m.sub.slug}` }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${m.sub.slug}$`));
  });
});

for (const theme of ["sang", "toi"] as const) {
  test.describe(`R9 — theme ${theme}: nút, bộ đếm, nền khung đọc được và lật vẫn chạy`, () => {
    test.use({ colorScheme: theme === "toi" ? "dark" : "light" });

    test("tương phản chữ bộ đếm ≥ 4,5 kể cả trên ảnh trắng; khung có nền + viền; nút lật được", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const feed = await layFeed();
      const m = feed.find((x) => soAnh(x) === 5)!;
      await page.goto("/");
      const khung = khungCua(page, m.id);
      await khung.scrollIntoViewIfNeeded();
      await khung.hover();
      await nutSau(khung).click();
      await denSlide(khung, 1);
      await expect(demCua(khung)).toHaveText("2/5");
      await expect(nutTruoc(khung)).toBeVisible();

      const r = await khung.evaluate((e) => {
        // `color-mix` ra `color(srgb r g b / a)`; màu thường ra `rgb(...)`. Chuẩn về [r,g,b,a] 0..255.
        const doc = (c: string): [number, number, number, number] => {
          const so = c.match(/-?[\d.]+/g)!.map(Number);
          if (c.startsWith("color(")) return [so[0] * 255, so[1] * 255, so[2] * 255, so[3] ?? 1];
          return [so[0], so[1], so[2], so[3] ?? 1];
        };
        const tron = (tren: number[], duoi: number[]) =>
          [0, 1, 2].map((i) => tren[i] * tren[3] + duoi[i] * (1 - tren[3]));
        const lum = (rgb: number[]) => {
          const [r, g, b] = rgb.map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const tuong_phan = (a: number[], b: number[]) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };
        const cs = (el: Element, p: keyof CSSStyleDeclaration) => getComputedStyle(el)[p] as string;
        const pill = e.querySelector("[aria-live]")!;
        const nut = [...e.querySelectorAll("button")].find((b) => !b.hidden)!;
        const chu = doc(cs(pill, "color"));
        const nen_pill = doc(cs(pill, "backgroundColor"));
        const nen_khung = doc(cs(e, "backgroundColor"));
        const trang = [255, 255, 255, 1];
        const den = [0, 0, 0, 1];
        const t = (nen: number[], duoi: number[]) => tuong_phan(chu, tron(nen, duoi));
        return {
          tren_khung: t(nen_pill, nen_khung),
          tren_trang: t(nen_pill, trang),
          tren_den: t(nen_pill, den),
          nut_chu_giong_pill: cs(nut, "color") === cs(pill, "color"),
          nut_nen_giong_pill: cs(nut, "backgroundColor") === cs(pill, "backgroundColor"),
          khung_nen_trong_suot: nen_khung[3] === 0,
          vien: cs(e, "borderTopWidth") + " " + cs(e, "borderTopStyle"),
          khung_khac_trang: cs(e, "backgroundColor") !== "rgb(255, 255, 255)",
          nut_hien: Number(cs(nut, "opacity")),
        };
      });
      expect(r.tren_khung, "chữ bộ đếm trên nền khung").toBeGreaterThanOrEqual(4.5);
      expect(r.tren_trang, "chữ bộ đếm trên ảnh trắng (xấu nhất)").toBeGreaterThanOrEqual(4.5);
      expect(r.tren_den).toBeGreaterThanOrEqual(4.5);
      expect(r.nut_chu_giong_pill && r.nut_nen_giong_pill, "nút cùng token với bộ đếm").toBe(true);
      expect(r.khung_nen_trong_suot, "khung phải có nền").toBe(false);
      expect(r.vien).toBe("1px solid");
      expect(r.nut_hien, "đang rê trong khung: nút hiện").toBe(1);
    });
  });
}

for (const theme of ["sang", "toi"] as const) {
  for (const rong of [375, 768]) {
    test.describe(`B7 — ${rong}px, theme ${theme}`, () => {
      test.use({ colorScheme: theme === "toi" ? "dark" : "light" });

      test("không tràn ngang; khung gallery không méo, không đẩy cột; chữ đọc được", async ({ page }) => {
        await page.setViewportSize({ width: rong, height: 900 });
        await page.goto("/");
        const cao = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y <= cao; y += 400) {
          await page.evaluate((v) => window.scrollTo(0, v), y);
          await page.waitForTimeout(80);
        }
        const hien = '[data-testid="bai-viet-mot-anh"] img, [data-testid="bai-viet-gallery-slide"]:first-child img';
        await page.waitForFunction(
          (sel) => [...document.querySelectorAll(sel)].every((i) => (i as HTMLImageElement).complete),
          hien,
        );

        const r = await page.evaluate(() => {
          const khoi = document.querySelector('[data-testid="khoi-bai-viet"]')!;
          const iw = window.innerWidth;
          const luminance = (rgb: string) => {
            const m = rgb.match(/[\d.]+/g)!.map(Number);
            const [r, g, b] = m.slice(0, 3).map((v) => {
              const c = v / 255;
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const nenCua = (el: Element) => {
            for (let e: Element | null = el; e; e = e.parentElement) {
              const bg = getComputedStyle(e).backgroundColor;
              const a = bg.match(/[\d.]+/g)!;
              if (!(a.length === 4 && Number(a[3]) === 0) && bg !== "transparent") return bg;
            }
            return "rgb(255, 255, 255)";
          };
          const tuong_phan = (a: string, b: string) => {
            const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
            return (x + 0.05) / (y + 0.05);
          };
          const xem = [...khoi.querySelectorAll('[data-testid="bai-viet-xem-truoc"]')].map((x) => {
            const gal = x.querySelector('[data-testid="bai-viet-gallery"]') as HTMLElement | null;
            const mot = x.querySelector('[data-testid="bai-viet-mot-anh"] img') as HTMLImageElement | null;
            const trich = x.querySelector('[data-testid="bai-viet-trich"]') as HTMLElement | null;
            const g = gal?.getBoundingClientRect();
            const slide = gal?.querySelector("li img") as HTMLImageElement | null;
            const tr = gal?.getBoundingClientRect();
            return {
              phai: Math.max(x.getBoundingClientRect().right, g?.right ?? 0),
              gallery: g ? { w: g.width, h: g.height, cha: x.getBoundingClientRect().width } : null,
              ty_le_anh_dau: slide ? slide.naturalWidth / slide.naturalHeight : null,
              fit: slide ? getComputedStyle(slide).objectFit : null,
              co_mot: !!mot,
              khung_tr: tr ? tr.width / tr.height : null,
              chu: trich
                ? {
                    px: parseFloat(getComputedStyle(trich).fontSize),
                    tp: tuong_phan(getComputedStyle(trich).color, nenCua(trich)),
                  }
                : null,
            };
          });
          return {
            iw,
            scrollW: document.documentElement.scrollWidth,
            xem,
            main_phai: document.querySelector("main")!.getBoundingClientRect().right,
          };
        });

        expect(r.scrollW, "không tràn ngang").toBeLessThanOrEqual(r.iw);
        expect(r.main_phai, "gallery không đẩy cột main ra ngoài").toBeLessThanOrEqual(r.iw);
        expect(r.xem.length).toBeGreaterThan(0);
        let so_khung = 0;
        for (const x of r.xem) {
          expect(x.phai).toBeLessThanOrEqual(r.iw);
          if (x.gallery) {
            so_khung++;
            expect(x.gallery.w, "khung phủ cả cột nội dung").toBeGreaterThanOrEqual(x.gallery.cha * 0.99);
            expect(x.gallery.h, "không cao quá trần").toBeLessThanOrEqual(CAO_TOI_DA + 1);
            expect(x.fit, "object-fit: contain (xem đủ ảnh, không cắt, không méo)").toBe("contain");
            // Khung theo tỉ lệ ảnh đầu đã kẹp [1 ; 16/9] — hoặc chạm trần chiều cao: khi đó khung
            // chỉ ĐƯỢC rộng hơn tỉ lệ kẹp (cao bị chặn), không bao giờ hẹp hơn.
            const ky_vong = Math.min(16 / 9, Math.max(1, x.ty_le_anh_dau!));
            if (x.gallery.h < CAO_TOI_DA - 1) {
              expect(Math.abs(x.khung_tr! - ky_vong) / ky_vong, `khung ${x.khung_tr} vs ${ky_vong}`).toBeLessThan(0.03);
            } else {
              expect(x.khung_tr!).toBeGreaterThanOrEqual(ky_vong * 0.97);
            }
          }
          if (x.chu) {
            expect(x.chu.px).toBeGreaterThanOrEqual(12);
            expect(x.chu.tp, "tương phản chữ").toBeGreaterThanOrEqual(4.5);
          }
        }
        expect(so_khung, "có khung gallery để đo").toBeGreaterThanOrEqual(5);
      });
    });
  }
}

test.describe("R3b — điện thoại (375, cảm ứng): nút ẩn, vuốt (cuộn) đổi bộ đếm, chạm ảnh mở bài, trang không tràn ngang", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("không có chuột ⇒ nút ẩn; cuộn ngang cập nhật bộ đếm; chạm ảnh mở bài", async ({ page }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 5)!;
    await page.goto("/");
    expect(
      await page.evaluate(() => [matchMedia("(hover: none)").matches, matchMedia("(hover: hover)").matches]),
      "tiền đề: thiết bị giả lập là cảm ứng không chuột",
    ).toEqual([true, false]);
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();
    await expect(nutSau(khung), "điện thoại: không nút sau").toBeHidden();
    await expect(nutTruoc(khung)).toBeHidden();
    await expect(demCua(khung)).toHaveText("1/5");

    await cuonToi(khung, 3);
    await expect(demCua(khung)).toHaveText("4/5");
    await expect(nutSau(khung), "vẫn ẩn sau khi vuốt").toBeHidden();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      "không tràn ngang",
    ).toBe(true);

    // Lần chạm đầu nạp sớm mọi ảnh của khung.
    await khung.locator("img").first().tap();
    await expect(page).toHaveURL(new RegExp(`/m/${m.slug}-${m.id}$`));
  });

  test("lần chạm đầu nạp sớm mọi ảnh của khung (touchstart)", async ({ page }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 5)!;
    await page.goto("/");
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();
    const lazy = () =>
      khung.locator("img").evaluateAll((es) => es.map((e) => e.getAttribute("loading")));
    expect((await lazy()).every((l) => l === "lazy")).toBe(true);
    await khung.dispatchEvent("touchstart");
    expect(
      (await lazy()).every((l) => l === "eager"),
      "touchstart đầu tiên nạp sớm mọi ảnh của khung",
    ).toBe(true);
  });
});

/* ---- Bàn phím: Tab / Enter / Space THẬT (không `.focus()` trực tiếp) ------------------------- */

/** Phần tử đang focus so với MỘT khung gallery. */
const dangFocus = (khung: Locator) =>
  khung.evaluate((k) => {
    const a = document.activeElement;
    return {
      body: a === null || a === document.body,
      trongKhung: a !== null && k.contains(a),
      the: a?.tagName ?? null,
      testid: a?.getAttribute("data-testid") ?? null,
      xemHet: !!a?.closest('[data-testid="bai-viet-gallery-xem-het"]'),
    };
  });

/** Chỉ báo focus của phần tử đang focus: có viền / bóng không, và hộp viền có nằm TRONG phần nhìn
 * thấy của khung không (`.gallery` có `overflow: hidden` nên viền vẽ ra ngoài hộp bị cắt). */
const chiBaoFocus = (khung: Locator) =>
  khung.evaluate((k) => {
    const a = document.activeElement as HTMLElement;
    const cs = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    const f = k.getBoundingClientRect();
    const ow = parseFloat(cs.outlineWidth) || 0;
    const off = parseFloat(cs.outlineOffset) || 0;
    const co_vien = cs.outlineStyle !== "none" && ow > 0;
    const co_bong = cs.boxShadow !== "none";
    // Viền vẽ cách hộp phần tử `off` rồi dày `ow`: mép ngoài cách hộp `off + ow` (âm = thụt vào).
    const ext = co_vien ? off + ow : 0;
    const pl = f.left + k.clientLeft;
    const pt = f.top + k.clientTop;
    const pr = pl + k.clientWidth;
    const pb = pt + k.clientHeight;
    return {
      testid: a.getAttribute("data-testid"),
      xemHet: !!a.closest('[data-testid="bai-viet-gallery-xem-het"]'),
      trongKhung: k.contains(a),
      co_chi_bao: co_vien || co_bong,
      kieu: `${cs.outlineStyle} ${ow}px offset ${off}px, shadow ${cs.boxShadow}`,
      trong:
        r.left - ext >= pl - 0.5 &&
        r.top - ext >= pt - 0.5 &&
        r.right + ext <= pr + 0.5 &&
        r.bottom + ext <= pb + 0.5,
      hop: { l: r.left - ext, t: r.top - ext, r: r.right + ext, b: r.bottom + ext },
      vung: { l: pl, t: pt, r: pr, b: pb },
    };
  });

/** Dải điểm ảnh 3px sát mép TRÁI trong khung (phía trên nút giữa, dưới bộ đếm): chỉ viền focus của
 * track / link "Xem tất cả" mới thay đổi nó khi focus rời đi. */
async function daiVienMepTrai(page: Page, khung: Locator) {
  const hop = (await khung.boundingBox())!;
  return page.screenshot({
    clip: { x: hop.x + 1, y: hop.y + 8, width: 3, height: Math.max(10, hop.height / 2 - 40) },
  });
}

test.describe("F — bàn phím thật trên gallery", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("F1 — Tab + Enter/Space thật ở hàng 2, 3, 5, 12 ảnh: focus luôn nằm ở một nút của gallery đó, KHÔNG rơi về <body>; lật tới cuối rồi ngược về đầu", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const feed = await layFeed();
    await page.goto("/");
    for (const so of [2, 3, 5, 12]) {
      const m = feed.find((x) => soAnh(x) === so)!;
      expect(m, `tiền đề: seed có hàng ${so} ảnh`).toBeTruthy();
      const khung = khungCua(page, m.id);
      const so_slide = Math.min(so, SO_ANH_GALLERY_TOI_DA) + (so > SO_ANH_GALLERY_TOI_DA ? 1 : 0);
      await expect(khung).toHaveAttribute("data-so-slide", String(so_slide));
      await khung.scrollIntoViewIfNeeded();

      // Điểm xuất phát là link s/<sub> của hàng; từ đó chỉ dùng Tab thật.
      await hang(page, m.id).getByRole("link", { name: `s/${m.sub.slug}` }).focus();
      let toi = false;
      for (let i = 0; i < 6 && !toi; i++) {
        await page.keyboard.press("Tab");
        toi = (await dangFocus(khung)).testid === "bai-viet-gallery-sau";
      }
      expect(toi, `${so} ảnh: Tab thật phải tới nút "Ảnh sau"`).toBe(true);

      const laNutCuaKhung = async () => {
        const f = await dangFocus(khung);
        return f.trongKhung && !f.body && f.the === "BUTTON";
      };

      for (let i = 1; i < so_slide; i++) {
        await page.keyboard.press(i % 2 ? "Enter" : "Space");
        await denSlide(khung, i);
        await expect
          .poll(laNutCuaKhung, { message: `${so} ảnh, tới slide ${i}: focus không phải nút của khung` })
          .toBe(true);
      }
      await expect(nutSau(khung), `${so} ảnh: tới cuối nút sau ẩn`).toBeHidden();
      await expect
        .poll(async () => (await dangFocus(khung)).testid, {
          message: `${so} ảnh: nút sau vừa ẩn, focus phải chuyển sang nút trước`,
        })
        .toBe("bai-viet-gallery-truoc");

      for (let i = so_slide - 2; i >= 0; i--) {
        await page.keyboard.press(i % 2 ? "Space" : "Enter");
        await denSlide(khung, i);
        await expect
          .poll(laNutCuaKhung, { message: `${so} ảnh, về slide ${i}: focus không phải nút của khung` })
          .toBe(true);
      }
      await expect(nutTruoc(khung), `${so} ảnh: về đầu nút trước ẩn`).toBeHidden();
      await expect
        .poll(async () => (await dangFocus(khung)).testid, {
          message: `${so} ảnh: nút trước vừa ẩn, focus phải chuyển sang nút sau`,
        })
        .toBe("bai-viet-gallery-sau");
    }
  });

  test("F2 — Tab thật qua cả hàng: mọi điểm dừng trong gallery có chỉ báo focus nhìn thấy, vẽ TRONG khung (không bị overflow cắt); ←/→ ở track lật ảnh; link 'Xem tất cả' chỉ vào thứ tự Tab khi slide của nó hiện", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const feed = await layFeed();
    await page.goto("/");
    let so_diem_dung = 0;
    for (const so of [3, 12]) {
      const m = feed.find((x) => soAnh(x) === so)!;
      const khung = khungCua(page, m.id);
      const track = khung.getByTestId("bai-viet-gallery-track");
      await khung.scrollIntoViewIfNeeded();
      // Track là điểm dừng Tab CÓ CHỦ Ý và có tên truy cập (Chromium tự cho vùng cuộn nhận focus
      // khi không có link con, nhưng Safari thì không — nên hợp đồng nằm ở thuộc tính).
      await expect(track).toHaveAttribute("tabindex", "0");
      await expect(track).toHaveAttribute("aria-label", /mũi tên/);

      const kiemDiemDung = async (nhan: string) => {
        const c = await chiBaoFocus(khung);
        expect(c.trongKhung, `${nhan}: phải ở trong khung`).toBe(true);
        expect(c.co_chi_bao, `${nhan}: điểm dừng MÙ (không viền / bóng): ${c.kieu}`).toBe(true);
        expect(c.trong, `${nhan}: viền bị cắt / ra ngoài khung ${JSON.stringify(c)}`).toBe(true);
        so_diem_dung++;
        return c;
      };
      // Chỉ báo phải thấy được ở mức điểm ảnh (không chỉ computed style): chụp dải mép trái khi
      // đang focus và sau khi rời focus — phải khác nhau.
      const kiemDiemAnh = async (nhan: string) => {
        const co = await daiVienMepTrai(page, khung);
        await page.evaluate(() => (document.activeElement as HTMLElement).blur());
        await page.waitForTimeout(300);
        const khong = await daiVienMepTrai(page, khung);
        expect(co.equals(khong), `${nhan}: viền focus không đổi điểm ảnh nào ở mép khung`).toBe(false);
      };

      // Pha 1: Tab thật từ link s/<sub> cho tới khi ra khỏi khung.
      await hang(page, m.id).getByRole("link", { name: `s/${m.sub.slug}` }).focus();
      const diem_dung: string[] = [];
      let da_vao = false;
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        const f = await dangFocus(khung);
        if (!f.trongKhung) {
          if (da_vao) break;
          continue;
        }
        da_vao = true;
        const c = await kiemDiemDung(`${so} ảnh, điểm dừng ${i + 1} (${f.testid ?? f.the})`);
        diem_dung.push(c.testid ?? (c.xemHet ? "xem-het" : "?"));
        if (c.testid === "bai-viet-gallery-track") {
          await kiemDiemAnh(`${so} ảnh, track`);
          // blur xoá focus: đưa lại để Tab tiếp đúng thứ tự
          await track.focus();
        }
      }
      expect(diem_dung, `${so} ảnh: các điểm dừng Tab đầu tiên`).toEqual([
        "bai-viet-gallery-track",
        "bai-viet-gallery-sau",
      ]);
      expect(diem_dung).not.toContain("xem-het");

      // Pha 2: ←/→ ở track lật ảnh.
      await track.focus();
      await page.keyboard.press("ArrowRight");
      await denSlide(khung, 1);
      await expect(demCua(khung)).toHaveText(`2/${so}`);
      await page.keyboard.press("ArrowLeft");
      await denSlide(khung, 0);
      await expect(demCua(khung)).toHaveText(`1/${so}`);

      if (so > SO_ANH_GALLERY_TOI_DA) {
        // Pha 3: lật bằng phím tới slide "Xem tất cả" rồi Tab: link vào thứ tự Tab, viền trong khung.
        const cuoi = SO_ANH_GALLERY_TOI_DA;
        for (let i = 1; i <= cuoi; i++) {
          await page.keyboard.press("ArrowRight");
          await denSlide(khung, i);
        }
        await expect(demCua(khung)).toBeHidden();
        await page.keyboard.press("Tab");
        const f = await dangFocus(khung);
        expect(f.xemHet, "Tab từ track ở slide cuối phải vào link 'Xem tất cả'").toBe(true);
        const c = await kiemDiemDung(`${so} ảnh, link Xem tất cả`);
        expect(c.xemHet).toBe(true);
        await kiemDiemAnh(`${so} ảnh, link Xem tất cả`);
        // Điểm dừng kế (sau khi blur, focus về body ⇒ quay lại link rồi Tab): nút trước.
        await khung.getByTestId("bai-viet-gallery-xem-het").getByRole("link").focus();
        await page.keyboard.press("Tab");
        expect((await dangFocus(khung)).testid).toBe("bai-viet-gallery-truoc");
        await kiemDiemDung(`${so} ảnh, nút trước ở slide cuối`);
      } else {
        await track.focus();
        await page.keyboard.press("Tab");
        expect((await dangFocus(khung)).testid).toBe("bai-viet-gallery-sau");
        await kiemDiemDung(`${so} ảnh, nút sau`);
      }
    }
    expect(so_diem_dung, "có điểm dừng để đo").toBeGreaterThanOrEqual(7);
  });
});

/* ---- Vòng cuối: bấm dồn, tắt JS, nút "dính", làm tròn ----------------------------------------- */

/** Bấm nút `nut` bằng `click()` DOM tại các mốc `tg` (ms, tính từ lúc gọi) — thời điểm chính xác,
 * không phụ thuộc độ trễ của Playwright — rồi chờ `cho` ms cho animation xong và trả chuỗi giá trị
 * bộ đếm đã thấy (để kiểm bộ đếm không nháy lùi qua slide cũ). */
const bamDon = (khung: Locator, nut: "Ảnh sau" | "Ảnh trước", tg: number[], cho = 1200) =>
  khung.evaluate(
    (k, a) =>
      new Promise<number[]>((xong) => {
        const b = [...k.querySelectorAll("button")].find(
          (x) => x.getAttribute("aria-label") === a.nut,
        ) as HTMLButtonElement;
        const dem = k.querySelector('[data-testid="bai-viet-gallery-dem"]')!;
        const so = () => Number((dem.textContent ?? "").split("/")[0]);
        const chuoi = [so()];
        const mo = new MutationObserver(() => chuoi.push(so()));
        mo.observe(dem, { childList: true, characterData: true, subtree: true });
        a.tg.forEach((t) => setTimeout(() => b.click(), t));
        setTimeout(() => {
          mo.disconnect();
          xong(chuoi);
        }, Math.max(...a.tg) + a.cho);
      }),
    { nut, tg, cho },
  );

const khongLui = (chuoi: number[], tang: boolean) =>
  chuoi.every((v, i) => i === 0 || (tang ? v >= chuoi[i - 1] : v <= chuoi[i - 1]));

for (const giam of [false, true]) {
  test.describe(`G — bấm dồn / giữ phím mũi tên không mất bước (${giam ? "giảm chuyển động" : "cuộn mượt"})`, () => {
    test.use({
      contextOptions: { reducedMotion: giam ? "reduce" : "no-preference" },
      viewport: { width: 1280, height: 900 },
    });

    test("G1 — bấm dồn Ảnh sau / Ảnh trước; bấm quá biên không vượt; bộ đếm không nháy lùi; scrollLeft khớp", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const feed = await layFeed();
      const m = feed.find((x) => soAnh(x) === 5)!;
      expect(m, "tiền đề: seed có hàng 5 ảnh").toBeTruthy();
      const ca_sau: [string, number[], number][] = [
        ["3 lần cách 60ms", [0, 60, 120], 3],
        ["3 lần cách 50ms", [0, 50, 100], 3],
        ["2 lần cách 50ms", [0, 50], 2],
        ["3 lần liền nhau (0ms)", [0, 0, 0], 3],
        ["7 lần cách 30ms (quá biên)", [0, 30, 60, 90, 120, 150, 180], 4],
      ];
      const ca_truoc: [string, number[], number][] = [
        ["3 lần cách 60ms", [0, 60, 120], 1],
        ["8 lần cách 30ms (quá biên)", [0, 30, 60, 90, 120, 150, 180, 210], 0],
      ];
      for (const huong of ["sau", "truoc"] as const) {
        for (const [ten, tg, mong] of huong === "sau" ? ca_sau : ca_truoc) {
          await page.goto("/");
          const khung = khungCua(page, m.id);
          await khung.scrollIntoViewIfNeeded();
          await khung.hover();
          if (huong === "truoc") {
            await cuonToi(khung, 4);
            await expect(demCua(khung)).toHaveText("5/5");
            await page.waitForTimeout(300);
          }
          const chuoi = await bamDon(khung, huong === "sau" ? "Ảnh sau" : "Ảnh trước", tg);
          const t = await doTrack(khung);
          const thay = Math.round(t.trai / t.rong);
          console.log(`[BAM-DON ${giam ? "giam" : "muot"}] ${huong} · ${ten} ⇒ slide ${thay} (đúng ${mong}); bộ đếm ${chuoi.join("→")}`);
          expect.soft(thay, `${huong} · ${ten}: slide cuối cùng`).toBe(mong);
          expect.soft(Math.abs(t.trai - mong * t.rong), `${huong} · ${ten}: scrollLeft khớp`).toBeLessThan(2);
          expect.soft(chuoi[chuoi.length - 1], `${huong} · ${ten}: bộ đếm cuối`).toBe(mong + 1);
          expect.soft(khongLui(chuoi, huong === "sau"), `${huong} · ${ten}: bộ đếm nháy lùi ${chuoi}`).toBe(true);
          // Hết cuộn rồi thì lật một bước nữa đi đúng một slide (cờ "đích" đã xoá, không kẹt).
          const them = huong === "sau" ? Math.max(0, mong - 1) : Math.min(4, mong + 1);
          if (them !== mong) {
            await bamDon(khung, huong === "sau" ? "Ảnh trước" : "Ảnh sau", [0], 900);
            const t2 = await doTrack(khung);
            expect.soft(Math.round(t2.trai / t2.rong), `${huong} · ${ten}: lật thêm một bước`).toBe(them);
          }
        }
      }
    });

    test("G2 — ArrowRight / ArrowLeft ×4 cách 35ms trên track có focus ⇒ đúng 4 slide", async ({ page }) => {
      const feed = await layFeed();
      const m = feed.find((x) => soAnh(x) === 5)!;
      await page.goto("/");
      const khung = khungCua(page, m.id);
      await khung.scrollIntoViewIfNeeded();
      await khung.getByTestId("bai-viet-gallery-track").focus();
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(35);
      }
      await denSlide(khung, 4);
      await expect(demCua(khung)).toHaveText("5/5");
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("ArrowLeft");
        await page.waitForTimeout(35);
      }
      await denSlide(khung, 0);
      await expect(demCua(khung)).toHaveText("1/5");
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("ArrowLeft");
        await page.waitForTimeout(20);
      }
      await denSlide(khung, 0);
      await expect(demCua(khung), "bấm quá biên trái không vượt").toHaveText("1/5");
    });
  });
}

test.describe("G3 — vị trí cuộn lệch 1px quanh biên slide: làm tròn (round), không floor", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("scrollLeft = k·w − 1 và k·w + 1 ⇒ bộ đếm là slide k+1; bấm sau đi tới k+2, không kẹt", async ({ page }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 5)!;
    await page.goto("/");
    const khung = khungCua(page, m.id);
    const track = khung.getByTestId("bai-viet-gallery-track");
    await khung.scrollIntoViewIfNeeded();
    await khung.hover();
    // Tắt snap để vị trí lệch 1px đứng yên (snap bắt buộc sẽ kéo nó về biên slide ngay).
    await track.evaluate((e) => (e.style.scrollSnapType = "none"));
    for (const lech of [-1, 1]) {
      const k = 2;
      await track.evaluate((e, a) => (e.scrollLeft = a.k * e.clientWidth + a.lech), { k, lech });
      await expect(demCua(khung), `scrollLeft = k·w ${lech > 0 ? "+" : "−"} 1`).toHaveText(`${k + 1}/5`);
      await bamDon(khung, "Ảnh sau", [0], 900);
      await track.evaluate((e) => (e.style.scrollSnapType = "none"));
      await expect(demCua(khung), `bấm sau từ k·w ${lech > 0 ? "+" : "−"} 1 phải tới ${k + 2}`).toHaveText(`${k + 2}/5`);
      await track.evaluate((e) => (e.scrollLeft = 0));
      await expect(demCua(khung)).toHaveText("1/5");
    }
  });
});

/* ---- Tắt JS: nút + bộ đếm không được hiện (không handler), vuốt / cuộn ngang vẫn chạy --------- */

test.describe("J — tắt JavaScript", () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });

  test("không nút / bộ đếm nhìn thấy dù rê chuột; cuộn ngang (bánh xe, scrollTo) vẫn đổi slide", async ({
    page,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 5)!;
    await page.goto("/");
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();
    await khung.hover();
    await page.waitForTimeout(300);
    // Markup SSR có nút nhưng ở trạng thái `hidden`: không có gì để bấm vào.
    await expect(khung.getByTestId("bai-viet-gallery-sau")).toHaveCount(1);
    await expect(khung.getByTestId("bai-viet-gallery-sau")).toBeHidden();
    await expect(khung.getByTestId("bai-viet-gallery-truoc")).toBeHidden();
    await expect(demCua(khung)).toBeHidden();
    // Mọi ảnh vẫn có trong DOM + cuộn ngang vẫn chạy (scroll-snap, không cần JS của trang).
    await expect(khung.getByTestId("bai-viet-gallery-slide")).toHaveCount(5);
    const hop = (await khung.boundingBox())!;
    await page.mouse.move(hop.x + hop.width / 2, hop.y + hop.height / 2);
    await page.mouse.wheel(900, 0);
    // Chờ snap xong: scrollLeft > 0 và là bội của bề rộng slide.
    await expect
      .poll(
        async () => {
          const x = await doTrack(khung);
          return x.trai > 0 && Math.abs(x.trai / x.rong - Math.round(x.trai / x.rong)) < 0.01;
        },
        { message: "bánh xe ngang phải đổi slide và snap về biên slide" },
      )
      .toBe(true);
    const t = await doTrack(khung);
    await cuonToi(khung, 3);
    await expect.poll(async () => Math.round((await doTrack(khung)).trai / t.rong)).toBe(3);
  });
});

test.describe("H — hydrate sạch, nút hiện sau hydrate", () => {
  for (const rong of [1280, 375, 320]) {
    test(`console sạch (không lỗi hydration) và nút hiện khi rê ở ${rong}px`, async ({ page }) => {
      await page.setViewportSize({ width: rong, height: 900 });
      const loi: string[] = [];
      page.on("console", (c) => {
        if (["error", "warning"].includes(c.type()) && !/Failed to load resource/i.test(c.text())) loi.push(c.text());
      });
      page.on("pageerror", (e) => loi.push(`pageerror: ${e.message}`));
      const feed = await layFeed();
      const m = feed.find((x) => soAnh(x) === 5)!;
      await page.goto("/");
      const khung = khungCua(page, m.id);
      await khung.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await expect(khung).toHaveAttribute("data-so-slide", "5");
      expect(loi, `console có lỗi / cảnh báo ở ${rong}px`).toEqual([]);
      if (rong >= 1024) {
        await khung.hover();
        await expect(nutSau(khung), "bật JS ⇒ nút hiện khi rê").toBeVisible();
        await expect(demCua(khung)).toBeVisible();
      }
    });
  }

  test("HTML SSR có nút + bộ đếm ở trạng thái hidden (bot thấy cùng markup, chưa hiện trước hydrate)", async ({
    request,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 5)!;
    const html = await (await request.get("/")).text();
    // Cắt hàng: từ `data-mach-id` của nó tới hàng kế (không dùng `</ul>`: track cũng đóng bằng `</ul>`).
    const dau = html.indexOf(`data-mach-id="${m.id}"`);
    const cuoi = html.indexOf('data-testid="bai-viet-hang"', dau + 1);
    const hang_html = dau < 0 ? "" : html.slice(dau, cuoi < 0 ? undefined : cuoi);
    expect(hang_html).toBeTruthy();
    for (const ten of ["Ảnh trước", "Ảnh sau"]) {
      const nut = new RegExp(`<button[^>]*aria-label="${ten}"[^>]*>`).exec(hang_html)?.[0] ?? "";
      expect(nut, `thiếu nút ${ten} trong HTML thô`).not.toBe("");
      expect(nut, `nút ${ten} phải hidden trong SSR`).toMatch(/\bhidden(=""|\s|>)/);
    }
    expect(/<div[^>]*aria-live="polite"[^>]*>/.exec(hang_html)?.[0] ?? "").toMatch(/\bhidden(=""|\s|>)/);
    // React tách các đoạn chữ bằng `<!-- -->` trong HTML SSR.
    expect(hang_html).toMatch(/Ảnh (<!-- -->)?1(<!-- -->)? trên (<!-- -->)?5/);
  });
});

/* ---- Nút không "dính" sau khi bấm bằng chuột; bàn phím thì hiện ----------------------------- */

test.describe("K — nút hiện theo hover hoặc focus bàn phím, không theo focus do chuột", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  const doMo = (khung: Locator) =>
    khung.evaluate((k) =>
      [...k.querySelectorAll("button")]
        .filter((b) => !b.hidden)
        .map((b) => getComputedStyle(b).opacity),
    );

  for (const so of [2, 3]) {
    test(`K1 — hàng ${so} ảnh: bấm Ảnh sau bằng chuột rồi đưa chuột ra ngoài ⇒ nút mờ hẳn (opacity 0)`, async ({
      page,
    }) => {
      const feed = await layFeed();
      const m = feed.find((x) => soAnh(x) === so)!;
      await page.goto("/");
      const khung = khungCua(page, m.id);
      await khung.scrollIntoViewIfNeeded();
      await khung.hover();
      await expect.poll(async () => (await doMo(khung)).every((o) => o === "1"), { message: "đang rê: nút hiện" }).toBe(true);
      await nutSau(khung).click();
      await denSlide(khung, 1);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(500);
      const mo = await doMo(khung);
      expect(mo.length, "còn nút nhìn thấy để đo").toBeGreaterThan(0);
      expect(mo, `${so} ảnh: nút vẫn hiện sau khi chuột rời (focus do chuột)`).toEqual(mo.map(() => "0"));
    });
  }

  test("K2 — Tab bằng bàn phím vào nút ⇒ nút hiện (opacity 1) dù chuột ở ngoài", async ({ page }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 3)!;
    await page.goto("/");
    const khung = khungCua(page, m.id);
    await khung.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await hang(page, m.id).getByRole("link", { name: `s/${m.sub.slug}` }).focus();
    for (let i = 0; i < 4 && (await dangFocus(khung)).testid !== "bai-viet-gallery-sau"; i++) await page.keyboard.press("Tab");
    expect((await dangFocus(khung)).testid).toBe("bai-viet-gallery-sau");
    await expect
      .poll(async () => nutSau(khung).evaluate((b) => getComputedStyle(b).opacity), { message: "Tab vào nút: nút hiện" })
      .toBe("1");
  });
});

test.describe("B8b — thumb tạm ẩn luôn được trả lại (chứng minh lưới an toàn)", () => {
  test("voiFileTamAn: fn ném lỗi giữa chừng ⇒ file vẫn về đúng tên, không còn .bvxt-tam", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bvxt-"));
    try {
      const file = join(dir, "a.png");
      writeFileSync(file, "noi-dung-goc");
      await expect(
        voiFileTamAn(file, async () => {
          // Chống bài đo rỗng: trong lúc chạy, file THẬT SỰ đang bị ẩn.
          expect(existsSync(file)).toBe(false);
          expect(existsSync(file + HAU_TO_TAM)).toBe(true);
          throw new Error("giả lập timeout / lỗi giữa bước");
        }),
      ).rejects.toThrow("giả lập");
      expect(existsSync(file), "file phải về đúng tên").toBe(true);
      expect(readFileSync(file, "utf8")).toBe("noi-dung-goc");
      expect(existsSync(file + HAU_TO_TAM), "không còn .bvxt-tam").toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("khoiPhucFileTam: trả lại mọi .bvxt-tam còn sót, kể cả thư mục con; có sẵn tên gốc thì bỏ bản tạm", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bvxt-"));
    try {
      mkdirSync(join(dir, "2026", "11"), { recursive: true });
      writeFileSync(join(dir, "x.png" + HAU_TO_TAM), "x");
      writeFileSync(join(dir, "2026", "11", "y.png" + HAU_TO_TAM), "y");
      writeFileSync(join(dir, "z.png"), "z-that");
      writeFileSync(join(dir, "z.png" + HAU_TO_TAM), "z-tam");
      writeFileSync(join(dir, "binh-thuong.png"), "giu");
      expect(khoiPhucFileTam(join(dir, "khong-ton-tai")), "thư mục không có thì bỏ qua").toBe(0);
      expect(khoiPhucFileTam(dir)).toBe(3);
      expect(readFileSync(join(dir, "x.png"), "utf8")).toBe("x");
      expect(readFileSync(join(dir, "2026", "11", "y.png"), "utf8")).toBe("y");
      expect(readFileSync(join(dir, "z.png"), "utf8"), "không đè file gốc đang có").toBe("z-that");
      expect(readFileSync(join(dir, "binh-thuong.png"), "utf8")).toBe("giu");
      const con_lai = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(HAU_TO_TAM));
      expect(con_lai).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

test.describe("B8 — ảnh 404", () => {
  // Timeout giữa chừng làm `finally` của bài không kịp chạy ⇒ quét lại sau MỖI bài.
  test.afterEach(quetMedia);

  test("thumb một ảnh bị xoá khỏi đĩa: hàng vẫn có tiêu đề + dòng chữ, không nhảy bố cục, không lỗi lạ", async ({
    page,
    browser,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 1 && x.xem_truoc?.trich);
    expect(m, "tiền đề: seed có hàng 1 ảnh").toBeTruthy();
    const url = m!.xem_truoc!.anh!.url_thumb;
    const file = resolve(thuMucMedia(), duongDan(url).replace(/^\/media\//, ""));
    test.skip(!existsSync(file), `không thấy file thumb ${file} (MEDIA_ROOT khác?)`);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const h = hang(page, m!.id);
    await h.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      (id) =>
        (document.querySelector(`[data-mach-id="${id}"] img`) as HTMLImageElement | null)?.complete,
      m!.id,
    );
    const cao_truoc = (await h.boundingBox())!.height;

    // Context MỚI: reload trong cùng context lấy ảnh từ cache HTTP của trình duyệt và ảnh
    // không bao giờ "vỡ" — bài đo xanh trên một thứ nó không đo.
    await voiFileTamAn(file, async () => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      try {
        const p2 = await ctx.newPage();
        const loi: string[] = [];
        p2.on("console", (c) => {
          if (c.type() === "error") loi.push(c.text());
        });
        p2.on("pageerror", (e) => loi.push(`pageerror: ${e.message}`));
        await p2.goto("/");
        const h2 = hang(p2, m!.id);
        await h2.scrollIntoViewIfNeeded();
        await p2.waitForFunction(
          (id) =>
            (document.querySelector(`[data-mach-id="${id}"] img`) as HTMLImageElement | null)?.complete,
          m!.id,
        );
        const img = h2.locator("img");
        expect(await img.evaluate((e) => (e as HTMLImageElement).naturalWidth), "ảnh phải vỡ thật").toBe(0);
        await expect(h2.getByRole("link", { name: m!.title }).first()).toBeVisible();
        await expect(h2.getByTestId("bai-viet-trich")).toBeVisible();
        await expect(h2.getByTestId("bai-viet-trich")).toHaveText(m!.xem_truoc!.trich);
        const cao_sau = (await h2.boundingBox())!.height;
        expect(Math.abs(cao_sau - cao_truoc), "ảnh vỡ không làm hàng nhảy").toBeLessThanOrEqual(2);
        const la = loi.filter((t) => !/404|Failed to load resource/i.test(t));
        expect(la, "chỉ được có lỗi 404 của chính ảnh").toEqual([]);
        expect(loi.length, "ảnh vỡ phải sinh đúng lỗi 404 (chống bài đo rỗng)").toBeGreaterThan(0);
      } finally {
        await ctx.close();
      }
    });
    expect(existsSync(file), "đã hoàn lại file thumb").toBe(true);
  });

  test("R10 — thumb ảnh ĐẦU của gallery bị xoá: khung giữ kích thước, nút + bộ đếm vẫn chạy, ảnh kế vẫn nạp, không lỗi lạ", async ({
    page,
    browser,
  }) => {
    const feed = await layFeed();
    const m = feed.find((x) => soAnh(x) === 3 && x.xem_truoc?.trich);
    expect(m, "tiền đề: seed có hàng 3 ảnh").toBeTruthy();
    const url = m!.xem_truoc!.anh!.url_thumb;
    const file = resolve(thuMucMedia(), duongDan(url).replace(/^\/media\//, ""));
    test.skip(!existsSync(file), `không thấy file thumb ${file} (MEDIA_ROOT khác?)`);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const k = khungCua(page, m!.id);
    await k.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      (id) =>
        (document.querySelector(`[data-mach-id="${id}"] img`) as HTMLImageElement | null)?.complete,
      m!.id,
    );
    const hop_truoc = (await k.boundingBox())!;
    const cao_hang_truoc = (await hang(page, m!.id).boundingBox())!.height;

    await voiFileTamAn(file, async () => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      try {
        const p2 = await ctx.newPage();
        const loi: string[] = [];
        p2.on("console", (c) => {
          if (c.type() === "error") loi.push(c.text());
        });
        p2.on("pageerror", (e) => loi.push(`pageerror: ${e.message}`));
        await p2.goto("/");
        const k2 = khungCua(p2, m!.id);
        await k2.scrollIntoViewIfNeeded();
        await p2.waitForFunction(
          (id) =>
            (document.querySelector(`[data-mach-id="${id}"] img`) as HTMLImageElement | null)?.complete,
          m!.id,
        );
        expect(
          await k2.locator("img").first().evaluate((e) => (e as HTMLImageElement).naturalWidth),
          "ảnh đầu phải vỡ thật",
        ).toBe(0);
        const hop_sau = (await k2.boundingBox())!;
        expect(Math.abs(hop_sau.height - hop_truoc.height), "khung không đổi cao").toBeLessThanOrEqual(1);
        expect(Math.abs(hop_sau.width - hop_truoc.width), "khung không đổi rộng").toBeLessThanOrEqual(1);
        expect(
          Math.abs((await hang(p2, m!.id).boundingBox())!.height - cao_hang_truoc),
          "ảnh vỡ không làm hàng nhảy",
        ).toBeLessThanOrEqual(2);
        await expect(hang(p2, m!.id).getByTestId("bai-viet-trich")).toHaveText(m!.xem_truoc!.trich);

        // Nút vẫn chạy, ảnh thứ hai (còn file) nạp được.
        await k2.hover();
        await nutSau(k2).click();
        await denSlide(k2, 1);
        await expect(demCua(k2)).toHaveText("2/3");
        await expect
          .poll(() => k2.locator("img").nth(1).evaluate((e) => (e as HTMLImageElement).naturalWidth), {
            timeout: 8000,
          })
          .toBeGreaterThan(0);
        const la = loi.filter((t) => !/404|Failed to load resource/i.test(t));
        expect(la, "chỉ được có lỗi 404 của chính ảnh").toEqual([]);
        expect(loi.length, "ảnh vỡ phải sinh đúng lỗi 404 (chống bài đo rỗng)").toBeGreaterThan(0);
      } finally {
        await ctx.close();
      }
    });
    expect(existsSync(file), "đã hoàn lại file thumb").toBe(true);
  });
});

test.describe("S3 — một HTML cho mọi User-Agent", () => {
  test("trình duyệt và Googlebot: cùng <head>, h1, lede, tập link /m/ và số <img> (mọi slide)", async ({
    request,
  }) => {
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
    const UA_BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const lay = async (ua: string) => (await request.get("/", { headers: { "user-agent": ua } })).text();
    const [a, b] = [await lay(UA), await lay(UA_BOT)];
    const chuan = (s: string) => s.replace(/ nonce="[^"]*"/g, "").replace(/\/_next\/static\/[^"'\s)]+/g, "X");
    const head = (s: string) => chuan(/<head>([\s\S]*?)<\/head>/.exec(s)?.[1] ?? "<<KHONG CO HEAD>>");
    const g = (re: RegExp, s: string) => [...s.matchAll(re)].map((m) => m[0]);
    const links = (s: string) => [...new Set(g(/href="\/m\/[^"#?]*"/g, s))].sort();
    expect(head(a)).not.toBe("<<KHONG CO HEAD>>");
    expect(head(a)).toBe(head(b));
    expect(g(/<h1[^>]*>[\s\S]*?<\/h1>/g, a)).toEqual(g(/<h1[^>]*>[\s\S]*?<\/h1>/g, b));
    expect(g(/<p class="[^"]*lede[^"]*"[^>]*>[\s\S]*?<\/p>/g, a)).toEqual(
      g(/<p class="[^"]*lede[^"]*"[^>]*>[\s\S]*?<\/p>/g, b),
    );
    expect(links(a)).toEqual(links(b));
    expect(links(a).length).toBeGreaterThan(10);
    // Ảnh của khối bài viết có trong HTML THÔ (bot thấy), cho cả hai UA — MỌI slide, không chỉ
    // slide đầu (slide 2.. không được chờ JS).
    const khoi = (s: string) =>
      /<section[^>]*data-testid="khoi-bai-viet"[\s\S]*?<\/section>/.exec(s)?.[0] ?? "";
    const so_anh = (s: string) => g(/<img\b[^>]*\/media\/anh-thumb\/[^>]*>/g, khoi(s)).length;
    const so_anh_co_alt = (s: string) => g(/<img\b[^>]*alt="Ảnh minh họa:[^>]*>/g, khoi(s)).length;
    const feed = await layFeed();
    const can = feed.reduce((n, m) => n + anhCanCo(m).length, 0);
    expect(so_anh(a)).toBeGreaterThan(20);
    expect(so_anh(a), "mọi ảnh API trả đều nằm trong HTML thô").toBe(can);
    expect(so_anh(a)).toBe(so_anh(b));
    expect(so_anh_co_alt(a), "mỗi hàng có ảnh giữ một alt có nghĩa (ảnh đầu)").toBeGreaterThanOrEqual(6);
    expect(so_anh_co_alt(a)).toBe(so_anh_co_alt(b));
    // Link "Xem tất cả N ảnh" của hàng vượt trần cũng nằm trong HTML thô, cho cả hai UA.
    const vuot = feed.find((m) => soAnh(m) > SO_ANH_GALLERY_TOI_DA)!;
    for (const html of [a, b]) {
      expect(khoi(html)).toContain(`Xem tất cả ${soAnh(vuot)} ảnh →`);
    }
  });
});
