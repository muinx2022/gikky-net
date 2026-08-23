import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const GOC = resolve(__dirname, "..", "..", "..", "..");
const SCRIPT = resolve(GOC, "scripts", "setup-env.mjs");
const MAU = resolve(GOC, "api", ".env.example");

/** `pnpm setup:env` trên một **CLONE SẠCH** — Z12 của lượt vá V1 (nợ L07).
 *
 * ## Vì sao bài đo này tồn tại
 *
 * `api/.env` không nằm trong repo, nên mọi con số của bộ e2e đều đo trên một máy **đã có**
 * file ấy. Cái trôi mất trong khoảng đó là `REVALIDATE_SECRET`: mẫu để nó RỖNG, rỗng nghĩa
 * là cửa `/lam-moi-cache` tắt hẳn (fail-closed), và `e2e/du-lieu.ts::lamMoiCacheTrang`
 * **ném** khi secret rỗng — trong `beforeAll` của ba file spec. Hệ quả đo được:
 * clone sạch → `pnpm setup:env` → `pnpm e2e` ⇒ **≥42 bài đỏ**, ở một file nói về cột vote.
 * Con số "365 e2e" chỉ tái lập được trên máy đã đặt tay biến đó.
 *
 * ## Bài đo chạy THẬT script, trong một thư mục tạm
 *
 * Không grep mã nguồn script (một hàng rào chữ), và không đụng `api/.env` của máy đang
 * chạy. `scripts/setup-env.mjs` nhận `GIKKY_GOC_REPO` để trỏ gốc repo đi chỗ khác — biến
 * ấy tồn tại **cho đúng bài đo này**, và nó được ghi ra ở chính script.
 */

function cloneSach(): string {
  const goc = mkdtempSync(resolve(tmpdir(), "gikky-clone-"));
  mkdirSync(resolve(goc, "api"));
  writeFileSync(resolve(goc, "api", ".env.example"), readFileSync(MAU, "utf8"), "utf8");
  return goc;
}

function chay(goc: string): string {
  return execFileSync(process.execPath, [SCRIPT], {
    env: { ...process.env, GIKKY_GOC_REPO: goc },
    encoding: "utf8",
  });
}

function doc(goc: string, ten: string): string {
  const noi_dung = readFileSync(resolve(goc, "api", ".env"), "utf8");
  return new RegExp(`^${ten}=(.*)$`, "m").exec(noi_dung)?.[1].trim() ?? "";
}

test("clone sạch: setup:env sinh CẢ SECRET_KEY lẫn REVALIDATE_SECRET, không rỗng", () => {
  const goc = cloneSach();
  chay(goc);

  expect(existsSync(resolve(goc, "api", ".env"))).toBe(true);
  expect(doc(goc, "SECRET_KEY").length).toBeGreaterThan(30);
  expect(doc(goc, "REVALIDATE_SECRET").length).toBeGreaterThan(20);
});

test("hai giá trị sinh ra là NGẪU NHIÊN, không phải chuỗi trong repo", () => {
  // Giá trị nằm trong `.env.example` là giá trị ai đọc repo cũng biết. Với `SECRET_KEY` đó
  // là khoá ký cookie phiên (giả mạo phiên được); với `REVALIDATE_SECRET` đó là chìa của
  // một cửa ép Next đi fetch lại trang.
  const mau = readFileSync(MAU, "utf8");
  const a = cloneSach();
  const b = cloneSach();
  chay(a);
  chay(b);

  for (const ten of ["SECRET_KEY", "REVALIDATE_SECRET"]) {
    expect(doc(a, ten)).not.toBe(doc(b, ten));
    expect(mau).not.toContain(doc(a, ten));
  }
});

test("secret sinh ra dùng được LÀM secret: không có ký tự phá cú pháp .env", () => {
  // base64url — không `=`, không `+`, không `/`, không khoảng trắng. Một dấu `=` lọt vào là
  // dòng `.env` bị cắt sai và cả hai bên đọc ra hai chuỗi khác nhau ⇒ cửa trả 401, im lặng.
  const goc = cloneSach();
  chay(goc);
  for (const ten of ["SECRET_KEY", "REVALIDATE_SECRET"]) {
    expect(doc(goc, ten)).toMatch(/^[A-Za-z0-9_-]+$/);
  }
});

test("KHÔNG đè `.env` đã có — file đó là cấu hình thật của máy", () => {
  const goc = cloneSach();
  writeFileSync(resolve(goc, "api", ".env"), "SECRET_KEY=cua-toi\nREVALIDATE_SECRET=cua-toi\n");
  const ra = chay(goc);

  expect(ra).toContain("đã có");
  expect(doc(goc, "SECRET_KEY")).toBe("cua-toi");
});

test("mẫu thiếu dòng REVALIDATE_SECRET ⇒ DỪNG, không chép nửa vời", () => {
  // Fail-closed đối xứng với `SECRET_KEY`: chép một `.env` thiếu dòng ấy nghĩa là cửa làm
  // mới cache tắt trên một máy vừa clone, và triệu chứng rơi xuống 42 bài đo ở chỗ khác.
  const goc = cloneSach();
  const mau = readFileSync(MAU, "utf8").replace(/^REVALIDATE_SECRET=.*$/m, "# gỡ đi");
  writeFileSync(resolve(goc, "api", ".env.example"), mau, "utf8");

  expect(() => chay(goc)).toThrow();
  expect(existsSync(resolve(goc, "api", ".env"))).toBe(false);
});

test("`.env` sinh ra đủ để `secretLamMoiCache()` của playwright đọc được", () => {
  // Nối hai đầu: script ghi, và **đúng hàm** mà `playwright.config.ts` dùng để truyền
  // secret cho tiến trình Next phải đọc lại được. Hai bên dùng cùng một định dạng dòng,
  // nhưng chúng là hai đoạn code khác nhau — đây là chỗ duy nhất bắt chúng khớp.
  const goc = cloneSach();
  chay(goc);
  const noi_dung = readFileSync(resolve(goc, "api", ".env"), "utf8");
  const nhu_playwright = /^REVALIDATE_SECRET=(.*)$/m.exec(noi_dung)?.[1].trim() ?? "";
  expect(nhu_playwright).not.toBe("");
  expect(nhu_playwright).toBe(doc(goc, "REVALIDATE_SECRET"));
});
