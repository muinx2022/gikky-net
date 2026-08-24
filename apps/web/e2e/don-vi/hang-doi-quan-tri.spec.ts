import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

const GOC = resolve(__dirname, "..", "..", "..", "..");
const ADMIN = resolve(GOC, "apps/admin");

/** Hàng đợi báo cáo **dời từ `app/page.tsx` sang `app/bao-cao/page.tsx` ở Phase 8** —
 * `/` nay là bảng điều khiển. Chỉ đổi chỗ đọc; mọi khẳng định bên dưới giữ nguyên. */
const TRANG_HANG_DOI = "app/bao-cao/page.tsx";

function doc(duong_dan: string): string {
  return boChuThich(readFileSync(resolve(ADMIN, duong_dan), "utf8"));
}

/** **L04** — hàng đợi kiểm duyệt phải có nút THI HÀNH thật, và bốn nút `Đóng:` phải thôi
 * khẳng định một hành động không xảy ra.
 *
 * ## Lỗi gốc, nói lại cho đủ
 *
 * Backend nói rõ `hanh_dong` **chỉ ghi lại** mod đã làm gì, nó không thi hành
 * (`api/quan_tri_bao_cao.py::dong_bao_cao_endpoint`). Trên hàng thì **không có nút khoá
 * hay ban thật** — chỉ Ẩn/Gỡ ẩn. Kết quả: bốn cái nút `Đóng: Đã ban` là thứ duy nhất
 * trông giống một hành động, và mod bấm nó trên một báo cáo lừa đảo nhận 200, hàng chuyển
 * sang "Đã xử lý", audit log đầy đủ, **kẻ kia không bị ban một giây nào**.
 *
 * ## Bài này đo cấu trúc; "ban có thi hành thật không" đo ở Django
 *
 * Ở đây là phân tích tĩnh trên nguồn `apps/admin` — nó trả lời *"hàng có gọi đúng endpoint
 * không, và nhãn có còn nói dối không"*. Câu *"gọi endpoint ấy thì kẻ kia có bị chặn thật
 * không"* thuộc về `api/tests/test_api_quan_tri_nguoi_dung.py`, nơi có DB thật để hỏi.
 *
 * Không đo bằng trình duyệt: bộ e2e chỉ dựng `apps/web` (3000) + Django (8000), khu quản
 * trị ở 3001 không nằm trong `webServer`. Dựng thêm một server thứ ba cho một màn hình là
 * một quyết định riêng, không phải một dòng thêm vào lượt này — ghi ra để không ai tưởng
 * đây là chỗ đã đo tận tay.
 */

test("L04 — hàng đợi gọi endpoint KHOÁ MẠCH và BAN thật", () => {
  const hang_doi = doc(TRANG_HANG_DOI);
  const form_ban = doc("components/form-ban.tsx");
  expect(hang_doi, "hàng phải có nút khoá mạch thật").toContain("quanTriDatKhoaMach");
  expect(hang_doi, "hàng phải có đường gỡ ban").toContain("quanTriGoBanNguoiDung");
  // **Và phải có NÚT, không chỉ có tên hàm.** Lượt thử phá bắt được đúng chỗ này: gỡ cái
  // nút đi mà để lại lời gọi trong nguồn thì hai dòng trên vẫn xanh — chúng chỉ chứng minh
  // "file có nhắc tới endpoint", không chứng minh mod bấm được gì.
  for (const nut of ["nut-khoa-mach", "nut-ban-tac-gia", "nut-go-ban"]) {
    expect(hang_doi, `hàng phải có nút ${nut}`).toContain(`data-testid="${nut}"`);
  }
  // Ban đi qua `FormBan` (một bản dùng chung với trang hồ sơ) chứ không gọi thẳng — nên
  // phép kiểm phải đi theo đúng đường ấy, không đòi tên hàm xuất hiện ở `page.tsx`.
  expect(hang_doi, "hàng phải mở được form ban").toContain("FormBan");
  expect(form_ban, "form ban phải gọi endpoint ban").toContain("quanTriBanNguoiDung");
});

