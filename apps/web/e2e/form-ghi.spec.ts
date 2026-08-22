import { expect, test, type Page } from "@playwright/test";

import { homNayVN } from "../lib/vong-doi";
import { dungTaiKhoan } from "./danh-tinh";
import { TITLE_HPG, duongDan, timMachTheoTitle } from "./du-lieu";

/** **Mảng B — vòng lặp lõi chạy được từ TRÌNH DUYỆT**: đăng bài · nối mốc · sửa · xoá ·
 * đóng sổ · mở lại (PLAN 5.1, 5.2).
 *
 * Trước mảng này, `apps/web` **không có form ghi nào**: API đủ và có test Python đủ, nhưng
 * mở trình duyệt lên thì không tạo được mạch. Bài đo cũ (`tai-khoan-va-ghi.spec.ts`) dựng
 * mạch bằng `request.post` — chứng minh API sống, **không** chứng minh có ai dùng được nó.
 * Nên luật của file này: **mọi thứ đi qua bàn phím và con chuột**, không một lời gọi HTTP
 * tay nào ở nhánh ghi.
 *
 * Nguồn sự thật để đối chiếu vẫn là **Django**, không phải HTML mình vừa render
 * (`timMachTheoTitle` gọi thẳng cổng 8000) — một bài đo so HTML với HTML chỉ chứng minh
 * trang bằng chính nó.
 */

const SUB = "chung-khoan";

/** Đăng một bài mới **bằng giao diện**, trả về đường dẫn trang mạch vừa tạo. */
async function dangBai(
  page: Page,
  title: string,
  than: string,
): Promise<string> {
  await page.goto("/dang-mach");
  await page.getByTestId("dang-mach-sub").selectOption(SUB);
  await page.getByTestId("dang-mach-title").fill(title);
  await page.getByTestId("dang-mach-body").fill(than);
  await page.getByTestId("dang-mach-gui").click();
  await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
  return new URL(page.url()).pathname;
}

/** Nối một mốc **bằng giao diện**, từ trang mạch đang mở. */
async function noiMocQuaForm(page: Page, than: string): Promise<void> {
  await page.getByTestId("nut-noi-moc").click();
  await page.getByTestId("noi-moc-body").fill(than);
  await page.getByTestId("noi-moc-gui").click();
}

