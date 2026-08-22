import { expect, test, type Browser, type Page } from "@playwright/test";

import { secretLamMoiCache } from "../playwright.config";
import { dungTaiKhoan } from "./danh-tinh";
import { machTheoId } from "./du-lieu";

/** **Phase 3 — mặt BÃO, vòng lặp quay lại, và cache của PLAN 8.4**, chạy thật trên trình duyệt.
 *
 * Bảy chuyện được ghim ở đây, và thứ tự là thứ tự rủi ro:
 *
 * 1. **không rò dữ liệu per-user** — hai người xem cùng một URL không được thấy trạng thái
 *    của nhau. Đây là lỗi nặng nhất mảng này có thể gây ra, và ISR làm nó nặng thêm một bậc;
 * 2. **ISR thật sự cache** (bình luận không có signal ⇒ khách thấy bản cũ) và **on-demand
 *    revalidate thật sự chạy** (nối mốc có signal ⇒ khách thấy ngay);
 * 3. mặt BÃO đúng bố cục PLAN 5.5, và **mạch đã đóng vẫn ra mặt CẶN**;
 * 4. vạch mới + số mốc chưa xem, và `POST /seen` làm chúng biến mất ở lượt sau;
 * 5. phiếu của tôi sống qua reload (nợ `VOTE-CUA-TOI`);
 * 6. theo mạch → chuông báo mốc mới;
 * 7. trích vào sổ: hai dấu thời gian, render tách bạch, gỡ được.
 *
 * **Hai danh tính dựng MỘT LẦN** (`test.describe.serial` + context riêng): mỗi lượt
 * `dungTaiKhoan` đi qua đăng ký → hộp thư trên đĩa → xác thực → đăng nhập, và dựng lại nó
 * cho từng bài là mười lăm lượt cho một chuyện đã chứng minh ở `tai-khoan-va-ghi.spec.ts`.
 * Đổi lại: các bài **phụ thuộc thứ tự**, nên `serial` là bắt buộc chứ không phải tiện tay.
 */

const SUB = "chung-khoan";

/** Trang mạch dùng chung của cả file, dựng ở bài đầu. */
let duong_dan_mach = "";
let mach_id = 0;
let ten_chu = "";

/** Hai tab sống suốt cả file: chủ mạch và một khán giả. */
let chu: Page;
let khan_gia: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  chu = await (await browser.newContext()).newPage();
  khan_gia = await (await browser.newContext()).newPage();
  // `window.confirm` của "Gỡ trích" và "Đóng sổ" — chấp nhận mặc định ở cả hai tab.
  for (const p of [chu, khan_gia]) p.on("dialog", (d) => void d.accept());
  ten_chu = (await dungTaiKhoan(chu, "p3chu")).username;
  await dungTaiKhoan(khan_gia, "p3kg");
});

test.afterAll(async () => {
  await chu.context().close();
  await khan_gia.context().close();
});

/** Nối một mốc **bằng giao diện**, từ trang mạch đang mở. */
async function noiMocQuaForm(page: Page, than: string): Promise<void> {
  await page.getByTestId("nut-noi-moc").click();
  await page.getByTestId("noi-moc-body").fill(than);
  await page.getByTestId("noi-moc-gui").click();
  await expect(page.getByTestId("form-noi-moc")).toBeHidden();
}

/** Gửi một bình luận **bằng giao diện**, qua composer ở CHÂN KHÁN ĐÀI.
 *
 * Phải khoanh vùng `khan-dai`, không được `getByTestId("composer-o").first()`: trang mạch
 * có ba loại composer, và loại đứng đầu DOM là composer của **ngăn kéo** — nó nằm trong
 * một `<details>` đang đóng, tức không nhìn thấy được. `.first()` ở đây là một locator
 * trỏ vào phần tử ẩn, và Playwright chờ 30 giây rồi mới nói ra.
 */
