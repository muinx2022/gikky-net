// Sao lưu PostgreSQL bằng `pg_dump` — Phase 6, PLAN mục 10 ("backup Postgres tự động").
//
//   node scripts/sao-luu-db.mjs                    # ra ./backup/gikky-<db>-<ts>.dump
//   node scripts/sao-luu-db.mjs --thu-muc D:\sao   # đổi chỗ ghi
//   node scripts/sao-luu-db.mjs --giu 14           # giữ 14 bản gần nhất, xoá phần cũ
//   node scripts/sao-luu-db.mjs --kiem             # chỉ kiểm điều kiện, không dump
//   node scripts/sao-luu-db.mjs --khong-anh        # BỎ QUA ảnh, chỉ dump database
//
// Phục hồi: xem `docs/sao-luu-phuc-hoi.md` — và ĐỌC NÓ TRƯỚC khi cần tới, chứ không
// phải lúc đang cần.
//
// ## Ba quyết định, mỗi cái có lý do
//
// 1. **Node chứ không `.ps1`/`.sh`.** Cùng lý lẽ với `scripts/py.mjs`: PLAN 8.3 chốt
//    script phải cross-platform, và repo này đã có một chỗ để một cú pháp bash trong
//    `package.json` không chạy được trên Windows.
// 2. **Định dạng `custom` (`-Fc`), không phải SQL trần.** `pg_restore` trên bản custom
//    cho phép phục hồi từng bảng, đảo thứ tự phụ thuộc, và chạy song song — thứ một file
//    `.sql` không cho. Nó cũng nén sẵn.
// 3. **Mật khẩu đi qua `PGPASSWORD` trong env của tiến trình CON**, không qua dòng lệnh.
//    Tham số dòng lệnh nằm trong danh sách tiến trình, ai trên máy cũng đọc được.
//
// ## Phase 5 đổi câu chuyện: có trạng thái NẰM NGOÀI database
//
// Tới Phase 4, `pg_dump` là bản sao lưu ĐỦ — mọi thứ sản phẩm biết đều nằm trong
// Postgres. Phase 5 cho người dùng tải ảnh xuống **đĩa** (`MEDIA_ROOT`), và từ đó một
// bản dump database một mình là bản sao lưu **thiếu**: phục hồi nó ra thì mọi hàng
// `MocAnh` còn nguyên, mọi thẻ `<img>` gãy hết, và không có gì báo.
//
// Vì thế script này nay sao lưu **cả hai kho ảnh** (`MEDIA_ROOT` và `MEDIA_AN_ROOT` —
// kho cách ly, chứa ảnh của mốc bị mod ẩn, mà ẩn thì đảo ngược được nên nó là dữ liệu
// thật). `--khong-anh` tắt được, và khi tắt thì script **nói ra** rằng bản sao lưu này
// không có ảnh — im lặng bỏ qua là để người ta tin nhầm là đã sao lưu đủ.
//
// **Ảnh chép theo lối GƯƠNG (mirror), không phải bản mới mỗi lần.** Tên file là uuid và
// nội dung sau một tên không bao giờ đổi (`core/anh_luu.py`), nên chép lại thứ đã có là
// tốn đĩa thuần tuý. Hệ quả cố ý: gương là **superset** — ảnh đã bị xoá khỏi máy chủ vẫn
// nằm lại trong bản sao lưu, và đó là điều một bản sao lưu nên làm.

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GOC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Nơi `pg_dump` có thể nằm khi nó KHÔNG có trên PATH.
 *
 * Trên máy dev hiện tại đúng là như vậy (`CLAUDE.md`: psql ở
 * `C:\Program Files\PostgreSQL\17\bin`). Dò theo danh sách thay vì bắt người dùng tự
 * thêm PATH: một script backup mà bước đầu tiên là "sửa biến môi trường" là một script
 * sẽ không ai chạy.
 */
const NOI_DO_PG_DUMP = [
  "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe",
  "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
  "/usr/bin/pg_dump",
  "/usr/local/bin/pg_dump",
  "/opt/homebrew/bin/pg_dump",
];

