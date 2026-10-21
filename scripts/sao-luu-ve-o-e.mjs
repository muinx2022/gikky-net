// Đồng bộ bản sao lưu PostgreSQL và kho ảnh từ vps-muinx về ổ cứng E:
// Hỗ trợ đồng bộ cả gikky.net lẫn các stack khác (hoc-tieng-anh, shopee-pg, bdslink, trekky).
//
// Cách dùng:
//   node scripts/sao-luu-ve-o-e.mjs                   # Chụp dump mới trên VPS rồi kéo về E:\gikky-backups
//   node scripts/sao-luu-ve-o-e.mjs --chi-keo        # Chỉ kéo các file hiện có trên VPS (không chụp mới)
//   node scripts/sao-luu-ve-o-e.mjs --giu 45         # Giữ 45 bản dump gần nhất trong db/
//   node scripts/sao-luu-ve-o-e.mjs --khong-anh      # Bỏ qua kéo ảnh gikky, chỉ kéo database
//   node scripts/sao-luu-ve-o-e.mjs --chi-gikky      # Chỉ sao lưu gikky.net, bỏ qua các stack khác
//   pnpm db:sao-luu:o-e

import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function docCo(argv = process.argv.slice(2)) {
  const lay = (ten, mac_dinh) => {
    const i = argv.indexOf(ten);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : mac_dinh;
  };

  const macDinhDich = process.env.GIKKY_LOCAL_BACKUP_DIR ?? "E:\\gikky-backups\\prod";
  const dich = resolve(lay("--dich", macDinhDich));
  const macDinhDichKhac = join(dirname(dich), "other-stacks");

  return {
    dich,
    dichKhac: resolve(lay("--dich-khac", macDinhDichKhac)),
    host: lay("--host", "vps-muinx"),
    giu: Number(lay("--giu", "30")),
    chiKeo: argv.includes("--chi-keo") || argv.includes("--pull-only"),
    khongAnh: argv.includes("--khong-anh"),
    chiGikky: argv.includes("--chi-gikky"),
  };
}

function chayLenh(bin, args, tuyChon = {}) {
  return execFileSync(bin, args, { encoding: "utf8", ...tuyChon });
}

async function dongBoAnh(host, thuMucDich) {
  console.log("[o-e] Đồng bộ kho ảnh (media & media-an)...");
  try {
    // Ưu tiên truyền qua luồng tar (nén trên VPS, giải nén trực tiếp vào thư mục đích trên ổ E:)
    await new Promise((resolveP, rejectP) => {
      const ssh = spawn(
        "ssh",
        [host, "tar -czf - -C ~/gikky-net/backup media media-an 2>/dev/null"],
        { stdio: ["ignore", "pipe", "inherit"] },
      );
      const tar = spawn("tar", ["-xzf", "-", "-C", thuMucDich], {
        stdio: [ssh.stdout, "inherit", "inherit"],
      });

      tar.on("close", (code) => {
        if (code === 0) resolveP();
        else rejectP(new Error(`tar giải nén kết thúc với mã ${code}`));
      });
      tar.on("error", rejectP);
      ssh.on("error", rejectP);
    });
    console.log("[o-e] Đồng bộ kho ảnh qua tar stream thành công!");
  } catch (err) {
    console.warn(`[o-e] tar stream gặp lỗi (${err.message}), fallback sang scp -r...`);
    chayLenh("scp", ["-r", `${host}:~/gikky-net/backup/media`, thuMucDich], { stdio: "inherit" });
    chayLenh("scp", ["-r", `${host}:~/gikky-net/backup/media-an`, thuMucDich], { stdio: "inherit" });
  }
}

function keoDanhSachFile(host, danhSachTuVPS, thuMucDich, nhan = "file") {
  let soMoi = 0;
  let soBoQua = 0;
  let byteMoi = 0;

  for (const { duongDan, kichThuoc } of danhSachTuVPS) {
    const tenFile = basename(duongDan);
    const fileDich = join(thuMucDich, tenFile);

    if (existsSync(fileDich)) {
      const stat = statSync(fileDich);
      if (stat.size === kichThuoc) {
        soBoQua++;
        continue;
      }
    }

    console.log(`[o-e] Kéo ${nhan}: ${tenFile} (${(kichThuoc / 1024 / 1024).toFixed(2)} MB)...`);
    chayLenh("scp", [`${host}:${duongDan}`, fileDich], { stdio: "inherit" });
    soMoi++;
    byteMoi += kichThuoc;
  }

  return { soMoi, soBoQua, byteMoi };
}

