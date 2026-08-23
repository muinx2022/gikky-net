import { expect, test } from "@playwright/test";

import { LY_DO_CHUA_DANG_NHAP } from "../lib/vote";
import { MAT_KHAU, danhTinhMoi, dungTaiKhoan } from "./danh-tinh";
import { TITLE_HPG, duongDan, timMachTheoTitle } from "./du-lieu";

/** **M1 + M3 ở tầng trình duyệt** — luồng tài khoản và đường ghi, chạy thật.
 *
 * Bài đo Python (`api/tests/test_quyen_ghi.py`) đã ghim phân quyền ở tầng API. File này
 * ghim thứ tầng API không nói được: *người dùng thật, trong một trình duyệt thật, có đi
 * hết được luồng không* — kể cả những chỗ chỉ hỏng ở trình duyệt: cookie CSRF chưa có,
 * link trong email trỏ sai cổng, nút không hiện vì `GET /me` chưa trả lời.
 *
 * **Xác thực email đi qua HỘP THƯ THẬT** (`api/.mail/`, `EMAIL_BACKEND = filebased`).
 * Không `EmailAddress.objects.update(verified=True)` cho nhanh: chốt của plan mảng A là
 * *"đọc từ file vẫn là luồng thật, khác hẳn việc tắt xác thực đi cho dễ"*.
 *
 * Luồng dựng tài khoản ấy nay ở `e2e/danh-tinh.ts` — mảng B (form ghi) cần đúng nó, và
 * hai bản sao của một đoạn chờ file trên đĩa là hai bản sẽ lệch nhau ở chỗ chờ.
 */

/* ---- M1: đăng ký → xác thực → đăng nhập → header → đăng xuất --------------- */

test.describe("M1 — luồng tài khoản chạy thật, qua hộp thư thật", () => {
  test("đăng ký · nhận mail · xác thực · đăng nhập · header hiện user · đăng xuất", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("thanh-tai-khoan-khach")).toBeVisible();

    const ai = await dungTaiKhoan(page, "m1");

    // Header hiện user trên MỌI trang, kể cả trang tĩnh `/luat` — đó là điều kiện của
    // cách cài (client component hỏi `GET /me`), và nếu ai đó chuyển nó sang server thì
    // `/luat` thôi tĩnh và bài này vẫn xanh nhưng `trang-loi.spec.ts` sẽ đỏ.
    await page.goto("/luat");
    await expect(page.getByTestId("nut-tai-khoan")).toHaveText(`u/${ai.username}`);

    await page.getByTestId("nut-tai-khoan").click();
    await page.getByTestId("nut-dang-xuat").click();
    await expect(page.getByTestId("thanh-tai-khoan-khach")).toBeVisible();
  });

  test("chưa xác thực email thì CHƯA đăng nhập được", async ({ page }) => {
    // Xác thực bắt buộc mà đăng nhập vẫn lọt thì cái "bắt buộc" chỉ là một dòng cấu hình.
    const ai = danhTinhMoi("chua_xt");
    await page.goto("/dang-ky");
    await page.getByTestId("o-email").fill(ai.email);
    await page.getByTestId("o-username").fill(ai.username);
    await page.getByTestId("o-password").fill(MAT_KHAU);
    await page.getByTestId("form-gui").click();
    await expect(page.getByTestId("form-xong")).toBeVisible();

    await page.goto("/dang-nhap");
    await page.getByTestId("o-email").fill(ai.email);
    await page.getByTestId("o-password").fill(MAT_KHAU);
    await page.getByTestId("form-gui").click();
    await expect(page.getByTestId("form-loi")).toBeVisible();
    await expect(page.getByTestId("nut-tai-khoan")).toHaveCount(0);
  });

  test("sai mật khẩu thì NÓI RA, không im lặng", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.getByTestId("o-email").fill("khong-ton-tai@gikky.test");
    await page.getByTestId("o-password").fill("sai-be-bet");
    await page.getByTestId("form-gui").click();
    await expect(page.getByTestId("form-loi")).toBeVisible();
  });

  test("M2 — Google tắt ⇒ nút VẮNG MẶT, không phải disabled", async ({ page }) => {
    // PLAN mục 4: "một cái nút vĩnh viễn không bấm được còn tệ hơn không có nút". Máy dev
    // không có `GOOGLE_CLIENT_ID`, nên đây là trạng thái thật của môi trường đang đo.
    for (const url of ["/dang-nhap", "/dang-ky"]) {
      await page.goto(url);
      await expect(page.getByTestId("nut-google"), url).toHaveCount(0);
      const than = (await page.locator("main").innerText()).toLowerCase();
      expect(than, url).not.toContain("google");
    }
  });

  test("quên mật khẩu: gửi mail, và câu trả lời KHÔNG tiết lộ email có tồn tại hay không", async ({
    page,
  }) => {
    await page.goto("/quen-mat-khau");
    await page.getByTestId("o-email").fill("chac-chan-khong-co@gikky.test");
    await page.getByTestId("form-gui").click();
    const chu = await page.getByTestId("form-xong").innerText();
    // `ACCOUNT_PREVENT_ENUMERATION` giữ cho API không tiết lộ; câu chữ ở UI không được
    // tiết lộ hộ nó.
    expect(chu).toContain("Nếu email này có tài khoản");
  });
});

