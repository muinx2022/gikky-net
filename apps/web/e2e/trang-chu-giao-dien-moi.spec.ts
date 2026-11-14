import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { FeedOut, MachTomTatOut, TrangBanTinOut } from "@gikky/api-client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { tieuDeBanTinGon } from "../lib/ban-tin";

import { dungTaiKhoan } from "./danh-tinh";
import {
  NK_BOT,
  NK_DONG,
  NK_THUONG,
  TIEN_TO_NHAT_KY_W,
  donNhatKyW,
  donThuVien,
  dungNhatKyW,
  dungThuVien,
  py,
} from "./thu-vien";

/** Trang chủ giao diện mới (plan `plans/2026-11-11-homepage-v2-giao-dien-moi.md`, tiêu chí
 * G1–G7) — chạy trên BẢN BUILD thật, nhóm **W**. Bố cục hai cột, SEO của `<head>`, mỗi tác giả
 * một thẻ… đã có ở `trang-chu-v2.spec.ts` / `seo-trang-chu.spec.ts`; file này đo cái MỚI: thứ
 * tự khối, chủ đề tuần, thẻ nhật ký (dải lệnh · BOT · chip · ảnh nhỏ · chân thẻ), tab lọc trạng
 * thái, dải chân khối, bài viết (khối rail từ việc 24), số link `/m/`, mobile.
 *
 * Dữ liệu TẠM (xem `thu-vien.ts`): thư viện bài viết trong các sub nhóm + ba nhật ký mới nhất
 * (lệnh đủ năm số của tài khoản `la_bot`, lệnh BÁN đã đóng sổ, nhật ký thường). Dựng ở
 * `beforeAll`, xoá sạch ở `afterAll` và cả ở đầu `beforeAll`. Nguồn sự thật kỳ vọng là **API**
 * và những con số cứng của chính dữ liệu tạm — không phải HTML mình vừa render.
 *
 * Ảnh chụp (desktop · mobile · tối): đặt `E2E_ANH_CHUP=<thư mục>` thì nhóm `W-ANH` ghi PNG vào
 * đó; không đặt thì bỏ qua (không đổi hành vi của lần chạy thường).
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

test.beforeAll(() => {
  donThuVien();
  donNhatKyW();
  dungThuVien();
  dungNhatKyW();
});
test.afterAll(() => {
  donThuVien();
  donNhatKyW();
});

/** Thẻ nhật ký theo tiêu đề tạm — qua API để lấy `id` rồi nhắm `data-mach-id`. */
async function theNhatKy(page: Page, tieu_de: string): Promise<{ the: Locator; mach: MachTomTatOut }> {
  const f = await api<FeedOut>("/api/v1/feeds/nhat-ky-moi-tac-gia?limit=20");
  const mach = f.items.find((m) => m.title === tieu_de);
  expect(mach, `nhật ký tạm "${tieu_de}" phải nằm trong 20 tác giả mới nhất`).toBeDefined();
  return {
    the: page.locator(`[data-testid="the-mach"][data-mach-id="${mach!.id}"]`),
    mach: mach!,
  };
}

const mau = (loc: Locator) => loc.evaluate((e) => getComputedStyle(e).color);

/* ================================================================================ W0 · seed */

