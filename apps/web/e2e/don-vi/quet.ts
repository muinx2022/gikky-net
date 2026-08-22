import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

/** Tiện ích quét mã nguồn cho các hàng rào grep (`mau-token`, `type-frontend`).
 *
 * **Vì sao phải bỏ chú thích trước khi grep:** hai hàng rào ở đây tìm những chuỗi mà
 * chính docstring của chúng phải nhắc tới (`#1C7A4F`, `client.setConfig(...)`). Không
 * bỏ chú thích thì mỗi lời giải thích lại tự tố cáo mình, và cách chữa duy nhất còn lại
 * là ngừng giải thích — tức hàng rào ăn mất tài liệu của chính nó.
 *
 * **Giới hạn đã biết của `boChuThich`:** nó là phép cắt chuỗi, không phải parser. Chú
 * thích khối `/* … *\/` và chú thích dòng `//` được bỏ; `//` đi ngay sau dấu `:` được
 * giữ để không chặt cụt `https://`. Một dấu `//` nằm TRONG chuỗi văn bản (không đứng sau
 * `:`) sẽ bị hiểu nhầm là chú thích và phần còn lại của dòng biến mất khỏi phép quét —
 * tức một điểm mù. Đổi lại, mỗi hàng rào đều có một bài đo "bộ file quét được không
 * rỗng" và một bài đo "chỗ được phép dùng thật sự có dùng", nên hàng rào không thể âm
 * thầm trở thành hàng rào rỗng.
 */

const BO_QUA_THU_MUC = [
  "node_modules",
  ".next",
  "test-results",
  "playwright-report",
  "blob-report",
];

export type FileNguon = { ten: string; noi_dung: string; sach: string };

export function quetNguon(goc: string, duoi: RegExp): FileNguon[] {
  const duong_dan: string[] = [];
  const di = (thu_muc: string) => {
    for (const ten of readdirSync(thu_muc)) {
      if (BO_QUA_THU_MUC.includes(ten)) continue;
      const p = resolve(thu_muc, ten);
      if (statSync(p).isDirectory()) di(p);
      else if (duoi.test(ten)) duong_dan.push(p);
    }
  };
  di(goc);
  return duong_dan.map((p) => {
    const noi_dung = readFileSync(p, "utf8");
    return {
      ten: relative(goc, p).replaceAll("\\", "/"),
      noi_dung,
      sach: boChuThich(noi_dung),
    };
  });
}

export function boChuThich(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Bỏ mọi câu lệnh `import … from "…"`.
 *
 * Cần cho luật "không tự khai lại schema": `import { xemMach, type FeedOut }` chứa đúng
 * chuỗi `type FeedOut` mà luật đó đi tìm, dù nó là *nhập khẩu* chứ không phải *khai báo*
 * — đọc đúng ngược ý nghĩa.
 */
export function boImport(s: string): string {
  return s.replace(/^import[\s\S]*?from\s*"[^"]*";\s*$/gm, "");
}
