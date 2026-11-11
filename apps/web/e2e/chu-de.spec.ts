import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import type { FeedOut, MachChiTietOut, MachTomTatOut, SubChiTietOut } from "@gikky/api-client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { tuanVNCua } from "../lib/chu-de";
import { dungTaiKhoan } from "./danh-tinh";
import { duongDan, lamMoiCacheTrang } from "./du-lieu";

/** Kho chủ đề `/chu-de` + trang mạch của chủ đề (plan `plans/2026-11-10-homepage-v2.md` §3.7–3.8,
 * tiêu chí K1–K8) — chạy trên BẢN BUILD thật.
 *
 * Dữ liệu là của `seed_e2e`: ba chủ đề `thao_luan` ở ba tuần khác nhau — một đang mở (2 bình
 * luận), một đã đóng có tổng kết (`ket_qua` "5 bình luận" + `bai_hoc`), một đã đóng không tổng
 * kết. Nguồn sự thật kỳ vọng là **API**, không phải HTML mình vừa render.
 *
 * Mấy ca cần dữ liệu khác seed (> 50 chủ đề, không có chủ đề, chỉ có chủ đề đã đóng, một chủ đề
 * riêng để mod bấm đóng) được DỰNG TẠM bằng Django shell trên `gikky_e2e` và HOÀN LẠI sạch trong
 * `afterAll` (cũng dọn ở `beforeAll`, để một lượt chạy trước bị ngắt giữa chừng không để rác lại
 * làm các bài đo B1–B3 của `trang-chu-v2.spec.ts` đỏ vì lý do không liên quan). */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";
const GOC = resolve(__dirname, "..", "..", "..");

