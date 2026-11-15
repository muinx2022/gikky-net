import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

/** Hàng rào đọc file cho nhãn «do Gikky tạo». Không server, không DB.
 *
 * Luật domain thuộc Django (`la_email_do_gikky`). Hai trang quản trị chỉ được
 * render cờ `do_gikky_tao` — một chuỗi `@gikky.net` ở đây là bản so sánh thứ hai.
 */

const GOC = resolve(__dirname, "..", "..", "..", "..");

const TRANG_USERS = "apps/admin/app/users/page.tsx";
const TRANG_HO_SO = "apps/admin/app/u/[username]/page.tsx";

function doc(tuongDoi: string): string {
  return readFileSync(resolve(GOC, tuongDoi), "utf8");
}

/** Thân hàm Python cấp module: từ `def ten(` tới `def ` kế tiếp ở cột 0. */
function hamPython(nguon: string, ten: string): string {
  const dau = `def ${ten}(`;
  const i = nguon.indexOf(dau);
  if (i < 0) return "";
  const sau = nguon.slice(i + dau.length);
  const ke = sau.search(/\ndef [A-Za-z_]/);
  return dau + (ke < 0 ? sau : sau.slice(0, ke));
}

test.describe("nhan-email-gikky", () => {
  test("hai trang render do_gikky_tao và chữ «do Gikky tạo» bằng tone nhan", () => {
    for (const duong of [TRANG_USERS, TRANG_HO_SO]) {
      const sach = boChuThich(doc(duong));
      expect(sach, `${duong} thiếu cờ`).toContain("do_gikky_tao");
      expect(sach, `${duong} thiếu chữ nhãn`).toMatch(
        /do_gikky_tao[\s\S]{0,240}tone="nhan"[\s\S]{0,80}do Gikky tạo/,
      );
    }
  });

  test("hai trang không tự so domain", () => {
    for (const duong of [TRANG_USERS, TRANG_HO_SO]) {
      expect(doc(duong), duong).not.toContain("@gikky.net");
    }
  });

  test("bảng đặt nhãn ở ô Tài khoản, trước cột Trạng thái mờ khi hover", () => {
    const sach = boChuThich(doc(TRANG_USERS));
    const nhan = sach.indexOf("do Gikky tạo");
    const cotMo = sach.indexOf("md:group-hover:opacity-0");
    expect(nhan, "không thấy nhãn").toBeGreaterThan(0);
    expect(cotMo, "không thấy cột Trạng thái").toBeGreaterThan(0);
    expect(nhan).toBeLessThan(cotMo);
  });

  test("la_email_do_gikky giữ domain gikky.net", () => {
    const ham = hamPython(doc("api/api/quan_tri_nguoi_dung.py"), "la_email_do_gikky");
    expect(ham, "không thấy hàm").not.toBe("");
    expect(ham).toContain('domain == "gikky.net"');
  });
});
