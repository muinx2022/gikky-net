import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { FeedOut, MachTomTatOut } from "@gikky/api-client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { dungTaiKhoan } from "./danh-tinh";
import {
  NK_BOT,
  NK_DONG,
  NK_THUONG,
  SUB_GIA_SACH,
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
 * thái, dải chân khối, thư viện bài viết, số link `/m/`, mobile.
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

test.describe("W1/G1 — thứ tự: dòng giới thiệu → Chủ đề tuần → Nhật ký mới → Bài viết", () => {
  test("y tăng dần theo đúng thứ tự; thư viện nằm DƯỚI CẢ RAIL và trải hết chiều ngang", async ({
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
    const bai_viet = await y("khoi-bai-viet");
    const rail = await y("rail-phai");
    expect(h1, "dòng giới thiệu trên cùng").toBeLessThan(chu_de.top);
    expect(chu_de.bottom, "chủ đề trước nhật ký").toBeLessThanOrEqual(nhat_ky.top + 1);
    expect(nhat_ky.top).toBeLessThan(bai_viet.top);
    // Section bài viết: dưới cả rail (không chỉ dưới main) và rộng bằng cả khung nhìn.
    expect(bai_viet.top, "thư viện dưới rail").toBeGreaterThanOrEqual(rail.bottom - 1);
    expect(Math.round(bai_viet.x)).toBe(0);
    // Rộng BẰNG `<body>` (`html { scrollbar-gutter: stable }` chừa sẵn rãnh cuộn nên body hẹp hơn
    // khung nhìn 15px), tức không bị khống chế ở 1200px như khung hai cột.
    expect(Math.round(bai_viet.w)).toBe(
      await page.evaluate(() => Math.round(document.body.getBoundingClientRect().width)),
    );
    expect(Math.round(bai_viet.w), "rộng hơn khung hai cột (1200px)").toBeGreaterThan(1200);
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
    expect(await co(h2), "câu hỏi chủ đề ~30px desktop").toBeGreaterThanOrEqual(28);
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
    // Chưa có bình luận ⇒ ẩn nửa phải; nửa trái chiếm hết (một cột, không khung rỗng).
    await expect(khoi.getByTestId("quan-diem-noi-bat")).toHaveCount(0);
    const cot = await khoi.getByTestId("chu-de-the").evaluate((e) => {
      const t = getComputedStyle(e).gridTemplateColumns;
      return t === "none" ? 1 : t.trim().split(/\s+/).length;
    });
    expect(cot, "không bình luận ⇒ một nửa").toBe(1);
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

test.describe("W2b — quan điểm nổi bật: top điểm, tối đa 3 ở desktop, MỘT ở mobile", () => {
  test("desktop hiện hết (seed: chủ đề mở có 2 bình luận gốc); 390px chỉ hiện 1", async ({ page }) => {
    // Chủ đề được chọn = cái xuất bản sau cùng trong 5 chủ đề mới nhất; dùng chính khối trên trang.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const khoi = page.getByTestId("khoi-thao-luan");
    const id = Number(await khoi.getByTestId("chu-de-the").getAttribute("data-mach-id"));
    const bl = await api<{
      threads: { id: number; depth: number; trang_thai: string; score: number }[];
    }>(`/api/v1/machs/${id}/comments?sort=hay_nhat&limit=50`);
    const goc = bl.threads.filter(
      (b) => b.depth === 1 && b.trang_thai === "binh_thuong" && b.score >= 0,
    ).length;
    test.skip(goc < 2, "chủ đề hiện tại có < 2 bình luận gốc — không đo được ẩn bớt ở mobile");
    const mong = Math.min(goc, 3);
    expect(await khoi.getByTestId("quan-diem").evaluateAll((l) => l.filter((e) => (e as HTMLElement).offsetParent !== null).length)).toBe(mong);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    expect(
      await page
        .getByTestId("khoi-thao-luan")
        .getByTestId("quan-diem")
        .evaluateAll((l) => l.filter((e) => (e as HTMLElement).offsetParent !== null).length),
    ).toBe(1);
    // Cả ba vẫn nằm trong HTML (một nội dung cho mọi UA).
    expect(await page.getByTestId("khoi-thao-luan").getByTestId("quan-diem").count()).toBe(mong);
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
      // Mọi thẻ đúng trạng thái: thẻ cũ chỉ có chữ "đã đóng sổ" khi đóng.
      const chip = page.getByTestId("bo-loc-trang-thai");
      await expect(chip).toContainText(tt === "open" ? "Đang mở" : "Đã đóng sổ");
      await expect(chip.getByRole("link")).toHaveAttribute("href", "/?tab=moi&loai_mach=nhat_ky");
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

test.describe("W5/G4 — khối bài viết: Mới đăng, giá sách do admin chọn, ảnh từng bài, <time>, dải bản tin", () => {
  test("Mới đăng: 3 bài mọi chuyên mục (có bài của sub KHÔNG được chọn), chip tên sub, <time datetime>, ô ảnh", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const khoi = page.getByTestId("khoi-bai-viet");
    await expect(khoi.getByRole("heading", { level: 2 })).toHaveText("Bài viết");
    await expect(khoi).toContainText("Kiến thức nền cho người giao dịch nghiêm túc");

    const moi_dang = khoi.getByTestId("bai-viet-moi-dang");
    await expect(moi_dang.getByRole("heading", { level: 3 })).toHaveText("Mới đăng");
    const muc = moi_dang.getByTestId("bai-viet-moi-dang-muc");
    await expect(muc).toHaveCount(3);

    const subs = await api<{ slug: string; ten: string; vi_tri_trang_chu: number | null }[]>(
      "/api/v1/subs",
    );
    const moi = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=50");
    const mong = moi.items.filter((m) => m.sub.slug !== "tin-tuc").slice(0, 3);
    expect(
      await muc.evaluateAll((ls) => ls.map((l) => Number((l as HTMLElement).dataset.machId))),
    ).toEqual(mong.map((m) => m.id));
    // Dữ liệu tạm: chung-khoan và crypto KHÔNG được chọn lên giá sách mà vẫn lên Mới đăng.
    const khong_chon = new Set(subs.filter((s) => s.vi_tri_trang_chu === null).map((s) => s.slug));
    expect(
      mong.some((m) => khong_chon.has(m.sub.slug)),
      "Mới đăng phải có bài của sub không được chọn",
    ).toBe(true);

    // Mỗi bài: tiêu đề là heading cấp 4 chứa link thật, chip = TÊN chuyên mục (không `s/<slug>`
    // khi sub có trong GET /subs), <time datetime> hợp lệ, ô ảnh.
    for (let i = 0; i < 3; i += 1) {
      const m = muc.nth(i);
      await expect(m.getByRole("heading", { level: 4 }).getByRole("link")).toHaveAttribute(
        "href",
        `/m/${mong[i].slug}-${mong[i].id}`,
      );
      await expect(m).toContainText(subs.find((s) => s.slug === mong[i].sub.slug)!.ten);
      const t = m.locator("time");
      expect(await t.getAttribute("datetime"), `bài ${i}: <time datetime>`).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await expect(t).toHaveText(/^\d{2}\/\d{2}$/);
      await expect(m.getByTestId("bai-viet-thumb")).toHaveCount(1);
    }
  });

  test("giá sách: một cột mỗi sub được chọn theo vị trí, tiêu đề = tên sub, 'Xem thêm →' tới /s/<slug>, chỉ tiêu đề + ngày", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const khoi = page.getByTestId("khoi-bai-viet");
    const subs = await api<{ slug: string; ten: string; vi_tri_trang_chu: number | null }[]>(
      "/api/v1/subs",
    );
    const cot = khoi.getByTestId("bai-viet-gia");
    await expect(cot).toHaveCount(3);
    expect(await cot.evaluateAll((c) => c.map((e) => (e as HTMLElement).dataset.sub))).toEqual(
      SUB_GIA_SACH,
    );
    expect(await cot.getByRole("heading", { level: 3 }).allTextContents()).toEqual(
      SUB_GIA_SACH.map((slug) => subs.find((s) => s.slug === slug)!.ten),
    );
    expect(
      await cot
        .getByTestId("bai-viet-gia-xem-them")
        .evaluateAll((l) => l.map((a) => a.getAttribute("href"))),
    ).toEqual(SUB_GIA_SACH.map((slug) => `/s/${slug}`));
    // Lưới chia đều theo SỐ giá (3 cột, không chừa ô trống cho cột thứ tư).
    const so_cot = await khoi
      .locator("[data-testid='bai-viet-gia']")
      .first()
      .evaluate((e) => getComputedStyle(e.parentElement!).gridTemplateColumns.trim().split(/\s+/).length);
    expect(so_cot).toBe(3);

    // Mỗi bài trên giá: <article>, tiêu đề cấp 4 chứa link thật, <time datetime>; KHÔNG ảnh,
    // KHÔNG đoạn trích. Giá không trùng bài đã ở Mới đăng.
    const trong_moi_dang = await khoi
      .getByTestId("bai-viet-moi-dang-muc")
      .evaluateAll((ls) => ls.map((l) => (l as HTMLElement).dataset.machId));
    const muc = khoi.getByTestId("bai-viet-gia-muc");
    const n = await muc.count();
    expect(n).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < n; i += 1) {
      const m = muc.nth(i);
      await expect(m.getByRole("heading", { level: 4 }).getByRole("link")).toHaveAttribute(
        "href",
        /^\/m\/.+-\d+$/,
      );
      const t = m.locator("time");
      expect(await t.getAttribute("datetime"), `bài ${i}: <time datetime>`).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await expect(t).toHaveText(/^\d{2}\/\d{2}$/);
      await expect(m.locator("img")).toHaveCount(0);
      await expect(m.getByTestId("bai-viet-thumb")).toHaveCount(0);
      expect(trong_moi_dang).not.toContain(await m.getAttribute("data-mach-id"));
    }
  });

  test("ảnh: bài có ảnh dùng thumb (lazy, width/height) trong khung 104×72; bài không ảnh có ô nền; khung không đổi", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const khoi = page.getByTestId("khoi-bai-viet");
    const co_anh = khoi.locator('[data-testid="bai-viet-thumb"][data-co-anh="true"]');
    const khong = khoi.locator('[data-testid="bai-viet-thumb"][data-co-anh="false"]');
    expect(await co_anh.count(), "có ít nhất một bài có ảnh").toBeGreaterThanOrEqual(1);
    expect(await khong.count(), "có ít nhất một bài không ảnh").toBeGreaterThanOrEqual(1);
    const img = co_anh.first().locator("img");
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(img).toHaveAttribute("width", /^\d+$/);
    await expect(img).toHaveAttribute("height", /^\d+$/);
    await expect(img).toHaveAttribute("alt", /^Ảnh minh họa: /);
    const hop = async (l: Locator) => {
      const b = await l.boundingBox();
      return { w: Math.round(b!.width), h: Math.round(b!.height) };
    };
    expect(await hop(co_anh.first())).toEqual({ w: 104, h: 72 });
    expect(await hop(khong.first()), "ô thay thế cùng kích thước").toEqual({ w: 104, h: 72 });
    expect(await khong.first().locator("img").count()).toBe(0);
    await img.evaluate((e) => (e as HTMLImageElement).decode());
    expect(await hop(co_anh.first())).toEqual({ w: 104, h: 72 });
    // Nền ô thay thế khác nền section (nhìn thấy được), cả hai theme dùng token.
    const nen = await khong.first().evaluate((e) => getComputedStyle(e).backgroundColor);
    const nen_section = await khoi.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(nen).not.toBe(nen_section);
  });

  test("dải bản tin: 3 bài tin-tuc mới nhất (ngày · tiêu đề) + 'Tất cả bản tin →'; chip chuyên mục là link /s/*", async ({
    page,
  }) => {
    await page.goto("/");
    const moi = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=50");
    const tin = moi.items.filter((m) => m.sub.slug === "tin-tuc").slice(0, 3);
    expect(tin.length).toBe(3);
    const ban_tin = page.getByTestId("ban-tin");
    await expect(ban_tin.getByRole("heading", { level: 3 })).toHaveText("Bản tin thị trường");
    const muc = ban_tin.getByTestId("ban-tin-muc");
    expect(await muc.evaluateAll((l) => l.map((a) => a.getAttribute("href")))).toEqual(
      tin.map((m) => `/m/${m.slug}-${m.id}`),
    );
    for (let i = 0; i < 3; i += 1) {
      await expect(muc.nth(i)).toContainText(tin[i].title);
      expect(await muc.nth(i).locator("time").getAttribute("datetime")).toBe(tin[i].published_at);
    }
    await expect(page.getByTestId("ban-tin-tat-ca")).toHaveAttribute("href", "/s/tin-tuc");
    // Chip: chỉ sub CÓ THẬT; nhãn lấy từ `GET /subs`.
    const subs = await api<{ slug: string; ten: string }[]>("/api/v1/subs");
    const chip = page.getByTestId("bai-viet-chips").locator("a[data-testid^='bai-viet-chip-']");
    const hrefs = await chip.evaluateAll((l) => l.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) {
      const slug = h!.replace("/s/", "");
      expect(subs.some((s) => s.slug === slug), `chip tới sub không có thật: ${h}`).toBe(true);
    }
    await expect(page.getByTestId("bai-viet-chips").getByTestId("bai-viet-chip-hoi-dap")).toHaveText(
      subs.find((s) => s.slug === "hoi-dap")!.ten,
    );
    expect(hrefs).not.toContain("/s/tin-tuc");
  });
});

/* ============================================================================== W6 · SEO · bot */

test.describe("W6/G5 — SEO: số link /m/, HTML như nhau cho trình duyệt và Googlebot", () => {
  const UA_TRINH_DUYET =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const UA_GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const linkM = (html: string) =>
    new Set([...html.matchAll(/<a [^>]*href="(\/m\/[^"]+)"/g)].map((m) => m[1]));

  test("≥ 19 link /m/ duy nhất trong HTML thô; bản tin + chủ đề + nhật ký + bài viết đều có", async ({
    request,
  }) => {
    const html = await (await request.get("/", { headers: { "user-agent": UA_TRINH_DUYET } })).text();
    const links = linkM(html);
    expect(links.size, `số link /m/ duy nhất: ${links.size}`).toBeGreaterThanOrEqual(19);
    // Link chuyên mục /s/* và /luat còn đủ.
    const subs = await api<{ slug: string }[]>("/api/v1/subs");
    const hrefs = new Set([...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]));
    for (const s of subs) expect(hrefs.has(`/s/${s.slug}`), `thiếu /s/${s.slug}`).toBe(true);
    expect(hrefs.has("/luat")).toBe(true);
    // Mỗi bài viết trong thư viện là <article> có <a href> và <time datetime> TRONG HTML thô.
    expect((html.match(/<article\b/g) ?? []).length).toBeGreaterThanOrEqual(9);
    // React in `dateTime=` (camelCase) ra HTML thô; thuộc tính HTML không phân biệt hoa thường.
    expect((html.match(/<time\b[^>]*\bdatetime="/gi) ?? []).length).toBeGreaterThanOrEqual(9 + 3);
  });

  test("UA trình duyệt và Googlebot nhận CÙNG tập link /m/ và cùng số <article>", async ({ request }) => {
    const a = await (await request.get("/", { headers: { "user-agent": UA_TRINH_DUYET } })).text();
    const b = await (await request.get("/", { headers: { "user-agent": UA_GOOGLEBOT } })).text();
    expect([...linkM(a)].sort()).toEqual([...linkM(b)].sort());
    expect((a.match(/<article\b/g) ?? []).length).toBe((b.match(/<article\b/g) ?? []).length);
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
      ["Xem thêm bài viết", page.getByTestId("bai-viet-xem-them")],
      ["chip chuyên mục", page.getByTestId("bai-viet-chip-hoi-dap")],
      ["bản tin", page.getByTestId("ban-tin-muc").first()],
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

  test("khối bài viết mobile: Mới đăng đủ 3 bài, giá sách 1 cột × 2 bài hiện (bài thứ 3 ẩn), thumb 88×66, chip cuộn ngang, 'Xem thêm bài viết' hiện", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const khoi = page.getByTestId("khoi-bai-viet");
    const hien = (l: Locator) =>
      l.evaluateAll((ls) => ls.filter((e) => (e as HTMLElement).offsetParent !== null).length);
    expect(await hien(khoi.getByTestId("bai-viet-moi-dang-muc")), "Mới đăng giữ cả 3 bài").toBe(3);
    const cot = khoi.getByTestId("bai-viet-gia");
    expect(await cot.count()).toBeGreaterThan(0);
    for (let i = 0; i < (await cot.count()); i += 1) {
      const thay = await hien(cot.nth(i).getByTestId("bai-viet-gia-muc"));
      expect(thay, `giá ${i}`).toBeLessThanOrEqual(2);
      expect(thay).toBeGreaterThan(0);
    }
    // Một cột: các giá xếp dọc, mỗi giá rộng bằng khối.
    const xs = await cot.evaluateAll((l) => l.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(xs).size, "mọi giá cùng lề trái (1 cột)").toBe(1);
    const t = await khoi.getByTestId("bai-viet-thumb").first().boundingBox();
    expect({ w: Math.round(t!.width), h: Math.round(t!.height) }).toEqual({ w: 88, h: 66 });
    await expect(page.getByTestId("bai-viet-xem-them")).toBeVisible();
    const chips = page.getByTestId("bai-viet-chips");
    // Chip = các sub admin chọn (ít hơn trước) nên có thể vừa khít 390px: chỉ ghim CƠ CHẾ cuộn
    // (một hàng không xuống dòng, overflow-x auto), không ghim việc nó tràn.
    const cuon = await chips.evaluate((e) => ({
      ov: getComputedStyle(e).overflowX,
      wrap: getComputedStyle(e).flexWrap,
    }));
    expect(cuon.ov).toBe("auto");
    expect(cuon.wrap).toBe("nowrap");
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