test.describe("B — form ghi: vòng lặp lõi chạy thật trong trình duyệt", () => {
  test("B1 — TẠO ĐƯỢC MỘT MẠCH từ trình duyệt, và Django xác nhận nó có thật", async ({
    page,
  }) => {
    const ai = await dungTaiKhoan(page, "b1");

    // Lối vào phải TÌM ĐƯỢC, không phải gõ URL: một form không có cửa nào dẫn tới thì
    // với người dùng nó không tồn tại.
    await page.goto("/");
    await page.getByTestId("nut-dang-mach").click();
    await expect(page).toHaveURL(/\/dang-mach$/);

    // Ngày sự việc điền sẵn = hôm nay GIỜ VN (PLAN 5.2). Ghim luôn ở đây vì đây là chỗ
    // duy nhất người dùng thấy nó trước khi gửi, và lệch múi giờ thì server từ chối đúng
    // cái ngày mà người dùng đang sống trong đó.
    await expect(page.getByTestId("dang-mach-occurred-at")).toHaveValue(homNayVN());

    const title = `Nhật ký lệnh của ${ai.username}`;
    const than = "Vào **HPG** 27.80 vì nền tích luỹ sáu tuần chưa gãy.";
    await page.getByTestId("dang-mach-sub").selectOption(SUB);
    await page.getByTestId("dang-mach-title").fill(title);
    await page.getByTestId("dang-mach-body").fill(than);
    await page.getByTestId("dang-mach-gui").click();

    // Đăng xong ĐI THẲNG tới mạch vừa tạo — không quay về feed rồi để người ta tự tìm.
    await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByTestId("moc-1")).toContainText("nền tích luỹ sáu tuần");
    // Markdown render thật, không in ra dấu sao.
    await expect(page.getByTestId("moc-1").locator("strong")).toHaveText("HPG");
    // Một mốc ⇒ vẫn là BÀI THƯỜNG, không phải mạch (PLAN nguyên tắc 1, 5.1).
    await expect(page.getByTestId("moc-1")).toHaveAttribute("data-kieu", "don");
    await expect(page.getByTestId("banner-trang-thai")).toHaveText("Bài thường");

    // Vế chống "trang tự chứng minh trang": hỏi thẳng Django xem hàng đó có thật không.
    const mach = await timMachTheoTitle(title);
    expect(mach.author.username).toBe(ai.username);
    expect(mach.sub.slug).toBe(SUB);
    expect(mach.entry_count).toBe(1);
    expect(mach.mocs[0].body).toContain("nền tích luỹ sáu tuần");
    expect(mach.mocs[0].occurred_at).toBe(homNayVN());
    expect(duongDan(mach)).toBe(new URL(page.url()).pathname);
  });

  test("B2 — nối mốc bật UI mạch, và hạn mức 3 mốc/ngày nói bằng TIẾNG NGƯỜI", async ({
    page,
  }) => {
    const ai = await dungTaiKhoan(page, "b2");
    await dangBai(page, `Hạn mức của ${ai.username}`, "Mốc 1 — vào lệnh.");

    // Mốc 2: UI mạch bật (spine + ngăn kéo) — PLAN 5.1 "UI mạch bật từ mốc 2".
    await noiMocQuaForm(page, "Mốc 2 — nâng dừng lỗ lên 26.40.");
    await expect(page.getByTestId("moc-2")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("moc-1")).toHaveAttribute("data-kieu", "mach");
    await expect(page.getByTestId("chu-ky-so-moc")).toHaveText("2 mốc");

    // Mốc 3: chạm trần của ngày.
    await noiMocQuaForm(page, "Mốc 3 — chốt 1/3 ở 29.10.");
    await expect(page.getByTestId("moc-3")).toBeVisible({ timeout: 20_000 });

    // Mốc 4 trong cùng ngày ⇒ 429 `qua_han_muc_moc`.
    await noiMocQuaForm(page, "Mốc 4 — cái này phải bị chặn.");
    const loi = page.getByTestId("chu-mach-loi");
    await expect(loi).toBeVisible({ timeout: 20_000 });
    const chu = await loi.innerText();

    // Câu của server (PLAN 5.1 "mai nối tiếp nhé")…
    expect(chu).toContain("mai nối tiếp");
    // …cộng đúng thứ server KHÔNG nói: bao giờ thì viết tiếp được.
    expect(chu).toMatch(/Viết tiếp được từ 00:00 ngày \d{2}\/\d{2} \(giờ VN\)/);
    // …và tuyệt đối không có mã máy nào lọt ra mặt người dùng.
    expect(chu).not.toContain("429");
    expect(chu).not.toContain("qua_han_muc_moc");

    // Mốc thứ tư KHÔNG ra đời — lỗi không được nuốt thành "có vẻ xong".
    await expect(page.getByTestId("moc-4")).toHaveCount(0);
    const mach = await timMachTheoTitle(`Hạn mức của ${ai.username}`);
    expect(mach.entry_count).toBe(3);
  });

  test("B3 — sửa mốc: NÓI TRƯỚC là sẽ để dấu «đã sửa», rồi lưu thật", async ({
    page,
  }) => {
    const ai = await dungTaiKhoan(page, "b3");
    const title = `Sửa mốc của ${ai.username}`;
    await dangBai(page, title, "Bản đầu — vào lệnh 27.80.");

    const the = page.getByTestId("moc-1");
    await the.getByTestId("menu-moc").click();
    await the.getByTestId("nut-sua-moc").click();

    // PLAN nguyên tắc 2: người ta phải biết cái giá TRƯỚC khi bấm Lưu, không phải sau.
    const nhac = the.getByTestId("nhac-da-sua");
    await expect(nhac).toBeVisible();
    await expect(nhac).toContainText("đã sửa");

    await the.getByTestId("sua-moc-body").fill("Bản sửa — vào lệnh 27.80, dừng lỗ 26.40.");
    await the.getByTestId("sua-moc-luu").click();

    await expect(page.getByTestId("moc-1")).toContainText("dừng lỗ 26.40", {
      timeout: 20_000,
    });
    const mach = await timMachTheoTitle(title);
    expect(mach.mocs[0].body).toContain("dừng lỗ 26.40");
  });

  test("B4 — xoá mốc thành BIA MỘ, không biến mất khỏi nhật ký", async ({ page }) => {
    const ai = await dungTaiKhoan(page, "b4");
    const title = `Bia mộ của ${ai.username}`;
    await dangBai(page, title, "Mốc 1 — ở lại.");
    await noiMocQuaForm(page, "Mốc 2 — sắp bị xoá.");
    await expect(page.getByTestId("moc-2")).toBeVisible({ timeout: 20_000 });

    // Hộp xác nhận phải nói ĐÚNG chuyện sắp xảy ra: nội dung mất, cái ô thì ở lại.
    let nhan = "";
    page.once("dialog", (d) => {
      nhan = d.message();
      void d.accept();
    });
    const the = page.getByTestId("moc-2");
    await the.getByTestId("menu-moc").click();
    await the.getByTestId("nut-xoa-moc").click();

    await expect(page.getByTestId("moc-2")).toHaveAttribute("data-trang-thai", "da_xoa", {
      timeout: 20_000,
    });
    expect(nhan).toContain("bia mộ");
    expect(nhan).toContain("số thứ tự");

    // Ô vẫn còn chỗ, nội dung thì không — `seq` bất biến (PLAN 5.2).
    await expect(page.getByTestId("moc-2").getByTestId("bia-mo-moc")).toHaveText(
      "[mốc đã xoá]",
    );
    await expect(page.getByTestId("moc-2")).not.toContainText("sắp bị xoá");
    // Và menu `⋯` biến mất khỏi bia mộ — API trả 409 cho mọi thao tác lên nó.
    await expect(page.getByTestId("moc-2").getByTestId("menu-moc")).toHaveCount(0);

    const mach = await timMachTheoTitle(title);
    expect(mach.entry_count).toBe(2);
    expect(mach.mocs[1].trang_thai).toBe("da_xoa");
  });

  test("B5 — đóng sổ kèm kết quả, rồi mở lại (kết quả bị xoá theo)", async ({ page }) => {
    const ai = await dungTaiKhoan(page, "b5");
    const title = `Đóng sổ của ${ai.username}`;
    await dangBai(page, title, "Mốc 1 — vào lệnh.");
    await noiMocQuaForm(page, "Mốc 2 — tổng kết.");
    await expect(page.getByTestId("moc-2")).toBeVisible({ timeout: 20_000 });

    const KET_QUA = "+18.2% · 163 ngày";
    let nhac_dong = "";
    page.once("dialog", (d) => {
      nhac_dong = d.message();
      void d.accept();
    });
    await page.getByTestId("nut-dong-so").click();
    await page.getByTestId("dong-so-ket-qua").fill(KET_QUA);
    await page.getByTestId("dong-so-gui").click();

    await expect(page.getByTestId("banner-trang-thai")).toHaveText("Mạch đã đóng", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("banner-ket-qua")).toHaveText(KET_QUA);
    // Xác nhận phải nói ra cả ba hệ quả — đóng sổ là hành động một chiều trên thực tế.
    expect(nhac_dong).toContain("Không nối thêm mốc");
    expect(nhac_dong).toContain("Bình luận thì vẫn viết được");
    expect(nhac_dong).toContain("7 ngày");

    // Đóng rồi thì không còn cửa nối mốc; cửa mở lại thì có (còn trong 7 ngày).
    await expect(page.getByTestId("nut-noi-moc")).toHaveCount(0);
    await expect(page.getByTestId("nut-mo-lai")).toBeVisible();

    page.once("dialog", (d) => void d.accept());
    await page.getByTestId("nut-mo-lai").click();
    await expect(page.getByTestId("banner-trang-thai")).toHaveText("Mạch đang mở", {
      timeout: 20_000,
    });
    // `ket_qua` bị xoá khi mở lại (`api/machs.py::mo_lai_mach`) — banner phải ẩn hẳn nó,
    // không để lại một dấu `·` lơ lửng.
    await expect(page.getByTestId("banner-ket-qua")).toHaveCount(0);
    await expect(page.getByTestId("nut-noi-moc")).toBeVisible();

    const mach = await timMachTheoTitle(title);
    expect(mach.status).toBe("open");
    expect(mach.ket_qua).toBeNull();
  });

  test("B6 — người lạ KHÔNG thấy khu chủ mạch, dù đã đăng nhập tử tế", async ({
    page,
  }) => {
    // Vế chặn thật nằm ở API (`test_quyen_ghi.py` — 403 `khong_phai_chu`); bài này ghim
    // rằng UI **không mời** người ta làm việc sẽ bị từ chối. Mạch HPG là của user seed.
    await dungTaiKhoan(page, "b6");
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(duongDan(hpg));

    // Vế chống rỗng: trang ĐÃ render và người này ĐANG đăng nhập — nếu không thì bài đo
    // dưới xanh vì lý do chẳng liên quan gì tới quyền.
    await expect(page.getByTestId("moc-1")).toBeVisible();
    await expect(page.getByTestId("nut-tai-khoan")).toBeVisible();

    await expect(page.getByTestId("khoi-chu-mach")).toHaveCount(0);
    await expect(page.getByTestId("nut-noi-moc")).toHaveCount(0);
    await expect(page.getByTestId("nut-dong-so")).toHaveCount(0);
    // Và không có menu `⋯` nào trên mốc của người khác.
    await expect(page.getByTestId("menu-moc")).toHaveCount(0);
  });

  test("B7 — khách: lối đăng nhập, KHÔNG phải một cái form vô dụng", async ({ page }) => {
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(duongDan(hpg));
    await expect(page.getByTestId("thanh-tai-khoan-khach")).toBeVisible();
    // PLAN mục 4: nút vĩnh viễn không bấm được thì đừng render.
    await expect(page.getByTestId("nut-dang-mach")).toHaveCount(0);
    await expect(page.getByTestId("khoi-chu-mach")).toHaveCount(0);
    await expect(page.getByTestId("menu-moc")).toHaveCount(0);

    // Vào thẳng `/dang-mach` bằng URL vẫn phải tử tế: một lời mời, không một form rỗng
    // gõ xong mới báo 401.
    await page.goto("/dang-mach");
    const moi = page.getByTestId("dang-mach-khach");
    await expect(moi).toBeVisible();
    await expect(moi.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute(
      "href",
      "/dang-nhap",
    );
    await expect(page.getByTestId("form-dang-mach")).toHaveCount(0);
  });
});
