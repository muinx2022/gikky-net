import { expect, test, type Page } from "@playwright/test";

import { dungTaiKhoan } from "./danh-tinh";

/** **Phase 5 — ảnh, từ TRÌNH DUYỆT THẬT** (tiêu chí A1, và vế UI của A3/A5).
 *
 * ⚠ **BỘ NÀY CHƯA ĐƯỢC CHẠY LẦN NÀO.** Nó được viết trong một worktree bị cấm chiếm cổng
 * 3000/8000 và cấm chạm `gikky_dev` (một agent khác đang giữ độc quyền các tài nguyên
 * đó), mà `pnpm e2e` cần đủ cả ba. Phiên chính phải chạy nó sau khi gộp, và **coi mọi
 * bài ở đây là chưa có bằng chứng cho tới lúc đó**.
 *
 * Cái nó đo mà pytest không đo được: `<input type="file">` có thật sự gắn được ảnh vào
 * request multipart không, ảnh có hiện trong gallery không, và **tải lại trang thì còn
 * không** — tức file có thật sự nằm trên đĩa và có thật sự được phục vụ qua `/media/`.
 * Bảy phép kiểm ở tầng byte đã có bộ đo dày bên Python (`api/tests/test_anh_*.py`); ở đây
 * chỉ giữ hai ca đại diện để chứng minh chúng còn đúng khi đi qua đường HTTP thật.
 *
 * `setInputFiles` nhận buffer thẳng, không cần file trên đĩa — nên bộ này không kéo theo
 * một thư mục fixture ảnh nào.
 */

const SUB = "chung-khoan";

/** JPEG nhỏ nhất có thể, dựng bằng canvas trong chính trình duyệt đang chạy test.
 *
 * Sinh ở phía trình duyệt chứ không nhúng một chuỗi base64 vào file này: một chuỗi
 * base64 dài 40 dòng là thứ không ai đọc lại được, và nó là đúng loại "dữ liệu ma thuật"
 * mà người sửa sau sẽ không dám đụng.
 */
async function anhJpeg(page: Page, mau = "#c0392b"): Promise<Buffer> {
  const b64 = await page.evaluate((m) => {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 180;
    const ctx = c.getContext("2d");
    if (ctx === null) throw new Error("không lấy được canvas 2d");
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  }, mau);
  return Buffer.from(b64, "base64");
}

async function dangBaiCoAnh(
  page: Page,
  title: string,
  anhs: { name: string; mimeType: string; buffer: Buffer }[],
): Promise<string> {
  await page.goto("/dang-mach");
  await page.getByTestId("dang-mach-sub").selectOption(SUB);
  await page.getByTestId("dang-mach-title").fill(title);
  await page.getByTestId("dang-mach-body").fill("Vào lệnh, kèm ảnh bảng giá.");
  await page.getByTestId("dang-mach-anh-input").setInputFiles(anhs);
  await page.getByTestId("dang-mach-gui").click();
  await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 60_000 });
  return new URL(page.url()).pathname;
}

