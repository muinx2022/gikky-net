import { expect, test } from "@playwright/test";

import { LY_DO_CHUA_DANG_NHAP, LY_DO_DANG_TAI } from "../lib/vote";
import { dungTaiKhoan } from "./danh-tinh";
import { TITLE_HPG, duongDan, machTheoId, timMachTheoTitle } from "./du-lieu";

/** Ba mục CHẶN/NẶNG của lượt vá V2 đo trong trình duyệt: **L15** và **L05**.
 *
 * (L04 và L41 đo ở chỗ khác vì chúng không sống trong `apps/web`: L04 là khu quản trị —
 * xem `api/tests/test_api_quan_tri_nguoi_dung.py` cho phần "ban có thi hành thật không"
 * và `e2e/don-vi/hang-doi-quan-tri.spec.ts` cho phần "hàng có nút thật không"; L41 là một
 * bước của lệnh build — xem `e2e/don-vi/cache-du-lieu.spec.ts`.)
 */

test.describe("L15 — CotVote xử nhịp `dangTai`", () => {
  test("trong lúc `/me` chưa về, mũi tên nói ĐANG TẢI chứ không nói 'chưa đăng nhập'", async ({
    page,
  }) => {
    // `usePhien()` trả `{toi: null, dangTai: true}` cho tới khi `/me` trả lời. Trước L15,
    // `CotVote` chỉ hỏi `toi?.dang_nhap`, nên suốt nhịp ấy **người đã đăng nhập** bị bảo
    // đi đăng nhập — và chính file đó viết "lý do phải ĐÚNG".
    //
    // Giữ `/me` lại 2 giây để nhịp ấy dài đủ mà nhìn. Không giả lập `dangTai` bằng cách
    // gọi hàm: thứ đang đo là **thứ tự các nhánh trong component thật** lúc chạy thật.
    // Khởi tạo bằng một hàm rỗng, không phải `null`: TypeScript thu hẹp một biến gán
    // trong callback xuống `never`, và lối thoát duy nhất còn lại là `tha?.()` — một dấu
    // `?` che mất đúng ca "quên nhả", tức bài đo treo 30 giây rồi đỏ vì timeout thay vì
    // đỏ vì thứ nó đang đo.
    let tha: () => void = () => {};
    const cho = new Promise<void>((r) => {
      tha = r;
    });
    await page.route("**/api/v1/me", async (route) => {
      await cho;
      await route.continue();
    });

    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(duongDan(hpg), { waitUntil: "domcontentloaded" });

    const mui_ten = page.getByTestId("cot-vote-moc").first().getByTestId("mui-ten-len");
    await expect(mui_ten).toBeDisabled();
    await expect(mui_ten).toHaveAttribute("title", LY_DO_DANG_TAI);
    await expect(mui_ten).toHaveAttribute("aria-label", new RegExp(LY_DO_DANG_TAI));

    // Nhả `/me` ra: khách thật sự chưa đăng nhập ⇒ câu đổi sang lý do ĐÚNG của ca đó.
    // Vế thứ hai này bắt buộc — không có nó thì một `LY_DO_DANG_TAI` gán vĩnh viễn cũng
    // làm vế thứ nhất xanh.
    tha();
    await expect(mui_ten).toHaveAttribute("title", LY_DO_CHUA_DANG_NHAP);
  });
});

