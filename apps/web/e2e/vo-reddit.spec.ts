import type {
  FeedOut,
  HoSoOut,
  KhanDaiOut,
  MachChiTietOut,
  SubChiTietOut,
} from "@gikky/api-client";
import { type Page, expect, test } from "@playwright/test";

import { TEN_DAU_CHU_NGUOI_DUNG } from "../lib/chu-nguoi-dung";
import { ngayCuaThoiDiem } from "../lib/dinh-dang";
// Đổi tên ở Phase 2: hằng cũ (một câu duy nhất cho "vote chưa sống") tách làm hai, vì
// nay có HAI lý do khác nhau — chưa đăng nhập, và mạch bị mod khoá. Dùng chung một câu
// nghĩa là người đang đăng nhập tử tế bị bảo đi đăng nhập lại vòng vòng.
// Nhóm A7 dưới đây chạy trên trình duyệt CHƯA đăng nhập, nên nó ghim đúng vế thứ nhất.
import { LY_DO_CHUA_DANG_NHAP } from "../lib/vote";
import {
  SUB_NGOAI_DANH_SACH,
  SUB_RONG,
  TITLE_BIA_MO,
  TITLE_HPG,
  TITLE_POST_THUONG,
  duongDan,
  khanDai,
  timMachTheoTitle,
} from "./du-lieu";

/** Vỏ Reddit — tiêu chí A7–A10, A12 của plan con 1d §3.
 *
 * Mọi con số kỳ vọng lấy từ **API**, không đọc lại từ chính HTML vừa render: một bài đo
 * so HTML với HTML chỉ chứng minh trang bằng chính nó (xem `e2e/du-lieu.ts`).
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function json<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

let hpg: MachChiTietOut;
let vnm: MachChiTietOut;
let post: MachChiTietOut;

test.beforeAll(async () => {
  hpg = await timMachTheoTitle(TITLE_HPG);
  vnm = await timMachTheoTitle(TITLE_BIA_MO);
  post = await timMachTheoTitle(TITLE_POST_THUONG);
});

/* ---- A7: cột vote trên thẻ feed ------------------------------------------- */

test.describe("A7 — thẻ feed có cột vote, mũi tên disabled kèm lý do", () => {
  test("mỗi thẻ có đúng một cột vote với hai mũi tên", async ({ page }) => {
    await page.goto("/?tab=moi");
    const the = page.locator(`[data-mach-id="${hpg.id}"]`);
    await expect(the).toHaveCount(1);
    const cot = the.getByTestId("cot-vote-mach");
    await expect(cot).toHaveCount(1);
    await expect(cot.getByTestId("mui-ten-len")).toHaveCount(1);
    await expect(cot.getByTestId("mui-ten-xuong")).toHaveCount(1);
  });

  test("con số bằng ĐÚNG `diem` mà API trả cho thẻ đó", async ({ page }) => {
    // Nguồn sự thật là API. Nếu UI lấy nhầm `comment_count` hay `entry_count` thì đỏ.
    const feed = await json<FeedOut>("/api/v1/feeds/moi?limit=50");
    const the_api = feed.items.find((m) => m.id === hpg.id);
    expect(the_api, "không thấy mạch HPG trong feed").toBeDefined();
    expect(the_api!.diem).toBeGreaterThan(0);

    await page.goto("/?tab=moi");
    await expect(
      page.locator(`[data-mach-id="${hpg.id}"]`).getByTestId("cot-vote-diem"),
    ).toHaveText(`+${the_api!.diem}`);
  });

  test("hai mũi tên bị KHOÁ và NÓI RA vì sao (không phải nút chết)", async ({
    page,
  }) => {
    // Bài học `error.tsx` của 1c: một cái nút không bấm được mà không giải thích là lỗi
    // người dùng không có cách nào hiểu. Ba đường cùng lúc: `disabled`, `title` (chuột),
    // `aria-label` (trình đọc màn hình — `title` một mình thì không ai nghe thấy).
    await page.goto("/?tab=moi");
    const cot = page.locator(`[data-mach-id="${hpg.id}"]`).getByTestId("cot-vote-mach");
    for (const huong of ["len", "xuong"]) {
      const nut = cot.getByTestId(`mui-ten-${huong}`);
      await expect(nut).toBeDisabled();
      await expect(nut).toHaveAttribute("title", LY_DO_CHUA_DANG_NHAP);
      await expect(nut).toHaveAttribute("aria-disabled", "true");
      await expect(nut).toHaveAttribute(
        "aria-label",
        new RegExp(LY_DO_CHUA_DANG_NHAP),
      );
    }
  });

  test("`💬 N` là LINK thật dẫn vào khán đài đang mở", async ({ page }) => {
    await page.goto("/?tab=moi");
    const nut = page
      .locator(`[data-mach-id="${hpg.id}"]`)
      .getByTestId("the-mach-so-binh-luan");
    await expect(nut).toHaveText(`💬 ${hpg.comment_count} bình luận`);
    await nut.click();
    await expect(page).toHaveURL(new RegExp(`/m/.*-${hpg.id}\\?khan_dai=1`));
    await expect(page.getByTestId("khan-dai")).toBeVisible();
  });

  test("A6/A7 — thẻ mốc cũng có cột vote, số bằng `score` của mốc", async ({ page }) => {
    await page.goto(duongDan(hpg));
    const moc9 = hpg.mocs.find((m) => m.seq === 9)!;
    const cot = page.getByTestId("moc-9").getByTestId("cot-vote-moc");
    await expect(cot).toHaveCount(1);
    await expect(cot.getByTestId("cot-vote-diem")).toHaveText(`+${moc9.score}`);
    await expect(cot.getByTestId("mui-ten-len")).toBeDisabled();
  });
});

/* ---- A8: /s/<sub> header + sidebar, KHÔNG có nút Tham gia ------------------ */