test.describe("Phase 5 — ảnh", () => {
  test("A1 — upload từ trình duyệt → hiện trong gallery → TẢI LẠI vẫn còn", async ({
    page,
  }) => {
    await dungTaiKhoan(page, "anh1");
    await page.goto("/");
    const buffer = await anhJpeg(page);

    await dangBaiCoAnh(page, `Mạch có ảnh ${Date.now()}`, [
      { name: "bang-gia.jpg", mimeType: "image/jpeg", buffer },
    ]);

    const gallery = page.getByTestId("gallery-moc-1");
    await expect(gallery).toHaveAttribute("data-so-anh", "1");

    // Vế QUAN TRỌNG NHẤT của A1, và là vế một bài đo hời hợt sẽ bỏ qua: tải lại trang.
    // Ảnh hiện ngay sau upload chỉ chứng minh response đúng; ảnh còn sau F5 mới chứng
    // minh **file nằm trên đĩa và được phục vụ thật**.
    await page.reload();
    await expect(page.getByTestId("gallery-moc-1")).toHaveAttribute("data-so-anh", "1");

    // Và `/media/...` phải trả ảnh thật, không phải 404 hay một trang HTML.
    const src = await page.getByTestId("gallery-moc-1").locator("img").first().getAttribute("src");
    expect(src).toMatch(/^\/media\//);
    const r = await page.request.get(new URL(src ?? "", page.url()).toString());
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/");
  });

  test("A1b — mốc KHÔNG ảnh thì không render khung nào (nguyên tắc 9)", async ({
    page,
  }) => {
    await dungTaiKhoan(page, "anh2");
    await page.goto("/dang-mach");
    await page.getByTestId("dang-mach-sub").selectOption(SUB);
    await page.getByTestId("dang-mach-title").fill(`Mạch không ảnh ${Date.now()}`);
    await page.getByTestId("dang-mach-body").fill("Không kèm ảnh nào.");
    await page.getByTestId("dang-mach-gui").click();
    await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 60_000 });

    // Không phải "khung rỗng ẩn đi" — không có phần tử nào cả.
    await expect(page.getByTestId("gallery-moc-1")).toHaveCount(0);
  });

  test("xem trước + bỏ một tấm TRƯỚC khi gửi, không tấm nào lên", async ({ page }) => {
    await dungTaiKhoan(page, "anh3");
    await page.goto("/dang-mach");
    const buffer = await anhJpeg(page);

    await page.getByTestId("dang-mach-sub").selectOption(SUB);
    await page.getByTestId("dang-mach-title").fill(`Bỏ ảnh trước khi gửi ${Date.now()}`);
    await page.getByTestId("dang-mach-body").fill("Chọn hai, bỏ một, còn một.");
    await page.getByTestId("dang-mach-anh-input").setInputFiles([
      { name: "mot.jpg", mimeType: "image/jpeg", buffer },
      { name: "hai.jpg", mimeType: "image/jpeg", buffer },
    ]);
    await expect(page.getByTestId("dang-mach-anh-the")).toHaveCount(2);

    await page.getByTestId("dang-mach-anh-bo").first().click();
    await expect(page.getByTestId("dang-mach-anh-the")).toHaveCount(1);

    await page.getByTestId("dang-mach-gui").click();
    await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 60_000 });
    await expect(page.getByTestId("gallery-moc-1")).toHaveAttribute("data-so-anh", "1");
  });

  test("A5 — file KHÔNG phải ảnh, đổi đuôi `.jpg`, bị từ chối và nói bằng tiếng người", async ({
    page,
  }) => {
    await dungTaiKhoan(page, "anh4");
    await page.goto("/dang-mach");

    await page.getByTestId("dang-mach-sub").selectOption(SUB);
    await page.getByTestId("dang-mach-title").fill(`Ảnh giả ${Date.now()}`);
    await page.getByTestId("dang-mach-body").fill("Gửi một file PHP đội lốt JPEG.");
    // Tên `.jpg` + `Content-Type: image/jpeg` — cả hai NÓI DỐI, và cả hai do client đặt.
    await page.getByTestId("dang-mach-anh-input").setInputFiles([
      {
        name: "khong-phai-anh.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("<?php system($_GET['c']); ?>"),
      },
    ]);
    await page.getByTestId("dang-mach-gui").click();

    // Bài VẪN đăng (nội dung là thứ người ta viết ra), nhưng câu lỗi phải nói rõ ảnh
    // không lên — và nói bằng tiếng Việt, không phải một mã lỗi.
    const loi = page.getByTestId("dang-mach-loi");
    await expect(loi).toBeVisible({ timeout: 60_000 });
    await expect(loi).toContainText("khong-phai-anh.jpg");
    await expect(loi).toContainText(/không phải ảnh|JPEG, PNG hoặc WebP/i);
  });

  test("A3 — ô chọn ảnh chặn TẠI CHỖ khi đã đủ trần", async ({ page }) => {
    await dungTaiKhoan(page, "anh5");
    await page.goto("/dang-mach");
    const buffer = await anhJpeg(page);

    // 12 tấm cho một trần 10: ô chọn phải cắt xuống 10 và nói ra đã bỏ mấy tấm, chứ
    // không để hai tấm cuối đi tới server rồi ăn 409.
    await page.getByTestId("dang-mach-anh-input").setInputFiles(
      Array.from({ length: 12 }, (_, i) => ({
        name: `anh-${i}.jpg`,
        mimeType: "image/jpeg",
        buffer,
      })),
    );
    await expect(page.getByTestId("dang-mach-anh-the")).toHaveCount(10);
    await expect(page.getByTestId("dang-mach-anh-loi")).toContainText("tối đa 10 ảnh");
    // Nút chọn tự nói ra là đã đầy, thay vì im lặng không phản ứng khi bấm tiếp.
    await expect(page.getByTestId("dang-mach-anh-nut")).toHaveText(/Đã đủ 10 ảnh/);
  });

  test("gỡ một ảnh ĐÃ LƯU ở form sửa mốc thì nó biến khỏi gallery", async ({ page }) => {
    await dungTaiKhoan(page, "anh6");
    await page.goto("/");
    const buffer = await anhJpeg(page);

    await dangBaiCoAnh(page, `Gỡ ảnh đã lưu ${Date.now()}`, [
      { name: "mot.jpg", mimeType: "image/jpeg", buffer },
      { name: "hai.jpg", mimeType: "image/jpeg", buffer },
    ]);
    await expect(page.getByTestId("gallery-moc-1")).toHaveAttribute("data-so-anh", "2");

    const the = page.getByTestId("moc-1");
    await the.getByTestId("menu-moc").click();
    await the.getByTestId("nut-sua-moc").click();
    await expect(the.getByTestId("anh-da-luu").locator("li")).toHaveCount(2);

    await the.getByTestId("anh-da-luu-go").first().click();
    await expect(page.getByTestId("gallery-moc-1")).toHaveAttribute("data-so-anh", "1", {
      timeout: 30_000,
    });

    // Và nó mất THẬT, không chỉ mất khỏi trang: tải lại vẫn một tấm.
    await page.reload();
    await expect(page.getByTestId("gallery-moc-1")).toHaveAttribute("data-so-anh", "1");
  });
});
