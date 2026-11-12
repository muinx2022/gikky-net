import type { FeedOut } from "@gikky/api-client";
import { expect, test, type Page } from "@playwright/test";

import { dungTaiKhoan } from "./danh-tinh";

/** Hàng rào chống tái phát lỗi hydrate #418 khi có phiên lưu (việc 17, plan
 * `plans/2026-11-12-sua-hydrate-418.md` §4.3) — trên BẢN BUILD thật, DB `gikky_e2e`.
 *
 * ## Lỗi nó chặn
 *
 * `PhienProvider` (`components/phien.tsx`) dùng `fallbackData` đọc `localStorage`. Nếu phiên lưu
 * lộ ra ngay ở lần render HYDRATE, mọi component vẽ theo `toi` lệch HTML server (server không có
 * `localStorage`): React báo #418, bỏ HTML server, render lại cả root — và trên đường ấy
 * (`acquireSingletonInstance`) xoá rồi gắn lại MỌI thuộc tính của `<html>`, tức cờ CSS mà script
 * `<head>` đặt (`data-da-dang-nhap`, `data-google-tat`, `style` gồm `color-scheme` và
 * `--rong-tai-khoan`) chết ngay lúc hydrate. Khách LƯỢT ĐẦU không có phiên lưu nên không dính —
 * vì vậy bài đo phải chạy cả ba trạng thái, một mình ca lượt đầu thì xanh cả khi lỗi còn nguyên.
 *
 * ## Hai phép đo, mỗi lượt tải
 *
 * - không `pageerror` / console error nào mang mã lỗi hydrate của React (#418, #419, #421, #422,
 *   #423, #425) hay chữ "Hydration" — mọi mã chứ không riêng #418: cập nhật context ngay sau
 *   hydrate có thể chạm Suspense boundary chưa hydrate xong (#421 thời React 18), plan §7;
 * - `MutationObserver` cài bằng `addInitScript`: chụp thuộc tính `<html>` lúc `<body>` vừa ra đời
 *   (script `<head>` đã chạy xong), rồi KHÔNG thuộc tính nào trong ảnh chụp ấy được gỡ hay đổi
 *   giá trị suốt lượt tải. Ngoại lệ hợp lệ duy nhất: `luuCachePhien` gỡ `data-da-dang-nhap` khi
 *   `/me` nói là khách — ở ca thành viên thật thì không có ngoại lệ nào.
 *
 * Gỡ-rồi-gắn-lại (đúng hình dạng của nhánh hydrate thất bại) vẫn bị bắt dù giá trị CUỐI giống hệt
 * ảnh chụp: mỗi bản ghi được so (giá trị trước, giá trị sau) chứ không chỉ so trạng thái cuối.
 */

const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

/** Mã lỗi hydrate của React 19 (bản minified) + chữ của bản dev. */
const LOI_HYDRATE = /Minified React error #(418|419|421|422|423|425)\b|hydrat/i;

async function feed(loai: string) {
  const r = await fetch(`${API}/api/v1/feeds/moi?limit=1&loai_mach=${loai}`);
  const f = (await r.json()) as FeedOut;
  const m = f.items[0];
  if (m === undefined) throw new Error(`seed không có mạch loai_mach=${loai}`);
  return m;
}

/** Các trang §4.3, dựng từ dữ liệu seed qua API (không đoán slug). */
async function cacTrang(): Promise<string[]> {
  const nhatKy = await feed("nhat_ky");
  const chuDe = await feed("thao_luan");
  const tu = nhatKy.title.split(/\s+/)[0] ?? "a";
  return [
    "/",
    `/s/${nhatKy.sub.slug}`,
    `/m/${nhatKy.slug}-${nhatKy.id}`,
    `/m/${chuDe.slug}-${chuDe.id}`,
    `/u/${nhatKy.author.username}`,
    "/chu-de",
    "/luat",
    `/tim-kiem?q=${encodeURIComponent(tu)}`,
  ];
}

