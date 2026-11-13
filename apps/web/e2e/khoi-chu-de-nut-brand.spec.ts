import { expect, test, type Locator, type Page } from "@playwright/test";

import { py } from "./thu-vien";

/** Việc 18 — plan `2026-11-12-khoi-chu-de-xep-chong-nut-brand.md` §3.4(b)(c), trên BẢN BUILD thật.
 *
 * (b) Nút đặc dùng `--brand` + chữ `--on-brand` ở CẢ HAI theme: "Đăng ký" ở header (mọi trang —
 *     đo trên `/` và `/luat`), "Vào thảo luận", "Mở nhật ký", nút "Ghi nhật ký" dính đáy mobile.
 *     Gốc chuyện là P-20261110-6: "Đăng ký" ở theme tối chữ trắng trên nền gần trắng.
 * (c) Khối chủ đề xếp chồng: tiêu đề rộng hết khối, ô quan điểm nằm DƯỚI nút, nền `--inset`, mỗi
 *     quan điểm một hàng ở desktop, có `<time datetime>`.
 *
 * Kỳ vọng màu lấy từ giá trị TÍNH của token trên `<html>` (đổi ra `rgb()` qua một phần tử thử),
 * không chép mã hex — đổi token thì bài vẫn đúng, đổi nút sang token khác thì bài đỏ.
 *
 * Dữ liệu TẠM cho (c): một chủ đề mới xuất bản (nên nó là cái `chonChuDeNoi` chọn) có HAI bình
 * luận gốc dài — không dựa vào seed, để bài không xanh vì rỗng. Xoá ở `afterAll` và ở đầu
 * `beforeAll` (dọn trước nên chạy lại `beforeAll` khi worker khởi động lại vẫn an toàn). Phép đo bố cục
 * dùng `expect.soft`: một lần hỏng hiện ĐỦ mọi luật bị vỡ, không dừng ở luật đầu. */

const TD =
  "Chủ đề xếp chồng e2e — tiêu đề đủ dài để thấy nó còn gãy mấy dòng khi chiếm hết bề rộng khối nhé";
const THAN_BL =
  "Quan điểm dài của bài đo xếp chồng: ở desktop câu trích phải nằm gọn trên MỘT dòng và cắt bằng dấu ba chấm, " +
  "còn ở mobile thì xuống hàng dưới tên và chỉ được hiện tối đa hai dòng, phần còn lại bị cắt đi cho gọn khối.";
/** Vòng 2 (§10.3): user TẠM có `display_name` dài đúng mức `max_length=60`
 * (`api/core/models/nguoi_dung.py`), viết bình luận "Hai." — bình luận mới hơn nên đứng đầu ở
 * kiểu "Quan điểm mới", tức chính nó là quan điểm duy nhất còn hiện ở mobile. */
const USER_TAM = "e2e_tam_ten_dai_viec18";
const TEN_DAI = "Người dùng tạm của bài đo e2e có tên hiển thị dài hết cỡ ".padEnd(60, "x").slice(0, 60);

/** Màu tính của một token trên `<html>`, dạng `rgb(…)` như `getComputedStyle` trả. */
async function mauToken(page: Page, ten: string): Promise<string> {
  return page.evaluate((t) => {
    const gia_tri = getComputedStyle(document.documentElement).getPropertyValue(t).trim();
    const thu = document.createElement("div");
    thu.style.color = gia_tri;
    document.body.appendChild(thu);
    const ra = getComputedStyle(thu).color;
    thu.remove();
    return ra;
  }, ten);
}

/** Ba kênh của một màu `rgb(…)`/`rgba(…)`. Alpha < 1 thì NÉM: tương phản của một màu trong suốt
 * phụ thuộc thứ nằm dưới nó, và bỏ alpha đi là coi `transparent` (`rgba(0, 0, 0, 0)`) thành đen —
 * chữ trắng trên "đen" ra 21:1, bài xanh trong lúc nút mất nền. */
