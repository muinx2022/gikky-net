import { type Browser, type Page, expect, test } from "@playwright/test";

import { dungTaiKhoan } from "./danh-tinh";

/** **Nhắn tin riêng 1-1 ở tầng trình duyệt** — tiêu chí A17 của
 * `plans/2026-09-03-nhan-tin-rieng.md`.
 *
 * Bài đo Python (`api/tests/test_api_tin_nhan.py`) đã ghim toàn bộ luật ở tầng API. File
 * này ghim đúng thứ tầng API không nói được — và cả bốn bài đều là chuyện chỉ hỏng ở
 * trình duyệt:
 *
 * 1. **khách vào `/tin-nhan`** — `router.replace("/dang-nhap")` chạy ở client, server trả
 *    200 cho ai cũng được;
 * 2. **nút "Nhắn tin" trên hồ sơ** hiện đúng chỗ và biến mất trên hồ sơ của chính mình —
 *    quyết định ấy do CLIENT so `username`, không có endpoint nào để hỏi;
 * 3. **hai người, hai trình duyệt**: A gõ Enter ⇒ B thấy con số trên phong bì, mở hộp thư
 *    thấy chấm chưa đọc, vào đọc thì chấm tắt **ngay** (qua `CustomEvent`, không đợi hết
 *    vòng poll 60 giây) và dòng chuông `tin_nhan` có mặt;
 * 4. **poll 10 giây**: B trả lời, trang A **đang mở** thấy tin mà không reload.
 *
 * Bài 4 là bài duy nhất của repo đo một vòng poll thật, nên nó là bài duy nhất phải chờ
 * bằng thời gian. Hạn 20 giây = hai vòng poll: một vòng có thể rơi đúng lúc B chưa gửi
 * xong, và bắt nó phải trúng vòng đầu là một bài đo chớp tắt ngẫu nhiên.
 *
 * ⚠ **Chạy bằng đúng lệnh ở §6 của plan** (trỏ `DATABASE_URL` sang `gikky_e2e` + `CI=1`).
 * `gikky_dev` chứa dữ liệu thật, và hai tài khoản `@gikky.test` của file này để lại
 * `HoiThoai`/`TinNhan` mà `don_rac_e2e` chưa dọn.
 */

/** Hai tab sống suốt cả file — hai người dùng thật, hai context riêng (hai phiên). */
let a: Page;
let b: Page;
let ten_a = "";
let ten_b = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  a = await (await browser.newContext()).newPage();
  b = await (await browser.newContext()).newPage();
  ten_a = (await dungTaiKhoan(a, "tn_a")).username;
  ten_b = (await dungTaiKhoan(b, "tn_b")).username;
});

test.afterAll(async () => {
  await a.context().close();
  await b.context().close();
});