type BanGhi = { ten: string; cu: string | null; moi: string | null };
type KetQua = {
  gan: boolean;
  anhDau: Record<string, string> | null;
  banGhi: BanGhi[];
  lsLucDau: string | null;
};

async function caiDo(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __hyd: KetQua };
    w.__hyd = { gan: false, anhDau: null, banGhi: [], lsLucDau: null };
    try {
      w.__hyd.lsLucDau = localStorage.getItem("gikky:phien");
    } catch {}
    const chup = () => {
      const r: Record<string, string> = {};
      for (const a of [...document.documentElement.attributes]) r[a.name] = a.value;
      return r;
    };
    // Bản ghi thuộc tính: (giá trị trước, giá trị sau). "Sau" của bản ghi i là "trước" của bản ghi
    // kế CÙNG tên trong cùng lô; bản cuối của lô lấy giá trị hiện tại. Chỉ ghi khi `<body>` đã có
    // — tức sau script `<head>` (chúng đặt thuộc tính trong lúc parse `<head>`, hợp lệ).
    const nhanThuocTinh = (lo: MutationRecord[]) => {
      if (document.body === null) return;
      lo.forEach((m, i) => {
        const ten = m.attributeName!;
        const ke = lo.slice(i + 1).find((x) => x.attributeName === ten);
        const moi = ke !== undefined ? ke.oldValue : document.documentElement.getAttribute(ten);
        w.__hyd.banGhi.push({ ten, cu: m.oldValue, moi });
      });
    };
    // Quan sát `document` trước (init script chạy khi `documentElement` còn `null` — xem
    // `giao-dien.spec.ts` T2), gắn observer thuộc tính lên `<html>` ngay khi nó ra đời, và chụp
    // ảnh lúc `<body>` xuất hiện.
    const ngoai = new MutationObserver(() => {
      const h = document.documentElement;
      if (h !== null && !w.__hyd.gan) {
        w.__hyd.gan = true;
        new MutationObserver(nhanThuocTinh).observe(h, { attributes: true, attributeOldValue: true });
      }
      if (document.body !== null && w.__hyd.anhDau === null) {
        w.__hyd.anhDau = chup();
        ngoai.disconnect();
      }
    });
    ngoai.observe(document, { childList: true, subtree: true });
  });
}

/** Tải `url`, chờ phiên được biết (`cho`), trả mọi vi phạm của lượt tải. */
async function taiVaDo(page: Page, url: string, cho: string, choGoDangNhap: boolean) {
  const loi: string[] = [];
  const nghe = (m: { type(): string; text(): string }) => {
    if (m.type() === "error" && LOI_HYDRATE.test(m.text())) loi.push(`console: ${m.text().slice(0, 200)}`);
  };
  const pe = (e: Error) => {
    if (LOI_HYDRATE.test(e.message)) loi.push(`pageerror: ${e.message.slice(0, 200)}`);
  };
  page.on("console", nghe);
  page.on("pageerror", pe);
  // Trang 404/500 cũng hydrate "sạch" — không ép mã thì bài đo một trang lỗi mà vẫn xanh.
  const r = await page.goto(url);
  expect(r?.status(), url).toBe(200);
  await page.waitForSelector(cho, { state: "attached" });
  await page.waitForTimeout(500);
  page.off("console", nghe);
  page.off("pageerror", pe);
  const kq = await page.evaluate(() => (window as unknown as { __hyd: KetQua }).__hyd);
  expect(kq.gan, `${url}: đo rỗng — observer không gắn được lên <html>`).toBe(true);
  expect(kq.anhDau, `${url}: đo rỗng — không chụp được <html> lúc <body> ra đời`).not.toBeNull();
  const anh = kq.anhDau!;
  for (const b of kq.banGhi) {
    if (!(b.ten in anh)) continue; // thuộc tính gắn SAU (vd `data-thanh-cuon` của thanh điều hướng)
    if (b.cu === null || b.moi === b.cu) continue;
    if (b.ten === "data-da-dang-nhap" && b.moi === null && choGoDangNhap) continue;
    loi.push(`<html ${b.ten}>: ${JSON.stringify(b.cu)} → ${JSON.stringify(b.moi)}`);
  }
  return { loi, anh, lsLucDau: kq.lsLucDau };
}

