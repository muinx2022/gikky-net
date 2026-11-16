import type { BinhLuanOut } from "@gikky/api-client";
import { type Browser, type Page, expect, test } from "@playwright/test";

import { KHOA_PHIEN } from "../lib/tai-khoan";
import { dungTaiKhoan } from "./danh-tinh";
import {
  duyet,
  khanDai,
  lamMoiCacheTrang,
  machTheoId,
  moComposer,
  nganKeo,
} from "./du-lieu";

/** Bình luận kiểu TikTok — `plans/2026-11-16-binh-luan-kieu-tiktok.md`.
 *
 * Hai hàm luật (làm phẳng, ưu tiên/gập đuôi) đã ghim ở `don-vi/binh-luan-phang.spec.ts`.
 * Bài này đo phần don-vi không với tới: NỐI DÂY thật trên trang — `usePhien()` có thật sự
 * đổi thứ tự sau hydrate, đuôi gập có thật sự `hidden` mà vẫn trong DOM, câu vừa trả lời
 * một reply có hiện ra (không rơi vào đuôi gập) sau `router.refresh()`, và deep-link vào
 * một reply nằm trong đuôi có tự bung đuôi không.
 *
 * Dựng dữ liệu RIÊNG (mạch mới, 2 người, 1 khách) chứ không đọc seed: thứ tự và số reply
 * là thứ đang đo, seed đổi một dòng là bài đo đổi nghĩa.
 */

async function guiTrongNganKeo(page: Page, seq: number, chu: string) {
  const khoang = page.getByTestId(`ngan-keo-${seq}`);
  if (!(await khoang.isVisible())) await page.getByTestId(`nut-ngan-keo-${seq}`).click();
  await expect(khoang).toBeVisible();
  const form = await moComposer(khoang);
  await form.getByTestId("composer-o").fill(chu);
  await form.getByTestId("composer-gui").click();
  await expect(khoang.getByText(chu)).toBeVisible({ timeout: 30_000 });
}

type Nguon = () => Promise<{ threads: BinhLuanOut[] }>;

/** Id của bình luận có đúng thân `chu` trong `nguon` (lát cắt ngăn kéo hoặc khu chung) —
 * hỏi API, không dò DOM. */
async function idTheoThan(nguon: Nguon, chu: string): Promise<number> {
  let id = -1;
  await expect
    .poll(
      async () => {
        const n = duyet((await nguon()).threads).find((x) => x.body === chu);
        id = n?.id ?? -1;
        return id;
      },
      { timeout: 30_000, message: `Django phải thấy "${chu}"` },
    )
    .toBeGreaterThan(0);
  return id;
}

async function traLoiUI(page: Page, nguon: Nguon, chaId: number, chu: string) {
  const cha = page.locator(`#bl-${chaId}`);
  await cha.scrollIntoViewIfNeeded();
  await cha.getByTestId("nut-tra-loi").first().click();
  const form = cha.getByTestId("composer").first();
  await expect(form).toBeVisible();
  await form.getByTestId("composer-o").fill(chu);
  await form.getByTestId("composer-gui").click();
  return idTheoThan(nguon, chu);
}

/** Id các reply ĐANG HIỆN (không `hidden`) của thread `gocId`, theo thứ tự DOM. */
async function replyDangHien(page: Page, gocId: number): Promise<number[]> {
  return page
    .locator(`#bl-${gocId}`)
    .getByTestId("danh-sach-reply")
    .locator("> [data-binh-luan-id]:not([hidden])")
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-binh-luan-id"))));
}

async function trangKhach(browser: Browser, url: string, duong_dan: string) {
  await lamMoiCacheTrang(duong_dan);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url);
  return { ctx, page };
}

