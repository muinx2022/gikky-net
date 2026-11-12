import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { TimKiemOut } from "@gikky/api-client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { py } from "./thu-vien";

/** ĐỢT D — thẻ thống nhất trên trang tìm kiếm (plan `plans/2026-11-11-thong-nhat-giao-dien-toan-site.md`
 * §4.1, tiêu chí T1 + T9) — chạy trên BẢN BUILD thật.
 *
 * Hai nhóm, tách theo việc CÓ CẦN Meilisearch hay không:
 *
 * 1. **Không cần** — T1 trên bốn trang `/`, feed lọc nhật ký, `/s/<sub>`, `/u/<x>` (thẻ mạch đầu tiên
 *    cùng tập testid con) và T9 của `/u/<x>`. Chạy ở MỌI máy, không bao giờ skip.
 * 2. **Cần** — thẻ tìm kiếm so với CÙNG tập mẫu của nhóm 1, đoạn khớp, dòng bình luận, khung chung,
 *    T9 của `/tim-kiem`. Dữ liệu TỰ DỰNG với một từ khoá chỉ có ở lượt chạy này: mạch A có mốc 1 bị
 *    mod ẩn ⇒ `doan_trich = ""`; mạch B có đoạn khớp; bình luận C (trên B) có chữ khớp.
 *
 * ⚠ **Skip CHỈ khi `MEILI_URL` rỗng** (clone sạch, `api/.env.example`) — đọc biến môi trường trước rồi
 * tới `api/.env`, đúng thứ tự Django đọc (`environ.Env.read_env` không đè biến đã có). KHÔNG skip theo
 * chữ "tạm nghỉ" trên trang: `api/api/tim_kiem.py` trả `co_the_tim=False` cho MỌI `MeiliHong` (sai
 * khoá, Meilisearch chết, timeout), nên skip theo trang là che đúng những lỗi đáng đỏ. Đã cấu hình
 * mà trang vẫn "tạm nghỉ" ⇒ ĐỎ.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";
const SUB = "e2e-thu-nghiem";
const USER = "e2e_nhieu_mach";
/** Chữ không dấu, không có trong seed nào: chỉ ba dòng của lượt này khớp. */
const KHOA = `tkd${Date.now().toString(36)}`;
const TIM = `/tim-kiem?q=${KHOA}`;

/** `MEILI_URL` mà tiến trình Django của e2e sẽ thấy: biến môi trường (webServer kế thừa) thắng,
 * không có thì dòng trong `api/.env` — cùng cách `playwright.config.ts::secretLamMoiCache` đọc file. */
function meiliUrl(): string {
  if (process.env.MEILI_URL !== undefined) return process.env.MEILI_URL.trim();
  try {
    const env = readFileSync(resolve(__dirname, "..", "..", "..", "api", ".env"), "utf8");
    return /^MEILI_URL=(.*)$/m.exec(env)?.[1].trim() ?? "";
  } catch {
    return "";
  }
}
const MEILI_URL = meiliUrl();

/** Testid phụ thuộc DỮ LIỆU / TRANG / NGƯỜI XEM — bỏ cả cây con trước khi so. Lý do từng nhóm:
 * - `nhan-loai`: chỉ `/s/*` và tìm kiếm bật `hienNhanLoai` (danh sách lẫn loại);
 * - `the-nhat-ky-bot`: theo cờ `la_bot` của tác giả;
 * - `the-nhat-ky-lenh` (+ ô con `the-nhat-ky-<khoá>`): chỉ khi mạch có `lenh`;
 * - `the-nhat-ky-than` (+ `-trich`, `-anh`, `the-mach-them-anh`): theo nội dung mốc 1 / đoạn khớp;
 * - `the-mach-noi-moc`, `the-mach-da-luu-tru`, `the-mach-rieng-tu`, `the-nhat-ky-trang-thai`: theo
 *   số mốc / trạng thái / loại (bài viết không có chip);
 * - `the-nhat-ky-theo-user` (+ nút bên trong): vắng trên thẻ của chính chủ trang hồ sơ;
 * - ruột `the-nhat-ky-avatar` (`avatar-chu` khi không có ảnh / ảnh / biểu tượng bot): theo tác giả.
 * Phần còn lại — avatar, vote, "N mốc", bình luận, chia sẻ — là BỘ KHUNG, phải bằng nhau. */
