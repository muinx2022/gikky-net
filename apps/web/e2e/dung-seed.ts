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

/** Ẩn mạch **và bình luận** mà **tài khoản dùng một lần của bộ e2e** để lại ở những lần
 * chạy TRƯỚC. Logic nằm trong `api/core/management/commands/don_rac_e2e.py` — đọc
 * docstring ở đó; phần dưới đây chỉ giữ những gì thuộc về phía Playwright.
 *
 * ### Vì sao phải có, và nó đã hỏng thật
 *
 * `pnpm e2e` GHI vào DB và `seed_dev` không `--reset`, nên rác của mỗi lần chạy ở lại.
 * Feed "Mới" sắp theo `created_at` và **trang 1 chỉ có 20 thẻ**, nên rác tích lại là một
 * cái đồng hồ đếm ngược: sau chừng chục lần chạy, mạch seed HPG bị đẩy khỏi trang 1 và
 * bảy bài đo *không liên quan gì tới việc ghi* đồng loạt đỏ (`vo-reddit.spec.ts` A7,
 * `seo-va-trang.spec.ts` feed…). Đúng chuyện đó xảy ra ngày 2026-08-23 khi mảng B thêm bộ
 * `form-ghi.spec.ts`: mỗi lần chạy nay đẻ 6 mạch thay vì 1, và cái đồng hồ chạy nhanh gấp
 * sáu. Bản thân bộ đo không sai — **nó chỉ không idempotent**, và đây là chỗ vá điều đó.
 *
 * Loài rác thứ HAI (P-20260830-13, 2026-08-31): **bình luận** mà `tai-khoan-va-ghi.spec.ts`
 * để lại trong mạch SEED. Nó không đẩy gì khỏi trang 1 nên không đỏ ở đâu — nó chỉ đổi
 * ngầm đối tượng đo của mọi bài chọn "mốc đông nhất / thread đầu tiên", và một cú đỏ vì
 * lý do đó đã bị ghi nhầm thành lỗi sản phẩm. Vế này là phần mà lệnh mới thêm vào.
 *
 * ### Vì sao ẩn chứ không xoá
 *
 * `hidden_at` là cơ chế soft-hide có sẵn của sản phẩm (PLAN 5.10): nội dung ẩn biến khỏi
 * mọi cửa công khai — feed, sitemap, RSS, trang mạch trả 404 — nên nó đủ để trả feed về
 * sạch. Xoá thật thì phải lo `Vote` mồ côi (`Vote` cố ý không có FK — PLAN 5.3) và cascade
 * sang `Trich`; một câu lệnh dọn dẹp mà phải hiểu ba luật domain là câu lệnh sẽ dọn sai.
 *
 * ### Vì sao ranh giới này KHÔNG thể chạm vào dữ liệu thật
 *
 * Tài khoản dùng một lần của bộ e2e luôn mang email `<username>@gikky.test`
 * (`e2e/danh-tinh.ts`), còn **mọi** tài khoản seed mang `@vi-du.gikky.net`
 * (`seed_dev.py`, `seed_e2e.py`). Hai miền tách hẳn nhau, nên không có ca biên nào để cân
 * nhắc — và nếu ai đó đổi miền email của bộ e2e, hậu quả là dọn HỤT (rác ở lại, bài đo đỏ
 * dần như cũ), không phải dọn NHẦM.
 *
 * ### Vì sao là một COMMAND chứ không phải `shell -c` inline như trước
 *
 * Bản trước dán 15 dòng Python vào một mảng chuỗi TS. Không pytest nào chạm được vào đó,
 * nên không thử phá được — và vế bình luận mới thì phải đi qua `dat_an_binh_luan`, tức
 * kéo theo `cap_nhat_dem_mach`: ghi sai một chỗ là `comment_count` của mạch seed lệch
 * **vĩnh viễn** mà không có gì đỏ. Đúng loại logic không được sống trong một chuỗi.
 * Bộ đo của nó: `api/tests/test_don_rac_e2e.py`.
 */
function donRacLanTruoc(goc: string): void {
  execFileSync(
    process.execPath,
    [resolve(goc, "scripts/py.mjs"), "don_rac_e2e"],
    { cwd: goc, stdio: "inherit" },
  );
}

export default globalSetup;
