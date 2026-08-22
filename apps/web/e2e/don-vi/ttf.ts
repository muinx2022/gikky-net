/** Đọc bảng `cmap` của một file TTF để trả lời đúng một câu: **font này có glyph cho mã
 * Unicode kia không?**
 *
 * Vì sao cần: ảnh OG được vẽ bởi satori, và satori **không báo lỗi** khi thiếu glyph — nó
 * vẽ một ô vuông rồi trả về một PNG hợp lệ. Ba file trong `apps/web/assets/font` là bản
 * static TTF tải từ Google Fonts; nhầm sang bản `latin` (thứ `next/og` dùng làm mặc định)
 * là mọi chữ có dấu tiếng Việt thành ô vuông trên Facebook, mà mọi bài đo khác vẫn xanh:
 * kích thước PNG vẫn > 0, hai ảnh khác tiêu đề vẫn khác nhau.
 *
 * Chỉ đọc `cmap` format 4 (BMP, hai byte) — đủ cho toàn bộ tiếng Việt: khối Latin
 * Extended Additional là U+1EA0–U+1EF9, nằm gọn trong BMP. Gặp format khác thì **NÉM**,
 * không trả `false`: `false` nói "font thiếu glyph" (một câu SAI), còn ném nói "bài đo
 * này không đọc được font đó" — hai kết luận khác nhau.
 */

type Bang = { batDau: number; format: number };

function timCmap(b: Buffer): Bang {
  const so_bang = b.readUInt16BE(4);
  let cmap = 0;
  for (let i = 0; i < so_bang; i += 1) {
    const o = 12 + i * 16;
    if (b.toString("ascii", o, o + 4) === "cmap") cmap = b.readUInt32BE(o + 8);
  }
  if (cmap === 0) throw new Error("TTF không có bảng cmap");

  // Ưu tiên subtable Unicode: (3,1)/(3,10) của Windows, hoặc platform 0 (Unicode).
  const so_sub = b.readUInt16BE(cmap + 2);
  let chon = 0;
  for (let i = 0; i < so_sub; i += 1) {
    const o = cmap + 4 + i * 8;
    const platform = b.readUInt16BE(o);
    const encoding = b.readUInt16BE(o + 2);
    if (platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) {
      chon = cmap + b.readUInt32BE(o + 4);
    }
  }
  if (chon === 0) throw new Error("TTF không có subtable cmap Unicode");
  return { batDau: chon, format: b.readUInt16BE(chon) };
}

/** `true` nếu font có glyph cho `ma` (một mã Unicode trong BMP). */
export function coGlyph(b: Buffer, ma: number): boolean {
  const { batDau, format } = timCmap(b);
  if (format !== 4) {
    throw new Error(`cmap format ${format} — bài đo này chỉ đọc được format 4`);
  }
  const so_byte_doan = b.readUInt16BE(batDau + 6);
  const cuoi_o = batDau + 14;
  const dau_o = cuoi_o + so_byte_doan + 2;
  const delta_o = dau_o + so_byte_doan;
  const range_o = delta_o + so_byte_doan;

  for (let s = 0; s < so_byte_doan / 2; s += 1) {
    const cuoi = b.readUInt16BE(cuoi_o + s * 2);
    if (ma > cuoi) continue;
    const dau = b.readUInt16BE(dau_o + s * 2);
    if (ma < dau) return false;
    const range = b.readUInt16BE(range_o + s * 2);
    if (range === 0) {
      return ((ma + b.readInt16BE(delta_o + s * 2)) & 0xffff) !== 0;
    }
    return b.readUInt16BE(range_o + s * 2 + range + (ma - dau) * 2) !== 0;
  }
  return false;
}

/** Chữ ký sfnt hợp lệ của một file TrueType: `0x00010000` hoặc `"true"`. */
export function laTtf(b: Buffer): boolean {
  const chu_ky = b.readUInt32BE(0);
  return chu_ky === 0x00010000 || chu_ky === 0x74727565;
}