const TIEU_DE_MO = "Chủ đề e2e đang mở";
const TIEU_DE_DONG_TONG_KET = "Chủ đề e2e đã đóng có tổng kết";
const TIEU_DE_DONG_KHONG = "Chủ đề e2e đã đóng không tổng kết";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Mọi chủ đề công khai, theo đúng thứ tự feed, đi hết các trang (API trần 50/trang). */
async function tatCaChuDeTheoApi(): Promise<MachTomTatOut[]> {
  const ra: MachTomTatOut[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i += 1) {
    const q: string = `/api/v1/feeds/moi?loai_mach=thao_luan&limit=50${
      cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`
    }`;
    const f: FeedOut = await api<FeedOut>(q);
    ra.push(...f.items);
    cursor = f.cursor_ke_tiep;
    if (cursor === null) return ra;
  }
  throw new Error("quá 20 trang chủ đề — dữ liệu e2e không bình thường");
}

/** Chạy một đoạn Python trong Django shell của `gikky_e2e` (DATABASE_URL kế thừa từ lệnh chạy
 * e2e — KHÔNG đặt ở đây), trả stdout. */
function py(ma: string): string {
  return execFileSync(process.execPath, [resolve(GOC, "scripts/py.mjs"), "shell", "-c", ma], {
    cwd: GOC,
    stdio: "pipe",
  }).toString();
}

/** Dòng in CUỐI CÙNG của một đoạn Python (Django shell in thêm "N objects imported
 * automatically" lên stdout). */
const dongCuoi = (ra: string) => ra.trim().split("\n").pop()?.trim() ?? "";

/** Ẩn / hiện các chủ đề seed có tiêu đề bắt đầu bằng `tien_to` (soft-hide của sản phẩm). CHECK
 * `mach_an_phai_co_nguoi_an_hoac_hen_gio` đòi có người ẩn ⇒ dùng chính tác giả. */
function anChuDeSeed(tien_to: string, an: boolean): void {
  py(
    "from django.utils import timezone; from django.db.models import F; from core.models import Mach; " +
      `Mach.objects.filter(loai_mach='thao_luan', title__startswith=${JSON.stringify(tien_to)})` +
      `.update(hidden_at=${an ? "timezone.now()" : "None"}, hidden_by=${an ? "F('author')" : "None"})`,
  );
}

const TIEN_TO_TAM = "Chủ đề tạm e2e";

/** Dựng `so` chủ đề tạm (loại `thao_luan`) cùng tác giả/sub với chủ đề seed. */
function dungChuDeTam(so: number, nhan: string, dong = false): void {
  py(
    [
      "from datetime import datetime, time, timedelta",
      "from core.ghi import tao_mach, dong_so",
      "from core.models import Mach",
      "from core.thoi_gian import TZ_VN, ngay_vn",
      `goc = Mach.objects.get(title__startswith=${JSON.stringify(TIEU_DE_MO)})`,
      "hom_nay = ngay_vn()",
      `for i in range(${so}):`,
      "    khi = datetime.combine(hom_nay - timedelta(days=5 + i), time(9, 0), tzinfo=TZ_VN)",
      "    m, _ = tao_mach(sub=goc.sub, author=goc.author,",
      `        title=f'${TIEN_TO_TAM} ${nhan} {i:03d}', body='Chủ đề tạm của bộ e2e.',`,
      "        occurred_at=khi.date(), loai=None, loai_mach=Mach.LoaiMach.THAO_LUAN, _created_at_seed=khi)",
      dong
        ? "    dong_so(mach=m, ket_qua=None, bai_hoc=None, khi=khi + timedelta(days=1))"
        : "    pass",
      "",
    ].join("\n"),
  );
}

function xoaChuDeTam(): void {
  py(
    "from core.models import Mach; " +
      `Mach.objects.filter(title__startswith=${JSON.stringify(TIEN_TO_TAM)}).delete()`,
  );
}

/** `textContent` của thẻ trừ tiêu đề (tiêu đề seed có chính chữ "đã đóng" — không trừ ra thì bài đo
 * nhãn tự đúng), giữ nguyên HOA/thường của mã nguồn (`innerText` đã áp `text-transform`). */
const chuNgoaiTieuDe = (the: Locator) =>
  the.evaluate((el) => {
    const ban_sao = el.cloneNode(true) as Element;
    ban_sao.querySelectorAll("h1, h2, h3").forEach((h) => h.remove());
    return ban_sao.textContent ?? "";
  });

const idsHang = (page: Page) =>
  page
    .getByTestId("chu-de-hang")
    .evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.machId)));

/* ---------------------------------------------------------------------------------------- */

test.describe("K1 · K4 · K5 — /chu-de với dữ liệu seed", () => {
  test.beforeAll(() => {
    anChuDeSeed("Chủ đề e2e", false);
    xoaChuDeTam();
  });

  test("K1 — 200; ba chủ đề, mới nhất trước, mỗi tuần một nhóm, chip và dòng tổng kết đúng", async ({
    page,
    request,
  }) => {
    const res = await request.get("/chu-de");
    expect(res.status()).toBe(200);

    const theoApi = await tatCaChuDeTheoApi();
    expect(theoApi, "seed phải có đúng ba chủ đề").toHaveLength(3);

    await page.goto("/chu-de");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chủ đề thảo luận");
    // Thứ tự = thứ tự của feed (mới nhất trước).
    expect(await idsHang(page)).toEqual(theoApi.map((m) => m.id));

    // Mỗi chủ đề ở một tuần khác nhau ⇒ ba nhóm, nhãn tính từ `published_at` của chính nó.
    const nhom = page.getByTestId("chu-de-tuan");
    await expect(nhom).toHaveCount(3);
    const nhan = await page.getByTestId("chu-de-tuan-nhan").allTextContents();
    expect(nhan).toEqual(theoApi.map((m) => tuanVNCua(m.published_at).nhan));
    expect(new Set(nhan).size, "ba nhãn tuần khác nhau").toBe(3);
    // Nhãn đúng khuôn của plan.
    for (const n of nhan) expect(n).toMatch(/^Tuần \d{2}\/\d{2}( \d{4})? – \d{2}\/\d{2}\/\d{4}$/);

    const hang = (tieu_de: string) =>
      page.getByTestId("chu-de-hang").filter({ hasText: tieu_de });

    // Đang mở: chip "Đang mở", không dòng tổng kết.
    await expect(hang(TIEU_DE_MO).getByTestId("chu-de-trang-thai")).toHaveText("Đang mở");
    await expect(hang(TIEU_DE_MO).getByTestId("chu-de-tong-ket")).toHaveCount(0);
    await expect(hang(TIEU_DE_MO).getByTestId("chu-de-so-binh-luan")).toHaveText("2 bình luận");

    // Đã đóng, có `ket_qua`: chip "Đã đóng" + dòng tổng kết = `ket_qua`.
    const dong = hang(TIEU_DE_DONG_TONG_KET);
    await expect(dong.getByTestId("chu-de-trang-thai")).toHaveText("Đã đóng");
    const ket_qua = theoApi.find((m) => m.title.startsWith(TIEU_DE_DONG_TONG_KET))?.ket_qua;
    expect(ket_qua, "seed: chủ đề này phải có ket_qua").toBeTruthy();
    await expect(dong.getByTestId("chu-de-tong-ket")).toContainText(ket_qua as string);
    await expect(dong.getByTestId("chu-de-so-binh-luan")).toHaveText("5 bình luận");

    // Đã đóng, KHÔNG ket_qua: chip "Đã đóng", không dòng tổng kết, không "0 bình luận".
    const dong0 = hang(TIEU_DE_DONG_KHONG);
    await expect(dong0.getByTestId("chu-de-trang-thai")).toHaveText("Đã đóng");
    await expect(dong0.getByTestId("chu-de-tong-ket")).toHaveCount(0);
    await expect(dong0.getByTestId("chu-de-so-binh-luan")).toHaveCount(0);

    // Mỗi tiêu đề là link thật tới `/m/…` của đúng mạch.
    for (const m of theoApi) {
      await expect(
        page.locator(`[data-mach-id="${m.id}"] h3 a`),
      ).toHaveAttribute("href", `/m/${m.slug}-${m.id}`);
    }

    // Không có "Xem thêm" khi chỉ có 3 chủ đề.
    await expect(page.getByTestId("chu-de-xem-them")).toHaveCount(0);
  });

  test("K1 — `?cursor=rac` ⇒ 200, lùi về trang đầu và NÓI RA (không 500)", async ({
    page,
    request,
  }) => {
    expect((await request.get("/chu-de?cursor=rac")).status()).toBe(200);
    await page.goto("/chu-de?cursor=rac");
    await expect(page.getByTestId("bao-cursor-hong")).toBeVisible();
    expect(await idsHang(page)).toEqual((await tatCaChuDeTheoApi()).map((m) => m.id));
  });

  test("K4 — <title>, canonical, og:url, og:title là của RIÊNG /chu-de, không phải của /; có og:image + twitter:image", async ({
    page,
    request,
  }) => {
    await page.goto("/chu-de");
    await expect(page).toHaveTitle("Chủ đề thảo luận — gikky.net");
    const dau = async (sel: string, thuoc: string) =>
      page.locator(sel).first().getAttribute(thuoc);
    expect(await dau('link[rel="canonical"]', "href")).toBe("http://localhost:3000/chu-de");
    expect(await dau('meta[property="og:url"]', "content")).toBe("http://localhost:3000/chu-de");
    expect(await dau('meta[property="og:title"]', "content")).toBe(
      "Chủ đề thảo luận — gikky.net",
    );
    expect(await dau('meta[property="og:site_name"]', "content")).toBe("gikky.net");
    expect(await dau('meta[property="og:locale"]', "content")).toBe("vi_VN");
    const mo_ta = await dau('meta[name="description"]', "content");
    expect(mo_ta?.length ?? 0).toBeGreaterThan(40);

    // Ảnh OG / Twitter CÓ MẶT (trước vòng sửa 1 `/chu-de` thiếu cả hai vì `openGraph` của trang
    // thay cả khối của layout) và cùng KIỂU nguồn với `/`: một route `opengraph-image` của chính
    // origin này, trả PNG thật.
    const anh_og = await dau('meta[property="og:image"]', "content");
    const anh_tw = await dau('meta[name="twitter:image"]', "content");
    expect(anh_og, "thiếu og:image").not.toBeNull();
    expect(anh_tw, "thiếu twitter:image").not.toBeNull();
    expect(anh_og).toMatch(/^http:\/\/localhost:3000\/chu-de\/opengraph-image(\?.*)?$/);
    expect(anh_tw).toMatch(/^http:\/\/localhost:3000\/chu-de\/(opengraph|twitter)-image(\?.*)?$/);
    expect(await dau('meta[property="og:image:width"]', "content")).toBe("1200");
    expect(await dau('meta[property="og:image:height"]', "content")).toBe("630");
    expect(await dau('meta[name="twitter:card"]', "content")).toBe("summary_large_image");
    const res_anh = await request.get(new URL(anh_og!).pathname);
    expect(res_anh.status()).toBe(200);
    expect(res_anh.headers()["content-type"]).toContain("image/png");

    // Đối chứng: `/` có ảnh OG cùng kiểu (route `opengraph-image` của origin), nên `/chu-de`
    // không "có ảnh" theo một nghĩa khác.
    await page.goto("/");
    expect(await dau('meta[property="og:image"]', "content")).toMatch(
      /^http:\/\/localhost:3000\/opengraph-image(\?.*)?$/,
    );
    expect(await dau('meta[name="twitter:image"]', "content")).toMatch(
      /^http:\/\/localhost:3000\/(opengraph|twitter)-image(\?.*)?$/,
    );

    // Đối chứng: trang chủ vẫn mang canonical `/` — nên K4 không xanh vì hai trang giống nhau.
    await page.goto("/");
    // (`urlTuyetDoi("/")` bỏ dấu gạch cuối: canonical của trang chủ là gốc, không phải `/chu-de`.)
    expect(await dau('link[rel="canonical"]', "href")).toBe("http://localhost:3000");
    expect(await dau('meta[property="og:url"]', "content")).toBe("http://localhost:3000");
  });

  test("K5 — sitemap.xml có /chu-de; tổng số URL = 3 trang tĩnh + chuyên mục + mọi mạch", async ({
    request,
  }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const loc = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(loc.filter((u) => u === "http://localhost:3000/chu-de")).toHaveLength(1);

    // Tính độc lập từ API: `/`, `/luat`, `/chu-de` + mỗi chuyên mục + mỗi mạch (feed không lọc).
    const cac_sub = await api<SubChiTietOut[]>("/api/v1/subs");
    let tong_mach = 0;
    let cursor: string | null = null;
    for (let i = 0; i < 100; i += 1) {
      const f: FeedOut = await api<FeedOut>(
        `/api/v1/feeds/moi?limit=50${cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`}`,
      );
      tong_mach += f.items.length;
      cursor = f.cursor_ke_tiep;
      if (cursor === null) break;
    }
    expect(loc).toHaveLength(3 + cac_sub.length + tong_mach);
    // Chủ đề riêng lẻ vẫn nằm trong sitemap qua vòng feed (không bị mất).
    for (const m of await tatCaChuDeTheoApi()) {
      expect(loc).toContain(`http://localhost:3000/m/${m.slug}-${m.id}`);
    }
  });
});