test.describe("T3 — hydrate sạch ở cả ba trạng thái phiên (việc 17)", () => {
  test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });

  test("khách lượt ĐẦU (localStorage rỗng)", async ({ page }) => {
    const trang = await cacTrang();
    await caiDo(page);
    const vi_pham: string[] = [];
    for (const url of trang) {
      if (page.url().startsWith("http")) await page.evaluate(() => localStorage.clear());
      const { loi, anh, lsLucDau } = await taiVaDo(page, url, '[data-testid="thanh-tai-khoan-khach"]', true);
      // Vế tiền đề: đúng là lượt đầu — script `<head>` không có gì để đọc.
      expect(lsLucDau, `${url}: không phải lượt đầu`).toBeNull();
      expect(anh.style ?? "", `${url}: đo rỗng — script theme không đặt color-scheme`).toContain("color-scheme");
      vi_pham.push(...loi.map((x) => `${url} — ${x}`));
    }
    expect(vi_pham).toEqual([]);
  });

  test("khách QUAY LẠI (phiên lưu `dang_nhap:false`, `google_bat:false`)", async ({ page }) => {
    const trang = await cacTrang();
    // Lượt đầu cho `/me` ghi phiên lưu THẬT (đúng object trình duyệt giữ lại) — một object viết tay
    // thiếu trường như `la_tai_khoan_doi` thì không dựng lại được cả các chỗ lệch có thật.
    expect((await page.goto("/luat"))?.status(), "/luat").toBe(200);
    await page.waitForSelector('[data-testid="thanh-tai-khoan-khach"]', { state: "attached" });
    await expect.poll(() => page.evaluate(() => localStorage.getItem("gikky:phien"))).toContain('"dang_nhap":false');
    expect(await page.evaluate(() => localStorage.getItem("gikky:phien"))).toContain('"google_bat":false');
    await caiDo(page);
    const vi_pham: string[] = [];
    for (const url of trang) {
      const { loi, anh, lsLucDau } = await taiVaDo(page, url, '[data-testid="thanh-tai-khoan-khach"]', true);
      expect(lsLucDau, `${url}: không có phiên lưu`).toContain('"dang_nhap":false');
      // Vế chống rỗng: cờ mà lỗi cũ xoá đang có mặt để mà bị xoá.
      expect(anh["data-google-tat"], `${url}: đo rỗng — script <head> không đặt data-google-tat`).toBe("1");
      vi_pham.push(...loi.map((x) => `${url} — ${x}`));
    }
    expect(vi_pham).toEqual([]);
  });

  test("thành viên thật, tải lần hai (+ `/cai-dat`)", async ({ page }) => {
    const trang = await cacTrang();
    await dungTaiKhoan(page, "hydsach");
    // Vế tiền đề: helper để lại phiên + bề ngang cụm tài khoản — chính thứ script `<head>` đọc.
    expect(await page.evaluate(() => localStorage.getItem("gikky:phien"))).toContain('"dang_nhap":true');
    await expect.poll(() => page.evaluate(() => localStorage.getItem("gikky:rong-tai-khoan"))).not.toBeNull();
    await caiDo(page);
    const vi_pham: string[] = [];
    for (const url of [...trang, "/cai-dat"]) {
      const { loi, anh } = await taiVaDo(page, url, '[data-testid="nut-tai-khoan"]', false);
      expect(anh["data-da-dang-nhap"], `${url}: đo rỗng — script <head> không đặt data-da-dang-nhap`).toBe("1");
      expect(anh.style ?? "", `${url}: đo rỗng — script <head> không đặt --rong-tai-khoan`).toContain("--rong-tai-khoan");
      vi_pham.push(...loi.map((x) => `${url} — ${x}`));
    }
    expect(vi_pham).toEqual([]);
  });
});
