import type { FeedOut, NhatKyDangBanOut } from "@gikky/api-client";
import { expect, test, type Page } from "@playwright/test";

/** Dải "Đang được bàn" dưới khối "Nhật ký mới" của `/` (plan `2026-11-13-nhat-ky-dang-ban.md`, D2/D3/D7).
 *
 * Dữ liệu là cụm `USERNAME_DANG_BAN` của `seed_e2e` — đúng ca của user: tác giả X có nhật ký CŨ
 * đang được bàn (3 bình luận của người khác, giờ được làm tươi mỗi lần seed chạy) và một nhật ký
 * MỚI hơn có 2 bình luận (vòng sửa 1 — để API dải trả CẢ HAI bài). Khối trên (mỗi tác giả một bài
 * mới nhất) chỉ còn bài mới; bài cũ phải nằm ở dải, bài mới phải bị dải bỏ. Phép đếm của dải được đo bằng pytest (`api/tests/test_api_nhat_ky_dang_ban.py`); ở
 * đây chỉ đo `/` VẼ đúng: đúng chỗ, không lặp với khối trên, không tràn ngang ở 390px.
 *
 * Tiêu đề chép từ hằng của `api/core/management/commands/seed_e2e.py` — đổi bên đó thì đổi đây.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";
const TAC_GIA_X = "e2e_tac_gia_dang_ban";
const TIEU_DE_CU = "Nhật ký e2e cũ đang được bàn — HPG thử nghiệm";
const TIEU_DE_MOI = "Nhật ký e2e mới hơn của tác giả đang được bàn";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

const idsTrong = (page: Page, khoi: string, testid: string) =>
  page
    .getByTestId(khoi)
    .getByTestId(testid)
    .evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.machId)));

/** Tiền điều kiện chống rỗng: API thật sự đặt bài cũ của X vào dải và bài mới của X vào khối trên. */
async function caCuaUser() {
  const dang_ban = await api<NhatKyDangBanOut>("/api/v1/feeds/nhat-ky-dang-ban?limit=10");
  const cu = dang_ban.items.find(
    (x) => x.mach.title === TIEU_DE_CU && x.mach.author.username === TAC_GIA_X,
  );
  expect(cu, "tiền điều kiện: API dải có nhật ký cũ của X (seed_e2e đã làm tươi bình luận?)").toBeDefined();
  expect(cu!.so_binh_luan_gan_day).toBeGreaterThanOrEqual(2);

  const moi_tac_gia = await api<FeedOut>("/api/v1/feeds/nhat-ky-moi-tac-gia?limit=8");
  const cua_x = moi_tac_gia.items.filter((m) => m.author.username === TAC_GIA_X);
  expect(cua_x.map((m) => m.title), "tiền điều kiện: khối trên chỉ có bài MỚI của X").toEqual([
    TIEU_DE_MOI,
  ]);
  return { dang_ban, cu: cu!.mach, moi: cua_x[0] };
}

test.describe("D — dải Đang được bàn của trang chủ", () => {
  test("D2/D3 — nhật ký cũ đang được bàn của X nằm ở dải, bài mới của X ở khối trên, không id nào ở cả hai", async ({
    page,
  }) => {
    const { dang_ban, cu, moi } = await caCuaUser();
    await page.goto("/");

    const tren = await idsTrong(page, "khoi-nhat-ky", "the-mach");
    const dai = await idsTrong(page, "khoi-nhat-ky-dang-ban", "dang-ban-muc");
    expect(tren).toContain(moi.id);
    expect(tren).not.toContain(cu.id);
    // Chống rỗng cho phép đo "không lặp": API dải THẬT SỰ trả ít nhất một mạch đang nằm ở khối
    // trên (seed cho bài mới của X 2 bình luận — vòng sửa 1). Thiếu dòng này thì dải không lặp
    // chỉ vì API chưa từng trả mạch nào trùng, và bước loại trùng hỏng vẫn xanh.
    expect(
      dang_ban.items.some((x) => tren.includes(x.mach.id)),
      "tiền điều kiện: API dải có mạch trùng khối trên",
    ).toBe(true);
    expect(dang_ban.items.map((x) => x.mach.id), "tiền điều kiện: API dải có bài mới của X").toContain(
      moi.id,
    );
    expect(dai).toContain(cu.id);
    expect(dai).not.toContain(moi.id);
    expect(dai.filter((id) => tren.includes(id)), "không lặp với khối Nhật ký mới").toEqual([]);
    expect(dai.length).toBeLessThanOrEqual(5);
    // Dải giữ đúng thứ tự API sau khi bỏ những mạch đã có ở khối trên.
    expect(dai).toEqual(
      dang_ban.items.map((x) => x.mach.id).filter((id) => !tren.includes(id)).slice(0, 5),
    );
  });

  test("D3 — section đứng NGAY sau khối Nhật ký mới; chữ, link khán đài và 'Xem thêm →'", async ({
    page,
  }) => {
    const { cu } = await caCuaUser();
    await page.goto("/");
    const ke = await page
      .getByTestId("khoi-nhat-ky")
      .evaluate((el) => el.nextElementSibling?.getAttribute("data-testid") ?? null);
    expect(ke).toBe("khoi-nhat-ky-dang-ban");

    const khoi = page.getByTestId("khoi-nhat-ky-dang-ban");
    await expect(khoi.getByRole("heading", { level: 2 })).toHaveText("Đang được bàn");
    await expect(khoi).toHaveAttribute("aria-labelledby", "tieu-khoi-nhat-ky-dang-ban");
    await expect(khoi).toContainText("Nhật ký có nhiều bình luận trong 48 giờ qua");
    await expect(khoi.getByTestId("dang-ban-xem-them")).toHaveAttribute(
      "href",
      "/?tab=dang-dien-ra&loai_mach=nhat_ky",
    );

    const hang = khoi.locator(`[data-testid="dang-ban-muc"][data-mach-id="${cu.id}"]`);
    await expect(hang.getByRole("link", { name: TIEU_DE_CU })).toHaveAttribute(
      "href",
      `/m/${cu.slug}-${cu.id}#khan-dai`,
    );
    await expect(hang).toContainText("E2E Tác giả đang được bàn");
    await expect(hang).toContainText(/\d+ bình luận mới/);
  });

  test("D7 — 390px: dải không tràn ngang", async ({ page }) => {
    await caCuaUser();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const khoi = page.getByTestId("khoi-nhat-ky-dang-ban");
    await expect(khoi).toBeVisible();
    const do_ = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="khoi-nhat-ky-dang-ban"]')!;
      const r = el.getBoundingClientRect();
      const hang = [...el.querySelectorAll('[data-testid="dang-ban-muc"]')].map(
        (h) => h.getBoundingClientRect().right,
      );
      return {
        cuon: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        trai: r.left,
        phai: r.right,
        hang_phai: Math.max(...hang),
        rong: window.innerWidth,
      };
    });
    expect(do_.cuon, JSON.stringify(do_)).toBeLessThanOrEqual(0);
    expect(do_.trai).toBeGreaterThanOrEqual(0);
    expect(do_.phai).toBeLessThanOrEqual(do_.rong);
    expect(do_.hang_phai).toBeLessThanOrEqual(do_.rong);
  });
});
