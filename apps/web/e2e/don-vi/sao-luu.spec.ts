import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
  docBien: (ten: string, duong_dan?: string) => string | null;
  chepGuong: (
    nguon: string,
    dich: string,
  ) => { chep: number; boQua: number; byte: number; thieu: boolean };
  thuMucAnh: () => { phucVu: string; cachLy: string };
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


// --- Ảnh (Phase 5): sao lưu phải gồm cả trạng thái NGOÀI database ------------
//
// Tới Phase 4, `pg_dump` là bản sao lưu ĐỦ. Phase 5 cho người dùng tải ảnh xuống đĩa, và
// từ đó một bản dump database một mình là bản sao lưu **thiếu** — phục hồi ra thì mọi
// hàng `MocAnh` còn nguyên và mọi thẻ `<img>` gãy, không có gì báo. Ba bài dưới đo phần
// chép ảnh; phần `pg_dump` vẫn không đo ở đây (cần PostgreSQL sống).

test("docBien đọc được biến trong .env, và trả null khi vắng hoặc để trống", async () => {
  const { docBien } = await nap();
  const thu_muc = mkdtempSync(join(tmpdir(), "gikky-env-"));
  const env = join(thu_muc, ".env");
  writeFileSync(env, ["MEDIA_ROOT=/var/lib/gikky/media", "MEDIA_AN_ROOT=", "KHAC=1"].join("\n"));

  expect(docBien("MEDIA_ROOT", env)).toBe("/var/lib/gikky/media");
  // Để TRỐNG phải ra `null`, không phải `""`: `""` đi tiếp vào `resolve()` và thành thư
  // mục làm việc hiện tại — script sẽ sao lưu nhầm cả cây mã nguồn.
  expect(docBien("MEDIA_AN_ROOT", env)).toBeNull();
  expect(docBien("KHONG_CO", env)).toBeNull();
  expect(docBien("MEDIA_ROOT", join(tmpdir(), "khong-co-file-nay.env"))).toBeNull();
});

test("chepGuong chép file mới, BỎ QUA file đã có, và giữ cây thư mục", async () => {
  const { chepGuong } = await nap();
  const nguon = mkdtempSync(join(tmpdir(), "gikky-anh-nguon-"));
  const dich = mkdtempSync(join(tmpdir(), "gikky-anh-dich-"));
  mkdirSync(join(nguon, "anh"), { recursive: true });
  mkdirSync(join(nguon, "anh-thumb"), { recursive: true });
  writeFileSync(join(nguon, "anh", "a.jpg"), "AAAA");
  writeFileSync(join(nguon, "anh-thumb", "a.jpg"), "aa");

  const lan1 = chepGuong(nguon, dich);
  expect(lan1).toMatchObject({ chep: 2, boQua: 0, thieu: false });
  expect(readFileSync(join(dich, "anh", "a.jpg"), "utf8")).toBe("AAAA");
  expect(readFileSync(join(dich, "anh-thumb", "a.jpg"), "utf8")).toBe("aa");

  // Lần hai KHÔNG chép lại: tên ảnh là uuid và nội dung sau một tên không bao giờ đổi,
  // nên chép lại thứ đã có là tốn đĩa thuần tuý. Chạy hằng đêm mà không có nhánh này thì
  // bản sao lưu phình theo số đêm, không theo số ảnh.
  expect(chepGuong(nguon, dich)).toMatchObject({ chep: 0, boQua: 2 });

  // File mới xuất hiện thì lần chạy sau phải bắt được.
  writeFileSync(join(nguon, "anh", "b.png"), "BBB");
  expect(chepGuong(nguon, dich)).toMatchObject({ chep: 1, boQua: 2 });
});

test("chepGuong chép ĐÈ khi kích thước lệch (dấu của lượt chép trước bị cắt ngang)", async () => {
  const { chepGuong } = await nap();
  const nguon = mkdtempSync(join(tmpdir(), "gikky-anh-nguon-"));
  const dich = mkdtempSync(join(tmpdir(), "gikky-anh-dich-"));
  mkdirSync(join(nguon, "anh"), { recursive: true });
  mkdirSync(join(dich, "anh"), { recursive: true });
  writeFileSync(join(nguon, "anh", "a.jpg"), "NGUYEN VEN");
  writeFileSync(join(dich, "anh", "a.jpg"), "CUT");

  expect(chepGuong(nguon, dich)).toMatchObject({ chep: 1, boQua: 0 });
  expect(readFileSync(join(dich, "anh", "a.jpg"), "utf8")).toBe("NGUYEN VEN");
});

test("chepGuong KHÔNG ném khi chưa ai upload lần nào", async () => {
  const { chepGuong } = await nap();
  // Máy chủ mới toanh: `MEDIA_ROOT` chưa tồn tại. Đó là trạng thái hợp lệ, không phải
  // lỗi — ném ở đây là làm cả lượt sao lưu database thất bại vì chưa có ảnh nào.
  const kq = chepGuong(join(tmpdir(), "khong-co-thu-muc-nay"), mkdtempSync(join(tmpdir(), "d-")));
  expect(kq).toMatchObject({ chep: 0, thieu: true });
});

test("thuMucAnh mặc định TRÙNG `config/settings.py` (hai bên lệch = sao lưu thư mục rỗng)", async () => {
  const { thuMucAnh } = await nap();
  const kho = thuMucAnh();
  // Không so đường dẫn tuyệt đối (nó phụ thuộc chỗ checkout), mà so **hình dạng**: kho
  // cách ly phải nằm NGOÀI kho phục vụ. Đó là cả cơ chế A9 — `MEDIA_AN_ROOT` nằm TRONG
  // `MEDIA_ROOT` là Caddy phục vụ lại đúng những tấm ảnh vừa bị gỡ.
  const chuan = (p: string) => p.replaceAll("\\", "/");
  expect(chuan(kho.phucVu)).toMatch(/\/media$/);
  expect(chuan(kho.cachLy)).toMatch(/\/media-an$/);
  // `startsWith(phucVu)` một mình là SAI ở đây, và bài đo này đã ăn đúng cái bẫy đó một
  // lần: `…/api/media-an` **có** bắt đầu bằng `…/api/media` mà không hề nằm trong nó.
  // Phép chứa của đường dẫn phải tính tới dấu phân cách, không phải tiền tố chuỗi.
  expect(chuan(kho.cachLy).startsWith(`${chuan(kho.phucVu)}/`)).toBe(false);
  expect(chuan(kho.cachLy)).not.toBe(chuan(kho.phucVu));
});