test.describe("A8 — trang sub có header + sidebar", () => {
  test("header hiện tên, mô tả và số mạch ĐÚNG như API", async ({ page }) => {
    const s = await json<SubChiTietOut>("/api/v1/subs/chung-khoan");
    await page.goto("/s/chung-khoan");
    const dau = page.getByTestId("sub-header");
    await expect(dau).toBeVisible();
    await expect(dau).toContainText(s.ten);
    await expect(dau).toContainText(s.mo_ta);
    await expect(page.getByTestId("sub-header-so")).toContainText(
      `${s.so_mach} mạch`,
    );
  });

  test("sidebar có mô tả sub, đường tới /luat và danh sách chuyên mục", async ({
    page,
  }) => {
    await page.goto("/s/chung-khoan");
    const sb = page.getByTestId("sidebar");
    await expect(sb).toBeVisible();
    await expect(sb.getByTestId("sidebar-ve-sub")).toBeVisible();
    await expect(sb.getByTestId("sidebar-luat")).toBeVisible();
    await expect(sb.getByTestId("sidebar-cac-sub")).toBeVisible();
    await sb.getByTestId("sidebar-dan-luat").click();
    await expect(page).toHaveURL(/\/luat$/);
  });

  test("trang chủ cũng có sidebar, và nó nói giới thiệu chứ không nói về sub", async ({
    page,
  }) => {
    await page.goto("/");
    const sb = page.getByTestId("sidebar");
    await expect(sb.getByTestId("sidebar-gioi-thieu")).toBeVisible();
    await expect(sb.getByTestId("sidebar-ve-sub")).toHaveCount(0);
    await expect(sb.getByTestId("sidebar-cac-sub")).toBeVisible();
  });

  test("KHÔNG có nút 'Tham gia' ở bất kỳ đâu (PLAN mục 4 loại khỏi v1)", async ({
    page,
  }) => {
    // Assert VẮNG MẶT. PLAN mục 4 *(chốt 2026-08-22)*: v1 chỉ có 2 sub, và "một cái nút
    // vĩnh viễn không bấm được còn tệ hơn không có nút". Kể cả dạng `disabled` làm chỗ
    // đứng — khác hẳn mũi tên vote, thứ SẼ sống ở Phase 2.
    for (const url of ["/", "/s/chung-khoan", "/s/crypto"]) {
      await page.goto(url);
      const than = (await page.locator("body").innerText()).toLowerCase();
      expect(than, `${url} có chữ "tham gia"`).not.toContain("tham gia");
      expect(than, `${url} có chữ "subscribe"`).not.toContain("subscribe");
      await expect(
        page.getByRole("button", { name: /tham gia|theo dõi sub|subscribe/i }),
        url,
      ).toHaveCount(0);
    }
  });

  test("sub không tồn tại vẫn 404 (header mới không được nuốt mất đường đó)", async ({
    request,
  }) => {
    expect((await request.get("/s/khong-co-sub-nay")).status()).toBe(404);
  });
});

/* ---- A9: tab thứ ba + khoảng --------------------------------------------- */

