import { expect, test, type Page } from "@playwright/test";

import { dungTaiKhoan } from "./danh-tinh";
import { TITLE_HPG, USER_NHIEU_MACH, duongDan, hoSo, timMachTheoTitle } from "./du-lieu";
import { py } from "./thu-vien";

/** ĐỢT M (việc 16) — giao diện mobile toàn site ở 390×844, trên BẢN BUILD thật
 * (plan `plans/2026-11-12-sua-mobile.md` §5, tiêu chí T1, T2, T5).
 *
 * ## Máy đo (T1) — `doTrang` chạy TRONG trang
 *
 * Bốn nhóm, mỗi nhóm có ngưỡng riêng và mỗi trang phải đo được > 0 phần tử của nhóm ấy (một bài đo
 * không tìm thấy gì để đo là bài đo rỗng, không phải bài đo xanh):
 *
 * 1. **Ô nhập** (`input` trừ checkbox/radio/ẩn/nút, `select`, `textarea`, `[contenteditable]`): cỡ
 *    chữ ≥ 16px — dưới đó iOS Safari tự phóng to trang khi chạm vào ô.
 * 2. **Nút** (`button`, `[role=button]`, `[role=tab]`, `summary`, `select`, nhãn của checkbox/radio, và
 *    link TRÔNG như nút — có nền hoặc viền đủ bốn cạnh): vùng bấm THẬT cao ≥ 44px.
 * 3. **Link chữ** (mọi link còn lại — tên tác giả, `s/sub`, chân trang…): vùng bấm THẬT cao ≥ 24px
 *    (WCAG 2.5.8).
 *    "Vùng bấm thật" của nhóm 2 + 3 = số px trúng chính phần tử khi quét `elementFromPoint` dọc tâm ngang
 *    của nó — không phải chiều cao hộp (xem `caoThat`).
 *    Link nằm GIỮA một câu văn (`p`/`li`/`blockquote`… có chữ khác ngoài link) được miễn, đúng như
 *    ngoại lệ "inline" của chính WCAG.
 * 4. **Bị che**: ở 4 vị trí cuộn, `elementFromPoint` tại tâm điều khiển. Xem `kiemChe`.
 *
 * Bỏ qua phần tử `aria-hidden`/`tabindex=-1` (link trùng để trang trí — avatar, ảnh nhỏ: đích của
 * nó đã có link chữ khác) và phần tử vô hình (`checkVisibility` có xét `opacity`).
 *
 * ## Allowlist — giữ NHỎ, mỗi mục một lý do
 *
 * Khoá là tên đo được (`data-testid` → `aria-label` → chữ). Một mục mới phải có lý do mà người đọc
 * allowlist đồng ý được; "cho xanh" không phải lý do.
 */

const KHO = { width: 390, height: 844 };
test.use({ viewport: KHO, isMobile: true, hasTouch: true, colorScheme: "dark" });

/** Tên (đã chuẩn hoá) → lý do được miễn. */
const ALLOWLIST: Readonly<Record<string, string>> = {};

type Do = {
  sw: number;
  vw: number;
  oNhap: { ten: string; co: number }[];
  nut: { ten: string; cao: number }[];
  link: { ten: string; cao: number }[];
  soONhap: number;
  soNut: number;
  soLink: number;
  matCach: string[];
};