export function timPgDump() {
  const co_san = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
  if (co_san.status === 0) return "pg_dump";
  for (const p of NOI_DO_PG_DUMP) if (existsSync(p)) return p;
  throw new Error(
    "Không tìm thấy `pg_dump`. Cài PostgreSQL client, hoặc thêm đường dẫn của bạn vào "
      + "`NOI_DO_PG_DUMP` trong scripts/sao-luu-db.mjs.",
  );
}

/** Tách `DATABASE_URL` trong `api/.env`.
 *
 * Đọc `.env` chứ không `process.env`: đó là nguồn sự thật của repo này (`settings.py`
 * đọc đúng file đó), và một script backup lấy DB từ một chỗ khác với ứng dụng là script
 * sẽ sao lưu nhầm database — im lặng, và chỉ lộ ra lúc phục hồi.
 */
export function docDatabaseUrl(duong_dan = join(GOC, "api", ".env")) {
  if (!existsSync(duong_dan)) {
    throw new Error(`Chưa có ${duong_dan}. Chạy \`pnpm setup:env\` trước (xem CLAUDE.md).`);
  }
  const khop = /^DATABASE_URL=(.*)$/m.exec(readFileSync(duong_dan, "utf8"));
  if (khop === null) throw new Error(`${duong_dan} không có dòng DATABASE_URL=`);
  return khop[1].trim();
}

/** `postgres://user:pass@host:port/db` → các mảnh `pg_dump` cần.
 *
 * `decodeURIComponent` cho user/mật khẩu: `URL` giữ nguyên phần trăm-mã hoá, và một mật
 * khẩu có ký tự `@` hay `/` BẮT BUỘC phải được mã hoá trong URL — không giải mã lại là
 * xác thực hỏng với một thông báo vô nghĩa ("password authentication failed").
 */
export function tachUrl(url) {
  const u = new URL(url);
  if (!/^postgres(ql)?:$/.test(u.protocol)) {
    throw new Error(`DATABASE_URL không phải postgres: ${u.protocol}`);
  }
  const ten_db = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (ten_db === "") throw new Error("DATABASE_URL không có tên database");
  return {
    host: u.hostname || "127.0.0.1",
    port: u.port || "5432",
    user: decodeURIComponent(u.username),
    matKhau: decodeURIComponent(u.password),
    db: ten_db,
  };
}

/** Đọc một biến bất kỳ trong `api/.env`, hoặc `null` nếu không có / để trống.
 *
 * Cùng nguồn với `docDatabaseUrl` và cùng lý lẽ: `settings.py` đọc đúng file này, nên
 * script phải đọc đúng file này. Lấy từ `process.env` là sao lưu nhầm thư mục.
 */
export function docBien(ten, duong_dan = join(GOC, "api", ".env")) {
  if (!existsSync(duong_dan)) return null;
  const khop = new RegExp(`^${ten}=(.*)$`, "m").exec(readFileSync(duong_dan, "utf8"));
  const gia_tri = khop === null ? "" : khop[1].trim();
  return gia_tri === "" ? null : gia_tri;
}

/** Hai kho ảnh của Phase 5, theo đúng mặc định của `config/settings.py`.
 *
 * Mặc định phải TRÙNG `settings.py` — hai bản mặc định lệch nhau là script sao lưu một
 * thư mục rỗng và báo "xong", trong khi ảnh thật nằm ở chỗ khác. Đây là **nợ có tên**:
 * không có gì tự kiểm hai bên khớp nhau.
 */
export function thuMucAnh() {
  const goc = docBien("MEDIA_ROOT") ?? join(GOC, "api", "media");
  const an = docBien("MEDIA_AN_ROOT") ?? join(dirname(resolve(goc)), "media-an");
  return { phucVu: resolve(goc), cachLy: resolve(an) };
}