/* ---------------------------------------------------------------------------------------- */

test.describe.serial("K2 — /chu-de khi có > 50 chủ đề", () => {
  test.beforeAll(() => {
    xoaChuDeTam();
    dungChuDeTam(55, "K2");
  });
  test.afterAll(() => xoaChuDeTam());

  test("link `cursor` THẬT trong HTML thô; theo link ra trang 2 không trùng, không sót", async ({
    page,
    request,
  }) => {
    const tat_ca = await tatCaChuDeTheoApi();
    expect(tat_ca.length, "3 chủ đề seed + 55 tạm").toBe(58);

    // HTML thô (không JS): có <a href> tới trang kế tiếp.
    const html = await (await request.get("/chu-de")).text();
    const m = /<a [^>]*href="(\/chu-de\?cursor=[^"]+)"/.exec(html);
    expect(m, "HTML thô phải có link cursor").not.toBeNull();
    const href = m![1].replace(/&amp;/g, "&");

    await page.goto("/chu-de");
    const trang1 = await idsHang(page);
    expect(trang1).toHaveLength(50);
    await expect(page.getByTestId("chu-de-xem-them")).toHaveAttribute("href", href);
    await expect(page.getByTestId("chu-de-ve-dau")).toHaveCount(0);

    await page.goto(href);
    const trang2 = await idsHang(page);
    expect(trang2).toHaveLength(8);
    await expect(page.getByTestId("chu-de-ve-dau")).toHaveAttribute("href", "/chu-de");
    // Trang 2 hết kho ⇒ không còn "Xem thêm".
    await expect(page.getByTestId("chu-de-xem-them")).toHaveCount(0);

    // Hợp hai trang = đúng tập API, đúng thứ tự, không trùng, không sót.
    expect(new Set([...trang1, ...trang2]).size).toBe(58);
    expect([...trang1, ...trang2]).toEqual(tat_ca.map((x) => x.id));
  });
});