test("TikTok: ưu tiên thread/reply của tôi, gập đuôi > 3, trả lời reply vẫn thấy ngay", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const dau = Date.now().toString(36);

  // --- A dựng mạch 2 mốc (mốc 2 có ngăn kéo) và viết gốc RA.
  await dungTaiKhoan(page, "ttA");
  await page.goto("/dang-mach");
  await page.getByTestId("dang-mach-sub").selectOption("chung-khoan");
  await page.getByTestId("dang-mach-title").fill(`TikTok ${dau}`);
  await page.getByTestId("dang-mach-body").fill("Mốc 1 — đo bình luận kiểu TikTok.");
  await page.getByTestId("dang-mach-gui").click();
  await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
  const duong_dan = new URL(page.url()).pathname;
  const mach_id = Number(/-(\d+)$/.exec(duong_dan)?.[1]);
  await page.getByTestId("nut-noi-moc").click();
  await page.getByTestId("noi-moc-body").fill("Mốc 2 — có ngăn kéo.");
  await page.getByTestId("noi-moc-gui").click();
  await expect(page.getByTestId("moc-2")).toBeVisible({ timeout: 30_000 });
  const moc2 = (await machTheoId(mach_id)).mocs.find((m) => m.seq === 2)!;
  const nk2: Nguon = () => nganKeo(moc2.id);
  const chung: Nguon = () => khanDai(mach_id, "moi_nhat");

  const url_moi = `${duong_dan}?khan_dai=1&sort=moi_nhat`;
  await page.goto(url_moi);
  const chu_ra = `gốc A ${dau}`;
  await guiTrongNganKeo(page, 2, chu_ra);
  const ra = await idTheoThan(nk2, chu_ra);

  // --- B (context riêng) viết gốc RB — mới hơn RA, nên `moi_nhat` của server xếp RB trước.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  const b = await dungTaiKhoan(pageB, "ttB");
  await pageB.goto(url_moi);
  const chu_rb = `gốc B ${dau}`;
  await guiTrongNganKeo(pageB, 2, chu_rb);
  const rb = await idTheoThan(nk2, chu_rb);

  const goc = (p: Page) =>
    p.getByTestId("lat-cat-2").locator("> [data-binh-luan-id]");
  const thuTuGoc = async (p: Page) =>
    (await goc(p).evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-binh-luan-id")))));

  // Server (`moi_nhat`) xếp RB trước RA — vế chống rỗng: nếu server đã xếp RA trước thì
  // vế "A thấy RA đầu tiên" dưới đây xanh mà không đo gì.
  expect((await nganKeo(moc2.id)).threads.map((t) => t.id)).toEqual([rb, ra]);

  // Khách: thứ tự server, không đổi gì.
  {
    const { ctx, page: k } = await trangKhach(browser, url_moi, duong_dan);
    await k.getByTestId("nut-ngan-keo-2").click();
    await expect(goc(k)).toHaveCount(2);
    expect(await thuTuGoc(k), "khách: thứ tự server").toEqual([rb, ra]);
    await ctx.close();
  }
  // A: thread của A lên đầu.
  await page.goto(url_moi);
  await page.getByTestId("nut-ngan-keo-2").click();
  await expect(goc(page)).toHaveCount(2);
  await expect
    .poll(() => thuTuGoc(page), { message: "A: thread có A phải lên đầu" })
    .toEqual([ra, rb]);

  // --- B trả lời RA ba lần (thẳng vào gốc).
  await pageB.goto(url_moi);
  await pageB.getByTestId("nut-ngan-keo-2").click();
  const b_ids: number[] = [];
  for (let i = 1; i <= 3; i += 1) {
    b_ids.push(await traLoiUI(pageB, nk2, ra, `B trả lời ${i} ${dau}`));
  }

  // --- A trả lời REPLY thứ ba của B (reply-vào-reply) — rồi phải THẤY nó ngay.
  await page.goto(url_moi);
  await page.getByTestId("nut-ngan-keo-2").click();
  const chu_a1 = `A trả lời B ${dau}`;
  const a1 = await traLoiUI(page, nk2, b_ids[2], chu_a1);
  const moi = page.locator(`#bl-${a1}`);
  await expect(moi, "câu vừa trả lời phải hiện sau router.refresh").toBeVisible({
    timeout: 30_000,
  });
  // Nằm PHẲNG dưới gốc RA, và mang dòng ↪ trỏ về B.
  await expect(page.locator(`#bl-${ra}`).locator(`#bl-${a1}`)).toHaveCount(1);
  await expect(page.locator(`#bl-${b_ids[2]}`).locator(`#bl-${a1}`)).toHaveCount(0);
  await expect(moi.getByTestId("tra-loi-cha")).toHaveText(`↪ trả lời @${b.username}`);
  // Reply của A lên ĐẦU danh sách reply của RA; 4 reply ⇒ đuôi có 1 (b3), A không ở đó.
  expect(await replyDangHien(page, ra), "A: reply của A lên đầu, rồi b1, b2").toEqual([
    a1,
    b_ids[0],
    b_ids[1],
  ]);
  const b3_cua_A = page.locator(`#bl-${b_ids[2]}`);
  await expect(b3_cua_A).toBeHidden();
  await expect(b3_cua_A).toHaveAttribute("data-trong-duoi", "1");
  // MỘT `<ul>`: phần hiện sẵn và đuôi là anh em — không tách cha (vòng sửa 2, NHẸ 2).
  await expect(
    page.locator(`#bl-${ra}`).getByTestId("danh-sach-reply").locator("> [data-binh-luan-id]"),
  ).toHaveCount(4);

  // --- Ca 3 (vòng sửa 2): A vào THẲNG #bl-b3. Lúc hydrate `toi` còn null ⇒ b3 ở phần hiện
  // sẵn, trang cuộn tới; rồi `toi` về, a1 chen lên đầu và đẩy b3 vào đuôi. Đích vừa được
  // dẫn tới KHÔNG được biến mất.
  //
  // Để ca này xảy ra THẬT, `toi` phải về SAU cú cuộn: xoá bản phiên lưu ở localStorage
  // (nếu còn, `toi` có ngay lúc hydrate và đích đã ở trong đuôi từ đầu — ca khác) và hãm
  // `GET /me` 1,5 giây. Không có hai bước này bài đo xanh cả khi bỏ bản sửa (đã đo).
  await page.evaluate((k) => window.localStorage.removeItem(k), KHOA_PHIEN);
  await page.route("**/api/v1/me", async (route) => {
    await new Promise((r) => setTimeout(r, 1_500));
    await route.continue();
  });
  await page.goto(`${duong_dan}?khan_dai=1&sort=cu_nhat#bl-${b_ids[2]}`);
  await expect
    .poll(async () => (await replyDangHien(page, ra))[0], {
      message: "chờ `toi` về: a1 lên đầu",
      timeout: 10_000,
    })
    .toBe(a1);
  await expect(b3_cua_A, "vế chống rỗng: b3 thật sự đã rơi vào đuôi").toHaveAttribute(
    "data-trong-duoi",
    "1",
  );
  await expect(b3_cua_A, "đích deep-link bị đẩy vào đuôi rồi ẩn mất").toBeVisible();
  await page.unroute("**/api/v1/me");

  // --- Khách: thứ tự thời gian b1 b2 b3 a1 ⇒ hiện b1 b2 b3, a1 vào đuôi (hidden, VẪN trong DOM).
  {
    const { ctx, page: k } = await trangKhach(browser, url_moi, duong_dan);
    await k.getByTestId("nut-ngan-keo-2").click();
    const thread = k.locator(`#bl-${ra}`);
    await expect(thread.locator(`#bl-${b_ids[0]}`)).toBeVisible();
    await expect(thread.locator(`#bl-${b_ids[2]}`)).toBeVisible();
    const an = thread.locator(`#bl-${a1}`);
    await expect(an, "đuôi vẫn nằm trong HTML").toHaveCount(1);
    await expect(an).toBeHidden();
    const nut = thread.getByTestId("nut-xem-them-reply");
    await expect(nut).toHaveText("Xem thêm 1 câu trả lời ▾");
    await expect(nut).toHaveAttribute("aria-expanded", "false");
    await nut.click();
    await expect(an).toBeVisible();
    await expect(nut).toHaveText("Ẩn bớt ▴");
    await nut.click();
    await expect(an).toBeHidden();

    // Ca 2: ngăn kéo ĐÃ MỞ SẴN, đuôi đang gập, rồi chỉ đổi hash (hashchange thuần — không
    // điều hướng, không remount). Đích trong đuôi phải hiện VÀ được cuộn tới.
    await k.evaluate(() => window.scrollTo(0, 0));
    await k.evaluate((h) => {
      window.location.hash = h;
    }, `bl-${a1}`);
    await expect(an).toBeInViewport({ timeout: 10_000 });

    // Vào THẲNG bằng URL có hash (tải lại từ trắng, ngăn kéo đóng, đuôi gập).
    await k.goto(`${duong_dan}?khan_dai=1&sort=cu_nhat#bl-${a1}`);
    await expect(k.locator(`#bl-${a1}`)).toBeInViewport({ timeout: 10_000 });
    await ctx.close();
  }

  // --- Ca 1 (vòng sửa 2): khu bình luận CHUNG (thread KHÔNG neo, đứng ngoài
  // `NganKeoProvider`), thread ≥ 4 reply, deep-link vào reply MỚI NHẤT — đúng đích của link
  // thông báo (`lib/thong-bao.ts`). Với khách, reply mới nhất luôn nằm trong đuôi.
  // Mặt CẶN: ô nhập nằm TRONG khu chung và mặc định không neo (mặt BÃO đặt ô nhập ở
  // ngoài khu — `va-v2.spec.ts`).
  await page.goto(`${duong_dan}?view=can&khan_dai=1&sort=moi_nhat`);
  const chu_rc = `gốc chung A ${dau}`;
  const o_soan = await moComposer(page.getByTestId("khan-dai"));
  await o_soan.getByTestId("composer-o").fill(chu_rc);
  await o_soan.getByTestId("composer-gui").click();
  const rc = await idTheoThan(chung, chu_rc);
  await pageB.goto(url_moi);
  const c_ids: number[] = [];
  for (let i = 1; i <= 4; i += 1) {
    c_ids.push(await traLoiUI(pageB, chung, rc, `B chung ${i} ${dau}`));
  }
  const moi_nhat = c_ids[3];
  {
    const { ctx, page: k } = await trangKhach(browser, url_moi, duong_dan);
    // Vế chống rỗng: trước deep-link, reply mới nhất đúng là đang nằm trong đuôi gập.
    const dich = k.locator(`#bl-${moi_nhat}`);
    await expect(dich).toHaveAttribute("data-trong-duoi", "1");
    await expect(dich).toBeHidden();
    await k.goto(`${duong_dan}?khan_dai=1&sort=cu_nhat#bl-${moi_nhat}`);
    await expect(dich).toBeInViewport({ timeout: 10_000 });
    await ctx.close();
  }
  await ctxB.close();
});