/** Chạy trong trang. `phamVi` = selector giới hạn vùng đo (ngăn kéo / sheet), hoặc null = cả trang. */
function doTrang(phamVi: string | null): Do {
  const goc: Element = (phamVi ? document.querySelector(phamVi) : document.body) ?? document.body;
  const ten = (el: Element) =>
    (
      el.getAttribute("data-testid") ||
      el.getAttribute("aria-label") ||
      (el as HTMLElement).innerText ||
      (el as HTMLInputElement).value ||
      el.getAttribute("placeholder") ||
      el.tagName
    )
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\d+/g, "#")
      .slice(0, 40);
  const thay = (el: Element) => {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const boQua = (el: Element) =>
    el.closest('[aria-hidden="true"]') !== null || el.getAttribute("tabindex") === "-1";

  const oNhap: Do["oNhap"] = [];
  let soONhap = 0;
  goc.querySelectorAll('input, select, textarea, [contenteditable="true"]').forEach((el) => {
    if (el instanceof HTMLInputElement && /^(checkbox|radio|hidden|file|submit|button|reset|range|color)$/.test(el.type)) return;
    if (!thay(el)) return;
    soONhap += 1;
    const co = parseFloat(getComputedStyle(el).fontSize);
    if (co < 16) oNhap.push({ ten: ten(el), co });
  });

  const nut: Do["nut"] = [];
  const link: Do["link"] = [];
  let soNut = 0;
  let soLink = 0;
  const daDo = new Set<Element>();
  // Vùng bấm THẬT, không phải hộp: cuộn phần tử ra giữa khung nhìn rồi quét `elementFromPoint` dọc theo
  // tâm ngang của nó (30px trên + dưới hộp), đếm số px trúng chính nó. Bắt được cả hai chiều sai mà đo
  // hộp không thấy: vùng nới bằng `::after` (hộp nhỏ, vùng bấm đủ) và hai vùng nới chồng nhau (hộp đủ,
  // nhưng nửa dưới bị phần tử sau trong DOM đè — bấm vào đó là trúng thứ khác).
  const y0 = scrollY;
  const caoThat = (dich: Element): number => {
    dich.scrollIntoView({ block: "center", inline: "nearest" });
    const r = dich.getBoundingClientRect();
    const x = r.left + r.width / 2;
    let trung = 0;
    for (let y = Math.floor(r.top - 30); y <= Math.ceil(r.bottom + 30); y += 1) {
      if (y < 0 || y >= innerHeight) continue;
      const t = document.elementFromPoint(x, y);
      if (t !== null && dich.contains(t)) trung += 1;
    }
    return trung;
  };
  const doNut = (el: Element, dich: Element) => {
    if (daDo.has(dich)) return;
    daDo.add(dich);
    soNut += 1;
    const cao = caoThat(dich);
    if (cao < 43.5) nut.push({ ten: ten(el), cao });
  };

  goc
    .querySelectorAll('button, [role="button"], [role="tab"], summary, select, input[type="checkbox"], input[type="radio"], input[type="file"], input[type="submit"]')
    .forEach((el) => {
      if (el instanceof HTMLInputElement && /^(checkbox|radio|file)$/.test(el.type)) {
        // Ô chọn + ô file đo bằng NHÃN của nó — vùng bấm thật. Ô có thể bị ẩn (ô file luôn ẩn, nút "Chọn
        // ảnh…" là nhãn của nó); nhãn thì không.
        const nhan = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
        if (nhan !== null && thay(nhan) && !boQua(nhan)) return doNut(el, nhan);
        if (!thay(el) || boQua(el)) return;
        return doNut(el, el);
      }
      if (!thay(el) || boQua(el)) return;
      if (el.tagName === "A") return; // `a[role=button|tab]` đi đường link bên dưới
      doNut(el, el);
    });

  goc.querySelectorAll("a[href]").forEach((a) => {
    if (!thay(a) || boQua(a)) return;
    const cs = getComputedStyle(a);
    const role = a.getAttribute("role");
    const coNen = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
    const coVien = ["Top", "Right", "Bottom", "Left"].every(
      (c) => parseFloat(cs.getPropertyValue(`border-${c.toLowerCase()}-width`)) > 0,
    );
    if (role === "button" || role === "tab" || coNen || coVien) return doNut(a, a);
    if (cs.display === "inline") {
      const khoi = a.closest("p, li, blockquote, td, dd, figcaption");
      const chuNgoai = khoi ? (khoi.textContent ?? "").length - (a.textContent ?? "").length : 0;
      if (chuNgoai > 3) return; // link giữa câu văn — ngoại lệ inline của WCAG 2.5.8
    }
    soLink += 1;
    const cao = caoThat(a);
    if (cao < 23.5) link.push({ ten: ten(a), cao });
  });
  window.scrollTo(0, y0);

  // Khoảng trắng bị NUỐT trong điều khiển ("💬 2 bình luận" hiện thành "2bình luận"): một luật
  // `display: (inline-)flex|grid` biến từng mảnh chữ/inline thành hộp riêng và bỏ dấu cách giữa chúng.
  // Đo bằng BỐ CỤC, không bằng `innerText` (Chrome trả "💬\n2\nbình luận" cho item flex — trông như
  // còn khoảng trắng): hai mảnh chữ liền nhau trên cùng một dòng mà DOM có khoảng trắng giữa chúng thì
  // trên màn hình phải cách nhau ≥ 2px.
  const matCach: string[] = [];
  goc.querySelectorAll('a[href], button, summary, label, [role="button"]').forEach((el) => {
    if (!thay(el)) return;
    const manh: { tho: string; r: DOMRect }[] = [];
    let cachTreo = false; // một nút chữ chỉ có khoảng trắng nằm giữa hai mảnh
    const di = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = di.nextNode() as Text | null; n !== null; n = di.nextNode() as Text | null) {
      const tho = n.data;
      const dau = tho.search(/\S/);
      if (dau < 0) {
        if (manh.length > 0 && tho.length > 0) cachTreo = true;
        continue;
      }
      const cuoi = tho.length - (tho.match(/\s*$/)?.[0].length ?? 0);
      const rg = document.createRange();
      rg.setStart(n, dau);
      rg.setEnd(n, cuoi);
      const r = rg.getBoundingClientRect();
      if (r.width === 0) continue; // mảnh bị ẩn
      const truoc = manh.at(-1);
      if (truoc !== undefined) {
        const coCach = cachTreo || /\s$/.test(truoc.tho) || /^\s/.test(tho);
        const cungDong = Math.abs(r.top + r.height / 2 - (truoc.r.top + truoc.r.height / 2)) < 4;
        if (coCach && cungDong && r.left - truoc.r.right < 2) {
          matCach.push(`"${(el.textContent ?? "").replace(/\s+/g, " ").trim()}": "${truoc.tho.trim()}"|"${tho.trim()}" dính nhau`);
        }
      }
      manh.push({ tho, r });
      cachTreo = false;
    }
  });

  return {
    sw: document.documentElement.scrollWidth,
    vw: innerWidth,
    oNhap,
    nut,
    link,
    soONhap,
    soNut,
    soLink,
    matCach,
  };
}

