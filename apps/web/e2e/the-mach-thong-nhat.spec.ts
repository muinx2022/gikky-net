import type { FeedOut, MachTomTatOut } from "@gikky/api-client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { dungTaiKhoan } from "./danh-tinh";
import { py } from "./thu-vien";

/** ĐỢT B — thẻ mạch thống nhất (plan `plans/2026-11-11-thong-nhat-giao-dien-toan-site.md` §4.1,
 * tiêu chí T1 + T9 phần thẻ) — chạy trên BẢN BUILD thật.
 *
 * Nguồn sự thật kỳ vọng là **API**, không phải HTML vừa render; mỗi bài đo khẳng định tập đối
 * chiếu KHÔNG rỗng trước (đối chiếu hai danh sách rỗng là đo rỗng). Dữ liệu: `seed_dev` +
 * `seed_e2e` (`e2e-thu-nghiem` có đủ ba loại; `e2e_nhieu_mach` có ≥ 20 nhật ký).
 *
 * ⚠ **Không bài nào ở đây được giả định một mạch seed CÒN nằm trên trang chủ / trang 1 của một
 * feed**: các spec chạy trước đăng thêm bài bằng tài khoản dùng một lần và đẩy chúng đi (đã làm
 * T1 bản đầu đỏ trong full-run). Gốc đo là thẻ ĐANG CÓ trên trang; chỗ cần một mạch cụ thể thì
 * tự dựng, hoặc đi qua đường chắc chắn (hồ sơ tác giả liệt kê bài của họ MỚI NHẤT trước).
 *
 * Phần đo KHÔNG cần trình duyệt (hàm `nhanNoiMoc`, vắng bóng của nút Thẻ/Gọn trong mã nguồn,
 * mọi danh sách đều dựng `TheMach`, kho theo dõi) ở `e2e/don-vi/`.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";
const SUB = "e2e-thu-nghiem";
const USER = "e2e_nhieu_mach";

async function api<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

const theTheoId = (page: Page, id: number) =>
  page.locator(`[data-testid="the-mach"][data-mach-id="${id}"]`).first();

/** Phần tử CÓ THỂ vắng trên một thẻ (theo dữ liệu / theo trang / theo người xem). Phần còn lại là
 * BỘ KHUNG — phải giống hệt trên mọi thẻ. */
const TUY_CHON = [
  "nhan-loai",
  "the-nhat-ky-bot",
  "the-nhat-ky-lenh",
  "the-nhat-ky-than",
  "the-mach-noi-moc",
  "the-mach-da-luu-tru",
  "the-mach-rieng-tu",
  "the-nhat-ky-trang-thai",
  "the-nhat-ky-theo-user",
];

/** Chữ ký cấu trúc của MỘT thẻ: mọi phần tử con theo thứ tự tài liệu, dạng `tag` hoặc
 * `tag[testid]`; heading h1–h6 quy về `h` (trang chủ truyền `capHeading=3`, chỗ khác `2` — khác
 * biệt DUY NHẤT được phép, ghi ở docstring `TheMach`).
 *
 * `khung = true` ⇒ chỉ BỘ KHUNG: bỏ các phần tử `TUY_CHON` (cả cây con), ruột avatar (ảnh thật
 * hay biểu tượng bot) và các dấu chấm ngăn `·` (đứng cạnh phần tuỳ chọn). `khung = false` ⇒ đủ
 * mọi thứ trừ nhãn loại (chỉ trang chuyên mục bật nó qua `hienNhanLoai`). */