test.describe("A9 — tab 'Nhiều điểm nhất' + chọn khoảng, đổi qua URL param", () => {
  test("ba tab có mặt, tab thứ ba đổi URL và đổi THẬT thứ tự", async ({ page }) => {
    const top = await json<FeedOut>(
      "/api/v1/feeds/moi?sort=nhieu_diem&limit=50",
    );
    const moi = await json<FeedOut>("/api/v1/feeds/moi?limit=50");
    expect(
      top.items.map((m) => m.id),
      "seed cho Top và Mới cùng thứ tự ⇒ bài đo này không phân biệt được gì",
    ).not.toEqual(moi.items.map((m) => m.id));

    await page.goto("/");
    await expect(page.getByTestId("tab-moi")).toHaveAttribute("aria-current", "page");
    await page.getByTestId("tab-nhieu-diem").click();
    await expect(page).toHaveURL(/tab=nhieu-diem/);
    await expect(page.getByTestId("tab-nhieu-diem")).toHaveAttribute(
      "aria-current",
      "page",
    );

    const tren_trang = await page
      .getByTestId("the-mach")
      .evaluateAll((els) =>
        els.map((e) => Number((e as HTMLElement).dataset.machId)),
      );
    expect(tren_trang.slice(0, 3)).toEqual(top.items.slice(0, 3).map((m) => m.id));
  });

  test("hàng chọn khoảng CHỈ hiện ở tab thứ ba", async ({ page }) => {
    await page.goto("/?tab=moi");
    await expect(page.getByTestId("chon-khoang")).toHaveCount(0);
    await page.goto("/?tab=nhieu-diem");
    await expect(page.getByTestId("chon-khoang")).toBeVisible();
  });

  test("đổi khoảng đi qua URL param và lọc THẬT", async ({ page }) => {
    // Mạch HPG cách hôm nay 208 ngày ⇒ nằm ngoài mọi khoảng trừ `tat_ca`. Đó là điều
    // phân biệt "lọc thật" với "chỉ tô lại cái nhãn".
    await page.goto("/?tab=nhieu-diem");
    await expect(page.locator(`[data-mach-id="${hpg.id}"]`)).toHaveCount(1);

    await page.getByTestId("khoang-tuan").click();
    await expect(page).toHaveURL(/khoang=tuan/);
    await expect(page.getByTestId("khoang-tuan")).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.locator(`[data-mach-id="${hpg.id}"]`)).toHaveCount(0);
  });

  test("khoảng rác trên URL KHÔNG làm trang 500, lùi về `tat_ca`", async ({
    page,
    request,
  }) => {
    expect((await request.get("/?tab=nhieu-diem&khoang=rac")).status()).toBe(200);
    await page.goto("/?tab=nhieu-diem&khoang=rac");
    await expect(page.getByTestId("khoang-tat_ca")).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("đổi tab thì RỚT cursor (cursor mang khoá sort của tab sinh ra nó)", async ({
    page,
  }) => {
    // Tha cursor sang tab khác là API trả 400 `cursor_khong_hop_le` ⇒ một cú bấm tab
    // biến thành trang lỗi (hoặc, tệ hơn, một dòng "đang hiện lại từ trang đầu").
    await page.goto("/?tab=moi&cursor=abc");
    const href = await page.getByTestId("tab-nhieu-diem").getAttribute("href");
    expect(href).not.toContain("cursor");
  });

  test("tab thứ ba cũng sống ở trang sub", async ({ page }) => {
    await page.goto("/s/chung-khoan?tab=nhieu-diem");
    await expect(page.getByTestId("tab-nhieu-diem")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("chon-khoang")).toBeVisible();
  });
});

/* ---- B3/B4: `khoang` sống trên URL, nhưng chỉ ÁP DỤNG ở tab có control ----- */

test.describe("B3/B4 — đổi tab không đánh rơi `khoang`, và không lọc lén", () => {
  test("B3 — vòng `nhieu-diem&khoang=tuan` → `moi` → `nhieu-diem` vẫn là `tuan`", async ({
    page,
  }) => {
    // Bản trước bản vá hỏi `tabCoKhoang` của tab ĐÍCH ngay khi dựng href, nên `khoang`
    // chỉ sống sót khi tab đích là `nhieu-diem` — tức chỉ khi KHÔNG đổi tab, đúng ngược
    // lại kịch bản mà docstring của `Feed` nói nó bảo vệ.
    await page.goto("/?tab=nhieu-diem&khoang=tuan");
    await expect(page.getByTestId("khoang-tuan")).toHaveAttribute(
      "aria-current",
      "true",
    );

    await page.getByTestId("tab-moi").click();
    await expect(page).toHaveURL(/tab=moi/);
    await expect(page).toHaveURL(/khoang=tuan/);
    // …mà hàng chọn khoảng thì KHÔNG hiện ở tab này: URL mang theo lựa chọn, màn hình
    // không bày ra một control vô nghĩa.
    await expect(page.getByTestId("chon-khoang")).toHaveCount(0);

    await page.getByTestId("tab-nhieu-diem").click();
    await expect(page.getByTestId("khoang-tuan")).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("B4 — `?tab=moi&khoang=ngay` KHÔNG cắt feed (bộ lọc tàng hình)", async ({
    page,
  }) => {
    // Mạch HPG cách hôm nay 208 ngày ⇒ nằm ngoài mọi khoảng trừ `tat_ca`. Nếu `khoang`
    // đi lên API ở tab này thì nó biến mất — và trên màn hình không có control nào để
    // người dùng thấy vì sao, cũng không có cách nào tắt (PLAN nguyên tắc 7).
    await page.goto("/?tab=moi");
    const so_khong_khoang = await page.getByTestId("the-mach").count();
    await expect(page.locator(`[data-mach-id="${hpg.id}"]`)).toHaveCount(1);

    await page.goto("/?tab=moi&khoang=ngay");
    await expect(page.locator(`[data-mach-id="${hpg.id}"]`)).toHaveCount(1);
    expect(await page.getByTestId("the-mach").count()).toBe(so_khong_khoang);
  });

  test("B4 — chiều ngược: ở tab thứ ba thì `khoang` VẪN lọc thật", async ({ page }) => {
    // Không có vế này thì "cắt `khoang` ở mọi nơi" cũng xanh, và tab thứ ba mất chức
    // năng duy nhất của nó.
    await page.goto("/?tab=nhieu-diem&khoang=tuan");
    await expect(page.locator(`[data-mach-id="${hpg.id}"]`)).toHaveCount(0);
  });
});

/* ---- V6/B8: sub 0 mạch không in số 0 -------------------------------------- */

test.describe("B8 — sub chưa có bài: không phô một con số 0", () => {
  test("header và sidebar của sub rỗng đều không nói `0 mạch`", async ({ page }) => {
    const s = await json<SubChiTietOut>(`/api/v1/subs/${SUB_RONG}`);
    expect(s.so_mach, "sub này phải RỖNG thì bài đo mới đo được gì").toBe(0);

    await page.goto(`/s/${SUB_RONG}`);
    await expect(page.getByTestId("feed-rong")).toBeVisible();
    for (const t of ["sub-header-so", "sidebar-so-mach"]) {
      const dong = page.getByTestId(t);
      await expect(dong).toBeVisible();
      await expect(dong, t).not.toContainText("0 mạch");
      // Ngày lập vẫn ở lại: nó là thông tin thật về nơi chốn này.
      await expect(dong, t).toContainText("lập");
      // **Khẳng định DƯƠNG** (W4/C5). Bản trước chỉ đo bằng phủ định
      // (`not.toContainText("0 mạch")`), nên mutant xoá hẳn chữ thay thế — để lại đúng
      // "lập 22/08/2026" — vẫn xanh: một dòng cụt không nói nó là cái gì.
      //
      // X1/X7 — chuỗi CỨNG, không gọi `dongSoMachSub()` nữa. Bản trước dùng chính hàm
      // đang được đo làm oracle: đổi câu trong `lib/dinh-dang.ts` thành bất cứ thứ gì —
      // kể cả "0 mạch · lập …", đúng cái B8 sinh ra để cấm — thì hai vế cùng đổi và bài
      // đo vẫn xanh. Hai vế `toContainText`/`not.toContainText` bên cạnh giữ nó khỏi
      // rỗng hẳn, nhưng vế DƯƠNG thì tự so với mình.
      //
      // `ngayCuaThoiDiem` vẫn được gọi, và có lý do: ngày lập là dữ liệu của seed, không
      // phải câu chữ của sản phẩm. Ghim nó thành chuỗi cứng là ghim ngày chạy seed.
      await expect(dong, t).toHaveText(
        `Chuyên mục lập ${ngayCuaThoiDiem(s.created_at)}`,
        { useInnerText: true },
      );
      // …và câu ấy KHÔNG được quả quyết "mới": `so_mach = 0` cũng là ca sub bị mod ẩn
      // sạch bài (`api/tests/test_api_sub.py`).
      await expect(dong, t).not.toContainText("mới");
    }
    const than = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(than).not.toMatch(/\b0 mạch\b/);
  });

  test("sub CÓ mạch vẫn in số ĐÚNG như API (không vá quá tay)", async ({ page }) => {
    const s = await json<SubChiTietOut>("/api/v1/subs/chung-khoan");
    expect(s.so_mach).toBeGreaterThan(0);
    await page.goto("/s/chung-khoan");
    await expect(page.getByTestId("sub-header-so")).toContainText(`${s.so_mach} mạch`);
    await expect(page.getByTestId("sidebar-so-mach")).toContainText(
      `${s.so_mach} mạch`,
    );
  });
});

/* ---- V8/B10: sub thứ ba tự xuất hiện ở sidebar VÀ sitemap ----------------- */

test.describe("B10 — danh sách sub hỏi `GET /subs`, không ghi cứng", () => {
  test("sidebar liệt kê ĐÚNG tập sub mà API trả, kể cả sub ngoài hai sub khởi điểm", async ({
    page,
  }) => {
    const cac_sub = await json<SubChiTietOut[]>("/api/v1/subs");
    expect(
      cac_sub.map((s) => s.slug),
      "seed phải có sub ngoài danh sách ghi cứng cũ thì bài đo mới phân biệt được",
    ).toContain(SUB_NGOAI_DANH_SACH);

    await page.goto("/");
    const tren_trang = await page
      .getByTestId("sidebar-cac-sub")
      .locator("a")
      .evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute("href")),
      );
    expect(tren_trang).toEqual(cac_sub.map((s) => `/s/${s.slug}`));
  });

  test("sitemap.xml cũng khai đủ, không teo về hai sub khởi điểm", async ({
    request,
  }) => {
    const cac_sub = await json<SubChiTietOut[]>("/api/v1/subs");
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const s of cac_sub) {
      expect(xml, `sitemap thiếu /s/${s.slug}`).toContain(`/s/${s.slug}<`);
    }
  });
});

