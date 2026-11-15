/** Trần chữ bối cảnh của khối "Chủ đề tuần".
 *
 * `xem_truoc.trich` trên API đã nới `DAI_TRICH_FEED = 400` để thẻ feed đủ năm dòng cạnh
 * ảnh nhỏ (`plans/2026-11-15-fill-trich-cao-anh.md`). Khối chủ đề đọc cùng trường ấy
 * nhưng cố ý giữ 240: sáu dòng CSS vẫn hiện trọn bối cảnh ở viewport 390 — plan
 * `2026-11-13-ban-tin-len-dau-ban-quyen` và e2e T13. Nâng trần này mà không nâng clamp
 * thì chữ bị cắt giữa chừng trên điện thoại; hạ `DAI_TRICH_FEED` thì thẻ feed lại hết
 * chữ trước năm dòng.
 *
 * Hàm thuần, không nhập React: bộ `don-vi` đo được từng nhánh.
 */
export const DAI_BOI_CANH_CHU_DE = 240;

/** Cắt `xem_truoc.trich` xuống `DAI_BOI_CANH_CHU_DE`.
 *
 * Cùng tinh thần `trich_van_ban` (`api/api/trinh_bay.py`): không dài hơn trần thì giữ
 * nguyên; dài hơn thì cắt ở khoảng trắng (U+0020) gần nhất nếu khoảng đó nằm sau 60%
 * trần — cắt giữa từ đọc như lỗi, còn khoảng trắng quá sớm thì cắt cứng để khỏi còn
 * vài chữ. Có cắt thì bỏ khoảng trắng cuối rồi thêm `…`. Chuỗi vào đã là văn bản thuần
 * từ API; hàm không gỡ HTML hay markdown lần nữa.
 */
export function catBoiCanhChuDe(trich: string): string {
  if (trich.length <= DAI_BOI_CANH_CHU_DE) return trich;
  const cat = trich.slice(0, DAI_BOI_CANH_CHU_DE);
  const khoang = cat.lastIndexOf(" ");
  const dau = khoang > DAI_BOI_CANH_CHU_DE * 0.6 ? cat.slice(0, khoang) : cat;
  return `${dau.trimEnd()}…`;
}
