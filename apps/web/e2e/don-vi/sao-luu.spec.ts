import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const GOC = resolve(__dirname, "..", "..", "..", "..");

/** Hàng rào cho `scripts/sao-luu-db.mjs` (Phase 6 — PLAN mục 10 "backup Postgres").
 *
 * **Vì sao bài đo của một script ở gốc repo lại nằm trong `apps/web/e2e`:** đây là bộ
 * chạy JavaScript duy nhất của repo. Bên Python có `pytest`, bên JS chỉ có Playwright —
 * và `e2e:don-vi` không cần cổng, không cần DB, nên nó chạy được ở mọi cây làm việc.
 * Cái giá là một đường dẫn `../../../..` xấu xí; cái được là ba hàm dễ sai nhất của
 * script có bài đo thay vì không có gì.
 *
 * Ba hàm ấy: tách `DATABASE_URL` (mật khẩu có ký tự đặc biệt), dấu thời gian dùng làm
 * tên file trên Windows, và phép dọn bản cũ (một script backup XOÁ NHẦM còn tệ hơn một
 * script không chạy).
 *
 * Phần chạm `pg_dump` thật KHÔNG đo ở đây — nó cần một PostgreSQL sống. Vòng
 * dump → `pg_restore` → đối chiếu số hàng đã chạy tay một lần, ghi trong
 * `docs/sao-luu-phuc-hoi.md`, bảng cuối file.
 */

type ModSaoLuu = {
  tachUrl: (url: string) => {
    host: string;
    port: string;
    user: string;
    matKhau: string;
    db: string;
  };
  dauThoiGian: (luc?: Date) => string;
  tenFileDump: (db: string, luc?: Date) => string;
  donBanCu: (thu_muc: string, db: string, giu: number) => string[];
  docDatabaseUrl: (duong_dan?: string) => string;
};

async function nap(): Promise<ModSaoLuu> {
  // `import()` bằng URL `file://`: đường dẫn Windows (`D:\…`) không phải một specifier
  // hợp lệ của ESM, Node báo "Only URLs with a scheme in: file, data are supported".
  const url = new URL(`file:///${join(GOC, "scripts", "sao-luu-db.mjs").replaceAll("\\", "/")}`);
  return (await import(url.href)) as ModSaoLuu;
}

test("tachUrl giải mã mật khẩu percent-encoded", async () => {
  const { tachUrl } = await nap();
  // Mật khẩu chứa `@` và `/` BẮT BUỘC phải mã hoá trong URL; không giải mã lại thì
  // `pg_dump` chỉ nói "password authentication failed" — một thông báo không chỉ được
  // chỗ sai.
  const d = tachUrl("postgres://gikky:m%40t%2Fkhau@127.0.0.1:5432/gikky_dev");
  expect(d).toEqual({
    host: "127.0.0.1",
    port: "5432",
    user: "gikky",
    matKhau: "m@t/khau",
    db: "gikky_dev",
  });
  // `postgresql://` cũng hợp lệ, và cổng thiếu thì về mặc định 5432.
  expect(tachUrl("postgresql://u:p@db.noi-bo:5433/x").port).toBe("5433");
  expect(tachUrl("postgresql://u:p@db.noi-bo/x").port).toBe("5432");
});

test("tachUrl NÉM với URL không dùng được (fail-closed)", async () => {
  const { tachUrl } = await nap();
  expect(() => tachUrl("mysql://u:p@h/x")).toThrow(/không phải postgres/);
  expect(() => tachUrl("postgres://u:p@h:5432/")).toThrow(/không có tên database/);
  expect(() => tachUrl("không phải url")).toThrow();
});

test("dấu thời gian dùng được làm tên file Windows và sắp đúng thứ tự", async () => {
  const { dauThoiGian, tenFileDump } = await nap();
  const t = dauThoiGian(new Date(2026, 7, 22, 19, 4, 31));
  expect(t).toBe("2026-08-22T19-04-31");
  // `:` là ký tự CẤM trong tên file trên Windows — `toISOString()` sinh ra nó.
  expect(t).not.toContain(":");
  // Sắp theo chuỗi phải trùng sắp theo thời gian, vì `donBanCu` dựa vào đúng điều đó.
  const som = dauThoiGian(new Date(2026, 7, 22, 9, 0, 0));
  expect(som < t).toBe(true);
  expect(tenFileDump("gikky_dev", new Date(2026, 7, 22, 19, 4, 31))).toBe(
    "gikky-gikky_dev-2026-08-22T19-04-31.dump",
  );
});

test("donBanCu giữ N bản mới nhất và KHÔNG đụng file của người khác", async () => {
  const { donBanCu } = await nap();
  const thu_muc = mkdtempSync(join(tmpdir(), "gikky-sao-luu-"));
  mkdirSync(thu_muc, { recursive: true });
  const dat = (t: string) => writeFileSync(join(thu_muc, t), "x");

  for (const gio of ["01", "02", "03", "04", "05"]) {
    dat(`gikky-gikky_dev-2026-08-22T${gio}-00-00.dump`);
  }
  // Ba thứ KHÔNG được đụng tới: dump của database khác, file lạ, và thư mục con.
  dat("gikky-gikky_khac-2026-08-22T01-00-00.dump");
  dat("ghi-chu.txt");

  const da_xoa = donBanCu(thu_muc, "gikky_dev", 2);
  expect(da_xoa).toEqual([
    "gikky-gikky_dev-2026-08-22T03-00-00.dump",
    "gikky-gikky_dev-2026-08-22T02-00-00.dump",
    "gikky-gikky_dev-2026-08-22T01-00-00.dump",
  ]);
  expect(readdirSync(thu_muc).sort()).toEqual([
    "ghi-chu.txt",
    "gikky-gikky_dev-2026-08-22T04-00-00.dump",
    "gikky-gikky_dev-2026-08-22T05-00-00.dump",
    "gikky-gikky_khac-2026-08-22T01-00-00.dump",
  ]);
});

test("donBanCu với --giu 0 KHÔNG xoá gì (0 = tắt, không phải 'xoá sạch')", async () => {
  const { donBanCu } = await nap();
  const thu_muc = mkdtempSync(join(tmpdir(), "gikky-sao-luu-"));
  writeFileSync(join(thu_muc, "gikky-x-2026-08-22T01-00-00.dump"), "x");
  expect(donBanCu(thu_muc, "x", 0)).toEqual([]);
  expect(readdirSync(thu_muc)).toHaveLength(1);
});

test("docDatabaseUrl nói RA việc phải làm khi thiếu `api/.env`", async () => {
  const { docDatabaseUrl } = await nap();
  // Thông báo mặc định ("ENOENT") không chỉ được việc phải làm — cùng lý lẽ với thông
  // báo thiếu `SECRET_KEY` trong `api/config/settings.py`.
  expect(() => docDatabaseUrl(join(tmpdir(), "khong-co-file-nay.env"))).toThrow(
    /pnpm setup:env/,
  );
});
