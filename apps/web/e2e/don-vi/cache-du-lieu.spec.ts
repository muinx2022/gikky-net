import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const GOC = resolve(__dirname, "..", "..", "..", "..");
const DUONG_DAN = resolve(GOC, "scripts/xoa-cache-du-lieu.mjs");

/** **L41** — cache dữ liệu của Next sống qua `next build` ⇒ 500 trên prod sau deploy.
 *
 * ## Lỗi thật, đo được, không phải giả định
 *
 * Sau lượt gộp Phase 5 (thẻ mốc mọc trường **bắt buộc** `anhs`), trang mạch ném
 * `TypeError: Cannot read properties of undefined (reading 'length')` ở `stringify` —
 * tức **HTTP 500** với người dùng thật, không phải render thiếu một tấm ảnh. Nguyên nhân:
 * `.next/cache/fetch-cache` giữ nguyên body Django trả về ở lần build TRƯỚC, và khoá
 * cache tính từ URL nên bản mới đọc thẳng vào bản cũ. `rm -rf .next/cache` ⇒ hết ngay.
 * Đây cũng là nguyên nhân thật của "flake 1/3" ở bài đo vote (L36).
 *
 * ## Bài này đo cái gì — và KHÔNG đo cái gì
 *
 * **Đo:** cơ chế dọn dẹp có xoá đúng thứ phải xoá, có giữ đúng thứ phải giữ, và **có
 * được nối vào lệnh build hay không**. Vế cuối là vế dễ mất nhất: một hàm đúng nằm mồ côi
 * trong `scripts/` thì L41 vẫn nguyên vẹn trên prod, và không gì đỏ.
 *
 * **Không đo:** rằng Next 15.5 thật sự crash khi gặp payload thiếu trường. Chuyện đó đã
 * xảy ra một lần trên cây này và được ghi vào `LOI-VA-NO.md` kèm nguyên văn stack trace;
 * dựng lại nó trong một bài đo đơn vị đòi chạy cả một vòng build → deploy → build, tức
 * đúng thứ chỉ lộ ra sau khi deploy. Ở đây thay bằng một payload **thật sự thiếu trường**
 * ghi vào đúng bố cục thư mục thật, và bài đo đòi nó không sống sót qua bước dọn.
 */

type Mod = {
  xoaCacheDuLieu: (gocNext: string) => string[];
  THU_MUC_CACHE_DU_LIEU: readonly string[];
  THU_MUC_GIU_LAI: readonly string[];
};

async function nap(): Promise<Mod> {
  return (await import(pathToFileURL(DUONG_DAN).href)) as unknown as Mod;
}

/** Dựng lại bố cục `.next/cache` THẬT, kèm một payload đúng hình dạng đã gây ra L41.
 *
 * Payload là một thẻ mốc **thiếu `anhs`** — chính cái body mà lần build trước ghi vào,
 * và chính lý do bản build sau đọc `undefined.length`. Dùng một chuỗi rác vô nghĩa thì
 * bài đo vẫn xanh y hệt, nhưng nó thôi kể được mình đang chặn cái gì.
 */
function dungCay(): { goc: string; duLieu: string; bienDich: string } {
  const tam = mkdtempSync(join(tmpdir(), "gikky-l41-"));
  const goc = join(tam, ".next");
  const du_lieu = join(goc, "cache", "fetch-cache");
  const bien_dich = join(goc, "cache", "webpack");
  mkdirSync(du_lieu, { recursive: true });
  mkdirSync(bien_dich, { recursive: true });
  mkdirSync(join(goc, "cache", "swc"), { recursive: true });
  writeFileSync(
    join(du_lieu, "a1b2c3"),
    JSON.stringify({
      kind: "FETCH",
      data: {
        body: Buffer.from(
          // Mốc của bản CŨ: có `body`, `seq`, `id` — **không có `anhs`**.
          JSON.stringify({ id: 7, seq: 1, body: "vào 27.80", figures: null }),
        ).toString("base64"),
        status: 200,
        url: "http://localhost:8000/api/v1/machs/7",
      },
      revalidate: 3600,
    }),
    "utf8",
  );
  writeFileSync(join(bien_dich, "0.pack"), "cache biên dịch, phải sống sót", "utf8");
  return { goc, duLieu: du_lieu, bienDich: bien_dich };
}

test("L41 — payload CŨ trong fetch-cache không sống sót qua bước dọn", async () => {
  const { xoaCacheDuLieu } = await nap();
  const { goc, duLieu } = dungCay();
  try {
    // Vế khẳng định trước: cây dựng lên đúng là cây có payload thiếu trường. Không có
    // dòng này thì "sau khi xoá thì không còn" cũng đúng khi chưa bao giờ có gì cả.
    const truoc = JSON.parse(readFileSync(join(duLieu, "a1b2c3"), "utf8")) as {
      data: { body: string };
    };
    const than = JSON.parse(
      Buffer.from(truoc.data.body, "base64").toString("utf8"),
    ) as Record<string, unknown>;
    expect(than.seq, "payload dựng lên phải là một thẻ mốc thật").toBe(1);
    expect(
      "anhs" in than,
      "payload phải THIẾU `anhs` — đó là hình dạng đã gây 500",
    ).toBe(false);

    const da_xoa = xoaCacheDuLieu(goc);
    expect(da_xoa).toContain("fetch-cache");
    expect(existsSync(duLieu)).toBe(false);
  } finally {
    rmSync(goc, { recursive: true, force: true });
  }
});

test("L41 — cache BIÊN DỊCH sống sót (nếu không, bước này sẽ bị gỡ vì chậm)", async () => {
  const { xoaCacheDuLieu, THU_MUC_GIU_LAI } = await nap();
  const { goc, bienDich } = dungCay();
  try {
    xoaCacheDuLieu(goc);
    expect(existsSync(join(bienDich, "0.pack"))).toBe(true);
    expect(existsSync(join(goc, "cache", "swc"))).toBe(true);
    // Và danh sách "giữ lại" không được giao nhau với danh sách "xoá" — hai hằng đọc
    // ngược nhau thì một trong hai đang nói dối.
    const { THU_MUC_CACHE_DU_LIEU } = await nap();
    for (const t of THU_MUC_GIU_LAI) expect(THU_MUC_CACHE_DU_LIEU).not.toContain(t);
  } finally {
    rmSync(goc, { recursive: true, force: true });
  }
});

test("L41 — chưa có .next (máy sạch, build đầu tiên) thì KHÔNG ném", async () => {
  const { xoaCacheDuLieu } = await nap();
  const tam = mkdtempSync(join(tmpdir(), "gikky-l41-sach-"));
  try {
    expect(xoaCacheDuLieu(join(tam, ".next"))).toEqual([]);
  } finally {
    rmSync(tam, { recursive: true, force: true });
  }
});

test("L41 — bước dọn được NỐI vào lệnh build của cả hai app", () => {
  // Vế quan trọng nhất của cả file. `LOI-VA-NO.md` viết thẳng: *"Chữ trong tài liệu không
  // đủ — đây là thứ chỉ lộ ra sau khi deploy."* Một hàm đúng mà không ai gọi thì L41 vẫn
  // còn nguyên, và ba bài trên vẫn xanh.
  for (const app of ["web", "admin"]) {
    const pkg = JSON.parse(
      readFileSync(resolve(GOC, "apps", app, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.build, `apps/${app} phải dọn cache dữ liệu TRƯỚC khi build`).toMatch(
      /xoa-cache-du-lieu\.mjs.*&&.*next build/,
    );
  }
});
