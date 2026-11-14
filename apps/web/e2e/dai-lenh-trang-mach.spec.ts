import type { FeedOut, MachChiTietOut, MachTomTatOut } from "@gikky/api-client";
import { expect, test, type Locator } from "@playwright/test";

import { py } from "./thu-vien";

/** Việc 25 — dải lệnh ở trang chi tiết mạch (plan `plans/2026-11-13-dai-lenh-trang-mach.md`, tiêu
 * chí D4, D5, D8). Chạy trên BẢN BUILD thật.
 *
 * Dữ liệu là của `seed_e2e`: hai nhật ký mang lệnh — một đủ năm số (MUA, SL·TP·Nhồi·R:R), một chỉ
 * có SL (BÁN, đã đóng sổ) — nên cả vế "ô có số thì hiện" lẫn "ô `null` thì vắng" đều đo được.
 * Nguồn sự thật kỳ vọng là **API chi tiết** `GET /api/v1/machs/{id}` → `lenh`, không phải HTML.
 * Phần đọc nguồn (dải là MỘT component dùng chung) ở `e2e/don-vi/dai-lenh.spec.ts` (D7).
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Mọi mạch công khai của một loại, đi hết cursor — hai nhật ký mang lệnh của seed cố ý lùi sâu
 * về quá khứ nên không nằm ở trang đầu. */