/** Chép GƯƠNG một thư mục: chỉ những file đích chưa có. Trả `{chép, bỏ qua, byte}`.
 *
 * So sánh bằng **sự tồn tại + kích thước**, không đọc nội dung: file ảnh là bất biến
 * (tên uuid, nội dung không bao giờ đổi sau một tên), nên băm lại từng file mỗi đêm là
 * đọc cả kho ảnh để biết một điều đã biết. Kích thước lệch ⇒ chép đè: đó là dấu của một
 * lượt chép trước bị cắt ngang.
 *
 * Thư mục nguồn không tồn tại ⇒ `{ chep: 0, ... , thieu: true }`, KHÔNG ném: chưa ai
 * upload lần nào là trạng thái hợp lệ của một máy chủ mới.
 */
export function chepGuong(nguon, dich) {
  if (!existsSync(nguon)) return { chep: 0, boQua: 0, byte: 0, thieu: true };
  let chep = 0;
  let boQua = 0;
  let byte = 0;
  const di = (thu_muc) => {
    for (const muc of readdirSync(thu_muc, { withFileTypes: true })) {
      const tu = join(thu_muc, muc.name);
      if (muc.isDirectory()) {
        di(tu);
        continue;
      }
      if (!muc.isFile()) continue;
      const den = join(dich, relative(nguon, tu));
      const co_that = statSync(tu);
      if (existsSync(den) && statSync(den).size === co_that.size) {
        boQua += 1;
        continue;
      }
      mkdirSync(dirname(den), { recursive: true });
      copyFileSync(tu, den);
      chep += 1;
      byte += co_that.size;
    }
  };
  di(nguon);
  return { chep, boQua, byte, thieu: false };
}

/** `2026-08-22T19-04-31` — dấu thời gian dùng được làm tên file trên Windows (`:` bị cấm).
 *
 * Giờ **địa phương**, không phải UTC: người đi tìm bản backup "tối qua" nghĩ theo đồng
 * hồ trên tường của họ. Thứ tự chuỗi vẫn trùng thứ tự thời gian nên `sort()` vẫn đúng.
 */
