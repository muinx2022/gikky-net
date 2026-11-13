import { expect, test, type Locator, type Page } from "@playwright/test";

import { py } from "./thu-vien";

/** Việc 18 — plan `2026-11-12-khoi-chu-de-xep-chong-nut-brand.md` §3.4(b)(c), trên BẢN BUILD thật.
 *
 * (b) Nút đặc dùng `--brand` + chữ `--on-brand` ở CẢ HAI theme: "Đăng ký" ở header (mọi trang —
 *     đo trên `/` và `/luat`), "Vào thảo luận", "Mở nhật ký", nút "Ghi nhật ký" dính đáy mobile.
 *     Gốc chuyện là P-20261110-6: "Đăng ký" ở theme tối chữ trắng trên nền gần trắng.
 * (c) Khối chủ đề: tiêu đề rộng hết khối, nút bo tròn hẳn. Phần "ô quan điểm" của (c) đã bỏ ở
 *     việc 19 (plan `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.4) cùng với chính ô ấy.
 *
 * Kỳ vọng màu lấy từ giá trị TÍNH của token trên `<html>` (đổi ra `rgb()` qua một phần tử thử),
 * không chép mã hex — đổi token thì bài vẫn đúng, đổi nút sang token khác thì bài đỏ.
 *
 * Dữ liệu TẠM cho (c): một chủ đề mới xuất bản (nên nó là cái `chonChuDeNoi` chọn) có HAI bình
 * luận gốc dài — để "không còn ô quan điểm" được đo trên một chủ đề CÓ bình luận. Xoá ở `afterAll` và ở đầu
 * `beforeAll` (dọn trước nên chạy lại `beforeAll` khi worker khởi động lại vẫn an toàn). Phép đo bố cục
 * dùng `expect.soft`: một lần hỏng hiện ĐỦ mọi luật bị vỡ, không dừng ở luật đầu. */

const TD =
  "Chủ đề xếp chồng e2e — tiêu đề đủ dài để thấy nó còn gãy mấy dòng khi chiếm hết bề rộng khối nhé";
const THAN_BL =
  "Quan điểm dài của bài đo xếp chồng: ở desktop câu trích phải nằm gọn trên MỘT dòng và cắt bằng dấu ba chấm, " +
  "còn ở mobile thì xuống hàng dưới tên và chỉ được hiện tối đa hai dòng, phần còn lại bị cắt đi cho gọn khối.";
/** Vòng 2 (§10.3): user TẠM có `display_name` dài đúng mức `max_length=60`
 * (`api/core/models/nguoi_dung.py`), viết bình luận "Hai.". Từng dùng để đo hàng tên dài của ô
 * quan điểm (đã bỏ ở việc 19); giữ lại làm một trong hai bình luận gốc của chủ đề tạm. */
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

  // Các bài đo ô quan điểm của việc 18 (tên dài ≤ 45%, hàng của tên dài ở 390, một hàng mỗi quan
  // điểm, ô DƯỚI nút nền `--inset`, 390 chỉ một quan điểm ≤ 2 dòng) đã xoá ở việc 19: ô ấy không còn
  // (plan `2026-11-13-ban-tin-len-dau-ban-quyen.md` §3.4). Dữ liệu tạm vẫn giữ HAI bình luận gốc
  // để bài dưới đo được "có bình luận mà vẫn không vẽ ô" — không xanh vì rỗng.
  for (const scheme of ["light", "dark"] as const) {
    test(`1280 · ${scheme}: tiêu đề rộng hết khối, nút bo tròn hẳn, không còn ô quan điểm dù có bình luận`, async ({
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

        // Bo tròn hẳn: bán kính tính ra ≥ nửa chiều cao.
        const nut = khoi.getByTestId("chu-de-vao");
        const { r, h } = await nut.evaluate((e) => ({
          r: parseFloat(getComputedStyle(e).borderTopLeftRadius),
          h: e.getBoundingClientRect().height,
        }));
        expect.soft(r, "chu-de-vao bo tròn hẳn").toBeGreaterThanOrEqual(h / 2);

        await expect.soft(khoi.getByTestId("quan-diem-noi-bat")).toHaveCount(0);
        await expect.soft(khoi.getByTestId("quan-diem")).toHaveCount(0);
      } finally {
        await ctx.close();
      }
    });
  }
});
