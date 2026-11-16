import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

/** Hàng rào đọc file cho checkbox «Ẩn user gikky» ở `/users`. Không server, không DB.
 *
 * Luật domain thuộc Django (`la_email_do_gikky`). Trang chỉ gửi cờ `an_gikky` lấy
 * từ chính state của checkbox — một chuỗi `@gikky.net` ở đây là bản so sánh
 * thứ hai. `/quan-tri-vien` gọi lại cùng endpoint và không được mọc checkbox này.
 */

const GOC = resolve(__dirname, "..", "..", "..", "..");

const TRANG_USERS = "apps/admin/app/users/page.tsx";
const TRANG_QTV = "apps/admin/app/quan-tri-vien/page.tsx";

function doc(tuongDoi: string): string {
  return readFileSync(resolve(GOC, tuongDoi), "utf8");
}

/** `<label>…</label>` bọc `data-testid="an-gikky-user"`. Rỗng nếu testid
 *  không nằm trong một label — checkbox trần không có chữ «Ẩn user gikky» cạnh nó. */
function labelAnGikky(sach: string): string {
  const moc = 'data-testid="an-gikky-user"';
  const i = sach.indexOf(moc);
  if (i < 0) return "";
  const mo = sach.lastIndexOf("<label", i);
  const dong = sach.indexOf("</label>", i);
  if (mo < 0 || dong < 0 || mo > i) return "";
  return sach.slice(mo, dong);
}

test.describe("loc-user-gikky", () => {
  test("trang /users có checkbox nhãn Ẩn user gikky và gọi API bằng state đó", () => {
    const sach = boChuThich(doc(TRANG_USERS));
    const select = sach.indexOf('data-testid="loc-trang-thai-user"');
    const hop = sach.indexOf('data-testid="an-gikky-user"');
    const xoa = sach.indexOf("Xoá bộ lọc");
    expect(select, "thiếu select trạng thái").toBeGreaterThan(0);
    expect(hop, "checkbox không đứng sau select").toBeGreaterThan(select);
    expect(xoa, "nút xoá không đứng sau checkbox").toBeGreaterThan(hop);

    const khoi = labelAnGikky(sach);
    expect(khoi, "testid không nằm trong label").not.toBe("");
    expect(khoi).toContain('type="checkbox"');
    expect(khoi, "nhãn nhìn thấy không phải chữ Ẩn user gikky").toMatch(/>\s*Ẩn user gikky\s*$/);
    expect(khoi, "checkbox bị đẩy sang phải").not.toContain("ml-auto");

    const checked = /checked=\{(\w+)\}/.exec(khoi);
    const doi = /onChange=\{\(e\) => (\w+)\(e\.target\.checked\)\}/.exec(khoi);
    expect(checked, "checkbox không đọc state").not.toBeNull();
    expect(doi, "checkbox không ghi state").not.toBeNull();
    const ten = checked?.[1] ?? "";
    const dat = doi?.[1] ?? "";
    // Shorthand `{ an_gikky }` gửi đúng tên state làm khoá query — nên tên state bị ghim.
    expect(ten, "state của checkbox không tên an_gikky").toBe("an_gikky");

    const dau = sach.indexOf("const nap = useCallback(");
    const cuoi = sach.indexOf(");", dau);
    const nap = dau < 0 || cuoi < 0 ? "" : sach.slice(dau, cuoi);
    expect(nap, "không thấy nap").toContain("quanTriLietKeNguoiDung({");
    expect(nap).toContain("baseUrl: GOC_API");
    const query = /query:\s*\{([^}]*)\}/.exec(nap);
    expect(query, "lời gọi không có query").not.toBeNull();
    const than = query?.[1] ?? "";
    const shorthand = new RegExp(`(^|,)\\s*${ten}\\s*(,|$)`).test(than);
    const gan = new RegExp(`\\ban_gikky\\s*:\\s*${ten}\\b`).test(than);
    expect(shorthand || gan, "query không truyền state của checkbox").toBe(true);
    const deps = /\[([^\]]*)\]\s*,\s*$/.exec(nap);
    expect(deps?.[1] ?? "", "deps của nap thiếu state").toContain(ten);

    const loc = /const co_bo_loc = ([^;]+);/.exec(sach);
    expect(loc?.[1] ?? "", "co_bo_loc không gồm checkbox").toContain(ten);
    expect(sach, "Xoá bộ lọc không bỏ tích").toContain(`${dat}(false)`);
  });

  test("trang /users không tự so domain", () => {
    const nguon = doc(TRANG_USERS);
    expect(nguon).not.toContain("@gikky.net");
    expect(nguon).not.toContain("endsWith");
  });

  test("trang /quan-tri-vien không có checkbox này", () => {
    const sach = boChuThich(doc(TRANG_QTV));
    expect(sach).not.toContain("an-gikky-user");
    expect(sach).not.toMatch(/type="checkbox"[\s\S]{0,120}(Ẩn user gikky|Gikky)/i);
    const goi = sach.slice(sach.indexOf("quanTriLietKeNguoiDung("));
    const query = /query:\s*\{([^}]*)\}/.exec(goi);
    expect(query?.[1] ?? "").not.toMatch(/\b(an_)?gikky\b/);
  });
});