async function binhLuan(page: Page, than: string): Promise<void> {
  const composer = page.getByTestId("khan-dai").getByTestId("composer");
  await composer.getByTestId("composer-o").fill(than);
  await composer.getByTestId("composer-gui").click();
  // Chờ chữ hiện trong **CÂY KHÁN ĐÀI**, không phải "đâu đó trên trang": khi gửi hỏng,
  // composer GIỮ NGUYÊN nội dung (`components/composer.tsx` chỉ `datThan("")` ở nhánh
  // thành công), nên một `getByText(...)` không khoanh vùng sẽ khớp chính cái textarea và
  // báo xanh cho một lượt gửi vừa thất bại.
  await expect(
    page.getByTestId("cay-khan-dai").getByText(than, { exact: false }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("Phase 3 — mặt BÃO, vòng lặp quay lại, cache", () => {
  test("P0 — dựng một mạch hai mốc, và nó ra MẶT BÃO (PLAN 5.5)", async () => {
    await chu.goto("/dang-mach");
    await chu.getByTestId("dang-mach-sub").selectOption(SUB);
    await chu.getByTestId("dang-mach-title").fill(`Mạch Phase 3 của ${ten_chu}`);
    await chu.getByTestId("dang-mach-body").fill("Mốc 1 — vào lệnh thử nghiệm.");
    await chu.getByTestId("dang-mach-gui").click();
    await chu.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
    duong_dan_mach = new URL(chu.url()).pathname;
    mach_id = Number(/-(\d+)$/.exec(duong_dan_mach)![1]);

    // Một mốc thì chưa phải "mạch" (PLAN 5.1) — không spine, không dải gập.
    await expect(chu.getByTestId("mat-bao")).toBeHidden();

    await noiMocQuaForm(chu, "Mốc 2 — nâng tỷ trọng.");
    await chu.reload();

    // Mạch đang mở, vừa hoạt động ⇒ server tính `face = bao` (vế thời gian của 5.5).
    expect((await machTheoId(mach_id)).face).toBe("bao");
    await expect(chu.getByTestId("the-mach")).toHaveAttribute("data-mat", "bao");
    await expect(chu.getByTestId("mat-bao")).toBeVisible();
    await expect(chu.getByTestId("spine")).toBeVisible();
    await expect(chu.getByTestId("spine-o-1")).toBeVisible();
    await expect(chu.getByTestId("spine-o-2")).toBeVisible();

    // Wireframe 9.2: **chỉ mốc mới nhất mở sẵn**, phần còn lại sau nút "mở cả mạch ▾".
    await expect(chu.getByTestId("moc-2")).toBeVisible();
    await expect(chu.getByTestId("moc-1")).toBeHidden();
    await chu.getByTestId("nut-mo-ca-mach").click();
    await expect(chu.getByTestId("moc-1")).toBeVisible();

    // Composer + câu mồi theo trạng thái đứng TRƯỚC cây khán đài, và khán đài mở SẴN —
    // ở mặt BÃO nó là thân bài, không nằm sau một cú bấm.
    await expect(chu.getByTestId("composer-mat-bao")).toBeVisible();
    await expect(chu.getByTestId("khan-dai")).toBeVisible();
  });

  test("P1 — mạch ĐÃ ĐÓNG vẫn ra mặt CẶN, không mượn bố cục BÃO", async () => {
    // Vế "status == open" của PLAN 5.5. Bài đo này là lượt thử phá (d) ở dạng thường
    // trực: đóng sổ xong mà `mat-bao` vẫn còn là mặt BÃO đang render cho mạch đã đóng.
    await chu.goto(duong_dan_mach);
    await chu.getByTestId("nut-dong-so").click();
    await chu.getByTestId("dong-so-gui").click();
    await expect(chu.getByTestId("nut-mo-lai")).toBeVisible();

    expect((await machTheoId(mach_id)).face).toBe("can");
    await expect(chu.getByTestId("the-mach")).toHaveAttribute("data-mat", "can");
    await expect(chu.getByTestId("mat-bao")).toBeHidden();
    await expect(chu.getByTestId("spine")).toBeHidden();
    // Mặt CẶN: nhật ký là thân bài ⇒ mọi mốc hiện thẳng, khán đài gập lại.
    await expect(chu.getByTestId("moc-1")).toBeVisible();
    await expect(chu.getByTestId("chan-trang-khan-dai")).toBeVisible();

    // `mo_lai_den` do server trả (nợ `API-THIEU-MOC-THOI-GIAN`) — UI hiện hạn CHÓT chứ
    // không nói "trong 7 ngày".
    await expect(chu.getByTestId("con-han-mo-lai")).toContainText("giờ VN");

    // Mở lại để các bài sau chạy trên một mạch đang sống.
    await chu.getByTestId("nut-mo-lai").click();
    await expect(chu.getByTestId("nut-noi-moc")).toBeVisible();
  });

  test("P2 — `?view=` đổi mặt theo LƯỢT XEM, và nó không được lưu (PLAN 5.5)", async () => {
    await chu.goto(`${duong_dan_mach}?view=can`);
    await expect(chu.getByTestId("the-mach")).toHaveAttribute("data-mat", "can");
    // Bỏ query đi là về đúng mặt server tính — không có cookie nào nhớ lựa chọn.
    await chu.goto(duong_dan_mach);
    await expect(chu.getByTestId("the-mach")).toHaveAttribute("data-mat", "bao");
  });

  test("P3 — theo mạch: trạng thái SỐNG QUA RELOAD, và khách không thấy nút", async () => {
    // Khách: không nút, không rò gì.
    const an_danh = await khan_gia.context().browser()!.newContext();
    const trang_khach = await an_danh.newPage();
    await trang_khach.goto(duong_dan_mach);
    await expect(trang_khach.getByTestId("khan-dai")).toBeVisible();
    await expect(trang_khach.getByTestId("nut-theo-mach")).toBeHidden();
    await an_danh.close();

    await khan_gia.goto(duong_dan_mach);
    const nut = khan_gia.getByTestId("nut-theo-mach");
    await expect(nut).toHaveText("＋ Theo mạch");
    await nut.click();
    await expect(nut).toHaveText("✓ Đang theo");

    // Nợ `VOTE-CUA-TOI` cùng loài: trạng thái per-user phải sống qua một lượt tải lại.
    await khan_gia.reload();
    await expect(khan_gia.getByTestId("nut-theo-mach")).toHaveText("✓ Đang theo");

    // …và người KHÁC mở cùng URL không thấy trạng thái đó. Đây là bài đo chống rò
    // per-user: nếu `following` bị nướng vào HTML cache, chủ mạch sẽ thấy "Đang theo".
    await chu.goto(duong_dan_mach);
    await expect(chu.getByTestId("nut-theo-mach")).toHaveText("＋ Theo mạch");
  });

  test("P4 — phiếu của tôi SỐNG QUA RELOAD, và không lây sang người khác", async () => {
    await khan_gia.goto(duong_dan_mach);
    const cot = khan_gia.getByTestId("cot-vote-moc").first();
    await cot.getByTestId("mui-ten-len").click();
    await expect(cot.getByTestId("mui-ten-len")).toHaveAttribute("aria-pressed", "true");

    await khan_gia.reload();
    const sau = khan_gia.getByTestId("cot-vote-moc").first();
    await expect(sau.getByTestId("mui-ten-len")).toHaveAttribute("aria-pressed", "true");

    // Chủ mạch mở cùng URL: mốc của chính họ đã có +1 tự upvote (PLAN 5.7), nhưng phiếu
    // của khán giả **không** được hiện ra như phiếu của họ ở mũi tên nào cả — cái ta ghim
    // là mũi tên XUỐNG, thứ không ai trong hai người bấm.
    await chu.goto(duong_dan_mach);
    const cua_chu = chu.getByTestId("cot-vote-moc").first();
    await expect(cua_chu.getByTestId("mui-ten-xuong")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("P5 — vạch mới + số mốc chưa xem, rồi `POST /seen` xoá chúng ở lượt sau", async () => {
    // Khán giả đang theo mạch với `last_seen_entry_seq = 2` (đặt lúc bấm Theo mạch).
    // Chủ nối mốc 3 ⇒ đúng một mốc chưa xem.
    await chu.goto(duong_dan_mach);
    await noiMocQuaForm(chu, "Mốc 3 — chốt một phần.");
    expect((await machTheoId(mach_id)).entry_count).toBe(3);

    // Lượt tải NÀY phải thấy vạch: `POST /seen` chạy SAU khi `/me` đã trả lời, và kết quả
    // của nó cố ý không đổ ngược vào state (`components/trang-thai-toi.tsx`).
    const da_ghi_vi_tri = khan_gia.waitForResponse(
      (r) => r.url().includes(`/machs/${mach_id}/seen`) && r.status() === 200,
    );
    await khan_gia.goto(duong_dan_mach);
    await expect(khan_gia.getByTestId("spine-o-3")).toHaveAttribute("data-chua-xem", "1");
    await expect(khan_gia.getByTestId("spine-o-2")).toHaveAttribute("data-chua-xem", "0");
    await khan_gia.getByTestId("nut-mo-ca-mach").click();
    await expect(khan_gia.getByTestId("vach-moi")).toBeVisible();
    await da_ghi_vi_tri;

    // Lượt sau: đã xem tới mốc mới nhất ⇒ không vạch, không ô hoàng thổ nào.
    await khan_gia.reload();
    await expect(khan_gia.getByTestId("spine-o-3")).toHaveAttribute("data-chua-xem", "0");
    await khan_gia.getByTestId("nut-mo-ca-mach").click();
    await expect(khan_gia.getByTestId("vach-moi")).toBeHidden();

    // Và **khách thì không bao giờ có vạch** — nó là dữ liệu per-user trên một trang cache.
    const an_danh = await khan_gia.context().browser()!.newContext();
    const trang_khach = await an_danh.newPage();
    await trang_khach.goto(duong_dan_mach);
    await expect(trang_khach.getByTestId("spine-o-3")).toHaveAttribute("data-chua-xem", "0");
    await an_danh.close();
  });

  test("P6 — chuông: mốc mới của mạch đang theo, và nguyên tắc 9 (không in số 0)", async () => {
    // Chuông của khán giả đã có ít nhất một tin (mốc 3 ở bài trước, khi họ đang theo).
    await khan_gia.goto("/");
    await expect(khan_gia.getByTestId("chuong-so-chua-doc")).toBeVisible();
    await khan_gia.getByTestId("nut-chuong").click();
    await expect(khan_gia.getByTestId("chuong-danh-sach")).toBeVisible();
    await expect(khan_gia.getByTestId("chuong-dong").first()).toContainText(
      "mốc mới",
    );

    await khan_gia.getByTestId("chuong-doc-het").click();
    // Nguyên tắc 9: hết chưa đọc thì **không có chấm nào**, không phải một chấm ghi `0`.
    await expect(khan_gia.getByTestId("chuong-so-chua-doc")).toBeHidden();

    // Chủ mạch tự nối mốc của chính mình thì KHÔNG tự báo cho mình (`bao_moc_moi` loại
    // người viết) — nên chuông của chủ vẫn im.
    await chu.goto("/");
    await expect(chu.getByTestId("chuong-so-chua-doc")).toBeHidden();
  });

  test("P7 — trích vào sổ: hai dấu thời gian, tách bạch, gỡ được (PLAN 5.6)", async () => {
    const cau = `Cắt lỗ theo MA20 chứ? — ${Date.now()}`;
    await khan_gia.goto(duong_dan_mach);
    await binhLuan(khan_gia, cau);

    // Khán giả KHÔNG được thấy nút trích — nó là quyền của chủ cuốn sổ (rào 4).
    await expect(khan_gia.getByTestId("nut-mo-trich")).toHaveCount(0);

    await chu.goto(duong_dan_mach);
    await chu.getByTestId("nut-mo-trich").first().click();
    await chu.getByTestId("trich-chon-moc").selectOption({ label: "Mốc 3" });
    await chu.getByTestId("trich-gui").click();

    const khoi = chu.getByTestId("trich-moc-3");
    await expect(khoi).toBeVisible();
    // Rào 2 — ĐỦ HAI dấu thời gian. Thiếu một là mở đường cho trích hậu nghiệm.
    await expect(khoi.getByTestId("trich-viet")).toContainText("viết");
    await expect(khoi.getByTestId("trich-trich")).toContainText("trích");
    // Rào 4 — render TÁCH BẠCH khỏi thân mốc: `<figure>` riêng, có chú thích nói rõ nguồn.
    await expect(khoi.getByTestId("trich-chu-thich")).toHaveText(
      "Trích từ khán đài, bởi chủ mạch",
    );
    expect(await khoi.evaluate((e) => e.tagName)).toBe("FIGURE");

    // Django xác nhận, không chỉ HTML tự nói.
    const tu_api = await machTheoId(mach_id);
    expect(tu_api.mocs.find((m) => m.seq === 3)?.trich?.body).toBe(cau);

    // Người được trích nhận thông báo (PLAN 5.6 dòng cuối).
    await khan_gia.goto("/");
    await khan_gia.getByTestId("nut-chuong").click();
    await expect(
      khan_gia.getByTestId("chuong-dong").filter({ hasText: "trích bình luận" }),
    ).toHaveCount(1);

    // Gỡ trích — trong 24 giờ.
    await chu.goto(duong_dan_mach);
    await chu.getByTestId("nut-go-trich").click();
    await expect(chu.getByTestId("trich-moc-3")).toBeHidden();
    expect((await machTheoId(mach_id)).mocs.find((m) => m.seq === 3)?.trich).toBeNull();
  });

  test("P8 — quyền sửa mốc hỏi tác giả của MỐC, không suy từ chủ mạch", async () => {
    // Nợ `MOC-THIEU-AUTHOR`. Hôm nay hai cột trùng nhau nên bài đo chỉ khẳng định được
    // hành vi đúng ở cả hai phía; cái nó giữ là **cửa** ấy tồn tại.
    await chu.goto(duong_dan_mach);
    await expect(chu.getByTestId("menu-moc").first()).toBeVisible();
    await khan_gia.goto(duong_dan_mach);
    await expect(khan_gia.getByTestId("menu-moc")).toHaveCount(0);
  });

  test("P9 — ISR: bình luận KHÔNG có signal ⇒ khách còn thấy bản cache (PLAN 8.4)", async ({
    browser,
  }) => {
    // Đây là bài đo chứng minh **cache có thật**. PLAN 8.4 điểm 2 xếp bình luận vào nhóm
    // KHÔNG có signal (`core/revalidate.py` cố ý không hook nó), nên một câu mới không
    // được làm mới bản cache của khách — nó chờ vòng revalidate nền 1 giờ.
    const an_danh = await browser.newContext();
    const khach = await an_danh.newPage();
    await khach.goto(duong_dan_mach);
    await expect(khach.getByTestId("khan-dai")).toBeVisible();

    const cau = `Câu này chỉ có trong DB, chưa có trong cache — ${Date.now()}`;
    await khan_gia.goto(duong_dan_mach);
    await binhLuan(khan_gia, cau);
    // Django đã có nó thật.
    const r = await fetch(
      `${process.env.E2E_API_ORIGIN ?? "http://localhost:8000"}/api/v1/machs/${mach_id}/comments?sort=moi_nhat&limit=50`,
    );
    expect(JSON.stringify(await r.json())).toContain(cau);

    await khach.reload();
    await expect(khach.getByText(cau)).toHaveCount(0);
    await an_danh.close();
  });

  test("P10 — ISR: nối mốc CÓ signal ⇒ khách thấy ngay (Django → cửa làm mới cache)", async ({
    browser,
  }) => {
    test.skip(
      secretLamMoiCache() === "",
      "REVALIDATE_SECRET rỗng ở api/.env ⇒ cửa làm mới cache tắt (fail-closed) — " +
        "không có gì để đo, và đó là cấu hình hợp lệ của một máy vừa clone.",
    );
    // Mạch RIÊNG cho bài này: mạch chung đã dùng hết 3 mốc của ngày lịch VN (PLAN 5.1),
    // nên một mốc nữa ở đó sẽ ăn 429 và bài đo đỏ vì một lý do không liên quan.
    await chu.goto("/dang-mach");
    await chu.getByTestId("dang-mach-sub").selectOption(SUB);
    await chu.getByTestId("dang-mach-title").fill(`Mạch signal của ${ten_chu}`);
    await chu.getByTestId("dang-mach-body").fill("Mốc 1 — chờ một sự kiện có signal.");
    await chu.getByTestId("dang-mach-gui").click();
    await chu.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
    const duong_dan_rieng = new URL(chu.url()).pathname;

    const an_danh = await browser.newContext();
    const khach = await an_danh.newPage();
    await khach.goto(duong_dan_rieng);

    const than = `Mốc 2 — sự kiện CÓ signal ${Date.now()}`;
    await noiMocQuaForm(chu, than);

    // Không `waitForTimeout`: `revalidatePath` chạy fire-and-forget bên Django
    // (`transaction.on_commit` + luồng nền), nên chỗ này phải là một phép chờ CÓ ĐIỀU
    // KIỆN. `toPass` thử lại tối đa 15 giây rồi mới đỏ.
    await expect(async () => {
      await khach.reload();
      await expect(khach.getByText(than)).toHaveCount(1);
    }).toPass({ timeout: 20_000 });
    await an_danh.close();
  });
});
