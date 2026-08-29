import { expect, test } from "@playwright/test";

import { LY_DO_CHUA_DANG_NHAP, LY_DO_DANG_TAI } from "../lib/vote";
import { dungTaiKhoan } from "./danh-tinh";
import {
  TITLE_HPG,
  duongDan,
  machTheoId,
  moComposer,
  timMachTheoTitle,
} from "./du-lieu";

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

/** Dựng một mạch 2 mốc mới toanh của tài khoản `ten`, trả `{duong_dan, id}`.
 *
 * Hai mốc chứ không một, và đó là điều kiện của mọi bài đo neo dưới đây: với một mốc duy
 * nhất thì "neo mốc 1" và "neo mốc mới nhất" là cùng một con số, nên bài đo không phân
 * biệt được bản đúng với bản hỏng.
 */
async function machHaiMoc(page: import("@playwright/test").Page, ten: string, nhan: string) {
  await dungTaiKhoan(page, ten);
  await page.goto("/dang-mach");
  await page.getByTestId("dang-mach-sub").selectOption("chung-khoan");
  await page.getByTestId("dang-mach-title").fill(`${nhan} ${Date.now().toString(36)}`);
  await page.getByTestId("dang-mach-body").fill("Mốc 1 — mở sổ để đo neo.");
  await page.getByTestId("dang-mach-gui").click();
  await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
  const duong_dan = new URL(page.url()).pathname;

  await page.getByTestId("nut-noi-moc").click();
  await page.getByTestId("noi-moc-body").fill("Mốc 2 — nối thêm để mốc mới nhất là 2.");
  await page.getByTestId("noi-moc-gui").click();
  await expect(page.getByTestId("moc-2")).toBeVisible({ timeout: 30_000 });

  return { duong_dan, id: Number(/-(\d+)$/.exec(duong_dan)?.[1]) };
}