/* ---- A10: gập/mở nhánh ---------------------------------------------------- */

test.describe("A10 — `[−]` gập/mở nhánh ở cả khán đài lẫn ngăn kéo", () => {
  test("khán đài: bấm `[−]` giấu thân, bấm lại hiện", async ({ page }) => {
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    const thread = page
      .getByTestId("cay-khan-dai")
      .locator("> [data-binh-luan-id]")
      .first();
    const nut = thread.getByTestId("nut-gap-nhanh").first();
    const than = thread.getByTestId("than-nhanh").first();

    await expect(than).toBeVisible();
    await expect(nut).toHaveText("[−]");
    await expect(nut).toHaveAttribute("aria-expanded", "true");

    await nut.click();
    await expect(than).toBeHidden();
    await expect(nut).toHaveText("[+]");
    await expect(nut).toHaveAttribute("aria-expanded", "false");
    await expect(thread.getByTestId("tom-tat-nhanh").first()).toBeVisible();

    await nut.click();
    await expect(than).toBeVisible();
    await expect(nut).toHaveText("[−]");
  });

  test("ngăn kéo: cũng gập được", async ({ page }) => {
    await page.goto(duongDan(hpg));
    await page.getByTestId("nut-ngan-keo-1").click();
    const lat = page.getByTestId("lat-cat-1");
    await expect(lat).toBeVisible();
    const nut = lat.getByTestId("nut-gap-nhanh").first();
    const than = lat.getByTestId("than-nhanh").first();
    await expect(than).toBeVisible();
    await nut.click();
    await expect(than).toBeHidden();
    await nut.click();
    await expect(than).toBeVisible();
  });

  test("gập một nhánh KHÔNG gập nhánh khác (khác accordion của ngăn kéo)", async ({
    page,
  }) => {
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    const goc = page.getByTestId("cay-khan-dai").locator("> [data-binh-luan-id]");
    await expect(goc.nth(1)).toBeVisible();
    await goc.nth(0).getByTestId("nut-gap-nhanh").first().click();
    await expect(goc.nth(0).getByTestId("than-nhanh").first()).toBeHidden();
    await expect(goc.nth(1).getByTestId("than-nhanh").first()).toBeVisible();
  });

  test("tóm tắt nói ra SỐ NHÁNH bị giấu (không thì `[+]` là hộp kín)", async ({
    page,
  }) => {
    const kd = await khanDai(hpg.id, "hay_nhat");
    const co_con = kd.threads.find((t) => t.replies.length > 0);
    expect(co_con, "seed không có thread nào có reply?").toBeDefined();

    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    const thread = page
      .getByTestId("cay-khan-dai")
      .locator(`> [data-binh-luan-id="${co_con!.id}"]`);
    await expect(thread).toHaveCount(1);
    await thread.getByTestId("nut-gap-nhanh").first().click();
    await expect(thread.getByTestId("tom-tat-nhanh").first()).toContainText(
      `${co_con!.replies.length} nhánh`,
    );
  });

  test("nội dung vẫn nằm trong HTML khi gập (bot vẫn đọc được — PLAN mục 1)", async ({
    page,
  }) => {
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    const thread = page
      .getByTestId("cay-khan-dai")
      .locator("> [data-binh-luan-id]")
      .first();
    const chu = (await thread.innerText()).slice(0, 40);
    await thread.getByTestId("nut-gap-nhanh").first().click();
    // `innerText` bỏ phần ẩn, nên hỏi `textContent` — thứ bot đọc.
    expect(await thread.textContent()).toContain(chu.split("\n")[0]);
  });
});

/* ---- Khối "Câu đáng đọc" (PLAN 5.5) --------------------------------------- */

