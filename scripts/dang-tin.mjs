/** Đăng **một mốc bản tin** lên gikky qua API công khai.
 *
 *   `plans/2026-08-25-bot-tin-tuc.md` (bản đầu) · `plans/2026-08-26-bot-mot-mach-mot-ngay.md`
 *
 *   node scripts/dang-tin.mjs --file <bai.json> --slot dem-qua
 *
 * ## Một mạch mỗi ngày, ba mốc — không phải ba bài rời (plan 2026-08-26)
 *
 * Ba khung giờ trong ngày ghi vào **cùng một mạch**: 06:12 tạo mạch + mốc 1, 08:07 và
 * 19:33 nối mốc 2 và 3. Ba bài rời phá mất thông tin *"tin ra lúc 06:15, thị trường phản
 * ứng thế nào lúc 08:11"* — thông tin ấy chỉ tồn tại khi chúng nằm chung một dòng thời
 * gian.
 *
 * **Nhánh TẠO hay NỐI do sổ cái quyết, không do tên slot.** Sổ cái nhớ `mach_id` theo
 * NGÀY VN; không có ⇒ tạo, có ⇒ nối. Xem khối chú thích trong `main()` cho ca "khung
 * đầu lỡ" mà luật này tồn tại để cứu.
 *
 * ## Vì sao một script chứ không để mỗi lượt LLM tự gọi HTTP
 *
 * Ba lượt/ngày × mỗi lượt một chuỗi ba request có CSRF là ba cơ hội để một phiên làm sai
 * một bước **khác nhau**, và một bước sai ở đây trả 403 trông y hệt 403 phân quyền. Script
 * cố định hoá hợp đồng và **test được**; phần LLM chỉ còn việc nó làm tốt — đọc tin và
 * viết chữ.
 *
 * ## Chuỗi ba request (tham chiếu: `apps/web/lib/tai-khoan.ts`)
 *
 *   ① GET  /api/_allauth/browser/v1/auth/session  → cookie `csrftoken`
 *   ② POST /api/_allauth/browser/v1/auth/login    {email, password}  → cookie phiên
 *   ③ POST /api/v1/machs             (TẠO)        X-CSRFToken + cookie phiên  → 201
 *     hoặc
 *   ③ POST /api/v1/machs/{id}/mocs   (NỐI)        X-CSRFToken + cookie phiên  → 201
 *
 * Bước ① **không bỏ được**: Django kiểm mọi POST bằng cặp cookie `csrftoken` + header
 * `X-CSRFToken`, và allauth đặt cookie ấy trên **mọi** phản hồi của client `browser`.
 * Bước ① trả **401** khi chưa đăng nhập — đó là trạng thái đúng, không phải lỗi.
 *
 * ⚠ **Django xoay `csrftoken` khi đăng nhập** (`rotate_token`). Token dùng cho bước ③
 * phải là token đọc lại từ phản hồi của bước ②, không phải token của bước ①.
 *
 * ## Vì sao `Origin` được đặt tay
 *
 * Với request **https**, Django đòi `Origin` hoặc `Referer` khớp host; `fetch` của Node
 * không tự thêm cái nào cho một lời gọi server-to-server. Thiếu chúng thì mọi lượt đăng
 * lên `https://gikky.net` ăn 403 CSRF — mà ở dev (http) lại chạy ngon, vì Django bỏ qua
 * phép kiểm ấy khi không có cả hai. Đúng loài lỗi chỉ lộ ra trên prod.
 *
 * ## Mã thoát là HỢP ĐỒNG
 *
 * Xem `MA` trong `scripts/tin-tuc/lib.mjs`. Tóm tắt: 0 xong · 2 bài hỏng · 3 đã đăng
 * slot này hôm nay · 4 ngoài khung giờ · 5 mạch của ngày có nhưng không nối vào được
 * (mod khoá / đóng sổ / hết hạn mức) · 1 mọi thứ khác. Scheduled task không ai đọc
 * stdout, nên mã thoát là kênh duy nhất phân biệt "bot từ chối có lý do" với "bot hỏng"
 * — và 3, 4, 5 đều là hành vi ĐÚNG, không phải sự cố cần đi sửa.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MA,
  SLOT,
  canhBaoThieuTruong,
  daDang,
  demKyTu,
  docCauHinh,
  docSoCai,
  ghiNhanDaDang,
  ghiSoCai,
  gioVN,
  khongNoiDuoc,
  khungGioCuaSlot,
  kiemTraBaiViet,
  machCuaNgay,
  ngayVN,
  ngoaiKhungGio,
  thanNoiMoc,
  thoiDiemBayGio,
} from "./tin-tuc/lib.mjs";

const thuMucScript = dirname(fileURLToPath(import.meta.url));
const goc_repo = resolve(thuMucScript, "..");

const ALLAUTH = "/api/_allauth/browser/v1";

/** User-Agent tường minh của bot. Xem lý do ở `goi()`. */
const UA = "gikky-news-bot/1.0 (+https://gikky.net)";