function kenh(rgb: string): [number, number, number] {
  const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/.exec(rgb.trim());
  if (m === null) throw new Error(`không đọc được màu "${rgb}"`);
  if (m[4] !== undefined && Number(m[4]) / (m[5] === "%" ? 100 : 1) < 1) {
    throw new Error(`màu "${rgb}" có alpha < 1 — không tính được tương phản`);
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Tương phản WCAG 2.1 giữa hai màu `rgb(…)` (cùng công thức `e2e/don-vi/tuong-phan.spec.ts`). */
function tiSo(a: string, b: string): number {
  const sang = (rgb: string) => {
    const [r, g, bl] = kenh(rgb).map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [sang(a), sang(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Nút có nền `--brand`, chữ `--on-brand`, tương phản ≥ 4.5. */
async function laNutBrand(page: Page, nut: Locator, ten: string): Promise<void> {
  await expect(nut, ten).toBeVisible();
  const brand = await mauToken(page, "--brand");
  const on_brand = await mauToken(page, "--on-brand");
  const { nen, chu } = await nut.evaluate((e) => {
    const s = getComputedStyle(e);
    return { nen: s.backgroundColor, chu: s.color };
  });
  expect(nen, `${ten}: nền`).toBe(brand);
  expect(chu, `${ten}: chữ`).toBe(on_brand);
  expect(tiSo(chu, nen), `${ten}: tương phản`).toBeGreaterThanOrEqual(4.5);
}

/** `filter: brightness(k)` trên một màu `rgb(…)`: nhân từng kênh sRGB với `k`, làm tròn, chặn ở
 * 255 — cùng phép của `nhanSang` ở `e2e/don-vi/nut-chinh-brand.spec.ts`, khớp pixel thật
 * (`#2563eb`×1.08 ⇒ `rgb(40, 107, 254)`). */
function nhanKenh(rgb: string, k: number): string {
  const [r, g, b] = kenh(rgb).map((v) => Math.min(255, Math.round(v * k)));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Vòng 2 (§10.1 H2): rê chuột lên nút, chờ `transition: filter` chạy xong (`getAnimations()`
 * rỗng), ép `filter` là `brightness(k)` — tức đang đo ĐÚNG trạng thái hover, không phải nút
 * nghỉ — rồi tính tương phản của nền và chữ SAU khi nhân `k`. `getComputedStyle` trả màu TRƯỚC
 * filter, nên phải tự nhân; ở theme tối brand/on-brand hover chỉ còn ~4.54:1. */
async function hoverVanDu(page: Page, nut: Locator, ten: string): Promise<void> {
  const brand = await mauToken(page, "--brand");
  await nut.hover();
  await expect
    .poll(
      () => nut.evaluate((e) => (e.getAnimations().length > 0 ? "đang chuyển" : getComputedStyle(e).filter)),
      { message: `${ten}: filter khi hover phải là brightness(k), đã hết chuyển tiếp` },
    )
    .toMatch(/^brightness\(/);
  const { loc, nen, chu } = await nut.evaluate((e) => {
    const s = getComputedStyle(e);
    return { loc: s.filter, nen: s.backgroundColor, chu: s.color };
  });
  // Nền lúc hover vẫn phải là brand, đặc (alpha 1 — `kenh` ném nếu không): hover đổi nền sang
  // `transparent` thì chữ nằm trên thứ gì đó bài này không biết.
  expect(nen, `${ten}: nền khi hover`).toBe(brand);
  const m = /^brightness\(([\d.]+)\)$/.exec(loc);
  expect(m, `${ten}: filter "${loc}" không tính được`).not.toBeNull();
  const k = Number(m![1]);
  expect(k, `${ten}: filter "${loc}" — hover phải đổi gì đó`).not.toBe(1);
  const r = tiSo(nhanKenh(chu, k), nhanKenh(nen, k));
  expect(r, `${ten}: tương phản khi hover (${loc}, nền ${nen}, chữ ${chu})`).toBeGreaterThanOrEqual(4.5);
}

/** "Đăng ký" ở header — trong HTML có cả cụm giữ chỗ, chỉ lấy cái đang hiện. */
const nutDangKy = (page: Page) => page.locator('a[href="/dang-ky"]:visible').first();

test("công thức tương phản đúng — hai mốc đã biết (chống bài đo luôn xanh)", () => {
  expect(tiSo("rgb(0, 0, 0)", "rgb(255, 255, 255)")).toBeCloseTo(21, 5);
  expect(tiSo("rgb(255, 255, 255)", "rgb(232, 236, 244)")).toBeLessThan(1.3);
  // Mốc nhân sáng: pixel phản biện đọc được trên "Đăng ký" theme tối đang hover.
  expect(nhanKenh("rgb(37, 99, 235)", 1.08)).toBe("rgb(40, 107, 254)");
  expect(nhanKenh("rgb(255, 255, 255)", 1.08)).toBe("rgb(255, 255, 255)");
  // Màu trong suốt không được coi là đen (phản biện lượt 1, điểm 5).
  expect(() => kenh("rgba(0, 0, 0, 0)")).toThrow(/alpha/);
  expect(() => kenh("rgba(37, 99, 235, 0.5)")).toThrow(/alpha/);
  expect(() => tiSo("rgb(255, 255, 255)", "rgba(0, 0, 0, 0)")).toThrow(/alpha/);
  expect(kenh("rgba(37, 99, 235, 1)")).toEqual([37, 99, 235]);
  expect(kenh("rgb(37 99 235 / 100%)")).toEqual([37, 99, 235]);
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(`(b) nút đặc màu brand — theme ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test("`/` ở 1280: Đăng ký · Vào thảo luận · Mở nhật ký", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/");
      // Chống đo nhầm theme: `--bg` phải đổi theo `colorScheme`.
      const bg = kenh(await mauToken(page, "--bg"));
      expect(bg[0] > 128, `theme ${scheme} chưa áp`).toBe(scheme === "light");
      await laNutBrand(page, nutDangKy(page), "Đăng ký");
      await laNutBrand(page, page.getByTestId("chu-de-vao"), "Vào thảo luận");
      await laNutBrand(page, page.getByTestId("nut-mo-nhat-ky"), "Mở nhật ký");
    });

    test("`/` ở 1280: hover Đăng ký · Vào thảo luận · Mở nhật ký vẫn ≥ 4.5 (H2)", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/");
      const bg = kenh(await mauToken(page, "--bg"));
      expect(bg[0] > 128, `theme ${scheme} chưa áp`).toBe(scheme === "light");
      await hoverVanDu(page, nutDangKy(page), "Đăng ký");
      await hoverVanDu(page, page.getByTestId("chu-de-vao"), "Vào thảo luận");
      await hoverVanDu(page, page.getByTestId("nut-mo-nhat-ky"), "Mở nhật ký");
    });

    test("`/` ở 390: nút Ghi nhật ký dính đáy", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await laNutBrand(page, page.getByTestId("nut-ghi-nhat-ky-di-dong"), "Ghi nhật ký");
    });

    test("`/luat` ở 1280: Đăng ký ở header", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/luat");
      await laNutBrand(page, nutDangKy(page), "Đăng ký");
    });
  });
}

test.describe("(c) khối chủ đề xếp chồng", () => {
  // Chủ đề TRƯỚC, user SAU: `Comment.author`/`Mach.author` là FK `PROTECT`, xoá user còn bình
  // luận là `ProtectedError`. Xoá chủ đề kéo theo bình luận (`Comment.mach` CASCADE).
  const xoa = () =>
    py(
      "from core.models import Mach, User; " +
        `Mach.objects.filter(title=${JSON.stringify(TD)}).delete(); ` +
        `User.objects.filter(username=${JSON.stringify(USER_TAM)}).delete()`,
    );

  test.beforeAll(() => {
    xoa();
    py(
      [
        "from django.contrib.auth.hashers import make_password",
        "from core.ghi import tao_binh_luan, tao_mach",
        "from core.models import Mach, User",
        "doi = User.objects.get(username='e2e_tai_khoan_doi')",
        `tam = User.objects.create(username=${JSON.stringify(USER_TAM)}, email=${JSON.stringify(`${USER_TAM}@vi-du.gikky.net`)},`,
        `    password=make_password('seed-dev-khong-dung-that'), display_name=${JSON.stringify(TEN_DAI)})`,
        "assert len(tam.display_name) == 60, len(tam.display_name)",
        "sub = Mach.objects.filter(loai_mach='thao_luan').first().sub",
        `m, _ = tao_mach(sub=sub, author=doi, title=${JSON.stringify(TD)}, body='Bối cảnh của chủ đề xếp chồng.',`,
        "    occurred_at=None, loai=None, loai_mach=Mach.LoaiMach.THAO_LUAN)",
        `tao_binh_luan(mach=m, author=doi, body=${JSON.stringify(`Một. ${THAN_BL}`)})`,
        `tao_binh_luan(mach=m, author=tam, body=${JSON.stringify(`Hai. ${THAN_BL}`)})`,
        "",
      ].join("\n"),
    );
  });
  test.afterAll(() => {
    xoa();
    const con = py(
      "from core.models import Mach, User; " +
        `print(Mach.objects.filter(title=${JSON.stringify(TD)}).count() + ` +
        `User.objects.filter(username=${JSON.stringify(USER_TAM)}).count())`,
    );
    expect(Number(con.trim().split("\n").pop()), "đã xoá sạch chủ đề và user tạm").toBe(0);
  });

  /** Hàng quan điểm của user tạm (link tên mang `title="u/<username>"`). */
  const hangTam = (page: Page) =>
    page
      .getByTestId("khoi-thao-luan")
      .getByTestId("quan-diem")
      .filter({ has: page.locator(`a[title="u/${USER_TAM}"]`) });

  // §10.3: `.quan_diem_dong { max-width: 45% }` — tên dài không được nuốt chỗ của câu trích. 700
  // vẫn là bố cục desktop (> 640px), khối hẹp hơn nên chỗ cho trích căng hơn.
  for (const rong of [1280, 700] as const) {
    test(`${rong}: tên dài bị cắt, cụm tên/ngày ≤ 45%, trích ≥ 40% (max-width 45%)`, async ({ page }) => {
      await page.setViewportSize({ width: rong, height: 900 });
      await page.goto("/");
      const khoi = page.getByTestId("khoi-thao-luan");
      await expect(khoi.getByRole("heading", { level: 2 })).toHaveText(TD);
      await expect(hangTam(page), "hàng của user tạm phải hiện").toBeVisible();

      // Chống đo rỗng: tên 60 ký tự PHẢI đang bị cắt — không thì "≤ 45%" xanh chỉ vì tên ngắn.
      // `soft`: mất `max-width` thì tên hết bị cắt VÀ cụm tên nuốt chỗ trích — hiện đủ cả hai.
      const ten = await hangTam(page)
        .getByTestId("quan-diem-ten")
        .evaluate((e) => ({ cuon: e.scrollWidth, thay: e.clientWidth, chu: e.textContent }));
      expect(ten.chu).toBe(TEN_DAI);
      expect.soft(ten.cuon, `tên user tạm phải bị cắt (scrollWidth ${ten.cuon} / clientWidth ${ten.thay})`).toBeGreaterThan(
        ten.thay,
      );

      const hang = await khoi.getByTestId("quan-diem").evaluateAll((ds) =>
        ds
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          // Theo CẤU TRÚC, không theo tên lớp (CSS module băm tên): trích là `<p>`, cha của nó là
          // `.quan_diem_than`; cha của `<time>` là `.quan_diem_dong`.
          .map((e) => {
            const p = e.querySelector("p")!;
            return {
              than: p.parentElement!.getBoundingClientRect().width,
              dong: e.querySelector("time")!.parentElement!.getBoundingClientRect().width,
              trich: p.getBoundingClientRect().width,
            };
          }),
      );
      expect(hang.length, "hai bình luận tạm đều hiện ở desktop").toBe(2);
      for (const h of hang) {
        expect.soft(h.dong, `cụm tên/ngày ${h.dong}px / thân ${h.than}px`).toBeLessThanOrEqual(0.45 * h.than + 1);
        expect.soft(h.trich, `trích ${h.trich}px / thân ${h.than}px`).toBeGreaterThanOrEqual(0.4 * h.than);
      }
    });
  }

  test("390: hàng của tên dài — ngày không bị đẩy ra ngoài, hàng không tràn ngang", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("khoi-thao-luan").getByRole("heading", { level: 2 })).toHaveText(TD);
    // ≤ 640px CSS đặt `.quan_diem_dong { max-width: none }` và chỉ hiện MỘT quan điểm — bình luận
    // của user tạm là cái mới nhất nên chính nó hiện (xem `USER_TAM`).
    const hang = hangTam(page);
    await expect(hang, "hàng của user tạm phải là quan điểm đang hiện ở mobile").toBeVisible();
    const so_do = await hang.evaluate((e) => {
      const li = e.getBoundingClientRect();
      const ngay = e.querySelector("time")!.getBoundingClientRect();
      return {
        phai_li: li.right,
        trai_ngay: ngay.left,
        phai_ngay: ngay.right,
        rong_ngay: ngay.width,
        cuon: e.scrollWidth,
        thay: e.clientWidth,
        trang_cuon: document.documentElement.scrollWidth,
        trang_thay: document.documentElement.clientWidth,
      };
    });
    expect(so_do.rong_ngay, "ngày phải còn bề rộng").toBeGreaterThan(0);
    expect(so_do.phai_ngay, "ngày nằm trong hàng").toBeLessThanOrEqual(so_do.phai_li + 0.5);
    expect(so_do.trai_ngay, "ngày nằm trong hàng").toBeLessThan(so_do.phai_li);
    expect(so_do.cuon, "hàng không tràn ngang").toBeLessThanOrEqual(so_do.thay);
    expect(so_do.trang_cuon, "trang không cuộn ngang").toBeLessThanOrEqual(so_do.trang_thay);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`1280 · ${scheme}: tiêu đề rộng hết khối, ô quan điểm DƯỚI nút, nền --inset, một hàng mỗi quan điểm`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      const page = await ctx.newPage();
      try {
        await page.goto("/");
        const khoi = page.getByTestId("khoi-thao-luan");
        await expect(khoi.getByRole("heading", { level: 2 })).toHaveText(TD);
        const the = khoi.getByTestId("chu-de-the");

        const rong_trong = await the.evaluate((e) => {
          const s = getComputedStyle(e);
          return e.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
        });
        const rong_h2 = await khoi.getByRole("heading", { level: 2 }).evaluate((e) => e.getBoundingClientRect().width);
        expect.soft(rong_h2, `h2 ${rong_h2}px / khối ${rong_trong}px`).toBeGreaterThanOrEqual(0.9 * rong_trong);

        const nut = khoi.getByTestId("chu-de-vao");
        const o = khoi.getByTestId("quan-diem-noi-bat");
        const day_nut = await nut.evaluate((e) => e.getBoundingClientRect().bottom);
        const dinh_o = await o.evaluate((e) => e.getBoundingClientRect().top);
        expect.soft(dinh_o, "ô quan điểm phải nằm dưới nút").toBeGreaterThanOrEqual(day_nut);

        expect.soft(await o.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(await mauToken(page, "--inset"));

        // Bo tròn hẳn: bán kính tính ra ≥ nửa chiều cao.
        const { r, h } = await nut.evaluate((e) => ({
          r: parseFloat(getComputedStyle(e).borderTopLeftRadius),
          h: e.getBoundingClientRect().height,
        }));
        expect.soft(r, "chu-de-vao bo tròn hẳn").toBeGreaterThanOrEqual(h / 2);

        const hien = await khoi.getByTestId("quan-diem").evaluateAll((ds) =>
          ds
            .filter((e) => (e as HTMLElement).offsetParent !== null)
            .map((e) => ({
              cao: e.getBoundingClientRect().height,
              ngay: e.querySelector("time")?.getAttribute("datetime") ?? null,
            })),
        );
        expect(hien.length, "dữ liệu tạm có đúng hai bình luận gốc").toBe(2);
        for (const q of hien) {
          expect.soft(q.cao, "một hàng ở desktop").toBeLessThanOrEqual(44);
          expect.soft(q.ngay).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        }
      } finally {
        await ctx.close();
      }
    });
  }

  test("390: chỉ hiện MỘT quan điểm, trích ≤ 2 dòng", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const khoi = page.getByTestId("khoi-thao-luan");
    await expect(khoi.getByRole("heading", { level: 2 })).toHaveText(TD);
    const trich = await khoi.getByTestId("quan-diem").evaluateAll((ds) =>
      ds
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => {
          const p = e.querySelector("p")!;
          return { cao: p.getBoundingClientRect().height, dong: parseFloat(getComputedStyle(p).lineHeight) };
        }),
    );
    expect(trich.length).toBe(1);
    expect(trich[0].cao, "trích cắt ở 2 dòng").toBeLessThanOrEqual(2 * trich[0].dong + 1);
    // Thân bài dài ⇒ nếu không cắt thì chắc chắn > 2 dòng ở 390px: phép đo không rỗng.
    expect(trich[0].cao).toBeGreaterThan(1.5 * trich[0].dong);
  });
});
