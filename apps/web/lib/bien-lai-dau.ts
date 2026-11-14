/** Ba hàm thuần của biên lai đầu bài và mốc thu gọn.
 *
 * `figuresMocDau` chỉ lấy số của mốc 1 còn đọc được — không phải `ket_qua`, không phải
 * mốc sau. Mạch CÓ LỆNH thì người gọi (`trang-mach.tsx`) bỏ qua hàm này và không vẽ biên lai
 * (việc 25: dải lệnh là khối số đầu bài duy nhất). Lưu ý luật "đọc được" ở đây (`trang_thai
 * === "binh_thuong"`, gồm cả bia mộ) RỘNG hơn luật API ẩn lệnh: API chỉ trả `lenh = null` khi
 * mốc 1 bị MOD ẩn — bia mộ do tác giả tự xoá vẫn giữ lệnh. `hienNutXemThem` quyết định có nút không: thân chữ tràn, hoặc còn ảnh /
 * snapshot / trích bị giấu. `nhanOSpine` là câu trình đọc màn hình nghe trên ô spine;
 * chữ nhìn thấy trên ô vẫn là số.
 */

const TOI_DA_CAP = 6;

export function figuresMocDau(
  mocs: readonly {
    seq: number;
    trang_thai: string;
    figures: readonly { label: string; value: string }[] | null;
  }[],
): { label: string; value: string }[] {
  const moc = mocs.find((m) => m.seq === 1);
  if (moc === undefined || moc.trang_thai !== "binh_thuong") return [];
  const figures = moc.figures;
  if (figures === null || figures.length === 0) return [];
  return figures.slice(0, TOI_DA_CAP).map((f) => ({
    label: f.label,
    value: f.value,
  }));
}

export function hienNutXemThem(thanTran: boolean, coPhanAn: boolean): boolean {
  return thanTran || coPhanAn;
}

export function nhanOSpine(
  seq: number,
  loai: string | null,
  chuaXem: boolean,
): string {
  const loaiSach = (loai ?? "").trim();
  if (loaiSach === "") {
    return chuaXem ? `Mốc ${seq}, chưa xem` : `Mốc ${seq}`;
  }
  return chuaXem
    ? `Mốc ${seq}, ${loaiSach}, chưa xem`
    : `Mốc ${seq}, ${loaiSach}`;
}