/* ---------------------------------------------------------------------------------------- */

test.describe.serial("K3 — /chu-de khi không có chủ đề nào", () => {
  test.beforeAll(() => {
    xoaChuDeTam();
    anChuDeSeed("Chủ đề e2e", false);
  });
  test.afterAll(() => anChuDeSeed("Chủ đề e2e", false));

  test("200 và một dòng 'Chưa có chủ đề nào.' (không lỗi, không khung rỗng)", async ({
    page,
    request,
  }) => {
    anChuDeSeed("Chủ đề e2e", true);
    expect(await tatCaChuDeTheoApi(), "không còn chủ đề công khai nào").toHaveLength(0);

    expect((await request.get("/chu-de")).status()).toBe(200);
    await page.goto("/chu-de");
    await expect(page.getByTestId("chu-de-rong")).toHaveText("Chưa có chủ đề nào.");
    await expect(page.getByTestId("chu-de-tuan")).toHaveCount(0);
    await expect(page.getByTestId("chu-de-xem-them")).toHaveCount(0);
    // Khung và rail vẫn dựng đủ: đây là một trang bình thường, chỉ chưa có nội dung.
    await expect(page.getByTestId("khung-hai-cot")).toBeVisible();
    await expect(page.getByTestId("sidebar-cac-sub")).toBeAttached();
    // `?cursor=rac` trên kho rỗng cũng không 500.
    expect((await request.get("/chu-de?cursor=rac")).status()).toBe(200);
  });
});

/* ---------------------------------------------------------------------------------------- */

test.describe.serial("K7 — trang chủ khi chỉ có chủ đề đã đóng", () => {
  test.beforeAll(() => anChuDeSeed("Chủ đề e2e", false));
  test.afterAll(() => anChuDeSeed("Chủ đề e2e", false));

  // Giao diện mới (plan 2026-11-11): khối là "Chủ đề tuần" — câu hỏi là `<h2>`, nhãn theo TUẦN
  // chứ không theo trạng thái ("Chủ đề gần nhất" khi chủ đề đã quá tuần của nó), nút "Xem lại
  // thảo luận", và KHÔNG còn link "Các chủ đề trước" trong khối (lối vào `/chu-de` là rail phải).
  test("khối Chủ đề vẫn hiện MỘT chủ đề, chip 'Đã đóng', nút 'Xem lại thảo luận'; lối vào kho chủ đề ở rail", async ({
    page,
  }) => {
    anChuDeSeed(TIEU_DE_MO, true);
    const con_lai = await tatCaChuDeTheoApi();
    expect(con_lai.map((m) => m.status)).toEqual(["closed", "closed"]);

    await page.goto("/");
    const khoi = page.getByTestId("khoi-thao-luan");
    await expect(khoi).toBeVisible();
    // Hai chủ đề đã đóng nhưng trang chủ chỉ hiện cái MỚI NHẤT.
    await expect(khoi.getByTestId("chu-de-the")).toHaveCount(1);
    await expect(khoi.getByTestId("chu-de-the")).toHaveAttribute(
      "data-mach-id",
      String(con_lai[0].id),
    );
    await expect(khoi.getByRole("heading", { level: 2 })).toHaveText(con_lai[0].title);
    await expect(khoi.getByTestId("chu-de-nhan")).toHaveText("Chủ đề gần nhất");
    await expect(khoi.getByTestId("chu-de-trang-thai")).toHaveText("Đã đóng");
    await expect(khoi.getByTestId("chu-de-vao")).toHaveText("Xem lại thảo luận");
    await expect(khoi.getByTestId("chu-de-tat-ca")).toHaveCount(0);
    await expect(khoi.locator('a[href="/chu-de"]')).toHaveCount(0);
    await expect(page.getByTestId("sidebar-dan-chu-de")).toHaveAttribute("href", "/chu-de");
  });
});