async function tatCa(loai: "nhat_ky" | "bai_viet"): Promise<MachTomTatOut[]> {
  const ra: MachTomTatOut[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 30; i += 1) {
    const q: string = `loai_mach=${loai}&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const f: FeedOut = await api<FeedOut>(`/api/v1/feeds/moi?${q}`);
    ra.push(...f.items);
    cursor = f.cursor_ke_tiep;
    if (cursor === null) break;
  }
  return ra;
}

/** Giải mã các thực thể HTML mà React có thể in trong text. */
function giaiMa(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const duongDan = (m: { slug: string; id: number }) => `/m/${m.slug}-${m.id}`;

/** Hình học của một dải lệnh: theo từng HÀNG ô (nhóm theo `top`), mép trái ô đầu / mép phải ô cuối
 * so với mép TRONG của hộp (trừ viền). Khoảng hở > 1.5px ở hai đầu hàng = nền `--line` lộ thành vệt
 * xám. Kèm từng `<b>` (giá / mã): `scrollWidth` so `clientWidth` và mép phải so ô chứa nó. */
async function hinhDaiLenh(dai: Locator) {
  return dai.evaluate((e) => {
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const trong_trai = r.left + parseFloat(s.borderLeftWidth);
    const trong_phai = r.right - parseFloat(s.borderRightWidth);
    const o = [...e.children].map((c) => c.getBoundingClientRect());
    const hang = new Map<number, DOMRect[]>();
    for (const x of o) {
      const k = Math.round(x.top);
      hang.set(k, [...(hang.get(k) ?? []), x]);
    }
    const ho = [...hang.values()].map((ds) => ({
      trai: Math.min(...ds.map((x) => x.left)) - trong_trai,
      phai: trong_phai - Math.max(...ds.map((x) => x.right)),
      so_o: ds.length,
    }));
    const b = [...e.querySelectorAll(":scope > * > b")].map((x) => {
      const o_cha = x.parentElement!.getBoundingClientRect();
      const rb = x.getBoundingClientRect();
      return {
        chu: x.textContent ?? "",
        cuon: x.scrollWidth,
        rong: x.clientWidth,
        // Mép phải `<b>` so mép phải VÙNG NỘI DUNG của ô (trừ padding).
        tran_o: rb.right - (o_cha.right - parseFloat(getComputedStyle(x.parentElement!).paddingRight)),
      };
    });
    return { so_o: o.length, ho, b };
  });
}

function kiemKhongVet(h: Awaited<ReturnType<typeof hinhDaiLenh>>, nhan: string) {
  const m = `${nhan}: ${JSON.stringify(h)}`;
  expect(h.so_o, m).toBeGreaterThan(1);
  for (const x of h.ho) {
    expect(x.trai, m).toBeLessThanOrEqual(1.5);
    expect(x.phai, m).toBeLessThanOrEqual(1.5);
  }
}

function kiemSoKhongTran(h: Awaited<ReturnType<typeof hinhDaiLenh>>, nhan: string) {
  const m = `${nhan}: ${JSON.stringify(h.b)}`;
  expect(h.b.length, `đo rỗng — ${m}`).toBeGreaterThan(1);
  for (const x of h.b) {
    expect(x.cuon, m).toBeLessThanOrEqual(x.rong);
    expect(x.tran_o, m).toBeLessThanOrEqual(0.5);
  }
}

/** Thứ tự ô sau cặp chiều + mã — viết lại ĐỘC LẬP ở đây (không import `lib/lenh`). */
const O: { khoa: string; truong: "gia_vao" | "sl" | "tp" | "nhoi" | "rr" }[] = [
  { khoa: "entry", truong: "gia_vao" },
  { khoa: "sl", truong: "sl" },
  { khoa: "tp", truong: "tp" },
  { khoa: "nhoi", truong: "nhoi" },
  { khoa: "rr", truong: "rr" },
];

/* ======================================================================= D4 · HTML thô */

test.describe("D4 — `/m/<nhật ký có lệnh>` HTML thô: dải lệnh khớp API, sau <h1>, không biên lai", () => {
  test("mọi nhật ký mang lệnh của seed: chiều · mã · các ô khớp `lenh` của API chi tiết", async ({
    request,
  }) => {
    const co_lenh = (await tatCa("nhat_ky")).filter((m) => m.lenh != null);
    expect(co_lenh.length, "seed_e2e phải có ≥ 2 nhật ký mang lệnh (đo rỗng)").toBeGreaterThanOrEqual(2);
    let so_o_vang = 0;
    for (const m of co_lenh) {
      const ct = await api<MachChiTietOut>(`/api/v1/machs/${m.id}`);
      const lenh = ct.lenh;
      expect(lenh, `${m.id}: API chi tiết phải trả lenh`).toBeTruthy();
      const html = await (await request.get(duongDan(m))).text();

      const i_h1 = html.indexOf("<h1");
      const i_dai = html.indexOf('data-testid="trang-mach-lenh"');
      expect(i_h1, `${m.id}: có <h1>`).toBeGreaterThan(-1);
      expect(i_dai, `${m.id}: có dải trang-mach-lenh trong HTML thô`).toBeGreaterThan(i_h1);
      // Có lệnh ⇒ không biên lai (user chốt 2026-11-14). Seed có lệnh đều `figures = null` nên
      // vế này ở đây chỉ là chặn ngược; ca CÓ figures nằm ở nhóm D10 (mạch tạm).
      expect(html, `${m.id}: có lệnh thì không biên lai`).not.toContain('data-testid="bien-lai-dau-bai"');
      // Đúng MỘT dải ở trang (thẻ feed trong rail không mang testid này).
      expect(html.split('data-testid="trang-mach-lenh"').length - 1).toBe(1);

      // Khối dải: tới `</div>` đầu tiên — dải không có `<div>` con.
      const dai = html.slice(i_dai, html.indexOf("</div>", i_dai));
      expect(dai).toContain('role="group"');
      const chieu = /data-testid="trang-mach-chieu"[^>]*>([^<]*)</.exec(dai)?.[1];
      expect(chieu, `${m.id}: chiều`).toBe(lenh!.chieu === "mua" ? "MUA" : "BÁN");
      const ma = /data-testid="trang-mach-chieu"[^>]*>[^<]*<\/span><b\b[^>]*>([^<]*)<\/b>/.exec(dai)?.[1];
      expect(giaiMa(ma ?? ""), `${m.id}: mã`).toBe(lenh!.ma);

      const khoa_thay = [...dai.matchAll(/data-testid="trang-mach-([a-z]+)"/g)]
        .map((x) => x[1])
        .filter((k) => k !== "lenh" && k !== "chieu");
      const khoa_mong = O.filter((o) => lenh![o.truong] != null).map((o) => o.khoa);
      expect(khoa_thay, `${m.id}: các ô theo đúng thứ tự, ô null thì vắng`).toEqual(khoa_mong);
      so_o_vang += O.length - khoa_mong.length;
      for (const o of O) {
        const gia_tri = lenh![o.truong];
        if (gia_tri == null) continue;
        const so = new RegExp(`data-testid="trang-mach-${o.khoa}"[^>]*>[\\s\\S]*?<b\\b[^>]*>([^<]*)</b>`).exec(
          dai,
        )?.[1];
        expect(so, `${m.id}: ô ${o.khoa}`).toBe(gia_tri);
      }
    }
    expect(so_o_vang, "đo rỗng: phải có ít nhất một ô null (vế 'vắng')").toBeGreaterThan(0);
  });
});

/* ================================================================== D5 · không lệnh */

test.describe("D5 — `/m/<bài viết>` và `/m/<nhật ký không lệnh>`: không có dải", () => {
  test("HTML thô không có `trang-mach-lenh`", async ({ request }) => {
    const nk = (await tatCa("nhat_ky")).find((m) => m.lenh == null);
    const bv = (await tatCa("bai_viet")).find((m) => m.sub.slug !== "tin-tuc");
    expect(nk, "đo rỗng: cần một nhật ký không lệnh").toBeDefined();
    expect(bv, "đo rỗng: cần một bài viết").toBeDefined();
    for (const m of [nk!, bv!]) {
      const r = await request.get(duongDan(m));
      expect(r.status(), `${m.id}`).toBe(200);
      const html = await r.text();
      expect(html, `${m.id}: trang phải dựng xong (có <h1>)`).toContain("<h1");
      expect(html, `${m.id} (${m.loai_mach})`).not.toContain("trang-mach-lenh");
      expect(html, `${m.id} (${m.loai_mach})`).not.toContain('aria-label="Lệnh"');
    }
  });
});

/* ============================================================ D8 · 390px + bề rộng desktop */

test.describe("D8 — dải lệnh ở trang chi tiết: 390px không cuộn ngang, desktop không giãn hết hàng", () => {
  async function machDuNamSo(): Promise<MachTomTatOut> {
    const m = (await tatCa("nhat_ky")).find((x) => x.lenh != null && x.lenh.rr != null);
    expect(m, "đo rỗng: cần nhật ký lệnh đủ năm số").toBeDefined();
    return m!;
  }

  test("390px: scrollWidth ≤ innerWidth; đủ ô, mỗi ô nằm trong khung nhìn", async ({ page }) => {
    const m = await machDuNamSo();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(duongDan(m));
    const dai = page.getByTestId("trang-mach-lenh");
    await expect(dai).toBeVisible();
    const do_ = await page.evaluate(() => ({
      cuon: document.documentElement.scrollWidth,
      rong: window.innerWidth,
    }));
    expect(do_.cuon, JSON.stringify(do_)).toBeLessThanOrEqual(do_.rong);
    for (const k of ["chieu", "entry", "sl", "tp", "nhoi", "rr"]) {
      const o = page.getByTestId(`trang-mach-${k}`);
      await expect(o, k).toBeVisible();
      const h = (await o.boundingBox())!;
      expect(h.x, k).toBeGreaterThanOrEqual(0);
      expect(h.x + h.width, k).toBeLessThanOrEqual(do_.rong);
    }
    // Vòng sửa phản biện: 6 ô trên lưới 4 cột từng để nửa hàng 2 trống — vệt nền `--line` ~167px.
    const h = await hinhDaiLenh(dai);
    expect(h.so_o, "6 ô (chiều+mã, Entry, SL, TP, Nhồi, R:R)").toBe(6);
    expect(h.ho.length, `dải phải xuống dòng ở 390px (ca có vệt): ${JSON.stringify(h)}`).toBeGreaterThan(1);
    kiemKhongVet(h, "390px");
  });

  test("1280px: dải co theo nội dung (không vệt nền kéo hết hàng), nằm giữa <h1> và biên lai", async ({
    page,
  }) => {
    const m = await machDuNamSo();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(duongDan(m));
    const dai = page.getByTestId("trang-mach-lenh");
    await expect(dai).toBeVisible();
    const r = await dai.evaluate((e) => {
      const cha = e.parentElement!.parentElement!.getBoundingClientRect();
      const h1 = document.querySelector("h1")!.getBoundingClientRect();
      const ban = e.getBoundingClientRect();
      const o_cuoi = e.lastElementChild!.getBoundingClientRect();
      return { cha_rong: cha.width, rong: ban.width, phai: ban.right, o_cuoi_phai: o_cuoi.right, h1_day: h1.bottom, tren: ban.top };
    });
    expect(r.rong, JSON.stringify(r)).toBeLessThan(r.cha_rong);
    // Ô cuối sát mép phải dải (≤ viền 1px): không còn dải nền `--line` thừa sau nó.
    expect(r.phai - r.o_cuoi_phai, JSON.stringify(r)).toBeLessThanOrEqual(1.5);
    expect(r.tren, JSON.stringify(r)).toBeGreaterThanOrEqual(r.h1_day);
  });
});

/* ======================================================= D8b · giá dài (tối đa schema) · TẠM */

/** Lệnh với số DÀI NHẤT schema cho phép (12 chữ số nguyên + 8 số lẻ, `core/lenh.py`) và mã 20 ký
 * tự — ca phản biện dựng: số tràn ô, bị ô kế đè, mất chữ số. Dựng TẠM bằng Django shell trên
 * `gikky_e2e` (MUA ⇒ sl < vào < tp), xoá sạch sau và kiểm lại 0 hàng. Đo ở CẢ HAI chỗ vẽ (cùng CSS):
 * trang chi tiết và thẻ trên trang chuyên mục. */
const TIEU_DE_GIA_DAI = "[e2e-dai-lenh-v25] Lệnh giá dài tối đa schema";
const LENH_DAI = {
  ma: "BTC-USDT.PERP_LONG01",
  gia_vao: "123456789012.12345678",
  sl: "123456789011.12345678",
  tp: "123456789099.87654321",
  nhoi: "123456789012.00000001",
} as const;

test.describe.serial("D8b — giá dài tối đa schema: mọi `<b>` xuống dòng trong ô, không vệt nền", () => {
  const dem = () =>
    Number(
      py(`from core.models import Mach; print(Mach.objects.filter(title=${JSON.stringify(TIEU_DE_GIA_DAI)}).count())`)
        .trim()
        .split(/\r?\n/)
        .pop(),
    );
  const don = () =>
    py(`from core.models import Mach; Mach.objects.filter(title=${JSON.stringify(TIEU_DE_GIA_DAI)}).delete()`);
  let id = 0;
  let slug = "";
  test.beforeAll(() => {
    don();
    const ra = py(
      [
        "from decimal import Decimal as D",
        "from core.ghi import tao_mach",
        "from core.lenh import Lenh",
        "from core.models import Mach, Sub",
        "goc = Mach.objects.filter(loai_mach=Mach.LoaiMach.NHAT_KY, lenh_ma__isnull=False).order_by('id').first()",
        "m, _ = tao_mach(sub=Sub.objects.get(slug='e2e-thu-nghiem'), author=goc.author, loai_mach=Mach.LoaiMach.NHAT_KY,",
        `    title=${JSON.stringify(TIEU_DE_GIA_DAI)}, body='Giá dài của bộ e2e (việc 25).', occurred_at=None, loai=None,`,
        `    lenh=Lenh('mua', ${JSON.stringify(LENH_DAI.ma)}, D(${JSON.stringify(LENH_DAI.gia_vao)}), sl=D(${JSON.stringify(LENH_DAI.sl)}), tp=D(${JSON.stringify(LENH_DAI.tp)}), nhoi=D(${JSON.stringify(LENH_DAI.nhoi)})))`,
        "print(f'{m.id} {m.slug}')",
        "",
      ].join("\n"),
    );
    const dong = ra.trim().split(/\r?\n/).pop()!.split(" ");
    id = Number(dong[0]);
    slug = dong[1];
    expect(id, `tạo mạch tạm: ${ra}`).toBeGreaterThan(0);
  });
  test.afterAll(() => {
    don();
    expect(dem(), "đã xoá sạch mạch tạm").toBe(0);
  });

  for (const rong of [390, 1280]) {
    test(`trang chi tiết ${rong}px: mọi <b> scrollWidth ≤ clientWidth, không tràn ô, không vệt nền`, async ({
      page,
    }) => {
      const ct = await api<MachChiTietOut>(`/api/v1/machs/${id}`);
      expect(ct.lenh?.gia_vao, "API trả đúng giá dài").toBe(LENH_DAI.gia_vao);
      await page.setViewportSize({ width: rong, height: 900 });
      await page.goto(`/m/${slug}-${id}`);
      const dai = page.getByTestId("trang-mach-lenh");
      await expect(dai).toBeVisible();
      await expect(dai).toContainText(LENH_DAI.gia_vao);
      const h = await hinhDaiLenh(dai);
      kiemSoKhongTran(h, `chi tiết ${rong}`);
      kiemKhongVet(h, `chi tiết ${rong}`);
      const cuon = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(cuon, "không cuộn ngang").toBeLessThanOrEqual(0);
    });
  }

  test("thẻ trên `/s/e2e-thu-nghiem` ở 390px: cùng CSS — số không tràn, không vệt nền", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/s/e2e-thu-nghiem");
    const the = page.locator(`[data-testid="the-mach"][data-mach-id="${id}"]`);
    await expect(the, "thẻ mạch tạm (mới nhất của sub) phải có ở trang 1").toHaveCount(1);
    const dai = the.getByTestId("the-nhat-ky-lenh");
    await expect(dai).toBeVisible();
    const h = await hinhDaiLenh(dai);
    kiemSoKhongTran(h, "thẻ 390");
    kiemKhongVet(h, "thẻ 390");
  });
});
/* ============================ D10 · có lệnh ⇒ không biên lai; mốc 1 bị ẩn ⇒ không dải · TẠM */

/** Vòng sửa 2 (user chốt 2026-11-14): "Có lệnh thì ẩn khối số" và "mốc 1 bị ẩn thì ẩn dải lệnh
 * theo". Seed không có mạch nào mang CẢ `lenh` lẫn `figures` mốc 1 (phản biện: vế "trước biên
 * lai" của D4 bản đầu không bao giờ chạy), nên dựng TẠM ba mạch bằng Django shell:
 * - `CO_CA_HAI`: lệnh + figures mốc 1 ⇒ có dải, KHÔNG biên lai, figures nằm TRONG thẻ mốc 1;
 * - `CHI_FIGURES`: figures, không lệnh ⇒ biên lai ở header như cũ, mốc 1 không lặp figures;
 * - `MOC_1_AN`: lệnh + figures, mốc 1 bị mod ẩn ⇒ API `lenh = null` ⇒ không dải ở trang chi
 *   tiết lẫn thẻ feed, và cũng không biên lai (mốc 1 không đọc được);
 * - `BIA_MO`: lệnh + figures, tác giả TỰ xoá mốc 1 ⇒ API GIỮ lệnh (user: "Giữ lệnh" — lệnh là
 *   biên lai) ⇒ dải hiện, biên lai không.
 * Xoá sạch sau và kiểm lại 0 hàng. */
const TIEN_TO_D10 = "[e2e-dai-lenh-v25-d10]";
const D10 = {
  CO_CA_HAI: `${TIEN_TO_D10} Lệnh và figures mốc 1`,
  CHI_FIGURES: `${TIEN_TO_D10} Chỉ figures mốc 1`,
  MOC_1_AN: `${TIEN_TO_D10} Lệnh, mốc 1 bị ẩn`,
  BIA_MO: `${TIEN_TO_D10} Lệnh, mốc 1 bia mộ`,
} as const;
const FIGURES_D10 = [
  { label: "Entry", value: "12.2" },
  { label: "SL", value: "11.71" },
  { label: "TP", value: "13.37" },
];

/** Đoạn HTML của thẻ mốc 1: từ `data-testid="moc-1"` tới thân mốc 1 (`figures` đứng trước thân). */
function doanMoc1(html: string): string {
  const dau = html.indexOf('data-testid="moc-1"');
  const cuoi = html.indexOf('data-testid="than-moc-1"', dau);
  expect(dau, "đo rỗng: có thẻ mốc 1").toBeGreaterThan(-1);
  expect(cuoi, "đo rỗng: có thân mốc 1").toBeGreaterThan(dau);
  return html.slice(dau, cuoi);
}

test.describe.serial("D10 — có lệnh ⇒ không biên lai; mốc 1 bị ẩn ⇒ không dải lệnh (mạch tạm)", () => {
  const loc = `Mach.objects.filter(title__startswith=${JSON.stringify(TIEN_TO_D10)})`;
  const dem = () =>
    Number(py(`from core.models import Mach; print(${loc}.count())`).trim().split(/\r?\n/).pop());
  const don = () => py(`from core.models import Mach; ${loc}.delete()`);
  const id: Record<keyof typeof D10, number> = { CO_CA_HAI: 0, CHI_FIGURES: 0, MOC_1_AN: 0, BIA_MO: 0 };
  const slug: Record<keyof typeof D10, string> = { CO_CA_HAI: "", CHI_FIGURES: "", MOC_1_AN: "", BIA_MO: "" };
  const url = (k: keyof typeof D10) => `/m/${slug[k]}-${id[k]}`;

  test.beforeAll(() => {
    don();
    const ra = py(
      [
        "from decimal import Decimal as D",
        "from core.ghi import dat_an_moc, tao_mach, xoa_moc",
        "from core.lenh import Lenh",
        "from core.models import Mach, Sub",
        "goc = Mach.objects.filter(loai_mach=Mach.LoaiMach.NHAT_KY, lenh_ma__isnull=False).order_by('id').first()",
        "sub = Sub.objects.get(slug='e2e-thu-nghiem')",
        `fig = ${JSON.stringify(FIGURES_D10)}`,
        "def tao(td, lenh):",
        "    m, m1 = tao_mach(sub=sub, author=goc.author, loai_mach=Mach.LoaiMach.NHAT_KY, title=td,",
        "        body='Mạch tạm của bộ e2e (việc 25, D10).', occurred_at=None, loai=None, figures=fig, lenh=lenh)",
        "    return m, m1",
        "L = lambda: Lenh('mua', 'D10LENH', D('12.2'), sl=D('11.71'), tp=D('13.37'))",
        `a, _ = tao(${JSON.stringify(D10.CO_CA_HAI)}, L())`,
        `b, _ = tao(${JSON.stringify(D10.CHI_FIGURES)}, None)`,
        `c, c1 = tao(${JSON.stringify(D10.MOC_1_AN)}, L())`,
        "dat_an_moc(moc=c1, boi=goc.author, an=True, ly_do='e2e D10')",
        `d, d1 = tao(${JSON.stringify(D10.BIA_MO)}, L())`,
        "xoa_moc(moc=d1)",
        "for k, m in (('CO_CA_HAI', a), ('CHI_FIGURES', b), ('MOC_1_AN', c), ('BIA_MO', d)): print(f'{k} {m.id} {m.slug}')",
        "",
      ].join("\n"),
    );
    for (const dong of ra.trim().split(/\r?\n/)) {
      const [k, i, s] = dong.trim().split(" ");
      if (k in id) {
        id[k as keyof typeof D10] = Number(i);
        slug[k as keyof typeof D10] = s;
      }
    }
    for (const k of Object.keys(D10) as (keyof typeof D10)[]) expect(id[k], `tạo ${k}: ${ra}`).toBeGreaterThan(0);
  });
  test.afterAll(() => {
    don();
    expect(dem(), "đã xoá sạch mạch tạm").toBe(0);
  });

  test("lệnh + figures mốc 1 ⇒ có dải, KHÔNG biên lai, figures nằm trong thẻ mốc 1", async ({ request }) => {
    const ct = await api<MachChiTietOut>(`/api/v1/machs/${id.CO_CA_HAI}`);
    expect(ct.lenh, "API trả lệnh").toBeTruthy();
    expect(ct.mocs.find((x) => x.seq === 1)?.figures, "API trả figures mốc 1").toHaveLength(3);
    const html = await (await request.get(url("CO_CA_HAI"))).text();
    expect(html).toContain('data-testid="trang-mach-lenh"');
    expect(html, "có lệnh ⇒ không biên lai").not.toContain('data-testid="bien-lai-dau-bai"');
    const m1 = doanMoc1(html);
    expect(m1, "figures trở về thẻ mốc 1").toContain('data-testid="figures"');
    for (const f of FIGURES_D10) expect(m1).toContain(`>${f.label}</dt>`);
  });

  test("chỉ figures (không lệnh) ⇒ biên lai ở header như cũ, mốc 1 KHÔNG lặp figures, không dải", async ({
    request,
  }) => {
    const html = await (await request.get(url("CHI_FIGURES"))).text();
    expect(html).not.toContain("trang-mach-lenh");
    const i_h1 = html.indexOf("<h1");
    const i_bien_lai = html.indexOf('data-testid="bien-lai-dau-bai"');
    expect(i_bien_lai, "có biên lai").toBeGreaterThan(i_h1);
    expect(i_bien_lai, "biên lai ở header, trước thẻ mốc 1").toBeLessThan(html.indexOf('data-testid="moc-1"'));
    expect(doanMoc1(html), "mốc 1 không lặp figures").not.toContain('data-testid="figures"');
  });

  test("mốc 1 bị mod ẩn ⇒ API `lenh = null` (chi tiết + feed) ⇒ không dải ở trang chi tiết lẫn thẻ", async ({
    request,
    page,
  }) => {
    const ct = await api<MachChiTietOut>(`/api/v1/machs/${id.MOC_1_AN}`);
    expect(ct.mocs.find((x) => x.seq === 1)?.trang_thai, "mốc 1 đã bị ẩn (đo rỗng)").toBe("da_an");
    expect(ct.lenh ?? null, "API chi tiết").toBeNull();
    const feed = await api<FeedOut>("/api/v1/feeds/moi?sub=e2e-thu-nghiem&limit=20");
    const the_api = feed.items.find((m) => m.id === id.MOC_1_AN);
    expect(the_api, "mạch tạm có trong feed của sub (đo rỗng)").toBeDefined();
    expect(the_api!.lenh ?? null, "API feed").toBeNull();
    // Đối chứng cùng lô: mạch mốc 1 bình thường vẫn có lệnh ở feed.
    expect(feed.items.find((m) => m.id === id.CO_CA_HAI)?.lenh, "đối chứng").toBeTruthy();

    const html = await (await request.get(url("MOC_1_AN"))).text();
    expect(html, "trang phải dựng xong").toContain("<h1");
    expect(html).not.toContain("trang-mach-lenh");
    expect(html).not.toContain('data-testid="bien-lai-dau-bai"');

    await page.goto("/s/e2e-thu-nghiem");
    const the = page.locator(`[data-testid="the-mach"][data-mach-id="${id.MOC_1_AN}"]`);
    await expect(the, "thẻ mạch tạm có ở trang 1").toHaveCount(1);
    await expect(the.getByTestId("the-nhat-ky-lenh")).toHaveCount(0);
    await expect(
      page.locator(`[data-testid="the-mach"][data-mach-id="${id.CO_CA_HAI}"]`).getByTestId("the-nhat-ky-lenh"),
      "đối chứng: thẻ mốc 1 bình thường có dải",
    ).toHaveCount(1);
  });

  test("mốc 1 là bia mộ (tác giả tự xoá) ⇒ API GIỮ lệnh ⇒ có dải, không biên lai", async ({ request }) => {
    const ct = await api<MachChiTietOut>(`/api/v1/machs/${id.BIA_MO}`);
    expect(ct.mocs.find((x) => x.seq === 1)?.trang_thai, "mốc 1 là bia mộ (đo rỗng)").toBe("da_xoa");
    expect(ct.lenh?.ma, "bia mộ giữ lệnh").toBe("D10LENH");
    const html = await (await request.get(url("BIA_MO"))).text();
    expect(html).toContain('data-testid="trang-mach-lenh"');
    expect(html).not.toContain('data-testid="bien-lai-dau-bai"');
  });
});