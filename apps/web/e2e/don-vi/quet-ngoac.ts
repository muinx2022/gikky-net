/** Phép quét ngoặc dùng chung cho **hai** hàng rào chống rò session —
 * `type-frontend.spec.ts` (`apps/web`) và `type-admin.spec.ts` (`apps/admin`).
 *
 * ## Vì sao nó phải là MỘT bản, không phải hai — L25
 *
 * Hai file kia hiện thực cùng một luật (*"mọi lời gọi hàm API phải kèm `baseUrl` theo
 * từng lần gọi"*), và chúng đã trôi khỏi nhau: bản web học đọc ngoặc LỒNG ở mảng B2, bản
 * admin ở lại với `\{([^{}]*)\}` một tầng. Lệch theo chiều an toàn — admin báo vi phạm
 * GIẢ nếu ai thêm một hằng có ngoặc lồng — nhưng một hàng rào báo động giả là một hàng
 * rào sẽ bị gỡ, và repo này đã ghi đúng câu đó ở L24.
 *
 * File này **không phải `.spec.ts`**, nên Playwright không thu nó vào bộ test. Đó là điều
 * kiện để hai spec `import` được nó mà không đăng ký bài đo hai lần.
 *
 * ## L37 — `baseUrl` phải nằm ở TẦNG ĐẦU của thân hằng
 *
 * Bản quét-cân-bằng trước đây hỏi `/\bbaseUrl\b/` trên **cả** thân hằng, nên nó cho lọt:
 *
 *     const C = { fetch: (u) => fetch(u, { baseUrl: 0 }) };
 *     xemMach({ ...C });                                   // ← không có baseUrl thật
 *
 * Chuỗi `baseUrl` ở đó nằm sâu hai tầng, thuộc về một lời gọi `fetch` bên trong, và
 * `{ ...C }` **không** đặt `baseUrl` cho lời gọi API nào cả. Bản một-tầng-ngoặc cũ không
 * cho lọt ca này (nó không đọc nổi thân hằng), nên câu *"Luật KHÔNG bị nới"* viết ở lượt
 * B2 rộng hơn sự thật đúng một ca — đó là L37.
 *
 * Cách bịt: đếm độ sâu qua cả ba loại ngoặc `{}` `[]` `()`, và chỉ nhận khoá tìm được ở
 * **độ sâu 0** của thân hằng. `CHUNG_ISR` thật vẫn qua (`baseUrl` của nó là khoá tầng
 * đầu); ca giả trên thì không.
 *
 * ⚠ Đây vẫn là phân tích chuỗi, không phải parser: nó không hiểu chuỗi ký tự, template
 * literal hay comment có chứa dấu ngoặc. Chấp nhận có ý thức — thứ nó canh là code THẬT
 * của repo, và mọi bản vá thông minh hơn ở đây đều đi về hướng "viết nửa cái type-checker
 * bằng regex", thứ repo này đã diệt nhiều lần. Bản đúng nghĩa là dùng type checker của
 * TypeScript, cùng lối `scripts/rao-can-client.mjs`; nó là một mục việc riêng.
 */

/** Thân của object literal khởi tạo hằng `ten`, hoặc `null` nếu không thấy.
 *
 * Đếm ngoặc CÂN BẰNG, không phải `\{([^{}]*)\}` *(mảng B2, 2026-08-23)*. Bản một tầng mù
 * với đúng hình dạng Phase 3 cần:
 *
 *     const CHUNG_ISR = { baseUrl: API_ORIGIN, fetch: (y) => fetch(y, { next: {…} }) };
 *
 * `[^{}]*` không vượt qua được dấu `{` bên trong, regex không khớp gì, và mọi lời gọi
 * `{ ...CHUNG_ISR, … }` bị báo **thiếu baseUrl**. Hỏng về phía an toàn — nhưng nó chặn
 * cứng cơ chế ISR của PLAN 8.4, và hai lối thoát còn lại đều xấu: một dòng giấy miễn trừ
 * cho đúng cái luật W2 vừa dọn sạch giấy, hoặc chép `baseUrl:` vào từng lời gọi để chiều
 * một hàng rào đọc kém.
 */
export function thanHang(ten: string, than: string): string | null {
  const dau = new RegExp(`\\b(?:const|let|var)\\s+${ten}\\s*=\\s*\\{`).exec(than);
  if (dau === null) return null;
  const mo = dau.index + dau[0].length - 1;
  let sau = 0;
  for (let i = mo; i < than.length; i += 1) {
    if (than[i] === "{") sau += 1;
    else if (than[i] === "}") {
      sau -= 1;
      if (sau === 0) return than.slice(mo + 1, i);
    }
  }
  return null;
}

/** Khoá `khoa` có xuất hiện ở **tầng đầu** của một thân object literal không? — L37.
 *
 * "Tầng đầu" = độ sâu 0, tính qua cả ba loại ngoặc. Một `baseUrl` nằm trong một hàm, một
 * mảng, hay một object con thì **không** phải khoá của object này, và spread nó vào một
 * lời gọi API không đặt `baseUrl` cho lời gọi ấy.
 */
export function coKhoaTangDau(than: string, khoa: string): boolean {
  let sau = 0;
  const re = new RegExp(`[{}\\[\\]()]|\\b${khoa}\\b`, "g");
  for (const m of than.matchAll(re)) {
    const t = m[0];
    if (t === "{" || t === "[" || t === "(") sau += 1;
    else if (t === "}" || t === "]" || t === ")") sau -= 1;
    else if (sau === 0) return true;
  }
  return false;
}

/** Đối số của một lời gọi API có mang `baseUrl` không — trực tiếp, hay qua **một** lớp
 * spread hằng số?
 *
 * `lib/api.ts` gom `{ baseUrl, cache }` vào hằng `CHUNG` rồi `{ ...CHUNG, … }` ở từng lời
 * gọi. Không đi theo được một lớp spread thì hàng rào bắt buộc mọi lời gọi phải chép lại
 * `baseUrl:` — tức nó ép một kiểu viết xấu hơn để chính nó đọc được.
 *
 * Vẫn **đúng một** lớp: `{...A}` với `const A = {...B}` và `baseUrl` nằm ở `B` thì KHÔNG
 * được nhận. Đi sâu hơn là mở đúng cửa mà hàm này canh.
 */
export function coBaseUrl(doi_so: string, than: string): boolean {
  if (/\bbaseUrl\b/.test(doi_so)) return true;
  for (const m of doi_so.matchAll(/\.\.\.([A-Za-z_$][\w$]*)/g)) {
    const khai = thanHang(m[1], than);
    // `coKhoaTangDau`, không phải `/\bbaseUrl\b/` — xem L37 ở docstring đầu file.
    if (khai !== null && coKhoaTangDau(khai, "baseUrl")) return true;
  }
  return false;
}