/** Đường mặc định của file bí mật và của sổ cái.
 *
 * Cả hai cho phép ghi đè bằng biến môi trường, và **bài đo bắt buộc phải dùng lối ghi
 * đè đó**: một bài đo ghi vào sổ cái thật sẽ tự làm mình đỏ ở lần chạy thứ hai (slot
 * "đã đăng hôm nay"), và một bài đo đọc `.env` thật sẽ trỏ vào `https://gikky.net` —
 * tức `pnpm test` đăng bài lên site thật.
 */
const duongEnvMacDinh = (env) =>
  String(env.GIKKY_BOT_ENV_FILE ?? "").trim() || join(thuMucScript, "tin-tuc", ".env");
const duongSoCaiMacDinh = (env) =>
  String(env.GIKKY_BOT_SO_CAI ?? "").trim() || join(thuMucScript, "tin-tuc", "da-dang.json");

const CACH_DUNG = `Cách dùng:
  node scripts/dang-tin.mjs --file <bai.json> --slot <tên>
                            [--ep] [--thu] [--origin https://gikky.net]
                            [--som-nhat HH:MM] [--han-chot HH:MM]

  --file      JSON {sub, title, body, loai, question_for_crowd, figures}. BẮT BUỘC.
              LUÔN có sub + title, kể cả khi lượt này chỉ nối mốc: khung đầu lỡ thì
              khung sau phải tự tạo được mạch (plan 2026-08-26 §3.2).
  --slot      ${Object.keys(SLOT).join(" | ")}. BẮT BUỘC.
              Khung giờ đi kèm slot, không phải gõ tay — xem bảng dưới.
  --ep        bỏ qua sổ cái chống trùng. KHÔNG tạo mạch thứ hai trong ngày —
              mạch của ngày đã có thì --ep nối thêm một mốc nữa vào chính nó.
  --thu       chạy thử: soát mọi thứ rồi dừng, KHÔNG gọi mạng.
  --origin    gốc site; mặc định GIKKY_ORIGIN trong scripts/tin-tuc/.env.
  --som-nhat  ghi đè sàn giờ của slot. CHỈ dành cho chạy tay.
  --han-chot  ghi đè trần giờ của slot. CHỈ dành cho chạy tay.

Khung giờ mặc định (giờ VN) — ngoài khoảng này thoát ${MA.NGOAI_KHUNG}:
${Object.entries(SLOT)
  .map(([ten, k]) => `  ${ten.padEnd(16)} ${k.som_nhat}–${k.han_chot}  (lịch chạy ${k.chay})`)
  .join("\n")}`;

/** Lỗi mang sẵn mã thoát — để `main()` không phải đoán lỗi nào ra số nào. */
class LoiCoMa extends Error {
  constructor(ma, message) {
    super(message);
    this.ma = ma;
  }
}

/** Bóc `--co --khoa giatri` thành object. Cờ lạ là **lỗi**, không bỏ qua im lặng.
 *
 * Bỏ qua im lặng nghĩa là `--han-chôt 07:00` (gõ nhầm một dấu) chạy trơn tru mà không
 * còn hàng rào chống-đăng-tin-ôi nào — hỏng đúng cái thứ ta thêm cờ ấy vào để chống.
 */