const chuKy = (the: Locator, khung: boolean) =>
  the.evaluate(
    (li, [tuy_chon, chi_khung]) => {
      const goc = li.cloneNode(true) as Element;
      goc.querySelectorAll('[data-testid="nhan-loai"]').forEach((e) => e.remove());
      // Khung nút "Theo dõi" vắng trên thẻ của chính chủ trang hồ sơ (`anTheoDoi`) và nút bên trong
      // phụ thuộc phiên — bỏ ở cả hai chế độ.
      goc.querySelectorAll('[data-testid="the-nhat-ky-theo-user"]').forEach((e) => e.remove());
      if (chi_khung) {
        for (const id of tuy_chon as string[]) goc.querySelectorAll(`[data-testid="${id}"]`).forEach((e) => e.remove());
        goc.querySelectorAll('[data-testid="the-nhat-ky-avatar"]').forEach((e) => (e.innerHTML = ""));
        goc
          .querySelectorAll('span[aria-hidden="true"]')
          .forEach((e) => (e.textContent ?? "").trim() === "·" && e.remove());
      }
      const ra: string[] = [];
      for (const e of Array.from(goc.querySelectorAll("*"))) {
        const id = e.getAttribute("data-testid");
        const tag = /^H[1-6]$/.test(e.tagName) ? "h" : e.tagName.toLowerCase();
        ra.push(id ? `${tag}[${id}]` : tag);
      }
      return ra;
    },
    [TUY_CHON, khung] as const,
  );