const PHU_THUOC_DU_LIEU = [
  "nhan-loai",
  "the-nhat-ky-bot",
  "the-nhat-ky-lenh",
  "the-nhat-ky-than",
  "the-mach-noi-moc",
  "the-mach-da-luu-tru",
  "the-mach-rieng-tu",
  "the-nhat-ky-trang-thai",
  "the-nhat-ky-theo-user",
];

const tapTestid = (the: Locator) =>
  the.evaluate((li, bo) => {
    const goc = li.cloneNode(true) as Element;
    for (const id of bo) goc.querySelectorAll(`[data-testid="${id}"]`).forEach((e) => e.remove());
    // Ruột avatar (chữ cái `avatar-chu` / ảnh / biểu tượng bot) theo tác giả — giữ cái khung
    // `the-nhat-ky-avatar`, bỏ phần bên trong (cùng cách bài đo khung của đợt B).
    goc.querySelectorAll('[data-testid="the-nhat-ky-avatar"]').forEach((e) => (e.innerHTML = ""));
    return [...new Set([...goc.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid")!))].sort();
  }, PHU_THUOC_DU_LIEU);

const BON_TRANG = ["/", "/?tab=moi&loai_mach=nhat_ky", `/s/${SUB}`, `/u/${USER}`];

/** Tập testid MẪU: thẻ mạch đầu tiên của bốn trang không cần tìm kiếm. Khẳng định bốn tập bằng nhau
 * và đủ lớn (chống đo rỗng) rồi trả tập ấy. */
async function tapMau(page: Page): Promise<string[]> {
  const ky: Record<string, string[]> = {};
  for (const url of BON_TRANG) {
    await page.goto(url);
    const the = page.getByTestId("the-mach");
    expect(await the.count(), `${url}: phải có thẻ`).toBeGreaterThan(0);
    ky[url] = await tapTestid(the.first());
  }
  const mau = ky["/"];
  for (const id of ["the-nhat-ky-avatar", "cot-vote-mach", "the-nhat-ky-so-moc", "the-nhat-ky-so-binh-luan"]) {
    expect(mau, `bộ khung thiếu ${id}`).toContain(id);
  }
  expect(mau.length).toBeGreaterThanOrEqual(5);
  for (const [url, tap] of Object.entries(ky)) expect(tap, url).toEqual(mau);
  return mau;
}

/** Trang không tràn ngang, mọi thẻ trong khung nhìn, chân ≤ 4 thẻ đầu có vùng bấm ≥ 44px. Trả danh
 * sách vi phạm (rỗng = đạt) để chỗ gọi cộng thêm phép đo riêng. */
async function kiem390(page: Page, url: string): Promise<string[]> {
  const rong = await page.evaluate(() => ({ cuon: document.documentElement.scrollWidth, khung: window.innerWidth }));
  expect(rong.cuon, `${url}: ${JSON.stringify(rong)}`).toBeLessThanOrEqual(rong.khung);
  const the = page.getByTestId("the-mach");
  expect(await the.count(), `${url}: phải có thẻ`).toBeGreaterThan(0);
  const ngoai = await the.evaluateAll(
    (l) =>
      l.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.right > window.innerWidth + 0.5 || r.left < -0.5;
      }).length,
  );
  expect(ngoai, `${url}: thẻ lọt ra ngoài màn hình`).toBe(0);

  const n = Math.min(await the.count(), 4);
  const thap: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = the.nth(i);
    for (const [ten, loc] of [
      ["mốc", t.getByTestId("the-nhat-ky-so-moc")],
      ["bình luận", t.getByTestId("the-nhat-ky-so-binh-luan")],
      ["chia sẻ", t.getByRole("button", { name: /chia sẻ/i })],
      ["vote lên", t.getByTestId("mui-ten-len")],
      ["vote xuống", t.getByTestId("mui-ten-xuong")],
    ] as const) {
      const b = await loc.first().boundingBox({ timeout: 5_000 }).catch(() => null);
      if (b === null) thap.push(`thẻ ${i} ${ten}: không có hộp`);
      else if (b.height < 43.5 || b.width < 43.5) thap.push(`thẻ ${i} ${ten}: ${Math.round(b.width)}×${Math.round(b.height)}`);
    }
  }
  return thap;
}

