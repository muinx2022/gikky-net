import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** `globalSetup` của Playwright: dựng dữ liệu THẬT trước khi chạy bộ e2e, và **dọn rác của
 * lần chạy trước**.
 *
 * Hai lệnh seed, hai vai (xem docstring của từng command):
 *
 * - `seed_dev` — dữ liệu nghiệm thu Phase 1a. Ba vai của mặt CẶN nằm ở ba hàng khác
 *   nhau, mốc 6 có 0 bình luận kèm câu mồi… mọi con số ở đó là điều kiện để tiêu chí
 *   V1–V8, V15 *đo được gì đó*.
 * - `seed_e2e` — user 21 mạch, chỉ để V16 (hồ sơ bị cắt) không pass rỗng.
 *
 * Cả hai **idempotent**: chạy lại không nhân đôi. Cố ý KHÔNG dùng `--reset` ở đây —
 * `--reset` xoá sạch rồi dựng lại, và một lần lỡ tay chạy bộ e2e trên DB có dữ liệu thật
 * sẽ là mất dữ liệu, không phải phiền toái.
 *
 * Đường dẫn lấy từ `__dirname` chứ không từ `import.meta.url`: `apps/web/package.json`
 * không khai `type: module`, nên Playwright biên dịch file này sang CJS và `import.meta`
 * là lỗi cú pháp ở đó.
 */
async function globalSetup() {
  const goc = resolve(__dirname, "..", "..", "..");
  for (const lenh of ["seed_dev", "seed_e2e"]) {
    execFileSync(process.execPath, [resolve(goc, "scripts/py.mjs"), lenh], {
      cwd: goc,
      stdio: "inherit",
    });
  }
  donRacLanTruoc(goc);
}

/** Ẩn mọi mạch do **tài khoản dùng một lần của bộ e2e** đăng ở những lần chạy TRƯỚC.
 *
 * ### Vì sao phải có, và nó đã hỏng thật
 *
 * `pnpm e2e` GHI vào `gikky_dev` và `seed_dev` không `--reset`, nên rác của mỗi lần chạy ở
 * lại. Feed "Mới" sắp theo `created_at` và **trang 1 chỉ có 20 thẻ**, nên rác tích lại là
 * một cái đồng hồ đếm ngược: sau chừng chục lần chạy, mạch seed HPG bị đẩy khỏi trang 1 và
 * bảy bài đo *không liên quan gì tới việc ghi* đồng loạt đỏ (`vo-reddit.spec.ts` A7,
 * `seo-va-trang.spec.ts` feed…). Đúng chuyện đó xảy ra ngày 2026-08-23 khi mảng B thêm bộ
 * `form-ghi.spec.ts`: mỗi lần chạy nay đẻ 6 mạch thay vì 1, và cái đồng hồ chạy nhanh gấp
 * sáu. Bản thân bộ đo không sai — **nó chỉ không idempotent**, và đây là chỗ vá điều đó.
 *
 * ### Vì sao ẩn chứ không xoá
 *
 * `hidden_at` là cơ chế soft-hide có sẵn của sản phẩm (PLAN 5.10): mạch ẩn biến khỏi mọi
 * cửa công khai — feed, sitemap, RSS, trang mạch trả 404 — nên nó đủ để trả feed về sạch.
 * Xoá thật thì phải lo `Vote` mồ côi (`Vote` cố ý không có FK — PLAN 5.3) và cascade sang
 * `Trich`; một câu lệnh dọn dẹp mà phải hiểu ba luật domain là câu lệnh sẽ dọn sai.
 *
 * ### Vì sao ranh giới này KHÔNG thể chạm vào dữ liệu thật
 *
 * Tài khoản dùng một lần của bộ e2e luôn mang email `<username>@gikky.test`
 * (`e2e/danh-tinh.ts`), còn **mọi** tài khoản seed mang `@vi-du.gikky.net`
 * (`seed_dev.py`, `seed_e2e.py`). Hai miền tách hẳn nhau, nên không có ca biên nào để cân
 * nhắc — và nếu ai đó đổi miền email của bộ e2e, hậu quả là dọn HỤT (rác ở lại, bài đo đỏ
 * dần như cũ), không phải dọn NHẦM.
 *
 * ### Đi qua `core/ghi.py::dat_an_mach`, KHÔNG ghi thẳng `hidden_at` — L32
 *
 * Bản trước chạy `rac.update(hidden_at=timezone.now())`, tức đi vòng qua đường ghi. Luật
 * *"không một dòng nào ghi thẳng `hidden_at`"* được viết ở `core/ghi.py:70` và
 * `api/quan_tri_kiem_duyet.py:3`, và bản `update()` ấy là dòng duy nhất trong repo phá nó.
 *
 * Vô hại về SỐ hôm nay (đã đối soát: ẩn mạch cố ý không đụng cột đếm nào). Không vô hại về
 * cấu trúc: `dat_an_mach` còn gọi `dong_bo_kho_anh` cho mọi mốc — tức chuyển ảnh sang kho
 * không server nào phục vụ (A9). Bản `update()` bỏ qua bước đó, nên **ảnh của mạch rác vẫn
 * phục vụ được qua `/media/`** dù mạch đã biến khỏi mọi cửa đọc. Đó không phải giả thuyết
 * về tương lai; nó đã đúng từ lúc Phase 5 gộp vào.
 *
 * `boi` là tài khoản staff của seed — `AuditLog` đòi một actor, và một dòng audit nói
 * "seed e2e dọn rác" là thứ đọc được khi ai đó thấy một mạch bị ẩn mà không nhớ vì sao.
 */
function donRacLanTruoc(goc: string): void {
  const lenh = [
    "from core.ghi import dat_an_mach",
    "from core.models.dien_dan import Mach",
    "from core.models.nguoi_dung import User",
    "boi = User.objects.filter(is_staff=True).order_by('pk').first()",
    "if boi is None:",
    "    raise SystemExit('Khong co tai khoan staff nao — chay `seed_dev` truoc.')",
    "rac = list(Mach.objects.filter(",
    "    author__email__endswith='@gikky.test', hidden_at__isnull=True",
    "))",
    "n = 0",
    "for m in rac:",
    "    if dat_an_mach(mach=m, boi=boi, an=True, ly_do='dọn rác e2e'):",
    "        n += 1",
    "print(f'Đã ẩn {n} mạch rác của các lần chạy e2e trước.')",
  ].join("\n");
  execFileSync(
    process.execPath,
    [resolve(goc, "scripts/py.mjs"), "shell", "-c", lenh],
    { cwd: goc, stdio: "inherit" },
  );
}

export default globalSetup;