export function tachDongKichThuocFile(out) {
  const ketQua = [];
  for (const dong of out.split("\n")) {
    const trimmed = dong.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx <= 0) continue;
    const kichThuoc = Number(trimmed.slice(0, spaceIdx));
    const duongDan = trimmed.slice(spaceIdx + 1).trim();
    if (!Number.isNaN(kichThuoc) && duongDan) {
      ketQua.push({ duongDan, kichThuoc });
    }
  }
  return ketQua;
}

export function layDanhSachFileTuVPS(host, lenhFind) {
  try {
    const out = chayLenh("ssh", [host, lenhFind]);
    return tachDongKichThuocFile(out);
  } catch (err) {
    console.warn(`[o-e] Không lấy được danh sách file từ VPS: ${err.message}`);
    return [];
  }
}

export function donBanCuTheoDuoi(thuMuc, duoi, giu) {
  if (giu <= 0) return [];
  if (!existsSync(thuMuc)) return [];

  const danhSach = readdirSync(thuMuc)
    .filter((t) => t.endsWith(duoi))
    .sort()
    .reverse()
    .slice(giu);

  for (const t of danhSach) {
    unlinkSync(join(thuMuc, t));
  }
  return danhSach;
}

export function donBanCu(thuMuc, giu) {
  return donBanCuTheoDuoi(thuMuc, ".dump", giu);
}

export function thongKeThuMuc(dir) {
  if (!existsSync(dir)) return { soLuong: 0, tongByte: 0 };
  let soLuong = 0;
  let tongByte = 0;
  const di = (d) => {
    for (const item of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, item.name);
      if (item.isDirectory()) {
        di(p);
      } else if (item.isFile()) {
        soLuong++;
        tongByte += statSync(p).size;
      }
    }
  };
  di(dir);
  return { soLuong, tongByte };
}

