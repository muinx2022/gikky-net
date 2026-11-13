import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

import type { Page } from "@playwright/test";

/** Dựng ĐÚNG bộ extension Tiptap của khu quản trị (`apps/admin/lib/tiptap-quan-tri.ts`) trong một
 * trang Chromium trống — cho bài đo round-trip `quan-tri-ban-tin-tiptap.spec.ts` (vòng sửa 1, đợt D).
 *
 * ## Vì sao trình duyệt, không phải `@tiptap/html` + DOM giả
 *
 * ProseMirror cần `DOMParser` để nạp HTML, và repo không có `jsdom` / `happy-dom` / `@tiptap/html`
 * (thêm phụ thuộc mới cho một bài đo là việc của phiên chính). Chromium của Playwright thì đã
 * có sẵn (`npx playwright install chromium`, bước bắt buộc của máy mới). Vẫn đúng tinh thần
 * `pnpm e2e:don-vi`: **không server, không cổng, không DB** — mọi file được phục vụ bằng
 * `page.route` trên một origin giả `http://tiptap.test`.
 *
 * ## Không bundler: tự phân giải import
 *
 * Mỗi module ESM được trả nguyên văn, chỉ viết lại các specifier trần (`@tiptap/core`…) thành
 * URL tuyệt đối tới file thật trong `node_modules` (đi theo symlink của pnpm, `exports` của
 * `package.json`). Cùng một file thật ⇒ cùng một URL ⇒ cùng một instance module, nên
 * `@tiptap/core` của StarterKit và của `Editor` dưới đây là MỘT. File `.ts` của admin đi qua
 * `typescript.transpileModule`.
 */

const ADMIN = realpathSync(resolve(__dirname, "..", "..", "..", "admin"));
const GOC = "http://tiptap.test";
const TIEN_TO = `${GOC}/fs/`;

const yeuCau = createRequire(join(ADMIN, "package.json"));
const ts = yeuCau("typescript") as typeof import("typescript");

type XuatKhau = string | { [k: string]: XuatKhau } | null;

function chonXuat(e: XuatKhau): string | null {
  if (typeof e === "string") return e;
  if (e !== null && typeof e === "object") {
    for (const k of ["browser", "import", "module", "default"]) {
      if (k in e) {
        const r = chonXuat(e[k]);
        if (r !== null) return r;
      }
    }
  }
  return null;
}

function timGoi(spec: string, tu_thu_muc: string): string {
  const phan = spec.split("/");
  const ten = spec.startsWith("@") ? phan.slice(0, 2).join("/") : phan[0];
  const con = spec.slice(ten.length);
  for (let d = tu_thu_muc; ; d = dirname(d)) {
    const ung_vien = join(d, "node_modules", ten);
    if (existsSync(join(ung_vien, "package.json"))) {
      const that = realpathSync(ung_vien);
      const pj = JSON.parse(readFileSync(join(that, "package.json"), "utf8"));
      let tuong_doi: string | null = null;
      if (pj.exports !== undefined) {
        const ex =
          typeof pj.exports === "string" || "import" in pj.exports || "default" in pj.exports
            ? { ".": pj.exports }
            : pj.exports;
        tuong_doi = chonXuat(ex[`.${con}`] ?? null);
      }
      tuong_doi ??= con !== "" ? `.${con}` : (pj.module ?? pj.main ?? "index.js");
      return join(that, tuong_doi as string);
    }
    if (dirname(d) === d) throw new Error(`không phân giải được ${spec} từ ${tu_thu_muc}`);
  }
}

const sangUrl = (p: string) => TIEN_TO + p.replaceAll("\\", "/");

