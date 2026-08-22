import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import robots from "../../app/robots";
import { TUOI_CACHE_MACH } from "../../lib/api";
import { DUONG_DAN_HOP_LE } from "../../lib/lam-moi-cache";
import { COOKIE_PHIEN, TIEN_TO_PHIEN } from "../../middleware";

const WEB = resolve(__dirname, "..", "..");
const GOC = resolve(WEB, "..", "..");

/** Hàng rào cho cơ chế ISR của PLAN 8.4 — nợ `ISR-BIEN-THE-ROUTE`, trả 2026-08-23.
 *
 * Cơ chế ấy gồm **bốn mảnh nằm ở bốn file khác nhau**, và nó chỉ đúng khi cả bốn khớp
 * nhau. Ba trong bốn cặp không có gì bắt chúng khớp ngoài trí nhớ:
 *
 * 1. `export const revalidate` của `app/m/[slugId]/page.tsx` ↔ `TUOI_CACHE_MACH`. Next đòi
 *    literal phân tích tĩnh được nên con số phải viết tay ở đó — một bản sao bắt buộc;
 * 2. tên cookie phiên ở `middleware.ts` ↔ `SESSION_COOKIE_NAME` của Django. Gõ sai thì
 *    middleware thành **no-op im lặng**: mọi người ăn bản cache, và "vừa nối mốc mà không
 *    thấy mốc đâu" là lỗi người ta sẽ đổ cho Django;
 * 3. `middleware.ts` rewrite sang `${TIEN_TO_PHIEN}/…` ↔ **route ấy phải tồn tại**. Thiếu
 *    nó là trang mạch 404 với đúng những người đã đăng nhập, và một bộ e2e chạy ẩn danh
 *    sẽ xanh hết.
 *
 * Mảnh thứ tư — "fetch có thật sự được cache không" — **không đo được ở đây**: nó là hành
 * vi lúc chạy của Next. Nó có bài đo riêng trong `e2e/cache-mach.spec.ts`, chạy thật trên
 * trình duyệt.
 */

const doc = (duong: string) => readFileSync(resolve(GOC, duong), "utf8");

test("`revalidate` của trang mạch bằng ĐÚNG TUOI_CACHE_MACH", () => {
  const trang = doc("apps/web/app/m/[slugId]/page.tsx");
  const m = /^export const revalidate = (\d+);$/m.exec(trang);
  expect(m, "không thấy `export const revalidate = <số>;` ở biến thể khách").not.toBeNull();
  expect(Number(m![1])).toBe(TUOI_CACHE_MACH);
  // PLAN 8.4 điểm 2 nói thẳng "revalidate nền **1 giờ**".
  expect(TUOI_CACHE_MACH).toBe(3600);
});

test("biến thể CÓ COOKIE là dynamic — nếu không thì hai nhánh giống hệt nhau", () => {
  const trang = doc(`apps/web/app${TIEN_TO_PHIEN}/[slugId]/page.tsx`);
  expect(trang).toMatch(/^export const dynamic = "force-dynamic";$/m);
  // …và nó KHÔNG được khai `revalidate`: hai chỉ thị ngược nhau trong một file là chỗ
  // người sửa sau phải đoán cái nào thắng.
  expect(trang).not.toMatch(/^export const revalidate/m);
});

test("route mà middleware rewrite tới CÓ THẬT (thiếu nó ⇒ 404 cho người đăng nhập)", () => {
  // Đọc file: `TIEN_TO_PHIEN` là nguồn của cả hai vế, nên đây là phép kiểm "cái tên ấy
  // trỏ vào một file có thật", không phải phép so hai hằng với nhau.
  expect(() => doc(`apps/web/app${TIEN_TO_PHIEN}/[slugId]/page.tsx`)).not.toThrow();
  expect(TIEN_TO_PHIEN.startsWith("/")).toBe(true);
  // Tiền tố KHÔNG được nằm dưới `/m/`, nếu không nó lọt vào chính `matcher` của middleware
  // và mỗi lượt tải là một vòng rewrite.
  expect(TIEN_TO_PHIEN.startsWith("/m/")).toBe(false);
});