/* ---- M3 + đường ghi ở trình duyệt ----------------------------------------- */

test.describe("Đường ghi — đăng bài, nối mốc, bình luận, vote", () => {
  test("đăng bài → nối mốc 2 → spine + ngăn kéo xuất hiện (UI mạch BẬT)", async ({
    page,
    request,
  }) => {
    const ai = await dungTaiKhoan(page, "ghi");

    // Đăng bài + nối mốc đi qua API (chưa có form đăng bài ở Phase 2 — xem nợ
    // `FORM-DANG-BAI` trong báo cáo). Nhưng nó đi bằng **cookie phiên của chính trình
    // duyệt này** cộng header CSRF, tức vẫn là đường ghi thật của một người đã đăng nhập.
    const csrf = (await page.context().cookies()).find((c) => c.name === "csrftoken");
    expect(csrf, "chưa có cookie csrftoken sau khi đăng nhập").toBeDefined();
    const header = {
      "Content-Type": "application/json",
      "X-CSRFToken": csrf!.value,
      Cookie: (await page.context().cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; "),
    };

    const tao = await request.post("/api/v1/machs", {
      headers: header,
      data: { sub: "chung-khoan", title: `Nhật ký của ${ai.username}`, body: "Mốc 1." },
    });
    expect(tao.status(), await tao.text()).toBe(201);
    const mach = (await tao.json()) as { id: number; slug: string };

    await page.goto(`/m/${mach.slug}-${mach.id}`);
    // `entry_count == 1` ⇒ render như post thường: KHÔNG spine, KHÔNG ngăn kéo (PLAN 5.1).
    await expect(page.getByTestId("moc-1")).toHaveAttribute("data-kieu", "don");

    const noi = await request.post(`/api/v1/machs/${mach.id}/mocs`, {
      headers: header,
      data: { body: "Mốc 2 — nâng dừng lỗ." },
    });
    expect(noi.status(), await noi.text()).toBe(201);

    await page.goto(`/m/${mach.slug}-${mach.id}`);
    // Mạch đang sống ⇒ mặt BÃO (Phase 3): mốc mới nhất mở sẵn, phần còn lại sau
    // "mở cả mạch ▾" (PLAN 5.5).
    await expect(page.getByTestId("moc-2")).toBeVisible();
    await page.getByTestId("nut-mo-ca-mach").click();
    await expect(page.getByTestId("moc-1")).toHaveAttribute("data-kieu", "mach");
  });

  test("bình luận từ composer khán đài, rồi tự sửa và tự xoá được", async ({ page }) => {
    const ai = await dungTaiKhoan(page, "bl");
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat`);

    const chu = `Bình luận của ${ai.username} lúc ${Date.now()}`;
    const composer = page.getByTestId("khan-dai").getByTestId("composer");
    await composer.getByTestId("composer-o").fill(chu);
    await composer.getByTestId("composer-gui").click();

    const cay = page.getByTestId("cay-khan-dai");
    await expect(cay.getByText(chu)).toBeVisible({ timeout: 15_000 });

    // Menu `⋯` chỉ hiện trên bình luận CỦA TÔI.
    const nut = cay.locator("[data-binh-luan-id]").filter({ hasText: chu }).first();
    await nut.getByTestId("menu-binh-luan").first().click();
    await nut.getByTestId("nut-sua-binh-luan").first().click();
    const chu2 = `${chu} (đã sửa)`;
    await nut.getByTestId("o-sua-binh-luan").first().fill(chu2);
    await nut.getByTestId("nut-luu-sua").first().click();
    await expect(cay.getByText(chu2)).toBeVisible({ timeout: 15_000 });

    page.once("dialog", (d) => void d.accept());
    const nut2 = cay.locator("[data-binh-luan-id]").filter({ hasText: chu2 }).first();
    await nut2.getByTestId("menu-binh-luan").first().click();
    await nut2.getByTestId("nut-xoa-binh-luan").first().click();
    await expect(cay.getByText(chu2)).toHaveCount(0, { timeout: 15_000 });
  });

  test("M3 ở tầng UI — bình luận của NGƯỜI KHÁC: không sửa/xoá được, chỉ báo cáo", async ({
    page,
  }) => {
    // Vế chặn thật nằm ở API (`test_quyen_ghi.py`); bài này ghim rằng UI **không mời**
    // người ta làm việc sẽ bị từ chối. Seed HPG có 24 bình luận của user khác.
    //
    // Từ lượt vá V1 (L03) menu `⋯` **có** trên bình luận của người khác — chứa đúng một
    // mục "Báo cáo" (PLAN 5.10). Bài đo đòi cả hai vế: hai nút ghi vắng mặt, cửa báo cáo
    // có mặt. Bản cũ chỉ đòi "menu vắng", và câu đó cũng xanh trong ca UI mất luôn nút
    // báo cáo — tức nó không phân biệt được bản vá với lỗi.
    await dungTaiKhoan(page, "khac");
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=cu_nhat`);
    const cay = page.getByTestId("cay-khan-dai");
    await expect(cay.getByTestId("nut-tra-loi").first()).toBeVisible();
    await cay.getByTestId("menu-binh-luan").first().click();
    await expect(cay.getByTestId("nut-sua-binh-luan")).toHaveCount(0);
    await expect(cay.getByTestId("nut-xoa-binh-luan")).toHaveCount(0);
    await expect(cay.getByTestId("nut-bao-cao-binh-luan").first()).toBeVisible();
  });

  test("báo cáo một bình luận của người khác — cửa nhận SỐNG, và chống trùng có thật (L03)", async ({
    page,
  }) => {
    // `POST /reports` là cửa mà PLAN 5.10 đòi và Phase 4 quên cài: nó dựng trọn hàng đợi
    // kiểm duyệt, `dong_bao_cao`, `AuditLog`, trang admin — rồi không có đường nào để một
    // báo cáo vào được hàng đợi ấy. Bài đo đi đúng đường người dùng đi: menu `⋯` → chọn lý
    // do → gửi, rồi bấm lần thứ hai để thấy chống trùng nói ra thành lời.
    await dungTaiKhoan(page, "tocao");
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=cu_nhat`);
    const cay = page.getByTestId("cay-khan-dai");

    await cay.getByTestId("menu-binh-luan").first().click();
    await cay.getByTestId("nut-bao-cao-binh-luan").first().click();
    await cay.getByTestId("bao-cao-ly-do").first().selectOption("lua_dao");
    await cay.getByTestId("bao-cao-ghi-chu").first().fill("Mời uỷ thác trong bình luận.");
    await cay.getByTestId("bao-cao-gui").first().click();
    await expect(cay.getByTestId("bao-cao-xong").first()).toBeVisible({ timeout: 15_000 });

    // Lần thứ hai vào cùng một đích: 409 `da_bao_cao`, và câu của server hiện ra chứ
    // không nuốt thành "Không gửi được". Đây cũng là vế chống rỗng — nếu lượt đầu không
    // thật sự ghi một hàng thì lượt này sẽ thành công lần nữa.
    await page.reload();
    const cay2 = page.getByTestId("cay-khan-dai");
    await cay2.getByTestId("menu-binh-luan").first().click();
    await cay2.getByTestId("nut-bao-cao-binh-luan").first().click();
    await cay2.getByTestId("bao-cao-gui").first().click();
    await expect(cay2.getByTestId("bao-cao-loi").first()).toContainText("đã báo cáo", {
      timeout: 15_000,
    });
  });

  test("mũi tên vote SỐNG khi đã đăng nhập, và con số về đúng sau khi rút", async ({
    page,
  }) => {
    await dungTaiKhoan(page, "vote");
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(duongDan(hpg));

    const cot = page.getByTestId("moc-9").getByTestId("cot-vote-moc");
    const so = cot.getByTestId("cot-vote-diem");
    const truoc = Number((await so.innerText()).replace("+", ""));

    const len = cot.getByTestId("mui-ten-len");
    await expect(len).toBeEnabled();
    await len.click();
    await expect(so).toHaveText(`+${truoc + 1}`);
    await expect(len).toHaveAttribute("aria-pressed", "true");

    // Bấm lại đúng mũi tên đang chọn = RÚT (PLAN mục 7: `value = 0`).
    await len.click();
    await expect(so).toHaveText(truoc === 0 ? "0" : `+${truoc}`);

    // Và phiếu THẬT SỰ vào DB, không chỉ đổi số trên màn hình: tải lại trang, con số
    // server trả về phải khớp. (Mũi tên nào là của tôi thì chưa sống qua lần tải lại —
    // nợ `VOTE-CUA-TOI`, xem `components/cot-vote.tsx`.)
    await len.click();
    await expect(so).toHaveText(`+${truoc + 1}`);
    await page.reload();
    await expect(
      page.getByTestId("moc-9").getByTestId("cot-vote-moc").getByTestId("cot-vote-diem"),
    ).toHaveText(`+${truoc + 1}`);
  });

  test("khách chưa đăng nhập: mũi tên khoá kèm ĐÚNG lý do, composer mời đăng nhập", async ({
    page,
  }) => {
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(`${duongDan(hpg)}?khan_dai=1`);
    // Scope tới `cot-vote-moc`: từ Phase 2 mỗi BÌNH LUẬN cũng có mũi tên, và ngăn kéo của
    // mốc 9 nằm bên trong `moc-9` — `getByTestId("moc-9").getByTestId("mui-ten-len")` vì
    // thế khớp 5 phần tử.
    const len = page
      .getByTestId("moc-9")
      .getByTestId("cot-vote-moc")
      .getByTestId("mui-ten-len");
    await expect(len).toBeDisabled();
    await expect(len).toHaveAttribute("title", LY_DO_CHUA_DANG_NHAP);
    // Scope tới khán đài: composer của các NGĂN KÉO đứng trước trong DOM và chúng nằm
    // trong `<details>` đang gập, tức `hidden` — `.first()` sẽ trúng một cái vô hình.
    await expect(
      page.getByTestId("khan-dai").getByTestId("composer-khach"),
    ).toBeVisible();
    await expect(page.getByTestId("nut-tra-loi")).toHaveCount(0);
  });

  test("markdown render thật, và `<script>` ra VĂN BẢN chứ không thành thẻ", async ({
    page,
  }) => {
    const ai = await dungTaiKhoan(page, "md");
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat`);

    const dau = `md-${ai.username}`;
    const chu = `${dau} **đậm** \`ma\` [link](https://gikky.net) <script>alert(1)</script>`;
    const composer = page.getByTestId("khan-dai").getByTestId("composer");
    await composer.getByTestId("composer-o").fill(chu);
    await composer.getByTestId("composer-gui").click();

    const nut = page
      .getByTestId("cay-khan-dai")
      .locator("[data-binh-luan-id]")
      .filter({ hasText: dau })
      .first();
    await expect(nut).toBeVisible({ timeout: 15_000 });
    await expect(nut.locator("strong")).toHaveText("đậm");
    await expect(nut.locator("code")).toHaveText("ma");
    await expect(nut.getByTestId("md-link")).toHaveAttribute(
      "href",
      "https://gikky.net",
    );
    // Thẻ `<script>` KHÔNG được dựng, và chữ của nó vẫn hiện ra nguyên văn.
    await expect(nut.locator("script")).toHaveCount(0);
    await expect(nut).toContainText("<script>alert(1)</script>");
  });
});
