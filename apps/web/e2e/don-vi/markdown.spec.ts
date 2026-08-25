import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { docDong, docMarkdown, urlAnToan } from "../../lib/markdown";
import { quetNguon } from "./quet";

/** Markdown của `body`: **allowlist, không blocklist** — chốt của plan mảng A, PLAN 5.2.
 *
 * Bài đo chia hai tầng, và tầng thứ hai mới là tầng thật sự bảo vệ:
 *
 * 1. **Cây node có đúng hình dạng không** — `<script>` phải ở lại trong một node `chu`,
 *    `javascript:` không được thành một node `link`;
 * 2. **Không có đường nào sinh HTML thô** — `ThanVan` không được dùng
 *    `dangerouslySetInnerHTML`, và không file nào ở `apps/web` được dùng nó. Tầng 1 kiểm
 *    hôm nay; tầng 2 giữ cho ngày mai ai đó "tối ưu" bằng một thư viện markdown và một
 *    bộ sanitize không thể lặng lẽ đổi cả mô hình an toàn.
 *
 * Vì sao mô hình là "cây node" chứ không phải "HTML rồi sanitize": xem docstring của
 * `lib/markdown.ts`. Tóm gọn — một bộ lọc chỉ an toàn bằng đúng độ đầy đủ của nó, và
 * blocklist muôn đời chậm hơn một bước so với cú pháp mới của thư viện.
 */

const WEB = resolve(__dirname, "..", "..");

/** Mọi chuỗi văn bản trong một cây node — thứ người đọc sẽ NHÌN THẤY. */
function chuThay(nodes: ReturnType<typeof docDong>): string {
  return nodes
    .map((n) => {
      switch (n.loai) {
        case "chu":
          return n.chu;
        case "ma":
          return n.chu;
        default:
          return chuThay(n.con);
      }
    })
    .join("");
}

function moiLoai(khoi: ReturnType<typeof docMarkdown>): string[] {
  const ra: string[] = [];
  const di = (nodes: ReturnType<typeof docDong>) => {
    for (const n of nodes) {
      ra.push(n.loai);
      if (n.loai === "dam" || n.loai === "nghieng" || n.loai === "link") di(n.con);
    }
  };
  for (const k of khoi) {
    ra.push(k.loai);
    if (k.loai === "danh_sach") k.muc.forEach(di);
    else di(k.con);
  }
  return ra;
}

// --- M7: ba mũi tấn công của bảng nghiệm thu --------------------------------

test("M7 — `<script>` ở lại là VĂN BẢN, không sinh node nào khác", () => {
  const khoi = docMarkdown('<script>alert("xin chao")</script>');
  // Không có node nào ngoài `doan` + `chu`: nghĩa là không có thẻ nào được dựng.
  expect(moiLoai(khoi)).toEqual(["doan", "chu"]);
  // …và nguyên văn còn đủ, không bị nuốt mất: người đọc thấy đúng những ký tự đó.
  expect(chuThay((khoi[0] as { con: ReturnType<typeof docDong> }).con)).toContain(
    "<script>",
  );
});

test("M7 — `onerror=` không có chỗ tồn tại: cây không có node nào mang thuộc tính tự do", () => {
  const khoi = docMarkdown('<img src=x onerror="alert(1)">');
  expect(moiLoai(khoi)).toEqual(["doan", "chu"]);
  // Ghim bất biến của cả mô hình: chỉ có SÁU loại node, và không loại nào nhận thuộc tính
  // tuỳ ý. `link` có đúng một trường ngoài `con`, và đó là `url` đã qua allowlist.
  const loai_hop_le = ["chu", "dam", "nghieng", "ma", "link"];
  const khoi_hop_le = ["doan", "trich", "danh_sach"];
  for (const l of moiLoai(docMarkdown("**a** *b* `c` [d](https://e.f)\n\n> g\n\n- h"))) {
    expect([...loai_hop_le, ...khoi_hop_le]).toContain(l);
  }
});

test("M7 — `javascript:` KHÔNG thành link, và rơi về nguyên văn chứ không biến mất", () => {
  const khoi = docMarkdown("[bấm đi](javascript:alert(1))");
  expect(moiLoai(khoi)).not.toContain("link");
  expect(chuThay((khoi[0] as { con: ReturnType<typeof docDong> }).con)).toBe(
    "[bấm đi](javascript:alert(1))",
  );
});