export function dauThoiGian(luc = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${luc.getFullYear()}-${p(luc.getMonth() + 1)}-${p(luc.getDate())}`
    + `T${p(luc.getHours())}-${p(luc.getMinutes())}-${p(luc.getSeconds())}`
  );
}

export function tenFileDump(db, luc = new Date()) {
  return `gikky-${db}-${dauThoiGian(luc)}.dump`;
}

/** Xoá bản cũ, giữ `giu` bản mới nhất. Trả danh sách file đã xoá.
 *
 * Lọc theo tiền tố `gikky-<db>-` chứ không xoá mọi thứ trong thư mục: người ta sẽ trỏ
 * `--thu-muc` vào một chỗ có sẵn thứ khác, và một script backup xoá nhầm dữ liệu là thứ
 * tệ hơn hẳn việc không có backup.
 */
export function donBanCu(thu_muc, db, giu) {
  if (giu <= 0) return [];
  const tien_to = `gikky-${db}-`;
  const cu = readdirSync(thu_muc)
    .filter((t) => t.startsWith(tien_to) && t.endsWith(".dump"))
    .sort()
    .reverse()
    .slice(giu);
  for (const t of cu) unlinkSync(join(thu_muc, t));
  return cu;
}

function docCo(argv) {
  const lay = (ten, mac_dinh) => {
    const i = argv.indexOf(ten);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : mac_dinh;
  };
  return {
    thuMuc: resolve(lay("--thu-muc", join(GOC, "backup"))),
    giu: Number(lay("--giu", "7")),
    chiKiem: argv.includes("--kiem"),
    khongAnh: argv.includes("--khong-anh"),
  };
}

function chay(argv) {
  const co = docCo(argv);
  if (!Number.isInteger(co.giu) || co.giu < 0) {
    throw new Error(`--giu phải là số nguyên ≥ 0, nhận ${JSON.stringify(co.giu)}`);
  }

  const pg_dump = timPgDump();
  const dich = tachUrl(docDatabaseUrl());
  console.log(`[sao-luu] pg_dump: ${pg_dump}`);
  console.log(`[sao-luu] nguồn:   ${dich.user}@${dich.host}:${dich.port}/${dich.db}`);

  if (co.chiKiem) {
    const kho = thuMucAnh();
    console.log(`[sao-luu] ảnh:     ${kho.phucVu}${existsSync(kho.phucVu) ? "" : " (chưa có)"}`);
    console.log(`[sao-luu] ảnh ẩn:  ${kho.cachLy}${existsSync(kho.cachLy) ? "" : " (chưa có)"}`);
    console.log("[sao-luu] --kiem: điều kiện đủ, KHÔNG dump.");
    return 0;
  }

  mkdirSync(co.thuMuc, { recursive: true });
  const ra = join(co.thuMuc, tenFileDump(dich.db));

  const kq = spawnSync(
    pg_dump,
    [
      "--format=custom",
      // `--no-owner`/`--no-privileges`: bản dump phục hồi được vào một máy mà role
      // `gikky` chưa tồn tại. Không có hai cờ này thì `pg_restore` đổ một tràng lỗi
      // "role does not exist" đúng lúc người ta đang cuống.
      "--no-owner",
      "--no-privileges",
      `--host=${dich.host}`,
      `--port=${dich.port}`,
      `--username=${dich.user}`,
      `--file=${ra}`,
      dich.db,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, PGPASSWORD: dich.matKhau },
    },
  );
  if (kq.error) throw kq.error;
  if (kq.status !== 0) {
    throw new Error(`pg_dump thoát với mã ${kq.status} — KHÔNG có bản sao lưu nào.`);
  }

  const co_that = statSync(ra);
  // `pg_dump` trả 0 nhưng ra file 0 byte là ca đã gặp thật với đường dẫn không ghi được.
  // Một thư mục backup đầy file rỗng còn nguy hiểm hơn thư mục trống: nó trông như đã
  // sao lưu.
  if (co_that.size < 1024) {
    throw new Error(`Bản dump chỉ ${co_that.size} byte — coi như HỎNG: ${ra}`);
  }
  console.log(`[sao-luu] xong: ${ra} (${(co_that.size / 1024).toFixed(1)} KB)`);

  const da_xoa = donBanCu(co.thuMuc, dich.db, co.giu);
  if (da_xoa.length > 0) {
    console.log(`[sao-luu] giữ ${co.giu} bản, đã xoá ${da_xoa.length}: ${da_xoa.join(", ")}`);
  }

  // --- Ảnh (Phase 5). Xem khối "trạng thái NẰM NGOÀI database" ở đầu file. ---
  if (co.khongAnh) {
    // Nói THẲNG, không im lặng bỏ qua: người đọc log phải biết bản sao lưu này thiếu gì.
    console.warn(
      "[sao-luu] ⚠ --khong-anh: bản sao lưu này CHỈ CÓ DATABASE, KHÔNG có ảnh.\n"
        + "[sao-luu]   Phục hồi nó ra thì mọi hàng MocAnh còn nguyên và mọi ảnh gãy.",
    );
    return 0;
  }
  const kho = thuMucAnh();
  for (const [nhan, nguon, ten_dich] of [
    ["ảnh", kho.phucVu, "media"],
    ["ảnh đã ẩn", kho.cachLy, "media-an"],
  ]) {
    const kq = chepGuong(nguon, join(co.thuMuc, ten_dich));
    if (kq.thieu) {
      console.log(`[sao-luu] ${nhan}: ${nguon} chưa tồn tại — bỏ qua (chưa ai upload).`);
      continue;
    }
    console.log(
      `[sao-luu] ${nhan}: chép ${kq.chep} file mới `
        + `(${(kq.byte / 1024 / 1024).toFixed(1)} MB), đã có sẵn ${kq.boQua} — `
        + `${join(co.thuMuc, ten_dich)}`,
    );
  }
  return 0;
}

const goi_thang = process.argv[1] === fileURLToPath(import.meta.url);
if (goi_thang) {
  try {
    process.exit(chay(process.argv.slice(2)));
  } catch (loi) {
    console.error(`[sao-luu] THẤT BẠI: ${loi.message}`);
    process.exit(1);
  }
}