/** Chạy trong trang: điều khiển nào đang bị phần tử `fixed`/`sticky` khác đè?
 *
 * - Điều khiển TỰ nó nằm trong một lớp `fixed`/`sticky` (nút dính đáy, nút về đầu trang, chính thanh
 *   cài app, header): KHÔNG BAO GIỜ được bị đè, ở mọi vị trí cuộn.
 * - Điều khiển trong luồng: ở CUỐI trang không được bị lớp dính ĐÁY đè (đúng lỗi M1 — trang không chừa
 *   chỗ nên cuộn hết cỡ vẫn nằm dưới thanh); ở ĐẦU trang không được bị lớp dính ĐỈNH đè. Ngoài hai
 *   chỗ đó, nội dung trôi dưới header / thanh đáy là hành vi cuộn bình thường — cuộn thêm là thấy —
 *   nên không tính (vd ở cuộn 0, dòng cuối của khung nhìn nằm dưới thanh đáy là chuyện tất nhiên).
 */
function kiemChe({ viTri, phamVi }: { viTri: "dau" | "giua" | "cuoi"; phamVi: string | null }): string[] {
  const goc: Element = (phamVi ? document.querySelector(phamVi) : document.body) ?? document.body;
  const lopDinh = (el: Element): Element | null => {
    for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === "fixed" || pos === "sticky") return p;
    }
    return null;
  };
  const ten = (el: Element) =>
    (el.getAttribute("data-testid") || el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.tagName)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
  const ra: string[] = [];
  goc.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"], [role="tab"]').forEach((el) => {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return;
    if (el.closest('[aria-hidden="true"]') || el.getAttribute("tabindex") === "-1") return;
    if (getComputedStyle(el).pointerEvents === "none") return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return;
    const t = document.elementFromPoint(x, y);
    if (t === null || el.contains(t) || t.contains(el)) return;
    // Nhãn bọc ô chọn: bấm trúng nhãn = bấm trúng ô.
    if (t.closest("label") !== null && t.closest("label")?.contains(el)) return;
    const deMinh = lopDinh(el);
    const deLen = lopDinh(t);
    if (deLen === null) return; // bị một phần tử trong luồng phủ — không phải chuyện của đợt này
    if (deMinh !== null && deMinh === deLen) return;
    const deDay = deLen.getBoundingClientRect().top > innerHeight / 2;
    const tinh = deMinh !== null || (viTri === "dau" && !deDay) || (viTri === "cuoi" && deDay);
    if (tinh) ra.push(`${ten(el)} ⟵ ${ten(deLen)}`);
  });
  return ra;
}

/** Chạy trong trang: thẻ mạch ở 390px (M4, M5) — chân thẻ MỘT hàng; mỗi cụm của dòng meta (ngày, "nối
 * mốc", `s/sub`, tên) không bị bẻ giữa chữ (một cụm = một hộp dòng). Trả số thẻ đã đo + lỗi. */
function kiemThe(): { so: number; loi: string[] } {
  const loi: string[] = [];
  let so = 0;
  document.querySelectorAll('[data-testid="the-mach"]').forEach((the) => {
    if (!the.checkVisibility()) return;
    so += 1;
    const tieuDe = (the.querySelector("h2, h3")?.textContent ?? "").trim().slice(0, 30);
    const chan = the.querySelector('[data-testid="the-nhat-ky-so-moc"]')?.parentElement;
    if (chan) {
      // Một hàng = mọi con có cùng TÂM dọc (các con cao khác nhau: pill vote 28px, nút 44px, canh giữa).
      const tam = [...chan.children]
        .filter((c) => c.checkVisibility() && c.getBoundingClientRect().width > 0)
        .map((c) => {
          const r = c.getBoundingClientRect();
          return r.top + r.height / 2;
        });
      if (Math.max(...tam) - Math.min(...tam) > 4) loi.push(`chân thẻ xuống dòng: "${tieuDe}"`);
    }
    the.querySelectorAll('a[href^="/s/"], a[href^="/u/"]:not([tabindex="-1"]), time, [data-testid="the-mach-noi-moc"]').forEach((el) => {
      if (el.closest('[data-testid="the-nhat-ky-so-moc"]')) return;
      if ([...el.getClientRects()].filter((r) => r.width > 1).length > 1) loi.push(`meta bị bẻ giữa chữ: "${(el.textContent ?? "").trim()}" ở "${tieuDe}"`);
      // Cụm không bị bẻ thì phải XUỐNG DÒNG nguyên cụm, không được tràn khỏi dòng meta (chui dưới chip
      // trạng thái bên phải) — ca "khoá nowrap cả dấu ngăn" làm cả dòng thành một khối liền.
      const hop = el.parentElement?.getBoundingClientRect();
      if (hop && el.getBoundingClientRect().right > hop.right + 1) loi.push(`meta tràn khỏi dòng: "${(el.textContent ?? "").trim()}" ở "${tieuDe}"`);
    });
  });
  return { so, loi };
}