test.describe("W0 — seed_e2e dựng dữ liệu cho dải lệnh / nhãn BOT (plan §6.5)", () => {
  /** Mọi nhật ký công khai, đi hết cursor (seed_e2e cố ý đặt hai bài mang lệnh LÙI SÂU về quá
   * khứ để không đẩy mạch nghiệm thu khỏi trang 1 của feed — nên chúng không nằm ở 50 bài đầu). */
  async function tatCaNhatKy(trang_thai?: "open" | "closed"): Promise<MachTomTatOut[]> {
    const ra: MachTomTatOut[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 30; i += 1) {
      const q: string = `loai_mach=nhat_ky&limit=50${trang_thai ? `&trang_thai=${trang_thai}` : ""}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const f: FeedOut = await api<FeedOut>(`/api/v1/feeds/moi?${q}`);
      ra.push(...f.items);
      cursor = f.cursor_ke_tiep;
      if (cursor === null) break;
    }
    return ra;
  }

  test("API có ≥ 1 nhật ký mang lệnh, ≥ 1 tác giả la_bot, ≥ 1 nhật ký đã đóng sổ có lệnh", async () => {
    const tat_ca = await tatCaNhatKy();
    expect(tat_ca.filter((m) => m.lenh != null).length, "seed phải có nhật ký mang lệnh").toBeGreaterThanOrEqual(2);
    expect(tat_ca.some((m) => m.author.la_bot)).toBe(true);
    const dong = await tatCaNhatKy("closed");
    expect(dong.some((m) => m.lenh != null)).toBe(true);
    // Mạch không khai lệnh thì `lenh` là null (không phải {}), kể cả bài viết.
    expect(tat_ca.some((m) => m.lenh == null)).toBe(true);
    const bai = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=20");
    expect(bai.items.every((m) => m.lenh == null)).toBe(true);
  });
});

/* =============================================================================== W1 · thứ tự */

test.describe("W1/G1 — thứ tự: dòng giới thiệu → Chủ đề tuần → Nhật ký mới; bài viết ở rail", () => {
  test("y tăng dần theo đúng thứ tự; bài viết là khối của RAIL (việc 24), không còn section riêng", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const y = (id: string) =>
      page.getByTestId(id).evaluate((e) => {
        const r = e.getBoundingClientRect();
        return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, x: r.left, w: r.width };
      });
    const h1 = await page.locator("h1").first().evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
    const chu_de = await y("khoi-thao-luan");
    const nhat_ky = await y("khoi-nhat-ky");
    const main = await page.locator("main").first().evaluate((e) => e.getBoundingClientRect().right);
    expect(h1, "dòng giới thiệu trên cùng").toBeLessThan(chu_de.top);
    expect(chu_de.bottom, "chủ đề trước nhật ký").toBeLessThanOrEqual(nhat_ky.top + 1);
    // Việc 24: section "Bài viết" (từng đứng dưới rail, trải hết chiều ngang) đã gỡ; bài viết mới
    // nằm trong rail phải — cột BÊN PHẢI nội dung chính ở desktop.
    await expect(page.getByTestId("khoi-bai-viet")).toHaveCount(0);
    const bai_viet = page.getByTestId("rail-phai").getByTestId("sidebar-bai-moi");
    await expect(bai_viet).toHaveCount(1);
    const hop = await bai_viet.boundingBox();
    expect(hop!.x, "khối bài viết ở cột phải").toBeGreaterThanOrEqual(main - 1);
    // Không còn danh sách "chủ đề trước" trên `/`.
    await expect(page.getByTestId("khoi-thao-luan").getByTestId("chu-de-hang")).toHaveCount(0);
    await expect(page.getByTestId("khoi-thao-luan").getByRole("link", { name: /chủ đề trước/i })).toHaveCount(0);
  });

  test("h1 + lede giữ từng byte nhưng thành dòng giới thiệu GỌN (nhỏ hơn câu hỏi chủ đề nhiều)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Nhật ký giao dịch chứng khoán & Luận điểm thị trường");
    const co = async (l: Locator) => parseFloat(await l.evaluate((e) => getComputedStyle(e).fontSize));
    const h2 = page.getByTestId("khoi-thao-luan").getByRole("heading", { level: 2 });
    expect(await co(h1)).toBeLessThanOrEqual(24);
    expect(await co(h2), "câu hỏi chủ đề ~22px desktop").toBeGreaterThanOrEqual(21);
    // Lede là <p> đầu tiên sau <h1>.
    const lede = await h1.evaluate((e) => {
      let n = e.nextElementSibling;
      while (n && n.tagName !== "P") n = n.nextElementSibling;
      return n?.textContent?.trim() ?? null;
    });
    expect(lede).toBe(
      "Ghi nhận nhận định trước khi có kết quả. Mọi mốc đều lưu vết thời gian thực và lịch sử minh bạch.",
    );
  });
});

/* ============================================================================ W2 · chủ đề tuần */

/** Tuần của chủ đề tạm xuất bản BÂY GIỜ: kỳ vọng tính ĐỘC LẬP (Intl, không cộng 7 giờ). */
function conLaiToiChuNhat(bay_gio: Date): number {
  const thu = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
  }).format(bay_gio);
  return 6 - ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(thu);
}

test.describe.serial("W2/G2 — chủ đề tuần: chip 'còn N ngày' theo giờ VN, quan điểm nổi bật ẩn khi chưa có bình luận", () => {
  const TD = "W Chủ đề tuần e2e — mới xuất bản";
  const dat = (ma: string) => py(ma);

  test.beforeAll(() => {
    dat(
      [
        "from core.ghi import tao_mach",
        "from core.models import Mach, User",
        "doi = User.objects.get(username='e2e_tai_khoan_doi')",
        "sub = Mach.objects.filter(loai_mach='thao_luan').first().sub",
        `tao_mach(sub=sub, author=doi, title=${JSON.stringify(TD)}, body='Bối cảnh ngắn của chủ đề tuần này.',`,
        "    occurred_at=None, loai=None, loai_mach=Mach.LoaiMach.THAO_LUAN)",
        "",
      ].join("\n"),
    );
  });
  test.afterAll(() => {
    dat(
      `from core.models import Mach; Mach.objects.filter(title=${JSON.stringify(TD)}).delete()`,
    );
  });

  test("chủ đề vừa xuất bản: nhãn 'Chủ đề tuần này', chip đếm đúng số ngày tới hết Chủ nhật, bối cảnh, KHÔNG quan điểm", async ({
    page,
  }) => {
    await page.goto("/");
    const khoi = page.getByTestId("khoi-thao-luan");
    await expect(khoi.getByRole("heading", { level: 2 })).toHaveText(TD);
    await expect(khoi.getByTestId("chu-de-nhan")).toHaveText("Chủ đề tuần này");
    const n = conLaiToiChuNhat(new Date());
    await expect(khoi.getByTestId("chu-de-trang-thai")).toHaveText(
      n > 0 ? `Đang mở · còn ${n} ngày` : "Đang mở · đóng hôm nay",
    );
    await expect(khoi.getByTestId("chu-de-boi-canh")).toContainText("Bối cảnh ngắn");
    // Không có ô quan điểm (việc 19 bỏ hẳn ô này; trước đó: chưa có bình luận thì ẩn). Phần đếm
    // cột lưới của `chu-de-the` đã gỡ ở việc 18: khối nay LUÔN xếp chồng một cột, nên phép đếm ấy xanh bất kể
    // đúng sai (đo rỗng). Bố cục xếp chồng đo ở `khoi-chu-de-nut-brand.spec.ts` (c).
    await expect(khoi.getByTestId("quan-diem-noi-bat")).toHaveCount(0);
  });

  test("ranh giới: mốc 'bây giờ' nằm ở DÒNG chip, không ở HTML bị cache — tải lại vẫn đúng", async ({
    page,
  }) => {
    await page.goto("/");
    const lan1 = await page.getByTestId("chu-de-trang-thai").textContent();
    await page.reload();
    expect(await page.getByTestId("chu-de-trang-thai").textContent()).toBe(lan1);
  });
});

/* ===================================================================== W3 · thẻ nhật ký mới */

test.describe("W3/G3 — thẻ nhật ký mới", () => {
  test("lệnh MUA đủ năm số của tài khoản la_bot: nhãn BOT · DEMO, dải Entry/SL/TP/Nhồi/R:R, chip Đang mở, màu theo token", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const { the, mach } = await theNhatKy(page, NK_BOT.tieu_de);
    await expect(the).toHaveCount(1);
    await expect(the.getByTestId("the-nhat-ky-bot")).toHaveText("BOT · DEMO");
    await expect(the.getByTestId("the-nhat-ky-trang-thai")).toHaveText("Đang mở");
    const lenh = the.getByTestId("the-nhat-ky-lenh");
    await expect(lenh).toBeVisible();
    await expect(the.getByTestId("the-nhat-ky-chieu")).toHaveText("MUA");
    await expect(lenh).toContainText(NK_BOT.lenh.ma); // server IN HOA "wbot" → "WBOT"
    // Số in NGUYÊN VĂN từ server (đã bỏ số 0 thừa: "12.20" → "12.2").
    const ct = (k: string) => the.getByTestId(`the-nhat-ky-${k}`).locator("b");
    await expect(ct("entry")).toHaveText("12.2");
    await expect(ct("sl")).toHaveText("11.71");
    await expect(ct("tp")).toHaveText("13.37");
    await expect(ct("nhoi")).toHaveText("12.69");
    await expect(ct("rr")).toHaveText(NK_BOT.lenh.rr);
    // API và HTML nói cùng một thứ.
    expect(mach.lenh).toMatchObject({ chieu: "mua", ma: "WBOT", gia_vao: "12.2", rr: "2.4" });
    // Màu: TP cùng màu chip MUA (--gain), SL khác TP (--loss), Entry không tô màu cảnh báo.
    const chip = await mau(the.getByTestId("the-nhat-ky-chieu"));
    expect(await mau(ct("tp"))).toBe(chip);
    expect(await mau(ct("sl"))).not.toBe(chip);
    expect(await mau(ct("entry"))).not.toBe(chip);
  });

  test("lệnh BÁN chỉ có SL, đã đóng sổ: chip 'Đã đóng sổ', KHÔNG TP / Nhồi / R:R, chiều BÁN cùng màu SL", async ({
    page,
  }) => {
    await page.goto("/");
    const { the } = await theNhatKy(page, NK_DONG.tieu_de);
    await expect(the.getByTestId("the-nhat-ky-trang-thai")).toHaveText("Đã đóng sổ");
    await expect(the.getByTestId("the-nhat-ky-chieu")).toHaveText("BÁN");
    await expect(the.getByTestId("the-nhat-ky-entry").locator("b")).toHaveText(NK_DONG.lenh.gia_vao);
    await expect(the.getByTestId("the-nhat-ky-sl").locator("b")).toHaveText(NK_DONG.lenh.sl);
    for (const k of ["tp", "nhoi", "rr"]) await expect(the.getByTestId(`the-nhat-ky-${k}`)).toHaveCount(0);
    expect(await mau(the.getByTestId("the-nhat-ky-chieu"))).toBe(
      await mau(the.getByTestId("the-nhat-ky-sl").locator("b")),
    );
    // Không phải bot: không nhãn.
    await expect(the.getByTestId("the-nhat-ky-bot")).toHaveCount(0);
  });

  test("nhật ký KHÔNG khai lệnh: không dải lệnh, không ảnh; trích kẹp ĐÚNG 3 dòng", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const { the, mach } = await theNhatKy(page, NK_THUONG.tieu_de);
    expect(mach.lenh ?? null).toBeNull();
    await expect(the.getByTestId("the-nhat-ky-lenh")).toHaveCount(0);
    await expect(the.getByTestId("the-nhat-ky-anh")).toHaveCount(0);
    const trich = the.getByTestId("the-nhat-ky-trich");
    const { cao, dong } = await trich.evaluate((e) => {
      const cs = getComputedStyle(e);
      const lh = parseFloat(cs.lineHeight);
      return { cao: e.getBoundingClientRect().height, dong: lh };
    });
    expect(cao, "kẹp 3 dòng, không hơn").toBeLessThanOrEqual(dong * 3 + 1);
    expect(cao, "và đủ 3 dòng (bài dài)").toBeGreaterThanOrEqual(dong * 3 - 1);
  });

  test("ảnh nhỏ bên phải: 168×104 desktop, 76×76 mobile, giữ chỗ cố định (CLS 0), lazy + width/height", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    let { the } = await theNhatKy(page, NK_BOT.tieu_de);
    let o = the.getByTestId("the-nhat-ky-anh");
    await expect(o).toBeVisible();
    const hop = async (l: Locator) => {
      const b = await l.boundingBox();
      return b === null ? null : { w: Math.round(b.width), h: Math.round(b.height) };
    };
    expect(await hop(o)).toEqual({ w: 168, h: 104 });
    const img = o.locator("img");
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(img).toHaveAttribute("decoding", "async");
    await expect(img).toHaveAttribute("width", /^\d+$/);
    await expect(img).toHaveAttribute("height", /^\d+$/);
    // Ảnh nằm bên PHẢI chữ.
    const trich = await the.getByTestId("the-nhat-ky-trich").boundingBox();
    const khung = await o.boundingBox();
    expect(khung!.x).toBeGreaterThan(trich!.x + trich!.width - 1);
    // Khung KHÔNG đổi sau khi ảnh nạp xong.
    await img.evaluate((e) => (e as HTMLImageElement).decode());
    expect(await hop(o)).toEqual({ w: 168, h: 104 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    ({ the } = await theNhatKy(page, NK_BOT.tieu_de));
    o = the.getByTestId("the-nhat-ky-anh");
    expect(await hop(o)).toEqual({ w: 76, h: 76 });
  });

  test("chân thẻ có đủ: vote · 'N mốc' · bình luận · chia sẻ; một thẻ một tác giả", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const { the } = await theNhatKy(page, NK_BOT.tieu_de);
    await expect(the.getByTestId("cot-vote-diem")).toBeVisible();
    await expect(the.getByTestId("the-nhat-ky-so-moc")).toHaveText("1 mốc");
    await expect(the.getByTestId("the-nhat-ky-so-binh-luan")).toHaveText("Bình luận");
    await expect(the.getByRole("button", { name: /chia sẻ/i })).toBeVisible();
    // Link tiêu đề, mốc, bình luận cùng trỏ về mạch này.
    const { mach } = await theNhatKy(page, NK_BOT.tieu_de);
    const href = `/m/${mach.slug}-${mach.id}`;
    await expect(the.getByRole("heading", { level: 3 }).getByRole("link")).toHaveAttribute("href", href);
    expect(await the.getByTestId("the-nhat-ky-so-binh-luan").getAttribute("href")).toBe(`${href}#khan-dai`);
    const tac_gia = await page
      .getByTestId("khoi-nhat-ky")
      .getByTestId("the-mach")
      .evaluateAll((ls) => ls.map((l) => l.querySelector("a[title^='u/']")?.getAttribute("title")));
    expect(new Set(tac_gia).size, "mỗi tác giả một thẻ").toBe(tac_gia.length);
  });
});

/* ===================================================== W4 · ô soạn nhanh · tab · chân khối */

test.describe("W4 — ô soạn nhanh, tab lọc, dải chân khối", () => {
  test("desktop: ô soạn nhanh là LINK /dang-mach; nút dính đáy KHÔNG hiện", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("nhat-ky-o-soan")).toBeVisible();
    await expect(page.getByTestId("nhat-ky-o-soan")).toHaveAttribute("href", "/dang-mach");
    await expect(page.getByTestId("nhat-ky-o-soan")).toContainText("Bạn vừa quyết định gì?");
    await expect(page.getByTestId("nut-ghi-nhat-ky-di-dong")).toBeHidden();
  });

  test("mobile: không ô soạn; nút 'Ghi nhật ký' dính đáy khung nhìn, cao ≥ 44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("nhat-ky-soan-nhanh")).toBeHidden();
    const nut = page.getByTestId("nut-ghi-nhat-ky-di-dong");
    await expect(nut).toHaveAttribute("href", "/dang-mach");
    await nut.scrollIntoViewIfNeeded();
    // Cuộn tới giữa khối nhật ký: nút phải bám đáy khung nhìn (sticky), không trôi theo trang.
    await page.getByTestId("khoi-nhat-ky").evaluate((e) => {
      const r = e.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + r.top + 300);
    });
    const hop = await nut.boundingBox();
    expect(hop!.height).toBeGreaterThanOrEqual(44);
    const khung = await page.evaluate(() => window.innerHeight);
    expect(hop!.y + hop!.height, "dính đáy").toBeGreaterThan(khung - 80);
    expect(hop!.y + hop!.height).toBeLessThanOrEqual(khung + 1);
  });

  test("ba tab là link thật tới feed cũ có lọc `trang_thai`; tab 'Mới nhất' đang chọn", async ({ page }) => {
    await page.goto("/");
    const t = (k: string) => page.getByTestId(`nhat-ky-tab-${k}`);
    await expect(t("moi")).toHaveAttribute("href", "/?tab=moi&loai_mach=nhat_ky");
    await expect(t("moi")).toHaveAttribute("aria-current", "true");
    await expect(t("open")).toHaveAttribute("href", "/?tab=moi&loai_mach=nhat_ky&trang_thai=open");
    await expect(t("closed")).toHaveAttribute("href", "/?tab=moi&loai_mach=nhat_ky&trang_thai=closed");
    await expect(t("open")).not.toHaveAttribute("aria-current", "true");
  });

  for (const tt of ["open", "closed"] as const) {
    test(`tab '${tt}': feed chỉ gồm nhật ký ${tt === "open" ? "đang mở" : "đã đóng sổ"}, chip 'Bỏ lọc', cuộn vô hạn giữ bộ lọc`, async ({
      page,
    }) => {
      await page.goto(`/?tab=moi&loai_mach=nhat_ky&trang_thai=${tt}`);
      const mong = await api<FeedOut>(`/api/v1/feeds/moi?loai_mach=nhat_ky&trang_thai=${tt}&limit=20`);
      expect(mong.items.length, "dữ liệu phải có để bài đo không rỗng").toBeGreaterThan(0);
      const ids = await page
        .getByTestId("the-mach")
        .evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.machId)));
      expect(ids).toEqual(mong.items.map((m) => m.id));
      // Đợt C (việc 14): lọc loại Nhật ký thì hàng Trạng thái thay chip "Trạng thái: … ✕ Bỏ lọc"
      // (hiện cả hai là báo một bộ lọc hai lần): mục đang chọn mang `aria-current`, "Tất cả" trỏ về
      // URL không lọc trạng thái. Chip chỉ còn cho URL mà hàng không hiện — bài đo riêng ở
      // `e2e/dai-dieu-khien-feed.spec.ts`.
      await expect(page.getByTestId("bo-loc-trang-thai")).toHaveCount(0);
      await expect(page.getByTestId(`loc-trang-thai-${tt}`)).toHaveAttribute("aria-current", "true");
      await expect(page.getByTestId("loc-trang-thai-tat-ca")).toHaveAttribute(
        "href",
        "/?tab=moi&loai_mach=nhat_ky",
      );
      // Bộ lọc đi xuyên qua link tab và link 'xem thêm' (cursor) của trang.
      expect(await page.getByTestId("tab-nhieu-diem").getAttribute("href")).toContain(`trang_thai=${tt}`);
      if (mong.cursor_ke_tiep !== null) {
        expect(await page.getByTestId("feed-xem-them").getAttribute("href")).toContain(`trang_thai=${tt}`);
      }
      // Tab 'Đang diễn ra' không nhận bộ lọc ⇒ href của nó KHÔNG mang theo.
      expect(await page.getByTestId("tab-dang-dien-ra").getAttribute("href")).not.toContain("trang_thai");
    });
  }

  test("`?trang_thai=` lạ không làm 500 và không thành bộ lọc tàng hình", async ({ page, request }) => {
    const r = await request.get("/?tab=moi&trang_thai=abc");
    expect(r.status()).toBe(200);
    await page.goto("/?tab=moi&trang_thai=abc");
    await expect(page.getByTestId("bo-loc-trang-thai")).toHaveCount(0);
    await expect(page.getByTestId("loc-trang-thai")).toHaveCount(0);
    const khong_loc = await api<FeedOut>("/api/v1/feeds/moi?limit=20");
    expect(
      await page
        .getByTestId("the-mach")
        .evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.machId))),
    ).toEqual(khong_loc.items.map((m) => m.id));
  });

  test("dải chân khối: MỘT <a>, tính N từ chính danh sách đã tải, không bịa số", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const tat_ca = await api<FeedOut>("/api/v1/feeds/nhat-ky-moi-tac-gia?limit=20");
    const con_lai = tat_ca.items.slice(8);
    const dai = page.getByTestId("nhat-ky-chan-khoi");
    // Có đủ tác giả sau 8 thẻ đầu (3 tạm + seed): bài đo không rỗng.
    expect(con_lai.length, "phải còn tác giả đứng sau 8 thẻ đầu").toBeGreaterThan(0);
    await expect(dai).toBeVisible();
    expect(await dai.evaluate((e) => e.tagName)).toBe("A");
    await expect(dai).toHaveAttribute("href", "/?tab=moi&loai_mach=nhat_ky");
    if (tat_ca.items.length >= 20) {
      await expect(dai).toContainText("Xem tất cả nhật ký");
      await expect(dai).not.toContainText(/\+\d+/);
    } else {
      // Đếm theo NGƯỜI nên chỉ nói số người, không nói số nhật ký.
      await expect(dai).toContainText(`+${con_lai.length} người khác vừa ghi nhật ký`);
      await expect(dai).not.toContainText(/\d+\s+nhật ký/);
    }
    // Nút 'Xem thêm nhật ký' kiểu viền xám đã bỏ.
    await expect(page.getByRole("button", { name: /xem thêm nhật ký/i })).toHaveCount(0);
  });
});

