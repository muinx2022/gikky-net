import type { MachChiTietOut } from "@gikky/api-client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { tinhDaiGap, trongDaiGap } from "../lib/dai-gap";
import { dungTaiKhoan } from "./danh-tinh";
import {
  TITLE_HPG,
  duongDan,
  duyet,
  khanDai,
  lamMoiCacheTrang,
  machTheoId,
  moComposer,
  nganKeo,
  timMachTheoTitle,
} from "./du-lieu";

/** Tách bình luận CHUNG khỏi bình luận MỐC — `plans/2026-08-26-binh-luan-chung-tach-khoi-moc.md`.
 *
 * Mô hình mới, một câu: **mỗi thread có đúng MỘT nhà trên trang.** Khu "Bình luận" cuối
 * bài giữ thread `anchor_moc_seq IS NULL`; thread neo mốc N sống duy nhất trong ngăn kéo
 * mốc N. Trước lượt này ngăn kéo là *cửa sổ* chiếu vào khán đài — cùng những câu ấy render
 * hai chỗ — nên mọi hệ quả dưới đây đều là hệ quả của việc cái cửa sổ ấy thành một cái
 * PHÒNG: ngăn kéo mang định danh (`id="bl-N"`), nó phải sâu bằng khán đài, nó phải mở được
 * từ một deep-link, và khối trích phải nhảy tới được vào trong nó.
 *
 * Bốn tiêu chí 5 · 7 · 8 · 9 của plan nằm ở đây. Tiêu chí 6 (composer mặc định không neo)
 * ở `va-v2.spec.ts`; 1–4 và 11–13 là Python.
 */

let hpg: MachChiTietOut;

test.beforeAll(async () => {
  hpg = await timMachTheoTitle(TITLE_HPG);
  // Xem `lamMoiCacheTrang`: trang khách có cache 1 giờ và bình luận KHÔNG có signal
  // revalidate, nên lượt chạy trước để lại một bản cũ mà bài đo sẽ so với Django hôm nay.
  await lamMoiCacheTrang(duongDan(hpg));
});

/** Mốc có nhiều thread neo nhất — chỗ dày dữ liệu nhất để đo. */
async function mocDongNhat() {
  const dem = await Promise.all(
    hpg.mocs.map(async (m) => ({ moc: m, nk: await nganKeo(m.id) })),
  );
  const chon = dem
    .filter((x) => x.nk.threads.length > 0)
    .sort((a, b) => b.nk.threads.length - a.nk.threads.length)[0];
  expect(chon, "seed phải có ít nhất một mốc có thread neo").toBeDefined();
  return chon;
}

test.describe("Tiêu chí 5 — khu chung và ngăn kéo là hai tập RỜI NHAU", () => {
  test("khán đài chỉ chứa thread KHÔNG neo, và mọi thread neo nằm trong ngăn kéo của nó", async ({
    page,
  }) => {
    // Nguồn sự thật là Django. Vế chống rỗng đứng TRƯỚC mọi khẳng định về DOM: nếu seed
    // hết thread neo thì cả bài này xanh mà không đo gì — đúng loài proof đo RỖNG.
    const kd = await khanDai(hpg.id, "moi_nhat");
    const { moc, nk } = await mocDongNhat();
    expect(nk.threads.length, "cần ≥1 thread neo để đo").toBeGreaterThan(0);
    expect(
      kd.threads.every((t) => t.anchor_moc_seq === null),
      "API còn trả thread neo ở khu chung",
    ).toBe(true);

    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat`);
    await page.getByTestId(`nut-ngan-keo-${moc.seq}`).click();
    await expect(page.getByTestId(`lat-cat-${moc.seq}`)).toBeVisible();

    const doc = async (khu: Locator) =>
      khu.locator("[data-binh-luan-id]").evaluateAll((els) =>
        els.map((e) => Number((e as HTMLElement).dataset.binhLuanId)),
      );

    const o_chung = await doc(page.getByTestId("cay-khan-dai"));
    const o_ngan_keo = await doc(page.getByTestId(`lat-cat-${moc.seq}`));
    expect(o_chung.length, "khu chung phải có nội dung").toBeGreaterThan(0);
    expect(o_ngan_keo).toEqual(duyet(nk.threads).map((n) => n.id));
    expect(
      o_chung.filter((x) => o_ngan_keo.includes(x)),
      "một bình luận render ở CẢ HAI khu — hai tập phải rời nhau",
    ).toEqual([]);
  });

  test("không `id=bl-N` trùng và không `data-binh-luan-id` trùng, kể cả khi MỌI ngăn kéo mở", async ({
    page,
  }) => {
    // Ngăn kéo nằm sẵn trong DOM dưới dạng `hidden` (nội dung do server render — mặt CẶN
    // là mặt Google index), nên phép đếm này thấy hết mà không cần bấm gì. Bấm mở một cái
    // chỉ để chắc rằng nội dung ấy có thật chứ không phải khoang rỗng.
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat`);
    await page.getByTestId("dai-gap-nut").click();

    const dem = await page.evaluate(() => {
      const lay = (chon: string, doc_thuoc_tinh: (e: HTMLElement) => string) =>
        [...document.querySelectorAll(chon)].map((e) =>
          doc_thuoc_tinh(e as HTMLElement),
        );
      const neo = lay("[id^='bl-']", (e) => e.id);
      const dinh_danh = lay(
        "[data-binh-luan-id]",
        (e) => e.dataset.binhLuanId!,
      );
      const trung = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
      return {
        neo_trung: trung(neo),
        dinh_danh_trung: trung(dinh_danh),
        so_neo: neo.length,
        so_dinh_danh: dinh_danh.length,
      };
    });

    expect(dem.neo_trung, "hai phần tử cùng `id` ⇒ deep-link hên xui").toEqual([]);
    expect(dem.dinh_danh_trung).toEqual([]);
    // Vế chống rỗng: `[]` là câu trả lời đúng cho cả một trang không render bình luận nào.
    expect(dem.so_neo).toBeGreaterThan(5);
    expect(dem.so_dinh_danh).toBe(dem.so_neo);
  });
});

