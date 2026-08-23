import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import {
  CAC_THEME,
  KHOA_THEME,
  THEME_MAC_DINH,
  docLuaChon,
  luocDoMau,
  nguonScriptTheme,
  thuocTinhTheme,
} from "../../lib/theme";
import {
  CAC_KIEU_XEM,
  KHOA_KIEU_XEM,
  KIEU_XEM_MAC_DINH,
  docKieuXem,
  nguonScriptKieuXem,
} from "../../lib/kieu-xem";
import { boChuThich } from "./quet";

const WEB = resolve(__dirname, "..", "..");

/** Công tắc theme + kiểu xem — phần đo được **không cần trình duyệt**.
 *
 * Nửa còn lại (không FOUC, không server-render, lựa chọn sống qua reload) đo bằng
 * Playwright thật ở `e2e/sang-toi.spec.ts`. Chia đôi vì hai nửa trả lời hai câu khác nhau:
 * ở đây là *"logic có đúng không"*, ở đó là *"nó có chạy đúng lúc không"*.
 *
 * ## Bài quan trọng nhất của file: script inline khớp với hàm
 *
 * `nguonScriptTheme()` **lặp lại** logic của `thuocTinhTheme`/`luocDoMau` bằng ES5, vì nó
 * chạy trước cả bundle. Bản sao ấy là bản sao thật, không phải hình thức — và cách duy
 * nhất giữ nó khỏi trôi là **chạy nó** trên một DOM giả rồi so kết quả với hai hàm kia,
 * cho cả ba lựa chọn. Không có bài đó thì đổi tên khoá hay đổi giá trị `data-theme` chỉ
 * hỏng ở một nửa, và nửa hỏng là nửa chạy lúc tải trang.
 */

/** `<html>` giả đủ dùng cho script inline: bốn thao tác nó gọi, không hơn. */
function gocGia() {
  const thuoc = new Map<string, string>();
  const style: Record<string, string> = {};
  return {
    style,
    thuoc,
    setAttribute: (k: string, v: string) => void thuoc.set(k, v),
    removeAttribute: (k: string) => void thuoc.delete(k),
  };
}

/** Chạy chuỗi script inline với `localStorage` và `document` giả. */
function chayScript(nguon: string, luu: Record<string, string>) {
  const goc = gocGia();
  const localStorage = { getItem: (k: string) => luu[k] ?? null };
  // `new Function` chứ không `eval`: nó nhận đúng hai thứ script cần và không thấy gì
  // khác của phạm vi bài đo — nên một script vô tình đụng vào biến ngoài sẽ ném ở đây.
  new Function("localStorage", "document", nguon)(localStorage, {
    documentElement: goc,
  });
  return goc;
}

test("script inline khớp ĐÚNG với thuocTinhTheme/luocDoMau ở cả ba lựa chọn", () => {
  for (const chon of CAC_THEME) {
    const goc = chayScript(nguonScriptTheme(), { [KHOA_THEME]: chon });
    const mong = thuocTinhTheme(chon);
    expect(goc.thuoc.get("data-theme") ?? null, `theme=${chon}`).toBe(mong);
    expect(goc.style.colorScheme, `color-scheme khi theme=${chon}`).toBe(luocDoMau(chon));
  }
});

test('"theo hệ thống" phải GỠ data-theme, không đặt một giá trị thứ ba', () => {
  // Bảng token ở `globals.css` viết luật dark là `@media (prefers-color-scheme: dark)` +
  // `:root:not([data-theme="light"])`. Một `data-theme="he"` nằm đó không khớp nhánh nào
  // ⇒ trang mắc kẹt ở sáng ngay trên một máy đang để tối.
  expect(thuocTinhTheme(THEME_MAC_DINH)).toBeNull();
  const goc = chayScript(nguonScriptTheme(), { [KHOA_THEME]: THEME_MAC_DINH });
  expect(goc.thuoc.has("data-theme")).toBe(false);
  expect(goc.style.colorScheme).toBe("light dark");
});