/** Đo một trang đã nạp: T1 đủ bốn nhóm. `coONhap` = trang có form (đòi > 0 ô nhập). */
async function kiemTrang(
  page: Page,
  nhan: string,
  { coONhap = false, phamVi = null as string | null, cuon = true } = {},
) {
  const d = await page.evaluate(doTrang, phamVi);
  const loc = <T extends { ten: string }>(xs: T[]) => xs.filter((x) => !(x.ten in ALLOWLIST));
  const loi: string[] = [];
  // Tràn ngang dừng NGAY: trang rộng hơn khung thì trình duyệt di động thu nhỏ cả trang, mọi số đo
  // phía sau (cao nút, bị che) đo trên một trang đã bị co — và một cú bấm sau đó có thể trượt.
  expect(d.sw, `${nhan}: tràn ngang (scrollWidth)`).toBeLessThanOrEqual(KHO.width);
  for (const x of loc(d.oNhap)) loi.push(`ô nhập < 16px: ${x.ten} (${x.co}px)`);
  for (const x of loc(d.nut)) loi.push(`nút < 44px: ${x.ten} (${x.cao}px)`);
  for (const x of loc(d.link)) loi.push(`link < 24px: ${x.ten} (${x.cao}px)`);
  for (const x of d.matCach) loi.push(`mất dấu cách: ${x}`);

  if (phamVi === null) {
    const the = await page.evaluate(kiemThe);
    loi.push(...the.loi);
  }

  if (cuon) {
    const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const cacViTri: Array<["dau" | "giua" | "cuoi", number]> = [
      ["dau", 0],
      ["giua", Math.round(H / 3)],
      ["giua", Math.round((2 * H) / 3)],
      ["cuoi", H],
    ];
    for (const [viTri, y] of cacViTri) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(350);
      if (viTri === "cuoi") {
        // Feed cuộn vô hạn: chạm đáy là nạp thêm trang. Cuộn tới khi trang thôi dài ra (tối đa 8 lượt)
        // để "cuối" là cuối THẬT — chân trang, không phải đáy tạm của trang feed thứ nhất.
        for (let i = 0; i < 8; i += 1) {
          const truoc = await page.evaluate(() => document.documentElement.scrollHeight);
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(700);
          if ((await page.evaluate(() => document.documentElement.scrollHeight)) === truoc) break;
        }
      }
      for (const x of await page.evaluate(kiemChe, { viTri, phamVi })) {
        loi.push(`bị che @${viTri}(${y}): ${x}`);
      }
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  } else {
    for (const x of await page.evaluate(kiemChe, { viTri: "dau" as const, phamVi })) {
      loi.push(`bị che: ${x}`);
    }
  }

  expect(d.soNut, `${nhan}: đo được 0 nút — bài đo rỗng`).toBeGreaterThan(0);
  if (phamVi === null) expect(d.soLink, `${nhan}: đo được 0 link chữ — bài đo rỗng`).toBeGreaterThan(0);
  if (coONhap) expect(d.soONhap, `${nhan}: trang form mà 0 ô nhập — bài đo rỗng`).toBeGreaterThan(0);
  return [...new Set(loi)].map((x) => `${nhan}: ${x}`);
}

/** Điều kiện hiện của thanh cài app (`goi-y-cai-app.tsx::kiemTraDiDong`) có thật ở ngữ cảnh này —
 * nếu không, mọi phép "bị che" ở dưới đo trên một trang KHÔNG có thanh và xanh vô nghĩa. */
async function thanhCaiAppHien(page: Page) {
  const dk = await page.evaluate(() => ({
    cham: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    rong: innerWidth,
    standalone: matchMedia("(display-mode: standalone)").matches,
    daTat: (() => {
      try {
        return localStorage.getItem("gikky_an_goi_y_cai_app");
      } catch {
        return "loi";
      }
    })(),
  }));
  expect(dk, "điều kiện hiện thanh cài app").toEqual({ cham: true, rong: 390, standalone: false, daTat: null });
  await expect(page.getByTestId("banner-cai-app")).toBeVisible();
}

async function moi(page: Page, url: string) {
  const r = await page.goto(url, { waitUntil: "load" });
  expect(r?.status(), url).toBeLessThan(url.includes("khong-ton-tai") ? 500 : 400);
  // Đợi hydrate + `useEffect` của thanh cài app.
  await page.waitForTimeout(800);
}

/* ===================================================================== T1 · trang khách */

test.describe("T1 — trang khách ở 390px", () => {
  test("nội dung: feed, chuyên mục, mạch, hồ sơ, trang tĩnh — thanh cài app ĐANG hiện", async ({ page }) => {
    test.setTimeout(240_000);
    const hpg = await timMachTheoTitle(TITLE_HPG);
    const bot = (await hoSo("e2e_bot_demo")).machs[0];
    const doi = (await hoSo("e2e_tai_khoan_doi")).machs;
    const chuDe = doi.find((m) => m.loai_mach === "thao_luan" && m.comment_count > 0);
    const baiViet = doi.find((m) => m.loai_mach === "bai_viet" && m.comment_count > 0);
    expect(bot?.lenh, "seed: mạch có lệnh").toBeTruthy();
    expect(chuDe, "seed: chủ đề có bình luận").toBeTruthy();
    expect(baiViet, "seed: bài viết có bình luận").toBeTruthy();

    const trang: string[] = [
      "/",
      "/?tab=moi&loai_mach=nhat_ky",
      "/?tab=moi&loai_mach=nhat_ky&trang_thai=open",
      "/?tab=nhieu-diem",
      "/s/chung-khoan",
      "/s/chung-khoan?loai_mach=nhat_ky",
      duongDan(hpg),
      `/m/${bot.slug}-${bot.id}`,
      `/m/${chuDe!.slug}-${chuDe!.id}`,
      `/m/${baiViet!.slug}-${baiViet!.id}`,
      `/u/${USER_NHIEU_MACH}`,
      "/chu-de",
      "/luat",
      "/khong-ton-tai-dot-m",
    ];
    const loi: string[] = [];
    for (const url of trang) {
      await moi(page, url);
      await thanhCaiAppHien(page);
      loi.push(...(await kiemTrang(page, url)));
    }

    // Ô tìm của header mobile (panel mở từ nút kính lúp) — ô nhập có ở MỌI trang.
    await moi(page, "/");
    await page.getByTestId("nut-tim-kiem").click();
    await expect(page.getByTestId("panel-tim-kiem")).toBeVisible();
    loi.push(
      ...(await kiemTrang(page, "panel tìm kiếm", {
        coONhap: true,
        phamVi: '[data-testid="panel-tim-kiem"]',
        cuon: false,
      })),
    );
    expect(loi, loi.join("\n")).toEqual([]);
  });

  test("form + xác thực + tìm kiếm: KHÔNG có thanh cài app, ô nhập ≥ 16px", async ({ page }) => {
    test.setTimeout(120_000);
    const loi: string[] = [];
    for (const [url, coONhap, coThanh] of [
      ["/dang-nhap", true, false],
      ["/dang-ky", true, false],
      ["/quen-mat-khau", true, false],
      // Trang tìm kiếm chỉ đo KHUNG (ô tìm + bộ lọc): bộ e2e không có Meilisearch.
      ["/tim-kiem", true, true],
      ["/tim-kiem?q=vang", true, true],
    ] as const) {
      await moi(page, url);
      if (coThanh) await thanhCaiAppHien(page);
      else await expect.soft(page.getByTestId("banner-cai-app"), url).toHaveCount(0);
      loi.push(...(await kiemTrang(page, url, { coONhap })));
    }
    expect(loi, loi.join("\n")).toEqual([]);
  });
});

