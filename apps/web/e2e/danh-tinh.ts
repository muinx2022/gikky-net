import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Dựng một tài khoản THẬT trong trình duyệt: đăng ký → đọc hộp thư → xác thực → đăng nhập.
 *
 * Tách khỏi `tai-khoan-va-ghi.spec.ts` khi mảng B (form ghi) cần đúng luồng ấy: hai bản
 * sao của một luồng 20 dòng đi qua hộp thư trên đĩa là hai bản sẽ lệch nhau ở chỗ chờ file
 * — và bản lệch sẽ là bản chớp tắt ngẫu nhiên trong CI, không phải bản đỏ hẳn.
 *
 * **Xác thực email đi qua HỘP THƯ THẬT** (`api/.mail/`, `EMAIL_BACKEND = filebased`).
 * Không `EmailAddress.objects.update(verified=True)` cho nhanh: chốt của plan mảng A là
 * *"đọc từ file vẫn là luồng thật, khác hẳn việc tắt xác thực đi cho dễ"*.
 */

const THU_MUC_MAIL = resolve(__dirname, "..", "..", "..", "api", ".mail");
export const MAT_KHAU = "mot-mat-khau-du-dai-2026";

/** Một danh tính mới cho mỗi lần chạy — bộ e2e chạy trên DB có dữ liệu cũ (`seed_dev`
 * không `--reset`), nên username cố định sẽ đụng lần chạy trước. */
export function danhTinhMoi(tien_to: string) {
  const n = `${tien_to}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  return { username: n, email: `${n}@gikky.test` };
}

/** Nội dung mail MỚI NHẤT trong `api/.mail/`, chờ tới khi có file mới xuất hiện.
 *
 * Chờ theo **thời điểm sửa** chứ không theo số file: bộ e2e chạy nhiều lần trên cùng thư
 * mục, nên "có ít nhất một file" là điều kiện đúng ngay cả khi mail của lượt này chưa
 * được ghi. `EmailBackend` dạng file ghi xong mới đóng, nên đọc file mới nhất là an toàn.
 */
export async function mailMoiNhat(sau: number): Promise<string> {
  for (let i = 0; i < 60; i += 1) {
    // Thư mục chỉ ra đời khi lá mail đầu tiên được gửi (`filebased.EmailBackend` tự tạo),
    // nên "chưa có" là trạng thái hợp lệ ở vòng lặp đầu — không phải lỗi.
    if (!existsSync(THU_MUC_MAIL)) {
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    const files = readdirSync(THU_MUC_MAIL)
      .map((f) => resolve(THU_MUC_MAIL, f))
      .filter((f) => statSync(f).isFile())
      .map((f) => ({ f, khi: statSync(f).mtimeMs }))
      .filter((x) => x.khi > sau)
      .sort((a, b) => b.khi - a.khi);
    if (files.length > 0) return readFileSync(files[0].f, "utf8");
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Không thấy mail mới trong ${THU_MUC_MAIL} sau 15 giây`);
}

/** Đường dẫn xác thực trong thân mail — trỏ về **frontend Next**, không về Django. */
export function duongDanXacThuc(than: string): string {
  const m = /https?:\/\/[^\s]*\/xac-thuc-email\/[^\s.,)]+/.exec(than);
  if (m === null) throw new Error(`không thấy link xác thực trong mail:\n${than}`);
  return new URL(m[0]).pathname;
}

/** Đăng ký → đọc mail → xác thực → đăng nhập. Trả về danh tính vừa dựng. */
export async function dungTaiKhoan(page: Page, tien_to: string) {
  const ai = danhTinhMoi(tien_to);
  const truoc = Date.now();

  await page.goto("/dang-ky");
  await page.getByTestId("o-email").fill(ai.email);
  await page.getByTestId("o-username").fill(ai.username);
  await page.getByTestId("o-password").fill(MAT_KHAU);
  await page.getByTestId("form-gui").click();

  // Xác thực email BẮT BUỘC ⇒ kết cục đúng của một lần đăng ký thành công là "kiểm tra
  // hộp thư", không phải vào thẳng trong.
  await expect(page.getByTestId("form-xong")).toContainText("email xác nhận");

  await page.goto(duongDanXacThuc(await mailMoiNhat(truoc)));
  await expect(page.getByTestId("xac-thuc-xong")).toBeVisible();

  await page.goto("/dang-nhap");
  await page.getByTestId("o-email").fill(ai.email);
  await page.getByTestId("o-password").fill(MAT_KHAU);
  await page.getByTestId("form-gui").click();
  await expect(page.getByTestId("nut-tai-khoan")).toHaveText(`u/${ai.username}`);
  return ai;
}