test("localStorage rỗng hoặc RÁC ⇒ về mặc định, không ném", () => {
  expect(docLuaChon(null)).toBe(THEME_MAC_DINH);
  expect(docLuaChon("")).toBe(THEME_MAC_DINH);
  expect(docLuaChon("dark")).toBe(THEME_MAC_DINH); // giá trị của một thư viện khác
  const goc = chayScript(nguonScriptTheme(), { [KHOA_THEME]: "rac" });
  expect(goc.thuoc.has("data-theme")).toBe(false);
});

test("script inline sống sót khi localStorage NÉM (cookie bị chặn hoàn toàn)", () => {
  // Không có `try/catch` thì ngoại lệ này nổ trong `<head>` và **cả trang không có theme
  // nào** — hỏng nặng hơn hẳn thứ nó đang canh.
  const goc = gocGia();
  const nem = {
    getItem() {
      throw new Error("SecurityError");
    },
  };
  expect(() =>
    new Function("localStorage", "document", nguonScriptTheme())(nem, {
      documentElement: goc,
    }),
  ).not.toThrow();
});

test("script inline đọc ĐÚNG khoá đã khai (đổi hằng mà quên script ⇒ đỏ)", () => {
  expect(nguonScriptTheme()).toContain(JSON.stringify(KHOA_THEME));
  expect(nguonScriptKieuXem()).toContain(JSON.stringify(KHOA_KIEU_XEM));
  // Hai khoá phải KHÁC nhau — một khoá dùng cho hai lựa chọn là đổi theme thì mất kiểu xem.
  expect(KHOA_THEME).not.toBe(KHOA_KIEU_XEM);
});

test("kiểu xem: script inline khớp hàm, và mặc định GỠ thuộc tính", () => {
  for (const kieu of CAC_KIEU_XEM) {
    const goc = chayScript(nguonScriptKieuXem(), { [KHOA_KIEU_XEM]: kieu });
    if (kieu === KIEU_XEM_MAC_DINH) expect(goc.thuoc.has("data-kieu-xem")).toBe(false);
    else expect(goc.thuoc.get("data-kieu-xem")).toBe(kieu);
  }
  expect(docKieuXem("rac")).toBe(KIEU_XEM_MAC_DINH);
});

test("T3 — layout NHÚNG script vào <head>, không phải cuối <body>", () => {
  // Đây là vế cấu trúc của "không FOUC". Vế hành vi đo bằng trình duyệt ở
  // `sang-toi.spec.ts`; vế này bắt được ca script bị dời chỗ mà bài kia chưa chạy tới.
  const nguon = boChuThich(readFileSync(resolve(WEB, "app/layout.tsx"), "utf8"));
  const dau_head = nguon.indexOf("<head>");
  const cuoi_head = nguon.indexOf("</head>");
  const tai_script = nguon.indexOf("nguonScriptTheme()");
  const tai_kieu = nguon.indexOf("nguonScriptKieuXem()");
  expect(dau_head, "layout phải có <head> tường minh").toBeGreaterThan(-1);
  expect(tai_script).toBeGreaterThan(dau_head);
  expect(tai_script).toBeLessThan(cuoi_head);
  expect(tai_kieu).toBeGreaterThan(dau_head);
  expect(tai_kieu).toBeLessThan(cuoi_head);
});

test("T3 — KHÔNG chỗ nào đọc theme từ cookie hay từ phía server", () => {
  // Luật cứng của lượt này: theme không được đi qua HTML đã cache (PLAN 8.4). Cửa duy
  // nhất có thể mở nó là ai đó đọc `cookies()` rồi đặt `data-theme` ở server. Ở đây ghim
  // rằng khoá theme **chỉ** xuất hiện cạnh `localStorage`, không cạnh `cookie`.
  const theme = boChuThich(readFileSync(resolve(WEB, "lib/theme.ts"), "utf8"));
  const kieu = boChuThich(readFileSync(resolve(WEB, "lib/kieu-xem.ts"), "utf8"));
  const layout = boChuThich(readFileSync(resolve(WEB, "app/layout.tsx"), "utf8"));
  for (const [ten, nguon] of [
    ["lib/theme.ts", theme],
    ["lib/kieu-xem.ts", kieu],
  ] as const) {
    expect(nguon, `${ten} không được nhắc tới cookie`).not.toMatch(/\bcookies?\b/i);
  }
  expect(layout, "layout không được đọc cookies()").not.toMatch(/\bcookies\s*\(/);
  expect(theme).toContain("localStorage");
});