test.describe("L05 — composer khán đài NEO thật", () => {
  test("câu viết ở cuối khán đài rơi vào ngăn kéo mốc MỚI NHẤT", async ({ page }) => {
    // Hình dạng của L05: khán đài gọi `<Composer />` không prop ⇒ `anchor_moc_seq: null`
    // ⇒ bình luận không vào ngăn kéo nào, và mọi ngăn kéo vẫn nói "Chưa ai neo bình luận
    // vào mốc này" trong khi khán đài đầy chữ.
    //
    // Nguồn sự thật là **Django**, không phải HTML vừa render: bài đo so HTML với HTML chỉ
    // chứng minh trang bằng chính nó.
    await dungTaiKhoan(page, "l05");

    await page.goto("/dang-mach");
    const title = `L05 neo khán đài ${Date.now().toString(36)}`;
    await page.getByTestId("dang-mach-sub").selectOption("chung-khoan");
    await page.getByTestId("dang-mach-title").fill(title);
    await page.getByTestId("dang-mach-body").fill("Mốc 1 — mở sổ để đo neo.");
    await page.getByTestId("dang-mach-gui").click();
    await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
    const duong_dan = new URL(page.url()).pathname;

    // Nối mốc 2 để "mốc mới nhất" khác mốc 1 — nếu chỉ có một mốc thì `anchor = 1` cũng
    // đúng một cách tình cờ, và bài đo không phân biệt được bản vá với bản hỏng.
    await page.getByTestId("nut-noi-moc").click();
    await page.getByTestId("noi-moc-body").fill("Mốc 2 — nối thêm để mốc mới nhất là 2.");
    await page.getByTestId("noi-moc-gui").click();
    await expect(page.getByTestId("moc-2")).toBeVisible({ timeout: 30_000 });

    // Mở khán đài rồi viết vào ô CUỐI TRANG — đúng ô mà L05 nói là gửi `null`.
    //
    // `?view=can` là BẮT BUỘC, không phải trang trí: mạch vừa dựng xong luôn ra mặt BÃO
    // (PLAN 5.5 — `last_activity_at` vài giây trước), và ở mặt BÃO ô nhập nằm TRÊN cây
    // khán đài chứ không ở cuối. Cái ô đang đo là ô của mặt CẶN.
    await page.goto(`${duong_dan}?view=can&khan_dai=1&sort=moi_nhat`);
    const khan_dai = page.getByTestId("khan-dai");
    const composer = khan_dai.getByTestId("composer");
    await expect(composer).toBeVisible();

    // Chip neo phải hiện sẵn mốc mới nhất — người viết thấy TRƯỚC khi gửi mình đang neo
    // vào đâu.
    await expect(khan_dai.getByTestId("composer-chon-moc")).toHaveValue("2");

    const cau = `L05 câu neo mốc 2 ${Date.now().toString(36)}`;
    await composer.getByTestId("composer-o").fill(cau);
    await composer.getByTestId("composer-gui").click();

    const id = Number(/-(\d+)$/.exec(duong_dan)?.[1]);
    await expect
      .poll(
        async () => {
          const m = await machTheoId(id);
          return m.mocs.find((x) => x.seq === 2)?.so_binh_luan ?? 0;
        },
        { timeout: 30_000, message: "Django phải thấy câu ấy NEO vào mốc 2" },
      )
      .toBe(1);

    const mach = await machTheoId(id);
    expect(
      mach.mocs.find((x) => x.seq === 1)?.so_binh_luan,
      "và nó KHÔNG rơi vào mốc 1",
    ).toBe(0);
  });

  test("gỡ chip (×) ⇒ câu về CẢ MẠCH, không vào ngăn kéo nào", async ({ page }) => {
    // Cơ chế mà `PLAN.md` mục 4 viện dẫn để bác một đề xuất khác: *"gỡ chip → anchor =
    // NULL"*. Tới trước L05 nó chưa tồn tại, nên lý lẽ ấy dựa vào một thứ không có thật.
    await dungTaiKhoan(page, "l05b");

    await page.goto("/dang-mach");
    const title = `L05 gỡ neo ${Date.now().toString(36)}`;
    await page.getByTestId("dang-mach-sub").selectOption("chung-khoan");
    await page.getByTestId("dang-mach-title").fill(title);
    await page.getByTestId("dang-mach-body").fill("Mốc 1 — mở sổ để đo gỡ neo.");
    await page.getByTestId("dang-mach-gui").click();
    await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
    const duong_dan = new URL(page.url()).pathname;
    const id = Number(/-(\d+)$/.exec(duong_dan)?.[1]);

    // `?view=can` — xem ghi chú ở bài trên.
    await page.goto(`${duong_dan}?view=can&khan_dai=1&sort=moi_nhat`);
    const composer = page.getByTestId("khan-dai").getByTestId("composer");
    await expect(composer).toBeVisible();

    // Chip có mặt, bấm `×` là gỡ — và cái `×` phải BIẾN MẤT sau đó (không còn gì để gỡ).
    await expect(page.getByTestId("composer-go-neo")).toBeVisible();
    await page.getByTestId("composer-go-neo").click();
    await expect(page.getByTestId("composer-chon-moc")).toHaveValue("");
    await expect(page.getByTestId("composer-go-neo")).toHaveCount(0);

    await composer.getByTestId("composer-o").fill(`L05 câu không neo ${Date.now()}`);
    await composer.getByTestId("composer-gui").click();

    await expect
      .poll(async () => (await machTheoId(id)).comment_count, {
        timeout: 30_000,
        message: "câu phải được ghi",
      })
      .toBe(1);
    expect(
      (await machTheoId(id)).mocs.find((x) => x.seq === 1)?.so_binh_luan,
      "gỡ neo ⇒ câu KHÔNG vào ngăn kéo mốc nào",
    ).toBe(0);
  });

  test("mặt BÃO chỉ có MỘT ô nhập, không phải hai", async ({ page }) => {
    // Vế thứ ba của L05: trang BÃO từng có hai ô nhập trông y hệt nhau với hai luật neo
    // khác nhau (`trang-mach.tsx` neo mốc mới nhất, ô cuối khán đài neo `null`). Người đọc
    // không có cách nào biết mình đang gõ vào cái nào.
    await dungTaiKhoan(page, "l05c");
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await page.goto(`${duongDan(hpg)}?view=bao`);

    // Đếm theo VÙNG, không đếm cả trang: mỗi ngăn kéo mốc cũng có một `composer` (PLAN
    // 5.4 luật 3) và chúng nằm sẵn trong DOM dưới dạng `hidden`. Một phép đếm cả trang ra
    // 10 trên mạch 9 mốc và không nói gì về thứ L05 đang hỏi.
    // `toBeVisible` trên chính cái ô nhập, không trên cái hộp bọc nó: hộp `composer-mat-bao`
    // render ngay ở server, còn `Composer` **chưa vẽ gì** cho tới khi `GET /me` về
    // (`dangTai`). Khẳng định vào cái hộp là khẳng định vào một hộp rỗng.
    await expect(
      page.getByTestId("composer-mat-bao").getByTestId("composer"),
    ).toBeVisible();
    expect(
      await page.getByTestId("composer-mat-bao").getByTestId("composer").count(),
      "ô nhập của mặt BÃO phải có mặt",
    ).toBe(1);
    expect(
      await page.getByTestId("khan-dai").getByTestId("composer").count(),
      "và khán đài KHÔNG được có ô thứ hai — hai ô cùng hình dạng, hai luật neo",
    ).toBe(0);

    // Đối chứng mặt CẶN: ở đó luật ngược lại — composer nằm ở CUỐI khán đài, và không có
    // `composer-mat-bao` nào. Không có vế này thì `hienComposer={false}` gán nhầm cho cả
    // hai mặt cũng làm bài trên xanh.
    await page.goto(`${duongDan(hpg)}?view=can&khan_dai=1`);
    await expect(page.getByTestId("composer-mat-bao")).toHaveCount(0);
    await expect(
      page.getByTestId("khan-dai").getByTestId("composer"),
    ).toBeVisible();
    expect(
      await page.getByTestId("khan-dai").getByTestId("composer").count(),
      "mặt CẶN phải có ô nhập ở cuối khán đài",
    ).toBe(1);
  });
});