test.describe("T1 — thẻ mạch ở 360px (máy hẹp nhất còn phổ biến)", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("chân thẻ một hàng, meta không bẻ giữa chữ, không tràn ngang", async ({ page }) => {
    const loi: string[] = [];
    for (const url of ["/", "/?tab=moi&loai_mach=nhat_ky", `/u/${USER_NHIEU_MACH}`]) {
      await moi(page, url);
      const the = await page.evaluate(kiemThe);
      expect(the.so, `${url}: 0 thẻ — bài đo rỗng`).toBeGreaterThan(0);
      loi.push(...the.loi.map((x) => `${url}: ${x}`));
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > 360) loi.push(`${url}: tràn ngang ${sw}`);
    }
    expect(loi, loi.join("\n")).toEqual([]);
  });
});

/* ===================================================================== T1 · trang user */

test.describe("T1 — trang của người đã đăng nhập ở 390px", () => {
  /** Thông báo chưa đọc dựng riêng cho bài này (để sheet Thông báo có nút "Đọc hết" mà đo) — nhận
   * diện bằng `dedupe_key`, dọn ở `afterAll` (và ở đầu bài, phòng lượt trước bị ngắt giữa chừng). */
  const KHOA_THONG_BAO = "dot-m-390";
  const donThongBao = () =>
    py(`from core.models import Notification; Notification.objects.filter(dedupe_key__startswith=${JSON.stringify(KHOA_THONG_BAO)}).delete()`);
  test.beforeAll(donThongBao);
  test.afterAll(donThongBao);

  test("form, hồ sơ + mạch của mình, ngăn đăng nhanh, sheet thông báo + tài khoản", async ({ page }) => {
    test.setTimeout(300_000);
    const ai = await dungTaiKhoan(page, "m390");

    // Một mạch của chính mình, đăng qua form `/dang-mach` — trang mạch + hồ sơ có thẻ để đo.
    await moi(page, "/dang-mach");
    await expect.soft(page.getByTestId("banner-cai-app"), "/dang-mach").toHaveCount(0);
    const loi: string[] = await kiemTrang(page, "/dang-mach", { coONhap: true });
    await page.getByTestId("dang-mach-sub").selectOption("chung-khoan");
    await page.getByTestId("dang-mach-title").fill(`Nhật ký mobile của ${ai.username}`);
    await page.getByTestId("dang-mach-body").fill("Vào HPG 27.80 — mốc đầu ghi từ điện thoại.");
    await page.getByTestId("dang-mach-gui").click();
    await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
    const machMinh = new URL(page.url()).pathname;

    // Menu ⋯ của mốc 1 (mạch của mình) đang MỞ: "Sửa mốc", "Xoá mốc"… cũng phải ≥ 44px.
    await moi(page, machMinh);
    await page.locator('[data-testid="menu-moc"] > summary').first().click();
    await expect(page.locator('[data-testid="menu-moc"][open]').first()).toBeVisible();
    const menuMoc = await page.evaluate(doTrang, '[data-testid="menu-moc"][open]');
    expect(menuMoc.soNut, "menu mốc: phải đo được summary + ít nhất một mục").toBeGreaterThan(1);
    for (const x of menuMoc.nut) loi.push(`menu mốc: nút < 44px: ${x.ten} (${x.cao}px)`);
    for (const x of menuMoc.matCach) loi.push(`menu mốc: mất dấu cách: ${x}`);

    // `/cai-dat` chỉ có ô chọn (nhận thư) — đo ở nhóm nút qua nhãn, không có ô nhập chữ.
    for (const [url, coONhap] of [["/cai-dat", false], ["/sua-ho-so", true], ["/doi-mat-khau", true]] as const) {
      await moi(page, url);
      await expect.soft(page.getByTestId("banner-cai-app"), url).toHaveCount(0);
      loi.push(...(await kiemTrang(page, url, { coONhap })));
    }
    for (const url of [`/u/${ai.username}`, machMinh, "/"]) {
      await moi(page, url);
      await thanhCaiAppHien(page);
      loi.push(...(await kiemTrang(page, url)));
    }

    // Một thông báo CHƯA ĐỌC cho chính tài khoản này ⇒ sheet Thông báo có nút "Đọc hết". Dựng NGAY
    // trước ba ngăn: mở trang mạch mà thông báo trỏ tới là nó tự thành đã đọc.
    const idMach = Number(/-(\d+)$/.exec(machMinh)![1]);
    py(
      [
        "from core.models import Mach, Notification",
        "from django.contrib.auth import get_user_model",
        `m = Mach.objects.get(pk=${idMach})`,
        `u = get_user_model().objects.get(username=${JSON.stringify(ai.username)})`,
        `Notification.objects.create(user=u, type="moc_moi", dedupe_key=${JSON.stringify(`${KHOA_THONG_BAO}:${ai.username}`)}, payload={"mach_id": m.pk, "mach_title": m.title, "mach_slug": m.slug})`,
        "",
      ].join("\n"),
    );

    // Ba ngăn mở từ thanh điều hướng mobile — đo TRONG ngăn, và thanh cài app phải nhường chỗ.
    const nav = page.getByRole("navigation", { name: "Điều hướng chính di động" });
    for (const [nhan, nut, phamVi, coONhap] of [
      ["ngăn đăng nhanh", "Đăng mạch mới", 'aside[aria-label="Đăng bài nhanh"]', true],
      ["sheet thông báo", "Thông báo", '[role="dialog"][aria-label="Thông báo"]', false],
      ["sheet tài khoản", "Cá nhân", '[role="dialog"][aria-label="Tài khoản"]', false],
    ] as const) {
      await moi(page, "/");
      await nav.getByRole("button", { name: nut }).click();
      await expect(page.locator(phamVi)).toBeVisible();
      await page.waitForTimeout(400);
      if (nhan === "sheet thông báo") {
        await expect(page.locator(phamVi).getByRole("button", { name: "Đọc hết" }), "sheet có thông báo chưa đọc").toBeVisible();
      }
      await expect.soft(page.getByTestId("banner-cai-app"), `${nhan}: thanh cài app khi ngăn mở`).toBeHidden();
      loi.push(...(await kiemTrang(page, nhan, { coONhap, phamVi, cuon: false })));
    }
    expect(loi, loi.join("\n")).toEqual([]);
  });
});

