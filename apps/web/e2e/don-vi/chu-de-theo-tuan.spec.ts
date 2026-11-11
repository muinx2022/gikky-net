import { expect, test } from "@playwright/test";

import { chonChuDeNoi, nhomTheoTuan, sapMoiXuatBanTruoc, tuanVNCua } from "../../lib/chu-de";

/** Nhóm chủ đề theo TUẦN giờ Việt Nam cho kho `/chu-de` (`lib/chu-de.ts`, plan homepage-v2
 * §3.8 và K1). Hàm thuần — đo các ranh giới mà bản build thật khó dựng.
 *
 * Tuần = thứ Hai 00:00 → Chủ nhật 23:59 **giờ VN (UTC+7)**. Cái bẫy là máy chạy Node ở UTC: đọc
 * `getDay()` thì 23:30 Chủ nhật giờ VN (16:30 UTC) vẫn đúng, nhưng 00:30 thứ Hai giờ VN là
 * 17:30 Chủ nhật UTC — lệch sang tuần trước nếu quên cộng 7 giờ. */

test("nhãn đúng khuôn 'Tuần dd/mm – dd/mm/yyyy' (thứ Hai → Chủ nhật)", () => {
  // Thứ Tư 11/11/2026 10:00 giờ VN ⇒ tuần thứ Hai 09/11 → Chủ nhật 15/11.
  expect(tuanVNCua("2026-11-11T03:00:00Z")).toEqual({
    khoa: "2026-11-09",
    nhan: "Tuần 09/11 – 15/11/2026",
  });
  expect(tuanVNCua("2026-11-16T00:00:00+07:00").nhan).toBe("Tuần 16/11 – 22/11/2026");
});

test("ranh giới: 23:59 Chủ nhật giờ VN còn thuộc tuần cũ, 00:00 thứ Hai giờ VN sang tuần mới", () => {
  const cn = tuanVNCua("2026-11-15T23:59:59+07:00"); // Chủ nhật 15/11
  const t2 = tuanVNCua("2026-11-16T00:00:00+07:00"); // thứ Hai 16/11
  expect(cn.khoa).toBe("2026-11-09");
  expect(t2.khoa).toBe("2026-11-16");
});

test("lệch múi giờ: cùng một khoảnh khắc viết bằng UTC hay +07 cho cùng một tuần", () => {
  // 17:30 UTC Chủ nhật 15/11 = 00:30 thứ Hai 16/11 giờ VN ⇒ tuần của 16/11, KHÔNG phải tuần cũ.
  expect(tuanVNCua("2026-11-15T17:30:00Z").khoa).toBe("2026-11-16");
  expect(tuanVNCua("2026-11-16T00:30:00+07:00").khoa).toBe("2026-11-16");
  // 16:59 UTC Chủ nhật = 23:59 Chủ nhật VN ⇒ tuần cũ.
  expect(tuanVNCua("2026-11-15T16:59:59Z").khoa).toBe("2026-11-09");
});

test("tuần vắt qua tháng và qua năm ghi đủ năm ở hai đầu khi cần", () => {
  // Thứ Hai 26/10/2026 → Chủ nhật 01/11/2026: qua tháng, cùng năm.
  expect(tuanVNCua("2026-10-28T12:00:00+07:00").nhan).toBe("Tuần 26/10 – 01/11/2026");
  // Thứ Hai 28/12/2026 → Chủ nhật 03/01/2027: qua năm.
  const nam = tuanVNCua("2027-01-01T12:00:00+07:00");
  expect(nam.khoa).toBe("2026-12-28");
  expect(nam.nhan).toBe("Tuần 28/12/2026 – 03/01/2027");
});

test("thời điểm hỏng thì NÉM, không rơi vào một tuần bịa", () => {
  expect(() => tuanVNCua("khong-phai-ngay")).toThrow();
});

