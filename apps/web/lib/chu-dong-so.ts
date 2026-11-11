/** Chữ của hộp xác nhận và form đóng / mở lại sổ — THEO LOẠI MẠCH.
 *
 * Chủ đề thảo luận (`loai_mach === "thao_luan"`) dùng lại ĐÚNG cơ chế đóng sổ của nhật ký, nhưng
 * chữ của nhật ký ("nối thêm mốc", "Mổ xẻ sau lệnh / Bài học rút ra") vô nghĩa với nó, và có một
 * câu đang NÓI SAI: `mo_lai` xoá cả `ket_qua` lẫn `bai_hoc` (với chủ đề đó là "Tổng kết"), mà
 * người bấm nay có thể là mod chứ không phải người đã viết chúng.
 *
 * Tách ra file thuần (không React, không import) để bài đo đơn vị kiểm được CHỮ mà không cần
 * trình duyệt. Nhật ký / bài viết (`laChuDe = false`) giữ NGUYÊN VĂN chữ cũ — form-ghi.spec.ts
 * canh một câu trong số đó ("Không nối thêm mốc"). */

export function cauXacNhanDongSo(laChuDe: boolean): string {
  if (laChuDe) {
    return (
      `Đóng chủ đề này?\n\n` +
      `• Bình luận thì vẫn viết được.\n` +
      `• Mở lại được trong một hạn ngắn — hạn chót sẽ hiện ngay ở khu này.`
    );
  }
  return (
    `Đóng sổ mạch này?\n\n` +
    `• Không nối thêm mốc được nữa.\n` +
    `• Bình luận thì vẫn viết được.\n` +
    `• Mở lại được trong một hạn ngắn — hạn chót sẽ hiện ngay ở khu này.`
  );
}

export function cauXacNhanMoLai(laChuDe: boolean): string {
  if (laChuDe) {
    return (
      "Mở lại chủ đề này?\n\n" +
      "Dòng kết quả và Tổng kết đã ghi khi đóng sẽ bị xoá " +
      "(nhật ký quản trị vẫn lưu bản cũ)."
    );
  }
  return "Mở lại mạch này?\n\nDòng kết quả đã ghi khi đóng sổ sẽ bị xoá.";
}

export type ChuFormDongSo = {
  nhanKetQua: string;
  goiYKetQua: string;
  ghiChuKetQua: string;
  nhanBaiHoc: string;
  goiYBaiHoc: string;
};

export function chuFormDongSo(laChuDe: boolean): ChuFormDongSo {
  if (laChuDe) {
    return {
      // `/chu-de` chỉ hiện `ket_qua` (≤ 40 ký tự), còn `bai_hoc` chỉ hiện ở trang chủ đề — nên
      // người đóng phải được nhắc rằng ô đầu mới là thứ người ta thấy ở kho.
      nhanKetQua: "Tóm tắt một dòng (hiện ở kho chủ đề)",
      goiYKetQua: "Kết luận của cuộc thảo luận trong một dòng",
      ghiChuKetQua:
        "Một dòng tự do, hiện ở kho chủ đề, trên trang chủ và trên thẻ chia sẻ. Bỏ trống cũng được.",
      nhanBaiHoc: "Tổng kết (hiện ở trang chủ đề)",
      goiYBaiHoc: "Các ý chính và điểm đã ngã ngũ của cuộc thảo luận…",
    };
  }
  return {
    nhanKetQua: "Kết quả",
    goiYKetQua: "Tóm tắt kết quả trong một dòng",
    ghiChuKetQua: "Một dòng tự do, hiện ở đầu trang và trên thẻ chia sẻ. Bỏ trống cũng được.",
    nhanBaiHoc: "Mổ xẻ sau lệnh / Bài học rút ra",
    goiYBaiHoc:
      "Ghi lại bài học kinh nghiệm, phân tích sai lầm hoặc điều đã làm tốt để rèn giũa kỷ luật...",
  };
}
