import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { tachDam } from "../../lib/tim-kiem";
import { boChuThich } from "./quet";

/** Bộ đọc dấu tô đậm `[[…]]` của API tìm kiếm — Phase 7.
 *
 * Hàm thuần, nên nó ở đây chứ không ở bộ e2e thật. Cái đáng đo không phải ca thường (một
 * cặp dấu, một từ) mà là **ba ca méo**: dấu mồ côi do người dùng gõ, cặp bị cắt ngang bởi
 * chỗ cắt đoạn trích, và hai cặp liền nhau. Cả ba đều có thật, và cả ba đều làm một bản
 * cài bằng `split("[[")` cho ra chữ sai — mà sai ở đây nghĩa là **nuốt mất nội dung**,
 * không phải hiện xấu.
 */

test("tách một cặp dấu thành ba đoạn", () => {
  expect(tachDam("Nhật ký lệnh [[HPG]] hôm nay")).toEqual([
    { chu: "Nhật ký lệnh ", dam: false },
    { chu: "HPG", dam: true },
    { chu: " hôm nay", dam: false },
  ]);
});

test("hai cặp liền nhau không dính vào nhau", () => {
  expect(tachDam("[[Nhật]] ký lệnh [[HPG]]")).toEqual([
    { chu: "Nhật", dam: true },
    { chu: " ký lệnh ", dam: false },
    { chu: "HPG", dam: true },
  ]);
});

test("chuỗi không có dấu nào trả về đúng một đoạn thường", () => {
  expect(tachDam("không khớp gì")).toEqual([{ chu: "không khớp gì", dam: false }]);
  expect(tachDam("")).toEqual([]);
});

test("`[[` MỒ CÔI giữ nguyên văn, không nuốt phần đuôi", () => {
  // `[[ghi chú]]` là cú pháp wiki quen tay; một `[[` không có `]]` theo sau là chuyện có
  // thật trong tiêu đề người dùng. Bản cài bằng `split` sẽ mất hết chữ sau nó.
  expect(tachDam("mở ngoặc [[ rồi thôi")).toEqual([
    { chu: "mở ngoặc [[ rồi thôi", dam: false },
  ]);
});

test("cặp bị CẮT NGANG bởi chỗ cắt đoạn trích không làm mất chữ", () => {
  // API cắt đoạn trích ở 220 ký tự, nên đoạn có thể kết thúc giữa một cặp dấu. Phần còn
  // lại phải hiện ra như chữ thường — không được biến mất, cũng không được tô đậm bừa.
  const ra = tachDam("chốt lời [[HP");
  expect(ra.map((m) => m.chu).join("")).toBe("chốt lời [[HP");
  expect(ra.every((m) => !m.dam)).toBe(true);
});

test("ghép lại các đoạn luôn ra đúng chuỗi gốc trừ cặp dấu", () => {
  // Bất biến quan trọng nhất: bộ tách **không được đổi một ký tự nào** của nội dung. Nó
  // chỉ đánh dấu chỗ nào là chỗ khớp.
  const goc = "Mua [[HPG]] vùng giá 26, [[chốt]] một phần.";
  expect(
    tachDam(goc)
      .map((m) => m.chu)
      .join(""),
  ).toBe("Mua HPG vùng giá 26, chốt một phần.");
});

/* --- Gợi ý khi đang gõ: ba chốt của đường gọi (2026-08-30) -------------------
 *
 * Đọc NGUỒN `components/o-tim-kiem.tsx`, và đó là tầng duy nhất rào được ba thứ này:
 *
 * - một bài Playwright thật đo được "gõ ra dropdown", nhưng **không** đo được có bao
 *   nhiêu request đã bay đi — nó chỉ thấy kết quả cuối;
 * - bỏ `AbortController` là lỗi **hiện SAI**, không phải lỗi chậm: phản hồi của "nh" về
 *   sau phản hồi của "nhật" thì dropdown hiện kết quả của một câu đã gõ xong từ lâu. Nó
 *   chỉ nổ khi mạng chậm và request về không đúng thứ tự, tức gần như không bao giờ tái
 *   hiện được ở dev;
 * - `cache: "no-store"` là thứ giữ cho một cái tên bài mod vừa gỡ không sống thêm một
 *   vòng nữa trong bộ nhớ đệm của trình duyệt.
 *
 * Ba chuyện ấy đều **biến mất khỏi mọi bài đo hành vi** — nên chúng phải có hàng rào đọc
 * nguồn, hoặc không có hàng rào nào cả.
 */

const O_TIM_KIEM_TSX = boChuThich(
  readFileSync(resolve(__dirname, "..", "..", "components/o-tim-kiem.tsx"), "utf8"),
);

