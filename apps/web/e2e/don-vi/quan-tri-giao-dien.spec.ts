import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { quetNguon } from "./quet";

const GOC = resolve(__dirname, "..", "..", "..", "..");
const ADMIN = resolve(GOC, "apps/admin");

/** Hai hàng rào cho lượt dựng lại giao diện khu quản trị (Phase 8, 2026-08-23).
 *
 * Cả hai canh đúng hai loài lỗi mà **chính cách làm của lượt ấy** sinh ra:
 *
 * 1. Giao diện dựng theo một template dashboard có sẵn, và template ấy đầy mục menu
 *    (`E-commerce`, `Charts`, `Widget`, `Documentation`) **không tồn tại ở gikky**. Chép
 *    nhầm một mục sang là một nút dẫn tới 404 mà chỉ mod nhìn thấy — tức gần như không ai
 *    báo. → `MENU`.
 * 2. Khu quản trị chuyển sang Tailwind, và Tailwind mở đúng một cửa mà hệ token đóng:
 *    `bg-[#B33A2B]`. Không hàng rào nào đang có bắt được nó. → `MÀU`.
 *
 * Quét trên bản **đã bỏ chú thích** (`quet.ts`), nên docstring này được phép nhắc tới
 * chính những mã màu nó cấm.
 */

const FILES = quetNguon(ADMIN, /\.tsx?$/);

test("quét trúng apps/admin (chống hàng rào rỗng)", () => {
  expect(FILES.length).toBeGreaterThan(15);
});

/* ===========================================================================
 * MENU — mọi mục phải dẫn tới một trang có thật
 * ========================================================================= */

/** Đường dẫn khai trong `components/khung/menu.ts`, đọc bằng regex trên nguồn.
 *
 * Không `import` file ấy: nó kéo theo `../icon` (JSX) và cả cây React, thứ bộ `don-vi`
 * cố ý không có. Regex ở đây đủ vì `menu.ts` là **dữ liệu tĩnh** — và nó là dữ liệu tĩnh
 * chính vì hàng rào này cần đọc được nó (xem docstring của `menu.ts`).
 */
function duongDanMenu(): string[] {
  const nguon = readFileSync(resolve(ADMIN, "components/khung/menu.ts"), "utf8");
  return [...nguon.matchAll(/duong_dan:\s*"([^"]+)"/g)].map((m) => m[1]);
}

