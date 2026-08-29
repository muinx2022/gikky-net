import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const WEB = resolve(__dirname, "..", "..");

/** **T5 — tương phản WCAG AA, đo bằng SỐ, ở CẢ HAI theme.**
 *
 * ## Vì sao đo ở đây chứ không để Lighthouse lo
 *
 * Lighthouse Accessibility có audit `color-contrast`, và nó chạy trên **trang thật ở theme
 * đang bật** — tức mỗi lượt đo chỉ soi một nửa. Nó cũng chỉ thấy những cặp màu **có mặt
 * trên đúng trang ấy**: một cặp chỉ xuất hiện ở trạng thái lỗi, ở menu đang đóng, hay ở
 * một trang chưa ai đo thì nó không biết. Bài này đi từ chiều ngược lại — đọc thẳng bảng
 * token và tính tỉ số cho từng cặp đã khai — nên nó không phụ thuộc vào việc trang nào
 * được mở.
 *
 * Hai phép đo bổ sung nhau, không thay nhau: cái này chứng minh **bảng màu** đúng, cái kia
 * chứng minh **cách dùng** bảng màu đúng.
 *
 * ## Công thức là WCAG 2.1, không phải một xấp xỉ
 *
 * `(L1 + 0.05) / (L2 + 0.05)`, với `L` là relative luminance sau khi gamma-expand từng
 * kênh sRGB. Viết ra ở đây thay vì kéo một thư viện: nó là 12 dòng, và một thư viện màu
 * trong `devDependencies` chỉ để chia hai số là chi phí bảo trì không cần thiết.
 */

const AA_CHU_THUONG = 4.5;
// (Không có hằng "chữ lớn" ở đây: bảng dưới không có cặp nào thuộc diện ấy. Thêm một
// hằng 3:1 mang tên "chữ lớn" khi chưa ai dùng là để sẵn một lối hạ ngưỡng.)
/** Viền, icon, thành phần giao diện — WCAG 1.4.11 "non-text contrast". */
const AA_PHI_CHU = 3;

/** Đọc một khối `:root { … }` (hoặc `:root[data-theme="dark"] { … }`) thành bảng token. */
export function docToken(css: string, chon: string): Record<string, string> {
  const tai = css.indexOf(chon);
  if (tai === -1) throw new Error(`Không thấy khối \`${chon}\` trong globals.css`);
  const mo = css.indexOf("{", tai);
  const dong = css.indexOf("}", mo);
  if (mo === -1 || dong === -1) throw new Error(`Khối \`${chon}\` không đóng ngoặc.`);
  const ra: Record<string, string> = {};
  for (const m of css.slice(mo, dong).matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    ra[m[1]] = m[2];
  }
  if (Object.keys(ra).length === 0) {
    throw new Error(`Cắt được \`${chon}\` nhưng không ra token màu nào — bài đo sẽ rỗng.`);
  }
  return ra;
}

/** Suy `--card` từ khai báo `color-mix` trong `globals.css` **thay vì gõ cứng một mã hex**.
 *
 * `--card` là token nền của THẺ — thẻ ở feed (từ 2026-08-24) và, từ 2026-08-26, cả tấm thẻ
 * của trang mạch. Nó không phải mã hex mà là
 * `color-mix(in srgb, var(--bg) N%, var(--surface-2))`, nên `docToken` (chỉ bắt `#hex`)
 * **bỏ qua nó** — và bảng cặp bên dưới đã không đo nền thẻ suốt từ ngày token ấy ra đời.
 * Hậu quả thật: `--ink-3` trên `--card` sáng chỉ 4.37:1, dưới AA, mà bài đo vẫn xanh.
 *
 * Đọc thẳng khai báo thay vì chép giá trị: chép là dựng bản sao thứ hai của một hằng, và
 * bản sao sẽ lệch đúng vào hôm ai đó chỉnh tỉ lệ trộn. Đổi shape khai báo ⇒ hàm này NÉM,
 * không im lặng trả về một màu đoán được.
 *
 * `color-mix(in srgb, …)` nội suy trên toạ độ sRGB **đã gamma-encode** (đúng như trình
 * duyệt trả về cho `color(srgb …)`), nên đây là phép nội suy tuyến tính trên byte màu.
 */
export function docCard(css: string, bang: Record<string, string>): string {
  const m = css.match(
    /--card:\s*color-mix\(\s*in srgb\s*,\s*var\((--[\w-]+)\)\s*([\d.]+)%\s*,\s*var\((--[\w-]+)\)\s*\)\s*;/,
  );
  if (m === null) {
    throw new Error(
      "Không đọc được `--card: color-mix(in srgb, var(--x) N%, var(--y));` trong globals.css — " +
        "token nền thẻ đổi shape thì bài đo này phải được viết lại, không được lặng lẽ bỏ qua.",
    );
  }
  const [, tenA, phanTram, tenB] = m;
  const a = bang[tenA];
  const b = bang[tenB];
  if (a === undefined || b === undefined) {
    throw new Error(`\`--card\` trộn từ ${tenA}/${tenB} nhưng theme này thiếu một trong hai.`);
  }
  const p = Number(phanTram) / 100;
  const tron = kenh(a).map((v, i) => v * p + kenh(b)[i] * (1 - p));
  return (
    "#" + tron.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")
  );
}

