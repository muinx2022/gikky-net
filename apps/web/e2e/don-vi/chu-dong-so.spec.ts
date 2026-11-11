import { expect, test } from "@playwright/test";

import { cauXacNhanDongSo, cauXacNhanMoLai, chuFormDongSo } from "../../lib/chu-dong-so";

/** Chữ của hộp xác nhận + form đóng / mở lại sổ theo loại mạch (plan homepage-v2, vòng sửa 1,
 * việc 2). Nhật ký / bài viết giữ NGUYÊN VĂN chữ cũ (chuỗi dưới đây chép từ bản trước khi đổi);
 * chủ đề nói đúng điều `mo_lai` làm: xoá cả `ket_qua` lẫn `bai_hoc` ("Tổng kết"). */

test("nhật ký / bài viết: chữ CŨ nguyên văn", () => {
  expect(cauXacNhanDongSo(false)).toBe(
    "Đóng sổ mạch này?\n\n" +
      "• Không nối thêm mốc được nữa.\n" +
      "• Bình luận thì vẫn viết được.\n" +
      "• Mở lại được trong một hạn ngắn — hạn chót sẽ hiện ngay ở khu này.",
  );
  expect(cauXacNhanMoLai(false)).toBe(
    "Mở lại mạch này?\n\nDòng kết quả đã ghi khi đóng sổ sẽ bị xoá.",
  );
  expect(chuFormDongSo(false)).toEqual({
    nhanKetQua: "Kết quả",
    goiYKetQua: "Tóm tắt kết quả trong một dòng",
    ghiChuKetQua: "Một dòng tự do, hiện ở đầu trang và trên thẻ chia sẻ. Bỏ trống cũng được.",
    nhanBaiHoc: "Mổ xẻ sau lệnh / Bài học rút ra",
    goiYBaiHoc:
      "Ghi lại bài học kinh nghiệm, phân tích sai lầm hoặc điều đã làm tốt để rèn giũa kỷ luật...",
  });
});

test("chủ đề: xác nhận mở lại NÊU Tổng kết sẽ bị xoá; xác nhận đóng bỏ câu nối mốc", () => {
  const mo_lai = cauXacNhanMoLai(true);
  expect(mo_lai).toContain("Tổng kết");
  expect(mo_lai).toContain("kết quả");
  expect(mo_lai).toContain("nhật ký quản trị vẫn lưu bản cũ");
  expect(mo_lai).not.toBe(cauXacNhanMoLai(false));

  const dong = cauXacNhanDongSo(true);
  expect(dong).not.toContain("nối thêm mốc");
  expect(dong).not.toContain("Đóng sổ mạch");
  expect(dong).toContain("Bình luận thì vẫn viết được");
});

test("chủ đề: nhãn form nhắc `ket_qua` hiện ở kho, `bai_hoc` là Tổng kết; không chữ của nhật ký", () => {
  const f = chuFormDongSo(true);
  expect(f.nhanKetQua).toBe("Tóm tắt một dòng (hiện ở kho chủ đề)");
  expect(f.nhanBaiHoc).toBe("Tổng kết (hiện ở trang chủ đề)");
  const tat_ca = Object.values(f).join(" | ");
  for (const chu_cu of ["Mổ xẻ sau lệnh", "Bài học rút ra", "kỷ luật", "sai lầm", "mốc"]) {
    expect(tat_ca, `chữ của nhật ký "${chu_cu}" lọt sang chủ đề`).not.toContain(chu_cu);
  }
});
