/** Markdown của `body` — **allowlist, không blocklist** (chốt của plan mảng A · PLAN 5.2).
 *
 * ## Quyết định lớn: KHÔNG sinh HTML, sinh CÂY NODE
 *
 * Cách thường thấy là `marked()` rồi `DOMPurify.sanitize()` rồi
 * `dangerouslySetInnerHTML`. Ở đây **không** làm thế, và lý do không phải khẩu vị: cách
 * ấy dựng một chuỗi HTML thật rồi mới đi dọn nó, nên độ an toàn của cả trang bằng đúng độ
 * đầy đủ của bộ lọc — mỗi lần thư viện markdown mọc thêm một cú pháp, hoặc trình duyệt
 * mọc thêm một thuộc tính, là bộ lọc phải đuổi theo. Blocklist muôn đời chậm hơn một bước.
 *
 * Hàm này **phân tích ra một cây node có kiểu** (`Nut` bên dưới), và `ThanVan` render cây
 * đó bằng JSX. Hệ quả:
 *
 * - **không tồn tại đường nào để HTML thô đi ra** — React escape mọi chuỗi văn bản, nên
 *   `<script>alert(1)</script>` in ra thành đúng mười chín ký tự đó;
 * - `onerror=`, `onclick=` … **không có chỗ tồn tại**: cây chỉ có 6 loại node và không
 *   loại nào mang thuộc tính tự do;
 * - `javascript:` bị chặn bằng **allowlist giao thức** (`http`, `https`, `mailto`) — mọi
 *   URL không khớp thì thẻ link **rơi về văn bản thường**, không phải rơi về một link
 *   trỏ đâu đó.
 *
 * Cái giá, nói thẳng: đây là một tập con markdown viết tay, không phải CommonMark. Nó
 * KHÔNG có bảng, ảnh, HTML nhúng, tiêu đề, danh sách lồng nhau, hay code block ba dấu
 * huyền. Với sản phẩm này thì đủ (PLAN 5.2 mô tả `body` là nhật ký giao dịch), và mỗi cú
 * pháp thêm vào phải đi kèm một bài đo — xem `e2e/don-vi/markdown.spec.ts`.
 *
 * **Chạy ở SERVER** (`ThanVan` là server component). Đó là chỗ đúng: cùng một chuỗi cho
 * cùng một cây, bot đọc được, và không tốn JS phía client.
 */

/** Giao thức được phép trong `[chữ](url)`. **Allowlist** — thiếu một cái thì link đó rơi
 * về văn bản, chứ không có nhánh "cứ cho qua". */
const GIAO_THUC_CHO_PHEP = ["http:", "https:", "mailto:"];

export type NutDong =
  | { loai: "chu"; chu: string }
  | { loai: "dam"; con: NutDong[] }
  | { loai: "nghieng"; con: NutDong[] }
  | { loai: "ma"; chu: string }
  | { loai: "link"; url: string; con: NutDong[] };

export type NutKhoi =
  | { loai: "doan"; con: NutDong[] }
  | { loai: "trich"; con: NutDong[] }
  | { loai: "danh_sach"; muc: NutDong[][] };

/** URL này có an toàn để làm `href` không.
 *
 * `new URL(...)` chứ không phải `startsWith("http")`: `java\tscript:alert(1)` và
 * ` javascript:alert(1)` đều **không** bắt đầu bằng "javascript" theo phép so chuỗi ngây
 * thơ, nhưng trình duyệt vẫn chạy chúng. Bộ phân tích URL của chính nền tảng là thứ duy
 * nhất đồng ý với trình duyệt về "giao thức của chuỗi này là gì".
 *
 * URL tương đối (`/m/abc-1`) hợp lệ: nó không mang giao thức nào, nên nó thừa hưởng
 * `https:` của trang.
 */
export function urlAnToan(url: string): boolean {
  const s = url.trim();
  if (s === "") return false;
  if (s.startsWith("/") && !s.startsWith("//")) return true;
  try {
    return GIAO_THUC_CHO_PHEP.includes(new URL(s).protocol);
  } catch {
    return false;
  }
}

/** Cú pháp INLINE, theo thứ tự ưu tiên. `ma` (`` `x` ``) đứng TRƯỚC mọi cái khác: nội
 * dung trong dấu huyền là mã, và `**` trong đó phải giữ nguyên chữ. */
const INLINE: {
  re: RegExp;
  dung: (m: RegExpExecArray) => NutDong;
}[] = [
  { re: /`([^`]+)`/, dung: (m) => ({ loai: "ma", chu: m[1] }) },
  {
    re: /\[([^\]]+)\]\(([^\s)]+)\)/,
    dung: (m) =>
      urlAnToan(m[2])
        ? { loai: "link", url: m[2].trim(), con: docDong(m[1]) }
        : // URL không an toàn ⇒ **rơi về văn bản**, giữ nguyên nguyên văn markdown. Không
          // im lặng bỏ chữ đi: người viết phải thấy được cái link của mình không thành
          // link, và người đọc phải thấy được nó trỏ đi đâu.
          { loai: "chu", chu: `[${m[1]}](${m[2]})` },
  },
  { re: /\*\*([^*]+)\*\*/, dung: (m) => ({ loai: "dam", con: docDong(m[1]) }) },
  { re: /\*([^*]+)\*/, dung: (m) => ({ loai: "nghieng", con: docDong(m[1]) }) },
];

/** Một dòng chữ → danh sách node inline. */
export function docDong(chu: string): NutDong[] {
  let som: { tai: number; m: RegExpExecArray; i: number } | null = null;
  for (let i = 0; i < INLINE.length; i += 1) {
    const m = INLINE[i].re.exec(chu);
    if (m !== null && (som === null || m.index < som.tai)) {
      som = { tai: m.index, m, i };
    }
  }
  if (som === null) return chu === "" ? [] : [{ loai: "chu", chu }];

  const truoc = chu.slice(0, som.tai);
  const sau = chu.slice(som.tai + som.m[0].length);
  return [
    ...(truoc === "" ? [] : [{ loai: "chu" as const, chu: truoc }]),
    INLINE[som.i].dung(som.m),
    ...docDong(sau),
  ];
}

/** Toàn bộ `body` → danh sách khối.
 *
 * Khối chia theo **dòng trống**, đúng như `ThanVan` của 1c đã làm; Phase 2 chỉ thêm ba
 * cú pháp khối: `> trích`, `- danh sách`, và đoạn thường. Xuống dòng đơn trong một đoạn
 * vẫn là `<br>` (nhật ký giao dịch xuống dòng nhiều, và ép người ta gõ hai lần Enter là
 * ép một quy ước không ai biết).
 */
export function docMarkdown(body: string): NutKhoi[] {
  const ra: NutKhoi[] = [];
  for (const khoi of body.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const dong = khoi.split("\n").filter((d) => d.trim() !== "");
    if (dong.length === 0) continue;

    if (dong.every((d) => /^\s*>\s?/.test(d))) {
      ra.push({
        loai: "trich",
        con: docDong(dong.map((d) => d.replace(/^\s*>\s?/, "")).join(" ")),
      });
      continue;
    }
    if (dong.every((d) => /^\s*[-*+]\s+/.test(d))) {
      ra.push({
        loai: "danh_sach",
        muc: dong.map((d) => docDong(d.replace(/^\s*[-*+]\s+/, ""))),
      });
      continue;
    }
    // Đoạn thường: mỗi dòng là một node, `ThanVan` chèn `<br>` giữa chúng.
    ra.push({ loai: "doan", con: docDong(dong.join("\n")) });
  }
  return ra;
}
