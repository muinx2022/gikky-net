/** Trình kiểm **tính đúng cú pháp** của một tài liệu XML, đủ dùng cho RSS.
 *
 * Node không có `DOMParser`, và kéo một trình phân tích XML vào `devDependencies` chỉ để
 * đo một endpoint là đổi một phụ thuộc lấy một bài đo. Cái ở đây là một máy quét ~80
 * dòng, và **giới hạn của nó được nói thẳng**: nó kiểm cân bằng thẻ, lồng nhau đúng thứ
 * tự, dấu ngoặc kép của thuộc tính, và **mọi dấu `&` phải mở một thực thể hợp lệ** — đó
 * đúng là bốn cách một feed tự ghép chuỗi hỏng. Nó KHÔNG kiểm namespace, DTD, hay tính
 * hợp lệ theo lược đồ RSS.
 *
 * **Fail-closed**: gặp thứ không hiểu thì NÉM. Một trình kiểm trả `true` cho mọi thứ nó
 * không đọc nổi là một hàng rào rỗng, và `rss.spec.ts` có hẳn một nhóm bài chứng minh
 * hàm này biết nói "không".
 */

const THUC_THE = /^&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;
// Ký tự điều khiển viết bằng `\uXXXX`, không dán byte thật vào nguồn.
const KY_TU_CAM = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export class LoiXml extends Error {
  constructor(thong_diep: string, readonly tai: number) {
    super(`XML hỏng tại vị trí ${tai}: ${thong_diep}`);
    this.name = "LoiXml";
  }
}

/** Ném `LoiXml` nếu tài liệu không đúng cú pháp. Trả về số phần tử đã gặp. */
export function kiemXml(s: string): number {
  if (KY_TU_CAM.test(s)) {
    throw new LoiXml("còn ký tự điều khiển — XML 1.0 cấm, kể cả dạng &#x1;", s.search(KY_TU_CAM));
  }

  const chong: string[] = [];
  let so_phan_tu = 0;
  let i = 0;

  // Prolog `<?xml … ?>` không bắt buộc, nhưng có thì phải đóng.
  if (s.startsWith("<?xml")) {
    const het = s.indexOf("?>");
    if (het < 0) throw new LoiXml("prolog `<?xml` không đóng", 0);
    i = het + 2;
  }

  while (i < s.length) {
    const mo = s.indexOf("<", i);
    if (mo < 0) {
      kiemVanBan(s.slice(i), i);
      break;
    }
    kiemVanBan(s.slice(i, mo), i);

    if (s.startsWith("<!--", mo)) {
      const het = s.indexOf("-->", mo);
      if (het < 0) throw new LoiXml("chú thích không đóng", mo);
      i = het + 3;
      continue;
    }

    const dong = s[mo + 1] === "/";
    const het_the = timDongThe(s, mo);
    const than = s.slice(mo + (dong ? 2 : 1), het_the).trim();
    const tu_dong = !dong && than.endsWith("/");
    const noi_dung = tu_dong ? than.slice(0, -1).trim() : than;
    const ten = noi_dung.split(/[\s]/, 1)[0];
    if (!/^[A-Za-z_][\w.:-]*$/.test(ten)) {
      throw new LoiXml(`tên thẻ không hợp lệ ${JSON.stringify(ten)}`, mo);
    }

    if (dong) {
      const cho_doi = chong.pop();
      if (cho_doi !== ten) {
        throw new LoiXml(`đóng </${ten}> trong khi đang mở <${cho_doi ?? "(rỗng)"}>`, mo);
      }
    } else {
      kiemThuocTinh(noi_dung.slice(ten.length), mo);
      so_phan_tu += 1;
      if (!tu_dong) chong.push(ten);
    }
    i = het_the + 1;
  }

  if (chong.length > 0) throw new LoiXml(`còn thẻ chưa đóng: ${chong.join(", ")}`, s.length);
  if (so_phan_tu === 0) throw new LoiXml("tài liệu không có phần tử nào", 0);
  return so_phan_tu;
}

export function laXmlHopLe(s: string): boolean {
  try {
    kiemXml(s);
    return true;
  } catch {
    return false;
  }
}

/** Vị trí dấu `>` đóng thẻ, **bỏ qua dấu `>` nằm trong giá trị thuộc tính**. */
function timDongThe(s: string, mo: number): number {
  let nhay: string | null = null;
  for (let i = mo + 1; i < s.length; i += 1) {
    const c = s[i];
    if (nhay !== null) {
      if (c === nhay) nhay = null;
    } else if (c === '"' || c === "'") {
      nhay = c;
    } else if (c === ">") {
      return i;
    }
  }
  throw new LoiXml("thẻ không đóng", mo);
}

function kiemVanBan(van_ban: string, tai: number): void {
  for (let i = 0; i < van_ban.length; i += 1) {
    if (van_ban[i] === "&" && !THUC_THE.test(van_ban.slice(i))) {
      throw new LoiXml("dấu `&` trần trong nội dung — phải là `&amp;`", tai + i);
    }
  }
}

function kiemThuocTinh(phan: string, tai: number): void {
  const con = phan.trim();
  if (con === "") return;
  const re = /([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')\s*/g;
  let da_doc = 0;
  for (const m of con.matchAll(re)) {
    if (m.index !== da_doc) {
      throw new LoiXml(`thuộc tính không đúng dạng tên="giá trị"`, tai);
    }
    da_doc += m[0].length;
    kiemVanBan(m[3] ?? m[4] ?? "", tai);
  }
  if (da_doc !== con.length) {
    throw new LoiXml(`thuộc tính không đúng dạng tên="giá trị"`, tai);
  }
}