test.describe("T1 — một thẻ, cùng cấu trúc ở mọi danh sách", () => {
  test("MỌI thẻ ở `/`, feed lọc, trang sub, hồ sơ có cùng BỘ KHUNG DOM (kể cả bài viết / chủ đề)", async ({
    page,
  }) => {
    const TRANG = [
      "/",
      "/?tab=moi&loai_mach=nhat_ky",
      "/?tab=moi&loai_mach=thao_luan",
      `/s/${SUB}`,
      `/s/${SUB}?loai_mach=bai_viet`,
      `/u/${USER}`,
    ];
    const kieu = new Map<string, string>();
    let tong = 0;
    for (const url of TRANG) {
      await page.goto(url);
      const the = page.getByTestId("the-mach");
      const n = await the.count();
      expect(n, `${url}: phải có thẻ`).toBeGreaterThan(0);
      for (let i = 0; i < n; i += 1) {
        const ky = (await chuKy(the.nth(i), true)).join(" ");
        if (!kieu.has(ky)) kieu.set(ky, `${url} thẻ #${i}`);
        tong += 1;
      }
    }
    expect(tong, "đo rỗng").toBeGreaterThan(30);
    expect(
      [...kieu.values()],
      `có ${kieu.size} bộ khung DOM khác nhau (nơi gặp đầu tiên của từng bộ)`,
    ).toHaveLength(1);
    expect([...kieu.keys()][0].split(" ").length, "bộ khung phải đủ lớn").toBeGreaterThan(15);
  });

  test("thẻ ĐANG CÓ trên `/` giống hệt thẻ cùng mạch ở hồ sơ tác giả (chữ ký đầy đủ)", async ({
    page,
  }) => {
    await page.goto("/");
    const trang_chu = page.getByTestId("khoi-nhat-ky").getByTestId("the-mach");
    const n = await trang_chu.count();
    expect(n, "trang chủ phải có thẻ nhật ký").toBeGreaterThan(0);
    const mau: { id: number; tac_gia: string; ky: string[] }[] = [];
    for (let i = 0; i < n; i += 1) {
      const the = trang_chu.nth(i);
      const id = Number(await the.getAttribute("data-mach-id"));
      const href = await the.locator('a[title^="u/"]').first().getAttribute("href");
      mau.push({ id, tac_gia: href!.replace(/^\/u\//, ""), ky: await chuKy(the, false) });
    }
    for (const m of mau) {
      // Hồ sơ liệt kê bài của tác giả MỚI NHẤT trước ⇒ nhật ký mới nhất của họ (thẻ trên `/`)
      // chắc chắn nằm trong trang đầu — không giả định gì về seed.
      await page.goto(`/u/${m.tac_gia}`);
      const the = theTheoId(page, m.id);
      await expect(the, `hồ sơ ${m.tac_gia} phải có mạch ${m.id}`).toBeVisible();
      expect(m.ky.length, "chữ ký rỗng là đo rỗng").toBeGreaterThan(20);
      expect(await chuKy(the, false), `mạch ${m.id}: hồ sơ khác trang chủ`).toEqual(m.ky);
    }
  });

  test("bộ testid bắt buộc có mặt trên MỌI thẻ của mọi danh sách (kể cả bài viết / chủ đề)", async ({
    page,
  }) => {
    const BAT_BUOC = [
      "cot-vote-mach",
      "the-nhat-ky-so-moc",
      "the-nhat-ky-so-binh-luan",
    ];
    for (const url of ["/", "/?tab=moi", `/s/${SUB}`, `/u/${USER}`]) {
      await page.goto(url);
      const the = page.getByTestId("the-mach");
      const n = await the.count();
      expect(n, `${url}: phải có thẻ`).toBeGreaterThan(0);
      for (let i = 0; i < n; i += 1) {
        for (const id of BAT_BUOC) {
          await expect(the.nth(i).getByTestId(id), `${url} thẻ #${i} thiếu ${id}`).toHaveCount(1);
        }
      }
    }
  });
});

test.describe("chip trạng thái theo loại", () => {
  test("bài viết: KHÔNG chip trạng thái, KHÔNG dải lệnh", async ({ page }) => {
    await page.goto(`/s/${SUB}?loai_mach=bai_viet`);
    const the = page.getByTestId("the-mach");
    expect(await the.count(), "phải có bài viết trên trang").toBeGreaterThan(0);
    await expect(page.getByTestId("the-nhat-ky-trang-thai")).toHaveCount(0);
    await expect(page.getByTestId("the-nhat-ky-lenh")).toHaveCount(0);
  });

  test("nhật ký: 'Đang mở' / 'Đã đóng sổ' khớp `status` của API", async ({ page }) => {
    const f = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=nhat_ky&limit=20");
    expect(f.items.some((m) => m.status === "closed"), "seed phải có nhật ký đã đóng").toBe(true);
    expect(f.items.some((m) => m.status !== "closed"), "seed phải có nhật ký đang mở").toBe(true);
    await page.goto("/?tab=moi&loai_mach=nhat_ky");
    for (const m of f.items) {
      const chip = theTheoId(page, m.id).getByTestId("the-nhat-ky-trang-thai");
      await expect(chip, `mạch ${m.id}`).toHaveText(m.status === "closed" ? "Đã đóng sổ" : "Đang mở");
    }
  });

  test("chủ đề thảo luận: 'Đang mở' / 'Đã đóng' — KHÔNG có chữ 'sổ'", async ({ page }) => {
    const f = await api<FeedOut>("/api/v1/feeds/moi?loai_mach=thao_luan&limit=20");
    expect(f.items.some((m) => m.status === "closed"), "seed phải có chủ đề đã đóng").toBe(true);
    expect(f.items.some((m) => m.status !== "closed"), "seed phải có chủ đề đang mở").toBe(true);
    await page.goto("/?tab=moi&loai_mach=thao_luan");
    for (const m of f.items) {
      const chip = theTheoId(page, m.id).getByTestId("the-nhat-ky-trang-thai");
      await expect(chip, `chủ đề ${m.id}`).toHaveText(m.status === "closed" ? "Đã đóng" : "Đang mở");
      expect(((await chip.textContent()) ?? "").toLowerCase(), `chủ đề ${m.id}`).not.toContain("sổ");
    }
  });

  test("trang chuyên mục: mỗi thẻ có nhãn loại, và CHỈ nhật ký / chủ đề có chip (đo từng loại)", async ({
    page,
  }) => {
    // 20 thẻ đầu của sub chỉ toàn nhật ký (nhật ký mới hơn), nên lọc theo từng loại để có đủ ba.
    for (const loai of ["nhat_ky", "bai_viet", "thao_luan"] as const) {
      const f = await api<FeedOut>(`/api/v1/feeds/moi?sub=${SUB}&loai_mach=${loai}&limit=20`);
      expect(f.items.length, `seed phải có mạch loại ${loai} ở ${SUB}`).toBeGreaterThan(0);
      await page.goto(`/s/${SUB}?loai_mach=${loai}`);
      for (const m of f.items) {
        const the = theTheoId(page, m.id);
        await expect(the.getByTestId("nhan-loai"), `mạch ${m.id}`).toHaveCount(1);
        await expect(the.getByTestId("the-nhat-ky-trang-thai"), `mạch ${m.id} (${loai})`).toHaveCount(
          loai === "bai_viet" ? 0 : 1,
        );
      }
    }
  });
});

/** Ngày giờ VN (UTC+7, không có giờ mùa hè) dạng `YYYY-MM-DD` — tính tay, KHÔNG dùng `Intl` như
 * `lib/dinh-dang.ts`, để bài đo không tự kiểm hàm của chính nó. */
const ngayVN = (iso: string) => new Date(Date.parse(iso) + 7 * 3600 * 1000).toISOString().slice(0, 10);

test.describe("'nối mốc dd/mm' trên thẻ", () => {
  test("chỉ khi ≥ 2 mốc, có mốc mới nhất đọc được và rơi vào NGÀY (giờ VN) khác ngày đăng", async ({
    page,
  }) => {
    const f = await api<FeedOut>("/api/v1/feeds/moi?limit=50");
    const mong = (m: MachTomTatOut): string | null => {
      if (m.entry_count <= 1 || !m.moc_moi_nhat) return null;
      const a = ngayVN(m.published_at);
      const b = ngayVN(m.moc_moi_nhat.created_at);
      // CHỈ khi mốc cuối SAU ngày đăng (`published_at` có thể bị dời về sau mốc: công khai / hẹn giờ).
      if (b <= a) return null;
      return `nối mốc ${b.slice(8, 10)}/${b.slice(5, 7)}`;
    };
    const co = f.items.filter((m) => mong(m) !== null);
    const khong_do_cut = f.items.filter((m) => m.entry_count > 1 && !m.moc_moi_nhat);
    expect(co.length, "seed phải có ≥ 1 mạch cần dòng 'nối mốc'").toBeGreaterThan(0);
    expect(
      khong_do_cut.length,
      "seed phải có ≥ 1 mạch nhiều mốc mà mốc cuối KHÔNG đạt chuẩn (không được in ngày của nó)",
    ).toBeGreaterThan(0);

    // `/?tab=moi` bày 20 thẻ đầu; kiểm những mạch của `f` nằm trong đó.
    await page.goto("/?tab=moi");
    const tren_trang = new Set(
      await page.getByTestId("the-mach").evaluateAll((l) => l.map((e) => Number((e as HTMLElement).dataset.machId))),
    );
    let da_do = 0;
    for (const m of f.items.filter((x) => tren_trang.has(x.id))) {
      const o = theTheoId(page, m.id).getByTestId("the-mach-noi-moc");
      const ky = mong(m);
      if (ky === null) await expect(o, `mạch ${m.id}: không được có dòng nối mốc`).toHaveCount(0);
      else {
        await expect(o, `mạch ${m.id}`).toHaveText(ky);
        da_do += 1;
      }
    }
    expect(da_do, "đo rỗng: không thẻ nào có dòng nối mốc trong 20 thẻ đầu").toBeGreaterThan(0);
  });
});

test.describe("hết nút Thẻ / Gọn", () => {
  test("không còn `chon-kieu-xem`, `kieu-xem-*` hay `data-kieu-xem` ở feed, trang sub, hồ sơ", async ({
    page,
  }) => {
    for (const url of ["/?tab=moi", `/s/${SUB}`, `/u/${USER}`]) {
      // Người dùng cũ còn `gikky:kieu-xem=gon` trong localStorage: giá trị rác đó không được
      // làm gì nữa (không script nào đọc nó).
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem("gikky:kieu-xem", "gon");
        } catch {
          /* trình duyệt chặn localStorage — không sao */
        }
      });
      await page.goto(url);
      await expect(page.getByTestId("chon-kieu-xem"), url).toHaveCount(0);
      await expect(page.getByTestId("kieu-xem-gon"), url).toHaveCount(0);
      await expect(page.getByTestId("kieu-xem-the"), url).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.hasAttribute("data-kieu-xem")), url).toBe(false);
    }
  });
});