test.describe("Tiêu chí 8 — deep-link `#bl-N` MỞ ngăn kéo chứa nó", () => {
  test("vào thẳng bằng URL có hash ⇒ ngăn kéo mở và phần tử vào viewport", async ({
    page,
  }) => {
    const { moc, nk } = await mocDongNhat();
    const dich = duyet(nk.threads)[0].id;

    // Trước khi mở: ngăn kéo đóng là trạng thái mặc định — nếu không, bài đo không phân
    // biệt được "effect chạy" với "ngăn kéo vốn đã mở sẵn".
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat`);
    await expect(page.getByTestId(`ngan-keo-${moc.seq}`)).toBeHidden();

    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat#bl-${dich}`);
    await expect(page.getByTestId(`ngan-keo-${moc.seq}`)).toBeVisible();
    await expect(page.locator(`#bl-${dich}`)).toBeInViewport();
  });

  test("`hashchange` trong cùng trang cũng mở — link nội bộ không remount", async ({
    page,
  }) => {
    // Nhánh thứ hai của effect, và là nhánh dễ quên nhất: bấm một `<a href="#bl-N">` cùng
    // trang thì Next không dựng lại component nào, nên một effect chỉ chạy ở mount sẽ im.
    const { moc, nk } = await mocDongNhat();
    const dich = duyet(nk.threads)[0].id;

    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat`);
    await expect(page.getByTestId(`ngan-keo-${moc.seq}`)).toBeHidden();

    await page.evaluate((h) => {
      window.location.hash = h;
    }, `bl-${dich}`);

    await expect(page.getByTestId(`ngan-keo-${moc.seq}`)).toBeVisible();
    await expect(page.locator(`#bl-${dich}`)).toBeInViewport();
  });
});