/* ===================================================================== T2 · thanh cài app */

test.describe("T2 — thanh cài app không cướp chỗ", () => {
  test("trang lọc nhật ký + trang chủ: nút 'Ghi nhật ký' bấm trúng khi thanh đang hiện, thanh đứng trên nút", async ({
    page,
  }) => {
    for (const url of ["/?tab=moi&loai_mach=nhat_ky", "/"]) {
      await moi(page, url);
      await thanhCaiAppHien(page);
      // Màn hình ĐẦU (khối nhật ký trang chủ bắt đầu sát đáy khung nhìn — ca dải ghi không lên cao hơn
      // đỉnh khối được) và một chỗ giữa khối (dải đang DÍNH đáy).
      for (const y of [0, 600]) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(300);
        const nut = page.getByTestId("nut-ghi-nhat-ky-di-dong");
        await expect(nut, url).toBeVisible();
        const trung = await nut.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const thanh = document.querySelector('[data-testid="banner-cai-app"]')!.getBoundingClientRect();
          return { trung: t !== null && el.contains(t), nutTren: r.top, thanhDuoi: thanh.bottom };
        });
        expect(trung.trung, `${url} @${y}: ${JSON.stringify(trung)}`).toBe(true);
        // Thiết kế chọn: THANH đứng trên dải ghi (lý do ở `goi-y-cai-app.module.css`).
        expect(trung.nutTren, `${url} @${y}: thanh phải đứng TRÊN nút ghi`).toBeGreaterThanOrEqual(trung.thanhDuoi - 1);
      }

    }
  });

  /** Cuộn tới đáy THẬT (feed cuộn vô hạn nạp thêm khi chạm đáy) rồi đo: chân trang phải nằm HẲN trên
   * thanh cài app — và trên dải "Ghi nhật ký" nếu dải đang dính đáy. Đo bằng hộp, không chỉ bằng
   * `elementFromPoint` ở tâm link: thanh trên trang có dải ghi đứng cao (`bottom: 83px`), nên khi trang
   * không chừa chỗ, link cuối rơi vào KHE dưới thanh và vẫn "bấm trúng" — phép kiểm cũ xanh rỗng ở đó. */
  for (const url of ["/?tab=moi&loai_mach=nhat_ky", "/", "/s/chung-khoan", `/u/${USER_NHIEU_MACH}`, "/luat"]) {
    test(`cuộn hết trang ${url}: chân trang nằm trên thanh cài app (và trên dải ghi nếu đang dính)`, async ({ page }) => {
      await moi(page, url);
      await thanhCaiAppHien(page);
      for (let i = 0; i < 8; i += 1) {
        const truoc = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(700);
        if ((await page.evaluate(() => document.documentElement.scrollHeight)) === truoc) break;
      }
      // Sửa ở việc 14 đợt E: chân trang không còn link nào ("Luật cộng đồng" + "Trang chủ" bỏ — plan
      // §4.7 "Bớt lặp"), nên phép "bấm trúng" đo trên DÒNG MIỄN TRỪ — phần tử cuối của chân trang, thứ
      // người đọc phải đọc được (PLAN 5.10). Phép đo hộp (đáy chân trang trên thanh / dải ghi) giữ nguyên.
      const d = await page.evaluate(() => {
        const chan = document.querySelector('[data-testid="chan-trang"]')!;
        const link = chan.querySelector('[data-testid="disclaimer"]')!;
        const rl = link.getBoundingClientRect();
        const t = document.elementFromPoint(rl.left + rl.width / 2, rl.top + rl.height / 2);
        const thanh = document.querySelector('[data-testid="banner-cai-app"]')!.getBoundingClientRect();
        const ghi = document.querySelector('[data-testid="nut-ghi-nhat-ky-di-dong"]');
        const dai = ghi?.parentElement?.getBoundingClientRect() ?? null;
        const daiDinh = dai !== null && dai.height > 0 && Math.abs(dai.bottom - innerHeight) < 1.5;
        return {
          chanDuoi: chan.getBoundingClientRect().bottom,
          thanhTren: thanh.top,
          daiTren: daiDinh ? dai!.top : null,
          trung: t !== null && link.contains(t),
        };
      });
      expect(d.chanDuoi, `${url}: ${JSON.stringify(d)}`).toBeLessThanOrEqual(d.thanhTren + 1);
      if (d.daiTren !== null) expect(d.chanDuoi, `${url}: dải ghi ${JSON.stringify(d)}`).toBeLessThanOrEqual(d.daiTren + 1);
      expect(d.trung, `${url}: dòng miễn trừ không bị che ${JSON.stringify(d)}`).toBe(true);
    });
  }

  test("nút về đầu trang không bị thanh đè; bấm ✕ thì thanh đi và trang hết chừa chỗ", async ({ page }) => {
    await moi(page, "/s/chung-khoan");
    await thanhCaiAppHien(page);
    const chua = () => page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
    expect(await chua(), "khi thanh hiện, body chừa chỗ ở đáy").toBeGreaterThanOrEqual(60);
    await page.evaluate(() => window.scrollTo(0, 1500));
    const ve = page.getByTestId("nut-ve-dau-trang");
    await expect(ve).toBeVisible();
    await page.waitForTimeout(400);
    const trung = await ve.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return t !== null && el.contains(t);
    });
    expect(trung, "nút về đầu trang bị đè").toBe(true);

    await page.getByTestId("banner-cai-app").getByRole("button", { name: "Đóng" }).click();
    await expect(page.getByTestId("banner-cai-app")).toHaveCount(0);
    expect(await chua(), "tắt thanh rồi thì hết chừa chỗ").toBe(0);
  });
});