test.describe("A5 (render) — khối 'Câu đáng đọc' nằm TRÊN CÙNG khối vừa bung", () => {
  test("bấm chân trang ⇒ khối hiện ra, đứng trước cây đầy đủ", async ({ page }) => {
    await page.goto(duongDan(hpg));
    await page.getByTestId("nut-bung-khan-dai").click();
    const khoi = page.getByTestId("cau-dang-doc");
    await expect(khoi).toBeVisible();

    // Thứ tự DOM: khối đứng trước cả thanh sort lẫn cây đầy đủ.
    const thu_tu = await page.evaluate(() => {
      const q = (t: string) => document.querySelector(`[data-testid="${t}"]`);
      const a = q("cau-dang-doc");
      const b = q("thanh-sort");
      const c = q("cay-khan-dai");
      if (!a || !b || !c) return null;
      return [
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
        a.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING,
      ];
    });
    expect(thu_tu).not.toBeNull();
    expect(thu_tu![0]).toBeGreaterThan(0);
    expect(thu_tu![1]).toBeGreaterThan(0);
  });

  test("khối chứa ĐÚNG tập server tính, và có cả bình luận được trích", async ({
    page,
  }) => {
    const tap = await json<KhanDaiOut>(
      `/api/v1/machs/${hpg.id}/comments?dang_doc=1`,
    );
    const moc_trich = hpg.mocs.find((m) => m.trich !== null)!;
    expect(tap.threads.map((t) => t.id)).toContain(moc_trich.trich!.comment_id);

    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    // Khối này là TRÍCH ĐOẠN, không phải chỗ ở của bình luận: nó mang
    // `data-ban-phu-binh-luan-id`, còn `data-binh-luan-id` thuộc về cây đầy đủ (W11).
    const ids = await page
      .getByTestId("cay-cau-dang-doc")
      .locator("> [data-ban-phu-binh-luan-id]")
      .evaluateAll((els) =>
        els.map((e) => Number((e as HTMLElement).dataset.banPhuBinhLuanId)),
      );
    expect(ids).toEqual(tap.threads.map((t) => t.id));
  });

  test("khối là tập CON thật — nhỏ hơn cây đầy đủ", async ({ page }) => {
    const day_du = await khanDai(hpg.id, "hay_nhat");
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    const so_khoi = await page
      .getByTestId("cay-cau-dang-doc")
      .locator("> [data-ban-phu-binh-luan-id]")
      .count();
    const so_day_du = await page
      .getByTestId("cay-khan-dai")
      .locator("> [data-binh-luan-id]")
      .count();
    expect(so_day_du).toBe(day_du.threads.length);
    expect(so_khoi).toBeLessThan(so_day_du);
  });

  test("khối KHÔNG đặt `id=bl-N` (hai chỗ cùng id là deep-link hên xui)", async ({
    page,
  }) => {
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    const trung = await page.evaluate(() => {
      const het = [...document.querySelectorAll("[id^='bl-']")].map((e) => e.id);
      return het.filter((x, i) => het.indexOf(x) !== i);
    });
    expect(trung).toEqual([]);
  });

  test("W11 — một comment id ⇒ ĐÚNG MỘT nút mang `data-binh-luan-id` trong cả trang", async ({
    page,
  }) => {
    // Bất biến bị mất trước W11: `CauDangDoc` render lại tới 10 thread ngay TRÊN cây đầy
    // đủ, và mỗi ngăn kéo render lát cắt của mốc mình (nội dung nằm sẵn trong DOM, chỉ
    // `hidden`), nên một bình luận có tới BA nút cùng thuộc tính. Bài đo cũ sống sót vì
    // mọi locator đều scope; cái bẫy dành cho bài đo viết sau.
    //
    // Mở CẢ ngăn kéo lẫn khán đài để ba nguồn trùng cùng có mặt một lúc — đo ở trạng
    // thái dễ nhất thì hàng rào này chỉ chứng minh trang có render được.
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    await page.getByTestId("nut-ngan-keo-1").click();
    await expect(page.getByTestId("lat-cat-1")).toBeVisible();
    await expect(page.getByTestId("cau-dang-doc")).toBeVisible();

    const dem = await page.evaluate(() => {
      const chinh = [...document.querySelectorAll("[data-binh-luan-id]")].map(
        (e) => (e as HTMLElement).dataset.binhLuanId!,
      );
      const ban_phu = [
        ...document.querySelectorAll("[data-ban-phu-binh-luan-id]"),
      ].map((e) => (e as HTMLElement).dataset.banPhuBinhLuanId!);
      return {
        trung: chinh.filter((x, i) => chinh.indexOf(x) !== i),
        so_chinh: chinh.length,
        // Vế chống rỗng: nếu hai khối phụ ngừng render thì `trung` rỗng một cách
        // rỗng tuếch, và bài đo này lại đo vào chỗ trống.
        so_ban_phu_trung_voi_chinh: ban_phu.filter((x) => chinh.includes(x)).length,
      };
    });

    expect(dem.trung, "comment id có hai nút `data-binh-luan-id`").toEqual([]);
    expect(dem.so_chinh).toBeGreaterThan(5);
    expect(
      dem.so_ban_phu_trung_voi_chinh,
      "không còn khối phụ nào render lại bình luận của cây đầy đủ ⇒ bài đo trên rỗng",
    ).toBeGreaterThan(0);
  });

  test("mạch nhỏ (post thường) KHÔNG render khối — nó sẽ là bản sao của cả cây", async ({
    page,
  }) => {
    await page.goto(`${duongDan(post)}?khan_dai=1&sort=hay_nhat`);
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("cau-dang-doc")).toHaveCount(0);
  });

  test("Y1 — mạch VNM (có bia mộ) cũng KHÔNG render khối, dù tập NHỎ HƠN cây", async ({
    page,
  }) => {
    // Hồi quy do chính X4 đẻ ra, tái hiện trên seed dev mặc định. Ba bài đo cũ của khối
    // này chạy trên HPG (14 gốc, 0 bia mộ) và `post` (2 gốc, 0 bia mộ); bài duy nhất mở
    // khán đài của mạch bia mộ thì scope locator vào TRONG cây, nên một khối mọc thêm ở
    // ngoài không đụng tới. Đây là bài đo chạy trên mạch CÓ bia mộ.
    const tap = await json<KhanDaiOut>(
      `/api/v1/machs/${vnm.id}/comments?dang_doc=1`,
    );
    const day_du = await khanDai(vnm.id, "hay_nhat");

    // Vế chống rỗng thứ nhất: cảnh này phải là cảnh mà LUẬT CŨ ("tập nhỏ hơn tổng thread
    // của cây ⇒ render") quyết định render. Không có nó thì `toHaveCount(0)` bên dưới
    // xanh vì mạch VNM tình cờ không có khối, chứ không vì luật mới đúng.
    expect(tap.tong_thread).toBeLessThan(day_du.tong_thread);
    // Vế chống rỗng thứ hai: và khối vẫn phải là thứ CÓ THẬT để mà render — tập không
    // rỗng, thread cuối của nó là bia mộ (đúng dòng `[bình luận đã xoá]` từng in dưới
    // nhãn "Câu đáng đọc").
    expect(tap.threads.length).toBeGreaterThan(0);
    expect(tap.threads.some((t) => t.trang_thai !== "binh_thuong")).toBe(true);

    await page.goto(`${duongDan(vnm)}?khan_dai=1&sort=hay_nhat`);
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("cay-khan-dai")).toBeVisible();
    await expect(page.getByTestId("cau-dang-doc")).toHaveCount(0);

    // …và lý do THẬT để không render, đọc từ chính API: tập đã chứa trọn phần **thread
    // GỐC** đọc được của cây, nên phép "lọc" không bỏ lại ứng viên nào.
    expect(tap.so_ung_vien_bo_lai).toBe(0);
  });
});