test.describe("Tiêu chí 9 — khối trích nhảy được vào trong ngăn kéo", () => {
  test("bình luận được trích nằm trong ngăn kéo ⇒ vẫn 'nhảy tới ↓', bấm là tới nơi", async ({
    page,
  }) => {
    // Đây là bài đo của §D1: `id_trong_trang` phải là **hợp** của khán đài và mọi lát cắt
    // ngăn kéo. Bỏ nửa ngăn kéo đi thì trang báo "chưa nhảy tới được" cho một bình luận
    // đang nằm cách chỗ bấm vài trăm pixel.
    const moc_trich = hpg.mocs.find((m) => m.trich !== null)!;
    const comment_id = moc_trich.trich!.comment_id;

    // Vế chống rỗng, và nó là vế mang cả ý nghĩa bài đo: bình luận ấy phải KHÔNG có ở khu
    // chung. Nếu nó ở đó thì bài này chỉ đo lại V15 cũ.
    const kd = await khanDai(hpg.id, "hay_nhat");
    expect(
      duyet(kd.threads).some((n) => n.id === comment_id),
      "bình luận được trích còn nằm ở khu chung ⇒ bài đo không đi qua đường ngăn kéo",
    ).toBe(false);

    await page.goto(duongDan(hpg));
    // ⚠ **KHÔNG bấm `dai-gap-nut` ở đây** *(gỡ 2026-08-27, phản biện NẶNG-1)*. Bản trước
    // bấm bung dải gập ngay trước khi bấm nút nhảy, và cú bấm ấy **che mất một lỗi thật**:
    // đích (`r7`, neo mốc 5) nằm TRONG dải gập `2..6`, nên bung tay trước là tự dọn đường
    // rồi mới đo xem đường có tự dọn không. Khối trích thì nằm ở mốc 7 — NGOÀI dải — nên
    // cú bấm ấy cũng chưa bao giờ cần cho việc tìm cái nút.
    const khoi = page.getByTestId(`trich-moc-${moc_trich.seq}`);
    await khoi.scrollIntoViewIfNeeded();
    // Vế chống-che: dải gập phải đang ĐÓNG lúc bấm, nếu không bài đo lại tự dọn đường.
    await expect(page.getByTestId("dai-gap-nut")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(khoi.getByTestId("trich-khong-nhay-duoc")).toHaveCount(0);
    await khoi.getByTestId("trich-nhay-khan-dai").click();

    await expect(page).toHaveURL(new RegExp(`#bl-${comment_id}$`));
    await expect(page.locator(`#bl-${comment_id}`)).toBeInViewport();
  });
});

/** Tiêu chí 15 — deep-link phải mở **MỌI** khoang gập trên đường tới đích.
 *
 * Hồi quy NẶNG-1 của lượt: effect mở được ngăn kéo nhưng dải gập bọc ngoài vẫn `hidden`
 * (`globals.css` ép `[hidden]` thành `display:none !important`), nên `scrollIntoView`
 * thành lệnh rỗng — và cờ đã-xử-lý vẫn bị đóng dấu nên không lần nào thử lại. Ca tái hiện
 * nằm sẵn trên seed: `r7` neo mốc 5, mốc 5 ở trong dải gập `2..6` của mạch HPG 9 mốc.
 *
 * **Không bài nào dưới đây được bấm bung tay** — đó là cả nội dung của tiêu chí.
 */
test.describe("Tiêu chí 15 — deep-link xuyên qua CẢ dải gập lẫn ngăn kéo", () => {
  /** Một bình luận neo vào mốc nằm TRONG dải gập, kèm `seq` của mốc ấy. */
  async function neoTrongDaiGap() {
    const dai = tinhDaiGap(hpg.entry_count);
    expect(dai.gap, "mạch HPG phải có dải gập").toBe(true);
    for (const m of hpg.mocs.filter((x) => trongDaiGap(dai, x.seq))) {
      const nk = await nganKeo(m.id);
      const nut = duyet(nk.threads).find((n) => n.trang_thai === "binh_thuong");
      if (nut !== undefined) return { seq: m.seq, id: nut.id };
    }
    throw new Error("seed phải có bình luận neo vào một mốc TRONG dải gập");
  }

  /** Ba khẳng định chung: dải bung, ngăn kéo mở, đích vào viewport. */
  async function daToiNoi(page: Page, seq: number, id: number) {
    await expect(page.getByTestId("dai-gap-nut")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.getByTestId(`ngan-keo-${seq}`)).toBeVisible();
    await expect(page.locator(`#bl-${id}`)).toBeInViewport();
  }

  test("lối 1 — vào THẲNG bằng URL có hash", async ({ page }) => {
    const { seq, id } = await neoTrongDaiGap();
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat#bl-${id}`);
    await daToiNoi(page, seq, id);
  });

  test("lối 2 — `hashchange` trong cùng trang", async ({ page }) => {
    const { seq, id } = await neoTrongDaiGap();
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat`);
    // Cả hai khoang phải đang ĐÓNG trước khi đổi hash — nếu không bài đo rỗng.
    await expect(page.getByTestId("dai-gap-nut")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.getByTestId(`ngan-keo-${seq}`)).toBeHidden();

    await page.evaluate((h) => {
      window.location.hash = h;
    }, `bl-${id}`);
    await daToiNoi(page, seq, id);
  });

  test("lối 3 — điều hướng cùng ROUTE, đổi query (đường của nút 'nhảy tới ↓')", async ({
    page,
  }) => {
    const { seq, id } = await neoTrongDaiGap();
    await page.goto(duongDan(hpg));
    await expect(page.getByTestId("dai-gap-nut")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // Đi bằng chính `<Link>` của trang, không `page.goto`: `goto` là tải lại từ trắng và
    // sẽ rơi về lối 1, tức bài đo trượt khỏi ca mà nó sinh ra để canh.
    await page.evaluate(
      ([duong, h]) => {
        const a = document.createElement("a");
        a.href = `${duong}?khan_dai=1&sort=hay_nhat#${h}`;
        document.body.appendChild(a);
        a.click();
      },
      [duongDan(hpg), `bl-${id}`] as const,
    );
    await daToiNoi(page, seq, id);
  });
});