test("M7 — biến thể lách của `javascript:` cũng trượt (dùng bộ phân tích URL, không so chuỗi)", () => {
  // Cả ba đều **không** bắt đầu bằng chuỗi "javascript" theo phép so ngây thơ, mà trình
  // duyệt vẫn chạy chúng. Đây là lý do `urlAnToan` gọi `new URL(...)`.
  for (const xau of [
    " javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
  ]) {
    expect(urlAnToan(xau), xau).toBe(false);
  }
});

test("allowlist không cắt quá tay: http · https · mailto · đường dẫn nội bộ đều qua", () => {
  // Không có bài này thì `urlAnToan` trả `false` vô điều kiện cũng xanh ở trên, và mọi
  // link trong mọi bài viết chết lặng.
  for (const tot of [
    "https://gikky.net/m/abc-1",
    "http://example.com",
    "mailto:ai@do.vn",
    "/m/nhat-ky-1",
  ]) {
    expect(urlAnToan(tot), tot).toBe(true);
  }
  const khoi = docMarkdown("xem [ở đây](https://gikky.net/m/abc-1) nhé");
  expect(moiLoai(khoi)).toContain("link");
});

test("`//evil.com` (protocol-relative) KHÔNG được coi là đường dẫn nội bộ", () => {
  // `startsWith("/")` một mình sẽ cho nó qua, và nó dẫn ra ngoài site.
  expect(urlAnToan("//evil.com")).toBe(false);
});

// --- cú pháp: mỗi loại node một bài -----------------------------------------

test("đậm · nghiêng · mã · trích · danh sách", () => {
  expect(moiLoai(docMarkdown("**đậm**"))).toEqual(["doan", "dam", "chu"]);
  expect(moiLoai(docMarkdown("*nghiêng*"))).toEqual(["doan", "nghieng", "chu"]);
  expect(moiLoai(docMarkdown("`ma`"))).toEqual(["doan", "ma"]);
  expect(moiLoai(docMarkdown("> câu trích"))).toEqual(["trich", "chu"]);
  expect(moiLoai(docMarkdown("- một\n- hai"))).toEqual([
    "danh_sach",
    "chu",
    "chu",
  ]);
});

test("mã ăn TRƯỚC: `**` trong dấu huyền giữ nguyên chữ", () => {
  // Ưu tiên sai ở đây thì một đoạn mã có `**` bị in nghiêng/đậm — nội dung mã bị sửa
  // trước mắt người đọc, mà đây là site nơi người ta dán lệnh và con số.
  const khoi = docMarkdown("`a ** b`");
  expect(moiLoai(khoi)).toEqual(["doan", "ma"]);
  expect(chuThay((khoi[0] as { con: ReturnType<typeof docDong> }).con)).toBe("a ** b");
});

test("xuống dòng ĐƠN giữ nguyên trong một đoạn, dòng trống mới tách khối", () => {
  expect(docMarkdown("một\nhai").length).toBe(1);
  expect(docMarkdown("một\n\nhai").length).toBe(2);
});

test("body rỗng ra mảng rỗng, không phải một đoạn trống", () => {
  expect(docMarkdown("")).toEqual([]);
  expect(docMarkdown("\n\n  \n")).toEqual([]);
});

// --- tầng 2: không đường nào sinh HTML thô -----------------------------------

