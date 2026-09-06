/** Xử lý và làm sạch văn bản HTML thành văn bản thuần (plain text) cho SEO và snippet. */

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Chuyển HTML thành văn bản thuần túy:
 * - Thay thế thẻ ngắt dòng/khối bằng khoảng trắng để các đoạn văn không dính vào nhau;
 * - Gỡ bỏ toàn bộ thẻ HTML;
 * - Giải mã các HTML entities thông dụng;
 * - Gom các khoảng trắng thừa về một dấu cách duy nhất.
 */
export function trichVanBanThuan(html: string): string {
  if (!html) return "";

  // 1. Thêm khoảng trắng vào các thẻ đóng hoặc ngắt khối để tránh dính chữ
  let str = html.replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/blockquote)[^>]*>/gi, " ");

  // 2. Gỡ bỏ mọi thẻ HTML còn lại
  str = str.replace(/<[^>]+>/g, "");

  // 3. Giải mã các thực thể HTML phổ biến
  str = str.replace(/&(?:amp|lt|gt|quot|#39|#x27|apos|nbsp);/gi, (match) => {
    return ENTITY_MAP[match.toLowerCase()] ?? match;
  });

  // Giải mã số dạng thập phân &#123; và hex &#x1a;
  str = str.replace(/&#(\d+);/g, (_, code) => {
    const num = Number.parseInt(code, 10);
    return Number.isFinite(num) ? String.fromCharCode(num) : _;
  });
  str = str.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const num = Number.parseInt(hex, 16);
    return Number.isFinite(num) ? String.fromCharCode(num) : _;
  });

  // 4. Chuẩn hoá khoảng trắng
  return str.replace(/\s+/g, " ").trim();
}