test("gợi ý có DEBOUNCE, không bắn một request mỗi phím gõ", () => {
  expect(O_TIM_KIEM_TSX, "mất `setTimeout` ⇒ gọi thẳng theo từng ký tự").toMatch(
    /setTimeout\(/,
  );
  // Con số ghim ở một hằng có tên, và nó phải đúng 250 (quyết định của plan). Một hằng
  // lặng lẽ đổi sang 0 là mất debounce mà mọi phép so "có setTimeout" vẫn xanh.
  expect(O_TIM_KIEM_TSX).toMatch(/const NHIP_CHO_MS = 250;/);
  expect(O_TIM_KIEM_TSX).toMatch(/NHIP_CHO_MS\s*\)/);
  // …và cái hẹn phải được HUỶ khi câu đổi, nếu không debounce chỉ là "trễ 250ms" chứ
  // không phải "gộp các phím gõ liền nhau".
  expect(O_TIM_KIEM_TSX).toMatch(/clearTimeout\(/);
});

test("gợi ý HUỶ request cũ (`AbortController`) — chống phản hồi về sai thứ tự", () => {
  expect(O_TIM_KIEM_TSX).toMatch(/new AbortController\(\)/);
  expect(O_TIM_KIEM_TSX).toMatch(/\.abort\(\)/);
  // Và `signal` phải THẬT SỰ đi vào lời gọi — dựng một controller rồi quên truyền nó là
  // đúng cách viết trông như đã rào mà không rào gì.
  expect(O_TIM_KIEM_TSX, "`signal` không được truyền xuống lời gọi API").toMatch(
    /signal:\s*\w+\.signal/,
  );
});

test("gợi ý KHÔNG cache, và không hỏi khi câu quá ngắn", () => {
  expect(O_TIM_KIEM_TSX).toMatch(/cache:\s*"no-store"/);
  expect(O_TIM_KIEM_TSX).toMatch(/const DAI_TOI_THIEU = 2;/);
  expect(O_TIM_KIEM_TSX).toMatch(/length < DAI_TOI_THIEU/);
});

test("ba hàng rào trên bắt được hàng giả (chống hàng rào rỗng)", () => {
  // Nếu `boChuThich` hỏng hoặc đường dẫn sai thì `O_TIM_KIEM_TSX` rỗng và mọi phép
  // `toMatch` ở trên đỏ chứ không xanh — nhưng bài này nói thẳng ra lý do.
  expect(O_TIM_KIEM_TSX.length).toBeGreaterThan(2000);
  // …và các mẫu ấy KHÔNG khớp bừa một file bất kỳ.
  const gia = "export function X() { return null; }";
  expect(/new AbortController\(\)/.test(gia)).toBe(false);
  expect(/const NHIP_CHO_MS = 250;/.test(gia)).toBe(false);
});

/* --- Dropdown KHÔNG tự bung khi URL đổi, và ĐÓNG khi Tab ra (2026-08-30) -----
 *
 * Cùng lý lẽ đọc-nguồn với ba chốt trên: một bài Playwright thấy "dropdown mở/đóng" ở
 * trạng thái cuối, nhưng hai lỗi dưới đây chỉ lộ theo NGUỒN GỐC của thay đổi (người gõ
 * vs URL đổi) và theo LỐI RỜI focus (Tab bàn phím vs chuột) — thứ không đọng lại trong
 * kết quả cuối cùng của một bài đo hành vi.
 */

test("gợi ý CHỈ bung khi người gõ, không khi URL đổi (tải trang / Back)", () => {
  // Cờ `useRef` phân biệt hai đường đổi `cau`. Không có nó, mở `/tim-kiem?q=hpg` hoặc
  // bấm Back về nó làm `q_tren_url` đổi ⇒ effect bắn gợi ý ⇒ dropdown tự bung khi vừa tải.
  expect(O_TIM_KIEM_TSX).toMatch(/nguoiGo\s*=\s*useRef\(false\)/);
  // Effect gợi ý PHẢI chặn khi cờ tắt — dựng ref mà không đọc nó là hàng rào rỗng.
  expect(O_TIM_KIEM_TSX).toMatch(/if\s*\(!nguoiGo\.current\)\s*return;/);
  // Bật khi người gõ (onChange), tắt khi URL đổi (effect đồng bộ).
  expect(O_TIM_KIEM_TSX).toMatch(/nguoiGo\.current\s*=\s*true/);
  expect(O_TIM_KIEM_TSX).toMatch(/nguoiGo\.current\s*=\s*false/);
});

test("dropdown ĐÓNG khi focus rời vùng bọc (Tab ra bằng bàn phím)", () => {
  // `mousedown` ngoài + Esc không bắt được Tab tới phần tử kế. `onBlur` (focusout, nổi
  // bọt) trên vùng bọc bắt cả blur input lẫn blur các `<Link>`.
  expect(O_TIM_KIEM_TSX).toMatch(/onBlur=/);
  // …và phải kiểm `relatedTarget` còn nằm TRONG vùng bọc — đóng vô điều kiện sẽ nuốt cú
  // bấm chuột vào một option (blur input xảy ra trước click của Link).
  expect(O_TIM_KIEM_TSX).toMatch(/\.contains\(\s*e\.relatedTarget/);
});

const PAGE_TSX = boChuThich(
  readFileSync(resolve(__dirname, "..", "..", "app/tim-kiem/page.tsx"), "utf8"),
);

test("`?sub=` không nói dối 'không có bình luận' — câu rỗng chỉ nói mạch", () => {
  // API cắt hẳn nhánh bình luận khi có `?sub=` (bình luận không mang sub). Câu trạng thái
  // rỗng phải đổi theo, cộng một dòng nói bộ lọc chuyên mục không áp cho bình luận —
  // không thì trang khẳng định "không có bình luận nào" cho một nhánh nó chưa hề hỏi.
  expect(PAGE_TSX).toContain("Bộ lọc chuyên mục không áp cho bình luận");
  expect(PAGE_TSX).toContain("tim-kiem-sub-chi-mach");
  expect(PAGE_TSX).toMatch(/Không có mạch nào khớp/);
  expect(PAGE_TSX.length).toBeGreaterThan(1500);
});
