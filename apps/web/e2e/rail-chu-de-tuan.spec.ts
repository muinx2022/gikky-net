import type { FeedOut, MachTomTatOut } from "@gikky/api-client";
import { expect, test, type Page } from "@playwright/test";

import { USER_NHIEU_MACH } from "./du-lieu";
import { py } from "./thu-vien";

/** Rail phải — đợt E của việc 14 (plan `plans/2026-11-11-thong-nhat-giao-dien-toan-site.md` §4.7,
 * tiêu chí T7), trên BẢN BUILD thật.
 *
 * - Khối "Chủ đề tuần này" (`sidebar-chu-de-tuan`) ở mọi trang có rail TRỪ `/` (khối tiêu điểm đã
 *   có), trang tĩnh `/luat`, và trang mạch của CHÍNH chủ đề ấy. Chủ đề là cái khối tiêu điểm của
 *   `/` đang hiện — đo bằng API, cài đặt phép chọn ĐỘC LẬP với `lib/chu-de.ts::chonChuDeNoi` (bài
 *   đo dùng chung cài đặt với thứ nó đo thì lỗi tự triệt tiêu).
 * - `/` và `/luat` GIỮ link "Chủ đề thảo luận →" ở khối giới thiệu: ở đó nó là link `/chu-de` duy
 *   nhất (luật "SEO chỉ cộng"). Có khối chủ đề thì link ấy nhường cho "Các chủ đề trước →".
 * - T7: rail không còn link "Trang chủ" (`href="/"`); `/luat` có ≤ 2 link `/luat` trong rail;
 *   `/chu-de` không có link nào trỏ về chính nó trong rail.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Chủ đề khối tiêu điểm của `/` chọn: trong 5 chủ đề đầu của feed `moi`, cái XUẤT BẢN sau cùng
 * (hoà ⇒ `id` lớn hơn). Viết lại độc lập — xem docstring đầu file. */