/* ---------------------------------------------------------------------------------------- */

test.describe("K6 — trang mạch: chữ theo loại mạch", () => {
  test("chủ đề đã đóng: 'Đã đóng chủ đề' + 'Tổng kết' + link '← Chủ đề thảo luận'", async ({
    page,
  }) => {
    anChuDeSeed("Chủ đề e2e", false);
    const ds = await tatCaChuDeTheoApi();
    const tk = ds.find((m) => m.title.startsWith(TIEU_DE_DONG_TONG_KET));
    expect(tk, "seed phải có chủ đề đóng có tổng kết").toBeDefined();
    const chi_tiet = await api<MachChiTietOut>(`/api/v1/machs/${tk!.id}`);
    expect(chi_tiet.loai_mach).toBe("thao_luan");
    expect(chi_tiet.bai_hoc, "seed: chủ đề này có bai_hoc").toBeTruthy();

    await lamMoiCacheTrang(duongDan(chi_tiet));
    await page.goto(duongDan(chi_tiet));

    const chan = page.getByTestId("chan-dong-so");
    await expect(chan.getByTestId("chan-dong-so-nhan")).toHaveText("Đã đóng chủ đề");
    await expect(chan.getByTestId("chan-dong-so-ket-qua")).toHaveText(chi_tiet.ket_qua ?? "");
    const bai_hoc = chan.getByTestId("chan-dong-so-bai-hoc");
    await expect(bai_hoc).toContainText("Tổng kết");
    await expect(bai_hoc).not.toContainText("Bài học");
    await expect(bai_hoc).toContainText(chi_tiet.bai_hoc as string);
    // Chữ nhật ký KHÔNG lọt sang chủ đề.
    await expect(chan).not.toContainText("Mạch đã đóng");

    const ve = page.getByTestId("ve-chu-de");
    await expect(ve).toHaveText("← Chủ đề thảo luận");
    await expect(ve).toHaveAttribute("href", "/chu-de");
  });

  test("nhật ký đã đóng: chữ CŨ ('Mạch đã đóng' / 'Bài học'), KHÔNG có link '← Chủ đề thảo luận'", async ({
    page,
  }) => {
    const feed = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=nhat_ky&limit=50");
    const dong = feed.items.find((m) => m.status === "closed" && m.ket_qua !== null);
    expect(dong, "seed_dev phải có nhật ký đã đóng sổ có ket_qua").toBeDefined();
    const chi_tiet = await api<MachChiTietOut>(`/api/v1/machs/${dong!.id}`);
    expect(chi_tiet.loai_mach).toBe("nhat_ky");

    await lamMoiCacheTrang(duongDan(chi_tiet));
    await page.goto(duongDan(chi_tiet));
    await expect(page.getByTestId("chan-dong-so-nhan")).toHaveText("Mạch đã đóng");
    if (chi_tiet.bai_hoc) {
      const bai_hoc = page.getByTestId("chan-dong-so-bai-hoc");
      await expect(bai_hoc).toContainText("Bài học");
      await expect(bai_hoc).not.toContainText("Tổng kết");
    }
    await expect(page.getByTestId("ve-chu-de")).toHaveCount(0);
  });

  test("nhãn trên thẻ feed: chủ đề đã đóng ghi 'đã đóng' (không 'sổ'), nhật ký đã đóng vẫn 'đã đóng sổ'", async ({
    page,
  }) => {
    anChuDeSeed("Chủ đề e2e", false);
    const ds = await tatCaChuDeTheoApi();
    const tk = ds.find((m) => m.title.startsWith(TIEU_DE_DONG_TONG_KET));
    expect(tk, "seed phải có chủ đề đóng có tổng kết").toBeDefined();
    await page.goto("/?tab=moi&loai_mach=thao_luan");
    const the_chu_de = page.locator(`[data-testid="the-mach"][data-mach-id="${tk!.id}"]`);
    await expect(the_chu_de).toHaveCount(1);
    // Từ đợt B (thẻ thống nhất) nhãn là CHIP "Đã đóng" (viết hoa đầu chữ, `the-nhat-ky-trang-thai`)
    // chứ không còn là nhãn chữ thường `đã đóng`.
    await expect(the_chu_de.getByTestId("the-nhat-ky-trang-thai")).toHaveText("Đã đóng");
    const chu_chu_de = await chuNgoaiTieuDe(the_chu_de);
    expect(chu_chu_de, "chữ 'sổ' là của nhật ký").not.toMatch(/đóng sổ/i);

    const nk = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=nhat_ky&limit=20");
    const dong = nk.items.find((m) => m.status === "closed");
    expect(dong, "seed_dev phải có nhật ký đã đóng sổ trong 20 cái mới nhất").toBeDefined();
    await page.goto("/?tab=moi&loai_mach=nhat_ky");
    const the_nhat_ky = page.locator(`[data-testid="the-mach"][data-mach-id="${dong!.id}"]`);
    await expect(the_nhat_ky).toHaveCount(1);
    await expect(the_nhat_ky.getByTestId("the-nhat-ky-trang-thai")).toHaveText("Đã đóng sổ");
  });

  test("bài viết: không có link '← Chủ đề thảo luận'", async ({ page }) => {
    const feed = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=bai_viet&limit=1");
    const m = await api<MachChiTietOut>(`/api/v1/machs/${feed.items[0].id}`);
    await lamMoiCacheTrang(duongDan(m));
    await page.goto(duongDan(m));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("ve-chu-de")).toHaveCount(0);
  });
});