function bocThamSo(argv) {
  const co = new Set(["--ep", "--thu"]);
  const khoa = new Set(["--file", "--slot", "--han-chot", "--som-nhat", "--origin"]);
  const ra = { ep: false, thu: false };

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (co.has(t)) {
      ra[t.slice(2)] = true;
      continue;
    }
    if (khoa.has(t)) {
      const gia_tri = argv[i + 1];
      if (gia_tri === undefined || gia_tri.startsWith("--")) {
        throw new LoiCoMa(MA.LOI, `${t} cần một giá trị.\n\n${CACH_DUNG}`);
      }
      ra[t.slice(2).replace(/-/g, "_")] = gia_tri;
      i += 1;
      continue;
    }
    throw new LoiCoMa(MA.LOI, `Tham số lạ: ${t}\n\n${CACH_DUNG}`);
  }

  if (ra.file === undefined) throw new LoiCoMa(MA.LOI, `Thiếu --file.\n\n${CACH_DUNG}`);
  if (ra.slot === undefined) throw new LoiCoMa(MA.LOI, `Thiếu --slot.\n\n${CACH_DUNG}`);
  // ⚠ Soát **giá trị** của `--slot`, không chỉ soát tên cờ. Parser này rất nghiêm với
  // tên cờ (`--han-chôt` ⇒ "Tham số lạ") nhưng bản đầu nhận mọi chuỗi làm slot, kể cả
  // rỗng — và slot là **khoá của sổ cái**. `--slot dem_qua` thay `dem-qua` cho ra một
  // khoá khác ⇒ hàng rào chống trùng biến mất im lặng, exit 0, hai bản tin một ngày.
  // Ném ở đây để câu lỗi liệt kê đúng ba tên hợp lệ.
  khungGioCuaSlot(ra.slot);
  return ra;
}

/** Đọc + parse file bài. Hỏng ⇒ `MA.BAI_HONG`: đây là dữ liệu bài, không phải sự cố hệ thống. */
function docBai(duong) {
  let tho;
  try {
    tho = readFileSync(resolve(goc_repo, duong), "utf8");
  } catch (e) {
    throw new LoiCoMa(MA.BAI_HONG, `Không đọc được ${duong}: ${e.message}`);
  }
  try {
    return JSON.parse(tho);
  } catch (e) {
    throw new LoiCoMa(MA.BAI_HONG, `${duong} không phải JSON hợp lệ: ${e.message}`);
  }
}

// --- Tầng HTTP ---------------------------------------------------------------

/** Hũ cookie tối giản: `fetch` của Node không giữ cookie giữa các lời gọi. */
class HuCookie {
  #kho = new Map();

  /** Nạp `Set-Cookie` của một phản hồi. Chỉ lấy cặp `tên=giá trị`, bỏ mọi thuộc tính.
   *
   * Bỏ `Domain`/`Path`/`Secure` là an toàn ở đây và **chỉ** ở đây: hũ này sống đúng một
   * lượt chạy và nói chuyện với đúng một origin, nên không có bên thứ hai nào để rò
   * cookie sang.
   */
  nap(phan_hoi) {
    for (const dong of phan_hoi.headers.getSetCookie()) {
      const cap = dong.split(";", 1)[0];
      const cat = cap.indexOf("=");
      if (cat <= 0) continue;
      const ten = cap.slice(0, cat).trim();
      const gia_tri = cap.slice(cat + 1).trim();
      // Django xoá cookie bằng cách đặt giá trị rỗng + Max-Age=0.
      if (gia_tri === "" || gia_tri === '""') this.#kho.delete(ten);
      else this.#kho.set(ten, gia_tri);
    }
  }

  lay(ten) {
    return this.#kho.get(ten) ?? "";
  }