/* ---- A11 (render): ngưỡng gập trên trang thật ----------------------------- */

test("A11 — mạch VNM 6 mốc VẪN gập, và gập đúng 2 mốc", async ({ page }) => {
  // Ngưỡng 5 phải giữ được mạch 6 mốc trong diện gập: nâng nhầm lên 6 là bia mộ đặt
  // trong dải gập của `seed_dev` mất chỗ đứng, và cả nhóm bài đo đó đo vào chỗ trống.
  expect(vnm.entry_count).toBe(6);
  await page.goto(duongDan(vnm));
  await expect(page.getByTestId("dai-gap-nhan")).toContainText("Mốc 2–3");
  await expect(page.getByTestId("dai-gap-nhan")).toContainText("2 mốc");
  await expect(page.getByTestId("moc-2")).toBeHidden();
  await expect(page.getByTestId("moc-4")).toBeVisible();
});

/* ---- A12: hồ sơ user chưa hoạt động --------------------------------------- */

/** Chữ mà **ỨNG DỤNG** nói trong `main` — đã trừ mọi nút mang dấu `CHU_NGUOI_DUNG`.
 *
 * Đây là nửa Y3 của bản vá: hàng rào dưới soi *thứ ứng dụng nói*, không soi *thứ user
 * nói*. Danh sách các chỗ được đánh dấu nằm ở `lib/chu-nguoi-dung.ts`.
 *
 * **Vì sao phải chép rồi gắn vào `body` chứ không đọc `textContent` của bản chép rời.**
 * `innerText` của một nút KHÔNG được render trả về đúng `textContent` — tức nó sẽ kéo
 * theo cả phần đang `hidden` (nhánh bình luận gập, `<details>` chưa mở). Bài đo cũ đọc
 * `innerText` của `main` đang sống; đổi âm thầm sang ngữ nghĩa `textContent` là đổi cả
 * thứ đang được đo. Bản chép nằm ngoài màn hình nên vẫn được render, và nó bị gỡ ngay.
 */
async function chuCuaUngDung(page: Page): Promise<string> {
  const chu = await page.locator("main").evaluate((goc, dau) => {
    const ban = goc.cloneNode(true) as HTMLElement;
    ban.querySelectorAll(`[${dau}]`).forEach((n) => n.remove());
    ban.style.position = "absolute";
    ban.style.left = "-99999px";
    // Gắn cạnh bản gốc, KHÔNG gắn vào `body`: `main` hôm nay là con trực tiếp của
    // `body` nên hai chỗ tương đương, nhưng ngày ai bọc `{children}` bằng một div
    // layout (grid feed + sidebar) thì bản chép rời khỏi chuỗi tổ tiên ⇒ mọi luật CSS
    // phụ thuộc tổ tiên thôi áp ⇒ nút đang ẩn HIỆN LẠI trong bản chép ⇒ hàng rào đo
    // một trang không tồn tại. Đo được: dựng `body > .canh main .x { display:none }`
    // thì bản gắn vào `body` đọc thêm chữ mà trang thật không hiện.
    (goc.parentElement ?? document.body).appendChild(ban);
    const ra = ban.innerText;
    ban.remove();
    return ra;
  }, TEN_DAU_CHU_NGUOI_DUNG);
  return chu.replace(/\s+/g, " ");
}

/** Hai luật của X1, áp cho **cả `main`** của một trang hồ sơ — **trừ phần người dùng gõ**.
 *
 * Tách ra hàm vì từ X1 có hai ca gọi nó (hồ sơ trắng trơn, và hồ sơ có hoạt động nhưng 0
 * mạch hiện) — chép tay hai bản là hai bản sẽ lệch nhau ở lượt sửa sau.
 *
 * **Vì sao hai luật đo hai kiểu khác nhau:**
 *
 * - *quả quyết về quá khứ* — so bằng `includes`. Ba cụm đều nhiều từ và không cụm nào là
 *   khúc giữa của một từ tiếng Việt khác, nên khớp chuỗi con là đủ và đọc dễ hơn;
 * - *rò việc kiểm duyệt* — so theo **RANH GIỚI TỪ**, `\p{L}` (chữ cái Unicode) chứ không
 *   phải `\b` (ASCII, mù với tiếng Việt có dấu). Bốn từ này ngắn, và `ẩn` là khúc giữa
 *   của những từ hoàn toàn vô hại: *bẩn*, *cẩn thận*, *lẩn quẩn*.
 *
 * **Ranh giới từ KHÔNG đủ, và X1 đã tin nhầm là đủ** *(sửa ở Y3)*. Docstring cũ nêu *gỡ
 * gạc* làm ví dụ "được ranh giới từ bảo vệ"; chạy đúng regex này thì `Chơi để gỡ gạc`
 * **KHỚP** — trong *gỡ gạc*, `gỡ` là một từ **trọn vẹn**, không phải khúc giữa. `Tôi
 * thích sống ẩn dật` cũng khớp, cùng lý do. Bài chống-đỏ-giả ở dưới chỉ thử ba ca
 * *cẩn/bẩn/lẩn*, tức không thử chính ví dụ mà docstring nêu.
 * Ranh giới thật không nằm ở hình dạng chuỗi mà ở chỗ **ai nói câu đó**, nên đầu vào của
 * hàm này là `chuCuaUngDung(page)` chứ không còn là `main.innerText`. Phạm vi vẫn là CẢ
 * `main`, trừ đúng những nút in chữ người dùng.
 *
 * Hai lỗ nhỏ, ghi ra cho có tên chứ chưa vá (không có cửa nào vào chúng ở 1d):
 * chuỗi NFD (`ẩn` viết thành `â` + dấu tổ hợp) **không** khớp, và `xóa` (dấu kiểu cũ)
 * **không** khớp — chỉ `xoá` khớp.
 */