/* ---------------------------------------------------------------------------------------- */

const TIEU_DE_K8 = `${TIEN_TO_TAM} K8 mod đóng`; // + " 000" do `dungChuDeTam`

test.describe.serial("K8 — mod (`is_staff`) đóng / mở lại chủ đề của người khác", () => {
  let ten_mod = "";
  let id_chu_de = 0;
  let duong_chu_de = "";

  const dem_audit = () =>
    Number(
      dongCuoi(
        py(
          "from core.models import AuditLog; " +
            "print(AuditLog.objects.filter(action__in=['dong_so_chu_de','mo_lai_chu_de'], " +
            `target_id=${id_chu_de}).count())`,
        ),
      ),
    );
  const trang_thai_db = () =>
    dongCuoi(
      py(
        "from core.models import Mach; " +
          `m = Mach.objects.get(id=${id_chu_de}); print(m.status)`,
      ),
    );
  const datCoTaiKhoan = (staff: boolean, doi: boolean) =>
    py(
      "from core.models import User; " +
        `User.objects.filter(username=${JSON.stringify(ten_mod)}).update(is_staff=${staff ? "True" : "False"}, la_tai_khoan_doi=${doi ? "True" : "False"})`,
    );

  /** Mở một trang rồi CHỜ `GET /me` xong — để "không thấy nút" là kết quả của một phiên đã nạp,
   * không phải của một phiên chưa kịp nạp. */
  async function veTrang(page: Page, duong: string) {
    const me = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/v1/me" && r.request().method() === "GET",
    );
    await page.goto(duong);
    await me;
    await expect(page.getByTestId("nut-tai-khoan")).toContainText(ten_mod);
    // Cho React gắn phiên mới vào cây.
    await page.waitForTimeout(400);
  }

  test.beforeAll(() => {
    xoaChuDeTam();
    // Chủ đề riêng cho K8 — KHÔNG đụng chủ đề seed (đóng nó là phá bài đo B2 của trang chủ).
    dungChuDeTam(1, "K8 mod đóng");
    id_chu_de = Number(
      dongCuoi(
        py(
          "from core.models import Mach; " +
            `print(Mach.objects.get(title__startswith=${JSON.stringify(TIEU_DE_K8)}).id)`,
        ),
      ),
    );
  });
  test.afterAll(() => {
    if (ten_mod !== "") datCoTaiKhoan(false, false);
    xoaChuDeTam();
  });

  test("người thường và tài khoản chỉ có cờ đội: KHÔNG thấy nút; mod thấy trên chủ đề, KHÔNG thấy trên nhật ký; bấm đóng ⇒ closed + AuditLog +1; mở lại ⇒ open + AuditLog +1", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const m = (await tatCaChuDeTheoApi()).find((x) => x.id === id_chu_de);
    expect(m, "chủ đề K8 phải nằm trong feed").toBeDefined();
    duong_chu_de = `/m/${m!.slug}-${m!.id}`;

    const tk = await dungTaiKhoan(page, "k8mod");
    ten_mod = tk.username;

    // 1. Người thường (không staff, không cờ đội).
    datCoTaiKhoan(false, false);
    await veTrang(page, duong_chu_de);
    await expect(page.getByTestId("khoi-chu-mach")).toHaveCount(0);
    await expect(page.getByTestId("nut-dong-so")).toHaveCount(0);

    // 2. Tài khoản có cờ đội nhưng KHÔNG staff: API sẽ 403 ⇒ UI không bày nút.
    datCoTaiKhoan(false, true);
    await veTrang(page, duong_chu_de);
    await expect(page.getByTestId("nut-dong-so")).toHaveCount(0);

    // 3. Mod (`is_staff`): thấy nút "Đóng sổ" ở chủ đề — và CHỈ nút đó.
    datCoTaiKhoan(true, false);
    await veTrang(page, duong_chu_de);
    await expect(page.getByTestId("nut-dong-so")).toBeVisible();
    await expect(page.getByTestId("nut-noi-moc")).toHaveCount(0);
    await expect(page.getByTestId("nut-tat-mo-binh-luan")).toHaveCount(0);
    await expect(page.getByTestId("nut-chu-mach-luu-tru")).toHaveCount(0);

    // 4. Mod KHÔNG thấy nút ở NHẬT KÝ đang mở của người khác (cùng phiên đã nạp ở bước 3).
    const nk = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=nhat_ky&limit=50");
    const mo = nk.items.find((x) => x.status !== "closed" && x.author.username !== ten_mod);
    expect(mo, "seed_dev phải có nhật ký đang mở của người khác").toBeDefined();
    await veTrang(page, `/m/${mo!.slug}-${mo!.id}`);
    await expect(page.getByTestId("khoi-chu-mach")).toHaveCount(0);
    await expect(page.getByTestId("nut-dong-so")).toHaveCount(0);

    // 5. Bấm đóng bằng mod ⇒ chủ đề `closed`, AuditLog +1.
    const truoc = dem_audit();
    expect(trang_thai_db()).toBe("open");
    await veTrang(page, duong_chu_de);
    await page.getByTestId("nut-dong-so").click();
    // Nhãn form đóng của CHỦ ĐỀ: không còn chữ của nhật ký (vòng sửa 1, việc 2).
    await expect(page.getByTestId("dong-so-nhan-ket-qua")).toContainText(
      "Tóm tắt một dòng (hiện ở kho chủ đề)",
    );
    await expect(page.getByTestId("dong-so-nhan-bai-hoc")).toContainText(
      "Tổng kết (hiện ở trang chủ đề)",
    );
    await expect(page.getByTestId("form-dong-so")).not.toContainText("Mổ xẻ sau lệnh");
    await expect(page.getByTestId("form-dong-so")).not.toContainText("Bài học rút ra");
    await page.getByTestId("dong-so-ket-qua").fill("K8 xong");
    let nhac_dong = "";
    page.once("dialog", (d) => {
      nhac_dong = d.message();
      void d.accept();
    });
    await page.getByTestId("dong-so-gui").click();
    await expect.poll(trang_thai_db, { timeout: 20_000 }).toBe("closed");
    expect(dem_audit()).toBe(truoc + 1);
    expect(nhac_dong).toContain("Đóng chủ đề này?");
    expect(nhac_dong, "chủ đề không có 'nối mốc'").not.toContain("nối thêm mốc");

    // Sau khi đóng: banner đổi chữ, mod còn đúng nút "Mở lại sổ" (không tắt bình luận/lưu trữ).
    await expect(page.getByTestId("chan-dong-so-nhan")).toHaveText("Đã đóng chủ đề");
    await expect(page.getByTestId("nut-mo-lai")).toBeVisible();
    await expect(page.getByTestId("nut-tat-mo-binh-luan-dong")).toHaveCount(0);
    await expect(page.getByTestId("nut-chu-mach-luu-tru-dong")).toHaveCount(0);

    // 6. Mở lại ⇒ `open`, AuditLog +1 nữa.
    let nhac_mo_lai = "";
    page.once("dialog", (d) => {
      nhac_mo_lai = d.message();
      void d.accept();
    });
    await page.getByTestId("nut-mo-lai").click();
    await expect.poll(trang_thai_db, { timeout: 20_000 }).toBe("open");
    expect(dem_audit()).toBe(truoc + 2);
    // `mo_lai` xoá CẢ `ket_qua` lẫn `bai_hoc` (Tổng kết): hộp xác nhận phải nói đúng điều đó.
    expect(nhac_mo_lai).toContain("Mở lại chủ đề này?");
    expect(nhac_mo_lai).toContain("Tổng kết");
    expect(nhac_mo_lai).toContain("nhật ký quản trị vẫn lưu bản cũ");
  });
});