test.describe("L05 — composer khán đài NEO thật (mặc định KHÔNG neo từ 2026-08-26)", () => {
  test("mặc định 'cả mạch (không neo)' ⇒ câu ở khu chung, KHÔNG vào ngăn kéo nào", async ({
    page,
  }) => {
    // **Kỳ vọng LẬT ngày 2026-08-26** *(user chốt)*. Bài này trước đó đo rằng ô cuối khán
    // đài neo sẵn **mốc mới nhất** — đúng với L05 (2026-08-23), và sai từ lượt tách bình
    // luận chung khỏi bình luận mốc: khu ấy nay chỉ hiện thread `anchor_moc_seq IS NULL`,
    // nên một mặc định neo sẽ đẩy câu vừa viết ra khỏi đúng danh sách người viết đang
    // nhìn. Họ bấm gửi và không thấy gì.
    //
    // Nguồn sự thật vẫn là **Django**, không phải HTML vừa render: so HTML với HTML chỉ
    // chứng minh trang bằng chính nó.
    const { duong_dan, id } = await machHaiMoc(page, "l05", "L05 không neo");

    // `?view=can` là BẮT BUỘC, không phải trang trí: mạch vừa dựng xong luôn ra mặt BÃO
    // (PLAN 5.5 — `last_activity_at` vài giây trước), và ở mặt BÃO ô nhập nằm TRÊN cây
    // khán đài chứ không ở cuối. Cái ô đang đo là ô của mặt CẶN.
    await page.goto(`${duong_dan}?view=can&khan_dai=1&sort=moi_nhat`);
    const khan_dai = page.getByTestId("khan-dai");
    const composer = await moComposer(khan_dai);

    // Người viết phải ĐỌC THẤY mình đang gửi vào đâu, kể cả khi câu trả lời là "không đâu".
    await expect(khan_dai.getByTestId("composer-chon-moc")).toHaveValue("");
    await expect(page.getByTestId("composer-go-neo")).toHaveCount(0);

    await composer.getByTestId("composer-o").fill(`L05 câu chung ${Date.now()}`);
    await composer.getByTestId("composer-gui").click();

    await expect
      .poll(async () => (await machTheoId(id)).comment_count, {
        timeout: 30_000,
        message: "câu phải được ghi",
      })
      .toBe(1);

    const mach = await machTheoId(id);
    expect(
      mach.mocs.map((m) => m.so_binh_luan),
      "không neo ⇒ câu KHÔNG rơi vào ngăn kéo mốc nào",
    ).toEqual([0, 0]);

    // Và nó CÓ mặt ở khu chung — vế này bắt buộc, nếu không "không ở đâu cả" cũng xanh.
    await page.reload();
    await expect(
      page.getByTestId("cay-khan-dai").getByTestId("binh-luan"),
    ).toHaveCount(1);
  });

  test("chọn mốc ở select ⇒ câu vào ngăn kéo mốc đó, KHÔNG ở khu chung", async ({
    page,
  }) => {
    // Chiều còn lại của tiêu chí 6: cái select vẫn là đường chính thức để gửi vào một mốc
    // từ ô chung — thứ vừa mất là **mặc định**, không phải khả năng.
    const { duong_dan, id } = await machHaiMoc(page, "l05b", "L05 chọn mốc");

    await page.goto(`${duong_dan}?view=can&khan_dai=1&sort=moi_nhat`);
    const khan_dai = page.getByTestId("khan-dai");
    const composer = await moComposer(khan_dai);

    await khan_dai.getByTestId("composer-chon-moc").selectOption("2");
    // Chọn xong thì `×` mọc ra — có cái để gỡ. Đây là cơ chế mà `PLAN.md` mục 4 viện dẫn.
    await expect(page.getByTestId("composer-go-neo")).toBeVisible();

    const cau = `L05 câu neo mốc 2 ${Date.now()}`;
    await composer.getByTestId("composer-o").fill(cau);
    await composer.getByTestId("composer-gui").click();

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

    // **Tiêu chí 16 — màn hình phải DẪN NGƯỜI VIẾT tới chỗ câu vừa rơi vào**
    // *(2026-08-27, phản biện TB-3)*.
    //
    // Bản trước của bài này khẳng định đúng cái trạng thái xấu: khu chung trống, ngăn kéo
    // đóng, người viết bấm Gửi xong nhìn thấy "Chưa có bình luận chung nào" — tức bài đo
    // ĐÓNG DẤU cho một lỗi sản phẩm. Nay `Composer` đặt `#bl-<id>` sau khi gửi và cơ chế
    // deep-link mở đường (`ngan-keo.tsx`), nên câu hỏi đổi thành: nó có tới nơi không.
    //
    // KHÔNG `reload()`, KHÔNG bấm mở ngăn kéo bằng tay — cả hai đều tự dọn đường và làm
    // bài đo mất nghĩa.
    // Không khẳng định vào URL: đường dẫn người viết tới đây **cố ý không đi qua hash**
    // (`router.refresh()` xoá hash — xem `ngan-keo.tsx::SU_KIEN_TOI_BINH_LUAN`), nên một
    // phép kiểm URL ở đây là ghim đúng cái cơ chế đã bị loại.
    await expect(page.getByTestId("ngan-keo-2")).toBeVisible();
    const moi = page.getByTestId("lat-cat-2").locator("[data-binh-luan-id]");
    await expect(moi).toHaveCount(1);
    await expect(moi).toContainText(cau);
    await expect(moi).toBeInViewport();

    // Và vế "không ở khu chung" vẫn phải đúng — nó là nửa còn lại của tiêu chí 6.
    await expect(page.getByTestId("cay-khan-dai")).toHaveCount(0);
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
    // `toBeVisible` trên chính cái CỬA, không trên cái hộp bọc nó: hộp `composer-mat-bao`
    // render ngay ở server, còn `Composer` **chưa vẽ gì** cho tới khi `GET /me` về
    // (`dangTai`). Khẳng định vào cái hộp là khẳng định vào một hộp rỗng.
    //
    // Từ 2026-08-26 đếm CỬA chứ không đếm form: form chỉ tồn tại sau một cú bấm, nên một
    // phép đếm form ở trạng thái vừa mở trang luôn ra 0 — xanh rỗng cho cả hai vế dưới.
    // Câu hỏi của L05 không đổi: *một mặt có đúng MẤY chỗ để viết*.
    const bao = page.getByTestId("composer-mat-bao");
    await expect(bao.getByTestId("composer-cua")).toBeVisible();
    expect(
      await bao.getByTestId("composer-cua").count(),
      "ô nhập của mặt BÃO phải có mặt",
    ).toBe(1);
    expect(
      await page.getByTestId("khan-dai").getByTestId("composer-cua").count(),
      "và khán đài KHÔNG được có ô thứ hai — hai ô cùng hình dạng, hai luật neo",
    ).toBe(0);
    // …và cái cửa ấy mở ra ĐÚNG MỘT form. Thiếu vế này thì "một cửa" có thể là một cửa
    // dẫn vào hai ô gõ.
    await moComposer(bao);
    expect(await page.getByTestId("composer").count()).toBe(1);

    // Đối chứng mặt CẶN: ở đó luật ngược lại — composer nằm ở CUỐI khán đài, và không có
    // `composer-mat-bao` nào. Không có vế này thì `hienComposer={false}` gán nhầm cho cả
    // hai mặt cũng làm bài trên xanh.
    await page.goto(`${duongDan(hpg)}?view=can&khan_dai=1`);
    await expect(page.getByTestId("composer-mat-bao")).toHaveCount(0);
    const khu_can = page.getByTestId("khan-dai");
    await expect(khu_can.getByTestId("composer-cua")).toBeVisible();
    expect(
      await khu_can.getByTestId("composer-cua").count(),
      "mặt CẶN phải có ô nhập trong khu bình luận",
    ).toBe(1);
    await moComposer(khu_can);
    expect(await khu_can.getByTestId("composer").count()).toBe(1);
  });
});
