import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

/** Hàng rào đọc file cho chấm «do Gikky tạo». Không server, không DB.
 *
 * Luật domain thuộc Django (`la_email_do_gikky`). Hai trang quản trị chỉ được
 * render cờ `do_gikky_tao` — một chuỗi `@gikky.net` ở đây là bản so sánh thứ hai.
 * Trong khung tên, đúng một span tự đóng mang lớp
 * `absolute -top-1 -right-2 size-2 rounded-full bg-nhan`, nằm trong
 * `{u.do_gikky_tao && ( … )}`, và chính span đó có `title`, `aria-label`,
 * `role="img"`. Gắn `aria-label` lên `h1` không tính. Gỡ hai thuộc tính ấy
 * rồi file không còn chuỗi «do Gikky tạo» (kể cả dạng `{"do Gikky tạo"}`).
 *
 * Chú thích JSX giữa `Link` và cờ bị `boChuThich` gỡ, chỉ còn `{}`. Hàng rào
 * đọc bản đã gỡ, không bám vào chữ chú thích.
 *
 * `!u.do_gikky_tao &&` vẫn chứa chuỗi `u.do_gikky_tao &&`, nên cờ phải khớp
 * dạng dương. `</span>` đầu tiên sau `relative inline-block` là mép khung:
 * chấm đứng sau mép ấy là chấm đã ra ngoài.
 */

const GOC = resolve(__dirname, "..", "..", "..", "..");

const TRANG_USERS = "apps/admin/app/users/page.tsx";
const TRANG_HO_SO = "apps/admin/app/u/[username]/page.tsx";

const LOP_CHAM = "absolute -top-1 -right-2 size-2 rounded-full bg-nhan";
const CHU_CHAM = "do Gikky tạo";
const THUOC_TITLE = `title="${CHU_CHAM}"`;
const THUOC_ARIA = `aria-label="${CHU_CHAM}"`;

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

/** Từ `relative inline-block` tới `</span>` đóng khung. Không có `</span>`
 *  nào chen giữa mép này và chấm — chấm tự đóng bằng `/>`. */
function khungTen(sach: string): string {
  const moc = "relative inline-block";
  const i = sach.indexOf(moc);
  if (i < 0) return "";
  const sau = sach.slice(i);
  const dong = sau.indexOf("</span>");
  if (dong < 0) return "";
  return sau.slice(0, dong);
}

function soLan(s: string, chuoi: string): number {
  return s.split(chuoi).length - 1;
}

/** `<span … />` tự đóng chứa đúng chuỗi lớp. Rỗng nếu lớp nằm thẻ khác
 *  hoặc thẻ đã đóng bằng `>`. */
function theSpanCham(khung: string): string {
  const i = khung.indexOf(LOP_CHAM);
  if (i < 0) return "";
  const mo = khung.lastIndexOf("<span", i);
  if (mo < 0) return "";
  const dong = khung.indexOf("/>", i);
  if (dong < 0) return "";
  const the = khung.slice(mo, dong + 2);
  if (!the.startsWith("<span")) return "";
  if (the.slice(0, -2).includes(">")) return "";
  return the;
}

/** Span nằm giữa cặp ngoặc của `{u.do_gikky_tao && ( … )}`.
 *  `{u.do_gikky_tao && null}` không mở ngoặc, nên span đứng sau không tính. */
function spanTrongCo(khung: string, the: string): boolean {
  if (the === "") return false;
  const re = /\{u\.do_gikky_tao && \(([\s\S]*?)\)\s*\}/g;
  for (const khoi of khung.matchAll(re)) {
    if (khoi[1].includes(the)) return true;
  }
  return false;
}

/** Gỡ đúng hai thuộc tính mang chữ nhãn. `{"do Gikky tạo"}` không phải thuộc
 *  tính ấy nên còn lại trong file. */
function goHaiThuocTinh(s: string): string {
  return s.replaceAll(THUOC_TITLE, "").replaceAll(THUOC_ARIA, "");
}

test.describe("nhan-email-gikky", () => {
  test("hai trang gắn chấm tròn theo cờ do_gikky_tao", () => {
    for (const duong of [TRANG_USERS, TRANG_HO_SO]) {
      const sach = boChuThich(doc(duong));
      const khung = khungTen(sach);
      expect(khung, `${duong} thiếu khung tên`).not.toBe("");
      expect(khung, `${duong} khung không chứa tên`).toContain(
        "{u.display_name || u.username}",
      );
      expect(khung, `${duong} chấm không theo cờ dương`).toMatch(
        /(?:^|[^!])u\.do_gikky_tao &&/,
      );
      expect(soLan(khung, LOP_CHAM), `${duong} phải đúng một chấm`).toBe(1);
      const the = theSpanCham(khung);
      expect(the, `${duong} chấm không phải span tự đóng`).toMatch(/^<span\b[\s\S]*\/>$/);
      expect(the.slice(0, -2), `${duong} span không tự đóng`).not.toContain(">");
      expect(spanTrongCo(khung, the), `${duong} span không nằm trong cờ`).toBe(true);
      expect(the, `${duong} thiếu title trên chấm`).toContain(THUOC_TITLE);
      expect(the, `${duong} thiếu aria-label trên chấm`).toContain(THUOC_ARIA);
      expect(the, `${duong} thiếu role img trên chấm`).toContain('role="img"');
      expect(
        goHaiThuocTinh(sach),
        `${duong} còn chữ «do Gikky tạo» ngoài title và aria-label`,
      ).not.toContain(CHU_CHAM);
    }
  });

  test("hai trang không tự so domain", () => {
    for (const duong of [TRANG_USERS, TRANG_HO_SO]) {
      expect(doc(duong), duong).not.toContain("@gikky.net");
    }
  });

  test("bảng đặt chấm ở khung tên, trước cột Trạng thái mờ khi hover", () => {
    const sach = boChuThich(doc(TRANG_USERS));
    const cham = sach.indexOf('aria-label="do Gikky tạo"');
    const cotMo = sach.indexOf("md:group-hover:opacity-0");
    expect(cham, "không thấy chấm").toBeGreaterThan(0);
    expect(cotMo, "không thấy cột Trạng thái").toBeGreaterThan(0);
    expect(cham).toBeLessThan(cotMo);
  });

  test("la_email_do_gikky giữ domain gikky.net", () => {
    const ham = hamPython(doc("api/api/quan_tri_nguoi_dung.py"), "la_email_do_gikky");
    expect(ham, "không thấy hàm").not.toBe("");
    expect(ham).toContain('domain == "gikky.net"');
  });
});