test("nhomTheoTuan: feed đã mới → cũ thì nhóm mới → cũ, hai chủ đề cùng tuần chung một nhóm", () => {
  const ds = [
    { id: 1, published_at: "2026-11-12T03:00:00Z" }, // tuần 09/11
    { id: 2, published_at: "2026-11-10T03:00:00Z" }, // tuần 09/11
    { id: 3, published_at: "2026-11-05T03:00:00Z" }, // tuần 02/11
    { id: 4, published_at: "2026-10-20T03:00:00Z" }, // tuần 19/10
  ];
  const nhom = nhomTheoTuan(ds);
  expect(nhom.map((n) => n.khoa)).toEqual(["2026-11-09", "2026-11-02", "2026-10-19"]);
  expect(nhom.map((n) => n.items.map((x) => x.id))).toEqual([[1, 2], [3], [4]]);
  expect(nhom[0].nhan).toBe("Tuần 09/11 – 15/11/2026");
});

test("nhomTheoTuan: mục cùng tuần KHÔNG liền kề vẫn gom lại", () => {
  const ds = [
    { id: 1, published_at: "2026-11-12T03:00:00Z" }, // 09/11
    { id: 2, published_at: "2026-11-05T03:00:00Z" }, // 02/11
    { id: 3, published_at: "2026-11-11T03:00:00Z" }, // 09/11 lại
  ];
  const nhom = nhomTheoTuan(ds);
  expect(nhom.map((n) => n.items.map((x) => x.id))).toEqual([[1, 3], [2]]);
});

test("nhomTheoTuan: rỗng ⇒ không nhóm nào", () => {
  expect(nhomTheoTuan([])).toEqual([]);
});

/* Vòng sửa 4 — feed `moi` sắp theo `last_content_at`, không phải `published_at`: một chủ đề CŨ
 * được nối mốc dài nhảy lên đầu feed. Mọi chỗ cần "mới nhất" phải tự sắp theo `published_at`. */

test("nhomTheoTuan: feed đầu là chủ đề CŨ (bị đẩy lên) ⇒ vẫn xếp tuần mới trước, trong tuần mục mới trước", () => {
  const ds = [
    { id: 1, published_at: "2026-10-20T03:00:00Z" }, // tuần 19/10, bị đẩy lên đầu feed
    { id: 2, published_at: "2026-11-10T03:00:00Z" }, // tuần 09/11
    { id: 3, published_at: "2026-11-11T03:00:00Z" }, // tuần 09/11, mới hơn id 2
    { id: 4, published_at: "2026-11-03T03:00:00Z" }, // tuần 02/11
  ];
  const nhom = nhomTheoTuan(ds);
  expect(nhom.map((n) => n.khoa)).toEqual(["2026-11-09", "2026-11-02", "2026-10-19"]);
  expect(nhom.map((n) => n.items.map((x) => x.id))).toEqual([[3, 2], [4], [1]]);
});

test("sapMoiXuatBanTruoc: published_at giảm dần, hoà ⇒ id lớn trước, không đổi mảng gốc", () => {
  const ds = [
    { id: 5, published_at: "2026-11-10T03:00:00Z" },
    { id: 9, published_at: "2026-11-10T03:00:00Z" },
    { id: 7, published_at: "2026-11-12T03:00:00Z" },
    { id: 1, published_at: "2026-11-09T22:00:00-05:00" }, // = 10/11 03:00Z, hoà với 5 và 9
  ];
  const goc = ds.map((x) => x.id);
  expect(sapMoiXuatBanTruoc(ds).map((x) => x.id)).toEqual([7, 9, 5, 1]);
  expect(ds.map((x) => x.id)).toEqual(goc);
});

test("chonChuDeNoi: chọn cái XUẤT BẢN sau cùng chứ không phải phần tử đầu; rỗng ⇒ []", () => {
  const ds = [
    { id: 1, published_at: "2026-10-20T03:00:00Z" }, // đầu feed, nhưng là chủ đề cũ
    { id: 2, published_at: "2026-11-10T03:00:00Z" }, // mới tạo nhất
    { id: 3, published_at: "2026-11-05T03:00:00Z" },
  ];
  expect(chonChuDeNoi(ds).map((x) => x.id)).toEqual([2]);
  expect(chonChuDeNoi([])).toEqual([]);
  // Mốc hỏng không bao giờ thắng và không làm hàm ném.
  expect(chonChuDeNoi([{ id: 8, published_at: "hỏng" }, ds[0]]).map((x) => x.id)).toEqual([1]);
});