/** `page.tsx` tương ứng một đường dẫn, hoặc `null`. `/` → `app/page.tsx`. */
function trangCho(duong_dan: string): string {
  const phan = duong_dan === "/" ? "" : duong_dan.replace(/^\//, "");
  return resolve(ADMIN, "app", phan, "page.tsx");
}

test("MENU — mọi mục sidebar dẫn tới một page.tsx có thật", () => {
  const duong_dan = duongDanMenu();
  // Chống rỗng: regex hỏng và trả mảng rỗng thì phép kiểm dưới xanh vô nghĩa.
  expect(duong_dan.length).toBeGreaterThanOrEqual(8);
  expect(duong_dan).toContain("/");
  expect(duong_dan).toContain("/bao-cao");

  const chet = duong_dan.filter((d) => !existsSync(trangCho(d)));
  expect(chet, `mục menu không có trang: ${chet.join(", ")}`).toEqual([]);
});

test("MENU — luật trên bắt được một mục giả (chứng minh hàng rào không rỗng)", () => {
  // Ghép chuỗi, không viết liền: viết liền là file này tự nộp mình cho chính regex nó
  // dùng để đọc `menu.ts`, và bài đo trên sẽ đếm cả mục giả này.
  const gia = `duong_dan` + `: "/e-commerce"`;
  const doc_duoc = [...gia.matchAll(/duong_dan:\s*"([^"]+)"/g)].map((m) => m[1]);
  expect(doc_duoc).toEqual(["/e-commerce"]);
  expect(existsSync(trangCho("/e-commerce"))).toBe(false);
});

/* ===========================================================================
 * MÀU — không bản sao bảng màu PLAN 9.1, không màu ứng biến
 * ========================================================================= */

/** Tám mã của hai hệ màu mà **PLAN 9.1 giao luật riêng** — xanh/đỏ lãi-lỗ và hoàng thổ.
 *
 * `apps/web/e2e/don-vi/mau-token.spec.ts` canh chúng ở `apps/web`, và nó **chỉ quét
 * `apps/web`**. Chép bảng ấy sang khu quản trị là dựng một bản sao không ai canh: một nút
 * "xoá" tô đúng mã đỏ lãi-lỗ ở đây sẽ không làm gì đỏ cả, trong khi cùng mã ấy ở
 * `apps/web` bị chặn.
 *
 * Khu quản trị có màu "tốt/xấu" riêng, mã khác hẳn — xem `app/globals.css`.
 */
const HEX_PLAN_91 = [
  "#1C7A4F",
  "#B33A2B",
  "#43BE83",
  "#E4776A",
  "#B07A2B",
  "#F5EBDA",
  "#D8A455",
  "#2A2318",
];

test("MÀU — không mã nào của PLAN 9.1 lọt vào apps/admin", () => {
  const viPham: string[] = [];
  for (const f of FILES) {
    for (const hex of HEX_PLAN_91) {
      if (new RegExp(hex, "i").test(f.sach)) viPham.push(`${f.ten}: ${hex}`);
    }
  }
  expect(viPham).toEqual([]);
});

/** Nơi DUY NHẤT được viết mã màu trong khu quản trị: khối `@theme` của `globals.css`.
 *
 * Tailwind biến `bg-[#…]`, `text-[rgb(…)]` thành một class hợp lệ, nên một mã màu lọt vào
 * TSX vẫn build xanh, vẫn hiện đúng, và vẫn nằm ngoài hệ token. Đó là cách nhanh nhất để
 * "chỉ chỗ này thôi" thành mười chỗ.
 */
const MAU_UNG_BIEN = [
  // `bg-[#fff]`, `text-[#123456]/50`, `border-[#abc]`
  /-\[#[0-9a-fA-F]{3,8}\]/,
  // `bg-[rgb(…)]`, `text-[hsl(…)]`, `bg-[oklch(…)]`
  /-\[(rgb|rgba|hsl|hsla|oklch|lab|color)\(/,
  // `style={{ color: "#fff" }}` — cùng cửa, khác cú pháp.
  /(color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*["'`]#[0-9a-fA-F]{3,8}/,
];

test("MÀU — không giá trị màu ứng biến nào trong apps/admin", () => {
  const viPham: string[] = [];
  for (const f of FILES) {
    for (const mau of MAU_UNG_BIEN) {
      const khop = mau.exec(f.sach);
      if (khop !== null) viPham.push(`${f.ten}: ${khop[0]}`);
    }
  }
  expect(viPham).toEqual([]);
});

test("MÀU — luật trên bắt được hàng giả", () => {
  // Chống rỗng: ba regex hỏng thì hai bài trên xanh mà không canh gì.
  const gia = [
    'className="bg-' + '[#B33A2B]"',
    'className="text-' + "[rgb(1,2,3)]\"",
    'style={{ color: "#' + 'ffffff" }}',
  ];
  for (const [i, mau] of MAU_UNG_BIEN.entries()) {
    expect(mau.test(gia[i]), `regex ${i} không bắt được ${gia[i]}`).toBe(true);
  }
});

test("MÀU — globals.css khai đủ hệ token, và nó là nơi duy nhất có mã hex", () => {
  const css = readFileSync(resolve(ADMIN, "app/globals.css"), "utf8");
  for (const token of [
    "--color-nen",
    "--color-muc",
    "--color-vien",
    "--color-nhan",
    "--color-tot",
    "--color-xau",
    "--color-chuoi-1",
    "--color-chuoi-4",
  ]) {
    expect(css, `thiếu token ${token}`).toContain(token);
  }
  // Theme tối phải khai lại CHÍNH bộ token ấy — thiếu một cái là một màu kẹt ở giá trị
  // sáng trên nền tối, và nó chỉ lộ ra với người dùng chế độ Tối.
  const sang = new Set(
    [...css.matchAll(/^\s{2}(--color-[a-z0-9-]+):/gm)].map((m) => m[1]),
  );
  const khoi_toi = css.slice(css.indexOf('[data-theme="toi"]'));
  const toi = new Set(
    [...khoi_toi.matchAll(/^\s{2}(--color-[a-z0-9-]+):/gm)].map((m) => m[1]),
  );
  expect(sang.size).toBeGreaterThanOrEqual(12);
  expect([...sang].filter((t) => !toi.has(t))).toEqual([]);
});