test.describe("T9 — mobile 390px: thẻ không tràn ngang, vùng bấm chân thẻ ≥ 44px", () => {
  for (const url of ["/", "/?tab=moi", `/s/${SUB}`, `/u/${USER}`]) {
    test(url, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await kiemThe390(page, 6);
    });
  }

  test("thẻ nhiều huy hiệu nhất mà một trang thật dựng được (🔒 riêng tư + 📦 lưu trữ + chip 'Đã đóng sổ') vẫn gọn", async ({
    page,
  }) => {
    // Bốn nhãn cùng lúc (nhãn loại + lưu trữ + riêng tư + chip) KHÔNG dựng được trên trang thật:
    // nhãn loại chỉ có ở `/s/<sub>` (danh sách công khai — không có mạch riêng tư / lưu trữ), còn
    // 🔒 và 📦 chỉ có ở tab hồ sơ của CHÍNH chủ (không có nhãn loại). Ca nặng nhất là ba huy hiệu
    // ở tab Lưu trữ của chính chủ — dựng nó ở đây.
    const ai = await dungTaiKhoan(page, "e2e_ba");
    py(
      [
        "from django.utils import timezone",
        "from core.ghi import dat_luu_tru_mach, dong_so, tao_mach",
        "from core.models import Mach, Sub, User",
        `u = User.objects.get(username=${JSON.stringify(ai.username)})`,
        "sub = Sub.objects.get(slug='e2e-thu-nghiem')",
        "m, _ = tao_mach(sub=sub, author=u, loai_mach=Mach.LoaiMach.NHAT_KY,",
        "    title='Nhật ký ba huy hiệu: riêng tư, đã lưu trữ, đã đóng sổ — tiêu đề dài để thử xuống dòng',",
        "    body='Nội dung thử.', occurred_at=None, loai=None, rieng_tu=True)",
        "dong_so(mach=m, ket_qua='+1%', bai_hoc='x', khi=timezone.now())",
        "dat_luu_tru_mach(mach=m, boi=u, luu_tru=True)",
        "",
      ].join("\n"),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/u/${ai.username}?tab=luu-tru`);
    const the = page.getByTestId("the-mach").first();
    await expect(the).toBeVisible();
    await expect(the.getByTestId("the-mach-da-luu-tru")).toHaveCount(1);
    await expect(the.getByTestId("the-mach-rieng-tu")).toHaveCount(1);
    await expect(the.getByTestId("the-nhat-ky-trang-thai")).toHaveText("Đã đóng sổ");
    await kiemThe390(page, 1);
    // Tên tác giả không bị ba huy hiệu bóp thành 0 (còn đọc được).
    const ten = await the.locator('a[title^="u/"]').first().boundingBox();
    expect(ten!.width, "tên bị huy hiệu bóp").toBeGreaterThan(40);
  });
});

/** Trang không tràn ngang, mọi thẻ trong khung nhìn, và chân `n` thẻ đầu có vùng bấm ≥ 44px. Hộp
 * `null` (không dựng ra) là LỖI, không phải "bỏ qua". */
async function kiemThe390(page: Page, n_toi_da: number): Promise<void> {
  const rong = await page.evaluate(() => ({
    cuon: document.documentElement.scrollWidth,
    khung: window.innerWidth,
  }));
  expect(rong.cuon, JSON.stringify(rong)).toBeLessThanOrEqual(rong.khung);

  // Từng thẻ nằm trọn trong chiều ngang màn hình (một dòng huy hiệu dài không được đẩy thẻ ra
  // ngoài mà `scrollWidth` của trang vẫn lọt qua nhờ `overflow-x: clip` ở đâu đó).
  const ngoai = await page
    .getByTestId("the-mach")
    .evaluateAll(
      (l) =>
        l
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.right > window.innerWidth + 0.5 || r.left < -0.5).length,
    );
  expect(ngoai, "thẻ lọt ra ngoài màn hình").toBe(0);

  const the = page.getByTestId("the-mach");
  const n = Math.min(await the.count(), n_toi_da);
  expect(n, "phải có thẻ").toBeGreaterThan(0);
  const thap: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = the.nth(i);
    for (const [ten, loc] of [
      ["mốc", t.getByTestId("the-nhat-ky-so-moc")],
      ["bình luận", t.getByTestId("the-nhat-ky-so-binh-luan")],
      ["chia sẻ", t.getByRole("button", { name: /chia sẻ/i })],
      ["vote lên", t.getByTestId("mui-ten-len")],
      ["vote xuống", t.getByTestId("mui-ten-xuong")],
    ] as const) {
      const b = await loc.first().boundingBox();
      if (b === null) {
        thap.push(`thẻ ${i} ${ten}: không có hộp`);
        continue;
      }
      if (b.height < 43.5 || b.width < 43.5) {
        thap.push(`thẻ ${i} ${ten}: ${Math.round(b.width)}×${Math.round(b.height)}`);
      }
    }
  }
  expect(thap, `vùng bấm < 44px / thiếu hộp: ${thap.join(" · ")}`).toEqual([]);
}

test.describe("link ảnh, avatar và huy hiệu '+N' của thẻ", () => {
  test("link ảnh + link avatar là `aria-hidden` và ra khỏi vòng Tab; '+N' khớp `so_anh - 1` và là `aria-hidden`", async ({
    page,
  }) => {
    const f = await api<FeedOut>(`/api/v1/feeds/moi?sub=${SUB}&loai_mach=bai_viet&limit=20`);
    const co_anh = f.items.filter((m) => m.xem_truoc?.anh);
    const nhieu = co_anh.filter((m) => (m.xem_truoc?.so_anh ?? 0) > 1);
    const mot = co_anh.filter((m) => m.xem_truoc?.so_anh === 1);
    expect(nhieu.length, "seed phải có bài viết nhiều ảnh trong 20 thẻ đầu").toBeGreaterThan(0);
    expect(mot.length, "seed phải có bài viết đúng MỘT ảnh trong 20 thẻ đầu").toBeGreaterThan(0);
    await page.goto(`/s/${SUB}?loai_mach=bai_viet`);

    for (const m of co_anh) {
      const the = theTheoId(page, m.id);
      const anh = the.getByTestId("the-nhat-ky-anh");
      await expect(anh, `mạch ${m.id}`).toHaveAttribute("aria-hidden", "true");
      await expect(anh, `mạch ${m.id}`).toHaveAttribute("tabindex", "-1");
      const them = the.getByTestId("the-mach-them-anh");
      const so = (m.xem_truoc?.so_anh ?? 1) - 1;
      if (so > 0) {
        await expect(them, `mạch ${m.id}`).toHaveText(`+${so}`);
        await expect(them, `mạch ${m.id}`).toHaveAttribute("aria-hidden", "true");
        // Nằm TRONG khung ảnh (không tràn ra ngoài).
        const k = await anh.boundingBox();
        const b = await them.boundingBox();
        expect(b!.x).toBeGreaterThanOrEqual(k!.x - 0.5);
        expect(b!.x + b!.width).toBeLessThanOrEqual(k!.x + k!.width + 0.5);
        expect(b!.y + b!.height).toBeLessThanOrEqual(k!.y + k!.height + 0.5);
      } else {
        await expect(them, `mạch ${m.id}: một ảnh thì không có +N`).toHaveCount(0);
      }
    }
    // Link avatar cũng ẩn khỏi cây trợ năng và vòng Tab (cùng đích với link tên).
    const av = page.getByTestId("the-nhat-ky-avatar");
    expect(await av.count()).toBeGreaterThan(0);
    for (let i = 0; i < (await av.count()); i += 1) {
      await expect(av.nth(i)).toHaveAttribute("aria-hidden", "true");
      await expect(av.nth(i)).toHaveAttribute("tabindex", "-1");
    }
  });
});

test.describe("khoảng cách giữa các thẻ", () => {
  test("chỗ nối trang 1 ↔ trang cuộn thêm bằng khoảng cách giữa hai thẻ bất kỳ", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/?tab=moi");
    const the_goc = await page.locator('[data-testid="feed"] > [data-testid="the-mach"]').count();
    expect(the_goc, "trang 1 phải đủ thẻ để có trang 2").toBeGreaterThanOrEqual(20);
    // Cuộn tới cuối cho tới khi trang nối thêm xuất hiện.
    await expect(async () => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      expect(
        await page.locator('[data-testid="feed-them"] > [data-testid="the-mach"]').count(),
      ).toBeGreaterThan(0);
    }).toPass({ timeout: 15_000 });

    const hop = await page.getByTestId("the-mach").evaluateAll((l) =>
      l.map((e) => {
        const r = e.getBoundingClientRect();
        return {
          tren: r.top + window.scrollY,
          duoi: r.bottom + window.scrollY,
          them: !!e.closest('[data-testid="feed-them"]'),
        };
      }),
    );
    expect(hop.length).toBeGreaterThan(the_goc);
    const khoang = hop.slice(1).map((h, i) => Math.round((h.tren - hop[i].duoi) * 10) / 10);
    const noi = hop.findIndex((h) => h.them) - 1;
    expect(noi, "phải có chỗ nối").toBeGreaterThan(0);
    const thuong = khoang.filter((_, i) => i !== noi);
    expect(Math.min(...thuong), "khoảng giữa hai thẻ cùng trang").toBeGreaterThan(5);
    for (const [i, k] of khoang.entries()) {
      expect(k, `khoảng giữa thẻ ${i} và ${i + 1}${i === noi ? " (CHỖ NỐI)" : ""}`).toBeCloseTo(
        thuong[0],
        0,
      );
    }
  });
});

test.describe("nút Theo dõi tác giả: một kho, một lời gọi mỗi tác giả", () => {
  const RE_ME = /\/api\/v1\/users\/([^/?]+)\/me(\?|$)/;

  test("đã đăng nhập: ≤ 1 lời gọi /users/{u}/me mỗi tác giả HIỂN THỊ, đồng bộ giữa các thẻ, không gọi ở mobile, hồ sơ không lệch", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await dungTaiKhoan(page, "e2e_td");
    // Sang trang tĩnh (không thẻ nào) để các lời gọi của trang sau đăng nhập không lọt vào số đếm:
    // kho sống theo TRANG TẢI (module), nên mỗi lần `goto` đầy đủ là một kho mới.
    await page.goto("/luat");
    const goi: string[] = [];
    page.on("request", (r) => {
      const m = RE_ME.exec(r.url());
      if (m && r.method() === "GET") goi.push(decodeURIComponent(m[1]));
    });

    // --- desktop: feed ---
    await page.setViewportSize({ width: 1280, height: 900 });
    // Trang chuyên mục: các thẻ của CÙNG một tác giả đứng liền nhau và cùng nằm trong khung nhìn —
    // đúng ca mà không có kho thì mỗi thẻ bắn một lời gọi (ở `/?tab=moi` các thẻ đầu khác tác giả
    // nên bài đo không phân biệt được).
    await page.goto(`/s/${SUB}`);
    await expect(page.getByTestId("nut-theo-user").first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    const tac_gia = await page
      .getByTestId("the-mach")
      .locator('a[title^="u/"]')
      .evaluateAll((l) => l.map((e) => (e.getAttribute("href") ?? "").replace("/u/", "")));
    const duy_nhat = new Set(tac_gia);
    const so_the = await page.getByTestId("the-mach").count();
    expect(
      duy_nhat.size,
      "đo rỗng: trang phải có tác giả trùng nhau (kho mới có gì để dedupe)",
    ).toBeLessThan(so_the);
    expect(goi.length, "phải có lời gọi (không thì nút không bao giờ hiện)").toBeGreaterThan(0);
    expect(new Set(goi).size, `tác giả bị hỏi nhiều lần: ${goi.join(",")}`).toBe(goi.length);
    expect(goi.length, `${goi.length} lời gọi cho ${duy_nhat.size} tác giả`).toBeLessThanOrEqual(
      duy_nhat.size,
    );
    for (const u of goi) expect(duy_nhat.has(u), `${u} không có thẻ nào trên trang`).toBe(true);

    // --- đồng bộ: bấm ở một thẻ ⇒ mọi thẻ cùng tác giả đổi theo ---
    const dem: Record<string, number> = {};
    for (const u of tac_gia) dem[u] = (dem[u] ?? 0) + 1;
    const lap = Object.keys(dem).find((u) => dem[u] > 1);
    expect(lap, "phải có tác giả có ≥ 2 thẻ trên trang").toBeDefined();
    const cua = page.locator('[data-testid="the-mach"]', {
      has: page.locator(`a[href="/u/${lap}"]`),
    });
    expect(await cua.count()).toBeGreaterThan(1);
    // Cuộn tới thẻ đầu của tác giả ấy: nút chỉ hỏi API khi tới gần khung nhìn.
    await cua.first().scrollIntoViewIfNeeded();
    const nut = cua.first().getByTestId("nut-theo-user");
    await expect(nut).toBeVisible({ timeout: 15_000 });
    await expect(nut).toHaveAttribute("aria-pressed", "false");
    await nut.click();
    for (let i = 0; i < (await cua.count()); i += 1) {
      await expect(
        cua.nth(i).getByTestId("nut-theo-user"),
        `thẻ ${i} của ${lap}`,
      ).toHaveAttribute("aria-pressed", "true");
    }
    // Bấm lại ở thẻ KHÁC ⇒ cả nhóm về như cũ.
    await cua.nth(1).getByTestId("nut-theo-user").click();
    for (let i = 0; i < (await cua.count()); i += 1) {
      await expect(cua.nth(i).getByTestId("nut-theo-user")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }

    // --- hồ sơ: thẻ của chính chủ trang KHÔNG có nút; header có đúng MỘT nút, bấm không lệch ---
    await page.goto(`/u/${USER}`);
    const header = page.getByTestId("nut-theo-user");
    await expect(header).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("the-mach").first()).toBeVisible();
    await expect(page.getByTestId("the-mach").getByTestId("nut-theo-user")).toHaveCount(0);
    await header.click();
    await expect(header).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("nut-theo-user")).toHaveCount(1);
    await header.click();
    await expect(header).toHaveAttribute("aria-pressed", "false");

    // --- mobile: nút bị CSS ẩn ⇒ KHÔNG gọi API ---
    goi.length = 0;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?tab=moi");
    await expect(page.getByTestId("the-mach").first()).toBeVisible();
    await page.waitForTimeout(1500);
    expect(goi, "mobile ẩn nút Theo dõi nhưng vẫn gọi API").toEqual([]);
  });
});