  header() {
    return [...this.#kho].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

/** Một lời gọi có cookie + CSRF. Trả `{ trangThai, than }`. */
async function goi(origin, duong, { method = "GET", than, hu }) {
  const header = {
    Accept: "application/json",
    Cookie: hu.header(),
    // Xem docstring module: Django (https) đòi một trong hai, `fetch` của Node không tự
    // thêm cái nào.
    Origin: origin,
    Referer: `${origin}/`,
    // UA tường minh thay cho `user-agent: node` mặc định. Hai lý do, cả hai thực dụng:
    // `gikky.net` nằm sau **Cloudflare Tunnel** (`plans/2026-08-25-deploy-vps-docker.md`),
    // và một request `user-agent: node` không cookie là mục tiêu điển hình của Bot Fight
    // Mode — triệu chứng sẽ là một trang challenge HTML trả về chỗ chờ JSON. Có UA riêng
    // thì đặt được WAF skip rule, và log của Caddy tách được bot khỏi người thật.
    "User-Agent": UA,
  };
  if (method !== "GET") {
    header["Content-Type"] = "application/json";
    header["X-CSRFToken"] = hu.lay("csrftoken");
  }

  const r = await fetch(`${origin}${duong}`, {
    method,
    headers: header,
    body: than === undefined ? undefined : JSON.stringify(than),
    redirect: "manual",
  });
  hu.nap(r);
  const van_ban = await r.text();
  let doc = null;
  try {
    doc = van_ban === "" ? null : JSON.parse(van_ban);
  } catch {
    doc = null;
  }
  return { trangThai: r.status, than: doc, van_ban };
}

/** Câu lỗi đọc được từ thân lỗi của allauth (`errors[]`) hoặc của Ninja (`detail`). */
function cauLoi(than, van_ban) {
  const dau = than?.errors?.[0]?.message ?? than?.detail ?? than?.chi_tiet ?? than?.message;
  if (typeof dau === "string" && dau !== "") return dau;
  return (van_ban ?? "").slice(0, 300).replace(/\s+/g, " ").trim() || "(thân rỗng)";
}

/** 429 là mã DUY NHẤT của API v1 mang thêm `thu_lai_tu` (`api/api/schemas.py::
 * LoiThoiGianOut`) — nửa đêm giờ VN kế tiếp. Vứt nó đi là biến "hết hạn mức, mai đăng
 * tiếp" thành một lỗi không rõ đợi tới bao giờ.
 */
function duoiThuLaiTu({ trangThai, than }) {
  return trangThai === 429 && typeof than?.thu_lai_tu === "string"
    ? ` (thử lại từ ${than.thu_lai_tu})`
    : "";
}

/** ①② — lấy csrftoken rồi đăng nhập. Trả hũ cookie đã sẵn sàng cho bước ③. */
async function dangNhap(origin, email, matKhau) {
  const hu = new HuCookie();

  // ① Lấy cookie csrftoken. 401 ở đây là "chưa đăng nhập" — đúng trạng thái đang có.
  const phien = await goi(origin, `${ALLAUTH}/auth/session`, { hu });
  if (phien.trangThai !== 200 && phien.trangThai !== 401) {
    throw new LoiCoMa(
      MA.LOI,
      `Không lấy được phiên từ ${origin} (HTTP ${phien.trangThai}): ` +
        cauLoi(phien.than, phien.van_ban),
    );
  }
  if (hu.lay("csrftoken") === "") {
    throw new LoiCoMa(
      MA.LOI,
      `${origin}${ALLAUTH}/auth/session không đặt cookie csrftoken — ` +
        "origin này có phải gikky không?",
    );
  }

  // ② Đăng nhập bằng EMAIL (ACCOUNT_LOGIN_METHODS = {"email"}), không phải username.
  const dn = await goi(origin, `${ALLAUTH}/auth/login`, {
    method: "POST",
    than: { email, password: matKhau },
    hu,
  });
  if (dn.trangThai !== 200) {
    throw new LoiCoMa(
      MA.LOI,
      `Đăng nhập thất bại cho ${email} (HTTP ${dn.trangThai}): ` +
        cauLoi(dn.than, dn.van_ban),
    );
  }
  return hu;
}

/** ③-TẠO — `POST /machs`. Trả `{ mach_id, url, seq, body_da_luu }`.
 *
 * Mọi mã ≠ 201 ở đây là `MA.LOI`, **không** phải `KHONG_NOI_DUOC`: mã 5 nghĩa là "mạch
 * của ngày có tồn tại nhưng không nối vào được", mà ở nhánh này thì chưa có mạch nào cả.
 */
async function taoMach({ origin, hu, bai }) {
  const dang = await goi(origin, "/api/v1/machs", { method: "POST", than: bai, hu });
  if (dang.trangThai !== 201) {
    throw new LoiCoMa(
      MA.LOI,
      `POST /api/v1/machs trả ${dang.trangThai}: ${cauLoi(dang.than, dang.van_ban)}` +
        duoiThuLaiTu(dang),
    );
  }

  const { id, slug, mocs } = dang.than ?? {};
  if (typeof id !== "number") {
    throw new LoiCoMa(MA.LOI, "201 nhưng thân không có `id` — hợp đồng đã đổi?");
  }
  // `MachChiTietOut.mocs[]` mang `body` **đã qua `lam_sach`** — tức thứ độc giả sẽ thấy
  // thật, không phải thứ ta gửi lên. Đó là dữ liệu duy nhất trả lời được câu "bài có bị
  // lọc mất cấu trúc không"; xem `canhBaoBiLoc`.
  const body_da_luu = Array.isArray(mocs) ? (mocs[0]?.body ?? null) : null;
  return { mach_id: id, url: `${origin}/m/${slug ?? ""}-${id}`, seq: 1, body_da_luu };
}

/** ③-NỐI — `POST /machs/{id}/mocs`. Trả `{ mach_id, url, seq, moc_id, body_da_luu }`.
 *
 * ## Vì sao 4xx ra mã thoát RIÊNG (plan §3.3)
 *
 * Mạch của ngày là một hàng dữ liệu mà **người khác động vào được**: mod khoá nó lúc
 * 10:00 (403 `mach_bi_khoa`), chủ mạch đóng sổ (409 `mach_da_dong`), mạch bị xoá (404),
 * hoặc đã đủ 3 mốc trong ngày (429 `qua_han_muc_moc`). Cả bốn đều là **hệ thống đang
 * chạy đúng**; gộp chúng vào mã 1 là dạy người trực rằng mỗi lần mod khoá một bài thì
 * có một con bot hỏng cần đi sửa.
 *
 * ## Vì sao KỂ TÊN bốn mã, không lấy cả dải 4xx
 *
 * Bản đầu lấy "mọi 4xx" cho gọn và để một mã mới của API sau này không rơi về `LOI` im
 * lặng. Cái giá hoá ra đắt hơn: **`400` do chính bot gửi thân bài sai cũng ra mã 5.**
 * Ca thật, dựng lại được — file bài mang `occurred_at` dạng ISO đầy đủ
 * (`"2026-08-26T19:33:00Z"`) thì cùng MỘT file hỏng cho hai mã trái ngược: slot đi
 * nhánh TẠO ra mã 1 ("bot hỏng, đi sửa"), slot đi nhánh NỐI ra mã 5 mà `lich/*.md` dạy
 * là *"Dừng. Đây không phải lỗi code."* Người trực đọc mã 5 rồi bỏ qua, và bot hỏng cả
 * tuần.
 *
 * Danh sách đóng thì một mã lạ rơi về `LOI` — hướng hỏng ĐÚNG: `LOI` bảo người ta đi
 * xem, `KHONG_NOI_DUOC` bảo người ta đừng.
 */
/** Câu chỉ đường cứu cho mã 5. **`--ep` KHÔNG cứu được ca này** — phải nói ra.
 *
 * `--ep` chỉ bỏ hàng rào chống trùng của slot; nó không đổi nhánh TẠO/NỐI, nên chạy lại
 * với `--ep` vẫn nối vào đúng cái mạch đang khoá và vẫn ra mã 5. Người trực đọc `--help`
 * thấy "bỏ qua sổ cái chống trùng" thì gần như chắc chắn thử `--ep` trước — và mất thêm
 * một lượt nữa.
 *
 * Đường cứu duy nhất là sửa tay sổ cái. In sẵn khối JSON đúng dạng vì điền tay dễ sai
 * đúng một chỗ không có gì báo: `"mach_id": "1010"` (chuỗi thay vì số) làm `machCuaNgay`
 * trả `null` ⇒ bot đẻ mạch thứ hai, im lặng, rồi ghi đè mất luôn bản ghi vừa điền.
 */
function chiDuongCuuMa5(duong_so_cai, ngay, mach_id) {
  return (
    `\n\nCách xử lý — LƯU Ý \`--ep\` KHÔNG cứu được ca này (nó chỉ bỏ hàng rào chống ` +
    `trùng, không đổi nhánh tạo/nối):\n` +
    `  • Nếu mạch ${mach_id} chỉ bị khoá/đóng tạm: mở lại rồi chạy lại đúng lệnh cũ.\n` +
    `  • Nếu mạch đã bị ẩn/xoá hẳn và bạn muốn hôm nay có mạch MỚI: mở ${duong_so_cai}\n` +
    `    rồi XOÁ nguyên khoá "${ngay}". Lượt chạy sau sẽ tạo mạch mới.\n` +
    `  • Nếu muốn trỏ sang một mạch khác, sửa bản ghi thành ĐÚNG dạng này —\n` +
    `    \`mach_id\` phải là SỐ, không phải chuỗi, nếu không bot lặng lẽ tạo mạch thứ hai:\n` +
    `      "${ngay}": { "mach_id": 1234, "url": "https://…/m/…-1234", "slot": {} }`
  );
}
async function noiMoc({ origin, hu, mach_id, bai, duong_so_cai, ngay }) {
  const duong = `/api/v1/machs/${mach_id}/mocs`;
  const dang = await goi(origin, duong, { method: "POST", than: thanNoiMoc(bai), hu });
  if (dang.trangThai !== 201) {
    const khong_noi_duoc = khongNoiDuoc(dang.trangThai);
    throw new LoiCoMa(
      khong_noi_duoc ? MA.KHONG_NOI_DUOC : MA.LOI,
      `POST /api/v1${duong} trả ${dang.trangThai}: ` +
        `${cauLoi(dang.than, dang.van_ban)}${duoiThuLaiTu(dang)}` +
        (khong_noi_duoc ? chiDuongCuuMa5(duong_so_cai, ngay, mach_id) : ""),
    );
  }

  const { id, seq, body } = dang.than ?? {};
  if (typeof id !== "number" || typeof seq !== "number") {
    throw new LoiCoMa(MA.LOI, "201 nhưng thân không có `id`/`seq` — hợp đồng đã đổi?");
  }
  return { mach_id, seq, moc_id: id, body_da_luu: typeof body === "string" ? body : null };
}

/** Ngưỡng cảnh báo: giữ lại dưới ngần này thì thân bài đã bị lọc mất phần đáng kể. */
const TY_LE_GIU_TOI_THIEU = 0.9;

/** So thân bài **đã lưu** với thân bài **đã gửi**, cảnh báo khi lệch nhiều. Không đổi mã thoát.
 *
 * `core/lam_sach_html.py` là **allowlist** và nó gỡ im lặng: server chỉ từ chối khi thân
 * bài rỗng HẲN sau khi lọc. Giữa "rỗng hẳn" và "nguyên vẹn" là một vùng xám mà không ai
 * nhìn, và bot đi thẳng vào đó — LLM soạn bài viết `## Tiêu đề` (markdown thay vì HTML),
 * `<table>`, `<div>`, `style=`, hay `<img src="https://cdn.reuters.com/…">`: tất cả bị
 * gỡ, server vẫn trả 201, script vẫn exit 0, và bài hiện ra là một khối chữ liền.
 *
 * Không nâng thành lỗi: bài **đã đăng rồi**, đổi mã thoát chỉ khiến người đọc tưởng nó
 * chưa đăng — đúng cái bẫy vừa vá ở `main()`. Việc đúng là nói ra, để lượt sau sửa prompt.
 */
function canhBaoBiLoc(body_gui, body_luu) {
  if (typeof body_luu !== "string" || body_luu === "") return;
  const gui = demKyTu(body_gui);
  if (gui === 0) return;
  // Ammonia **thêm** `rel`/`target` vào mỗi `<a>`, nên thân đã lưu thường DÀI hơn thân
  // gửi lên. Chỉ cảnh báo chiều ngắn đi.
  if (demKyTu(body_luu) / gui >= TY_LE_GIU_TOI_THIEU) return;
  process.stderr.write(
    `⚠ Thân bài bị server lọc mất ${Math.round((1 - demKyTu(body_luu) / gui) * 100)}% ` +
      `ký tự (${gui} → ${demKyTu(body_luu)}). Bài VẪN ĐĂNG, nhưng gần như chắc chắn nó ` +
      "đang thiếu cấu trúc: thẻ ngoài allowlist bị gỡ im lặng (markdown thô, <table>, " +
      "<div>, style=, <img> trỏ ra ngoài site). Xem lại thân bài trước khi soạn lượt sau.\n",
  );
}

// --- Điều phối ---------------------------------------------------------------

async function main(argv, env) {
  const tham_so = bocThamSo(argv);
  const bai = docBai(tham_so.file);

  // "Bây giờ" phải tính TRƯỚC khi soát bài: `occurred_at` không được là ngày tương lai,
  // và "tương lai" chỉ có nghĩa khi đã biết hôm nay là ngày nào **giờ VN**. Cả hai đều
  // là phép tính thuần, không chạm đĩa và không mở socket, nên đưa lên đây không phá
  // thứ tự ba phép chặn bên dưới.
  const bay_gio = thoiDiemBayGio(env);
  const ngay = ngayVN(bay_gio);

  // Thứ tự ba phép chặn dưới đây là có chủ đích:
  //   1. **bài hỏng** trước — đó là lỗi người soạn phải sửa, đúng bất kể giờ giấc;
  //   2. **hạn chót** — quá giờ thì bản tin ôi, khỏi bàn tới chuyện trùng;
  //   3. **sổ cái** cuối, vì nó là phép chặn duy nhất chạm đĩa.
  // Cả ba đều nằm TRƯỚC mọi socket.
  const loi_bai = kiemTraBaiViet(bai, { ngayHomNay: ngay });
  if (loi_bai.length > 0) {
    throw new LoiCoMa(MA.BAI_HONG, `Bài không hợp lệ:\n- ${loi_bai.join("\n- ")}`);
  }

  // Khung giờ lấy TỪ SLOT; hai cờ chỉ để ghi đè khi chạy tay. Xem docstring `SLOT`.
  const mac_dinh = khungGioCuaSlot(tham_so.slot);
  const khung = {
    som_nhat: tham_so.som_nhat ?? mac_dinh.som_nhat,
    han_chot: tham_so.han_chot ?? mac_dinh.han_chot,
  };
  const lech = ngoaiKhungGio(khung, bay_gio);
  if (lech !== null) {
    throw new LoiCoMa(
      MA.NGOAI_KHUNG,
      `Slot "${tham_so.slot}" chỉ đăng trong khoảng ${khung.som_nhat}–${khung.han_chot} ` +
        `giờ VN: ${lech}\n(Bây giờ là ${ngay} lúc ${gioVN(bay_gio)} giờ VN.)`,
    );
  }

  const duong_so_cai = duongSoCaiMacDinh(env);
  const so_cai = docSoCai(duong_so_cai);
  if (!tham_so.ep) {
    const cu = daDang(so_cai, tham_so.slot, ngay);
    if (cu !== null) {
      throw new LoiCoMa(
        MA.TRUNG,
        `Slot "${tham_so.slot}" đã đăng ngày ${ngay} rồi: ${cu.url}\n` +
          "Muốn đăng thêm thì thêm --ep.",
      );
    }
  }

  // ⚠ **Nhánh TẠO hay NỐI do sổ cái quyết, không do tên slot** — plan §3.2.
  //
  // Cám dỗ là viết `if (slot === "dem-qua") tạo; else nối`, vì lịch thường ngày đúng như
  // vậy: 06:12 tạo, 08:07 và 19:33 nối. Nhưng ứng dụng đóng lúc 06:12 là ca thật (cùng
  // ca đã đẻ ra cả sàn giờ lẫn hạn chót), và lúc đó `truoc-phien-vn` mở ra với sổ cái
  // không có `mach_id` nào. Nối theo tên slot ở đây nghĩa là **nối vào hư vô**, còn hỏi
  // sổ cái thì nó tự tạo mạch và ngày đó vẫn có bản tin.
  //
  // Hệ quả đi kèm, đã ghi vào cả ba `lich/*.md`: **mọi slot đều phải mang sẵn tiêu đề**.
  const mach_hom_nay = machCuaNgay(so_cai, ngay);
  const se_tao = mach_hom_nay === null;

  const cau_hinh = docCauHinh({
    env,
    duongEnv: duongEnvMacDinh(env),
    origin: tham_so.origin,
  });

  if (tham_so.thu) {
    const nhanh = se_tao
      ? `TẠO mạch mới trong s/${bai.sub}`
      : `NỐI mốc vào mạch ${mach_hom_nay.mach_id} (${mach_hom_nay.url})`;
    process.stdout.write(
      `thử: ${cau_hinh.origin} ← ${nhanh} — "${bai.title}" ` +
        `(slot ${tham_so.slot}, ngày VN ${ngay}) — KHÔNG gọi mạng.\n`,
    );
    return MA.OK;
  }

  const hu = await dangNhap(cau_hinh.origin, cau_hinh.email, cau_hinh.matKhau);
  const ket = se_tao
    ? await taoMach({ origin: cau_hinh.origin, hu, bai })
    : await noiMoc({
        origin: cau_hinh.origin,
        hu,
        mach_id: mach_hom_nay.mach_id,
        bai,
        duong_so_cai,
        ngay,
      });

  // URL của mạch: ở nhánh tạo là URL vừa dựng từ 201; ở nhánh nối là URL đã nằm sẵn
  // trong sổ cái — `MocOut` không mang slug mạch, nên không dựng lại được từ phản hồi.
  //
  // ⚠ Sổ cái là file người sửa tay được (chính `chiDuongCuuMa5` bảo họ làm thế), nên
  // `url` trong đó có thể rỗng hoặc không phải chuỗi. In một dòng rỗng ra stdout là vỡ
  // im lặng hợp đồng "một dòng, một URL" mà scheduled task đang đọc — dựng lại một URL
  // tối thiểu từ `mach_id` còn hơn: nó vẫn mở đúng bài, vì Django khớp mạch theo id ở
  // đuôi slug.
  const url =
    se_tao || mach_hom_nay.url !== ""
      ? (se_tao ? ket.url : mach_hom_nay.url)
      : `${cau_hinh.origin}/m/-${mach_hom_nay.mach_id}`;
  const { body_da_luu } = ket;

  // ⚠ **URL ra TRƯỚC, ghi sổ SAU, và ghi sổ không được phép làm hỏng lượt này.**
  //
  // Bản đầu làm ngược: `ghiSoCai(...)` đứng trước `stdout.write(url)` và nằm ngoài mọi
  // `try`. Lượt phản biện 2026-08-25 tái hiện được ca thật — `GIKKY_BOT_SO_CAI` trỏ vào
  // một thư mục ⇒ `writeFileSync` ném `EISDIR` ⇒ `catch` ở cuối file đặt exit 1 với một
  // mã lỗi `fs` trần trụi. Hậu quả xếp chồng, cái sau nặng hơn cái trước:
  //   1. bài **đã đăng thật** (server trả 201) nhưng mã thoát nói "lỗi";
  //   2. URL — output duy nhất của script — mất luôn;
  //   3. sổ cái trống ⇒ **hàng rào chống trùng biến mất**, lượt sau đăng bài thứ hai
  //      mà không cần `--ep` và không một dòng cảnh báo.
  // Cùng kết cục với: tiến trình bị kill giữa hai dòng, đĩa đầy, thư mục read-only.
  //
  // Sau khi server đã 201, việc duy nhất còn đúng là **báo cho được cái đã xảy ra**.
  //
  // Nhánh **nối** thừa kế nguyên luật này, không phải một đường riêng nhẹ hơn: mốc 2 và
  // mốc 3 cũng đã vào DB thật trước khi `ghiSoCai` chạy, và sổ cái hỏng ở đó còn xoá
  // mất cả `mach_id` của ngày ⇒ lượt sau **tạo mạch thứ hai** thay vì nối tiếp.
  process.stdout.write(`${url}\n`);
  // Dòng thứ hai chỉ có ở nhánh nối, và có chủ đích: nhánh tạo giữ nguyên hợp đồng "một
  // dòng, một URL" mà scheduled task đang đọc. Ở nhánh nối, URL của mốc 2 và mốc 3 giống
  // hệt nhau — không có dòng này thì log không phân biệt được "đã nối" với "chạy lại một
  // lượt cũ".
  if (!se_tao) {
    process.stdout.write(`mốc ${ket.seq} · ${tham_so.slot} · id ${ket.moc_id}\n`);
  }
  try {
    ghiSoCai(
      duong_so_cai,
      ghiNhanDaDang(so_cai, {
        slot: tham_so.slot,
        ngay,
        mach_id: ket.mach_id,
        url,
        luc: bay_gio,
      }),
    );
  } catch (e) {
    process.stderr.write(
      `⚠ ĐÃ ĐĂNG ${url} nhưng KHÔNG ghi được sổ cái ${duong_so_cai}: ${e.message}\n` +
        `Hàng rào chống trùng của slot "${tham_so.slot}" ngày ${ngay} hiện KHÔNG có ` +
        "hiệu lực — chạy lại slot này hôm nay sẽ đăng TRÙNG. Nặng hơn: sổ không giữ " +
        `được mach_id ${ket.mach_id}, nên các slot còn lại của ngày ${ngay} sẽ TẠO MẠCH ` +
        "MỚI thay vì nối tiếp. Điền tay bản ghi của ngày này trước khi chạy lượt sau.\n",
    );
  }

  canhBaoBiLoc(bai.body, body_da_luu);
  // Cảnh báo trường vắng đi SAU khi đăng, cùng lý lẽ với `canhBaoBiLoc`: bài đã lên rồi,
  // đổi mã thoát chỉ khiến người đọc tưởng nó chưa lên. Việc đúng là nói ra để lượt sau
  // soạn đủ hơn.
  for (const cau of canhBaoThieuTruong(bai)) {
    process.stderr.write(`⚠ ${cau}\n`);
  }
  return MA.OK;
}

const goiTrucTiep = process.argv[1] === fileURLToPath(import.meta.url);
if (goiTrucTiep) {
  try {
    process.exitCode = await main(process.argv.slice(2), process.env);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = e instanceof LoiCoMa ? e.ma : MA.LOI;
  }
}