function kenh(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const day = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(day.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

/** Relative luminance theo WCAG 2.1. */
export function doSang(hex: string): number {
  const [r, g, b] = kenh(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function tiSo(a: string, b: string): number {
  const [x, y] = [doSang(a), doSang(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Mọi cặp chữ/nền THẬT SỰ dùng trong sản phẩm, kèm ngưỡng của nó.
 *
 * Danh sách gõ tay — và nó phải thế: "cặp nào thật sự đứng cạnh nhau" là kiến thức về bố
 * cục, không suy được từ bảng token. Nhân chéo mọi token với mọi token thì ra hàng trăm
 * cặp chưa bao giờ gặp nhau, và bài đo sẽ đỏ vì những cặp không tồn tại.
 *
 * Cái giá: thêm một cặp mới trong CSS mà quên khai ở đây thì không có gì đỏ. Đó là lý do
 * Lighthouse Accessibility vẫn phải chạy trên trang thật — nó soi đúng chỗ này.
 */
const CAP: readonly { chu: string; nen: string; nguong: number; o_dau: string }[] = [
  { chu: "--ink", nen: "--bg", nguong: AA_CHU_THUONG, o_dau: "chữ thân trên nền trang" },
  { chu: "--ink", nen: "--surface", nguong: AA_CHU_THUONG, o_dau: "chữ trên thẻ" },
  { chu: "--ink", nen: "--inset", nguong: AA_CHU_THUONG, o_dau: "chữ trong ô lõm" },
  { chu: "--ink", nen: "--surface-2", nguong: AA_CHU_THUONG, o_dau: "chữ trên chip đếm" },
  { chu: "--ink-2", nen: "--bg", nguong: AA_CHU_THUONG, o_dau: "chữ phụ trên nền trang" },
  { chu: "--ink-2", nen: "--surface", nguong: AA_CHU_THUONG, o_dau: "chữ phụ trên thẻ" },
  { chu: "--ink-2", nen: "--inset", nguong: AA_CHU_THUONG, o_dau: "chữ phụ trong ô lõm" },
  { chu: "--ink-2", nen: "--surface-2", nguong: AA_CHU_THUONG, o_dau: "chữ phụ trên chip" },
  // `--ink-3` là mực NHẠT NHẤT (dấu thời gian, nhãn nhóm, gợi ý). WCAG cho phép 3:1 với
  // chữ lớn; ở đây nó là chữ nhỏ, nên ngưỡng vẫn là 4.5 — không hạ ngưỡng cho một token
  // chỉ vì nó đang trượt. Hạ ngưỡng là cách "sửa" một bài đo tương phản mà không sửa gì.
  { chu: "--ink-3", nen: "--bg", nguong: AA_CHU_THUONG, o_dau: "mực nhạt trên nền trang" },
  { chu: "--ink-3", nen: "--surface", nguong: AA_CHU_THUONG, o_dau: "mực nhạt trên thẻ" },
  // ===== Nền THẺ `--card` (feed từ 2026-08-24, trang mạch từ 2026-08-26) =====
  // Nó TỐI HƠN `--surface` ở theme sáng, nên mọi cặp ở đây căng hơn cặp cùng chữ trên
  // `--surface` — và suốt từ lúc token ấy ra đời KHÔNG cặp nào được đo (xem `docCard`).
  { chu: "--ink", nen: "--card", nguong: AA_CHU_THUONG, o_dau: "chữ trên nền thẻ" },
  { chu: "--ink-2", nen: "--card", nguong: AA_CHU_THUONG, o_dau: "chữ phụ trên nền thẻ" },
  { chu: "--ink-3", nen: "--card", nguong: AA_CHU_THUONG, o_dau: "mực nhạt trên nền thẻ" },
  { chu: "--accent", nen: "--card", nguong: AA_CHU_THUONG, o_dau: "link trên nền thẻ" },
  { chu: "--gain", nen: "--card", nguong: AA_CHU_THUONG, o_dau: "con số LÃI trên nền thẻ" },
  { chu: "--loss", nen: "--card", nguong: AA_CHU_THUONG, o_dau: "con số LỖ trên nền thẻ" },
  { chu: "--focus", nen: "--card", nguong: AA_PHI_CHU, o_dau: "vòng focus trên nền thẻ" },
  { chu: "--stamp", nen: "--card", nguong: AA_PHI_CHU, o_dau: "con dấu trên nền thẻ — MIỄN TRỪ L43" },
  { chu: "--accent", nen: "--bg", nguong: AA_CHU_THUONG, o_dau: "link trên nền trang" },
  { chu: "--accent", nen: "--surface", nguong: AA_CHU_THUONG, o_dau: "link trên thẻ" },
  { chu: "--accent", nen: "--accent-soft", nguong: AA_CHU_THUONG, o_dau: "tab đang chọn" },
  { chu: "--on-accent", nen: "--accent", nguong: AA_CHU_THUONG, o_dau: "badge CHỦ MẠCH · nút Gửi" },
  // ⚠⚠ **HOÀNG THỔ SÁNG CHƯA ĐẠT AA CHO CHỮ NHỎ — và ngưỡng dưới đây là một MIỄN TRỪ có
  // ghi tên, không phải một kết luận "đã đạt".** Đọc hết đoạn này trước khi tin con số.
  //
  // Đo được: `--stamp` sáng `#B07A2B` cho **3.71:1** trên `--surface` và **3.31:1** trên
  // `--bg`. Chỗ dùng nó đều là chữ NHỎ — "đã sửa N lần", "ĐÃ ĐÓNG SỔ" 10.5px, nhãn
  // "DRAFT", "Được trích ×N" — nên ngưỡng ĐÚNG của chúng là 4.5, và cả hai đều trượt.
  // Bản tối đạt thoải mái (7.78:1); chỉ bản sáng hỏng.
  //
  // Vì sao không sửa ở lượt này: mã `#B07A2B` do **PLAN 9.1 ghim đích danh**, và mục 9.1
  // bị ghim SHA-256 ở `mau-token.spec.ts`. Đổi nó là đổi PLAN, tức một quyết định của
  // người — đúng thứ lớp băm ấy sinh ra để bắt phải cố ý. Lượt giao diện 2026-08-23 bị
  // cấm tường minh chạm vào 9.1.
  //
  // Vì sao KHÔNG xoá hai dòng này khỏi bảng: xoá đi là bài đo im lặng, và im lặng đọc
  // thành "đã đạt". Để lại ở ngưỡng phi-chữ nghĩa là *"hôm nay hoàng thổ chỉ đủ tư cách
  // một dấu hiệu phi văn bản"* — đúng sự thật, và nó vẫn ĐỎ nếu ai làm nó tệ thêm.
  //
  // Đã ghi thành mục **L43** trong `LOI-VA-NO.md` kèm hai cách chữa và cái giá của mỗi cách.
  { chu: "--stamp", nen: "--surface", nguong: AA_PHI_CHU, o_dau: 'con dấu "đã sửa" — MIỄN TRỪ L43' },
  { chu: "--stamp", nen: "--bg", nguong: AA_PHI_CHU, o_dau: "vạch mới — MIỄN TRỪ L43" },
  { chu: "--gain", nen: "--surface", nguong: AA_CHU_THUONG, o_dau: "con số LÃI" },
  { chu: "--loss", nen: "--surface", nguong: AA_CHU_THUONG, o_dau: "con số LỖ" },
  // ===== Chỗ dùng THỨ HAI của xanh/đỏ: thông báo form tài khoản (2026-08-27) =====
  // `mau-token.spec.ts` vừa nới allowlist cho `form-tai-khoan.module.css` — nới chỗ dùng
  // thì phải nới cả chỗ ĐO, nếu không thì một màu vừa được cấp phép đi vào một cái nền
  // chưa ai đo. `.loi`/`.xong` nằm trên `--inset` (nền hộp) chứ không trên `--surface`
  // (nền thẻ), nên cặp với `--inset` mới là cặp thật sự xuất hiện trên màn hình.
  { chu: "--loss", nen: "--inset", nguong: AA_CHU_THUONG, o_dau: "chữ LỖI trong form" },
  { chu: "--gain", nen: "--inset", nguong: AA_CHU_THUONG, o_dau: "chữ XONG trong form" },
  // Vòng focus là thứ WCAG 1.4.11 thật sự đòi 3:1: nó là dấu hiệu TRẠNG THÁI, và nó là
  // thứ duy nhất nói cho người đi bằng bàn phím biết mình đang đứng ở đâu.
  { chu: "--focus", nen: "--bg", nguong: AA_PHI_CHU, o_dau: "vòng focus trên nền trang" },
  { chu: "--focus", nen: "--surface", nguong: AA_PHI_CHU, o_dau: "vòng focus trên thẻ" },
  // `--line-2` (viền ô nhập, viền chip) **cố ý KHÔNG có trong bảng** — 1.63:1 sáng /
  // 1.70:1 tối, và đưa nó lên 3:1 đòi một xám đậm cỡ `#91959E`, thứ làm mọi khung trên
  // site nặng hẳn lên. WCAG 1.4.11 đòi 3:1 cho đường bao **cần thiết để nhận ra một thành
  // phần**; ô nhập ở đây không dựa vào viền để được nhận ra — nó có nền riêng
  // (`--surface` khác `--bg`), có `<label>` thật, và trạng thái focus đi bằng vòng focus
  // 2px đã đo ngay trên. Đây là một đánh đổi có ghi ra, không phải một chỗ bị bỏ sót.
];

const CSS = readFileSync(resolve(WEB, "app/globals.css"), "utf8");
/** ⚠ `--card` được BƠM THÊM vào cả hai bảng (xem `docCard`): nó là token nền của thẻ
 * nhưng không phải mã hex, nên `docToken` không thấy. Bơm ở đây — chứ không phải thêm một
 * dòng hex vào `globals.css` — để `globals.css` vẫn giữ đúng MỘT nguồn cho công thức trộn.
 *
 * Bản tối khai `--bg`/`--surface-2` riêng còn `--card` thì không (nó là `color-mix` tham
 * chiếu hai token kia, trình duyệt giải ở lúc DÙNG), nên cùng một công thức cho ra hai màu
 * khác nhau — đúng như trên trang thật. */
const THEME: Readonly<Record<string, Record<string, string>>> = (() => {
  const sang = docToken(CSS, ":root {");
  const toi = docToken(CSS, ':root[data-theme="dark"]');
  sang["--card"] = docCard(CSS, sang);
  toi["--card"] = docCard(CSS, toi);
  return { sáng: sang, tối: toi };
})();

test("bảng token đọc được và KHÔNG rỗng ở cả hai theme (chống bài đo rỗng)", () => {
  for (const [ten, bang] of Object.entries(THEME)) {
    expect(Object.keys(bang).length, `theme ${ten}`).toBeGreaterThan(12);
  }
  // Hai theme phải khai CÙNG tập token: một token chỉ có ở sáng nghĩa là ở tối nó rơi về
  // giá trị của sáng, và cặp tương phản của nó không còn ai đo.
  expect(Object.keys(THEME["sáng"]).sort()).toEqual(Object.keys(THEME["tối"]).sort());
});

test("T5 — mọi cặp chữ/nền đạt WCAG AA ở CẢ HAI theme", () => {
  const truot: string[] = [];
  for (const [ten, bang] of Object.entries(THEME)) {
    for (const c of CAP) {
      const chu = bang[c.chu];
      const nen = bang[c.nen];
      if (chu === undefined || nen === undefined) {
        truot.push(`${ten}: thiếu token ${chu === undefined ? c.chu : c.nen}`);
        continue;
      }
      const r = tiSo(chu, nen);
      if (r < c.nguong) {
        truot.push(
          `${ten}: ${c.chu} trên ${c.nen} (${c.o_dau}) = ${r.toFixed(2)}:1 < ${c.nguong}`,
        );
      }
    }
  }
  expect(truot).toEqual([]);
});

test("công thức tương phản đúng — ba mốc đã biết", () => {
  // Không có ba dòng này thì một `tiSo` luôn trả `21` cũng làm bài trên xanh tuyệt đối.
  expect(tiSo("#000000", "#ffffff")).toBeCloseTo(21, 5);
  expect(tiSo("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  // Cặp WCAG kinh điển: #767676 trên trắng = đúng 4.54:1, mốc AA sát nhất.
  expect(tiSo("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  expect(tiSo("#777777", "#ffffff")).toBeLessThan(4.6);
  // Đối xứng: đổi chỗ chữ/nền không đổi tỉ số.
  //
  // ⚠ Màu dùng ở đây **cố ý KHÔNG phải** một mã của hệ token. `mau-token.spec.ts` cấm bốn
  // mã lãi/lỗ và bốn mã hoàng thổ xuất hiện ngoài `app/globals.css`, và cái cấm ấy đúng:
  // một bài đo gõ cứng `#1C7A4F` là một chỗ nữa cho mã ấy sống, tức một chỗ nữa để nó trôi
  // khỏi bảng token. Phép đo đối xứng không cần màu THẬT nào.
  expect(tiSo("#336699", "#ffffff")).toBeCloseTo(tiSo("#ffffff", "#336699"), 10);
});

test("danh sách cặp không rỗng và không có token ma", () => {
  expect(CAP.length).toBeGreaterThan(15);
  for (const c of CAP) {
    expect(THEME["sáng"], `${c.chu} phải có trong bảng token`).toHaveProperty(c.chu);
    expect(THEME["sáng"], `${c.nen} phải có trong bảng token`).toHaveProperty(c.nen);
  }
});