/* ====================================================================== W5 · thư viện bài viết */

test.describe("W5/G4 — bài viết ở rail (việc 24): 10 bài, tên chuyên mục, <time>, 'Tất cả bài viết'; dải bản tin", () => {
  test("rail: 'Bài viết mới' = 10 bài đầu của API (trừ tin-tuc), tiêu đề đầy đủ (không title), tên chuyên mục · <time datetime>", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("khoi-bai-viet")).toHaveCount(0);
    const khoi = page.getByTestId("sidebar-bai-moi");
    await expect(khoi.getByRole("heading", { level: 2 })).toHaveText("Bài viết mới");

    const subs = await api<{ slug: string; ten: string }[]>("/api/v1/subs");
    const moi = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=50");
    // Lọc phòng thủ tin-tuc (việc 20 vòng sửa 1) giữ nguyên ở rail.
    const mong = moi.items.filter((m) => m.sub.slug !== "tin-tuc").slice(0, 10);
    expect(mong.length, "dữ liệu tạm + seed có ≥ 10 bài viết").toBe(10);
    const muc = khoi.locator("li");
    await expect(muc).toHaveCount(10);
    for (let i = 0; i < 10; i += 1) {
      const a = muc.nth(i).locator("a");
      await expect(a).toHaveAttribute("href", `/m/${mong[i].slug}-${mong[i].id}`);
      // Tiêu đề đầy đủ là TEXT của `<a>`; `title` đã bỏ (việc 24 bổ sung, user 2026-11-13: tooltip
      // native tràn khỏi rail) — tiêu đề dài đi qua tooltip CSS `data-tieu-de`, đo ở
      // `rail-bai-viet.spec.ts` (B1/B2).
      await expect(a).toHaveText(mong[i].title);
      await expect(a).not.toHaveAttribute("title");
      // Tên chuyên mục (không `s/<slug>` khi sub có trong GET /subs).
      await expect(muc.nth(i)).toContainText(subs.find((s) => s.slug === mong[i].sub.slug)!.ten);
      const t = muc.nth(i).locator("time");
      expect(await t.getAttribute("datetime"), `bài ${i}: <time datetime>`).toBe(mong[i].published_at);
      await expect(t).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);
      // Không ảnh trong rail.
      await expect(muc.nth(i).locator("img")).toHaveCount(0);
    }
    await expect(khoi.getByTestId("sidebar-bai-moi-tat-ca")).toHaveAttribute(
      "href",
      "/?tab=moi&loai_mach=bai_viet",
    );
  });

  test("dải bản tin: 2 bản tin mới nhất (ngày · tiêu đề gọn, title đầy đủ) + 'Tất cả bản tin →'", async ({
    page,
  }) => {
    await page.goto("/");
    // Dải vẽ 2 bản tin (`SO_BAN_TIN_DAI`, việc 19 vòng 2) từ bảng RIÊNG (`liet_ke_ban_tin`, việc 20).
    const tin = (await api<TrangBanTinOut>("/api/v1/ban-tin?limit=2")).items;
    expect(tin.length).toBe(2);
    // Việc 19: dải dời lên ngay dưới header, nhãn là `<span>` (đứng trước `<h1>` nên không là
    // heading) và vùng của nó mang tên qua `aria-label`. Vị trí đo ở `dai-ban-tin.spec.ts`.
    const ban_tin = page.getByRole("region", { name: "Bản tin thị trường" });
    await expect(ban_tin).toHaveAttribute("data-testid", "ban-tin");
    await expect(ban_tin.getByRole("heading")).toHaveCount(0);
    // Bản tin không lọt vào khối bài viết ở rail (việc 24).
    await expect(page.getByTestId("sidebar-bai-moi").getByTestId("ban-tin")).toHaveCount(0);
    const muc = ban_tin.getByTestId("ban-tin-muc");
    expect(await muc.evaluateAll((l) => l.map((a) => a.getAttribute("href")))).toEqual(
      tin.map((b) => `/s/tin-tuc/${b.ngay}`),
    );
    for (let i = 0; i < 2; i += 1) {
      await expect(muc.nth(i)).toContainText(tieuDeBanTinGon(tin[i].title));
      await expect(muc.nth(i)).toHaveAttribute("title", tin[i].title);
      expect(await muc.nth(i).locator("time").getAttribute("datetime")).toBe(tin[i].ngay);
    }
    await expect(page.getByTestId("ban-tin-tat-ca")).toHaveAttribute("href", "/s/tin-tuc");
    // Hàng chip chuyên mục của khối "Bài viết" gỡ cùng khối (việc 24); lối tới mọi `/s/*` nay là
    // khối "Chuyên mục" của rail (đo ở W6 và `vo-reddit.spec.ts`).
  });
});