test("tên cookie phiên khớp Django (`SESSION_COOKIE_NAME`)", () => {
  const cai_dat = doc("api/config/settings.py");
  const m = /^SESSION_COOKIE_NAME\s*=\s*["']([^"']+)["']/m.exec(cai_dat);
  // Django không khai ⇒ mặc định `sessionid`. Khai rồi thì phải khớp.
  expect(COOKIE_PHIEN).toBe(m === null ? "sessionid" : m[1]);
});

test("biến thể nội bộ chống trùng nội dung bằng CANONICAL, không bằng `Disallow`", () => {
  // Bài học F4 lần thứ hai: `Disallow` làm bot không tải trang ⇒ nó không đọc được thẻ
  // `canonical` nằm trong chính trang ấy, mà URL bị chặn vẫn lên index dạng URL trần.
  // Nên `robots.txt` không có `Disallow` nào (`e2e/seo-va-trang.spec.ts::C5` ghim), và
  // việc gộp hai URL do canonical làm — nó phải có mặt ở thân bài DÙNG CHUNG.
  // Soi **giá trị trả về**, không grep file: docstring của `robots.ts` nhắc chữ
  // `Disallow` bảy lần để kể lại vì sao KHÔNG dùng nó, và một hàng rào ăn mất tài liệu
  // của chính nó là thứ `quet.ts` đã bỏ chú thích để tránh.
  expect(robots().rules).toEqual([{ userAgent: "*", allow: "/" }]);
  expect(doc("apps/web/components/trang-mach.tsx")).toMatch(
    /alternates:\s*\{\s*canonical:\s*urlTuyetDoi\(duong_dan\)/,
  );
});

test("allowlist của cửa làm mới nhận MỌI slug Django sinh ra được", () => {
  // Bắt tại trận 2026-08-23: bản `[a-z0-9-]+` từ chối slug có dấu GẠCH DƯỚI, mà
  // `django.utils.text.slugify` giữ nguyên `_`. Hậu quả im lặng — Django ghi WARNING,
  // cửa trả 400, trang không bao giờ được làm mới.
  for (const duong of [
    "/m/nhat-ky-lenh-hpg-12",
    "/m/mach-cua-p3chu_mt4u3rmu893-1370", // `_` từ username trong tiêu đề
    "/m/-1234", // slug rỗng: tiêu đề toàn emoji (`slug_tu_title`)
    "/m/a-1",
  ]) {
    expect(DUONG_DAN_HOP_LE.test(duong), `phải NHẬN ${duong}`).toBe(true);
  }
});

test("…và vẫn từ chối mọi thứ khác (allowlist không thành cửa mở)", () => {
  for (const duong of [
    "/", // cả trang chủ
    "/luat",
    "/m/", // thiếu id
    "/m/abc-1/", // dấu / thừa
    "/m/abc-1?x=1", // query
    "/m/../luat", // đi ngược
    "/m/ABC-1", // chữ hoa: slugify không sinh ra được
    "/m/abc-1x", // id không phải số
    "/s/chung-khoan",
  ]) {
    expect(DUONG_DAN_HOP_LE.test(duong), `phải TỪ CHỐI ${duong}`).toBe(false);
  }
});

test("hai biến thể route dùng CHUNG một thân bài (không có bản thứ hai để trôi)", () => {
  for (const duong of [
    "apps/web/app/m/[slugId]/page.tsx",
    `apps/web/app${TIEN_TO_PHIEN}/[slugId]/page.tsx`,
  ]) {
    expect(doc(duong), `${duong} không dùng components/trang-mach`).toMatch(
      /from "@\/components\/trang-mach"/,
    );
  }
});
