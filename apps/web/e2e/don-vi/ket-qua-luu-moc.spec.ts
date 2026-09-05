import { expect, test } from "@playwright/test";

import { ketQuaLuuMoc, type KetQuaTaiAnh } from "../../lib/anh";

/** `ketQuaLuuMoc` — thông báo hiển thị sau khi bấm Lưu trên `HanhDongMoc`
 * (`plans/2026-09-05-cua-so-tu-sua-bai.md`, mục 1, lượt vá thứ tư).
 *
 * Ca bắt lỗi: KHÔNG đổi chữ (chỉ thêm ảnh) rồi bấm Lưu ĐÚNG LÚC cửa sổ tự sửa vừa hết
 * hạn — PATCH chữ không hề chạy (không có gì để sửa), mọi ảnh bị 403 `het_cua_so_sua`.
 * Ba lượt sửa trước để lại `datAnhs([])` (xoá sạch ảnh đã chọn, kể cả tấm chưa kịp thử)
 * và `Đã lưu, nhưng ...` (nói có lưu trong khi không PATCH, không ảnh nào lên được) —
 * cả hai sai vì phép tính nằm lẫn trong hàm xử lý sự kiện của component, không ai gọi
 * riêng nó để đo. Tách ra đây để viết được đúng bốn ca dưới.
 */

const anh = (ten: string): File => new File(["x"], ten, { type: "image/png" });

const ok = (ten: string): KetQuaTaiAnh => ({ ten, loi: null });
const hong = (ten: string, loi = "Đã quá thời hạn tự sửa bài này."): KetQuaTaiAnh => ({
  ten,
  loi,
});

test("không đổi chữ, không có ảnh nào để gửi ⇒ trót lọt (không gọi tới đây trong thực tế, nhưng hàm phải đúng)", () => {
  const ra = ketQuaLuuMoc(false, [], []);
  expect(ra).toEqual({ thongBao: null, conLai: [] });
});

test("Ca bắt lỗi — không đổi chữ, MỌI ảnh đều hỏng ⇒ 'Chưa lưu được', KHÔNG phải 'Đã lưu'", () => {
  const a = anh("a.png");
  const b = anh("b.png");
  const ra = ketQuaLuuMoc(false, [a, b], [hong("a.png"), hong("b.png")]);

  expect(ra.thongBao).not.toBeNull();
  expect(ra.thongBao).toContain("Chưa lưu được");
  expect(ra.thongBao).not.toContain("Đã lưu");
  // Cả hai tấm đều hỏng ⇒ cả hai phải Ở LẠI, không mất trắng lựa chọn của người dùng.
  expect(ra.conLai).toEqual([a, b]);
});

test("đổi chữ thành công, một ảnh hỏng ⇒ vẫn 'Đã lưu, nhưng ...' — có cái thật sự lưu", () => {
  const a = anh("a.png");
  const ra = ketQuaLuuMoc(true, [a], [hong("a.png")]);

  expect(ra.thongBao).toContain("Đã lưu, nhưng");
  expect(ra.conLai).toEqual([a]);
});

test("không đổi chữ, một ảnh lên được một ảnh hỏng ⇒ 'Đã lưu, nhưng ...', chỉ giữ tấm hỏng", () => {
  const a = anh("a.png");
  const b = anh("b.png");
  const ra = ketQuaLuuMoc(false, [a, b], [ok("a.png"), hong("b.png")]);

  expect(ra.thongBao).toContain("Đã lưu, nhưng");
  // Tấm `a` đã lên ⇒ xoá khỏi ô chọn; tấm `b` hỏng ⇒ giữ lại, đúng thứ tự đã chọn.
  expect(ra.conLai).toEqual([b]);
});

test("mọi ảnh đều lên được (hoặc không có ảnh) ⇒ trót lọt, không có gì để báo", () => {
  const a = anh("a.png");
  expect(ketQuaLuuMoc(true, [a], [ok("a.png")])).toEqual({
    thongBao: null,
    conLai: [],
  });
  expect(ketQuaLuuMoc(true, [], [])).toEqual({ thongBao: null, conLai: [] });
});