test("L04 — nhãn nút đóng báo cáo KHÔNG còn khẳng định một hành động", () => {
  const chu = doc("components/dung-mo-ta.ts");
  const hang_doi = doc(TRANG_HANG_DOI);
  // Nhãn nút lấy từ `CHU_GHI_NHAN` ("Ghi: đã ban"), không từ `CHU_HANH_DONG` ("đã ban").
  expect(chu).toContain("CHU_GHI_NHAN");
  expect(hang_doi, "nút đóng phải dùng CHU_GHI_NHAN").toContain("CHU_GHI_NHAN[hd]");
  // Và chuỗi cũ phải biến mất khỏi nguồn — nó là câu nói dối, không phải một cách viết.
  expect(hang_doi, 'chuỗi "Đóng: " cũ phải biến mất').not.toContain("Đóng: {");
  // Mỗi nhãn ghi nhận phải mang động từ "Ghi", không được quay về thì quá khứ trống chủ ngữ.
  for (const m of chu.matchAll(/^\s{2}(an|khoa|ban|bo_qua): "([^"]+)",$/gm)) {
    if (!m[2].startsWith("Ghi")) continue;
    expect(m[2]).toMatch(/^Ghi: /);
  }
});

test("L04 — nút bật/tắt đọc TRẠNG THÁI THẬT, không đoán", () => {
  // Một nút bật/tắt không biết mình đang ở chiều nào thì nửa số lần bấm trả `da_doi=false`
  // và màn hình không đổi — tức một nút chết theo lịch. Hai trường này thêm vào
  // `NoiDungBiBaoCaoOut` cùng lượt.
  const hang_doi = doc(TRANG_HANG_DOI);
  expect(hang_doi).toContain("dich.mach_da_khoa");
  expect(hang_doi).toContain("tac_gia_bi_ban");
  expect(hang_doi, "nhãn nút khoá phải đổi theo trạng thái").toContain("Mở khoá mạch");
});

test("L04 — FORM BAN chỉ có MỘT bản, dùng chung hai màn hình", () => {
  // Chép form sang hàng đợi là hai bản của cùng một luật, và bản chép sẽ quên `required`
  // trên lý do hoặc quên rằng hai kiểu hạn loại trừ nhau. Khuôn mẫu ấy đã đếm được 8 lần
  // trong `LOI-VA-NO.md` mục D.
  const ho_so = doc("app/u/[username]/page.tsx");
  expect(ho_so, "trang hồ sơ phải dùng FormBan chung").toContain("FormBan");
  expect(ho_so, "và KHÔNG giữ bản riêng").not.toContain("quanTriBanNguoiDung");
});

test("L33 — hạn ban tính ở SERVER: form gửi `so_ngay`, không gửi `den_khi`", () => {
  const form_ban = doc("components/form-ban.tsx");
  expect(form_ban).toContain("so_ngay");
  // `new Date(Date.now() + N*86400e3)` ở trình duyệt là hạn ban lệch theo đồng hồ máy mod,
  // và không có gì kêu vì server nhận một mốc thời gian hợp lệ.
  expect(form_ban, "không được tự cộng ngày ở client").not.toMatch(/Date\.now\(\)/);
  expect(form_ban, "không gửi `den_khi` từ UI").not.toMatch(/den_khi\s*:/);
});

test("L22 — có ô tra cứu mạch/user, và nó nằm trên thanh điều hướng", () => {
  // Phase 8 tách khung ra khỏi cổng: thanh điều hướng nay là `khung/thanh-tren.tsx`,
  // `cong-quan-tri.tsx` chỉ còn phần cổng (401/403/sai-host). Khẳng định không đổi —
  // ô tra cứu vẫn phải nằm trên thanh điều hướng, chỉ là thanh ấy đổi file.
  const thanh = doc("components/khung/thanh-tren.tsx");
  const o = doc("components/o-tra-cuu.tsx");
  expect(thanh, "thanh điều hướng phải gắn ô tra cứu").toContain("OTraCuu");
  expect(o).toContain("/m/");
  expect(o).toContain("/u/");
});

test("L30 — nút Xoá sub có đủ BA đường (disabled · title · aria-label)", () => {
  const subs = doc("app/subs/page.tsx");
  expect(subs).toContain("aria-label");
  // Không rỗng: nhãn phải nêu ĐƯỢC lý do, không chỉ nêu tên hành động.
  expect(subs).toMatch(/không xoá được: sub còn/);
});

test("bài đo trên có đọc trúng file thật (chống quét vào chỗ trống)", () => {
  for (const f of [
    TRANG_HANG_DOI,
    "components/form-ban.tsx",
    "components/o-tra-cuu.tsx",
    "components/dung-mo-ta.ts",
    "app/subs/page.tsx",
    "app/u/[username]/page.tsx",
    "components/cong-quan-tri.tsx",
    "components/khung/thanh-tren.tsx",
  ]) {
    expect(doc(f).length, `${f} rỗng?`).toBeGreaterThan(200);
  }
});