test.describe("tin-nhan — nhắn tin riêng 1-1", () => {
  test("T1 — khách vào `/tin-nhan` bị đẩy về `/dang-nhap`", async ({ browser }) => {
    const an_danh = await browser.newContext();
    const khach = await an_danh.newPage();
    await khach.goto("/tin-nhan");
    await khach.waitForURL(/\/dang-nhap$/, { timeout: 15_000 });
    // Và phong bì trên header **không tồn tại** với khách: nó poll một endpoint trả 401.
    await expect(khach.getByTestId("thu-tin")).toHaveCount(0);
    await an_danh.close();
  });

  test("T2 — nút “Nhắn tin” có trên hồ sơ NGƯỜI KHÁC, không có trên hồ sơ mình", async () => {
    await a.goto(`/u/${ten_b}`);
    await expect(a.getByTestId("nut-nhan-tin")).toBeVisible();

    await a.goto(`/u/${ten_a}`);
    // Không phải "ẩn" mà là **không render** — một nút dẫn tới trang nhắn tin với chính
    // mình là một nút bấm vào ăn 400.
    await expect(a.getByTestId("nut-nhan-tin")).toHaveCount(0);
  });

  test("T3 — A gửi, B thấy số chưa đọc · chấm ở hộp thư · chuông · đọc là tắt", async () => {
    const cau = `Chào ${ten_b}, đây là tin thử ${Date.now()}`;

    await a.goto(`/u/${ten_b}`);
    await a.getByTestId("nut-nhan-tin").click();
    await a.waitForURL(new RegExp(`/tin-nhan/${ten_b}$`), { timeout: 15_000 });
    await expect(a.getByTestId("cuoc-tro-chuyen")).toBeVisible();

    await a.getByTestId("o-tin-nhan").fill(cau);
    // Enter gửi (Shift+Enter mới xuống dòng) — quy ước của mọi ô chat.
    await a.getByTestId("o-tin-nhan").press("Enter");
    await expect(a.locator('[data-testid="tin-nhan-dong"][data-cua-toi="1"]')).toContainText(
      cau,
    );

    // --- phía B: con số trên phong bì của header, ở một trang BẤT KỲ ---------
    await b.goto("/");
    await expect(b.getByTestId("thu-tin-so-chua-doc")).toHaveText("1", {
      timeout: 20_000,
    });

    // --- hộp thư: chấm chưa đọc trên đúng dòng ------------------------------
    await b.getByTestId("thu-tin").click();
    await b.waitForURL(/\/tin-nhan$/, { timeout: 15_000 });
    const dong = b.locator('[data-testid="hop-thu-dong"][data-chua-doc="1"]');
    await expect(dong).toHaveCount(1);
    await expect(dong.getByTestId("hop-thu-chua-doc")).toHaveText("1");

    // --- vào đọc: thấy tin của A, và chấm tắt NGAY --------------------------
    await dong.click();
    await b.waitForURL(new RegExp(`/tin-nhan/${ten_a}$`), { timeout: 15_000 });
    await expect(b.locator('[data-testid="tin-nhan-dong"][data-cua-toi="0"]')).toContainText(
      cau,
    );
    // `toHaveCount(0)`, không `toBeHidden()`: nguyên tắc 9 — không có gì chưa đọc thì
    // KHÔNG in số 0, tức nút chấm biến mất khỏi DOM. Và nó phải biến mất **ngay** nhờ
    // `CustomEvent`, không phải sau 60 giây poll — nên hạn ở đây cố tình ngắn.
    await expect(b.getByTestId("thu-tin-so-chua-doc")).toHaveCount(0, { timeout: 10_000 });

    // --- chuông: một dòng loại `tin_nhan` ------------------------------------
    await b.getByTestId("nut-chuong").click();
    await expect(b.locator('[data-testid="chuong-dong"][data-loai="tin_nhan"]')).toHaveCount(
      1,
    );
  });

  test("T4 — B trả lời, trang A ĐANG MỞ thấy tin trong ≤20 giây, KHÔNG reload", async () => {
    const tra_loi = `Trả lời tự động ${Date.now()}`;

    // A vẫn đang ở `/tin-nhan/<b>` từ bài T3 — không `goto` lại, vì cả điểm của bài này là
    // vòng poll 10 giây làm việc trên một trang không được tải lại.
    await expect(a).toHaveURL(new RegExp(`/tin-nhan/${ten_b}$`));
    const truoc = await a.locator('[data-testid="tin-nhan-dong"]').count();

    await b.getByTestId("o-tin-nhan").fill(tra_loi);
    await b.getByTestId("nut-gui-tin").click();
    await expect(b.locator('[data-testid="tin-nhan-dong"][data-cua-toi="1"]')).toContainText(
      tra_loi,
    );

    await expect(a.locator('[data-testid="tin-nhan-dong"][data-cua-toi="0"]')).toContainText(
      tra_loi,
      { timeout: 20_000 },
    );
    expect(await a.locator('[data-testid="tin-nhan-dong"]').count()).toBe(truoc + 1);
  });
});