/** Bảo đảm ngăn kéo mốc `seq` đang MỞ — bấm nếu nó đang đóng, không bấm nếu đã mở.
 *
 * Không bấm thẳng: `Composer` gọi `router.refresh()` sau khi gửi, và refresh của App Router
 * là refresh MỀM — state client của `NganKeoProvider` sống qua nó, nên ngăn kéo vẫn mở.
 * Một cú bấm vô điều kiện ở vòng sau sẽ ĐÓNG nó lại, và bài đo hỏng theo kiểu khó đọc nhất:
 * bước kế tiếp không thấy phần tử mà nó vừa nhìn thấy một dòng trước.
 */
async function moNganKeo(page: Page, seq: number): Promise<Locator> {
  const khoang = page.getByTestId(`ngan-keo-${seq}`);
  if (!(await khoang.isVisible())) {
    await page.getByTestId(`nut-ngan-keo-${seq}`).click();
  }
  await expect(khoang).toBeVisible();
  return khoang;
}

/** Bấm "Trả lời" trên bình luận `cha_id` rồi gửi `chu`. Chờ tới khi ngăn kéo sâu thêm
 * một tầng, và trả về `id` của **nút sâu nhất** — chính là bình luận vừa tạo.
 *
 * ⚠ **Không dò id bằng `filter({ hasText })`.** Bản đầu làm thế và sai im lặng: `hasText`
 * khớp cả TỔ TIÊN — một `<li>` cha chứa nguyên văn chữ của con — nên `.first()` (thứ tự
 * tài liệu) trả về **gốc thread**, không phải reply vừa viết. Vòng lặp vì thế cắm mãi ở
 * tầng 1 và cái cây 4 tầng không bao giờ được dựng, trong khi bài đo trông vẫn "chạy".
 *
 * Nguồn sự thật là **API**, đúng lối của cả bộ e2e: hỏi lát cắt, lấy `depth` lớn nhất.
 */
async function traLoi(
  page: Page,
  mocId: number,
  cha_id: number,
  chu: string,
): Promise<number> {
  const truoc = duyet((await nganKeo(mocId)).threads).length;
  const cha = page.locator(`#bl-${cha_id}`);
  await cha.scrollIntoViewIfNeeded();
  await cha.getByTestId("nut-tra-loi").first().click();
  const form = cha.getByTestId("composer").first();
  await expect(form).toBeVisible();
  await form.getByTestId("composer-o").fill(chu);
  await form.getByTestId("composer-gui").click();

  // `router.refresh()` dựng lại cây từ server; chờ Django thấy hàng mới rồi mới đọc id.
  await expect
    .poll(async () => duyet((await nganKeo(mocId)).threads).length, {
      timeout: 30_000,
      message: "Django phải thấy reply vừa gửi",
    })
    .toBe(truoc + 1);

  const sau_nhat = duyet((await nganKeo(mocId)).threads).reduce((a, b) =>
    b.depth > a.depth ? b : a,
  );
  expect(sau_nhat.parent_id, "reply mới phải nối đúng vào cha").toBe(cha_id);
  return sau_nhat.id;
}