async function chuDeDangNoi(): Promise<MachTomTatOut> {
  const f = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=thao_luan&limit=5");
  const chon = [...f.items].sort(
    (a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id - a.id,
  )[0];
  if (chon === undefined) throw new Error("seed e2e không có chủ đề thảo luận công khai nào");
  return chon;
}

async function machDauTien(loai: string, bo?: number): Promise<string> {
  const f = await api<FeedOut>(`/api/v1/feeds/moi?limit=10&loai_mach=${loai}`);
  const m = f.items.find((x) => x.id !== bo);
  if (m === undefined) throw new Error(`seed không có mạch loại ${loai}`);
  return `/m/${m.slug}-${m.id}`;
}

const rail = (page: Page) => page.getByTestId("rail-phai");

test.describe("E1 — khối 'Chủ đề tuần này' ở rail", () => {
  test("có ở mọi trang có rail (trừ `/`, `/luat`): đúng chủ đề của trang chủ, ba link, HTML server-render", async ({
    page,
    request,
  }) => {
    const chon = await chuDeDangNoi();
    const href_mach = `/m/${chon.slug}-${chon.id}`;
    const urls = [
      "/?tab=moi&loai_mach=nhat_ky",
      "/s/chung-khoan",
      await machDauTien("nhat_ky"),
      await machDauTien("thao_luan", chon.id),
      `/u/${USER_NHIEU_MACH}`,
      "/tim-kiem?q=e2e",
      "/dang-nhap",
      "/chu-de",
    ];
    for (const url of urls) {
      // HTML THÔ: khối do server nạp + vẽ (Sidebar không gọi API), bot đọc được ba link.
      const html = await (await request.get(url)).text();
      expect(html, `${url}: HTML server không có khối`).toContain('data-testid="sidebar-chu-de-tuan"');

      await page.goto(url);
      const khoi = rail(page).getByTestId("sidebar-chu-de-tuan");
      await expect(khoi, url).toHaveCount(1);
      const tieu_de = khoi.getByTestId("sidebar-chu-de-tuan-link");
      await expect(tieu_de, url).toHaveText(chon.title);
      await expect(tieu_de, url).toHaveAttribute("href", href_mach);
      const vao = await khoi.getByTestId("sidebar-chu-de-tuan-vao").getAttribute("href");
      expect(vao, `${url}: "Vào thảo luận" tới khán đài của chủ đề`).toMatch(
        new RegExp(`^${href_mach.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?.*#khan-dai$`),
      );
      if (url === "/chu-de") {
        await expect(khoi.getByTestId("sidebar-chu-de-tuan-truoc"), "/chu-de: không tự trỏ").toHaveCount(0);
      } else {
        await expect(khoi.getByTestId("sidebar-chu-de-tuan-truoc"), url).toHaveAttribute("href", "/chu-de");
      }
      // Link cũ "Chủ đề thảo luận →" nhường chỗ: không in hai lối cùng đích.
      await expect(rail(page).getByTestId("sidebar-dan-chu-de"), url).toHaveCount(0);
    }
  });

  test("`/` và `/luat` KHÔNG có khối; link `/chu-de` của khối giới thiệu vẫn còn (link duy nhất tới kho)", async ({
    page,
  }) => {
    for (const url of ["/", "/luat"]) {
      await page.goto(url);
      await expect(rail(page).getByTestId("sidebar-gioi-thieu"), url).toBeVisible();
      await expect(page.getByTestId("sidebar-chu-de-tuan"), url).toHaveCount(0);
      await expect(rail(page).getByTestId("sidebar-dan-chu-de"), url).toHaveAttribute("href", "/chu-de");
    }
  });

  test("trang mạch của CHÍNH chủ đề ấy: không có khối (cả ba link đều tự trỏ hoặc đã có ở đầu trang)", async ({
    page,
  }) => {
    const chon = await chuDeDangNoi();
    await page.goto(`/m/${chon.slug}-${chon.id}`);
    await expect(rail(page).getByTestId("sidebar-bai-moi")).toBeVisible();
    await expect(page.getByTestId("sidebar-chu-de-tuan")).toHaveCount(0);
    // Lối về kho vẫn có — ở đầu trang mạch chủ đề.
    await expect(page.getByTestId("ve-chu-de")).toHaveAttribute("href", "/chu-de");
  });
});

/** Vòng sửa 3 (phản biện): seed e2e có thứ tự feed `moi` (`last_content_at`) TRÙNG thứ tự xuất bản,
 * nên một rail chọn nhầm `items[0]` vẫn xanh ở bài trên. Ở đây dựng đúng ca hai thứ tự KHÁC nhau —
 * đẩy `last_content_at` của một chủ đề CŨ lên trước (đúng điều nối mốc vào chủ đề cũ làm; chỉ đổi
 * dấu thời gian, không tạo mốc / bình luận / phiếu nào), khôi phục ở `afterAll` — rồi so khối tiêu
 * điểm của `/` với khối rail của các trang khác trên CÙNG bản build. */
test.describe.serial("E1 — rail và trang chủ chọn CÙNG chủ đề khi feed lệch thứ tự xuất bản", () => {
  let cu: { id: number; last_content_at: string } | null = null;

  test.beforeAll(async () => {
    const chon = await chuDeDangNoi();
    const f = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=thao_luan&limit=5");
    const khac = f.items.find((m) => m.id !== chon.id && Date.parse(m.published_at) < Date.parse(chon.published_at));
    if (khac === undefined) throw new Error("seed cần ≥ 2 chủ đề công khai xuất bản khác ngày");
    // `shell` in thêm dòng "N objects imported automatically" — giá trị là dòng CUỐI, có tiền tố riêng.
    const ra = py(`from core.models import Mach; print("LCA=" + Mach.objects.get(id=${khac.id}).last_content_at.isoformat())`);
    const goc = /^LCA=(\S+)\s*$/m.exec(ra)?.[1];
    if (goc === undefined) throw new Error(`không đọc được last_content_at: ${ra}`);
    cu = { id: khac.id, last_content_at: goc };
    py(
      "from datetime import timedelta; from django.utils import timezone; from core.models import Mach; " +
        `Mach.objects.filter(id=${khac.id}).update(last_content_at=timezone.now() + timedelta(minutes=5))`,
    );
  });

  test.afterAll(() => {
    if (cu === null) return;
    py(
      "from django.utils.dateparse import parse_datetime; from core.models import Mach; " +
        `Mach.objects.filter(id=${cu.id}).update(last_content_at=parse_datetime(${JSON.stringify(cu.last_content_at)}))`,
    );
  });

  test("feed đã lệch (vế tiền đề); `/` và rail của `/s/<sub>`, `/chu-de` cùng một chủ đề — cái xuất bản sau cùng", async ({
    page,
  }) => {
    const chon = await chuDeDangNoi();
    const f = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=thao_luan&limit=5");
    expect(f.items[0]?.id, "vế tiền đề: phần tử đầu feed phải là chủ đề CŨ vừa bị đẩy lên").toBe(cu?.id);
    expect(f.items[0]?.id).not.toBe(chon.id);

    await page.goto("/");
    const tieu_diem = await page.getByTestId("khoi-thao-luan").getByTestId("chu-de-the").getAttribute("data-mach-id");
    expect(Number(tieu_diem), "khối tiêu điểm của `/`").toBe(chon.id);

    for (const url of ["/s/chung-khoan", "/chu-de"]) {
      await page.goto(url);
      const href = await rail(page).getByTestId("sidebar-chu-de-tuan-link").getAttribute("href");
      expect(href, `${url}: rail khác khối tiêu điểm của /`).toBe(`/m/${chon.slug}-${chon.id}`);
    }
  });
});

test.describe("E2 + T7 — rail bớt lặp", () => {
  test("không còn link 'Trang chủ' trong rail; `ChanTrang` chỉ còn dòng miễn trừ", async ({ page }) => {
    for (const url of ["/", "/?tab=moi", "/s/chung-khoan", await machDauTien("nhat_ky"), "/chu-de", "/luat", "/dang-nhap"]) {
      await page.goto(url);
      await expect(page.getByTestId("disclaimer"), url).toBeVisible();
      await expect(rail(page).locator('a[href="/"]'), `${url}: link "Trang chủ" trong rail`).toHaveCount(0);
      await expect(page.getByTestId("chan-trang").locator("a"), `${url}: link trong chân trang`).toHaveCount(0);
    }
  });

  test("`/luat`: ≤ 2 link `/luat` trong rail (khối khách + khối luật); `/chu-de`: 0 link tự trỏ trong rail", async ({
    page,
  }) => {
    await page.goto("/luat");
    // Chờ khối khách (client) để đếm cả link của nó — đếm trước lúc ấy là đếm thiếu.
    await expect(rail(page).getByTestId("khoi-khach")).toBeVisible();
    const so_luat = await rail(page).locator('a[href="/luat"]').count();
    expect(so_luat, "đo rỗng: khối luật phải dẫn /luat").toBeGreaterThanOrEqual(1);
    expect(so_luat).toBeLessThanOrEqual(2);

    await page.goto("/chu-de");
    await expect(rail(page).getByTestId("sidebar-chu-de-tuan")).toBeVisible();
    await expect(rail(page).locator('a[href="/chu-de"]')).toHaveCount(0);
  });

  test("`/`: câu 'Có thể ghi riêng tư…' chỉ in MỘT lần (ô soạn), rail không lặp", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(rail(page).getByTestId("khoi-khach")).toBeVisible();
    // `innerText` (chữ HIỆN ra), không `textContent`: payload RSC trong `<script>` cũng mang câu ấy.
    const than = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(than.match(/Có thể ghi riêng tư, công khai khi bạn muốn\./g)?.length).toBe(1);
    await expect(rail(page)).not.toContainText("Có thể ghi riêng tư");
  });
});