/* ---------------------------------------------------------------------------------------- */

const TIEN_TO_V4 = "Chủ đề tạm V4";

function xoaChuDeV4(): void {
  py(
    "from core.models import Mach; " +
      `Mach.objects.filter(title__startswith=${JSON.stringify(TIEN_TO_V4)}).delete()`,
  );
}

const demChuDeV4 = () =>
  Number(
    dongCuoi(
      py(
        "from core.models import Mach; " +
          `print(Mach.objects.filter(title__startswith=${JSON.stringify(TIEN_TO_V4)}).count())`,
      ),
    ),
  );

/** K9 (vòng sửa 4) — "chủ đề mới nhất" là chủ đề XUẤT BẢN sau cùng, không phải chủ đề có
 * `last_content_at` lớn nhất. Feed `moi` sắp theo `last_content_at`; nối một mốc ≥ 80 ký tự vào
 * chủ đề CŨ đẩy cột đó lên, nên chủ đề cũ chiếm đầu feed. Dựng hai chủ đề tạm: A (xuất bản 20
 * ngày trước) và B (vừa tạo), rồi nối mốc dài vào A. Dữ liệu tạm xoá sạch ở `beforeAll`/`afterAll`
 * (và `afterAll` đo lại là 0). */
test.describe.serial("K9 — chủ đề nổi và kho /chu-de theo published_at, không theo thứ tự feed", () => {
  let id_a = 0;
  let id_b = 0;

  test.beforeAll(() => {
    xoaChuDeV4();
    const ra = py(
      [
        "from datetime import timedelta",
        "from django.utils import timezone",
        "from core.ghi import tao_mach, them_moc",
        "from core.models import Mach",
        `goc = Mach.objects.get(title__startswith=${JSON.stringify(TIEU_DE_MO)})`,
        "khi_a = timezone.now() - timedelta(days=20)",
        "a, _ = tao_mach(sub=goc.sub, author=goc.author, title='Chủ đề tạm V4 A cũ',",
        "    body='Chủ đề A, xuất bản trước.', loai_mach=Mach.LoaiMach.THAO_LUAN, _created_at_seed=khi_a)",
        "b, _ = tao_mach(sub=goc.sub, author=goc.author, title='Chủ đề tạm V4 B mới',",
        "    body='Chủ đề B, vừa tạo.', loai_mach=Mach.LoaiMach.THAO_LUAN)",
        // Mốc dài ≥ 80 ký tự văn bản thuần, nối SAU khi B đã xuất bản ⇒ `last_content_at` của A > của B.
        "them_moc(mach=a, author=goc.author, body='Cập nhật dài cho chủ đề A: ' + 'nội dung đủ dài để được tính là mốc chất lượng. ' * 3)",
        "print(f'IDS {a.id} {b.id}')",
      ].join("\n"),
    );
    const m = /IDS (\d+) (\d+)/.exec(ra);
    if (m === null) throw new Error(`không dựng được chủ đề tạm: ${ra}`);
    id_a = Number(m[1]);
    id_b = Number(m[2]);
  });
  test.afterAll(() => {
    xoaChuDeV4();
    expect(demChuDeV4(), "chủ đề tạm V4 phải được xoá sạch").toBe(0);
  });

  test("tiền đề: feed limit=1 trả A (cũ), dù B xuất bản sau — đây chính là lỗi bài đo phải bắt", async () => {
    const [dau] = (await api<FeedOut>("/api/v1/feeds/moi?loai_mach=thao_luan&limit=1")).items;
    expect(dau.id, "feed `moi` đặt chủ đề cũ A (vừa được nối mốc) lên đầu").toBe(id_a);
    const nam = (await api<FeedOut>("/api/v1/feeds/moi?loai_mach=thao_luan&limit=5")).items;
    const a = nam.find((x) => x.id === id_a);
    const b = nam.find((x) => x.id === id_b);
    expect(a, "A nằm trong 5 chủ đề đầu").toBeDefined();
    expect(b, "B nằm trong 5 chủ đề đầu").toBeDefined();
    expect(Date.parse(b!.published_at), "B xuất bản SAU A").toBeGreaterThan(
      Date.parse(a!.published_at),
    );
  });

  test("trang chủ hiện B (xuất bản sau cùng), đúng MỘT thẻ, cả trong HTML thô", async ({
    page,
    request,
  }) => {
    const html = await (await request.get("/")).text();
    expect(html).toContain(`data-mach-id="${id_b}"`);
    expect(html, "A không được giành thẻ nổi").not.toContain(`data-mach-id="${id_a}"`);

    await page.goto("/");
    const the = page.getByTestId("khoi-thao-luan").getByTestId("chu-de-the");
    await expect(the).toHaveCount(1);
    await expect(the).toHaveAttribute("data-mach-id", String(id_b));
    // Giao diện mới: câu hỏi của chủ đề là `<h2>` của khối (không còn `<h3>` trong thẻ nổi).
    await expect(the.getByRole("heading", { level: 2 })).toContainText("Chủ đề tạm V4 B mới");
  });

  test("/chu-de xếp B trước A, và các nhóm tuần xếp mới → cũ", async ({ page }) => {
    await page.goto("/chu-de");
    const ids = await idsHang(page);
    expect(ids).toContain(id_a);
    expect(ids).toContain(id_b);
    expect(ids.indexOf(id_b), "B (mới) đứng trước A (cũ)").toBeLessThan(ids.indexOf(id_a));

    const tuan = await page
      .getByTestId("chu-de-tuan")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.tuan ?? ""));
    expect(tuan.length).toBeGreaterThanOrEqual(2);
    expect(tuan, "khoá tuần giảm dần").toEqual([...tuan].sort().reverse());
    // Mỗi hàng nằm trong nhóm tuần đúng với `published_at` của nó (không lệch nhóm).
    const nam = await tatCaChuDeTheoApi();
    for (const id of [id_a, id_b]) {
      const m = nam.find((x) => x.id === id)!;
      const nhom = page.locator(`[data-testid="chu-de-tuan"][data-tuan="${tuanVNCua(m.published_at).khoa}"]`);
      await expect(nhom.locator(`[data-mach-id="${id}"]`)).toHaveCount(1);
    }
  });
});