/* ===================================================================== T5 · home mobile */

// Việc 24: section "Bài viết" (từng đứng NGOÀI khung, được `order` kéo lên trước rail) đã gỡ;
// bài viết mới là một khối của rail. User chốt 2026-11-14: trên điện thoại (≤ 640px) rail BỎ hẳn
// "Chuyên mục" và khối bài mới (`.an_tren_dien_thoai`) — danh sách chuyên mục đã có ở tab "Chuyên
// mục" của thanh điều hướng dưới. Hai khối vẫn trong DOM (ẩn bằng CSS), chỉ không hiện.
test.describe("T5 — home mobile: rail không có Chuyên mục / bài mới", () => {
  test("390px: Nhật ký mới → rail (Luật) → chân trang; Chuyên mục + bài mới ẩn; không cuộn ngang", async ({
    page,
  }) => {
    await moi(page, "/");
    const top = (sel: string) =>
      page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await expect(page.locator('[data-testid="khoi-bai-viet"]')).toHaveCount(0);
    const rail = page.getByTestId("rail-phai");
    // Vế chống rỗng: hai khối CÓ trong DOM (trang có dữ liệu), chỉ bị ẩn.
    await expect(rail.getByTestId("sidebar-cac-sub")).toBeAttached();
    await expect(rail.getByTestId("sidebar-bai-moi")).toBeAttached();
    await expect(rail.getByTestId("sidebar-cac-sub")).toBeHidden();
    await expect(rail.getByTestId("sidebar-bai-moi")).toBeHidden();
    // Các khối khác của rail giữ nguyên.
    await expect(rail.getByTestId("sidebar-luat")).toBeVisible();
    // Đường tới danh sách chuyên mục trên điện thoại: tab "Chuyên mục" của thanh điều hướng dưới.
    await expect(
      page.getByRole("navigation", { name: "Điều hướng chính di động" }).getByRole("button", { name: "Chuyên mục" }),
    ).toBeVisible();
    const nhatKy = await top('[data-testid="khoi-nhat-ky"]');
    const dauRail = await top('[data-testid="rail-phai"]');
    const luat = await top('[data-testid="rail-phai"] [data-testid="sidebar-luat"]');
    const chan = await top('[data-testid="chan-trang"]');
    expect(nhatKy).toBeLessThan(dauRail);
    expect(dauRail).toBeLessThanOrEqual(luat);
    expect(luat).toBeLessThan(chan);
    const rong = await page.evaluate(() => ({
      cuon: document.documentElement.scrollWidth,
      khung: window.innerWidth,
    }));
    expect(rong.cuon, JSON.stringify(rong)).toBeLessThanOrEqual(rong.khung);
  });

  test("`/luat` (khối tự nạp ở trình duyệt) cũng ẩn ở 390px; 641px thì cả hai khối HIỆN lại", async ({ page }) => {
    await moi(page, "/luat");
    const rail = page.getByTestId("rail-phai");
    // Nhánh trình duyệt (`ChuyenMucTuTrinhDuyet` / `BaiMoiTuTrinhDuyet`): chờ nạp xong rồi mới xét.
    await expect(rail.getByTestId("sidebar-cac-sub")).toBeAttached();
    await expect(rail.getByTestId("sidebar-bai-moi")).toBeAttached();
    await expect(rail.getByTestId("sidebar-cac-sub")).toBeHidden();
    await expect(rail.getByTestId("sidebar-bai-moi")).toBeHidden();
    await expect(rail.getByTestId("sidebar-luat")).toBeVisible();
    // Ngay trên breakpoint điện thoại: không đổi so với trước 2026-11-14.
    await page.setViewportSize({ width: 641, height: 900 });
    for (const url of ["/", "/luat"]) {
      await moi(page, url);
      await expect(rail.getByTestId("sidebar-cac-sub"), url).toBeVisible();
      await expect(rail.getByTestId("sidebar-bai-moi"), url).toBeVisible();
    }
  });
});