test.describe("Tiêu chí 7 — ngăn kéo sâu bằng khán đài", () => {
  test("thread neo sâu 4 tầng render ĐỦ trong ngăn kéo (ngưỡng cũ là 3)", async ({
    page,
  }) => {
    // Ngưỡng cũ `SAU_NGAN_KEO = 3` cắt con của nút tầng 3, nên tầng 4 **không có phần tử
    // nào** trong trang — bài đo này đỏ ở đúng chỗ đó. Ngưỡng ấy hợp lý khi ngăn kéo còn
    // là cửa sổ: link "tiếp tục thread →" dẫn sang một cái nhà đầy đủ ở dưới. Từ lượt này
    // không còn cái nhà đó, nên nhà duy nhất không được cụt hơn nhà cũ.
    //
    // Dựng qua UI thật (4 lượt ghi) chứ không seed sẵn: thứ đang đo là **ngưỡng cắt lúc
    // render**, và nó chỉ lộ ra trên một cây có thật ở đúng độ sâu ấy.
    await dungTaiKhoan(page, "sau6");

    await page.goto("/dang-mach");
    await page.getByTestId("dang-mach-sub").selectOption("chung-khoan");
    await page
      .getByTestId("dang-mach-title")
      .fill(`Ngăn kéo sâu ${Date.now().toString(36)}`);
    await page.getByTestId("dang-mach-body").fill("Mốc 1 — mở sổ để đo độ sâu.");
    await page.getByTestId("dang-mach-gui").click();
    await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
    const duong_dan = new URL(page.url()).pathname;
    const mach_id = Number(/-(\d+)$/.exec(duong_dan)?.[1]);

    await page.getByTestId("nut-noi-moc").click();
    await page.getByTestId("noi-moc-body").fill("Mốc 2 — để mạch có ngăn kéo.");
    await page.getByTestId("noi-moc-gui").click();
    await expect(page.getByTestId("moc-2")).toBeVisible({ timeout: 30_000 });

    const moc2 = (await machTheoId(mach_id)).mocs.find((m) => m.seq === 2)!;

    // Gốc viết TỪ TRONG ngăn kéo mốc 2 ⇒ nó tự neo mốc 2 (PLAN 5.4 luật 3).
    await page.goto(`${duong_dan}?view=can&khan_dai=1&sort=moi_nhat`);
    const khoang = await moNganKeo(page, 2);
    const composer = await moComposer(khoang);
    const goc_chu = `tầng 1 ${Date.now().toString(36)}`;
    await composer.getByTestId("composer-o").fill(goc_chu);
    await composer.getByTestId("composer-gui").click();
    await expect(khoang.getByText(goc_chu)).toBeVisible({ timeout: 30_000 });

    // Id lấy từ API, không dò DOM — lý do ở `traLoi`. `poll` chứ không khẳng định thẳng:
    // chữ hiện trên màn hình là kết quả của `router.refresh()`, và giữa cú refresh ấy với
    // lượt `GET /mocs/{id}/comments` của bài đo có một nhịp — khẳng định thẳng ở đây xanh
    // phần lớn lượt chạy rồi đỏ một lượt, tức đúng loài bài đo chớp tắt.
    await expect
      .poll(async () => (await nganKeo(moc2.id)).threads.length, {
        timeout: 30_000,
        message: "gốc vừa viết phải vào đúng ngăn kéo mốc 2",
      })
      .toBe(1);
    let cha = duyet((await nganKeo(moc2.id)).threads)[0].id;

    const tang: number[] = [cha];
    for (let d = 2; d <= 4; d += 1) {
      await moNganKeo(page, 2);
      cha = await traLoi(page, moc2.id, cha, `tầng ${d} ${Date.now().toString(36)}`);
      tang.push(cha);
    }

    // Cây phải THẬT SỰ sâu 4 tầng — nếu không, khẳng định "render đủ" ở dưới đo một cây
    // nông và xanh với cả ngưỡng cũ.
    expect(
      Math.max(...duyet((await nganKeo(moc2.id)).threads).map((n) => n.depth)),
      "phải dựng được cây sâu 4 tầng thì mới vượt được ngưỡng cũ (3)",
    ).toBe(4);

    // Tải lại từ trắng: state client mất, cây dựng lại hoàn toàn từ server. Đây mới là
    // ngưỡng cắt THẬT lúc render, không phải một cây đã sống qua bốn lượt `refresh()`.
    await page.reload();
    await moNganKeo(page, 2);
    const lat = page.getByTestId("lat-cat-2");
    await expect(lat).toBeVisible();
    for (const [i, id] of tang.entries()) {
      await expect(lat.locator(`#bl-${id}`), `tầng ${i + 1}`).toHaveCount(1);
    }
    // Không nhánh nào bị cắt ⇒ không có link "tiếp tục thread →" nào trong ngăn kéo.
    await expect(lat.getByRole("link", { name: /tiếp tục thread/ })).toHaveCount(0);
  });

  test("tiêu đề khoang không hứa một chiều nào — gốc và reply chạy ngược nhau", async ({
    page,
  }) => {
    // §C3: nhãn cũ ghi "cũ → mới" trong khi server sắp gốc theo hoạt động (mới trước) và
    // reply theo thời gian (cũ trước). Một câu ngắn không tả nổi hai chiều, và một nhãn
    // SAI tệ hơn không có nhãn.
    const { moc } = await mocDongNhat();
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat`);
    const khoang = await moNganKeo(page, moc.seq);
    await expect(khoang).toContainText(`Bình luận neo vào mốc ${moc.seq}`);
    await expect(khoang).not.toContainText("cũ → mới");
    await expect(khoang).not.toContainText("mới → cũ");
  });
});