function vietLaiImport(ma: string, tep: string): string {
  const thu_muc = dirname(tep);
  const doi = (cu: string, truoc: string, nhay: string, spec: string) => {
    if (/^(\.|\/|http)/.test(spec) || !/^[@a-z][\w@/.-]*$/i.test(spec)) return cu;
    return truoc + nhay + sangUrl(timGoi(spec, thu_muc)) + nhay;
  };
  return ma
    .replace(/(\bfrom\s*)(["'])([^"']+)\2/g, (m, a, q, s) => doi(m, a, q, s))
    .replace(/(\bimport\s*)(["'])([^"']+)\2/g, (m, a, q, s) => doi(m, a, q, s))
    .replace(/(\bimport\(\s*)(["'])([^"']+)\2/g, (m, a, q, s) => doi(m, a, q, s));
}

function docModule(tep: string): string {
  const nguon = readFileSync(tep, "utf8");
  const js = tep.endsWith(".ts")
    ? ts.transpileModule(nguon, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
    : nguon;
  return vietLaiImport(js, tep);
}

/** Kết quả một lượt nạp → (gõ) → xuất HTML trong editor. */
export type KhuHoi = {
  /** HTML ngay sau khi nạp (`onCreate` — mốc so của trang bản tin). */
  luc_tao: string;
  /** HTML sau khi gõ `go` ở cuối thân (`onUpdate` — thứ trang gửi đi khi Lưu). */
  sau_go: string;
  /** HTML sau khi gõ `go` rồi xoá đúng chừng ấy ký tự. */
  go_roi_xoa: string;
};

/** Mở trang trống, nạp Tiptap với `phanMoRongQuanTri()`. Gọi một lần mỗi bài. */
export async function dungTiptap(page: Page): Promise<(html: string, go: string) => Promise<KhuHoi>> {
  const loi: string[] = [];
  page.on("pageerror", (e) => loi.push(e.message));
  const tep_mo_rong = join(ADMIN, "lib", "tiptap-quan-tri.ts");
  const tep_core = timGoi("@tiptap/core", realpathSync(join(ADMIN, "node_modules", "@tiptap", "starter-kit")));
  const loi_vao = `
    import { Editor } from "${sangUrl(tep_core)}";
    import { phanMoRongQuanTri } from "${sangUrl(tep_mo_rong)}";
    const html = (e) => (e.isEmpty ? "" : e.getHTML());
    window.khuHoi = async (noi_dung, go) => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      let luc_tao = null;
      let da_tao;
      const cho_tao = new Promise((r) => { da_tao = r; });
      const ed = new Editor({
        element: el,
        content: noi_dung,
        extensions: phanMoRongQuanTri(),
        // Tiptap phát "create" ở tick sau — chờ đúng sự kiện mà SoanThaoQuanTri.onTaoXong nghe.
        onCreate: ({ editor }) => { luc_tao = html(editor); da_tao(); },
      });
      await cho_tao;
      ed.commands.focus("end");
      const tu = ed.state.selection.from;
      ed.commands.insertContent(go);
      const sau_go = html(ed);
      ed.commands.deleteRange({ from: tu, to: tu + go.length });
      const go_roi_xoa = html(ed);
      ed.destroy();
      el.remove();
      return { luc_tao, sau_go, go_roi_xoa };
    };
  `;
  await page.route(`${GOC}/**`, async (route) => {
    const url = route.request().url();
    if (url === `${GOC}/`) {
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><body><script type=module src='/vao.js'></script></body></html>",
      });
    }
    if (url === `${GOC}/vao.js`) {
      return route.fulfill({ contentType: "application/javascript", body: loi_vao });
    }
    const tep = decodeURIComponent(url.slice(TIEN_TO.length));
    return route.fulfill({ contentType: "application/javascript", body: docModule(tep) });
  });
  await page.goto(`${GOC}/`);
  await page
    .waitForFunction(() => typeof (window as unknown as { khuHoi?: unknown }).khuHoi === "function", null, {
      timeout: 30_000,
    })
    .catch(() => {
      throw new Error(`không dựng được Tiptap trong trình duyệt: ${loi.join(" | ")}`);
    });
  return (html: string, go: string) =>
    page.evaluate(
      ([h, g]) =>
        (window as unknown as { khuHoi: (h: string, g: string) => Promise<KhuHoi> }).khuHoi(h, g),
      [html, go] as const,
    );
}