function khongQuaQuyetVeQuaKhu(than: string) {
  const ca_trang = than.toLowerCase();
  for (const cam of ["chưa đăng", "chưa từng", "không có bài"]) {
    expect(ca_trang, `cả trang không được quả quyết "${cam}"`).not.toContain(cam);
  }
  for (const ro of ["ẩn", "gỡ", "xoá", "kiểm duyệt"]) {
    const nguyen_tu = new RegExp(`(^|[^\\p{L}])${ro}([^\\p{L}]|$)`, "u");
    expect(ca_trang, `cả trang không được rò "${ro}"`).not.toMatch(nguyen_tu);
  }
}

test("X1 — hàng rào trên bắt được hàng giả (không phải một luật nghiệm đúng với mọi thứ)", () => {
  // Vế chống rỗng. Không có nó thì `khongQuaQuyetVeQuaKhu` có thể `return` ngay và hai ca
  // gọi bên dưới xanh — đúng loại proof đo RỖNG mà repo đã dính.
  for (const gia of [
    "Tài khoản này chưa đăng mạch hay bình luận nào.", // câu W4 vừa xoá
    "Chưa đăng mạch nào.", // câu X1 vừa xoá, cửa anh em của nó
    "Người này chưa từng viết gì.",
    "Bài của người này đã bị ẩn.", // rò việc kiểm duyệt
  ]) {
    expect(() => khongQuaQuyetVeQuaKhu(gia), gia).toThrow();
  }

  // …và nó KHÔNG đỏ với chữ hợp lệ chỉ vì chứa khúc chữ giống. Đây là cả lý do phép so
  // theo ranh giới từ tồn tại (§3 rủi ro 2 của plan lượt vá 3): `bio` là chữ người dùng
  // gõ, và `ẩn` là khúc giữa của *cẩn thận*, *bẩn*, *lẩn quẩn*.
  expect(() =>
    khongQuaQuyetVeQuaKhu("Bio: tôi cẩn thận, không chơi bẩn, lẩn quẩn ở phố."),
  ).not.toThrow();

  // Chiều thứ ba, và là chỗ X1 tin nhầm: ranh giới từ **không** cứu được hai chuỗi này.
  // Chúng phải khớp — đó là lý do Y3 không chữa bằng cách siết regex mà chữa bằng cách
  // đừng đưa chữ người dùng vào đây.
  for (const tu_trong_ven of CHU_VO_TOI) {
    expect(() => khongQuaQuyetVeQuaKhu(tu_trong_ven), tu_trong_ven).toThrow();
  }
});

/** Hai chuỗi mà bản X1 tưởng được ranh giới từ bảo vệ — dùng cho cả hai chiều của Y3. */
const CHU_VO_TOI = ["Chơi để gỡ gạc", "Tôi thích sống ẩn dật"];

test.describe("Y3 — hàng rào soi chữ ỨNG DỤNG, không soi chữ người dùng gõ", () => {
  test("cùng chuỗi ấy nằm trong nút NGƯỜI DÙNG ⇒ KHÔNG đỏ", async ({ page }) => {
    // Dựng DOM thẳng thay vì đợi một `bio` như thế xuất hiện trong seed: thứ đang được đo
    // là phép TRỪ nút đánh dấu, và nó phải đo được mà không bắt seed phải chứa sẵn hai
    // chuỗi vô nghĩa. Thuộc tính lấy từ chính hằng mà component đang spread ra.
    await page.setContent(`<main>
      <h1 ${TEN_DAU_CHU_NGUOI_DUNG}>${CHU_VO_TOI[0]}</h1>
      <p ${TEN_DAU_CHU_NGUOI_DUNG}>${CHU_VO_TOI[1]}</p>
      <p>Chưa có mạch nào hiện ở đây.</p>
    </main>`);

    const chu = await chuCuaUngDung(page);
    // Vế chống rỗng: phép trừ phải chừa lại chữ của ứng dụng, không được trừ sạch `main`.
    expect(chu).toContain("Chưa có mạch nào hiện ở đây.");
    for (const bi_tru of CHU_VO_TOI) expect(chu).not.toContain(bi_tru);

    khongQuaQuyetVeQuaKhu(chu);
  });

  test("đúng hai chuỗi ấy do ỨNG DỤNG nói ⇒ ĐỎ", async ({ page }) => {
    // Chiều đối xứng, và là chiều làm hàng rào còn có răng: bỏ nút đánh dấu ra khỏi phép
    // trừ thì `gỡ`/`ẩn` vẫn phải bị bắt ở chỗ nó thật sự nguy hiểm.
    for (const ung_dung_noi of CHU_VO_TOI) {
      await page.setContent(`<main><p>${ung_dung_noi}</p></main>`);
      const chu = await chuCuaUngDung(page);
      expect(() => khongQuaQuyetVeQuaKhu(chu), ung_dung_noi).toThrow();
    }
  });
});