/* ===================================================== nhóm 1 — KHÔNG cần Meilisearch == */

test.describe("T1 + T9 — bốn danh sách không cần tìm kiếm", () => {
  test("thẻ mạch đầu tiên của `/`, feed lọc nhật ký, `/s/<sub>`, `/u/<x>` có cùng tập testid con", async ({
    page,
  }) => {
    await tapMau(page);
  });

  test("T9 — `/u/<x>` ở 390px: không tràn ngang, vùng bấm chân thẻ ≥ 44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/u/${USER}`);
    const thap = await kiem390(page, `/u/${USER}`);
    expect(thap, thap.join(" · ")).toEqual([]);
  });
});

/* ========================================================= nhóm 2 — CẦN Meilisearch == */

test.describe("trang tìm kiếm (cần Meilisearch)", () => {
  test.skip(MEILI_URL === "", "MEILI_URL rỗng (env lẫn api/.env) — máy chưa cấu hình Meilisearch, tìm kiếm tắt có chủ đích");

  let id_a = 0;
  let id_b = 0;
  let id_c = 0;

  test.beforeAll(() => {
    const ra = py(
      [
        "from core.ghi import dat_an_moc, tao_binh_luan, tao_mach",
        "from core.models import Sub, User",
        "u = User.objects.get(username='e2e_tai_khoan_doi')",
        `sub = Sub.objects.get(slug=${JSON.stringify(SUB)})`,
        `a, moc_a = tao_mach(sub=sub, author=u, title='Thẻ tìm kiếm ${KHOA} mốc một bị ẩn',`,
        "    body='Thân mốc một sẽ bị mod ẩn nên không được lọt ra đoạn trích.', occurred_at=None, loai=None)",
        "dat_an_moc(moc=moc_a, boi=u, an=True, ly_do='e2e dot D')",
        `b, _ = tao_mach(sub=sub, author=u, title='Thẻ tìm kiếm ${KHOA} có đoạn khớp',`,
        `    body='Đoạn mở đầu bình thường rồi tới chữ ${KHOA} nằm giữa thân bài để có chỗ tô đậm.',`,
        "    occurred_at=None, loai=None)",
        `c = tao_binh_luan(mach=b, author=u, body='Bình luận có chữ ${KHOA} để trang tìm kiếm trả về dòng bình luận.')`,
        "print('ID', a.pk, b.pk, c.pk)",
        "",
      ].join("\n"),
    );
    const m = /ID (\d+) (\d+) (\d+)/.exec(ra);
    if (!m) throw new Error(`không dựng được dữ liệu: ${ra}`);
    [id_a, id_b, id_c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  });

  test.afterAll(() => {
    if (id_a === 0) return;
    py(["from core.models import Mach", `Mach.objects.filter(pk__in=[${id_a}, ${id_b}]).delete()`, ""].join("\n"));
  });

  /** Mở trang tìm kiếm. `MEILI_URL` đã đặt mà trang "tạm nghỉ" ⇒ ĐỎ (Meilisearch chết / sai khoá /
   * timeout — `co_the_tim=False` gộp mọi `MeiliHong`). Meilisearch thật đánh chỉ mục BẤT ĐỒNG BỘ
   * ⇒ tải lại tới khi đủ ba dòng của lượt này. */
  async function moTimKiem(page: Page): Promise<void> {
    await page.goto(TIM);
    await expect(
      page.getByTestId("tim-kiem-tam-nghi"),
      `MEILI_URL=${MEILI_URL} đã cấu hình nhưng trang báo "tìm kiếm tạm nghỉ" — Meilisearch không trả lời, sai MEILI_KEY hoặc timeout`,
    ).toHaveCount(0);
    await expect(async () => {
      await page.goto(TIM);
      expect(await page.locator('[data-testid="danh-sach-ket-qua"] > li').count()).toBe(3);
    }).toPass({ timeout: 20_000 });
  }

  test("T1 — thẻ mạch đầu tiên của `/tim-kiem` có ĐÚNG tập testid mẫu của bốn trang kia", async ({ page }) => {
    const mau = await tapMau(page);
    await moTimKiem(page);
    const the = page.getByTestId("the-mach");
    expect(await the.count(), "tìm kiếm: phải có thẻ mạch").toBeGreaterThan(0);
    expect(await tapTestid(the.first())).toEqual(mau);
  });

  test("tiêu đề + đoạn trích khớp API (`<mark>` đúng chỗ); `doan_trich` rỗng ⇒ KHÔNG đoạn trích", async ({ page }) => {
    await moTimKiem(page);
    const kq = (await (await fetch(`${API}/api/v1/tim-kiem?q=${KHOA}`)).json()) as TimKiemOut;
    const mach = kq.items.filter((x) => x.loai === "mach");
    expect(mach.map((x) => x.mach.id).sort()).toEqual([id_a, id_b].sort());
    const boDau = (s: string) => s.replaceAll("[[", "").replaceAll("]]", "");
    const soDam = (s: string) => s.split("[[").length - 1;

    for (const x of mach) {
      const the = page.locator(`[data-testid="the-mach"][data-mach-id="${x.mach.id}"]`);
      await expect(the).toHaveCount(1);
      const tieu_de = the.getByRole("heading").getByRole("link");
      await expect(tieu_de).toHaveText(boDau(x.title_to_dam));
      expect(soDam(x.title_to_dam), `mạch ${x.mach.id}: API phải tô tiêu đề`).toBeGreaterThan(0);
      await expect(tieu_de.locator("mark")).toHaveCount(soDam(x.title_to_dam));
      const trich = the.getByTestId("the-nhat-ky-trich");
      if (x.doan_trich === "") {
        await expect(trich, `mạch ${x.mach.id}: doan_trich rỗng`).toHaveCount(0);
      } else {
        await expect(trich).toHaveText(boDau(x.doan_trich));
        await expect(trich.locator("mark")).toHaveCount(soDam(x.doan_trich));
      }
    }
    // Hai nhánh đều được đo (không phải mọi mạch cùng rơi một nhánh).
    expect(mach.find((x) => x.mach.id === id_a)?.doan_trich, "mốc 1 bị ẩn ⇒ doan_trich rỗng").toBe("");
    expect(soDam(mach.find((x) => x.mach.id === id_b)?.doan_trich ?? ""), "B phải có đoạn khớp").toBeGreaterThan(0);
    // Mốc 1 bị ẩn không được rò ra dưới dạng nào (kể cả trích tự sinh).
    await expect(page.locator(`[data-mach-id="${id_a}"]`)).not.toContainText("không được lọt ra");
  });

  test("dòng bình luận trỏ đúng `#bl-<id>`, in tên qua tenHienThi, có `<mark>`", async ({ page }) => {
    await moTimKiem(page);
    const dong = page.locator(`[data-testid="ket-qua-tim-kiem"][data-binh-luan-id="${id_c}"]`);
    await expect(dong).toHaveCount(1);
    await expect(dong).toHaveAttribute("data-loai", "binh_luan");
    await expect(dong).toHaveAttribute("data-mach-id", String(id_b));
    const href = await dong.locator("a").first().getAttribute("href");
    expect(href).toMatch(new RegExp(`-${id_b}#bl-${id_c}$`));
    expect(await dong.locator("a").count(), "không `<a>` lồng trong dòng bình luận").toBe(1);
    // Tên: luật `tenHienThi` (có display_name ⇒ in nó, không thì username TRẦN, không `u/`), tính
    // tay từ API; handle `u/…` ở `title`.
    const kq = (await (await fetch(`${API}/api/v1/tim-kiem?q=${KHOA}`)).json()) as TimKiemOut;
    const ai = kq.items.find((x) => x.binh_luan_id === id_c)?.tac_gia;
    expect(ai?.username).toBe("e2e_tai_khoan_doi");
    const ten = dong.locator('[title^="u/"]');
    await expect(ten).toHaveAttribute("title", "u/e2e_tai_khoan_doi");
    await expect(ten).toHaveText(ai!.display_name.trim() !== "" ? ai!.display_name : ai!.username);
    // Tên ở đây KHÔNG phải link hồ sơ (cả dòng là link tới bình luận) ⇒ hover không gạch chân như
    // `.ten` của thẻ mạch.
    await ten.hover();
    expect(await ten.evaluate((e) => getComputedStyle(e).textDecorationLine)).toBe("none");
    expect(await dong.locator("mark").count()).toBeGreaterThan(0);
  });

  test("dòng bình luận và thẻ mạch CÙNG khung (viền, bo góc, nền, padding); khoảng giữa các dòng bằng feed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await moTimKiem(page);
    const kieu = (loc: Locator) =>
      loc.evaluate((e) => {
        const s = getComputedStyle(e);
        return {
          bo: s.borderTopLeftRadius,
          vien: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
          nen: s.backgroundColor,
          dem: s.padding,
        };
      });
    const the = await kieu(page.locator(`[data-testid="the-mach"][data-mach-id="${id_b}"]`));
    const bl = await kieu(page.locator(`[data-binh-luan-id="${id_c}"]`));
    expect(the.vien).toMatch(/^1px solid /);
    expect(bl).toEqual(the);
    // Hàng đầu của dòng bình luận cũng là avatar · tên · ngày, cùng cỡ avatar với thẻ.
    const av_the = await page.locator(`[data-mach-id="${id_b}"] [data-testid="the-nhat-ky-avatar"]`).boundingBox();
    const av_bl = await page.locator(`[data-binh-luan-id="${id_c}"] [aria-hidden="true"]`).first().boundingBox();
    expect(Math.round(av_bl!.height)).toBe(Math.round(av_the!.height));

    const khoang = await page.locator('[data-testid="danh-sach-ket-qua"] > li').evaluateAll((l) =>
      l.slice(1).map((e, i) => Math.round(e.getBoundingClientRect().top - l[i].getBoundingClientRect().bottom)),
    );
    expect(khoang.length).toBe(2);
    // 14px = `--khoang-the` của feed (`feed.module.css#.danh_sach`).
    for (const k of khoang) expect(k).toBe(14);
  });

  test("T9 — `/tim-kiem` ở 390px: không tràn ngang, vùng bấm thẻ ≥ 44px, dòng bình luận ≥ 44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await moTimKiem(page);
    const thap = await kiem390(page, TIM);
    const ngoai = await page.locator('[data-testid="danh-sach-ket-qua"] > li').evaluateAll(
      (l) =>
        l.filter((e) => {
          const r = e.getBoundingClientRect();
          return r.right > window.innerWidth + 0.5 || r.left < -0.5;
        }).length,
    );
    expect(ngoai, "dòng kết quả lọt ra ngoài màn hình").toBe(0);
    const b = await page.locator(`[data-binh-luan-id="${id_c}"] a`).boundingBox();
    if (b === null || b.height < 43.5) thap.push(`dòng bình luận: ${JSON.stringify(b)}`);
    expect(thap, thap.join(" · ")).toEqual([]);
  });
});