export async function dongBoStackKhac(co) {
  console.log("\n================================================================================");
  console.log("ĐỒNG BỘ CÁC STACK KHÁC TRÊN VPS VỀ Ổ E:");
  console.log(`Đích lưu trữ:   ${co.dichKhac}`);
  console.log(`Máy chủ VPS:    ${co.host}`);
  console.log("================================================================================");

  const tmHocTiengAnh = join(co.dichKhac, "hoc-tieng-anh");
  const tmShopee = join(co.dichKhac, "shopee-pg");
  const tmBdslink = join(co.dichKhac, "bdslink");
  const tmTrekky = join(co.dichKhac, "trekky");

  mkdirSync(tmHocTiengAnh, { recursive: true });
  mkdirSync(tmShopee, { recursive: true });
  mkdirSync(tmBdslink, { recursive: true });
  mkdirSync(tmTrekky, { recursive: true });

  // 1. hoc-tieng-anh (sqlite backups)
  console.log("\n[o-e:other] 1. Kiểm tra backup hoc-tieng-anh (~/backups/hoctienganh_data-*.db.gz)...");
  const dsHta = layDanhSachFileTuVPS(
    co.host,
    "find ~/backups -maxdepth 1 -type f -name 'hoctienganh_data-*.db.gz' -printf '%s %p\\n' 2>/dev/null || true",
  );
  const kqHta = keoDanhSachFile(co.host, dsHta, tmHocTiengAnh, "hoc-tieng-anh");
  console.log(
    `[o-e:other] hoc-tieng-anh: ${kqHta.soMoi} file mới tải về (${(kqHta.byteMoi / 1024 / 1024).toFixed(2)} MB), `
      + `${kqHta.soBoQua} file đã có sẵn.`,
  );
  if (co.giu > 0) {
    const daXoaHta = donBanCuTheoDuoi(tmHocTiengAnh, ".db.gz", co.giu);
    if (daXoaHta.length > 0) {
      console.log(`[o-e:other] Xoay vòng hoc-tieng-anh (giữ ${co.giu}): Đã xoá ${daXoaHta.length} bản cũ: ${daXoaHta.join(", ")}`);
    }
  }

  // 2. shopee-pg (PostgreSQL dumps)
  console.log("\n[o-e:other] 2. Kiểm tra backup shopee-pg (/var/lib/shopee-hub/backups/pg/shopee-*.sql.gz)...");
  const dsShopee = layDanhSachFileTuVPS(
    co.host,
    "find /var/lib/shopee-hub/backups/pg -maxdepth 1 -type f -name 'shopee-*.sql.gz' -printf '%s %p\\n' 2>/dev/null || true",
  );
  const kqShopee = keoDanhSachFile(co.host, dsShopee, tmShopee, "shopee-pg");
  console.log(
    `[o-e:other] shopee-pg: ${kqShopee.soMoi} file mới tải về (${(kqShopee.byteMoi / 1024 / 1024).toFixed(2)} MB), `
      + `${kqShopee.soBoQua} file đã có sẵn.`,
  );
  if (co.giu > 0) {
    const daXoaShopee = donBanCuTheoDuoi(tmShopee, ".sql.gz", co.giu);
    if (daXoaShopee.length > 0) {
      console.log(`[o-e:other] Xoay vòng shopee-pg (giữ ${co.giu}): Đã xoá ${daXoaShopee.length} bản cũ: ${daXoaShopee.join(", ")}`);
    }
  }

  // 3. bdslink & trekky: Snapshot docker volumes (nếu không có --chi-keo)
  if (!co.chiKeo) {
    console.log(`\n[o-e:other] 3. Tạo snapshot docker volume cho bdslink & trekky trên ${co.host}...`);
    try {
      const lenhSnapshot = [
        "mkdir -p ~/backups/other-stacks",
        "TS=$(date +%Y-%m-%dT%H-%M-%S)",
        'docker run --rm -v bdslink_sqlite_data:/sqlite:ro -v bdslink_media_data:/media:ro -v "$HOME/backups/other-stacks":/out alpine tar -czf "/out/bdslink-${TS}.tar.gz" /sqlite /media',
        "(cd ~/backups/other-stacks && ls -t bdslink-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f || true)",
        'docker run --rm -v trekky_data:/trekky:ro -v "$HOME/backups/other-stacks":/out alpine tar -czf "/out/trekky-${TS}.tar.gz" /trekky',
        "(cd ~/backups/other-stacks && ls -t trekky-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f || true)",
      ].join(" && ");
      chayLenh("ssh", [co.host, lenhSnapshot], { stdio: "inherit" });
    } catch (err) {
      console.warn(`[o-e:other] Cảnh báo khi tạo snapshot bdslink/trekky trên VPS: ${err.message}`);
    }
  } else {
    console.log("\n[o-e:other] 3. Cờ --chi-keo: Bỏ qua tạo snapshot mới, kéo bản sao lưu hiện có.");
  }

  // Kéo bdslink
  console.log("\n[o-e:other] 3a. Kéo bản snapshot bdslink...");
  const dsBdslink = layDanhSachFileTuVPS(
    co.host,
    "find ~/backups/other-stacks ~/backups -maxdepth 1 -type f -name 'bdslink-*.tar.gz' -printf '%s %p\\n' 2>/dev/null || true",
  );
  const kqBdslink = keoDanhSachFile(co.host, dsBdslink, tmBdslink, "bdslink");
  console.log(
    `[o-e:other] bdslink: ${kqBdslink.soMoi} file mới tải về (${(kqBdslink.byteMoi / 1024 / 1024).toFixed(2)} MB), `
      + `${kqBdslink.soBoQua} file đã có sẵn.`,
  );
  if (co.giu > 0) {
    const daXoaBdslink = donBanCuTheoDuoi(tmBdslink, ".tar.gz", co.giu);
    if (daXoaBdslink.length > 0) {
      console.log(`[o-e:other] Xoay vòng bdslink (giữ ${co.giu}): Đã xoá ${daXoaBdslink.length} bản cũ: ${daXoaBdslink.join(", ")}`);
    }
  }

  // Kéo trekky
  console.log("\n[o-e:other] 3b. Kéo bản snapshot trekky...");
  const dsTrekky = layDanhSachFileTuVPS(
    co.host,
    "find ~/backups/other-stacks ~/backups -maxdepth 1 -type f -name 'trekky-*.tar.gz' -printf '%s %p\\n' 2>/dev/null || true",
  );
  const kqTrekky = keoDanhSachFile(co.host, dsTrekky, tmTrekky, "trekky");
  console.log(
    `[o-e:other] trekky: ${kqTrekky.soMoi} file mới tải về (${(kqTrekky.byteMoi / 1024 / 1024).toFixed(2)} MB), `
      + `${kqTrekky.soBoQua} file đã có sẵn.`,
  );
  if (co.giu > 0) {
    const daXoaTrekky = donBanCuTheoDuoi(tmTrekky, ".tar.gz", co.giu);
    if (daXoaTrekky.length > 0) {
      console.log(`[o-e:other] Xoay vòng trekky (giữ ${co.giu}): Đã xoá ${daXoaTrekky.length} bản cũ: ${daXoaTrekky.join(", ")}`);
    }
  }
}