test.describe("A12 — hồ sơ user chưa hoạt động: không `×0` nào", () => {
  test("user chỉ bỏ phiếu (0 mạch, 0 mốc, 0 bình luận) ⇒ ẩn cả khối chỉ số", async ({
    page,
  }) => {
    // `nguoi_xem_01` của `seed_dev` chỉ tồn tại để bỏ phiếu — đúng hình dạng "người mới".
    const hs = await json<HoSoOut>("/api/v1/users/nguoi_xem_01");
    expect([hs.so_mach, hs.so_moc, hs.so_binh_luan, hs.duoc_trich]).toEqual([
      0, 0, 0, 0,
    ]);

    await page.goto("/u/nguoi_xem_01");
    await expect(page.getByTestId("chi-so")).toHaveCount(0);
    await expect(page.getByTestId("chi-so-duoc-trich")).toHaveCount(0);
    const cho_trong = page.getByTestId("ho-so-chua-hoat-dong");
    await expect(cho_trong).toBeVisible();

    // W4/C5 — khẳng định DƯƠNG về câu thay thế, và ba điều nó KHÔNG được nói.
    // Bốn con số đều đếm nội dung **hiện được**, nên nhánh này cũng là hồ sơ của người
    // bị mod ẩn sạch bài (`api/tests/test_api_ho_so.py::
    // test_bon_chi_so_ve_0_khi_noi_dung_bi_an_SACH`): câu cũ "Tài khoản này chưa đăng
    // mạch hay bình luận nào." là một khẳng định về QUÁ KHỨ mà API không hề nói.
    await expect(cho_trong).toHaveText("Chưa có hoạt động nào hiện ở hồ sơ này.");

    // X1 — **khẳng định dương cho chỗ thứ hai**: danh sách mạch rỗng. Nó nằm ngoài thẻ
    // `cho_trong`, và đó chính là lý do W4 để lọt nó: bốn cụm cấm bên dưới trước đây chỉ
    // quét trong thẻ ấy.
    const khong_mach = page.getByTestId("ho-so-khong-mach");
    await expect(khong_mach).toHaveText("Chưa có mạch nào hiện ở đây.");

    // Y3: chữ của ỨNG DỤNG trong `main` — `display_name`, `bio` và tên mạch bị trừ ra.
    const than = await chuCuaUngDung(page);

    // Vế chống rỗng của Y3 **trên trang thật**: phép trừ phải cắt được thứ có thật, nếu
    // không hàng rào vẫn đang quét chữ người dùng mà ta tưởng là không. Gỡ dấu
    // `CHU_NGUOI_DUNG` khỏi `app/u/[username]/page.tsx` là hai dòng này đỏ.
    expect(await page.locator("main").innerText()).toContain("u/nguoi_xem_01");
    expect(than).not.toContain("nguoi_xem_01");

    // X1 — bốn cụm cấm nay quét **CẢ `main`**, không riêng một thẻ. Chỗ nào trên hồ sơ
    // cũng không được quả quyết về quá khứ của người ta: cả bốn con số lẫn danh sách
    // mạch đều đếm nội dung **hiện được** (`api/tests/test_api_ho_so.py::
    // test_bon_chi_so_ve_0_khi_noi_dung_bi_an_SACH`), nên "chưa đăng" là một câu API
    // không hề nói. Và không chỗ nào được rò ra rằng có thứ vừa bị gỡ.
    khongQuaQuyetVeQuaKhu(than);

    // Không `×0`, và cả cái NHÃN của nó cũng phải biến mất — PLAN nguyên tắc 9 + 5.6:
    // `Được trích ×N` là phần thưởng chủ lực, in `×0` vào mặt người mới là nói với họ
    // rằng họ đang ở cuối bảng trước khi kịp viết chữ nào.
    expect(than).not.toContain("×0");
    expect(than).not.toContain("Được trích");
    expect(than).not.toMatch(/(Mạch|Mốc|Bình luận)\s*0\b/);
  });

  test("X1 — CÓ hoạt động nhưng 0 mạch hiện: khối chỉ số hiện, và KHÔNG câu nào quả quyết", async ({
    page,
  }) => {
    // Ca mà W4 để lọt, và nó dễ gặp hơn ca A12 ở trên: `hai_lua` bình luận 4 lần, không
    // có mạch nào ⇒ `da_hoat_dong = true` ⇒ nhánh `ho-so-chua-hoat-dong` KHÔNG chạy, nên
    // mọi thứ W4 vá đều nằm ngoài đường đi. Câu duy nhất còn nói về quá khứ là câu dưới
    // danh sách mạch — đúng chỗ X1 vá.
    //
    // Hình dạng này cũng là hình dạng của một người bị mod ẩn sạch bài: `users.py` lọc
    // `hidden_at__isnull=True` nên hai ca không phân biệt được từ ngoài, và đó là cả lý
    // do câu ở đây không được quả quyết.
    const hs = await json<HoSoOut>("/api/v1/users/hai_lua");
    expect(hs.so_mach, "seed đổi — `hai_lua` phải là người 0 mạch").toBe(0);
    expect(hs.so_binh_luan, "…và phải CÓ bình luận, không thì rơi vào ca A12").toBeGreaterThan(0);

    await page.goto("/u/hai_lua");
    await expect(page.getByTestId("chi-so")).toBeVisible();
    await expect(page.getByTestId("ho-so-chua-hoat-dong")).toHaveCount(0);
    await expect(page.getByTestId("ho-so-khong-mach")).toHaveText(
      "Chưa có mạch nào hiện ở đây.",
    );

    khongQuaQuyetVeQuaKhu(await chuCuaUngDung(page));
  });

  test("user CÓ hoạt động thì khối chỉ số vẫn hiện đủ (không vá quá tay)", async ({
    page,
  }) => {
    await page.goto(`/u/${hpg.author.username}`);
    await expect(page.getByTestId("chi-so")).toBeVisible();
    await expect(page.getByTestId("chi-so-duoc-trich")).toBeVisible();
    await expect(page.getByTestId("ho-so-chua-hoat-dong")).toHaveCount(0);
    // Chiều ngược của X1: người CÓ mạch hiện thì không có câu rỗng nào.
    await expect(page.getByTestId("ho-so-khong-mach")).toHaveCount(0);

    // Y3 — hồ sơ CÓ thẻ mạch là chỗ duy nhất `TheMach` lọt vào phạm vi quét, và thẻ ấy
    // in bốn chuỗi người dùng gõ (tiêu đề, slug sub, tên tác giả, kết quả). Gỡ dấu
    // `CHU_NGUOI_DUNG` khỏi `components/the-mach.tsx` là hai dòng dưới đỏ, và lúc đó một
    // tiêu đề mạch chứa đúng chữ "gỡ" sẽ làm cả hàng rào đỏ giả.
    const than = await chuCuaUngDung(page);
    expect(await page.locator("main").innerText()).toContain(hpg.title);
    expect(than).not.toContain(hpg.title);
    khongQuaQuyetVeQuaKhu(than);
  });
});
