import { expect, test } from "@playwright/test";

import { duongDanQuayLai } from "../../../admin/lib/quay-lai";

/** Bài đo chống **open redirect** cho `?tiep=` của trang đăng nhập quản trị
 * (`apps/admin/lib/quay-lai.ts`).
 *
 * **Vì sao bài đo của `apps/admin` lại nằm trong `apps/web/e2e/don-vi`.** Bộ `don-vi` là
 * bộ chạy-được-song-song duy nhất của repo (không DB, không cổng — xem
 * `playwright.don-vi.config.ts`), và `apps/admin` không có bộ chạy nào của riêng nó. Đây
 * là lối đã có sẵn: `hang-loat-quan-tri.spec.ts` và `check-fx.spec.ts` nhập thẳng module
 * theo đúng cách này, làm được vì `lib/quay-lai.ts` cố ý không kéo theo React hay `fetch`.
 *
 * ⚠ **Đây là phần DUY NHẤT của lượt 2026-08-26 kiểm tự động được ở phía frontend.** Hai
 * việc kia của lượt ấy — bỏ một lần click, và nút con mắt — nằm trong component React mà
 * `apps/admin` không có bài đo trình duyệt nào, nên chúng chỉ kiểm được bằng tay. Đừng để
 * số bài xanh ở file này đọc như thể cả ba việc đã có người đo.
 */

test("đường dẫn nội bộ đi qua nguyên vẹn", () => {
  expect(duongDanQuayLai("/machs")).toBe("/machs");
  expect(duongDanQuayLai("/")).toBe("/");
  expect(duongDanQuayLai("/u/nguoi-dung")).toBe("/u/nguoi-dung");
});

test("query string được giữ — nếu mất thì `?tiep=` chỉ quay về nửa chỗ", () => {
  expect(duongDanQuayLai("/m/12?x=1")).toBe("/m/12?x=1");
  expect(duongDanQuayLai("/machs?trang=3&sub=phim")).toBe("/machs?trang=3&sub=phim");
  expect(duongDanQuayLai("/bao-cao#muc-2")).toBe("/bao-cao#muc-2");
});

test("rỗng / null ⇒ về `/`", () => {
  expect(duongDanQuayLai(null)).toBe("/");
  expect(duongDanQuayLai("")).toBe("/");
});

test("`//host` — protocol-relative, CA NGUY HIỂM NHẤT", () => {
  // Bắt đầu bằng `/` nên một phép kiểm `startsWith("/")` đơn độc cho nó đi qua, mà trình
  // duyệt đọc nó là *host khác*. Bản vá ngây thơ nhất trông như đã chặn ca này.
  expect(duongDanQuayLai("//kẻ-gian.example")).toBe("/");
  expect(duongDanQuayLai("//kẻ-gian.example/dang-nhap")).toBe("/");
  expect(duongDanQuayLai("///kẻ-gian.example")).toBe("/");
});

test("`/\\host` — backslash, trình duyệt hiểu y như `//`", () => {
  expect(duongDanQuayLai("/\\kẻ-gian.example")).toBe("/");
  expect(duongDanQuayLai("/\\/kẻ-gian.example")).toBe("/");
});

test("có scheme ⇒ về `/`", () => {
  expect(duongDanQuayLai("https://kẻ-gian.example")).toBe("/");
  expect(duongDanQuayLai("http://kẻ-gian.example/machs")).toBe("/");
  expect(duongDanQuayLai("javascript:alert(1)")).toBe("/");
  // `:` trước dấu `/` đầu tiên — một scheme viết thiếu một gạch, vẫn ra ngoài site.
  expect(duongDanQuayLai("http:/x")).toBe("/");
  expect(duongDanQuayLai("data:text/html,<script>1</script>")).toBe("/");
});

test("đường dẫn tương đối không có `/` mở đầu ⇒ về `/`", () => {
  // `machs` giải nghĩa theo trang HIỆN TẠI, nên nó vô hại; nhưng `kẻ-gian.example` cũng
  // không có `/` mở đầu, và phân biệt hai thứ đó đòi một phép phân giải URL đầy đủ.
  // Từ chối cả hai rẻ hơn và không ai mất gì: cổng quản trị luôn dựng `tiep` tuyệt đối.
  expect(duongDanQuayLai("machs")).toBe("/");
  expect(duongDanQuayLai("kẻ-gian.example")).toBe("/");
});

test("tab / xuống dòng bị XOÁ trước khi kiểm, không phải sau", () => {
  // Trình duyệt xoá `\t\n\r` khỏi URL trước khi phân giải (WHATWG URL parser), nên
  // `"/\t/kẻ-gian"` tới nơi là `"//kẻ-gian"` — protocol-relative. Một bản vá kiểm chuỗi
  // THÔ thấy `"/"` rồi `"\t"` và kết luận "đường dẫn nội bộ, một gạch, hợp lệ".
  expect(duongDanQuayLai("/\t/kẻ-gian.example")).toBe("/");
  expect(duongDanQuayLai("/\n/kẻ-gian.example")).toBe("/");
  expect(duongDanQuayLai("/\r/kẻ-gian.example")).toBe("/");
  expect(duongDanQuayLai("/\t\\kẻ-gian.example")).toBe("/");
  // Và chuỗi trả về là bản ĐÃ xoá — trả `tiep` thô là trả một chuỗi khác với chuỗi vừa
  // được kiểm, tức phép kiểm nói về một thứ, giá trị dùng thật là một thứ khác.
  expect(duongDanQuayLai("/ma\tchs")).toBe("/machs");
});

/* ===========================================================================
 * Từ chối chính `/dang-nhap` — lượt phản biện 2026-08-26
 * ========================================================================= */

test("`?tiep=/dang-nhap` không đưa người dùng trở lại form đăng nhập", () => {
  // Soạn tay được, và `CongQuanTri` cũng tự sinh ra được trong một cuộc đua hẹp.
  // Hậu quả: gõ đúng mật khẩu xong thấy lại form trống ⇒ tưởng mình gõ sai.
  expect(duongDanQuayLai("/dang-nhap")).toBe("/");
  expect(duongDanQuayLai("/dang-nhap?tiep=%2Fmachs")).toBe("/");
  // Biến thể qua tab: trình duyệt xoá tab trước khi đi, nên phép kiểm phải đứng SAU
  // bước xoá — nếu ai đó đảo thứ tự, dòng này đỏ.
  expect(duongDanQuayLai("/dang-\tnhap")).toBe("/");
});

test("nhưng KHÔNG chặn nhầm đường dẫn chỉ TRÙNG TIỀN TỐ", () => {
  // Chống một bản cài `startsWith("/dang-nhap")` trần: nó sẽ nuốt luôn những trang hợp lệ
  // bắt đầu bằng cùng chuỗi ký tự, và cái đó không đỏ ở đâu cả.
  expect(duongDanQuayLai("/dang-nhap-lai")).toBe("/dang-nhap-lai");
  expect(duongDanQuayLai("/dang-nhaps")).toBe("/dang-nhaps");
});