async function main() {
  const co = docCo(process.argv.slice(2));
  console.log("================================================================================");
  console.log("GIKKY.NET — ĐỒNG BỘ SAO LƯU PRODUCTION VỀ Ổ CỨNG E:");
  console.log(`Đích lưu trữ:   ${co.dich}`);
  console.log(`Máy chủ VPS:    ${co.host}`);
  console.log(`Giữ bản dump:   ${co.giu} bản gần nhất`);
  console.log(`Chỉ gikky:      ${co.chiGikky ? "BẬT (không sao lưu stack khác)" : "TẮT (sao lưu cả các stack khác)"}`);
  console.log("================================================================================");

  const tmDb = join(co.dich, "db");
  const tmLichSu = join(co.dich, "db-lich-su");
  const tmMedia = join(co.dich, "media");
  const tmMediaAn = join(co.dich, "media-an");

  mkdirSync(tmDb, { recursive: true });
  mkdirSync(tmLichSu, { recursive: true });
  mkdirSync(tmMedia, { recursive: true });
  mkdirSync(tmMediaAn, { recursive: true });

  // Bước 1: Yêu cầu VPS chụp bản dump và đồng bộ media mới nhất (nếu không có --chi-keo)
  if (!co.chiKeo) {
    console.log(`[o-e] Kích hoạt tạo bản sao lưu mới trên ${co.host}...`);
    try {
      chayLenh("ssh", [co.host, "cd ~/gikky-net/src && bash deploy/prod/sao-luu-prod.sh"], {
        stdio: "inherit",
      });
    } catch (err) {
      console.error(`[o-e] Cảnh báo khi chạy script trên VPS: ${err.message}`);
    }
  } else {
    console.log("[o-e] Cờ --chi-keo được bật: Bỏ qua tạo bản dump mới trên VPS, bắt đầu kéo dữ liệu hiện có.");
  }

  // Bước 2: Kéo các bản dump trong ~/gikky-net/backup/db/
  console.log("\n[o-e] 1. Kiểm tra các bản dump Postgres mới nhất...");
  const danhSachDump = layDanhSachFileTuVPS(
    co.host,
    "find ~/gikky-net/backup/db -type f -name '*.dump' -printf '%s %p\\n' 2>/dev/null || true",
  );
  const kqDump = keoDanhSachFile(co.host, danhSachDump, tmDb, "dump DB");
  console.log(
    `[o-e] Dump DB: ${kqDump.soMoi} file mới tải về (${(kqDump.byteMoi / 1024 / 1024).toFixed(2)} MB), `
      + `${kqDump.soBoQua} file đã có sẵn.`,
  );

  // Bước 3: Kéo các bản dump & sql.gz lịch sử từ các lần deploy/migrate trước
  console.log("\n[o-e] 2. Kiểm tra các bản dump & sql.gz lịch sử trên VPS...");
  const danhSachLichSu = layDanhSachFileTuVPS(
    co.host,
    "find ~/gikky-net/backup ~/gikky-net/backups -maxdepth 1 -type f \\( -name '*.sql.gz' -o -name '*.dump' \\) -printf '%s %p\\n' 2>/dev/null || true",
  );
  const kqLichSu = keoDanhSachFile(co.host, danhSachLichSu, tmLichSu, "lịch sử DB");
  console.log(
    `[o-e] Lịch sử DB: ${kqLichSu.soMoi} file mới tải về (${(kqLichSu.byteMoi / 1024 / 1024).toFixed(2)} MB), `
      + `${kqLichSu.soBoQua} file đã có sẵn.`,
  );

  // Bước 4: Đồng bộ kho ảnh media và media-an
  if (!co.khongAnh) {
    console.log("\n[o-e] 3. Đồng bộ kho ảnh production...");
    await dongBoAnh(co.host, co.dich);
  } else {
    console.log("\n[o-e] 3. Cờ --khong-anh: Bỏ qua đồng bộ ảnh.");
  }

  // Bước 5: Xoay vòng bản dump tại tmDb
  if (co.giu > 0) {
    const daXoa = donBanCu(tmDb, co.giu);
    if (daXoa.length > 0) {
      console.log(`\n[o-e] Xoay vòng bản dump cục bộ (giữ ${co.giu}): Đã xoá ${daXoa.length} bản cũ: ${daXoa.join(", ")}`);
    }
  }

  // Đồng bộ các stack khác (hoc-tieng-anh, shopee-pg, bdslink, trekky) nếu không có --chi-gikky
  if (!co.chiGikky) {
    await dongBoStackKhac(co);
  } else {
    console.log("\n[o-e] Cờ --chi-gikky được bật: Bỏ qua đồng bộ các stack khác trên VPS.");
  }

  // Bước 6: Thống kê tổng kết
  const tkDb = thongKeThuMuc(tmDb);
  const tkLichSu = thongKeThuMuc(tmLichSu);
  const tkMedia = thongKeThuMuc(tmMedia);
  const tkMediaAn = thongKeThuMuc(tmMediaAn);

  console.log("\n================================================================================");
  console.log("BÁO CÁO TỔNG KẾT SAO LƯU TRÊN Ổ E:");
  console.log(`[gikky.net] — Thư mục: ${co.dich}`);
  console.log(`  - DB Dump mới:    ${tkDb.soLuong} file (${(tkDb.tongByte / 1024 / 1024).toFixed(2)} MB) tại ${tmDb}`);
  console.log(`  - DB Lịch sử:     ${tkLichSu.soLuong} file (${(tkLichSu.tongByte / 1024 / 1024).toFixed(2)} MB) tại ${tmLichSu}`);
  console.log(`  - Kho ảnh media:  ${tkMedia.soLuong} file (${(tkMedia.tongByte / 1024 / 1024).toFixed(2)} MB) tại ${tmMedia}`);
  console.log(`  - Kho ảnh ẩn:     ${tkMediaAn.soLuong} file (${(tkMediaAn.tongByte / 1024 / 1024).toFixed(2)} MB) tại ${tmMediaAn}`);
  const tongByteGikky = tkDb.tongByte + tkLichSu.tongByte + tkMedia.tongByte + tkMediaAn.tongByte;
  console.log(`  -> Tổng gikky.net: ${(tongByteGikky / 1024 / 1024).toFixed(2)} MB`);

  let tongByteKhac = 0;
  if (!co.chiGikky) {
    const tmHocTiengAnh = join(co.dichKhac, "hoc-tieng-anh");
    const tmShopee = join(co.dichKhac, "shopee-pg");
    const tmBdslink = join(co.dichKhac, "bdslink");
    const tmTrekky = join(co.dichKhac, "trekky");

    const tkHta = thongKeThuMuc(tmHocTiengAnh);
    const tkShopee = thongKeThuMuc(tmShopee);
    const tkBdslink = thongKeThuMuc(tmBdslink);
    const tkTrekky = thongKeThuMuc(tmTrekky);

    tongByteKhac = tkHta.tongByte + tkShopee.tongByte + tkBdslink.tongByte + tkTrekky.tongByte;

    console.log(`\n[other-stacks] — Thư mục: ${co.dichKhac}`);
    console.log(`  - hoc-tieng-anh:  ${tkHta.soLuong} file (${(tkHta.tongByte / 1024 / 1024).toFixed(2)} MB) tại ${tmHocTiengAnh}`);
    console.log(`  - shopee-pg:      ${tkShopee.soLuong} file (${(tkShopee.tongByte / 1024 / 1024).toFixed(2)} MB) tại ${tmShopee}`);
    console.log(`  - bdslink:        ${tkBdslink.soLuong} file (${(tkBdslink.tongByte / 1024 / 1024).toFixed(2)} MB) tại ${tmBdslink}`);
    console.log(`  - trekky:         ${tkTrekky.soLuong} file (${(tkTrekky.tongByte / 1024 / 1024).toFixed(2)} MB) tại ${tmTrekky}`);
    console.log(`  -> Tổng các stack khác: ${(tongByteKhac / 1024 / 1024).toFixed(2)} MB`);
  }

  const tongByteTatCa = tongByteGikky + tongByteKhac;
  console.log("\n--------------------------------------------------------------------------------");
  console.log(`-> TỔNG DUNG LƯỢNG SAO LƯU AN TOÀN TRÊN Ổ E: ${(tongByteTatCa / 1024 / 1024).toFixed(2)} MB`);
  console.log("================================================================================");
}

const goiThang = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (goiThang) {
  main().catch((err) => {
    console.error(`[o-e] THẤT BẠI: ${err.message}`);
    process.exit(1);
  });
}