test("KHÔNG file nào ở apps/web dùng `dangerouslySetInnerHTML`", () => {
  // Đây là hàng rào giữ cho mô hình an toàn không bị đổi lặng lẽ. `ThanVan` render một
  // cây node bằng JSX, nên React escape mọi văn bản; đổi sang chèn HTML là đổi cả mô
  // hình, không phải đổi một cách render — và nó phải là một quyết định nhìn thấy được.
  //
  // Hai ngoại lệ, cả hai tường minh — không phải một điều kiện suy ra:
  //
  // 1. `components/json-ld.tsx`, chỗ chèn JSON-LD của 1c. Nó KHÔNG nhận chữ người dùng gõ
  //    theo đường thô — `lib/json-ld.ts` dựng object rồi `JSON.stringify`, nên nội dung đi
  //    qua phép escape của JSON.
  // 2. `app/layout.tsx`, script inline của công tắc theme (lượt giao diện, 2026-08-23).
  //    Chuỗi nó chèn là **HẰNG BIÊN DỊCH**: `lib/theme.ts::nguonScriptTheme()` và
  //    `lib/kieu-xem.ts::nguonScriptKieuXem()` ghép từ hằng của chính module, không có một
  //    đường nào cho dữ liệu bên ngoài đi vào. Không dùng được `next/script` thay: mọi
  //    `strategy` của nó đều chạy SAU lần vẽ đầu, tức không tránh được cú nháy sai theme —
  //    mà tránh cú nháy ấy là toàn bộ lý do script tồn tại.
  //
  //    Cửa duy nhất biến nó thành lỗ: cho một biến chạy vào chuỗi. Bài
  //    `e2e/don-vi/theme.spec.ts` canh đúng chỗ đó — nó chạy chuỗi trên một DOM giả và
  //    khớp kết quả với hàm thuần, nên một tham số lạ chen vào sẽ lộ.
  // 3. `components/than-html.tsx`, thân MỐC do Tiptap soạn (user chốt 2026-08-24: "Tiptap
  //    lưu HTML đầy đủ"). Đây là ngoại lệ **nặng nhất** trong ba cái, vì nó là chỗ duy
  //    nhất chèn chữ NGƯỜI DÙNG GÕ vào DOM mà không qua JSX. Nó được phép vì độ an toàn
  //    nằm ở một chỗ khác và nằm ở PHÍA SERVER: `api/core/lam_sach_html.py::lam_sach`
  //    chạy trong `core/ghi.py` trên **mọi** đường ghi `body` (tạo mạch · nối mốc · sửa
  //    mốc) — allowlist 15 thẻ, thuộc tính chỉ `a[href]`, giao thức chỉ
  //    `http`/`https`/`mailto`. Không có đường ghi thứ tư.
  //
  //    Hai vế giữ cho câu trên không mục:
  //    - `api/tests/test_lam_sach_html.py` đo chính bộ lọc ấy;
  //    - một bài đo BẤT BIẾN ở phía Django: mọi `body` trong DB phải **bằng chính nó**
  //      sau khi `lam_sach` lần nữa — chuông báo nếu có dữ liệu lọt vào bằng đường khác.
  //
  //    ⚠ `Comment.body` và `MocRevision.body` **chưa từng qua `lam_sach`**; chúng có
  //    đường render riêng (`ThanVan` và `<pre>`). Đưa chúng vào `ThanHtml` là dựng lại
  //    đúng lỗ XSS mà cả lượt ấy bỏ công tránh.
  const MIEN = new Set([
    "components/json-ld.tsx",
    "app/layout.tsx",
    "components/than-html.tsx",
    "e2e/don-vi/markdown.spec.ts",
  ]);
  const pham = quetNguon(WEB, /\.tsx?$/)
    .filter((f) => !MIEN.has(f.ten))
    .filter((f) => f.sach.includes("dangerouslySetInnerHTML"))
    .map((f) => f.ten);
  expect(pham).toEqual([]);
});

test("bài trên không rỗng: MỌI file được miễn trừ THẬT SỰ có dùng nó", () => {
  // Giấy miễn trừ chết là giấy miễn trừ sẽ được nới. Quét CẢ HAI dòng chứ không chỉ dòng
  // đầu: bản trước chỉ soi `json-ld.tsx`, nên dòng miễn trừ thứ hai thêm vào lúc nào cũng
  // được mà không ai kiểm nó có cần thật không.
  for (const ten of [
    "components/json-ld.tsx",
    "app/layout.tsx",
    "components/than-html.tsx",
  ]) {
    const nguon = readFileSync(resolve(WEB, ten), "utf8");
    expect(nguon, `${ten} được miễn trừ mà không dùng dangerouslySetInnerHTML`).toContain(
      "dangerouslySetInnerHTML",
    );
  }
});

test("ThanVan in `body` qua docMarkdown, và trong THÂN nó không có chèn HTML thô", () => {
  // Đọc bản ĐÃ BỎ CHÚ THÍCH (`quetNguon`), y như bài trên: docstring của `ThanVan` nhắc
  // tên `dangerouslySetInnerHTML` để dặn người sau đừng đổi sang nó, và một hàng rào đọc
  // nguyên văn sẽ tố cáo chính lời dặn ấy.
  const f = quetNguon(WEB, /\.tsx?$/).find(
    (x) => x.ten === "components/than-van.tsx",
  );
  expect(f, "không tìm thấy components/than-van.tsx").toBeDefined();
  expect(f!.sach).toContain("docMarkdown");
  expect(f!.sach).not.toContain("dangerouslySetInnerHTML");
});