/* ============================================================================== W6 · SEO · bot */

test.describe("W6/G5 — SEO: số link /m/, HTML như nhau cho trình duyệt và Googlebot", () => {
  const UA_TRINH_DUYET =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const UA_GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const linkM = (html: string) =>
    new Set([...html.matchAll(/<a [^>]*href="(\/m\/[^"]+)"/g)].map((m) => m[1]));

  test("≥ 17 link /m/ duy nhất trong HTML thô; bản tin + chủ đề + nhật ký + bài viết (rail) đều có", async ({
    request,
  }) => {
    const html = await (await request.get("/", { headers: { "user-agent": UA_TRINH_DUYET } })).text();
    const links = linkM(html);
    // Việc 20: hai link bản tin của dải rời `/m/` sang `/s/tin-tuc/<ngày>` — ngưỡng /m/ hạ đúng 2
    // (19 → 17), và hai link bản tin được đếm riêng.
    expect(links.size, `số link /m/ duy nhất: ${links.size}`).toBeGreaterThanOrEqual(17);
    const ban_tin = new Set([...html.matchAll(/<a [^>]*href="(\/s\/tin-tuc\/\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]));
    expect(ban_tin.size, "hai link bản tin của dải").toBe(2);
    // Link chuyên mục /s/* và /luat còn đủ.
    const subs = await api<{ slug: string }[]>("/api/v1/subs");
    const hrefs = new Set([...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]));
    for (const s of subs) expect(hrefs.has(`/s/${s.slug}`), `thiếu /s/${s.slug}`).toBe(true);
    expect(hrefs.has("/luat")).toBe(true);
    // Việc 24: khối "Bài viết" (9 `<article>` — 3 Mới đăng + ≥ 6 giá sách) đã gỡ; bài viết nay là
    // khối rail "Bài viết mới": 10 `<li>`, mỗi mục một `<a href="/m/…">` và một `<time datetime>`
    // TRONG HTML thô. Ngưỡng đếm theo khối ấy (không còn `<article>` nào để đếm trên `/`).
    const rail = /<section[^>]*data-testid="sidebar-bai-moi"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect(rail, "khối bài viết ở rail phải có trong HTML thô").not.toBe("");
    expect(linkM(rail).size, "10 link bài viết ở rail").toBe(10);
    // React in `dateTime=` (camelCase) ra HTML thô; thuộc tính HTML không phân biệt hoa thường.
    expect((rail.match(/<time\b[^>]*\bdatetime="/gi) ?? []).length).toBe(10);
    expect((html.match(/<time\b[^>]*\bdatetime="/gi) ?? []).length).toBeGreaterThanOrEqual(10 + 3);
  });

  test("UA trình duyệt và Googlebot nhận CÙNG tập link /m/ và cùng số <time>", async ({ request }) => {
    const a = await (await request.get("/", { headers: { "user-agent": UA_TRINH_DUYET } })).text();
    const b = await (await request.get("/", { headers: { "user-agent": UA_GOOGLEBOT } })).text();
    expect([...linkM(a)].sort()).toEqual([...linkM(b)].sort());
    // `<article>` (khối bài viết cũ) không còn trên `/` từ việc 24 — so `<time>` thay cho nó.
    const dem = (s: string) => (s.match(/<time\b[^>]*\bdatetime="/gi) ?? []).length;
    expect(dem(a)).toBeGreaterThan(0);
    expect(dem(a)).toBe(dem(b));
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(a)![1]).toBe(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(b)![1]);
  });
});

/* ============================================================================== W7 · mobile */

test.describe("W7/G7 — mobile 390px", () => {
  test("không tràn ngang; khối chủ đề là màn hình ĐẦU; vùng bấm ≥ 44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const rong = await page.evaluate(() => ({
      cuon: document.documentElement.scrollWidth,
      khung: window.innerWidth,
    }));
    expect(rong.cuon, JSON.stringify(rong)).toBeLessThanOrEqual(rong.khung);

    // Màn hình đầu: câu hỏi chủ đề nằm trong 844px đầu và nút 'Vào thảo luận' cũng vậy.
    const khoi = page.getByTestId("khoi-thao-luan");
    const q = await khoi.getByRole("heading", { level: 2 }).boundingBox();
    expect(q!.y + q!.height, "câu hỏi nằm trong màn hình đầu").toBeLessThan(844);
    const vao = await khoi.getByTestId("chu-de-vao").boundingBox();
    expect(vao!.y + vao!.height, "nút chính nằm trong màn hình đầu").toBeLessThan(844 + 200);

    // Vùng bấm ≥ 44px (cao) cho các điều khiển chính của trang.
    const can_44: Array<[string, Locator]> = [
      ["Vào thảo luận", khoi.getByTestId("chu-de-vao")],
      ["Viết quan điểm", khoi.getByTestId("chu-de-viet")],
      ["tab Đang mở", page.getByTestId("nhat-ky-tab-open")],
      ["tab Đã đóng sổ", page.getByTestId("nhat-ky-tab-closed")],
      ["nút Ghi nhật ký", page.getByTestId("nut-ghi-nhat-ky-di-dong")],
      ["chân khối", page.getByTestId("nhat-ky-chan-khoi")],
      ["Tất cả nhật ký", page.getByTestId("nhat-ky-tat-ca")],
      // "Xem thêm bài viết" + chip chuyên mục gỡ cùng khối "Bài viết" (việc 24).
      ["bản tin", page.getByTestId("ban-tin-muc").first()],
      ["Tất cả bản tin", page.getByTestId("ban-tin-tat-ca")],
    ];
    const thap: string[] = [];
    for (const [ten, loc] of can_44) {
      const b = await loc.first().boundingBox();
      if (b === null) {
        thap.push(`${ten}: không có hộp`);
        continue;
      }
      if (b.height < 43.5) thap.push(`${ten}: cao ${Math.round(b.height)}px`);
    }
    // Chân thẻ nhật ký: vote, mốc, bình luận, chia sẻ.
    const the = page.getByTestId("khoi-nhat-ky").getByTestId("the-mach").first();
    for (const loc of [
      the.getByTestId("the-nhat-ky-so-moc"),
      the.getByTestId("the-nhat-ky-so-binh-luan"),
      the.getByRole("button", { name: /chia sẻ/i }),
      the.getByRole("button", { name: /ủng hộ|upvote|vote|tăng/i }).first(),
    ]) {
      const b = await loc.first().boundingBox();
      if (b === null) continue;
      if (b.height < 43.5 || b.width < 43.5) thap.push(`chân thẻ: ${Math.round(b.width)}×${Math.round(b.height)}`);
    }
    expect(thap, `vùng bấm < 44px: ${thap.join(" · ")}`).toEqual([]);
  });

  test("khối bài viết mobile (việc 24): nằm trong rail DƯỚI nội dung chính, đủ 10 bài một dòng, không tràn ngang", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const khoi = page.getByTestId("rail-phai").getByTestId("sidebar-bai-moi");
    await expect(khoi).toBeVisible();
    const tren = await page.locator("main").first().evaluate((e) => e.getBoundingClientRect().bottom);
    const hop = await khoi.boundingBox();
    expect(hop!.y, "khối bài viết dưới nội dung chính").toBeGreaterThanOrEqual(tren - 1);
    expect(hop!.x + hop!.width, "khối bài viết trong khung 390px").toBeLessThanOrEqual(390);
    // Đủ 10 bài, mỗi tiêu đề MỘT dòng (cắt bằng ellipsis), không đẩy trang cuộn ngang.
    const tieu_de = khoi.locator("li > a");
    await expect(tieu_de).toHaveCount(10);
    const cao = await tieu_de.evaluateAll((ls) =>
      ls.map((e) => Math.round(e.getBoundingClientRect().height) <= Math.ceil(parseFloat(getComputedStyle(e).lineHeight)) + 1),
    );
    expect(cao.every(Boolean), `tiêu đề một dòng: ${JSON.stringify(cao)}`).toBe(true);
    const rong = await page.evaluate(() => ({
      cuon: document.documentElement.scrollWidth,
      khung: window.innerWidth,
    }));
    expect(rong.cuon, JSON.stringify(rong)).toBeLessThanOrEqual(rong.khung);
  });
});

/* ============================================================ W8 · lối vào ghi nhật ký → ngăn kéo */

/** Cả bốn lối vào ghi nhật ký của trang chủ là `<a href="/dang-mach">` (`LoiVaoNhatKy`): khách và
 * bot đi tới `/dang-mach`, người đã đăng nhập bấm trái thường thì mở NGĂN KÉO đăng nhanh — cái
 * mà nút "+" ở header vẫn mở. Tài khoản tạm mang tiền tố `e2e_w_` nên `donNhatKyW` (đầu và cuối
 * file) dọn luôn cả mạch nó đăng. */
test.describe("W8 — lối vào ghi nhật ký mở ngăn kéo đăng nhanh (người đăng nhập) / đi /dang-mach (khách)", () => {
  const TIEN_TO_TAI_KHOAN_NGAN_KEO = `${TIEN_TO_NHAT_KY_W}ngk`;
  const LOI_VAO = ["nhat-ky-o-soan", "nut-mo-nhat-ky", "nut-ghi-nhat-ky-di-dong"] as const;

  test("(c) HTML thô của `/` vẫn có href=\"/dang-mach\" ở mọi lối vào (SEO không đổi)", async ({
    request,
  }) => {
    const html = await (await request.get("/")).text();
    const the_a = html.match(/<a\b[^>]*>/g) ?? [];
    for (const id of LOI_VAO) {
      const the = the_a.find((t) => t.includes(`data-testid="${id}"`));
      expect(the, `lối vào ${id} phải là <a> trong HTML thô`).toBeDefined();
      expect(the, id).toContain('href="/dang-mach"');
    }
  });

  test("(a) khách bấm 'Mở nhật ký' thì tới /dang-mach, ngăn kéo không mở", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByTestId("nut-mo-nhat-ky").click();
    await expect(page).toHaveURL(/\/dang-mach$/);
    await expect(page.getByTestId("form-dang-nhanh")).toBeHidden();
    // Trang /dang-mach có lời mời đăng nhập cho khách.
    await expect(page.getByTestId("dang-mach-khach")).toBeVisible();
  });

  test("(b) người đã đăng nhập bấm ô soạn nhanh / 'Mở nhật ký' → ngăn kéo mở, URL vẫn là `/`", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await dungTaiKhoan(page, TIEN_TO_TAI_KHOAN_NGAN_KEO);
    await page.goto("/");
    // Nút "+" ở header chỉ hiện khi phiên đã tải và là người đăng nhập ⇒ cũng là tín hiệu đã hydrate.
    await expect(page.getByTestId("nut-dang-mach")).toBeVisible();
    const duong_dan = () => new URL(page.url()).pathname;

    for (const id of ["nhat-ky-o-soan", "nut-mo-nhat-ky"] as const) {
      await page.getByTestId(id).click();
      await expect(page.getByTestId("form-dang-nhanh"), id).toBeVisible();
      expect(duong_dan(), `${id}: không rời trang`).toBe("/");
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("form-dang-nhanh")).toBeHidden();
    }

    // Phím bổ trợ: ctrl+click là "mở tab mới tới đúng URL", đừng cướp.
    const [tab_moi] = await Promise.all([
      context.waitForEvent("page"),
      page.getByTestId("nut-mo-nhat-ky").click({ modifiers: ["Control"] }),
    ]);
    // Tab mới khởi đầu ở about:blank: chờ nó thật sự tới đích rồi mới đọc URL.
    await tab_moi.waitForURL(/\/dang-mach$/);
    expect(new URL(tab_moi.url()).pathname).toBe("/dang-mach");
    await tab_moi.close();
    await expect(page.getByTestId("form-dang-nhanh")).toBeHidden();
    expect(duong_dan()).toBe("/");
  });

  test("(b') mobile: nút 'Ghi nhật ký' dính đáy cũng mở ngăn kéo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await dungTaiKhoan(page, TIEN_TO_TAI_KHOAN_NGAN_KEO);
    await page.goto("/");
    await expect(page.getByTestId("nut-ghi-nhat-ky-di-dong")).toBeVisible();
    // Nút "+" ở header bị ẩn bằng CSS ở 390px nhưng vẫn được vẽ KHI VÀ CHỈ KHI phiên đã tải và là
    // người đăng nhập ⇒ `toBeAttached` là tín hiệu "đã hydrate + biết mình là ai" cho cả mobile.
    await expect(page.getByTestId("nut-dang-mach")).toBeAttached();
    await page.getByTestId("nut-ghi-nhat-ky-di-dong").click();
    await expect(page.getByTestId("form-dang-nhanh")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("(d) đăng từ ngăn kéo kèm lệnh → mạch có `lenh` (qua API); lệnh sai bị chặn bằng tiếng Việt; nối mốc không có khối lệnh", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await dungTaiKhoan(page, TIEN_TO_TAI_KHOAN_NGAN_KEO);
    await page.goto("/");
    await expect(page.getByTestId("nut-dang-mach")).toBeVisible();
    await page.getByTestId("nhat-ky-o-soan").click();
    const form = page.getByTestId("form-dang-nhanh");
    await expect(form).toBeVisible();

    const tieu_de = `W8 Ngăn kéo kèm lệnh ${Date.now()}`;
    await page.getByRole("button", { name: "s/chung-khoan", exact: true }).click();
    await form.getByPlaceholder("Tiêu đề ngắn gọn", { exact: false }).fill(tieu_de);
    await page.getByTestId("dang-nhanh-body").fill("Mạch tạo từ ngăn kéo, có lệnh có cấu trúc.");
    // Riêng tư: không chen vào feed công khai của các bài đo khác.
    await page.getByTestId("dang-nhanh-rieng-tu").check();

    // Khối lệnh GẬP mặc định.
    const khoi = page.getByTestId("dang-nhanh-lenh");
    await expect(khoi).toBeVisible();
    expect(await khoi.evaluate((e) => (e as HTMLDetailsElement).open)).toBe(false);
    await khoi.locator("summary").click();
    await page.getByTestId("dang-nhanh-lenh-ma").fill("wngk");

    // Lệnh sai (MUA mà SL ≥ giá vào): chặn ở client, tiếng Việt, KHÔNG tạo mạch.
    await page.getByTestId("dang-nhanh-lenh-gia-vao").fill("27.5");
    await page.getByTestId("dang-nhanh-lenh-sl").fill("28");
    await page.getByTestId("dang-nhanh-gui").click();
    await expect(form.getByRole("alert")).toHaveText("Lệnh MUA: SL phải thấp hơn giá vào.");
    expect(new URL(page.url()).pathname).toBe("/");
    // Dấu phẩy thập phân: lỗi, KHÔNG tự đổi thành dấu chấm.
    await page.getByTestId("dang-nhanh-lenh-sl").fill("26,5");
    await page.getByTestId("dang-nhanh-gui").click();
    await expect(form.getByRole("alert")).toHaveText("Dùng dấu chấm cho phần thập phân (vd 27.5).");

    // Sửa đúng rồi đăng.
    await page.getByTestId("dang-nhanh-lenh-sl").fill("26.5");
    await page.getByTestId("dang-nhanh-lenh-tp").fill("30.25");
    await page.getByTestId("dang-nhanh-gui").click();
    await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
    const id = Number(new URL(page.url()).pathname.match(/-(\d+)$/)![1]);

    const r = await page.request.get(`/api/v1/machs/${id}`);
    expect(r.ok()).toBe(true);
    const mach = (await r.json()) as { title: string; loai_mach: string; lenh: unknown };
    expect(mach.title).toBe(tieu_de);
    expect(mach.loai_mach).toBe("nhat_ky");
    // Server IN HOA mã; số giữ nguyên chuỗi thập phân.
    expect(mach.lenh).toMatchObject({
      chieu: "mua",
      ma: "WNGK",
      gia_vao: "27.5",
      sl: "26.5",
      tp: "30.25",
    });

    // Nối mốc cũng đi qua ngăn kéo — nhưng lệnh chỉ đặt lúc tạo mạch ⇒ KHÔNG có khối lệnh.
    await page.getByTestId("nut-noi-moc").click();
    await expect(page.getByTestId("form-noi-moc")).toBeVisible();
    await expect(page.getByTestId("dang-nhanh-lenh")).toHaveCount(0);
  });
});

/* ====================================================================== W-ANH · ảnh chụp */

const THU_MUC_ANH = process.env.E2E_ANH_CHUP;

test.describe("W-ANH — ảnh chụp trang chủ (chỉ khi đặt E2E_ANH_CHUP)", () => {
  test.skip(!THU_MUC_ANH, "đặt E2E_ANH_CHUP=<thư mục> để ghi ảnh chụp");
  const ghi = async (page: Page, ten: string) => {
    mkdirSync(THU_MUC_ANH!, { recursive: true });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: resolve(THU_MUC_ANH!, ten), fullPage: true });
  };
  test("desktop sáng · mobile sáng · desktop tối · mobile tối", async ({ browser }) => {
    for (const [ten, w, h, scheme] of [
      ["trang-chu-desktop-sang.png", 1280, 900, "light"],
      ["trang-chu-mobile-sang.png", 390, 844, "light"],
      ["trang-chu-desktop-toi.png", 1280, 900, "dark"],
      ["trang-chu-mobile-toi.png", 390, 844, "dark"],
    ] as const) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
      const page = await ctx.newPage();
      try {
        await ghi(page, ten);
      } finally {
        await ctx.close();
      }
    }
  });
});