/* ======================================================= M6 · nút gập nhánh, M8 · rail, M2 · xoay ngang */

test.describe("M6 — nút gập nhánh `[−]` ở 390px", () => {
  test("cùng hàng tên người bình luận; tâm + 4 điểm sát mép vùng bấm (30×44) trúng CHÍNH nút, không trúng vạch nhánh", async ({
    page,
  }) => {
    const hpg = await timMachTheoTitle(TITLE_HPG);
    await moi(page, duongDan(hpg));
    const nut = page.locator('[data-testid="nut-gap-nhanh"]:visible').first();
    await expect(nut).toBeVisible();
    await nut.scrollIntoViewIfNeeded();
    const d = await nut.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      const khung = el.parentElement!.parentElement!;
      const ten = khung.querySelector('a[href^="/u/"]:not([tabindex="-1"])')!.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const diem: Array<[string, number, number]> = [
        ["tâm", cx, cy],
        ["trên", cx, cy - 20],
        ["dưới", cx, cy + 20],
        ["trái", cx - 13, cy],
        ["phải", cx + 13, cy],
      ];
      return {
        lechHang: Math.abs(cy - (ten.top + ten.height / 2)),
        truot: diem
          .filter(([, x, y]) => {
            const t = document.elementFromPoint(x, y);
            return t === null || !el.contains(t);
          })
          .map(([n, x, y]) => {
            const t = document.elementFromPoint(x, y);
            return `${n} → ${t?.getAttribute("data-testid") ?? t?.tagName}`;
          }),
      };
    });
    expect(d.lechHang, "[−] lệch hàng với tên người bình luận").toBeLessThanOrEqual(4);
    expect(d.truot, "điểm trong vùng bấm không trúng nút").toEqual([]);
    // Playwright tự kiểm "có phần tử nào chặn cú bấm" — lỗi cũ: vạch nhánh chặn.
    await nut.click({ trial: true, timeout: 5_000 });
  });
});

test.describe("M8 + M2 — trang form của người đã đăng nhập: rail ẩn trên điện thoại, ô nhập ≥ 16px khi xoay ngang", () => {
  test("390px: 4 trang form không vẽ rail; 1280px: rail vẫn hiện; 844×390: ô nhập /dang-mach + ô tìm header ≥ 16px", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await dungTaiKhoan(page, "m390r");
    const FORM = ["/dang-mach", "/cai-dat", "/sua-ho-so", "/doi-mat-khau"];
    for (const url of FORM) {
      await moi(page, url);
      await expect(page.getByTestId("rail-phai"), `${url} @390: rail phải ẩn`).toBeHidden();
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const url of FORM) {
      await moi(page, url);
      await expect(page.getByTestId("rail-phai"), `${url} @1280: rail phải hiện`).toBeVisible();
    }

    // iPhone xoay ngang: khổ 844 (> 640) vẫn là Safari iOS — vẫn tự phóng to ô < 16px.
    await page.setViewportSize({ width: 844, height: 390 });
    await moi(page, "/dang-mach");
    const nho = (sel: string) =>
      page.evaluate(
        (s) =>
          [...document.querySelectorAll(s)]
            .filter((e) => e.getBoundingClientRect().width > 2)
            .map((e) => [e.getAttribute("data-testid") ?? e.tagName, parseFloat(getComputedStyle(e).fontSize)] as const)
            .filter(([, co]) => co < 16),
        sel,
      );
    const soO = await page
      .locator('[data-testid="form-dang-mach"] :is(input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea, [contenteditable="true"])')
      .count();
    expect(soO, "/dang-mach @844: 0 ô nhập — bài đo rỗng").toBeGreaterThan(0);
    expect(
      await nho('[data-testid="form-dang-mach"] :is(input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea, [contenteditable="true"])'),
      "/dang-mach @844×390",
    ).toEqual([]);
    await page.getByTestId("nut-tim-kiem").click();
    const oTim = page.getByTestId("panel-tim-kiem").getByTestId("o-tim-kiem");
    await expect(oTim).toBeVisible();
    expect(await nho('[data-testid="panel-tim-kiem"] [data-testid="o-tim-kiem"]'), "ô tìm header @844×390").toEqual([]);
  });
});
