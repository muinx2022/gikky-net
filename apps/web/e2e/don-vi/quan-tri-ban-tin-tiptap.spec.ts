import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { chuanHoaThanBanTin, khungDaDoi } from "../../../admin/lib/ban-tin";
import { dungTiptap } from "./tiptap-trinh-duyet";

/** Vòng sửa 1, việc 21 đợt D — sửa thân bản tin qua Tiptap KHÔNG được làm hỏng cấu trúc.
 *
 * Lỗi đã xảy ra: `SoanThaoQuanTri` tắt `horizontalRule` + `codeBlock` ("ngoài allowlist" — sai,
 * `lam_sach` giữ cả `hr` lẫn `pre`). Mở một bản tin thật, gõ một dấu phẩy, Lưu ⇒ mất cả 5 `<hr>`,
 * `<pre>` thành `<p>…<br>…</p>`, mọi `<li>` thành `<li><p>…</p></li>`, cuối thân thừa `<p></p>`.
 *
 * Bài này chạy thân THẬT của bot (`mau/ban-tin-that-*.html`, chép từ prod 13/11/2026) qua đúng
 * bộ extension của khu quản trị (`apps/admin/lib/tiptap-quan-tri.ts`, dựng trong Chromium —
 * xem `tiptap-trinh-duyet.ts`) rồi qua `chuanHoaThanBanTin`, đúng đường mà nút "Lưu khung" đi. */

const MAU = resolve(__dirname, "mau");
const THAN_THAT = ["ban-tin-that-truoc-phien-my.html", "ban-tin-that-truoc-phien-vn.html"];

/** Mẫu dựng tay cho thứ hai thân thật không có: `<pre>` nhiều dòng, danh sách đánh số, `<hr>` giữa
 * hai danh sách, danh sách lồng (mục cha có chữ + danh sách con — KHÔNG được gỡ `<p>`). */
const MAU_TAY = [
  "<h3>A</h3>",
  "<ul><li>x <strong>y</strong></li></ul>",
  "<hr>",
  "<pre>dong 1\ndong 2</pre>",
  "<ol><li>mot</li><li>hai <a href=\"https://gikky.net\">link</a></li></ol>",
  "<ul><li>cha<ul><li>con</li></ul></li></ul>",
].join("\n");

const THE_DEM = ["hr", "pre", "h3", "a", "strong", "ul", "ol", "li"] as const;

function demThe(html: string): Record<string, number> {
  const ra: Record<string, number> = {};
  for (const t of THE_DEM) ra[t] = (html.match(new RegExp(`<${t}[\\s>]`, "g")) ?? []).length;
  return ra;
}

test.describe("vòng sửa 1 — round-trip thân bản tin qua Tiptap của khu quản trị", () => {
  for (const ten of [...THAN_THAT, "mẫu dựng tay"]) {
    test(`${ten}: gõ rồi lưu giữ nguyên số thẻ, không còn li > p, không p rỗng cuối`, async ({
      page,
    }) => {
      const goc = ten === "mẫu dựng tay" ? MAU_TAY : readFileSync(resolve(MAU, ten), "utf8");
      const truoc = demThe(goc);
      // Chống đo rỗng: thân thật phải có thứ dễ mất nhất.
      if (ten === THAN_THAT[0]) expect(truoc.hr).toBeGreaterThanOrEqual(5);
      if (ten === "mẫu dựng tay") expect(truoc.pre).toBe(1);

      const khuHoi = await dungTiptap(page);
      const kq = await khuHoi(goc, ",");
      const luu = chuanHoaThanBanTin(kq.sau_go);

      expect(demThe(luu)).toEqual(truoc);
      expect(luu).toContain(",");
      // `li > p` do Tiptap sinh: chỉ còn ở mục có danh sách con (`<li><p>cha</p><ul>`).
      expect(luu.match(/<li><p>[^]*?<\/p><\/li>/g) ?? []).toEqual([]);
      expect(luu).not.toMatch(/<p>\s*<\/p>\s*$/);
      if (ten === "mẫu dựng tay") {
        expect(luu).toMatch(/<pre><code>dong 1\ndong 2<\/code><\/pre>/);
        expect(luu).toMatch(/<li><p>cha<\/p><ul><li>con,<\/li><\/ul><\/li>/);
      }
    });
  }

  test("gõ rồi xoá lại ⇒ không tính là đã sửa (so trên bản chuẩn hoá của cả hai bên)", async ({
    page,
  }) => {
    const khuHoi = await dungTiptap(page);
    for (const ten of THAN_THAT) {
      const goc = readFileSync(resolve(MAU, ten), "utf8");
      const kq = await khuHoi(goc, ", thêm");
      const figures = [{ label: "S&P 500", value: "5.432" }];
      // Trang so `luc_tao` (HTML Tiptap dựng từ thân đang lưu) với thứ đang có trong editor.
      expect(
        khungDaDoi({ body: kq.luc_tao, figures }, { body: kq.go_roi_xoa, figures }),
        ten,
      ).toBe(false);
      expect(khungDaDoi({ body: kq.luc_tao, figures }, { body: kq.sau_go, figures }), ten).toBe(
        true,
      );
    }
  });
});

test("chuanHoaThanBanTin: chỉ gỡ <p> khi li có đúng một <p> con; bỏ p rỗng ở cuối", () => {
  expect(chuanHoaThanBanTin("<ul><li><p>a <strong>b</strong></p></li></ul><p></p>")).toBe(
    "<ul><li>a <strong>b</strong></li></ul>",
  );
  expect(chuanHoaThanBanTin("<ul><li><p>a</p><p>b</p></li></ul>")).toBe(
    "<ul><li><p>a</p><p>b</p></li></ul>",
  );
  expect(chuanHoaThanBanTin("<ul><li><p>cha</p><ul><li><p>con</p></li></ul></li></ul>")).toBe(
    "<ul><li><p>cha</p><ul><li>con</li></ul></li></ul>",
  );
  expect(chuanHoaThanBanTin("<pre><code>x</code></pre><p>a</p><p></p><p></p>")).toBe(
    "<pre><code>x</code></pre><p>a</p>",
  );
  // `<p>` rỗng GIỮA thân là ý của người viết — không đụng.
  expect(chuanHoaThanBanTin("<p>a</p><p></p><p>b</p>")).toBe("<p>a</p><p></p><p>b</p>");
});
